// =============================================
//  渲染模块
// =============================================

function render() {
    ctx.save();
    if (shakeTime > 0) {
        const ratio = shakeTime / 400;
        ctx.translate((Math.random()-0.5)*shakeIntensity*ratio, (Math.random()-0.5)*shakeIntensity*ratio);
    }

    drawBackground();
    drawLanes();
    drawStars();
    drawTelegraphs();
    drawCrystal();
    drawEnemies();
    if (boss) drawBoss();
    if (charles) drawCharles();
    drawPlayerBullets();
    drawPlayer();
    drawEnemyBullets();
    drawParticles();
    drawFloatTexts();
    drawPhaseBanner();

    if (screenFlash > 0) { // 混沌终焉：全屏白闪
        ctx.fillStyle = `rgba(255,255,255,${Math.min(1, screenFlash)})`;
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
    }

    ctx.restore();
    if (boss) drawBossHPBar();
    if (gameMode === 'tutorial') drawTutorialHints();
}

// ===== 教学关卡：HUD 元素箭头标注（2026-09-25） =====
function drawTutorialHints() {
    if (gameState !== 'playing') return;
    // 最后一步：教程完成提示一直显示（不消失）
    if (tutorialStep >= TUTORIAL_STEPS.length - 1) {
        const lastStep = TUTORIAL_STEPS[TUTORIAL_STEPS.length - 1];
        ctx.font = '900 22px "Arial Black", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'center';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.strokeText(lastStep.hint, 640, 140);
        ctx.fillStyle = '#ffe14d';
        ctx.fillText(lastStep.hint, 640, 140);
        ctx.font = '900 16px "Arial Black", "Microsoft YaHei", sans-serif';
        ctx.strokeText('请手动退出，自建卡组吧！', 640, 172);
        ctx.fillStyle = '#fff';
        ctx.fillText('请手动退出，自建卡组吧！', 640, 172);
        ctx.textAlign = 'left';
        return;
    }
    // 只在教程前几秒显示 HUD 标注（步骤0时显示）
    if (tutorialStep !== 0) return;
    const alpha = Math.min(1, (performance.now() % 4000) / 1000) * 0.9;
    const box = (x, y, w, label, color) => {
        ctx.globalAlpha = alpha;
        ctx.fillStyle = 'rgba(13,13,15,0.8)';
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.fillRect(x - 4, y - 4, w + 8, 34);
        ctx.strokeRect(x - 4, y - 4, w + 8, 34);
        ctx.fillStyle = color;
        ctx.font = '900 16px "Arial Black", "Microsoft YaHei", sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(label, x, y + 20);
        // 向下箭头
        ctx.beginPath();
        ctx.moveTo(x + w / 2 - 12, y + 38);
        ctx.lineTo(x + w / 2 + 12, y + 38);
        ctx.lineTo(x + w / 2, y + 54);
        ctx.closePath(); ctx.fill();
        ctx.globalAlpha = 1;
    };
    // HP / SP / CHP 三条提示
    box(30, 20, 200, 'HP：你的生命，归零死亡', '#e8632a');
    box(280, 20, 220, 'SP：能量，出卡要消耗', '#1a5fb4');
    box(560, 20, 260, 'CHP：水晶生命，归零失败', '#e8b60a');
}

// 当前关卡的卡通场景条（cave=第1关 / street=第2关 / hell=第3关 / city=第4关）
function sceneImage() {
    if (!stage || !stage.scene) return null;
    if (stage.scene === 'cave') return Assets.img.scene || null;
    if (stage.scene === 'street') return Assets.img.scene2 || null;
    if (stage.scene === 'hell') return Assets.img.scene3 || null;
    if (stage.scene === 'city') return Assets.img.scene4 || null;
    return null;
}

const SCENE_BG = { cave: '#060606', street: '#1c2430', hell: '#1a0806', city: '#10141f' };

function sceneStripActive() {
    return !!sceneImage();
}

function drawBackground() {
    const scene = sceneImage();
    if (scene) {
        // 一张场景图 = 一条通道，上中下复制三份拼成战场
        ctx.fillStyle = SCENE_BG[stage.scene] || '#060606';
        ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
        const H = 210; // 与三路间距一致
        for (let i = 0; i < 3; i++) {
            ctx.drawImage(scene, 0, CONFIG.LANE_YS[i] - H / 2, CONFIG.CANVAS_WIDTH, H);
        }
        // 漫画分格线
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        for (let i = 1; i < 3; i++) {
            const y = CONFIG.LANE_YS[i] - H / 2;
            ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CONFIG.CANVAS_WIDTH, y); ctx.stroke();
        }
        return;
    }
    const grad = ctx.createLinearGradient(0, 0, 0, CONFIG.CANVAS_HEIGHT);
    grad.addColorStop(0, '#0d0d1f'); grad.addColorStop(0.5, '#111130'); grad.addColorStop(1, '#0a0a18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
}

function drawLanes() {
    const H = 110;
    const sceneOn = sceneStripActive();
    if (!sceneOn) {
        for (let i = 0; i < 3; i++) {
            const y = CONFIG.LANE_YS[i] - H / 2;
            ctx.fillStyle = i === 1 ? 'rgba(40, 60, 110, 0.10)' : 'rgba(40, 60, 100, 0.07)';
            ctx.fillRect(0, y, CONFIG.CANVAS_WIDTH, H);
            ctx.strokeStyle = 'rgba(90, 110, 170, 0.22)';
            ctx.lineWidth = 1; ctx.setLineDash([12, 10]);
            ctx.beginPath();
            ctx.moveTo(0, y); ctx.lineTo(CONFIG.CANVAS_WIDTH, y);
            ctx.moveTo(0, y + H); ctx.lineTo(CONFIG.CANVAS_WIDTH, y + H);
            ctx.stroke(); ctx.setLineDash([]);
        }
    }
    // 玩家当前所在道路高亮（自由飞行角色取垂直位置最近的道路）
    if (player && gameState === 'playing') {
        const cy = player.y + player.height / 2;
        const li = player.freeMove ? (cy < 255 ? 0 : cy > 465 ? 2 : 1) : player.laneIndex;
        const y = CONFIG.LANE_YS[li] - H / 2;
        ctx.fillStyle = sceneOn ? 'rgba(255,255,255,0.12)' : 'rgba(100, 160, 255, 0.05)';
        ctx.fillRect(0, y, CONFIG.CANVAS_WIDTH, H);
        ctx.strokeStyle = sceneOn ? 'rgba(255,255,255,0.9)' : 'rgba(106, 160, 255, 0.35)';
        ctx.lineWidth = sceneOn ? 3 : 2;
        ctx.strokeRect(3, y + 3, 118, H - 6);
    }
}

function drawStars() {
    if (sceneStripActive()) return; // 洞穴场景不画星空
    for (const s of stars) {
        ctx.fillStyle = `rgba(180, 200, 255, ${0.3 + Math.sin(s.phase) * 0.3})`;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
}

function drawTelegraphs() {
    const H = 110;
    for (const t of telegraphs) {
        const blink = 0.10 + 0.10 * Math.sin(performance.now() * 0.02);
        for (const li of t.lanes) {
            const y = CONFIG.LANE_YS[li] - H / 2;
            const isSafe = t.safeLane === li;
            ctx.fillStyle = isSafe ? `rgba(80,255,140,${blink})` : `rgba(255,68,68,${blink + 0.06})`;
            ctx.fillRect(0, y, CONFIG.CANVAS_WIDTH, H);
            ctx.strokeStyle = isSafe ? 'rgba(80,255,140,0.5)' : 'rgba(255,68,68,0.55)';
            ctx.lineWidth = 2; ctx.setLineDash([8, 6]);
            ctx.strokeRect(0, y, CONFIG.CANVAS_WIDTH, H);
            ctx.setLineDash([]);
            if (isSafe) {
                ctx.font = '900 26px "Arial Black", "Microsoft YaHei", sans-serif';
                ctx.textAlign = 'center';
                ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
                ctx.strokeText('◀ 安全通道', 900, y + H / 2 + 9);
                ctx.fillStyle = 'rgba(120,255,170,0.95)';
                ctx.fillText('◀ 安全通道', 900, y + H / 2 + 9);
                ctx.textAlign = 'left';
            }
        }
    }
}

function drawCrystal() {
    const c = crystal, cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    const pulse = Math.sin(c.pulseTime * 0.003) * 4;

    if (hasEffect('crystal_shield')) {
        ctx.strokeStyle = 'rgba(100,200,255,0.5)'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(cx, cy, c.width + 18 + Math.sin(c.pulseTime*0.005)*3, 0, Math.PI*2); ctx.stroke();
    }

    // 柔白光晕（黑白画风）
    const glowGrad = ctx.createRadialGradient(cx, cy, 10, cx, cy, 90 + pulse);
    glowGrad.addColorStop(0, 'rgba(255,255,255,0.4)'); glowGrad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glowGrad;
    ctx.fillRect(c.x - 50, c.y - 30, c.width + 100, c.height + 60);

    ctx.save(); ctx.translate(cx, cy);
    const flash = c.hitFlash > 0;
    // 白水晶 + 粗黑描边（墨线风，受击闪灰）
    ctx.fillStyle = flash ? '#9aa0a8' : '#f8f8f4';
    ctx.strokeStyle = '#111'; ctx.lineWidth = 3.5;
    const halfW = c.width / 2 + pulse, halfH = c.height / 2;
    ctx.beginPath();
    ctx.moveTo(0, -halfH); ctx.lineTo(halfW, -halfH*0.5); ctx.lineTo(halfW*0.7, 0);
    ctx.lineTo(halfW, halfH*0.5); ctx.lineTo(0, halfH); ctx.lineTo(-halfW, halfH*0.5);
    ctx.lineTo(-halfW*0.7, 0); ctx.lineTo(-halfW, -halfH*0.5); ctx.closePath();
    ctx.fill(); ctx.stroke();

    ctx.fillStyle = `rgba(255,255,255,${0.3 + Math.sin(c.pulseTime*0.005)*0.15})`;
    ctx.beginPath();
    ctx.moveTo(0, -halfH*0.8); ctx.lineTo(halfW*0.4, -halfH*0.2);
    ctx.lineTo(0, halfH*0.5); ctx.lineTo(-halfW*0.4, -halfH*0.2); ctx.closePath();
    ctx.fill(); ctx.restore();

    drawBar(c.x - 5, c.y - 10, c.width + 10, 5, c.hp / c.maxHp, '#44aaff');
}

// ========== Boss 绘制（覆盖三路） ==========
function drawBoss() {
    const b = boss;
    const dying = b.state === 'dying';
    ctx.save();
    if (dying) {
        ctx.globalAlpha = Math.max(0.1, b.deathTimer / 1600);
        ctx.rotate(Math.sin(b.deathTimer * 0.02) * 0.04);
    }

    // 墨色阴影光晕（黑白画风）
    const glow = ctx.createRadialGradient(b.x, b.y, 40, b.x, b.y, 260);
    glow.addColorStop(0, 'rgba(0,0,0,0.22)');
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(b.x - 280, b.y - 280, 560, 560);

    const flash = b.hitFlash > 0;
    const bodyColor = flash ? '#ffffff' : b.def.color;
    ctx.lineWidth = 3;

    switch (b.def.shape) {
        case 'worm': { // 腐蚀巨蠕（第1关：多眼肉块精灵，加载失败回退为节肢链）
            const spr = Assets.img.boss1;
            if (spr) {
                if (sceneStripActive()) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(b.x, b.y + 255, 220, 16, 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(Math.sin(b.oscT * 0.0012) * 0.05);
                if (flash) ctx.filter = 'brightness(2.2)';
                const d = 540; // 占满三条通道
                ctx.drawImage(spr, -d / 2, -d / 2, d, d);
                ctx.restore();
                break;
            }
            for (let i = 0; i < 7; i++) {
                const segY = 110 + i * 68;
                const wob = Math.sin(b.oscT * 0.003 + i * 0.8) * 22;
                const rr = 42 - i * 3;
                ctx.fillStyle = i % 2 === 0 ? bodyColor : (flash ? '#fff' : b.def.color + 'cc');
                ctx.strokeStyle = 'rgba(255,255,255,0.35)';
                ctx.beginPath(); ctx.arc(b.x + wob, segY, rr, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                // 眼睛
                if (i === 0) {
                    ctx.fillStyle = '#221';
                    ctx.beginPath(); ctx.arc(b.x + wob - rr * 0.4, segY, 8, 0, Math.PI * 2); ctx.fill();
                }
            }
            break;
        }
        case 'twin': { // 街头兽王（第2关：兽人精灵+冲刺攻击；图片缺失回退双炮塔）
            const spr = Assets.img.boss2;
            if (spr) {
                if (sceneStripActive()) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(b.x, b.y + 165, 110, 13, 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x, b.y);
                if (b.dashState === 'go') {
                    // 冲刺残影 + 速度线
                    ctx.globalAlpha = 0.35;
                    ctx.drawImage(spr, 40, -160, 180, 240);
                    ctx.globalAlpha = 1;
                    ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 3;
                    for (let i = 0; i < 4; i++) {
                        ctx.beginPath();
                        ctx.moveTo(100, -130 + i * 62);
                        ctx.lineTo(230, -130 + i * 62);
                        ctx.stroke();
                    }
                }
                if (b.dashState === 'warn') {
                    ctx.translate((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 8); // 预警抖动
                }
                if (flash) ctx.filter = 'brightness(2.2)';
                ctx.drawImage(spr, -120, -160, 240, 320);
                ctx.restore();
                break;
            }
            for (const oy of [-160, 160]) {
                const py = b.y + oy + Math.sin(b.oscT * 0.002 + oy * 0.01) * 14;
                ctx.save(); ctx.translate(b.x, py);
                ctx.rotate(b.rot * 0.5);
                ctx.fillStyle = flash ? '#fff' : '#c77b2e';
                ctx.strokeStyle = bodyColor;
                ctx.beginPath();
                for (let i = 0; i < 8; i++) {
                    const a = (i / 8) * Math.PI * 2;
                    const rr = i % 2 === 0 ? 78 : 58;
                    const px = Math.cos(a) * rr, py2 = Math.sin(a) * rr;
                    i === 0 ? ctx.moveTo(px, py2) : ctx.lineTo(px, py2);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.fillStyle = bodyColor;
                ctx.beginPath(); ctx.arc(0, 0, 30, 0, Math.PI * 2); ctx.fill();
                ctx.restore();
            }
            // 连接桥
            ctx.strokeStyle = bodyColor; ctx.lineWidth = 10;
            ctx.beginPath(); ctx.moveTo(b.x, b.y - 150); ctx.lineTo(b.x, b.y + 150); ctx.stroke();
            break;
        }
        case 'destroyer': { // 深红之瞳（第3关：红瞳触手怪精灵+持续光环；回退装甲舰）
            const spr = Assets.img.boss3;
            if (spr) {
                // 红色伤害光环（与特性呼应的可读性提示）
                const rg = ctx.createRadialGradient(b.x, b.y, 60, b.x, b.y, 340);
                rg.addColorStop(0, 'rgba(255,40,40,0.22)'); rg.addColorStop(1, 'rgba(255,40,40,0)');
                ctx.fillStyle = rg;
                ctx.fillRect(b.x - 340, b.y - 340, 680, 680);
                if (sceneStripActive()) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(b.x, b.y + 230, 210, 15, 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(Math.sin(b.oscT * 0.0012) * 0.05);
                if (flash) ctx.filter = 'brightness(2.2)';
                ctx.drawImage(spr, -320, -240, 640, 480); // 横版4:3
                ctx.restore();
                break;
            }
            ctx.save(); ctx.translate(b.x, b.y);
            ctx.fillStyle = flash ? '#fff' : '#3a4050';
            ctx.strokeStyle = bodyColor; ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.moveTo(-90, -240); ctx.lineTo(80, -200); ctx.lineTo(60, 0);
            ctx.lineTo(80, 200); ctx.lineTo(-90, 240); ctx.lineTo(-60, 0);
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // 装甲板
            ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 2;
            for (let i = -2; i <= 2; i++) {
                ctx.beginPath(); ctx.moveTo(-70, i * 80); ctx.lineTo(50, i * 80); ctx.stroke();
            }
            // 核心炮口
            ctx.fillStyle = bodyColor;
            ctx.beginPath(); ctx.arc(-30, 0, 34 + Math.sin(b.oscT * 0.004) * 6, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
        }
        case 'abyss': { // 机械巨兽（第4关：Q版机甲精灵+召唤；回退巨眼）
            const spr = Assets.img.boss4;
            if (spr) {
                if (sceneStripActive()) {
                    ctx.fillStyle = 'rgba(0,0,0,0.3)';
                    ctx.beginPath(); ctx.ellipse(b.x, b.y + 155, 100, 12, 0, 0, Math.PI * 2); ctx.fill();
                }
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(Math.sin(b.oscT * 0.0012) * 0.05);
                if (flash) ctx.filter = 'brightness(2.2)';
                ctx.drawImage(spr, -150, -150, 300, 300);
                ctx.restore();
                break;
            }
            ctx.save(); ctx.translate(b.x, b.y);
            ctx.fillStyle = flash ? '#fff' : '#1a1030';
            ctx.strokeStyle = bodyColor; ctx.lineWidth = 4;
            ctx.beginPath();
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 + b.rot;
                const rr = i % 2 === 0 ? 230 : 170;
                const px = Math.cos(a) * rr * 0.55, py = Math.sin(a) * rr;
                i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
            }
            ctx.closePath(); ctx.fill(); ctx.stroke();
            // 眼白+瞳孔
            ctx.fillStyle = '#e8e0ff';
            ctx.beginPath(); ctx.ellipse(0, 0, 80, 200, 0, 0, Math.PI * 2); ctx.fill();
            const lookY = Math.max(-120, Math.min(120, (player ? player.y : 360) - b.y));
            ctx.fillStyle = bodyColor;
            ctx.beginPath(); ctx.ellipse(0, lookY, 38, 90, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#000';
            ctx.beginPath(); ctx.ellipse(0, lookY, 16, 44, 0, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
        }
        case 'core': { // NULL（第5关：方格头异常体精灵+周期无敌白罩；回退多层旋转核心）
            const spr = Assets.img.boss5;
            if (spr) {
                ctx.save();
                ctx.translate(b.x, b.y);
                ctx.rotate(Math.sin(b.oscT * 0.0009) * 0.04);
                if (b.invuln) {
                    // 周期无敌：白色护罩闪烁
                    const tw = 0.5 + Math.sin(performance.now() * 0.02) * 0.3;
                    ctx.strokeStyle = `rgba(255,255,255,${tw})`; ctx.lineWidth = 6;
                    ctx.beginPath(); ctx.arc(0, 0, 170 + Math.sin(performance.now() * 0.01) * 8, 0, Math.PI * 2); ctx.stroke();
                    ctx.fillStyle = `rgba(255,255,255,${tw * 0.12})`;
                    ctx.beginPath(); ctx.arc(0, 0, 170, 0, Math.PI * 2); ctx.fill();
                }
                if (flash) ctx.filter = 'brightness(2.2)';
                ctx.drawImage(spr, -160, -160, 320, 320);
                ctx.restore();
                break;
            }
            ctx.save(); ctx.translate(b.x, b.y);
            for (let layer = 0; layer < 3; layer++) {
                const sides = 3 + layer * 2;
                const rr = 100 + layer * 65;
                const rot = b.rot * (layer % 2 === 0 ? 1 : -1.4);
                ctx.save(); ctx.rotate(rot);
                ctx.strokeStyle = bodyColor;
                ctx.globalAlpha = ctx.globalAlpha * (1 - layer * 0.22);
                ctx.lineWidth = 5 - layer;
                ctx.fillStyle = flash ? 'rgba(255,255,255,0.5)' : (layer === 0 ? '#220a14' : 'rgba(255,68,102,0.06)');
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const a = (i / sides) * Math.PI * 2;
                    const px = Math.cos(a) * rr * 0.6, py = Math.sin(a) * rr;
                    i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
                }
                ctx.closePath(); ctx.fill(); ctx.stroke();
                ctx.restore();
            }
            ctx.globalAlpha = dying ? ctx.globalAlpha : 1;
            ctx.fillStyle = bodyColor;
            ctx.beginPath(); ctx.arc(0, 0, 36 + Math.sin(b.oscT * 0.005) * 8, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
            break;
        }
        case 'true_felisis': { // 真-芙丽西斯（隐藏Boss：小模型单通道）
            const spr = Assets.img['boss-true-felisis'];
            if (spr) {
                ctx.save();
                ctx.translate(b.x, b.y);
                if (flash) ctx.filter = 'brightness(2.2)';
                const d = 160;
                ctx.drawImage(spr, -d / 2, -d / 2, d, d);
                ctx.restore();
            } else {
                // 回退：程序化绘制
                ctx.save(); ctx.translate(b.x, b.y);
                ctx.fillStyle = bodyColor;
                ctx.beginPath(); ctx.arc(0, 0, 55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
                ctx.restore();
            }
            break;
        }
    }
    ctx.restore();
}

function drawBossHPBar() {
    if (!boss || boss.state === 'dying') return;
    const w = 680, h = 20, x = (CONFIG.CANVAS_WIDTH - w) / 2, y = 14;
    ctx.fillStyle = '#f5f5ef'; // 白色血条底（黑白漫画）
    ctx.fillRect(x - 3, y - 3, w + 6, h + 6);
    const ratio = Math.max(0, boss.hp / boss.maxHp);
    const grad = ctx.createLinearGradient(x, 0, x + w, 0);
    grad.addColorStop(0, boss.def.color);
    grad.addColorStop(1, '#ff2244');
    ctx.fillStyle = grad;
    ctx.fillRect(x, y, w * ratio, h);
    // 黑色描边
    ctx.strokeStyle = '#000'; ctx.lineWidth = 2.5;
    ctx.strokeRect(x - 3, y - 3, w + 6, h + 6);
    // 阶段2分割线
    if (boss.phase === 2) {
        ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(x + w * 0.5, y); ctx.lineTo(x + w * 0.5, y + h); ctx.stroke();
    }
    ctx.font = '900 18px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 5;
    const label = `${boss.def.name}${boss.phase === 2 ? ' [狂暴]' : ''}  ${Math.ceil(boss.hp)}/${boss.maxHp}`;
    ctx.strokeText(label, 640, y + h + 20);
    ctx.fillText(label, 640, y + h + 20);
    ctx.textAlign = 'left';
}

function drawPhaseBanner() {
    let text = null, color = '#fff';
    if (phase === 'break' && waveBreakTimer > 0) {
        text = `下一波 ${Math.ceil(waveBreakTimer / 1000)}`; color = '#44ff88';
    } else if (phase === 'bossWarn') {
        const t = Math.ceil(bossWarnTimer / 1000);
        text = `!! BOSS 来袭 !!`; color = '#ff4444';
    } else if (phase === 'wave') {
        text = (gameMode === 'endless') ? `无尽 · 第 ${currentWave} 波` : `第 ${currentWave}/${stage.waves} 波`; color = '#ffaa44';
    } else if (phase === 'boss' && boss && boss.state === 'enter') {
        text = boss.def.name; color = boss.def.color;
    }
    if (!text) return;
    ctx.save();
    ctx.globalAlpha = 0.9;
    ctx.font = '900 34px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 6;
    ctx.strokeText(text, 640, 100);
    ctx.fillStyle = color;
    ctx.fillText(text, 640, 100);
    ctx.restore();
}

// 玩家绘制（2026-09-18 重构）：三角色贴图/程序化分发
// 克希娅：3姿态贴图（待机/攻击/换道移动，水平翻转）+ 近身刃域光环 + 匕首贴图弹
// 二小姐：2姿态贴图（待机/攻击）+ 持续黄激光 + 传送金光
// 阿撒托斯：专属绅士精灵（自由飞行 + 混沌环绕 + ∞标记）
function drawPlayer() {
    const p = player;
    if (!p) return;
    // 姿态攻击计时衰减（射击时短暂切换攻击姿态）
    if (p.atkPoseT > 0) p.atkPoseT -= 16;
    // 化身修罗：变身期间完全变成Boss（隐藏玩家，画Boss模型覆盖三通道）
    if (p.transformed) { drawTransformedBoss(p); return; }
    if (p.charId === 'kexiya' && Assets.img['kexiya-idle']) { drawKexiya(p); return; }
    if (p.charId === 'miss2' && Assets.img['miss2-idle']) { drawMiss2(p); return; }
    if (p.charId === 'yangtaole' && Assets.img['ytl-idle']) { drawYtl(p); return; }
    if (p.charId === 'azathoth' && Assets.img.player) { drawAzathoth(p); return; }
    if (p.charId === 'felisis' && Assets.img['felisis-idle']) { drawFelisis(p); return; }
    // 化身修罗：变身期间画Boss贴图（翻转朝右）
    if (p.transformed && Assets.img['boss-true-felisis']) { /* Boss贴图渲染在drawTransformation中 */ }
    drawProceduralPlayer(p);
}

// 水平翻转绘制精灵（素材面朝左 → 游戏内朝右）
function drawFlipped(img, x, y, w, h, alpha = 1) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.translate(x, y);
    ctx.scale(-1, 1);
    ctx.drawImage(img, -w / 2, -h / 2, w, h);
    ctx.restore();
}

// 通用效果环（护盾/遁形等反馈）
function drawPlayerRings(p, cx, cy, radius) {
    if (hasEffect('shield')) {
        ctx.strokeStyle = 'rgba(100,255,200,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, radius + 9 + Math.sin(p.enginePhase) * 2, 0, Math.PI * 2); ctx.stroke();
    } else if (activeEffects.length > 0) {
        ctx.strokeStyle = p.char.color + '4d'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, radius + 5 + Math.sin(p.enginePhase) * 2, 0, Math.PI * 2); ctx.stroke();
    }
    // 魔法护盾：紫色护罩环 + 剩余吸收量小条（血条上方）
    if (p.shieldHp > 0) {
        const tw = Math.max(0.25, 0.45 + Math.sin(p.enginePhase) * 0.2);
        ctx.strokeStyle = `rgba(201,160,255,${tw})`; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, radius + 16 + Math.sin(p.enginePhase * 1.3) * 3, 0, Math.PI * 2); ctx.stroke();
        drawBar(p.x, p.y - 18, p.width, 3, p.shieldHp / MAGIC_SHIELD_HP, '#c9a0ff');
    }
}

// 克希娅：匕首刺客（贴图姿态 + 近身刃域光环）
function drawKexiya(p) {
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const t = performance.now();
    const moving = p.switchT < 1;
    const attacking = (p.atkPoseT || 0) > 0;
    // 被动触发姿态优先：刃域切割命中敌人时短暂显示冲刺挥剑姿态（kexiya-aura.png，2026-09-22）
    const auraPose = (p.auraPoseT || 0) > 0 && Assets.img['kexiya-aura'];
    const key = auraPose ? 'kexiya-aura' : (attacking ? 'kexiya-atk' : (moving ? 'kexiya-move' : 'kexiya-idle'));
    const spr = Assets.img[key] || Assets.img['kexiya-idle'];
    const hgt = 92, wid = hgt * (spr.width / spr.height);

    // 近身刃域：淡蓝光圈（被动可视化）
    const pulse = 100 + Math.sin(t * 0.004) * 6;
    ctx.strokeStyle = 'rgba(125,214,255,0.35)'; ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.arc(cx, cy, pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 落地/悬浮阴影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 46, 21, 5.5, 0, 0, Math.PI * 2); ctx.fill();

    // 换道移动轨迹（移动姿态 + 淡蓝拖尾）
    if (moving) {
        const fromCy = p.switchFrom + p.height / 2;
        ctx.globalAlpha = 0.3;
        ctx.strokeStyle = '#7dd6ff'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(cx, fromCy); ctx.lineTo(cx, cy); ctx.stroke();
        ctx.globalAlpha = 1;
    }

    drawFlipped(spr, cx, cy + Math.sin(t * 0.004) * 2.5, wid, hgt, p.invulnerable > 0 ? 0.5 : 1);
    drawPlayerRings(p, cx, cy, 42);

    // 血条
    drawBar(p.x, p.y - 12, p.width, 4, p.hp / p.maxHp, '#ff5566');
}

// 二小姐：时间魔女（贴图姿态 + 持续黄激光 + 传送金光）
function drawMiss2(p) {
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const t = performance.now();
    const moving = p.switchT < 1;
    const attacking = (p.atkPoseT || 0) > 0;
    const key = attacking ? 'miss2-atk' : 'miss2-idle';
    const spr = Assets.img[key] || Assets.img['miss2-idle'];
    const hgt = 104, wid = hgt * (spr.width / spr.height);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 50, 22, 6, 0, 0, Math.PI * 2); ctx.fill();

    if (moving) {
        // 传送：金色光柱（起点到当前位置）
        const fromCy = p.switchFrom + p.height / 2;
        const grad = ctx.createLinearGradient(cx, fromCy, cx, cy);
        grad.addColorStop(0, 'rgba(255,225,77,0.05)');
        grad.addColorStop(1, 'rgba(255,225,77,0.5)');
        ctx.fillStyle = grad;
        ctx.fillRect(cx - 20, fromCy - 20, 40, cy - fromCy + 40);
        ctx.strokeStyle = 'rgba(255,225,77,0.9)'; ctx.lineWidth = 2;
        ctx.strokeRect(cx - 20, fromCy - 20, 40, cy - fromCy + 40);
    }

    drawFlipped(spr, cx, cy + Math.sin(t * 0.003) * 2, wid, hgt, p.invulnerable > 0 ? 0.5 : 1);
    drawPlayerRings(p, cx, cy, 40);
    drawBar(p.x, p.y - 12, p.width, 4, p.hp / p.maxHp, '#ff5566');
}

// 杨陶乐：械师（贴图姿态：待机/攻击；素材面朝右无需翻转；被动由查尔斯承担致命伤害）
function drawYtl(p) {
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const t = performance.now();
    const moving = p.switchT < 1;
    const attacking = (p.atkPoseT || 0) > 0;
    const key = attacking ? 'ytl-atk' : 'ytl-idle';
    const spr = Assets.img[key] || Assets.img['ytl-idle'];
    const hgt = 92, wid = hgt * (spr.width / spr.height);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 46, 21, 5.5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 0.004) * 2.5);
    if (moving) {   // 换道微倾（朝移动方向）
        const dir = Math.sign(CONFIG.LANE_YS[p.laneIndex] - p.switchFrom) || 0;
        ctx.rotate(dir * 0.09);
    }
    if (p.invulnerable > 0) ctx.globalAlpha = 0.5;
    ctx.drawImage(spr, -wid / 2, -hgt / 2, wid, hgt);
    ctx.restore();

    drawPlayerRings(p, cx, cy, 42);
    drawBar(p.x, p.y - 12, p.width, 4, p.hp / p.maxHp, '#ff5566');
}

// ===== 化身修罗：玩家完全变成Boss（使用原版Boss贴图翻转朝右，覆盖三通道）=====
function drawTransformedBoss(p) {
    const key = p.transformed;
    const def = BOSSES[key];
    if (!def) return;
    const cx = 300, cy = 360;   // 水晶前方覆盖三通道
    const timer = p.transformTimer / 1000;
    const spriteMap = { worm: 'boss1', twin: 'boss2', destroyer: 'boss3', abyss: 'boss4', core: 'boss5' };
    const spr = Assets.img[spriteMap[key]];

    // Boss名字+倒计时
    ctx.font = '900 22px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText('化身·' + def.name + '  ' + timer.toFixed(1) + 's', cx, 80);
    ctx.fillStyle = def.color;
    ctx.fillText('化身·' + def.name + '  ' + timer.toFixed(1) + 's', cx, 80);
    ctx.textAlign = 'left';

    // 大型Boss贴图（翻转朝右，覆盖三通道）
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(-1, 1);   // 翻转朝右
    ctx.globalAlpha = 0.9;
    const size = 320;   // 覆盖三通道
    if (spr) {
        ctx.drawImage(spr, -size / 2, -size / 2, size, size);
    } else {
        ctx.fillStyle = def.color;
        ctx.beginPath(); ctx.arc(0, 0, 100, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    // 变身粒子
    if (Math.random() < 0.5) {
        spawnParticles(cx + (Math.random()-0.5)*200, cy + (Math.random()-0.5)*300, def.color, 2, 4);
    }
}

// 芙丽西斯：书使（贴图姿态：待机/攻击；素材面朝右无需翻转；被动随机弹）
function drawFelisis(p) {
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const t = performance.now();
    const moving = p.switchT < 1;
    const attacking = (p.atkPoseT || 0) > 0;
    const key = attacking ? 'felisis-atk' : 'felisis-idle';
    const spr = Assets.img[key] || Assets.img['felisis-idle'];
    const hgt = 92, wid = hgt * (spr.width / spr.height);

    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 46, 21, 5.5, 0, 0, Math.PI * 2); ctx.fill();

    ctx.save();
    ctx.translate(cx, cy + Math.sin(t * 0.003) * 2);
    if (p.invulnerable > 0) ctx.globalAlpha = 0.5;
    ctx.drawImage(spr, -wid / 2, -hgt / 2, wid, hgt);
    ctx.restore();

    drawPlayerRings(p, cx, cy, 42);
    drawBar(p.x, p.y - 12, p.width, 4, p.hp / p.maxHp, '#ff5566');
}

// 机械随从·查尔斯：驻守炮台（杨陶乐·保护协议召唤；贴图面朝右，跪姿持枪）
function drawCharles() {
    const c = charles;
    if (!c) return;
    const cx = c.x + c.width / 2, cy = c.y + c.height / 2;
    const spr = Assets.img.charles;
    const t = performance.now();
    const hgt = 96, wid = spr ? hgt * (spr.width / spr.height) : 96;
    const topY = cy - hgt / 2;

    // 登场/传送扩散光环
    if (c.spawnT > 0) {
        const k = 1 - c.spawnT / 350;
        ctx.strokeStyle = `rgba(94,234,212,${(1 - k) * 0.9})`;
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 30 + k * 70, 0, Math.PI * 2); ctx.stroke();
    }

    // 落地阴影
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath(); ctx.ellipse(cx, cy + hgt * 0.52, 26, 6.5, 0, 0, Math.PI * 2); ctx.fill();

    if (spr) {
        ctx.save();
        ctx.translate(cx, cy + Math.sin(t * 0.003) * 1.5);
        if (c.hitFlash > 0) ctx.filter = 'brightness(2.4)';
        ctx.drawImage(spr, -wid / 2, -hgt / 2, wid, hgt);
        ctx.restore();
    } else {
        // 贴图缺失回退：白色方机身 + 蓝色炮管
        ctx.save();
        ctx.fillStyle = '#f4f4f0'; ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
        ctx.fillRect(cx - 20, cy - 22, 40, 44); ctx.strokeRect(cx - 20, cy - 22, 40, 44);
        ctx.fillStyle = '#44ccff';
        ctx.fillRect(cx + 20, cy - 8, 26, 6);
        ctx.restore();
    }

    // 血条 + 名标
    drawBar(cx - 23, topY - 12, 46, 4, c.hp / c.maxHp, '#5eead4');
    ctx.font = '900 12px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 3;
    ctx.strokeText('查尔斯', cx, topY - 16);
    ctx.fillStyle = '#9ff5e2';
    ctx.fillText('查尔斯', cx, topY - 16);
    ctx.textAlign = 'left';
}

// 程序化回退绘制（角色贴图缺失时）
function drawProceduralPlayer(p) {
    const flash = p.invulnerable > 0 && Math.floor(p.invulnerable / 100) % 2 === 0;
    ctx.save();
    ctx.translate(p.x + p.width / 2, p.y + p.height / 2);
    if (!flash) {
        const w = p.width, h = p.height;
        ctx.fillStyle = '#f4f4f0';
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(w/2, 0); ctx.lineTo(-w/4, -h/2); ctx.lineTo(-w/2, -h/4);
        ctx.lineTo(-w/3, 0); ctx.lineTo(-w/2, h/4); ctx.lineTo(-w/4, h/2);
        ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.restore();
    drawBar(p.x, p.y - 12, p.width, 4, p.hp / p.maxHp, '#ff5566');
}

// 阿撒托斯：游戏内立绘精灵 —— 漂浮 + 换道瞬移帧 + 混沌环绕小点 + ∞标记
function drawAzathoth(p) {
    const spr = Assets.img.player;
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    const t = performance.now();
    const dh = 92, dw = dh * (spr.width / spr.height);

    // 落地阴影（漂浮体投影在石板路上）
    if (sceneStripActive()) {
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.beginPath(); ctx.ellipse(cx, cy + 46, 22, 6, 0, 0, Math.PI * 2); ctx.fill();
    }

    const drawBody = (y, alpha, sx, sy, rot) => {
        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(cx, y);
        if (rot) ctx.rotate(rot);
        ctx.scale(sx, sy);
        ctx.drawImage(spr, -dw / 2, -dh / 2, dw, dh);
        ctx.restore();
    };

    if (p.switchT < 1) {
        // ===== 换道瞬移帧：起点残影拉伸淡出 → 消失留速度线 → 终点淡入挤压回弹 =====
        const tt = p.switchT;
        const fromCy = p.switchFrom + p.height / 2;
        const toCy = CONFIG.LANE_YS[p.laneIndex] + p.height / 2;
        drawBody(fromCy, (1 - tt) * 0.45, 1, 1 + tt * 0.5, 0); // 起点残影
        if (tt < 0.45) {
            drawBody(fromCy, 1 - tt / 0.45, 1 - tt * 0.3, 1 + tt * 1.1, 0); // 拉伸离去
        } else if (tt < 0.7) {
            const my = fromCy + (toCy - fromCy) * ((tt - 0.45) / 0.25); // 瞬移速度线
            ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2;
            for (let i = -1; i <= 1; i++) {
                ctx.beginPath();
                ctx.moveTo(cx - 16 + i * 8, my - 24);
                ctx.lineTo(cx + 22 + i * 8, my + 24);
                ctx.stroke();
            }
        } else {
            const k = (tt - 0.7) / 0.3;
            drawBody(toCy, k, 1 + (1 - k) * 0.25, 1 - (1 - k) * 0.3, 0); // 挤压回弹
        }
    } else {
        // ===== 漂浮待机：正弦起伏 + 微倾 + 混沌小点环绕 =====
        const bob = Math.sin(t * 0.003) * 3;
        drawBody(cy + bob, 1, 1, 1, Math.sin(t * 0.0016) * 0.05);
        for (let i = 0; i < 3; i++) {
            const a = t * 0.0022 + i * (Math.PI * 2 / 3);
            ctx.fillStyle = 'rgba(18,18,22,0.55)';
            ctx.beginPath(); ctx.arc(cx + Math.cos(a) * 34, cy + bob + Math.sin(a) * 13, 3, 0, Math.PI * 2); ctx.fill();
        }
    }

    // 效果环（护盾卡等功能性反馈）
    if (hasEffect('shield')) {
        ctx.strokeStyle = 'rgba(100,255,200,0.55)'; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(cx, cy, 58 + Math.sin(p.enginePhase) * 2, 0, Math.PI * 2); ctx.stroke();
    } else if (activeEffects.length > 0) {
        ctx.strokeStyle = 'rgba(20,20,24,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(cx, cy, 54 + Math.sin(p.enginePhase) * 2, 0, Math.PI * 2); ctx.stroke();
    }

    // ∞ 无敌标记（替代血条）
    ctx.font = '900 19px "Arial Black", "Microsoft YaHei", sans-serif';
    ctx.textAlign = 'center';
    ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
    ctx.strokeText('∞', cx, cy - dh / 2 - 8);
    ctx.fillStyle = '#fff';
    ctx.fillText('∞', cx, cy - dh / 2 - 8);
    ctx.textAlign = 'left';
}

function drawEnemies() {
    for (const e of enemies) {
        const cx = e.x + e.width / 2, cy = e.y + e.height / 2;
        const flash = e.hitFlash > 0;
        // art：melee=近战(跑动·无弹幕) / ranged=远程(漂浮·有弹幕)；立绘套随关卡（spriteSet，第5关随机混搭）
        const set = e.spriteSet || '';
        const spr = (e.def.art === 'ranged')
            ? (Assets.img['enemyFar' + set] || Assets.img.enemyFar)
            : (Assets.img['enemyNear' + set] || Assets.img.enemyNear);
        const d = e.width * 1.5;
        const topY = cy - d / 2;

        // 功能色光晕（击杀回能/抽牌/精英的可读性标识）
        ctx.fillStyle = e.def.glowColor;
        ctx.beginPath(); ctx.arc(cx, cy, e.width * 0.7, 0, Math.PI * 2); ctx.fill();

        if (spr) {
            // 落地阴影
            if (sceneStripActive()) {
                ctx.fillStyle = 'rgba(0,0,0,0.22)';
                ctx.beginPath(); ctx.ellipse(cx, cy + d * 0.52, e.width * 0.6, 6, 0, 0, Math.PI * 2); ctx.fill();
            }
            ctx.save();
            ctx.translate(cx, cy);
            if (e.def.art === 'melee') {
                // 跑动动画：前后倾摆 + 步伐弹跳
                ctx.rotate(Math.sin(e.animPhase) * 0.12);
                ctx.translate(0, -Math.abs(Math.sin(e.animPhase)) * 3);
            } else {
                // 漂浮：正弦起伏 + 触手微摆
                ctx.rotate(Math.sin(e.animPhase * 0.6) * 0.06);
                ctx.translate(0, Math.sin(e.animPhase) * 3);
            }
            if (flash) ctx.filter = 'brightness(2.6)';
            ctx.drawImage(spr, -d / 2, -d / 2, d, d);
            ctx.restore();
        } else {
            ctx.save(); ctx.translate(cx, cy); ctx.rotate(e.angle);
            ctx.fillStyle = flash ? '#ffffff' : e.color;
            ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 1.5;
            const s = e.width / 2;
            switch (e.def.shape) {
                case 'square': ctx.fillRect(-s, -s, s*2, s*2); ctx.strokeRect(-s, -s, s*2, s*2); break;
                case 'diamond': ctx.beginPath(); ctx.moveTo(0,-s); ctx.lineTo(s,0); ctx.lineTo(0,s); ctx.lineTo(-s,0); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
                case 'triangle': ctx.beginPath(); ctx.moveTo(-s,s); ctx.lineTo(s,s); ctx.lineTo(0,-s); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
                case 'hexagon': ctx.beginPath();
                    for (let i = 0; i < 6; i++) { const a = (i/6)*Math.PI*2; const x = Math.cos(a)*s, y = Math.sin(a)*s; i===0 ? ctx.moveTo(x,y) : ctx.lineTo(x,y); }
                    ctx.closePath(); ctx.fill(); ctx.stroke(); break;
            }
            ctx.restore();
        }

        // 头顶类型徽章（黑白场景中用功能色区分敌人种类）
        drawTypeBadge(cx, topY - 13, e);

        // 魅惑友军：粉色光环标记（不与冰冻/毒圈冲突）
        if (e.friendly) {
            ctx.strokeStyle = 'rgba(255,138,216,0.85)'; ctx.lineWidth = 2.5;
            ctx.beginPath(); ctx.arc(cx, cy, e.width * 0.75 + Math.sin(performance.now() * 0.008) * 3, 0, Math.PI * 2); ctx.stroke();
        }

        // 冰冻 / 中毒状态圈
        if (e.freezeTimer > 0) {
            ctx.strokeStyle = 'rgba(100,200,255,0.6)'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.arc(cx, cy, e.width / 2 + 6, 0, Math.PI*2); ctx.stroke();
        }
        if (e.poisonTimer > 0) {
            ctx.strokeStyle = 'rgba(170,68,255,0.5)'; ctx.lineWidth = 1.5;
            ctx.beginPath(); ctx.arc(cx, cy, e.width / 2 + 9, 0, Math.PI*2); ctx.stroke();
        }

        drawBar(e.x, e.y - 8, e.width, 3, e.hp / e.maxHp, e.color);
    }
}

// 头顶类型徽章：底色=种类色（白灰/绿/蓝/红），白色符号=击杀效果
// 能量=⚡闪电 / 抽牌=卡片 / 高危=！/ 无效果=圆点
function drawTypeBadge(x, y, e) {
    const r = 9;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = e.def.color;
    ctx.fill();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 2; ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    switch (e.def.badge) {
        case 'energy': // 闪电
            ctx.beginPath();
            ctx.moveTo(x + 2, y - 5); ctx.lineTo(x - 3, y + 1); ctx.lineTo(x, y + 1);
            ctx.lineTo(x - 2, y + 5); ctx.lineTo(x + 3, y - 1); ctx.lineTo(x, y - 1);
            ctx.closePath(); ctx.fill();
            break;
        case 'draw': // 卡片
            ctx.strokeRect(x - 4, y - 3, 8, 6);
            break;
        case 'elite': // 高危 !
            ctx.font = '900 14px "Arial Black", "Microsoft YaHei", sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', x, y + 4.5);
            ctx.textAlign = 'left';
            break;
        default: // 无效果：小圆点
            ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
}

function drawPlayerBullets() {
    for (const b of playerBullets) {
        // 外圈彩光：浅色场景下保证子弹可读（普通弹=角色色光晕，混沌弹=紫光）
        ctx.shadowColor = b.chaos ? '#a78bfa' : (b.color || '#ffffff');
        ctx.shadowBlur = 13;
        // 二小姐激光段：黄芯白边长条（间隔释放，从指尖射出）
        if (b.beam) {
            ctx.fillStyle = 'rgba(255,240,150,0.9)';
            ctx.fillRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
            ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.strokeRect(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h);
            ctx.shadowBlur = 0;
            continue;
        }
        // 查尔斯蓝色光线：蓝芯白边长条（驻守炮台1秒/发，单发不穿透）
        if (b.charlesBeam) {
            ctx.fillStyle = 'rgba(90,215,255,0.92)';
            ctx.fillRect(b.x, b.y, b.w, b.h);
            ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.strokeRect(b.x, b.y, b.w, b.h);
            ctx.shadowBlur = 0;
            continue;
        }
        // 克希娅匕首：贴图弹（翻转朝右飞行）
        if (b.sprite === 'kexiya' && Assets.img['kexiya-bullet']) {
            const spr = Assets.img['kexiya-bullet'];
            const bw2 = b.w * 1.7, bh2 = bw2 * (spr.height / spr.width);
            ctx.save();
            ctx.translate(b.x + b.w / 2, b.y + b.h / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(spr, -bw2 / 2, -bh2 / 2, bw2, bh2);
            ctx.restore();
            ctx.shadowBlur = 0;
            continue;
        }
        if (b.chaos) {
            // 黑色混沌弹：黑核白描边 + 环绕白点
            ctx.beginPath(); ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2);
            ctx.fillStyle = '#0c0c0e'; ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = '#fff'; ctx.stroke();
            const a = performance.now() * 0.02 + (b.seed || 0);
            ctx.beginPath();
            ctx.arc(b.x + Math.cos(a) * b.w * 0.24, b.y + Math.sin(a) * b.w * 0.24, 2, 0, Math.PI * 2);
            ctx.fillStyle = '#fff'; ctx.fill();
        } else {
            // 白色弹体 + 黑描边（黑白卡通）
            ctx.fillStyle = '#f6f6f2'; ctx.strokeStyle = '#111'; ctx.lineWidth = 1.5;
            if (b.circle && b.w <= 12) {
                ctx.beginPath(); ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
            } else {
                ctx.fillRect(b.x, b.y, b.w, b.h); ctx.strokeRect(b.x, b.y, b.w, b.h);
            }
        }
        ctx.shadowBlur = 0;
    }
}

function drawEnemyBullets() {
    for (const b of enemyBullets) {
        // 黑色弹体 + 白描边（在浅色石板路上保持可读）
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fillStyle = '#0c0c0e'; ctx.fill();
        ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; ctx.stroke();
    }
}

function drawParticles() {
    for (const p of particles) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.globalAlpha = a; ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * a, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
}

function drawFloatTexts() {
    for (const t of floatTexts) {
        ctx.globalAlpha = Math.min(1, Math.max(0, t.life));
        // 教程提示用大字号
        if (t.big) { ctx.font = '900 22px "Arial Black", "Microsoft YaHei", sans-serif'; }
        else { ctx.font = '900 21px "Arial Black", "Microsoft YaHei", sans-serif'; }
        ctx.fillStyle = t.color; ctx.textAlign = 'center';
        ctx.strokeStyle = '#000'; ctx.lineWidth = 4;
        ctx.strokeText(t.text, t.x, t.y); ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'left';
}

function drawBar(x, y, w, h, ratio, color) {
    ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color; ctx.fillRect(x, y, w * Math.max(0, ratio), h);
    ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1;
    ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);
}
