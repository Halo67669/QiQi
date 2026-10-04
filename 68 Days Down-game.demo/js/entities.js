// ========== 玩家类（三路切换，非自由移动） ==========
class Player {
    constructor(charId) {
        this.charId = charId;
        this.char = CHARACTERS[charId];
        this.x = CONFIG.PLAYER_X;
        this.width = CONFIG.PLAYER_WIDTH;
        this.height = CONFIG.PLAYER_HEIGHT;
        this.laneIndex = 1;            // 中路起始
        this.y = CONFIG.LANE_YS[this.laneIndex];
        this.switchFrom = this.y;
        this.switchT = 1;               // 换道动画进度 0~1
        this.switchDur = CONFIG.PLAYER_LANE_SWITCH_MS;
        this.hp = CONFIG.PLAYER_HP;
        this.maxHp = CONFIG.PLAYER_HP;
        this.damage = this.char.stats.damage;
        this.lastFireTime = 0;
        this.invulnerable = 0;
        this.circularTimer = 0;
        this.enginePhase = 0;
        this.spiralAngle = 0;
        this.speedMult = 1;            // 换道速度倍率
        this.damageReduction = 0;
        this.regenAccum = 0;
        this.shieldHp = 0;             // 魔法护盾：吸收池（法术牌 magic_shield）
        this.auraPoseT = 0;            // 克希娅：被动触发姿态计时（刃域切割命中时短暂显示）
        this.freeMove = !!this.char.freeMove;   // 阿撒托斯：输入层按住持续飞行（曾缺失致自由飞行失效）
    }

    switchLane(dir) {
        // 二小姐：传送式换道（金色粒子在起点与终点爆发）
        if (this.char.teleport) {
            spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#ffe14d', 16, 5);
        }
        const target = this.laneIndex + dir;
        if (target < 0 || target >= CONFIG.LANE_COUNT) return;
        this.laneIndex = target;
        this.switchFrom = this.y;
        this.switchT = 0;
        if (this.char.teleport) {
            const ty = CONFIG.LANE_YS[target];
            spawnParticles(this.x + this.width / 2, ty + this.height / 2, '#ffe14d', 16, 5);
        }
    }

    update(dt) {
        // 换道动画
        if (this.switchT < 1) {
            this.switchT = Math.min(1, this.switchT + dt / (this.switchDur / this.speedMult));
            const t = this.switchT;
            // easeOutCubic
            const ease = 1 - Math.pow(1 - t, 3);
            this.y = this.switchFrom + (CONFIG.LANE_YS[this.laneIndex] - this.switchFrom) * ease;
        } else if (!this.char.freeMove) {
            // 自由飞行角色（阿撒托斯）不吸附通道中心——否则每帧被拉回laneY，
            // 与下方自由移动±6.2相互抵消，表现为"完全动不了"（2026-09-22 修复）
            this.y = CONFIG.LANE_YS[this.laneIndex];
        }

        // 阿撒托斯：自由移动（无视三通道，按住W/S/↑/↓在场景内连续上下飞行）
        if (this.char.freeMove && input.up) this.y -= 6.2;
        if (this.char.freeMove && input.down) this.y += 6.2;
        if (this.char.freeMove) this.y = Math.max(40, Math.min(CONFIG.CANVAS_HEIGHT - 90, this.y));

        // 克希娅被动：近身刃域（周期切割近距离敌人；命中时短暂切换被动攻击姿态）
        if (this.char.passive === 'auraDamage') {
            this.auraTick = (this.auraTick || 0) + dt;
            if (this.auraTick >= 400) {
                this.auraTick = 0;
                const cx = this.x + this.width / 2, cy = this.y + this.height / 2;
                let hitAny = false;
                for (const e of enemies) {
                    const ec = e.getCenter();
                    if ((ec.x - cx) ** 2 + (ec.y - cy) ** 2 < 110 * 110) {
                        e.hp -= this.char.auraDmg || 3; e.hitFlash = 60;
                        hitAny = true;
                        spawnParticles(ec.x, ec.y, '#7dd6ff', 3, 2);
                        if (e.hp <= 0) onEnemyKilled(e);
                    }
                }
                if (hitAny) this.auraPoseT = 300;   // 被动触发表现：切换被动攻击姿态约0.3秒
            }
        }

        if (this.invulnerable > 0) this.invulnerable -= dt;
        if (hasEffect('shield') && this.invulnerable <= 0) this.invulnerable = 200;
        // 魔法护盾：效果到期后吸收池清零
        if (this.shieldHp > 0 && !hasEffect('magic_shield')) this.shieldHp = 0;
        // 克希娅被动姿态计时衰减
        if (this.auraPoseT > 0) this.auraPoseT -= dt;

        this.enginePhase += 0.2;
        this.circularTimer += dt;
        this.spiralAngle += 0.35;

        // 生命再生
        if (hasEffect('regen')) {
            this.regenAccum += dt;
            if (this.regenAccum >= 1000) {
                this.regenAccum -= 1000;
                if (this.hp < this.maxHp) this.hp = Math.min(this.maxHp, this.hp + 2);
            }
        }
    }

    takeDamage(dmg) {
        if (this.char.passive === 'invincible') return false; // 阿撒托斯：本体绝对无敌，弹幕被吸收
        if (this.invulnerable > 0) return false;
        dmg = Math.round(dmg * (1 - this.damageReduction));
        // 魔法护盾：先由吸收池承担（完全吸收不掉血、不触发无敌帧）
        if (this.shieldHp > 0) {
            const absorbed = Math.min(this.shieldHp, dmg);
            this.shieldHp -= absorbed;
            dmg -= absorbed;
            spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#c9a0ff', 8, 4);
            if (dmg <= 0) return true;
        }
        // 杨陶乐被动：查尔斯在场时，致命伤害转移给查尔斯（自身免伤）
        if (this.char.passive === 'charlesGuard' && charles && this.hp - dmg <= 0) {
            charles.takeDamage(dmg);
            floatTexts.push(new FloatText(this.x + 18, this.y - 30, '伤害转移!', '#5eead4'));
            this.invulnerable = 1200;
            return true;
        }
        this.hp -= dmg;
        this.invulnerable = 1200;
        return true;
    }

    getCenter() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }
}

// ========== 机械随从·查尔斯（杨陶乐·保护协议召唤：原地驻守自动射击的友方炮台）==========
class Charles {
    constructor(laneIndex) {
        this.laneIndex = laneIndex;
        this.x = CHARLES_DEF.x;
        this.width = 46;
        this.height = 46;
        this.moveToLane(laneIndex);
        this.hp = CHARLES_DEF.hp;
        this.maxHp = CHARLES_DEF.hp;
        this.fireRate = CHARLES_DEF.fireRate;
        this.damage = CHARLES_DEF.damage;
        this.lastFireTime = 0;
        this.hitFlash = 0;
        this.spawnT = 350;          // 登场/传送光环时长
    }

    // 保护协议再施放：传送至指定通道（血量由卡牌效果回满）
    moveToLane(laneIndex) {
        this.laneIndex = laneIndex;
        this.y = CONFIG.LANE_YS[laneIndex] - this.height / 2;   // 立绘以通道中心对齐
        this.spawnT = 350;
    }

    update(dt, now) {
        if (this.spawnT > 0) this.spawnT -= dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
        // 自动射击：0.2秒一发蓝色光线（友方随从，不受时间暂停影响）
        if (now - this.lastFireTime < this.fireRate) return;
        this.lastFireTime = now;
        const mx = this.x + this.width, my = this.y + this.height / 2 - 6;
        playerBullets.push({
            x: mx, y: my, vx: CHARLES_DEF.bulletSpeed, vy: 0,
            damage: this.damage, piercing: false, hitSet: new Set(),
            w: 52, h: 6, color: '#44ccff',
            onHit: {}, homing: false, bounces: 0, circle: false,
            chaos: false, seed: 0, sprite: null, charlesBeam: true,
        });
        spawnParticles(mx + 4, my, '#44ccff', 4, 2);
    }

    takeDamage(dmg) {
        // 伤害来源：杨陶乐被动转移 / 小怪撞击阻挡，统一在此结算（飘字由调用方按场景显示）
        this.hp -= dmg;
        this.hitFlash = 200;
        spawnParticles(this.x + this.width / 2, this.y + this.height / 2, '#5eead4', 12, 5);
    }

    getCenter() { return { x: this.x + this.width / 2, y: this.y + this.height / 2 }; }
}

// ========== 敌人类（固定走一条道） ==========
class Enemy {
    constructor(type, laneIndex, stage) {
        const def = ENEMY_TYPES[type];
        this.type = type;
        this.def = def;
        this.laneIndex = laneIndex;
        this.x = CONFIG.CANVAS_WIDTH + 40 + Math.random() * 60;
        this.y = CONFIG.LANE_YS[laneIndex];
        this.width = type === 'red' ? 52 : 38;
        this.height = type === 'red' ? 52 : 38;
        this.hp = Math.round(def.hp * stage.hpMult);
        this.maxHp = this.hp;
        this.speed = def.speed * stage.spdMult;
        this.damage = def.damage;
        this.color = def.color;
        this.shootRate = def.shootRate > 0 ? Math.max(500, def.shootRate * stage.fireMult) : 0;
        this.lastShootTime = performance.now() + Math.random() * 1500;
        this.angle = 0;
        this.wobble = Math.random() * Math.PI * 2;
        this.animPhase = Math.random() * Math.PI * 2; // 跑动/漂浮动画相位
        // 本关小怪立绘套：第3关='3'、第4关='4'、第5关='random'（各套随机混搭登场）
        this.spriteSet = stage.enemySet === 'random'
            ? ['', '3', '4'][Math.floor(Math.random() * 3)]
            : (stage.enemySet || '');
        this.hitFlash = 0;
        this.poisonTimer = 0;
        this.poisonDmg = 0;
        this.poisonAccum = 0;
        this.freezeTimer = 0;
        // 魅惑状态（charm_shot 命中后）：成为友军，从左向右飞离并撞击敌方
        this.friendly = false;
        this.friendlyHitCd = 0;
    }

    update(dt, now) {
        let spd = this.speed;
        if (this.freezeTimer > 0) { spd *= 0.4; this.freezeTimer -= dt; }
        if (hasEffect('time_stop')) spd = 0;
        else if (hasEffect('time_decel') || hasEffect('time_slow')) spd *= 0.4;

        // 魅惑友军：反向移动（从左向右），不射击、不撞水晶与主角，撞击敌方造成伤害，飞出右缘消失
        if (this.friendly) {
            this.x += spd * 1.6;
            this.wobble += 0.04;
            this.angle += 0.04;
            if (this.freezeTimer <= 0) this.animPhase += dt * 0.012;
            if (this.hitFlash > 0) this.hitFlash -= dt;
            if (this.friendlyHitCd > 0) this.friendlyHitCd -= dt;
            // 撞击敌方（非友军敌人与Boss）造成伤害
            const myC = this.getCenter();
            for (const e of enemies) {
                if (e === this || e.friendly) continue;
                if (this.friendlyHitCd <= 0 && Math.abs(e.getCenter().x - myC.x) < (e.width + this.width) / 2 &&
                    Math.abs(e.getCenter().y - myC.y) < (e.height + this.height) / 2) {
                    e.hp -= this.damage; e.hitFlash = 80;
                    this.friendlyHitCd = 300;
                    spawnParticles(e.getCenter().x, e.getCenter().y, '#ff8ad8', 6, 3);
                    if (e.hp <= 0) onEnemyKilled(e);
                }
            }
            if (boss && boss.state === 'fight' && this.friendlyHitCd <= 0) {
                const hb = boss.hitbox;
                if (myC.x > hb.x && myC.x < hb.x + hb.width && myC.y > hb.y && myC.y < hb.y + hb.height) {
                    this.friendlyHitCd = 300;
                    boss.takeDamage(this.damage);
                    spawnParticles(myC.x, myC.y, '#ff8ad8', 6, 3);
                }
            }
            if (this.x > CONFIG.CANVAS_WIDTH + 40) this.friendlyGone = true; // 飞出右缘标记
            return;
        }

        this.x -= spd;
        // 道内轻微摆动（不越出本道）
        const laneY = CONFIG.LANE_YS[this.laneIndex];
        this.y = laneY + Math.sin(this.wobble) * 10;
        this.wobble += 0.04;
        this.angle += 0.04;
        if (this.freezeTimer <= 0) this.animPhase += dt * 0.012; // 冰冻时动画停住
        if (this.hitFlash > 0) this.hitFlash -= dt;

        // 毒伤
        if (this.poisonTimer > 0) {
            this.poisonTimer -= dt;
            this.poisonAccum += dt;
            if (this.poisonAccum >= 1000) {
                this.poisonAccum -= 1000;
                this.hp -= this.poisonDmg;
                this.hitFlash = 50;
                spawnParticles(this.x + this.width/2, this.y + this.height/2, '#aa44ff', 3, 2);
            }
        }

        // 射击（瞄准玩家所在道；魅惑友军不射击）
        if (this.shootRate > 0 && !this.friendly && now - this.lastShootTime > this.shootRate) {
            this.lastShootTime = now;
            this.shoot();
        }
    }

    shoot() {
        const center = player.getCenter();
        const myC = this.getCenter();
        const dx = center.x - myC.x;
        const dy = center.y - myC.y;
        const dist = Math.max(1, Math.sqrt(dx * dx + dy * dy));
        const speed = 4.5;

        if (this.type === 'blue') {
            for (let i = -1; i <= 1; i++) {
                const a = Math.atan2(dy, dx) + i * 0.32;
                enemyBullets.push({ x: myC.x, y: myC.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, damage: 8, r: 6, color: '#ff6655', fromBoss: false });
            }
        } else if (this.type === 'red') {
            for (let i = -1; i <= 1; i++) {
                const a = Math.atan2(dy, dx) + i * 0.22;
                enemyBullets.push({ x: myC.x, y: myC.y, vx: Math.cos(a)*speed, vy: Math.sin(a)*speed, damage: 10, r: 7, color: '#ff3322', fromBoss: false });
            }
        } else {
            enemyBullets.push({ x: myC.x, y: myC.y, vx: (dx/dist)*speed, vy: (dy/dist)*speed, damage: 8, r: 6, color: '#ff8844', fromBoss: false });
        }
    }

    getCenter() { return { x: this.x + this.width / 2, y: this.y + this.height / 2 }; }
}

// ========== Boss类（模型与弹幕覆盖全部三路） ==========
class Boss {
    constructor(def, stageIndex) {
        this.def = def;
        this.stageIndex = stageIndex;
        this.hp = Math.round(def.hp * (1 + stageIndex * 0.06));
        this.maxHp = this.hp;
        this.x = CONFIG.CANVAS_WIDTH + 200;
        this.targetX = 1050;
        this.y = 360;
        this.state = 'enter';
        this.phase = 1;
        this.attackTimer = 1800;
        this.oscT = 0;
        this.hitFlash = 0;
        this.rot = 0;
        this.spiralActive = false;
        this.spiralTimer = 0;
        this.spiralAngle = 0;
        this.deathTimer = -1;
        // 冲刺攻击（街头兽王专属：def.dash=冷却ms）
        this.dashTimer = def.dash ? 5000 : 0;
        this.dashState = null;   // null | 'warn' | 'go' | 'return'
        this.dashLane = 1;
        this.dashHit = false;
        // 特性状态（深红之瞳·持续光环 / 机械巨兽·召唤 / NULL·周期无敌）
        this.auraTimer = 0;
        this.summonTimer = 1200;
        this.invulnCycleT = 0;
        this.invuln = false;
        this.introDrained = false;
        // 小型Boss（真-芙丽西斯）：单通道+移动
        if (def.smallBoss) {
            this.laneIdx = 1;
            this.laneMoveTimer = 2500;
            this.targetX = CONFIG.CANVAS_WIDTH - 200;   // 驻守右侧
        }
    }

    get hitbox() {
        if (this.def.smallBoss) {
            // 小型Boss：命中盒仅覆盖当前通道
            return { x: this.x - 55, y: CONFIG.LANE_YS[this.laneIdx || 1] - 65, width: 110, height: 130 };
        }
        return { x: this.x - 80, y: 100, width: 160, height: 520 };
    }

    inPhase2() { return this.hp < this.maxHp / 2; }

    update(dt, now) {
        this.rot += 0.02;
        this.oscT += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;

        if (this.state === 'enter') {
            this.x -= 4;
            if (this.x <= this.targetX) {
                this.x = this.targetX; this.state = 'fight';
                if (this.def.introDrain) this.doIntroDrain();
            }
            return;
        }
        if (this.state === 'dying') {
            this.deathTimer -= dt;
            if (Math.random() < 0.3) {
                spawnParticles(this.x + (Math.random()-0.5)*140, 100 + Math.random()*520, '#ffaa33', 8, 6);
            }
            return;
        }

        // 上下漂浮（覆盖三路）；冲刺期间由 updateDash 接管 x/y
        // 小型Boss：不漂浮，在通道间移动
        if (this.def.smallBoss) {
            // 通道间移动
            this.laneMoveTimer -= dt;
            if (this.laneMoveTimer <= 0) {
                this.laneMoveTimer = 2500 + Math.random() * 2000;
                this.laneIdx = Math.floor(Math.random() * 3);
            }
            // 平滑移动到目标通道
            const targetY = CONFIG.LANE_YS[this.laneIdx || 1];
            this.y += (targetY - this.y) * Math.min(1, dt / 300);
        } else if (!this.dashState) {
            this.y = 360 + Math.sin(this.oscT * 0.0012) * 40;
        }

        // 冲刺攻击（def.dash 存在的Boss：每隔一段时间冲向主角所在道，撞击后跑回最右侧）
        if (this.def.dash) {
            if (this.dashState) this.updateDash(dt);
            else {
                this.dashTimer -= dt;
                if (this.dashTimer <= 0) this.startDash();
            }
        }

        // 阶段切换
        if (this.phase === 1 && this.inPhase2()) {
            this.phase = 2;
            shake(12, 400);
            spawnParticles(this.x, this.y, this.def.color, 30, 7);
            floatTexts.push(new FloatText(this.x - 100, this.y, '狂暴模式!', '#ff4444'));
        }

        // 螺旋弹幕持续
        if (this.spiralActive) {
            this.spiralTimer -= dt;
            this.spiralAngle += 0.11;
            if (Math.floor(this.spiralTimer / 130) !== Math.floor((this.spiralTimer + dt) / 130)) {
                this.fireSpiralPair();
            }
            if (this.spiralTimer <= 0) this.spiralActive = false;
        }

        // 深红之瞳：持续伤害光环（对水晶+主角少量伤害）
        if (this.def.aura) {
            this.auraTimer -= dt;
            if (this.auraTimer <= 0) {
                this.auraTimer = this.def.aura;
                crystal.takeDamage(2);
                if (player.takeDamage(1)) shake(4, 120);
                spawnParticles(crystal.x + 27, crystal.y + 60 + Math.random() * 390, '#ff5544', 5, 3);
            }
        }

        // 机械巨兽：所有通道持续召唤小怪
        if (this.def.summon) {
            this.summonTimer -= dt;
            if (this.summonTimer <= 0 && enemies.length < 18) {
                this.summonTimer = this.def.summon * (this.phase === 2 ? 0.66 : 1);
                const lane = Math.floor(Math.random() * 3);
                const type = stage.types[Math.floor(Math.random() * stage.types.length)];
                const e = new Enemy(type, lane, stage);
                e.x = this.x - 130 - Math.random() * 60;   // 在Boss左侧出现
                enemies.push(e);
                spawnParticles(e.x + 19, e.y + 19, '#88ffaa', 10, 4);
                floatTexts.push(new FloatText(e.x, e.y - 26, '召唤!', '#88ffaa'));
            }
        }

        // NULL：每5秒周期，最后2秒无敌
        if (this.def.invuln) {
            this.invulnCycleT = (this.invulnCycleT + dt) % this.def.invuln.every;
            this.invuln = this.invulnCycleT >= this.def.invuln.every - this.def.invuln.dur;
        }

        // 攻击循环（冲刺期间暂停普通攻击）
        this.attackTimer -= dt;
        if (this.attackTimer <= 0 && !this.spiralActive && !this.dashState) {
            this.attackTimer = this.def.fireInterval * (this.phase === 2 ? 0.65 : 1) * (0.85 + Math.random() * 0.3);
            const pattern = this.def.patterns[Math.floor(Math.random() * this.def.patterns.length)];
            this.doAttack(pattern);
        }
    }

    doAttack(pattern) {
        const p2 = this.phase === 2;
        const dmg = this.def.bulletDamage;
        switch (pattern) {
            case 'lane_burst': {
                // 扇形弹幕：从下→中→上 依次扫射（每道间隔~460ms，可躲避；相位2更快更密）
                const stepMs = p2 ? 320 : 460;
                const speed = 4.2 * (p2 ? 1.2 : 1);
                const count = p2 ? 7 : 5;
                for (let k = 0; k < 3; k++) {
                    const li = 2 - k; // 下(2)→中(1)→上(0)
                    const laneY = CONFIG.LANE_YS[li];
                    scheduleTelegraph({ lanes: [li], safeLane: null, ms: 650 + k * stepMs, color: '#ff4444' }, () => {
                        const tx = player ? player.getCenter().x : 170;
                        const baseA = Math.atan2(laneY - this.y, tx - (this.x - 40));
                        for (let i = 0; i < count; i++) {
                            const a = baseA + (i - (count - 1) / 2) * 0.15;
                            enemyBullets.push({
                                x: this.x - 40, y: this.y,
                                vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                                damage: dmg, r: 8, color: '#ff5544', fromBoss: true,
                            });
                        }
                    });
                }
                break;
            }
            case 'full_sweep': {
                // 全路弹幕墙，留下一条安全道（绿色高亮提示）
                const safe = Math.floor(Math.random() * 3);
                scheduleTelegraph({ lanes: [0, 1, 2], safeLane: safe, ms: 900, color: '#ff4444' }, () => {
                    const speed = 3.2 * (p2 ? 1.2 : 1);
                    const perLane = p2 ? 9 : 7;
                    for (let li = 0; li < 3; li++) {
                        if (li === safe) continue;
                        for (let i = 0; i < perLane; i++) {
                            enemyBullets.push({
                                x: this.x - 80 - i * 30, y: CONFIG.LANE_YS[li] + (Math.random() - 0.5) * 10,
                                vx: -speed, vy: 0, damage: dmg, r: 8, color: '#ff3388', fromBoss: true,
                            });
                        }
                    }
                });
                break;
            }
            case 'radial': {
                const num = p2 ? 18 : 13;
                const speed = 3.4 * (p2 ? 1.15 : 1);
                for (let i = 0; i < num; i++) {
                    const a = (i / num) * Math.PI * 2 + this.rot;
                    enemyBullets.push({
                        x: this.x, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                        damage: dmg, r: 7, color: this.def.color, fromBoss: true,
                    });
                }
                break;
            }
            case 'aimed': {
                const target = player.getCenter();
                const dx = target.x - this.x;
                const dy = target.y - this.y;
                const baseA = Math.atan2(dy, dx);
                const speed = 5.2 * (p2 ? 1.15 : 1);
                const n = p2 ? 5 : 3;
                for (let i = 0; i < n; i++) {
                    const a = baseA + (i - (n - 1) / 2) * 0.18;
                    enemyBullets.push({
                        x: this.x - 70, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                        damage: dmg + 2, r: 9, color: '#ffaa22', fromBoss: true,
                    });
                }
                break;
            }
            case 'spiral': {
                this.spiralActive = true;
                this.spiralTimer = 2600;
                this.spiralAngle = Math.PI / 2;
                break;
            }
        }
    }

    doIntroDrain() {
        // NULL 登场：扣除水晶与主角当前生命的一半
        crystal.hp = Math.max(1, Math.ceil(crystal.hp / 2));
        crystal.hitFlash = 600;
        player.hp = Math.max(1, Math.ceil(player.hp / 2));
        screenFlash = 1;
        shake(30, 900);
        floatTexts.push(new FloatText(640, 280, 'N U L L', '#ff4466'));
        floatTexts.push(new FloatText(200, 220, '水晶 -50%', '#44aaff'));
        floatTexts.push(new FloatText(player.x + 18, player.y - 40, '生命 -50%', '#ff5566'));
    }

    startDash() {
        // 锁定预警：冲刺目标=主角当前所在道（700ms预警，玩家可换道躲开）
        this.dashLane = player ? player.laneIndex : 1;
        this.dashState = 'warn';
        this.dashHit = false;
        this.dashTimer = 700;
        scheduleTelegraph({ lanes: [this.dashLane], safeLane: null, ms: 700, color: '#ff4444' }, () => {});
        floatTexts.push(new FloatText(this.x - 60, this.y - 130, '!! 冲刺 !!', '#ff4444'));
    }

    updateDash(dt) {
        if (this.dashState === 'warn') {
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) { this.dashState = 'go'; shake(8, 250); }
        } else if (this.dashState === 'go') {
            // 高速冲向最前方，冲刺路径可造成一次撞击伤害（换道可躲）
            this.x -= 17;
            const laneY = CONFIG.LANE_YS[this.dashLane];
            this.y += (laneY - this.y) * Math.min(1, dt / 90);
            if (!this.dashHit && player) {
                const bx = this.x - 70, by = laneY - 55;
                if (bx < player.x + player.width && bx + 140 > player.x &&
                    by < player.y + player.height && by + 110 > player.y) {
                    this.dashHit = true;
                    if (player.takeDamage(this.def.dashDamage || 18)) {
                        shake(14, 350);
                        spawnParticles(player.x + 18, player.y + 18, '#ff8844', 14, 5);
                    }
                }
            }
            if (this.x <= 190) this.dashState = 'return';
        } else if (this.dashState === 'return') {
            // 快速跑回通道最右侧（回程无碰撞，给玩家输出窗口）
            this.x += 11;
            this.y += (360 - this.y) * Math.min(1, dt / 220);
            if (this.x >= this.targetX) {
                this.x = this.targetX;
                this.dashState = null;
                this.dashTimer = (this.def.dash || 9000) * (this.inPhase2() ? 0.75 : 1);
            }
        }
    }

    fireSpiralPair() {
        const speed = 4;
        for (const off of [0, Math.PI]) {
            const a = this.spiralAngle + off;
            enemyBullets.push({
                x: this.x - 40, y: this.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed,
                damage: this.def.bulletDamage, r: 7, color: '#cc66ff', fromBoss: true,
            });
        }
    }

    takeDamage(dmg) {
        if (this.state === 'dying') return;
        if (this.invuln) return; // NULL：周期无敌期间不掉血
        this.hp -= dmg;
        this.hitFlash = 80;
        if (this.hp <= 0) {
            this.hp = 0;
            this.state = 'dying';
            this.deathTimer = 1600;
            shake(25, 900);
        }
    }
}

// ========== 水晶类 ==========
class Crystal {
    constructor() {
        this.x = CONFIG.CRYSTAL_X;
        this.y = CONFIG.CRYSTAL_Y;
        this.width = CONFIG.CRYSTAL_WIDTH;
        this.height = CONFIG.CRYSTAL_HEIGHT;
        this.hp = CONFIG.CRYSTAL_HP;
        this.maxHp = CONFIG.CRYSTAL_HP;
        this.pulseTime = 0;
        this.hitFlash = 0;
    }
    update(dt) {
        this.pulseTime += dt;
        if (this.hitFlash > 0) this.hitFlash -= dt;
    }
    takeDamage(dmg) {
        if (hasEffect('crystal_shield')) return;
        this.hp -= dmg;
        this.hitFlash = 300;
    }
}

// ========== 粒子类 ==========
class Particle {
    constructor(x, y, color, opts = {}) {
        this.x = x; this.y = y;
        const angle = opts.angle !== undefined ? opts.angle : Math.random() * Math.PI * 2;
        const speed = opts.speed !== undefined ? opts.speed : Math.random() * 5 + 2;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.life = opts.life || 1;
        this.maxLife = this.life;
        this.color = color;
        this.size = opts.size || (Math.random() * 4 + 2);
        this.gravity = opts.gravity || 0;
    }
    update(dt) {
        this.x += this.vx; this.y += this.vy;
        this.vx *= 0.94; this.vy *= 0.94; this.vy += this.gravity;
        this.life -= dt / 600;
    }
    isAlive() { return this.life > 0; }
}

// ========== 飘字类 ==========
class FloatText {
    constructor(x, y, text, color) {
        this.x = x; this.y = y;
        this.text = text; this.color = color;
        this.life = 1; this.vy = -1.5;
    }
    update(dt) { this.y += this.vy; this.vy *= 0.95; this.life -= dt / 1000; }
    isAlive() { return this.life > 0; }
}
