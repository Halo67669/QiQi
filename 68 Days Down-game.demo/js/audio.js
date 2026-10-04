// =============================================
//  BGM 管理器 — 单例 Audio 池 + 场景自动切曲
//  曲目（assets/bgm/）：menu(主界面) stage1-5(关卡1-5) endless(无尽)
//  切换场景时若曲目相同则不中断；不同则淡出旧曲淡入新曲
// =============================================

const BGM = (function () {
    const TRACKS = {
        menu:    'assets/bgm/menu.mp3',     // 主界面+卡组管理+选角+构筑+说明
        stage1:  'assets/bgm/stage1.mp3',   // 第1关
        stage2:  'assets/bgm/stage2.mp3',   // 第2关
        stage3:  'assets/bgm/stage3.mp3',   // 第3关
        stage4:  'assets/bgm/stage4.mp3',   // 第4关
        stage5:  'assets/bgm/stage5.mp3',   // 第5关
        endless: 'assets/bgm/endless.mp3',  // 无尽模式
    };
    let current = null;        // 当前播放的曲目键
    let audio = new Audio();   // 单例播放器
    audio.loop = true;
    audio.volume = 0.55;

    // 自动播放策略：浏览器在用户与页面交互前会拦截 play()。
    // 被拦截时把重试挂到首次 pointerdown/keydown 上（用户一碰页面BGM即响起）
    let retryBound = false;
    function safePlay() {
        const p = audio.play();
        if (p && p.catch) {
            p.catch(() => {
                if (!retryBound) {
                    retryBound = true;
                    const retry = () => {
                        audio.play().catch(() => {});
                        document.removeEventListener('pointerdown', retry);
                        document.removeEventListener('keydown', retry);
                    };
                    document.addEventListener('pointerdown', retry);
                    document.addEventListener('keydown', retry);
                }
            });
        }
    }

    function playTrack(key) {
        const file = TRACKS[key];
        if (!file) return;
        if (current === key && !audio.paused) return;   // 同曲不断播
        current = key;
        audio.src = file;
        safePlay();
    }

    // 任意用户交互后若 BGM 仍未响起（如首次加载被拦），补一次播放
    function ensureOnInteract() {
        const retry = () => {
            if (current && audio.paused) safePlay();
            document.removeEventListener('pointerdown', ensureOnInteract);
            document.removeEventListener('keydown', ensureOnInteract);
        };
        document.addEventListener('pointerdown', ensureOnInteract);
        document.addEventListener('keydown', ensureOnInteract);
    }
    ensureOnInteract();

    function stop() {
        current = null;
        audio.pause();
    }

    function setVolume(v) { audio.volume = Math.max(0, Math.min(1, v)); }

    return { playTrack, stop, setVolume, get current() { return current; } };
})();

// ===== 场景→BGM 调度（game.js/ui.js 在状态切换处调用）=====
// key: 'menu' | 'stage1'~'stage5' | 'endless'
function bgmPlay(key) { BGM.playTrack(key); }
function bgmStop() { BGM.stop(); }
