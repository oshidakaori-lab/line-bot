require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");

const app = express();

app.use(express.json());

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ==============================
// 生存確認
// ==============================
app.get("/", (req, res) => {
  res.send("OK");
});

// ==============================
// queue
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
  "モモンガ"
];

const weathers = [
  "晴れ",
  "曇り",
  "雨",
  "風",
  "雷"
];

const hexagrams = [
  "乾為天",
  "坤為地",
  "水雷屯",
  "山水蒙",
  "天水訟"
];

// ==============================
// AI占い
// ==============================
async function generateAIAdvice(result) {
  try {

    const prompt = `
あなたは「空の易」の幻想的占い師です。

空模様・易経・感情・運命を詩的に読み解きます。

条件:
- 80文字以内
- 幻想的
- やさしい
- 不思議
- 日本語

天気: ${result.weather}
卦: ${result.name}
レア度: ${result.rarity}
キャラ: ${result.character}

今日の運勢:
`;

    const completion =
      await openai.chat.completions.create({
        model: "gpt-4.1-mini",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      });

    return completion.choices[0].message.content;

  } catch (err) {

    console.error(err);

    return "静かな空気が流れています。";
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
    feeling: "今日は空気が動く日",
    advice: "まず一歩動いてみよう",
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
        url: skyImages[result.weather],
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
            color: "#444444",
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

          {
            type: "separator",
          },

          {
            type: "text",
            text: result.feeling,
            wrap: true,
          },

          {
            type: "text",
            text: result.advice,
            wrap: true,
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
  line.middleware(config),
  (req, res) => {

    try {

      console.log("Webhook受信");

      const events = req.body.events || [];

      if (events.length === 0) {
        return res.status(200).end();
      }

      for (const event of events) {

        if (event.type !== "message") continue;

        if (!event.source?.userId) continue;

        queue.push({
          userId: event.source.userId,
        });
      }

      return res.status(200).end();

    } catch (err) {

      console.error(err);

      return res.status(200).end();
    }
  }
);

// ==============================
// Worker
// ==============================
setInterval(async () => {

  if (queue.length === 0) return;

  const job = queue.shift();

  try {

    console.log("送信開始");

    const result = generateFortune();

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

    console.error(
      "PUSH ERROR:",
      err.response?.data || err
    );
  }

}, 500);

// ==============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server started");
});