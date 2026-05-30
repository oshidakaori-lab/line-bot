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

// 🌟 データを入れる空の箱を用意するよ
let hexagrams = [];
let lines = [];
const lastFortune = new Map();

// ヘッダーのゴミ（BOM）を取り除く関数
const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

// 🌟 1. 卦のデータをCSVから読み込む！
fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data))
  .on("end", () => console.log("Hexagrams CSV loaded!"));

// 🌟 2. 爻のデータをCSVから読み込む！
fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data))
  .on("end", () => console.log("Lines CSV loaded!"));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });
  
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  const lineIndex = parseInt(l_name) || 1; 
  let l = matchedLines.find(line => String(line.line) === String(lineIndex) || String(line.line_name) === String(l_name)) || {};

  // 🌟 HTMLへ送るデータを準備！CSVの新しい列名に合わせたよ。
  res.json({
    name: h.name, 
    weather: h.weather,
    sky_name: h.sky_name,
    emotion: h.emotion,
    emotion_type: h.emotion_action, // 👈 csvの列名に合わせました
    
    line_name: l.line_name_kawaii || l.line_name || l_name, 
    line_emotion: l.chiikawa_line_emotion || l.soranoeki_line_emotion || "静かに巡る空の気配",
    
    // 🌟 csvの列名に合わせて取得
    chiikawa_scene: h.sky_description_kawaii || h.sky_description || "みんなですやすや眠っているみたい。",
    
    // 🌟 見守り助言
    advice: h.yoroi_advice || "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    
    chiikawa: l.chiikawa_line || h.chiikawa_line || "フゥン", 
    hachiware: l.hachiware_line || h.hachiware_line || "なんとかなれーッ", 
    usagi: l.usagi_line || h.usagi_line || "ヤハ",
    
    color: h.color,
    image: h.image,
    bgm: h.bgm // 🌟 BGMを追加！
  });
});

app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      
      // データがまだ読み込めていない時のエラー回避
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

      const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
      const l = matchedLines.find(line => String(line.line) === String(lineIndex)) || {};
      
      // const kawaiiName = l.line_name_kawaii || lName;
      // const chiikawaEmotion = l.chiikawa_line_emotion || ""; 
      // const chiikawaWord = l.chiikawa_line || ""; 

      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lName)}`;

      const rarityColors = {
        "SSR": "#fbbf24", // ゴールド
        "SR": "#38bdf8", // ブルー
        "R": "#4ade80", // グリーン
        "N": "#94a3b8"  // グレー
      };
      
      const frameColor = rarityColors[h.rarity] || "#ffffff";

      const flexMessage = {
        type: "flex",
        altText: `🔮 【${h.name}】が届いたよ`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: frameColor,
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
                  { type: "text", text: `•  ${h.rarity}  •`, weight: "bold", color: frameColor, align: "center", size: "xs" },
                  { type: "text", text: h.name, weight: "bold", size: "xxl", color: "#ffffff", align: "center", margin: "lg" },
                  { type: "text", text: lName, size: "xs", color: "#64748b", align: "center", margin: "none" },
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
                    borderColor: frameColor,
                    borderWidth: "semi-bold",
                    cornerRadius: "md",
                    action: { type: "uri", label: "Open Card", uri: finalUrl },
                    contents: [
                      { type: "text", text: "Open Card", color: frameColor, align: "center", weight: "bold", size: "sm" }
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
