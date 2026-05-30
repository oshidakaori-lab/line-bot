require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
// 🌟 AIの脳みそを呼び出すよ！
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// 🌟 環境変数（Render）からAPIキーをセット！
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

let hexagrams = [];
let lines = [];
const lastFortune = new Map();

// ヘッダーのゴミを綺麗にする関数
const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

// 🌟 CSVデータの読み込み（名前をアップロードされたファイルに合わせているよ）
fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data))
  .on("end", () => console.log("Hexagrams CSV loaded!"));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data))
  .on("end", () => console.log("Lines CSV loaded!"));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🌟 ここがAIの魔法を使うメイン部分！
app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  const lineIndex = parseInt(l_name) || 1; 
  let l = matchedLines.find(line => String(line.line) === String(lineIndex) || String(line.line_name) === String(l_name)) || {};

  // 🤖 AIへの指示書（プロンプト）
  // 君の作ったCSVデータをAIに渡して、場面を想像させるよ！
  const prompt = `
    あなたは「ちいかわ」の世界のガイドです。
    以下の情報を元に、ちいかわ、ハチワレ、うさぎの3人の会話と、鎧さんのアドバイス、そして今の情景（ちいかわ達の様子）を考えてください。

    【空の様子】${h.sky_name}：${h.sky_description_kawaii}
    【全体の感情】${h.emotion_action_kawaii}
    【今の状況（爻）】${l.line_name_kawaii}：${l.chiikawa_line_emotion}

    必ず以下のJSON形式だけで答えてください。マークダウン（\`\`\`jsonなど）は不要です。
    {
      "chiikawa": "ちいかわのセリフ（短め）",
      "hachiware": "ハチワレのセリフ（短め）",
      "usagi": "うさぎのセリフ（短め）",
      "chiikawa_scene": "ちいかわ達が今何をしているかの情景描写",
      "advice": "鎧さん風の温かい見守り助言"
    }
  `;

  let aiData = {};
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);
    
    // AIが余計な記号をつけた場合に取り除く安全装置
    const text = result.response.text().replace(/```json|```/g, "").trim();
    aiData = JSON.parse(text);
    
  } catch (e) {
    console.error("AIの生成に失敗しました:", e);
    // 🛡️ AIが疲れている時（エラー時）は、君のCSVのデータを代わりに使うよ！ボットは止まりません！
    aiData = {
      chiikawa: l.chiikawa_line || "フゥン",
      hachiware: l.hachiware_line || "なんとかなれーッ",
      usagi: l.usagi_line || "ヤハ",
      chiikawa_scene: h.sky_description_kawaii || "みんなですやすや眠っているみたい。",
      advice: "今はぼちぼちいこう。"
    };
  }

  // 🌟 HTML画面（index.html）へデータを送る
  res.json({
    name: h.name, 
    weather: h.weather,
    sky_name: h.sky_name,
    emotion: h.emotion,
    emotion_type: h.emotion_action,
    line_name: l.line_name_kawaii || l.line_name || l_name, 
    line_emotion: l.chiikawa_line_emotion || l.soranoeki_line_emotion || "静かに巡る空の気配",
    chiikawa_scene: aiData.chiikawa_scene, // AIが考えた情景
    advice: aiData.advice,                 // AIが考えたアドバイス
    chiikawa: aiData.chiikawa,             // AIが考えたセリフ
    hachiware: aiData.hachiware,           // AIが考えたセリフ
    usagi: aiData.usagi,                   // AIが考えたセリフ
    color: h.color, // 背景グラデーション用
    image: h.image,
    bgm: h.bgm
  });
});

// 🌟 LINEに通知を送る処理（レアリティやカラーを消したシンプル版！）
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      if (hexagrams.length === 0) continue;

      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

      const lineIndex = Math.floor(Math.random() * 6) + 1;
      const lName = `${lineIndex}爻`; 

      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lineIndex)}`;

      // 🌟 シンプルでスタイリッシュなFlex Message
      const flexMessage = {
        type: "flex",
        altText: `🔮 【${h.name}】が届いたよ`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#ffffff",
            paddingAll: "2px",
            cornerRadius: "xl",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#0f172a",
                cornerRadius: "xl",
                paddingAll: "xl",
                contents: [
                  { type: "text", text: h.name, weight: "bold", size: "xxl", color: "#ffffff", align: "center", margin: "none" },
                  { type: "text", text: lName, size: "xs", color: "#64748b", align: "center", margin: "md" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "CURRENT SKY", size: "xxs", color: "#475569", align: "center", weight: "bold" },
                      { type: "text", text: h.sky_name, size: "md", color: "#cbd5e1", align: "center" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    paddingAll: "sm",
                    borderColor: "#ffffff",
                    borderWidth: "semi-bold",
                    cornerRadius: "md",
                    action: { type: "uri", label: "Open Card", uri: finalUrl },
                    contents: [
                      { type: "text", text: "Open Card", color: "#ffffff", align: "center", weight: "bold", size: "sm" }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      await client.replyMessage(event.replyToken, flexMessage);
    }

    res.sendStatus(200);
  } catch (error) { 
    console.error(error); 
    res.sendStatus(500); 
  }
});

app.listen(process.env.PORT || 10000);
