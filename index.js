require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");

// Gemini
const {
  GoogleGenerativeAI,
} = require("@google/generative-ai");

const app = express();

app.use(
  "/images",
  express.static("public/images")
);

// ======================
// Gemini 初期化
// ======================
const genAI =
  new GoogleGenerativeAI(
    process.env.GEMINI_API_KEY
  );

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
// CSV
// ======================
const hexagrams = [];
const lines = [];

// 卦CSV
fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => {

    hexagrams.push(data);

  })
  .on("end", () => {

    console.log("卦CSV読込完了");
    console.log(hexagrams.length);

  });

// 爻CSV
fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => {

    lines.push(data);

  })
  .on("end", () => {

    console.log("爻CSV読込完了");
    console.log(lines.length);

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
// キャラセリフ
// ======================
function generateCharacterLine(character) {

  // うさぎ
  if (character === "うさぎ") {

    const lines = [
      "……ヤハ。",
      "風、来てるヤハ。",
      "フゥン。",
      "……！！",
    ];

    return lines[
      Math.floor(
        Math.random() *
        lines.length
      )
    ];
  }

  // ハチワレ
  if (character === "ハチワレ") {

    const lines = [
      "なんとかなりそう。",
      "大丈夫だといいね。",
      "不思議な空だね。",
      "ちょっと安心した。",
    ];

    return lines[
      Math.floor(
        Math.random() *
        lines.length
      )
    ];
  }

  // モモンガ
  if (character === "モモンガ") {

    const lines = [
      "最高じゃ〜ん。",
      "今日はイイ感じ。",
      "運命って感じする。",
      "空、キレイじゃん。",
    ];

    return lines[
      Math.floor(
        Math.random() *
        lines.length
      )
    ];
  }

  // ちいかわ
  const lines = [
    "……。",
    "ちょっとこわい…。",
    "でも、進みたい…。",
    "空、見てる…。",
  ];

  return lines[
    Math.floor(
      Math.random() *
      lines.length
    )
  ];
}

// ======================
// キャラ出典リンク
// ======================
function getCharacterSource(character) {

  // ちいかわ公式
  if (character === "ちいかわ") {

    return {
      title:
        "ちいかわ公式",

      url:
        "https://twitter.com/ngnchiikawa",
    };
  }

  // ハチワレ
  if (character === "ハチワレ") {

    return {
      title:
        "ハチワレ登場回",

      url:
        "https://twitter.com/ngnchiikawa",
    };
  }

  // うさぎ
  if (character === "うさぎ") {

    return {
      title:
        "うさぎおすすめ回",

      url:
        "https://twitter.com/ngnchiikawa",
    };
  }

  // モモンガ
  return {

    title:
      "モモンガおすすめ回",

    url:
      "https://twitter.com/ngnchiikawa",
  };
}

function getWeatherIcon(weather) {

  if (weather?.includes("晴"))
    return "☀️";

  if (weather?.includes("雨"))
    return "🌧️";

  if (weather?.includes("雷"))
    return "⛈️";

  if (weather?.includes("風"))
    return "🌪️";

  if (weather?.includes("曇"))
    return "☁️";

  return "✨";
}


// ======================
// 天気画像
// ======================
function getWeatherImage(weather) {

  if (weather?.includes("晴"))
    return "sunny.gif";

  if (weather?.includes("雨"))
    return "rain.gif";

  if (weather?.includes("雷"))
    return "thunder.gif";

  if (weather?.includes("風"))
    return "wind.gif";

  if (weather?.includes("曇"))
    return "cloudy.gif";

  return "default.jpg";
}

// ======================
// Gemini AI メッセージ生成
// ======================
async function generateAIAdvice(result) {

  try {

    const model =
      genAI.getGenerativeModel({
        model: "gemini-2.5-flash",
      });

const prompt = `
あなたは「空の易」という、
空模様と易経を融合した占いAIです。

以下の情報を元に、
短く美しい占いメッセージを
80文字以内で生成してください。

【卦】
${result.name}

【感情】
${result.emotion}

【意味】
${result.meaning}

【爻】
${result.line_name}

【天気】
${result.weather}
    

条件:
- やさしい
- 不安を煽らない
- 空の描写を入れる
- 日本語のみ
- 1文のみ
- 改行禁止
- 詩のように短く
- 「空」「風」「雲」「光」「雨」など自然表現を必ず1つ含める
`;

    const response =
      await model.generateContent(
        prompt
      );

    const text =
      response.response.text();

    return text.trim();

  } catch (err) {

    console.log(
      "Gemini Error:"
    );

    console.log(err.message);

    // fallback
    return `${result.weather}の空が静かに揺れています。`;
  }
}

// ======================
// 占い生成
// ======================
async function generateFortune() {

  if (
    hexagrams.length === 0 ||
    lines.length === 0
  ) {
    return null;
  }

  // ランダム卦
  const hexagram =
    hexagrams[
      Math.floor(
        Math.random() *
        hexagrams.length
      )
    ];

  // ランダム爻
  const line =
    Math.floor(Math.random() * 6) + 1;

  // 爻検索
  const selectedLine =
    lines.find(
      (l) =>
        Number(l.hexagram_id) ===
          Number(hexagram.id) &&
        Number(l.line) ===
          Number(line)
    );

  // キャラ
  const character =
    characters[
      Math.floor(
        Math.random() *
        characters.length
      )
    ];

  const result = {

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
      getWeatherImage(
        hexagram.weather
      ),

    name:
      hexagram.name,

    kana:
      hexagram.kana,

    character,

characterLine:
  generateCharacterLine(
    character
  ),
    
    source:
  getCharacterSource(
    character
  ),

    line,

    line_name:
      selectedLine?.line_name ||
      "爻",

    line_emotion:
      selectedLine?.line_emotion ||
      "",
  };

  // Gemini生成
  result.aiAdvice =
    await generateAIAdvice(
      result
    );

  return result;
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
          IMAGE_BASE +
          result.image,

        size: "full",

        aspectRatio: "16:9",

        aspectMode: "cover",
      },

      body: {

        type: "box",

        layout: "vertical",

        contents: [

          // AIメッセージ
          {
            type: "text",

            text:
              result.aiAdvice,

            wrap: true,

            size: "lg",

            weight: "bold",

            color:
              "#333333",
          },

          // 卦名
          {
            type: "text",

            text:
              result.name,

            size: "xxl",

            weight: "bold",

            margin: "lg",
          },

          // よみ
          {
            type: "text",

            text:
              result.kana,

            size: "sm",

            color:
              "#888888",
          },

          // 爻
          {
            type: "text",

            text:
              result.line_name,

            size: "lg",

            weight: "bold",

            margin: "lg",
          },

          // 爻emotion
          {
            type: "text",

            text:
              result.line_emotion,

            wrap: true,

            size: "sm",

            color:
              "#888888",
          },

          // 天気
          {
            type: "text",

            text:
              `${getWeatherIcon(result.weather)} ${result.weather}`,

            size: "md",

            margin: "lg",
          },

          // emotion
          {
            type: "text",

            text:
              result.emotion,

            wrap: true,

            size: "sm",

            color:
              "#666666",

            margin: "md",
          },

          // キャラタイトル
          {
            type: "text",

            text:
              `🐾 「${result.character}」が何か言ってる？！`,

            size: "sm",

            margin: "lg",

            weight: "bold",

            color: "#444444",
          },

          // キャラセリフBOX
{
type: "box",

layout: "vertical",

position: "absolute",

offsetTop: "130px",

offsetStart: "32px",

width: "12px",

height: "12px",

backgroundColor: "#FFFFFF",

borderWidth: "1px",

borderColor: "#DDDDDD",

cornerRadius: "12px",

contents: [],
},
  ],
},
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

    try {

      const events =
        req.body.events;

      for (const event of events) {

        if (
          event.type !== "message"
        ) {
          continue;
        }

        if (
          event.message.type !==
          "text"
        ) {
          continue;
        }

        const result =
          await generateFortune();

        if (!result) {

          await client.replyMessage(
            event.replyToken,
            {
              type: "text",

              text:
                "空を読み込み中です…☁️",
            }
          );

          continue;
        }

        console.log(result);

        const flex =
          buildFlex(result);

        await client.replyMessage(
          event.replyToken,
          flex
        );
      }

      res.sendStatus(200);

    } catch (err) {

      console.log(
        "====== ERROR ======"
      );

      console.log(err);

      res.sendStatus(500);
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