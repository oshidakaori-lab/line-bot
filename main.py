import os
import random
import requests
from flask import Flask, request, abort
from linebot import LineBotApi, WebhookHandler
from linebot.exceptions import InvalidSignatureError
from linebot.models import MessageEvent, TextMessage, AudioMessage

# クロードナリのライブラリをインポート
import cloudinary
import cloudinary.uploader

app = Flask(__name__)

# ーーー 環境変数から設定を読み込む ーーー
LINE_CHANNEL_ACCESS_TOKEN = os.getenv('LINE_CHANNEL_ACCESS_TOKEN')
LINE_CHANNEL_SECRET = os.getenv('LINE_CHANNEL_SECRET')
FISH_AUDIO_API_KEY = os.getenv('FISH_AUDIO_API_KEY')
FISH_AUDIO_MODEL_ID = os.getenv('FISH_AUDIO_MODEL_ID')

# Cloudinaryの設定
cloudinary.config(
    cloud_name = os.getenv('CLOUDINARY_CLOUD_NAME'),
    api_key = os.getenv('CLOUDINARY_API_KEY'),
    api_secret = os.getenv('CLOUDINARY_API_SECRET'),
    secure = True
)

line_bot_api = LineBotApi(LINE_CHANNEL_ACCESS_TOKEN)
handler = WebhookHandler(LINE_CHANNEL_SECRET)

@app.route("/callback", methods=['POST'])
def callback():
    signature = request.headers['X-Line-Signature']
    body = request.get_data(as_text=True)
    try:
        handler.handle(body, signature)
    except InvalidSignatureError:
        abort(400)
    return 'OK'

@handler.add(MessageEvent, message=TextMessage)
def handle_message(event):
    # ★ハチワレちゃん風の占いの結果セリフリスト
    fortunes = [
        "今日の運勢はっ…大吉！…ってコト！？ なんとかなるよ！がんばろ！",
        "今日は中吉…かな？ 悪くない、悪くないよね！喜びがない〜ってならないように気をつけよ！",
        "えっ…凶！？ うぐぐ…でも大丈夫！なんとかなれーッ！",
        "今日は小吉！あッ！メッセージが届いてるみたい！いいことあるといいね！"
    ]
    
    # リストの中からランダムで1つ選ぶ
    fortune_text = random.choice(fortunes)

    # 1. Fish.audioのAPIを叩いて音声を生成する
    fish_api_url = "https://api.fish.audio/v1/tts"
    headers = {
        "Authorization": f"Bearer {FISH_AUDIO_API_KEY}",
        "Content-Type": "application/json"
    }
    data = {
        "text": fortune_text, 
        "model_id": FISH_AUDIO_MODEL_ID,
        "format": "mp3"
    }

    try:
        response = requests.post(fish_api_url, json=data, headers=headers)

        if response.status_code == 200:
            # 2. 生成された音声を一時的にCloudinaryにアップロードする
            upload_result = cloudinary.uploader.upload(
                response.content, 
                resource_type = "video", 
                format = "mp3"
            )
            
            # 安全なURL（https://〜）を取得
            audio_url = upload_result.get("secure_url")
            
            # LINEの仕様上、音声の長さ（ミリ秒）が必要なので、文字数から計算
            duration_ms = max(2000, len(fortune_text) * 300)
            
            # 3. LINEに音声メッセージ（MP3）を返信する
            audio_message = AudioMessage(
                original_content_url=audio_url,
                duration=duration_ms
            )
            line_bot_api.reply_message(event.reply_token, audio_message)
            
        else:
            # エラーが起きた場合はテキストで結果だけ返す
            line_bot_api.reply_message(
                event.reply_token, 
                TextMessage(text=f"声が出なかったから文字で言うね！\n{fortune_text}")
            )
    except Exception as e:
        # 通信エラーなどの場合もテキストで結果を返す
        line_bot_api.reply_message(
            event.reply_token, 
            TextMessage(text=f"うぐぐ…文字で受け取って！\n{fortune_text}")
        )

if __name__ == "__main__":
    app.run(port=5000)
