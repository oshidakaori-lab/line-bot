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
    line_name: l.line_name || l_name, // 👈 読み込みが間に合わなくても必ず「◯爻」が入る
    line_emotion: l.line_emotion || "静かに巡る空の気配", // 👈 より世界観に合うフォールバック
    meaning: h.meaning,
    advice: "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line, 
    hachiware: h.hachiware_line, 
    usagi: h.usagi_line,
    color: h.color
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
  altText: `🔮 【${h.name}】が届いたよ`,
  contents: {
    type: "bubble",
    size: "kilo",
    body: {
      type: "box",
      layout: "vertical",
      borderColor: frameColor,
      borderWidth: "bold",
      cornerRadius: "xl",
      paddingAll: "xl", // 余白を広めにとって空気感を出すよ
      backgroundColor: "#0f172a",
      contents: [
        // 🪐 1. レアリティ（上部にふわっと浮かせる）
        {
          type: "text",
          text: `•  ${h.rarity}  •`,
          weight: "bold",
          color: frameColor,
          align: "center",
          size: "xs",
          letterSpacing: "md" // 文字の間隔を広げて、シンプルで洗練された印象に
        },
        // 🔮 2. メインのタイトル（ドーンと大きく、でもシンプルに）
        {
          type: "text",
          text: h.name,
          weight: "bold",
          size: "xxl", // サイズを1歩大きくして存在感アップ！
          color: "#ffffff",
          align: "center",
          margin: "lg"
        },
        // 爻（ひっそりと寄り添うように）
        {
          type: "text",
          text: lName,
          size: "xs",
          color: "#64748b",
          align: "center",
          margin: "none"
        },
        // 🌤 3. 空模様（中央に仕切り線を入れず、空間で魅せる）
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
        // 🃏 4. ボタン（ベタ塗りをやめて、軽やかなアウトラインに！）
        {
          type: "button",
          style: "outline", // 👈 ここをカスタム！
          borderColor: frameColor,
          borderWidth: "semi-bold",
          margin: "xxl",
          height: "sm",
          action: {
            type: "uri",
            label: "Open Card", // あえて英語にして海外のミニマルデザイン風に
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
 