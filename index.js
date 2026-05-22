require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai"); // ハイフンなしの公式パッケージに修正
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
        if (path.endsWith(".mp4")) {
          res.set("Content-Type", "video/mp4");
          res.set("Accept-Ranges", "bytes");
        }
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
          res.set("Content-Type", "image/jpeg");
        }
        if (path.endsWith(".gif")) {
          res.set("Content-Type", "image/gif");
        }
      },
    }
  )
);

// あなたのRenderサーバーのURL
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
// Gemini API 初期化（完全無料枠）
// ======================
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ======================
// CSV 読み込み（新カラム・爻対応版）
// ======================
const hexagrams = [];
const lines = [];

fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => { hexagrams.push(data); })
  .on("end", () => { console.log("ちいかわ特化・卦CSV読込完了:", hexagrams.length); });

fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => { lines.push(data); })
  .on("end", () => { console.log("ちいかわ特化・爻CSV読込完了:", lines.length); });

function getWeatherIcon(weather) {
  if (weather?.includes("晴")) return "☀️";
  if (weather?.includes("雨")) return "🌧️";
  if (weather?.includes("雷")) return "⛈️";
  if (weather?.includes("風")) return "🌪️";
  if (weather?.includes("曇")) return "☁️";
  return "✨";
}

// ======================
// Geminiによる占いメッセージ生成
// ======================
async function generateGeminiAdvice(result) {
  try {
    const prompt = `
あなたは「空の易」という、空模様と易経を融合した占いAIです。
以下のちいかわ達の掛け合いや、卦と爻の意味、空気感をベースにして、ちいかわの世界観に寄り添った短く優しい占いメッセージを生成してください。

【今回の占いデータ】
卦名: ${result.name} (${result.kana})
爻名: ${result.line_name} (${result.line_emotion})
天気: ${result.weather}
今回の全体の雰囲気: ${result.emotion}
詳細な意味: ${result.meaning}

【キャラクターたちの様子】
ちいかわ: 「${result.chiikawa_line}」
ハチワレ: 「${result.hachiware_line}」
うさぎ: 「${result.usagi_line}」

【出力ルール】
・ちいかわの世界観をベースにした、優しくて少し不穏さもある、励ましの言葉にしてください。
・日本語のみ、1文、改行禁止で「80文字以内」で出力してください。
・「空」「風」「雲」「光」「雨」「雷」などの自然表現を必ずどれか1つ文章に含めてください。
・AIとしての言葉として出力し、「ちいかわ:」などのキャラ名は文頭につけないでください。
`;

    // 無料で最速の Gemini 1.5 Flash を呼び出し
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const response = await model.generateContent(prompt);
    const text = response.text; // 最新の取得方法に修正

    return text.replace(/\n/g, "").slice(0, 80).trim();

  } catch (err) {
    console.log("Gemini Error:", err.message);
    // エラーが起きたことが分かりやすいように、仮の文字を変更します
    return `${result.weather}の空を見上げて、みんなでチャリメラを食べよう。`;
  }
}

// ======================
// 占いデータ抽出（ちいかわ新CSV完全準拠・卦と爻の合体）
// ======================
function generateFortune() {
  if (hexagrams.length === 0 || lines.length === 0) return null;

  // 1. ランダムに1つの卦を引く
  const hexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  
  // 2. ランダムに爻（0〜6）を選ぶ（0は卦全体の意味、1〜6は各爻）
  const lineNum = Math.floor(Math.random() * 7); 

  // 3. lines.csv から該当する爻のデータを引っ張ってくる
  const selectedLine = lines.find(
    (l) => Number(l.Hexagram_id) === Number(hexagram.id) && Number(l.line) === lineNum
  );

  return {
    name: hexagram.name,
    kana: hexagram.kana,
    weather: hexagram.weather,
    emotion: hexagram.emotion,
    meaning: hexagram.meaning,
    // 爻のデータがあれば上書き、なければ卦のデータを使う
    line_name: selectedLine ? selectedLine.line_name : "卦",
    line_emotion: selectedLine ? selectedLine.line_emotion : hexagram.emotion,
    chiikawa_line: selectedLine ? selectedLine.chiikawa_line : hexagram.chiikawa_line,
    hachiware_line: selectedLine ? selectedLine.hachiware_line : hexagram.hachiware_line,
    usagi_line: selectedLine ? selectedLine.usagi_line : hexagram.usagi_line,
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

      // Geminiで占いテキストを生成
      result.aiAdvice = await generateGeminiAdvice(result);  

      const videoUrl = `${IMAGE_BASE}${result.video}`;
      const previewUrl = `${IMAGE_BASE}${result.preview}`;

      // LINEに送るメッセージを構築（新CSVの3人全員のセリフを並べるリッチ版！）
      const messages = [
        {
          type: "video",
          originalContentUrl: videoUrl,
          previewImageUrl: previewUrl
        },
        {
          type: "text",
          text: `【空の易】\n${getWeatherIcon(result.weather)} ${result.weather}（${result.emotion}）\n\n🔮 卦：${result.name} (${result.kana})\n✨ 状態：${result.line_name} — ${result.line_emotion}\n\n💌 AIの助言：\n${result.aiAdvice}\n\n🐾 ちいかわ「${result.chiikawa_line}」\n🐾 ハチワレ「${result.hachiware_line}」\n🐾 うさぎ「${result.usagi_line}」`
        }
      ];

      console.log("Gemini完全版 送信データ:", result);  
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
app.listen(PORT, () => { console.log("Gemini完全版 起動成功！"); });
