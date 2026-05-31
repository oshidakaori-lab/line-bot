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

// CSV読み込み設定
const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, '').trim();

fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));

app.use(express.static(__dirname));

app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  const l = lines.find(line => String(line.hexagram_id) === String(hid) && String(line.line) === String(l_name));

  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const prompt = `あなたは「ちいかわ」の世界のガイドです。以下の情報から、ちいかわ達の会話と鎧さんのアドバイスを生成してください。
  【卦】${h.name}: ${h.sky_description_kawaii} (${h.emotion_action_kawaii})
  【爻】${l ? l.line_name_kawaii : ""}: ${l ? l.chiikawa_line_emotion : ""}
  
  JSON形式（"chiikawa", "hachiware", "usagi", "advice", "chiikawa_scene"）で回答して。`;

  try {
    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text().replace(/```json|```/g, ""));
    res.json({ ...h, ...aiData, bgm: h.bgm || "default.mp3" });
  } catch (e) {
    res.json({ ...h, chiikawa: "…", hachiware: "…", usagi: "ヤハ", advice: "ゆっくりいこう。", chiikawa_scene: h.sky_description_kawaii, bgm: h.bgm || "default.mp3" });
  }
});

app.listen(process.env.PORT || 10000);
