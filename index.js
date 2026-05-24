require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const app = express();

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = [];
const lines = [];

// 💡 CSV読み込み時に「見えないゴミ文字(BOM)」を完全に削除する設定を追加
fs.createReadStream("hexagrams.csv")
  .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: ({ header }) => header.replace(/^\uFEFF/, '').trim() }))
  .on("data", (data) => lines.push(data));

// データ取得用API
app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  
  if (hexagrams.length === 0 || lines.length === 0) {
    return res.status(500).json({ error: "サーバーがCSVデータをまだ読み込み中です。少し待ってね！" });
  }

  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: `占い番号「${hid}」のデータがCSVに見つかりませんでした。` });
  
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  let l = matchedLines.find(line => String(line.line_name) === String(l_name));
  if (!l) l = matchedLines[0] || { line_name: "全体", line_emotion: "ふんわり" };

  res.json({
    name: h.name || "無名の卦", 
    weather: h.weather || "曇り", 
    emotion: h.emotion || "おだやか", 
    line_name: l.line_name || "全体", 
    line_emotion: l.line_emotion || "まったり", 
    meaning: h.meaning || "のんびり過ごすとき", 
    advice: "3人が身を寄せ合って空を見上げているな。今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    chiikawa: h.chiikawa_line || "わッ…！",
    hachiware: h.hachiware_line || "なんとかなるさ！",
    usagi: h.usagi_line || "ヤハ！",
    video: "https://www.w3schools.com/html/mov_bbb.mp4"
  });
});

app.use(express.static(__dirname));

// LINEからのメッセージ受信
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;
      
      if (hexagrams.length === 0 || lines.length === 0) {
        await client.replyMessage(event.replyToken, { type: "text", text: "占いのデータを準備中だよ！1秒後にまた送ってみてね！" });
        continue;
      }

      const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
      const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
      const l = matchedLines[Math.floor(Math.random() * matchedLines.length)] || { line_name: "全体" };

      const myUrl = `https://${req.get('host')}`;
      const finalUrl = `${myUrl}?hid=${h.id}&l_name=${encodeURIComponent(l.line_name)}`;

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
