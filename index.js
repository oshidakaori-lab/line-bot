app.post("/callback", express.json(), async (req, res) => {
  try {
    const events = req.body.events;
    if (!events) {
      return res.sendStatus(200);
    }

    for (const event of events) {
      if (event.type !== "message" || event.message.type !== "text") continue;

      const result = generateFortune();

      const queryParams = new URLSearchParams({
        name: result.name,
        icon: result.icon,
        weather: result.weather,
        emotion: result.emotion,
        line_name: result.line_name,
        line_emotion: result.line_emotion,
        advice: result.advice,
        chiikawa: result.chiikawa,
        hachiware: result.hachiware,
        usagi: result.usagi,
        video: result.video
      }).toString();

      const liffUrl = `https://liff.line.me/2010171447-1dyDX3Dk?${queryParams}`;

      await client.replyMessage(event.replyToken, {
        type: "flex",
        altText: "占いカード",
        contents: {
          type: "bubble",
          hero: { type: "image", url: "https://cdn.pixabay.com/photo/2016/11/18/17/46/house-1836070_1280.jpg", size: "full", aspectMode: "cover" },
          body: { type: "box", layout: "vertical", contents: [{ type: "text", text: result.name, weight: "bold", size: "xl" }] },
          footer: {
            type: "box",
            layout: "vertical",
            contents: [{
              type: "button",
              style: "primary",
              color: "#4682B4",
              action: { type: "uri", label: "空を見る 🌌", uri: liffUrl }
            }]
          }
        }
      });
    } // forループの閉じ括弧

    res.sendStatus(200);
  } catch (err) { // tryの閉じ括弧を待ってからcatchが始まる
    console.error(err);
    res.sendStatus(200);
  } // catchの閉じ括弧
}); // app.postの閉じ括弧