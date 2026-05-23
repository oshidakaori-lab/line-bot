import dotenv from "dotenv";
import express from "express";
import line from "@line/bot-sdk";
import fs from "fs";
import csv from "csv-parser";

dotenv.config();

const app = express();
const BASE_URL = "https://line-bot-v2rk.onrender.com";

// LINE 初期化
const config = {
  channelSecret: process.env.LINE_CHANNEL_SECRET,
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
};
const client = new line.Client(config);

// CSV 読み込み（簡易版）
const hexagrams = [];
const lines = [];
fs.createReadStream("hexagrams.csv").pipe(csv()).on("data", (data) => hexagrams.push(data));
fs.createReadStream("lines.csv").pipe(csv()).on("data", (data) => lines.push(data));

function getWeatherIcon(weather) {
  if (weather?.includes("晴")) return "☀️";
  if (weather?.includes("雨")) return "🌧️";
  return "✨";
}

// 占い生成関数
function generateFortune() {
  if (hexagrams.length === 0) return null;
  const hexagram = hexagrams[Math.floor(Math.random() * hexagrams.length)];
  return { name: hexagram.name, kana: hexagram.kana, weather: hexagram.weather, emotion: hexagram.emotion, line_name: "初爻", line_emotion: "幸運", chiikawa_line: "わッ…！", hachiware_line: "なんとかなりそう？", usagi_line: "ヤハ！" };
}

// Gemini通信（エラー時は固定文）
async function generateGeminiAdvice(result) {
  return "3人が身を寄せ合って不思議な空を見上げているな。今は無理せず美味しいものでもハフムシャ食べてゆっくり過ごすといいぞ。";
}

// Webhook
app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) return res.sendStatus(200);

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;
      const result = generateFortune();
      result.aiAdvice = await generateGeminiAdvice(result);

      const params = new URLSearchParams({ ...result, advice: result.aiAdvice });
      const webPageUrl = `https://liff.line.me/2010171447-1dyDX3Dk?${params.toString()}`;

      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "占いが出たぞ",
        contents: {
          type: "bubble",
          hero: { type: "image", url: "https://cdn.pixabay.com/photo/2016/11/18/17/46/house-1836070_1280.jpg", size: "full", aspectRatio: "20:13", aspectMode: "cover" },
          body: { type: "box", layout: "vertical", contents: [{ type: "text", text: result.name, weight: "bold", size: "xl" }] },
          footer: { type: "box", layout: "vertical", contents: [{ type: "button", style: "primary", color: "#4682B4", action: { type: "uri", label: "シネマティック画面で見る 🌌", uri: webPageUrl } }] }
        }
      });
    }
    res.sendStatus(200);
  } catch (err) {
    res.sendStatus(200);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("起動成功！"));
