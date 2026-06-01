require("dotenv").config();
const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");
const path = require("path");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();
// 🌟 最新のGemini 2.5を利用できるように設定
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const client = new line.Client({
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
});

const hexagrams = [];
const lines = [];
const lastFortune = new Map(); // 連続で同じ結果が出ないように記憶する箱

// CSVのヘッダーから不要な文字（BOMなど）を消してキレイにするおまじない
const cleanHeader = ({ header }) => header.replace(/[\uFEFF\u200B]+/g, '').trim();

// 🌟 CSV読み込み設定（もしタブ区切りの場合は separator: '\t' を追加するとより安全です）
fs.createReadStream("hexagrams_master_with_emotion.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => hexagrams.push(data))
  .on("end", () => console.log(`卦のデータを ${hexagrams.length} 件読み込みました。`));

fs.createReadStream("lines.csv")
  .pipe(csv({ mapHeaders: cleanHeader }))
  .on("data", (data) => lines.push(data))
  .on("end", () => console.log(`爻のデータを ${lines.length} 件読み込みました。`));

app.use(express.static(__dirname));
app.get("/", (req, res) => res.sendFile(path.join(__dirname, "index.html")));

// 🌟 HTML画面からのリクエスト（ここでAIが会話と図鑑要素を作るよ！）
app.get("/api/fortune", async (req, res) => {
  const { hid, l_name } = req.query;
  const h = hexagrams.find(item => String(item.id) === String(hid));
  const l = lines.find(line => String(line.hexagram_id) === String(h?.id) && String(line.line) === String(l_name));

  if (!h) return res.status(404).json({ error: "卦が見つかりません" });

  // 🌟 モデルを最新の gemini-2.5-flash に修正！
  const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
  
  // 🌟 CSVの図鑑データをAIにフル活用させるための特製プロンプト
  const prompt = `あなたは「ちいかわ」の世界の優しいガイドであり、易（占い）の解説者です。
  以下の「空の様子」と「キャラクターの感情データ」を元に、ちいかわ・ハチワレ・うさぎ達の可愛い掛け合いと、それを見守るポシェットの鎧さんの現実的で温かいアドバイスを生成してください。
  
  【今回の易データ】
  ・卦名（空の種類）: ${h.name} (${h.sky_name || "不思議な空"})
  ・空の様子（図鑑の解説文）: ${h.sky_description_kawaii || "いつもと違う特別な空模様。"}
  ・この時のちいかわ達の行動/雰囲気: ${h.emotion_action_kawaii || "みんなで空を見上げているよ。"}
  ・変化の様子（爻の状況）: ${l ? l.line_name_kawaii : "全体の雰囲気"}
  ・ちいかわ達の今の気持ち: ${l ? l.chiikawa_line_emotion : "ドキドキ、わくわく。"}
  
  【生成のルール】
  1. ちいかわは「ワァ…」「フリーム…」「ってコト！？」など原作のセリフ感を大切に。
  2. ハチワレが状況を優しく説明したり、ちいかわを励ましたりします。
  3. うさぎは「ヤハ！」「ウララララ！」と元気に割り込みます。
  4. 鎧さんは、この空の易のメッセージ（状況の良し悪しや過渡期であること）を噛み砕いて、ユーザーへの現実的なアドバイス（開運のヒント）として語りかけてください。
  5. chiikawa_scene には、ちいかわ達がどんな場所でどんな風にその空を見上げてドタバタしているかの情景を2〜3文で描写してください。

  必ず以下のJSON形式のみで回答してください。余計な解説や\`\`\`jsonのようなマークダウンの枠は一切含めないでください。
  {
    "chiikawa": "ちいかわのセリフ",
    "hachiware": "ハチワレのセリフ",
    "usagi": "うさぎのセリフ",
    "advice": "鎧さんのアドバイス",
    "chiikawa_scene": "ちいかわ達が空の下で過ごしている情景（図鑑の1ページのような描写）"
  }`;

  try {
    const result = await model.generateContent(prompt);
    // AIが万が一マークダウンを返しても壊れないようにトリミング処理
    const cleanText = result.response.text().replace(/```json|```/g, "").trim();
    const aiData = JSON.parse(cleanText);
    
    // CSVから読み込んだ基本データ(h)に、AIが作ったセリフ(aiData)を合体させてフロントに返すよ！
    res.json({ ...h, ...aiData, bgm: h.bgm || "default.mp3" });
  } catch (e) {
    console.error("AI生成エラー:", e);
    // 万が一AIがエラーになっても画面が真っ白にならないための、可愛いセーフティ（お助けデータ）
    res.json({ 
      ...h, 
      chiikawa: "ワァ……（うるうる）", 
      hachiware: "なんだか空が眩しくて、うまく言葉にできないや…！", 
      usagi: "プルャ！！", 
      advice: "こういう時は焦らず、美味しいチャリメラでも食べてゆっくり寝るのが一番だぞ。", 
      chiikawa_scene: h.sky_description_kawaii || "みんなでぎゅっと集まって、不思議な空を見上げているよ。", 
      bgm: h.bgm || "default.mp3" 
    });
  }
});

// 🌟 LINEからのメッセージ受け取り（引いたカードをWeb画面へ橋渡し！）
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const userId = event.source.userId;
      if (hexagrams.length === 0) continue; 

      let h;
      let attempts = 0;
      do {
        h = hexagrams[Math.floor(Math.random() * hexagrams.length)];
        attempts++;
      } while (h.id === lastFortune.get(userId) && attempts < 10);
      lastFortune.set(userId, h.id);

      const lineIndex = Math.floor(Math.random() * 6) + 1;
      const lName = `${lineIndex}爻`; 

      // Web画面にパラメータ（hid=卦ID、l_name=何爻か）を渡すURLを作成
      const finalUrl = `https://${req.get('host')}/index.html?hid=${h.id}&l_name=${encodeURIComponent(lineIndex)}`;

      const flexMessage = {
        type: "flex",
        altText: `🔮 【${h.name}】の空が届いたよ`,
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
                  { type: "text", text: h.name, weight: "bold", size: "xxl", color: "#ffffff", align: "center", margin: "none" },
                  { type: "text", text: lName, size: "xs", color: "#64748b", align: "center", margin: "md" },
                  {
                    type: "box",
                    layout: "vertical",
                    margin: "xl",
                    spacing: "xs",
                    contents: [
                      { type: "text", text: "CURRENT SKY", size: "xxs", color: "#475569", align: "center", weight: "bold" },
                      { type: "text", text: h.sky_name || "不思議な空", size: "md", color: "#cbd5e1", align: "center" }
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

      await client.replyMessage(event.replyToken, flexMessage);
    }
    res.sendStatus(200);
  } catch (error) { 
    console.error(error); 
    res.sendStatus(500); 
  }
});

app.listen(process.env.PORT || 10000);
