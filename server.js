const express = require("express");
const line = require("@line/bot-sdk");

const app = express();

const config = {
  channelAccessToken: process.env.CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.CHANNEL_SECRET
};

const client = new line.Client(config);

// 生存確認
app.get("/", (req, res) => {
  res.send("OK");
});

app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const event = req.body.events && req.body.events[0];
    if (!event) return res.status(200).end();

const result = generateFortune();

const skyImages = {
  "晴れ": "https://i.imgur.com/gKnEQds.jpeg",
  "曇り": "https://i.imgur.com/PNvbK3W.jpeg",
  "雨": "https://i.imgur.com/WC8C8zC.jpeg",
  "風": "https://i.imgur.com/9kFUKDI.jpeg",
  "雷": "https://i.imgur.com/etZ12NJ.jpeg"
};

const imageUrl = skyImages[result.weather];

const text =
`【今日の空】${result.weather}
【卦】${result.name}｜${result.line}爻

${result.feeling}
ちいかわ達も「そんな感じだね」って言ってる

👉 今日の一歩
${result.advice}`;

      // 🎯 返信（1回だけ！）
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

  } catch (err) {
    console.error("エラー:", err);
    res.status(200).end();
  }
});

// Render対応
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on " + PORT);
});

function generateFortune() {

  // 🎯 卦番号と爻
  const hexagramNumber = Math.floor(Math.random() * 64) + 1;
  const line = Math.floor(Math.random() * 6) + 1;

  // 🎯 卦名
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

  const name = hexagramNames[hexagramNumber - 1];

  // 🎯 天気分類（あなたのロジック）
  let weather = "";
  if (hexagramNumber <= 13) weather = "晴れ";
  else if (hexagramNumber <= 26) weather = "曇り";
  else if (hexagramNumber <= 39) weather = "雨";
  else if (hexagramNumber <= 52) weather = "風";
  else weather = "雷";

  // 🎯 爻による強度変化
  let feeling = "";
  let advice = "";

  if (weather === "晴れ") {
    if (line <= 2) {
      feeling = "ワーッ！いい流れきてる！";
      advice = "小さく一歩出す";
    } else if (line <= 4) {
      feeling = "ワーッ！進んでいいタイミング！";
      advice = "思い切って行動";
    } else {
      feeling = "ワーッ！でも調子乗りすぎ注意！";
      advice = "勢いをコントロール";
    }
  }

  if (weather === "曇り") {
    if (line <= 2) {
      feeling = "フーッ…様子見の時間";
      advice = "焦らない";
    } else if (line <= 4) {
      feeling = "フーッ…少しずつ動こう";
      advice = "軽く行動";
    } else {
      feeling = "フーッ…無理すると崩れる";
      advice = "休むのも大事";
    }
  }

  if (weather === "雨") {
    if (line <= 2) {
      feeling = "…ってコト！？慎重に";
      advice = "一旦止まる";
    } else if (line <= 4) {
      feeling = "…ってコト！？考える時間";
      advice = "整理する";
    } else {
      feeling = "…ってコト！？抜ける準備";
      advice = "次の一歩を考える";
    }
  }

  if (weather === "風") {
    if (line <= 2) {
      feeling = "ワーッ！変化きた！";
      advice = "流れに乗る";
    } else if (line <= 4) {
      feeling = "ワーッ！チャンス動く！";
      advice = "掴みにいく";
    } else {
      feeling = "ワーッ！変わりすぎ注意";
      advice = "冷静さキープ";
    }
  }

  if (weather === "雷") {
    if (line <= 2) {
      feeling = "フーッ…急展開の予感";
      advice = "慎重に";
    } else if (line <= 4) {
      feeling = "フーッ…大きな変化くる";
      advice = "覚悟を決める";
    } else {
      feeling = "フーッ…ピーク状態";
      advice = "無理せず乗り切る";
    }
  }

  return {
    weather,
    name,
    line,
    feeling,
    advice
  };
}

