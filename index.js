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
// 天気アイコン
// ======================
function getWeatherIcon(weather) {

  if (weather === "晴れ") {
    return "☀️";
  }

  if (weather === "雨") {
    return "🌧️";
  }

  if (weather === "雷") {
    return "⛈️";
  }

  if (weather === "風") {
    return "🌪️";
  }

  if (weather === "曇り") {
    return "☁️";
  }

  return "✨";
}

// ======================
// メッセージ生成
// ======================
function generateMessage(result) {

  const messages = [

    `${result.line_name} - ${result.line_emotion}`,

    result.emotion,

    `${result.weather}の空がゆっくり流れています。`,

    "まだ名前のない感情が漂っています。",

    "遠い空から気配が届いています。",

    "風向きが少し変わり始めました。",

    `${result.name}の風が流れています。`,

    "空が静かに揺れています。",

    "見えない流れが変わり始めています。",

    `${result.weather}の気配が満ちています。`,

    "静かな兆しが空に浮かんでいます。",

    `${result.character}が空を見上げています。`,

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

  return {

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

  characterLine:
    generateCharacterLine(
      character
    ),

  line,

  line_name:
    selectedLine?.line_name ||
    "爻",

  line_emotion:
    selectedLine?.line_emotion ||
    "",

  message:
    generateMessage({
      weather:
        hexagram.weather,

      emotion:
        hexagram.emotion,

      meaning:
        hexagram.meaning,

      line_name:
        selectedLine?.line_name ||
        "爻",

      line_emotion:
        selectedLine?.line_emotion ||
        "",

      name:
        hexagram.name,

      character,
    }),
  };
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

        spacing: "md",

        paddingAll: "20px",

        backgroundColor:
          result.rarity === "SSR"
            ? "#FFF7D6"
            : (
                result.rarity === "SR"
                  ? "#F3E8FF"
                  : "#FFFFFF"
              ),

        contents: [

          // メッセージ
          {
  type: "text",

  text:
    result.message,

  wrap: true,

  size: "lg",

  color:
    result.rarity === "SSR"
      ? "#E65100"
      : "#333333",

  weight:
    "bold",
},

          // 卦名
          {
            type: "text",

            text:
              result.name,

            size: "xl",

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

          // 爻名
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

          // 卦emotion
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

          // キャラセリフ
          {
            type: "text",

            text:
              result.characterLine || "",

            size: "sm",

            wrap: true,

            color:
              "#555555",

            margin: "sm",
          },

          // SSR演出
          ...(result.rarity === "SSR"
            ? [
                {
                  type: "text",

                  text:
                    "✦ SUPER RARE ✦",

                  size: "xl",

                  weight:
                    "bold",

                  color:
                    "#FFB300",

                  align: "center",

                  margin:
                    "xl",
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

      const events = req.body.events;

      for (const event of events) {

        if (event.type !== "message") {
          continue;
        }

        if (event.message.type !== "text") {
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

      console.log("====== ERROR ======");
      console.log(err);

      console.log("====== MESSAGE ======");
      console.log(err.message);

      console.log("====== FULL RESPONSE ======");

      console.dir(
        err.response?.data,
        { depth: null }
      );

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