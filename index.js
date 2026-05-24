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
  
  // 卦（け）を1つ選ぶ
  const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  // その卦に対応する「爻（こう）」を1つ選ぶ（lines.csvから）
  const l = lines.filter(line => line.hexagram_id === h.id)[Math.floor(Math.random() * 6)];

  // これをHTMLに渡す準備完了！
  return { 
    name: h.name, 
    weather: h.weather, 
    emotion: h.emotion,          // CSVのemotion（例：湧き立つよろこび）
    line_emotion: l.line_emotion, // 爻の感情（例：空へ伸びていく感覚）
    meaning: h.meaning,          // CSVのmeaning（例：「湧く」無限湧き発生ッ！）
    advice: "今は無理せず美味しいもの食べよう！", // ここは後で好きなように変えてね
    chiikawa: h.chiikawa_line,
    hachiware: h.hachiware_line,
    usagi: h.usagi_line
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

      
      // さっき作った generateFortune() を呼び出す
const result = generateFortune();

// URLを作る（ここが魔法の言葉！）
const url = `https://https://line-bot-v2rk.onrender.com/index.html?name=${encodeURIComponent(result.name)}&emotion=${encodeURIComponent(result.emotion)}&line_emotion=${encodeURIComponent(result.line_emotion)}&meaning=${encodeURIComponent(result.meaning)}&advice=${encodeURIComponent(result.advice)}&chiikawa=${encodeURIComponent(result.chiikawa)}&hachiware=${encodeURIComponent(result.hachiware)}&usagi=${encodeURIComponent(result.usagi)}`;

// LINEでボタンとして送る
await client.replyMessage(event.replyToken, {
  type: "text",
  text: "今日の占いだよ！",
  quickReply: {
    items: [{
      type: "action",
      action: { type: "uri", label: "カードを開く", uri: url }
    }]
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
