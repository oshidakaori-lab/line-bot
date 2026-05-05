function generateFortune() {

  const hexagramNumber = Math.floor(Math.random() * 64) + 1;
  const line = Math.floor(Math.random() * 6) + 1;

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

  // 🌤 天気分類
  let weather = "";
  if (hexagramNumber <= 13) weather = "晴れ";
  else if (hexagramNumber <= 26) weather = "曇り";
  else if (hexagramNumber <= 39) weather = "雨";
  else if (hexagramNumber <= 52) weather = "風";
  else weather = "雷";

  // 💬 感情＆アドバイス
  let feeling = "";
  let advice = "";

  if (weather === "晴れ") {
    if (line <= 2) {
      feeling = "いい流れきてる";
      advice = "小さく一歩出す";
    } else if (line <= 4) {
      feeling = "進んでいいタイミング";
      advice = "思い切って行動";
    } else {
      feeling = "調子乗りすぎ注意";
      advice = "勢いをコントロール";
    }
  }

  if (weather === "曇り") {
    if (line <= 2) {
      feeling = "様子見の時間";
      advice = "焦らない";
    } else if (line <= 4) {
      feeling = "少しずつ動こう";
      advice = "軽く行動";
    } else {
      feeling = "無理すると崩れる";
      advice = "休む";
    }
  }

  if (weather === "雨") {
    if (line <= 2) {
      feeling = "慎重に";
      advice = "一旦止まる";
    } else if (line <= 4) {
      feeling = "考える時間";
      advice = "整理する";
    } else {
      feeling = "抜ける準備";
      advice = "次を考える";
    }
  }

  if (weather === "風") {
    if (line <= 2) {
      feeling = "変化きた";
      advice = "流れに乗る";
    } else if (line <= 4) {
      feeling = "チャンス動く";
      advice = "掴みにいく";
    } else {
      feeling = "変わりすぎ注意";
      advice = "冷静さキープ";
    }
  }

  if (weather === "雷") {
    if (line <= 2) {
      feeling = "急展開の予感";
      advice = "慎重に";
    } else if (line <= 4) {
      feeling = "大きな変化くる";
      advice = "覚悟を決める";
    } else {
      feeling = "ピーク状態";
      advice = "無理せず乗り切る";
    }
  }

  // 🎭 キャラ決定
  const character = getCharacter(weather);

  // 🎭 キャラ適用
  const finalFeeling = applyCharacterFeeling(feeling, character);
  const finalAdvice = applyCharacterAdvice(advice, character);

  return {
    weather,
    name,
    line,
    character,
    feeling: finalFeeling,
    advice: finalAdvice
  };
}

function getCharacter(weather) {
  if (Math.random() < 0.1) return "モモンガ";

  if (weather === "晴れ") return "うさぎ";
  if (weather === "曇り") return "ハチワレ";
  if (weather === "雨") return "ちいかわ";
  if (weather === "風") return "うさぎ";
  if (weather === "雷") return "ハチワレ";
}

function applyCharacterFeeling(text, character) {
  if (character === "ちいかわ") return "…ってコト！？ " + text + "…だよ…";
  if (character === "ハチワレ") return "フーッ… " + text + "かもね";
  if (character === "うさぎ") return "ワーッ！ " + text + "！！";
  if (character === "モモンガ") return "え〜♡ " + text + "だよね〜";
  return text;
}

function applyCharacterAdvice(text, character) {
  if (character === "ちいかわ") return "ゆっくりでいいよ → " + text + "…だよ…";
  if (character === "ハチワレ") return "整理しよう → " + text + "かもね";
  if (character === "うさぎ") return "いっちゃえ！ → " + text + "！！";
  if (character === "モモンガ") return "楽しくいこ〜♡ → " + text;
  return text;
}

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