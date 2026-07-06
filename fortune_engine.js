// ==========================
// fortune_engine.js
// 空の易 Fortune Engine v1.0
// ==========================

// CSVデータを保存
let emotionData = [];

// 読み込み完了後に保存
function setEmotionData(data){
    emotionData = data;
}

// ランダムに64卦を選ぶ
function drawFortune(){

    if(emotionData.length === 0){
        console.log("emotion_master.csv が読み込まれていません");
        return null;
    }

    const random =
        Math.floor(Math.random()*emotionData.length);

    return emotionData[random];
}
