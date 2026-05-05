// ------------------------------
// レア度
// ------------------------------
function getRarity(weather) {
  let rand = Math.random();

  // 雷はSSR出やすい
  if (weather === "雷") rand *= 0.5;

  if (rand < 0.6) return "N";
  if (rand < 0.85) return "R";
  if (rand < 0.97) return "SR";
  return "SSR";
}

// ------------------------------
// 卦の意味
// ------------------------------
const hexagramMeaning = {
  "乾為天": {
    short: "創造・スタート",
    detail: "エネルギー最大、攻める時"
  },
  "坤為地": {
    short: "受容・安定",
    detail: ""
  }
};

// ------------------------------
// キャラ演出
// ------------------------------
function applyCharacterFeeling(text, character) {
  if (!text) return "";

  if (character === "ちいかわ") return text + "…ってコト！？";
  if (character === "ハチワレ") return text + " きっと大丈夫だよ";
  if (character === "うさぎ") return text + " ワーッ！！";
  if (character === "モモンガ") return "♡" + text + "♡";

  return text;
}

function getColor(character) {
  if (character === "ちいかわ") return "#FFC0CB";
  if (character === "ハチワレ") return "#87CEFA";
  if (character === "うさぎ") return "#FFD700";
  if (character === "モモンガ") return "#FF69B4";
  return "#f0f8ff";
}

function getComment(character) {
  if (character === "ちいかわ") return "…ってコト！？って思ってる";
  if (character === "ハチワレ") return "大丈夫かもねって考えてる";
  if (character === "うさぎ") return "ワーッ！ってなってる";
  if (character === "モモンガ") return "え〜♡全部うまくいく気しかしない〜";
}

// ------------------------------
// 天気
// ------------------------------
const weatherEmoji = {
  "晴れ": "☀️",
  "曇り": "☁️",
  "雨": "🌧️",
  "風": "🌬️",
  "雷": "⚡"
};

const skyImages = {
  "晴れ": "https://i.imgur.com/gKnEQds.jpeg",
  "曇り": "https://i.imgur.com/PNvbK3W.jpeg",
  "雨": "https://i.imgur.com/WC8C8zC.jpeg",
  "風": "https://i.imgur.com/9kFUKDI.jpeg",
  "雷": "https://i.imgur.com/etZ12NJ.jpeg"
};

// ------------------------------
// メイン処理
// ------------------------------
app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const event = req.body.events && req.body.events[0];
    if (!event) return res.status(200).end();

    if (event.type !== "message" || event.message.type !== "text") {
      return res.status(200).end();
    }

    const result = generateFortune();

    // ------------------------------
    // レア度決定
    // ------------------------------
    result.rarity = getRarity(result.weather);

    // ------------------------------
    // SSR演出
    // ------------------------------
if (result.rarity === "SR") {
  result.advice = "ちょっと頑張ると跳ねる日✨ " + result.advice;
}

if (result.rarity === "R") {
  result.advice = "コツコツが効く日🌱 " + result.advice;
}
    
// ① モモンガ通常
if (result.character === "モモンガ") {
  result.feeling = "✨レア発生✨ " + result.feeling;
  result.advice = "今日は好きに生きていい日♡ " + result.advice;
}

// ② SSR共通
if (result.rarity === "SSR") {
  result.feeling = "🌈超大吉🌈 " + result.feeling;
  result.advice = "今日は何しても上手くいく日🔥 " + result.advice;
}

// ③ モモンガSSR（最強）
if (result.character === "モモンガ" && result.rarity === "SSR") {
  result.feeling = "💎完全覚醒💎 " + result.feeling;
  result.advice = "全部思い通りになる日♡ " + result.advice;
}

// ④ 雷ボーナス（最後に乗算）
if (result.weather === "雷") {
  result.feeling = "⚡神引き⚡ " + result.feeling;
}

    // ------------------------------
    // 画像分岐
    // ------------------------------
    let imageUrl = skyImages[result.weather] || skyImages["曇り"];

    const ssrImages = [
  "https://i.imgur.com/gKnEQds.jpeg",
  "https://i.imgur.com/etZ12NJ.jpeg"
];

let ssrType = "normal";

if (result.weather === "雷") ssrType = "thunder";
if (result.character === "モモンガ") ssrType = "momo";

if (result.rarity === "SSR") {
  if (ssrType === "thunder") {
    imageUrl = "雷専用SSR画像";
  } else if (ssrType === "momo") {
    imageUrl = "モモンガSSR画像";
  } else {
    imageUrl = ssrImages[Math.floor(Math.random() * ssrImages.length)];
  }
}

    const meaning = hexagramMeaning[result.name];

    // ------------------------------
    // Flex Message
    // ------------------------------
    const flexMessage = {
      type: "flex",
      altText: `${weatherEmoji[result.weather] || ""} ${result.rarity}｜${result.name} ${result.line}爻`,
      contents: {
        type: "bubble",

        hero: {
          type: "image",
          url: imageUrl,
          size: "full",
          aspectRatio: "16:9",
          aspectMode: "cover"
        },

        body: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "text",
              text: `${weatherEmoji[result.weather] || "☁️"} ${result.weather}`,
              weight: "bold",
              size: "lg"
            },

            {
              type: "text",
              text:
                result.rarity === "SSR"
                  ? "🌈 ★ SSR ★ 🌈"
                  : `★ ${result.rarity}`,
              size: "xs",
              color:
                result.rarity === "SSR" ? "#ff0000" :
                result.rarity === "SR" ? "#ff9900" :
                result.rarity === "R" ? "#00aaff" :
                "#999999"
            },

            {
              type: "text",
              text: meaning
                ? `${result.name}（${meaning.short}）｜${result.line}爻`
                : `${result.name}｜${result.line}爻`,
              size: "sm"
            },

            ...(meaning?.detail ? [{
              type: "text",
              text: applyCharacterFeeling(meaning.detail, result.character),
              size: "xs",
              color: "#666666",
              wrap: true,
              margin: "sm"
            }] : []),

            {
              type: "text",
              text: `🐾 ${result.character}`,
              size: "sm"
            },
            {
              type: "text",
              text: getComment(result.character),
              size: "xs",
              color: "#888888",
              margin: "sm"
            },

            {
              type: "separator",
              margin: "md"
            },

            {
              type: "text",
              text: result.feeling,
              wrap: true,
              margin: "md"
            },

            {
              type: "text",
              text: "👉 今日の一歩（アクション）",
              weight: "bold",
              margin: "lg"
            },
            {
              type: "text",
              text: result.advice,
              wrap: true
            }
          ]
        },

        styles: {
          body: {
            backgroundColor:
              result.rarity === "SSR"
                ? "#fff5e6"
                : getColor(result.character)
          }
        },

        footer: {
          type: "box",
          layout: "vertical",
          contents: [
            {
              type: "button",
              action: {
                type: "message",
                label: "もう一度占う",
                text: "占い"
              }
            }
          ]
        }
      }
    };

    await client.replyMessage(event.replyToken, flexMessage);

    res.status(200).end();

  } catch (err) {
    console.error(err);
    res.status(200).end();
  }
});