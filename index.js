require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

app.use(express.json());

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

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

// ==============================
// 占い生成
// ==============================
function generateFortune() {

  const weather =
    weathers[Math.floor(Math.random() * weathers.length)];

  const character =
    characters[Math.floor(Math.random() * characters.length)];

  return {
    weather,
    character,
    rarity: Math.random() > 0.9 ? "SSR" : "N",
    feeling: "今日は空気が動く日",
    advice: "まず一歩動いてみよう",
  };
}

// ==============================
// Flex Message
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
        aspectMode: "cover"
      },

      body: {
        type: "box",
        layout: "vertical",

        contents: [

          {
            type: "text",
            text:
              `${weatherEmoji[result.weather]} ${result.weather}`,
            size: "xl",
            weight: "bold"
          },

          {
            type: "text",
            text: result.rarity,
            size: "sm"
          },

          {
            type: "text",
            text: `🐾 ${result.character}`,
            size: "sm"
          },

          {
            type: "separator"
          },

          {
            type: "text",
            text: result.feeling,
            wrap: true
          },

          {
            type: "text",
            text: result.advice,
            wrap: true
          }

        ]
      }
    }
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

      const event = req.body.events?.[0];

      if (!event) {
        return res.status(200).end();
      }

      console.log("受信OK");

      // queueへ追加
      queue.push({
        userId: event.source.userId
      });

      // 即200返す
      return res.status(200).end();

    } catch (err) {

      console.error("ERROR:", err);

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

    const flex = buildFlex(result);

    await client.pushMessage(
      job.userId,
      [flex]
    );

    console.log("送信成功");

  } catch (err) {

    console.error(
      "WORKER ERROR:",
      err.response?.data || err
    );
  }

}, 500);

// ==============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server started");
});