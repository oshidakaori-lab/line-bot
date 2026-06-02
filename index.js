require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const cloudinary = require("cloudinary").v2;
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true
});

const app = express();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = [];
const lines = [];
const lastFortune = new Map(); 

const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, '').trim();

fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ separator: '\t', mapHeaders: cleanHeader }))
  .on("data", (data) => {
    if (data.id) hexagrams.push(data);
  })
  .on("end", () => console.log(`【図鑑】卦のデータを ${hexagrams.length} 件読み込みました。`));

fs.createReadStream("lines.csv")
  .pipe(csv({ separator: '\t', mapHeaders: cleanHeader }))
  .on("data", (data) => {
    if (data.hexagram_id) lines.push(data);
  })
  .on("end", () => console.log(`【図鑑】爻のデータを ${lines.length} 件読み込みました。`));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  const l = lines.find(line => String(line.hexagram_id) === String(h?.id) && String(line.line) === String(l_name));

  if (!h) return res.status(404).json({ error: "卦のデータが見つかりません。" });

  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  const prompt = `ちいかわの世界のやさしい空気感で、以下の「空の様子」と「データ」をもとに、みんなのやり取りと鎧さんの言葉を考えてください。
  
  【データ】
  ・卦名: ${h.name} (${h.sky_name || h.soranoeki_sky || "不思議な空"})
  ・空の様子: ${h.soranoeki_sky_description || h.sky_description || "いつもと違う特別な空模様。"}
  ・みんなの雰囲気: ${h.feeling_kawaii || h.emotion_description || "みんなで空を見上げているよ。"}
  ・変化の様子（爻の状況）: ${l ? l.line_name_kawaii : "全体の雰囲気"}
  
  【セリフと情景の厳格なルール】
  1. ちいかわは文章で喋らせず、「…」「…ンショ」「…わぁ」「…ッ」のような短い健気なつぶやきに。
  2. ハチワレのセリフから「ちいかわちゃん」という呼びかけを省略。
  3. うさぎは「ヤハ！」「ウララララ！」「プルャ！」などの叫び声のみ。
  4. 鎧さんは、さらにほんの少し優しく、包み込むような口調に。
  5. 「あなた」「三者三様」などの人称や難しい言葉は含めない。
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

app.post("/callback", express.json(), async (req, res) => {
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
      } while (h && h.id === lastFortune.get(userId) && attempts < 10);
      
      if (!h || !h.id) continue;
      
      lastFortune.set(userId, h.id);

      const lineIndex = Math.floor(Math.random() * 6) + 1;
      const lName = `${lineIndex}爻`; 
      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lineIndex)}`;
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

      const speakText = `${h.name}のカードが届いたよ！開いてみてね！`;
      let errorMessage = "";

      try {
        const fishResponse = await fetch("https://api.fish.audio/v1/tts", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${process.env.FISH_AUDIO_API_KEY}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text: speakText,
            reference_id: process.env.FISH_AUDIO_MODEL_ID, // ★ここを正しく修正しました
            format: "mp3"
          })
        });

        if (!fishResponse.ok) {
           const errText = await fishResponse.text();
           throw new Error(`Fishエラー: ${fishResponse.status} ${errText}`);
        }

        const arrayBuffer = await fishResponse.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const uploadResult = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { resource_type: "video", format: "mp3" },
            (error, result) => {
              if (error) reject(new Error(`Cloudinaryエラー: ${error.message}`));
              else resolve(result);
            }
          );
          uploadStream.end(buffer);
        });

        const duration_ms = Math.max(2000, speakText.length * 300);

        await client.replyMessage(event.replyToken, [
          flexMessage,
          {
            type: "audio",
            originalContentUrl: uploadResult.secure_url,
            duration: duration_ms
          }
        ]);
        continue; 
        
      } catch (err) {
        console.error("音声作成エラー:", err);
        errorMessage = err.message; // エラーの原因をメモ
      }

      // ★もし音声が失敗したら、LINEのトーク画面に直接エラーの原因を返信する
      await client.replyMessage(event.replyToken, [
        flexMessage,
        { type: "text", text: `(裏側のエラーメモ: ${errorMessage})` }
      ]);
    }
    res.sendStatus(200);
  } catch (error) { 
    res.sendStatus(500); 
  }
});

app.listen(process.env.PORT || 10000);
