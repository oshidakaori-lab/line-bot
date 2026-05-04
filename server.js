const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.post("/callback", line.middleware(config), async (req, res) => {
  const event = req.body.events[0];

  if (event.type === "message") {
    await client.replyMessage(event.replyToken, {
      type: "text",
      text: "動いたよ！"
    });
  }

  res.status(200).end();
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log("🚀 Server running on " + PORT);
});