// =============================================
//  DOM UI 模块 — 手牌 / 状态栏 / 效果栏
// =============================================

const ui = {};
let _effectsSig = null;

function cacheUI() {
    ui.score = document.getElementById('score-val');
    ui.stage = document.getElementById('stage-val');
    ui.wave = document.getElementById('wave-val');
    ui.kill = document.getElementById('kill-val');
    ui.energy = document.getElementById('energy-val');
    ui.deck = document.getElementById('deck-count');
    ui.discard = document.getElementById('discard-count');
    ui.php = document.getElementById('php-val');
    ui.chp = document.getElementById('chp-val');
    ui.effectsBar = document.getElementById('effects-bar');
    ui.cardRow = document.getElementById('card-row');
}

function updateUI() {
    if (!ui.score) cacheUI();
    ui.score.textContent = score;
    ui.stage.textContent = (gameMode === 'endless') ? '无尽' : (stageIndex + 1) + '/' + STAGES.length;
    ui.kill.textContent = killCount;
    if (phase === 'boss' || phase === 'bossWarn') ui.wave.textContent = 'BOSS';
    else if (gameMode === 'endless') ui.wave.textContent = '第' + currentWave + '波';
    else ui.wave.textContent = currentWave + '/' + stage.waves;
    ui.energy.textContent = energy + '/' + maxEnergy;
    ui.deck.textContent = deck.length;
    ui.discard.textContent = discardPile.length;
    ui.php.textContent = player.char.passive === 'invincible' ? '∞' : Math.max(0, Math.round(player.hp)) + '/' + player.maxHp;
    ui.chp.textContent = Math.max(0, Math.round(crystal.hp)) + '/' + crystal.maxHp;
    updateEffectsBar();
}

function updateEffectsBar() {
    if (!ui.effectsBar) cacheUI();
    const bar = ui.effectsBar;
    const now = performance.now();
    const sig = activeEffects.map(e => e.type).join(',') + '|' + nextCardHalfPrice + '|' + nextCardFree;

    if (sig !== _effectsSig) {
        _effectsSig = sig;
        bar.innerHTML = '';
        if (nextCardHalfPrice) {
            bar.appendChild(makeChip('💰 下张半价', '#f9ca24'));
        }
        if (nextCardFree) {
            bar.appendChild(makeChip('🆓 下张免费', '#f9ca24'));
        }
        for (const eff of activeEffects) {
            const chip = makeChip(eff.name, eff.color);
            const timer = document.createElement('span');
            timer.className = 'effect-timer';
            chip.appendChild(timer);
            bar.appendChild(chip);
        }
        // 手牌封锁 debuff（真-芙丽西斯Boss机制）
        if (handDisabledTimer > 0) {
            const chip = makeChip('🚫 手牌封锁 ' + (handDisabledTimer >= 999999 ? '∞' : (handDisabledTimer / 1000).toFixed(1) + 's'), '#ff4444');
            bar.appendChild(chip);
        }
    }

    const timerEls = bar.querySelectorAll('.effect-timer');
    for (let i = 0; i < activeEffects.length; i++) {
        const remain = Math.max(0, (activeEffects[i].endTime - now) / 1000);
        if (timerEls[i]) timerEls[i].textContent = remain.toFixed(1) + 's';
    }

    document.querySelectorAll('#card-row .card').forEach((el, i) => {
        if (i < hand.length) {
            const def = CARD_DEFINITIONS[hand[i]];
            let cost = def.cost;
            if (freeMark[i]) cost = 0;
            else if (nextCardFree) cost = 0;
            else if (nextCardHalfPrice) cost = Math.ceil(cost / 2);
            // 芙丽西斯被动：最右边手牌始终花费为0
            if (player.char.rightmostFree && i === hand.length - 1) cost = 0;
            el.classList.toggle('disabled', energy < cost);
        }
    });
}

function makeChip(text, color) {
    const chip = document.createElement('div');
    chip.className = 'effect-chip';
    chip.style.borderColor = color;
    const span = document.createElement('span');
    span.style.color = color;
    span.textContent = text;
    chip.appendChild(span);
    return chip;
}

function renderCards() {
    _effectsSig = null;
    if (!ui.cardRow) cacheUI();
    const row = ui.cardRow;
    row.innerHTML = '';

    for (let i = 0; i < CONFIG.HAND_LIMIT; i++) {
        const cardEl = document.createElement('div');
        cardEl.className = 'card';
        cardEl.dataset.idx = i;

        if (i < hand.length) {
            const cardId = hand[i];
            const def = CARD_DEFINITIONS[cardId];
            let cost = def.cost;
            let costHtml = String(cost);
            if (freeMark[i]) costHtml = '0';
            else if (nextCardFree) costHtml = '0';
            else if (nextCardHalfPrice) {
                cost = Math.ceil(cost / 2);
                costHtml = cost + '<s style="font-size:11px;opacity:.6">' + def.cost + '</s>';
            }
            if (def.type === 'character') cardEl.classList.add('char-card');
            // 芙丽西斯被动：最右边手牌始终花费为0
            if (player.char.rightmostFree && i === hand.length - 1) costHtml = '0';

            cardEl.innerHTML = `
                <div class="card-cost ${def.cost === 0 ? 'free' : ''}">${costHtml}</div>
                <div class="card-type-bar" style="background:${def.color}"></div>
                <div class="card-name">${def.name}</div>
                <div class="card-icon"${def.type === 'heal' ? ' style="color:#2ecc71"' : ''}>${TYPE_ICONS[def.type] || '👑'}</div>
                <div class="card-desc">${def.desc}</div>
                ${def.duration ? `<div class="card-duration">${(def.duration/1000).toFixed(0)}s</div>` : ''}
                <div class="card-key">${i + 1}</div>
            `;
        } else {
            cardEl.classList.add('empty-slot');
        }
        row.appendChild(cardEl);
    }
    updateEffectsBar();
}
