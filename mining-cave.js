
// ============================================================================
// Mining Cave — embedded animation engine (adapted from the standalone demo).
// No on-canvas Rest/Skin buttons here: the active miner's admin-assigned skin
// and the real mining/cooldown state (driven by app.js from Firebase-backed,
// timestamp-based mining data) control this animation from the outside via
// the window.MiningCave API defined at the bottom of this file. That means
// the animation itself holds no truth of its own — a refresh just restarts
// the visual loop, while resumeMining()/tickMining() in app.js immediately
// re-sync it to the real (persisted) mining/cooldown state, so nothing about
// the actual mining logic can desync or "bug out" across reloads.
// ============================================================================
const canvas = document.getElementById('mining-cave-canvas');
const ctx = canvas.getContext('2d');
canvas.width = 900;
canvas.height = 520;

let transitioning = false;
let transitionAlpha = 0;
let transitionPhase = 'out';

// ---- Rest mode: pauses the mine and shows the miner & a ghost playing cards ----
// Driven externally by window.MiningCave.setResting() — true whenever there is
// no miner actively accumulating right now (on cooldown, or nothing running).
let resting = true;
let restT = 0;

// ---- Miner skins ----
// `id` is the stable key the admin panel stores on a miner (miners/{id}/skin)
// and that window.MiningCave.setSkin(id) looks up below.
const MINER_SKINS = [
    { id: 'miner', name: 'Miner',      icon: '👷', skin: '#c8956c', outfit: '#6b4226', boot: '#2a1a0a', head: 'helmet', helmetColor: '#c9a227', trim: '#8b6914' },
    { id: 'lady', name: 'Lady',       icon: '👩', skin: '#e3b08d', outfit: '#b0447a', boot: '#3a1a2a', head: 'hair',   hairColor: '#3a2a1a',   trim: '#7a2f55' },
    { id: 'old', name: 'Old',        icon: '👴', skin: '#d8b491', outfit: '#5c5c5c', boot: '#2c2c2c', head: 'bald',   hairColor: '#d8d8d8',   trim: '#3f3f3f' },
    { id: 'boxer', name: 'Boxer',      icon: '🥊', skin: '#a8714f', outfit: '#c0392b', boot: '#1a1a1a', head: 'band',   bandColor: '#e0e0e0',   trim: '#7a1f18', glove: '#8b1a1a' },
    { id: 'robot', name: 'Robot',      icon: '🤖', skin: '#9aa8b0', outfit: '#4a5560', boot: '#242a2e', head: 'robot',  eye: '#ff3b3b',         trim: '#2a2f33' },
    { id: 'alien', name: 'Alien',      icon: '👽', skin: '#7fe0a0', outfit: '#2e5c46', boot: '#16261d', head: 'alien',  eye: '#111318',         trim: '#1c3a2c' },
    { id: 'king', name: 'King',       icon: '👑', skin: '#e3b08d', outfit: '#5a1e8c', boot: '#2a1030', head: 'crown',  crownColor: '#f4d03f',  trim: '#c79a2e' },
    { id: 'skeleton', name: 'Skeleton',   icon: '💀', skin: '#eadfc4', outfit: '#3a3a3a', boot: '#1c1c1c', head: 'skull',  trim: '#222222' },
    { id: 'witch', name: 'Witch',      icon: '🧙‍♀️', skin: '#b7cf8a', outfit: '#231b33', boot: '#0e0b16', head: 'witch',  hatColor: '#1a1428',   trim: '#3a2a52' },
    { id: 'blue', name: 'Blue Miner', icon: '🔵', skin: '#8fb8d6', outfit: '#1e4d78', boot: '#0c2436', head: 'helmet', helmetColor: '#3a7bbf', trim: '#1c507a' },
    // ---- 11-20 ----
    { id: 'queen', name: 'Queen',      icon: '👸', skin: '#e8b894', outfit: '#8e1450', boot: '#4a0a2a', head: 'queen',  hairColor: '#4a2414', crownColor: '#ffd75e', trim: '#ffd75e', body: 'gown', legs: 'skirt', cape: '#5a0b3a', gem: '#5fd0ff', sleeve: '#8e1450', sleeveLen: 0.4 },
    { id: 'robber', name: 'Robber',    icon: '🦹', skin: '#c8956c', outfit: '#f0f0f0', boot: '#1a1a1a', pants: '#252525', head: 'robber', hatColor: '#1c1c1c', trim: '#111111', body: 'stripes', stripe: '#1c1c1c', sleeve: '#3a3a3a' },
    { id: 'mermaid', name: 'Mermaid',  icon: '🧜‍♀️', skin: '#f0c8a8', outfit: '#f0c8a8', boot: '#14b3ab', head: 'mermaid', hairColor: '#1fc9bd', trim: '#ff8fb8', body: 'mermaid', legs: 'tail', tail2: '#7be8d8', shell: '#ff9ec4' },
    { id: 'ironhero', name: 'Iron Hero', icon: '🦾', skin: '#d9a441', outfit: '#b3172a', boot: '#e0b52c', pants: '#b3172a', head: 'ironhelm', helm: '#b3172a', plate: '#e0b52c', trim: '#e0b52c', body: 'armor', sleeve: '#b3172a', hand: '#e0b52c', glow: '#8fe8ff' },
    { id: 'titan', name: 'Titan',      icon: '🟣', skin: '#8f62b0', outfit: '#2b2f6b', boot: '#1a1a3a', pants: '#25285c', head: 'titan', helm: '#d9a92a', trim: '#e0b52c', body: 'warlord', sleeve: '#2b2f6b', hand: '#8f62b0', gauntlet: '#f0c33a' },
    { id: 'hacker', name: 'Hacker',    icon: '🧑‍💻', skin: '#c8956c', outfit: '#15181c', boot: '#0c0e10', pants: '#101216', head: 'hacker', trim: '#33ff77', body: 'hoodie', sleeve: '#15181c', hand: '#c8956c', glow: '#33ff77' },
    { id: 'oldlady', name: 'Old Lady', icon: '👵', skin: '#e0bd9c', outfit: '#7a5a94', boot: '#3a2a3a', head: 'granny', hairColor: '#e6e6ea', trim: '#f2f2f2', body: 'gown', legs: 'skirt', noBelt: true, shawl: '#d98aa8', sleeve: '#7a5a94' },
    { id: 'model1', name: 'Model 1',   icon: '🧑', skin: '#a06b47', outfit: '#f2f2ec', boot: '#111111', pants: '#161616', head: 'quiff', hairColor: '#15151a', stache: true, body: 'swirl', pattern: '#3f7a72', trim: '#3f7a72', sleeve: '#f2f2ec', sleeveLen: 0.38 },
    { id: 'model2', name: 'Model 2',   icon: '🧑‍🦱', skin: '#9a6848', outfit: '#d0246e', boot: '#15151a', pants: '#1c2a4a', head: 'curly', hairColor: '#15141a', stache: true, body: 'plaid', plaid2: '#243f8a', plaidLine: '#f4e6ef', trim: '#d0246e', sleeve: '#c02a78' },
    { id: 'model3', name: 'Model 3',   icon: '🙂', skin: '#b07c55', outfit: '#77707c', boot: '#1c1a1c', pants: '#c9c6c0', head: 'messy', hairColor: '#1c1a1c', stache: true, body: 'plaid', plaid2: '#2f2d38', plaidLine: '#e8e6ea', trim: '#77707c', sleeve: '#77707c' },
];
let currentSkin = 0;
function setSkinById(id){
    const idx = MINER_SKINS.findIndex(s => s.id === id);
    currentSkin = idx >= 0 ? idx : 0;
}

// ============ PER-SKIN GEAR (bag + pickaxe) ============
const SKIN_GEAR = [
  /* Miner   */ { bag:{kind:'sack',c1:'#c68e47',c2:'#75501f',rope:'#e0c072',deco:null},
                  pick:{handle:'#8b6914',head:'#707070',hi:'#a0a0a0',style:'classic'} },
  /* Lady    */ { bag:{kind:'purse',c1:'#e86aa6',c2:'#a22c66',trim:'#ffd76a'},
                  pick:{handle:'#d85a95',head:'#e8b4c8',hi:'#fff0f6',style:'ribbon'} },
  /* Old     */ { bag:{kind:'rucksack',c1:'#8a8a86',c2:'#4d4d4a',trim:'#c9b458'},
                  pick:{handle:'#5b4a36',head:'#7a5a44',hi:'#a08468',style:'classic'} },
  /* Boxer   */ { bag:{kind:'duffel',c1:'#d24030',c2:'#7a1f18',trim:'#f0f0f0'},
                  pick:{handle:'#b5322a',head:'#8c8c94',hi:'#d0d0d8',style:'tape'} },
  /* Robot   */ { bag:{kind:'crate',c1:'#8e9aa3',c2:'#4a5560',trim:'#ff3b3b'},
                  pick:{handle:'#5a656e',head:'#3ad0ff',hi:'#d8f8ff',style:'glow',glow:'#3ad0ff'} },
  /* Alien   */ { bag:{kind:'pod',c1:'#8cf0ac',c2:'#2e8c5a',trim:'#d6ffe4'},
                  pick:{handle:'#3a7a58',head:'#b16cff',hi:'#ecd4ff',style:'glow',glow:'#b16cff'} },
  /* King    */ { bag:{kind:'sack',c1:'#7a2bc4',c2:'#3d1266',rope:'#f4d03f',deco:'jewel'},
                  pick:{handle:'#e0b52c',head:'#f4d03f',hi:'#fff2a0',style:'jewel'} },
  /* Skeleton*/ { bag:{kind:'sack',c1:'#eadfc4',c2:'#b3a37c',rope:'#8a7a58',deco:'skull'},
                  pick:{handle:'#eadfc4',head:'#d8ccae',hi:'#fffaea',style:'bone'} },
  /* Witch   */ { bag:{kind:'cauldron',c1:'#4a4a56',c2:'#1a1a22',trim:'#7dff5a'},
                  pick:{handle:'#4a3020',head:'#5a3a86',hi:'#a67de0',style:'star'} },
  /* Blue    */ { bag:{kind:'sack',c1:'#3a86d0',c2:'#1a4c80',rope:'#d0d8e0',deco:'stitch'},
                  pick:{handle:'#2a5e96',head:'#9fb4c4',hi:'#e6f0f8',style:'classic'} },
  /* Queen   */ { bag:{kind:'chest',c1:'#b81c5c',c2:'#6a0f36',trim:'#ffd75e',deco:'crown'},
                  pick:{handle:'#e8a0b0',head:'#ffd75e',hi:'#fff4c0',style:'jewel'} },
  /* Robber  */ { bag:{kind:'sack',c1:'#8a8f5a',c2:'#4d5230',rope:'#2a2a2a',deco:'dollar'},
                  pick:{handle:'#2a2a2a',head:'#8c8c94',hi:'#e0e0e6',style:'tape'} },
  /* Mermaid */ { bag:{kind:'shell',c1:'#ff9ec4',c2:'#c0508a',trim:'#fff2f8'},
                  pick:{handle:'#14b3ab',head:'#7be8d8',hi:'#e8fffb',style:'trident'} },
  /* IronHero*/ { bag:{kind:'reactor',c1:'#c8202f',c2:'#7a0f1a',trim:'#8fe8ff'},
                  pick:{handle:'#b3172a',head:'#e0b52c',hi:'#fff0a0',style:'glow',glow:'#8fe8ff'} },
  /* Titan   */ { bag:{kind:'chest',c1:'#3a3f8a',c2:'#1a1d4a',trim:'#f0c33a',gems:true},
                  pick:{handle:'#2b2f6b',head:'#f0c33a',hi:'#fff2a0',style:'gems'} },
  /* Hacker  */ { bag:{kind:'laptop',c1:'#2a2f36',c2:'#0f1216',trim:'#33ff77'},
                  pick:{handle:'#1c2026',head:'#33ff77',hi:'#d8ffe6',style:'glow',glow:'#33ff77'} },
  /* OldLady */ { bag:{kind:'basket',c1:'#c89a5a',c2:'#7a5428',trim:'#e8a0c0'},
                  pick:{handle:'#8a5a3a',head:'#c9c4d8',hi:'#f4f0fa',style:'ribbon'} },
  /* Model 1 */ { bag:{kind:'tote',c1:'#f2f2ec',c2:'#cfcfc4',pattern:'swirl',pc:'#3f7a72',trim:'#3f7a72'},
                  pick:{handle:'#3f7a72',head:'#9aa8a4',hi:'#ecf4f2',style:'classic'} },
  /* Model 2 */ { bag:{kind:'tote',c1:'#d0246e',c2:'#243f8a',pattern:'plaid',pc:'#f4e6ef',trim:'#243f8a'},
                  pick:{handle:'#c02a78',head:'#8c9ac8',hi:'#eef0fa',style:'classic'} },
  /* Model 3 */ { bag:{kind:'tote',c1:'#77707c',c2:'#2f2d38',pattern:'plaid',pc:'#e8e6ea',trim:'#2f2d38'},
                  pick:{handle:'#4a4652',head:'#a09ca8',hi:'#f0eef2',style:'classic'} },
];

function drawPickTool(pk, bx, by, tx, ty, hy, hw, ctrl) {
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = pk.handle; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(tx, ty); ctx.stroke();
    if (pk.style === 'tape') {
        ctx.strokeStyle = '#f2f2f2'; ctx.lineWidth = 4.5;
        ctx.beginPath(); ctx.moveTo(bx + (tx - bx) * 0.1, by + (ty - by) * 0.1); ctx.lineTo(bx + (tx - bx) * 0.32, by + (ty - by) * 0.32); ctx.stroke();
    }
    if (pk.style === 'bone') {
        ctx.fillStyle = pk.handle; ctx.strokeStyle = '#2b1e14'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx - 2, by, 3.2, 0, 6.28); ctx.arc(bx + 2, by, 3.2, 0, 6.28); ctx.fill(); ctx.stroke();
    }
    if (pk.glow) { ctx.shadowColor = pk.glow; ctx.shadowBlur = 10; }
    ctx.strokeStyle = pk.head; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(tx - hw, hy); ctx.quadraticCurveTo(tx, ctrl, tx + hw, hy); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = pk.hi; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - hw + 2, hy - 1); ctx.quadraticCurveTo(tx, ctrl + 1, tx + hw - 2, hy - 1); ctx.stroke();
    if (pk.style === 'bone') {
        ctx.fillStyle = pk.head; ctx.strokeStyle = '#2b1e14'; ctx.lineWidth = 1;
        [-hw, hw].forEach(dx => { ctx.beginPath(); ctx.arc(tx + dx, hy, 2.8, 0, 6.28); ctx.fill(); ctx.stroke(); });
    }
    if (pk.style === 'trident') {
        const my = (hy + ctrl) / 2;
        ctx.strokeStyle = pk.head; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.moveTo(tx, my + 2); ctx.lineTo(tx, my - 8); ctx.stroke();
        ctx.fillStyle = pk.hi;
        [[tx, my - 8], [tx - hw, hy], [tx + hw, hy]].forEach(p => { ctx.beginPath(); ctx.moveTo(p[0], p[1] - 4.5); ctx.lineTo(p[0] - 2.4, p[1] + 0.5); ctx.lineTo(p[0] + 2.4, p[1] + 0.5); ctx.closePath(); ctx.fill(); });
    }
    if (pk.style === 'gems') {
        const cols = ['#ff3b5c', '#3bc4ff', '#ffd23b', '#5cff8a', '#c07bff', '#ff9a3b'];
        const pts = [[tx - hw * 0.72, 0.5 * hy + 0.5 * hy - 0.5], [tx - hw * 0.5, 0.625 * hy + 0.375 * ctrl], [tx, (hy + ctrl) / 2], [tx + hw * 0.5, 0.625 * hy + 0.375 * ctrl]];
        pts.forEach((p, i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(p[0], p[1] + 0.6, 1.7, 0, 6.28); ctx.fill(); });
    }
    if (pk.style === 'ribbon') {
        ctx.fillStyle = '#ff5fa2';
        ctx.beginPath(); ctx.moveTo(tx, ty + 7); ctx.lineTo(tx - 7, ty + 3); ctx.lineTo(tx - 7, ty + 11); ctx.closePath();
        ctx.moveTo(tx, ty + 7); ctx.lineTo(tx + 7, ty + 3); ctx.lineTo(tx + 7, ty + 11); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.arc(tx, ty + 7, 2, 0, 6.28); ctx.fill();
    }
    if (pk.style === 'jewel') {
        ctx.fillStyle = '#ff3d6e'; ctx.strokeStyle = '#fff2a0'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(tx, (hy + ctrl) / 2 + 1, 2.8, 0, 6.28); ctx.fill(); ctx.stroke();
    }
    if (pk.style === 'star') {
        ctx.fillStyle = '#ffe14d'; const sx = tx, sy = ty + 9;
        ctx.beginPath(); ctx.moveTo(sx, sy - 4); ctx.lineTo(sx + 1.5, sy - 1.5); ctx.lineTo(sx + 4, sy); ctx.lineTo(sx + 1.5, sy + 1.5);
        ctx.lineTo(sx, sy + 4); ctx.lineTo(sx - 1.5, sy + 1.5); ctx.lineTo(sx - 4, sy); ctx.lineTo(sx - 1.5, sy - 1.5); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
}

// bag body: origin = bottom center, ~50px wide, ~40px tall
function drawBagBody(b) {
    const grad = ctx.createLinearGradient(-22, -30, 22, 0);
    grad.addColorStop(0, b.c1); grad.addColorStop(1, b.c2);
    const OUTL = '#1e140a';
    ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const hl = (x, y, rx, ry) => { ctx.fillStyle = 'rgba(255,255,255,0.22)'; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0.3, 0, 6.28); ctx.fill(); };

    if (b.kind === 'sack') {
        ctx.beginPath(); ctx.moveTo(-9, -30); ctx.lineTo(-13, -43); ctx.lineTo(-4, -36); ctx.lineTo(0, -45); ctx.lineTo(4, -36); ctx.lineTo(13, -43); ctx.lineTo(9, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-8, -32); ctx.bezierCurveTo(-25, -22, -26, -3, -14, 0); ctx.lineTo(14, 0); ctx.bezierCurveTo(26, -3, 25, -22, 8, -32); ctx.closePath(); ctx.fill(); ctx.stroke();
        hl(-9, -16, 5, 10);
        if (b.deco === 'jewel') {
            ctx.fillStyle = '#ff4f7a'; ctx.strokeStyle = '#f4d03f'; ctx.lineWidth = 1.4;
            ctx.beginPath(); ctx.moveTo(0, -21); ctx.lineTo(6, -14); ctx.lineTo(0, -7); ctx.lineTo(-6, -14); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.strokeStyle = '#f4d03f'; ctx.lineWidth = 2;
            ctx.beginPath(); ctx.moveTo(-15, -4); ctx.quadraticCurveTo(0, 2, 15, -4); ctx.stroke();
        } else if (b.deco === 'skull') {
            ctx.fillStyle = '#f5efdc'; ctx.strokeStyle = '#2b1e14'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.arc(0, -15, 6.5, 0, 6.28); ctx.fill(); ctx.stroke();
            ctx.fillRect(-3.5, -11, 7, 4.5); ctx.strokeRect(-3.5, -11, 7, 4.5);
            ctx.fillStyle = '#222';
            ctx.beginPath(); ctx.arc(-2.6, -16, 1.7, 0, 6.28); ctx.arc(2.6, -16, 1.7, 0, 6.28); ctx.fill();
        } else if (b.deco === 'dollar') {
            ctx.fillStyle = '#f4e9a0'; ctx.strokeStyle = '#2b2510'; ctx.lineWidth = 0.8;
            ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText('$', 0, -14); ctx.strokeText('$', 0, -14);
        } else if (b.deco === 'stitch') {
            ctx.strokeStyle = b.rope; ctx.lineWidth = 1.3; ctx.setLineDash([3, 3]);
            ctx.beginPath(); ctx.moveTo(0, -28); ctx.lineTo(0, -2); ctx.stroke(); ctx.setLineDash([]);
        }
        ctx.fillStyle = b.rope; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.rect(-9, -34, 18, 5); ctx.fill(); ctx.stroke();

    } else if (b.kind === 'purse') {
        ctx.strokeStyle = b.trim; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.ellipse(0, -26, 11, 14, 0, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-21, -27, 42, 27, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.beginPath(); ctx.roundRect(-21, -27, 42, 10, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.trim; ctx.beginPath(); ctx.arc(0, -17, 3.4, 0, 6.28); ctx.fill(); ctx.stroke();
        hl(-11, -10, 4, 7);

    } else if (b.kind === 'rucksack') {
        ctx.strokeStyle = b.trim; ctx.lineWidth = 3.5;
        ctx.beginPath(); ctx.arc(0, -34, 7, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-19, -34, 38, 34, 9); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.beginPath(); ctx.roundRect(-12, -17, 24, 15, 4); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = b.trim; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(-10, -14); ctx.lineTo(10, -14); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-19, -34, 38, 13, 6); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.trim; ctx.fillRect(-3, -27, 6, 8); ctx.strokeRect(-3, -27, 6, 8);
        ctx.fillStyle = '#a4623a'; ctx.fillRect(9, -9, 7, 6);   // little patch
        hl(-12, -15, 3, 6);

    } else if (b.kind === 'duffel') {
        ctx.strokeStyle = '#222'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.ellipse(0, -26, 12, 12, 0, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-27, -26, 54, 26, 12); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.trim; ctx.fillRect(-5, -25.5, 10, 25);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(-22, -19); ctx.lineTo(22, -19); ctx.stroke();
        hl(-15, -14, 8, 4);

    } else if (b.kind === 'crate') {
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-21, -33, 42, 33, 3); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.fillRect(-21, -33, 42, 7); ctx.strokeRect(-21, -33, 42, 7);
        ctx.save(); ctx.shadowColor = b.trim; ctx.shadowBlur = 8; ctx.fillStyle = b.trim;
        ctx.beginPath(); ctx.roundRect(-12, -19, 24, 5, 2); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#4dff7a';
        [-10, -4, 2].forEach(x => { ctx.beginPath(); ctx.arc(x, -8, 1.6, 0, 6.28); ctx.fill(); });
        ctx.fillStyle = '#c9d2d8';
        [[-17,-29],[17,-29],[-17,-4],[17,-4]].forEach(p => { ctx.beginPath(); ctx.arc(p[0], p[1], 1.7, 0, 6.28); ctx.fill(); });
        ctx.strokeStyle = '#666'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, -33); ctx.lineTo(15, -42); ctx.stroke();
        ctx.fillStyle = '#ff3b3b'; ctx.beginPath(); ctx.arc(15, -43, 2.2, 0, 6.28); ctx.fill();

    } else if (b.kind === 'pod') {
        ctx.save(); ctx.shadowColor = b.trim; ctx.shadowBlur = 14;
        ctx.fillStyle = grad; ctx.strokeStyle = '#1c5a3a';
        ctx.beginPath(); ctx.moveTo(-10, -30); ctx.bezierCurveTo(-32, -24, -28, 0, 0, 0); ctx.bezierCurveTo(28, 0, 32, -24, 10, -30); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        ctx.fillStyle = b.c2; ctx.strokeStyle = '#1c5a3a'; ctx.beginPath(); ctx.ellipse(0, -31, 11, 4, 0, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.trim; ctx.beginPath(); ctx.ellipse(0, -31, 8, 2.5, 0, 0, 6.28); ctx.fill();
        ctx.fillStyle = 'rgba(214,255,228,0.45)';
        [[-10,-16,4],[8,-20,3],[5,-8,2.5],[-4,-6,2]].forEach(s => { ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, 6.28); ctx.fill(); });

    } else if (b.kind === 'cauldron') {
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-16, -4, 6, 7); ctx.fillRect(10, -4, 6, 7);
        ctx.strokeStyle = '#111'; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.ellipse(-27, -22, 3.5, 5, 0, 0, 6.28); ctx.ellipse(27, -22, 3.5, 5, 0, 0, 6.28); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-21, -28); ctx.bezierCurveTo(-32, -20, -28, -2, -14, -3); ctx.lineTo(14, -3); ctx.bezierCurveTo(28, -2, 32, -20, 21, -28); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.beginPath(); ctx.ellipse(0, -28, 22, 6, 0, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.shadowColor = b.trim; ctx.shadowBlur = 10; ctx.fillStyle = b.trim;
        ctx.beginPath(); ctx.ellipse(0, -28, 18, 4, 0, 0, 6.28); ctx.fill();
        [[-6,-33,2.4],[5,-36,3],[0,-40,1.8]].forEach(s => { ctx.beginPath(); ctx.arc(s[0], s[1], s[2], 0, 6.28); ctx.fill(); });
        ctx.restore();
        hl(-14, -14, 4, 8);

    } else if (b.kind === 'tote') {
        ctx.strokeStyle = b.trim; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.ellipse(0, -30, 10, 13, 0, Math.PI, 0); ctx.stroke();
        ctx.save();
        ctx.beginPath(); ctx.roundRect(-21, -30, 42, 30, 4); ctx.clip();
        ctx.fillStyle = b.c1; ctx.fillRect(-21, -30, 42, 30);
        if (b.pattern === 'plaid') {
            ctx.globalAlpha = 0.78; ctx.fillStyle = b.c2;
            for (let x = -21; x < 21; x += 10) ctx.fillRect(x, -30, 5, 30);
            for (let y = -30; y < 0; y += 10) ctx.fillRect(-21, y, 42, 5);
            ctx.globalAlpha = 1; ctx.strokeStyle = b.pc; ctx.lineWidth = 0.8;
            for (let x = -14; x < 21; x += 10) { ctx.beginPath(); ctx.moveTo(x, -30); ctx.lineTo(x, 0); ctx.stroke(); }
            for (let y = -23; y < 0; y += 10) { ctx.beginPath(); ctx.moveTo(-21, y); ctx.lineTo(21, y); ctx.stroke(); }
        } else if (b.pattern === 'swirl') {
            ctx.strokeStyle = b.pc; ctx.lineWidth = 2.6; ctx.lineCap = 'round';
            [[-12, -21], [8, -23], [-2, -9], [13, -8], [-15, -6]].forEach(q => {
                ctx.beginPath(); ctx.arc(q[0], q[1], 4.2, 0.3, 4.9); ctx.stroke();
                ctx.beginPath(); ctx.arc(q[0] + 0.6, q[1], 1.5, 0, 6.28); ctx.stroke();
            });
        }
        ctx.restore();
        ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-21, -30, 42, 30, 4); ctx.stroke();
        hl(-13, -15, 3, 8);

    } else if (b.kind === 'chest') {
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-23, -21, 46, 21, 3); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-23, -21); ctx.quadraticCurveTo(0, -44, 23, -21); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.trim;
        ctx.fillRect(-23, -23, 46, 3.5); ctx.fillRect(-16, -33, 4, 33); ctx.fillRect(12, -33, 4, 33);
        ctx.fillRect(-4, -25, 8, 8); ctx.strokeRect(-4, -25, 8, 8);
        ctx.fillStyle = b.c2; ctx.fillRect(-1.2, -22, 2.4, 3.6);
        if (b.gems) {
            ['#ff3b5c', '#3bc4ff', '#ffd23b', '#5cff8a', '#c07bff', '#ff9a3b'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(-17.5 + i * 7, -10, 2.3, 0, 6.28); ctx.fill(); });
        }
        if (b.deco === 'crown') {
            ctx.fillStyle = b.trim; ctx.strokeStyle = '#8a6a14'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-6, -8); ctx.lineTo(-6, -14); ctx.lineTo(-3, -11); ctx.lineTo(0, -16); ctx.lineTo(3, -11); ctx.lineTo(6, -14); ctx.lineTo(6, -8); ctx.closePath(); ctx.fill(); ctx.stroke();
        }
        hl(-9, -13, 5, 3);

    } else if (b.kind === 'shell') {
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-24, -4); ctx.bezierCurveTo(-32, -28, -10, -42, 0, -42); ctx.bezierCurveTo(10, -42, 32, -28, 24, -4); ctx.quadraticCurveTo(0, 5, -24, -4); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = b.c2; ctx.lineWidth = 1.3;
        [[-19, -30], [-10, -37], [0, -40], [10, -37], [19, -30]].forEach(q => { ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(q[0], q[1]); ctx.stroke(); });
        const pg = ctx.createRadialGradient(-1.5, -12, 0.5, 0, -10, 5);
        pg.addColorStop(0, '#ffffff'); pg.addColorStop(1, '#e8d8f0');
        ctx.fillStyle = pg; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.arc(0, -10, 4.4, 0, 6.28); ctx.fill(); ctx.stroke();

    } else if (b.kind === 'reactor') {
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-21, -33, 42, 33, 5); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#e0b52c'; ctx.fillRect(-21, -12, 42, 4); ctx.fillRect(-21, -33, 42, 4);
        ctx.save(); ctx.shadowColor = b.trim; ctx.shadowBlur = 10; ctx.fillStyle = b.trim;
        ctx.beginPath(); ctx.arc(0, -22, 5.6, 0, 6.28); ctx.fill(); ctx.restore();
        ctx.strokeStyle = '#e0b52c'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, -22, 7, 0, 6.28); ctx.stroke();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, -22, 2.4, 0, 6.28); ctx.fill();
        ctx.fillStyle = '#e8d090';
        [[-17, -29], [17, -29], [-17, -4], [17, -4]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 1.5, 0, 6.28); ctx.fill(); });

    } else if (b.kind === 'laptop') {
        ctx.strokeStyle = '#555c66'; ctx.lineWidth = 3.2;
        ctx.beginPath(); ctx.arc(0, -35, 7, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.roundRect(-19, -36, 38, 36, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = b.c2; ctx.beginPath(); ctx.roundRect(-13, -13, 26, 11, 3); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.shadowColor = b.trim; ctx.shadowBlur = 6; ctx.strokeStyle = b.trim; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
        [[-12, -29, 6], [-12, -24, 14], [-12, -19, 9]].forEach(l => { ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[0] + l[2], l[1]); ctx.stroke(); });
        ctx.beginPath(); ctx.moveTo(-7, -9); ctx.lineTo(-4, -7); ctx.lineTo(-7, -5); ctx.moveTo(-1, -5); ctx.lineTo(5, -5); ctx.stroke();
        ctx.restore();

    } else if (b.kind === 'basket') {
        ctx.strokeStyle = b.c2; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.ellipse(0, -24, 20, 16, 0, Math.PI, 0); ctx.stroke();
        ctx.fillStyle = grad; ctx.strokeStyle = OUTL; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-23, -24); ctx.lineTo(23, -24); ctx.lineTo(18, 0); ctx.lineTo(-18, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(60,30,10,0.45)'; ctx.lineWidth = 1;
        [-18, -12, -6].forEach(y => { ctx.beginPath(); ctx.moveTo(-22 + (y + 24) * 0.2, y); ctx.lineTo(22 - (y + 24) * 0.2, y); ctx.stroke(); });
        for (let x = -16; x <= 16; x += 8) { ctx.beginPath(); ctx.moveTo(x, -23); ctx.lineTo(x * 0.8, -1); ctx.stroke(); }
        ctx.fillStyle = b.trim; ctx.strokeStyle = '#a8557a'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(-6, -30, 7, 0, 6.28); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.arc(-6, -30, 4.4, 0.4, 4.4); ctx.stroke();
        ctx.beginPath(); ctx.arc(8, -28, 5, 0, 6.28); ctx.fillStyle = '#b8d8f0'; ctx.fill(); ctx.stroke();
        ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(4, -32); ctx.lineTo(19, -47); ctx.stroke();
    }
}

const rnd = (a, b) => a + Math.random() * (b - a);
const FLOOR_Y = 200; // above = stone wall, below = walking floor

// ============ CAVE BACKGROUND (pre-rendered per scene) ============
// ============ PROCEDURAL ROCK TEXTURE (height map + lighting) ============
function makeNoise(w, h, cell) {
    const gw = Math.ceil(w / cell) + 3, gh = Math.ceil(h / cell) + 3;
    const d = new Float32Array(gw * gh);
    for (let i = 0; i < d.length; i++) d[i] = Math.random();
    return (x, y) => {
        const fx = Math.min(Math.max(x, 0), w - 1) / cell, fy = Math.min(Math.max(y, 0), h - 1) / cell, ix = fx | 0, iy = fy | 0;
        let tx = fx - ix, ty = fy - iy;
        tx = tx * tx * (3 - 2 * tx); ty = ty * ty * (3 - 2 * ty);
        const a = d[iy * gw + ix], b = d[iy * gw + ix + 1], c = d[(iy + 1) * gw + ix], e = d[(iy + 1) * gw + ix + 1];
        const top = a + (b - a) * tx, bot = c + (e - c) * tx;
        return top + (bot - top) * ty;
    };
}
function makeRockTexture(w, h) {
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d');
    const n1 = makeNoise(w, h, 90), n2 = makeNoise(w, h, 45), n3 = makeNoise(w, h, 22), n4 = makeNoise(w, h, 11), n5 = makeNoise(w, h, 5);
    const nr = makeNoise(w, h, 55), nc = makeNoise(w, h, 75), ns = makeNoise(w, h, 130), nt = makeNoise(w, h, 160);
    const H = new Float32Array(w * h), CR = new Float32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const a3 = n3(x, y);
        let hv = 0.42 * n1(x, y) + 0.26 * n2(x, y) + 0.16 * a3 + 0.10 * n4(x, y) + 0.06 * n5(x, y);
        const rv = 1 - Math.abs(2 * nr(x, y) - 1);
        hv += 0.24 * rv * rv;
        H[y * w + x] = hv;
        const cv = Math.abs(nc(x + (a3 - 0.5) * 50, y + (a3 - 0.5) * 50) - 0.5);
        const t = Math.min(1, cv / 0.03);
        CR[y * w + x] = 1 - t * t * (3 - 2 * t);
    }
    const img = g.createImageData(w, h), px = img.data;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const xl = H[y * w + Math.max(0, x - 1)], xr = H[y * w + Math.min(w - 1, x + 1)];
        const yu = H[Math.max(0, y - 1) * w + x], yd = H[Math.min(h - 1, y + 1) * w + x];
        let shade = 1 - ((xr - xl) + (yd - yu)) * 5.5;   // light from top-left
        shade = Math.max(0.45, Math.min(1.6, shade));
        const t = Math.max(0, Math.min(1, (H[i] - 0.25) / 0.7));
        const warm = nt(x, y);
        const strata = 0.94 + 0.06 * Math.sin(y * 0.11 + ns(x, y) * 8);
        let r = (36 + t * 78) * shade * strata, gg = (29 + t * 64) * shade * strata, b = (23 + t * 50) * shade * strata;
        r *= 0.94 + warm * 0.14; b *= 1.06 - warm * 0.12;
        const cr = 1 - 0.72 * CR[i];
        px[i * 4] = r * cr; px[i * 4 + 1] = gg * cr; px[i * 4 + 2] = b * cr; px[i * 4 + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    return c;
}

function makeBackground() {
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const g = c.getContext('2d');

    // textured rock (bump-mapped height map): no outlines, real rock look
    g.drawImage(makeRockTexture(c.width, c.height), 0, 0);

    // wall shading: dark ceiling, dark base
    const cg = g.createLinearGradient(0, 0, 0, FLOOR_Y);
    cg.addColorStop(0, 'rgba(0,0,0,0.6)'); cg.addColorStop(0.35, 'rgba(0,0,0,0.1)');
    cg.addColorStop(0.85, 'rgba(0,0,0,0.05)'); cg.addColorStop(1, 'rgba(0,0,0,0.4)');
    g.fillStyle = cg; g.fillRect(0, 0, c.width, FLOOR_Y + 20);

    // ---- cave floor (flat, fixed height every scene) ----
    const edge = x => FLOOR_Y;
    const fl = g.createLinearGradient(0, FLOOR_Y - 10, 0, c.height);
    fl.addColorStop(0, 'rgba(120,96,68,0.8)'); fl.addColorStop(0.5, 'rgba(96,76,54,0.8)'); fl.addColorStop(1, 'rgba(58,44,32,0.85)');
    g.fillStyle = fl;
    g.beginPath(); g.moveTo(0, c.height);
    for (let x = 0; x <= c.width; x += 6) g.lineTo(x, edge(x));
    g.lineTo(c.width, c.height); g.closePath(); g.fill();
    for (let i = 0; i < 300; i++) {
        const x = rnd(0, c.width), y = rnd(FLOOR_Y + 10, c.height);
        g.fillStyle = Math.random() > 0.5 ? 'rgba(125,102,78,0.3)' : 'rgba(25,17,10,0.3)';
        g.beginPath(); g.ellipse(x, y, rnd(2, 10), rnd(1.5, 4), 0, 0, Math.PI * 2); g.fill();
    }
    // shadow at base of wall onto floor
    const sh = g.createLinearGradient(0, FLOOR_Y, 0, FLOOR_Y + 50);
    sh.addColorStop(0, 'rgba(0,0,0,0.45)'); sh.addColorStop(1, 'rgba(0,0,0,0)');
    g.save();
    g.beginPath(); g.moveTo(0, c.height);
    for (let x = 0; x <= c.width; x += 6) g.lineTo(x, edge(x));
    g.lineTo(c.width, c.height); g.closePath(); g.clip();
    g.fillStyle = sh; g.fillRect(0, FLOOR_Y - 10, c.width, 70);
    g.restore();
    // rubble along the base of the wall
    for (let i = 0; i < 45; i++) {
        const x = rnd(0, c.width), y = edge(x) + rnd(-2, 14), r = rnd(4, 13);
        g.fillStyle = 'rgba(0,0,0,0.35)';
        g.beginPath(); g.ellipse(x + 2, y + r * 0.5, r, r * 0.4, 0, 0, Math.PI * 2); g.fill();
        g.fillStyle = `hsl(${rnd(24, 32)|0},16%,${rnd(26, 40)|0}%)`;
        g.beginPath(); g.ellipse(x, y, r, r * 0.65, rnd(-0.4, 0.4), 0, Math.PI * 2); g.fill();
    }
    return c;
}

// ============ SKELETON DRAWING ============
const BONE = '#eadfc4', BONE_SH = '#c9b98f', OUT = '#2b1e14';

function bone(g, x1, y1, x2, y2, w) {
    g.lineCap = 'round';
    g.strokeStyle = OUT; g.lineWidth = w + 3;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    g.strokeStyle = BONE; g.lineWidth = w;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
}
function knob(g, x, y, r) {
    g.fillStyle = BONE; g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); g.stroke();
}

function drawHumanSkeleton(g) {
    // legs
    bone(g, -7, 0, -12, 28, 5); bone(g, -12, 28, -17, 55, 5);
    bone(g, 7, 0, 12, 28, 5);   bone(g, 12, 28, 17, 55, 5);
    knob(g, -12, 28, 4); knob(g, 12, 28, 4);
    g.fillStyle = BONE; g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.ellipse(-20, 58, 10, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.ellipse(20, 58, 10, 4, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    // spine
    bone(g, 0, -46, 0, -8, 4);
    // ribs
    for (let i = 0; i < 4; i++) {
        const y = -42 + i * 8, w = 15 - i * 1.5;
        g.strokeStyle = OUT; g.lineWidth = 6;
        g.beginPath(); g.ellipse(0, y, w, 4, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = BONE; g.lineWidth = 3;
        g.beginPath(); g.ellipse(0, y, w, 4, 0, 0, Math.PI * 2); g.stroke();
    }
    // pelvis
    g.fillStyle = BONE; g.strokeStyle = OUT; g.lineWidth = 2;
    g.beginPath(); g.ellipse(0, -4, 15, 8, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = OUT;
    g.beginPath(); g.ellipse(-6, -4, 3.5, 4.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(6, -4, 3.5, 4.5, 0, 0, Math.PI * 2); g.fill();
    // arms (raised)
    bone(g, -12, -42, -32, -34, 4); bone(g, -32, -34, -48, -50, 4);
    bone(g, 12, -42, 32, -34, 4);   bone(g, 32, -34, 48, -50, 4);
    knob(g, -12, -42, 4); knob(g, 12, -42, 4); knob(g, -32, -34, 3.5); knob(g, 32, -34, 3.5);
    for (let s = -1; s <= 1; s += 2) for (let f = -1; f <= 1; f++)
        bone(g, s * 48, -50, s * (52 + f * 1), -57 + f * 3, 1.5);
    // skull
    g.fillStyle = BONE; g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath(); g.arc(0, -62, 15, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.rect(-8, -52, 16, 8); g.fill(); g.stroke();
    g.fillStyle = OUT;
    g.beginPath(); g.ellipse(-6, -63, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(6, -63, 4.5, 5.5, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(0, -58); g.lineTo(-2, -54); g.lineTo(2, -54); g.fill();
    g.strokeStyle = OUT; g.lineWidth = 1.2;
    for (let i = -6; i <= 6; i += 4) { g.beginPath(); g.moveTo(i, -50); g.lineTo(i, -45); g.stroke(); }
}

function along(g, p0, p1, p2, n, r0, r1) {
    for (let i = 0; i <= n; i++) {
        const t = i / n, u = 1 - t;
        const x = u*u*p0[0] + 2*u*t*p1[0] + t*t*p2[0];
        const y = u*u*p0[1] + 2*u*t*p1[1] + t*t*p2[1];
        knob(g, x, y, r0 + (r1 - r0) * t);
    }
}

function drawTrexSkeleton(g) {
    // tail
    along(g, [28, -40], [70, -30], [112, -8], 12, 6, 1.5);
    // hind legs
    bone(g, 22, -36, 8, -8, 8); bone(g, 8, -8, 20, 20, 6);
    knob(g, 8, -8, 6); knob(g, 22, -36, 8);
    for (let i = -1; i <= 1; i++) bone(g, 20, 22, 30 + i * 2, 26 + i * 4, 3);
    bone(g, 12, -34, -2, -6, 6); bone(g, -2, -6, 6, 20, 5);
    for (let i = -1; i <= 1; i++) bone(g, 6, 22, 16 + i * 2, 26 + i * 4, 3);
    // spine & neck
    along(g, [-10, -66], [-4, -50], [24, -46], 8, 4, 6);
    along(g, [-38, -66], [-24, -74], [-10, -66], 5, 4, 4.5);
    // ribs
    for (let i = 0; i < 6; i++) {
        const sx = -8 + i * 5;
        g.strokeStyle = OUT; g.lineWidth = 5;
        g.beginPath(); g.moveTo(sx, -52); g.quadraticCurveTo(sx - 8, -36, sx + 2 - i * 0.8, -22 + i); g.stroke();
        g.strokeStyle = BONE; g.lineWidth = 2.5;
        g.beginPath(); g.moveTo(sx, -52); g.quadraticCurveTo(sx - 8, -36, sx + 2 - i * 0.8, -22 + i); g.stroke();
    }
    // tiny arms
    bone(g, -12, -50, -22, -38, 3); bone(g, -22, -38, -30, -34, 3);
    bone(g, -30, -34, -35, -30, 1.5); bone(g, -30, -34, -34, -35, 1.5);
    // skull
    g.fillStyle = BONE; g.strokeStyle = OUT; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(-28, -84); g.quadraticCurveTo(-45, -96, -70, -82);
    g.lineTo(-90, -74); g.lineTo(-88, -66); g.lineTo(-54, -62);
    g.quadraticCurveTo(-32, -58, -26, -70);
    g.closePath(); g.fill(); g.stroke();
    // lower jaw
    g.beginPath();
    g.moveTo(-88, -64); g.lineTo(-55, -60); g.lineTo(-40, -58); g.lineTo(-44, -50); g.lineTo(-84, -56);
    g.closePath(); g.fill(); g.stroke();
    // teeth
    g.fillStyle = '#f7f0dc'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
        const tx = -84 + i * 8;
        g.beginPath(); g.moveTo(tx, -68); g.lineTo(tx + 3, -61); g.lineTo(tx + 6, -68); g.fill(); g.stroke();
    }
    for (let i = 0; i < 5; i++) {
        const tx = -80 + i * 8;
        g.beginPath(); g.moveTo(tx, -62); g.lineTo(tx + 3, -67); g.lineTo(tx + 6, -62); g.fill(); g.stroke();
    }
    // eye socket + nostril
    g.fillStyle = OUT;
    g.beginPath(); g.ellipse(-48, -76, 7, 5, 0.2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(-82, -74, 2.5, 1.8, 0, 0, Math.PI * 2); g.fill();
}

function makeFossilSprite(f) {
    const W = 340, H = 250, ox = 170, oy = 140;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d');
    const trex = f.type === 'trex';
    const bw = trex ? 150 : 85;

    g.save(); g.translate(ox, oy);
    // dark carved cavity around the bones
    const cav = g.createRadialGradient(0, -25, 10, 0, -25, bw);
    cav.addColorStop(0, 'rgba(10,6,3,0.7)'); cav.addColorStop(0.75, 'rgba(10,6,3,0.35)'); cav.addColorStop(1, 'rgba(10,6,3,0)');
    g.fillStyle = cav; g.beginPath(); g.ellipse(0, -25, bw, trex ? 85 : 95, 0, 0, Math.PI * 2); g.fill();
    g.rotate(f.rot); g.scale(f.flip * f.scale, f.scale);
    (trex ? drawTrexSkeleton : drawHumanSkeleton)(g);
    g.restore();

    // aged, dusty bones
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = 'rgba(75,52,35,0.32)'; g.fillRect(0, 0, W, H);

    // rock swallows the lower part + random patches (bones are INSIDE the wall)
    const cutY = trex ? rnd(-22, -6) : rnd(-18, 12);
    const lumps = [];
    for (let x = -bw - 20; x <= bw + 20; x += 20)
        lumps.push({ x, y: cutY + rnd(-12, 10), rx: rnd(20, 32), ry: rnd(14, 24) });
    const extra = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < extra; i++)
        lumps.push({ x: rnd(-bw * 0.7, bw * 0.7), y: rnd(cutY - 70, cutY - 15), rx: rnd(10, 20), ry: rnd(8, 15) });

    g.globalCompositeOperation = 'destination-out';
    g.fillStyle = '#000';
    lumps.forEach(l => { g.beginPath(); g.ellipse(ox + l.x, oy + l.y, l.rx, l.ry, 0, 0, Math.PI * 2); g.fill(); });
    g.fillRect(0, oy + cutY + 10, W, H);

    // rock lip: dark edge + light edge so bones look tucked behind rock
    g.globalCompositeOperation = 'source-over';
    lumps.forEach(l => {
        g.strokeStyle = 'rgba(8,4,2,0.55)'; g.lineWidth = 2.5;
        g.beginPath(); g.ellipse(ox + l.x, oy + l.y, l.rx, l.ry, 0, 0, Math.PI * 2); g.stroke();
        g.strokeStyle = 'rgba(200,170,130,0.25)'; g.lineWidth = 1.5;
        g.beginPath(); g.ellipse(ox + l.x - 1, oy + l.y - 1, l.rx - 2, l.ry - 2, 0, Math.PI, Math.PI * 1.55); g.stroke();
    });
    f.sprite = c; f.ox = ox; f.oy = oy;
}

function drawFossil(f) { ctx.drawImage(f.sprite, f.x - f.ox, f.y - f.oy); }

// ============ SCENE GENERATOR ============
// crack in the rock + rubble around a crystal cluster (crystals burst out of the wall)
function buildFissure(sc) {
    const hole = [], n = 10;
    for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 / n) * i;
        const k = rnd(0.75, 1.25);
        hole.push([Math.cos(a) * 17 * sc * k, Math.sin(a) * 8 * sc * k - 2]);
    }
    const wedges = [];
    const wc = 6 + Math.floor(Math.random() * 3);
    for (let i = 0; i < wc; i++) {
        const a = (Math.PI * 2 / wc) * i + rnd(-0.35, 0.35);
        const pts = [[0, 0]];
        let px = 0, py = 0;
        const len = rnd(24, 60) * sc, steps = 4;
        for (let k = 1; k <= steps; k++) {
            const aa = a + rnd(-0.4, 0.4);
            px += Math.cos(aa) * len / steps; py += Math.sin(aa) * len / steps * 0.9;
            pts.push([px, py]);
        }
        wedges.push({ pts, w: rnd(2.5, 5) * sc });
    }
    const crumbs = [];
    for (let i = 0; i < 22; i++) crumbs.push({ x: rnd(-46, 46) * sc, y: rnd(-14, 34) * sc, r: rnd(1, 3.8) * sc, l: rnd(22, 48) });
    const lip = [];
    for (let i = 0; i < 5; i++) lip.push({ x: rnd(-15, 15) * sc, y: rnd(-1, 6) * sc, r: rnd(5, 10) * sc, l: rnd(30, 46), seed: Math.random() });
    return { hole, wedges, crumbs, lip };
}

function generateCaveScene() {
    const scene = { walls: [], stalactites: [], stalagmites: [], wallRocks: [], goldVeins: [], stones: [], torches: [], fossils: [], seed: Math.random() * 10000 };
    scene.bg = makeBackground();


    const stalCount = 0;
    for (let i = 0; i < stalCount; i++)
        scene.stalactites.push({ x: rnd(80, canvas.width - 80), y: rnd(80, 120), length: rnd(25, 80), width: rnd(8, 22), sway: Math.random() * 6.28 });

    const stalagCount = 0;
    for (let i = 0; i < stalagCount; i++)
        scene.stalagmites.push({ x: rnd(70, canvas.width - 70), y: canvas.height - rnd(55, 80), height: rnd(20, 65), width: rnd(10, 26) });

    for (let i = 0; i < 40; i++)
        scene.wallRocks.push({ x: rnd(0, canvas.width), y: rnd(10, FLOOR_Y - 10), w: rnd(8, 26), h: rnd(6, 16), rotation: Math.random() * 3.14, shade: rnd(0.1, 0.35) });

    for (let i = 0; i < 0; i++) // wall gold veins removed
        scene.goldVeins.push({ x: rnd(40, canvas.width - 40), y: rnd(30, FLOOR_Y - 30), size: rnd(6, 14), sparkle: Math.random() * 6.28, glow: rnd(0.5, 1) });

    // Fossils buried in the back wall: 1 T-Rex + 1-2 humans
    const slots = [rnd(190, 260), rnd(430, 480), rnd(680, 730)].sort(() => Math.random() - 0.5);
    const fossilCount = 0; // skeletons removed
    for (let i = 0; i < fossilCount; i++) {
        const isTrex = i === 0;
        const f = {
            type: isTrex ? 'trex' : 'human',
            x: slots[i], y: isTrex ? rnd(200, 220) : rnd(170, 190),
            scale: isTrex ? rnd(1.0, 1.25) : rnd(0.95, 1.15),
            flip: Math.random() > 0.5 ? 1 : -1,
            rot: rnd(-0.08, 0.08)
        };
        makeFossilSprite(f);
        scene.fossils.push(f);
    }

    // Stones
    const stoneCount = 4 + Math.floor(Math.random() * 5);
    const positions = [];
    for (let i = 0; i < stoneCount; i++) {
        let x, y, valid = false, attempts = 0;
        while (!valid && attempts < 50) {
            x = rnd(150, canvas.width - 150);
            y = rnd(FLOOR_Y + 50, canvas.height - 60);
            valid = positions.every(p => Math.hypot(x - p.x, y - p.y) >= 100);
            attempts++;
        }
        positions.push({ x, y });
        scene.stones.push(makeStone(x, y));
    }

    // blue crystal clusters: on the wall and near the wall base on the floor
    scene.crystals = [];
    const mkCluster = (x, y, sc, up) => {
        const spikes = [], n = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) spikes.push({ a: (up ? -Math.PI / 2 : rnd(-2.2, -0.9)) + (i - (n - 1) / 2) * 0.35 + rnd(-0.1, 0.1), l: rnd(18, 40) * sc, w: rnd(5, 9) * sc });
        return Object.assign({ x, y, phase: Math.random() * 6.28, spikes }, buildFissure(sc));
    };
    // wall-only crystals: 3-5 clusters, kept well apart so spikes never visually touch
    const crystalCount = 3 + Math.floor(Math.random() * 3); // 3, 4, or 5
    const crystalXs = [];
    const MIN_GAP = rnd(110, 150); // center-to-center gap; large enough that spikes (~35-50px reach each side) never overlap
    for (let i = 0; i < crystalCount; i++) {
        let x, attempts = 0, valid = false;
        while (!valid && attempts < 200) {
            x = rnd(50, canvas.width - 50);
            valid = crystalXs.every(px => Math.abs(x - px) >= MIN_GAP);
            attempts++;
        }
        crystalXs.push(x);
        scene.crystals.push(mkCluster(x, rnd(50, FLOOR_Y - 25), rnd(0.8, 1.3), false));
    }

    // Exactly 2 fixed torches: top-left and top-right, near the very top of the wall
    scene.torches.push({ x: 90, y: 40, flicker: 0, intensity: 1 });
    scene.torches.push({ x: canvas.width - 90, y: 40, flicker: 2, intensity: 1 });
    return scene;
}

function makeStone(x, y) {
    const radius = rnd(38, 56);
    const n = 13;
    const verts = [];
    for (let i = 0; i < n; i++) {
        const a = (Math.PI * 2 / n) * i + rnd(-0.12, 0.12);
        const r = radius * rnd(0.78, 1.05);
        verts.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.88, a });
    }
    // inner ridge points (for facets)
    const inner = verts.map(v => ({ x: v.x * rnd(0.38, 0.55) + rnd(-4, 4), y: v.y * rnd(0.38, 0.55) + rnd(-4, 4) - 3 }));
    const speckles = [];
    for (let i = 0; i < 28; i++) {
        const a = Math.random() * 6.28, r = Math.random() * radius * 0.8;
        speckles.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.85, s: rnd(0.8, 2.6), l: Math.random() > 0.5 });
    }
    const flecks = [];
    for (let i = 0; i < 9; i++) {
        const a = Math.random() * 6.28, r = Math.random() * radius * 0.65;
        flecks.push({ x: Math.cos(a) * r, y: Math.sin(a) * r * 0.8, s: rnd(2, 5), rot: Math.random() * 3 });
    }
    const cracks = [];
    const cc = 6 + Math.floor(Math.random() * 4);
    for (let j = 0; j < cc; j++) {
        const ang = (Math.PI * 2 / cc) * j + rnd(-0.3, 0.3);
        const len = radius * rnd(0.5, 0.85);
        const pts = [{ x: 0, y: 0 }];
        const segs = 5;
        for (let k = 1; k <= segs; k++) {
            const t = k / segs;
            const a = ang + rnd(-0.35, 0.35);
            pts.push({ x: Math.cos(a) * len * t, y: Math.sin(a) * len * t * 0.9 });
        }
        cracks.push({ pts, grow: 0 });
    }
    // real mining logic: hits needed grow with stone size (mass ~ radius^2)
    const maxHp = Math.max(4, Math.round(radius * radius / 250 + rnd(-0.6, 0.6)));
    return { x, y, radius, maxHp, hp: maxHp, shake: 0, verts, inner, speckles, flecks, cracks, glow: 0, mined: false, goldRich: Math.random() > 0.3, hue: rnd(22, 34),
        blueVeins: Array.from({ length: 3 }, () => { let x = rnd(-0.6, 0.4) * radius, y = rnd(-0.7, 0.05) * radius; const p = [[x, y]]; for (let k = 0; k < 4; k++) { x += rnd(-9, 12); y += rnd(-6, 8); p.push([x, y]); } return p; }),
        bumps: Array.from({ length: 9 }, () => rnd(-5, 5)),
        pebbles: Array.from({ length: 8 }, () => ({ x: rnd(-1.2, 1.2), y: rnd(0.45, 0.9), s: rnd(2, 6) })) };
}

// ============ MINER ============
const miner = {
    x: canvas.width / 2, y: canvas.height / 2 + 100,
    facing: 1, state: 'find_stone',
    swingPhase: 0, swingSpeed: 0.26,
    walkCycle: 0, walkSpeed: 4.5,
    blinkTimer: 0, blink: false, breathe: 0,
    currentStone: null, exitDirection: 1, hasHit: false
};

// ============ LOOT BAG + REWARD ============
const bag = { x: miner.x - 36, y: miner.y + 34, pop: 0, count: 0, sparks: 0 };
const loot = [];
const reward = { active: false, t: 0, dir: 1 };
const BTN = { x: 350, y: 425, w: 200, h: 56 };

function spawnLoot(x, y, n, small) {
    for (let i = 0; i < n; i++) {
        if (small) loot.push({ small: true, x0: x + rnd(-6, 6), y0: y + rnd(-6, 6), t: -i * 0.08, dur: 24 + Math.random() * 10, arc: rnd(25, 50) });
        else loot.push({ x0: x + rnd(-14, 14), y0: y + rnd(-8, 8), t: -i * 0.12, dur: 42 + Math.random() * 10, arc: rnd(50, 90) });
    }
}

function updateBag() {
    const m = miner;
    const tx = m.x - m.facing * 36, ty = m.y + 34;
    bag.x += (tx - bag.x) * 0.12;
    bag.y += (ty - bag.y) * 0.12;

    // never let the bag's drawn position land on top of an un-mined stone
    for (const s of caveScene.stones) {
        if (s.mined) continue;
        const dx = bag.x - s.x, dy = bag.y - s.y, dist = Math.hypot(dx, dy);
        const minDist = s.radius + 22;
        if (dist < minDist) {
            if (dist < 0.001) { bag.x = s.x + minDist; bag.y = s.y; }
            else { bag.x = s.x + (dx / dist) * minDist; bag.y = s.y + (dy / dist) * minDist; }
        }
    }

    bag.pop *= 0.88;

    for (let i = loot.length - 1; i >= 0; i--) {
        const l = loot[i];
        l.t += 1 / l.dur;
        if (l.t >= 1) {
            loot.splice(i, 1);
            if (l.small) { bag.sparks++; bag.pop = Math.max(bag.pop, 0.45); }
            else { bag.count++; bag.pop = 1; createSparks(bag.x, bag.y - 30, 6); }
        }
    }

    if (reward.active) {
        if (reward.dir === 1) {
            reward.t = Math.min(1, reward.t + 0.025);
            // This in-canvas "reward" screen is purely decorative flourish — real
            // claiming happens through the app's own Claim button outside the
            // canvas. Auto-continue after a short hold so the background loop
            // never sits stuck waiting for a canvas click nobody expects to make.
            if (reward.t >= 1) {
                reward.hold = (reward.hold || 0) + 1;
                if (reward.hold > 70) reward.dir = -1;
            }
        } else {
            reward.t -= 0.05;
            if (reward.t <= 0) {
                reward.t = 0; reward.active = false; reward.hold = 0;
                bag.count = 0; bag.sparks = 0;
                m.state = 'exit';
                m.exitDirection = m.x < canvas.width / 2 ? -1 : 1;
            }
        }
    }
}

function drawGem(x, y, r, a) {
    ctx.save(); ctx.translate(x, y); ctx.globalAlpha = a === undefined ? 1 : a;
    const gg = ctx.createRadialGradient(0, 0, 1, 0, 0, r * 3);
    gg.addColorStop(0, 'rgba(90,190,255,0.5)'); gg.addColorStop(1, 'rgba(90,190,255,0)');
    ctx.fillStyle = gg; ctx.fillRect(-r * 3, -r * 3, r * 6, r * 6);
    ctx.fillStyle = '#3ab4ff';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#b8e6ff';
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, 0); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#0d4f8f'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -r); ctx.lineTo(r * 0.8, 0); ctx.lineTo(0, r); ctx.lineTo(-r * 0.8, 0); ctx.closePath(); ctx.stroke();
    ctx.restore();
}

// themed bag (changes with the miner skin); origin = bottom center
function drawBagShape(x, y, sc, fill, pop) {
    const b = SKIN_GEAR[currentSkin].bag;
    ctx.save();
    ctx.translate(x, y);
    const p = 1 + (pop || 0) * 0.18;
    ctx.scale(sc * p, sc * (1 + fill * 0.12) * (2 - p));
    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 1, 19, 5, 0, 0, Math.PI * 2); ctx.fill();
    // gems peeking out of the bag
    const peek = Math.min(6, Math.round(fill * 6));
    for (let i = 0; i < peek; i++) drawGem(-10 + i * 4 + (i % 2) * 1.5, -40 - (i % 3) * 2, 3.2);
    drawBagBody(b);
    ctx.restore();
}

function drawBag() {
    if (reward.active) return;
    drawBagShape(bag.x, bag.y, 1, Math.min(1, (bag.count + bag.sparks / 6) / 8), bag.pop);
}

function drawLoot() {
    loot.forEach(l => {
        if (l.t < 0) return;
        const e = l.t * l.t * (3 - 2 * l.t);
        const x = l.x0 + (bag.x - l.x0) * e;
        const y = l.y0 + ((bag.y - 30) - l.y0) * e - Math.sin(Math.PI * l.t) * l.arc;
        if (l.small) {
            const a = 1 - Math.max(0, l.t - 0.85) * 4;
            const gg = ctx.createRadialGradient(x, y, 0, x, y, 9);
            gg.addColorStop(0, `rgba(120,205,255,${0.8 * a})`); gg.addColorStop(1, 'rgba(60,170,255,0)');
            ctx.fillStyle = gg; ctx.fillRect(x - 9, y - 9, 18, 18);
            ctx.fillStyle = `rgba(220,245,255,${a})`;
            ctx.beginPath(); ctx.arc(x, y, 2.2, 0, Math.PI * 2); ctx.fill();
        } else drawGem(x, y, 5 + (1 - l.t) * 2, 1 - Math.max(0, l.t - 0.85) * 4);
    });
}

function drawRewardOverlay() {
    if (!reward.active) return;
    const e = reward.t * reward.t * (3 - 2 * reward.t);
    const now = performance.now() / 1000;
    ctx.save();
    ctx.fillStyle = `rgba(0,5,15,${0.72 * e})`; ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cx = bag.x + (450 - bag.x) * e, cy = bag.y + (345 - bag.y) * e, sc = 1 + 4.3 * e;

    // rotating light rays
    ctx.save(); ctx.translate(cx, cy - 110 * e); ctx.rotate(now * 0.5);
    for (let i = 0; i < 14; i++) {
        ctx.rotate(Math.PI * 2 / 14);
        ctx.fillStyle = `rgba(80,180,255,${0.16 * e})`;
        ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(-26, -380); ctx.lineTo(26, -380); ctx.closePath(); ctx.fill();
    }
    ctx.restore();
    const halo = ctx.createRadialGradient(cx, cy - 110 * e, 10, cx, cy - 110 * e, 240 * e + 1);
    halo.addColorStop(0, `rgba(120,200,255,${0.45 * e})`); halo.addColorStop(1, 'rgba(120,200,255,0)');
    ctx.fillStyle = halo; ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawBagShape(cx, cy, sc, Math.min(1, Math.max(bag.count + bag.sparks / 6, 1) / 8), 0.3 * Math.sin(now * 3) * e);

    // floating gems
    for (let i = 0; i < 10; i++) {
        const a = now * 0.8 + i * 0.63;
        drawGem(450 + Math.cos(a * 1.3 + i) * (170 + i * 8), 220 + Math.sin(a + i) * 110, 5 + (i % 3) * 2, 0.8 * e);
    }

    ctx.restore();
}

function canvasPos(ev) {
    const r = canvas.getBoundingClientRect();
    return { x: (ev.clientX - r.left) * canvas.width / r.width, y: (ev.clientY - r.top) * canvas.height / r.height };
}
function overBtn(p) { return p.x >= BTN.x && p.x <= BTN.x + BTN.w && p.y >= BTN.y && p.y <= BTN.y + BTN.h; }

// ============ PARTICLES (no smoke/dust) ============
const particles = [];

function createSparks(x, y, count = 12) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * 6.28, sp = 2 + Math.random() * 5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 2, life: 1, decay: 0.03 + Math.random() * 0.03,
            color: Math.random() > 0.4 ? '#3ab4ff' : '#1e78ff', size: 1.5 + Math.random() * 2.5, gravity: 0.2, type: 'spark' });
    }
}
function createRockChips(x, y, count = 8, floorY = y + 40) {
    for (let i = 0; i < count; i++) {
        const a = Math.random() * 6.28, sp = 2 + Math.random() * 3.5;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 3, life: 1, decay: 0.012 + Math.random() * 0.012,
            color: ['#8b7355', '#6b5b4a', '#5a4a3a', '#9a8468'][Math.floor(Math.random() * 4)], size: 2 + Math.random() * 4, gravity: 0.3,
            type: 'chip', floorY: floorY + rnd(-8, 12), rotation: Math.random() * 3, rotSpeed: (Math.random() - 0.5) * 0.3 });
    }
}
function createChunks(x, y, R, floorY) {
    for (let i = 0; i < 9; i++) {
        const a = Math.random() * 6.28, sp = 1.5 + Math.random() * 3;
        particles.push({ x: x + Math.cos(a) * R * 0.3, y: y + Math.sin(a) * R * 0.2, vx: Math.cos(a) * sp, vy: -2 - Math.random() * 3.5,
            life: 1, decay: 0.006 + Math.random() * 0.004, color: ['#6b5b4a', '#7a6650', '#5a4a3a'][i % 3],
            size: R * (0.16 + Math.random() * 0.16), gravity: 0.35, type: 'chip', floorY: floorY + rnd(-6, 16),
            rotation: Math.random() * 3, rotSpeed: (Math.random() - 0.5) * 0.3 });
    }
}

function createGoldBurst(x, y) {
    for (let i = 0; i < 20; i++) {
        const a = Math.random() * 6.28, sp = 3 + Math.random() * 6;
        particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 4, life: 1, decay: 0.016 + Math.random() * 0.012,
            color: '#3ab4ff', size: 2.5 + Math.random() * 4, gravity: 0.14, type: 'gold', shine: Math.random() * 6.28 });
    }
}

let caveScene = generateCaveScene();

// Fixed mining rule for every stone: miner stands on the floor, beside the stone,
// at a constant gap from its edge (never on top of it).
const STAND_GAP = 38;
function chooseStand(stone) {
    const cands = [];
    for (const dir of [-1, 1]) {
        const x = stone.x + dir * (stone.radius + STAND_GAP);
        const y = stone.y + stone.radius * 0.3 - 33; // feet on the same ground line as the stone
        if (x < 40 || x > canvas.width - 40) continue;
        let clear = Infinity;
        for (const o of caveScene.stones)
            if (o !== stone && !o.mined) clear = Math.min(clear, Math.hypot(x - o.x, y - o.y) - o.radius);
        cands.push({ x, y, dir, clear, d: Math.abs(x - miner.x) });
    }
    if (!cands.length) return { x: stone.x - stone.radius - STAND_GAP, y: stone.y + stone.radius * 0.3 - 33 };
    const ok = cands.filter(c => c.clear >= 25);
    const pool = ok.length ? ok : cands;
    pool.sort((a, b) => ok.length ? a.d - b.d : b.clear - a.clear);
    return pool[0];
}

function findNearestStone() {
    let nearest = null, min = Infinity;
    for (const s of caveScene.stones) {
        if (!s.mined) {
            const d = Math.hypot(s.x - miner.x, s.y - miner.y);
            if (d < min) { min = d; nearest = s; }
        }
    }
    return nearest;
}

// ============ DRAW ============
function drawCaveBackground() {
    ctx.drawImage(caveScene.bg, 0, 0);
}

function drawCaveWalls() {
    caveScene.walls.forEach(wall => {
        ctx.fillStyle = '#231b15';
        ctx.beginPath();
        if (wall.type === 'top') { ctx.moveTo(0, 0); wall.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(canvas.width, 0); }
        else if (wall.type === 'bottom') { ctx.moveTo(0, canvas.height); wall.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(canvas.width, canvas.height); }
        else if (wall.type === 'left') { ctx.moveTo(0, 0); wall.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(0, canvas.height); }
        else { ctx.moveTo(canvas.width, 0); wall.points.forEach(p => ctx.lineTo(p.x, p.y)); ctx.lineTo(canvas.width, canvas.height); }
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(140,115,85,0.35)'; ctx.lineWidth = 2;
        ctx.beginPath();
        wall.points.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
        ctx.stroke();
    });
    caveScene.wallRocks.forEach(r => {
        ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(r.rotation);
        ctx.fillStyle = `rgba(75, 62, 50, ${r.shade})`;
        ctx.beginPath(); ctx.ellipse(0, 0, r.w, r.h, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    });
}

function drawFossils() { caveScene.fossils.forEach(drawFossil); }

function drawStalactites() {
    caveScene.stalactites.forEach(s => {
        s.sway += 0.008;
        const sx = Math.sin(s.sway) * 1.5;
        ctx.fillStyle = '#3a2f26';
        ctx.beginPath(); ctx.moveTo(s.x - s.width, s.y); ctx.lineTo(s.x + s.width, s.y); ctx.lineTo(s.x + sx, s.y + s.length); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(150, 125, 95, 0.2)';
        ctx.beginPath(); ctx.moveTo(s.x - s.width * 0.3, s.y); ctx.lineTo(s.x + s.width * 0.1, s.y); ctx.lineTo(s.x + sx * 0.5, s.y + s.length * 0.7); ctx.closePath(); ctx.fill();
    });
}
function drawStalagmites() {
    caveScene.stalagmites.forEach(s => {
        ctx.fillStyle = '#34291f';
        ctx.beginPath(); ctx.moveTo(s.x - s.width, s.y); ctx.lineTo(s.x + s.width, s.y); ctx.lineTo(s.x, s.y - s.height); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(140, 115, 88, 0.2)';
        ctx.beginPath(); ctx.moveTo(s.x - s.width * 0.2, s.y); ctx.lineTo(s.x + s.width * 0.3, s.y); ctx.lineTo(s.x, s.y - s.height * 0.6); ctx.closePath(); ctx.fill();
    });
}
function drawCrystals() {
    caveScene.crystals.forEach(c => {
        if (!resting) c.phase += 0.03;
        const pulse = 0.65 + Math.sin(c.phase) * 0.35;
        ctx.save(); ctx.translate(c.x, c.y);

        // 1. fractures spreading out of the opening (tapered wedges)
        ctx.fillStyle = 'rgba(6,3,1,0.75)';
        c.wedges.forEach(wd => {
            const p = wd.pts;
            ctx.beginPath(); ctx.moveTo(p[0][0] - wd.w, p[0][1]);
            for (let i = 1; i < p.length; i++) ctx.lineTo(p[i][0] - wd.w * (1 - i / p.length), p[i][1]);
            for (let i = p.length - 1; i >= 1; i--) ctx.lineTo(p[i][0] + wd.w * (1 - i / p.length), p[i][1]);
            ctx.lineTo(p[0][0] + wd.w, p[0][1]); ctx.closePath(); ctx.fill();
        });
        // light chipped edge above the opening
        ctx.fillStyle = 'rgba(170,140,105,0.28)';
        ctx.beginPath(); c.hole.forEach((q, i) => i ? ctx.lineTo(q[0] * 1.18 - 1.5, q[1] * 1.18 - 2.5) : ctx.moveTo(q[0] * 1.18 - 1.5, q[1] * 1.18 - 2.5)); ctx.closePath(); ctx.fill();
        // 2. dark opening
        const og = ctx.createRadialGradient(0, 0, 1, 0, 0, 22);
        og.addColorStop(0, '#020101'); og.addColorStop(1, '#1a120c');
        ctx.fillStyle = og;
        ctx.beginPath(); c.hole.forEach((q, i) => i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.closePath(); ctx.fill();

        // 3. blue glow spilling from inside
        const gg = ctx.createRadialGradient(0, -8, 2, 0, -8, 75);
        gg.addColorStop(0, `rgba(70,170,255,${0.34 * pulse})`); gg.addColorStop(1, 'rgba(70,170,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(-75, -85, 150, 150);

        // 4. crystals growing out of the opening
        c.spikes.forEach(sp => {
            ctx.save(); ctx.rotate(sp.a + Math.PI / 2);
            const cg = ctx.createLinearGradient(-sp.w, 0, sp.w, -sp.l);
            cg.addColorStop(0, '#1656c9'); cg.addColorStop(1, '#8fdcff');
            ctx.fillStyle = cg; ctx.strokeStyle = '#08284f'; ctx.lineWidth = 1.2; ctx.lineJoin = 'round';
            ctx.beginPath(); ctx.moveTo(-sp.w, 0); ctx.lineTo(-sp.w * 0.7, -sp.l * 0.75); ctx.lineTo(0, -sp.l); ctx.lineTo(sp.w * 0.7, -sp.l * 0.75); ctx.lineTo(sp.w, 0); ctx.closePath();
            ctx.fill(); ctx.stroke();
            ctx.fillStyle = `rgba(210,240,255,${0.35 + 0.3 * pulse})`;
            ctx.beginPath(); ctx.moveTo(-sp.w * 0.4, -2); ctx.lineTo(-sp.w * 0.3, -sp.l * 0.7); ctx.lineTo(0, -sp.l * 0.95); ctx.lineTo(-sp.w * 0.05, -2); ctx.closePath(); ctx.fill();
            ctx.restore();
        });

        // 5. broken rock in front hides the crystal bases (they come out of the wall)
        c.lip.forEach(l => {
            const rg = ctx.createRadialGradient(l.x - l.r * 0.3, l.y - l.r * 0.4, 1, l.x, l.y, l.r * 1.2);
            rg.addColorStop(0, `hsl(28,16%,${l.l + 12}%)`); rg.addColorStop(1, `hsl(26,16%,${l.l - 10}%)`);
            ctx.fillStyle = rg;
            ctx.beginPath();
            for (let i = 0; i < 7; i++) {
                const an = (Math.PI * 2 / 7) * i, rr = l.r * (0.7 + ((i * 37 + l.seed * 100) % 10) / 22);
                const px = l.x + Math.cos(an) * rr, py = l.y + Math.sin(an) * rr * 0.75;
                i ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
            }
            ctx.closePath(); ctx.fill();
        });

        // 6. rock crumbs / powder scattered around and fallen below
        c.crumbs.forEach(k => {
            ctx.fillStyle = 'rgba(0,0,0,0.3)';
            ctx.beginPath(); ctx.ellipse(k.x + 1, k.y + 1.5, k.r, k.r * 0.6, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = `hsl(28,14%,${k.l}%)`;
            ctx.beginPath(); ctx.ellipse(k.x, k.y, k.r, k.r * 0.7, 0.4, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
    });
}

function drawGoldVeins() {
    caveScene.goldVeins.forEach(g => {
        g.sparkle += 0.025;
        const shine = 0.4 + Math.sin(g.sparkle) * 0.25;
        const gg = ctx.createRadialGradient(g.x, g.y, 0, g.x, g.y, g.size * 3);
        gg.addColorStop(0, `rgba(60,170,255,${shine * 0.3 * g.glow})`);
        gg.addColorStop(1, 'rgba(60,170,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(g.x - g.size * 3, g.y - g.size * 3, g.size * 6, g.size * 6);
        ctx.fillStyle = `rgba(60,170,255,${shine * 0.8})`;
        ctx.beginPath(); ctx.ellipse(g.x, g.y, g.size, g.size * 0.5, 0.3, 0, Math.PI * 2); ctx.fill();
    });
}

function drawTorches() {
    caveScene.torches.forEach(t => {
        if (!resting) t.flicker += 0.12 + Math.random() * 0.08;
        const flick = resting ? 0.25 : (Math.sin(t.flicker) * 0.35 + Math.sin(t.flicker * 2.1) * 0.15 + Math.random() * 0.1);
        ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(t.x, t.y - 8); ctx.lineTo(t.x, t.y + 20); ctx.stroke();
        ctx.fillStyle = '#5a3a20'; ctx.fillRect(t.x - 5, t.y - 12, 10, 10);
        const fh = 22 + flick * 8, fw = 9 + flick * 3;
        const fg = ctx.createRadialGradient(t.x, t.y - 16, 2, t.x, t.y - 16, fh);
        fg.addColorStop(0, `rgba(255,200,100,${0.7 + flick * 0.15})`);
        fg.addColorStop(0.4, `rgba(255,120,30,${0.5 + flick * 0.1})`);
        fg.addColorStop(0.8, `rgba(200,60,10,${0.2 + flick * 0.08})`);
        fg.addColorStop(1, 'rgba(100,20,0,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.ellipse(t.x, t.y - 16, fw, fh, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = `rgba(255,255,220,${0.6 + flick * 0.15})`;
        ctx.beginPath(); ctx.ellipse(t.x, t.y - 14, fw * 0.35, fh * 0.45, 0, 0, Math.PI * 2); ctx.fill();
        const gs = 170 * t.intensity;
        const gg = ctx.createRadialGradient(t.x, t.y, 10, t.x, t.y, gs);
        gg.addColorStop(0, `rgba(255,160,60,${0.2 + flick * 0.05})`);
        gg.addColorStop(0.5, `rgba(255,120,40,${0.09 + flick * 0.02})`);
        gg.addColorStop(1, 'rgba(255,100,30,0)');
        ctx.fillStyle = gg; ctx.fillRect(t.x - gs, t.y - gs, gs * 2, gs * 2);
    });
}

function traceShape(verts) {
    ctx.beginPath();
    verts.forEach((v, i) => i ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y));
    ctx.closePath();
}

function drawStone(stone) {
    if (stone.mined) {
        // leftover rubble pit
        ctx.save(); ctx.translate(stone.x, stone.y);
        ctx.fillStyle = 'rgba(15,9,4,0.4)';
        ctx.beginPath(); ctx.ellipse(0, stone.radius * 0.3, stone.radius * 0.9, stone.radius * 0.2, 0, 0, Math.PI * 2); ctx.fill();
        stone.pebbles.forEach(p => {
            ctx.fillStyle = '#6a5540';
            ctx.beginPath(); ctx.ellipse(p.x * stone.radius * 0.8, p.y * stone.radius * 0.7, p.s, p.s * 0.6, 0, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
        return;
    }
    if (stone.shake > 0.1) stone.shake *= 0.8; else stone.shake = 0;
    const sx = (Math.random() - 0.5) * stone.shake, sy = (Math.random() - 0.5) * stone.shake;
    const R = stone.radius, V = stone.verts, I = stone.inner, n = V.length;
    const damage = 1 - stone.hp / stone.maxHp;

    ctx.save();
    ctx.translate(stone.x + sx, stone.y + sy);
    // ground line: everything below is inside the floor (hidden), no dirt mound on top
    const GL = R * 0.3;
    ctx.beginPath(); ctx.rect(-R * 1.6, -R * 1.6, R * 3.2, R * 1.6 + GL); ctx.clip();


    // base silhouette
    ctx.fillStyle = `hsl(${stone.hue}, 22%, 22%)`;
    traceShape(V); ctx.fill();

    // faceted planes (light from upper-left)
    const lightAngle = -2.3;
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mid = (V[i].a + (V[j].a < V[i].a ? V[j].a + Math.PI * 2 : V[j].a)) / 2;
        const lit = Math.cos(mid - lightAngle); // -1..1
        const L = 27 + lit * 14;
        // outer facet
        ctx.fillStyle = `hsl(${stone.hue}, ${18 + lit * 4}%, ${L}%)`;
        ctx.beginPath(); ctx.moveTo(V[i].x, V[i].y); ctx.lineTo(V[j].x, V[j].y); ctx.lineTo(I[j].x, I[j].y); ctx.lineTo(I[i].x, I[i].y); ctx.closePath(); ctx.fill();
        // edge line
        ctx.strokeStyle = `rgba(20,12,6,0.55)`; ctx.lineWidth = 1;
        ctx.stroke();
    }
    // top plateau
    const tg = ctx.createLinearGradient(-R * 0.5, -R * 0.6, R * 0.4, R * 0.4);
    tg.addColorStop(0, `hsl(${stone.hue}, 20%, 48%)`);
    tg.addColorStop(1, `hsl(${stone.hue}, 18%, 30%)`);
    ctx.fillStyle = tg; traceShape(I); ctx.fill();
    ctx.strokeStyle = 'rgba(15,9,4,0.6)'; ctx.lineWidth = 1.2; ctx.stroke();
    // ridge lines from inner to outer
    ctx.strokeStyle = 'rgba(15,9,4,0.4)'; ctx.lineWidth = 1;
    for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(I[i].x, I[i].y); ctx.lineTo(V[i].x, V[i].y); ctx.stroke(); }

    // speckles (mineral grains)
    stone.speckles.forEach(s => {
        ctx.fillStyle = s.l ? 'rgba(200,180,150,0.35)' : 'rgba(10,6,2,0.4)';
        ctx.beginPath(); ctx.arc(s.x, s.y, s.s, 0, Math.PI * 2); ctx.fill();
    });

    // blue mineral veins in the rock
    stone.blueVeins.forEach(p => {
        ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        ctx.shadowColor = 'rgba(70,170,255,0.9)'; ctx.shadowBlur = 8;
        ctx.strokeStyle = 'rgba(40,130,235,0.9)'; ctx.lineWidth = 3;
        ctx.beginPath(); p.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
        ctx.shadowBlur = 0; ctx.strokeStyle = 'rgba(190,230,255,0.85)'; ctx.lineWidth = 1;
        ctx.beginPath(); p.forEach((q, j) => j ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1])); ctx.stroke();
        ctx.restore();
    });

    // rim highlight (top-left edges)
    ctx.strokeStyle = 'rgba(230,210,175,0.5)'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let i = 0; i < n; i++) {
        const j = (i + 1) % n;
        const mid = (V[i].a + (V[j].a < V[i].a ? V[j].a + Math.PI * 2 : V[j].a)) / 2;
        if (Math.cos(mid - lightAngle) > 0.55) { ctx.beginPath(); ctx.moveTo(V[i].x, V[i].y); ctx.lineTo(V[j].x, V[j].y); ctx.stroke(); }
    }
    // bottom rim dark
    ctx.strokeStyle = 'rgba(0,0,0,0.5)'; ctx.lineWidth = 2;
    traceShape(V); ctx.stroke();

    // gold flecks appear as damage grows
    if (stone.goldRich && damage > 0.1) {
        stone.flecks.forEach((f, i) => {
            if (damage * stone.flecks.length > i) {
                ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
                ctx.fillStyle = '#4cc3ff';
                ctx.beginPath(); ctx.moveTo(-f.s, 0); ctx.lineTo(0, -f.s * 0.7); ctx.lineTo(f.s, 0); ctx.lineTo(0, f.s * 0.7); ctx.closePath(); ctx.fill();
                ctx.fillStyle = 'rgba(255,255,255,0.7)';
                ctx.fillRect(-f.s * 0.3, -f.s * 0.3, f.s * 0.3, f.s * 0.3);
                ctx.restore();
            }
        });
    }

    // cracks
    stone.cracks.forEach((c, i) => {
        const threshold = (i + 1) / stone.cracks.length * 0.9;
        if (damage > threshold * 0.8 - 0.05 && c.grow < 1) c.grow = Math.min(1, c.grow + 0.08);
        if (c.grow > 0) {
            const upTo = Math.max(1, Math.floor(c.pts.length * c.grow));
            ctx.strokeStyle = '#120a04'; ctx.lineWidth = 2; ctx.lineJoin = 'round';
            ctx.beginPath();
            for (let k = 0; k < upTo; k++) k ? ctx.lineTo(c.pts[k].x, c.pts[k].y) : ctx.moveTo(c.pts[k].x, c.pts[k].y);
            ctx.stroke();
            ctx.strokeStyle = 'rgba(210,190,160,0.25)'; ctx.lineWidth = 0.8;
            ctx.beginPath();
            for (let k = 0; k < upTo; k++) k ? ctx.lineTo(c.pts[k].x + 1, c.pts[k].y + 1) : ctx.moveTo(c.pts[k].x + 1, c.pts[k].y + 1);
            ctx.stroke();
        }
    });

    // glow when about to break
    if (damage > 0.75) {
        if (!resting) stone.glow += 0.15;
        const gi = (Math.sin(stone.glow) * 0.3 + 0.5) * (damage - 0.75) * 2;
        const gg = ctx.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 1.4);
        gg.addColorStop(0, `rgba(60,170,255,${gi * 0.3})`);
        gg.addColorStop(1, 'rgba(60,170,255,0)');
        ctx.fillStyle = gg; ctx.fillRect(-R * 1.4, -R * 1.4, R * 2.8, R * 2.8);
    }
    // ambient occlusion where the rock meets the floor
    ctx.save();
    traceShape(V); ctx.clip();
    const ao = ctx.createLinearGradient(0, GL - R * 0.55, 0, GL);
    ao.addColorStop(0, 'rgba(0,0,0,0)'); ao.addColorStop(1, 'rgba(0,0,0,0.5)');
    ctx.fillStyle = ao; ctx.fillRect(-R * 1.4, GL - R * 0.55, R * 2.8, R * 0.55 + 1);
    ctx.restore();
    ctx.restore();

    // thin contact shadow on the floor around the base (floor stays flat)
    ctx.save(); ctx.translate(stone.x, stone.y);
    const cs = ctx.createRadialGradient(0, GL, R * 0.3, 0, GL, R * 1.25);
    cs.addColorStop(0, 'rgba(0,0,0,0.5)'); cs.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cs;
    ctx.beginPath(); ctx.ellipse(0, GL + 1, R * 1.25, R * 0.16, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}


// ---------- extra character helpers (sleeves, gowns, armor, mermaid tail ...) ----------
// arm segment: plain skin arm for the old skins; sleeved arm (+hand / gauntlet) for the new ones
function armStroke(sk, x0, y0, x1, y1, side) {
    ctx.lineCap = 'round';
    if (!sk.sleeve) {
        ctx.strokeStyle = sk.skin; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        return;
    }
    const f = sk.sleeveLen == null ? 1 : sk.sleeveLen;
    ctx.strokeStyle = sk.hand || sk.skin; ctx.lineWidth = 4.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    ctx.strokeStyle = sk.sleeve; ctx.lineWidth = 5.6;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); ctx.stroke();
    if (f >= 0.9) {
        if (sk.gauntlet && side === 'R') {
            ctx.fillStyle = sk.gauntlet; ctx.strokeStyle = '#8a6a14'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(x1, y1, 5.4, 0, 6.28); ctx.fill(); ctx.stroke();
            ['#ff3b5c', '#3bc4ff', '#ffd23b'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x1 - 2.2 + i * 2.2, y1 - 0.5 + (i === 1 ? -1.4 : 0.8), 1.15, 0, 6.28); ctx.fill(); });
        } else {
            ctx.fillStyle = sk.hand || sk.skin;
            ctx.beginPath(); ctx.arc(x1, y1, 3.3, 0, 6.28); ctx.fill();
        }
    }
}

function drawCape(sk) {
    ctx.fillStyle = sk.cape;
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(6, -6); ctx.lineTo(-2, 32); ctx.lineTo(-26, 30); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-2, -6); ctx.lineTo(-14, 31); ctx.lineTo(-26, 30); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(-26, 30); ctx.lineTo(-2, 32); ctx.stroke();
}

function drawMermaidTail(sk, m, walking) {
    const sw = walking ? Math.sin(m.walkCycle) * 5 : Math.sin(m.breathe * 1.3) * 2.5;
    ctx.save();
    ctx.fillStyle = sk.boot; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(-9, 8); ctx.lineTo(9, 8);
    ctx.bezierCurveTo(10, 18, 5 + sw * 0.3, 24, 3 + sw, 29);
    ctx.lineTo(13 + sw, 37);
    ctx.quadraticCurveTo(5 + sw, 32, sw, 35);
    ctx.quadraticCurveTo(-5 + sw, 32, -13 + sw, 37);
    ctx.lineTo(-3 + sw, 29);
    ctx.bezierCurveTo(-5 + sw * 0.3, 24, -10, 18, -9, 8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    // scales
    ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 1;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
        const x = -6 + c * 6 + (r % 2) * 3 - 1.5 + sw * (r + 1) * 0.12, y = 13 + r * 5;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0.1, Math.PI - 0.1); ctx.stroke();
    }
    // lighter fin
    ctx.fillStyle = sk.tail2; ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.moveTo(3 + sw, 29); ctx.lineTo(13 + sw, 37); ctx.quadraticCurveTo(5 + sw, 32, sw, 35);
    ctx.quadraticCurveTo(-5 + sw, 32, -13 + sw, 37); ctx.lineTo(-3 + sw, 29); ctx.closePath(); ctx.fill();
    ctx.globalAlpha = 1;
    ctx.restore();
}

// torso for the new skins. g = { t:top, b:bottom, wt:half-width top, wb:half-width bottom, sit, leg }
function drawTorsoCustom(sk, g) {
    const t = g.t, b = g.b, wt = g.wt, wb = g.wb, H = b - t;
    const path = () => { ctx.beginPath(); ctx.moveTo(-wt, t); ctx.lineTo(wt, t); ctx.lineTo(wb, b); ctx.lineTo(-wb, b); ctx.closePath(); };
    const shade = () => { ctx.fillStyle = 'rgba(0,0,0,0.2)'; ctx.beginPath(); ctx.moveTo(0, t); ctx.lineTo(wt, t); ctx.lineTo(wb, b); ctx.lineTo(0, b); ctx.closePath(); ctx.fill(); };
    const vneck = (depth, flap) => {
        ctx.fillStyle = sk.skin; ctx.beginPath(); ctx.moveTo(-4.5, t); ctx.lineTo(4.5, t); ctx.lineTo(0, t + depth); ctx.closePath(); ctx.fill();
        ctx.fillStyle = flap; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 0.8;
        ctx.beginPath(); ctx.moveTo(-4.5, t); ctx.lineTo(-8.5, t + 1); ctx.lineTo(-2.5, t + depth * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4.5, t); ctx.lineTo(8.5, t + 1); ctx.lineTo(2.5, t + depth * 0.62); ctx.closePath(); ctx.fill(); ctx.stroke();
    };

    // skirt (over the legs, under the bodice)
    if (sk.body === 'gown') {
        ctx.fillStyle = sk.outfit; ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.6;
        if (g.sit) {
            ctx.beginPath(); ctx.ellipse(0, b + 2, 20, 8, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        } else {
            const sw = (g.leg || 0) * 0.35;
            ctx.beginPath(); ctx.moveTo(-wb, b - 4); ctx.lineTo(wb, b - 4);
            ctx.lineTo(wb + 9 + sw, 29); ctx.quadraticCurveTo(sw, 34, -wb - 9 + sw, 29); ctx.closePath(); ctx.fill();
            ctx.fillStyle = 'rgba(0,0,0,0.18)';
            ctx.beginPath(); ctx.moveTo(0, b - 4); ctx.lineTo(wb, b - 4); ctx.lineTo(wb + 9 + sw, 29); ctx.quadraticCurveTo(sw, 34, sw * 0.5, 31); ctx.closePath(); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-wb - 9 + sw, 29); ctx.quadraticCurveTo(sw, 34, wb + 9 + sw, 29); ctx.stroke();
        }
    }

    // base
    ctx.fillStyle = sk.outfit; path(); ctx.fill();

    if (sk.body === 'gown') {
        shade();
        ctx.fillStyle = sk.skin; ctx.beginPath(); ctx.moveTo(-5, t); ctx.lineTo(5, t); ctx.lineTo(0, t + 5.5); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(-6, t); ctx.lineTo(0, t + 6); ctx.lineTo(6, t); ctx.stroke();
        if (!sk.noBelt) { ctx.fillStyle = sk.trim; ctx.fillRect(-wb, b - 4, wb * 2, 3); }
        if (sk.gem) {
            ctx.fillStyle = sk.gem; ctx.strokeStyle = sk.trim; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.arc(0, t + 9, 2.3, 0, 6.28); ctx.fill(); ctx.stroke();
        }
        if (sk.shawl) {
            ctx.fillStyle = sk.shawl; ctx.strokeStyle = 'rgba(0,0,0,0.28)'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-wt - 1, t - 1); ctx.lineTo(wt + 1, t - 1); ctx.lineTo(wt - 2, t + 7); ctx.lineTo(0, t + 13); ctx.lineTo(-wt + 2, t + 7); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = '#f5d6e2';
            [[-6, 3], [-2, 7], [3, 4], [6, 8], [0, 1.5]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], t + q[1], 0.9, 0, 6.28); ctx.fill(); });
        }
    } else if (sk.body === 'mermaid') {
        shade();
        ctx.fillStyle = sk.boot; ctx.fillRect(-wb, b - 3, wb * 2, 3);                 // waist scales
        [-4.6, 5.4].forEach(x => {
            ctx.fillStyle = sk.shell; ctx.strokeStyle = '#c0508a'; ctx.lineWidth = 0.9;
            ctx.beginPath(); ctx.arc(x, t + 6, 4.5, 0, 6.28); ctx.fill(); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(x, t + 10); ctx.lineTo(x - 3, t + 4); ctx.moveTo(x, t + 10); ctx.lineTo(x, t + 2.6); ctx.moveTo(x, t + 10); ctx.lineTo(x + 3, t + 4); ctx.stroke();
        });
    } else if (sk.body === 'armor') {
        shade();
        ctx.fillStyle = sk.trim;
        ctx.beginPath(); ctx.moveTo(-wt + 2, t + 1); ctx.lineTo(wt - 2, t + 1); ctx.lineTo(wt - 5, t + 10); ctx.lineTo(-wt + 5, t + 10); ctx.closePath(); ctx.fill();
        ctx.fillRect(-wb, b - 4, wb * 2, 4);
        ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(0, t + 10); ctx.lineTo(0, b - 4); ctx.stroke();
        ctx.save(); ctx.shadowColor = sk.glow; ctx.shadowBlur = 9; ctx.fillStyle = sk.glow;
        ctx.beginPath(); ctx.arc(0, t + 5.5, 3.3, 0, 6.28); ctx.fill(); ctx.restore();
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(0, t + 5.5, 1.4, 0, 6.28); ctx.fill();
        ctx.fillStyle = sk.trim; ctx.strokeStyle = 'rgba(90,60,0,0.6)'; ctx.lineWidth = 1;
        [-wt, wt].forEach(x => { ctx.beginPath(); ctx.arc(x, t + 2, 4.2, 0, 6.28); ctx.fill(); ctx.stroke(); });
    } else if (sk.body === 'warlord') {
        shade();
        ctx.strokeStyle = sk.trim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-wt + 3, t); ctx.lineTo(0, t + 9); ctx.lineTo(wt - 3, t); ctx.stroke();
        ctx.fillStyle = sk.trim; ctx.fillRect(-wb, b - 4, wb * 2, 4);
        ctx.fillStyle = '#7a3aa8'; ctx.fillRect(-2, b - 4, 4, 4);
        ctx.fillStyle = sk.gauntlet; ctx.strokeStyle = '#8a6a14'; ctx.lineWidth = 1;
        [-wt, wt].forEach(x => { ctx.beginPath(); ctx.ellipse(x, t + 2, 5.6, 4.2, 0, 0, 6.28); ctx.fill(); ctx.stroke(); });
    } else if (sk.body === 'hoodie') {
        shade();
        ctx.fillStyle = '#0a0c0e'; ctx.beginPath(); ctx.ellipse(0, t + 1, 8, 3.6, 0, 0, 6.28); ctx.fill();
        ctx.strokeStyle = 'rgba(51,255,119,0.5)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(0, t + 4); ctx.lineTo(0, b); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-7, b - 6); ctx.lineTo(-5, b - 1); ctx.lineTo(5, b - 1); ctx.lineTo(7, b - 6); ctx.stroke();
        ctx.save(); ctx.strokeStyle = sk.trim; ctx.shadowColor = sk.trim; ctx.shadowBlur = 4; ctx.lineWidth = 1.4; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-8, t + 5); ctx.lineTo(-5, t + 7.5); ctx.lineTo(-8, t + 10); ctx.moveTo(-3, t + 10.5); ctx.lineTo(1, t + 10.5); ctx.stroke();
        ctx.restore();
    } else if (sk.body === 'stripes') {
        ctx.save(); path(); ctx.clip(); ctx.fillStyle = sk.stripe;
        for (let y = t + 2; y < b; y += 5) ctx.fillRect(-wt, y, wt * 2, 2.6);
        ctx.restore(); shade();
        ctx.fillStyle = '#1a1a1a'; ctx.fillRect(-wb, b - 3, wb * 2, 3);
    } else if (sk.body === 'swirl') {
        shade();
        ctx.save(); path(); ctx.clip();
        ctx.strokeStyle = sk.pattern; ctx.lineWidth = 2.3; ctx.lineCap = 'round';
        [[-8, 0.35], [7, 0.25], [-3, 0.7], [9, 0.78], [-9, 0.95]].forEach(q => {
            const y = t + H * q[1];
            ctx.beginPath(); ctx.arc(q[0], y, 3.1, 0.3, 4.9); ctx.stroke();
            ctx.beginPath(); ctx.arc(q[0] + 0.5, y, 1.1, 0, 6.28); ctx.stroke();
        });
        ctx.restore();
        vneck(9, '#f2f2ec');
    } else if (sk.body === 'plaid') {
        ctx.save(); path(); ctx.clip();
        ctx.globalAlpha = 0.8; ctx.fillStyle = sk.plaid2;
        for (let x = -wt; x < wt; x += 8) ctx.fillRect(x, t, 4, H);
        for (let y = t; y < b; y += 8) ctx.fillRect(-wt, y, wt * 2, 4);
        ctx.globalAlpha = 1; ctx.strokeStyle = sk.plaidLine; ctx.lineWidth = 0.8;
        for (let x = -wt + 6; x < wt; x += 8) { ctx.beginPath(); ctx.moveTo(x, t); ctx.lineTo(x, b); ctx.stroke(); }
        for (let y = t + 6; y < b; y += 8) { ctx.beginPath(); ctx.moveTo(-wt, y); ctx.lineTo(wt, y); ctx.stroke(); }
        ctx.restore(); shade();
        vneck(11, sk.outfit);
        ctx.fillStyle = sk.plaidLine; [t + 13, t + 17].forEach(y => { if (y < b) { ctx.beginPath(); ctx.arc(0, y, 0.9, 0, 6.28); ctx.fill(); } });
    }
}

// head + headgear for any skin. dy shifts it (used by the sitting pose)
function drawMinerHead(sk, blink, breathe, dy) {
    ctx.save();
    ctx.translate(0, dy);
    if (sk.head === 'robot') {
        ctx.fillStyle = sk.skin; ctx.strokeStyle = sk.trim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.rect(-9, -28, 18, 18); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = sk.trim; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(1, -28); ctx.lineTo(1, -35); ctx.stroke();
        ctx.fillStyle = sk.eye; ctx.beginPath(); ctx.arc(1, -36, 2, 0, Math.PI * 2); ctx.fill();
        const on = Math.sin(breathe * 3) > -0.5;
        ctx.fillStyle = on ? sk.eye : 'rgba(80,20,20,0.4)';
        ctx.beginPath(); ctx.rect(-4, -21, 10, 3); ctx.fill();
        ctx.fillStyle = sk.trim;
        ctx.fillRect(-9, -12, 18, 2); ctx.fillRect(-9, -22, 18, 2);
    } else if (sk.head === 'alien') {
        ctx.fillStyle = sk.skin;
        ctx.beginPath(); ctx.ellipse(1, -19, 9, 12, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sk.eye;
        ctx.beginPath(); ctx.ellipse(-2.5, -20, 3.2, 4.6, -0.25, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(6, -20, 3.2, 4.6, 0.25, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        ctx.beginPath(); ctx.arc(-3.2, -22, 0.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(5.2, -22, 0.8, 0, Math.PI * 2); ctx.fill();
    } else if (sk.head === 'ironhelm') {
        ctx.fillStyle = sk.helm; ctx.strokeStyle = '#6a0f1a'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.arc(1, -18, 11.2, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = sk.plate; ctx.strokeStyle = '#8a6a14'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(1, -27); ctx.quadraticCurveTo(11, -26, 11.6, -16); ctx.quadraticCurveTo(10, -8, 3, -6.5); ctx.quadraticCurveTo(-1, -12, 1, -27); ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.save(); ctx.shadowColor = sk.glow; ctx.shadowBlur = 6; ctx.fillStyle = '#eafcff';
        ctx.beginPath(); ctx.moveTo(2.5, -19.6); ctx.lineTo(6.2, -19.2); ctx.lineTo(5.8, -17.3); ctx.lineTo(2.6, -17.6); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(7.4, -19.2); ctx.lineTo(11, -19.7); ctx.lineTo(10.7, -17.6); ctx.lineTo(7.6, -17.3); ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = 'rgba(80,50,10,0.75)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(4, -11.2); ctx.lineTo(9.5, -11.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(7.5, -16); ctx.lineTo(7.8, -13); ctx.stroke();
    } else if (sk.head === 'titan') {
        ctx.fillStyle = sk.skin;
        ctx.beginPath(); ctx.ellipse(1, -18, 10.5, 11.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(5, -9.5, 8.5, 4.4, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(50,15,80,0.6)'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(1, -20.2); ctx.lineTo(5, -18.8); ctx.moveTo(10, -20.2); ctx.lineTo(6.6, -18.8); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(6, -13.5); ctx.lineTo(9, -14.5); ctx.moveTo(1, -8.2); ctx.lineTo(8, -8.2); ctx.stroke();
        if (!blink) {
            ctx.fillStyle = '#1a0b26';
            ctx.beginPath(); ctx.arc(3.2, -17.8, 1.6, 0, Math.PI * 2); ctx.arc(8, -17.8, 1.6, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = 'rgba(255,255,255,0.8)';
            ctx.beginPath(); ctx.arc(3.7, -18.3, 0.5, 0, Math.PI * 2); ctx.arc(8.5, -18.3, 0.5, 0, Math.PI * 2); ctx.fill();
        }
        ctx.strokeStyle = '#3a1a4a'; ctx.lineWidth = 1.3;
        ctx.beginPath(); ctx.moveTo(2.5, -12.4); ctx.quadraticCurveTo(6, -11, 10, -12.6); ctx.stroke();
        ctx.fillStyle = sk.helm; ctx.strokeStyle = '#8a6a14'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(1, -21, 11.2, Math.PI, 0); ctx.fill(); ctx.stroke();
        [[-7, -30, -4.5, -37, -1.5, -31], [-1.5, -31.4, 1.5, -39, 4.5, -31.4], [3.5, -31, 6.6, -37, 9.4, -29.6]].forEach(q => {
            ctx.beginPath(); ctx.moveTo(q[0], q[1]); ctx.lineTo(q[2], q[3]); ctx.lineTo(q[4], q[5]); ctx.closePath(); ctx.fill(); ctx.stroke();
        });
        ctx.fillStyle = '#b8861a'; ctx.fillRect(-10.2, -22, 22.4, 2.6);
    } else if (sk.head === 'hacker') {
        ctx.fillStyle = sk.outfit;
        ctx.beginPath(); ctx.ellipse(0, -18, 12.5, 13.5, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = sk.skin;
        ctx.beginPath(); ctx.ellipse(4, -16, 7.2, 8.6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.save(); ctx.beginPath(); ctx.ellipse(4, -16, 7.2, 8.6, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = 'rgba(0,0,0,0.38)'; ctx.fillRect(-4, -26, 16, 7); ctx.restore();
        ctx.save(); ctx.shadowColor = sk.glow; ctx.shadowBlur = 8; ctx.fillStyle = 'rgba(51,255,119,0.92)';
        ctx.fillRect(0.6, -20.6, 5.6, 3.6); ctx.fillRect(7.2, -20.6, 4.2, 3.6); ctx.restore();
        ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(1.6, -20, 1.4, 1); ctx.fillRect(8.2, -20, 1.2, 1);
        ctx.strokeStyle = '#0c0e10'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(6.2, -19); ctx.lineTo(7.2, -19); ctx.stroke();
        ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(3, -11.5); ctx.quadraticCurveTo(6, -10, 9, -12); ctx.stroke();
        ctx.strokeStyle = '#dfe6e0'; ctx.lineWidth = 0.9;
        ctx.beginPath(); ctx.moveTo(0.5, -7); ctx.lineTo(0, -2.5); ctx.moveTo(3.5, -7); ctx.lineTo(4, -2.5); ctx.stroke();
    } else {
        // generic round head
        if (sk.head === 'queen' || sk.head === 'mermaid') {           // long hair behind the head
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.ellipse(-7, -8, 6.6, 15, 0.12, 0, Math.PI * 2); ctx.fill();
        }
        ctx.fillStyle = sk.skin;
        ctx.beginPath(); ctx.arc(1, -17, 10, 0, Math.PI * 2); ctx.fill();

        if (sk.head === 'skull') {
            ctx.fillStyle = '#1a1006';
            ctx.beginPath(); ctx.ellipse(-2, -18, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5, -18, 2.2, 3, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(1, -14); ctx.lineTo(-1, -11); ctx.lineTo(3, -11); ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#1a1006'; ctx.lineWidth = 1;
            for (let i = -6; i <= 6; i += 3) { ctx.beginPath(); ctx.moveTo(i, -9); ctx.lineTo(i, -6); ctx.stroke(); }
        } else if (!blink && sk.head !== 'robber' && sk.head !== 'granny') {
            ctx.fillStyle = '#1a1a1a';
            ctx.beginPath(); ctx.arc(3, -19, 1.3, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(6, -19, 1.3, 0, Math.PI * 2); ctx.fill();
        }

        if (sk.head === 'helmet') {
            ctx.fillStyle = sk.helmetColor;
            ctx.beginPath(); ctx.arc(1, -21, 11, Math.PI, 0); ctx.fill();
            ctx.fillRect(-10, -22, 23, 3);
            ctx.fillStyle = '#ffffcc';
            ctx.beginPath(); ctx.arc(1, -25, 3, 0, Math.PI * 2); ctx.fill();
            const lg = ctx.createRadialGradient(1, -25, 2, 1, -25, 35);
            lg.addColorStop(0, 'rgba(255,255,200,0.35)'); lg.addColorStop(1, 'rgba(255,255,200,0)');
            ctx.fillStyle = lg; ctx.beginPath(); ctx.arc(1, -25, 35, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'hair') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -22, 9.5, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-10, -14, 4, 9, 0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#e0447a';
            ctx.beginPath(); ctx.moveTo(-10, -22); ctx.lineTo(-5, -19); ctx.lineTo(-10, -16); ctx.lineTo(-15, -19); ctx.closePath(); ctx.fill();
        } else if (sk.head === 'bald') {
            ctx.strokeStyle = sk.hairColor; ctx.lineWidth = 3; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(-8, -18, 4, 0.3, Math.PI - 0.3); ctx.stroke();
            ctx.beginPath(); ctx.arc(10, -18, 4, 0.3, Math.PI - 0.3); ctx.stroke();
            ctx.strokeStyle = sk.hairColor; ctx.lineWidth = 3.5;
            ctx.beginPath(); ctx.moveTo(-3, -10); ctx.quadraticCurveTo(1, -6, 5, -10); ctx.stroke();
        } else if (sk.head === 'band') {
            ctx.fillStyle = sk.bandColor;
            ctx.fillRect(-10, -22, 22, 4);
            ctx.fillStyle = sk.trim;
            ctx.beginPath(); ctx.arc(-9, -20, 2, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'crown') {
            ctx.fillStyle = sk.crownColor;
            ctx.beginPath();
            ctx.moveTo(-10, -22); ctx.lineTo(-10, -30); ctx.lineTo(-5, -24); ctx.lineTo(1, -32); ctx.lineTo(7, -24); ctx.lineTo(12, -30); ctx.lineTo(12, -22);
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = sk.trim; ctx.lineWidth = 1.5; ctx.stroke();
            ctx.fillStyle = '#e0447a';
            ctx.beginPath(); ctx.arc(1, -25, 2, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'witch') {
            ctx.fillStyle = sk.hatColor;
            ctx.beginPath(); ctx.ellipse(1, -21, 13, 3.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.moveTo(-6, -22); ctx.lineTo(3, -48); ctx.lineTo(9, -22); ctx.closePath(); ctx.fill();
            ctx.fillStyle = sk.trim;
            ctx.beginPath(); ctx.ellipse(2, -30, 4, 2, 0.4, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'queen') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -21, 10.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
            ctx.strokeStyle = '#d0245a'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(5, -14.2, 2, 0.2, Math.PI - 0.4); ctx.stroke();
            ctx.fillStyle = 'rgba(255,120,150,0.35)'; ctx.beginPath(); ctx.arc(7.5, -15, 2, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = sk.crownColor; ctx.beginPath(); ctx.arc(-8, -13, 1.4, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = sk.crownColor; ctx.strokeStyle = '#b8862a'; ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(-6, -26); ctx.lineTo(-6, -32); ctx.lineTo(-2.5, -28.5); ctx.lineTo(1, -35); ctx.lineTo(4.5, -28.5); ctx.lineTo(8, -32); ctx.lineTo(8, -26); ctx.closePath(); ctx.fill(); ctx.stroke();
            ctx.fillStyle = sk.gem; ctx.beginPath(); ctx.arc(1, -29.5, 1.7, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff5f9f'; ctx.beginPath(); ctx.arc(-3.6, -28, 1.1, 0, Math.PI * 2); ctx.arc(5.6, -28, 1.1, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'robber') {
            ctx.fillStyle = sk.hatColor;
            ctx.beginPath(); ctx.arc(1, -21, 11, Math.PI, 0); ctx.fill();
            ctx.fillStyle = '#3a3a3a'; ctx.fillRect(-10, -23, 22, 4);
            ctx.fillStyle = '#0d0d0d'; ctx.beginPath(); ctx.roundRect(-8, -22, 20, 6.4, 3); ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.beginPath(); ctx.ellipse(3.2, -19, 1.9, 1.5, 0, 0, Math.PI * 2); ctx.ellipse(7.6, -19, 1.9, 1.5, 0, 0, Math.PI * 2); ctx.fill();
            if (!blink) { ctx.fillStyle = '#000'; ctx.beginPath(); ctx.arc(3.9, -19, 0.9, 0, Math.PI * 2); ctx.arc(8.3, -19, 0.9, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = '#5a3a24'; ctx.lineWidth = 1.2;
            ctx.beginPath(); ctx.moveTo(2, -12.6); ctx.quadraticCurveTo(5, -10.6, 8.6, -12.8); ctx.stroke();
            ctx.fillStyle = 'rgba(40,25,15,0.35)';
            [[0, -11], [2.5, -9.4], [5.5, -9], [8, -10.6], [-1.5, -13.6]].forEach(q => { ctx.beginPath(); ctx.arc(q[0], q[1], 0.6, 0, Math.PI * 2); ctx.fill(); });
        } else if (sk.head === 'mermaid') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -21, 10.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
            ctx.beginPath(); ctx.ellipse(6, -26, 6, 3.2, -0.3, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#ff8fb8';
            ctx.beginPath();
            for (let i = 0; i < 10; i++) { const r = i % 2 ? 1.2 : 3, a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(-3 + Math.cos(a) * r, -27.5 + Math.sin(a) * r); }
            ctx.closePath(); ctx.fill();
            ctx.strokeStyle = '#ff6fa8'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
            ctx.beginPath(); ctx.arc(5, -14.2, 2, 0.2, Math.PI - 0.4); ctx.stroke();
            ctx.fillStyle = 'rgba(255,120,150,0.3)'; ctx.beginPath(); ctx.arc(7.5, -15, 2, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'granny') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -21, 10.4, Math.PI * 1.02, Math.PI * 1.98); ctx.fill();
            ctx.beginPath(); ctx.arc(-5, -29, 4.6, 0, Math.PI * 2); ctx.fill();
            ctx.strokeStyle = '#b4b4be'; ctx.lineWidth = 0.9; ctx.beginPath(); ctx.arc(-5, -29, 2.6, 0.5, 4.5); ctx.stroke();
            ctx.strokeStyle = '#555'; ctx.lineWidth = 1.1;
            ctx.beginPath(); ctx.arc(3, -19, 2.5, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.arc(8.2, -19, 2.5, 0, Math.PI * 2); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(5.5, -19.4); ctx.lineTo(5.7, -19.4); ctx.moveTo(-0.5, -19.5); ctx.lineTo(-6, -20); ctx.stroke();
            if (!blink) { ctx.fillStyle = '#1a1a1a'; ctx.beginPath(); ctx.arc(3.4, -19, 0.9, 0, Math.PI * 2); ctx.arc(8.6, -19, 0.9, 0, Math.PI * 2); ctx.fill(); }
            ctx.strokeStyle = 'rgba(120,80,60,0.55)'; ctx.lineWidth = 0.8;
            ctx.beginPath(); ctx.moveTo(-1, -14); ctx.lineTo(0.8, -14.6); ctx.moveTo(2, -23); ctx.lineTo(7, -23.4); ctx.moveTo(4, -12.6); ctx.quadraticCurveTo(6.4, -11, 8.6, -12.6); ctx.stroke();
            ctx.fillStyle = 'rgba(255,130,130,0.3)'; ctx.beginPath(); ctx.arc(8, -14.6, 1.8, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'quiff') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -21, 10.6, Math.PI, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(5, -29, 8, 4.6, 0.15, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-9, -16, 2.4, 5.5, 0, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'curly') {
            ctx.fillStyle = sk.hairColor;
            for (let i = 0; i < 8; i++) { const a = Math.PI * (1.02 + i * 0.13); ctx.beginPath(); ctx.arc(1 + Math.cos(a) * 9.2, -21 + Math.sin(a) * 9.2, 4.3, 0, Math.PI * 2); ctx.fill(); }
            ctx.beginPath(); ctx.ellipse(1, -27, 9, 5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(-9, -15, 3.4, 0, Math.PI * 2); ctx.fill();
        } else if (sk.head === 'messy') {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.arc(1, -21, 10.4, Math.PI, Math.PI * 2); ctx.fill();
            for (let i = 0; i < 5; i++) {
                const a = Math.PI * (1.12 + i * 0.19), c = Math.cos(a), sn = Math.sin(a);
                const bx = 1 + c * 9.5, by = -21 + sn * 9.5, tx = 1 + c * 15 + (i % 2 ? 2 : -2), ty = -21 + sn * 14.5;
                ctx.beginPath(); ctx.moveTo(bx - sn * 2.4, by + c * 2.4); ctx.lineTo(tx, ty); ctx.lineTo(bx + sn * 2.4, by - c * 2.4); ctx.closePath(); ctx.fill();
            }
            ctx.beginPath(); ctx.ellipse(7, -25, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(-9, -16, 2.2, 5, 0, 0, Math.PI * 2); ctx.fill();
        }
        if (sk.stache) {
            ctx.fillStyle = sk.hairColor;
            ctx.beginPath(); ctx.ellipse(5, -13.5, 3.5, 0.85, 0.05, 0, Math.PI * 2); ctx.fill();
        }
        // 'skull' has no extra headgear
    }
    ctx.restore();
}

function drawMiner() {
    const m = miner;
    const sk = MINER_SKINS[currentSkin];
    const gear = SKIN_GEAR[currentSkin];
    m.breathe += 0.06;
    const bo = Math.sin(m.breathe) * 1;
    ctx.save();
    ctx.translate(m.x, m.y + bo);
    ctx.scale(m.facing, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.beginPath(); ctx.ellipse(0, 35, 20, 5, 0, 0, Math.PI * 2); ctx.fill();

    const walking = m.state === 'walk' || m.state === 'exit';
    const leg = walking ? Math.sin(m.walkCycle) * 10 : 0;

    if (sk.cape) drawCape(sk);
    if (sk.legs === 'tail') {
        drawMermaidTail(sk, m, walking);
    } else {
        ctx.strokeStyle = sk.pants || sk.boot; ctx.lineWidth = 6; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(-4, 12); ctx.lineTo(-8 + leg, 32); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(4, 12); ctx.lineTo(8 - leg, 32); ctx.stroke();
        ctx.fillStyle = sk.boot;
        ctx.fillRect(-12 + leg, 30, 9, 5); ctx.fillRect(4 - leg, 30, 9, 5);
    }

    if (sk.body) {
        drawTorsoCustom(sk, { t: -6, b: 14, wt: 12, wb: 10, sit: false, leg: leg });
    } else {
    ctx.fillStyle = sk.outfit;
    ctx.beginPath(); ctx.moveTo(-12, -6); ctx.lineTo(12, -6); ctx.lineTo(10, 14); ctx.lineTo(-10, 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.moveTo(0, -6); ctx.lineTo(12, -6); ctx.lineTo(10, 14); ctx.lineTo(0, 14); ctx.closePath(); ctx.fill();

    ctx.strokeStyle = sk.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-7, -6); ctx.lineTo(-5, 14); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(7, -6); ctx.lineTo(5, 14); ctx.stroke();
    ctx.fillStyle = sk.boot; ctx.fillRect(-11, 9, 22, 4);
    }

    // ---- head ----
    drawMinerHead(sk, m.blink, m.breathe, 0);

    // relaxed pause pose: pickaxe rests on the ground, arms down
    if (m.state === 'collect' || m.state === 'reward') {
        const sway = Math.sin(m.breathe) * 0.6;
        drawPickTool(gear.pick, 17, 34, 16, -8, -6, 12, -14);
        armStroke(sk, -9, -2, -10, 10 + sway, 'L');
        armStroke(sk, 10, -2, 16, 6, 'R');
        if (!sk.sleeve) { ctx.fillStyle = sk.glove || sk.skin; ctx.beginPath(); ctx.arc(16, 6, sk.glove ? 5 : 3, 0, Math.PI * 2); ctx.fill(); }
        if (sk.glove) { ctx.fillStyle = sk.glove; ctx.beginPath(); ctx.arc(-10, 10 + sway, 5, 0, Math.PI * 2); ctx.fill(); }
        ctx.restore();
        return;
    }
    const sa = m.state === 'mine' ? Math.sin(m.swingPhase) * 1.2 - 0.5 : -0.2;
    armStroke(sk, -9, -2, -2 + Math.cos(sa) * 10, -6 + Math.sin(sa) * 10, 'L');
    armStroke(sk, 10, -2, 6 + Math.cos(sa) * 16, -6 + Math.sin(sa) * 16, 'R');
    if (sk.glove) {
        ctx.fillStyle = sk.glove;
        ctx.beginPath(); ctx.arc(-2 + Math.cos(sa) * 10, -6 + Math.sin(sa) * 10, 5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(6 + Math.cos(sa) * 16, -6 + Math.sin(sa) * 16, 5, 0, Math.PI * 2); ctx.fill();
    }

    ctx.save();
    ctx.translate(4 + Math.cos(sa) * 15, -6 + Math.sin(sa) * 15);
    ctx.rotate(sa + Math.PI / 3);
    drawPickTool(gear.pick, 0, 4, 0, -26, -26, 12, -33);
    ctx.restore();
    ctx.restore();
}

// ============ REST SCENE: miner & ghost watching TV ============
function drawMinerSitting(x, y, faceDir) {
    const sk = MINER_SKINS[currentSkin];
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(faceDir, 1);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath(); ctx.ellipse(0, 20, 22, 6, 0, 0, Math.PI * 2); ctx.fill();

    // crossed legs
    ctx.fillStyle = sk.pants || sk.boot;
    ctx.beginPath(); ctx.ellipse(-7, 13, 13, 6.5, 0.35, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(7, 13, 13, 6.5, -0.35, 0, Math.PI * 2); ctx.fill();
    if (sk.legs === 'tail') {   // curled mermaid tail with fins
        ctx.fillStyle = sk.tail2;
        ctx.beginPath(); ctx.moveTo(-17, 15); ctx.lineTo(-27, 9); ctx.lineTo(-25, 16); ctx.lineTo(-27, 22); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(17, 15); ctx.lineTo(27, 9); ctx.lineTo(25, 16); ctx.lineTo(27, 22); ctx.closePath(); ctx.fill();
    }
    ctx.fillStyle = sk.boot;
    ctx.beginPath(); ctx.ellipse(-14, 15, 5, 3, 0.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(14, 15, 5, 3, -0.4, 0, Math.PI * 2); ctx.fill();

    // torso (overalls)
    if (sk.body) {
        drawTorsoCustom(sk, { t: -4, b: 11, wt: 11, wb: 9, sit: true, leg: 0 });
    } else {
    ctx.fillStyle = sk.outfit;
    ctx.beginPath(); ctx.moveTo(-11, -4); ctx.lineTo(11, -4); ctx.lineTo(9, 11); ctx.lineTo(-9, 11); ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(11, -4); ctx.lineTo(9, 11); ctx.lineTo(0, 11); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = sk.trim; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(-6, -4); ctx.lineTo(-4, 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -4); ctx.lineTo(4, 11); ctx.stroke();
    }

    // relaxed arms, resting on the knees
    armStroke(sk, -8, -1, -2, 9, 'L');
    armStroke(sk, 9, -1, 3, 9, 'R');
    if (sk.glove) {
        ctx.fillStyle = sk.glove;
        ctx.beginPath(); ctx.arc(-2, 9, 4.5, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(3, 9, 4.5, 0, Math.PI * 2); ctx.fill();
    }

    // head + this skin's own headgear (helmet / crown / hat / robot head ...)
    drawMinerHead(sk, false, restT, 2);

    ctx.restore();
}

function drawGhost(x, y, phase) {
    const bob = Math.sin(phase) * 5;
    const pulse = 0.6 + Math.sin(phase * 1.6) * 0.4;
    ctx.save();
    ctx.translate(x, y + bob);

    ctx.shadowColor = `rgba(210,245,255,${0.6 + pulse * 0.4})`;
    ctx.shadowBlur = 28;
    const grad = ctx.createLinearGradient(0, -30, 0, 18);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(1, 'rgba(215,242,255,0.85)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, -4, 17, Math.PI, 0, false);
    ctx.lineTo(17, 12);
    ctx.quadraticCurveTo(12.5, 20, 8.5, 12);
    ctx.quadraticCurveTo(4.5, 20, 0, 12);
    ctx.quadraticCurveTo(-4.5, 20, -8.5, 12);
    ctx.quadraticCurveTo(-12.5, 20, -17, 12);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // soft inner glow core
    const ig = ctx.createRadialGradient(0, -6, 1, 0, -6, 20);
    ig.addColorStop(0, `rgba(255,255,255,${0.5 * pulse})`);
    ig.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = ig; ctx.beginPath(); ctx.arc(0, -6, 20, 0, Math.PI * 2); ctx.fill();

    // eyes + blush
    ctx.fillStyle = 'rgba(70,110,130,0.75)';
    ctx.beginPath(); ctx.arc(-5.5, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(5.5, -6, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(70,110,130,0.6)'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, -1, 3, 0.15, Math.PI - 0.15); ctx.stroke();

    ctx.restore();
}

function drawTV(x, y, phase) {
    ctx.save();
    ctx.translate(x, y);

    // stand legs, under the front of the set
    ctx.strokeStyle = '#3a2a1a'; ctx.lineWidth = 4; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-15, 20); ctx.lineTo(-19, 34); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(10, 17); ctx.lineTo(15, 32); ctx.stroke();

    // body in side profile: narrow screen-face on the left, body tapering back (depth) to the right
    ctx.fillStyle = '#4a3826'; ctx.strokeStyle = '#241a10'; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-20, -20);
    ctx.lineTo(20, -14);
    ctx.lineTo(20, 16);
    ctx.lineTo(-20, 20);
    ctx.closePath();
    ctx.fill(); ctx.stroke();

    // antenna, sticking up from the back
    ctx.strokeStyle = '#8a8a8a'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(10, -15); ctx.lineTo(3, -36); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(17, -15); ctx.lineTo(26, -34); ctx.stroke();

    // glowing screen on the FRONT edge (left side), facing whoever is watching
    const hue = (phase * 22) % 360;
    const flick = 0.75 + Math.sin(phase * 3.3) * 0.15 + Math.random() * 0.08;
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(-20, -17); ctx.lineTo(-13, -15); ctx.lineTo(-13, 15); ctx.lineTo(-20, 17);
    ctx.closePath(); ctx.clip();
    const sg = ctx.createLinearGradient(-20, -17, -13, 17);
    sg.addColorStop(0, `hsla(${hue},70%,58%,${flick})`);
    sg.addColorStop(1, `hsla(${(hue + 70) % 360},70%,46%,${flick})`);
    ctx.fillStyle = sg;
    ctx.fillRect(-24, -20, 14, 40);
    ctx.restore();

    // control knobs on the back/side panel
    ctx.fillStyle = '#241a10';
    ctx.beginPath(); ctx.arc(8, 4, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(15, 4, 2.4, 0, Math.PI * 2); ctx.fill();

    ctx.restore();

    // soft light thrown from the screen edge toward the viewers (to the left)
    ctx.save();
    const glow = ctx.createRadialGradient(x - 20, y, 4, x - 20, y, 100);
    glow.addColorStop(0, `hsla(${hue},70%,60%,0.16)`);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x - 20, y, 100, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}

function drawRestScene() {
    const cx = canvas.width / 2, cy = Math.min(canvas.height - 60, FLOOR_Y + 130);

    // cozy rug beneath them
    ctx.fillStyle = 'rgba(70,50,32,0.5)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 16, 100, 24, 0, 0, Math.PI * 2); ctx.fill();

    // TV set they're both facing, drawn first so the light glow sits behind them
    drawTV(cx + 80, cy - 6, restT);

    // miner and ghost sit side by side, both facing the TV
    drawMinerSitting(cx - 40, cy, 1);
    drawGhost(cx + 6, cy - 6, restT);

    // the miner's own pickaxe (leaning) and bag rest beside him, in the selected skin's theme
    ctx.save(); ctx.translate(cx - 108, cy + 22); ctx.rotate(0.28);
    drawPickTool(SKIN_GEAR[currentSkin].pick, 0, 0, 0, -58, -58, 12, -65);
    ctx.restore();
    drawBagShape(cx - 82, cy + 24, 0.9, Math.min(1, (bag.count + bag.sparks / 6) / 8), 0);

    // small floating sparkles for the vibe
    for (let i = 0; i < 5; i++) {
        const a = restT * 0.7 + i * 1.3;
        const sx = cx - 20 + Math.sin(a) * 30, sy = cy - 55 - i * 8 + Math.sin(a * 1.4) * 6;
        ctx.fillStyle = `rgba(200,235,255,${0.2 + 0.2 * Math.sin(a * 2)})`;
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2); ctx.fill();
    }
}

function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.x += p.vx; p.y += p.vy;
        if (p.gravity) p.vy += p.gravity;
        // floor collision: bounce, lose energy, then rest
        if (p.floorY !== undefined && p.vy > 0 && p.y > p.floorY) {
            p.y = p.floorY; p.vy *= -0.4; p.vx *= 0.65;
            if (Math.abs(p.vy) < 0.7) { p.vy = 0; p.vx = 0; p.gravity = 0; p.rotSpeed = 0; }
        }
        if (p.rotSpeed) p.rotation += p.rotSpeed;
        p.life -= p.decay;
        if (p.life <= 0) { particles.splice(i, 1); continue; }
        ctx.save();
        ctx.globalAlpha = p.life;
        if (p.type === 'chip') {
            ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.moveTo(-p.size / 2, -p.size / 3); ctx.lineTo(p.size / 2, -p.size / 2); ctx.lineTo(p.size / 3, p.size / 2); ctx.closePath(); ctx.fill();
        } else if (p.type === 'gold') {
            const sh = Math.sin(p.shine + p.life * 8) * 0.3 + 0.7;
            ctx.fillStyle = `rgba(60,170,255,${sh})`;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2); ctx.fill();
        } else {
            ctx.fillStyle = p.color;
            ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
}

function drawVignette() {
    const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.height * 0.3, canvas.width / 2, canvas.height / 2, canvas.height * 0.95);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(0.6, 'rgba(0,0,0,0.18)');
    g.addColorStop(1, 'rgba(0,0,0,0.6)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawTransition() {
    if (transitioning) { ctx.fillStyle = `rgba(0,0,0,${transitionAlpha})`; ctx.fillRect(0, 0, canvas.width, canvas.height); }
}

// ============ UPDATE ============
function updateMiner() {
    const m = miner;
    m.blinkTimer++;
    if (m.blinkTimer > 60 + Math.random() * 50) {
        m.blink = true;
        if (m.blinkTimer > 66 + Math.random() * 50) { m.blink = false; m.blinkTimer = 0; }
    }

    if (m.state === 'find_stone') {
        const nearest = findNearestStone();
        if (!nearest) {
            // all stones in this batch are mined: wait for loot to land in the bag, then either
            // show the bag-zoom reward scene (only when mining is paused for a full cap, i.e. the
            // "Watch X ads to claim" button is showing) or just walk off to start the next batch.
            if (loot.length === 0) {
                if (paused) {
                    if (!reward.active) { m.state = 'reward'; reward.active = true; reward.t = 0; reward.dir = 1; }
                } else {
                    m.state = 'exit';
                    m.exitDirection = m.x < canvas.width / 2 ? -1 : 1;
                }
            }
        }
        else { m.currentStone = nearest; m.stand = chooseStand(nearest); m.state = 'walk'; }
    }
    else if (m.state === 'walk') {
        const s = m.currentStone;
        if (!s || s.mined) { m.state = 'find_stone'; return; }
        const dx = m.stand.x - m.x, dy = m.stand.y - m.y, dist = Math.hypot(dx, dy);
        if (dist <= m.walkSpeed) {
            // arrived at the fixed mining spot beside the stone
            m.x = m.stand.x; m.y = m.stand.y;
            m.facing = s.x > m.x ? 1 : -1;
            m.state = 'mine'; m.swingPhase = 0; m.hasHit = false;
        } else {
            if (Math.abs(dx) > 1) m.facing = dx > 0 ? 1 : -1;
            m.walkCycle += 0.22;
            m.x += (dx / dist) * m.walkSpeed;
            m.y += (dy / dist) * m.walkSpeed;
        }
    }
    else if (m.state === 'mine') {
        const s = m.currentStone;
        if (!s || s.mined) { m.state = 'find_stone'; return; }
        m.facing = s.x > m.x ? 1 : -1;
        m.swingPhase += m.swingSpeed;

        if (m.swingPhase > Math.PI * 0.55 && m.swingPhase < Math.PI * 0.75 && !m.hasHit) {
            m.hasHit = true;
            const hx = s.x - m.facing * s.radius * 0.85;
            const hy = m.y - 2;
            createSparks(hx, hy, 14);
            createRockChips(hx, hy, 6 + Math.round(s.radius / 12), s.y + s.radius * 0.45);
            spawnLoot(hx, hy, 2 + Math.floor(Math.random() * 2), true);
            s.shake = 7;
            s.hp--;
            if (s.hp <= 0) {
                s.mined = true;
                createGoldBurst(s.x, s.y);
                spawnLoot(s.x, s.y - 10, 2 + Math.floor(s.radius / 25));
                createRockChips(s.x, s.y, 22, s.y + s.radius * 0.45);
                createChunks(s.x, s.y, s.radius, s.y + s.radius * 0.45);
                // pause here until the loot has flown into the bag
                m.state = 'collect'; m.swingPhase = 0; m.hasHit = false; m.pause = 0;
            }
        }
        if (m.swingPhase > Math.PI * 1.1) { m.swingPhase = 0; m.hasHit = false; }
    }
    else if (m.state === 'collect') {
        // miner stands still while gems fly into the bag; then a short beat before moving on
        if (loot.length === 0) {
            m.pause++;
            if (m.pause > 25) { m.state = 'find_stone'; m.pause = 0; }
        }
    }
    else if (m.state === 'exit') {
        m.walkCycle += 0.22;
        m.facing = m.exitDirection;
        m.x += m.exitDirection * m.walkSpeed * 1.4;
        if (!transitioning && ((m.exitDirection === 1 && m.x > canvas.width + 50) || (m.exitDirection === -1 && m.x < -50))) {
            transitioning = true; transitionAlpha = 0; transitionPhase = 'out';
        }
    }

    if (transitioning) {
        if (transitionPhase === 'out') {
            transitionAlpha += 0.04;
            if (transitionAlpha >= 1) {
                transitionAlpha = 1;
                caveScene = generateCaveScene();
                m.x = canvas.width / 2; m.y = canvas.height / 2 + 100;
                m.state = 'find_stone'; m.currentStone = null; m.swingPhase = 0; m.hasHit = false;
                particles.length = 0;
                loot.length = 0; bag.count = 0; bag.sparks = 0; bag.x = m.x - 36; bag.y = m.y + 34;
                transitionPhase = 'in';
            }
        } else {
            transitionAlpha -= 0.04;
            if (transitionAlpha <= 0) { transitionAlpha = 0; transitioning = false; }
        }
    }
}

// ============ MAIN LOOP ============
// The mining page can be hidden (another tab active) while this script keeps
// running in the background — skip the (fairly heavy) draw work in that case
// and just keep the rAF chain alive so it picks back up instantly when the
// user returns to the Mining tab, with no restart/flicker.
function caveIsVisible(){
    const page = document.getElementById('page-mining');
    return !!page && page.classList.contains('active');
}
let paused = false, pausedDrawn = false;
function animate() {
    if (caveIsVisible() && !(paused && pausedDrawn)) {
        if (paused) pausedDrawn = true;
        drawCaveBackground();
        drawFossils();
        drawCaveWalls();
        drawGoldVeins();
        drawCrystals();
        drawStalactites();
        drawStalagmites();
        drawTorches();
        if (!resting) caveScene.stones.forEach(drawStone);
        if (resting) {
            restT += 0.05;
            drawRestScene();
        } else {
            if (!paused) { updateMiner(); updateBag(); }
            drawBag();
            drawMiner();
            drawLoot();
            drawParticles();
        }
        drawVignette();
        drawRewardOverlay();
        drawTransition();
    }
    requestAnimationFrame(animate);
}
animate();

// ============ EXTERNAL CONTROL API (used by app.js) ============
// app.js is the single source of truth for whether a miner is actively
// mining or on cooldown (computed from Firebase timestamps), and for which
// skin the admin assigned to the active miner. This animation just reflects
// that state — it never invents or persists mining truth of its own.
window.MiningCave = {
    // id: one of the MINER_SKINS ids above (falls back to the first skin).
    setSkin(id){ const prev = currentSkin; setSkinById(id); if (prev !== currentSkin) pausedDrawn = false; },
    setPaused(v){ v = !!v; if (v !== paused) { paused = v; pausedDrawn = false; } },
    // v: true while on cooldown / nothing actively mining right now.
    setResting(v){
        v = !!v;
        if (v !== resting) { resting = v; pausedDrawn = false; if (resting) restT = 0; }
    },
    skins: MINER_SKINS.map(s => ({ id: s.id, name: s.name, icon: s.icon, color: s.skin }))
};
