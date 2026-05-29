require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const app = express();

const hexagrams = require("./hexagrams"); 

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const lines = [];
const lastFortune = new Map();

const cleanHeader = ({ header }) => header.replace(/^[\uFEFF\u200B]+/, '').trim();

fs.createReadStream("lines_3.csv") // 🌟 lines.csv から lines_3.csv に変更！
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));


app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// index.js の app.get("/api/fortune", ...) の中身をこれに差し替えてね！

app.get("/api/fortune", (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });
  
  // 🌟 LINE側と合わせて、数字（line）または文字列で確実にCSVから爻を特定するよ
  const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
  const lineIndex = parseInt(l_name) || 1; 
  let l = matchedLines.find(line => String(line.line) === String(lineIndex) || String(line.line_name) === String(l_name)) || {};

  res.json({
    name: h.name, 
    weather: h.weather,
    sky_name: h.sky_name,
    emotion: h.emotion,
    emotion_type: h.emotion_type,
    
    // 🌟 LINEで集めていた「可愛い爻の名前」と「その時の感情」をHTMLへ引き継ぐ！
    line_name: l.line_name_kawaii || l.line_name || l_name, 
    line_emotion: l.chiikawa_line_emotion || l.soranoeki_line_emotion || "静かに巡る空の気配",
    
    // 🌟 【ご要望】meaning を chiikawa_scene に変更！
    chiikawa_scene: h.chiikawa_scene || "みんなですやすや眠っているみたい。",
    
    // 🌟 【ご要望】鎧さんの見守り助言をHTMLにまとめる！
    advice: h.yoroi_advice || "今は無理せず、美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。",
    
    // 🌟 3人の可愛いセリフ（爻のCSVデータにあれば優先、なければ卦のJSから取得）
    chiikawa: l.chiikawa_line || h.chiikawa_line || "フゥン", 
    hachiware: l.hachiware_line || h.hachiware_line || "なんとかなれーッ", 
    usagi: l.usagi_line || h.usagi_line || "ヤハ",
    
    color: h.color,
    image: h.image
  });
});


app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      
      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

            // 1〜6の爻をランダムで選ぶ
      const lineIndex = Math.floor(Math.random() * 6) + 1; // 1〜6の数字
      const lName = `${lineIndex}爻`; // 画面表示用の「○爻」

      // 🌟 新しい lines_2.csv の構造に合わせて、数字（line）で確実に探すよ！
      const matchedLines = lines.filter(line => String(line.hexagram_id) === String(h.id));
      const l = matchedLines.find(line => String(line.line) === String(lineIndex)) || {};
      
      // 🌟 CSVから可愛いセリフたちを抜き出す
      const kawaiiName = l.line_name_kawaii || lName;         // 「ぴょん，でてきた…！」
      const chiikawaEmotion = l.chiikawa_line_emotion || "";   // 「立ち上がる力，出てきた…！」
      const chiikawaWord = l.chiikawa_line || "";             // 「いいスタート！」


      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lName)}`;

      // 🌟 ここにちいかわランクの色設定をしっかり入れたよ！
      const rarityColors = {
        "超ハレバレ SSR…ってコト？！！": "#fbbf24", // ゴールド
        "フワラッキー SR…ってコト？！": "#38bdf8", // ブルー
        "プチホッコリ R…ってコト！？": "#4ade80", // グリーン
        "ボチボチ N…ってコト": "#94a3b8"      // グレー
      };
      
      // もし rarity が見つからなかったら白になる
      const frameColor = rarityColors[h.rarity] || "#ffffff";

      // 🌟 Flex Messageの作成（エラー完全撃退版！）
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
                  // 🌟 ここにあった「📝 今のちいかわたちの様子」と「🛡 鎧さんの助言」を削除！
                  // 🃏 すぐに「Open Card」ボタンを配置！
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
