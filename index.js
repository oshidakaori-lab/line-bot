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
    name: h.name, weather: h.weather, emotion: h.emotion,
    line_name: l.line_name, line_emotion: l.line_emotion || "ふんわりした予感",
    meaning: h.meaning,
    advice: "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line, hachiware: h.hachiware_line, usagi: h.usagi_line
  });
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

      // 🌟 3. LINEに送るメッセージをスッキリ修正！
      await client.replyMessage(event.replyToken, {
        type: "text",
        // 【修正ポイント】以前の「(全体)」という表示を消して、綺麗に【卦の名前】（〇爻）と出るようにしたよ！
        text: `🔮 今日の「空の易」占い結果が出たよ！\n【${h.name}】（${lName}）\n下のボタンを押して、可愛いイラストカードを開いてみてね👇`,
        quickReply: { items: [{ type: "action", action: { type: "uri", label: "カードを開く 🃏", uri: finalUrl } }] }
      });
    }
    res.sendStatus(200);
  } catch (error) { console.error(error); res.sendStatus(500); }
});

    res.sendStatus(200);
  } catch (error) { console.error(error); res.sendStatus(500); }
});


app.use(express.static(__dirname));
app.listen(process.env.PORT || 10000);
