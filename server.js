const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// サーバー生存確認
app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const event = req.body.events && req.body.events[0];
    if (!event) return res.status(200).end();

if (event.type === "message") {

const skyImages = {
  "晴れ": "https://i.imgur.com/gKnEQds.jpeg",
  "曇り": "https://i.imgur.com/PNvbK3W.jpeg",
  "雨": "https://i.imgur.com/WC8C8zC.jpeg",
  "風": "https://i.imgur.com/9kFUKDI.jpeg",
  "雷": "https://i.imgur.com/etZ12NJ.jpeg"
};
  
await client.replyMessage(event.replyToken, [
  {
    type: "image",
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl
  },
  {
    type: "text",
    text: `今日の空：${weather}`
  }
]);  
  
  const imageUrl = "https://i.imgur.com/gKnEQds.jpeg";

  await client.replyMessage(event.replyToken, [
    {
      type: "image",
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl
    },
    {
      type: "text",
      text: "画像テストだよ！"
    }
  ]);
}
    
    res.status(200).end();

  } catch (err) {
    console.error("エラー:", err);
    res.status(200).end(); // ← 超重要（エラーでも200返す）
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});