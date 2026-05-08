function buildFlex(result) {

  return {
    type: "flex",

    altText: "空の易",

    contents: {
      type: "bubble",

      size: "mega",

      hero: {
        type: "image",
        url:
          skyImages[result.weather] ||
          skyImages["曇り"],

        size: "full",
        aspectRatio: "16:9",
        aspectMode: "cover",
      },

      body: {
        type: "box",
        layout: "vertical",

        spacing: "md",

        contents: [

          // AI占い
          {
            type: "text",
            text: result.aiAdvice,
            wrap: true,
            size: "md",
            color: "#555555",
            margin: "md",
          },

          // 天気
          {
            type: "text",
            text:
              `${weatherEmoji[result.weather]} ${result.weather}`,

            size: "xxl",
            weight: "bold",
            margin: "lg",
            color: "#222222",
          },

          // レア
          {
            type: "text",
            text:
              result.rarity === "SSR"
                ? "🌈 SSR"
                : `⭐ ${result.rarity}`,

            size: "sm",
            color: "#999999",
          },

          // 卦
          {
            type: "text",
            text: `☯ ${result.name}`,
            size: "lg",
            weight: "bold",
            margin: "md",
            color: "#444444",
          },

          // キャラ
          {
            type: "text",
            text: `🐾 ${result.character}`,
            size: "md",
            color: "#666666",
            margin: "sm",
          },

          // 線
          {
            type: "separator",
            margin: "xl",
          },

          // 一言
          {
            type: "text",
            text: "空が静かに揺れています。",
            size: "sm",
            color: "#888888",
            margin: "lg",
            wrap: true,
          },

        ],
      },

      styles: {
        body: {
          backgroundColor: "#ffffff",
        },
      },
    },
  };
}