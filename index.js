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

// CSVをそのままシンプルに読み込む
fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => lines.push(data));

// データ取得用API

// 💡 ここを追加！：トップページにアクセスした時の対応
app.get("/", (req, res) => {
  res.send("<h1>空の易ボットは動いているよ！</h1><p>LINEからメッセージを送って占ってみてね🐾</p>");
});
app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  
  if (hexagrams.length === 0 || lines.length === 0) {
    return res.status(500).json({ error: "サーバーがCSVデータをまだ読み込み中です。少し待ってね！" });
  }

  // 💡 補正の極意：ヘッダー名に依存せず、CSVの「絶対に1列目にある値」をIDとして確実に探す
  const h = hexagrams.find(item => {
    const keys = Object.keys(item);
    if (keys.length === 0) return false;
    const actualId = String(item[keys[0]] || '').trim(); // 1列目の値を取り出して前後の空白を消す
    return actualId === String(hid).trim();
  });

  if (!h) return res.status(404).json({ error: `占い番号「${hid}」のデータがCSVに見つかりませんでした。` });
  
  // 💡 lines.csvでも同様に1列目（hexagram_id）を安全に取得して紐付け
  const matchedLines = lines.filter(lineItem => {
    const keys = Object.keys(lineItem);
    if (keys.length === 0) return false;
    const hexIdInLine = String(lineItem[keys[0]] || '').trim();
    const targetId = String(h[Object.keys(h)[0]] || '').trim();
    return hexIdInLine === targetId;
  });

  let l = matchedLines.find(lineItem => String(lineItem.line_name).trim() === String(l_name).trim());
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
      
      // 💡 LINE側でも1列目のIDを絶対にブレないように取得
      const hKeys = Object.keys(h);
      const hId = hKeys.length > 0 ? String(h[hKeys[0]]).trim() : "";

      const matchedLines = lines.filter(lineItem => {
        const keys = Object.keys(lineItem);
        if (keys.length === 0) return false;
        return String(lineItem[keys[0]]).trim() === hId;
      });
      const l = matchedLines[Math.floor(Math.random() * matchedLines.length)] || { line_name: "全体" };

      const myUrl = `https://${req.get('host')}/index.html`;
      const finalUrl = `${myUrl}?hid=${hId}&l_name=${encodeURIComponent(l.line_name)}`;

      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `🔮 今日の「空の易」占い結果が出たよ！\n【${h.name || "占い結果"}】\n下のボタンを押して、可愛いイラストカードを開いてみてね👇`,
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
