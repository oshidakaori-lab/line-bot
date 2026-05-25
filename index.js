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

// CSV読み込み
fs.createReadStream("hexagrams.csv").pipe(csv()).on("data", (data) => hexagrams.push(data));
fs.createReadStream("lines.csv").pipe(csv()).on("data", (data) => lines.push(data));

// 1. トップページにアクセスされたら index.html を返す設定
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// 2. 占い結果API
app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });
  
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  let l = matchedLines.find(line => String(line.line_name) === String(l_name));
  if (!l) l = matchedLines[0] || { line_name: "全体", line_emotion: "ふんわりした予感" };

  res.json({
    name: h.name, 
    weather: h.weather, 
    emotion: h.emotion,
    line_name: l.line_name,
    line_emotion: l.line_emotion,
    meaning: h.meaning,
    advice: "3人が身を寄せ合って空を見上げているな。今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line || "わッ…！",
    hachiware: h.hachiware_line || "なんとなんとそう？",
    usagi: h.usagi_line || "ヤハ！",
    // 💡 URLの https:// が重複していたので1回に直しました
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fsky.mp4?alt=media&token=98456177-ef82-41bc-8b53-75da87b85674"
  });
});

app.use(express.static(__dirname));

// 3. どんなURLでも index.html に飛ばす魔法の受け皿（これがあるとCannot GETを防げる！）
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

// LINEのやり取り
app.post("/callback", express.json(), async (req, res) => {

  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;
      
      if (hexagrams.length === 0 || lines.length === 0) {
        await client.replyMessage(event.replyToken, { type: "text", text: "占いの準備中だよ、ちょっと待ってね！" });
        continue;
      }

      // ランダムに卦と爻を選ぶ
      const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
      const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
      const l = matchedLines[Math.floor(Math.random() * matchedLines.length)] || { line_name: "全体" };

      const myUrl = `https://${req.get('host')}/index.html`;
      
      // 🌟【超重要】URLにはIDと爻の名前だけを乗せる（これで文字数がめちゃくちゃ短くなる！）
      const finalUrl = `${myUrl}?hid=${h.id}&l_name=${encodeURIComponent(l.line_name)}`;

      // LINEにボタン付きで返信する
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `🔮 今日の「空の易」占い結果が出たよ！\n【${h.name}】\n下のボタンを押して、可愛いイラストカードを開いてみてね👇`,
        quickReply: {
          items: [
            {
              type: "action",
              action: {
                type: "uri",
                label: "カードを開く 🃏",
                uri: finalUrl
              }
            }
          ]
        }
      });
    }
    res.sendStatus(200);
  } catch (error) {
    console.error("LINE送信エラー:", error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
