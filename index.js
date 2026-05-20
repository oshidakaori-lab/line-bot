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

  express.static(
    "public/images",

    {
      maxAge: "1d",

      acceptRanges: true,

      setHeaders: (
        res,
        path
      ) => {

        // mp4
        if (
          path.endsWith(".mp4")
        ) {

          res.set(
            "Content-Type",
            "video/mp4"
          );

          // 超重要
          res.set(
            "Accept-Ranges",
            "bytes"
          );
        }

        // gif
        if (
          path.endsWith(".gif")
        ) {

          res.set(
            "Content-Type",
            "image/gif"
          );
        }
      },
    }
  )
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
      "ヤハ。",
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
function getWeatherMedia(weather) {

  // 晴れ
  if (weather?.includes("晴")) {

    return {

      video:
        "sunny.mp4",

      preview:
        "sunny.jpg",
    };
  }

  // 雨
  if (weather?.includes("雨")) {

    return {

      video:
        "rain.mp4",

      preview:
        "rain.jpg",
    };
  }

  // 雷
  if (weather?.includes("雷")) {

    return {

      video:
        "thunder.mp4",

      preview:
        "thunder.jpg",
    };
  }

  // 風
  if (weather?.includes("風")) {

    return {

      video:
        "wind.mp4",

      preview:
        "wind.jpg",
    };
  }

  // 曇
  if (weather?.includes("曇")) {

    return {

      video:
        "cloudy.mp4",

      preview:
        "cloudy.jpg",
    };
  }

  // fallback
  return {

    video:
      "default.mp4",

    preview:
      "default.jpg",
  };
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

以下の情報を元に、ちいかわの世界観を基調に
短く優しい占いメッセージを
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
- 俳句のように短く
- 「空」「風」「雲」「光」「雨」など自然表現を必ず1つ含める
-     
`;

    const response =
      await model.generateContent(
        prompt
      );

    const text =
  response.response
    .text()
    .replace(/\n/g, "")
    .slice(0, 80);

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
  
  // media取得
const media =
  getWeatherMedia(
    hexagram.weather
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
    
    video:
  media.video,

preview:
  media.preview,
    
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
        type: "video",

        url:
          IMAGE_BASE +
          result.video,

        previewUrl:
          IMAGE_BASE +
          result.preview,

        altContent: {
          type: "image",

          url:
            IMAGE_BASE +
            result.preview,

          size: "full",

          aspectRatio: "16:9",

          aspectMode: "cover",
        },

        aspectRatio: "16:9",

        aspectMode: "cover",

        action: {
          type: "uri",

          uri:
            IMAGE_BASE +
            result.video,
        },
      },

      body: {

        type: "box",

        layout: "vertical",

        contents: [

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

          {
            type: "text",

            text:
              result.name,

            size: "xxl",

            weight: "bold",

            margin: "lg",
          },

          {
            type: "text",

            text:
              result.kana,

            size: "sm",

            color:
              "#888888",
          },

          {
            type: "text",

            text:
              result.line_name,

            size: "lg",

            weight: "bold",

            margin: "lg",
          },

          {
            type: "text",

            text:
              result.line_emotion,

            wrap: true,

            size: "sm",

            color:
              "#888888",
          },

          {
            type: "text",

            text:
              `${getWeatherIcon(result.weather)} ${result.weather}`,

            size: "md",

            margin: "lg",
          },

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

          {
            type: "box",

            layout: "vertical",

            margin: "md",

            paddingAll: "12px",

            backgroundColor: "#FFFFFF",

            borderWidth: "1px",

            borderColor: "#DDDDDD",

            cornerRadius: "12px",

            position: "relative",

            contents: [

              {
                type: "text",

                text:
                  `🐾 「${result.character}」が何か言ってる？！`,

                size: "sm",

                color: "#999999",

                weight: "bold",
              },

              {
                type: "text",

                text:
                  `「${result.characterLine}」`,

                wrap: true,

                size: "sm",

                color: "#555555",

                style: "italic",

                margin: "sm",
              },

              {
                type: "text",

                text:
                  "※ 空の易オリジナル再現セリフ",

                size: "xs",

                color: "#AAAAAA",

                margin: "sm",
              },

              {
                type: "button",

                style: "secondary",

                color: "#EEF6FF",

                height: "sm",

                margin: "md",

                action: {
                  type: "uri",

                  label:
                    `📚 ${result.source.title}`,

                  uri:
                    result.source.url,
                },
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

      console.log(
        JSON.stringify(
          err,
          null,
          2
        )
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