require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");

const app = express();

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
// レア度
// ==============================
function getRarity(weather) {

  let rand = Math.random();

  // 雷はSSR率UP
  if (weather === "雷") {
    rand *= 0.5;
  }

  if (rand < 0.6) return "N";
  if (rand < 0.85) return "R";
  if (rand < 0.97) return "SR";

  return "SSR";
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
    getRarity(weather);

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
// 演出
// ==============================
function applyEffects(result) {

  const feelings = [result.feeling];
  const advices = [result.advice];

  // SSR
  if (result.rarity === "SSR") {

    feelings.unshift("🌈 超大吉 🌈");

    advices.unshift(
      "運命が大きく動く日"
    );
  }

  // SR
  else if (result.rarity === "SR") {

    feelings.unshift(
      "✨ 少し跳ねる日 ✨"
    );
  }

  // R
  else if (result.rarity === "R") {

    feelings.unshift(
      "🌱 積み重ねの日 🌱"
    );
  }

  // モモンガ
  if (result.character === "モモンガ") {

    feelings.unshift(
      "💎 レア気配 💎"
    );
  }

  // 雷
  if (result.weather === "雷") {

    feelings.unshift(
      "⚡ 神引き ⚡"
    );
  }

  result.feeling =
    feelings.join(" ");

  result.advice =
    advices.join(" ");

  return result;
}

// ==============================
// AI占い
// ==============================
async function generateAIAdvice(result) {

  try {

    const prompt = `
あなたは「空の易」の幻想的占い師です。

空・雲・雷・風・雨・易経・夢・感情を
静かに読み解きます。

条件:

- 80文字以内
- 日本語
- 幻想的
- 少し切ない
- 詩的
- 優しい
- 不思議
- 余韻
- 説明しすぎない

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
            content: prompt,
          },
        ],
      });

    return completion.choices[0].message.content;

  } catch (err) {

    console.error(
      "OPENAI ERROR:",
      err.response?.data ||
      err.message ||
      err
    );

    return "静かな空気が流れています。";
  }
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

            text:
              `★ ${result.rarity}`,

            size: "sm",
          },

          {
            type: "text",

            text: result.name,

            size: "sm",
          },

          {
            type: "text",

            text:
              `🐾 ${result.character}`,

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

      const events =
        req.body.events || [];

      // 疎通確認
      if (events.length === 0) {

        return res.status(200).end();
      }

      for (const event of events) {

        if (event.type !== "message") {
          continue;
        }

        if (!event.source?.userId) {
          continue;
        }

        console.log(
          "メッセージ受信:",
          event.source.userId
        );

        // queue暴走防止
        if (queue.length < 100) {

          queue.push({
            userId:
              event.source.userId,
          });
        }
      }

      // 即200返す
      return res.status(200).end();

    } catch (err) {

      console.error(
        "WEBHOOK ERROR:",
        err.response?.data ||
        err.message ||
        err
      );

      return res.status(200).end();
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

    let result =
      generateFortune();

    result =
      applyEffects(result);

    result.aiAdvice =
      await generateAIAdvice(result);

    const flex =
      buildFlex(result);

    await client.pushMessage(
      job.userId,
      [flex]
    );

    console.log(
      "送信成功:",
      job.userId
    );

  } catch (err) {

    console.error(
      "PUSH ERROR:",
      err.response?.data ||
      err.message ||
      err
    );
  }

}, 1500);

// ==============================
// 起動
// ==============================
app.listen(
  process.env.PORT || 3000,
  () => {

    console.log("🚀 Server started");
  }
);