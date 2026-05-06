// ==============================
// 初期設定
// ==============================
const express = require("express");
const line = require("@line/bot-sdk");
require("dotenv").config();

const app = express();

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
// データ定義
// ==============================
const hexagramMeaning = {
  乾為天: { short: "創造・スタート", detail: "エネルギー最大、攻める時" },
  坤為地: { short: "受容・安定", detail: "流れに任せると整う日" },
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

const ssrImages = [
  "https://i.imgur.com/gKnEQds.jpeg",
  "https://i.imgur.com/etZ12NJ.jpeg",
];

// ==============================
// キャラ処理
// ==============================
function getColor(character) {
  return {
    ちいかわ: "#FFC0CB",
    ハチワレ: "#87CEFA",
    うさぎ: "#FFD700",
    モモンガ: "#FF69B4",
  }[character] || "#f0f8ff";
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
  const nameList = Object.keys(hexagramMeaning);
  const characterList = ["ちいかわ", "ハチワレ", "うさぎ", "モモンガ"];

  const weather = weatherList[Math.floor(Math.random() * weatherList.length)];
  const name = nameList[Math.floor(Math.random() * nameList.length)];
  const line = Math.floor(Math.random() * 6) + 1;
  const character = characterList[Math.floor(Math.random() * characterList.length)];

  const meaning = hexagramMeaning[name];

  return {
    weather,
    name,
    line,
    character,
    rarity: getRarity(weather),
    feeling: meaning ? `${name}の気配がある日` : "少し不思議な空気の日",
    advice: meaning ? `${meaning.short}を意識するとよさそう` : "まず一歩だけ動こう",
  };
}

// ==============================
// 演出合成（コア）
// ==============================
function applyEffects(result) {
  const feelings = [result.feeling];
  const advices = [result.advice];

  // --- レア度 ---
  if (result.rarity === "SSR") {
    feelings.unshift("🌈超大吉🌈");
    advices.unshift("今日は何しても上手くいく日🔥");
  } else if (result.rarity === "SR") {
    feelings.unshift("✨少し跳ねる日✨");
    advices.unshift("ちょっと頑張ると跳ねる日✨");
  } else if (result.rarity === "R") {
    feelings.unshift("🌱コツコツが光る日🌱");
    advices.unshift("コツコツが効く日🌱");
  }

  // --- キャラ ---
  if (result.character === "モモンガ") {
    feelings.unshift("✨レア発生✨");
    advices.unshift("今日は好きに生きていい日♡");

    if (result.rarity === "SSR") {
      feelings.unshift("💎完全覚醒💎");
      advices.unshift("全部思い通りになる日♡");
    }
  }

  // --- 卦 ---
  const meaning = hexagramMeaning[result.name];
  if (meaning) {
    feelings.unshift(`「${meaning.short}」の日`);
  }

  // --- 天気 ---
  if (result.weather === "雷") {
    feelings.unshift("⚡神引き⚡");
    advices.unshift("全部一撃で決まる気がする日");
  }

  result.feeling = feelings.join(" ");
  result.advice = advices.join(" ");

  return result;
}

// ==============================
// 画像決定
// ==============================
function getImage(result) {
  let imageUrl = skyImages[result.weather] || skyImages["曇り"];

  if (result.rarity === "SSR") {
    if (result.character === "モモンガ" && result.weather === "雷") {
      return "https://i.imgur.com/etZ12NJ.jpeg";
    }
    if (result.character === "モモンガ") {
      return "https://i.imgur.com/gKnEQds.jpeg";
    }
    if (result.weather === "雷") {
      return "https://i.imgur.com/etZ12NJ.jpeg";
    }
    return ssrImages[Math.floor(Math.random() * ssrImages.length)];
  }

  return imageUrl;
}

// ==============================
// Flex Message
// ==============================
function buildFlex(result) {
  const meaning = hexagramMeaning[result.name];
  const imageUrl = getImage(result);

  return {
    type: "flex",
    altText: `${weatherEmoji[result.weather]} ${result.rarity}｜${result.name}`,
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
        contents: [
          { type: "text", text: `${weatherEmoji[result.weather]} ${result.weather}`, size: "lg", weight: "bold" },
          {
            type: "text",
            text: result.rarity === "SSR" ? "🌈 ★ SSR ★ 🌈" : `★ ${result.rarity}`,
            size: "xs",
          },
          {
            type: "text",
            text: meaning
              ? `${result.name}（${meaning.short}）｜${result.line}爻`
              : `${result.name}｜${result.line}爻`,
            size: "sm",
          },
          { type: "text", text: `🐾 ${result.character}`, size: "sm" },
          { type: "text", text: getComment(result.character), size: "xs", color: "#888" },
          { type: "separator" },
          { type: "text", text: result.feeling, wrap: true },
          { type: "text", text: "👉 今日の一歩", weight: "bold" },
          { type: "text", text: result.advice, wrap: true },
        ],
      },
      styles: {
        body: {
          backgroundColor: result.rarity === "SSR" ? "#fff5e6" : getColor(result.character),
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
    if (!event || event.type !== "message") return res.status(200).end();

    let result = generateFortune();
    result = applyEffects(result);

    const flex = buildFlex(result);

    await client.replyMessage(event.replyToken, flex);

    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(200).end();
  }
});

// ==============================
app.listen(process.env.PORT || 3000);