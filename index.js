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
    line_name: l.line_name || l_name, 
    line_emotion: l.line_emotion || "静かに巡る空の気配",
    meaning: h.meaning,
    advice: "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line, 
    hachiware: h.hachiware_line, 
    usagi: h.usagi_line,
    color: h.color
  });
});

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
            // 🌟 Flex Messageの作成（100%エラー回避版！）
      const flexMessage = {
        type: "flex",
        altText: `🔮 【${h.name}】が届いたよ`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: frameColor, // 枠線の色を外側の背景として敷く
            paddingAll: "2px",           // 枠線の太さ
            cornerRadius: "xl",
            contents: [
              {
                type: "box",
                layout: "vertical",
                backgroundColor: "#0f172a", // 内側のメイン背景色
                cornerRadius: "xl",
                paddingAll: "xl",
                contents: [
                  // 🪐 1. レアリティ
                  {
                    type: "text",
                    text: `•  ${h.rarity}  •`,
                    weight: "bold",
                    color: frameColor,
                    align: "center",
                    size: "xs"
                  },
                  // 🔮 2. メインのタイトル
                  {
                    type: "text",
                    text: h.name,
                    weight: "bold",
                    size: "xxl",
                    color: "#ffffff",
                    align: "center",
                    margin: "lg"
                  },
                  // 爻
                  {
                    type: "text",
                    text: lName,
                    size: "xs",
                    color: "#64748b",
                    align: "center",
                    margin: "none"
                  },
                  // 🌤 3. 空模様
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xxl",
                    spacing: "xs",
                    contents: [
                      {
                        type: "text",
                        text: "CURRENT SKY",
                        size: "xxs",
                        color: "#475569",
                        align: "center",
                        weight: "bold"
                      },
                      {
                        type: "text",
                        text: h.sky_name,
                        size: "md",
                        color: "#cbd5e1",
                        align: "center"
                      }
                    ]
                  },
                  // 🃏 4. ボタン（※ボタンコンポーネントを使わず、箱と文字で自作する安全策！）
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xxl",
                    paddingAll: "sm",
                    borderColor: frameColor, // 外枠の色
                    borderWidth: "semi-bold",
                    cornerRadius: "md",
                    action: {
                      type: "uri",
                      label: "Open Card",
                      uri: finalUrl
                    },
                    contents: [
                      {
                        type: "text",
                        text: "Open Card",
                        color: frameColor, // 文字の色
                        align: "center",
                        weight: "bold",
                        size: "sm"
                      }
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
