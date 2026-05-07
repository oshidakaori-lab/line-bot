const OpenAI = require("openai");
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});


require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();



const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

console.log("SECRET:", process.env.LINE_CHANNEL_SECRET);
console.log("TOKEN:", process.env.LINE_CHANNEL_ACCESS_TOKEN);

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
// AI占い関数
// ==============================
async function generateAIAdvice(result) {
  try {

    const prompt = `
あなたは幻想的な空の占い師です。

天気: ${result.weather}
卦: ${result.name}
レア度: ${result.rarity}
キャラ: ${result.character}

80文字以内で
幻想的で優しい今日の運勢を返してください。
`;

    const completion = await openai.chat.completions.create({
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
  text: result.aiAdvice,
  wrap: true,
  size: "sm",
  color: "#444444"
},        
        
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
app.post("/callback", line.middleware(config), (req, res) => {
  try {

    console.log("Webhook受信");

    const events = req.body.events || [];

    if (events.length === 0) {
      return res.status(200).end();
    }

    for (const event of events) {

      if (event.type !== "message") continue;

      if (!event.source?.userId) continue;

      console.log("メッセージ受信");

      queue.push({
        userId: event.source.userId
      });
    }

    return res.status(200).end();

  } catch (err) {

    console.error("🔥 ERROR:", err);

    return res.status(200).end();
  }
});

// ==============================
// Worker
// ==============================

setInterval(async () => {

  if (queue.length === 0) return;

  const job = queue.shift();

  try {

    let result = generateFortune();

    result = applyEffects(result);

    const flexMessage = buildFlex(result);

    await client.pushMessage(
      job.userId,
      [flexMessage]
    );

    console.log("送信成功");

  } catch (err) {

    console.error(
      "🔥 PUSH ERROR:",
      err.response?.data || err
    );
  }

}, 300);


setInterval(async () => {

  if (queue.length === 0) return;

  const job = queue.shift();

  try {

    console.log("送信開始");

    const result = generateFortune();

    result.aiAdvice = await generateAIAdvice(result);
    
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
// 演出
// ==============================
function applyEffects(result) {

  const feelings = [result.feeling];
  const advices = [result.advice];

  // SSR
  if (result.rarity === "SSR") {
    feelings.unshift("🌈超大吉🌈");
    advices.unshift("今日は何しても上手くいく🔥");
  }

  // SR
  else if (result.rarity === "SR") {
    feelings.unshift("✨少し跳ねる日✨");
  }

  // R
  else if (result.rarity === "R") {
    feelings.unshift("🌱コツコツの日🌱");
  }

  // モモンガ
  if (result.character === "モモンガ") {
    feelings.unshift("✨レア発生✨");
  }

  // 雷
  if (result.weather === "雷") {
    feelings.unshift("⚡神引き⚡");
  }

  result.feeling = feelings.join(" ");
  result.advice = advices.join(" ");

  return result;
}

// ==============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server started");
});