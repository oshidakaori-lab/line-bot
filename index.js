require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = [];
const lines = [];
const lastFortune = new Map(); // 連続で同じ結果が出ないように記憶する箱

// CSV読み込み設定
const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, '').trim();

fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🌟 HTML画面からのリクエスト（ここでAIが会話を作るよ！）
app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  // 爻のデータを探す処理を修正
  const l = lines.find(line => String(line.hexagram_id) === String(h?.id) && String(line.line) === String(l_name));

  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `あなたは「ちいかわ」の世界のガイドです。以下の情報から、ちいかわ達の会話と鎧さんのアドバイスを生成してください。
  【卦】${h.name}: ${h.sky_description_kawaii} (${h.emotion_action_kawaii})
  【爻】${l ? l.line_name_kawaii : ""}: ${l ? l.chiikawa_line_emotion : ""}
  
  必ずJSON形式（"chiikawa", "hachiware", "usagi", "advice", "chiikawa_scene"）のみで回答して。マークダウンは不要です。`;

  try {
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text().replace(/```json|```/g, "").trim());
    res.json({ ...h, ...aiData, bgm: h.bgm || "default.mp3" });
  } catch (e) {
    console.error(e);
    res.json({ ...h, chiikawa: "…", hachiware: "…", usagi: "ヤハ", advice: "ゆっくりいこう。", chiikawa_scene: h.sky_description_kawaii, bgm: h.bgm || "default.mp3" });
  }
});

// 🌟 LINEからのメッセージ受け取り（ここが前回消えちゃってた部分！）
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      if (hexagrams.length === 0) continue; // データ準備中ならスキップ

      // ランダムに占いの結果（卦）を選ぶ
      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

      // ランダムに爻（1〜6）を選ぶ
      const lineIndex = Math.floor(Math.random() * 6) + 1;
      const lName = `${lineIndex}爻`; 

      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lineIndex)}`;

      // LINEに送るシンプルなカード（レアリティなし・白枠）
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
                      { type: "text", text: h.sky_name || "不思議な空", size: "md", color: "#cbd5e1", align: "center" }
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
