require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const { GoogleGenerativeAI } = require("@google/generative-ai");

const app = express();

app.use("/images", express.static("public/images"));

// ======================
// 修正①: IMAGE_BASE の定義を追加
// ======================
const IMAGE_BASE = "https://line-bot-v2rk.onrender.com/images/";

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ======================
// 天気アイコン
// ======================
function getWeatherIcon(weather) {
  if (weather?.includes("晴")) return "☀️";
  if (weather?.includes("雨")) return "🌧️";
  if (weather?.includes("雷")) return "⛈️";
  if (weather?.includes("風")) return "🌪️";
  if (weather?.includes("曇")) return "☁️";
  return "✨";
}

// ======================
// 天気画像
// ======================
function getWeatherImage(weather) {
  if (weather?.includes("晴")) return "sunny.jpg";
  if (weather?.includes("雨")) return "rain.jpg";
  if (weather?.includes("雷")) return "thunder.jpg";
  if (weather?.includes("風")) return "wind.jpg";
  if (weather?.includes("曇")) return "cloudy.jpg";
  return "default.jpg";
}

// ======================
// AIによる占い・メッセージ生成
// ======================
async function generateAIFortune(userMessage) {
  try {
    const prompt = `
      ユーザーから以下のメッセージ（悩みや一言）が届きました。
      「${userMessage}」

      このメッセージに対して、東洋の「易（占い）」の要素と、「ちいかわ」の世界観（ちいかわ、ハチワレ、うさぎ、モモンガのいずれか1キャラクターが登場）を融合させた占いをしてください。
      
      各項目の要件:
      - character: ちいかわ、ハチワレ、うさぎ、モモンガのいずれか
      - characterLine: そのキャラらしいセリフ。うさぎなら「ヤハ」「プルャ」、ハチワレなら「なんとかなれッ」、ちいかわなら「ワァ…」など。
      - hexagramName: 悩みに応じた易の卦名（漢字3〜4文字、実在のものでもアレンジでも可）
      - lineName: その卦の状況を表す言葉
      - weather: 晴れ、雨、雷、風、曇りのいずれか
      - fortuneMessage: ユーザーへの占いアドバイスメッセージ（優しく、少し不思議な空気感で、100文字程度）
    `;

    // 修正②: responseMimeType を指定し、スキーマを固定して100%JSONで返却させる
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: {
          type: "object",
          properties: {
            character: { type: "string" },
            characterLine: { type: "string" },
            hexagramName: { type: "string" },
            lineName: { type: "string" },
            weather: { type: "string" },
            fortuneMessage: { type: "string" }
          },
          required: ["character", "characterLine", "hexagramName", "lineName", "weather", "fortuneMessage"]
        }
      }
    });

    const aiResult = await model.generateContent(prompt);
    const responseText = aiResult.response.text().trim();

    // 100%綺麗なJSONが保証されているので、安全にパース可能
    const data = JSON.parse(responseText);
    return data;
  } catch (error) {
    console.error("AI Generation Error:", error);
    return null;
  }
}

// ======================
// Flex Message ビルダー
// ======================
function buildFlex(result) {
  return {
    type: "flex",
    altText: "空の易（AI占い）",
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: IMAGE_BASE + getWeatherImage(result.weather), 
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        spacing: "md",
        paddingAll: "20px",
        backgroundColor: "#FFFFFF",
        contents: [
          // AIからのメッセージ
          {
            type: "text",
            text: result.fortuneMessage,
            wrap: true,
            size: "md",
            color: "#333333",
            weight: "bold",
          },
          // 卦名
          {
            type: "text",
            text: result.hexagramName,
            size: "xl",
            weight: "bold",
            margin: "lg",
          },
          // 爻名・状況
          {
            type: "text",
            text: result.lineName,
            size: "sm",
            color: "#888888",
          },
          // 天気
          {
            type: "text",
            text: `${getWeatherIcon(result.weather)} 空模様: ${result.weather}`,
            size: "md",
            margin: "lg",
          },
          // キャラクター
          {
            type: "text",
            text: `🐾 ${result.character}`,
            size: "sm",
            margin: "lg",
            weight: "bold",
          },
          // キャラセリフ
          {
            type: "text",
            text: result.characterLine ? `「${result.characterLine}」` : "",
            size: "sm",
            wrap: true,
            color: "#555555",
            margin: "sm",
            style: "italic",
          },
        ],
      },
    },
  };
}

// ======================
// Webhook
// ======================
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") {
        continue;
      }

      const userMessage = event.message.text;

      // 占い結果の生成
      const result = await generateAIFortune(userMessage);

      if (!result) {
        await client.replyMessage(event.replyToken, {
          type: "text",
          text: "空の向こうでAIが考え込んでいます…☁️ しばらく経ってからもう一度話しかけてね。",
        });
        continue;
      }

      // Flex Messageの構築と送信
      const flex = buildFlex(result);
      await client.replyMessage(event.replyToken, flex);
    }

    res.sendStatus(200);
  } catch (err) {
    console.log("====== ERROR ======");
    console.error(err);
    res.sendStatus(500);
  }
});

// ======================
// 起動
// ======================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`サーバーがポート ${PORT} で起動しました`);
});
