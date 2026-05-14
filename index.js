const app = express();require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();
app.use(
  "/images",
  app.use('/images', express.static('public/images'));

// ======================
// 画像URL
// ======================

const IMAGE_BASE =
  "https://line-bot-v2rk.onrender.com/images/";

// ======================
// LINE
// ======================
const config = {
  channelSecret:
    process.env.LINE_CHANNEL_SECRET,

  channelAccessToken:
    process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client =
  new line.Client(config);

// ======================
// OpenAI
// ======================
const openai =
  new OpenAI({
    apiKey:
      process.env.OPENAI_API_KEY,
  });

// ======================
// CSV
// ======================
const hexagrams = [];

fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => {

    hexagrams.push(data);

  })
  .on("end", () => {

    console.log("CSV読込完了");

    console.log(hexagrams.length);

  });

// ======================
// キャラ
// ======================
const characters = [
  "ちいかわ",
  "ハチワレ",
  "うさぎ",
  "モモンガ",
];

// ======================
// AI
// ======================
async function generateAIAdvice(result) {

  try {

    const prompt = `
幻想的な占い師として、
80文字以内で、
やさしく運勢を返してください。

卦:
${result.name}

感情:
${result.emotion}

意味:
${result.meaning}
`;

    const completion =
      await openai.chat.completions.create({

        model: "gpt-4.1-mini",

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],
      });

    return completion
  .choices[0]
  .message
  .content
  .slice(0, 80);

  } catch (err) {

    console.log(err.message);

    return "静かな空が広がっています。";
  }
}

// ======================
// 占い生成
// ======================
function generateFortune() {
  
  if (hexagrams.length === 0) {

    return null;
  }

  const hexagram =
    hexagrams[
      Math.floor(
        Math.random() *
        hexagrams.length
      )
    ];

  const character =
    characters[
      Math.floor(
        Math.random() *
        characters.length
      )
    ];

  return {

    type: "sky",

    weather:
      hexagram.weather,

    emotion:
      hexagram.emotion,

    meaning:
      hexagram.meaning,

    rarity:
      hexagram.rarity,

    color:
      hexagram.color,

    bgm:
      hexagram.bgm,

    image:
      hexagram.image,

    name:
      hexagram.name,

    kana:
      hexagram.kana,

    character,
  };
}

// ======================
// Flex
// ======================
function buildFlex(result) {

  return {

    type: "flex",

    altText: "空の易",

    contents: {

      type: "bubble",

      hero: {

        type: "image",

        url:
  IMAGE_BASE + result.image,

        size: "full",

        aspectRatio: "16:9",

        aspectMode: "cover",
      },

      body: {

        type: "box",

        layout: "vertical",

        contents: [

          {
            type: "text",

            text:
              result.aiAdvice,

            wrap: true,

            size: "lg",
          },

          {
            type: "text",

            text:
              result.name,

            size: "xxl",

            weight: "bold",

            margin: "lg",
          },

          {
            type: "text",

            text:
              result.kana,

            size: "sm",

            color: "#888888",
          },

          {
            type: "text",

            text:
              result.weather,

            size: "lg",

            margin: "lg",
          },

          {
            type: "text",

            text:
              result.emotion,

            wrap: true,

            size: "sm",

            color: "#666666",

            margin: "md",
          },

          {
            type: "text",

            text:
              `🐾 ${result.character}`,

            size: "sm",

            margin: "lg",
          },
            ...(result.rarity === "SSR"
            ? [{
                type: "text",

                text: "✨ SSR ✨",

                size: "xl",

                weight: "bold",

                color: "#FFD700",

                margin: "lg",
              }]
            : []),
        ],
      },
    },
  };
}

// ======================
// webhook
// ======================
app.post(
  "/callback",

  line.middleware(config),

  async (req, res) => {

    res.sendStatus(200);

    const events =
      req.body.events;

    for (const event of events) {

      if (
        event.type !== "message"
      ) {
        continue;
      }

      if (
        event.message.type !== "text"
      ) {
        continue;
      }

      const result =
        generateFortune();
      
      if (!result) {

        await client.replyMessage(
          event.replyToken,
          {
            type: "text",
            text: "空を読み込み中です…☁️",
          }
        );

        continue;
      }

      result.aiAdvice =
        await generateAIAdvice(result);

      const flex =
        buildFlex(result);

      await client.replyMessage(
        event.replyToken,
        flex
      );
    }
  }
);

// ======================
// 起動
// ======================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("起動成功");
});