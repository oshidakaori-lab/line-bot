require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");

const app = express();

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
// emotion
// ==============================
const emotions = {

  乾為天:
    "空へ伸びていく感覚",

  坤為地:
    "やさしく包まれる安心",

  水雷屯:
    "迷いながら始まる気配",

  山水蒙:
    "幼い霧のような感情",

  天水訟:
    "心が静かに揺れている",
};

// ==============================
// AI占い
// ==============================
async function generateAIAdvice(result) {

  if (!process.env.OPENAI_API_KEY) {
    return "静かな空が広がっています。";
  }

  try {

    let prompt = "";

    // タロット
    if (result.type === "tarot") {

      prompt = `
あなたは幻想的な
ちいかわタロット占い師です。

80文字以内で、
やさしく幻想的に、
運勢を返してください。

カード:
${result.cardName}

位置:
${result.position}

意味:
${result.meaning}

キャラ:
${result.character}
`;

    } else {

      prompt = `
あなたは幻想的な空の占い師です。

80文字以内で、
やさしく幻想的な運勢を返してください。

天気:
${result.weather}

卦:
${result.name}

キャラ:
${result.character}
`;

    }

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
      .content;

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

  const tarotCards = [

{
  name: "ワンドの6",

  character: "🟦ハチワレ",

  positive:
    "「優勝！」パフォーマー",

  reverse:
    "「俺だけ！」独り占め",

  positiveEpisode:
    "アニメ11話「1位！優勝だー！」",

  reverseEpisode:
    "アニメ12話「俺だけMVP！」",

  // 正位置URL
  positiveUrl:
    "https://www.youtube.com/",

  // 逆位置URL
  reverseUrl:
    "https://www.youtube.com/",

  // 正位置サムネ
  positiveImage:
    "https://i.imgur.com/gKnEQds.jpeg",

  // 逆位置サムネ
  reverseImage:
    "https://i.imgur.com/WC8C8zC.jpeg",
},

];  

function generateTarot() {
  
  

  const card =
    tarotCards[
      Math.floor(
        Math.random() * tarotCards.length
      )
    ];

  const isReverse =
    Math.random() > 0.5;

  return {

    type: "tarot",

    cardName:
      card.name,

    character:
      card.character,

    position:
      isReverse
        ? "逆位置"
        : "正位置",

    meaning:
      isReverse
        ? card.reverse
        : card.positive,

    recommendedEpisode:
      isReverse
        ? card.reverseEpisode
        : card.positiveEpisode,

    episodeUrl:
      isReverse
        ? card.reverseUrl
        : card.positiveUrl,

    image:
      isReverse
        ? card.reverseImage
        : card.positiveImage,
  };
}

// ==============================
// 3枚引き生成
// ==============================
function generateTripleTarot() {

  return [

    {
      title: "過去",
      ...generateTarot(),
    },

    {
      title: "現在",
      ...generateTarot(),
    },

    {
      title: "未来",
      ...generateTarot(),
    },

  ];
}

// ==============================
// タロットFlex
// ==============================
function buildTarotFlex(result) {
  

return {

  type: "flex",

  altText: "ちいかわタロット",

  contents: {

    type: "bubble",

    size: "mega",

    hero: {

      type: "image",

      url: result.image,

      size: "full",

      aspectRatio: "3:4",

      aspectMode: "cover",
    },

    body: {

      type: "box",

      layout: "vertical",

      spacing: "md",

      paddingAll: "20px",

      contents: [

        {
          type: "text",

          text:
            result.cardName,

          size: "xl",

          weight: "bold",
        },

        {
          type: "text",

          text:
            result.position,

          size: "sm",

          color: "#999999",
        },

        {
          type: "text",

          text:
            result.meaning,

          wrap: true,

          size: "lg",

          margin: "md",
        },

        {
          type: "text",

          text:
            `🐾 ${result.character}`,

          size: "sm",

          color: "#666666",

          margin: "md",
        },

        {
          type: "separator",

          margin: "lg",
        },

        {
          type: "text",

          text:
            "📺 おすすめ回",

          size: "sm",

          weight: "bold",

          margin: "lg",
        },

        {
          type: "text",

          text:
            result.recommendedEpisode,

          wrap: true,

          size: "sm",

          color: "#888888",
        },

        {
          type: "separator",

          margin: "lg",
        },

        {
          type: "text",

          text:
            result.aiAdvice,

          wrap: true,

          size: "sm",

          color: "#555555",

          margin: "lg",
        },

      ],
    },

    footer: {

      type: "box",

      layout: "vertical",

      spacing: "sm",

      contents: [

        {
          type: "button",

          style: "primary",

          action: {

            type: "uri",

            label: "📺 アニメを見る",

            uri:
              result.episodeUrl,
          },
        },

      ],
    },
  },
};
}

// ==============================
// タロット3枚引き
// ==============================
function buildTripleCarousel(results) {

  return {

    type: "flex",

    altText: "3枚引きタロット",

    contents: {

      type: "carousel",

      contents:

        results.map(
          buildTarotBubble
        ),
    },
  };
}

// ==============================
// タロットBubble
// ==============================
function buildTarotBubble(result) {

  return {

    type: "bubble",

    size: "mega",

    hero: {

      type: "image",

      url: result.image,

      size: "full",

      aspectRatio: "3:4",

      aspectMode: "cover",
    },

    body: {

      type: "box",

      layout: "vertical",

      spacing: "md",

      paddingAll: "20px",

      contents: [

        {
          type: "text",

          text:
            `🔮 ${result.title}`,

          size: "sm",

          color: "#999999",
        },

        {
          type: "text",

          text:
            result.cardName,

          size: "xl",

          weight: "bold",
        },

        {
          type: "text",

          text:
            result.position,

          size: "sm",

          color: "#999999",
        },

        {
          type: "text",

          text:
            result.meaning,

          wrap: true,

          size: "md",

          margin: "md",
        },

      ],
    },

    footer: {

      type: "box",

      layout: "vertical",

      contents: [

        {
          type: "button",

          style: "primary",

          action: {

            type: "uri",

            label: "📺 アニメを見る",

            uri:
              result.episodeUrl,
          },
        },

      ],
    },
  };
}

// ==============================
// 空Flex
// ==============================
function buildFlex(result) {

  return {
    type: "flex",

    altText: "空の易",

    contents: {

      type: "bubble",

      size: "mega",

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

        spacing: "md",

        paddingAll: "20px",

        contents: [

          {
            type: "text",

            text:
              result.aiAdvice,

            wrap: true,

            size: "lg",

            color: "#444444",

            margin: "md",
          },

          {
            type: "text",

            text:
              `${weatherEmoji[result.weather]} ${result.weather}`,

            size: "xxl",

            weight: "bold",

            color: "#222222",

            margin: "lg",
          },

          {
            type: "text",

            text:
              result.rarity,

            size: "sm",

            color: "#999999",
          },

          {
            type: "text",

            text:
              `☯ ${result.name}`,

            size: "lg",

            weight: "bold",

            color: "#555555",
          },

          {
            type: "text",
            
            text:
            result.emotion || "静かな感情",

            size: "sm",

            color: "#999999",
          },

          {
            type: "text",

            text:
              `🐾 ${result.character}`,

            size: "sm",

            color: "#777777",
          },

          {
            type: "separator",

            margin: "xl",
          },

          {
            type: "text",

            text:
              "空が静かに揺れています。",

            size: "xs",

            color: "#aaaaaa",

            margin: "lg",

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

  async (req, res) => {

    try {

      console.log("Webhook受信");

      res.status(200).end();

      const events = req.body.events || [];

      if (events.length === 0) {
        return;
      }

      for (const event of events) {

        // message以外無視
        if (event.type !== "message") {
          continue;
        }

        // text以外無視
        if (event.message.type !== "text") {
          continue;
        }

        // userId無いなら無視
        if (!event.source?.userId) {
          continue;
        }

        const text =
          event.message.text || "";

        console.log("QUEUE追加");

        let mode = "sky";

        if (text.includes("3枚")) {

          mode = "triple";

        } else if (text.includes("タロット")) {

          mode = "tarot";
        }

        queue.push({

          userId:
            event.source.userId,

          mode,
        });
      }

    } catch (err) {

      console.error("WEBHOOK ERROR");
      console.error(err);
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

    let result;

    // ======================
    // モード分岐
    // ======================

    if (job.mode === "triple") {

      result =
        generateTripleTarot();

    } else if (job.mode === "tarot") {

      result =
        generateTarot();

      result.aiAdvice =
        await generateAIAdvice(result);

    } else {

      result =
        generateFortune();

      result.aiAdvice =
        await generateAIAdvice(result);
    }

    // ======================
    // Flex生成
    // ======================

    let flex;

    if (job.mode === "triple") {

      flex =
        buildTripleCarousel(result);

    } else if (result.type === "tarot") {

      flex =
        buildTarotFlex(result);

    } else {

      flex =
        buildFlex(result);
    }

    // ======================
    // 送信
    // ======================

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