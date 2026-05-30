require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
// 🌟 AIライブラリを読み込む
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = require("./hexagrams");
const lines = [];

const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, '').trim();

fs.createReadStream("lines_3.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🌟 ここがAI連携の核心部分！
app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  // 爻のデータを探す
  const l = lines.find(line => String(line.hexagram_id) === String(hid) && String(line.line_name) === String(l_name));

  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  
  // AIへのプロンプト（指示書）
  const prompt = `
    あなたはちいかわの世界のガイドです。
    以下の情報を元に、ちいかわ、ハチワレ、うさぎの3人のセリフと、鎧さんのアドバイスを考えてください。
    
    【卦】${h.name}：${h.emotion}
    【空の様子】${h.sky_name}：${h.sky_description_kawaii || h.chiikawa_scene}
    【爻の意味】${l ? l.chiikawa_line_emotion : '特になし'}
    
    必ず以下のJSON形式だけで答えてください。
    {"chiikawa": "ちいかわのセリフ", "hachiware": "ハチワレのセリフ", "usagi": "うさぎのセリフ", "advice": "鎧さんのアドバイス"}
  `;

  try {
    const result = await model.generateContent(prompt);
    const aiText = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(aiText);
    
    res.json({
      ...h,
      line_name: l ? l.line_name_kawaii : l_name,
      ...aiData
    });
  } catch (e) {
    console.error("AI生成エラー:", e);
    // AIが失敗したとき用の予備データ（これまでのCSVデータ）
    res.json({ ...h, chiikawa: "…", hachiware: "…", usagi: "ヤハ", advice: h.yoroi_advice || "ぼちぼちいこう。" });
  }
});

app.post("/callback", express.json(), async (req, res) => {
  const events = req.body.events;
  for (const event of events) {
    if (event.type !== "message" || event.message.type !== "text") continue;
    
    const h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
    const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=1`;

    const flexMessage = {
      type: "flex",
      altText: `${h.name}の占い結果`,
      contents: {
        type: "bubble",
        body: {
          type: "box",
          layout: "vertical",
          backgroundColor: "#0f172a",
          paddingAll: "xl",
          contents: [
            { type: "text", text: h.name, weight: "bold", size: "xxl", color: "#ffffff", align: "center" },
            { type: "box", layout: "vertical", margin: "xl", paddingAll: "sm", borderColor: "#ffffff", borderWidth: "1px", cornerRadius: "md", action: { type: "uri", label: "Open", uri: finalUrl }, contents: [{ type: "text", text: "Open Card", color: "#ffffff", align: "center" }] }
          ]
        }
      }
    };
    await client.replyMessage(event.replyToken, flexMessage);
  }
  res.sendStatus(200);
});

app.listen(process.env.PORT || 10000);
