// =============================================
//  菜单系统 — 卡组管理 / 角色选择 / 关卡选择
// =============================================

let store = loadStore();
let editDeckId = null;        // 正在编辑的卡组id
let buildCharId = null;       // 构建器中已选角色
let buildCards = [];          // 构建器中已选19张卡
let selectedDeckIndex = 0;    // 关卡选择中的卡组索引
let selectedStageIndex = 0;   // 关卡选择中的关卡索引

const MENU_SCREENS = ['start-screen', 'deck-manager', 'char-select', 'deck-builder', 'stage-select', 'game-help', 'endless-select'];

function showMenuScreen(id) {
    for (const s of MENU_SCREENS) {
        document.getElementById(s).classList.toggle('hidden', s !== id);
    }
    document.getElementById('bottom-panel').classList.add('hidden');
    document.getElementById('top-bar').classList.add('hidden');
    document.getElementById('effects-bar').innerHTML = '';
    gameState = 'menu';
    bgmPlay('menu');   // 菜单场景切主界面BGM（同曲不断播）
    resizeStage();
}

function hideMenuScreens() {
    for (const s of MENU_SCREENS) document.getElementById(s).classList.add('hidden');
    document.getElementById('bottom-panel').classList.remove('hidden');
    document.getElementById('top-bar').classList.remove('hidden');
    resizeStage();
}

// ===== 主菜单 =====
let pendingMode = 'stage';   // 选角确认后的开局模式（'stage' | 'endless'）

function startAdventure() {
    pendingMode = 'stage';
    if (store.decks.length === 0) newDeck();
    else openStageSelect();
}

// 无尽模式：直接选择已组好的卡组开局（不走选角色/构筑流程）
function startEndless() {
    if (store.decks.length === 0) {
        // 没有卡组：先引导去构筑
        pendingMode = 'stage';
        newDeck();
        return;
    }
    openEndlessSelect();
}

function openEndlessSelect() {
    showMenuScreen('endless-select');
    renderEndlessList();
}

function renderEndlessList() {
    const list = document.getElementById('es-list');
    list.innerHTML = '';
    if (store.decks.length === 0) {
        list.innerHTML = '<div class="dm-empty">还没有卡组</div>';
        return;
    }
    store.decks.forEach((deck, i) => {
        const ch = CHARACTERS[deck.charId];
        const row = document.createElement('div');
        row.className = 'dm-deck-row';
        row.style.cursor = 'pointer';
        row.innerHTML = `
            <div class="dm-deck-icon" style="background:${ch.color}22;color:${ch.color}">${ch.icon}</div>
            <div class="dm-deck-info">
                <div class="dm-deck-name">${escapeHtml(deck.name)}</div>
                <div class="dm-deck-char">${ch.icon} ${ch.name} · 角色卡【${CHARACTER_CARDS[ch.card].name}】+ 19张</div>
            </div>
            <div class="dm-deck-actions">
                <button class="btn mini" onclick="event.stopPropagation();startEndlessWith(${i})">出战 ▶</button>
            </div>`;
        list.appendChild(row);
    });
}

function startEndlessWith(i) {
    const deck = store.decks[i];
    if (!deck) return;
    pendingMode = 'endless';
    hideMenuScreens();
    initGame(deck, 0, 'endless');
}

function newDeck() {
    editDeckId = null;
    buildCharId = null;
    buildCards = [];
    pendingMode = 'stage';   // 重置开局模式（修：无尽退出后新建卡组跳过构筑直进无尽的bug）
    const nameInput = document.getElementById('db-name-input');
    if (nameInput) nameInput.value = '';
    openCharSelect();
}

// ===== 卡组管理 =====
function openDeckManager() {
    showMenuScreen('deck-manager');
    renderDeckList();
}

function renderDeckList() {
    const list = document.getElementById('dm-list');
    list.innerHTML = '';
    document.getElementById('dm-deck-count').textContent = `共 ${store.decks.length} 套卡组 · 每套 20 张（1 角色卡 + 19 自选）`;

    if (store.decks.length === 0) {
        list.innerHTML = '<div class="dm-empty">还没有卡组<br>点击下方按钮创建你的第一套卡组</div>';
        return;
    }

    store.decks.forEach((deck, i) => {
        const char = CHARACTERS[deck.charId];
        const row = document.createElement('div');
        row.className = 'dm-deck-row';
        row.style.borderColor = char.color + '55';
        row.innerHTML = `
            <div class="dm-deck-icon" style="background:${char.color}22;color:${char.color}">${char.icon}</div>
            <div class="dm-deck-info">
                <div class="dm-deck-name">${escapeHtml(deck.name)}</div>
                <div class="dm-deck-char">${char.icon} ${char.name} · 角色卡【${CHARACTER_CARDS[char.card].name}】+ 19张</div>
            </div>
            <div class="dm-deck-actions">
                <button class="btn mini" onclick="useDeck(${i})">使用</button>
                <button class="btn mini secondary" onclick="editDeck(${i})">编辑</button>
                <button class="btn mini danger" onclick="deleteDeck(${i})">删除</button>
            </div>
        `;
        list.appendChild(row);
    });
}

function useDeck(i) {
    selectedDeckIndex = i;
    openStageSelect();
}

function editDeck(i) {
    const d = store.decks[i];
    if (!d) return;
    editDeckId = d.id;
    buildCharId = d.charId;
    buildCards = [...d.cards];
    const nameInput = document.getElementById('db-name-input');
    if (nameInput) nameInput.value = d.name;
    showMenuScreen('deck-builder');
    renderDeckBuilder();
}

function deleteDeck(i) {
    const d = store.decks[i];
    if (!d) return;
    showConfirm(`确定删除卡组【${d.name}】吗？`, function () {
        store.decks.splice(i, 1);
        if (selectedDeckIndex >= store.decks.length) selectedDeckIndex = 0;
        saveStore(store);
        renderDeckList();
    });
}

// ===== 自定义确认弹窗（替代原生confirm，修复手机WebView不弹窗的bug）=====
let _confirmCb = null;
function showConfirm(msg, cb) {
    _confirmCb = cb;
    document.getElementById('confirm-dialog-text').textContent = msg;
    document.getElementById('confirm-dialog').classList.remove('hidden');
}
function closeConfirm(result) {
    document.getElementById('confirm-dialog').classList.add('hidden');
    if (result && _confirmCb) _confirmCb();
    _confirmCb = null;
}

// ===== 角色选择（2026-09-18 重构为切换模式：左立绘 + 右信息面板）=====
let csIndex = 0;   // 当前预览的角色索引

function openCharSelect() {
    showMenuScreen('char-select');
    renderCharSelect();
}

function csMove(dir) {
    const ids = Object.keys(CHARACTERS);
    csIndex = (csIndex + dir + ids.length) % ids.length;
    renderCharSelect();
}

function csConfirm() {
    const id = Object.keys(CHARACTERS)[csIndex];
    if (id === 'azathoth' && !store.azathothUnlocked) return; // 锁定不可选
    if (id === 'felisis' && !store.felisisUnlocked) return;   // 芙丽西斯：击败隐藏Boss解锁
    buildCharId = id;
    if (pendingMode === 'endless') {
        // 无尽模式：选定角色后用当前出战卡组直接开局
        const deck = store.decks[selectedDeckIndex];
        if (!deck) { openDeckManager(); return; }
        hideMenuScreens();
        initGame(deck, 0, 'endless');
        return;
    }
    openDeckBuilder();
}

function renderCharSelect() {
    const ids = Object.keys(CHARACTERS);
    if (csIndex >= ids.length) csIndex = 0;
    const id = ids[csIndex];
    const ch = CHARACTERS[id];
    const locked = (id === 'azathoth' && !store.azathothUnlocked) ||
                   (id === 'felisis' && !store.felisisUnlocked);

    // 各角色选角立绘（阿撒托斯沿用 portrait.png）
    const portraitFile = { kexiya: 'kexiya-portrait.png', miss2: 'miss2-portrait.png', azathoth: 'portrait.png', yangtaole: 'ytl-portrait.png', felisis: 'felisis-portrait.png' }[id] || 'portrait.png';

    const bulletRow = ch.bulletLabel || '—';
    const passiveRow = ch.passiveText ||
        (ch.passive === 'invincible' ? '本体绝对无敌，弹幕不侵（水晶仍需守护）' : '—');
    const card = CHARACTER_CARDS[ch.card];

    const moveText = ch.freeMove ? '自由飞行（无视三通道）'
        : (ch.moveSpeed >= 1.4 ? '传送换道 · 快' : '换道 · 适中');

    const grid = document.getElementById('cs-grid');
    grid.innerHTML = `
        <div class="cs-switch">
            <button class="cs-arrow" onclick="csMove(-1)">◀</button>
            <div class="cs-portrait-box ${locked ? 'locked' : ''}">
                <img src="assets/${portraitFile}" alt="${ch.name}" onerror="this.style.display='none'">
                ${locked ? `<div class="cs-lock">🔒<br>${id === 'felisis' ? '击败无尽模式隐藏Boss解锁<br>(无尽第20波)' : '通过第4关解锁'}</div>` : ''}
            </div>
            <div class="cs-info">
                <div class="cs-info-name" style="color:${ch.color}">${ch.icon} ${ch.name}</div>
                <div class="cs-info-row"><span class="cs-k">子弹</span><span>${bulletRow}</span></div>
                <div class="cs-info-row"><span class="cs-k">移动</span><span>${moveText}</span></div>
                <div class="cs-info-row"><span class="cs-k">被动</span><span>${passiveRow}</span></div>
                <div class="cs-info-row"><span class="cs-k">专属卡</span><span><b style="color:${card.color}">${card.name}</b>（自动携带）—— ${card.desc}</span></div>
                <div class="cs-count">角色 ${csIndex + 1} / ${ids.length}</div>
            </div>
            <button class="cs-arrow" onclick="csMove(1)">▶</button>
        </div>
        <div class="cs-confirm-row">
            <button class="btn xl" onclick="csConfirm()" ${locked ? 'disabled' : ''}>${locked ? '🔒 未解锁' : '选定 · 进入构筑 ▶'}</button>
        </div>`;
}

// ===== 牌组构建器（19张 + 1角色卡 = 20）=====
function openDeckBuilder() {
    if (!buildCharId || !CHARACTERS[buildCharId]) buildCharId = 'kexiya';
    showMenuScreen('deck-builder');
    renderDeckBuilder();
}

function changeChar() {
    openCharSelect();
}

function renderDeckBuilder() {
    const char = CHARACTERS[buildCharId];
    const chCard = CHARACTER_CARDS[char.card];

    // 头部角色信息
    const header = document.getElementById('db-char-info');
    header.innerHTML = `
        <div class="db-char-avatar" style="background:${char.color}22;color:${char.color}">${char.icon}</div>
        <div>
            <div class="db-char-name">${char.name} <span class="db-change-btn" onclick="changeChar()">更换角色</span></div>
            <div class="db-char-stats">${char.desc}</div>
        </div>
        <div class="db-char-card" style="border-color:${chCard.color}">
            <div style="font-size:11px;color:#666">👑 角色卡已自动携带 (1/20)</div>
            <div style="color:#111;font-weight:900">${chCard.name}</div>
        </div>
    `;

    // 卡池
    const pool = document.getElementById('db-card-pool');
    pool.innerHTML = '';

    for (const type of ['bullet', 'danmaku', 'stat', 'heal', 'spell', 'utility']) {
        const headerEl = document.createElement('div');
        headerEl.className = 'db-type-header';
        headerEl.innerHTML = `${type === 'heal' ? '<span style="color:#2ecc71">' + TYPE_ICONS[type] + '</span>' : TYPE_ICONS[type]} ${TYPE_NAMES[type]} (${CARD_IDS_BY_TYPE[type].length}张)`;
        pool.appendChild(headerEl);

        const grid = document.createElement('div');
        grid.className = 'db-card-grid';

        for (const cardId of CARD_IDS_BY_TYPE[type]) {
            const def = CARD_DEFINITIONS[cardId];
            const count = buildCards.filter(id => id === cardId).length;
            const cardEl = document.createElement('div');
            cardEl.className = 'db-card' + (count > 0 ? ' in-deck' : '');
            cardEl.innerHTML = `
                <div class="card-cost ${def.cost === 0 ? 'free' : ''}">${def.cost}</div>
                ${count > 0 ? `<div class="db-card-count">${count}</div>` : ''}
                <div class="card-type-bar" style="background:${def.color}"></div>
                <div class="card-name">${def.name}</div>
                <div class="card-icon"${type === 'heal' ? ' style="color:#2ecc71"' : ''}>${TYPE_ICONS[type]}</div>
                <div class="card-desc">${def.desc}</div>
                ${def.duration ? `<div class="card-duration">${(def.duration/1000).toFixed(0)}s</div>` : ''}
            `;
            cardEl.oncontextmenu = (e) => { e.preventDefault(); removeFromBuild(cardId); };
            cardEl.onclick = () => addToBuild(cardId);
            grid.appendChild(cardEl);
        }
        pool.appendChild(grid);
    }

    updateBuildSidebar();
}

function addToBuild(cardId) {
    if (buildCards.length >= CONFIG.DECK_LIMIT) return;
    buildCards.push(cardId);
    renderDeckBuilder();
}

function removeFromBuild(cardId) {
    const idx = buildCards.lastIndexOf(cardId);
    if (idx === -1) return;
    buildCards.splice(idx, 1);
    renderDeckBuilder();
}

function randomBuild() {
    buildCards = [];
    const pool = [...ALL_CARD_IDS];
    for (let i = 0; i < CONFIG.DECK_LIMIT; i++) {
        buildCards.push(pool[Math.floor(Math.random() * pool.length)]);
    }
    renderDeckBuilder();
}

function clearBuild() {
    buildCards = [];
    renderDeckBuilder();
}

function updateBuildSidebar() {
    document.getElementById('db-count').textContent = buildCards.length;
    const startBtn = document.getElementById('db-save-btn');
    if (startBtn) startBtn.disabled = buildCards.length !== CONFIG.DECK_LIMIT;

    // 类型统计
    const counts = {};
    for (const id of buildCards) {
        const t = CARD_DEFINITIONS[id].type;
        counts[t] = (counts[t] || 0) + 1;
    }
    const summary = document.getElementById('db-summary');
    summary.innerHTML = Object.entries(counts).map(([t, c]) =>
        `<div>${TYPE_ICONS[t]} ${TYPE_NAMES[t]}: <b>${c}</b></div>`
    ).join('') || '<div style="color:#555">尚未选卡</div>';

    // 19槽位列表
    const list = document.getElementById('db-deck-list');
    let html = '';
    for (let i = 0; i < CONFIG.DECK_LIMIT; i++) {
        if (i < buildCards.length) {
            const def = CARD_DEFINITIONS[buildCards[i]];
            html += `<div class="db-deck-entry" onclick="removeBuildAt(${i})">
                <span>${def.name}</span>
                <span class="cnt">费用${def.cost}</span>
            </div>`;
        } else {
            html += `<div class="db-deck-entry empty">— 空 ${i+1} —</div>`;
        }
    }
    list.innerHTML = html;
}

function removeBuildAt(i) {
    if (i < 0 || i >= buildCards.length) return;
    buildCards.splice(i, 1);
    renderDeckBuilder();
}

function saveDeckBuild() {
    if (buildCards.length !== CONFIG.DECK_LIMIT) return;
    const nameInput = document.getElementById('db-name-input');
    const name = (nameInput.value || '').trim() ||
        (editDeckId ? '未命名卡组' : `卡组 ${store.decks.length + 1}`);
    if (editDeckId) {
        const d = store.decks.find(x => x.id === editDeckId);
        if (d) { d.name = name; d.charId = buildCharId; d.cards = [...buildCards]; }
    } else {
        store.decks.push({ id: Date.now(), name, charId: buildCharId, cards: [...buildCards] });
    }
    saveStore(store);
    editDeckId = null;
    openDeckManager();
}

// ===== 关卡选择 =====
function openStageSelect(deckIndex) {
    if (store.decks.length === 0) { newDeck(); return; }
    if (deckIndex !== undefined) selectedDeckIndex = deckIndex;
    selectedDeckIndex = Math.min(selectedDeckIndex, store.decks.length - 1);
    selectedStageIndex = Math.min(selectedStageIndex, store.unlockedStage - 1);
    showMenuScreen('stage-select');
    renderStageSelect();
}

function cycleDeck(dir) {
    if (store.decks.length === 0) return;
    selectedDeckIndex = (selectedDeckIndex + dir + store.decks.length) % store.decks.length;
    renderStageSelect();
}

function pickStage(i) {
    if (i >= store.unlockedStage) return;
    selectedStageIndex = i;
    renderStageSelect();
}

function renderStageSelect() {
    // 卡组信息
    const deck = store.decks[selectedDeckIndex];
    const char = CHARACTERS[deck.charId];
    const deckEl = document.getElementById('ss-deck');
    deckEl.innerHTML = `
        <button class="btn mini secondary" onclick="cycleDeck(-1)">◀</button>
        <div class="ss-deck-info">
            <div class="ss-deck-name">${escapeHtml(deck.name)}</div>
            <div class="ss-deck-char">${char.icon} ${char.name} · 【${CHARACTER_CARDS[char.card].name}】</div>
        </div>
        <button class="btn mini secondary" onclick="cycleDeck(1)">▶</button>
    `;

    // 关卡网格
    const grid = document.getElementById('ss-stages');
    grid.innerHTML = '';
    STAGES.forEach((st, i) => {
        const boss = BOSSES[st.boss];
        const locked = i >= store.unlockedStage;
        const el = document.createElement('div');
        el.className = 'ss-stage' + (locked ? ' locked' : '') + (i === selectedStageIndex ? ' selected' : '');
        el.style.borderColor = locked ? '#333' : boss.color;
        el.innerHTML = locked ? `
            <div class="ss-stage-lock">🔒</div>
            <div class="ss-stage-name" style="color:#555">??? </div>
            <div class="ss-stage-sub" style="color:#444">通过上一关解锁</div>
        ` : `
            <div class="ss-stage-name">${st.name}</div>
            <div class="ss-stage-boss">BOSS: ${boss.name}</div>
            <div class="ss-stage-sub">${st.waves} 波敌人 · 体力 ${Math.round(st.hpMult*100)}%</div>
            <div class="ss-stage-num">第 ${i+1} / ${STAGES.length} 关</div>
        `;
        el.onclick = () => pickStage(i);
        grid.appendChild(el);
    });
}

function startBattle() {
    const deck = store.decks[selectedDeckIndex];
    if (!deck) return;
    hideMenuScreens();
    initGame(deck, selectedStageIndex);
    bgmPlay('stage' + (selectedStageIndex + 1));   // 关卡BGM
}

// ===== 工具 =====
function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
