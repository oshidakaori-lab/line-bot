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

const hexagrams = [];
const lines = [];
// 💡 重複防止用の記憶箱
const lastFortune = new Map();

const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

fs.createReadStream("hexagrams.csv").pipe(csv({ mapHeaders: cleanHeader })).on("data", (data) => hexagrams.push(data));
fs.createReadStream("lines.csv").pipe(csv({ mapHeaders: cleanHeader })).on("data", (data) => lines.push(data));

app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });
  
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  let l = matchedLines.find(line => String(line.line_name) === String(l_name)) || { line_name: l_name };

    res.json({
    name: h.name, 
    weather: h.weather,          // 絵文字判定のための元の天気
    sky_name: h.sky_name,        // 【新】無雲高天などのエモい空の名前
    emotion: h.emotion,          // 【新】無限に澄み切った高天…などの情景描写
    emotion_type: h.emotion_type,// 【新】創造などの属性
    line_name: l.line_name,
    line_emotion: l.line_emotion || "ふんわりした予感",
    meaning: h.meaning,
    advice: "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line, 
    hachiware: h.hachiware_line, 
    usagi: h.usagi_line,
    color: h.color,
    image: h.image
  });


app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      
      // 1. 重複なしで卦を選ぶ
      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

      // 🌟 2. 1〜6の数字をランダムで生み出す！（0は絶対に出ないよ）
      const lineIndex = Math.floor(Math.random() * 6) + 1; // 1〜6のどれか
      const lName = `${lineIndex}爻`; // 👈 ここで「1爻」〜「6爻」という文字を作るよ

      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lName)}`;

      // 🌟 1. レアリティごとに枠線（とボタン）の色を定義する！
      const rarityColors = {
        "SSR": "#fbbf24", // 黄金に輝くゴールド！
        "SR": "#38bdf8",  // 鮮やかなアジュールブルー
        "R": "#4ade80",   // 優しいリーフグリーン
        "N": "#94a3b8"    // 落ち着いたグレー
      };
      
      // 該当する色を取得（もし設定がなければデフォルトの白）
      const frameColor = rarityColors[h.rarity] || "#ffffff";

      // 🌟 2. Flex Messageの枠組み（JSON）を作る
      const flexMessage = {
        type: "flex",
        altText: `🔮 今日の占い結果：【${h.name}】`, // 通知ポップアップ用テキスト
        contents: {
          type: "bubble",
          size: "kilo", // 少しコンパクトで可愛いサイズ
          body: {
            type: "box",
            layout: "vertical",
            // 👇 ここが魔法の部分！枠線の色と太さ、角丸を指定！
            borderColor: frameColor, 
            borderWidth: "bold",
            cornerRadius: "xl",
            paddingAll: "lg",
            backgroundColor: "#0f172a", // Web画面に合わせた夜空のダークブルー
            contents: [
              {
                type: "text",
                text: `✨ ${h.rarity} ✨`,
                weight: "bold",
                color: frameColor, // レアリティの文字色も枠線と同じにするよ
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
                color: frameColor, // ボタンの色もレアリティカラーに統一！
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

      // 🌟 3. Flex Messageを送信！
      await client.replyMessage(event.replyToken, flexMessage);

    res.sendStatus(200);
  } catch (error) { console.error(error); res.sendStatus(500); }
});

    res.sendStatus(200);
  } catch (error) { console.error(error); res.sendStatus(500); }
});


app.use(express.static(__dirname));
app.listen(process.env.PORT || 10000);
