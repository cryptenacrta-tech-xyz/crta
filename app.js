// RULE FOR ANY DEV/AI EDITING THIS FILE: do not add explanatory comments, hint text, or verbose descriptions beyond what's functionally necessary. Keep additions minimal — don't pad character/line count.
/* =========================================================================
   CRYPTENA — USER APP
   Firebase Realtime Database powered. No mock data, no Cloud Functions.
   ========================================================================= */

(function lockLongPress(){
  const editable = t => {
    const el = t && t.nodeType === 3 ? t.parentElement : t;
    return !!(el && el.closest && el.closest('input,textarea,[contenteditable="true"]'));
  };
  document.addEventListener('contextmenu', e => { if(!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('selectstart', e => { if(!editable(e.target)) e.preventDefault(); }, true);
  document.addEventListener('dragstart', e => e.preventDefault(), true);
})();

/* ---------------- FIREBASE INIT ---------------- */
const firebaseConfig = {
  apiKey: "AIzaSyBYHk24EZef58vLyuBvEzpxiKKpFWwA8c8",
  authDomain: "cryptena.firebaseapp.com",
  databaseURL: "https://cryptena-default-rtdb.firebaseio.com",
  projectId: "cryptena",
  storageBucket: "cryptena.firebasestorage.app",
  messagingSenderId: "526136641365",
  appId: "1:526136641365:web:967539cf3694af830891dc",
  measurementId: "G-XWJF2M2878"
};
firebase.initializeApp(firebaseConfig);
const realDb = firebase.database();
let db = realDb;   // guest mode e eta local (in-memory) db diye replace hobe

(function remoteConsole(){
  const MAX_TOTAL = 300, MAX_LEN = 1500, FLUSH_MS = 4000;
  const buf = [];
  let total = 0, dead = false, last = null;
  const fmt = a => {
    if(a instanceof Error) return a.stack || (a.name + ': ' + a.message);
    if(typeof a === 'string') return a;
    if(a === undefined) return 'undefined';
    try{ const s = JSON.stringify(a); return s === undefined ? String(a) : s; }catch(e){ return String(a); }
  };
  const add = (level, args) => {
    if(dead || total >= MAX_TOTAL) return;
    let msg;
    try{ msg = Array.prototype.map.call(args, fmt).join(' ').slice(0, MAX_LEN); }catch(e){ return; }
    if(!msg) return;
    if(last && last.level === level && last.msg === msg && buf.indexOf(last) >= 0){ last.n++; return; }
    total++;
    last = { t: Date.now(), level, msg, n: 1 };
    buf.push(last);
    if(total === MAX_TOTAL) buf.push({ t: Date.now(), level: 'warn', msg: 'Log limit reached for this session', n: 1 });
  };
  ['log', 'info', 'warn', 'error', 'debug'].forEach(level => {
    const orig = console[level];
    console[level] = function(){ try{ add(level, arguments); }catch(e){} return orig.apply(console, arguments); };
  });
  window.addEventListener('error', e => {
    add('error', [(e.message || 'Script error') + (e.filename ? ' @ ' + String(e.filename).split('/').pop() + ':' + e.lineno + ':' + e.colno : '')]);
  });
  window.addEventListener('unhandledrejection', e => { add('error', ['Unhandled promise rejection:', e.reason]); });
  const flush = () => {
    if(dead || !buf.length) return;
    let id, uname, name;
    try{
      if(IS_GUEST || !uid) return;
      id = uid; uname = (me && me.username) || ''; name = (me && me.firstName) || '';
    }catch(e){ return; }
    const batch = buf.splice(0, buf.length);
    const up = {};
    batch.forEach(l => { up[realDb.ref('consoleLogs').push().key] = { t: l.t, uid: id, username: uname, name, level: l.level, msg: l.msg, n: l.n }; });
    realDb.ref('consoleLogs').update(up).catch(() => { dead = true; buf.length = 0; });
  };
  setInterval(flush, FLUSH_MS);
  document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'hidden') flush(); });
})();
const SERVER_INC = (n) => firebase.database.ServerValue.increment(n);

/* ---------------- TELEGRAM MINI APP SETUP ---------------- */
const tg = window.Telegram && window.Telegram.WebApp;
(function initTelegram(){
  try{
    if(tg){
      tg.ready();
      // Size/fullscreen mode is intentionally NOT forced here — it follows whatever
      // is configured for this Mini App in BotFather (FullSize / Fullscreen).
      if(tg.disableVerticalSwipes) tg.disableVerticalSwipes();
      try{ tg.setHeaderColor('#080b1e'); }catch(e){}
      try{ tg.setBackgroundColor('#080b1e'); }catch(e){}
      const applyViewportHeight = ()=>{
        const h = tg.viewportStableHeight || tg.viewportHeight || window.innerHeight;
        document.documentElement.style.setProperty('--tg-vh', h + 'px');
      };
      const applySafeArea = ()=>{
        const sa = tg.safeAreaInset || {}, ca = tg.contentSafeAreaInset || {};
        const top = (Number(sa.top)||0) + (Number(ca.top)||0);
        const bottom = (Number(sa.bottom)||0) + (Number(ca.bottom)||0);
        const root = document.documentElement.style;
        root.setProperty('--safe-top', top > 0 ? top + 'px' : 'env(safe-area-inset-top, 0px)');
        root.setProperty('--safe-bottom', bottom > 0 ? bottom + 'px' : 'env(safe-area-inset-bottom, 0px)');
      };
      applySafeArea();
      ['safeAreaChanged','contentSafeAreaChanged','fullscreenChanged'].forEach(ev=>{ if(tg.onEvent) tg.onEvent(ev, applySafeArea); });
      applyViewportHeight();
      tg.onEvent && tg.onEvent('viewportChanged', applyViewportHeight);
      window.addEventListener('resize', applyViewportHeight);
    } else {
      document.documentElement.style.setProperty('--tg-vh', window.innerHeight + 'px');
      window.addEventListener('resize', ()=>{
        document.documentElement.style.setProperty('--tg-vh', window.innerHeight + 'px');
      });
    }
  }catch(e){
    document.documentElement.style.setProperty('--tg-vh', '100vh');
  }
})();

/* ---------------- NAV ---------------- */
// Full-screen pages (no bottom nav, own header + back button)
const SUB_PAGES = ['deposit','withdraw','notifications'];
let currentPage = 'home';
const pageStack = [];

/* Task icon — same icon as the admin sidebar's Task item (bottom nav + anywhere tagged data-nav="task") */
(function applyTaskIcon(){
  const PATHS = '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>';
  const apply = () => {
    document.querySelectorAll('[data-nav="task"] svg, [data-goto="task"] svg').forEach(svg => {
      svg.setAttribute('viewBox','0 0 24 24');
      svg.setAttribute('fill','none');
      svg.setAttribute('stroke','currentColor');
      svg.setAttribute('stroke-width','2');
      svg.setAttribute('stroke-linecap','round');
      svg.setAttribute('stroke-linejoin','round');
      svg.innerHTML = PATHS;
    });
  };
  apply();
  document.addEventListener('DOMContentLoaded', apply);
})();

function showPage(name, keepScroll){
  const el = document.getElementById('page-'+name);
  if(!el) return;
  document.querySelectorAll('.page, .fs-page').forEach(p=>p.classList.remove('active'));
  el.classList.add('active');
  const isSub = SUB_PAGES.indexOf(name) !== -1;
  document.body.classList.toggle('sub-open', isSub);
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.toggle('active', n.dataset.nav===name));
  currentPage = name;
  if(!isSub && !keepScroll) window.scrollTo(0,0);
  syncTgBackButton();
}
function goTo(name){
  if(SUB_PAGES.indexOf(name) !== -1){
    if(currentPage !== name) pageStack.push(currentPage);
  } else {
    pageStack.length = 0;
  }
  showPage(name);
}
function goBack(){
  const prev = pageStack.pop() || 'home';
  showPage(prev, true);
}
function syncTgBackButton(){
  try{
    if(!(tg && tg.initData && tg.BackButton)) return;
    if(SUB_PAGES.indexOf(currentPage) !== -1) tg.BackButton.show(); else tg.BackButton.hide();
  }catch(e){}
}
try{ if(tg && tg.initData && tg.BackButton) tg.BackButton.onClick(goBack); }catch(e){}

/* ---------------- HTML ESCAPE ---------------- */
function esc(v){
  return String(v == null ? '' : v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
/* Round logo/icon box: shows a fallback letter until the image (direct link) loads */
function logoBox(url, fallback, cls){
  const img = url ? `<img src="${esc(url)}" alt="" onload="this.previousElementSibling.style.display='none'" onerror="this.remove()">` : '';
  return `<div class="${cls}"><span>${esc(fallback)}</span>${img}</div>`;
}

/* ---------------- WALLET HELPERS ---------------- */
// masked view: first 4 + ****** + last 6  (e.g. ckdi******rjdiej). Full address is never shown to the user.
function maskAddr(a){
  a = String(a || '');
  if(a.length > 12) return a.slice(0,4) + '******' + a.slice(-6);
  if(a.length > 4)  return a.slice(0,2) + '******' + a.slice(-2);
  return a ? '******' : '';
}
function hasWallet(u){
  const w = (u || me) && (u || me).wallets;
  return !!w && Object.keys(w).some(k => w[k]);
}
// gate for daily claim / mining: a connected wallet is required
function requireWallet(what){
  if(hasWallet()) return true;
  showToast(T('t_connect_wallet_first') + what);
  openWallet();
  return false;
}

/* ---------------- TELEGRAM AVATAR ---------------- */
function avatarInner(photoUrl, letter){
  const img = photoUrl ? `<img src="${esc(photoUrl)}" alt="" referrerpolicy="no-referrer" onerror="this.remove()">` : '';
  return `<span>${esc(letter)}</span>${img}`;
}
function tgUserInfo(){
  return (tg && tg.initDataUnsafe && tg.initDataUnsafe.user) || null;
}
// top bar: Telegram profile picture + Telegram name (falls back to the saved user record)
function renderBrand(){
  const t = tgUserInfo();
  const src = t || me;
  if(!src) return;
  const first = t ? t.first_name : src.firstName;
  const last  = t ? t.last_name  : src.lastName;
  const uname = t ? t.username   : src.username;
  const name  = ((first||'') + (last ? ' '+last : '')).trim() || uname || 'Cryptena';
  const photo = (t && t.photo_url) || (me && me.photoUrl) || '';
  const av = document.getElementById('brand-avatar');
  const nm = document.getElementById('brand-name');
  if(nm) nm.innerHTML = esc(name);
  if(av){
    const key = photo + '|' + name.charAt(0);
    if(av.dataset.key !== key){
      av.dataset.key = key;
      av.innerHTML = avatarInner(photo, name.charAt(0).toUpperCase());
    }
  }
}

/* ---------------- TOAST ---------------- */
let toastTimer;
function showToast(msg){
  const t = document.getElementById('toast');
  t.textContent = (typeof TT === 'function') ? TT(msg) : msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>t.classList.remove('show'), 2200);
}

/* ---------------- GLOBAL CACHES ---------------- */
// 30-day cycle, rising from 0.42 to 1.58 CRTA (+0.04/day) — claiming all 30 days pays exactly 30 CRTA → reward balance
const DAILY_REWARDS = Array.from({length:30}, (_,i)=>Math.round((0.42+i*0.04)*100)/100);
const fmtReward = n => Number(n).toFixed(2);
let me = null;              // live snapshot of users/{uid}
let uid = null;
let settings = {
  swapRate:0.85,
  supportUrl:'https://t.me/Cryptena_Support', telegramChannelUrl:'https://t.me/Cryptena_Official', botUsername:'cryptenaBot',
  activeAdNetwork:'monetag', monetagZoneId:'', adsgramBlockId:'', botToken:''
};
let depositMethods = {};
let withdrawMethods = {};
let badgesCache = {};
let minersCache = {};
let tasksCache = {};
let notifCache = {};
let leaderboardCache = [];
let miningTickInterval = null;
let currentTxTab = 'all';
let currentTaskTab = 'all';
let userSocialCache = {};
let socialTaskId = null, socialImage = null, socialBusy = false;
let userAccountCache = {};
let accountTaskId = null, accountBusy = false, accountStep = 'copy';
let modalMode = 'deposit';
let selectedMethodId = null;

/* ---------------- REFERRAL CODE GEN ----------------
   Format (8 chars): 2 letters from name + 4 chars from UID + 1 random A-Z + 1 random 0-9 */
function genReferralCode(nameSeed, idSeed){
  const letters = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
  const digits = '0123456789';
  const nameClean = (nameSeed || 'U').trim().toUpperCase().replace(/[^A-Z]/g,'');
  const namePart = (nameClean || 'U').padEnd(2,'X').slice(0,2);
  const idClean = String(idSeed).replace(/[^A-Za-z0-9]/g,'').toUpperCase();
  const idPart = idClean.slice(-4).padStart(4,'X');
  const randLetter = letters.charAt(Math.floor(Math.random()*letters.length));
  const randDigit = digits.charAt(Math.floor(Math.random()*digits.length));
  return namePart + idPart + randLetter + randDigit;
}
async function generateUniqueReferralCode(nameSeed, idSeed){
  for(let i=0;i<8;i++){
    const code = genReferralCode(nameSeed, idSeed);
    const snap = await db.ref('referralIndex/'+code).get();
    if(!snap.exists()) return code;
  }
  // extremely unlikely fallback: still 8 chars, seeded with time to force a new random tail
  return genReferralCode(nameSeed, idSeed + Date.now());
}

/* =========================================================================
   GUEST MODE (browser testing)
   Telegram er baire (normal browser e) khulle app guest hisebe chalbe.
   - Shared data (settings, tasks, badges, methods, leaderboard, notifications)
     real Firebase theke READ hoy.
   - Guest user er sob data + sob WRITE shudhu browser memory te thake.
     Firebase e kono write jay na. Page refresh dile guest data reset hoy.
   Production e guest mode bondho korte: ALLOW_GUEST_MODE = false
   ========================================================================= */
const ALLOW_GUEST_MODE = true;
const GUEST_OVERRIDES = {          // test er subidhar jonno guest er starting value
  crpt: 200,                       // earning balance (CRTA) — mining / tasks / daily reward
  depositBalance: 500,             // deposit balance — only from deposits, swaps to CRTA (badge %)
  usdBalance: 100                  // USD — withdrawable
};
let IS_GUEST = false;

function createGuestDb(realDb, guestUid){
  const store = {};
  const listeners = [];
  let flushQueued = false;

  const parts = p => String(p || '').split('/').filter(Boolean);
  const clone = v => (v === undefined || v === null) ? null : JSON.parse(JSON.stringify(v));
  const isSV = v => v && typeof v === 'object' && Object.prototype.hasOwnProperty.call(v, '.sv');
  const isLocalPath = p => p === 'users/' + guestUid || p.indexOf('users/' + guestUid + '/') === 0;

  function getAt(path){
    let n = store;
    for(const k of parts(path)){
      if(n === null || typeof n !== 'object' || !(k in n)) return null;
      n = n[k];
    }
    return n === undefined ? null : n;
  }

  // ServerValue.TIMESTAMP / increment() local-e resolve kora
  function resolveValue(val, old){
    if(val === null || val === undefined) return null;
    if(isSV(val)){
      const sv = val['.sv'];
      if(sv === 'timestamp') return Date.now();
      if(sv && typeof sv === 'object' && 'increment' in sv) return (typeof old === 'number' ? old : 0) + Number(sv.increment);
      return null;
    }
    if(typeof val === 'object'){
      const out = {};
      Object.keys(val).forEach(k=>{
        const r = resolveValue(val[k], (old && typeof old === 'object') ? old[k] : undefined);
        if(r !== null) out[k] = r;
      });
      return Object.keys(out).length ? out : null;
    }
    return val;
  }

  function setAt(path, val){
    const keys = parts(path);
    if(!keys.length){
      Object.keys(store).forEach(k=> delete store[k]);
      const r = resolveValue(val, null);
      if(r && typeof r === 'object') Object.assign(store, r);
      return;
    }
    let n = store;
    for(let i = 0; i < keys.length - 1; i++){
      if(n[keys[i]] === null || typeof n[keys[i]] !== 'object') n[keys[i]] = {};
      n = n[keys[i]];
    }
    const last = keys[keys.length - 1];
    const r = resolveValue(val, n[last]);
    if(r === null) delete n[last]; else n[last] = r;
  }

  function makeSnap(path){
    const val = clone(getAt(path));
    const key = parts(path).pop() || null;
    const snap = {
      key,
      exists: () => val !== null,
      val: () => clone(val),
      forEach: cb => {
        if(val && typeof val === 'object'){
          for(const k of Object.keys(val)){
            const child = { key: k, exists: () => true, val: () => clone(val[k]) };
            if(cb(child) === true) break;
          }
        }
        return false;
      }
    };
    return snap;
  }

  function queueFlush(){
    if(flushQueued) return;
    flushQueued = true;
    Promise.resolve().then(()=>{
      flushQueued = false;
      listeners.slice().forEach(l=>{
        const cur = JSON.stringify(getAt(l.path));
        if(cur !== l.last){ l.last = cur; l.cb(makeSnap(l.path)); }
      });
    });
  }

  function write(path, val){ setAt(path, val); queueFlush(); return Promise.resolve(); }
  function updateAt(path, obj){
    Object.keys(obj || {}).forEach(k=> setAt(parts(path).concat(parts(k)).join('/'), obj[k]));
    queueFlush();
    return Promise.resolve();
  }

  function makeRef(rawPath){
    const path = parts(rawPath).join('/');
    const local = isLocalPath(path);
    const real = () => path ? realDb.ref(path) : realDb.ref();
    const ref = {
      key: parts(path).pop() || null,
      get: () => local ? Promise.resolve(makeSnap(path)) : real().get(),
      on: (ev, cb) => {
        if(!local) return real().on(ev, cb);          // shared data: real Firebase (read-only)
        const l = { path, cb, last: null };
        listeners.push(l);
        Promise.resolve().then(()=>{ l.last = JSON.stringify(getAt(path)); cb(makeSnap(path)); });
        return cb;
      },
      off: (ev, cb) => {
        if(!local) return real().off(ev, cb);
        for(let i = listeners.length - 1; i >= 0; i--) if(listeners[i].path === path && (!cb || listeners[i].cb === cb)) listeners.splice(i, 1);
      },
      // ---- WRITE: shob local memory te, Firebase e kokhono na ----
      set: v => write(path, v),
      update: obj => updateAt(path, obj),
      remove: () => write(path, null),
      push: v => {
        const key = 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        const child = makeRef(path + '/' + key);
        if(v === undefined) return child;
        const p = child.set(v);
        child.then = p.then.bind(p);
        child.catch = p.catch.bind(p);
        return child;
      },
      transaction: (fn, cb) => {
        const cur = clone(getAt(path));
        const out = fn(cur);
        const committed = out !== undefined;
        if(committed) write(path, out);
        if(cb) cb(null, committed, makeSnap(path));
        return Promise.resolve({committed});
      },
      orderByChild: c => real().orderByChild(c)       // leaderboard query: real read
    };
    return ref;
  }

  return { ref: makeRef };
}

function showGuestBadge(){
  const bar = document.querySelector('.top-actions');
  if(!bar || document.getElementById('guest-pill')) return;
  const pill = document.createElement('div');
  pill.id = 'guest-pill';
  pill.className = 'guest-pill';
  pill.textContent = 'GUEST · not saved';
  pill.onclick = ()=> showToast(T('t_guest_mode_note'));
  bar.prepend(pill);
}

/* ---------------- CLIENT INFO (device type + public IP) ----------------
   • device: read straight from Telegram (tg.platform / tg.version) + user agent — no permission needed
   • ip: PUBLIC IP via api.ipify.org. A phone's LOCAL/LAN IP (192.168.x.x) cannot be read reliably
     from a web view, and it is useless for multi-account checks anyway.
   • signupIp: written once (first IP ever seen) and never overwritten                              */
function getDeviceInfo(){
  const ua = navigator.userAgent || '';
  const platform = (tg && tg.platform) || 'unknown';
  let type = 'desktop';
  if(/iPad|Tablet|PlayBook|Silk/i.test(ua) || (/Android/i.test(ua) && !/Mobile/i.test(ua))) type = 'tablet';
  else if(/Mobi|Android|iPhone|iPod/i.test(ua) || ['android','android_x','ios'].indexOf(platform) >= 0) type = 'mobile';
  return { type, platform, tgVersion: (tg && tg.version) || '', userAgent: ua.slice(0, 200) };
}
async function fetchPublicIp(){
  try{
    const ctl = new AbortController();
    const t = setTimeout(()=>ctl.abort(), 4000);
    const r = await fetch('https://api.ipify.org?format=json', { signal: ctl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = await r.json();
    return (j && j.ip) ? String(j.ip) : '';
  }catch(e){ return ''; }
}
async function saveClientInfo(){
  if(IS_GUEST || !uid) return;
  const ip = await fetchPublicIp();
  if(!ip) return;
  await db.ref('users/'+uid).update({ ip, ipUpdatedAt: firebase.database.ServerValue.TIMESTAMP });
  db.ref('users/'+uid+'/signupIp').transaction(cur => cur || ip);
}

/* Snapshot of the referrer's code + commission % (from THEIR level) at the moment someone joins through them.
   The real payout % is still decided on the admin side when the referred user withdraws. */
async function referrerSnapshot(refUid){
  const out = { code: '', badge: DEFAULT_BADGE_ID, normal: 0, active: 0 };
  try{
    const [cSnap, bSnap] = await Promise.all([
      db.ref('users/'+refUid+'/referralCode').get(),
      db.ref('users/'+refUid+'/badge').get()
    ]);
    out.code = cSnap.exists() ? String(cSnap.val()||'') : '';
    const bid = (bSnap.exists() && bSnap.val()) ? String(bSnap.val()) : DEFAULT_BADGE_ID;
    let b = badgesCache[bid];
    if(!b){ const s = await db.ref('badges/'+bid).get(); b = s.exists() ? s.val() : {}; }
    out.badge = bid;
    out.normal = Number(b.normalReferCommission) || 0;
    out.active = Number(b.activeReferCommission) || 0;
  }catch(e){}
  return out;
}

/* ---------------- BOOT ---------------- */
async function boot(){
  // loading screen is visible only while data loads; show a hint if the network is slow
  setTimeout(()=>{
    const ls = document.getElementById('loading-screen');
    if(ls && ls.style.display !== 'none'){ const h = document.getElementById('loading-slow'); if(h) h.classList.add('show'); }
  }, 8000);
  // safety net: never let loading-screen block the app/background forever
  // (e.g. Firebase unreachable, blocked, or boot() throws before the normal hide-path runs)
  setTimeout(()=>{
    const ls = document.getElementById('loading-screen');
    if(ls && ls.style.display !== 'none') ls.style.display = 'none';
  }, 15000);
  try{
  let tgUser = tg && tg.initDataUnsafe && tg.initDataUnsafe.user;
  let startParam = '';
  if(!tgUser || !tgUser.id){
    if(!ALLOW_GUEST_MODE){
      document.getElementById('loading-screen').innerHTML =
        '<div style="font-size:34px;">📱</div><div style="color:var(--dim);font-size:13px;font-weight:600;max-width:260px;text-align:center;">Please open Cryptena from inside Telegram to continue.</div>';
      return;
    }
    // ---- GUEST MODE: Telegram chhara browser e open ----
    IS_GUEST = true;
    const guestId = 'guest_' + Math.random().toString(36).slice(2, 8);
    tgUser = { id: guestId, username: 'guest', first_name: 'Guest', last_name: 'User' };
    db = createGuestDb(realDb, guestId);
    showGuestBadge();
  } else {
    startParam = (tg.initDataUnsafe && tg.initDataUnsafe.start_param) || '';
  }
  uid = String(tgUser.id);
  renderBrand();

  const userRef = db.ref('users/'+uid);
  const snap = await userRef.get();

  if(!snap.exists()){
    const nameSeed = tgUser.username || tgUser.first_name || 'U';
    const code = await generateUniqueReferralCode(nameSeed, uid);

    let referredByUid = null;
    const refCode = String(startParam||'').trim().replace(/^ref_/i,'').toUpperCase();
    if(refCode){
      try{
        const idxSnap = await db.ref('referralIndex/'+refCode).get();
        if(idxSnap.exists() && idxSnap.val() !== uid) referredByUid = idxSnap.val();
      }catch(e){}
    }
    if(!referredByUid && !IS_GUEST){
      try{
        const pend = await db.ref('pendingReferrals/'+uid).get();
        const pr = pend.exists() ? pend.val() : null;
        if(pr && pr.referrerUid && String(pr.referrerUid) !== uid){
          const chk = await db.ref('users/'+pr.referrerUid+'/referralCode').get();
          if(chk.exists()) referredByUid = String(pr.referrerUid);
        }
      }catch(e){}
    }

    const newUser = {
      uid, telegramId: uid,
      username: tgUser.username || '',
      firstName: tgUser.first_name || '',
      lastName: tgUser.last_name || '',
      photoUrl: tgUser.photo_url || '',
      device: getDeviceInfo(),
      // ---- 3 separate balances ----
      crpt: 0,                // 1) earning balance (CRTA) — mining, tasks, daily reward. Swaps to USD at the admin rate.
      depositBalance: 0,      // 2) deposit balance — ONLY from accepted deposits. Swaps to CRTA (kept % = badge "Deposit swap %"). Never withdrawable.
      usdBalance: 0,          // 3) USD — the withdrawable balance (CRTA->USD swaps + referral commission)
      referralCode: code,
      referredBy: referredByUid,
      referralsNormal: 0,
      referralsActive: 0,
      referEarned: 0,
      wallets: {},
      badge: DEFAULT_BADGE_ID,
      status: 'active',
      createdAt: firebase.database.ServerValue.TIMESTAMP,
      lastSeen: firebase.database.ServerValue.TIMESTAMP,
      streakDay: 1,
      streak: 0,
      claimedToday: false,
      lastClaimDate: '',
      miner: {id:'', active:false, startedAt:0, cooldownUntil:0},
      ownedMiners: {},
      totalMining: 0, totalTask: 0, totalWithdraw: 0, totalDeposit: 0,
      todayDeposit: 0, todayDepositDate: '', todayReferrals: 0, todayReferralsDate: '',
      minedToday: 0, minedTodayDate: ''
    };
    if(IS_GUEST) Object.assign(newUser, GUEST_OVERRIDES);
    await userRef.set(newUser);
    await db.ref('referralIndex/'+code).set(uid);

    // Referral counts only if the referrer has a connected wallet.
    if(referredByUid){
      try{
        const wSnap = await db.ref('users/'+referredByUid+'/wallets').get();
        if(!hasWallet({wallets: wSnap.val() || {}})) referredByUid = null;
      }catch(e){ referredByUid = null; }
      if(!referredByUid) await userRef.update({referredBy: null});
    }
    if(referredByUid){
      const snapR = await referrerSnapshot(referredByUid);
      // No CRTA is paid out just for a new referral joining. Referral
      // earnings only happen as a % commission when this referred user
      // withdraws — that's handled on the admin side at withdraw approval.
      const refUpdates = {};
      refUpdates['users/'+referredByUid+'/referralsNormal'] = SERVER_INC(1);
      refUpdates['users/'+uid+'/referredByCode'] = snapR.code;
      refUpdates['users/'+uid+'/referredByCommission'] = { normal: snapR.normal, active: snapR.active, badge: snapR.badge };
      refUpdates['users/'+referredByUid+'/referrals/'+uid] = {
        name: (tgUser.first_name||tgUser.username||'New user'),
        username: tgUser.username || '',
        photoUrl: tgUser.photo_url || '',
        joinedAt: firebase.database.ServerValue.TIMESTAMP,
        status: 'normal'
      };
      await db.ref().update(refUpdates);
      bumpTodayReferrals(referredByUid).catch(()=>{});
      notifyNewReferral(referredByUid, tgUser);
    }
    if(!IS_GUEST) db.ref('pendingReferrals/'+uid).remove().catch(()=>{});
  } else {
    const sync = {lastSeen: firebase.database.ServerValue.TIMESTAMP};
    if(!IS_GUEST){
      if(tgUser.first_name != null) sync.firstName = tgUser.first_name || '';
      if(tgUser.last_name != null || snap.val().lastName) sync.lastName = tgUser.last_name || '';
      sync.username = tgUser.username || '';
      if(tgUser.photo_url) sync.photoUrl = tgUser.photo_url;
      sync.device = getDeviceInfo();
    }
    userRef.update(sync);
    // existing account that never joined through a referrer: apply a link it clicked in the bot
    applyLateReferral();
  }

  saveClientInfo().catch(()=>{});

  // realtime listeners
  db.ref('settings/general').on('value', s=>{
    const prevNet = settings.activeAdNetwork, prevM = settings.monetagZoneId, prevA = settings.adsgramBlockId;
    if(s.exists()) Object.assign(settings, s.val());
    if(!String(settings.botUsername||'').trim()) settings.botUsername = 'cryptenaBot';
    if(!String(settings.supportUrl||'').trim()) settings.supportUrl = 'https://t.me/Cryptena_Support';
    if(!String(settings.telegramChannelUrl||'').trim()) settings.telegramChannelUrl = 'https://t.me/Cryptena_Official';
    if(!settings.activeAdNetwork) settings.activeAdNetwork = 'monetag';
    if(prevNet!==settings.activeAdNetwork || prevM!==settings.monetagZoneId || prevA!==settings.adsgramBlockId){
      resetAdSdkCache();
    }
    refreshSwapUI();
    if(me) renderHome();      // live "≈ USD" estimate follows the admin's swap rate
  });
  db.ref('depositMethods').on('value', s=>{ depositMethods = s.val()||{}; renderDepositMethods(); });
  db.ref('withdrawMethods').on('value', s=>{ withdrawMethods = s.val()||{}; renderWithdrawPage(); });
  db.ref('badges').on('value', s=>{
    badgesCache = s.val()||{};
    renderBadges();
    if(me){ renderBrand(); renderProfile(); renderHomeProfileHead(); renderLeaderboard(); renderWithdrawPage(); }
  });
  db.ref('tasks').on('value', s=>{ tasksCache = s.val()||{}; renderTaskTabs(); renderTasks(); });
  db.ref('userSocial/'+uid).on('value', s=>{ userSocialCache = s.val()||{}; renderTasks(); });
  db.ref('userAccount/'+uid).on('value', s=>{ userAccountCache = s.val()||{}; renderTasks(); });
  // bot saved a referral click while the app is already open -> apply it right away (only if still un-referred)
  if(!IS_GUEST) db.ref('pendingReferrals/'+uid).on('value', s=>{ if(s.exists() && me && !me.referredBy) applyLateReferral(); });
  db.ref('miners').on('value', s=>{ minersCache = s.val()||{}; renderMinersList(); if(me) renderMiningStatic(); });
  db.ref('users').orderByChild('totalMining').limitToLast(50).on('value', s=>{
    const arr = [];
    s.forEach(c=>{ arr.push(Object.assign({uid:c.key}, c.val())); });
    arr.reverse();
    leaderboardCache = arr;
    renderLeaderboard();
    renderHomeRank();
  });

  userRef.on('value', s=>{
    if(!s.exists()) return;
    me = Object.assign({uid}, s.val());
    if(me.status === 'banned'){
      document.getElementById('loading-screen').style.display = 'none';
      document.getElementById('banned-screen').style.display = 'flex';
      return;
    }
    document.getElementById('loading-screen').style.display = 'none';
    document.getElementById('banned-screen').style.display = 'none';
    checkDailyReset();
    resumeMining();
    renderAll();
  });

  listenNotifications();
  startPresence();
  }catch(e){
    console.error('boot() failed:', e);
    const ls = document.getElementById('loading-screen');
    if(ls) ls.style.display = 'none';
  }
}

function dayStr(offset){ return new Date(Date.now()+offset*86400000).toISOString().slice(0,10); }
// Bump targetUid's "today referrals" counter (resets to 1 when the stored date has rolled over).
// NOTE: this only touches the two child fields (todayReferrals / todayReferralsDate) — never the
// whole users/<uid> node. A whole-node transaction needs read+write access to the referrer's entire
// record, which a *different* user (the one who just joined) doesn't have, so it failed silently and
// the counter stayed 0. The Home card no longer depends on this counter alone — see todayReferCount().
function bumpTodayReferrals(targetUid){
  const today = dayStr(0);
  const base = db.ref('users/'+targetUid);
  return base.child('todayReferralsDate').get().then(s=>{
    if(s.val() !== today) return base.update({ todayReferrals: 1, todayReferralsDate: today });
    return base.child('todayReferrals').transaction(n => (Number(n)||0) + 1);
  });
}
// "Today refer" shown on Home. The source of truth is the referrals list itself (each entry has a
// joinedAt server timestamp) — the same list shown on the Refer tab — so it can never disagree with it.
// The stored counter is only used as a fallback (whichever is higher wins). "Today" = UTC day, same as
// the daily reward / mining / deposit resets.
function todayReferCount(){
  if(!me) return 0;
  const today = dayStr(0);
  const dayStart = Date.parse(today+'T00:00:00Z');
  const fromList = me.referrals ? Object.values(me.referrals).filter(r => r && Number(r.joinedAt) >= dayStart).length : 0;
  const fromCounter = me.todayReferralsDate === today ? (Number(me.todayReferrals)||0) : 0;
  return Math.max(fromList, fromCounter);
}
let presenceStarted = false;
function startPresence(){
  if(presenceStarted || IS_GUEST || !uid) return;
  presenceStarted = true;
  let lastDay = null, busy = false, lastAt = 0;
  const beat = async () => {
    if(busy || document.visibilityState === 'hidden' || Date.now()-lastAt < 20000) return;
    busy = true; lastAt = Date.now();
    try{
      const day = dayStr(0);
      if(lastDay === null) lastDay = (await db.ref('presence/'+uid+'/d').get()).val() || '';
      const up = {};
      if(lastDay !== day) up['stats/daily/'+day+'/active'] = SERVER_INC(1);
      up['stats/daily/'+day+'/mins'] = SERVER_INC(1);
      up['presence/'+uid] = {t: firebase.database.ServerValue.TIMESTAMP, d: day};
      await db.ref().update(up);
      lastDay = day;
    }catch(e){}
    busy = false;
  };
  beat();
  setInterval(beat, 60000);
  document.addEventListener('visibilitychange', beat);
}
function checkDailyReset(){
  const today = dayStr(0), yesterday = dayStr(-1);
  const updates = {};
  const last = me.lastClaimDate || '';
  const day = me.streakDay || 1;
  if(me.streak === undefined){
    updates.streak = Math.max(0, day-1);
    if(last && last !== today && me.claimedToday) updates.claimedToday = false;
  } else if(last && last !== today){
    if(last === yesterday){
      if(me.claimedToday){ updates.claimedToday = false; updates.streakDay = day < DAILY_REWARDS.length ? day+1 : 1; }
    } else if(me.claimedToday || me.streak || day !== 1){
      updates.claimedToday = false; updates.streakDay = 1; updates.streak = 0;
    }
  }
  if(me.minedTodayDate !== today){ updates.minedToday = 0; updates.minedTodayDate = today; }
  if(me.todayDepositDate !== today){ updates.todayDeposit = 0; updates.todayDepositDate = today; }
  if(me.todayReferralsDate !== today){ updates.todayReferrals = 0; updates.todayReferralsDate = today; }
  if(Object.keys(updates).length){ db.ref('users/'+uid).update(updates); }
}
setInterval(()=>{ if(me && uid) checkDailyReset(); }, 60000);

function renderAll(){
  renderBrand();
  renderHome();
  renderRefer();
  renderProfile();
  renderBadges();
  renderTransactions();
  renderMiningStatic();
  refreshSwapUI();
  renderSwapHistory();
  renderWithdrawPage();
  renderWalletMethodList();
}

/* ---------------- TRANSACTIONS LOG HELPER ---------------- */
function pushTxLocal(forUid, type, title, amt){
  if(!forUid) return;
  db.ref('users/'+forUid+'/txlog').push({
    type, title, amt: (amt>=0?'+':'')+Number(amt).toFixed(4)+' CRTA', time: firebase.database.ServerValue.TIMESTAMP
  });
}
function pushTx(type, title, amt, unit){
  db.ref('users/'+uid+'/txlog').push({
    type, title, amt: (amt>=0?'+':'')+Number(amt).toFixed(4)+' '+(unit||'CRTA'), time: firebase.database.ServerValue.TIMESTAMP
  });
}

/* =========================================================================
   AD NETWORK SYSTEM (Monetag / Adsgram)
   Exactly one network is active at a time (admin picks it in Settings).
   Every "gated" button needs the user to watch one rewarded ad before the
   real action runs. While locked the button shows a lock icon + "Watch 1 ad
   to unlock" INSTEAD of its normal icon + name. 1st click = show the ad;
   ad watched = the button flips back to its own icon + name (unlocked);
   2nd click = the real action runs and the button re-locks for next time.
   If the ad fails/is skipped, nothing happens — no unlock, no action.
   (Deposit / Withdraw shortcuts, Level and Transactions are NOT gated.)
   ========================================================================= */
let adsgramController = null, adsgramLoadedBlockId = null;
let monetagLoadedZoneId = null, monetagScriptEl = null;

// Wipe cached SDK state — called whenever admin changes the active network or its id,
// so the next ad request always uses the freshest zone/block id.
function resetAdSdkCache(){
  adsgramController = null; adsgramLoadedBlockId = null;
  monetagLoadedZoneId = null;
}

function ensureAdsgramLoaded(blockId){
  return new Promise((resolve, reject)=>{
    if(window.Adsgram && adsgramController && adsgramLoadedBlockId===blockId){ resolve(adsgramController); return; }
    function init(){
      try{
        adsgramController = window.Adsgram.init({ blockId });
        adsgramLoadedBlockId = blockId;
        resolve(adsgramController);
      }catch(e){ reject(e); }
    }
    if(window.Adsgram){ init(); return; }
    let script = document.getElementById('adsgram-sdk-tag');
    if(!script){
      script = document.createElement('script');
      script.id = 'adsgram-sdk-tag';
      script.src = 'https://sad.adsgram.ai/js/sad.min.js';
      document.head.appendChild(script);
    }
    script.addEventListener('load', init, {once:true});
    script.addEventListener('error', ()=>reject(new Error('adsgram-sdk-failed')), {once:true});
    if(window.Adsgram) init();
  });
}

function ensureMonetagLoaded(zoneId){
  const fnName = 'show_' + zoneId;
  return new Promise((resolve, reject)=>{
    if(monetagLoadedZoneId===zoneId && typeof window[fnName]==='function'){ resolve(fnName); return; }
    if(monetagScriptEl) monetagScriptEl.remove();
    monetagScriptEl = document.createElement('script');
    monetagScriptEl.id = 'monetag-sdk-tag';
    monetagScriptEl.src = '//libtl.com/sdk.js';
    monetagScriptEl.setAttribute('data-zone', zoneId);
    monetagScriptEl.setAttribute('data-sdk', fnName);
    monetagScriptEl.onerror = () => reject(new Error('monetag-sdk-failed'));
    monetagScriptEl.onload = () => {
      let tries = 0;
      (function check(){
        if(typeof window[fnName]==='function'){ monetagLoadedZoneId = zoneId; resolve(fnName); }
        else if(tries++ < 50){ setTimeout(check, 100); }
        else reject(new Error('monetag-sdk-not-ready'));
      })();
    };
    document.head.appendChild(monetagScriptEl);
  });
}

// Shows one rewarded ad using whichever network admin currently has active.
// Resolves when the user watched it through; rejects on any failure/skip/misconfiguration.
function showActiveRewardedAd(){
  const net = settings.activeAdNetwork==='adsgram' ? 'adsgram' : 'monetag';
  if(net==='adsgram'){
    const blockId = (settings.adsgramBlockId||'').trim();
    if(!blockId) return Promise.reject(new Error('ad-not-configured'));
    return ensureAdsgramLoaded(blockId).then(ctrl => ctrl.show());
  }
  const zoneId = (settings.monetagZoneId||'').trim();
  if(!zoneId) return Promise.reject(new Error('ad-not-configured'));
  return ensureMonetagLoaded(zoneId).then(fnName => window[fnName]());
}

// key -> true once the user has watched an ad for that specific button and hasn't used it yet
const adGateUnlocked = {};
// key -> the real action to run once unlocked. Filled in near the bottom of this file,
// once every action/navigation function below has been declared.
const AD_GATE_ACTIONS = {};

function adGateEls(key){
  return document.querySelectorAll('[data-ad-gate="'+key+'"]');
}
function renderAdGate(key){
  const unlocked = !!adGateUnlocked[key];
  adGateEls(key).forEach(el=>{
    el.classList.toggle('ad-locked', !unlocked);
    el.classList.remove('ad-loading');
  });
}
// injects the "lock icon + Watch 1 ad to unlock" view next to the button's own icon + label (.ag-main)
function buildAdGateLock(el){
  if(el.querySelector(':scope > .ag-lock')) return;
  const lock = document.createElement('span');
  lock.className = 'ag-lock';
  lock.innerHTML = lockSvg + '<span>Watch 1 ad to unlock</span>';
  el.insertBefore(lock, el.firstChild);
}
function initAdGates(){
  document.querySelectorAll('[data-ad-gate]').forEach(buildAdGateLock);
  Object.keys(AD_GATE_ACTIONS).forEach(key=>{ adGateUnlocked[key] = false; renderAdGate(key); });
}
// change a gated button's visible name without touching its icon / lock view
function setBtnLabel(target, text){
  const el = typeof target === 'string' ? document.getElementById(target) : target;
  if(!el) return;
  const l = el.querySelector('.ag-label');
  (l || el).textContent = text;
}
function adGateClick(key){
  const action = AD_GATE_ACTIONS[key];
  if(!action) return;
  if(adGateUnlocked[key]){
    // already unlocked by a previously watched ad — consume it and run the real action
    adGateUnlocked[key] = false;
    renderAdGate(key);
    action();
    return;
  }
  adGateEls(key).forEach(el=>el.classList.add('ad-loading'));
  showActiveRewardedAd().then(()=>{
    adGateUnlocked[key] = true;
    renderAdGate(key);
    showToast(T('t_ad_watched'));
  }).catch(err=>{
    adGateEls(key).forEach(el=>el.classList.remove('ad-loading'));
    if(err && err.message==='ad-not-configured'){
      showToast(T('t_ads_not_setup'));
    } else {
      showToast(T('t_ad_not_completed'));
    }
  });
}

/* ---------------- HOME BALANCE ----------------
   Big number = total balance (CRTA earning balance + deposit balance), animated.
   Small line = live USD value of CRTA-only, if swapped now (CRTA x admin's swap rate). */
let lastRenderedBalance = null;
function swapRate(){ return Number(settings.swapRate) || 0; }
function paintHomeBalance(totalVal){
  const balEl = document.getElementById('home-balance');
  const usdEl = document.getElementById('home-balance-usd');
  if(!balEl || !usdEl) return;
  balEl.innerHTML = totalVal.toFixed(4) + ' <span class="unit">CRTA</span>';
  const crptOnly = me.crpt || 0;
  usdEl.innerHTML = '≈ $' + (crptOnly * swapRate()).toFixed(4) + ' USD';
}
function firstWalletAddr(){
  const w = me && me.wallets;
  if(!w) return '';
  const id = Object.keys(w).find(k => w[k]);
  return id ? w[id] : '';
}
function renderHome(){
  const addr = firstWalletAddr();
  const wallEl = document.getElementById('bc-wallet');
  if(wallEl) wallEl.textContent = addr ? maskAddr(addr) : 'Connect wallet';
  const newBal = (me.crpt || 0) + (me.depositBalance || 0);
  if(lastRenderedBalance===null || Math.abs(newBal-lastRenderedBalance) <= 0.0001){
    paintHomeBalance(newBal);
  } else {
    const from = lastRenderedBalance;
    const dur = 550; const start = performance.now();
    function tick(now){
      const p = Math.min((now-start)/dur,1);
      const eased = 1-Math.pow(1-p,3);
      paintHomeBalance(from + (newBal-from)*eased);
      if(p<1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  }
  lastRenderedBalance = newBal;
  document.getElementById('home-stat-usd').textContent = '$'+(me.usdBalance||0).toFixed(2);
  document.getElementById('home-stat-crta').textContent = (me.crpt||0).toFixed(2);
  renderStreak();
  renderHomeRank();
  renderHomeProfileHead();
  renderHomeMining();
  renderHomeWithdrawLimit();
}
// Home-page profile card: avatar, name, "Level: [emoji]" + "Next: NextLevelName", XP bar + "x / y XP".
// Mirrors renderProfileLevelBar() exactly — SAME badge data + SAME functions the Profile/Levels
// pages already use (allBadges/isBadgeUnlocked/badgeRequirementChecks/badgeProgressPct/badgeXpRequired)
// so Home never drifts out of sync with Profile: no numeric "Lv. N" here, just the current level's
// emoji/icon (like Profile) and the next level's real name.
function renderHomeProfileHead(){
  if(!me) return;
  const av = document.getElementById('home-pf-avatar');
  if(av) av.innerHTML = avatarInner((tgUserInfo() && tgUserInfo().photo_url) || me.photoUrl || '', initials(me));
  const nm = document.getElementById('home-pf-name');
  if(nm) nm.textContent = displayName(me);
  const fill = document.getElementById('home-pf-level-bar-fill');
  if(!fill) return;
  const all = allBadges();
  const ids = Object.keys(all);
  const cur = myBadge();
  const iconEl = document.getElementById('home-pf-level-icon');
  if(iconEl){
    iconEl.innerHTML = (cur.imageType==='emoji' && cur.emoji) ? esc(cur.emoji)
      : (cur.imageUrl ? `<img src="${esc(cur.imageUrl)}" alt="" onerror="this.remove()">` : '🔰');
  }
  const labelEl = document.getElementById('home-pf-level-label');
  if(labelEl) labelEl.textContent = 'Level:';
  let target = null;
  for(const id of ids){ if(!isBadgeUnlocked(id)){ target = all[id]; break; } }
  const roleEl = document.getElementById('home-pf-level-role');
  if(roleEl) roleEl.textContent = target ? ('Next: '+(target.name||'—')) : 'Max level reached';
  const pct = target ? badgeProgressPct(badgeRequirementChecks(target)) : 100;
  fill.style.width = Math.max(0,Math.min(100,pct)) + '%';
  const xpTarget = badgeXpRequired(target || cur);
  const xpCurrent = target ? Math.round(xpTarget * pct / 100) : xpTarget;
  const xpEl = document.getElementById('home-pf-xp');
  if(xpEl) xpEl.textContent = xpCurrent.toLocaleString()+' / '+xpTarget.toLocaleString()+' XP';
}
// Full-width "current mining" progress card below the home leaderboard. Reads the
// SAME live numbers as the mining page (activeMinerConfig/minerStoredAmount/minerCapAmount)
// and is refreshed every second from tickMining(), so it's a true live mirror, not a snapshot.
function renderHomeMining(){
  const fill = document.getElementById('home-mine-bar-fill');
  if(!fill || !me) return;
  const nameEl = document.getElementById('home-mine-name');
  const pctEl = document.getElementById('home-mine-pct');
  const nextEl = document.getElementById('home-mine-next');
  const cfg = activeMinerConfig();
  if(!cfg){
    if(nameEl) nameEl.textContent = 'Not mining';
    fill.style.width = '0%';
    if(pctEl) pctEl.textContent = '0%';
    if(nextEl) nextEl.textContent = 'Start a miner to begin';
    return;
  }
  const cap = minerCapAmount(cfg);
  const stored = minerStoredAmount();
  const pct = cap > 0 ? Math.min(100, (stored/cap)*100) : 0;
  if(nameEl) nameEl.textContent = cfg.name || 'Miner';
  fill.style.width = pct.toFixed(2) + '%';
  if(pctEl) pctEl.textContent = Math.floor(pct) + '%';
  if(nextEl) nextEl.textContent = stored.toFixed(4)+' / '+cap.toFixed(4)+' CRTA'+(pct>=100?' · Ready to claim':'');
}
// Home-page mirror of the withdraw page's monthly-limit card, same source functions.
function renderHomeWithdrawLimit(){
  const card = document.getElementById('home-wd-limit-card');
  if(!card || !me) return;
  const limit = myMonthlyWithdrawLimit();
  const used = limit <= 0 ? 0 : Math.min(myWithdrawUsedThisMonth(), limit);
  const remaining = Math.max(0, limit - used);
  const blocked = limit <= 0 || remaining <= 0;
  document.getElementById('home-wd-used').textContent = used+' / '+limit;
  document.getElementById('home-wd-remaining').textContent = String(remaining);
  document.getElementById('home-wd-used-row').classList.toggle('limit-blocked', blocked);
  document.getElementById('home-wd-remaining-row').classList.toggle('limit-blocked', blocked);
  const barFill = document.getElementById('home-wd-bar-fill');
  if(barFill) barFill.style.width = (limit>0 ? Math.min(100,(used/limit)*100) : 0) + '%';
}
function renderHomeRank(){
  if(!me) return;
  const idx = leaderboardCache.findIndex(u=>u.uid===me.uid);
  document.getElementById('home-rank').textContent = idx>=0 ? '#'+(idx+1) : '—';
}

// Shows a sliding 7-day window instead of all 30 at once (looks cluttered otherwise).
// The window always starts at the current claimable day, e.g. Day1 -> [1..6] + pinned Day30,
// after claiming Day1 -> [2..7] + pinned Day30, ... so the user can always see the full
// 30-day cycle length. Once close enough to the end it stops sliding and just shows the
// final 7 days, [24..30], since Day 30 is already naturally inside that window.
function renderStreak(animateIdx){
  const grid = document.getElementById('streak-grid');
  const rewards = DAILY_REWARDS;
  grid.innerHTML = '';
  const total = DAILY_REWARDS.length;
  const windowSize = 7;
  const currentDay = me.streakDay || 1;
  const remaining = total - currentDay + 1;   // days left from today through Day 30
  let days;
  if(remaining <= windowSize){
    const start = Math.max(1, total - windowSize + 1);
    days = []; for(let i=start;i<=total;i++) days.push(i);
  } else {
    days = []; for(let i=currentDay;i<currentDay+windowSize-1;i++) days.push(i);
    days.push(total);   // pin Day 30 as the 7th tile so the 30-day length is always visible
  }
  days.forEach((i, idx)=>{
    const done = i < me.streakDay || (i===me.streakDay && me.claimedToday);
    const today = i === me.streakDay && !me.claimedToday;
    const pinned = idx>0 && (i - days[idx-1]) > 1;   // there's a gap right before this tile
    const div = document.createElement('div');
    div.className = 'day-cell' + (done?' done':'') + (today?' today':'') + (i===total?' final-day':'') + (pinned?' pinned-final':'');
    if(animateIdx===i) div.classList.add('claim-pop');
    div.innerHTML = (done? '<svg class="check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M20 6L9 17l-5-5"/></svg>':'') +
      '<div class="lbl">'+T('day_word')+' '+i+'</div><div class="amt">'+fmtReward(rewards[i-1])+'</div>';
    grid.appendChild(div);
  });
  const btn = document.getElementById('claim-btn');
  // no wallet yet = no ad needed, the button just sends the user to connect one (so no lock view)
  btn.classList.toggle('ad-bypass', !me.claimedToday && !hasWallet());
  if(me.claimedToday){
    btn.disabled = true;
    setBtnLabel(btn, T('daily_claimed_lbl'));
  } else if(!hasWallet()){
    btn.disabled = false;
    setBtnLabel(btn, T('daily_connect_claim'));
  } else {
    btn.disabled = false;
    setBtnLabel(btn, T('daily_claim_plus').replace('{a}', fmtReward(rewards[(me.streakDay||1)-1])));
  }
}

function claimDaily(){
  if(!me || me.claimedToday) return;
  if(!requireWallet('claim your daily reward')) return;
  const day = me.streakDay || 1;
  const reward = DAILY_REWARDS[day-1];
  db.ref('users/'+uid).update({
    crpt: SERVER_INC(reward),         // reward balance
    claimedToday: true,
    lastClaimDate: dayStr(0),
    streak: (me.streak||0)+1
  }).then(()=>{
    pushTx('task', 'Daily check-in reward (Day '+day+')', reward, 'CRTA');
    showToast(T('t_daily_reward_claimed').replace('{a}', fmtReward(reward)));
    renderStreak(day);
  });
}

/* ---------------- LEADERBOARD ---------------- */
function initials(u){
  const n = u.firstName || u.username || 'U';
  return n.charAt(0).toUpperCase();
}
function displayName(u){
  return (u.firstName || '') + (u.lastName ? ' '+u.lastName : '') || u.username || 'User';
}
function renderLeaderboard(){
  const box = document.getElementById('home-leaderboard');
  if(!box) return;
  if(!leaderboardCache.length){ box.innerHTML = '<div class="empty-state">No miners yet — be the first!</div>'; return; }
  const top3 = leaderboardCache.slice(0,3);
  const rest = leaderboardCache.slice(3,15);
  const podiumHtml = `<div class="podium">
    ${top3.map((u,i)=>{
      const rank=i+1;
      return `<div class="podium-slot rank${rank}">
        ${rank===1?'<div class="crown">👑</div>':''}
        <div class="podium-avatar">${avatarInner(u.photoUrl, initials(u))}</div>
        <div class="podium-name">${nameWithBadgeHtml(u)}</div>
        <div class="podium-sub">${esc(badgeLabel(u))}</div>
        <div class="podium-amt">${(u.totalMining||0).toFixed(2)}</div>
        <div class="podium-base">#${rank}</div>
      </div>`;
    }).join('')}
  </div>`;
  const restHtml = `<div class="lb-rest">${rest.map((u,i)=>`
    <div class="lb-row">
      <div class="lb-rank">#${i+4}</div>
      <div class="lb-avatar">${avatarInner(u.photoUrl, initials(u))}</div>
      <div class="lb-info"><div class="lb-name">${nameWithBadgeHtml(u)}</div><div class="lb-sub">${esc(badgeLabel(u))}</div></div>
      <div class="lb-amt">${(u.totalMining||0).toFixed(2)}</div>
    </div>`).join('')}</div>`;
  box.innerHTML = podiumHtml + restHtml;
}

/* ---------------- PROFILE ---------------- */
function renderProfile(){
  document.getElementById('pf-avatar').innerHTML = avatarInner((tgUserInfo() && tgUserInfo().photo_url) || me.photoUrl || '', initials(me));
  document.getElementById('pf-name').textContent = displayName(me);
  document.getElementById('pf-username').textContent = me.username ? '@'+me.username : '';
  document.getElementById('pf-uid').textContent = 'UID: '+me.uid;
  document.getElementById('pf-crpt').textContent = (me.crpt||0).toFixed(2);
  document.getElementById('pf-deposit').textContent = (me.depositBalance||0).toFixed(2);
  document.getElementById('pf-usd').textContent = '$'+(me.usdBalance||0).toFixed(2);
  document.getElementById('pf-total-refer').textContent = me.referralsNormal||0;
  document.getElementById('pf-active-refer').textContent = me.referralsActive||0;
  document.getElementById('pf-total-withdraw').textContent = (me.totalWithdraw||0).toFixed(2);
  document.getElementById('pf-total-task').textContent = me.totalTask||0;
  document.getElementById('pf-total-mining').textContent = (me.totalMining||0).toFixed(2);
  document.getElementById('pf-total-deposit').textContent = (me.totalDeposit||0).toFixed(2);
  const walletCount = Object.keys((me.wallets)||{}).length;
  document.getElementById('wallet-val').textContent = walletCount ? (walletCount+' connected') : 'Not linked';
  renderProfileLevelBar();
}
// Visual-only addition: live "level progress" bar for the profile header.
// Reuses the SAME badge data + the SAME functions the Levels page already uses
// (allBadges/isBadgeUnlocked/badgeRequirementChecks/badgeProgressPct/badgeXpRequired)
// — no new business logic, no new numbers. "Level:" shows ONLY the current
// level's emoji (no number, no current name). Next to it is the NEXT level's
// name. The bar + "x / y XP" both track progress toward that next level.
function renderProfileLevelBar(){
  const fill = document.getElementById('pf-level-bar-fill');
  if(!fill || !me) return;
  const all = allBadges();
  const ids = Object.keys(all);
  const cur = myBadge();
  const iconEl = document.getElementById('pf-level-icon');
  if(iconEl){
    iconEl.innerHTML = (cur.imageType==='emoji' && cur.emoji) ? esc(cur.emoji)
      : (cur.imageUrl ? `<img src="${esc(cur.imageUrl)}" alt="" onerror="this.remove()">` : '🔰');
  }
  const labelEl = document.getElementById('pf-level-label');
  if(labelEl) labelEl.textContent = 'Level:';
  let target = null;
  for(const id of ids){ if(!isBadgeUnlocked(id)){ target = all[id]; break; } }
  const nextEl = document.getElementById('pf-level-next');
  if(nextEl) nextEl.textContent = target ? ('Next: '+(target.name||'—')) : 'Max level reached';
  const pct = target ? badgeProgressPct(badgeRequirementChecks(target)) : 100;
  fill.style.width = Math.max(0,Math.min(100,pct)) + '%';
  const xpTarget = badgeXpRequired(target || cur);
  const xpCurrent = target ? Math.round(xpTarget * pct / 100) : xpTarget;
  const xpEl = document.getElementById('pf-level-xp');
  if(xpEl) xpEl.textContent = xpCurrent.toLocaleString()+' / '+xpTarget.toLocaleString()+' XP';
}

/* ---------------- WALLET CONNECT (per withdraw method) ---------------- */
// All enabled withdraw methods, regardless of whether a wallet is connected yet.
// Used on the "Connect wallet" picker page.
function allEnabledWithdrawMethods(){
  return Object.entries(withdrawMethods).filter(([id,m])=> m && m.enabled !== false);
}

function renderWalletMethodList(){
  const list = document.getElementById('wallet-method-list');
  if(!list || !me) return;
  const wallets = me.wallets || {};
  const entries = allEnabledWithdrawMethods();
  list.innerHTML = entries.length ? entries.map(([id,m])=>{
    const connected = !!wallets[id];
    return `
    <div class="method-card${connected?' selected wallet-locked':''}" data-id="${esc(id)}" onclick="openWalletAddress(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'mc-logo')}
      <div class="mc-info">
        <div class="mc-name">${esc(m.name||'Method')}</div>
        ${connected ? `<div class="mc-addr">${esc(maskAddr(wallets[id]))}</div>` : ''}
      </div>
      <div class="mc-side">
        <span class="fee-tag">${connected ? '✓ Connected' : 'Connect'}</span>
        ${connected ? `<span class="lock-ic">${lockSvg}</span>` : ''}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No withdraw methods available right now</div>';
}

function openWallet(){
  const limit = myMaxWalletConnect();
  if(limit>0 && me && Object.keys(me.wallets||{}).length >= limit){
    showToast(T('t_wallet_limit')+limit+T('t_wallet_limit_suffix').replace('{s}', limit==1?'':'s'));
    return;
  }
  renderWalletMethodList();
  const title = document.getElementById('wallet-sheet-title');
  const back = document.getElementById('wallet-sheet-back');
  const note = document.getElementById('wallet-method-note');
  const label = document.getElementById('wallet-method-label');
  const list = document.getElementById('wallet-method-list');
  const addrBlock = document.getElementById('wallet-address-block');
  const footer = document.getElementById('wallet-sheet-footer');
  title.textContent = 'Connect wallet';
  back.style.display = 'none';
  note.style.display = ''; label.style.display = ''; list.style.display = '';
  addrBlock.style.display = 'none'; footer.style.display = 'none';
  selectedWalletMethodId = null;
  document.getElementById('sheet-wallet').classList.add('active');
}
function closeWalletSheet(){
  document.getElementById('sheet-wallet').classList.remove('active');
  selectedWalletMethodId = null;
}

let selectedWalletMethodId = null;
function openWalletAddress(id){
  const m = withdrawMethods[id];
  if(!m) return;
  if(me && me.wallets && me.wallets[id]){ showToast(T('t_wallet_locked')); return; }
  const limit = myMaxWalletConnect();
  if(limit>0 && me && Object.keys(me.wallets||{}).length >= limit){
    showToast(T('t_wallet_limit')+limit+T('t_wallet_limit_suffix').replace('{s}', limit==1?'':'s'));
    return;
  }
  selectedWalletMethodId = id;
  document.getElementById('wallet-sheet-title').textContent = 'Confirm your ' + (m.name||'wallet') + ' wallet connection';
  document.getElementById('wallet-sheet-back').style.display = '';
  document.getElementById('wallet-method-note').style.display = 'none';
  document.getElementById('wallet-method-label').style.display = 'none';
  document.getElementById('wallet-method-list').style.display = 'none';
  document.getElementById('wallet-address-block').style.display = '';
  document.getElementById('wallet-sheet-footer').style.display = '';
  document.getElementById('wallet-address-input').value = '';
}
function walletSheetBack(){
  openWallet();
}

function saveWalletAddress(){
  const id = selectedWalletMethodId;
  const m = id ? withdrawMethods[id] : null;
  if(!m){ showToast(T('t_select_method_first')); openWallet(); return; }
  const val = document.getElementById('wallet-address-input').value.trim();
  if(!val){ showToast(T('t_enter_valid_wallet')); return; }
  if(val.length < 6){ showToast(T('t_wallet_too_short')); return; }
  if(me && me.wallets && me.wallets[id]){ showToast(T('t_wallet_already_connected')); closeWalletSheet(); return; }
  const doSave = ()=>{
    // write-once: transaction only writes if nothing is stored yet
    db.ref('users/'+uid+'/wallets/'+id).transaction(cur => cur ? undefined : val, (err, committed)=>{
      if(err){ showToast(T('t_something_wrong')); return; }
      if(!committed){ showToast(T('t_wallet_already_connected')); closeWalletSheet(); return; }
      db.ref('users/'+uid+'/walletInfo/'+id).set({ methodId: id, methodName: m.name||'', connectedAt: firebase.database.ServerValue.TIMESTAMP }).catch(()=>{});
      showToast((m.name||T('t_default_wallet'))+T('t_connected_suffix'));
      closeWalletSheet();
    });
  };
  const msg = 'Connect ' + maskAddr(val) + ' to ' + (m.name||'this method') + '?\n\nThis is permanent. You will not be able to edit, change or remove it.';
  if(tg && tg.initData && tg.showConfirm) tg.showConfirm(msg, ok=>{ if(ok) doSave(); });
  else if(window.confirm(msg)) doSave();
}

/* ---------------- BADGES ----------------
   * "default" badge: every user owns + wears it from the very start. Admin can edit it, never delete it.
   * Every other badge is LOCKED until: the admin's unlock rule is reached, or the admin grants it.
   ---------------------------------------------------------------- */
const DEFAULT_BADGE_ID = 'default';
const DEFAULT_BADGE = {
  name: 'Starter', imageUrl: '', imageType: 'emoji', emoji: '⭐',
  isDefault: true,
  normalReferCount: 0, normalReferCommission: 0,
  activeReferCount: 0, activeReferCommission: 0,
  depositFeePercent: 0, withdrawFeePercent: 0, depositSwapPercent: 0,
  minerLevelMin: 0, minerLevelMax: 0,
  maxWalletConnect: 0, monthlyWithdrawLimit: 0,
  reqDepositBalance: 0, reqTotalDeposit: 0, requiredTasks: {}, customRequired: ''
};
/* Renders a badge's icon: an emoji (if the admin picked that) or the direct-link image, else a fallback. */
function badgeIconHtml(b, cls){
  if(b && b.imageType==='emoji' && b.emoji){
    return `<div class="${cls}" style="display:flex;align-items:center;justify-content:center;font-size:22px;line-height:1;">${esc(b.emoji)}</div>`;
  }
  return logoBox(b && b.imageUrl, '🔰', cls);
}
// all badges, default first (works even if admin never created it in the DB yet)
function allBadges(){
  const out = {};
  out[DEFAULT_BADGE_ID] = Object.assign({}, DEFAULT_BADGE, badgesCache[DEFAULT_BADGE_ID] || {}, { isDefault: true });
  Object.keys(badgesCache).forEach(id=>{ if(id !== DEFAULT_BADGE_ID) out[id] = badgesCache[id]; });
  return out;
}
function activeBadgeId(){
  const all = allBadges();
  return (me && me.badge && all[me.badge]) ? me.badge : DEFAULT_BADGE_ID;
}
// PATH: this always reads the badge id straight off the user's own record (me.badge), looks it
// up in the live badges list, and returns that badge's object — so whatever % the admin set on
// THAT badge (ref commission, fees, boosts...) is exactly what this user gets, everywhere below.
function myBadge(){
  return allBadges()[activeBadgeId()] || DEFAULT_BADGE;
}
// Deposit balance -> CRTA: the % of the swapped deposit balance the user KEEPS (the rest is deducted).
// It comes from the active badge's "Deposit swap %". CRTA -> USD is NOT affected by badges (admin rate only).
function depositSwapPct(){
  return Math.max(0, Math.min(100, Number(myBadge().depositSwapPercent) || 0));
}
// how many wallets the user's active badge lets them connect (0 = no limit)
function myMaxWalletConnect(){
  return Math.max(0, Number(myBadge().maxWalletConnect) || 0);
}
/* ---------------- MONTHLY WITHDRAWAL LIMIT ----------------
   "monthlyWithdrawLimit" = max number of withdrawals (pending + accepted) a user
   can submit during the current calendar month. 0 = NO withdrawals this month —
   this is NEVER "unlimited". The used-count is a per-user, per-month counter at
   users/{uid}/withdrawMonthly/{YYYY-MM}, incremented atomically (Firebase transaction)
   at submission time and released by the admin panel if a request is rejected, so
   rejected withdrawals never count against the limit.
   ------------------------------------------------------------------------------- */
function currentWithdrawMonthKey(){
  const d = new Date();
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0');
}
function myMonthlyWithdrawLimit(){
  return Math.max(0, Number(myBadge().monthlyWithdrawLimit) || 0);
}
function myWithdrawUsedThisMonth(){
  const mk = currentWithdrawMonthKey();
  return Math.max(0, Number(me && me.withdrawMonthly && me.withdrawMonthly[mk]) || 0);
}
function badgeLabel(u){
  const all = allBadges();
  return (all[(u && u.badge) || DEFAULT_BADGE_ID] || all[DEFAULT_BADGE_ID]).name || 'Miner';
}
function activeBadgeFor(u){
  const all = allBadges();
  return all[(u && u.badge) || DEFAULT_BADGE_ID] || all[DEFAULT_BADGE_ID];
}
// small inline icon for whichever badge the user actually has equipped — emoji or direct-link image, whichever is set
function badgeIconInlineHtml(u){
  const b = activeBadgeFor(u);
  if(!b) return '';
  if(b.imageType==='emoji' && b.emoji) return `<span class="name-badge-emoji">${esc(b.emoji)}</span>`;
  if(b.imageUrl) return `<img class="name-badge-img" src="${esc(b.imageUrl)}" alt="" onerror="this.remove()">`;
  return '';
}
// display name with the user's current badge (emoji or image) appended, e.g. "Xushar💸"
function nameWithBadgeHtml(u){
  return `${esc(displayName(u))}${badgeIconInlineHtml(u)}`;
}
function isBadgeUnlocked(id){
  if(id === DEFAULT_BADGE_ID) return true;
  return !!me && (!!(me.unlockedBadges && me.unlockedBadges[id]) || me.badge === id);
}
// The badge's own "Required" numbers (set by admin) vs. the user's live stats.
// Each entry: label shown to the user, how much they have, how much they need.
// Only stat-backed requirements are checked here — custom text requirements can't be measured automatically.
function badgeRequirementChecks(b){
  const checks = [];
  if(Number(b.normalReferCount)>0) checks.push({ have: Number(me && me.referralsNormal)||0, need: Number(b.normalReferCount), label: 'Normal referrals', unit: '' });
  if(Number(b.activeReferCount)>0) checks.push({ have: Number(me && me.referralsActive)||0, need: Number(b.activeReferCount), label: 'Active referrals', unit: '' });
  if(Number(b.reqDepositBalance)>0) checks.push({ have: Number(me && me.depositBalance)||0, need: Number(b.reqDepositBalance), label: 'Deposit balance', unit: 'CRTA' });
  if(Number(b.reqTotalDeposit)>0) checks.push({ have: Number(me && me.totalDeposit)||0, need: Number(b.reqTotalDeposit), label: 'Total deposited', unit: 'CRTA' });
  Object.entries(b.requiredTasks||{}).forEach(([cat,n])=>{
    if(Number(n)>0) checks.push({ have: taskCatDoneCount(cat), need: Number(n), label: (TASK_TAB_LABELS[cat]||cat)+' tasks', unit: '' });
  });
  return checks;
}
// ONE overall progress number for a badge: the average completion of every measurable requirement
// (each one capped at 100%). floor() so it never shows 100% until every requirement is truly met.
function badgeProgressPct(checks){
  if(!checks.length) return 0;
  const sum = checks.reduce((a,c)=> a + Math.min(1, Math.max(0, c.have / c.need)), 0);
  return Math.floor((sum / checks.length) * 100 + 1e-9);
}
// true once every stat-based requirement on the badge is met — this is what unlocks the
// "Watch 1 ad to unlock" button. (Custom text requirements are informational only.)
function badgeRequirementsMet(b){
  if(!me) return false;
  return badgeRequirementChecks(b).every(c => c.have >= c.need);
}
/* XP is a derived display number, not an admin-set field: a level that asks for more
   (more referrals, more tasks, a bigger deposit) simply costs more XP. Weights below are
   an arbitrary but fixed scale — every level's XP requirement grows with its own real
   requirement checks, so heavier levels always read as "more XP" than lighter ones. */
function badgeXpRequired(b){
  if(!b) return 0;
  const taskCount = Object.values(b.requiredTasks||{}).reduce((a,n)=>a+Number(n||0),0);
  const xp = 500
    + Number(b.normalReferCount||0)*60
    + Number(b.activeReferCount||0)*120
    + Number(b.reqDepositBalance||0)*0.5
    + Number(b.reqTotalDeposit||0)*0.3
    + taskCount*40;
  return Math.round(xp);
}
function fmtProg(n){ return Number(n).toLocaleString(undefined,{maximumFractionDigits:2}); }
// Auto-generated text — the admin never types this. It's built straight from the badge's
// field values, mirroring the exact same generator used on the admin side.
function badgeRequiredParts(b){
  const parts = [];
  if(Number(b.normalReferCount)>0) parts.push(b.normalReferCount+' normal referrals');
  if(Number(b.activeReferCount)>0) parts.push(b.activeReferCount+' active referrals');
  if(Number(b.reqDepositBalance)>0) parts.push('Current deposit balance ≥ '+b.reqDepositBalance+' CRTA');
  if(Number(b.reqTotalDeposit)>0) parts.push('Total deposited ≥ '+b.reqTotalDeposit+' CRTA');
  Object.entries(b.requiredTasks||{}).forEach(([cat,n])=>{
    if(Number(n)>0) parts.push(n+' '+(TASK_TAB_LABELS[cat]||cat)+' task'+(n==1?'':'s')+' completed');
  });
  if(b.customRequired) parts.push(b.customRequired);
  return parts;
}
function badgeBenefitParts(b){
  const parts = [];
  if(Number(b.normalReferCommission)>0) parts.push(b.normalReferCommission+'% commission per normal referral');
  if(Number(b.activeReferCommission)>0) parts.push(b.activeReferCommission+'% commission per active referral');
  if(Number(b.depositFeePercent)>0) parts.push('Deposit fee '+b.depositFeePercent+'%');
  if(Number(b.withdrawFeePercent)>0) parts.push('Withdraw fee '+b.withdrawFeePercent+'%');
  if(Number(b.depositSwapPercent)>0) parts.push('Deposit → CRTA swap '+b.depositSwapPercent+'%');
  if(Number(b.minerLevelMin)>0 || Number(b.minerLevelMax)>0) parts.push('Unlocks miner level '+(b.minerLevelMin||0)+'–'+(b.minerLevelMax||0));
  if(Number(b.maxWalletConnect)>0) parts.push('Connect up to '+b.maxWalletConnect+' wallet'+(b.maxWalletConnect==1?'':'s'));
  parts.push(Number(b.monthlyWithdrawLimit)>0
    ? 'Up to '+b.monthlyWithdrawLimit+' withdrawal'+(b.monthlyWithdrawLimit==1?'':'s')+' / month'
    : 'No withdrawals allowed this month');
  return parts;
}
// short, user-facing summary of what a badge actually gives — shown on every badge card
function badgePerksHtml(b){
  const parts = badgeBenefitParts(b);
  return parts.length ? `<div class="bi-benbox"><div class="bi-rhead"><span>Benefits</span></div><div class="bi-perks">${parts.map(p=>`<span class="bi-perk-chip">${esc(p)}</span>`).join('')}</div></div>` : '';
}
const tickSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
const infoSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.6v.01"/></svg>';
const xpSvg = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13 2 3 14h7l-1 8 11-14h-7l1-6z"/></svg>';
// Small "current / target XP" line shown on EVERY level card (locked or not) so users can see
// exactly how much XP each level costs — not just the one they're currently working towards.
// Unlocked badges show the full amount (already earned); locked ones show live progress,
// using the SAME per-requirement checks (and the same weighted formula) as badgeXpRequired.
function badgeXpRowHtml(b, unlocked, checks){
  const xpTarget = badgeXpRequired(b);
  if(!xpTarget) return '';
  const pct = unlocked ? 100 : badgeProgressPct(checks);
  const xpCurrent = unlocked ? xpTarget : Math.round(xpTarget * pct / 100);
  return `<div class="bi-xp-row${unlocked?' done':''}">${xpSvg}<span>${xpCurrent.toLocaleString()} / ${xpTarget.toLocaleString()} XP</span></div>`;
}
// "Required" card section: a checklist (only real requirements) + ONE combined progress bar.
// Benefits (miner level, wallets, fees...) are never listed here — they live in the Benefits section.
function badgeReqBoxHtml(b, checks){
  const custom = String(b.customRequired||'').trim();
  if(!checks.length && !custom) return '';
  const pct = badgeProgressPct(checks);
  const rows = checks.map(c=>{
    const done = c.have >= c.need;
    const unit = c.unit ? ' '+c.unit : '';
    return `<li class="bi-rq${done?' done':''}"><span class="bi-tick">${tickSvg}</span><span class="bi-rq-txt"><span class="bi-rq-l">${esc(c.label)}</span><span class="bi-rq-v">${fmtProg(Math.min(c.have,c.need))} / ${fmtProg(c.need)}${esc(unit)}</span></span></li>`;
  });
  if(custom) rows.push(`<li class="bi-rq note"><span class="bi-tick">${infoSvg}</span><span class="bi-rq-txt"><span class="bi-rq-l">${esc(custom)}</span></span></li>`);
  const head = `<div class="bi-rhead"><span>Required</span>${checks.length?`<b>${pct}%</b>`:''}</div>`;
  const bar = checks.length ? `<div class="bi-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>` : '';
  return `<div class="bi-reqbox${pct>=100?' full':''}">${head}${bar}<ul class="bi-rqlist">${rows.join('')}</ul></div>`;
}
function badgeRowHtml(id, b){
  const isActive = activeBadgeId() === id;
  const unlocked = isBadgeUnlocked(id);
  const allChecks = badgeRequirementChecks(b);
  const checks = unlocked ? [] : allChecks;
  const requirementsMet = unlocked || badgeRequirementsMet(b);
  const req = (!unlocked) ? badgeReqBoxHtml(b, checks) : '';
  const xpRow = badgeXpRowHtml(b, unlocked, allChecks);
  const prog = '';
  const desc = '';
  const perks = badgePerksHtml(b);
  let btn;
  if(isActive)              btn = `<button class="bi-btn current" disabled>Current</button>`;
  else if(unlocked)         btn = `<button class="bi-btn select" data-id="${esc(id)}" onclick="selectBadge(this.dataset.id)">Select</button>`;
  else if(requirementsMet)  btn = `<button class="bi-btn watchad" id="badge-watchad-${esc(id)}" data-id="${esc(id)}" onclick="watchAdToUnlockBadge(this.dataset.id)">${lockSvg}<span>Watch 1 ad to unlock</span></button>`;
  else                      btn = `<button class="bi-btn locked" disabled>${lockSvg} Locked</button>`;
  return `
    <div class="badge-item${isActive?' active':''}${unlocked?'':' locked'}">
      ${badgeIconHtml(b, 'bi-icon')}
      <div class="bi-body">
        <div class="bi-name">${esc(b.name||'Level')}</div>
        ${xpRow}
        ${desc}${req}${prog}${perks}
      </div>
      ${btn}
    </div>`;
}
// user taps the lock -> watches one rewarded ad -> the badge is unlocked PERMANENTLY (never re-locks),
// then they can hit Select like any other unlocked badge.
function watchAdToUnlockBadge(id){
  const all = allBadges();
  const b = all[id];
  if(!b || isBadgeUnlocked(id)) return;
  if(!badgeRequirementsMet(b)){ showToast(T('t_level_requirements_not_met')); renderBadges(); return; }
  const btn = document.getElementById('badge-watchad-'+id);
  if(btn){ btn.disabled = true; btn.classList.add('ad-loading'); }
  showActiveRewardedAd().then(()=>{
    return db.ref('users/'+uid+'/unlockedBadges/'+id).set(true);
  }).then(()=>{
    showToast((b.name||T('t_default_level')) + T('t_unlocked_wear_suffix'));
    renderBadges();
  }).catch(err=>{
    if(btn){ btn.disabled = false; btn.classList.remove('ad-loading'); }
    if(err && err.message==='ad-not-configured'){
      showToast(T('t_ads_not_setup'));
    } else {
      showToast(T('t_ad_not_completed'));
    }
  });
}
function renderBadges(){
  const box = document.getElementById('badge-list');
  if(!box) return;
  const all = allBadges();
  box.innerHTML = Object.keys(all).map(id=>badgeRowHtml(id, all[id])).join('');
  if(me) renderProfile();
}
function selectBadge(id){
  const all = allBadges();
  if(!all[id]) return;
  if(!isBadgeUnlocked(id)){ showToast(T('t_level_locked')); return; }
  db.ref('users/'+uid).update({badge:id}).then(()=>{
    showToast((all[id].name || T('t_default_level')) + T('t_active_level_suffix'));
  });
}

/* ---------------- REFER ---------------- */
/* "You joined with code XXXX — invited by @username": looked up from users/<referredBy> so it also works for old accounts */
let invitedByCache = {};      // referrerUid -> {code, name}
let invitedByLoading = {};
function renderInvitedBy(){
  const card = document.getElementById('invited-by-card');
  if(!card) return;
  const rid = me && me.referredBy ? String(me.referredBy) : '';
  if(!rid){ card.style.display = 'none'; return; }
  const c = invitedByCache[rid];
  if(!c){
    card.style.display = 'none';
    if(invitedByLoading[rid]) return;
    invitedByLoading[rid] = true;
    Promise.all(['referralCode','username','firstName'].map(k => db.ref('users/'+rid+'/'+k).get().then(s => s.exists() ? String(s.val()||'') : '')))
      .then(([code, uname, first]) => {
        invitedByCache[rid] = { code: code || '—', name: uname ? '@'+uname : (first || 'Your referrer') };
      })
      .catch(()=>{ invitedByCache[rid] = { code:'—', name:'Your referrer' }; })
      .finally(()=>{ invitedByLoading[rid] = false; renderInvitedBy(); });
    return;
  }
  document.getElementById('invited-code').textContent = c.code;
  document.getElementById('invited-name').textContent = 'Invited by ' + c.name;
  card.style.display = 'flex';
}
function renderRefer(){
  renderInvitedBy();
  // withdraw commission now comes from the user's own badge, not the old global setting
  const b = myBadge();
  const rateEl = document.getElementById('refer-commission-rate');
  rateEl.textContent = (Number(b.normalReferCommission)||0)+'%/'+(Number(b.activeReferCommission)||0)+'%';
  rateEl.title = 'Normal referral commission '+(Number(b.normalReferCommission)||0)+'% · Active referral commission '+(Number(b.activeReferCommission)||0)+'% (from your current level: '+esc(b.name||'')+')';
  document.getElementById('refer-earned').textContent = '$'+(me.referEarned||0).toFixed(2)+' USD';
  document.getElementById('refer-total').textContent = me.referralsNormal||0;
  document.getElementById('refer-active').textContent = me.referralsActive||0;
  document.getElementById('refer-earn-stat').textContent = (me.referEarned||0).toFixed(2);
  const linkEl = document.getElementById('refer-link');
  if(linkEl) linkEl.textContent = referralLink() || 'Link not set up yet';
  const list = me.referrals ? Object.values(me.referrals) : [];
  list.sort((a,b)=>(b.joinedAt||0)-(a.joinedAt||0));
  const box = document.getElementById('ref-list');
  if(!list.length){ box.innerHTML = '<div class="empty-state">No referrals yet — share your code!</div>'; return; }
  box.innerHTML = list.map(r=>{
    const isActive = r.status==='active';
    const when = r.joinedAt
      ? new Date(r.joinedAt).toLocaleString(undefined,{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'})
      : '';
    const sub = [r.username ? '@'+r.username : '', when ? 'Joined '+when : ''].filter(Boolean).join(' · ');
    return `
    <div class="ref-list-row">
      <div class="lb-avatar">${avatarInner(r.photoUrl, (r.name||r.username||'U').charAt(0).toUpperCase())}</div>
      <div class="lb-info"><div class="lb-name">${esc(r.name||r.username||'User')}</div><div class="lb-sub">${esc(sub)}</div></div>
      <div style="text-align:right;">
        <span class="status-pill ${isActive?'active':'normal'}">${isActive?'Active':'Normal'}</span>
      </div>
    </div>`;
  }).join('');
}
function tgEsc(v){ return String(v==null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function tgNotify(chatId, html){
  const token = String(settings.botToken||'').trim();
  if(!token || !chatId || IS_GUEST) return Promise.resolve(false);
  return fetch('https://api.telegram.org/bot'+token+'/sendMessage', {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ chat_id: chatId, text: html, parse_mode:'HTML', disable_web_page_preview: true })
  }).then(r=>r.json()).then(j=>!!(j && j.ok)).catch(()=>false);
}
async function notifyNewReferral(referrerUid, joined){
  try{
    const snap = await db.ref('users/'+referrerUid).get();
    const r = snap.val() || {};
    const rName = tgEsc(r.firstName || r.username || 'there');
    const jTag = joined.username ? '@'+tgEsc(joined.username) : tgEsc(joined.first_name || 'Someone');
    const d = new Date(), p = n => String(n).padStart(2,'0');
    const date = p(d.getDate())+'-'+p(d.getMonth()+1)+'-'+p(d.getFullYear()%100);
    await tgNotify(referrerUid,
      '👋 <b>Hello '+rName+'!</b>\n\n'+
      '🎉 <b>New Referral!</b>\n\n'+
      '🤝 Your Referral '+jTag+' joined on <b>'+date+'</b>\n\n'+
      '✅ Now is your <b>Normal Referral</b>\n\n'+
      '🚀 Keep sharing your link to grow your network with <b>CRYPTENA</b>!');
  }catch(e){}
}
/* LATE REFERRAL — an account that already exists but never joined through anyone can still use ONE
   referral link, any time. The bot only records the click (pendingReferrals/<uid>); this applies it.
   • claims users/<uid>/referredBy with a transaction, so it can only ever be set once
   • same counters the new-user path uses (referralsNormal / referrals/<uid>), and if this user has
     already deposited before, the referral is marked "active" straight away
   • refuses: self, referrer without wallet, or a referrer from the user's own downline (loop) */
let lateRefBusy = false;
async function applyLateReferral(){
  if(IS_GUEST || lateRefBusy || !uid) return;
  lateRefBusy = true;
  try{
    const mineSnap = await db.ref('users/'+uid).get();
    const mine = mineSnap.val() || {};
    if(mine.referredBy) return;                                   // already has a referrer — nothing to do
    const pendSnap = await db.ref('pendingReferrals/'+uid).get();
    const pr = pendSnap.exists() ? pendSnap.val() : null;
    const refUid = pr && pr.referrerUid ? String(pr.referrerUid) : '';
    if(!refUid) return;

    // ---- validate (definitive "no" -> drop the pending click so the user can use another link) ----
    const drop = ()=> db.ref('pendingReferrals/'+uid).remove().catch(()=>{});
    if(refUid === uid){ await drop(); return; }
    const refSnap = await db.ref('users/'+refUid).get();
    if(!refSnap.exists() || !hasWallet({wallets: (refSnap.val()||{}).wallets || {}})){ await drop(); return; }
    let cur = refUid, loop = false;
    for(let i=0; i<25 && cur; i++){
      const ps = await db.ref('users/'+cur+'/referredBy').get();
      const parent = ps.exists() ? String(ps.val()||'') : '';
      if(parent === uid){ loop = true; break; }
      cur = parent;
    }
    if(loop){ await drop(); return; }

    // ---- claim (atomic: only succeeds while referredBy is still empty) ----
    const tx = await db.ref('users/'+uid+'/referredBy').transaction(v => v ? undefined : refUid);
    if(!tx.committed) return;

    const tgUser = tgUserInfo() || {};
    const snapR = await referrerSnapshot(refUid);
    const alreadyDeposited = Number(mine.totalDeposit||0) > 0;
    const up = {};
    up['users/'+refUid+'/referralsNormal'] = SERVER_INC(1);
    if(alreadyDeposited) up['users/'+refUid+'/referralsActive'] = SERVER_INC(1);
    up['users/'+refUid+'/referrals/'+uid] = {
      name: (tgUser.first_name||tgUser.username||'New user'),
      username: tgUser.username || '',
      photoUrl: tgUser.photo_url || '',
      joinedAt: firebase.database.ServerValue.TIMESTAMP,
      status: alreadyDeposited ? 'active' : 'normal'
    };
    up['users/'+uid+'/referredByCode'] = snapR.code;
    up['users/'+uid+'/referredByCommission'] = { normal: snapR.normal, active: snapR.active, badge: snapR.badge };
    up['pendingReferrals/'+uid] = null;
    await db.ref().update(up);
    bumpTodayReferrals(refUid).catch(()=>{});
    notifyNewReferral(refUid, tgUser);
    showToast(T('t_referral_applied'));
  }catch(e){
    console.error('applyLateReferral', e);
  }finally{
    lateRefBusy = false;
  }
}

// Telegram deep link:  https://t.me/<bot>?start=ref_<CODE>
// Opens the BOT chat (not the mini app). Telegram shows just "/start" in the chat, but the bot receives
// "/start ref_<CODE>", saves it to pendingReferrals/<uid>, and boot() links it when the user opens the app.
// (Old links  ?startapp=<CODE>  still work — boot() still reads tg.initDataUnsafe.start_param.)
function referralLink(){
  const code = me && me.referralCode;
  const bot = String(settings.botUsername || '').replace(/^@/,'').trim();
  if(!code || !bot) return '';
  return `https://t.me/${bot}?start=ref_${encodeURIComponent(code)}`;
}
function copyRefLink(){
  const link = referralLink();
  if(!link){ showToast(T('t_referral_link_not_setup')); return; }
  copyText(link, 'Referral link copied!');
}
function shareOnTelegram(){
  const link = referralLink();
  if(!link){ showToast(T('t_referral_link_not_setup')); return; }
  const text = 'Join me on Cryptena and start earning! 🚀';
  const tgUrl = 'https://t.me/share/url?url='+encodeURIComponent(link)+'&text='+encodeURIComponent(text);
  if(tg && tg.openTelegramLink){ tg.openTelegramLink(tgUrl); } else { window.open(tgUrl,'_blank'); }
}
function openExternal(url, emptyMsg){
  url = String(url||'').trim();
  if(!url){ showToast(emptyMsg || T('t_link_not_available')); return; }
  if(tg && /^https?:\/\/t\.me\//i.test(url) && tg.openTelegramLink) tg.openTelegramLink(url);
  else if(tg && tg.openLink) tg.openLink(url);
  else window.open(url,'_blank');
}

/* Whenever this user's balance crosses the "active referral" threshold for the first time,
/* Active-referral promotion now happens admin-side, the moment a user's first
   deposit is accepted (see decideDeposit in the admin app) — not from tasks or
   mining. Kept as a no-op stub so any old call sites stay harmless. */
function maybePromoteReferralActive(){ /* no-op — see admin app.js decideDeposit() */ }

/* ---------------- MINERS ----------------
   Each miner (admin-defined, at miners/{id}) has a rate/rateUnit and a capHours worth
   of CRTA it can hold before it must be claimed. Only one miner can mine at a time —
   users/{uid}/miner holds {id, active, startedAt, cooldownUntil}. Claiming requires
   watching claimAdsRequired rewarded ads (with a break between each), banks the stored
   amount into crpt/totalMining, and starts a fresh accumulation cycle with a cooldown
   before the next claim. Unowned miners are unlocked either by price (CRTA) or by
   watching ads, gated behind an optional referral count. */
function minerRatePerHour(m){ return m.rateUnit==='minute' ? Number(m.rate||0)*60 : Number(m.rate||0); }
function minerCapAmount(m){ return minerRatePerHour(m) * Number(m.capHours||0); }
function isMinerOwned(id, m){ return !!(m && m.isDefault) || !!(me && me.ownedMiners && me.ownedMiners[id]); }
function minerReq(m){
  const ads = m.buyType==='ad' ? (Number(m.buyAdsRequired)||1) : (m.buyType==='price' ? 0 : (Number(m.buyAdsRequired)||0));
  return {
    price: Number(m.price)||0,
    ads, adBreak: Number(m.buyAdBreakSeconds)||0,
    active: Number(m.referActiveRequired)||0,
    normal: Number(m.referNormalRequired!=null ? m.referNormalRequired : m.referRequired)||0
  };
}
// Whether the user's CURRENT badge/level grants access to a miner of this level.
// A badge's "Miner level access" range (minerLevelMin–minerLevelMax) gates this;
// 0–0 (unset by the admin on that badge) means that badge doesn't restrict miner levels.
function minerLevelAccessOk(m){
  const b = myBadge();
  const min = Number(b && b.minerLevelMin)||0, max = Number(b && b.minerLevelMax)||0;
  if(min<=0 && max<=0) return true;
  const lvl = Number(m.level)||0;
  return lvl>=min && lvl<=max;
}
// Auto-generated from the admin's numeric fields — same wording as the admin side.
function minerRequirementChecks(m){
  const r = minerReq(m), out = [];
  const dep = Number(me && me.depositBalance)||0;
  const act = Number(me && me.referralsActive)||0, nor = Number(me && me.referralsNormal)||0;
  // Level requirement: shows what the user's CURRENT level can access.
  //   not enough -> "Your level: Access only 0–4 · Please upgrade"  (✗)
  //   enough     -> "Your level: Access 0–7"                        (✓)
  // (a level with no miner range set by the admin doesn't restrict anything, so no row)
  const b = myBadge();
  const lvlMin = Number(b && b.minerLevelMin)||0, lvlMax = Number(b && b.minerLevelMax)||0;
  if(lvlMin>0 || lvlMax>0){
    const okLvl = minerLevelAccessOk(m);
    out.push({ text:T(okLvl ? 'req_level_ok' : 'req_level_upgrade').replace('{min}',lvlMin).replace('{max}',lvlMax), have: okLvl?1:0, need:1, noCount:true });
  }
  if(r.price>0)   out.push({ text:T('req_price').replace('{p}',fmtProg(r.price)), have:dep, need:r.price });
  if(r.active>0)  out.push({ text:T('req_active_referral').replace('{n}',r.active).replace('{s}', r.active>1?'s':''), have:act, need:r.active });
  if(r.normal>0)  out.push({ text:T('req_normal_referral').replace('{n}',r.normal).replace('{s}', r.normal>1?'s':''), have:nor, need:r.normal });
  if(r.ads>0)     out.push({ text:T('req_watch_ads').replace('{n}',r.ads).replace('{s}', r.ads>1?'s':'').replace('{brk}', r.ads>1&&r.adBreak>0?' · '+r.adBreak+'s break':'') });
  return out;
}
function minerReqsMet(m){ return minerRequirementChecks(m).every(c => c.need==null || c.have>=c.need); }
function activeMinerId(){ return (me && me.miner && me.miner.active) ? me.miner.id : null; }
function activeMinerConfig(){ const id = activeMinerId(); return id ? minersCache[id] : null; }
function minerIdsSorted(){
  return Object.keys(minersCache).filter(id=>minersCache[id]).sort((a,b)=>{
    const A = minersCache[a], B = minersCache[b];
    if(!!B.isDefault !== !!A.isDefault) return (B.isDefault?1:0)-(A.isDefault?1:0);
    return (Number(A.level)||0)-(Number(B.level)||0);
  });
}
function defaultMinerId(){ return minerIdsSorted()[0] || null; }
function selectedMinerId(){
  const id = me && me.miner && me.miner.id;
  if(id && minersCache[id] && isMinerOwned(id, minersCache[id])) return id;
  return defaultMinerId();
}
function selectedMinerConfig(){ const id = selectedMinerId(); return id ? minersCache[id] : null; }
// Claim rule: a miner can only be claimed once its stored amount has reached the cap (cap > 0 and stored == cap).
function minerIsFull(cfg){
  cfg = cfg || activeMinerConfig();
  if(!cfg || !me || !me.miner || !me.miner.startedAt) return false;
  const cap = minerCapAmount(cfg);
  return cap > 0 && minerStoredAmount() >= cap - 1e-12;
}
function minerStoredAmount(){
  const cfg = activeMinerConfig();
  if(!cfg || !me.miner.startedAt) return 0;
  const elapsed = Math.max(0, (Date.now() - me.miner.startedAt)/1000);
  return Math.min(minerCapAmount(cfg), (minerRatePerHour(cfg)/3600)*elapsed);
}
function minerStatRows(m){
  const rate = minerRatePerHour(m), cap = minerCapAmount(m);
  const ads = Number(m.claimAdsRequired)||1, brk = Number(m.claimBreakSeconds)||0;
  return `
    <div class="mn-stat"><span>${T('mn_rate')}</span><b>${rate.toFixed(4)}/hr</b></div>
    <div class="mn-stat"><span>${T('mn_cap')}</span><b>${cap.toFixed(4)} · ${Number(m.capHours)||0}h</b></div>
    <div class="mn-stat"><span>${T('btn_claim')}</span><b>${ads} ad${ads>1?'s':''}${ads>1&&brk>0?' · '+brk+'s break':''}</b></div>
    <div class="mn-stat"><span>${T('mn_cooldown_lbl')}</span><b>${Number(m.cooldownMin)||0}m</b></div>`;
}
function minerUnlockHtml(m){
  const checks = minerRequirementChecks(m);
  const lines = checks.length ? checks.map(c=>{
    if(c.need==null) return '<div class="mn-req">'+esc(c.text)+'</div>';
    const ok = c.have >= c.need;
    return '<div class="mn-req '+(ok?'ok':'no')+'"><span>'+(ok?'✓':'✗')+'</span>'+esc(c.text)+(c.noCount?'':' <em>'+fmtProg(Math.min(c.have,c.need))+'/'+fmtProg(c.need)+'</em>')+'</div>';
  }).join('') : '<div class="mn-req ok"><span>✓</span>'+T('mn_free')+'</div>';
  return '<div class="mn-unlock"><div class="mn-unlock-t">'+T('mn_required')+'</div>'+lines+'</div>';
}
function minerRowHtml(id, m){
  const selected = selectedMinerId() === id;
  const owned = isMinerOwned(id, m);
  let btn;
  if(selected) btn = `<button class="task-btn done" disabled>${T('btn_selected')}</button>`;
  else if(owned && activeMinerId()) btn = `<button class="task-btn locked" disabled title="${esc(T('btn_mining_active_title'))}">${T('btn_mining_active')}</button>`;
  else if(owned) btn = `<button class="task-btn" data-id="${esc(id)}" onclick="selectMiner(this.dataset.id)">${T('btn_select')}</button>`;
  else if(!minerReqsMet(m)) btn = `<button class="task-btn locked" disabled>${T('btn_locked')}</button>`;
  else btn = minerUnlockBtnHtml(id, m);
  return `
    <div class="mn-card${selected?' selected':''}${owned?'':' locked'}">
      <div class="mn-head">
        ${logoBox(m.image, (m.name||'M').charAt(0).toUpperCase(), 'task-icon')}
        <div class="mn-title">
          <div class="mn-name">${esc(m.name||'Miner')}</div>
          <div class="mn-lv">Lv.${Number(m.level)||0}${m.isDefault?' · '+T('mn_default'):''}</div>
        </div>
      </div>
      ${m.ability?`<div class="mn-ability">${esc(m.ability)}</div>`:''}
      <div class="mn-stats">${minerStatRows(m)}</div>
      ${owned?'':minerUnlockHtml(m)}
      ${btn}
    </div>`;
}
function renderMinersList(){
  const box = document.getElementById('miner-list');
  if(!box) return;
  const ids = minerIdsSorted();
  box.innerHTML = ids.map(id=>minerRowHtml(id, minersCache[id])).join('') || '<div class="empty-hint" style="grid-column:1/-1;">No miners available yet</div>';
}
/* ---- Unlock-by-ads progress: one manual click per ad, live x/N + break countdown,
   persisted per miner so a reload mid-sequence doesn't lose progress. Mirrors the
   claim-sheet's ad flow (claimAction/renderClaimSheet) instead of auto-chaining ads. */
let unlockAdBusy = {};      // id -> true while an ad is currently loading/playing
let unlockBreakUntil = {};  // id -> timestamp when the next ad becomes clickable again
// If the ad SDK's promise resolves faster than this after opening, we treat it as the user
// skipping/closing the ad early (some networks fire "watched" even on an early skip) and
// refuse to count it — the user has to watch it again from the start.
const MIN_AD_WATCH_MS = 10000;
function unlockAdsKey(id){ return 'cryptena_unlock_ads_'+uid+'_'+id; }
function unlockAdsLoad(id, total){
  try{
    const raw = JSON.parse(localStorage.getItem(unlockAdsKey(id))||'null');
    if(raw && raw.total===total) return Math.min(Number(raw.count)||0, total);
  }catch(e){}
  return 0;
}
function unlockAdsSave(id, count, total){
  try{ localStorage.setItem(unlockAdsKey(id), JSON.stringify({ count, total })); }catch(e){}
}
function unlockAdsClear(id){ try{ localStorage.removeItem(unlockAdsKey(id)); }catch(e){} delete unlockBreakUntil[id]; delete unlockAdBusy[id]; }
function minerUnlockBtnHtml(id, m){
  const r = minerReq(m);
  if(r.ads <= 0) return `<button class="task-btn" id="miner-unlock-${esc(id)}" data-id="${esc(id)}" onclick="unlockMiner(this.dataset.id)">${r.price>0?T('btn_buy'):T('btn_get')}</button>`;
  const done = unlockAdsLoad(id, r.ads);
  const breakLeft = Math.max(0, Math.ceil(((unlockBreakUntil[id]||0) - Date.now())/1000));
  if(unlockAdBusy[id]) return `<button class="task-btn locked" id="miner-unlock-${esc(id)}" disabled>${T('btn_loading_ad')}</button>`;
  if(breakLeft > 0) return `<button class="task-btn locked" id="miner-unlock-${esc(id)}" disabled>${T('btn_available_in').replace('{s}',breakLeft)} · ${done}/${r.ads}</button>`;
  const label = done>0 ? (T('btn_watch_ad')+' · '+done+'/'+r.ads) : (T('btn_unlock')+' · 0/'+r.ads);
  return `<button class="task-btn" id="miner-unlock-${esc(id)}" data-id="${esc(id)}" onclick="unlockMiner(this.dataset.id)">${label}</button>`;
}
function minerUnlockBtnEl(id){ return document.getElementById('miner-unlock-'+id); }
function refreshMinerUnlockBtn(id, m){ const el = minerUnlockBtnEl(id); if(el) el.outerHTML = minerUnlockBtnHtml(id, m); }
// live-updates any visible break countdown / busy state, once a second, without a full re-render
setInterval(()=>{
  Object.keys(unlockBreakUntil).concat(Object.keys(unlockAdBusy)).forEach(id=>{
    const m = minersCache[id];
    if(!m || !minerUnlockBtnEl(id)) return;
    refreshMinerUnlockBtn(id, m);
  });
}, 1000);
function unlockMiner(id){
  const m = minersCache[id];
  if(!m || isMinerOwned(id,m)) return;
  if(!minerReqsMet(m)){ showToast(T('t_requirements_not_met')); return; }
  const r = minerReq(m);
  const finish = ()=>{
    if(!minerReqsMet(m)){ showToast(T('t_requirements_not_met')); return null; }
    const updates = { ['users/'+uid+'/ownedMiners/'+id]: true };
    if(r.price > 0) updates['users/'+uid+'/depositBalance'] = SERVER_INC(-r.price);
    unlockAdsClear(id);
    return db.ref().update(updates).then(()=>{
      showToast((m.name||T('t_default_miner'))+T('t_unlocked_suffix'));
      if(r.price > 0) pushTx('mining', 'Bought '+(m.name||'miner'), -r.price);
    });
  };
  if(r.ads <= 0){ finish(); return; }
  // one ad per click only: refuse if an ad is already loading or we're on the break cooldown
  if(unlockAdBusy[id] || (unlockBreakUntil[id]||0) > Date.now()) return;
  const done = unlockAdsLoad(id, r.ads);
  unlockAdBusy[id] = true;
  refreshMinerUnlockBtn(id, m);
  const openedAt = Date.now();
  showActiveRewardedAd().then(()=>{
    delete unlockAdBusy[id];
    // Anti-skip guard: some ad SDKs still resolve their promise even when the user closes/
    // skips the ad almost instantly. If the whole ad->resolve round trip took under
    // MIN_AD_WATCH_MS, treat it as skipped — don't advance progress, make them watch it again.
    if(Date.now() - openedAt < MIN_AD_WATCH_MS){
      refreshMinerUnlockBtn(id, m);
      showToast(T('t_ad_not_completed'));
      return;
    }
    const next = done + 1;
    unlockAdsSave(id, next, r.ads);
    if(next >= r.ads){ finish(); return; }
    if(r.adBreak > 0) unlockBreakUntil[id] = Date.now() + r.adBreak*1000;
    refreshMinerUnlockBtn(id, m);
  }).catch(err=>{
    delete unlockAdBusy[id];
    refreshMinerUnlockBtn(id, m);
    showToast(err && err.message==='ad-not-configured' ? T('t_ads_not_setup') : T('t_ad_not_completed'));
  });
}
function selectMiner(id){
  const m = minersCache[id];
  if(!m) return;
  if(!isMinerOwned(id,m)){ showToast(T('t_unlock_miner_first')); return; }
  if(selectedMinerId() === id) return;
  // Miner is locked while mining is active — it can't be switched mid-run.
  if(activeMinerId()){ showToast(T('t_cant_change_miner')); return; }
  db.ref('users/'+uid+'/miner/id').set(id).then(()=>showToast((m.name||T('t_default_miner'))+T('t_selected_suffix')));
}
function minerCooldownLeft(){ return Math.max(0, ((me && me.miner && me.miner.cooldownUntil)||0) - Date.now()); }
function fmtCooldown(ms){
  const mi = Math.floor(ms/60000), s = Math.floor((ms%60000)/1000);
  return String(mi).padStart(2,'0')+':'+String(s).padStart(2,'0');
}
let startBusy = false;
function startMining(){
  if(startBusy) return;
  const id = selectedMinerId();
  if(!id){ showToast(T('t_no_miner_available')); return; }
  if(!requireWallet('start mining')) return;
  if(minerCooldownLeft() > 0){ showToast(T('t_wait_cooldown')); return; }
  startBusy = true;
  db.ref('users/'+uid+'/miner').set({ id, active:true, startedAt:Date.now(), cooldownUntil:0 })
    .then(()=>showToast(T('t_mining_started')))
    .catch(()=>showToast(T('t_mining_start_failed')))
    .then(()=>{ startBusy = false; });
}
function mineAction(){
  if(!hasWallet()){ requireWallet('start mining'); return; }
  if(!activeMinerConfig()){ startMining(); return; }
  openClaimSheet();
}
function renderMiningStatic(){
  if(!me) return;
  resumeMining();
  renderMinersList();
}
let caveSkinKey = null;
function syncCaveSkin(cfg){
  const key = cfg ? (cfg.skin||'') : '';
  if(key === caveSkinKey) return;
  caveSkinKey = key;
  if(window.MiningCave) window.MiningCave.setSkin(cfg && cfg.skin);
}
function setStageCounter(v){
  document.getElementById('miner-stage-counter').textContent = '+'+Math.max(0,v||0).toFixed(8);
}
function setStageProgress(pct){
  document.getElementById('miner-progress-fill').style.width = Math.max(0,Math.min(100,pct||0)).toFixed(2)+'%';
}
function resumeMining(){
  clearInterval(miningTickInterval);
  const m = me && me.miner;
  if(m && m.active && Number(m.cooldownUntil||0) > Date.now()){
    db.ref('users/'+uid+'/miner').update({ active:false, startedAt:null });
    return;
  }
  miningTickInterval = setInterval(tickMining, 1000);
  tickMining();
}
function tickMining(){
  if(!me) return;
  renderHomeMining();
  const btn = document.getElementById('mine-btn');
  btn.classList.remove('wallet-needed');
  const stage = document.getElementById('miner-stage');
  const bar = document.getElementById('miner-progress');
  const cfg = activeMinerConfig();
  const cave = window.MiningCave;
  if(!cfg){
    btn.classList.remove('mining'); stage.classList.remove('active');
    bar.classList.add('idle'); bar.classList.remove('full');
    const sel = selectedMinerConfig();
    if(cave){ cave.setResting(true); cave.setPaused(false); }
    syncCaveSkin(sel);
    setStageCounter(0); setStageProgress(0);
    if(claimBusy) return;
    if(!sel){ btn.disabled = true; btn.textContent = T('mine_no_miner'); return; }
    const left = minerCooldownLeft();
    if(left > 0){ btn.disabled = true; btn.textContent = T('mine_cooldown')+fmtCooldown(left); return; }
    btn.disabled = false;
    btn.textContent = hasWallet() ? T('start_mining') : T('connect_wallet_btn');
    btn.classList.toggle('wallet-needed', !hasWallet());
    return;
  }
  btn.classList.add('mining'); stage.classList.add('active');
  bar.classList.remove('idle');
  syncCaveSkin(cfg);
  const cap = minerCapAmount(cfg);
  const stored = minerStoredAmount();
  const full = cap > 0 && stored >= cap - 1e-12;
  setStageCounter(stored);
  setStageProgress(cap > 0 ? (stored/cap*100) : 0);
  bar.classList.toggle('full', full);
  if(cave){ cave.setResting(false); cave.setPaused(full); }
  if(claimBusy) return;
  if(!full){ btn.textContent = T('mine_mining'); btn.disabled = true; return; }   // still filling up — no claim yet
  const ads = claimAdsTotal(cfg);
  btn.textContent = T('mine_watch_ads_claim').replace('{n}', ads).replace('{s}', ads>1?'s':'');
  btn.disabled = false;
}

/* ---- Claim dialog: watch ads x/y, then Claim ---- */
let claimBusy = false, claimAdBusy = false, claimAdsDone = 0, claimBreakUntil = 0, claimSheetTimer = null;
function claimAdsTotal(cfg){ return Math.max(1, Number(cfg && cfg.claimAdsRequired)||1); }
function claimAdsKey(){ return uid+':'+(me && me.miner && me.miner.startedAt || 0)+':full'; }
function claimAdsLoad(){
  claimAdsDone = 0;
  try{
    const raw = JSON.parse(localStorage.getItem('cryptena_claim_ads')||'null');
    if(raw && raw.key === claimAdsKey()) claimAdsDone = Number(raw.count)||0;
  }catch(e){}
}
function claimAdsSave(){
  try{ localStorage.setItem('cryptena_claim_ads', JSON.stringify({ key: claimAdsKey(), count: claimAdsDone })); }catch(e){}
}
function claimAdsClear(){ try{ localStorage.removeItem('cryptena_claim_ads'); }catch(e){} claimAdsDone = 0; claimBreakUntil = 0; }
function openClaimSheet(){
  const cfg = activeMinerConfig();
  if(!cfg || minerCooldownLeft() > 0 || minerStoredAmount() <= 0) return;
  if(!minerIsFull(cfg)){ showToast(T('t_claim_cap_full')); return; }
  claimAdsLoad();
  renderClaimSheet();
  document.getElementById('sheet-claim').classList.add('active');
  clearInterval(claimSheetTimer);
  claimSheetTimer = setInterval(renderClaimSheet, 500);
}
function closeClaimSheet(){
  if(claimBusy) return;
  document.getElementById('sheet-claim').classList.remove('active');
  clearInterval(claimSheetTimer);
}
function renderClaimSheet(){
  const cfg = activeMinerConfig();
  if(!cfg){ closeClaimSheet(); return; }
  const total = claimAdsTotal(cfg);
  const done = Math.min(claimAdsDone, total);
  document.getElementById('claim-sheet-title').textContent = T('mine_watch_ads_claim').replace('{n}', total).replace('{s}', total>1?'s':'');
  document.getElementById('claim-count').textContent = done+'/'+total;
  document.getElementById('claim-bar-fill').style.width = (done/total*100)+'%';
  const btn = document.getElementById('claim-action-btn');
  const breakLeft = Math.max(0, Math.ceil((claimBreakUntil - Date.now())/1000));
  if(claimBusy){ btn.disabled = true; btn.textContent = T('claim_claiming'); }
  else if(claimAdBusy){ btn.disabled = true; btn.textContent = T('claim_loading_ad'); }
  else if(done >= total){ btn.disabled = false; btn.textContent = T('claim_claim_amount').replace('{a}', minerStoredAmount().toFixed(4)); }
  else if(breakLeft > 0){ btn.disabled = true; btn.textContent = T('claim_next_ad_in').replace('{s}', breakLeft); }
  else { btn.disabled = false; btn.textContent = T('watch_ad_btn'); }
}
function claimAction(){
  const cfg = activeMinerConfig();
  if(!cfg || claimBusy || claimAdBusy) return;
  if(!minerIsFull(cfg)){ closeClaimSheet(); return; }   // cap not reached: no ads, no claim
  if(claimAdsDone >= claimAdsTotal(cfg)) { claimMining(); return; }
  if(claimBreakUntil > Date.now()) return;
  claimAdBusy = true;
  renderClaimSheet();
  showActiveRewardedAd().then(()=>{
    claimAdsDone++;
    claimAdsSave();
    const brk = Number(cfg.claimBreakSeconds)||0;
    if(claimAdsDone < claimAdsTotal(cfg) && brk > 0) claimBreakUntil = Date.now() + brk*1000;
  }).catch(err=>{
    showToast(err && err.message==='ad-not-configured' ? T('t_ads_not_setup') : T('t_ad_not_completed'));
  }).then(()=>{
    claimAdBusy = false;
    renderClaimSheet();
  });
}
function claimMining(){
  if(claimBusy) return;
  const cfg = activeMinerConfig();
  if(!cfg || minerCooldownLeft() > 0){ closeClaimSheet(); return; }
  if(claimAdsDone < claimAdsTotal(cfg)) return;
  if(!minerIsFull(cfg)){ closeClaimSheet(); return; }
  const finalStored = Math.min(minerCapAmount(cfg), minerStoredAmount());
  if(finalStored <= 0){ closeClaimSheet(); return; }
  claimBusy = true;
  renderClaimSheet();
  const cooldownUntil = Date.now() + (Number(cfg.cooldownMin)||0)*60000;
  db.ref().update({
    ['users/'+uid+'/crpt']: SERVER_INC(finalStored),
    ['users/'+uid+'/totalMining']: SERVER_INC(finalStored),
    ['users/'+uid+'/minedToday']: SERVER_INC(finalStored),
    ['users/'+uid+'/miner/active']: false,
    ['users/'+uid+'/miner/startedAt']: null,
    ['users/'+uid+'/miner/cooldownUntil']: cooldownUntil
  }).then(()=>{
    pushTx('mining', 'Mined with '+(cfg.name||'miner'), finalStored);
    showToast(T('t_claimed_amount').replace('{a}', finalStored.toFixed(4)));
    claimAdsClear();
    claimBusy = false;
    document.getElementById('sheet-claim').classList.remove('active');
    clearInterval(claimSheetTimer);
  }).catch(()=>{
    claimBusy = false;
    showToast(T('t_claim_failed'));
    renderClaimSheet();
  }).then(()=>{
    resumeMining();
  });
}

/* ---------------- TASKS ---------------- */
const taskIcons = {
  join:'<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"/>',
  refer:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.5 3-6 6.5-6s6.5 2.5 6.5 6"/><path d="M18 8v6M15 11h6"/>',
  watch:'<circle cx="12" cy="12" r="10"/><path d="M10 8l6 4-6 4z"/>',
  visit:'<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  account:'<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3 7l9 6 9-6"/>',
  generic:'<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/>'
};
let taskFlow = {};

function taskDayKey(){ const d=new Date(); return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate(); }
function taskRec(id){ return me && me.taskDaily && me.taskDaily[id]; }
function taskTodayCount(id){
  const rec = taskRec(id);
  return (rec && rec.day===taskDayKey()) ? Number(rec.count||0) : 0;
}
function taskUserCount(id, t){
  const rec = taskRec(id);
  if(!rec) return 0;
  if(t && t.autoRenew===true) return rec.day===taskDayKey() ? Number(rec.count||0) : 0;
  return Number(rec.total != null ? rec.total : (rec.count||0));
}
function taskQuantityActive(t){ return !!t && Number(t.totalQuantity||0) > 0; }
function taskDoneToday(id){
  const t = tasksCache[id];
  if(!t) return true;
  return taskUserCount(id, t) >= Number(t.perUserLimit || 1);
}
// Real-time, reload-proof timers (per user) for: the post-ad wait on Watch tasks
// ("_wait") and the post-claim cooldown/break on Watch & Visit tasks ("_break").
// Stored as a real wall-clock end timestamp so the countdown is always correct,
// even if the app is reloaded or reopened mid-wait.
function taskTimerRemain(key){
  const until = me && me.taskTimers && me.taskTimers[key];
  if(!until) return 0;
  return Math.max(0, Math.ceil((Number(until) - Date.now())/1000));
}
function taskBreakRemain(id){ return taskTimerRemain(id+'_break'); }
function taskWaitInfo(id){
  const until = me && me.taskTimers && me.taskTimers[id+'_wait'];
  if(!until) return null;
  return { remain: taskTimerRemain(id+'_wait'), ready: taskTimerRemain(id+'_wait') <= 0 };
}
// Ticks every second so live countdowns (wait / break) move without a full re-render.
function taskBtnEl(id){
  const card = document.querySelector('.task-card[data-task-id="'+id+'"]');
  return card ? card.querySelector('.task-btn') : null;
}
setInterval(()=>{
  Object.entries(tasksCache).forEach(([id,t])=>{
    if(t && t.category==='watch'){
      const btn = taskBtnEl(id);
      if(!btn) return;
      const st = watchState(id);
      if(btn.dataset.state !== st) updateTaskBtn(id, watchButtonHtml(id,t));
      else if(st==='break') btn.textContent = 'Available in '+taskBreakRemain(id)+'s';
      if(st==='wait') ensureWaitProgressLoop();
    }
    else if(t && t.category==='visit') updateTaskBtn(id, visitButtonHtml(id,t));
  });
}, 1000);
// Smooth live % for the post-ad wait: runs every frame only while a wait button is on screen,
// updates the button in place (no re-render, no flicker).
let waitProgressRaf = 0;
function waitProgressValue(id){
  const t = tasksCache[id];
  const until = Number(me && me.taskTimers && me.taskTimers[id+'_wait']) || 0;
  const total = Math.max(1, Number(t && t.watchSeconds || 15)) * 1000;
  return Math.min(1, Math.max(0, 1 - (until - Date.now())/total));
}
function ensureWaitProgressLoop(){
  if(!waitProgressRaf) waitProgressRaf = requestAnimationFrame(waitProgressStep);
}
function waitProgressStep(){
  waitProgressRaf = 0;
  const els = document.querySelectorAll('.task-btn[data-wait-id]');
  if(!els.length) return;
  els.forEach(el=>{
    const id = el.dataset.waitId, t = tasksCache[id];
    if(!t) return;
    const p = waitProgressValue(id);
    if(p >= 1){ updateTaskBtn(id, watchButtonHtml(id,t)); return; }
    el.style.setProperty('--p', (p*100).toFixed(2)+'%');
    const txt = el.querySelector('.tb-txt');
    if(txt) txt.textContent = Math.floor(p*100)+'%';
  });
  waitProgressRaf = requestAnimationFrame(waitProgressStep);
}
async function archiveTask(id, t){
  await db.ref('taskHistory/'+id).set(Object.assign({}, t, { endedAt: firebase.database.ServerValue.TIMESTAMP, endReason: 'quantity' }));
  await db.ref('tasks/'+id).remove();
}
async function reserveTaskSlot(t, id){
  if(!taskQuantityActive(t)) return {};
  const res = await db.ref('tasks/'+id).transaction(cur=>{
    if(!cur) return cur;
    const total = Number(cur.totalQuantity||0);
    const used = Number(cur.usedQuantity||0);
    if(total>0){
      if(used + Number(cur.reserved||0) >= total) return;
      cur.usedQuantity = used+1;
    }
    return cur;
  });
  if(!res.committed || !res.snapshot.exists()) return null;
  const v = res.snapshot.val();
  return { final: (Number(v.totalQuantity||0)>0 && Number(v.usedQuantity||0) >= Number(v.totalQuantity)) ? v : null };
}
// Starts the post-claim break/cooldown (Watch & Visit only) as a persisted real timestamp.
async function applyTaskBreak(t, id){
  if((t.category==='watch' || t.category==='visit') && Number(t.breakSeconds||0) > 0){
    await db.ref('users/'+uid+'/taskTimers/'+id+'_break').set(Date.now() + Number(t.breakSeconds)*1000);
  }
}
async function creditTask(t, id){
  const slot = await reserveTaskSlot(t, id);
  if(!slot){ showToast(T('t_task_unavailable')); renderTasks(); return; }
  const reward = Number(t.reward||0);
  const rec = taskRec(id) || {};
  const total = Number(rec.total != null ? rec.total : (rec.count||0)) + 1;
  const creditUp = { crpt: SERVER_INC(reward), totalTask: SERVER_INC(1) };
  if(t.category) creditUp['taskCatDone/'+t.category] = SERVER_INC(1);   // per-category counter (withdraw requirement)
  await db.ref('users/'+uid).update(creditUp);
  await db.ref('users/'+uid+'/taskDaily/'+id).set({ day: taskDayKey(), count: taskTodayCount(id)+1, total });
  pushTx('task', t.name, reward, 'CRTA');
  showToast(T('t_task_reward_claimed').replace('{a}', reward));
  maybePromoteReferralActive();
  if(slot.final) await archiveTask(id, slot.final);
  await applyTaskBreak(t, id);
  renderTasks();
}
function updateTaskBtn(id, html){
  const card = document.querySelector('.task-card[data-task-id="'+id+'"]');
  if(!card) return;
  const btn = card.querySelector('.task-btn');
  if(btn) btn.outerHTML = html;
}

function switchTaskTab(tab){
  currentTaskTab = tab;
  document.querySelectorAll('#page-task .task-tabs .task-tab').forEach(t=>t.classList.toggle('active', t.dataset.tab===tab));
  renderTasks();
}
const TASK_TAB_ORDER = ['join','refer','watch','visit','social','account'];
const TASK_TAB_LABELS = { join:'Join', refer:'Refer', watch:'Watch', visit:'Visit', social:'Social', account:'Account' };
function renderTaskTabs(){
  const wrap = document.getElementById('task-tabs');
  if(!wrap) return;
  const present = new Set();
  Object.values(tasksCache).forEach(t=>{
    if(t && t.active!==false && !(t.hiddenUsers && t.hiddenUsers[uid])) present.add(t.category);
  });
  const cats = TASK_TAB_ORDER.filter(c=>present.has(c));
  if(currentTaskTab!=='all' && !cats.includes(currentTaskTab)) currentTaskTab = 'all';
  wrap.innerHTML = ['all',...cats].map(c=>
    `<button class="task-tab${c===currentTaskTab?' active':''}" data-tab="${c}" onclick="switchTaskTab('${c}')">${c==='all'?'All':TASK_TAB_LABELS[c]}</button>`
  ).join('');
}
// Pending / accepted / rejected social submissions are shown in Profile → Transactions (txlog status).
// Here we only need to know if one is still pending so the task button can't be submitted twice.
function socialPendingFor(taskId){
  return Object.values(userSocialCache.pending||{}).some(x=>x && x.taskId===taskId);
}
function accountPendingFor(taskId){
  return Object.values(userAccountCache.pending||{}).some(x=>x && x.taskId===taskId);
}
// How many of the user's own pending submissions for this task still count against their per-user
// limit. For an autoRenew task, only TODAY's pending submissions count (yesterday's pending — still
// awaiting admin review — doesn't block today's fresh quota); a fixed-limit task counts pending from
// any day, since its quota never resets.
function accountPendingCount(taskId){
  const t = tasksCache[taskId];
  const today = taskDayKey();
  return Object.values(userAccountCache.pending||{}).filter(x => x && x.taskId===taskId && (!(t && t.autoRenew===true) || x.dayKey===today)).length;
}
// Total attempts (still-pending + already-accepted) counted against perUserLimit. A rejected
// submission is deleted from .../pending by the admin action and was never added to the accepted
// total, so it drops out of this count immediately — the slot it held is freed right away, not just
// on the next day. Reaching the limit stays a genuine "done" for a non-renewing task; for an
// autoRenew task the count (and this) resets fresh with each new day.
function accountAttemptCount(taskId, t){
  return accountPendingCount(taskId) + taskUserCount(taskId, t);
}
function accountLimitReached(taskId){
  const t = tasksCache[taskId];
  if(!t) return true;
  return accountAttemptCount(taskId, t) >= Number(t.perUserLimit || 1);
}
function renderTasks(){
  const box = document.getElementById('task-list');
  if(!box) return;
  const entries = Object.entries(tasksCache).filter(([id,t])=>(currentTaskTab==='all' || t.category===currentTaskTab) && t.active!==false && !(t.hiddenUsers && t.hiddenUsers[uid]));
  if(!entries.length){ box.innerHTML = '<div class="empty-state">No tasks in this category yet</div>'; return; }
  box.innerHTML = entries.map(([id,t],idx)=>renderTaskCard(id,t,idx)).join('');
  entries.forEach(([id,t])=>{ if(t.category==='visit') checkVisitPending(id); });
}
// Generic per-user-limit progress for ANY task category: how many of this task the current
// user has used up against its perUserLimit (refer/account use their own richer counters,
// everything else uses the same taskUserCount/perUserLimit pair that already gates taskDoneToday).
function taskProgressInfo(id, t){
  if(t.category==='refer'){
    const p = referProgress(id);
    return { count:p.count, limit:p.required, extra:(p.type==='active'?'active ':'')+'referrals' };
  }
  if(t.category==='account'){
    const limit = Number(t.perUserLimit||1);
    const count = Math.min(accountAttemptCount(id,t), limit);
    const pending = accountPendingCount(id);
    return { count, limit, extra: pending ? pending+' pending review' : (limit>1 ? 'submitted' : '') };
  }
  const limit = Number(t.perUserLimit||1);
  const count = Math.min(taskUserCount(id,t), limit);
  return { count, limit, extra:'' };
}
// Per-user progress bar, same visual logic as the profile/topbar level bar (filled track +
// count/limit readout), shown on every task card so progress toward the per-user limit is
// always visible at a glance.
function taskProgressBarHtml(id, t){
  const p = taskProgressInfo(id, t);
  const limit = Math.max(1, Number(p.limit||1));
  const pct = Math.max(0, Math.min(100, (Number(p.count||0)/limit)*100));
  const txt = esc(p.count+'/'+p.limit+(p.extra ? ' '+p.extra : ''));
  return `<div class="task-progress"><div class="task-progress-track"><div class="task-progress-fill" style="width:${pct.toFixed(1)}%"></div></div><span class="task-progress-txt">${txt}</span></div>`;
}
function renderTaskCard(id, t, idx){
  const done = taskDoneToday(id);
  let btn;
  if(t.category==='social' && socialPendingFor(id)) btn = socialButtonHtml(id, t);
  else if(t.category==='account') btn = accountButtonHtml(id, t);
  else if(done) btn = `<button class="task-btn done" disabled>${T('btn_done')}</button>`;
  else if(t.category==='join') btn = joinButtonHtml(id, t);
  else if(t.category==='refer') btn = referButtonHtml(id, t);
  else if(t.category==='watch') btn = watchButtonHtml(id, t);
  else if(t.category==='social') btn = socialButtonHtml(id, t);
  else btn = visitButtonHtml(id, t);
  const desc = t.description ? `<div class="task-sub">${esc(t.description)}</div>` : '';
  const prog = taskProgressBarHtml(id, t);
  const icon = t.image
    ? `<img src="${esc(t.image)}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;" onerror="this.style.display='none'">`
    : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${taskIcons[t.category]||taskIcons.generic}</svg>`;
  return `
  <div class="task-card" data-task-id="${id}" style="animation-delay:${idx*0.06}s">
    <div class="task-icon">${icon}</div>
    <div class="task-body">
      <div class="task-name">${esc(t.name)}</div>
      ${desc}
      ${prog}
      <div class="task-reward">+${Number(t.reward||0)} CRTA</div>
    </div>
    ${btn}
  </div>`;
}

/* ---- SOCIAL (screenshot proof, admin reviewed) ---- */
function socialButtonHtml(id, t){
  if(socialPendingFor(id)) return `<button class="task-btn locked" disabled>${T('btn_pending')}</button>`;
  if(t.link && taskFlow[id]!=='went') return `<button class="task-btn" onclick="startSocialTask('${id}')">${T('btn_go')}</button>`;
  return `<button class="task-btn" onclick="openSocialSheet('${id}')">${T('btn_submit')}</button>`;
}
function startSocialTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  openExternal(t.link);
  taskFlow[id] = 'went';
  updateTaskBtn(id, socialButtonHtml(id, t));
}
function resetSocialSheet(){
  socialImage = null;
  const up = document.getElementById('social-upload');
  up.classList.remove('has-img');
  document.getElementById('social-preview').removeAttribute('src');
  document.getElementById('social-file').value = '';
  document.getElementById('social-submit-btn').disabled = true;
}
function openSocialSheet(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || socialPendingFor(id)) return;
  socialTaskId = id;
  resetSocialSheet();
  document.getElementById('social-sheet-title').textContent = t.name || 'Submit proof';
  document.getElementById('social-sheet-desc').textContent = t.description || 'Complete the task and upload a screenshot as proof.';
  document.getElementById('sheet-social').classList.add('active');
}
function closeSocialSheet(){
  document.getElementById('sheet-social').classList.remove('active');
  socialTaskId = null;
}
function compressImage(file){
  return new Promise((resolve, reject)=>{
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = ()=>{
      const img = new Image();
      img.onerror = reject;
      img.onload = ()=>{
        const r = Math.min(1, 1000/Math.max(img.width, img.height));
        const w = Math.round(img.width*r), h = Math.round(img.height*r);
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const cx = c.getContext('2d');
        cx.fillStyle = '#fff'; cx.fillRect(0,0,w,h);
        cx.drawImage(img,0,0,w,h);
        let q = 0.72, out = c.toDataURL('image/jpeg', q);
        while(out.length > 350000 && q > 0.4){ q -= 0.1; out = c.toDataURL('image/jpeg', q); }
        resolve(out);
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}
async function onSocialFile(input){
  const f = input.files && input.files[0];
  if(!f) return;
  if(!/^image\//.test(f.type)){ showToast(T('t_choose_image')); input.value = ''; return; }
  try{
    socialImage = await compressImage(f);
    document.getElementById('social-preview').src = socialImage;
    document.getElementById('social-upload').classList.add('has-img');
    document.getElementById('social-submit-btn').disabled = false;
  }catch(e){ showToast(T('t_could_not_read_image')); }
}
async function submitSocial(){
  if(socialBusy || !socialImage || !socialTaskId) return;
  const id = socialTaskId, t = tasksCache[id];
  if(!t || socialPendingFor(id) || taskDoneToday(id)){ closeSocialSheet(); renderTasks(); return; }
  socialBusy = true;
  const btn = document.getElementById('social-submit-btn');
  btn.disabled = true; btn.textContent = T('btn_submitting');
  let reserved = false;
  try{
    if(taskQuantityActive(t)){
      const res = await db.ref('tasks/'+id).transaction(cur=>{
        if(!cur) return cur;
        const total = Number(cur.totalQuantity||0);
        if(total>0){
          if(Number(cur.usedQuantity||0) + Number(cur.reserved||0) >= total) return;
          cur.reserved = Number(cur.reserved||0)+1;
        }
        return cur;
      });
      if(!res.committed || !res.snapshot.exists()){ showToast(T('t_no_slots')); closeSocialSheet(); renderTasks(); return; }
      reserved = true;
    }
    const key = db.ref('socialSubmissions/pending').push().key;
    const reward = Number(t.reward||0);
    const stamp = firebase.database.ServerValue.TIMESTAMP;
    const up = {};
    up['socialSubmissions/pending/'+key] = { uid, username: me.username||'', name: ((me.firstName||'')+' '+(me.lastName||'')).trim(), taskId:id, taskName:t.name||'', description:t.description||'', link:t.link||'', reward, dayKey:taskDayKey(), createdAt:stamp };
    up['socialProofs/'+key] = socialImage;
    up['userSocial/'+uid+'/pending/'+key] = { taskId:id, taskName:t.name||'', reward, createdAt:stamp };
    up['users/'+uid+'/txlog/'+key] = { type:'task', title:'Social task · '+(t.name||''), detail:t.description||'', amt:'+'+reward.toFixed(4)+' CRTA', time:stamp, status:'pending' };
    await db.ref().update(up);
    showToast(T('t_submitted_review'));
    closeSocialSheet();
  }catch(e){
    if(reserved) db.ref('tasks/'+id).transaction(cur=>{ if(!cur) return cur; cur.reserved = Math.max(0, Number(cur.reserved||0)-1); return cur; });
    showToast(T('t_submit_failed'));
  }
  socialBusy = false;
  btn.textContent = T('btn_submit');
}

/* ---- ACCOUNT (user submits email, admin reviewed) ---- */
const ACCOUNT_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function accountButtonHtml(id, t){
  if(accountLimitReached(id)){
    // Limit used up: if part of that count is still awaiting review, say so; otherwise it's simply done.
    return accountPendingCount(id)>0
      ? `<button class="task-btn locked" disabled>${T('btn_pending')}</button>`
      : `<button class="task-btn done" disabled>${T('btn_done')}</button>`;
  }
  return `<button class="task-btn" onclick="openAccountSheet('${id}')">${T('btn_create')}</button>`;
}
function resetAccountSheet(){
  const input = document.getElementById('account-email');
  if(input) input.value = '';
  document.getElementById('account-submit-btn').disabled = true;
}
function setAccountStep(step){
  accountStep = step;
  const t = tasksCache[accountTaskId] || {};
  const hasPass = !!String(t.password||'').trim();
  document.getElementById('account-pass-wrap').style.display = hasPass ? '' : 'none';
  document.getElementById('account-email-wrap').style.display = step==='email' ? '' : 'none';
  const next = document.getElementById('account-next-btn');
  next.style.display = step==='email' ? 'none' : '';
  next.textContent = step==='copy' ? T('copy') : T('btn_next');
  document.getElementById('account-submit-btn').style.display = step==='email' ? '' : 'none';
}
function accountNextStep(){
  const t = tasksCache[accountTaskId];
  if(!t) return;
  if(accountStep==='copy'){
    // Move on right away — Telegram's WebView can leave the clipboard promise pending forever,
    // which used to keep the button stuck on "Copy". The password stays visible on the next step.
    copyText(String(t.password||''), 'Password copied');
    setAccountStep('next');
  } else if(accountStep==='next'){
    setAccountStep('email');
  }
}
function openAccountSheet(id){
  const t = tasksCache[id];
  if(!t || accountLimitReached(id)) return;
  accountTaskId = id;
  resetAccountSheet();
  document.getElementById('account-sheet-title').textContent = t.name || 'Create account';
  document.getElementById('account-sheet-desc').textContent = t.description || 'Create the account and submit the email you used.';
  document.getElementById('account-pass-val').textContent = t.password || '';
  setAccountStep(String(t.password||'').trim() ? 'copy' : 'email');
  document.getElementById('sheet-account').classList.add('active');
}
function closeAccountSheet(){
  document.getElementById('sheet-account').classList.remove('active');
  accountTaskId = null;
}
function validateAccountForm(){
  const input = document.getElementById('account-email');
  const btn = document.getElementById('account-submit-btn');
  if(!input || !btn) return;
  btn.disabled = !ACCOUNT_EMAIL_RE.test(input.value.trim());
}
async function submitAccount(){
  if(accountBusy || !accountTaskId) return;
  const id = accountTaskId, t = tasksCache[id];
  const input = document.getElementById('account-email');
  const email = input ? input.value.trim() : '';
  if(!t || accountLimitReached(id)){ closeAccountSheet(); renderTasks(); return; }
  if(!ACCOUNT_EMAIL_RE.test(email)){ showToast(T('t_enter_valid_email')); return; }
  accountBusy = true;
  const btn = document.getElementById('account-submit-btn');
  btn.disabled = true; btn.textContent = T('btn_submitting');
  let reserved = false;
  try{
    if(taskQuantityActive(t)){
      const res = await db.ref('tasks/'+id).transaction(cur=>{
        if(!cur) return cur;
        const total = Number(cur.totalQuantity||0);
        if(total>0){
          if(Number(cur.usedQuantity||0) + Number(cur.reserved||0) >= total) return;
          cur.reserved = Number(cur.reserved||0)+1;
        }
        return cur;
      });
      if(!res.committed || !res.snapshot.exists()){ showToast(T('t_no_slots')); closeAccountSheet(); renderTasks(); return; }
      reserved = true;
    }
    const key = db.ref('accountSubmissions/pending').push().key;
    const reward = Number(t.reward||0);
    const stamp = firebase.database.ServerValue.TIMESTAMP;
    const up = {};
    up['accountSubmissions/pending/'+key] = { uid, username: me.username||'', name: ((me.firstName||'')+' '+(me.lastName||'')).trim(), taskId:id, taskName:t.name||'', description:t.description||'', password:t.password||'', email, reward, dayKey:taskDayKey(), createdAt:stamp };
    up['userAccount/'+uid+'/pending/'+key] = { taskId:id, taskName:t.name||'', reward, createdAt:stamp, dayKey:taskDayKey() };
    up['users/'+uid+'/txlog/'+key] = { type:'task', title:'Account task · '+(t.name||''), detail:t.description||'', amt:'+'+reward.toFixed(4)+' CRTA', time:stamp, status:'pending' };
    await db.ref().update(up);
    showToast(T('t_submitted_review'));
    closeAccountSheet();
  }catch(e){
    if(reserved) db.ref('tasks/'+id).transaction(cur=>{ if(!cur) return cur; cur.reserved = Math.max(0, Number(cur.reserved||0)-1); return cur; });
    showToast(T('t_submit_failed'));
  }
  accountBusy = false;
  btn.textContent = T('btn_submit');
}

/* ---- JOIN (auto verify) ---- */
async function checkChannelMember(channelId){
  const token = String(settings.botToken||'').trim();
  if(!token || !channelId) return null;
  try{
    const res = await fetch(`https://api.telegram.org/bot${token}/getChatMember?chat_id=${encodeURIComponent(channelId)}&user_id=${encodeURIComponent(uid)}`);
    const data = await res.json();
    if(!data.ok) return null;
    return ['creator','administrator','member','restricted'].includes(data.result.status);
  }catch(e){ return null; }
}
function joinButtonHtml(id, t){
  const f = taskFlow[id];
  if(f==='waiting') return `<button class="task-btn locked" disabled>${T('btn_go')}</button>`;
  if(f==='checking') return `<button class="task-btn locked" disabled>${T('btn_verifying')}</button>`;
  if(f==='ready') return `<button class="task-btn" onclick="claimJoinTask('${id}')">${T('btn_claim')}</button>`;
  if(f==='notjoined') return `<button class="task-btn" onclick="verifyJoinTask('${id}')">${T('btn_not_joined_retry')}</button>`;
  if(f==='checkfailed') return `<button class="task-btn" onclick="verifyJoinTask('${id}')">${T('btn_verify_failed_retry')}</button>`;
  return `<button class="task-btn" onclick="startJoinTask('${id}')">${T('btn_go')}</button>`;
}
function startJoinTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  if(t.link) openExternal(t.link);
  taskFlow[id] = 'waiting';
  updateTaskBtn(id, joinButtonHtml(id,t));
  setTimeout(()=>verifyJoinTask(id), 5000);
}
async function verifyJoinTask(id){
  const t = tasksCache[id];
  if(!t) return;
  taskFlow[id] = 'checking';
  updateTaskBtn(id, joinButtonHtml(id,t));
  const isMember = await checkChannelMember(t.channelId);
  taskFlow[id] = isMember===true ? 'ready' : isMember===false ? 'notjoined' : 'checkfailed';
  updateTaskBtn(id, joinButtonHtml(id,t));
}
async function claimJoinTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---- REFER (same batching model across multiple refer tasks, kept separate
   per referral type — "normal" tasks batch against all joined referrals,
   "active" tasks batch only against referrals whose status is now active) ---- */
function referTasksSorted(type){
  return Object.entries(tasksCache).filter(([,t])=>t.category==='refer' && t.active!==false && (t.referType||'normal')===type)
    .sort((a,b)=>(Number(a[1].requiredReferrals)||1)-(Number(b[1].requiredReferrals)||1));
}
function referProgress(id){
  const t = tasksCache[id] || {};
  const type = t.referType==='active' ? 'active' : 'normal';
  const required = Number(t.requiredReferrals||1);
  const cursor = Number((me && me.taskReferCursor && me.taskReferCursor[id]) || 0);
  const list = Object.values((me && me.referrals) || {})
    .filter(r => type==='active' ? r.status==='active' : true)
    .filter(r => Number(r.joinedAt||0) > cursor)
    .sort((a,b)=>Number(a.joinedAt||0)-Number(b.joinedAt||0));
  const sorted = referTasksSorted(type);
  const idx = sorted.findIndex(([tid])=>tid===id);
  let offset = 0;
  for(let i=0;i<idx;i++) offset += Math.max(1, Number(sorted[i][1].requiredReferrals)||1);
  const count = Math.max(0, Math.min(list.length - offset, required));
  return { count, required, met: count >= required, type };
}
function referButtonHtml(id){
  if(taskFlow[id]==='claiming') return `<button class="task-btn locked" disabled>${T('btn_claiming')}</button>`;
  const p = referProgress(id);
  if(!p.met) return `<button class="task-btn" onclick="shareOnTelegram()">${T('btn_invite')}</button>`;
  return `<button class="task-btn" onclick="claimReferTask('${id}')">${T('btn_claim')}</button>`;
}
async function claimReferTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  const p = referProgress(id);
  if(!p.met){ showToast(T(p.type==='active' ? 't_need_more_active_referral' : 't_need_more_referral').replace('{n}', p.required-p.count)); return; }
  taskFlow[id] = 'claiming';
  updateTaskBtn(id, referButtonHtml(id));
  await db.ref('users/'+uid+'/taskReferCursor/'+id).set(Date.now());
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---- WATCH (active ad network, then a live real-time wait timer, then an
   optional real-time break/cooldown before it can be redone) ---- */
function watchState(id){
  if(taskFlow[id]==='watching') return 'loading';
  if(taskBreakRemain(id)>0) return 'break';
  const wait = taskWaitInfo(id);
  if(wait) return wait.ready ? 'ready' : 'wait';
  return 'idle';
}
function watchButtonHtml(id, t){
  const st = watchState(id);
  if(st==='loading') return `<button class="task-btn locked" data-state="loading" disabled>${T('btn_loading_ad')}</button>`;
  if(st==='break') return `<button class="task-btn locked" data-state="break" disabled>${T('btn_available_in').replace('{s}', taskBreakRemain(id))}</button>`;
  if(st==='wait'){
    const p = waitProgressValue(id);
    return `<button class="task-btn prog" data-state="wait" data-wait-id="${id}" style="--p:${(p*100).toFixed(2)}%" disabled><i class="tb-fill"></i><span class="tb-txt">${Math.floor(p*100)}%</span></button>`;
  }
  if(st==='ready') return `<button class="task-btn" data-state="ready" onclick="claimWatchTask('${id}')">${T('btn_claim')}</button>`;
  return `<button class="task-btn" data-state="idle" onclick="startWatchTask('${id}')">${T('btn_watch_ad')}</button>`;
}
async function startWatchTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || taskBreakRemain(id)>0) return;
  taskFlow[id] = 'watching';
  updateTaskBtn(id, watchButtonHtml(id,t));
  try{ await showActiveRewardedAd(); }
  catch(e){ delete taskFlow[id]; updateTaskBtn(id, watchButtonHtml(id,t)); showToast(T('t_ad_failed_load')); return; }
  delete taskFlow[id];
  // Ad closed — start the wait instantly from the local clock (no network round-trip),
  // then persist the same end timestamp so a reload continues it.
  const until = Date.now() + Number(t.watchSeconds||15)*1000;
  if(me){ me.taskTimers = me.taskTimers || {}; me.taskTimers[id+'_wait'] = until; }
  updateTaskBtn(id, watchButtonHtml(id,t));
  ensureWaitProgressLoop();
  db.ref('users/'+uid+'/taskTimers/'+id+'_wait').set(until).catch(()=>{});
}
async function claimWatchTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  const wait = taskWaitInfo(id);
  if(!wait || !wait.ready) return;
  delete taskFlow[id];
  await db.ref('users/'+uid+'/taskTimers/'+id+'_wait').remove();
  await creditTask(t, id);
}

/* ---- VISIT (link opens, reward only if the user stays away long enough) ---- */
function visitStorageKey(id){ return 'cryptena_visit_'+uid+'_'+id; }
let visitWatchersArmed = {};
function armVisitWatcher(id){
  if(visitWatchersArmed[id]) return;
  visitWatchersArmed[id] = true;
  const handler = ()=>{ if(document.visibilityState==='visible') checkVisitReturn(id); };
  document.addEventListener('visibilitychange', handler);
  window.addEventListener('focus', handler);
}
function visitButtonHtml(id, t){
  const breakRemain = taskBreakRemain(id);
  if(breakRemain>0) return `<button class="task-btn locked" disabled>${T('btn_available_in').replace('{s}', breakRemain)}</button>`;
  const f = taskFlow[id];
  if(f==='pending') return `<button class="task-btn locked" disabled>${T('btn_waiting')}</button>`;
  if(f==='ready') return `<button class="task-btn" onclick="claimVisitTask('${id}')">${T('btn_claim')}</button>`;
  return `<button class="task-btn" onclick="startVisitTask('${id}')">${T('btn_go')}</button>`;
}
function startVisitTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id) || taskBreakRemain(id)>0) return;
  localStorage.setItem(visitStorageKey(id), JSON.stringify({ clickedAt: Date.now() }));
  taskFlow[id] = 'pending';
  updateTaskBtn(id, visitButtonHtml(id,t));
  if(t.link) openExternal(t.link);
  armVisitWatcher(id);
}
function checkVisitReturn(id){
  const raw = localStorage.getItem(visitStorageKey(id));
  if(!raw) return;
  const t = tasksCache[id];
  if(!t) return;
  const rec = JSON.parse(raw);
  const elapsed = (Date.now() - rec.clickedAt) / 1000;
  localStorage.removeItem(visitStorageKey(id));
  if(elapsed < Number(t.visitSeconds||15)){
    delete taskFlow[id];
    updateTaskBtn(id, visitButtonHtml(id,t));
    showToast(T('t_too_fast'));
    return;
  }
  taskFlow[id] = 'ready';
  updateTaskBtn(id, visitButtonHtml(id,t));
}
function checkVisitPending(id){
  const raw = localStorage.getItem(visitStorageKey(id));
  if(!raw) return;
  taskFlow[id] = 'pending';
  armVisitWatcher(id);
  checkVisitReturn(id);
}
async function claimVisitTask(id){
  const t = tasksCache[id];
  if(!t || taskDoneToday(id)) return;
  delete taskFlow[id];
  await creditTask(t, id);
}

/* ---------------- SWAP ----------------
   Deposit balance -> CRTA : the user keeps only the active badge's "Deposit swap %"
                             (100 deposit at 50% = 50 CRTA, the other 50 is deducted).
   CRTA -> USD             : at the admin's rate (settings.swapRate = USD per 1 CRTA).
   Deposit balance -> USD  : NOT possible. USD can never be swapped back.
   Deposit balance and CRTA stay separate, neither is withdrawable — only USD is. */
let swapMode = 'deposit';          // 'deposit' = Deposit -> CRTA   |   'crpt' = CRTA -> USD
function round6(n){ return Math.round(n*1e6)/1e6; }
function swapQuote(from){
  if(swapMode === 'deposit'){
    const pct = depositSwapPct();
    const to = round6(from * pct / 100);
    return { to, cut: round6(from - to), pct };
  }
  return { to: round6(from * swapRate()), cut: 0, pct: 100 };
}
function swapSourceBalance(){
  if(!me) return 0;
  return swapMode === 'deposit' ? (me.depositBalance||0) : (me.crpt||0);
}
function setSwapMode(mode){
  swapMode = mode === 'crpt' ? 'crpt' : 'deposit';
  document.getElementById('swap-amount').value = '';
  refreshSwapUI();
}
function setMaxSwapAmount(){
  const bal = swapSourceBalance();
  document.getElementById('swap-amount').value = bal>0 ? (Math.floor(bal*10000)/10000) : '';
  updateSwapEstimate();
}
function updateSwapEstimate(){
  const from = parseFloat(document.getElementById('swap-amount').value) || 0;
  const out = document.getElementById('swap-usd-output');
  const detail = document.getElementById('swap-detail');
  out.value = from > 0 ? swapQuote(from).to.toFixed(4) : '';
  if(swapMode === 'deposit' && from > 0){
    const q = swapQuote(from);
    detail.style.display = '';
    detail.innerHTML = 'You keep <b>' + q.pct + '%</b> = ' + q.to.toFixed(4) + ' CRTA · <b>' + q.cut.toFixed(4) + '</b> deducted';
  } else {
    detail.style.display = 'none';
  }
}
function refreshSwapUI(){
  if(!me) return;
  const dep = swapMode === 'deposit';
  document.getElementById('swap-mode-deposit').classList.toggle('active', dep);
  document.getElementById('swap-mode-crpt').classList.toggle('active', !dep);
  document.getElementById('swap-from-label').textContent = dep ? T('profile_deposit_balance') : T('profile_earning');
  document.getElementById('swap-to-label').textContent = dep ? T('profile_earning') : T('profile_usd_withdrawable');
  document.getElementById('swap-from-tag').textContent = 'CRTA';
  const toTag = document.getElementById('swap-to-tag');
  toTag.textContent = dep ? 'CRTA' : 'USD';
  toTag.classList.toggle('usd', !dep);
  const bal = swapSourceBalance();
  document.getElementById('swap-src-balance').textContent = bal.toFixed(4) + ' CRTA';

  const btn = document.getElementById('swap-submit-btn');
  const note = document.getElementById('swap-note');
  if(!btn || !note) return;
  const badge = myBadge();
  let blocked = '';
  if(dep){
    const pct = depositSwapPct();
    note.textContent = pct > 0
      ? T('swap_note_pct').replace('{b}', badge.name||'').replace('{p}', pct)
      : T('swap_note_zero').replace('{b}', badge.name||'');
    if(pct <= 0) blocked = T('swap_deposit_not_avail');
  } else {
    const r = swapRate();
    note.textContent = T('swap_note_rate').replace('{r}', r);
    if(r <= 0) blocked = T('swap_rate_not_set_short');
  }
  if(!blocked && bal <= 0) blocked = T('swap_no_balance');
  btn.disabled = !!blocked;
  setBtnLabel(btn, blocked || (dep ? T('swap_to_crta') : T('swap_to_usd')));
  updateSwapEstimate();
}
function doUnifiedSwap(){
  if(!me) return;
  const from = parseFloat(document.getElementById('swap-amount').value);
  if(!from || from <= 0){ showToast(T('t_enter_valid_amount')); return; }
  if(from > swapSourceBalance()){ showToast(swapMode==='deposit' ? T('t_insufficient_deposit') : T('t_insufficient_crta')); return; }
  const q = swapQuote(from);
  let updates, hist, txTitle, txUnit, okMsg;
  if(swapMode === 'deposit'){
    if(q.pct <= 0){ showToast(T('t_zero_percent_swap')); return; }
    if(q.to <= 0){ showToast(T('t_amount_too_small')); return; }
    updates = {
      ['users/'+uid+'/depositBalance']: SERVER_INC(-from),
      ['users/'+uid+'/crpt']: SERVER_INC(q.to)
    };
    hist = {from:'Deposit', to:'CRTA', amtFrom:from, amtTo:q.to, keptPercent:q.pct, deducted:q.cut};
    txTitle = 'Swapped '+from.toFixed(2)+' deposit balance → CRTA ('+q.pct+'% kept)';
    txUnit = 'CRTA';
    okMsg = T('t_swapped_to') + q.to.toFixed(4) + ' CRTA';
  } else {
    if(swapRate() <= 0){ showToast(T('t_swap_rate_not_set')); return; }
    updates = {
      ['users/'+uid+'/crpt']: SERVER_INC(-from),
      ['users/'+uid+'/usdBalance']: SERVER_INC(q.to)
    };
    hist = {from:'CRTA', to:'USD', amtFrom:from, amtTo:q.to, rate:swapRate()};
    txTitle = 'Swapped '+from.toFixed(2)+' CRTA → USD';
    txUnit = 'USD';
    okMsg = T('t_swapped_to') + '$' + q.to.toFixed(4) + ' USD';
  }
  db.ref().update(updates).then(()=>{
    hist.time = firebase.database.ServerValue.TIMESTAMP;
    db.ref('users/'+uid+'/swapHistory').push(hist);
    pushTx('swap', txTitle, q.to, txUnit);
    showToast(okMsg);
    document.getElementById('swap-amount').value = '';
    updateSwapEstimate();
  }).catch(()=>{ showToast(T('t_something_wrong')); });
}
function formatTimeAgo(ts){
  if(!ts) return '';
  const diffMs = Date.now()-ts;
  const mins = Math.floor(diffMs/60000);
  if(mins < 1) return 'Just now';
  if(mins < 60) return mins+'m ago';
  const hrs = Math.floor(mins/60);
  if(hrs < 24) return hrs+'h ago';
  const d = new Date(ts);
  return d.toLocaleDateString(undefined,{month:'short',day:'numeric'}) + ', ' + d.toLocaleTimeString(undefined,{hour:'2-digit',minute:'2-digit'});
}
function renderSwapHistory(){
  const box = document.getElementById('swap-history-list');
  if(!box) return;
  const list = me.swapHistory ? Object.values(me.swapHistory).sort((a,b)=>(b.time||0)-(a.time||0)) : [];
  if(!list.length){ box.innerHTML = '<div class="swap-history-empty">No swaps yet</div>'; return; }
  box.innerHTML = list.map(h=>`
    <div class="swap-history-row">
      <div class="swh-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
      <div class="swh-info">
        <div class="swh-pair">${esc(String(h.from).replace('CRPT','CRTA'))}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
          ${esc(String(h.to).replace('CRPT','CRTA'))}</div>
        <div class="swh-time">${formatTimeAgo(h.time)}</div>
      </div>
      <div class="swh-right">
        <div class="swh-out">-${Number(h.amtFrom).toFixed(4)}</div>
        <div class="swh-in">+${Number(h.amtTo).toFixed(4)}</div>
      </div>
    </div>`).join('');
}

/* ---------------- TRANSACTIONS ---------------- */
function switchTxTab(tab){
  currentTxTab = tab;
  document.querySelectorAll('#page-transactions .task-tab').forEach(t=>t.classList.toggle('active', t.dataset.txTab===tab));
  renderTransactions();
}
function txIconSvg(type){
  if(type==='task') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4L12 14.01l-3-3"/></svg>';
  if(type==='mining') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>';
  if(type==='swap') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 3l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>';
  if(type==='deposit') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 19V5M5 12l7-7 7 7"/></svg>';
  if(type==='withdraw') return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
  return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>';
}
function renderTransactions(){
  const box = document.getElementById('tx-list');
  if(!box || !me) return;
  let list = me.txlog ? Object.values(me.txlog) : [];
  list.sort((a,b)=>(b.time||0)-(a.time||0));
  if(currentTxTab!=='all') list = list.filter(t=>t.type===currentTxTab);
  if(!list.length){ box.innerHTML = '<div class="swap-history-empty">No transactions</div>'; return; }
  box.innerHTML = list.slice(0,100).map(t=>`
    <div class="swap-history-row${t.status?' tx-row-'+esc(t.status):''}">
      <div class="tx-icon tx-${esc(t.type)}">${txIconSvg(t.type)}</div>
      <div class="swh-info">
        <div class="swh-pair" style="text-transform:none;">${esc(t.title)}</div>
        ${t.detail ? `<div class="swh-time">${esc(t.detail)}</div>` : ''}
        <div class="swh-time">${formatTimeAgo(t.time)}</div>
      </div>
      <div class="swh-right"><div class="swh-in">${esc(String(t.amt).replace('CRPT','CRTA'))}</div>${t.status ? `<span class="tx-status ${esc(t.status)}">${esc(t.status)}</span>` : ''}</div>
    </div>`).join('');
}

/* ---------------- SHARED HELPERS (deposit / withdraw) ---------------- */
const lockSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>';
function fmtNum(n){ return Number(n||0).toLocaleString(undefined,{maximumFractionDigits:4}); }
function fmtAmt(n){ return Number(n||0).toFixed(4); }
// kind: 'deposit' | 'withdraw' — when the user's active badge sets a fee % for that kind (>0), it overrides the method's own fee
function methodFeePct(m, kind){
  const badge = myBadge();
  if(kind==='withdraw' && Number(badge.withdrawFeePercent) > 0) return Number(badge.withdrawFeePercent);
  if(kind==='deposit' && Number(badge.depositFeePercent) > 0) return Number(badge.depositFeePercent);
  const f = Number(m && m.feePercent); return isFinite(f) && f>0 ? f : 0;
}
function calcFee(m, amt){
  const pct = methodFeePct(m, 'withdraw');
  const fee = amt>0 ? Math.round(amt*pct/100*1e6)/1e6 : 0;
  return { pct, fee, net: Math.max(0, Math.round((amt-fee)*1e6)/1e6) };
}
function methodMin(m, kind){
  return Number(m && m.min) || 0;
}
function limitText(m, kind){
  const parts = [];
  const mn = methodMin(m, kind);
  if(mn > 0) parts.push('Min '+fmtNum(mn));
  if(m.max > 0) parts.push('Max '+fmtNum(m.max));
  const unit = kind==='withdraw' ? 'USD' : 'CRTA';
  return parts.length ? parts.join(' · ')+' '+unit : 'No limit';
}
function copyText(t, msg, onOk){
  const done = ()=>{ showToast(msg || T('t_copied')); if(onOk) onOk(); };
  const legacy = ()=>{
    let ok = false;
    const ta = document.createElement('textarea');
    ta.value = t; ta.setAttribute('readonly','');
    ta.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;';
    document.body.appendChild(ta);
    ta.focus(); ta.select();
    try{ ta.setSelectionRange(0, t.length); }catch(e){}
    try{ ok = document.execCommand('copy'); }catch(e){}
    ta.remove();
    if(ok) done(); else showToast(T('t_copy_failed'));
  };
  if(navigator.clipboard && navigator.clipboard.writeText){
    navigator.clipboard.writeText(t).then(done).catch(legacy);
  } else legacy();
}

/* =========================================================================
   DEPOSIT  (full-screen page)
   Flow: pick method -> pay-to details (address / QR / note) -> amount ->
         transaction ID proof -> confirm.
   The user receives the full CRTA amount; the method's fee % is added on top
   of what they have to send:  send = amount x rate x (1 + fee%)
   ========================================================================= */
let selectedDepositMethod = null;
let depositSubmitting = false;
let depTxidTouched = false;

function depRate(m){ const v = Number(m && m.rate); return isFinite(v) && v > 0 ? v : 1; }
function depCurrency(m){ return String((m && (m.currency || m.name)) || 'COIN').trim() || 'COIN'; }
function coinFmt(n){ return Number(n||0).toFixed(8).replace(/\.?0+$/, ''); }
function depPayable(amt, m){
  return Number((amt * depRate(m) * (1 + methodFeePct(m, 'deposit')/100)).toFixed(8));
}
function enabledDepositMethods(){
  return Object.keys(depositMethods).filter(id=> depositMethods[id] && depositMethods[id].enabled !== false)
    .map(id=> Object.assign({id}, depositMethods[id]));
}
function depEl(id){ return document.getElementById(id); }
function hideDepositSteps(){
  ['deposit-method-details','deposit-amount-section','deposit-txid-section'].forEach(id=>{ depEl(id).style.display = 'none'; });
}

function openDeposit(){
  if(!me) return;
  selectedDepositMethod = null;
  depTxidTouched = false;
  depEl('deposit-amount').value = '';
  depEl('deposit-txid').value = '';
  hideDepositSteps();
  renderDepositMethods();
  validateDepositForm();
  goTo('deposit');
}

function renderDepositMethods(){
  const wrap = depEl('deposit-methods');
  if(!wrap) return;
  const methods = enabledDepositMethods();
  if(!methods.length){
    wrap.innerHTML = '<div class="empty-state">No deposit methods yet.<br>Please check back later.</div>';
    selectedDepositMethod = null;
    hideDepositSteps();
    validateDepositForm();
    return;
  }
  wrap.innerHTML = methods.map(m=>`
    <div class="deposit-method${selectedDepositMethod && selectedDepositMethod.id===m.id ? ' selected' : ''}" data-id="${esc(m.id)}" onclick="selectDepositMethod(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'dm-logo')}
      <span class="dm-name">${esc(m.name||'Method')}</span>
    </div>`).join('');
  if(selectedDepositMethod){
    const still = methods.find(m=>m.id === selectedDepositMethod.id);
    if(still){ selectedDepositMethod = still; showDepositMethodDetail(still); }
    else { selectedDepositMethod = null; hideDepositSteps(); }
  }
  validateDepositForm();
}

function selectDepositMethod(id){
  const m = enabledDepositMethods().find(x=>x.id === id);
  if(!m) return;
  selectedDepositMethod = m;
  document.querySelectorAll('#deposit-methods .deposit-method').forEach(el=> el.classList.toggle('selected', el.dataset.id === id));
  showDepositMethodDetail(m);
  depEl('deposit-amount-section').style.display = 'block';
  depEl('deposit-txid-section').style.display = 'block';
  onDepositAmountChange();
}

function showDepositMethodDetail(m){
  depEl('deposit-method-details').style.display = 'block';
  depEl('deposit-method-detail-label').textContent = 'Send payment to (' + (m.name||'') + ')';
  depEl('deposit-method-detail-value').textContent = m.wallet || m.note || '—';

  const qrBox = depEl('deposit-method-qr');
  if(m.qrUrl){
    qrBox.style.display = 'block';
    qrBox.innerHTML = `<img id="deposit-qr-image" src="${esc(m.qrUrl)}" alt="QR" referrerpolicy="no-referrer" loading="lazy" onclick="openQrLightbox()" onerror="this.onerror=null;this.replaceWith(Object.assign(document.createElement('div'),{className:'qr-fallback',textContent:'QR unavailable'}));">`;
  } else { qrBox.style.display = 'none'; qrBox.innerHTML = ''; }

  depEl('deposit-limit-text').textContent =
    'Rate: 1 CRTA = ' + coinFmt(depRate(m)) + ' ' + depCurrency(m) + ' · ' + limitText(m);

  const noteBox = depEl('deposit-method-note');
  if(m.note && m.wallet){ noteBox.style.display = 'block'; noteBox.textContent = m.note; }
  else { noteBox.style.display = 'none'; noteBox.textContent = ''; }
}

function copyDepositAddress(){
  if(!selectedDepositMethod) return;
  const text = selectedDepositMethod.wallet || selectedDepositMethod.note || '';
  if(!text){ showToast(T('t_no_address')); return; }
  copyText(text, 'Address copied!');
}

// tap the QR to see it full size
function openQrLightbox(){
  const img = depEl('deposit-qr-image');
  if(!img || !img.src) return;
  let box = document.getElementById('qr-lightbox');
  if(!box){
    box = document.createElement('div');
    box.id = 'qr-lightbox';
    box.className = 'qr-lightbox';
    box.innerHTML = '<button class="qr-close" aria-label="Close">✕</button><img id="qr-lightbox-img" alt="QR" referrerpolicy="no-referrer">';
    box.addEventListener('click', ()=> box.classList.remove('show'));
    document.body.appendChild(box);
  }
  document.getElementById('qr-lightbox-img').src = img.src;
  box.classList.add('show');
}

function setDepositAmount(v){
  depEl('deposit-amount').value = v;
  onDepositAmountChange();
}
function onDepositAmountChange(){
  validateDepositForm();
  renderDepositBreakdown();
}

function renderDepositBreakdown(){
  const box = depEl('deposit-breakdown');
  const amt = parseFloat(depEl('deposit-amount').value);
  if(!selectedDepositMethod || !amt || amt <= 0){ box.style.display = 'none'; return; }
  const m = selectedDepositMethod, unit = depCurrency(m), pct = methodFeePct(m, 'deposit');
  const base = amt * depRate(m);
  const feeCoin = base * pct / 100;
  box.style.display = 'block';
  box.innerHTML =
    'Rate: 1 CRTA = ' + coinFmt(depRate(m)) + ' ' + esc(unit) + '<br>' +
    'Deposit fee (' + pct + '%): ' + coinFmt(feeCoin) + ' ' + esc(unit) + '<br>' +
    'You must send: <strong>' + coinFmt(depPayable(amt, m)) + ' ' + esc(unit) + '</strong><br>' +
    'You will receive: <strong>' + fmtNum(amt) + ' CRTA</strong>';
}

function validateDepositForm(){
  const errEl = depEl('deposit-amount-error');
  const txErr = depEl('deposit-txid-error');
  const btn = depEl('deposit-submit-btn');
  errEl.classList.remove('show');
  txErr.classList.remove('show');
  btn.disabled = true;
  if(!selectedDepositMethod) return false;

  const m = selectedDepositMethod;
  const amt = parseFloat(depEl('deposit-amount').value);
  const txid = depEl('deposit-txid').value.trim();
  if(!amt || amt <= 0) return false;
  if(m.min > 0 && amt < m.min){ errEl.textContent = 'Minimum deposit is ' + fmtNum(m.min) + ' CRTA'; errEl.classList.add('show'); return false; }
  if(m.max > 0 && amt > m.max){ errEl.textContent = 'Maximum deposit is ' + fmtNum(m.max) + ' CRTA'; errEl.classList.add('show'); return false; }
  if(!txid){
    if(depTxidTouched){ txErr.textContent = 'Transaction ID / proof is required'; txErr.classList.add('show'); }
    return false;
  }
  btn.disabled = depositSubmitting;
  return true;
}

function submitDeposit(){
  if(!me || depositSubmitting) return;
  const m = selectedDepositMethod;
  const amt = parseFloat(depEl('deposit-amount').value);
  const txid = depEl('deposit-txid').value.trim();
  if(!m){ showToast(T('t_select_deposit_method')); return; }
  if(!amt || amt <= 0){ showToast(T('t_enter_valid_amount')); return; }
  if(m.min > 0 && amt < m.min){ showToast(T('t_min_deposit') + fmtNum(m.min) + ' CRTA'); return; }
  if(m.max > 0 && amt > m.max){ showToast(T('t_max_deposit') + fmtNum(m.max) + ' CRTA'); return; }
  if(!txid){ depTxidTouched = true; validateDepositForm(); showToast(T('t_txid_required')); return; }

  const unit = depCurrency(m);
  const payAmount = depPayable(amt, m);
  const record = {
    uid, username: me.username || me.firstName || '',
    methodId: m.id, methodName: m.name || '',
    amount: amt,                        // CRTA credited to the deposit balance when accepted (not withdrawable directly — must be swapped to USD first)
    rate: depRate(m),                   // rate at the time of the request
    paymentCurrency: unit,
    feePercent: methodFeePct(m, 'deposit'),
    payAmount,                          // what the user has to send, in paymentCurrency
    txid,
    status: 'pending',
    createdAt: firebase.database.ServerValue.TIMESTAMP
  };

  depositSubmitting = true;
  depEl('deposit-submit-btn').disabled = true;
  setBtnLabel('deposit-submit-btn', 'Processing…');
  const depKey = db.ref('deposits').push().key;
  db.ref().update({
    ['deposits/'+depKey]: record,
    ['users/'+uid+'/txlog/'+depKey]: { type:'deposit', title:'Deposit · '+(m.name||''), detail:'TxID '+txid, amt:'+'+Number(amt).toFixed(4)+' CRTA', time: firebase.database.ServerValue.TIMESTAMP, status:'pending' }
  }).then(()=>{
    showToast(T('t_deposit_request_submitted').replace('{amt}', fmtNum(amt)).replace('{pay}', coinFmt(payAmount)).replace('{unit}', unit));
    depEl('deposit-amount').value = '';
    depEl('deposit-txid').value = '';
    goBack();
  }).catch(()=>{
    showToast(T('t_deposit_submit_failed'));
  }).then(()=>{
    depositSubmitting = false;
    setBtnLabel('deposit-submit-btn', 'Confirm Deposit');
    validateDepositForm();
  });
}

/* =========================================================================
   WITHDRAW  (full-screen page)
   ========================================================================= */
let selectedWithdrawId = null;
let withdrawBusy = false;

function withdrawMethodList(){
  const wallets = (me && me.wallets) || {};
  return Object.entries(withdrawMethods).filter(([id,m])=> m && m.enabled !== false && wallets[id]);
}
// Completed tasks of one category ('all' = every category). Uses the per-category counter and
// also the per-task totals, so tasks finished before the counter existed still count.
function taskCatDoneCount(cat){
  if(!me) return 0;
  if(cat==='all' || !cat) return Number(me.totalTask)||0;
  let fromTasks = 0;
  Object.entries(tasksCache).forEach(([id,t])=>{
    if(t && t.category===cat){ const r = taskRec(id); if(r) fromTasks += Number(r.total != null ? r.total : (r.count||0)); }
  });
  return Math.max(Number(me.taskCatDone && me.taskCatDone[cat])||0, fromTasks);
}
// unmet requirements of a withdraw method
function methodLockReasons(m){
  if(!me) return [];
  const r = [];
  const a = m.requiredActiveReferral||0, n = m.requiredNormalReferral||0,
        d = m.requiredDepositBalance||0, c = m.requiredMinUsd||0;
  if(a > (me.referralsActive||0)) r.push(T('req_active_referral').replace('{n}',a).replace('{s}', a>1?'s':''));
  if(n > (me.referralsNormal||0)) r.push(T('req_normal_referral').replace('{n}',n).replace('{s}', n>1?'s':''));
  if(d > (me.depositBalance||0))  r.push(T('t_req_deposit_balance').replace('{amt}', fmtNum(d)));
  if(c > (me.usdBalance||0))      r.push(T('t_req_usd_balance').replace('{amt}', fmtNum(c)));
  const tn = Number(m.requiredTaskCount)||0;
  if(tn > 0){
    const cat = m.requiredTaskCategory || 'all';
    if(taskCatDoneCount(cat) < tn){
      const label = cat==='all' ? '' : ((TASK_TAB_LABELS[cat]||cat)+' ');
      r.push(T('t_req_tasks_completed').replace('{n}',tn).replace('{label}',label).replace('{s}', tn>1?'s':''));
    }
  }
  return r;
}

// "Monthly Withdrawals: X / LIMIT" + "Remaining: Y". Limit 0 always reads "0 / 0" / "Remaining: 0" —
// never "Unlimited" — and the card turns coral once the month's limit is reached (including limit 0).
function renderMonthlyWithdrawLimitCard(){
  const card = document.getElementById('wd-monthly-limit-card');
  if(!card || !me) return;
  const limit = myMonthlyWithdrawLimit();
  const used = limit <= 0 ? 0 : Math.min(myWithdrawUsedThisMonth(), limit);
  const remaining = Math.max(0, limit - used);
  const blocked = limit <= 0 || remaining <= 0;
  card.style.display = '';
  document.getElementById('wd-monthly-used').textContent = used+' / '+limit;
  document.getElementById('wd-monthly-remaining').textContent = String(remaining);
  document.getElementById('wd-monthly-used-row').classList.toggle('limit-blocked', blocked);
  document.getElementById('wd-monthly-remaining-row').classList.toggle('limit-blocked', blocked);
}

function renderWithdrawPage(){
  const list = document.getElementById('wd-method-list');
  if(!list || !me) return;
  const wallets = me.wallets || {};
  const hasAnyWallet = hasWallet();
  const prompt = document.getElementById('wd-connect-prompt');
  const formBody = document.getElementById('wd-form-body');
  const pill = document.getElementById('wd-wallet-pill');
  const amountSec = document.getElementById('wd-amount-section');

  document.getElementById('wd-balance').textContent = '$'+fmtAmt(me.usdBalance)+' USD';
  renderMonthlyWithdrawLimitCard();

  if(!hasAnyWallet){
    if(prompt) prompt.style.display = '';
    if(formBody) formBody.style.display = 'none';
    if(pill) pill.style.display = 'none';
    list.innerHTML = '';
    selectedWithdrawId = null;
    updateWithdrawSummary();
    return;
  }
  if(prompt) prompt.style.display = 'none';
  if(formBody) formBody.style.display = '';

  const entries = withdrawMethodList();
  // a method must be picked by the user (and must be unlocked) before the amount box appears
  const sel = selectedWithdrawId && withdrawMethods[selectedWithdrawId];
  if(!sel || methodLockReasons(sel).length || !wallets[selectedWithdrawId]) selectedWithdrawId = null;

  list.innerHTML = entries.length ? entries.map(([id,m])=>{
    const reasons = methodLockReasons(m);
    const locked = reasons.length > 0;
    const pct = methodFeePct(m);
    return `
    <div class="method-card${id===selectedWithdrawId?' selected':''}${locked?' locked':''}" data-id="${esc(id)}" onclick="selectWithdrawMethod(this.dataset.id)">
      ${logoBox(m.logoUrl, (m.name||'?').trim().charAt(0).toUpperCase(), 'mc-logo')}
      <div class="mc-info">
        <div class="mc-name">${esc(m.name||'Method')}</div>
        <div class="mc-meta">${esc(limitText(m,'withdraw'))}</div>
        ${locked ? `<div class="mc-lock">Requires ${esc(reasons.join(', '))}</div>` : ''}
      </div>
      <div class="mc-side">
        <span class="fee-tag">${pct>0 ? 'Fee '+pct+'%' : 'No fee'}</span>
        ${locked ? `<span class="lock-ic">${lockSvg}</span>` : '<span class="radio"></span>'}
      </div>
    </div>`;
  }).join('') : '<div class="empty-state">No connected withdraw method available. Connect one from your profile.</div>';

  // masked wallet of the selected method, shown on the balance card (top-left)
  if(pill){
    if(selectedWithdrawId){
      document.getElementById('wd-wallet-mask').textContent = maskAddr(wallets[selectedWithdrawId]);
      pill.style.display = '';
    } else pill.style.display = 'none';
  }
  if(amountSec) amountSec.style.display = selectedWithdrawId ? '' : 'none';
  updateWithdrawSummary();
}

function selectWithdrawMethod(id){
  const m = withdrawMethods[id];
  if(!m) return;
  const reasons = methodLockReasons(m);
  if(reasons.length){ showToast(T('t_requires')+reasons.join(', ')); return; }
  selectedWithdrawId = id;
  renderWithdrawPage();
}

function updateWithdrawSummary(){
  const input = document.getElementById('wd-amount');
  const hint = document.getElementById('wd-hint');
  const box = document.getElementById('wd-summary');
  const cta = document.getElementById('wd-cta');
  if(!input || !hint || !box || !cta) return;
  const m = withdrawMethods[selectedWithdrawId];
  const limit = myMonthlyWithdrawLimit();
  const limitReached = limit <= 0 || myWithdrawUsedThisMonth() >= limit;
  cta.disabled = !m || withdrawBusy || limitReached;
  if(limitReached){
    hint.textContent = T('t_withdraw_limit_reached');
    box.innerHTML = '';
    return;
  }
  if(!m){ hint.textContent = ''; box.innerHTML = ''; return; }
  const pct = methodFeePct(m);
  hint.textContent = limitText(m,'withdraw') + ' · ' + (pct>0 ? 'Fee '+pct+'%' : 'No fee');
  const amt = parseFloat(input.value) || 0;
  if(amt <= 0){ box.innerHTML = ''; return; }
  const f = calcFee(m, amt);
  box.innerHTML = `
    <div class="summary-card">
      <div class="sum-row"><span>Amount</span><b>$${fmtAmt(amt)} USD</b></div>
      <div class="sum-row"><span>Fee${pct>0 ? ' ('+pct+'%)' : ''}</span><b>${f.fee>0 ? '-' : ''}$${fmtAmt(f.fee)} USD</b></div>
      <div class="sum-row total"><span>You will receive</span><b>$${fmtAmt(f.net)} USD</b></div>
    </div>`;
}

function setMaxWithdraw(){
  if(!me) return;
  const m = withdrawMethods[selectedWithdrawId];
  let max = me.usdBalance || 0;
  if(m && m.max > 0) max = Math.min(max, m.max);
  document.getElementById('wd-amount').value = max > 0 ? (Math.floor(max*10000)/10000) : '';
  updateWithdrawSummary();
}

function openWithdraw(){
  if(!me) return;
  document.getElementById('wd-amount').value = '';
  selectedWithdrawId = null;
  renderWithdrawPage();
  goTo('withdraw');
}

function setWithdrawBusy(busy){
  withdrawBusy = busy;
  const cta = document.getElementById('wd-cta');
  cta.disabled = busy || !withdrawMethods[selectedWithdrawId];
  setBtnLabel(cta, busy ? 'Processing…' : 'Request withdrawal');
}

function submitWithdraw(){
  if(!me || withdrawBusy) return;
  const id = selectedWithdrawId;
  const m = withdrawMethods[id];
  if(!m){ showToast(T('t_select_method')); return; }
  const input = document.getElementById('wd-amount');
  const amt = parseFloat(input.value);
  if(!amt || amt <= 0){ showToast(T('t_enter_valid_amount')); return; }
  const wMin = methodMin(m, 'withdraw');
  if(wMin > 0 && amt < wMin){ showToast(T('t_min_amount')+fmtNum(wMin)+' USD'); return; }
  if(m.max > 0 && amt > m.max){ showToast(T('t_max_amount')+fmtNum(m.max)+' USD'); return; }
  const f = calcFee(m, amt);
  if(f.net <= 0){ showToast(T('t_amount_too_small_fee')); return; }
  if(methodLockReasons(m).length){ showToast(T('t_method_requirements_not_met')); return; }
  const walletAddr = (me.wallets && me.wallets[id]) || '';
  if(!walletAddr){ showToast(T('t_connect_wallet_method')); openWallet(); return; }
  if(amt > (me.usdBalance||0)){ showToast(T('t_insufficient_usd')); return; }

  // --- Monthly withdrawal limit: 0 = NO withdrawals allowed this month, never "unlimited". ---
  // Checked here, immediately before creating the withdrawal, not just by disabling the button —
  // so a stale UI state (or a request fired programmatically) can never slip through.
  const limit = myMonthlyWithdrawLimit();
  if(limit <= 0){ showToast(T('t_withdraw_limit_reached')); return; }

  // Lock the UI synchronously so a rapid double-click/double-tap can't start a second submission
  // while this one is still in flight — the real, race-proof guard is the Firebase transaction below.
  setWithdrawBusy(true);

  const monthKey = currentWithdrawMonthKey();
  const counterRef = db.ref('users/'+uid+'/withdrawMonthly/'+monthKey);

  // Atomically reserve one of this month's withdrawal slots. Firebase resolves concurrent
  // transactions on the same node one at a time, so even multiple rapid clicks or multiple
  // open tabs can never push the used count past the limit.
  counterRef.transaction(cur => {
    const used = Number(cur) || 0;
    if(used >= limit) return; // returning undefined aborts the transaction — limit reached
    return used + 1;
  }, (err, committed) => {
    if(err){ showToast(T('t_something_wrong')); setWithdrawBusy(false); return; }
    if(!committed){
      showToast(T('t_withdraw_limit_reached'));
      setWithdrawBusy(false);
      renderMonthlyWithdrawLimitCard();
      updateWithdrawSummary();
      return;
    }

    const req = {
      uid, username: me.username || me.firstName || '',
      methodId: id, methodName: m.name || '',
      amount: amt, feePercent: f.pct, fee: f.fee, netAmount: f.net,
      wallet: walletAddr, monthKey,
      status: 'pending', createdAt: firebase.database.ServerValue.TIMESTAMP
    };
    const key = db.ref('withdraws').push().key;
    // one atomic write: create the request + hold the amount from the USD earning balance
    db.ref().update({
      ['withdraws/'+key]: req,
      ['users/'+uid+'/usdBalance']: SERVER_INC(-amt),
      ['users/'+uid+'/totalWithdraw']: SERVER_INC(amt),
      ['users/'+uid+'/txlog/'+key]: { type:'withdraw', title:'Withdraw · '+(m.name||''), detail:'Payout $'+Number(f.net).toFixed(2)+' USD', amt:'-'+Number(amt).toFixed(4)+' USD', time: firebase.database.ServerValue.TIMESTAMP, status:'pending' }
    }).then(()=>{
      showToast(T('t_withdraw_submitted'));
      input.value = '';
      goBack();
    }).catch(()=>{
      // the withdrawal itself failed to write — release the slot we reserved so it isn't lost
      counterRef.transaction(cur => Math.max(0, (Number(cur)||0) - 1));
      showToast(T('t_something_wrong'));
    }).then(()=>{
      setWithdrawBusy(false);
      updateWithdrawSummary();
    });
  });
}

/* ---------------- NOTIFICATIONS ---------------- */
function listenNotifications(){
  db.ref('notifications').on('value', s=>{
    const all = s.val() || {};
    const now = Date.now();
    const toRemove = [];
    const relevant = {};
    Object.entries(all).forEach(([id,n])=>{
      if(!n.permanent && n.expiresAt && n.expiresAt < now){ toRemove.push(id); return; }
      if(n.target === 'all' || n.target === uid) relevant[id] = n;
    });
    toRemove.forEach(id=> db.ref('notifications/'+id).remove().catch(()=>{}) );
    notifCache = relevant;
    const seen = (me && me.seenNotifs) || {};
    const unreadCount = Object.keys(relevant).filter(id=>!seen[id]).length;
    const dot = document.getElementById('notif-dot');
    if(dot) dot.style.display = unreadCount>0 ? 'block' : 'none';
    renderNotifPanel();
  });
}
function renderNotifPanel(){
  const box = document.getElementById('notif-list');
  if(!box) return;
  const list = Object.entries(notifCache).map(([id,n])=>Object.assign({id},n)).sort((a,b)=>(b.createdAt||0)-(a.createdAt||0));
  if(!list.length){ box.innerHTML = '<div class="notif-empty">No notifications</div>'; return; }
  box.innerHTML = list.map(n=>`
    <div class="notif-row">
      <div class="n-title">${esc(n.title||'')}</div>
      <div class="n-msg">${esc(n.message||'')}</div>
      <div class="n-time">${formatTimeAgo(n.createdAt)}</div>
    </div>`).join('');
}
function openNotifications(){
  goTo('notifications');
  if(me){
    const updates = {};
    Object.keys(notifCache).forEach(id=>{ updates['users/'+uid+'/seenNotifs/'+id] = true; });
    if(Object.keys(updates).length) db.ref().update(updates);
    document.getElementById('notif-dot').style.display = 'none';
  }
}

// Daily claim flow: wallet connected? -> then watch ad -> then reward.
// If no wallet is connected yet, send the user to connect one first — no ad is shown for that step.
function claimAdGateClick(){
  if(!me || me.claimedToday) return;
  if(!hasWallet()){
    showToast(T('t_connect_wallet_daily'));
    openWallet();
    return;
  }
  adGateClick('claim');
}
// Every gated button's real action, keyed by the data-ad-gate value used in index.html.
Object.assign(AD_GATE_ACTIONS, {
  claim: claimDaily,
  withdraw: submitWithdraw,
  deposit: submitDeposit,
  swap: doUnifiedSwap,
  walletConnect: saveWalletAddress
});
initAdGates();


/* ================= I18N (Language) ================= */
const I18N = {
en:{
 nav_home:"Home", t_connected_suffix:" connected!",t_unlocked_suffix:" unlocked!",t_unlocked_wear_suffix:" unlocked! Tap Select to wear it.",t_active_level_suffix:" is now your active level!",t_selected_suffix:" selected",t_link_not_available:"Link not available yet",t_reward_claimed:"claimed! 🎉",t_swapped_to:"Swapped to ", t_claimed_amount:"Claimed {a} CRTA!", claim_claiming:"Claiming…",claim_loading_ad:"Loading ad…",claim_claim_amount:"Claim {a} CRTA",claim_next_ad_in:"Next ad in {s}s", mine_no_miner:"No miner available",mine_cooldown:"Cooldown ",mine_mining:"Mining…",mine_watch_ads_claim:"Watch {n} ad{s} to claim", swap_to_crta:"Swap to CRTA",swap_to_usd:"Swap to USD",swap_deposit_not_avail:"Deposit swap not available",swap_rate_not_set_short:"Swap rate not set",swap_no_balance:"No balance to swap",swap_note_pct:"Your level ({b}) converts {p}% of the deposit balance to CRTA. The rest is deducted.",swap_note_zero:"Your level ({b}) has 0% deposit swap. Unlock a level with a swap % to convert deposit balance.",swap_note_rate:"1 CRTA = ${r} USD · USD cannot be swapped back",nav_task:"Task",nav_swap:"Swap",nav_mining:"Mining",nav_refer:"Refer",nav_profile:"Profile",
 total_balance:"Total balance",deposit:"Deposit",withdraw:"Withdraw",
 lbl_streak:"Streak",lbl_today_mining:"Today mining",lbl_today_refer:"Today refer",lbl_rank:"Rank",
 daily_reward:"Daily reward",leaderboard:"Leaderboard",claim_today_reward:"Claim today's reward",
 tasks_title:"Tasks",tab_all:"All",
 swap_title:"Swap",swap_deposit_to_crta:"Deposit → CRTA",swap_crta_to_usd:"CRTA → USD",
 you_pay:"You pay (",available:"Available",you_receive:"You receive (",max:"MAX",swap_history:"Swap history",btn_swap:"Swap",
 mining_mined:"Mined",start_mining:"Start mining",miners_title:"Miners",
 invite_earn:"Invite & Earn",earn_commission_sub:"Earn commission every time your friends withdraw",
 total_earned:"Total earned",active_refer:"Active refer",commission:"Commission",your_referral_link:"Your referral link",
 copy:"Copy",copy_link:"Copy link",share:"Share",joined_with_code:"You joined with code",your_referrals:"Your referrals",total_refer:"Total refer",
 profile_earning:"Earning (CRTA)",profile_deposit_balance:"Deposit balance",profile_usd_withdrawable:"USD (withdrawable)",
 total_withdraw:"Total withdraw",total_task:"Total task",total_mining:"Total mining",total_deposit:"Total deposit",
 menu_level:"Level",menu_connect_wallet:"Connect wallet",menu_transactions:"Transactions",menu_telegram_channel:"Telegram channel",menu_support:"Support",menu_language:"Language",
 levels_title:"Levels",transactions_title:"Transactions",tx_all:"All",tx_deposit:"Deposit",tx_withdraw:"Withdraw",tx_task:"Task",tx_mining:"Mining",tx_refer:"Refer",tx_swap:"Swap",
 deposit_page_title:"Deposit",payment_method:"Payment method",send_payment_to:"Send payment to",amount_crta:"Amount (CRTA)",txid_label:"Transaction ID / Proof",confirm_deposit:"Confirm Deposit",
 withdraw_page_title:"Withdraw",available_balance:"Available balance",no_wallet_connected:"No wallet connected yet. Connect a wallet to withdraw.",connect_wallet_btn:"Connect wallet",select_method:"Select method",amount_label:"Amount",usd_unit:"USD",processing_note:"Processing may take up to 24 hours. Rejected requests are refunded in full.",request_withdrawal:"Request withdrawal",
 wallet_sheet_title:"Connect wallet",wallet_method_note:"One wallet per method — permanent and can't be changed later. A connected wallet is required for daily claim, referrals and mining.",choose_method:"Choose method",wallet_address_placeholder:"Enter your wallet address",wallet_warn_note:"⚠ Permanent once saved. You can't edit or remove it, and the full address is never shown again. Double-check before saving.",save_wallet:"Save wallet",
 watch_ads_title:"Watch ads to claim",ads_watched:"Ads watched",claim_note:"Watch every ad, then tap Claim to collect your mined CRTA.",watch_ad_btn:"Watch Ad",
 submit_proof_title:"Submit proof",screenshot_label:"Screenshot",upload_hint:"Tap to upload from gallery",submit_btn:"Submit",
 create_account_title:"Create account",password_label:"Password",your_email_label:"Your email",
 notifications_title:"Notifications",no_notifications:"No notifications",
 loading_text:"Loading",slow_connection:"Slow connection, still trying…",account_suspended_title:"Account suspended",account_suspended_sub:"Your account has been banned. Contact support if you believe this is a mistake.",
 language_title:"Language",
 t_connect_wallet_first:"Connect a wallet first to ",
 t_ad_watched:"Ad watched — tap again to continue",t_ads_not_setup:"Ads are not set up yet — please try again later",t_ad_not_completed:"Ad was not completed — try again",
 t_wallet_locked:"Wallet is locked. It cannot be edited or removed.",t_select_method_first:"Select a method first",t_enter_valid_wallet:"Enter a valid wallet address",
 t_wallet_too_short:"Wallet address looks too short",t_wallet_already_connected:"Wallet already connected and locked",t_something_wrong:"Something went wrong. Please try again.",
 t_level_requirements_not_met:"You have not met the requirements for this level yet",t_level_locked:"This level is still locked",
 t_referral_applied:"Referral applied to your account!",t_requirements_not_met:"Requirements not met yet",t_unlock_miner_first:"Unlock this miner first",
 t_cant_change_miner:"Can't change miner while mining is active",t_no_miner_available:"No miner available",t_wait_cooldown:"Wait for the cooldown to finish",
 t_mining_started:"Mining started!",t_mining_start_failed:"Could not start mining, try again",t_claim_cap_full:"You can claim once the cap is full",t_claim_failed:"Claim failed, try again",
 t_task_unavailable:"This task is no longer available",t_choose_image:"Please choose an image",t_could_not_read_image:"Could not read that image",t_no_slots:"No slots left for this task",
 t_submitted_review:"Submitted — waiting for review",t_submit_failed:"Failed to submit, try again",t_enter_valid_email:"Enter a valid email",t_ad_failed_load:"Ad failed to load, try again",
 t_too_fast:"You came back too fast — task not counted, try again",t_enter_valid_amount:"Enter a valid amount",t_insufficient_deposit:"Insufficient deposit balance",t_insufficient_crta:"Insufficient CRTA balance",
 t_zero_percent_swap:"Your level has 0% deposit swap",t_amount_too_small:"Amount is too small",t_swap_rate_not_set:"Swap rate is not set yet",t_copied:"Copied!",t_copy_failed:"Copy failed. Please copy manually.",
 t_no_address:"No address to copy",t_select_deposit_method:"Select a deposit method",t_txid_required:"Transaction ID / proof is required",t_deposit_submit_failed:"Failed to submit deposit request",
 t_select_method:"Select a method",t_amount_too_small_fee:"Amount is too small after fee",t_method_requirements_not_met:"You do not meet the requirements for this method",
 t_connect_wallet_method:"Connect a wallet for this method before withdrawing",t_insufficient_usd:"Insufficient USD balance",t_withdraw_submitted:"Withdrawal request submitted!",
 t_connect_wallet_daily:"Connect a wallet first to claim your daily reward",t_wallet_limit:"Your level allows connecting up to ",
 t_min_deposit:"Minimum deposit is ",t_max_deposit:"Maximum deposit is ",t_min_amount:"Minimum amount is $",t_max_amount:"Maximum amount is $",t_requires:"Requires ",t_withdraw_limit_reached:"Withdrawals are not available for your current level this month.",
 btn_go:"Go",btn_submit:"Submit",btn_submitting:"Submitting…",btn_pending:"Pending",btn_claim:"Claim",btn_not_joined_retry:"Not Joined — Retry",btn_verify_failed_retry:"Couldn't Verify — Retry",btn_verifying:"Verifying...",btn_claiming:"Claiming...",btn_invite:"Invite",btn_loading_ad:"Loading Ad...",btn_available_in:"Available in {s}s",btn_watch_ad:"Watch Ad",btn_waiting:"Waiting...",btn_selected:"Selected",btn_mining_active:"Mining active",btn_mining_active_title:"Miner can't be changed while mining is active",btn_select:"Select",btn_locked:"Locked",btn_unlock:"Unlock",btn_buy:"Buy",btn_get:"Get",btn_done:"Done ✓",btn_create:"Create",btn_next:"Next",
 mn_rate:"Rate",mn_cap:"Cap",mn_cooldown_lbl:"Cooldown",mn_required:"Required",mn_free:"Free",mn_default:"Default",
 req_level_access:"Miner level {min}–{max} access (your level: {name})",req_level_upgrade:"Your level: Access only {min}–{max} · Please upgrade",req_level_ok:"Your level: Access {min}–{max}",req_price:"Price {p} CRTA (deposit balance)",req_active_referral:"{n} active referral{s}",req_normal_referral:"{n} normal referral{s}",req_watch_ads:"Watch {n} ad{s}{brk}",
 day_word:"Day",daily_claimed_lbl:"Today's reward claimed ✓",daily_connect_claim:"Connect wallet to claim",daily_claim_plus:"Claim +{a} CRTA",
 t_need_more_referral:"You need {n} more referral(s)",t_need_more_active_referral:"You need {n} more active referral(s)",
 t_guest_mode_note:"Guest mode: data won't be saved to the database",t_wallet_limit_suffix:" wallet{s} only",t_default_wallet:"Wallet",t_default_level:"Level",t_default_miner:"Miner",t_referral_link_not_setup:"Referral link is not set up yet (admin: set Bot username)",t_daily_reward_claimed:"+{a} CRTA claimed! 🎉",t_task_reward_claimed:"+{a} CRTA claimed!",t_deposit_request_submitted:"Deposit request of {amt} CRTA submitted. Send {pay} {unit} to complete.",t_req_deposit_balance:"{amt} CRTA deposit balance",t_req_usd_balance:"${amt} USD balance",t_req_tasks_completed:"{n} {label}task{s} completed"
},
ru:{
 nav_home:"Главная", t_connected_suffix:" подключён!",t_unlocked_suffix:" разблокирован!",t_unlocked_wear_suffix:" разблокирован! Нажмите «Выбрать», чтобы использовать.",t_active_level_suffix:" теперь ваш активный уровень!",t_selected_suffix:" выбран",t_link_not_available:"Ссылка пока недоступна",t_reward_claimed:"получено! 🎉",t_swapped_to:"Обменяно на ", t_claimed_amount:"Получено {a} CRTA!", claim_claiming:"Получение…",claim_loading_ad:"Загрузка рекламы…",claim_claim_amount:"Забрать {a} CRTA",claim_next_ad_in:"Следующая реклама через {s}с", mine_no_miner:"Нет доступного майнера",mine_cooldown:"Перезарядка ",mine_mining:"Майнинг…",mine_watch_ads_claim:"Посмотрите {n} рекл. чтобы забрать", swap_to_crta:"Обменять на CRTA",swap_to_usd:"Обменять на USD",swap_deposit_not_avail:"Обмен депозита недоступен",swap_rate_not_set_short:"Курс обмена не установлен",swap_no_balance:"Нет баланса для обмена",swap_note_pct:"Ваш уровень ({b}) конвертирует {p}% депозитного баланса в CRTA. Остальное удерживается.",swap_note_zero:"Ваш уровень ({b}) имеет 0% обмена депозита. Разблокируйте уровень с % обмена, чтобы конвертировать депозитный баланс.",swap_note_rate:"1 CRTA = ${r} USD · USD нельзя обменять обратно",nav_task:"Задания",nav_swap:"Обмен",nav_mining:"Майнинг",nav_refer:"Рефералы",nav_profile:"Профиль",
 total_balance:"Общий баланс",deposit:"Депозит",withdraw:"Вывод",
 lbl_streak:"Серия",lbl_today_mining:"Добыто сегодня",lbl_today_refer:"Рефералов сегодня",lbl_rank:"Ранг",
 daily_reward:"Ежедневная награда",leaderboard:"Таблица лидеров",claim_today_reward:"Забрать награду за сегодня",
 tasks_title:"Задания",tab_all:"Все",
 swap_title:"Обмен",swap_deposit_to_crta:"Депозит → CRTA",swap_crta_to_usd:"CRTA → USD",
 you_pay:"Вы платите (",available:"Доступно",you_receive:"Вы получите (",max:"МАКС",swap_history:"История обменов",btn_swap:"Обменять",
 mining_mined:"Добыто",start_mining:"Начать майнинг",miners_title:"Майнеры",
 invite_earn:"Приглашай и зарабатывай",earn_commission_sub:"Получайте комиссию за каждый вывод средств друга",
 total_earned:"Всего заработано",active_refer:"Активных рефералов",commission:"Комиссия",your_referral_link:"Ваша реферальная ссылка",
 copy:"Копировать",copy_link:"Копировать ссылку",share:"Поделиться",joined_with_code:"Вы присоединились по коду",your_referrals:"Ваши рефералы",total_refer:"Всего рефералов",
 profile_earning:"Доход (CRTA)",profile_deposit_balance:"Баланс депозита",profile_usd_withdrawable:"USD (доступно к выводу)",
 total_withdraw:"Всего выведено",total_task:"Всего заданий",total_mining:"Всего добыто",total_deposit:"Всего депозитов",
 menu_level:"Уровень",menu_connect_wallet:"Подключить кошелёк",menu_transactions:"Транзакции",menu_telegram_channel:"Telegram-канал",menu_support:"Поддержка",menu_language:"Язык",
 levels_title:"Уровни",transactions_title:"Транзакции",tx_all:"Все",tx_deposit:"Депозит",tx_withdraw:"Вывод",tx_task:"Задание",tx_mining:"Майнинг",tx_refer:"Рефералы",tx_swap:"Обмен",
 deposit_page_title:"Депозит",payment_method:"Способ оплаты",send_payment_to:"Отправить оплату на",amount_crta:"Сумма (CRTA)",txid_label:"ID транзакции / Доказательство",confirm_deposit:"Подтвердить депозит",
 withdraw_page_title:"Вывод",available_balance:"Доступный баланс",no_wallet_connected:"Кошелёк ещё не подключён. Подключите кошелёк для вывода средств.",connect_wallet_btn:"Подключить кошелёк",select_method:"Выберите способ",amount_label:"Сумма",usd_unit:"USD",processing_note:"Обработка может занять до 24 часов. Отклонённые заявки возвращаются полностью.",request_withdrawal:"Запросить вывод",
 wallet_sheet_title:"Подключить кошелёк",wallet_method_note:"Один кошелёк на способ — навсегда, изменить позже нельзя. Подключённый кошелёк нужен для ежедневной награды, рефералов и майнинга.",choose_method:"Выберите способ",wallet_address_placeholder:"Введите адрес кошелька",wallet_warn_note:"⚠ После сохранения нельзя изменить. Вы не сможете отредактировать или удалить его, и полный адрес больше не будет показан. Проверьте перед сохранением.",save_wallet:"Сохранить кошелёк",
 watch_ads_title:"Смотрите рекламу, чтобы забрать",ads_watched:"Просмотрено рекламы",claim_note:"Посмотрите всю рекламу, затем нажмите «Забрать», чтобы получить добытые CRTA.",watch_ad_btn:"Смотреть рекламу",
 submit_proof_title:"Отправить доказательство",screenshot_label:"Скриншот",upload_hint:"Нажмите, чтобы загрузить из галереи",submit_btn:"Отправить",
 create_account_title:"Создать аккаунт",password_label:"Пароль",your_email_label:"Ваш email",
 notifications_title:"Уведомления",no_notifications:"Нет уведомлений",
 loading_text:"Загрузка",slow_connection:"Медленное соединение, продолжаем попытки…",account_suspended_title:"Аккаунт заблокирован",account_suspended_sub:"Ваш аккаунт был заблокирован. Обратитесь в поддержку, если считаете это ошибкой.",
 language_title:"Язык",
 t_connect_wallet_first:"Сначала подключите кошелёк, чтобы ",
 t_ad_watched:"Реклама просмотрена — нажмите ещё раз, чтобы продолжить",t_ads_not_setup:"Реклама ещё не настроена — попробуйте позже",t_ad_not_completed:"Реклама не была досмотрена — попробуйте снова",
 t_wallet_locked:"Кошелёк заблокирован. Его нельзя изменить или удалить.",t_select_method_first:"Сначала выберите способ",t_enter_valid_wallet:"Введите корректный адрес кошелька",
 t_wallet_too_short:"Адрес кошелька выглядит слишком коротким",t_wallet_already_connected:"Кошелёк уже подключён и заблокирован",t_something_wrong:"Что-то пошло не так. Попробуйте снова.",
 t_level_requirements_not_met:"Вы ещё не выполнили требования для этого уровня",t_level_locked:"Этот уровень всё ещё заблокирован",
 t_referral_applied:"Реферал применён к вашему аккаунту!",t_requirements_not_met:"Требования пока не выполнены",t_unlock_miner_first:"Сначала разблокируйте этот майнер",
 t_cant_change_miner:"Нельзя сменить майнер во время активного майнинга",t_no_miner_available:"Нет доступного майнера",t_wait_cooldown:"Дождитесь окончания перезарядки",
 t_mining_started:"Майнинг начат!",t_mining_start_failed:"Не удалось начать майнинг, попробуйте снова",t_claim_cap_full:"Вы можете забрать награду, когда лимит будет заполнен",t_claim_failed:"Не удалось забрать награду, попробуйте снова",
 t_task_unavailable:"Это задание больше недоступно",t_choose_image:"Пожалуйста, выберите изображение",t_could_not_read_image:"Не удалось прочитать это изображение",t_no_slots:"Нет свободных мест для этого задания",
 t_submitted_review:"Отправлено — ожидает проверки",t_submit_failed:"Не удалось отправить, попробуйте снова",t_enter_valid_email:"Введите корректный email",t_ad_failed_load:"Не удалось загрузить рекламу, попробуйте снова",
 t_too_fast:"Вы вернулись слишком быстро — задание не засчитано, попробуйте снова",t_enter_valid_amount:"Введите корректную сумму",t_insufficient_deposit:"Недостаточно средств на депозите",t_insufficient_crta:"Недостаточно CRTA",
 t_zero_percent_swap:"На вашем уровне обмен депозита составляет 0%",t_amount_too_small:"Сумма слишком мала",t_swap_rate_not_set:"Курс обмена ещё не установлен",t_copied:"Скопировано!",t_copy_failed:"Не удалось скопировать. Скопируйте вручную.",
 t_no_address:"Нет адреса для копирования",t_select_deposit_method:"Выберите способ депозита",t_txid_required:"Требуется ID транзакции / доказательство",t_deposit_submit_failed:"Не удалось отправить заявку на депозит",
 t_select_method:"Выберите способ",t_amount_too_small_fee:"Сумма слишком мала после комиссии",t_method_requirements_not_met:"Вы не соответствуете требованиям для этого способа",
 t_connect_wallet_method:"Подключите кошелёк для этого способа перед выводом",t_insufficient_usd:"Недостаточно USD",t_withdraw_submitted:"Заявка на вывод отправлена!",
 t_connect_wallet_daily:"Сначала подключите кошелёк, чтобы забрать ежедневную награду",t_wallet_limit:"Ваш уровень позволяет подключить до ",
 t_min_deposit:"Минимальный депозит — ",t_max_deposit:"Максимальный депозит — ",t_min_amount:"Минимальная сумма — $",t_max_amount:"Максимальная сумма — $",t_requires:"Требуется ",t_withdraw_limit_reached:"Снятие средств недоступно для вашего текущего уровня в этом месяце.",
 btn_go:"Перейти",btn_submit:"Отправить",btn_submitting:"Отправка…",btn_pending:"Ожидание",btn_claim:"Забрать",btn_not_joined_retry:"Не в канале — Повтор",btn_verify_failed_retry:"Не удалось проверить — Повтор",btn_verifying:"Проверка...",btn_claiming:"Забираем...",btn_invite:"Пригласить",btn_loading_ad:"Загрузка рекламы...",btn_available_in:"Доступно через {s}с",btn_watch_ad:"Смотреть рекламу",btn_waiting:"Ожидание...",btn_selected:"Выбрано",btn_mining_active:"Добыча активна",btn_mining_active_title:"Майнер нельзя сменить, пока активна добыча",btn_select:"Выбрать",btn_locked:"Заблокировано",btn_unlock:"Разблокировать",btn_buy:"Купить",btn_get:"Получить",btn_done:"Готово ✓",btn_create:"Создать",btn_next:"Далее",
 mn_rate:"Скорость",mn_cap:"Лимит",mn_cooldown_lbl:"Откат",mn_required:"Требуется",mn_free:"Бесплатно",mn_default:"По умолчанию",
 req_level_access:"Доступ уровня майнера {min}–{max} (ваш уровень: {name})",req_level_upgrade:"Ваш уровень: доступ только {min}–{max} · Повысьте уровень",req_level_ok:"Ваш уровень: доступ {min}–{max}",req_price:"Цена {p} CRTA (депозитный баланс)",req_active_referral:"{n} активных реферал{s}",req_normal_referral:"{n} обычных реферал{s}",req_watch_ads:"Посмотреть {n} реклам{s}{brk}",
 day_word:"День",daily_claimed_lbl:"Награда сегодня получена ✓",daily_connect_claim:"Подключите кошелёк, чтобы забрать",daily_claim_plus:"Забрать +{a} CRTA",
 t_need_more_referral:"Нужно ещё {n} реферал(ов)",t_need_more_active_referral:"Нужно ещё {n} активных реферал(ов)",
 t_guest_mode_note:"Гостевой режим: данные не будут сохранены в базе данных",t_wallet_limit_suffix:" кошелек{s} только",t_default_wallet:"Кошелёк",t_default_level:"Уровень",t_default_miner:"Майнер",t_referral_link_not_setup:"Реферальная ссылка ещё не настроена (админ: укажите имя бота)",t_daily_reward_claimed:"+{a} CRTA получено! 🎉",t_task_reward_claimed:"+{a} CRTA получено!",t_deposit_request_submitted:"Заявка на депозит {amt} CRTA отправлена. Отправьте {pay} {unit} для завершения.",t_req_deposit_balance:"{amt} CRTA депозитного баланса",t_req_usd_balance:"${amt} USD баланса",t_req_tasks_completed:"{n} {label}задани{s} выполнено"
},
hi:{
 nav_home:"होम", t_connected_suffix:" कनेक्ट हो गया!",t_unlocked_suffix:" अनलॉक हुआ!",t_unlocked_wear_suffix:" अनलॉक हुआ! पहनने के लिए Select पर टैप करें।",t_active_level_suffix:" अब आपका सक्रिय लेवल है!",t_selected_suffix:" चुना गया",t_link_not_available:"लिंक अभी उपलब्ध नहीं है",t_reward_claimed:"क्लेम हो गया! 🎉",t_swapped_to:"स्वैप हुआ: ", t_claimed_amount:"{a} CRTA क्लेम किया गया!", claim_claiming:"क्लेम हो रहा है…",claim_loading_ad:"विज्ञापन लोड हो रहा है…",claim_claim_amount:"{a} CRTA क्लेम करें",claim_next_ad_in:"अगला विज्ञापन {s}सेकंड में", mine_no_miner:"कोई माइनर उपलब्ध नहीं",mine_cooldown:"कूलडाउन ",mine_mining:"माइनिंग हो रही है…",mine_watch_ads_claim:"क्लेम के लिए {n} विज्ञापन देखें", swap_to_crta:"CRTA में स्वैप करें",swap_to_usd:"USD में स्वैप करें",swap_deposit_not_avail:"डिपॉज़िट स्वैप उपलब्ध नहीं है",swap_rate_not_set_short:"स्वैप रेट सेट नहीं है",swap_no_balance:"स्वैप के लिए बैलेंस नहीं है",swap_note_pct:"आपका लेवल ({b}) डिपॉज़िट बैलेंस का {p}% CRTA में बदलता है। बाकी काट लिया जाता है।",swap_note_zero:"आपके लेवल ({b}) में 0% डिपॉज़िट स्वैप है। डिपॉज़िट बैलेंस बदलने के लिए स्वैप % वाला लेवल अनलॉक करें।",swap_note_rate:"1 CRTA = ${r} USD · USD वापस स्वैप नहीं हो सकता",nav_task:"टास्क",nav_swap:"स्वैप",nav_mining:"माइनिंग",nav_refer:"रेफर",nav_profile:"प्रोफ़ाइल",
 total_balance:"कुल बैलेंस",deposit:"डिपॉज़िट",withdraw:"निकासी",
 lbl_streak:"स्ट्रीक",lbl_today_mining:"आज माइनिंग",lbl_today_refer:"आज रेफर",lbl_rank:"रैंक",
 daily_reward:"दैनिक इनाम",leaderboard:"लीडरबोर्ड",claim_today_reward:"आज का इनाम क्लेम करें",
 tasks_title:"टास्क",tab_all:"सभी",
 swap_title:"स्वैप",swap_deposit_to_crta:"डिपॉज़िट → CRTA",swap_crta_to_usd:"CRTA → USD",
 you_pay:"आप देंगे (",available:"उपलब्ध",you_receive:"आपको मिलेगा (",max:"अधिकतम",swap_history:"स्वैप इतिहास",btn_swap:"स्वैप करें",
 mining_mined:"माइन किया गया",start_mining:"माइनिंग शुरू करें",miners_title:"माइनर्स",
 invite_earn:"आमंत्रित करें और कमाएं",earn_commission_sub:"जब भी आपके दोस्त निकासी करें, कमीशन कमाएं",
 total_earned:"कुल कमाई",active_refer:"सक्रिय रेफर",commission:"कमीशन",your_referral_link:"आपका रेफरल लिंक",
 copy:"कॉपी",copy_link:"लिंक कॉपी करें",share:"शेयर करें",joined_with_code:"आप इस कोड से जुड़े",your_referrals:"आपके रेफरल",total_refer:"कुल रेफर",
 profile_earning:"कमाई (CRTA)",profile_deposit_balance:"डिपॉज़िट बैलेंस",profile_usd_withdrawable:"USD (निकासी योग्य)",
 total_withdraw:"कुल निकासी",total_task:"कुल टास्क",total_mining:"कुल माइनिंग",total_deposit:"कुल डिपॉज़िट",
 menu_level:"लेवल",menu_connect_wallet:"वॉलेट कनेक्ट करें",menu_transactions:"लेन-देन",menu_telegram_channel:"टेलीग्राम चैनल",menu_support:"सहायता",menu_language:"भाषा",
 levels_title:"लेवल्स",transactions_title:"लेन-देन",tx_all:"सभी",tx_deposit:"डिपॉज़िट",tx_withdraw:"निकासी",tx_task:"टास्क",tx_mining:"माइनिंग",tx_refer:"रेफर",tx_swap:"स्वैप",
 deposit_page_title:"डिपॉज़िट",payment_method:"भुगतान का तरीका",send_payment_to:"यहां भुगतान भेजें",amount_crta:"राशि (CRTA)",txid_label:"ट्रांज़ैक्शन ID / प्रमाण",confirm_deposit:"डिपॉज़िट कन्फ़र्म करें",
 withdraw_page_title:"निकासी",available_balance:"उपलब्ध बैलेंस",no_wallet_connected:"अभी तक कोई वॉलेट कनेक्ट नहीं है। निकासी के लिए वॉलेट कनेक्ट करें।",connect_wallet_btn:"वॉलेट कनेक्ट करें",select_method:"तरीका चुनें",amount_label:"राशि",usd_unit:"USD",processing_note:"प्रोसेसिंग में 24 घंटे तक लग सकते हैं। अस्वीकृत अनुरोध पूरी तरह वापस किए जाते हैं।",request_withdrawal:"निकासी का अनुरोध करें",
 wallet_sheet_title:"वॉलेट कनेक्ट करें",wallet_method_note:"हर तरीके के लिए एक वॉलेट — स्थायी और बाद में बदला नहीं जा सकता। दैनिक क्लेम, रेफरल और माइनिंग के लिए कनेक्टेड वॉलेट ज़रूरी है।",choose_method:"तरीका चुनें",wallet_address_placeholder:"अपना वॉलेट पता दर्ज करें",wallet_warn_note:"⚠ सेव होने के बाद स्थायी है। आप इसे एडिट या हटा नहीं सकते, और पूरा पता फिर कभी नहीं दिखाया जाएगा। सेव करने से पहले जांच लें।",save_wallet:"वॉलेट सेव करें",
 watch_ads_title:"क्लेम के लिए विज्ञापन देखें",ads_watched:"देखे गए विज्ञापन",claim_note:"हर विज्ञापन देखें, फिर अपना माइन किया CRTA पाने के लिए क्लेम पर टैप करें।",watch_ad_btn:"विज्ञापन देखें",
 submit_proof_title:"प्रमाण सबमिट करें",screenshot_label:"स्क्रीनशॉट",upload_hint:"गैलरी से अपलोड करने के लिए टैप करें",submit_btn:"सबमिट करें",
 create_account_title:"अकाउंट बनाएं",password_label:"पासवर्ड",your_email_label:"आपका ईमेल",
 notifications_title:"सूचनाएं",no_notifications:"कोई सूचना नहीं",
 loading_text:"लोड हो रहा है",slow_connection:"धीमा कनेक्शन, कोशिश जारी है…",account_suspended_title:"अकाउंट सस्पेंड किया गया",account_suspended_sub:"आपका अकाउंट बैन कर दिया गया है। अगर यह गलती लगती है तो सहायता से संपर्क करें।",
 language_title:"भाषा",
 t_connect_wallet_first:"सबसे पहले वॉलेट कनेक्ट करें ताकि आप ",
 t_ad_watched:"विज्ञापन देखा गया — जारी रखने के लिए फिर से टैप करें",t_ads_not_setup:"विज्ञापन अभी सेट नहीं हुए हैं — बाद में कोशिश करें",t_ad_not_completed:"विज्ञापन पूरा नहीं हुआ — फिर से कोशिश करें",
 t_wallet_locked:"वॉलेट लॉक है। इसे एडिट या हटाया नहीं जा सकता।",t_select_method_first:"पहले एक तरीका चुनें",t_enter_valid_wallet:"मान्य वॉलेट पता दर्ज करें",
 t_wallet_too_short:"वॉलेट पता बहुत छोटा लग रहा है",t_wallet_already_connected:"वॉलेट पहले से कनेक्ट और लॉक है",t_something_wrong:"कुछ गलत हो गया। कृपया फिर से कोशिश करें।",
 t_level_requirements_not_met:"आपने अभी तक इस लेवल की आवश्यकताएं पूरी नहीं की हैं",t_level_locked:"यह लेवल अभी भी लॉक है",
 t_referral_applied:"रेफरल आपके अकाउंट पर लागू हो गया!",t_requirements_not_met:"अभी आवश्यकताएं पूरी नहीं हुईं",t_unlock_miner_first:"पहले इस माइनर को अनलॉक करें",
 t_cant_change_miner:"माइनिंग चलते समय माइनर नहीं बदल सकते",t_no_miner_available:"कोई माइनर उपलब्ध नहीं",t_wait_cooldown:"कूलडाउन खत्म होने का इंतज़ार करें",
 t_mining_started:"माइनिंग शुरू हुई!",t_mining_start_failed:"माइनिंग शुरू नहीं हो सकी, फिर से कोशिश करें",t_claim_cap_full:"कैप पूरा होने पर ही आप क्लेम कर सकते हैं",t_claim_failed:"क्लेम विफल, फिर से कोशिश करें",
 t_task_unavailable:"यह टास्क अब उपलब्ध नहीं है",t_choose_image:"कृपया एक इमेज चुनें",t_could_not_read_image:"वह इमेज पढ़ी नहीं जा सकी",t_no_slots:"इस टास्क के लिए कोई स्लॉट नहीं बचा",
 t_submitted_review:"सबमिट हो गया — समीक्षा की प्रतीक्षा है",t_submit_failed:"सबमिट नहीं हो सका, फिर से कोशिश करें",t_enter_valid_email:"मान्य ईमेल दर्ज करें",t_ad_failed_load:"विज्ञापन लोड नहीं हो सका, फिर से कोशिश करें",
 t_too_fast:"आप बहुत जल्दी वापस आ गए — टास्क नहीं गिना गया, फिर से कोशिश करें",t_enter_valid_amount:"मान्य राशि दर्ज करें",t_insufficient_deposit:"डिपॉज़िट बैलेंस अपर्याप्त है",t_insufficient_crta:"CRTA बैलेंस अपर्याप्त है",
 t_zero_percent_swap:"आपके लेवल में डिपॉज़िट स्वैप 0% है",t_amount_too_small:"राशि बहुत कम है",t_swap_rate_not_set:"स्वैप रेट अभी सेट नहीं हुआ",t_copied:"कॉपी हो गया!",t_copy_failed:"कॉपी नहीं हो सका। कृपया मैन्युअली कॉपी करें।",
 t_no_address:"कॉपी करने के लिए कोई पता नहीं",t_select_deposit_method:"डिपॉज़िट का तरीका चुनें",t_txid_required:"ट्रांज़ैक्शन ID / प्रमाण आवश्यक है",t_deposit_submit_failed:"डिपॉज़िट अनुरोध सबमिट नहीं हो सका",
 t_select_method:"एक तरीका चुनें",t_amount_too_small_fee:"फीस के बाद राशि बहुत कम है",t_method_requirements_not_met:"आप इस तरीके की आवश्यकताएं पूरी नहीं करते",
 t_connect_wallet_method:"निकासी से पहले इस तरीके के लिए वॉलेट कनेक्ट करें",t_insufficient_usd:"USD बैलेंस अपर्याप्त है",t_withdraw_submitted:"निकासी अनुरोध सबमिट हो गया!",
 t_connect_wallet_daily:"दैनिक इनाम क्लेम करने के लिए पहले वॉलेट कनेक्ट करें",t_wallet_limit:"आपका लेवल इतने वॉलेट कनेक्ट करने की अनुमति देता है: ",
 t_min_deposit:"न्यूनतम डिपॉज़िट है ",t_max_deposit:"अधिकतम डिपॉज़िट है ",t_min_amount:"न्यूनतम राशि है $",t_max_amount:"अधिकतम राशि है $",t_requires:"आवश्यक: ",t_withdraw_limit_reached:"इस महीने आपके मौजूदा स्तर के लिए निकासी उपलब्ध नहीं है।",
 btn_go:"जाएं",btn_submit:"जमा करें",btn_submitting:"जमा हो रहा है…",btn_pending:"लंबित",btn_claim:"क्लेम करें",btn_not_joined_retry:"जॉइन नहीं किया — फिर से कोशिश करें",btn_verify_failed_retry:"सत्यापित नहीं हो सका — फिर से कोशिश करें",btn_verifying:"सत्यापन हो रहा है...",btn_claiming:"क्लेम हो रहा है...",btn_invite:"आमंत्रित करें",btn_loading_ad:"विज्ञापन लोड हो रहा है...",btn_available_in:"{s} सेकंड में उपलब्ध",btn_watch_ad:"विज्ञापन देखें",btn_waiting:"प्रतीक्षा हो रही है...",btn_selected:"चयनित",btn_mining_active:"माइनिंग सक्रिय",btn_mining_active_title:"माइनिंग सक्रिय रहते हुए माइनर नहीं बदला जा सकता",btn_select:"चुनें",btn_locked:"लॉक्ड",btn_unlock:"अनलॉक करें",btn_buy:"खरीदें",btn_get:"प्राप्त करें",btn_done:"पूर्ण ✓",btn_create:"बनाएं",btn_next:"अगला",
 mn_rate:"दर",mn_cap:"सीमा",mn_cooldown_lbl:"कूलडाउन",mn_required:"आवश्यक",mn_free:"मुफ़्त",mn_default:"डिफ़ॉल्ट",
 req_level_access:"माइनर लेवल {min}–{max} एक्सेस (आपका लेवल: {name})",req_level_upgrade:"आपका लेवल: सिर्फ़ {min}–{max} एक्सेस · कृपया अपग्रेड करें",req_level_ok:"आपका लेवल: {min}–{max} एक्सेस",req_price:"मूल्य {p} CRTA (डिपॉज़िट बैलेंस)",req_active_referral:"{n} सक्रिय रेफरल{s}",req_normal_referral:"{n} सामान्य रेफरल{s}",req_watch_ads:"{n} विज्ञापन{s} देखें{brk}",
 day_word:"दिन",daily_claimed_lbl:"आज का इनाम क्लेम हो गया ✓",daily_connect_claim:"क्लेम करने के लिए वॉलेट कनेक्ट करें",daily_claim_plus:"+{a} CRTA क्लेम करें",
 t_need_more_referral:"आपको {n} और रेफरल चाहिए",t_need_more_active_referral:"आपको {n} और सक्रिय रेफरल चाहिए",
 t_guest_mode_note:"गेस्ट मोड: डेटा डेटाबेस में सेव नहीं होगा",t_wallet_limit_suffix:" वॉलेट",t_default_wallet:"वॉलेट",t_default_level:"लेवल",t_default_miner:"माइनर",t_referral_link_not_setup:"रेफरल लिंक अभी सेट नहीं है (एडमिन: बॉट यूज़रनेम सेट करें)",t_daily_reward_claimed:"+{a} CRTA क्लेम हो गया! 🎉",t_task_reward_claimed:"+{a} CRTA क्लेम हो गया!",t_deposit_request_submitted:"{amt} CRTA की डिपॉज़िट रिक्वेस्ट भेजी गई। पूरा करने के लिए {pay} {unit} भेजें।",t_req_deposit_balance:"{amt} CRTA डिपॉज़िट बैलेंस",t_req_usd_balance:"${amt} USD बैलेंस",t_req_tasks_completed:"{n} {label}टास्क{s} पूरे करें"
},
ur:{
 nav_home:"ہوم", t_connected_suffix:" کنیکٹ ہو گیا!",t_unlocked_suffix:" ان لاک ہو گیا!",t_unlocked_wear_suffix:" ان لاک ہو گیا! پہننے کے لیے Select پر ٹیپ کریں۔",t_active_level_suffix:" اب آپ کا فعال لیول ہے!",t_selected_suffix:" منتخب ہو گیا",t_link_not_available:"لنک ابھی دستیاب نہیں",t_reward_claimed:"کلیم ہو گیا! 🎉",t_swapped_to:"سویپ ہوا: ", t_claimed_amount:"{a} CRTA کلیم ہو گیا!", claim_claiming:"کلیم ہو رہا ہے…",claim_loading_ad:"اشتہار لوڈ ہو رہا ہے…",claim_claim_amount:"{a} CRTA کلیم کریں",claim_next_ad_in:"اگلا اشتہار {s} سیکنڈ میں", mine_no_miner:"کوئی مائنر دستیاب نہیں",mine_cooldown:"کول ڈاؤن ",mine_mining:"مائننگ ہو رہی ہے…",mine_watch_ads_claim:"کلیم کے لیے {n} اشتہار دیکھیں", swap_to_crta:"CRTA میں سویپ کریں",swap_to_usd:"USD میں سویپ کریں",swap_deposit_not_avail:"ڈپازٹ سویپ دستیاب نہیں",swap_rate_not_set_short:"سویپ ریٹ سیٹ نہیں ہے",swap_no_balance:"سویپ کے لیے بیلنس نہیں ہے",swap_note_pct:"آپ کا لیول ({b}) ڈپازٹ بیلنس کا {p}% CRTA میں تبدیل کرتا ہے۔ باقی کاٹ لیا جاتا ہے۔",swap_note_zero:"آپ کے لیول ({b}) میں 0% ڈپازٹ سویپ ہے۔ ڈپازٹ بیلنس تبدیل کرنے کے لیے سویپ % والا لیول ان لاک کریں۔",swap_note_rate:"1 CRTA = ${r} USD · USD واپس سویپ نہیں ہو سکتا",nav_task:"ٹاسک",nav_swap:"سویپ",nav_mining:"مائننگ",nav_refer:"ریفر",nav_profile:"پروفائل",
 total_balance:"کل بیلنس",deposit:"ڈپازٹ",withdraw:"نکالیں",
 lbl_streak:"اسٹریک",lbl_today_mining:"آج مائننگ",lbl_today_refer:"آج ریفر",lbl_rank:"رینک",
 daily_reward:"روزانہ انعام",leaderboard:"لیڈر بورڈ",claim_today_reward:"آج کا انعام کلیم کریں",
 tasks_title:"ٹاسکس",tab_all:"سب",
 swap_title:"سویپ",swap_deposit_to_crta:"ڈپازٹ → CRTA",swap_crta_to_usd:"CRTA → USD",
 you_pay:"آپ ادا کریں گے (",available:"دستیاب",you_receive:"آپ کو ملے گا (",max:"زیادہ سے زیادہ",swap_history:"سویپ کی تاریخ",btn_swap:"سویپ کریں",
 mining_mined:"مائن شدہ",start_mining:"مائننگ شروع کریں",miners_title:"مائنرز",
 invite_earn:"دعوت دیں اور کمائیں",earn_commission_sub:"جب بھی آپ کے دوست نکاسی کریں کمیشن کمائیں",
 total_earned:"کل کمائی",active_refer:"فعال ریفر",commission:"کمیشن",your_referral_link:"آپ کا ریفرل لنک",
 copy:"کاپی",copy_link:"لنک کاپی کریں",share:"شیئر کریں",joined_with_code:"آپ اس کوڈ سے شامل ہوئے",your_referrals:"آپ کے ریفرلز",total_refer:"کل ریفر",
 profile_earning:"کمائی (CRTA)",profile_deposit_balance:"ڈپازٹ بیلنس",profile_usd_withdrawable:"USD (قابلِ نکاسی)",
 total_withdraw:"کل نکاسی",total_task:"کل ٹاسک",total_mining:"کل مائننگ",total_deposit:"کل ڈپازٹ",
 menu_level:"لیول",menu_connect_wallet:"والیٹ کنیکٹ کریں",menu_transactions:"ٹرانزیکشنز",menu_telegram_channel:"ٹیلیگرام چینل",menu_support:"سپورٹ",menu_language:"زبان",
 levels_title:"لیولز",transactions_title:"ٹرانزیکشنز",tx_all:"سب",tx_deposit:"ڈپازٹ",tx_withdraw:"نکاسی",tx_task:"ٹاسک",tx_mining:"مائننگ",tx_refer:"ریفر",tx_swap:"سویپ",
 deposit_page_title:"ڈپازٹ",payment_method:"ادائیگی کا طریقہ",send_payment_to:"یہاں ادائیگی بھیجیں",amount_crta:"رقم (CRTA)",txid_label:"ٹرانزیکشن ID / ثبوت",confirm_deposit:"ڈپازٹ کنفرم کریں",
 withdraw_page_title:"نکاسی",available_balance:"دستیاب بیلنس",no_wallet_connected:"ابھی تک کوئی والیٹ کنیکٹ نہیں ہے۔ نکاسی کے لیے والیٹ کنیکٹ کریں۔",connect_wallet_btn:"والیٹ کنیکٹ کریں",select_method:"طریقہ منتخب کریں",amount_label:"رقم",usd_unit:"USD",processing_note:"پروسیسنگ میں 24 گھنٹے تک لگ سکتے ہیں۔ مسترد درخواستیں مکمل واپس کر دی جاتی ہیں۔",request_withdrawal:"نکاسی کی درخواست دیں",
 wallet_sheet_title:"والیٹ کنیکٹ کریں",wallet_method_note:"ہر طریقے کے لیے ایک والیٹ — مستقل ہے اور بعد میں تبدیل نہیں ہو سکتا۔ روزانہ کلیم، ریفرل اور مائننگ کے لیے کنیکٹڈ والیٹ ضروری ہے۔",choose_method:"طریقہ منتخب کریں",wallet_address_placeholder:"اپنا والیٹ ایڈریس درج کریں",wallet_warn_note:"⚠ محفوظ ہونے کے بعد مستقل ہے۔ آپ اسے ایڈٹ یا حذف نہیں کر سکتے، اور مکمل ایڈریس دوبارہ نہیں دکھایا جائے گا۔ محفوظ کرنے سے پہلے چیک کر لیں۔",save_wallet:"والیٹ محفوظ کریں",
 watch_ads_title:"کلیم کے لیے اشتہار دیکھیں",ads_watched:"دیکھے گئے اشتہارات",claim_note:"ہر اشتہار دیکھیں، پھر اپنا مائن شدہ CRTA حاصل کرنے کے لیے کلیم پر ٹیپ کریں۔",watch_ad_btn:"اشتہار دیکھیں",
 submit_proof_title:"ثبوت جمع کروائیں",screenshot_label:"اسکرین شاٹ",upload_hint:"گیلری سے اپلوڈ کرنے کے لیے ٹیپ کریں",submit_btn:"جمع کروائیں",
 create_account_title:"اکاؤنٹ بنائیں",password_label:"پاس ورڈ",your_email_label:"آپ کا ای میل",
 notifications_title:"اطلاعات",no_notifications:"کوئی اطلاع نہیں",
 loading_text:"لوڈ ہو رہا ہے",slow_connection:"سست کنکشن، کوشش جاری ہے…",account_suspended_title:"اکاؤنٹ معطل کر دیا گیا",account_suspended_sub:"آپ کا اکاؤنٹ بین کر دیا گیا ہے۔ اگر یہ غلطی لگتی ہے تو سپورٹ سے رابطہ کریں۔",
 language_title:"زبان",
 t_connect_wallet_first:"پہلے والیٹ کنیکٹ کریں تاکہ آپ ",
 t_ad_watched:"اشتہار دیکھا گیا — جاری رکھنے کے لیے دوبارہ ٹیپ کریں",t_ads_not_setup:"اشتہارات ابھی سیٹ نہیں ہوئے — بعد میں کوشش کریں",t_ad_not_completed:"اشتہار مکمل نہیں ہوا — دوبارہ کوشش کریں",
 t_wallet_locked:"والیٹ لاک ہے۔ اسے ایڈٹ یا حذف نہیں کیا جا سکتا۔",t_select_method_first:"پہلے ایک طریقہ منتخب کریں",t_enter_valid_wallet:"درست والیٹ ایڈریس درج کریں",
 t_wallet_too_short:"والیٹ ایڈریس بہت مختصر لگ رہا ہے",t_wallet_already_connected:"والیٹ پہلے سے کنیکٹ اور لاک ہے",t_something_wrong:"کچھ غلط ہو گیا۔ دوبارہ کوشش کریں۔",
 t_level_requirements_not_met:"آپ نے ابھی تک اس لیول کی شرائط پوری نہیں کیں",t_level_locked:"یہ لیول ابھی بھی لاک ہے",
 t_referral_applied:"ریفرل آپ کے اکاؤنٹ پر لاگو ہو گیا!",t_requirements_not_met:"شرائط ابھی پوری نہیں ہوئیں",t_unlock_miner_first:"پہلے اس مائنر کو ان لاک کریں",
 t_cant_change_miner:"مائننگ کے دوران مائنر تبدیل نہیں ہو سکتا",t_no_miner_available:"کوئی مائنر دستیاب نہیں",t_wait_cooldown:"کول ڈاؤن ختم ہونے کا انتظار کریں",
 t_mining_started:"مائننگ شروع ہو گئی!",t_mining_start_failed:"مائننگ شروع نہیں ہو سکی، دوبارہ کوشش کریں",t_claim_cap_full:"کیپ مکمل ہونے پر ہی آپ کلیم کر سکتے ہیں",t_claim_failed:"کلیم ناکام، دوبارہ کوشش کریں",
 t_task_unavailable:"یہ ٹاسک اب دستیاب نہیں",t_choose_image:"براہ کرم ایک تصویر منتخب کریں",t_could_not_read_image:"وہ تصویر پڑھی نہیں جا سکی",t_no_slots:"اس ٹاسک کے لیے کوئی جگہ باقی نہیں",
 t_submitted_review:"جمع ہو گیا — جائزے کا انتظار ہے",t_submit_failed:"جمع نہیں ہو سکا، دوبارہ کوشش کریں",t_enter_valid_email:"درست ای میل درج کریں",t_ad_failed_load:"اشتہار لوڈ نہیں ہو سکا، دوبارہ کوشش کریں",
 t_too_fast:"آپ بہت جلدی واپس آ گئے — ٹاسک شمار نہیں ہوا، دوبارہ کوشش کریں",t_enter_valid_amount:"درست رقم درج کریں",t_insufficient_deposit:"ڈپازٹ بیلنس ناکافی ہے",t_insufficient_crta:"CRTA بیلنس ناکافی ہے",
 t_zero_percent_swap:"آپ کے لیول میں ڈپازٹ سویپ 0% ہے",t_amount_too_small:"رقم بہت کم ہے",t_swap_rate_not_set:"سویپ ریٹ ابھی سیٹ نہیں ہوا",t_copied:"کاپی ہو گیا!",t_copy_failed:"کاپی نہیں ہو سکا۔ براہ کرم دستی طور پر کاپی کریں۔",
 t_no_address:"کاپی کرنے کے لیے کوئی ایڈریس نہیں",t_select_deposit_method:"ڈپازٹ کا طریقہ منتخب کریں",t_txid_required:"ٹرانزیکشن ID / ثبوت درکار ہے",t_deposit_submit_failed:"ڈپازٹ درخواست جمع نہیں ہو سکی",
 t_select_method:"ایک طریقہ منتخب کریں",t_amount_too_small_fee:"فیس کے بعد رقم بہت کم ہے",t_method_requirements_not_met:"آپ اس طریقے کی شرائط پوری نہیں کرتے",
 t_connect_wallet_method:"نکاسی سے پہلے اس طریقے کے لیے والیٹ کنیکٹ کریں",t_insufficient_usd:"USD بیلنس ناکافی ہے",t_withdraw_submitted:"نکاسی کی درخواست جمع ہو گئی!",
 t_connect_wallet_daily:"روزانہ انعام کلیم کرنے کے لیے پہلے والیٹ کنیکٹ کریں",t_wallet_limit:"آپ کا لیول اتنے والیٹ کنیکٹ کرنے کی اجازت دیتا ہے: ",
 t_min_deposit:"کم از کم ڈپازٹ ہے ",t_max_deposit:"زیادہ سے زیادہ ڈپازٹ ہے ",t_min_amount:"کم از کم رقم ہے $",t_max_amount:"زیادہ سے زیادہ رقم ہے $",t_requires:"درکار ہے: ",t_withdraw_limit_reached:"اس مہینے آپ کے موجودہ لیول کے لیے نکاسی دستیاب نہیں ہے۔",
 btn_go:"جائیں",btn_submit:"جمع کروائیں",btn_submitting:"جمع ہو رہا ہے…",btn_pending:"زیرِ التوا",btn_claim:"کلیم کریں",btn_not_joined_retry:"جوائن نہیں کیا — دوبارہ کوشش کریں",btn_verify_failed_retry:"تصدیق نہیں ہو سکی — دوبارہ کوشش کریں",btn_verifying:"تصدیق ہو رہی ہے...",btn_claiming:"کلیم ہو رہا ہے...",btn_invite:"دعوت دیں",btn_loading_ad:"اشتہار لوڈ ہو رہا ہے...",btn_available_in:"{s} سیکنڈ میں دستیاب",btn_watch_ad:"اشتہار دیکھیں",btn_waiting:"انتظار ہو رہا ہے...",btn_selected:"منتخب",btn_mining_active:"مائننگ فعال",btn_mining_active_title:"مائننگ فعال ہونے کے دوران مائنر تبدیل نہیں کیا جا سکتا",btn_select:"منتخب کریں",btn_locked:"مقفل",btn_unlock:"ان لاک کریں",btn_buy:"خریدیں",btn_get:"حاصل کریں",btn_done:"مکمل ✓",btn_create:"بنائیں",btn_next:"اگلا",
 mn_rate:"شرح",mn_cap:"حد",mn_cooldown_lbl:"کول ڈاؤن",mn_required:"درکار",mn_free:"مفت",mn_default:"ڈیفالٹ",
 req_level_access:"مائنر لیول {min}–{max} رسائی (آپ کا لیول: {name})",req_level_upgrade:"آپ کا لیول: صرف {min}–{max} رسائی · براہ کرم اپ گریڈ کریں",req_level_ok:"آپ کا لیول: {min}–{max} رسائی",req_price:"قیمت {p} CRTA (ڈپازٹ بیلنس)",req_active_referral:"{n} فعال ریفرل{s}",req_normal_referral:"{n} عام ریفرل{s}",req_watch_ads:"{n} اشتہار{s} دیکھیں{brk}",
 day_word:"دن",daily_claimed_lbl:"آج کا انعام کلیم ہو گیا ✓",daily_connect_claim:"کلیم کرنے کے لیے والیٹ کنیکٹ کریں",daily_claim_plus:"+{a} CRTA کلیم کریں",
 t_need_more_referral:"آپ کو {n} مزید ریفرل درکار ہیں",t_need_more_active_referral:"آپ کو {n} مزید فعال ریفرل درکار ہیں",
 t_guest_mode_note:"گیسٹ موڈ: ڈیٹا ڈیٹا بیس میں محفوظ نہیں ہوگا",t_wallet_limit_suffix:" والٹ",t_default_wallet:"والٹ",t_default_level:"لیول",t_default_miner:"مائنر",t_referral_link_not_setup:"ریفرل لنک ابھی سیٹ نہیں ہے (ایڈمن: بوٹ یوزر نیم سیٹ کریں)",t_daily_reward_claimed:"+{a} CRTA کلیم ہو گیا! 🎉",t_task_reward_claimed:"+{a} CRTA کلیم ہو گیا!",t_deposit_request_submitted:"{amt} CRTA کی ڈپازٹ درخواست جمع ہو گئی۔ مکمل کرنے کے لیے {pay} {unit} بھیجیں۔",t_req_deposit_balance:"{amt} CRTA ڈپازٹ بیلنس",t_req_usd_balance:"${amt} USD بیلنس",t_req_tasks_completed:"{n} {label}ٹاسک{s} مکمل کریں"
},
bn:{
 nav_home:"হোম", t_connected_suffix:" কানেক্ট হয়েছে!",t_unlocked_suffix:" আনলক হয়েছে!",t_unlocked_wear_suffix:" আনলক হয়েছে! পরার জন্য Select-এ ট্যাপ করুন।",t_active_level_suffix:" এখন আপনার সক্রিয় লেভেল!",t_selected_suffix:" নির্বাচিত হয়েছে",t_link_not_available:"লিংক এখনো উপলব্ধ নেই",t_reward_claimed:"ক্লেইম হয়েছে! 🎉",t_swapped_to:"সোয়াপ হয়েছে: ", t_claimed_amount:"{a} CRTA ক্লেইম হয়েছে!", claim_claiming:"ক্লেইম হচ্ছে…",claim_loading_ad:"বিজ্ঞাপন লোড হচ্ছে…",claim_claim_amount:"{a} CRTA ক্লেইম করুন",claim_next_ad_in:"পরবর্তী বিজ্ঞাপন {s} সেকেন্ডে", mine_no_miner:"কোনো মাইনার উপলব্ধ নেই",mine_cooldown:"কুলডাউন ",mine_mining:"মাইনিং হচ্ছে…",mine_watch_ads_claim:"ক্লেইম করতে {n}টি বিজ্ঞাপন দেখুন", swap_to_crta:"CRTA-তে সোয়াপ করুন",swap_to_usd:"USD-তে সোয়াপ করুন",swap_deposit_not_avail:"ডিপোজিট সোয়াপ উপলব্ধ নেই",swap_rate_not_set_short:"সোয়াপ রেট সেট করা নেই",swap_no_balance:"সোয়াপ করার মতো ব্যালেন্স নেই",swap_note_pct:"আপনার লেভেল ({b}) ডিপোজিট ব্যালেন্সের {p}% CRTA-তে রূপান্তর করে। বাকিটা কেটে নেওয়া হয়।",swap_note_zero:"আপনার লেভেলে ({b}) ০% ডিপোজিট সোয়াপ আছে। ডিপোজিট ব্যালেন্স রূপান্তর করতে সোয়াপ % সহ একটি লেভেল আনলক করুন।",swap_note_rate:"1 CRTA = ${r} USD · USD ফেরত সোয়াপ করা যায় না",nav_task:"টাস্ক",nav_swap:"সোয়াপ",nav_mining:"মাইনিং",nav_refer:"রেফার",nav_profile:"প্রোফাইল",
 total_balance:"মোট ব্যালেন্স",deposit:"ডিপোজিট",withdraw:"উইথড্র",
 lbl_streak:"স্ট্রিক",lbl_today_mining:"আজকের মাইনিং",lbl_today_refer:"আজকের রেফার",lbl_rank:"র‍্যাংক",
 daily_reward:"দৈনিক পুরস্কার",leaderboard:"লিডারবোর্ড",claim_today_reward:"আজকের পুরস্কার ক্লেইম করুন",
 tasks_title:"টাস্ক",tab_all:"সব",
 swap_title:"সোয়াপ",swap_deposit_to_crta:"ডিপোজিট → CRTA",swap_crta_to_usd:"CRTA → USD",
 you_pay:"আপনি দেবেন (",available:"উপলব্ধ",you_receive:"আপনি পাবেন (",max:"সর্বোচ্চ",swap_history:"সোয়াপ ইতিহাস",btn_swap:"সোয়াপ করুন",
 mining_mined:"মাইন করা হয়েছে",start_mining:"মাইনিং শুরু করুন",miners_title:"মাইনার",
 invite_earn:"আমন্ত্রণ জানান ও আয় করুন",earn_commission_sub:"আপনার বন্ধুরা উইথড্র করলেই কমিশন আয় করুন",
 total_earned:"মোট আয়",active_refer:"সক্রিয় রেফার",commission:"কমিশন",your_referral_link:"আপনার রেফারেল লিংক",
 copy:"কপি",copy_link:"লিংক কপি করুন",share:"শেয়ার করুন",joined_with_code:"আপনি এই কোড দিয়ে যোগ দিয়েছেন",your_referrals:"আপনার রেফারেলরা",total_refer:"মোট রেফার",
 profile_earning:"আয় (CRTA)",profile_deposit_balance:"ডিপোজিট ব্যালেন্স",profile_usd_withdrawable:"USD (উত্তোলনযোগ্য)",
 total_withdraw:"মোট উইথড্র",total_task:"মোট টাস্ক",total_mining:"মোট মাইনিং",total_deposit:"মোট ডিপোজিট",
 menu_level:"লেভেল",menu_connect_wallet:"ওয়ালেট কানেক্ট করুন",menu_transactions:"লেনদেন",menu_telegram_channel:"টেলিগ্রাম চ্যানেল",menu_support:"সাপোর্ট",menu_language:"ভাষা",
 levels_title:"লেভেলসমূহ",transactions_title:"লেনদেন",tx_all:"সব",tx_deposit:"ডিপোজিট",tx_withdraw:"উইথড্র",tx_task:"টাস্ক",tx_mining:"মাইনিং",tx_refer:"রেফার",tx_swap:"সোয়াপ",
 deposit_page_title:"ডিপোজিট",payment_method:"পেমেন্ট পদ্ধতি",send_payment_to:"এখানে পেমেন্ট পাঠান",amount_crta:"পরিমাণ (CRTA)",txid_label:"ট্রানজেকশন ID / প্রমাণ",confirm_deposit:"ডিপোজিট নিশ্চিত করুন",
 withdraw_page_title:"উইথড্র",available_balance:"উপলব্ধ ব্যালেন্স",no_wallet_connected:"এখনও কোনো ওয়ালেট কানেক্ট করা হয়নি। উইথড্র করতে একটি ওয়ালেট কানেক্ট করুন।",connect_wallet_btn:"ওয়ালেট কানেক্ট করুন",select_method:"পদ্ধতি নির্বাচন করুন",amount_label:"পরিমাণ",usd_unit:"USD",processing_note:"প্রসেসিং করতে ২৪ ঘণ্টা পর্যন্ত সময় লাগতে পারে। প্রত্যাখ্যাত অনুরোধ সম্পূর্ণ ফেরত দেওয়া হয়।",request_withdrawal:"উইথড্র অনুরোধ করুন",
 wallet_sheet_title:"ওয়ালেট কানেক্ট করুন",wallet_method_note:"প্রতিটি পদ্ধতির জন্য একটি ওয়ালেট — স্থায়ী এবং পরে পরিবর্তন করা যাবে না। দৈনিক ক্লেইম, রেফারেল এবং মাইনিংয়ের জন্য একটি কানেক্টেড ওয়ালেট প্রয়োজন।",choose_method:"পদ্ধতি বেছে নিন",wallet_address_placeholder:"আপনার ওয়ালেট ঠিকানা লিখুন",wallet_warn_note:"⚠ সেভ করার পর স্থায়ী হয়ে যাবে। আপনি এটি এডিট বা মুছে ফেলতে পারবেন না, এবং সম্পূর্ণ ঠিকানা আর দেখানো হবে না। সেভ করার আগে ভালোভাবে যাচাই করুন।",save_wallet:"ওয়ালেট সেভ করুন",
 watch_ads_title:"ক্লেইম করতে বিজ্ঞাপন দেখুন",ads_watched:"দেখা বিজ্ঞাপন",claim_note:"প্রতিটি বিজ্ঞাপন দেখুন, তারপর আপনার মাইন করা CRTA সংগ্রহ করতে ক্লেইমে ট্যাপ করুন।",watch_ad_btn:"বিজ্ঞাপন দেখুন",
 submit_proof_title:"প্রমাণ জমা দিন",screenshot_label:"স্ক্রিনশট",upload_hint:"গ্যালারি থেকে আপলোড করতে ট্যাপ করুন",submit_btn:"জমা দিন",
 create_account_title:"অ্যাকাউন্ট তৈরি করুন",password_label:"পাসওয়ার্ড",your_email_label:"আপনার ইমেইল",
 notifications_title:"নোটিফিকেশন",no_notifications:"কোনো নোটিফিকেশন নেই",
 loading_text:"লোড হচ্ছে",slow_connection:"ধীর সংযোগ, চেষ্টা অব্যাহত…",account_suspended_title:"অ্যাকাউন্ট স্থগিত করা হয়েছে",account_suspended_sub:"আপনার অ্যাকাউন্ট নিষিদ্ধ করা হয়েছে। এটি ভুল মনে হলে সাপোর্টে যোগাযোগ করুন।",
 language_title:"ভাষা",
 t_connect_wallet_first:"প্রথমে একটি ওয়ালেট কানেক্ট করুন যাতে আপনি ",
 t_ad_watched:"বিজ্ঞাপন দেখা হয়েছে — চালিয়ে যেতে আবার ট্যাপ করুন",t_ads_not_setup:"বিজ্ঞাপন এখনো সেটআপ করা হয়নি — পরে আবার চেষ্টা করুন",t_ad_not_completed:"বিজ্ঞাপন সম্পূর্ণ দেখা হয়নি — আবার চেষ্টা করুন",
 t_wallet_locked:"ওয়ালেট লক করা আছে। এটি এডিট বা মুছে ফেলা যাবে না।",t_select_method_first:"প্রথমে একটি পদ্ধতি নির্বাচন করুন",t_enter_valid_wallet:"একটি বৈধ ওয়ালেট ঠিকানা লিখুন",
 t_wallet_too_short:"ওয়ালেট ঠিকানাটি খুব ছোট মনে হচ্ছে",t_wallet_already_connected:"ওয়ালেট ইতিমধ্যে কানেক্ট ও লক করা আছে",t_something_wrong:"কিছু ভুল হয়েছে। আবার চেষ্টা করুন।",
 t_level_requirements_not_met:"আপনি এখনও এই লেভেলের শর্ত পূরণ করেননি",t_level_locked:"এই লেভেলটি এখনও লক করা আছে",
 t_referral_applied:"রেফারেল আপনার অ্যাকাউন্টে প্রয়োগ করা হয়েছে!",t_requirements_not_met:"শর্তাবলী এখনও পূরণ হয়নি",t_unlock_miner_first:"প্রথমে এই মাইনারটি আনলক করুন",
 t_cant_change_miner:"মাইনিং চলাকালীন মাইনার পরিবর্তন করা যাবে না",t_no_miner_available:"কোনো মাইনার উপলব্ধ নেই",t_wait_cooldown:"কুলডাউন শেষ হওয়ার জন্য অপেক্ষা করুন",
 t_mining_started:"মাইনিং শুরু হয়েছে!",t_mining_start_failed:"মাইনিং শুরু করা যায়নি, আবার চেষ্টা করুন",t_claim_cap_full:"ক্যাপ পূর্ণ হলে আপনি ক্লেইম করতে পারবেন",t_claim_failed:"ক্লেইম ব্যর্থ হয়েছে, আবার চেষ্টা করুন",
 t_task_unavailable:"এই টাস্কটি আর উপলব্ধ নেই",t_choose_image:"অনুগ্রহ করে একটি ছবি নির্বাচন করুন",t_could_not_read_image:"সেই ছবিটি পড়া যায়নি",t_no_slots:"এই টাস্কের জন্য কোনো স্লট বাকি নেই",
 t_submitted_review:"জমা দেওয়া হয়েছে — পর্যালোচনার অপেক্ষায়",t_submit_failed:"জমা দেওয়া যায়নি, আবার চেষ্টা করুন",t_enter_valid_email:"একটি বৈধ ইমেইল লিখুন",t_ad_failed_load:"বিজ্ঞাপন লোড করা যায়নি, আবার চেষ্টা করুন",
 t_too_fast:"আপনি খুব দ্রুত ফিরে এসেছেন — টাস্ক গণনা হয়নি, আবার চেষ্টা করুন",t_enter_valid_amount:"একটি বৈধ পরিমাণ লিখুন",t_insufficient_deposit:"ডিপোজিট ব্যালেন্স অপর্যাপ্ত",t_insufficient_crta:"CRTA ব্যালেন্স অপর্যাপ্ত",
 t_zero_percent_swap:"আপনার লেভেলে ডিপোজিট সোয়াপ ০%",t_amount_too_small:"পরিমাণ খুব কম",t_swap_rate_not_set:"সোয়াপ রেট এখনও সেট করা হয়নি",t_copied:"কপি হয়েছে!",t_copy_failed:"কপি করা যায়নি। অনুগ্রহ করে ম্যানুয়ালি কপি করুন।",
 t_no_address:"কপি করার মতো কোনো ঠিকানা নেই",t_select_deposit_method:"একটি ডিপোজিট পদ্ধতি নির্বাচন করুন",t_txid_required:"ট্রানজেকশন ID / প্রমাণ প্রয়োজন",t_deposit_submit_failed:"ডিপোজিট অনুরোধ জমা দেওয়া যায়নি",
 t_select_method:"একটি পদ্ধতি নির্বাচন করুন",t_amount_too_small_fee:"ফি কাটার পর পরিমাণ খুব কম",t_method_requirements_not_met:"আপনি এই পদ্ধতির শর্ত পূরণ করেন না",
 t_connect_wallet_method:"উইথড্র করার আগে এই পদ্ধতির জন্য একটি ওয়ালেট কানেক্ট করুন",t_insufficient_usd:"USD ব্যালেন্স অপর্যাপ্ত",t_withdraw_submitted:"উইথড্র অনুরোধ জমা দেওয়া হয়েছে!",
 t_connect_wallet_daily:"দৈনিক পুরস্কার ক্লেইম করতে প্রথমে একটি ওয়ালেট কানেক্ট করুন",t_wallet_limit:"আপনার লেভেল এই কয়টি ওয়ালেট কানেক্ট করার অনুমতি দেয়: ",
 t_min_deposit:"সর্বনিম্ন ডিপোজিট হলো ",t_max_deposit:"সর্বোচ্চ ডিপোজিট হলো ",t_min_amount:"সর্বনিম্ন পরিমাণ হলো $",t_max_amount:"সর্বোচ্চ পরিমাণ হলো $",t_requires:"প্রয়োজন: ",t_withdraw_limit_reached:"এই মাসে আপনার বর্তমান লেভেলের জন্য উত্তোলন উপলব্ধ নেই।",
 btn_go:"যান",btn_submit:"জমা দিন",btn_submitting:"জমা হচ্ছে…",btn_pending:"অপেক্ষমাণ",btn_claim:"ক্লেইম করুন",btn_not_joined_retry:"জয়েন করা হয়নি — আবার চেষ্টা করুন",btn_verify_failed_retry:"যাচাই করা যায়নি — আবার চেষ্টা করুন",btn_verifying:"যাচাই হচ্ছে...",btn_claiming:"ক্লেইম হচ্ছে...",btn_invite:"ইনভাইট করুন",btn_loading_ad:"বিজ্ঞাপন লোড হচ্ছে...",btn_available_in:"{s} সেকেন্ডে পাওয়া যাবে",btn_watch_ad:"বিজ্ঞাপন দেখুন",btn_waiting:"অপেক্ষা করা হচ্ছে...",btn_selected:"নির্বাচিত",btn_mining_active:"মাইনিং চলছে",btn_mining_active_title:"মাইনিং চলাকালীন মাইনার পরিবর্তন করা যাবে না",btn_select:"নির্বাচন করুন",btn_locked:"লকড",btn_unlock:"আনলক করুন",btn_buy:"কিনুন",btn_get:"নিন",btn_done:"সম্পন্ন ✓",btn_create:"তৈরি করুন",btn_next:"পরবর্তী",
 mn_rate:"রেট",mn_cap:"ক্যাপ",mn_cooldown_lbl:"কুলডাউন",mn_required:"প্রয়োজনীয়",mn_free:"ফ্রি",mn_default:"ডিফল্ট",
 req_level_access:"মাইনার লেভেল {min}–{max} অ্যাক্সেস (আপনার লেভেল: {name})",req_level_upgrade:"আপনার লেভেল: শুধু {min}–{max} অ্যাক্সেস · অনুগ্রহ করে আপগ্রেড করুন",req_level_ok:"আপনার লেভেল: {min}–{max} অ্যাক্সেস",req_price:"মূল্য {p} CRTA (ডিপোজিট ব্যালেন্স)",req_active_referral:"{n}টি সক্রিয় রেফারেল",req_normal_referral:"{n}টি সাধারণ রেফারেল",req_watch_ads:"{n}টি বিজ্ঞাপন দেখুন{brk}",
 day_word:"দিন",daily_claimed_lbl:"আজকের রিওয়ার্ড ক্লেইম হয়েছে ✓",daily_connect_claim:"ক্লেইম করতে ওয়ালেট কানেক্ট করুন",daily_claim_plus:"+{a} CRTA ক্লেইম করুন",
 t_need_more_referral:"আপনার আরও {n}টি রেফারেল দরকার",t_need_more_active_referral:"আপনার আরও {n}টি সক্রিয় রেফারেল দরকার",
 t_guest_mode_note:"গেস্ট মোড: ডেটা ডেটাবেসে সেভ হবে না",t_wallet_limit_suffix:" টি ওয়ালেট",t_default_wallet:"ওয়ালেট",t_default_level:"লেভেল",t_default_miner:"মাইনার",t_referral_link_not_setup:"রেফারেল লিংক এখনো সেট করা হয়নি (অ্যাডমিন: বট ইউজারনেম সেট করুন)",t_daily_reward_claimed:"+{a} CRTA ক্লেইম হয়েছে! 🎉",t_task_reward_claimed:"+{a} CRTA ক্লেইম হয়েছে!",t_deposit_request_submitted:"{amt} CRTA ডিপোজিট রিকোয়েস্ট জমা হয়েছে। সম্পন্ন করতে {pay} {unit} পাঠান।",t_req_deposit_balance:"{amt} CRTA ডিপোজিট ব্যালেন্স",t_req_usd_balance:"${amt} USD ব্যালেন্স",t_req_tasks_completed:"{n}টি {label}টাস্ক সম্পন্ন করুন"
}
};
const LANG_NAMES = {en:"English",ru:"Русский",hi:"हिन्दी",ur:"اردو",bn:"বাংলা"};
let currentLang = 'en';
function T(key){
  const d = I18N[currentLang] || I18N.en;
  const v = d && d[key];
  if(v !== undefined) return v;
  const ev = I18N.en[key];
  return ev !== undefined ? ev : key;
}
function setTxt(id,key){ const el=document.getElementById(id); if(el) el.textContent = T(key); }
function setSib(id,key){ const a=document.getElementById(id); if(a && a.nextElementSibling) a.nextElementSibling.textContent = T(key); }
function setLastText(el,key){ if(!el) return; const n=el.lastChild; if(n && n.nodeType===3) n.nodeValue=' '+T(key)+' '; else el.appendChild(document.createTextNode(' '+T(key))); }

function applyStaticTranslations(){
  try{
    document.documentElement.lang = currentLang;
    const nl = document.querySelectorAll('.bottom-nav .nl');
    const navKeys = ['nav_home','nav_task','nav_swap','nav_mining','nav_refer','nav_profile'];
    nl.forEach((el,i)=>{ if(navKeys[i]) el.textContent = T(navKeys[i]); });

    setTxt('language-val', 'lang_'+currentLang);
    const lv = document.getElementById('language-val'); if(lv) lv.textContent = LANG_NAMES[currentLang] || 'English';

    setSib('home-rank','lbl_rank');
    const sectionTitles = Array.from(document.querySelectorAll('.section-title')).filter(el=>!el.hasAttribute('data-static'));
    const stKeys = ['daily_reward','leaderboard','swap_history','miners_title','your_referrals'];
    sectionTitles.forEach((el,i)=>{ if(stKeys[i]) el.textContent = T(stKeys[i]); });
    const agLabel = document.querySelector('#claim-btn .ag-label'); if(agLabel) agLabel.textContent = T('claim_today_reward');

    const taskTabAll = document.querySelector('#task-tabs .task-tab[data-tab="all"]'); if(taskTabAll) taskTabAll.textContent = T('tab_all');

    setTxt('swap-mode-deposit','swap_deposit_to_crta'); setTxt('swap-mode-crpt','swap_crta_to_usd');
    if(typeof refreshSwapUI === 'function' && me) refreshSwapUI();

    const mrLabelSpan = document.querySelector('.mr-label span'); if(mrLabelSpan) mrLabelSpan.textContent = T('mining_mined');

    const heroTitle = document.querySelector('.hero-title'); if(heroTitle) heroTitle.textContent = T('invite_earn');
    const heroSub = document.querySelector('.hero-sub'); if(heroSub) heroSub.textContent = T('earn_commission_sub');
    const ecLabel = document.querySelector('.ec-label'); if(ecLabel) ecLabel.textContent = T('total_earned');
    setSib('refer-total','total_refer'); setSib('refer-active','active_refer'); setSib('refer-commission-rate','commission');
    const lcLabel = document.querySelector('.lc-label'); if(lcLabel) lcLabel.textContent = T('your_referral_link');
    const copyLinkBtn = document.getElementById('copy-link-btn'); if(copyLinkBtn) copyLinkBtn.textContent = T('copy');
    const shareBtns = document.querySelectorAll('.share-row .share-btn');
    if(shareBtns[0]) setLastText(shareBtns[0],'copy_link');
    if(shareBtns[1]) setLastText(shareBtns[1],'share');
    const invL = document.querySelector('.inv-l'); if(invL && invL.firstChild) invL.firstChild.nodeValue = T('joined_with_code')+' ';

    setSib('pf-crpt','profile_earning'); setSib('pf-deposit','profile_deposit_balance'); setSib('pf-usd','profile_usd_withdrawable');
    setSib('pf-total-refer','total_refer'); setSib('pf-active-refer','active_refer'); setSib('pf-total-withdraw','total_withdraw');
    setSib('pf-total-task','total_task'); setSib('pf-total-mining','total_mining'); setSib('pf-total-deposit','total_deposit');
    const quickBtns = document.querySelectorAll('.quick-actions .quick-btn');
    if(quickBtns[0]) setLastText(quickBtns[0],'deposit');
    if(quickBtns[1]) setLastText(quickBtns[1],'withdraw');
    const menuTxts = document.querySelectorAll('#page-profile .menu-txt');
    const menuKeys = ['menu_level','menu_connect_wallet','menu_transactions','menu_telegram_channel','menu_support','menu_language'];
    menuTxts.forEach((el,i)=>{ if(menuKeys[i]) el.textContent = T(menuKeys[i]); });

    document.querySelectorAll('[data-tx-tab]').forEach(btn=>{
      const k = {all:'tx_all',deposit:'tx_deposit',withdraw:'tx_withdraw',task:'tx_task',mining:'tx_mining',refer:'tx_refer',swap:'tx_swap'}[btn.dataset.txTab];
      if(k) btn.textContent = T(k);
    });

    const fsTitles = document.querySelectorAll('.fs-title');
    if(fsTitles[0]) fsTitles[0].textContent = T('deposit_page_title');
    if(fsTitles[1]) fsTitles[1].textContent = T('withdraw_page_title');
    if(fsTitles[2]) setLastText(fsTitles[2],'notifications_title');
    const depLabels = document.querySelectorAll('.deposit-content .deposit-label');
    if(depLabels[0]) depLabels[0].textContent = T('payment_method');
    const amtLbl = document.querySelector('#deposit-amount-section .deposit-label'); if(amtLbl) amtLbl.textContent = T('amount_crta');
    const txidLbl = document.querySelector('#deposit-txid-section .deposit-label'); if(txidLbl){ const req = txidLbl.querySelector('.req'); txidLbl.textContent = T('txid_label')+' '; if(req) txidLbl.appendChild(req); else txidLbl.appendChild(document.createTextNode('*')); }
    const depAgLabel = document.querySelector('#deposit-submit-btn .ag-label'); if(depAgLabel) depAgLabel.textContent = T('confirm_deposit');

    const availLbl = document.querySelector('.avail-card .lbl'); if(availLbl) availLbl.textContent = T('available_balance');
    const connectPrompt = document.getElementById('wd-connect-prompt');
    if(connectPrompt){ const btn = connectPrompt.querySelector('button'); connectPrompt.childNodes[0].nodeValue = T('no_wallet_connected')+' '; if(btn) btn.textContent = T('connect_wallet_btn'); }
    const wdFsLabels = document.querySelectorAll('#page-withdraw .fs-label');
    if(wdFsLabels[0]) wdFsLabels[0].textContent = T('select_method');
    if(wdFsLabels[1]) wdFsLabels[1].textContent = T('amount_label');
    const amtUnit = document.querySelector('#page-withdraw .amount-unit'); if(amtUnit) amtUnit.textContent = T('usd_unit');
    const wdNote = document.querySelector('#page-withdraw .fs-note'); if(wdNote) wdNote.textContent = T('processing_note');
    const wdAgLabel = document.querySelector('#wd-cta .ag-label'); if(wdAgLabel) wdAgLabel.textContent = T('request_withdrawal');
    const swapAgLabel = document.querySelector('#swap-submit-btn .ag-label'); if(swapAgLabel && !me) swapAgLabel.textContent = T('btn_swap');
    const walletSaveAgLabel = document.querySelector('#wallet-save-btn .ag-label'); if(walletSaveAgLabel) walletSaveAgLabel.textContent = T('save_wallet');

    const walletNote = document.getElementById('wallet-method-note'); if(walletNote) walletNote.textContent = T('wallet_method_note');
    const walletLabel = document.getElementById('wallet-method-label'); if(walletLabel) walletLabel.textContent = T('choose_method');
    const walletAddrInput = document.getElementById('wallet-address-input'); if(walletAddrInput) walletAddrInput.placeholder = T('wallet_address_placeholder');
    const walletWarn = document.querySelector('#wallet-address-block .fs-note.warn'); if(walletWarn) walletWarn.textContent = T('wallet_warn_note');

    const claimHint = document.querySelector('.claim-hint'); if(claimHint) claimHint.textContent = T('ads_watched');
    const claimNote = document.querySelector('.claim-note'); if(claimNote) claimNote.textContent = T('claim_note');

    const socialTitle = document.getElementById('social-sheet-title'); if(socialTitle) socialTitle.textContent = T('submit_proof_title');
    const socialFsLabel = document.querySelector('#sheet-social .fs-label'); if(socialFsLabel) socialFsLabel.textContent = T('screenshot_label');
    const uploadSpan = document.querySelector('#social-upload span'); if(uploadSpan) uploadSpan.textContent = T('upload_hint');
    const socialSubmitBtn = document.getElementById('social-submit-btn'); if(socialSubmitBtn) socialSubmitBtn.textContent = T('submit_btn');

    const accountTitle = document.getElementById('account-sheet-title'); if(accountTitle) accountTitle.textContent = T('create_account_title');
    const passLbl = document.querySelector('#account-pass-wrap .fs-label'); if(passLbl) passLbl.textContent = T('password_label');
    const emailLbl = document.querySelector('#account-email-wrap .fs-label'); if(emailLbl) emailLbl.textContent = T('your_email_label');

    const notifTitle = document.querySelector('#page-notifications .fs-title'); if(notifTitle) setLastText(notifTitle,'notifications_title');

    const loadingText = document.querySelector('.loading-text'); if(loadingText){ const dots = loadingText.querySelectorAll('.d'); loadingText.childNodes[0].nodeValue = T('loading_text'); }
    const slowText = document.getElementById('loading-slow'); if(slowText) slowText.textContent = T('slow_connection');
    const bannedTitle = document.querySelector('.banned-title'); if(bannedTitle) bannedTitle.textContent = T('account_suspended_title');
    const bannedSub = document.querySelector('.banned-sub'); if(bannedSub) bannedSub.textContent = T('account_suspended_sub');

    const langSheetTitle = document.querySelector('#sheet-language .sheet-title'); if(langSheetTitle) langSheetTitle.textContent = T('language_title');

    if(typeof renderNotifPanel === 'function' && document.getElementById('notif-list')) renderNotifPanel();
    if(typeof renderWalletMethodList === 'function' && me) renderWalletMethodList();
    if(typeof renderWithdrawPage === 'function' && me && document.getElementById('wd-method-list')) renderWithdrawPage();
    if(typeof renderTasks === 'function' && me && document.getElementById('task-list')) renderTasks();
    if(typeof renderMinersList === 'function' && me && document.getElementById('miner-list')) renderMinersList();
    if(typeof renderStreak === 'function' && me && document.getElementById('streak-grid')) renderStreak();
  }catch(e){ console.error('i18n apply error', e); }
}
function openLanguageSheet(){
  document.querySelectorAll('#language-list .lang-item').forEach(el=>{
    el.classList.toggle('selected', el.dataset.lang === currentLang);
  });
  document.getElementById('sheet-language').classList.add('active');
}
function closeLanguageSheet(){
  document.getElementById('sheet-language').classList.remove('active');
}
function selectLanguage(code){
  if(!I18N[code]) return;
  currentLang = code;
  try{ localStorage.setItem('cryptena_lang', code); }catch(e){}
  document.querySelectorAll('#language-list .lang-item').forEach(el=>{
    el.classList.toggle('selected', el.dataset.lang === code);
  });
  applyStaticTranslations();
  closeLanguageSheet();
}
function initLanguage(){
  let saved = null;
  try{ saved = localStorage.getItem('cryptena_lang'); }catch(e){}
  currentLang = (saved && I18N[saved]) ? saved : 'en';
  applyStaticTranslations();
}

function TT(msg){
  try{
    if(typeof msg !== 'string') return msg;
    const en = I18N.en;
    const exactMap = {};
    Object.keys(en).forEach(k=>{ if(k.indexOf('t_')===0) exactMap[en[k]] = k; });
    if(exactMap[msg]) return T(exactMap[msg]);

    if(msg.indexOf('Connect a wallet first to ') === 0){
      return T('t_connect_wallet_first') + msg.slice('Connect a wallet first to '.length);
    }
    let m = msg.match(/^Your level allows connecting up to (\d+) wallet(s?) only$/);
    if(m) return T('t_wallet_limit') + m[1] + (currentLang==='en' ? (' wallet'+(m[1]==='1'?'':'s')+' only') : '');
    m = msg.match(/^Minimum deposit is (.+)$/); if(m) return T('t_min_deposit')+m[1];
    m = msg.match(/^Maximum deposit is (.+)$/); if(m) return T('t_max_deposit')+m[1];
    m = msg.match(/^Minimum amount is \$(.+)$/); if(m) return T('t_min_amount')+m[1];
    m = msg.match(/^Maximum amount is \$(.+)$/); if(m) return T('t_max_amount')+m[1];
    m = msg.match(/^Requires (.+)$/); if(m) return T('t_requires')+m[1];
    m = msg.match(/^Claimed ([\d.]+) CRTA!$/); if(m) return T('t_claimed_amount').replace('{a}', m[1]);
    m = msg.match(/^\+([\d.]+) CRTA claimed! 🎉$/); if(m) return '+'+m[1]+' CRTA '+T('t_reward_claimed');
    m = msg.match(/^\+([\d.]+) CRTA claimed!$/); if(m) return '+'+m[1]+' CRTA '+T('t_reward_claimed');
    m = msg.match(/^(.+) connected!$/); if(m) return m[1]+T('t_connected_suffix');
    m = msg.match(/^(.+) unlocked! Tap Select to wear it\.$/); if(m) return m[1]+T('t_unlocked_wear_suffix');
    m = msg.match(/^(.+) unlocked!$/); if(m) return m[1]+T('t_unlocked_suffix');
    m = msg.match(/^(.+) is now your active level!$/); if(m) return m[1]+T('t_active_level_suffix');
    m = msg.match(/^(.+) selected$/); if(m) return m[1]+T('t_selected_suffix');
    if(msg === 'Link not available yet') return T('t_link_not_available');
    m = msg.match(/^Swapped to \$?([\d.]+) (CRTA|USD)$/); if(m) return T('t_swapped_to')+(msg.indexOf('$')>=0?'$':'')+m[1]+' '+m[2];
    if(msg.indexOf('Referral link is not set up yet') === 0) return msg;
    return msg;
  }catch(e){ return msg; }
}

/* ---------------- INIT ---------------- */
initLanguage();
boot();