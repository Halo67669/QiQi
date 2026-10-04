// =============================================
//  美术资源模块 — 黑白卡通素材加载
//  素材已由 tools/process-assets.ps1 预处理（绿幕抠像/条带裁切/缩放），
//  运行期仅 drawImage —— file:// 下 Canvas 不能 getImageData（跨域污染），
//  因此所有像素级处理必须在游戏外完成。
// =============================================

const ASSET_DIR = 'assets/';

const Assets = {
    img: {},   // 键 -> HTMLImageElement（尚未加载完成时该键不存在）

    _load(key, file, onReady) {
        const im = new Image();
        im.onload = () => {
            this.img[key] = im;
            if (onReady) onReady();
        };
        im.onerror = () => console.warn('[Assets] 加载失败:', file);
        im.src = ASSET_DIR + file;
    },

    init() {
        this._load('scene',     'lane-strip.png');   // 第1关通道条（一张=一条道，战斗中画3份）
        this._load('scene2',    'lane-strip2.png');  // 第2关通道条（街头工业隧道）
        this._load('boss2',     'boss2.png');        // 第2关Boss（街头兽人）
        this._load('scene3',    'lane-strip3.png');  // 第3关通道条（地狱熔岩）
        this._load('scene4',    'lane-strip4.png');  // 第4关通道条（霓虹机械舱）
        this._load('enemyNear3','enemy-near3.png');  // 第3关近战小怪（红鬃小恶魔）
        this._load('enemyFar3', 'enemy-far3.png');    // 第3关远程小怪（恶魔章鱼）
        this._load('enemyNear4','enemy-near4.png');  // 第4关近战小怪（机械骷髅）
        this._load('enemyFar4', 'enemy-far4.png');    // 第4关远程小怪（机械章鱼）
        this._load('boss3',     'boss3.png');        // 第3关Boss（深红之瞳）
        this._load('boss4',     'boss4.png');        // 第4关Boss（机械巨兽）
        this._load('boss5',     'boss5.png');        // 第5关Boss（NULL）
        this._load('bgUI',      'bg-ui.png');        // 战斗外UI背景（CSS 引用，此处仅预热）
        this._load('cardFrame', 'card-frame.png');   // 卡面模板（CSS 引用）
        this._load('player',    'player.png');      // 玩家战斗精灵（白帽绅士，面朝右）
        this._load('enemyNear', 'enemy-near.png');   // 小怪·近战型（哥布林，面朝左）
        this._load('enemyFar',  'enemy-far.png');    // 小怪·远程型（独眼章鱼）
        this._load('boss1',     'boss1.png');       // 第1关Boss（多眼肉块）
        this._load('portrait',  'portrait.png', () => {
            // 主菜单立绘（已抠像透明PNG，直接作为背景图挂载）
            const el = document.getElementById('menu-portrait');
            if (el) el.style.backgroundImage = `url(${ASSET_DIR}portrait.png)`;
        });
        // ---- 新角色贴图（2026-09-19 补注册：克希娅5张 + 二小姐3张）----
        this._load('kexiya-portrait', 'kexiya-portrait.png');  // 选角立绘
        this._load('kexiya-idle',     'kexiya-idle.png');       // 待机姿态
        this._load('kexiya-atk',      'kexiya-atk.png');         // 攻击姿态
        this._load('kexiya-move',     'kexiya-move.png');        // 换道姿态
        this._load('kexiya-bullet',   'kexiya-bullet.png');      // 匕首弹贴图
        this._load('kexiya-aura',     'kexiya-aura.png');        // 被动触发姿态（刃域切割时，2026-09-22）
        this._load('miss2-portrait',  'miss2-portrait.png');     // 选角立绘
        this._load('miss2-idle',      'miss2-idle.png');          // 待机姿态
        this._load('miss2-atk',       'miss2-atk.png');            // 攻击姿态
        // ---- 杨陶乐 + 机械随从查尔斯（2026-09-22 新增）----
        this._load('ytl-portrait',    'ytl-portrait.png');       // 选角立绘（杨陶乐与机器人）
        this._load('ytl-idle',        'ytl-idle.png');            // 待机姿态（面朝右）
        this._load('ytl-atk',         'ytl-atk.png');              // 攻击姿态（面朝右）
        this._load('charles',         'charles.png');              // 机械随从查尔斯（跪姿持枪）
        // ---- 芙丽西斯 + 真-芙丽西斯（2026-09-27 新增）----
        this._load('felisis-portrait', 'felisis-portrait.png');    // 选角立绘
        this._load('felisis-idle',     'felisis-idle.png');         // 待机姿态（面朝右）
        this._load('felisis-atk',      'felisis-atk.png');           // 攻击姿态（面朝右）
        this._load('boss-true-felisis', 'boss-true-felisis.png');    // 真-芙丽西斯 Boss贴图
    },
};

Assets.init();
