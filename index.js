require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const lineConfig = {
  channelSecret: process.env.LINE_CHANNEL_SECRET || "",
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || ""
};

const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = [];
const hexagramLines = [];
const lastFortune = new Map();

const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, "").trim();

// 図鑑データの読み込み
fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ separator: "\t", mapHeaders: cleanHeader }))
  .on("data", (data) => {
    if (data && data.id) hexagrams.push(data);
  })
  .on("end", () => console.log(`【図鑑】卦のデータを ${hexagrams.length} 件読み込みました。`));

fs.createReadStream("lines.csv")
  .pipe(csv({ separator: "\t", mapHeaders: cleanHeader }))
  .on("data", (data) => {
    if (data && data.hexagram_id) hexagramLines.push(data);
  })
  .on("end", () => console.log(`【図鑑】爻のデータを ${hexagramLines.length} 件読み込みました。`));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 画面（フロント）用API
app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => item && item.id && String(item.id) === String(hid));
  const l = hexagramLines.find(line => String(line.hexagram_id) === String(h?.id) && String(line.line) === String(l_name));

  if (!h) return res.status(404).json({ error: "卦のデータが見つかりません。" });

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

  const prompt = `ちいかわの世界のやさしい空気感で、以下の「空の様子」と「データ」をもとに、みんなのやり取りと鎧さんの言葉を考えてください。
  
【データ】
・卦名: ${h.name} (${h.sky_name || h.soranoeki_sky || "不思議な空"})
・空の様子: ${h.soranoeki_sky_description || h.sky_description || "いつもと違う特別な空模様。"}
・みんなの雰囲気: ${h.feeling_kawaii || h.emotion_description || "みんなで空を見上げているよ。"}
* 変化の様子（爻の状況）: ${l ? l.line_name_kawaii : "全体の雰囲気"}

【セリフと情景の厳格なルール】
1. ちいかわは文章で喋らせず、「…」「…ンショ」「…わぁ」「…ッ」のような短い健気なつぶやきに。
2. ハチワレのセリフから「ちいかわちゃん」という呼びかけを省略。
3. うさぎは「ヤハ！」「ウララララ！」「プルャ！」などの叫び声のみ。
4. 鎧さんは、ぶっきらぼうだけど最高に優しい包み込むようなお兄さんのような口調（語尾は「〜だぞ」「〜な」「〜か？」など）
5. 「あなた」「三者三様」「お前たち」などの人称や難しい言葉は含めない。
6. chiikawa_sceneは、絵本のようにふんわりとしたやわらかい雰囲気に。

必ず以下のJSON形式のみで回答してください。
{
  "chiikawa": "つぶやき",
  "hachiware": "セリフ",
  "usagi": "叫び",
  "advice": "言葉",
  "chiikawa_scene": "情景描写"
}`;

  try {
    const result = await model.generateContent(prompt);
    const cleanText = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(cleanText);
    res.json({ ...h, ...aiData, bgm: h.bgm || "default.mp3" });
  } catch (e) {
    console.error("AI generateContent error:", e);
    res.json({
      ...h,
      chiikawa: "…わぁ",
      hachiware: "なんだか不思議な空だね…！おもしろいね。",
      usagi: "ヤハ！！",
      advice: "大丈夫だぞ、のんびりいこうな。",
      chiikawa_scene: "淡い光がやさしく広がって、みんなでゆったり空を見上げているね…",
      bgm: h.bgm || "default.mp3"
    });
  }
});

// LINE送受信（案内を省略して、カードだけをスッキリ送る形にしました）
app.post("/callback", line.middleware(lineConfig), express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;

      if (hexagrams.length === 0) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "いま図鑑のデータをひらいているところだから、もういっかい話しかけてみてね！🐥"
        });
        continue;
      }

      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h && h.id === lastFortune.get(userId) && attempts < 20);

      if (!h || !h.id) continue;

      lastFortune.set(userId, h.id);

      const lineIndex = Math.floor(Math.random() * 6) + 1;
      const lName = `${lineIndex}爻`;
      const finalUrl = `https://${req.get("host")}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lineIndex)}`;
      const skyTitle = h.sky_name || h.soranoeki_sky || "不思議な空";

      const flexMessage = {
        type: "flex",
        altText: `🔮 【${h.name || "空の占い"}】が届いたよ`,
        contents: {
          type: "bubble",
          body: {
            type: "box",
            layout: "vertical",
            backgroundColor: "#ffffff",
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
                  { type: "text", text: h.name || "空の易", weight: "bold", size: "xxl", color: "#ffffff", align: "center", margin: "none" },
                  { type: "text", text: lName, size: "xs", color: "#64748b", align: "center", margin: "md" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "CURRENT SKY", size: "xxs", color: "#475569", align: "center", weight: "bold" },
                      { type: "text", text: skyTitle, size: "md", color: "#cbd5e1", align: "center" }
                    ]
                  },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    paddingAll: "sm",
                    borderColor: "#ffffff",
                    borderWidth: "semi-bold",
                    cornerRadius: "md",
                    action: { type: "uri", label: "Open Card", uri: finalUrl },
                    contents: [
                      { type: "text", text: "空のカードを開く ➔", color: "#ffffff", align: "center", weight: "bold", size: "sm" }
                    ]
                  }
                ]
              }
            ]
          }
        }
      };

      // 純粋にFlex Message（カード）だけをリプライします
      await client.replyMessage(event.replyToken, flexMessage);
    }

    res.sendStatus(200);
  } catch (error) {
    console.error("callback handler error:", error);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
