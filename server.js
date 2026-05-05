const skyImages = {
  "晴れ": "https://i.imgur.com/gKnEQds.jpeg",
  "曇り": "https://i.imgur.com/PNvbK3W.jpeg",
  "雨": "https://i.imgur.com/WC8C8zC.jpeg",
  "風": "https://i.imgur.com/9kFUKDI.jpeg",
  "雷": "https://i.imgur.com/etZ12NJ.jpeg"
};

const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/callback", line.middleware(config), async (req, res) => {
  const event = req.body.events[0];

if (event.type === "message") {

  // 🎯 ① 卦（1〜64）と爻（1〜6）
  const hexagramNumber = Math.floor(Math.random() * 64) + 1;
  const line = Math.floor(Math.random() * 6) + 1;

  // 🎯 ② 卦名（最低限）
  const hexagramNames = [
    "乾為天","坤為地","水雷屯","山水蒙","水天需","天水訟","地水師","水地比",
    "風天小畜","天沢履","地天泰","天地否","天火同人","火天大有","地山謙","雷地豫",
    "沢雷随","山風蠱","地沢臨","風地観","火雷噬嗑","山火賁","山地剥","地雷復",
    "天雷无妄","山天大畜","山雷頤","沢風大過","坎為水","離為火","沢山咸","雷風恒",
    "天山遯","雷天大壮","火地晋","地火明夷","風火家人","火沢睽","水山蹇","雷水解",
    "山沢損","風雷益","沢天夬","天風姤","沢地萃","地風升","沢水困","水風井",
    "沢火革","火風鼎","震為雷","艮為山","風山漸","雷沢帰妹","雷火豊","火山旅",
    "巽為風","兌為沢","風水渙","水沢節","風沢中孚","雷山小過","水火既済","火水未済"
  ];

  const hexagramName = hexagramNames[hexagramNumber - 1];

  // 🎯 ③ 天気分類（5タイプ）
  let weather = "";
  if (hexagramNumber <= 13) weather = "晴れ";
  else if (hexagramNumber <= 26) weather = "曇り";
  else if (hexagramNumber <= 39) weather = "雨";
  else if (hexagramNumber <= 52) weather = "風";
  else weather = "雷";

  // 🎯 ④ ちいかわ感情生成
  let feeling = "";
  let advice = "";

  if (weather === "晴れ") {
    feeling = "ワーッ！今日はいい流れ！";
    advice = "小さくでもいいから前に進む";
  } else if (weather === "曇り") {
    feeling = "フーッ…ちょっと様子見しよ…";
    advice = "無理に動かずタイミング待ち";
  } else if (weather === "雨") {
    feeling = "…ってコト！？焦らずいこう";
    advice = "一旦立ち止まって整理する";
  } else if (weather === "風") {
    feeling = "ワーッ！流れ変わるかも！";
    advice = "変化に乗ってみる";
  } else {
    feeling = "フーッ…急展開くるかも";
    advice = "慎重に判断する";
  }

  // 🎯 ⑤ 最終メッセージ
  const text =
`【今日の空】${weather}
【卦】${hexagramName}｜${line}爻

${feeling}
ちいかわ達も「そんな感じだね」って言ってる

👉 今日の一歩
${advice}`;

const imageUrl = skyImages[weather];  
  
await client.replyMessage(event.replyToken, [
  {
    type: "image",
    originalContentUrl: imageUrl,
    previewImageUrl: imageUrl
  },
  {
    type: "text",
    text: text
  }
]);
  
  res.status(200).end();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running");
});