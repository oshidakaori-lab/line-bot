require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const app = express();

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

let hexagrams = [];
let lines = [];
const lastFortune = new Map();

const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

// 卦と爻のデータを読み込み
fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  const lineIndex = parseInt(l_name) || 1;
  let l = matchedLines.find(line => String(line.line) === String(lineIndex)) || {};

  res.json({
    name: h.name,
    weather: h.weather,
    sky_name: h.sky_name,
    emotion: h.emotion,
    emotion_type: h.emotion_action,
    line_name: l.line_name_kawaii || l_name,
    line_emotion: l.chiikawa_line_emotion || "静かに巡る空の気配",
    chiikawa_scene: h.sky_description_kawaii || "みんなですやすや眠っているみたい。",
    advice: h.yoroi_advice || "ゆっくり過ごすといいぞ。",
    chiikawa: l.chiikawa_line || "フゥン",
    hachiware: l.hachiware_line || "なんとかなれーッ",
    usagi: l.usagi_line || "ヤハ",
    image: h.image,
    bgm: h.bgm
  });
});

app.post("/callback", express.json(), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== "message" || event.message.type !== "text") continue;
    
    const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
    const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=1`;

    const flexMessage = {
      type: "flex",
      altText: `${h.name}の占い結果`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#0f172a",
          paddingAll: "xl",
          contents: [
            { type: "text", text: h.name, weight: "bold", size: "xxl", color: "#ffffff", align: "center" },
            { type: "box", layout: "vertical", margin: "xl", paddingAll: "sm", borderColor: "#ffffff", borderWidth: "1px", cornerRadius: "md", action: { type: "uri", label: "Open", uri: finalUrl }, contents: [{ type: "text", text: "Open Card", color: "#ffffff", align: "center" }] }
          ]
        }
      }
    };
    await client.replyMessage(event.replyToken, flexMessage);
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 10000);
