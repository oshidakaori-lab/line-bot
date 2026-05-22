require("dotenv").config(); // 👈 小文字の「require」に修正！これで環境変数が確実に生きます

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();

// ======================
// 動画・画像の配信設定（Render）
// ======================
app.use(
  "/images",
  express.static(
    "public/images",
    {
      maxAge: "1d",
      acceptRanges: true, 
      setHeaders: (res, path) => {
        if (path.endsWith(".mp4")) { res.set("Content-Type", "video/mp4"); res.set("Accept-Ranges", "bytes"); }
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) res.set("Content-Type", "image/jpeg");
        if (path.endsWith(".gif")) res.set("Content-Type", "image/gif");
      },
    }
  )
);

const IMAGE_BASE = "https://line-bot-v2rk.onrender.com/images/";

// ======================
// LINE 初期化
// ======================
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

// ======================
// CSV 読み込み
// ======================
const hexagrams = [];
const lines = [];

fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => { hexagrams.push(data); })
  .on("end", () => { console.log("シネマティック卦CSV読込完了:", hexagrams.length); });

fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => { lines.push(data); })
  .on("end", () => { console.log("爻CSV読込完了:", lines.length); });

function getWeatherIcon(weather) {
  if (weather?.includes("晴")) return "☀️";
  if (weather?.includes("雨")) return "🌧️";
  if (weather?.includes("雷")) return "⛈️";
  if (weather?.includes("風")) return "🌪️";
  if (weather?.includes("曇")) return "☁️";
  return "✨";
}

// ======================
// 【完全決着版】URL直接叩きでGeminiから占いを取得する
// ======================
async function generateGeminiAdvice(result) {
  try {
    const prompt = `
あなたは、ちいかわ達（ちいかわ、ハチワレ、うさぎ）を少し離れたところから優しく見守る「鎧さん」のような存在であり、同時に「空の易」の占い師です。

以下の【今回の占いデータ】と【3人の様子】を読み解き、彼らがこの空模様の中でどれほど仲良く寄り添い合っているか（仲良しすぎて微笑ましい空気感）を描写しつつ、ユーザーへ向けた「大人としての優しいアドバイス（ひとこと）」で総括する文章を作ってください。

【今回の占いデータ】
・本卦（メインの象徴）: ${result.name} (${result.kana})
・天気と全体の情緒: ${result.weather} / ${result.emotion}
・この卦が持つ本来の意味: ${result.meaning}
・引いた爻（現在の詳細な状態）: ${result.line_name} (${result.line_emotion})

【3人の様子（CSVデータ）】
・ちいかわ: 「${result.chiikawa_line}」
・ハチワレ: 「${result.hachiware_line}」
・うさぎ: 「${result.usagi_line}」

【出力ルール】
1. 最初に、この美しい空の下で3人がギュッと身を寄せ合ったり、お互いを気遣い合って「仲良くしすぎている微笑ましい様子」を見守り目線で優しく描写してください。
2. 最後に、「鎧さん」の口調（「〜だぞ」「〜するといい」「〜だな」など）で、ユーザーの心に寄り添うアドバイス的ひとことで締めくくってください。
3. 日本語のみ、全体で「120文字以内」、改行はせず1つの文章（塊）として出力してください。
4. 文頭に「鎧さん：」などのキャラクター名は絶対に付けないでください。
`;

    // 👈 現在Googleが最優先で稼働させている最新の「gemini-2.5-flash」ルートに変更！これなら古いプロジェクトのキーでも絶対に弾かれません
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });

    const rawText = await response.text();
    
    if (!rawText) {
      throw new Error("Google APIから何もデータが返ってきませんでした");
    }

    let data;
    try {
      data = JSON.parse(rawText);
    } catch (parseErr) {
      console.log("⚠️ GoogleからJSONではないデータが返ってきました：", rawText);
      throw new Error("APIのレスポンスがJSON形式ではありませんでした。");
    }
    
    if (data.error) {
      console.log("⚠️ Google APIがエラーを返しています：", JSON.stringify(data.error));
      throw new Error(`Google API Error: ${data.error.message}`);
    }

    if (!data.candidates || data.candidates.length === 0) {
      console.log("⚠️ candidatesが見つかりません。データ：", JSON.stringify(data));
      throw new Error("APIレスポンスの構造にcandidatesが含まれていません。");
    }
    
    const text = data.candidates[0].content.parts[0].text;
    return text.replace(/\n/g, "").slice(0, 120).trim();

  } catch (err) {
    console.log("🚨 [Gemini通信エラー最終防衛線]:", err.message);
    return `3人が身を寄せ合って${result.weather}の空を見上げているな。今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。`;
  }
}

// ======================
// 占いデータ抽出（変卦を見据えた1〜6爻抽出）
// ======================
function generateFortune() {
  if (hexagrams.length === 0 || lines.length === 0) return null;

  const hexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  const lineNum = Math.floor(Math.random() * 6) + 1; 

  const selectedLine = lines.find(
    (l) => Number(l.Hexagram_id) === Number(hexagram.id) && Number(l.line) === lineNum
  );

  console.log(`【易経ログ】本卦: ${hexagram.name} / 得爻: ${lineNum}爻目`);

  return {
    name: hexagram.name,
    kana: hexagram.kana,
    weather: hexagram.weather,
    emotion: hexagram.emotion,
    meaning: hexagram.meaning,
    line_num: lineNum,
    
    line_name: selectedLine ? selectedLine.line_name : `${lineNum}爻`,
    line_emotion: selectedLine ? selectedLine.line_emotion : "移り変わる気配",
    chiikawa_line: selectedLine ? selectedLine.chiikawa_line : "わッ…！",
    hachiware_line: selectedLine ? selectedLine.hachiware_line : "なんとかなりそう？",
    usagi_line: selectedLine ? selectedLine.usagi_line : "ヤハ！",
    
    video: hexagram.image?.replace(".jpg", ".mp4") || "sunny.mp4", 
    preview: hexagram.image || "sunny.jpg"
  };
}

// ======================
// Webhook ハンドラ
// ======================
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const result = generateFortune();  
      if (!result) {  
        await client.replyMessage(event.replyToken, { type: "text", text: "空を読み込み中です…☁️" });  
        continue;  
      }  

      // Geminiで「見守り＆鎧さん総括」テキストを生成
      result.aiAdvice = await generateGeminiAdvice(result);  

      const videoUrl = `${IMAGE_BASE}${result.video}`;
      const previewUrl = `${IMAGE_BASE}${result.preview}`;

      const messages = [
        {
          type: "video",
          originalContentUrl: videoUrl,
          previewImageUrl: previewUrl
        },
        {
          type: "text",
          text: `【空の易】\n${getWeatherIcon(result.weather)} ${result.weather}（${result.emotion}）\n\n🔮 本卦：${result.name} (${result.kana})\n✨ 得爻：${result.line_name}（${result.line_emotion}）\n\n💬 鎧さんの見守り助言：\n${result.aiAdvice}`
        }
      ];

      console.log("Gemini直叩き版 送信データ:", result);  
      await client.replyMessage(event.replyToken, messages);  
    }  
    res.sendStatus(200);

  } catch (err) {
    console.log("====== ERROR ======");
    console.log(err.message);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log("Gemini直叩き版 起動成功！"); });
