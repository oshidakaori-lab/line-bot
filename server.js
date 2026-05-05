app.post("/callback", line.middleware(config), async (req, res) => {
  try {
    const event = req.body.events && req.body.events[0];
    if (!event) return res.status(200).end();

    if (event.type === "message") {

      const result = generateFortune();

      const skyImages = {
        "晴れ": "https://i.imgur.com/gKnEQds.jpeg",
        "曇り": "https://i.imgur.com/PNvbK3W.jpeg",
        "雨": "https://i.imgur.com/WC8C8zC.jpeg",
        "風": "https://i.imgur.com/9kFUKDI.jpeg",
        "雷": "https://i.imgur.com/etZ12NJ.jpeg"
      };

      const imageUrl = skyImages[result.weather];

      const flexMessage = {
        type: "flex",
        altText: "今日の占い結果",
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
                text: `☁️ ${result.weather}`,
                weight: "bold",
                size: "lg"
              },
              {
                type: "text",
                text: `${result.name}｜${result.line}爻`,
                size: "sm"
              },
              {
                type: "text",
                text: `🐾 ${result.character}`,
                size: "sm"
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
                text: "👉 今日の一歩",
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
              backgroundColor: "#f0f8ff"
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
    }

    res.status(200).end();

  } catch (err) {
    console.error(err);
    res.status(200).end();
  }
});