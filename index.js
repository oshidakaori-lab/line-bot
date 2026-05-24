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

// CSVから読み込んだデータを格納する箱
const hexagrams = [];
const lines = [];

// サーバー起動時にCSVファイルを読み込む
fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => hexagrams.push(data));

fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => lines.push(data));

// 占いの結果を生成する関数
function generateFortune() {
  if (hexagrams.length === 0 || lines.length === 0) return null;
  
  // 1. 64個の「卦(け)」からランダムに1つ選ぶ
  const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  
  // 2. 選んだ卦のIDに一致する「爻(こう)」の行だけをlines.csvから集める
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  
  // 3. その中からさらにランダムで1つ選ぶ（通常は0〜6番目のどれか）
  let l = matchedLines[Math.floor(Math.random() * matchedLines.length)];
  
  // もし爻が見つからなかったときの安全対策
  if (!l) {
    l = { line_name: "全体", line_emotion: "ふんわりした予感" };
  }

  // 4. 新しく追加したい「meaning」や「line_emotion」もまとめて返すよ！
  return { 
    name: h.name, 
    weather: h.weather, 
    emotion: h.emotion,          // 卦の感情（例：湧き立つよろこび）
    line_name: l.line_name,      // 爻の名前（例：九二）
    line_emotion: l.line_emotion, // 爻の感情（例：空へ伸びていく感覚）
    meaning: h.meaning,          // 今日のシチュエーション
    advice: "3人が身を寄せ合って空を見上げているな。今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。", // 鎧さんの助言
    chiikawa: h.chiikawa_line || "わッ…！",
    hachiware: h.hachiware_line || "なんとかなりそう？",
    usagi: h.usagi_line || "ヤハ！",
    video: "https://www.w3schools.com/html/mov_bbb.mp4" // 仮の動画URL（後でお好みの動画に変えてね）
  };
}

// 静的ファイル（index.htmlなど）を公開する設定
app.use(express.static(__dirname));

// LINE Bot からメッセージが届いたときの処理
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      // テキストメッセージ以外は無視する
      if (event.type !== "message" || event.message.type !== "text") continue;
      
      // 占い結果を作る（ここでresultを作るのは1回だけに修正したよ！）
      const result = generateFortune();
      if (!result) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "データがまだ準備中みたい…少し待ってからもう一度試してね！"
        });
        continue;
      }

      // Render上のWebページのURLを組み立てる
      // ※あなたのRenderのURL（https://line-bot-v2rk.onrender.com）を自動で使うようにしているよ！
      const myUrl = `https://${req.get('host')}/index.html`;
      
      // URLに占いの結果データを全部くっつける（URLパラメータ）
      const finalUrl = `${myUrl}?name=${encodeURIComponent(result.name)}&weather=${encodeURIComponent(result.weather)}&emotion=${encodeURIComponent(result.emotion)}&line_name=${encodeURIComponent(result.line_name)}&line_emotion=${encodeURIComponent(result.line_emotion)}&meaning=${encodeURIComponent(result.meaning)}&advice=${encodeURIComponent(result.advice)}&chiikawa=${encodeURIComponent(result.chiikawa)}&hachiware=${encodeURIComponent(result.hachiware)}&usagi=${encodeURIComponent(result.usagi)}&video=${encodeURIComponent(result.video)}`;

      // LINEにメッセージを返信する
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: `🔮 今日の「空の易」占い結果が出たよ！\n【${result.name}】\n下のボタンを押して、可愛いイラストカードを開いてみてね👇`,
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
    console.error("エラーが発生しました:", error);
    res.sendStatus(500);
  }
});

// ポート10000番でサーバーを起動
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
