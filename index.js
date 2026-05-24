// 1. 準備
require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai"); // 👈ここを追加！

// 2. インスタンス作成
const app = express();
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);


// 3. データ読み込み
const hexagrams = [];
const lines = [];
fs.createReadStream("hexagrams.csv").pipe(csv()).on("data", (data) => hexagrams.push(data));
fs.createReadStream("lines.csv").pipe(csv()).on("data", (data) => lines.push(data));

// 4. 関数定義
function generateFortune() {
  if (hexagrams.length === 0) return null;
  const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  return { 
    name: h.name, kana: h.kana, weather: h.weather || "晴れ", 
    emotion: h.emotion || "ワクワク", icon: "☀️",
    line_name: "初九", line_emotion: "新しい始まり",
    advice: "焦らず、まずは深呼吸してみるのがおすすめだぞ。",
    chiikawa: "ワァ…！", hachiware: "なんとかなれッ！", usagi: "ヤハ！",
    video: "https://example.com/sunny.mp4" 
  };
}

async function getFortune(userMessage) {
    try {
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash-latest" });
        const prompt = `ユーザーの悩み：「${userMessage}」。これについて、易占いの結果とちいかわの世界観で回答して。
        必ず以下のJSONのみで返して: {name, kana, weather, emotion, icon, line_name, line_emotion, advice, chiikawa, hachiware, usagi, video}`;
        
        const result = await model.generateContent(prompt);
        return JSON.parse(result.response.text());
    } catch (e) {
        console.error("AI失敗、CSVへバックアップします:", e);
        return generateFortune(); 
    }
}


// 5. ルーティング設定（ここが真ん中に来るよ！）
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;
      const result = await getFortune(event.message.text);
      const queryParams = new URLSearchParams({
        name: result.name, icon: result.icon, weather: result.weather,
        emotion: result.emotion, line_name: result.line_name,
        line_emotion: result.line_emotion, advice: result.advice,
        chiikawa: result.chiikawa, hachiware: result.hachiware,
        usagi: result.usagi, video: result.video
      }).toString();
      const liffUrl = `https://liff.line.me/2010171447-1dyDX3Dk?${queryParams}`;

      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "占いカード",
        contents: {
          type: "bubble",
          hero: { type: "image", url: "https://cdn.pixabay.com/photo/2016/11/18/17/46/house-1836070_1280.jpg", size: "full", aspectMode: "cover" },
          body: { type: "box", layout: "vertical", contents: [{ type: "text", text: result.name, weight: "bold", size: "xl" }] },
          footer: { type: "box", layout: "vertical", contents: [{ type: "button", style: "primary", color: "#4682B4", action: { type: "uri", label: "空を見る 🌌", uri: liffUrl } }] }
        }
      });
    }
    res.sendStatus(200);
  } catch (err) {
    console.error(err);
    res.sendStatus(200);
  }
});

// 6. サーバー起動（一番最後！）
app.listen(process.env.PORT || 10000);
