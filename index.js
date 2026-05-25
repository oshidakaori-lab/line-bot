if (data.video) {

    const video = document.getElementById("video-background");

    // 完全リセット
    video.pause();
    video.removeAttribute("src");
    video.load();

    // 動画セット
    video.src = data.video;

    // iPhone / LINE対策
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;

    video.setAttribute("muted", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("playsinline", "");

    // 読み込み開始
    video.load();

    // 読み込み完了後に再生
    video.oncanplay = async () => {
        try {
            await video.play();
            console.log("動画再生成功");
        } catch (e) {
            console.log("再生失敗", e);
        }
    };

    // 自動復帰
    video.onpause = () => {
        video.play().catch(() => {});
    };

    // エラー監視
    video.onerror = (e) => {
        console.log("動画エラー", e);
    };
}

#video-background {
    position: fixed;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: cover;

    z-index: -100;

    filter:
        brightness(0.75)
        contrast(1.08)
        saturate(1.1);

    transform: scale(1.03);
}