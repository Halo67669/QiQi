// =============================================
//  弹幕卡牌射击 — 核心逻辑（三路 / 关卡 / Boss）
// =============================================

// ----- 全局对象 -----
let canvas, ctx;
let player, crystal, boss;
let charles = null;   // 机械随从·查尔斯（杨陶乐保护协议召唤）
let enemies = [];
let playerBullets = [];
let enemyBullets = [];
let particles = [];
let floatTexts = [];
let telegraphs = [];
let handDisabledTimer = 0;   // >0 = 手牌被禁用（真-芙丽西斯Boss机制）
let transformBoss = null;    // 化身修罗：友方Boss实体 { key, def, x, y, timer, fireTimer }

let deck = [];
let hand = [];
let freeMark = [];   // 与hand平行的免费标记数组（恩赐后当前手牌=免费）
let discardPile = [];
let currentDeckData = null;

let energy = CONFIG.ENERGY_START;
let maxEnergy = CONFIG.ENERGY_MAX;
let score = 0;
let killCount = 0;
let gameState = 'menu';
let nextCardHalfPrice = false;
let nextCardFree = false;
let activeEffects = [];
let shakeTime = 0;
let shakeIntensity = 0;
let screenFlash = 0; // 混沌终焉：全屏白闪（1→0）
let lastTime = 0;
let stars = [];

// 关卡流程
let stage = null;
let stageIndex = 0;
let currentWave = 1;
let waveEnemiesLeft = 0;
let spawnTimer = 0;
let spawnInterval = 1800;
let waveBreakTimer = 0;
let bossWarnTimer = 0;
let phase = 'wave'; // wave | break | bossWarn | boss

const input = { up: false, down: false };

// =============================================
//  初始化
// =============================================
window.addEventListener('load', () => {
    canvas = document.getElementById('game-canvas');
    ctx = canvas.getContext('2d');
    setupInput();
    generateStars();
    showMenuScreen('start-screen');
    window.addEventListener('resize', resizeStage);
    requestAnimationFrame(loop);
});

function resizeStage() {
    const stageEl = document.getElementById('stage');
    const panel = document.getElementById('bottom-panel');
    // 舞台整体 = 画布(720) + 底部卡牌区，一起缩放；窗口更大时整体放大（上限1.6），过小则缩小适配
    const panelH = (panel && !panel.classList.contains('hidden')) ? panel.offsetHeight : 0;
    const scale = Math.min((window.innerWidth - 16) / 1280, (window.innerHeight - 8) / (720 + panelH), 1.6);
    stageEl.style.transform = `scale(${scale})`;
}

function generateStars() {
    stars = [];
    for (let i = 0; i < 70; i++) {
        stars.push({
            x: Math.random() * CONFIG.CANVAS_WIDTH,
            y: Math.random() * CONFIG.CANVAS_HEIGHT,
            r: Math.random() * 1.5 + 0.3,
            phase: Math.random() * Math.PI * 2,
            speed: Math.random() * 0.02 + 0.005,
        });
    }
}

// =============================================
//  输入
// =============================================
function setupInput() {
    document.addEventListener('keydown', (e) => {
        const k = e.key.toLowerCase();
        if (['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k)) e.preventDefault();

        if (gameState === 'playing') {
            switch (k) {
                case 'w': case 'arrowup':
                    // 阿撒托斯自由移动：按住持续飞行（keyup 释放）；其余角色一次性换道
                    if (player.freeMove) { input.up = true; }
                    else if (!e.repeat) player.switchLane(-1);
                    break;
                case 's': case 'arrowdown':
                    if (player.freeMove) { input.down = true; }
                    else if (!e.repeat) player.switchLane(1);
                    break;
                case '1': case '2': case '3': case '4': case '5': case '6':
                    playCard(parseInt(k) - 1); break;
                case ' ': togglePause(); break;
            }
        } else if (gameState === 'paused' && k === ' ') {
            togglePause();
        }
    });

    document.addEventListener('keyup', (e) => {
        const k = e.key.toLowerCase();
        if (k === 'w' || k === 'arrowup') input.up = false;
        if (k === 's' || k === 'arrowdown') input.down = false;
    });

    document.getElementById('card-row').addEventListener('click', (e) => {
        const cardEl = e.target.closest('.card');
        if (cardEl && gameState === 'playing') playCard(parseInt(cardEl.dataset.idx));
    });
}

function togglePause() {
    if (gameState === 'playing') {
        gameState = 'paused';
        document.getElementById('pause-screen').classList.remove('hidden');
    } else if (gameState === 'paused') {
        gameState = 'playing';
        document.getElementById('pause-screen').classList.add('hidden');
    }
}

// =============================================
//  战斗初始化 / 关卡流程
// =============================================
// gameMode: 'stage'=关卡模式 | 'endless'=无尽模式（无限波次+每5波随机Boss）
function makeEndlessStage(wave) {
    const diff = 1 + (wave - 1) * 0.15;                       // 每波难度+15%
    return {
        name: '无尽模式 · 第' + wave + '波',
        scene: null, enemySet: 'random',                      // 默认深色星空+小怪随机混搭
        waves: Infinity, waveBase: 6, waveGrowth: 2,
        types: ['gray', 'green', 'blue', 'red'],
        hpMult: diff, spdMult: Math.min(2.0, 0.9 + (wave - 1) * 0.06),
        fireMult: Math.max(0.55, 1 - (wave - 1) * 0.025),
        endless: true,
    };
}

function initGame(deckData, stageIdx, mode) {
    gameMode = mode || 'stage';
    currentDeckData = deckData;
    stageIndex = stageIdx;
    stage = (gameMode === 'endless') ? makeEndlessStage(1) : STAGES[stageIdx];
    // BGM：按关卡/模式切曲（同曲不断播）
    bgmPlay(gameMode === 'endless' ? 'endless' : 'stage' + (stageIdx + 1));

    player = new Player(deckData.charId);
    crystal = new Crystal();
    boss = null;
    charles = null;
    enemies = []; playerBullets = []; enemyBullets = [];
    particles = []; floatTexts = []; telegraphs = [];
    activeEffects = [];
    nextCardHalfPrice = false; nextCardFree = false;
    handDisabledTimer = 0; transformBoss = null;   // 重置Boss机制状态

    energy = CONFIG.ENERGY_START;
    maxEnergy = CONFIG.ENERGY_MAX;   // 法力突破的+2 SP槽是本局效果，重开关卡时还原
    score = 0; killCount = 0;
    currentWave = 1;
    setupWave();
    phase = 'wave';
    waveBreakTimer = 0; bossWarnTimer = 0;
    shakeTime = 0; _effectsSig = null;

    // 牌组 = 角色卡(1) + 自选卡(19)
    deck = [player.char.card, ...deckData.cards];
    shuffleDeck(deck);
    hand = []; freeMark = []; discardPile = [];
    for (let i = 0; i < CONFIG.INITIAL_DRAW; i++) drawCard();

    gameState = 'playing';
    hideMenuScreens();
    hideEndScreens();
    renderCards();
    updateUI();
}

// =============================================
//  教学关卡（2026-09-25）— 克希娅 · 洞穴 · 脚本化敌人+手牌管理
// =============================================
let tutorialStep = 0;
let tutorialKillCount = 0;   // 当前阶段的击杀计数

function initTutorial() {
    gameMode = 'tutorial';
    stageIndex = 0;
    stage = STAGES[0];           // 第1关洞穴背景
    bgmPlay('stage1');
    tutorialStep = 0;
    tutorialKillCount = 0;
    phase = 'wave';

    player = new Player('kexiya');
    crystal = new Crystal();
    boss = null; charles = null;
    enemies = []; playerBullets = []; enemyBullets = [];
    particles = []; floatTexts = []; telegraphs = [];
    activeEffects = []; nextCardHalfPrice = false; nextCardFree = false;
    energy = 10; maxEnergy = CONFIG.ENERGY_MAX;
    score = 0; killCount = 0; currentWave = 1;
    // 小牌组：蓝色击杀抽牌时有牌可抽
    deck = ['heal', 'shield', 'damage_up', 'rapid_fire', 'draw2'];
    discardPile = []; hand = []; freeMark = [];

    // 阻止常规波次逻辑（waveEnemiesLeft=undefined → 两个if都不触发）
    waveEnemiesLeft = undefined; spawnTimer = 0; shakeTime = 0; _effectsSig = null;

    gameState = 'playing';
    hideMenuScreens();
    hideEndScreens();
    renderCards();
    updateUI();
    showTutorialHint(TUTORIAL_STEPS[0].hint);
    spawnTutorialEnemies();
}

function showTutorialHint(text) {
    // 教程提示：3秒显示、不上飘、大字号、便于阅读
    const ft = new FloatText(640, 160, text, '#ffe14d');
    ft.life = 3; ft.vy = 0; ft.big = true;
    floatTexts.push(ft);
}

function advanceTutorialStep() {
    tutorialStep++;
    if (tutorialStep >= TUTORIAL_STEPS.length) {
        // 教程完成：显示完成提示，不自动退出（玩家手动退出自建卡组）
        return;
    }
    const step = TUTORIAL_STEPS[tutorialStep];
    showTutorialHint(step.hint);
    if (step.handCard) {
        hand = [step.handCard]; freeMark = [false];
        renderCards();
    }
    if (step.enemyTypes) { spawnTutorialEnemies(); }
}

function spawnTutorialEnemies() {
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step.enemyTypes) return;
    step.enemyTypes.forEach(type => {
        const e = new Enemy(type, 1, stage);
        e.x = CONFIG.CANVAS_WIDTH - 150 - Math.random() * 100;
        e.y = CONFIG.LANE_YS[1];
        e.hp = 200; e.maxHp = 200;   // 教程专用血量：不被刃域秒杀，足够体验射杀
        enemies.push(e);
    });
}

// 教程步骤推进（事件驱动：tutorialOnEnemyKilled / tutorialOnCardPlayed）
function updateTutorial() { }

function tutorialOnCardPlayed(cardId) {
    if (gameMode !== 'tutorial') return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step || !step.handCard) return;
    // 只要打出一张牌就推进教程（用完卡后自动进入下一步）
    advanceTutorialStep();
}

function tutorialOnEnemyKilled(enemy) {
    if (gameMode !== 'tutorial') return;
    const step = TUTORIAL_STEPS[tutorialStep];
    if (!step) return;
    if (step.enemyTypes && step.enemyTypes.includes(enemy.type)) {
        const alive = enemies.filter(e => !e.friendlyGone && e.hp > 0);
        if (alive.length === 0) advanceTutorialStep();
    }
}

function setupWave() {
    if (gameMode === 'endless') {
        // 无尽模式：波次无限、难度递增、波间隔渐短
        stage = makeEndlessStage(currentWave);
        waveEnemiesLeft = stage.waveBase + (currentWave - 1) * stage.waveGrowth;
        spawnInterval = Math.max(450, 1500 - (currentWave - 1) * 40);
        spawnTimer = 0;
        return;
    }
    waveEnemiesLeft = stage.waveBase + (currentWave - 1) * stage.waveGrowth;
    spawnTimer = 0;
    spawnInterval = Math.max(520, 1900 - (currentWave - 1) * 180 - stageIndex * 90);
}

function shuffleDeck(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
}

// =============================================
//  卡牌系统
// =============================================
function drawCard() {
    if (hand.length >= CONFIG.HAND_LIMIT) return false;
    if (deck.length === 0) {
        if (discardPile.length === 0) return false;
        deck = [...discardPile]; discardPile = [];
        shuffleDeck(deck);
        floatTexts.push(new FloatText(640, 320, '牌库已洗牌', '#f9ca24'));
    }
    const card = deck.shift();
    hand.push(card);
    freeMark.push(false);   // 与hand平行同步：新抽的牌默认不免费
    return true;
}

function drawCards(n) {
    let d = 0;
    for (let i = 0; i < n; i++) if (drawCard()) d++;
    return d;
}

function playCard(idx) {
    if (gameState !== 'playing') return;
    if (handDisabledTimer > 0) { floatTexts.push(new FloatText(640, 200, '手牌被封锁！', '#ff4444')); return; }
    if (idx < 0 || idx >= hand.length) return;
    const cardId = hand[idx];
    const def = CARD_DEFINITIONS[cardId];
    if (!def) return;

    let cost = def.cost;
    if (freeMark[idx]) cost = 0;
    else if (nextCardFree) cost = 0;
    else if (nextCardHalfPrice) cost = Math.ceil(cost / 2);
    // 芙丽西斯被动：最右边手牌始终花费为0
    if (player.char.rightmostFree && idx === hand.length - 1) cost = 0;
    if (energy < cost) return;

    energy -= cost;
    nextCardHalfPrice = false; nextCardFree = false;
    hand.splice(idx, 1);
    freeMark.splice(idx, 1);
    discardPile.push(cardId);

    applyCardEffect(cardId, def);
    tutorialOnCardPlayed(cardId);
    renderCards();
    updateUI();
}

function applyCardEffect(cardId, def) {
    const now = performance.now();
    switch (cardId) {
        // 角色专属卡
        case 'kexiya_card': // 遁形：自身与水晶5秒无法被攻击
            addEffect('shield', def, now);
            addEffect('crystal_shield', def, now);
            floatText(player.x, '遁形!', def.color);
            break;
        case 'miss2_card': // 时间禁锢：全场时间暂停5秒
            addEffect('time_stop', def, now);
            floatText(player.x, '时间禁锢!', def.color);
            break;
        case 'azathoth_card': { // 混沌终焉：湮灭场上所有敌人（BOSS也无法幸免）
            screenFlash = 1;
            shake(32, 900);
            floatTexts.push(new FloatText(640, 290, '混 沌 终 焉', '#ffffff'));
            spawnParticles(640, 360, '#111111', 40, 10);
            for (const e of [...enemies]) {
                spawnParticles(e.x + e.width / 2, e.y + e.height / 2, '#111111', 12, 5);
                onEnemyKilled(e); // 保留击杀奖励（回费/抽牌/抽卡）
            }
            if (boss && (boss.state === 'fight' || boss.state === 'enter')) boss.takeDamage(boss.hp);
            break;
        }
        case 'yangtaole_card': { // 保护协议：召唤查尔斯驻守当前通道；已在场则传送至当前通道并回满血
            if (charles) {
                charles.moveToLane(player.laneIndex);
                charles.hp = charles.maxHp;
                spawnParticles(charles.x + charles.width / 2, charles.y + charles.height / 2, '#5eead4', 20, 6);
                floatText(player.x, '查尔斯转移·血量回满!', def.color);
            } else {
                charles = new Charles(player.laneIndex);
                spawnParticles(charles.x + charles.width / 2, charles.y + charles.height / 2, '#5eead4', 20, 6);
                floatText(player.x, '查尔斯登场!', def.color);
            }
            break;
        }
        case 'felisis_card': { // 化身修罗：完全变成友方Boss 8秒（Boss贴图翻转朝右+Boss弹幕+技能）
            const keys = ['worm', 'twin', 'destroyer', 'abyss', 'core'];
            const key = keys[Math.floor(Math.random() * keys.length)];
            player.transformed = key;
            player.transformTimer = def.duration;
            player.invulnerable = def.duration;
            // 友方Boss实体：位于水晶前方（覆盖三通道），使用原Boss贴图翻转朝右
            transformBoss = {
                key: key,
                def: BOSSES[key],
                x: 300, y: 360,
                timer: def.duration,
                fireTimer: 0,
            };
            const bossName = BOSSES[key].name;
            floatTexts.push(new FloatText(640, 200, '化身·' + bossName + '!', '#ff6b9d'));
            shake(20, 600);
            // 立刻发动Boss技能
            triggerBossSkill(key);
            break;
        }

        // 子弹强化
        case 'double_shot': case 'triple_shot': case 'rapid_fire': case 'piercing':
        case 'power_ammo': case 'big_bullet': case 'explosive_shot': case 'vampire_bullet':
        case 'laser_beam': case 'ricochet': case 'poison_bullet': case 'freeze_bullet':
            addEffect(cardId, def, now); break;

        // 弹幕模式
        case 'spread_shot': case 'wide_spread': case 'circular_burst': case 'side_shot':
        case 'spiral_shot': case 'shotgun_blast': case 'meteor_shot': case 'wave_cannon':
            addEffect(cardId, def, now); break;

        // 属性强化
        case 'hp_boost':
            player.maxHp += 20; player.hp = Math.min(player.maxHp, player.hp + 20);
            floatText(player.x, '+20 最大生命', def.color); break;
        case 'max_hp_up2':
            player.maxHp += 30; floatText(player.x, '+30 最大生命', def.color); break;
        case 'heal': {
            const amt = Math.min(30, player.maxHp - player.hp);
            player.hp += amt; floatText(player.x, '+' + amt + ' HP', def.color);
            drawCard(); break;   // 治疗系卡附赠：抽1张
        }
        case 'full_heal': player.hp = player.maxHp; floatText(player.x, '生命回满', def.color); drawCard(); break;
        case 'damage_up': player.damage += 5; floatText(player.x, '+5 伤害', def.color); break;
        case 'damage_up2': player.damage += 10; floatText(player.x, '+10 伤害', def.color); break;
        case 'speed_up': player.speedMult += 0.9; floatText(player.x, '换道提速', def.color); break;
        case 'defense_up': player.damageReduction = 0.3; floatText(player.x, '防御强化', def.color); break;
        case 'regen': addEffect('regen', def, now); player.regenAccum = 0; drawCard(); break;
        case 'crystal_heal':
            crystal.hp = Math.min(crystal.maxHp, crystal.hp + 30);
            floatText(120, '+30 水晶HP', def.color);
            drawCard(); break;

        // 辅助
        case 'draw2': floatText(player.x, '抽' + drawCards(2) + '张', def.color); break;
        case 'draw3': floatText(player.x, '抽' + drawCards(3) + '张', def.color); break;
        case 'half_price': nextCardHalfPrice = true; floatText(player.x, '下张半价', def.color); break;
        case 'free_play': nextCardFree = true; floatText(player.x, '下张免费', def.color); break;
        case 'energy_burst': energy = Math.min(maxEnergy, energy + 3); floatText(player.x, '+3 能量', '#44ff66'); break;
        case 'energy_max': energy = maxEnergy; floatText(player.x, '能量满载', '#44ff66'); break;
        case 'shuffle':
            if (discardPile.length > 0) {
                deck = [...deck, ...discardPile]; discardPile = [];
                shuffleDeck(deck); floatText(player.x, '已洗牌', def.color);
            }
            break;
        case 'discard_draw': {
            const n = hand.length;
            for (const id of hand) discardPile.push(id);
            hand = [];
            freeMark = [];
            floatText(player.x, '换手 ' + drawCards(n) + '张', def.color); break;
        }
        case 'blessing': // 恩赐：当前手牌全部标记免费（新抽的牌不继承）
            for (let i = 0; i < hand.length; i++) freeMark[i] = true;
            floatText(player.x, '恩赐! 手牌全部免费', def.color);
            break;
        case 'clear_bullets':
            for (const b of enemyBullets) spawnParticles(b.x, b.y, '#f9ca24', 3, 3);
            enemyBullets = [];
            floatText(640, 320, '弹幕清除!', def.color); break;
        case 'time_slow': addEffect('time_slow', def, now); break;
        case 'bomb': {
            const toKill = [];
            for (const e of enemies) {
                e.hp -= 40; e.hitFlash = 100;
                spawnParticles(e.x + e.width/2, e.y + e.height/2, '#ff8844', 8, 5);
                if (e.hp <= 0) toKill.push(e);
            }
            if (boss && boss.state === 'fight') boss.takeDamage(40);
            for (const e of toKill) onEnemyKilled(e);
            shake(20, 500); floatText(640, 320, '轰炸!', def.color); break;
        }
        case 'shield': case 'rage': case 'crystal_shield': case 'double_energy': case 'overload':
            addEffect(cardId, def, now); break;

        // 法术牌（2026-09-18 新增类别）
        case 'time_stop': case 'time_decel':
            addEffect(cardId, def, now); break;
        case 'mana_burst': // 法力突破：永久+2 SP上限（当前SP不变）
            maxEnergy += 2;
            floatText(player.x, 'SP上限 +2!', def.color);
            break;
        case 'magic_shield': // 魔法护盾：50点吸收盾持续5秒，先于血量/查尔斯转移承受伤害（再施放刷新）
            player.shieldHp = MAGIC_SHIELD_HP;
            addEffect('magic_shield', def, now);
            floatText(player.x, '魔法护盾 +50', def.color);
            break;
        case 'enigma': { // 恩尼格玛：将手牌补充至满(5张)
            let drew = 0;
            while (hand.length < CONFIG.HAND_LIMIT && drawCard()) drew++;
            floatText(player.x, drew > 0 ? '手牌补满 +' + drew + '张' : '手牌已满', def.color);
            break;
        }
        case 'charm_shot': {
            // 魅惑弹：命中敌人使其成为友军（穿透，可连魅多个）
            playerBullets.push({
                x: player.x + player.width, y: player.y + player.height / 2,
                vx: 8.5, vy: 0, damage: 0, piercing: true, hitSet: new Set(),
                w: 20, h: 20, color: '#ff8ad8', onHit: {}, homing: false,
                bounces: 0, circle: true, charm: true, seed: 0, sprite: null,
            });
            floatText(player.x, '魅惑弹发射!', def.color);
            break;
        }
        case 'foresight': {
            const d = drawCard();
            let preview = '牌库顶: ';
            for (let i = 0; i < Math.min(2, deck.length); i++)
                preview += CARD_DEFINITIONS[deck[i]].name + (i < 1 ? ', ' : '');
            floatText(player.x, d ? '抽1张' : '手牌已满', def.color);
            floatTexts.push(new FloatText(640, 360, preview, '#aaaaff')); break;
        }
        case 'thin_deck':
            if (deck.length > 0) floatText(player.x, '移除: ' + CARD_DEFINITIONS[deck.shift()].name, def.color);
            break;
    }
    spawnParticles(player.x + 18, player.y + 18, def.color, 12, 4);
}

function floatText(x, text, color) {
    floatTexts.push(new FloatText(x, player.y - 26, text, color));
}

// 化身修罗：立刻发动对应Boss的招牌技能（v2 加强效果确保可见）
function triggerBossSkill(key) {
    switch (key) {
        case 'worm': // 千眼魔物：三通道大范围穿透弹幕
            for (let li = 0; li < 3; li++) {
                const laneY = CONFIG.LANE_YS[li];
                for (let i = 0; i < 7; i++) {
                    const a = (i - 3) * 0.22;
                    playerBullets.push({ x: player.x + 18, y: player.y + 18, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, damage: 40, piercing: true, hitSet: new Set(), w: 14, h: 14, color: '#88ff66', onHit: {}, circle: true });
                }
            }
            shake(12, 300);
            break;
        case 'twin': // 街头兽王：冲锋冲击波（全屏80伤+震屏）
            for (const e of enemies) { e.hp -= 80; e.hitFlash = 100;
                spawnParticles(e.x + e.width/2, e.y + e.height/2, '#ffaa33', 10, 6); }
            enemies = enemies.filter(e => e.hp > 0);
            shake(20, 600);
            floatTexts.push(new FloatText(640, 300, '冲锋！', '#ffaa33'));
            break;
        case 'destroyer': // 深红之瞳：全屏伤害脉冲（100伤+红光粒子+Boss伤150）
            for (const e of enemies) { e.hp -= 100; e.hitFlash = 100;
                spawnParticles(e.x + e.width/2, e.y + e.height/2, '#ff4444', 12, 7); }
            enemies = enemies.filter(e => e.hp > 0);
            if (boss && boss.state === 'fight') boss.takeDamage(150);
            shake(25, 800);
            floatTexts.push(new FloatText(640, 300, '湮灭脉冲！', '#ff5577'));
            break;
        case 'abyss': { // 机械巨兽：召唤2个魅惑友军作战（200血，自动攻击敌方）
            for (let i = 0; i < 2; i++) {
                const minion = new Enemy('gray', Math.floor(Math.random() * 3), stage);
                minion.x = player.x + 100 + i * 80;
                minion.y = CONFIG.LANE_YS[Math.floor(Math.random() * 3)];
                minion.friendly = true;   // 魅惑友军：自动向右飞行攻击敌方
                minion.hp = 200; minion.maxHp = 200;
                enemies.push(minion);
                spawnParticles(minion.x, minion.y, '#aa66ff', 15, 5);
            }
            floatTexts.push(new FloatText(640, 300, '召唤友军！', '#aa66ff'));
            break;
        }
        case 'core': // NULL：清除所有敌方子弹+短暂屏幕闪光
            for (const b of enemyBullets) spawnParticles(b.x, b.y, '#ff4466', 3, 3);
            enemyBullets = [];
            screenFlash = 0.8;
            floatTexts.push(new FloatText(640, 300, '湮灭光波！', '#ff4466'));
            break;
    }
}

function addEffect(type, def, now) {
    let dur = def.duration || 0;
    // 二小姐被动：时间法术卡效果延长2秒
    if (dur > 0 && player.char.passive === 'timeExtend') dur += 2000;
    const endTime = now + dur;
    const ex = activeEffects.find(e => e.type === type);
    if (ex) ex.endTime = endTime;
    else activeEffects.push({ type, name: def.name, color: def.color, endTime });
}

function hasEffect(type) { return activeEffects.some(e => e.type === type); }
function fxSet() { return new Set(activeEffects.map(e => e.type)); }

// =============================================
//  玩家射击（按角色 + 卡牌效果）
// =============================================
function tryFire(now) {
    const st = player.char.stats;

    // 二小姐：间隔释放激光段（每1秒从立绘指尖射出一道穿透激光，发射时攻击姿态，其余时间待机）
    if (player.char.pattern === 'beam') {
        // 急速射击/过载：射击间隔减半
        let gap = st.fireRate;
        if (hasEffect('rapid_fire') || hasEffect('overload')) gap /= 2;
        if (now - player.lastFireTime < gap) return;
        player.lastFireTime = now;
        player.atkPoseT = 420;   // 发射瞬间显示攻击姿态
        // 发射起点：立绘指尖（角色右上方）
        const fxBeam = fxSet();
        let beamDmg = player.damage * 2;
        if (fxBeam.has('power_ammo') || fxBeam.has('overload')) beamDmg = Math.round(beamDmg * 1.5);
        if (fxBeam.has('rage')) beamDmg *= 2;
        if (fxBeam.has('laser_beam')) beamDmg = Math.round(beamDmg * 1.5);
        const beamOnHit = {
            explosive: fxBeam.has('explosive_shot') || fxBeam.has('char_arcane'),
            vampire: fxBeam.has('vampire_bullet'),
            poison: fxBeam.has('poison_bullet'),
            freeze: fxBeam.has('freeze_bullet'),
        };
        // 双发射击/三发射击对激光同样生效：多列激光段
        const beamRows = fxBeam.has('triple_shot') ? 3 : (fxBeam.has('double_shot') ? 2 : 1);
        const sx = player.x + player.width + 14;
        const sy = player.y + player.height * 0.30;
        for (let r = 0; r < beamRows; r++) {
            const oy = (r - (beamRows - 1) / 2) * 18;
            playerBullets.push({
                x: sx, y: sy + oy, vx: 15, vy: 0, damage: beamDmg, piercing: true,
                hitSet: new Set(), w: 150, h: 10, color: '#ffe14d',
                onHit: beamOnHit, homing: false, bounces: 0, circle: false,
                chaos: false, seed: 0, sprite: null, beam: true,
            });
        }
        spawnParticles(sx, sy, '#ffe14d', 8, 3);
        return;
    }

    // 化身修罗：变身期间使用Boss全通道密集弹幕（替代普通射击，0.5秒/轮，覆盖三通道）
    if (player.transformed) {
        if (now - player.lastFireTime < 500) return;
        player.lastFireTime = now;
        const bx = player.x + player.width / 2, by = 360;   // 屏幕中心（覆盖三通道）
        const tk = player.transformed;
        switch (tk) {
            case 'worm': // 全通道散射大弹（5×3=15发覆盖三路）
                for (let li = 0; li < 3; li++) {
                    const ly = CONFIG.LANE_YS[li];
                    for (let i = 0; i < 5; i++) {
                        const a = (i - 2) * 0.2;
                        playerBullets.push({ x: bx, y: ly, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, damage: 35, piercing: true, hitSet: new Set(), w: 14, h: 14, color: '#88ff66', onHit: {}, circle: true });
                    }
                }
                break;
            case 'twin': // 三通道贯穿激光
                for (let li = 0; li < 3; li++) {
                    playerBullets.push({ x: bx, y: CONFIG.LANE_YS[li], vx: 14, vy: 0, damage: 25, piercing: true, hitSet: new Set(), w: 50, h: 8, color: '#ffaa33', onHit: {}, circle: false });
                }
                break;
            case 'destroyer': // 大范围穿透激光（中央+上下偏移）
                playerBullets.push({ x: bx, y: 360, vx: 18, vy: 0, damage: 40, piercing: true, hitSet: new Set(), w: 120, h: 10, color: '#ff5577', onHit: {}, circle: false });
                break;
            case 'abyss': // 三通道散弹
                for (let li = 0; li < 3; li++) {
                    const ly = CONFIG.LANE_YS[li];
                    for (let i = -1; i <= 1; i++) {
                        const a = i * 0.35;
                        playerBullets.push({ x: bx, y: ly, vx: Math.cos(a) * 10, vy: Math.sin(a) * 10, damage: 25, piercing: false, hitSet: new Set(), w: 12, h: 12, color: '#aa66ff', onHit: {}, circle: true });
                    }
                }
                break;
            case 'core': // 8方向环形弹（全通道覆盖）
                for (let i = 0; i < 12; i++) {
                    const a = (i / 12) * Math.PI * 2;
                    playerBullets.push({ x: bx, y: 360, vx: Math.cos(a) * 8, vy: Math.sin(a) * 8, damage: 20, piercing: true, hitSet: new Set(), w: 10, h: 10, color: '#ff4466', onHit: {}, circle: true });
                }
                break;
        }
        spawnParticles(bx, by, '#ff6b9d', 5, 3);
        return;
    }

    const st2 = st;
    let fireRate = st2.fireRate;
    if (hasEffect('rapid_fire') || hasEffect('overload')) fireRate /= 2;
    if (hasEffect('char_rapid')) fireRate /= 3;
    if (now - player.lastFireTime < fireRate) return;
    player.lastFireTime = now;

    const fx = fxSet();
    let dmg = player.damage;
    if (fx.has('power_ammo') || fx.has('overload')) dmg = Math.round(dmg * 1.5);
    if (fx.has('rage')) dmg *= 2;

    let bw = st.bulletW, bh = st.bulletH, bColor = player.char.color, speed = st.bulletSpeed;
    if (fx.has('laser_beam')) { bw = 52; bh = 4; bColor = '#ff44ff'; dmg = Math.round(dmg * 1.5); }
    if (fx.has('big_bullet')) { bw = Math.round(bw * 1.8); bh = Math.round(bh * 1.8); bColor = '#ffaa22'; dmg = Math.round(dmg * 2); }

    let piercing = player.char.pattern === 'pierce' || fx.has('piercing') || fx.has('laser_beam') || fx.has('overload');
    const homing = player.char.pattern === 'homing';

    const onHit = {
        explosive: fx.has('explosive_shot') || fx.has('char_arcane'),
        vampire: fx.has('vampire_bullet'),
        ricochet: fx.has('ricochet'),
        poison: fx.has('poison_bullet'),
        freeze: fx.has('freeze_bullet'),
    };

    // 基础角度（角色形态）
    let angles;
    switch (player.char.pattern) {
        case 'spread3': angles = [-0.28, 0, 0.28]; break;
        case 'chaos': angles = [(Math.random() - 0.5) * 0.24]; break; // 混沌弹随机微偏
        case 'random': { // 芙丽西斯：随机模仿其他4角色子弹（伤害使用玩家的计算值，含攻击卡加成）
            const v = FELISIS_BULLETS[Math.floor(Math.random() * FELISIS_BULLETS.length)];
            bw = v.w; bh = v.h; speed = v.speed;
            bColor = v.color;
            if (v.chaos) { angles = [(Math.random() - 0.5) * 0.24]; player.char._chaosShot = true; }
            else { angles = [0]; player.char._chaosShot = false; }
            if (v.sprite) { fireBullet(player.x + player.width, player.y + player.height / 2,
                Math.cos(angles[0]) * speed, Math.sin(angles[0]) * speed, dmg, v.piercing, bw, bh, bColor, onHit, false, false, v.sprite);
                return; }
            break;
        }
        default: angles = [0];
    }
    // 角色卡强化
    if (fx.has('char_triple')) angles = [-0.3, 0, 0.3];
    if (fx.has('char_nova')) angles = Array.from({length: 9}, (_, i) => (i - 4) * (Math.PI / 6));
    if (fx.has('char_prism')) { angles = [-0.22, 0, 0.22]; bColor = '#c4b5fd'; bw = Math.round(bw * 1.2); }
    // 弹幕卡追加
    if (fx.has('spread_shot')) angles = angles.concat([-0.38, 0.38]);
    if (fx.has('wide_spread')) angles = angles.concat([-0.62, -0.31, 0.31, 0.62]);

    // 平行弹列数
    let rows = 1;
    if (fx.has('double_shot') || fx.has('overload')) rows = 2;
    if (fx.has('triple_shot')) rows = 3;

    for (let r = 0; r < rows; r++) {
        const oy = (r - (rows - 1) / 2) * 16;
        for (const a of angles) {
            fireBullet(player.x + player.width, player.y + player.height / 2 + oy,
                Math.cos(a) * speed, Math.sin(a) * speed,
                dmg, piercing, bw, bh, bColor, onHit, homing, player.char.pattern === 'chaos',
                player.char.bulletSprite || null);
        }
    }
    player.atkPoseT = 260;   // 克希娅：射击时短暂切换攻击姿态

    // 附加弹幕
    if (fx.has('side_shot')) {
        fireBullet(player.x + player.width/2, player.y, 0, -speed, dmg, piercing, 5, 12, '#88ffaa', onHit);
        fireBullet(player.x + player.width/2, player.y + player.height, 0, speed, dmg, piercing, 5, 12, '#88ffaa', onHit);
    }
    if (fx.has('shotgun_blast')) {
        for (let i = 0; i < 6; i++) {
            const a = (Math.random() - 0.5) * 0.6;
            fireBullet(player.x + player.width, player.y + player.height/2,
                Math.cos(a) * speed * 0.9, Math.sin(a) * speed * 0.9,
                Math.round(dmg * 0.6), false, 8, 8, '#ffcc66', {});
        }
    }
    if (fx.has('circular_burst') && player.circularTimer >= 600) {
        player.circularTimer = 0;
        for (let i = 0; i < 10; i++) {
            const a = (i / 10) * Math.PI * 2;
            fireBullet(player.x + player.width/2, player.y + player.height/2,
                Math.cos(a) * speed * 0.7, Math.sin(a) * speed * 0.7,
                Math.round(dmg * 0.7), false, 9, 9, '#44ffcc', {});
        }
    }
    if (fx.has('spiral_shot')) {
        const a = player.spiralAngle;
        fireBullet(player.x + player.width/2, player.y + player.height/2,
            Math.cos(a) * speed, Math.sin(a) * speed, Math.round(dmg * 0.8), false, 8, 8, '#44ddff', {});
    }
    if (fx.has('meteor_shot')) {
        for (let i = 0; i < 3; i++) {
            const a = Math.random() * Math.PI * 2;
            fireBullet(player.x + player.width/2, player.y + player.height/2,
                Math.cos(a) * speed * 0.8, Math.sin(a) * speed * 0.8,
                Math.round(dmg * 0.6), false, 7, 7, '#ff66ff', {});
        }
    }
    if (fx.has('wave_cannon')) {
        fireBullet(player.x + player.width, player.y + player.height/2,
            speed * 0.5, 0, dmg * 3, piercing, 34, 22, '#ff44ff', onHit);
    }
}

function fireBullet(x, y, vx, vy, dmg, piercing, w, h, color, onHit, homing, chaos, sprite) {
    playerBullets.push({
        x, y, vx, vy, damage: dmg, piercing, hitSet: new Set(),
        w, h, color, onHit: { ...onHit }, homing: !!homing,
        bounces: onHit.ricochet ? 3 : 0,
        circle: w === h,
        chaos: !!chaos, seed: Math.random() * Math.PI * 2,
        sprite: sprite || null,     // 贴图弹（如克希娅匕首）
        charm: false,
    });
}

function nearestTarget(x, y) {
    let best = null, bestD = Infinity;
    for (const e of enemies) {
        const c = e.getCenter();
        const d = (c.x - x) ** 2 + (c.y - y) ** 2;
        if (d < bestD) { bestD = d; best = c; }
    }
    if (boss && boss.state === 'fight') {
        const d = (boss.x - x) ** 2 + (boss.y - y) ** 2;
        if (d < bestD) best = { x: boss.x, y: boss.y };
    }
    return best;
}

// =============================================
//  预警（Boss 攻击前摇）
// =============================================
function scheduleTelegraph(info, cb) {
    telegraphs.push({ lanes: info.lanes, safeLane: info.safeLane, color: info.color, timer: info.ms, cb });
}

// =============================================
//  更新
// =============================================
function update(dt) {
    const now = performance.now();
    // 时间暂停：敌人、Boss、敌弹全部静止（预警计时也暂停）
    const frozen = hasEffect('time_stop');
    if (gameMode === 'tutorial') updateTutorial();
    player.update(dt);
    tryFire(now);

    // 手牌禁用计时（真-芙丽西斯Boss机制）
    if (handDisabledTimer > 0) handDisabledTimer -= dt;
    // 化身修罗：变身计时+期间接触伤害（三通道阻挡）
    if (player.transformed) {
        player.transformTimer -= dt;
        if (player.transformTimer <= 0) { player.transformed = null; }
        else {
            // 化身期间三通道阻挡：范围内敌人持续受伤
            for (const e of enemies) {
                const ec = e.getCenter();
                if (Math.abs(ec.x - player.x - 18) < 120 && Math.abs(ec.y - 410) < 200) {
                    e.hp -= 3; e.hitFlash = 40;
                    if (e.hp <= 0) onEnemyKilled(e);
                }
            }
        }
    }

    // 能量回复
    energyTimer += dt;
    const regenMs = CONFIG.ENERGY_REGEN_MS / (hasEffect('double_energy') ? 2 : 1);
    if (energyTimer >= regenMs) {
        energyTimer = 0;
        if (energy < maxEnergy) {
            energy++;
            floatTexts.push(new FloatText(player.x + 18, player.y - 10, '+1 能量', '#44ff66'));
        }
    }

    // 关卡阶段机
    if (phase === 'wave') {
        spawnTimer += dt;
        if (waveEnemiesLeft > 0 && spawnTimer >= spawnInterval && enemies.length < 14) {
            spawnTimer = 0; waveEnemiesLeft--;
            const type = stage.types[Math.floor(Math.random() * stage.types.length)];
            enemies.push(new Enemy(type, Math.floor(Math.random() * 3), stage));
        }
        if (waveEnemiesLeft === 0 && enemies.length === 0) {
            // 无尽模式：每5波出现一个随机Boss
            if (gameMode === 'endless' && currentWave % 5 === 0) {
                phase = 'bossWarn'; bossWarnTimer = CONFIG.BOSS_WARNING_MS;
                floatTexts.push(new FloatText(640, 300, '⚠ BOSS 来袭 ⚠', '#ff4444'));
                shake(10, 800);
            } else if (currentWave < stage.waves) {
                phase = 'break'; waveBreakTimer = CONFIG.WAVE_BREAK_MS;
                floatTexts.push(new FloatText(640, 300, `第 ${currentWave} 波 肃清`, '#44ff88'));
            } else {
                phase = 'bossWarn'; bossWarnTimer = CONFIG.BOSS_WARNING_MS;
                floatTexts.push(new FloatText(640, 300, '⚠ BOSS 来袭 ⚠', '#ff4444'));
                shake(10, 800);
            }
        }
    } else if (phase === 'break') {
        waveBreakTimer -= dt;
        if (waveBreakTimer <= 0) {
            currentWave++; setupWave(); phase = 'wave';
            floatTexts.push(new FloatText(640, 280, `第 ${currentWave} 波`, '#ffaa44'));
        }
    } else if (phase === 'bossWarn') {
        bossWarnTimer -= dt;
        if (bossWarnTimer <= 0) {
            if (gameMode === 'endless') {
                // 无尽模式：每5波一个随机Boss；第20波必出隐藏Boss真-芙丽西斯
                let def;
                if (currentWave === 20) {
                    def = BOSSES.true_felisis;
                    floatTexts.push(new FloatText(640, 250, '⚠ 隐藏Boss现身 ⚠', '#ff6b9d'));
                    // 出场即解锁芙丽西斯（无论后续是否击败/退出）
                    if (!store.felisisUnlocked) {
                        store.felisisUnlocked = true;
                        saveStore(store);
                        floatTexts.push(new FloatText(640, 290, '🔓 已解锁角色：芙丽西斯！', '#ff6b9d'));
                    }
                } else {
                    const keys = Object.keys(BOSSES).filter(k => k !== 'true_felisis');
                    def = BOSSES[keys[Math.floor(Math.random() * keys.length)]];
                }
                boss = new Boss(def, Math.floor(currentWave / 5) - 1);
                // 真-芙丽西斯出场禁手牌7秒
                if (def.disableHandOnSpawn) handDisabledTimer = def.disableHandOnSpawn;
            } else {
                boss = new Boss(BOSSES[stage.boss], stageIndex);
            }
            phase = 'boss';
        }
    } else if (phase === 'boss' && boss) {
        if (!frozen) boss.update(dt, now);
        if (boss.state === 'dying' && boss.deathTimer <= 0) {
            spawnParticles(boss.x, boss.y, boss.def.color, 60, 9);
            for (const b of enemyBullets) spawnParticles(b.x, b.y, '#ffcc44', 3, 4);
            enemyBullets = []; telegraphs = [];
            // Boss死亡：清除手牌禁用
            handDisabledTimer = 0;
            if (boss.def.shape === 'true_felisis') {
                floatTexts.push(new FloatText(640, 280, '🔓 解锁角色：芙丽西斯！', '#ff6b9d'));
            }
            boss = null;
            if (gameMode === 'endless') {
                score += 1500;
                currentWave++; setupWave(); phase = 'wave';
                floatTexts.push(new FloatText(640, 280, 'BOSS 击破！继续无尽挑战', '#ff44ff'));
            } else {
                score += 500 * (stageIndex + 1);
                onStageClear();
                return;
            }
        }
    }

    // 预警计时
    if (!frozen) {
        for (let i = telegraphs.length - 1; i >= 0; i--) {
            const t = telegraphs[i];
            t.timer -= dt;
            if (t.timer <= 0) { if (t.cb) t.cb(); telegraphs.splice(i, 1); }
        }
    }

    // 机械随从·查尔斯：驻守自动射击；血量耗尽损毁退场（不冻结——友方单位）
    if (charles) {
        charles.update(dt, now);
        if (charles.hp <= 0) {
            spawnParticles(charles.x + charles.width / 2, charles.y + charles.height / 2, '#ff8844', 26, 7);
            spawnParticles(charles.x + charles.width / 2, charles.y + charles.height / 2, '#5eead4', 14, 4);
            floatTexts.push(new FloatText(charles.x, charles.y - 30, '查尔斯损毁!', '#ff8844'));
            shake(10, 350);
            charles = null;
        }
    }

    // 敌人
    for (let i = enemies.length - 1; i >= 0; i--) {
        const e = enemies[i];
        if (!frozen) e.update(dt, now);
        if (e.friendlyGone) { enemies.splice(i, 1); continue; }   // 魅惑友军飞出右缘
        if (e.hp <= 0) { onEnemyKilled(e); continue; }
        if (e.friendly) continue;   // 友军不撞水晶/主角
        if (e.x <= crystal.x + crystal.width) {
            crystal.takeDamage(e.damage);
            shake(15, 400);
            spawnParticles(e.x, e.y, '#ff4444', 16, 5);
            enemies.splice(i, 1);
            if (crystal.hp <= 0) { crystal.hp = 0; endGame('水晶被摧毁！'); return; }
            continue;
        }
        // 查尔斯阻挡：小怪撞击查尔斯后消亡，撞击伤害由查尔斯承受（不掉分不抽牌）
        if (charles && rectOverlap(e, charles)) {
            charles.takeDamage(e.damage);
            spawnParticles(e.x + e.width / 2, e.y + e.height / 2, e.def.color, 10, 4);
            floatTexts.push(new FloatText(charles.x + charles.width / 2, charles.y - 24, '阻挡!', '#5eead4'));
            enemies.splice(i, 1);
            continue;
        }
        // 化身修罗：变身期间玩家覆盖三通道，碰撞小怪消亡（不掉分不抽牌）
        if (player.transformed && rectOverlap(e, player)) {
            e.hp -= 50; e.hitFlash = 60;
            spawnParticles(e.x + e.width/2, e.y + e.height/2, '#ff6b9d', 8, 4);
            if (e.hp <= 0) { onEnemyKilled(e); }
            enemies.splice(i, 1);
            continue;
        }
        if (rectOverlap(e, player)) {
            if (player.takeDamage(e.damage)) {
                spawnParticles(player.x + 18, player.y + 18, '#ff6677', 12, 4);
                shake(8, 200);
            }
            spawnParticles(e.x + e.width/2, e.y + e.height/2, e.def.color, 10, 4);
            enemies.splice(i, 1);
            if (player.hp <= 0) { player.hp = 0; endGame('角色阵亡！'); return; }
        }
    }

    // 玩家子弹
    for (let i = playerBullets.length - 1; i >= 0; i--) {
        const b = playerBullets[i];
        if (b.homing) {
            const tgt = nearestTarget(b.x, b.y);
            if (tgt) {
                const want = Math.atan2(tgt.y - b.y, tgt.x - b.x);
                let cur = Math.atan2(b.vy, b.vx);
                let diff = want - cur;
                while (diff > Math.PI) diff -= Math.PI * 2;
                while (diff < -Math.PI) diff += Math.PI * 2;
                cur += Math.max(-0.09, Math.min(0.09, diff));
                const spd = Math.hypot(b.vx, b.vy);
                b.vx = Math.cos(cur) * spd; b.vy = Math.sin(cur) * spd;
            }
        }
        if (b.chaos) { // 混沌弹：蛇形漂移 + 暗色烟尾
            b.y += Math.sin(now * 0.012 + b.seed) * 1.1;
            if (Math.random() < 0.3) spawnParticles(b.x - 4, b.y, '#16161a', 1, 0.5);
        }
        b.x += b.vx; b.y += b.vy;
        if (b.x > CONFIG.CANVAS_WIDTH + 60 || b.x < -60 || b.y < -60 || b.y > CONFIG.CANVAS_HEIGHT + 60) {
            playerBullets.splice(i, 1); continue;
        }

        let hit = false;
        for (let j = enemies.length - 1; j >= 0; j--) {
            const e = enemies[j];
            if (b.hitSet.has(e)) continue;
            if (b.x < e.x + e.width && b.x + b.w > e.x && b.y < e.y + e.height && b.y + b.h > e.y) {
                hitEnemy(b, e);
                if (b.piercing) b.hitSet.add(e);
                else if (b.onHit.ricochet && b.bounces > 0) {
                    // 弹射弹：hitEnemy 内已扣减 bounces 并转向下一个目标，子弹存活继续飞
                    //（2026-09-24 修复：此前命中即被标记移除，弹射转向永远无法生效）
                }
                else { hit = true; break; }
            }
        }
        // 命中Boss
        if (!hit && boss && boss.state === 'fight' && !b.hitSet.has(boss)) {
            const hb = boss.hitbox;
            if (b.x < hb.x + hb.width && b.x + b.w > hb.x && b.y < hb.y + hb.height && b.y + b.h > hb.y) {
                if (b.onHit.explosive) explodeAt(b.x, b.y, 70, b.damage * 0.5);
                if (b.onHit.vampire) player.hp = Math.min(player.maxHp, player.hp + 1);
                boss.takeDamage(b.damage);
                // 真-芙丽西斯：残血1000时再次禁用手牌直至死亡
                if (boss.def.disableHandAtHp && boss.hp <= boss.def.disableHandAtHp && !boss.handDisabledAtLow) {
                    boss.handDisabledAtLow = true;
                    handDisabledTimer = 999999;   // 持续到Boss死亡
                    floatTexts.push(new FloatText(640, 200, '手牌被封锁！', '#ff4444'));
                }
                spawnParticles(b.x, b.y, boss.def.color, 4, 3);
                if (b.piercing) b.hitSet.add(boss);
                else hit = true;
            }
        }
        if (hit) playerBullets.splice(i, 1);
    }

    // 敌方子弹（时间暂停冻结；时间延缓减速）
    const ebSlow = hasEffect('time_decel') ? 0.5 : 1;
    for (let i = enemyBullets.length - 1; i >= 0; i--) {
        const b = enemyBullets[i];
        if (!frozen) {
            b.x += b.vx * ebSlow; b.y += b.vy * ebSlow;
        }
        if (b.x < -30 || b.x > CONFIG.CANVAS_WIDTH + 60 || b.y < -30 || b.y > CONFIG.CANVAS_HEIGHT + 30) {
            enemyBullets.splice(i, 1); continue;
        }
        if (b.x > player.x && b.x < player.x + player.width && b.y > player.y && b.y < player.y + player.height) {
            if (player.takeDamage(b.damage)) {
                spawnParticles(b.x, b.y, '#ff6677', 6, 3);
                shake(5, 150);
            }
            enemyBullets.splice(i, 1);
            if (player.hp <= 0) { player.hp = 0; endGame('角色阵亡！'); return; }
            continue;
        }
        // 查尔斯拦截敌方子弹：飞入其驻守通道（laneY±55全通道高度）的敌弹全部吸收，
        // 伤害由查尔斯承受（此前仅46px小命中盒，子弹贴着机甲身侧穿过=视觉上"不挡弹"）
        if (charles) {
            const laneY = CONFIG.LANE_YS[charles.laneIndex];
            if (b.x > charles.x - 10 && b.x < charles.x + charles.width + 10 &&
                b.y > laneY - 55 && b.y < laneY + 55) {
                charles.takeDamage(b.damage);
                spawnParticles(b.x, b.y, '#44ccff', 6, 3);
                enemyBullets.splice(i, 1);
            }
        }
    }

    // 效果过期 / 粒子 / 飘字 / 震动 / 星空
    for (let i = activeEffects.length - 1; i >= 0; i--)
        if (now >= activeEffects[i].endTime) activeEffects.splice(i, 1);

    crystal.update(dt);

    for (let i = particles.length - 1; i >= 0; i--) {
        particles[i].update(dt);
        if (!particles[i].isAlive()) particles.splice(i, 1);
    }
    for (let i = floatTexts.length - 1; i >= 0; i--) {
        floatTexts[i].update(dt);
        if (!floatTexts[i].isAlive()) floatTexts.splice(i, 1);
    }
    if (shakeTime > 0) shakeTime -= dt;
    if (screenFlash > 0) screenFlash = Math.max(0, screenFlash - dt / 450);
    for (const s of stars) {
        s.x -= s.speed * 60;
        if (s.x < 0) { s.x = CONFIG.CANVAS_WIDTH; s.y = Math.random() * CONFIG.CANVAS_HEIGHT; }
        s.phase += 0.03;
    }

    updateUI();
}

let energyTimer = 0;

function hitEnemy(b, e) {
    // 魅惑弹：命中敌人使其倒戈成为友军（不造成伤害，可连续魅惑多个）
    if (b.charm) {
        if (!e.friendly) {
            e.friendly = true;
            e.hitFlash = 200;
            e.friendlyHitCd = 0;
            spawnParticles(e.x + e.width/2, e.y + e.height/2, '#ff8ad8', 12, 4);
            floatTexts.push(new FloatText(e.x, e.y - 30, '魅惑!', '#ff8ad8'));
        }
        return;
    }
    e.hp -= b.damage;
    e.hitFlash = 100;
    spawnParticles(b.x, b.y, e.def.color, 4, 3);

    if (b.onHit.explosive) explodeAt(e.x + e.width/2, e.y + e.height/2, 70, b.damage * 0.5);
    if (b.onHit.vampire) player.hp = Math.min(player.maxHp, player.hp + 1);
    if (b.onHit.poison) { e.poisonTimer = 3000; e.poisonDmg = 3; e.poisonAccum = 0; }
    if (b.onHit.freeze) e.freezeTimer = 3000;

    if (b.onHit.ricochet && b.bounces > 0) {
        b.bounces--; b.hitSet.add(e);
        let nearest = null, minD = Infinity;
        for (const e2 of enemies) {
            if (e2 === e || b.hitSet.has(e2)) continue;
            const c = e2.getCenter();
            const d = (c.x - b.x) ** 2 + (c.y - b.y) ** 2;
            if (d < minD) { minD = d; nearest = c; }
        }
        if (nearest) {
            const dx = nearest.x - b.x, dy = nearest.y - b.y;
            const dist = Math.max(1, Math.hypot(dx, dy));
            const spd = Math.hypot(b.vx, b.vy);
            b.vx = (dx / dist) * spd; b.vy = (dy / dist) * spd;
        }
    }

    if (e.hp <= 0) onEnemyKilled(e);
}

function explodeAt(x, y, radius, damage) {
    // 2026-09-24：爆炸反馈加强（弹射/爆裂弹曾"看不出触发"）——弹环粒子+白色火花+轻微震动
    spawnParticles(x, y, '#ffaa33', 26, 8);
    spawnParticles(x, y, '#ffffff', 10, 12);
    shake(4, 120);
    const toKill = [];
    for (const e of enemies) {
        const c = e.getCenter();
        if ((c.x - x) ** 2 + (c.y - y) ** 2 < radius * radius) {
            e.hp -= damage; e.hitFlash = 100;
            if (e.hp <= 0) toKill.push(e);
        }
    }
    for (const e of toKill) onEnemyKilled(e);
}

function onEnemyKilled(enemy) {
    const idx = enemies.indexOf(enemy);
    if (idx === -1) return;
    enemies.splice(idx, 1);
    score += enemy.type === 'red' ? 50 : 10;
    killCount++;
    spawnParticles(enemy.x + enemy.width/2, enemy.y + enemy.height/2, enemy.def.color, 18, 5);

    if (enemy.def.onKill === 'energy') {
        energy = Math.min(maxEnergy, energy + (enemy.def.energyGain || 2));
        floatTexts.push(new FloatText(enemy.x, enemy.y - 10, '+' + (enemy.def.energyGain || 2) + ' 能量', '#44ff66'));
    } else if (enemy.def.onKill === 'drawCard') {
        const drew = drawCard();
        floatTexts.push(new FloatText(enemy.x, enemy.y - 10, drew ? '抽牌!' : '手牌已满', '#44aaff'));
    }
    // 2026-09-24：移除击杀无条件抽牌——只有蓝色（抽牌）敌人击杀才抽牌
    tutorialOnEnemyKilled(enemy);
    renderCards();
}

// =============================================
//  通用
// =============================================
function rectOverlap(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}
function spawnParticles(x, y, color, count, speed) {
    for (let i = 0; i < count; i++)
        particles.push(new Particle(x, y, color, { speed: Math.random() * speed + 1 }));
}
function shake(intensity, duration) {
    shakeTime = Math.max(shakeTime, duration);
    shakeIntensity = Math.max(shakeIntensity, intensity);
}

// =============================================
//  结算
// =============================================
function hideEndScreens() {
    for (const id of ['game-over-screen', 'stage-clear-screen', 'victory-screen', 'pause-screen'])
        document.getElementById(id).classList.add('hidden');
}

function endGame(msg) {
    gameState = 'gameOver';
    let text = `${msg}<br>关卡: ${stage.name} · 得分: ${score} · 击杀: ${killCount}`;
    if (gameMode === 'endless') {
        // 无尽模式：结算并记录历史最高成绩
        let best = 0;
        try { best = parseInt(localStorage.getItem('day68_endless_best') || '0', 10) || 0; } catch (err) { best = 0; }
        const isRecord = score > best;
        if (isRecord) {
            try { localStorage.setItem('day68_endless_best', String(score)); } catch (err) { /* 存储满忽略 */ }
        }
        text += `<br>抵达: 第 ${currentWave} 波<br>` +
            (isRecord ? '<span style="color:#ffe14d">★ 新纪录！</span>'
                      : `历史最高: ${best}`);
    }
    document.getElementById('go-text').innerHTML = text;
    document.getElementById('game-over-screen').classList.remove('hidden');
}

// 暂停菜单·退出关卡：不做结算，直接回主菜单
function exitStage() {
    hideEndScreens();
    gameState = 'menu';
    boss = null; charles = null;
    handDisabledTimer = 0; transformBoss = null;
    enemies = []; playerBullets = []; enemyBullets = [];
    particles = []; floatTexts = []; telegraphs = [];
    activeEffects = [];
    showMenuScreen('start-screen');
}

function onStageClear() {
    gameState = 'stageClear';
    if (stageIndex + 2 > store.unlockedStage) {
        store.unlockedStage = Math.min(STAGES.length, stageIndex + 2);
        saveStore(store);
    }
    // 阿撒托斯解锁条件（2026-09-18）：通过第4关
    if (stageIndex >= 3 && !store.azathothUnlocked) {
        store.azathothUnlocked = true;
        saveStore(store);
    }
    if (stageIndex >= STAGES.length - 1) {
        document.getElementById('victory-text').innerHTML =
            `🎉 全部 ${STAGES.length} 关通关！<br>最终得分: ${score} · 总击杀: ${killCount}`;
        document.getElementById('victory-screen').classList.remove('hidden');
    } else {
        const nextName = STAGES[stageIndex + 1].name;
        let extra = '';
        if (stageIndex === 3) extra = '<br><span style="color:#ffe14d">★ 已解锁隐藏角色：阿撒托斯（第4关通关奖励）</span>';
        document.getElementById('sc-text').innerHTML =
            `${stage.name} 完成！<br>得分: ${score} · 击杀: ${killCount}<br><span style="color:#8af">下一关: ${nextName}</span>${extra}`;
        document.getElementById('sc-next-btn').textContent = `进入下一关 ▶`;
        document.getElementById('stage-clear-screen').classList.remove('hidden');
    }
}

function retryStage() {
    hideEndScreens();
    initGame(currentDeckData, stageIndex);
}

function nextStage() {
    hideEndScreens();
    initGame(currentDeckData, stageIndex + 1);
}

function backToMenu() {
    hideEndScreens();
    gameState = 'menu';
    showMenuScreen('start-screen');
}

// =============================================
//  主循环
// =============================================
function loop(timestamp) {
    if (!lastTime) lastTime = timestamp;
    const dt = Math.min(50, timestamp - lastTime);
    lastTime = timestamp;

    if (gameState === 'playing') update(dt);
    if (gameState !== 'menu') render();
    else { drawBackground(); drawLanes(); drawStars(); }

    requestAnimationFrame(loop);
}
