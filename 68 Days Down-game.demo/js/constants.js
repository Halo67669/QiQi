// ========== 游戏配置 ==========
const CONFIG = {
    CANVAS_WIDTH: 1280,
    CANVAS_HEIGHT: 720,

    // 三路布局（上/中/下）
    LANE_YS: [150, 360, 570],
    LANE_COUNT: 3,

    // 玩家
    PLAYER_X: 170,
    PLAYER_WIDTH: 36,
    PLAYER_HEIGHT: 36,
    PLAYER_HP: 150,   // 2026-09-25 角色血量上限/开局血量 100→150
    PLAYER_LANE_SWITCH_MS: 110, // 换道动画时长

    // 水晶
    CRYSTAL_X: 30,
    CRYSTAL_Y: 105,
    CRYSTAL_WIDTH: 55,
    CRYSTAL_HEIGHT: 510,
    CRYSTAL_HP: 150,   // 2026-09-19 水晶血量上限 100→150

    // 能量
    ENERGY_START: 10,  // 2026-09-22 开局SP 5→10
    ENERGY_MAX: 12,
    ENERGY_REGEN_MS: 2500,

    // 卡牌
    HAND_LIMIT: 5,    // 2026-09-19 手牌上限 6→5（按动态栏设计稿）
    INITIAL_DRAW: 5,
    DECK_LIMIT: 19,   // 自选19张 + 1张角色卡 = 20
    DECK_MIN: 19,     // 必须满19张

    // 波次
    WAVE_BREAK_MS: 2000,
    BOSS_WARNING_MS: 2500,
};

// ========== 敌人类型（颜色区分效果） ==========
const ENEMY_TYPES = {
    gray: {
        color: '#9999aa', glowColor: 'rgba(153,153,170,0.4)',
        hp: 30, speed: 1.4, damage: 15, shootRate: 0,
        name: '普通', onKill: null, shape: 'square',
        art: 'melee', badge: 'none',      // 近战哥布林：无弹幕，跑动
    },
    green: {
        color: '#44dd66', glowColor: 'rgba(68,221,102,0.4)',
        hp: 45, speed: 1.1, damage: 10, shootRate: 2800,
        name: '能量', onKill: 'energy', energyGain: 2, shape: 'diamond',
        art: 'ranged', badge: 'energy',   // 漂浮章鱼炮手：击杀回费
    },
    blue: {
        color: '#44aaff', glowColor: 'rgba(68,170,255,0.4)',
        hp: 22, speed: 1.7, damage: 8, shootRate: 1700,
        name: '抽牌', onKill: 'drawCard', shape: 'triangle',
        art: 'ranged', badge: 'draw',     // 击杀抽牌
    },
    red: {
        color: '#ff5555', glowColor: 'rgba(255,85,85,0.4)',
        hp: 80, speed: 0.9, damage: 25, shootRate: 1430,   // 2026-09-22 射速下调30%（间隔1.0s→1.43s）
        name: '精英', onKill: null, shape: 'hexagon',
        art: 'ranged', badge: 'elite',    // 高危：有弹幕 → 远程章鱼（放大）
    },
};

// ========== 可选角色（2026-09-18 重构：删除旧5角色，新增克希娅/二小姐；阿撒托斯保留） ==========
const CHARACTERS = {
    kexiya: {
        name: '克希娅', color: '#7dd6ff', icon: '✦',
        desc: '刺客·匕首投掷。被动：近身环绕刃域，持续切割近距离敌人',
        passive: 'auraDamage',
        stats: { damage: 23, fireRate: 700, bulletSpeed: 9, bulletW: 34, bulletH: 12 },   // 2026-09-25 伤害×2.5
        pattern: 'single',        // 投掷匕首（贴图弹）
        card: 'kexiya_card',
        shape: 'kexiya',
        sprites: { idle: 'kexiya-idle', atk: 'kexiya-atk', move: 'kexiya-move' },
        bulletSprite: 'kexiya-bullet',
        moveSpeed: 1.0,           // 换道速度：适中
        switchDur: 800,           // 2026-09-19 换道动作0.8秒（移动姿态全程可见）
        bulletLabel: '投掷匕首 · 速度适中',
        fireGapLabel: '0.7秒/发',
        auraDmg: 150,             // 2026-09-22 近身刃域每次切割伤害 3→150（每0.4秒一切）
        passiveText: '近身刃域：持续伤害近距离敌人',
    },
    miss2: {
        name: '二小姐', color: '#ffe14d', icon: '☀',
        desc: '魔女·时间法术。被动：所有时间法术卡效果延长2秒',
        passive: 'timeExtend',
        stats: { damage: 20, fireRate: 1000, bulletSpeed: 15, bulletW: 150, bulletH: 10 },   // 2026-09-25 伤害×2.5
        pattern: 'beam',          // 间隔释放激光段（1秒一次，指尖发射，穿透）
        card: 'miss2_card',
        shape: 'miss2',
        sprites: { idle: 'miss2-idle', atk: 'miss2-atk' },
        moveSpeed: 1.6,           // 换道速度：快
        bulletLabel: '贯穿激光 · 1秒一次',
        fireGapLabel: '1秒/发',
        passiveText: '时间法术卡效果+2秒',
    },
    yangtaole: {
        name: '杨陶乐', color: '#5eead4', icon: '⚙',
        desc: '械师·守护协议。被动：查尔斯在场时，致命伤害由查尔斯承担',
        passive: 'charlesGuard',
        stats: { damage: 20, fireRate: 700, bulletSpeed: 10, bulletW: 10, bulletH: 10 },   // 2026-09-25 伤害×2.5
        pattern: 'single',        // 普通单发
        card: 'yangtaole_card',
        shape: 'yangtaole',
        sprites: { idle: 'ytl-idle', atk: 'ytl-atk' },
        moveSpeed: 1.0,           // 换道速度：适中
        bulletLabel: '普通单发 · 速度适中',
        fireGapLabel: '0.7秒/发',
        passiveText: '查尔斯在场时：致命伤害由查尔斯承担',
    },
    azathoth: {
        name: '阿撒托斯', color: '#e8e8e8', icon: '♛',
        desc: '通关嘉奖·混沌之主：本体绝对无敌，敌方弹幕被其吸收（水晶仍需守护）。可自由飞行',
        passive: 'invincible',
        freeMove: true,           // 无视三通道，场景内自由上下移动
        stats: { damage: 28, fireRate: 240, bulletSpeed: 11, bulletW: 14, bulletH: 14 },   // 2026-09-25 伤害×2.5
        pattern: 'chaos',         // 黑色混沌弹：黑体白描边、蛇形漂移、暗色烟尾
        card: 'azathoth_card',
        shape: 'azathoth',
    },
    felisis: {
        name: '芙丽西斯', color: '#ff6b9d', icon: '📖',
        desc: '书使·万象抄袭。被动：每次射击随机模仿其他四位角色的子弹；最右边手牌始终免费。专属卡可化身Boss',
        passive: 'randomBullet',
        rightmostFree: true,      // 最右边手牌始终花费为0（芙丽西斯被动）
        stats: { damage: 30, fireRate: 200, bulletSpeed: 10, bulletW: 10, bulletH: 10 },   // 2026-09-27 射速0.2s
        pattern: 'random',        // 随机模仿其他角色子弹
        card: 'felisis_card',
        shape: 'felisis',
        sprites: { idle: 'felisis-idle', atk: 'felisis-atk' },
        moveSpeed: 2.0,           // 换道速度：0.5秒（极快）
        switchDur: 500,
        bulletLabel: '万象·随机模仿其他角色子弹',
        fireGapLabel: '0.2秒/发',
        passiveText: '每次射击随机使用其他四位角色的子弹模式；最右边手牌始终免费',
        spriteNoFlip: true,       // 素材朝右，无需翻转
    },
};

// ========== 芙丽西斯随机子弹变体（模仿其他4角色）==========
const FELISIS_BULLETS = [
    { dmg: 23, speed: 9,  w: 34, h: 12,  sprite: 'kexiya-bullet', piercing: false, color: '#7dd6ff', chaos: false },
    { dmg: 20, speed: 15, w: 150, h: 10, sprite: null, piercing: true,  color: '#ffe14d', chaos: false },
    { dmg: 20, speed: 10, w: 10, h: 10,  sprite: null, piercing: false, color: '#5eead4', chaos: false },
    { dmg: 28, speed: 11, w: 14, h: 14,  sprite: null, piercing: false, color: '#e8e8e8', chaos: true },
];
const CHARLES_DEF = {
    hp: 180,                // 生命（2026-09-22 应要求 80→180）
    damage: 10,             // 蓝色光线伤害（2026-09-22 应要求翻倍 5→10）
    fireRate: 200,          // 射速：0.2秒/发（2026-09-22 调整 0.1→0.2 削弱）
    bulletSpeed: 13,
    x: CONFIG.PLAYER_X + 170,   // 驻守位：玩家前方
};

// ========== 魔法护盾（法术牌：0费吸收盾，持续5秒）==========
const MAGIC_SHIELD_HP = 50;

// ========== 角色专属卡（1+19 中的"1"，随角色强制携带） ==========
const CHARACTER_CARDS = {
    kexiya_card: { name: '遁形', cost: 4, type: 'character', duration: 5000, desc: '5秒内自身与水晶无法被攻击', color: '#7dd6ff' },
    miss2_card:  { name: '时间禁锢', cost: 5, type: 'character', duration: 5000, desc: '时间暂停5秒：全场敌人与敌弹静止', color: '#ffe14d' },
    azathoth_card: { name: '混沌终焉', cost: 10, type: 'character', desc: '湮灭场上所有敌人，BOSS也无法幸免', color: '#111111' },
    yangtaole_card: { name: '保护协议', cost: 7, type: 'character', desc: '在当前通道召唤机械随从查尔斯（180血·自动射击·阻挡小怪）；查尔斯在场时改为传送至当前通道并回满血量', color: '#5eead4' },
    felisis_card:   { name: '化身修罗', cost: 8, type: 'character', duration: 8000, desc: '随机化身一个Boss持续8秒：无敌+三通道阻挡+立刻发动Boss技能+弹幕与原Boss一致', color: '#ff6b9d' },
};

// ========== 48张通用卡牌 ==========
const CARD_DEFINITIONS = {
    // ===== 子弹强化（限时）12张 =====
    double_shot:    { name: '双发射击', cost: 2, type: 'bullet', duration: 10000, desc: '同时发射两发子弹',     color: '#ff7a7a' },
    triple_shot:    { name: '三发射击', cost: 3, type: 'bullet', duration: 10000, desc: '同时发射三发子弹',     color: '#ff7a7a' },
    rapid_fire:     { name: '急速射击', cost: 2, type: 'bullet', duration: 8000,  desc: '射速翻倍',             color: '#ff7a7a' },
    piercing:       { name: '穿透弹',   cost: 3, type: 'bullet', duration: 10000, desc: '子弹穿透敌人',         color: '#ff7a7a' },
    power_ammo:     { name: '强化弹药', cost: 0, type: 'bullet', duration: 10000, desc: '子弹伤害+50%',         color: '#ff7a7a' },
    big_bullet:     { name: '巨型子弹', cost: 2, type: 'bullet', duration: 10000, desc: '子弹变大 伤害翻倍',    color: '#ff7a7a' },
    explosive_shot: { name: '爆裂弹',   cost: 3, type: 'bullet', duration: 8000,  desc: '命中后爆炸 范围伤害',  color: '#ff7a7a' },
    vampire_bullet: { name: '吸血弹',   cost: 0, type: 'bullet', duration: 10000, desc: '命中回复1点生命',      color: '#ff7a7a' },
    laser_beam:     { name: '激光束',   cost: 4, type: 'bullet', duration: 6000,  desc: '发射高伤穿透激光',     color: '#ff7a7a' },
    ricochet:       { name: '弹射弹',   cost: 2, type: 'bullet', duration: 10000, desc: '子弹在敌人间弹射',     color: '#ff7a7a' },
    poison_bullet:  { name: '毒弹',     cost: 2, type: 'bullet', duration: 10000, desc: '命中附加持续毒伤',     color: '#ff7a7a' },
    freeze_bullet:  { name: '冰冻弹',   cost: 3, type: 'bullet', duration: 10000, desc: '命中减速敌人',         color: '#ff7a7a' },

    // ===== 弹幕模式（限时）8张（2026-09-24 全部-2费） =====
    spread_shot:    { name: '散射弹幕', cost: 1, type: 'danmaku', duration: 10000, desc: '增加左右斜向射击',    color: '#4ecdc4' },
    wide_spread:    { name: '广域散射', cost: 2, type: 'danmaku', duration: 10000, desc: '五方向散射射击',      color: '#4ecdc4' },
    circular_burst: { name: '环形弹幕', cost: 2, type: 'danmaku', duration: 8000,  desc: '周期性全方向射击',    color: '#4ecdc4' },
    side_shot:      { name: '侧翼射击', cost: 0, type: 'danmaku', duration: 10000, desc: '增加上下方向射击',    color: '#4ecdc4' },
    spiral_shot:    { name: '螺旋弹幕', cost: 1, type: 'danmaku', duration: 10000, desc: '旋转角度连续射击',    color: '#4ecdc4' },
    shotgun_blast:  { name: '散弹枪',   cost: 1, type: 'danmaku', duration: 8000,  desc: '近距离扇形爆发',      color: '#4ecdc4' },
    meteor_shot:    { name: '流星弹幕', cost: 2, type: 'danmaku', duration: 8000,  desc: '随机角度流星射击',    color: '#4ecdc4' },
    wave_cannon:    { name: '波动炮',   cost: 2, type: 'danmaku', duration: 8000,  desc: '巨型缓慢高伤弹丸',    color: '#4ecdc4' },

    // ===== 属性强化 6张 =====
    hp_boost:       { name: '生命强化', cost: 3, type: 'stat', desc: '最大生命+20 回复20',    color: '#95e1d3' },
    max_hp_up2:     { name: '体质强化', cost: 3, type: 'stat', desc: '最大生命+30',            color: '#95e1d3' },
    damage_up:      { name: '攻击强化', cost: 3, type: 'stat', desc: '伤害+5',                 color: '#95e1d3' },
    damage_up2:     { name: '狂暴之力', cost: 7, type: 'stat', desc: '伤害+10',                color: '#95e1d3' },
    speed_up:       { name: '移速强化', cost: 2, type: 'stat', desc: '换道速度大幅提升',       color: '#95e1d3' },
    defense_up:     { name: '防御强化', cost: 3, type: 'stat', desc: '受到伤害减少30%',        color: '#95e1d3' },

    // ===== 治疗卡牌 4张（2026-09-24 从属性强化拆分，绿十字标识） =====
    heal:           { name: '治疗术',   cost: 2, type: 'heal', desc: '回复30点生命，抽1张牌',  color: '#2ecc71' },
    full_heal:      { name: '完全治愈', cost: 5, type: 'heal', desc: '生命值回满，抽1张牌',    color: '#2ecc71' },
    regen:          { name: '生命再生', cost: 0, type: 'heal', duration: 15000, desc: '15秒内每秒回复2点生命，抽1张牌', color: '#2ecc71' },
    crystal_heal:   { name: '水晶修复', cost: 3, type: 'heal', desc: '水晶回复30点生命，抽1张牌', color: '#2ecc71' },

    // ===== 辅助卡牌 19张 =====
    draw2:          { name: '抽牌术',   cost: 1, type: 'utility', desc: '抽2张牌',              color: '#f9ca24' },
    draw3:          { name: '深抽术',   cost: 2, type: 'utility', desc: '抽3张牌',              color: '#f9ca24' },
    half_price:     { name: '费用减半', cost: 1, type: 'utility', desc: '下一张牌费用减半',      color: '#f9ca24' },
    free_play:      { name: '免费出牌', cost: 1, type: 'utility', desc: '下一张牌费用为0',       color: '#f9ca24' },
    energy_burst:   { name: '能量爆发', cost: 0, type: 'utility', desc: '获得3点能量',           color: '#f9ca24' },
    energy_max:     { name: '能量满载', cost: 5, type: 'utility', desc: '能量回满',             color: '#f9ca24' },
    shuffle:        { name: '洗牌',     cost: 1, type: 'utility', desc: '弃牌堆洗回牌库',        color: '#f9ca24' },
    discard_draw:   { name: '弃旧迎新', cost: 0, type: 'utility', desc: '弃掉所有手牌并重新抽',  color: '#f9ca24' },
    clear_bullets:  { name: '弹幕清除', cost: 2, type: 'spell', desc: '清除所有敌方子弹',       color: '#c9a0ff' },
    time_slow:      { name: '时间减缓', cost: 3, type: 'spell', duration: 5000, desc: '5秒内敌人减速', color: '#c9a0ff' },
    bomb:           { name: '轰炸',     cost: 4, type: 'spell', desc: '对全屏敌人造成40伤害',  color: '#c9a0ff' },
    shield:         { name: '无敌护盾', cost: 3, type: 'spell', duration: 5000, desc: '5秒无敌', color: '#c9a0ff' },
    rage:           { name: '狂怒',     cost: 3, type: 'spell', duration: 5000, desc: '5秒内伤害翻倍', color: '#c9a0ff' },
    crystal_shield: { name: '水晶护盾', cost: 2, type: 'spell', duration: 5000, desc: '水晶5秒不受伤害', color: '#c9a0ff' },
    double_energy:  { name: '能量翻倍', cost: 1, type: 'utility', duration: 10000, desc: '10秒内能量回复翻倍', color: '#f9ca24' },
    foresight:      { name: '预见',     cost: 1, type: 'utility', desc: '抽1张牌并查看牌库顶2张', color: '#f9ca24' },
    thin_deck:      { name: '精简牌组', cost: 0, type: 'utility', desc: '永久移除牌库顶部1张',   color: '#f9ca24' },
    enigma:         { name: '恩尼格玛', cost: 6, type: 'utility', desc: '将手牌补充至满(5张)', color: '#f9ca24' },
    blessing:       { name: '恩赐',     cost: 9, type: 'utility', desc: '使全部手牌花费为0（本回合）', color: '#f9ca24' },
    overload:       { name: '过载',     cost: 5, type: 'utility', duration: 5000, desc: '5秒内多重弹幕全开', color: '#f9ca24' },

    // ===== 法术牌 6张（2026-09-18 新增类别；09-21 狂怒/水晶护盾/时间减缓并入）=====
    time_stop:      { name: '时间暂停', cost: 5, type: 'spell', duration: 3000, desc: '3秒内敌人与敌弹全部静止', color: '#c9a0ff' },
    time_decel:     { name: '时间延缓', cost: 3, type: 'spell', duration: 5000, desc: '5秒内敌人与敌弹速度减半', color: '#c9a0ff' },
    charm_shot:     { name: '魅惑法术', cost: 4, type: 'spell', desc: '发射魅惑弹，命中的敌人成为友军', color: '#ff8ad8' },
    mana_burst:     { name: '法力突破', cost: 2, type: 'spell', desc: '永久获得2个SP（费用）槽', color: '#c9a0ff' },
    magic_shield:   { name: '魔法护盾', cost: 0, type: 'spell', duration: 5000, desc: '获得50点护盾，持续5秒', color: '#c9a0ff' },
};

// 合并角色卡进总定义（角色卡仅角色本尊可用）
Object.assign(CARD_DEFINITIONS, CHARACTER_CARDS);

const TYPE_NAMES = {
    bullet: '子弹强化',
    danmaku: '弹幕模式',
    stat: '属性强化',
    heal: '治疗卡牌',
    utility: '辅助卡牌',
    spell: '法术牌',
    character: '角色专属',
};

const TYPE_ICONS = {
    bullet: '🔫',
    danmaku: '🌀',
    stat: '⚔️',
    heal: '✚',
    utility: '✨',
    spell: '⏳',
    character: '👑',
};

// 按类型分组的卡牌ID列表（牌组构建器，不含角色卡）
const CARD_IDS_BY_TYPE = {
    bullet: ['double_shot','triple_shot','rapid_fire','piercing','power_ammo','big_bullet','explosive_shot','vampire_bullet','laser_beam','ricochet','poison_bullet','freeze_bullet'],
    danmaku: ['spread_shot','wide_spread','circular_burst','side_shot','spiral_shot','shotgun_blast','meteor_shot','wave_cannon'],
    stat: ['hp_boost','max_hp_up2','damage_up','damage_up2','speed_up','defense_up'],
    heal: ['heal','full_heal','regen','crystal_heal'],
    utility: ['draw2','draw3','half_price','free_play','energy_burst','energy_max','shuffle','discard_draw','double_energy','foresight','thin_deck','overload','enigma','blessing'],
    spell: ['time_stop','time_decel','charm_shot','mana_burst','rage','crystal_shield','time_slow','clear_bullets','bomb','shield','magic_shield'],
};

const ALL_CARD_IDS = Object.keys(CARD_DEFINITIONS).filter(id => !CHARACTER_CARDS[id]);

// ========== Boss定义（模型与弹幕覆盖全部三路） ==========
const BOSSES = {
    worm: {
        name: '千眼魔物', color: '#88ff66', hp: 500,
        shape: 'worm', patterns: ['lane_burst', 'aimed'],
        fireInterval: 2000, bulletDamage: 10,
    },
    twin: {
        name: '街头兽王', color: '#ffaa33', hp: 1400,
        shape: 'twin', art: 'orc', dash: 9000, dashDamage: 18,
        patterns: ['lane_burst', 'radial', 'aimed'],
        fireInterval: 1800, bulletDamage: 10,
    },
    destroyer: {
        name: '深红之瞳', color: '#ff5577', hp: 2000,
        shape: 'destroyer', art: 'boss3', aura: 1800,
        patterns: ['aimed', 'radial', 'lane_burst'],
        fireInterval: 1500, bulletDamage: 11,
    },
    abyss: {
        name: '机械巨兽', color: '#aa66ff', hp: 2600,
        shape: 'abyss', art: 'boss4', summon: 3000,
        patterns: ['spiral', 'radial', 'aimed', 'lane_burst'],
        fireInterval: 1300, bulletDamage: 11,
    },
    core: {
        name: 'NULL', color: '#ff4466', hp: 3400,
        shape: 'core', art: 'boss5',
        invuln: { every: 5000, dur: 2000 }, introDrain: true,
        patterns: ['full_sweep', 'spiral', 'radial', 'lane_burst', 'aimed'],
        fireInterval: 1200, bulletDamage: 12,
    },
    true_felisis: {
        name: '真-芙丽西斯', color: '#ff6b9d', hp: 5000,
        shape: 'true_felisis', art: 'true_felisis',
        smallBoss: true,                    // 小模型，占一条通道
        disableHandOnSpawn: 7000,           // 出场禁手牌7秒
        disableHandAtHp: 1000,              // 残血1000再禁手牌至死亡
        patterns: ['aimed'],
        fireInterval: 2000, bulletDamage: 12,
    },
};

// ========== 关卡（每关末尾一个Boss） ==========
const STAGES = [
    {
        name: '第1关 · 幽暗蝠窟', boss: 'worm', scene: 'cave',
        waves: 3, waveBase: 7, waveGrowth: 3,
        types: ['gray', 'blue', 'green'],   // 2026-09-25 第1关加入蓝色抽牌怪
        hpMult: 1.0, spdMult: 0.72, fireMult: 1.0,   // 第1关敌人最慢，循序渐进
    },
    {
        name: '第2关 · 街头巷战', boss: 'twin', scene: 'street',
        waves: 4, waveBase: 8, waveGrowth: 3,
        types: ['gray', 'green', 'blue'],
        hpMult: 1.25, spdMult: 1.0, fireMult: 0.95,
    },
    {
        name: '第3关 · 地狱盛宴', boss: 'destroyer', scene: 'hell', enemySet: '3',
        waves: 4, waveBase: 9, waveGrowth: 4,
        types: ['gray', 'green', 'blue', 'blue'],
        hpMult: 1.55, spdMult: 1.12, fireMult: 0.9,
    },
    {
        name: '第4关 · 机械巢穴', boss: 'abyss', scene: 'city', enemySet: '4',
        waves: 5, waveBase: 9, waveGrowth: 4,
        types: ['gray', 'green', 'blue', 'red'],
        hpMult: 1.9, spdMult: 1.25, fireMult: 0.85,
    },
    {
        name: '第5关 · 终焉', boss: 'core', enemySet: 'random',   // 默认深色背景+星空；小怪立绘随机混搭1/3/4套
        waves: 5, waveBase: 10, waveGrowth: 5,
        types: ['gray', 'green', 'blue', 'red', 'red'],
        hpMult: 2.3, spdMult: 1.4, fireMult: 0.8,
    },
];

// ========== 本地存储 ==========
const STORAGE_KEY = 'danmaku_card_game_v2';

function loadStore() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) {
            const data = JSON.parse(raw);
            if (Array.isArray(data.decks)) {
                // 旧卡组迁移：已删除的卡替换为同类卡（避免整组作废）
                const SUBS = { back_shot: 'spread_shot', cross_fire: 'side_shot' };
                data.decks.forEach(d => {
                    if (Array.isArray(d.cards)) d.cards = d.cards.map(id => SUBS[id] || id);
                });
                // 校验每个卡组
                data.decks = data.decks.filter(d =>
                    d && CHARACTERS[d.charId] &&
                    Array.isArray(d.cards) && d.cards.length === CONFIG.DECK_LIMIT &&
                    d.cards.every(id => CARD_IDS_BY_TYPE.bullet.concat(CARD_IDS_BY_TYPE.danmaku, CARD_IDS_BY_TYPE.stat, CARD_IDS_BY_TYPE.heal, CARD_IDS_BY_TYPE.spell, CARD_IDS_BY_TYPE.utility).includes(id))
                );
            } else data.decks = [];
            data.unlockedStage = Math.max(1, Math.min(STAGES.length, data.unlockedStage || 1));
            // 老存档若已通关第4关 => 视为已解锁阿撒托斯（2026-09-18 解锁条件从第5关下调至第4关）
            data.azathothUnlocked = !!data.azathothUnlocked || data.unlockedStage >= 4;
            data.felisisUnlocked = !!data.felisisUnlocked;
            return data;
        }
    } catch (e) { /* ignore */ }
    return { decks: [], unlockedStage: 1, azathothUnlocked: false, felisisUnlocked: false };
}

function saveStore(data) {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); } catch (e) { /* ignore */ }
}

// ========== 教学关卡脚本（2026-09-25）==========
// 用克希娅，洞穴背景；每步给定手牌/敌人/提示文案；教程引导玩家体验核心循环
const TUTORIAL_STEPS = [
    { id: 0, hint: '欢迎！▲▼切换通道躲避弹幕，自动射击。击杀蓝色远程怪！（小心它的弹幕）', enemyTypes: ['blue'] },
    { id: 1, hint: '蓝色敌人被击杀会抽1张牌！接下来击杀绿色敌人恢复SP！', enemyTypes: ['green'] },
    { id: 2, hint: 'SP恢复了！点按手牌中的完全治愈回复生命！', handCard: 'full_heal' },
    { id: 3, hint: '🎉 教程完成！你已学会战斗与卡牌的基础操作。请手动退出，自建卡组吧！' },
];
