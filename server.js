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
      await client.replyMessage(event.replyToken, {
        type: "text",
        text: "動いたよ！"
      });
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