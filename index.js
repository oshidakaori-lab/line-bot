// ==============================
// 初期設定
// ==============================
const express = require("express");
const line = require("@line/bot-sdk");
require("dotenv").config();

const app = express();

// 🔥 これ重要（JSONを正しく読む）
app.use(express.json());

const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};

const client = new line.Client(config);

// ==============================
// レア度
// ==============================
function getRarity(weather) {
  let rand = Math.random();
  if (weather === "雷") rand *= 0.5;

  if (rand < 0.6) return "N";
  if (rand < 0.85) return "R";
  if (rand < 0.97) return "SR";
  return "SSR";
}

// ==============================
// データ
// ==============================
const hexagramMeaning = {
  乾為天: { short: "創造・スタート" },
  坤為地: { short: "受容・安定" },
};

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

// ==============================
// キャラ
// ==============================
function getColor(character) {
  return {
    ちいかわ: "#FFC0CB",
    ハチワレ: "#87CEFA",
    うさぎ: "#FFD700",
    モモンガ: "#FF69B4",
  }[character] || "#ffffff";
}

function getComment(character) {
  return {
    ちいかわ: "…ってコト！？って思ってる",
    ハチワレ: "大丈夫かもねって考えてる",
    うさぎ: "ワーッ！ってなってる",
    モモンガ: "え〜♡全部うまくいく気しかしない〜",
  }[character] || "";
}

// ==============================
// 占い生成
// ==============================
function generateFortune() {
  const weatherList = ["晴れ", "曇り", "雨", "風", "雷"];
  const characterList = ["ちいかわ", "ハチワレ", "うさぎ", "モモンガ"];
  const nameList = Object.keys(hexagramMeaning);

  const weather = weatherList[Math.floor(Math.random() * weatherList.length)];
  const character = characterList[Math.floor(Math.random() * characterList.length)];
  const name = nameList[Math.floor(Math.random() * nameList.length)];
  const line = Math.floor(Math.random() * 6) + 1;

  const meaning = hexagramMeaning[name];

  return {
    weather,
    character,
    name,
    line,
    rarity: getRarity(weather),
    feeling: `${name}の気配がある日`,
    advice: `${meaning.short}を意識するとよさそう`,
  };
}

// ==============================
// 演出
// ==============================
function applyEffects(result) {
  const feelings = [result.feeling];
  const advices = [result.advice];

  // レア度
  if (result.rarity === "SSR") {
    feelings.unshift("🌈超大吉🌈");
    advices.unshift("今日は何しても上手くいく🔥");
  } else if (result.rarity === "SR") {
    feelings.unshift("✨少し跳ねる日✨");
  } else if (result.rarity === "R") {
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
// Flex Message
// ==============================
function buildFlex(result) {
  const meaning = hexagramMeaning[result.name];
  const imageUrl = skyImages[result.weather];

  const contents = [
    {
      type: "text",
      text: `${weatherEmoji[result.weather]} ${result.weather}`,
      size: "lg",
      weight: "bold",
    },
    {
      type: "text",
      text: result.rarity === "SSR" ? "🌈 ★ SSR ★ 🌈" : `★ ${result.rarity}`,
      size: "xs",
    },
    {
      type: "text",
      text: `${result.name}（${meaning.short}）｜${result.line}爻`,
      size: "sm",
    },
    {
      type: "text",
      text: `🐾 ${result.character}`,
      size: "sm",
    },
  ];

  // コメント追加（安全）
  const comment = getComment(result.character);
  if (comment) {
    contents.push({
      type: "text",
      text: comment,
      size: "xs",
      color: "#888",
    });
  }

  contents.push(
    { type: "separator" },
    { type: "text", text: result.feeling, wrap: true },
    { type: "text", text: "👉 今日の一歩", weight: "bold" },
    { type: "text", text: result.advice, wrap: true }
  );

  return {
    type: "flex",
    altText: `${result.weather} ${result.rarity}`,
    contents: {
      type: "bubble",
      hero: {
        type: "image",
        url: imageUrl,
        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },
      body: {
        type: "box",
        layout: "vertical",
        contents: contents,
      },
      styles: {
        body: {
          backgroundColor:
            result.rarity === "SSR"
              ? "#fff5e6"
              : getColor(result.character),
        },
      },
    },
  };
}

// ==============================
// Webhook
// ==============================
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const event = req.body.events?.[0];

    if (!event || event.type !== "message") {
      return res.status(200).end();
    }

    let result = generateFortune();
    result = applyEffects(result);

    const flexMessage = buildFlex(result);

    await client.replyMessage(event.replyToken, [flexMessage]);

    res.status(200).end();

  } catch (err) {
    console.error("🔥 ERROR:", err.response?.data || err);
    res.status(200).end();
  }
});

// ==============================
app.listen(process.env.PORT || 3000, () => {
  console.log("🚀 Server started");
});