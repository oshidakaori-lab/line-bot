require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const app = express();

// 🌟 CSVではなく、新色（midnightなど）が入った完璧な hexagrams.js を直接使う！
const hexagrams = require("./hexagrams"); 

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const lines = [];
// 💡 重複防止用の記憶箱
const lastFortune = new Map();

const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

// lines.csv の読み込み
fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));

app.use(express.static(__dirname));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🔮 占い詳細データをフロントに返すAPI
app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });
  
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  let l = matchedLines.find(line => String(line.line_name) === String(l_name)) || { line_name: l_name };

  res.json({
    name: h.name, 
    weather: h.weather,
    sky_name: h.sky_name,
    emotion: h.emotion,
    emotion_type: h.emotion_type,
    line_name: l.line_name,
    line_emotion: l.line_emotion || "ふんわりした予感",
    meaning: h.meaning,
    advice: "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line, 
    hachiware: h.hachiware_line, 
    usagi: h.usagi_line,
    color: h.color
    // 💡 background-imageは使わないので、imageフィールドは返さなくてOK！
  });
}); // 👈 🌟 ここで綺麗に閉じました！

// 🤖 LINEからのメッセージを受け取るコールバック
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      
      // 1. 完全ランダム（等確率）で卦を選ぶ！
      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

      // 2. 1〜6の爻をランダムで選ぶ
      const lineIndex = Math.floor(Math.random() * 6) + 1; 
      const lName = `${lineIndex}爻`; 

      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lName)}`;

      // 🌟 レアリティごとの枠線カラー
      const rarityColors = {
        "SSR": "#fbbf24", // ゴールド
        "SR": "#38bdf8",  // アジュールブルー
        "R": "#4ade80",   // リーフグリーン
        "N": "#94a3b8"    // グレー
      };
      
      const frameColor = rarityColors[h.rarity] || "#ffffff";

      // 🌟 Flex Messageの作成
      const flexMessage = {
        type: "flex",
        altText: `🔮 今日の占い結果：【${h.name}】`,
        contents: {
          type: "bubble",
          size: "kilo",
          body: {
            type: "box",
            layout: "vertical",
            borderColor: frameColor, 
            borderWidth: "bold",
            cornerRadius: "xl",
            paddingAll: "lg",
            backgroundColor: "#0f172a",
            contents: [
              {
                type: "text",
                text: `✨ ${h.rarity} ✨`,
                weight: "bold",
                color: frameColor,
                align: "center",
                size: "sm"
              },
              {
                type: "text",
                text: `【${h.name}】(${lName})`,
                weight: "bold",
                size: "xl",
                color: "#ffffff",
                align: "center",
                margin: "md"
              },
              {
                type: "text",
                text: `空模様: ${h.sky_name}`,
                size: "xs",
                color: "#cbd5e1",
                align: "center",
                margin: "sm"
              },
              {
                type: "button",
                style: "primary",
                color: frameColor,
                margin: "lg",
                height: "sm",
                action: {
                  type: "uri",
                  label: "カードを開く 🃏",
                  uri: finalUrl
                }
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
