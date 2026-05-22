require("dotenv").config();

const express = require("express");
const line = require("@line/bot-sdk");
const OpenAI = require("openai");
const fs = require("fs");
const csv = require("csv-parser");

const app = express();

// ======================
// 【超重要】動画・画像の配信設定
// ======================
app.use(
  "/images",
  express.static(
    "public/images",
    {
      maxAge: "1d",
      acceptRanges: true, // 動画ストリーミング再生に必須
      setHeaders: (res, path) => {
        // mp4動画の設定
        if (path.endsWith(".mp4")) {
          res.set("Content-Type", "video/mp4");
          res.set("Accept-Ranges", "bytes"); // スマホ再生の命綱
        }
        // jpg画像の設定
        if (path.endsWith(".jpg") || path.endsWith(".jpeg")) {
          res.set("Content-Type", "image/jpeg");
        }
        // gif画像の設定（予備）
        if (path.endsWith(".gif")) {
          res.set("Content-Type", "image/gif");
        }
      },
    }
  )
);

// ======================
// 画像・動画のベースURL
// ======================
const MEDIA = {
  sunny: {
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fsunny.mp4?alt=media&token=bb0ed639-4358-421d-bd62-c211018b3a22",
    preview: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fsunny.jpg?alt=media&token=6d7b9405-2c63-4de3-bfef-0e40fc79350d"
  },
  
  cloudy: {
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fcloudy.mp4?alt=media&token=ef78cca7-d262-42ca-9f98-be95a624cf24",
    preview: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fcloudy.jpg?alt=media&token=116c8eaa-e901-48a3-bf76-4f2bc1d636ff"
  },
  
  wind: {
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fwind.mp4?alt=media&token=944e3e66-047c-44ac-b25b-614b0e9b6148",
    preview: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fwind.jpg?alt=media&token=c381dd33-2b6b-435a-9c2b-f0416be28282"
  },
  
  thunder: {
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fthunder.mp4?alt=media&token=fca7f02b-7ab8-4399-a214-4aee326b85b2",
    preview: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Fthunder.jpg?alt=media&token=93b9579b-2d9f-4ccd-8aae-24ef611cce43"
  },

  rain: {
    video: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Frain.mp4?alt=media&token=c4e62a8e-c5cb-4bd6-bb2a-c2a7d52f5ae2",
    preview: "https://firebasestorage.googleapis.com/v0/b/sora-no-eki-f7e5c.firebasestorage.app/o/weather%2Frain.jpg?alt=media&token=471eb40e-7425-418d-a820-a1450cd4e736"
  }
};

// ======================
// LINE 初期化
// ======================
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

// ======================
// OpenAI 初期化（回数制限なし！）
// ======================

const openai = new OpenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

console.log("OPENAI KEY EXISTS:", !!process.env.GEMINI_API_KEY);

// ======================
// CSV 読み込み
// ======================
const hexagrams = [];
const lines = [];

fs.createReadStream("hexagrams.csv")
  .pipe(csv())
  .on("data", (data) => { hexagrams.push(data); })
  .on("end", () => { console.log("卦CSV読込完了:", hexagrams.length); });

fs.createReadStream("lines.csv")
  .pipe(csv())
  .on("data", (data) => { lines.push(data); })
  .on("end", () => { console.log("爻CSV読込完了:", lines.length); });

// ======================
// キャラクター設定
// ======================
const characters = ["ちいかわ", "ハチワレ", "うさぎ", "モモンガ"];

function generateCharacterLine(character) {
  if (character === "うさぎ") return ["……ヤハ。", "ヤハ。", "フゥン。", "……！！"][Math.floor(Math.random() * 4)];
  if (character === "ハチワレ") return ["なんとかなりそう。", "大丈夫だといいね。", "不思議な空だね。", "ちょっと安心した。"][Math.floor(Math.random() * 4)];
  if (character === "モモンガ") return ["最高じゃ〜ん。", "今日はイイ感じ。", "運命って感じする。", "空、キレイじゃん。"][Math.floor(Math.random() * 4)];
  return ["……。", "ちょっとこわい…。", "でも、進みたい…。", "空、見てる…。"][Math.floor(Math.random() * 4)];
}

function getCharacterSource(character) {
  return {
    title: character === "ちいかわ" ? "ちいかわ公式" : `${character}登場回`,
    url: "https://twitter.com/ngnchiikawa",
  };
}

function getWeatherIcon(weather) {
  if (weather?.includes("晴")) return "☀️";
  if (weather?.includes("雨")) return "🌧️";
  if (weather?.includes("雷")) return "⛈️";
  if (weather?.includes("風")) return "🌪️";
  if (weather?.includes("曇")) return "☁️";
  return "✨";
}

// 天気文字から動画ファイル名を紐付け
function getWeatherMedia(weather) {

  if (weather?.includes("晴")) {
    return MEDIA.sunny;
  }

  if (weather?.includes("雨")) {
    return MEDIA.rain;
  }

  if (weather?.includes("雷")) {
    return MEDIA.thunder;
  }

  if (weather?.includes("風")) {
    return MEDIA.wind;
  }

  if (weather?.includes("曇")) {
    return MEDIA.cloudy;
  }

  return MEDIA.sunny;
}

// ======================
// OpenAI メッセージ生成
// ======================
async function generateAIAdvice(result) {
  try {
    const prompt = `
あなたは「空の易」という、空模様と易経を融合した占いAIです。
以下の情報を元に、ちいかわの世界観を基調にした短く優しい占いメッセージを、日本語のみ・1文・改行禁止の「80文字以内」で生成してください。
「空」「風」「雲」「光」「雨」など自然表現を必ず1つ含めてください。

卦: ${result.name}
意味: ${result.meaning}
爻: ${result.line_name}
天気: ${result.weather}
`;

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
    });

    return completion.choices[0].message.content.replace(/\n/g, "").slice(0, 80).trim();
  } catch (err) {
    console.log("OpenAI Error:", err.message);
    return `${result.weather}の空が静かに揺れています。`;
  }
}

// ======================
// 占いデータ生成
// ======================
function generateFortune() {
  if (hexagrams.length === 0 || lines.length === 0) return null;

  const hexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  const line = Math.floor(Math.random() * 6) + 1;
  const selectedLine = lines.find(l => Number(l.hexagram_id) === Number(hexagram.id) && Number(l.line) === Number(line));
  const media = getWeatherMedia(hexagram.weather);
  const character = characters[Math.floor(Math.random() * characters.length)];

  return {
    weather: hexagram.weather,
    emotion: hexagram.emotion,
    meaning: hexagram.meaning,
    rarity: hexagram.rarity,
    color: hexagram.color,
    bgm: hexagram.bgm,
    video: media.video,
    preview: media.preview,
    name: hexagram.name,
    kana: hexagram.kana,
    character,
    characterLine: generateCharacterLine(character),
    source: getCharacterSource(character),
    line,
    line_name: selectedLine?.line_name || "爻",
    line_emotion: selectedLine?.line_emotion || "",
  };
}

// ======================
// Flex Message ビルダー（完全動画対応版）
// ======================
function buildFlex(result) {
  const videoUrl = result.video;
  const previewUrl = result.preview;
  
  return {
    type: "flex",
    altText: "空の易",
    contents: {
      type: "bubble",
      
      // 動画エリア設定
      hero: {
  type: "video",
  url: videoUrl,

  altContent: {
    type: "image",
    url: previewUrl,
    size: "full",
    aspectRatio: "16:9",
    aspectMode: "cover"
  },

  aspectRatio: "16:9",

  action: {
    type: "uri",
    label: "再生",
    uri: videoUrl
  }
},
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          { type: "text", text: result.aiAdvice, wrap: true, size: "lg", weight: "bold", color: "#333333" },
          { type: "text", text: result.name, size: "xxl", weight: "bold", margin: "lg" },
          { type: "text", text: result.kana, size: "sm", color: "#888888" },
          { type: "text", text: result.line_name, size: "lg", weight: "bold", margin: "lg" },
          { type: "text", text: result.line_emotion, wrap: true, size: "sm", color: "#888888" },
          { type: "text", text: `${getWeatherIcon(result.weather)} ${result.weather}`, size: "md", margin: "lg" },
          { type: "text", text: result.emotion, wrap: true, size: "sm", color: "#666666", margin: "md" },
          {
            type: "box",
            layout: "vertical",
            margin: "md",
            paddingAll: "12px",
            backgroundColor: "#FFFFFF",
            borderWidth: "1px",
            borderColor: "#DDDDDD",
            cornerRadius: "12px",
            contents: [
              { type: "text", text: `🐾 「${result.character}」が何か言ってる？！`, size: "sm", color: "#999999", weight: "bold" },
              { type: "text", text: `「${result.characterLine}」`, wrap: true, size: "sm", color: "#555555", style: "italic", margin: "sm" },
              { type: "text", text: "※ 空の易オリジナル再現セリフ", size: "xs", color: "#AAAAAA", margin: "sm" },
              {
                type: "button",
                style: "secondary",
                color: "#EEF6FF",
                height: "sm",
                margin: "md",
                action: {
                  type: "uri",
                  label: "詳細を見る",
                  uri: result.source.url
                }
              }
            ]
          }
        ]
      }
    }
  };
}

// ======================
// Webhook ハンドラ
// ======================
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const events = req.body.events;
    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const result = generateFortune();
      if (!result) {
        await client.replyMessage(event.replyToken, { type: "text", text: "空を読み込み中です…☁️" });
        continue;
      }

      // OpenAIで占いテキストを生成
      result.aiAdvice = await generateAIAdvice(result);

      console.log("送信データチェック:", result);

      const flex = buildFlex(result);
      await client.replyMessage(event.replyToken, flex);
    }
    res.sendStatus(200);
  } catch (err) {
    console.log("====== ERROR ======");
    console.log(err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => { console.log("起動成功、ポート:", PORT); });
