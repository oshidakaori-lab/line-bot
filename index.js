require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");

const app = express();

// JSON
app.use(express.json());

// ==============================
// LINE設定
// ==============================
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

// ==============================
// OpenAI
// ==============================
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==============================
// 生存確認
// ==============================
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// ==============================
// Queue
// ==============================
const queue = [];

// ==============================
// データ
// ==============================
const weatherEmoji = {
  晴れ: "☀️",
  曇り: "☁️",
  雨: "🌧️",
  風: "🌬️",
  雷: "⚡",
};

const skyImages = {
  晴れ: "https://i.imgur.com/gKnEQds.jpeg",
  曇り: "https://i.imgur.com/PNvbK3W.jpeg",
  雨: "https://i.imgur.com/WC8C8zC.jpeg",
  風: "https://i.imgur.com/9kFUKDI.jpeg",
  雷: "https://i.imgur.com/etZ12NJ.jpeg",
};

const characters = [
  "ちいかわ",
  "ハチワレ",
  "うさぎ",
  "モモンガ",
];

const weathers = [
  "晴れ",
  "曇り",
  "雨",
  "風",
  "雷",
];

const hexagrams = [
  "乾為天",
  "坤為地",
  "水雷屯",
  "山水蒙",
  "天水訟",
];

// ==============================
// OpenAI 占い
// ==============================
async function generateAIAdvice(result) {

  try {

    const prompt = `
あなたは幻想的な空の占い師です。

80文字以内で、
やさしく幻想的な運勢を返してください。

天気: ${result.weather}
卦: ${result.name}
キャラ: ${result.character}
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

    return completion.choices[0].message.content;

  } catch (err) {

    console.error("OPENAI ERROR");
    console.error(err.message);

    return "静かな風が流れています。";
  }
}

// ==============================
// 占い生成
// ==============================
function generateFortune() {

  const weather =
    weathers[Math.floor(Math.random() * weathers.length)];

  const character =
    characters[Math.floor(Math.random() * characters.length)];

  const name =
    hexagrams[Math.floor(Math.random() * hexagrams.length)];

  const rarity =
    Math.random() > 0.9 ? "SSR" : "N";

  return {
    weather,
    character,
    name,
    rarity,
  };
}

// ==============================
// Flex
// ==============================
function buildFlex(result) {

  return {
    type: "flex",

    altText: "今日の運勢",

    contents: {
      type: "bubble",

      hero: {
        type: "image",
        url:
          skyImages[result.weather] ||
          skyImages["曇り"],

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
            text: result.aiAdvice,
            wrap: true,
            size: "sm",
          },

          {
            type: "text",
            text:
              `${weatherEmoji[result.weather]} ${result.weather}`,

            size: "xl",
            weight: "bold",
          },

          {
            type: "text",
            text: result.rarity,
            size: "sm",
          },

          {
            type: "text",
            text: result.name,
            size: "sm",
          },

          {
            type: "text",
            text: `🐾 ${result.character}`,
            size: "sm",
          },

        ],
      },
    },
  };
}

// ==============================
// Webhook
// ==============================
app.post(
  "/callback",

  // middleware
  line.middleware(config),

  async (req, res) => {

    try {

      console.log("Webhook受信");

      // まず即200返す
      res.status(200).end();

      const events = req.body.events || [];

      if (events.length === 0) {
        return;
      }

      for (const event of events) {

        if (event.type !== "message") {
          continue;
        }

        if (!event.source?.userId) {
          continue;
        }

        console.log("QUEUE追加");

        queue.push({
          userId: event.source.userId,
        });
      }

    } catch (err) {

      console.error("WEBHOOK ERROR");
      console.error(err);

      // ここ重要
      try {
        res.status(200).end();
      } catch {}
    }
  }
);

// ==============================
// Worker
// ==============================
setInterval(async () => {

  if (queue.length === 0) {
    return;
  }

  const job = queue.shift();

  try {

    console.log("送信開始");

    const result =
      generateFortune();

    result.aiAdvice =
      await generateAIAdvice(result);

    const flex =
      buildFlex(result);

    await client.pushMessage(
      job.userId,
      [flex]
    );

    console.log("送信成功");

  } catch (err) {

    console.error("PUSH ERROR");

    if (err.response?.data) {
      console.error(err.response.data);
    } else {
      console.error(err.message);
    }
  }

}, 1000);

// ==============================
// 起動
// ==============================
const PORT =
  process.env.PORT || 3000;

app.listen(PORT, () => {

  console.log("🚀 Server started");
  console.log("PORT:", PORT);

});