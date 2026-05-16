require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();

app.use(
  "/images",
  express.static("public/images")
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
// 固定メッセージ生成
// ======================
function generateFixedAdvice(result) {

  const messages = [

    `${result.weather}の空が、静かに流れています。`,

    `${result.line_name}の気配が、心を照らしています。`,

    `${result.emotion}が、やさしく広がっています。`,

    `今日は「${result.meaning}」がテーマになりそうです。`,

    `${result.character}が、そっと寄り添っています。`,
  ];

  return messages[
    Math.floor(
      Math.random() *
      messages.length
    )
  ];
}

// ======================
// 占い生成
// ======================
function generateFortune() {

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
        Number(l.hexagram_id) === Number(hexagram.id) &&
        Number(l.line) === Number(line)
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

    line,

    line_name:
      selectedLine?.line_name ||
      "爻",

    line_emotion:
      selectedLine?.line_emotion ||
      "",
  };

  // AIの代わり
  result.aiAdvice =
    generateFixedAdvice(result);

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

        backgroundColor:
          "#000000",
      },

      body: {

        type: "box",

        layout: "vertical",

        contents: [

          // メッセージ
          {
            type: "text",

            text:
              result.aiAdvice,

            wrap: true,

            size: "lg",
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
              `☁️ ${result.weather}`,

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

          // キャラ
          {
            type: "text",

            text:
              `🐾 ${result.character}`,

            size: "sm",

            margin: "lg",
          },

          // SSR演出
          ...(result.rarity === "SSR"
            ? [
                {
                  type: "text",

                  text:
                    "✨ SSR ✨",

                  size: "xl",

                  weight:
                    "bold",

                  color:
                    "#FFD700",

                  margin:
                    "lg",
                },
              ]
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
          generateFortune();

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