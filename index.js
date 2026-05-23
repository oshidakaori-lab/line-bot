require("dotenv").config(); // 👈 小文字の「require」に修正して環境変数を確実に有効化！

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");

const app = express();

// 静的ファイルの配信設定（画像・動画）
app.use(express.static("public", {
  maxAge: "1d",
  acceptRanges: true,
  setHeaders: (res, filePath) => {
    if (filePath.endsWith(".mp4")) { res.set("Content-Type", "video/mp4"); res.set("Accept-Ranges", "bytes"); }
    if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) res.set("Content-Type", "image/jpeg");
    if (filePath.endsWith(".gif")) res.set("Content-Type", "image/gif");
  }
}));

const BASE_URL = "https://line-bot-v2rk.onrender.com";
const IMAGE_BASE = `${BASE_URL}/images/`;

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
// Geminiから占いを取得
// ======================
async function generateGeminiAdvice(result) {
  try {
    const prompt = `
あなたは、ちいかわ達（ちいかわ、ハチワレ、うさぎ）を少し離れたところから優しく見守る「鎧さん」のような存在であり、同時に「空の易」の占い師です。
以下の【今回の占いデータ】と【3人の様子】を読み解き、彼らがこの空模様の中でどれほど仲良く寄り添い合っているかを描写しつつ、ユーザーへ向けた「大人としての優しいアドバイス」で総括する文章を作ってください。

【今回の占いデータ】
・本卦: ${result.name} (${result.kana})
・天気と全体の情緒: ${result.weather} / ${result.emotion}
・引いた爻: ${result.line_name} (${result.line_emotion})

【3人の様子】
・ちいかわ: 「${result.chiikawa_line}」
・ハチワレ: 「${result.hachiware_line}」
* うさぎ: 「${result.usagi_line}」

【出力ルール】
1. 最初に、この美しい空の下で3人がギュッと身を寄せ合ってお互いを気遣い合って「仲良くしすぎている微笑ましい様子」を見守り目線で優しく描写してください。
2. 最後に、「鎧さん」の口調（「〜だぞ」「〜するといい」「〜だな」など）で、ユーザーの心に寄り添うアドバイス的ひとことで締めくくってください。
3. 日本語のみ、全体で「120文字以内」、改行はせず1つの文章として出力してください。文字装飾やキャラクター名は絶対に付けないでください。
`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });

    const rawText = await response.text();
    let data = JSON.parse(rawText);
    
    if (data.error) throw new Error(data.error.message);

    const text = data.candidates[0].content.parts[0].text;
    return text.replace(/\n/g, "").slice(0, 120).trim();

  } catch (err) {
    console.log("🚨 [Gemini通信エラー最終防衛線]:", err.message);
    return "3人が身を寄せ合って不思議な空を見上げているな。今は無理せず美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。";
  }
}

// ======================
// 占いデータ抽出
// ======================
function generateFortune() {
  if (hexagrams.length === 0 || lines.length === 0) return null;

  const hexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  const lineNum = Math.floor(Math.random() * 6) + 1; 

  const selectedLine = lines.find(
    (l) => Number(l.Hexagram_id) === Number(hexagram.id) && Number(l.line) === lineNum
  );

  return {
    name: hexagram.name || "易の気配",
    kana: hexagram.kana || "えきのけはい",
    weather: hexagram.weather || "曇り",
    emotion: hexagram.emotion || "静寂",
    meaning: hexagram.meaning || "移り変わる気配",
    line_num: lineNum,
    
    line_name: selectedLine ? selectedLine.line_name : `${lineNum}爻`,
    line_emotion: selectedLine ? selectedLine.line_emotion : "移り変わる気配",
    chiikawa_line: selectedLine ? selectedLine.chiikawa_line : "わッ…！",
    hachiware_line: selectedLine ? selectedLine.hachiware_line : "なんとかなりそう？",
    usagi_line: selectedLine ? selectedLine.usagi_line : "ヤハ！",
    
    video: "sunny.mp4", // 🚨 テスト用に完全に安全な動画で固定
    preview: "sunny.jpg" // 🚨 テスト用に完全に安全な画像で固定
  };
}

// ======================
// Webhook ハンドラ
// ======================
// 🚨 エラーの原因になるline.middlewareを外し、express.json()でLIFF通信もすべて優しく受け入れます！
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;

    // 検証対策
    if (!events || events.length === 0 || (events[0] && events[0].replyToken === "00000000000000000000000000000000")) {
      return res.sendStatus(200);
    }

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const result = generateFortune();  
      if (!result) {
        await client.replyMessage(event.replyToken, { type: "text", text: "空を読み込み中です…☁️" });  
        continue;  
      }  

      result.aiAdvice = await generateGeminiAdvice(result);  

      const videoUrl = `${IMAGE_BASE}${result.video}`;
      const previewUrl = `${IMAGE_BASE}${result.preview}`;
      const icon = getWeatherIcon(result.weather);

      const cleanText = (str) => {
        if (!str) return "";
        return str.replace(/[\r\n\t\f\v]/g, " ").replace(/\\/g, "/").trim();
      };

      const safeAdvice = cleanText(result.aiAdvice || "今は無理せずゆっくり過ごすといいぞ。");
      const safeChiikawa = cleanText(result.chiikawa_line || "わッ…！");
      const safeHachiware = cleanText(result.hachiware_line || "なんとかなりそう？");
      const safeUsagi = cleanText(result.usagi_line || "ヤハ！");
      const safeLineName = cleanText(result.line_name || "初爻");
      const safeLineEmotion = cleanText(result.line_emotion || "移り変わる気配");
      const safeWeather = cleanText(result.weather || "曇り");
      const safeKana = cleanText(result.kana || "えきのけはい");

      const params = new URLSearchParams({
        name: result.name,
        kana: safeKana,
        weather: safeWeather,
        emotion: result.emotion,
        line_name: safeLineName,
        line_emotion: safeLineEmotion,
        advice: safeAdvice,
        chiikawa: safeChiikawa,
        hachiware: safeHachiware,
        usagi: safeUsagi,
        video: videoUrl,
        icon: icon
      });

      const webPageUrl = `https://liff.line.me/2010170006-KZK8g4zg?${params.toString()}`;

      const messages = [
        {
          type: "flex",
          altText: `【空の易】占いが出たぞ：${result.name}`,
          contents: {
            type: "bubble",
            hero: {
              type: "image",
              url: previewUrl,
              size: "full",
              aspectRatio: "20:13",
              aspectMode: "cover"
            },
            body: {
              type: "box",
              layout: "vertical",
              contents: [
                { type: "text", text: `【空の易】${icon} ${safeWeather}`, weight: "bold", size: "sm", color: "#888888" },
                { type: "text", text: `${result.name} (${safeKana})`, weight: "bold", size: "xl", margin: "md" },
                { type: "text", text: `${safeLineName}（${safeLineEmotion}）`, size: "md", color: "#555555", margin: "sm" }
              ]
            },
            footer: {
              type: "box",
              layout: "vertical",
              spacing: "sm",
              contents: [
                {
                  type: "button",
                  style: "primary",
                  color: "#4682B4",
                  action: {
                    type: "uri",
                    label: "シネマティック画面で見る 🌌",
                    uri: webPageUrl
                  }
                }
              ]
            }
          }
        }
      ];

      await client.replyMessage(event.replyToken, messages);  
    }  
    res.sendStatus(200);

  } catch (err) {
    console.log("====== ERROR DISCOVERED ======");
    console.log("メッセージ:", err.message);
    if (err.response && err.response.data) {
      console.log(JSON.stringify(err.response.data, null, 2));
    }
    res.sendStatus(500);
  }
});

// ポート10000番で完全固定
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => { console.log("LIFF準備版 起動成功！"); });
