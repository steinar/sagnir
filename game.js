(() => {
'use strict';

// ---------- Gögn og hjálparföll ----------
const asList = x => Array.isArray(x) ? x : [x];
const PLAYERS = window.PLAYERS || { styrmir: { name: 'Styrmir', hero: '🧙', verbs: window.VERBS || [] } };
const prepVerbs = list => list.map(v => ({ ...v, id: v.inf, past: asList(v.past), pp: asList(v.pp) }));
let playerId = null, VERBS = [];
const FORM_NAME = { inf: 'Infinitive', past: 'Past Simple', pp: 'Past Participle' };
const FORM_IS = { past: 'þátíð', pp: 'lýsingarhætti þátíðar' };

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const norm = s => String(s).toLowerCase().trim().replace(/\s+/g, ' ');
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = a => a[Math.floor(Math.random() * a.length)];
const fmt = arr => arr.join(' / ');
const rowText = v => `${v.inf} – ${fmt(v.past)} – ${fmt(v.pp)}`;
const sayRow = v => `${v.inf}, ${v.past[0]}, ${v.pp[0]}`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const speakBtn = text => `<button class="say" data-say="${esc(text)}" title="Hlusta">🔊</button>`;
const isAnswer = (list, val) => list.map(norm).includes(norm(val));

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++)
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[a.length][b.length];
}

// ---------- Vistun ----------
const STORE_KEY = 'sagnaturninn-v1';
const storeGet = k => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return null; } };
const storeSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
const blankSave = () => ({ xp: 0, best: 0, wins: 0, m: {} });
let save = blankSave();
let muted = !!storeGet(STORE_KEY + '-muted');
// Vistun frá því áður en leikmenn komu til tilheyrir Styrmi
(() => {
  const old = storeGet(STORE_KEY);
  if (old && !storeGet(STORE_KEY + '-styrmir')) { if (old.muted) muted = true; delete old.muted; storeSet(STORE_KEY + '-styrmir', old); }
})();
const persist = () => { if (playerId) storeSet(STORE_KEY + '-' + playerId, save); };
function loadPlayer(id) {
  playerId = id;
  const p = PLAYERS[id];
  VERBS = prepVerbs(p.verbs);
  save = Object.assign(blankSave(), storeGet(STORE_KEY + '-' + id) || {});
  $('#wizard').textContent = p.hero || '🧙';
}
const mastery = id => save.m[id] || (save.m[id] = { past: 0, pp: 0 });
const stars = id => { const m = mastery(id); return Math.min(3, Math.floor((m.past + m.pp) / 3)); };

// ---------- Hljóð ----------
let actx = null;
function tone(freq, dur = .12, type = 'sine', vol = .15, when = 0) {
  if (muted) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const t = actx.currentTime + when, o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur);
    o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + .02);
  } catch (e) {}
}
const sfx = {
  good() { tone(660, .1, 'triangle'); tone(880, .1, 'triangle', .15, .08); tone(1320, .2, 'triangle', .12, .16); },
  bad() { tone(220, .25, 'sawtooth', .1); tone(150, .35, 'sawtooth', .1, .12); },
  click() { tone(520, .05, 'square', .04); },
  boom() { tone(110, .3, 'square', .08); tone(70, .4, 'sawtooth', .07, .05); },
  heal() { [523, 784, 1047].forEach((f, i) => tone(f, .15, 'sine', .12, i * .08)); },
  win() { [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, .2, 'triangle', .14, i * .13)); },
  lose() { [392, 349, 311, 233].forEach((f, i) => tone(f, .3, 'sawtooth', .08, i * .2)); },
};
function speak(text, force) {
  if (muted && !force) return;
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'en-GB'; u.rate = .85;
    const voices = speechSynthesis.getVoices();
    const v = voices.find(v => /^en[-_]GB/i.test(v.lang)) || voices.find(v => /^en/i.test(v.lang));
    if (v) u.voice = v;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  } catch (e) {}
}
function renderMute() { $('#muteBtn').textContent = muted ? '🔇' : '🔊'; }
$('#muteBtn').addEventListener('click', () => {
  muted = !muted; storeSet(STORE_KEY + '-muted', muted); renderMute();
  try { if (muted) speechSynthesis.cancel(); } catch (e) {}
  sfx.click();
});

// ---------- Skjáir ----------
function showScreen(id) { $$('.screen').forEach(s => s.classList.toggle('active', s.id === id)); window.scrollTo(0, 0); }
const isActive = id => $('#' + id).classList.contains('active');
function go(where) {
  if (where !== 'battle') run = null;
  if (where === 'who' || !playerId) return renderWho();
  if (where === 'battle') startRun();
  else if (where === 'cards') startCards();
  else if (where === 'book') renderBook();
  else renderMenu();
}
document.addEventListener('click', e => {
  const s = e.target.closest('[data-say]');
  if (s) { e.preventDefault(); e.stopPropagation(); speak(s.dataset.say, true); return; }
  const pl = e.target.closest('[data-player]');
  if (pl) { sfx.click(); loadPlayer(pl.dataset.player); renderMenu(); return; }
  const g = e.target.closest('[data-go]');
  if (g) { sfx.click(); go(g.dataset.go); }
});

function renderWho() {
  $('#whoList').innerHTML = Object.entries(PLAYERS).map(([id, p]) => {
    const st = storeGet(STORE_KEY + '-' + id) || {};
    return `<button class="who-card" data-player="${esc(id)}"><span class="who-hero">${p.hero || '🧙'}</span>` +
      `<b>${esc(p.name)}</b><small>${p.verbs.length} sagnir · ${st.xp || 0} XP · 🐉 ${st.wins || 0}</small></button>`;
  }).join('');
  showScreen('who');
}

function renderMenu() {
  const p = PLAYERS[playerId];
  $('#hello').innerHTML = `Hæ <b>${esc(p.name)}</b>! ${p.hero || '🧙'} Í dag lærir þú <b>${VERBS.length} sagnir</b>.`;
  const mastered = VERBS.filter(v => stars(v.id) === 3).length;
  $('#menuStats').innerHTML =
    `<div class="stat"><b>${save.xp}</b><span>XP samtals</span></div>` +
    `<div class="stat"><b>${save.wins}</b><span>Drekar sigraðir</span></div>` +
    `<div class="stat"><b>${mastered}/${VERBS.length}</b><span>Sagnir fullnumdar ⭐⭐⭐</span></div>`;
  showScreen('menu');
}

// ---------- Effektar ----------
function banner(title, text) {
  const b = el('div', 'banner', `<h2>${title}</h2>${text ? `<p>${text}</p>` : ''}`);
  document.body.append(b); setTimeout(() => b.remove(), 2000);
}
function feedback(html, kind) { const f = $('#feedback'); f.className = 'fb ' + kind; f.innerHTML = html; }
function restartAnim(node, cls) { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); }
function floatText(t) { const f = el('div', 'float', t); $('#arena').append(f); setTimeout(() => f.remove(), 1100); }
function sparks() {
  const a = $('#arena'), r = a.getBoundingClientRect(), m = $('#monster').getBoundingClientRect();
  const cx = m.left - r.left + m.width / 2, cy = m.top - r.top + m.height / 2;
  for (let i = 0; i < 14; i++) {
    const s = el('div', 'spark', pick(['✨', '⭐', '💥', '🌟']));
    const ang = Math.random() * Math.PI * 2, dist = 50 + Math.random() * 70;
    s.style.left = cx + 'px'; s.style.top = cy + 'px';
    s.style.setProperty('--dx', Math.cos(ang) * dist + 'px'); s.style.setProperty('--dy', Math.sin(ang) * dist + 'px');
    a.append(s); setTimeout(() => s.remove(), 850);
  }
}
function confetti() {
  const colors = ['#ffd34d', '#ec4899', '#a855f7', '#4ade80', '#7dd3fc', '#ff9f43'];
  for (let i = 0; i < 120; i++) {
    const c = el('div', 'confetti');
    c.style.left = Math.random() * 100 + 'vw'; c.style.background = pick(colors);
    c.style.animationDuration = 2.5 + Math.random() * 2.5 + 's'; c.style.animationDelay = Math.random() * 1.2 + 's';
    document.body.append(c); setTimeout(() => c.remove(), 6500);
  }
}
async function castSpell(big, kill) {
  const f = el('div', 'fireball' + (big ? ' big' : ''), big ? '☄️' : '🔥');
  $('#arena').append(f); restartAnim($('#wizard'), 'cast');
  await wait(450); f.remove(); sfx.boom(); sparks();
  const mon = $('#monster'); mon.classList.remove('appear', 'hit', 'attack');
  restartAnim(mon, kill ? 'dead' : 'hit');
}
async function monsterAttack(isBoss) {
  const mon = $('#monster'); mon.classList.remove('appear', 'hit');
  restartAnim(mon, 'attack');
  if (isBoss) { const b = el('div', 'breath', '🔥'); $('#arena').append(b); setTimeout(() => b.remove(), 500); }
  await wait(250);
  restartAnim($('#arena'), 'shake'); restartAnim($('#hearts'), 'flash');
}

// ---------- Skrímsli ----------
const MONSTERS = [
  { e: '🦇', n: 'Leðurblakan Lalli' }, { e: '👻', n: 'Draugurinn Dóri' }, { e: '🕷️', n: 'Kóngulóin Kata' },
  { e: '🧟', n: 'Uppvakningurinn Úlfar' }, { e: '👺', n: 'Púkinn Palli' }, { e: '🐺', n: 'Varúlfurinn Valdi' },
  { e: '🦂', n: 'Sporðdrekinn Siggi' }, { e: '👹', n: 'Tröllið Trausti' }, { e: '🐍', n: 'Snákurinn Snorri' },
  { e: '💀', n: 'Beinagrindin Begga' }, { e: '🦖', n: 'Risaeðlan Rúna' }, { e: '🧌', n: 'Jötuninn Jói' },
  { e: '🐙', n: 'Kolkrabbinn Kalli' }, { e: '🤖', n: 'Vélmennið Vala' },
];
const BOSS = { e: '🐉', n: 'Sagnadrekinn ógurlegi' };
const PRAISE = ['Frábært! 🔥', 'Snilld! ⚡', 'Rétt! 🎯', 'Vel gert! 💥', 'Galdrar! ✨', 'Kraftmikið! 💪', 'Ótrúlegt! 🌟', 'Bang! 💫'];

// ---------- Bardagi ----------
const FLOORS = 4, MAX_HEARTS = 5, BOSS_HP = 3;
let PER_FLOOR = 3;
let run = null;
const curFloor = () => Math.min(FLOORS, Math.floor(run.step / PER_FLOOR) + 1);
const multiplier = () => run.combo >= 6 ? 3 : run.combo >= 3 ? 2 : 1;

function startRun() {
  PER_FLOOR = VERBS.length > 20 ? 4 : 3;
  run = {
    hearts: MAX_HEARTS, xp: 0, combo: 0, bestCombo: 0, step: 0, total: FLOORS * PER_FLOOR,
    retry: [], recent: [], seen: new Set(), missed: new Set(), correct: 0, wrong: 0,
    boss: false, bossHp: BOSS_HP, bossQueue: [], monsters: shuffle(MONSTERS), q: null, busy: false,
  };
  showScreen('battle');
  $('#monster').className = 'fighter';
  renderHud(); nextEncounter();
}

function renderHud() {
  if (!run) return;
  let h = '';
  for (let i = 0; i < MAX_HEARTS; i++) h += i < run.hearts ? '❤️' : '<span class="lost">🖤</span>';
  $('#hearts').innerHTML = h;
  $('#floorLabel').textContent = run.boss ? '🏰 Turntoppurinn' : `Hæð ${curFloor()} af ${FLOORS}`;
  $('#xpLabel').textContent = `⭐ ${run.xp} XP`;
  let p = '';
  for (let i = 0; i < run.total; i++) {
    if (i && i % PER_FLOOR === 0) p += '<span class="sep"></span>';
    p += `<span class="dot ${i < run.step ? 'done' : (i === run.step && !run.boss ? 'now' : '')}"></span>`;
  }
  p += '<span class="sep"></span><span class="dot boss">🐉</span>';
  $('#path').innerHTML = p;
  $('#bossHp').innerHTML = run.boss ? `<div class="hpbar"><div style="width:${run.bossHp / BOSS_HP * 100}%"></div></div>` : '';
  $('#combo').textContent = run.combo >= 3 ? `🔥 Combo ${run.combo}  ×${multiplier()}` : '';
}

function setMonster(m) {
  const mon = $('#monster');
  mon.className = 'fighter'; mon.textContent = m.e; void mon.offsetWidth; mon.classList.add('appear');
  $('#monsterName').textContent = m.n;
}

function nextEncounter() {
  if (!run || !isActive('battle')) return;
  if (run.hearts <= 0) return endRun(false);
  if (run.boss) return run.bossHp <= 0 ? endRun(true) : bossQuestion();
  if (run.step >= run.total) return bossIntro();
  if (run.step % PER_FLOOR === 0) {
    const f = curFloor();
    if (f === 1) banner('Hæð 1', 'Skrímslin bíða... 👀');
    else if (run.hearts < MAX_HEARTS) { run.hearts++; sfx.heal(); banner(`Hæð ${f}`, 'Þú fannst töfradrykk! +1 ❤️'); }
    else banner(`Hæð ${f}`, 'Lengra upp í turninn! 🧗');
    renderHud();
  }
  setMonster(run.monsters[run.step % run.monsters.length]);
  askQuestion(makeQuestion());
}

function chooseItem() {
  if (run.retry.length && (Math.random() < .6 || run.step >= run.total - 3)) return run.retry.shift();
  let pool = VERBS.filter(v => !run.recent.includes(v.id));
  if (!pool.length) pool = VERBS.slice();
  const w = pool.map(v => { const m = mastery(v.id); return 1 + (10 - m.past - m.pp) + (run.seen.has(v.id) ? 0 : 6); });
  let r = Math.random() * w.reduce((a, b) => a + b, 0), v = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) { r -= w[i]; if (r <= 0) { v = pool[i]; break; } }
  const m = mastery(v.id);
  let form = m.past === m.pp ? (Math.random() < .5 ? 'past' : 'pp') : (m.past < m.pp ? 'past' : 'pp');
  if (Math.random() < .25) form = form === 'past' ? 'pp' : 'past';
  return { v, form };
}

function makeQuestion() {
  const { v, form } = chooseItem();
  run.recent.push(v.id);
  if (run.recent.length > Math.min(4, VERBS.length - 1)) run.recent.shift();
  run.seen.add(v.id);
  const level = mastery(v.id)[form];
  const typed = Math.random() < Math.min(.85, .1 + level * .18 + (curFloor() - 1) * .12);
  const s = v[form === 'past' ? 'sPast' : 'sPp'];
  const sentence = s && s.includes('___') && Math.random() < .45 ? s : null;
  return { v, form, typed, sentence, hintLevel: 0, hinted: false, graceUsed: false, mustRetype: false };
}

function distractors(v, form) {
  const bad = new Set(v[form].map(norm));
  const other = form === 'past' ? v.pp : v.past;
  const spec = shuffle(v[form === 'past' ? 'wrongPast' : 'wrongPp'] || []);
  const ed = /e$/.test(v.inf) ? v.inf + 'd' : v.inf + 'ed';
  const auto = shuffle([ed, v.inf, v.inf + 's']);
  const fallback = shuffle(VERBS.filter(x => x !== v).map(x => x[form][0]));
  const out = [];
  for (const c of [...shuffle(other), ...spec, ...auto, ...fallback]) {
    const n = norm(c);
    if (!bad.has(n) && !out.some(o => norm(o) === n)) out.push(c);
    if (out.length === 3) break;
  }
  return out;
}

function askQuestion(q) {
  run.q = q; run.busy = false;
  const { v, form, sentence } = q;
  const tag = `<span class="form-tag ${form}">${FORM_NAME[form]}</span>`;
  if (sentence) {
    const s = esc(sentence).replace('___', '<span class="blank" id="blank">?</span>');
    $('#qPrompt').innerHTML =
      `<div class="q-small">Fylltu í eyðuna – notaðu ${tag}</div>` +
      `<div class="sentence">${s} <span class="hint-verb">(${esc(v.inf)})</span></div>` +
      `<div class="q-is">${esc(v.inf)} = ${esc(v.is)} ${speakBtn(v.inf)}</div>`;
  } else {
    $('#qPrompt').innerHTML =
      `<div class="q-small">Hvað er ${tag} af</div>` +
      `<div class="q-verb">${esc(v.inf)} ${speakBtn(v.inf)}</div>` +
      `<div class="q-is">${esc(v.is)}</div>`;
  }
  feedback('', '');
  const area = $('#qArea'); area.innerHTML = '';
  if (q.typed) {
    const wrap = el('div', 'type-row');
    const input = el('input', 'answer');
    Object.assign(input, { type: 'text', id: 'answerInput', autocomplete: 'off', spellcheck: false, placeholder: 'Skrifaðu svarið...' });
    input.setAttribute('autocapitalize', 'off'); input.setAttribute('autocorrect', 'off');
    const btn = el('button', 'btn primary', 'Galdra! ✨');
    const hint = el('button', 'btn ghost', '💡 Vísbending');
    const submit = () => { if (!run.busy) checkTyped(input.value); };
    btn.onclick = submit;
    input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
    hint.onclick = () => {
      const ans = v[form][0];
      if (q.mustRetype || q.hintLevel >= ans.length - 1) return;
      q.hintLevel++; q.hinted = true;
      input.value = ans.slice(0, q.hintLevel); input.focus();
      feedback(`💡 Svarið byrjar á <b>${esc(ans.slice(0, q.hintLevel))}</b>… (hálf XP)`, 'info');
    };
    wrap.append(input, btn); area.append(wrap, hint);
    setTimeout(() => input.focus(), 60);
  } else {
    const opts = shuffle([v[form][0], ...distractors(v, form)]);
    const grid = el('div', 'options');
    opts.forEach((o, i) => {
      const b = el('button', 'opt', `<span class="key">${i + 1}</span>${esc(o)}`);
      b.dataset.val = o;
      b.onclick = () => { if (!run.busy) checkMC(o, b); };
      grid.append(b);
    });
    area.append(grid);
  }
}

function checkMC(val, btn) {
  const q = run.q; run.busy = true;
  $$('.opt').forEach(b => { b.disabled = true; if (isAnswer(q.v[q.form], b.dataset.val)) b.classList.add('right'); });
  if (isAnswer(q.v[q.form], val)) onCorrect();
  else { btn.classList.add('wrong'); onWrong(true); }
}

function checkTyped(raw) {
  const q = run.q, ans = norm(raw), input = $('#answerInput');
  if (!ans) return;
  const correct = q.v[q.form];
  if (q.mustRetype) {
    if (isAnswer(correct, ans)) {
      run.busy = true; input.classList.add('ok'); input.disabled = true;
      feedback('Flott! Nú manstu þetta betur. 💪', 'info');
      const r = run; setTimeout(() => nextAfterWrong(r), 900);
    } else { restartAnim(input, 'shake'); feedback(`Skrifaðu nákvæmlega: <b>${esc(correct[0])}</b>`, 'bad'); input.select(); }
    return;
  }
  if (isAnswer(correct, ans)) { run.busy = true; input.classList.add('ok'); input.disabled = true; return onCorrect(); }
  // Ein mild aukatilraun ef barnið er nálægt réttu svari
  if (!q.graceUsed) {
    const otherKey = q.form === 'past' ? 'pp' : 'past';
    let msg = null;
    if (isAnswer(q.v[otherKey], ans)) msg = `Hmm, <b>${esc(raw.trim())}</b> er ${FORM_NAME[otherKey]}! Hér vantar ${FORM_NAME[q.form]}. Reyndu aftur 🤔`;
    else if (norm(q.v.inf) === ans) msg = `Þetta er nafnhátturinn. Hvernig er sögnin í ${FORM_IS[q.form]}? 🤔`;
    else if (correct.some(c => c.length > 3 && lev(norm(c), ans) === 1)) msg = 'Næstum því! Athugaðu stafsetninguna. 🔍';
    if (msg) { q.graceUsed = true; restartAnim(input, 'shake'); feedback(msg, 'warn'); input.select(); return; }
  }
  run.busy = true; input.classList.add('bad'); onWrong(false);
}

async function onCorrect() {
  const r = run, q = r.q, m = mastery(q.v.id);
  m[q.form] = Math.min(5, m[q.form] + (q.typed && !q.hinted ? 2 : 1));
  r.correct++; r.combo++; r.bestCombo = Math.max(r.bestCombo, r.combo);
  let gain = (q.typed ? 15 : 10) * multiplier();
  if (q.hinted) gain = Math.ceil(gain / 2);
  r.xp += gain; save.xp += gain; persist();
  if (q.sentence && $('#blank')) { $('#blank').textContent = q.v[q.form][0]; $('#blank').classList.add('filled'); }
  feedback(`${pick(PRAISE)}<span class="row">${esc(rowText(q.v))}</span>`, 'good');
  sfx.good(); speak(sayRow(q.v));
  renderHud();
  if (r.combo >= 3) restartAnim($('#combo'), 'pop');
  await castSpell(false, true);
  if (run !== r) return;
  floatText(`+${gain} XP`);
  r.step++; renderHud();
  await wait(1300);
  if (run === r) nextEncounter();
}

async function onWrong(isMC) {
  const r = run, q = r.q, m = mastery(q.v.id);
  m[q.form] = Math.max(0, m[q.form] - 2); persist();
  r.wrong++; r.combo = 0; r.missed.add(q.v.id);
  r.retry.push({ v: q.v, form: q.form });
  r.hearts--; renderHud();
  sfx.bad(); monsterAttack(false);
  if (q.sentence && $('#blank')) { $('#blank').textContent = q.v[q.form][0]; $('#blank').classList.add('reveal'); }
  feedback(`Æjæ! Rétt svar er <b>${esc(fmt(q.v[q.form]))}</b><span class="row">${esc(rowText(q.v))}</span>`, 'bad');
  speak(sayRow(q.v));
  if (r.hearts <= 0) { await wait(2200); if (run === r) endRun(false); return; }
  if (isMC) {
    const b = el('button', 'btn primary next', 'Áfram ➜');
    b.onclick = () => nextAfterWrong(r);
    $('#qArea').append(b); setTimeout(() => b.focus(), 50);
  } else {
    q.mustRetype = true;
    const input = $('#answerInput');
    $('#feedback').insertAdjacentHTML('beforeend', '<div class="q-small">✍️ Skrifaðu rétta svarið til að halda áfram</div>');
    setTimeout(() => {
      if (run !== r) return;
      input.classList.remove('bad'); input.value = '';
      input.placeholder = `Skrifaðu: ${q.v[q.form][0]}`;
      r.busy = false; input.focus();
    }, 700);
  }
}

function nextAfterWrong(r) {
  if (run !== r) return;
  r.busy = true;
  restartAnim($('#monster'), 'flee');
  feedback('Skrímslið slapp... en það kemur aftur! 👀', 'info');
  r.step++; renderHud();
  setTimeout(() => { if (run === r) nextEncounter(); }, 700);
}

// ---------- Drekinn ----------
function bossIntro() {
  const r = run;
  r.boss = true; r.bossHp = BOSS_HP;
  const missed = shuffle([...r.missed]).map(id => VERBS.find(v => v.id === id));
  const rest = shuffle(VERBS.filter(v => !r.missed.has(v.id))).sort((a, b) => {
    const ma = mastery(a.id), mb = mastery(b.id); return (ma.past + ma.pp) - (mb.past + mb.pp);
  });
  r.bossQueue = [...missed, ...rest];
  setMonster(BOSS); $('#monster').classList.add('boss');
  $('#qPrompt').innerHTML = ''; $('#qArea').innerHTML = ''; feedback('', '');
  renderHud();
  banner('🐉 SAGNADREKINN!', 'Skrifaðu allar þrjár myndir sagnarinnar til að særa hann!');
  tone(90, .8, 'sawtooth', .12); tone(60, 1, 'square', .08, .3);
  setTimeout(() => { if (run === r) bossQuestion(); }, 2000);
}

function bossQuestion() {
  if (!run.bossQueue.length) run.bossQueue = shuffle(VERBS);
  const v = run.bossQueue.shift();
  run.q = { v, boss: true }; run.busy = false;
  const mon = $('#monster'); mon.className = 'fighter boss';
  $('#qPrompt').innerHTML =
    `<div class="q-small">Drekinn öskrar: „Hvernig beygist...“</div>` +
    `<div class="q-verb">${esc(v.is)}</div>` +
    `<div class="q-small">Skrifaðu allar þrjár myndirnar á ensku!</div>`;
  feedback('', '');
  const area = $('#qArea'); area.innerHTML = '';
  const grid = el('div', 'boss-grid');
  const attack = () => { if (!run.busy) checkBoss(inputs); };
  const inputs = ['inf', 'past', 'pp'].map((k, i) => {
    const lab = el('label', '', `<span class="form-tag ${k}">${FORM_NAME[k]}</span>`);
    const inp = el('input', 'answer');
    Object.assign(inp, { type: 'text', autocomplete: 'off', spellcheck: false });
    inp.setAttribute('autocapitalize', 'off'); inp.setAttribute('autocorrect', 'off');
    inp.addEventListener('keydown', e => {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i < 2) inputs[i + 1].focus(); else attack();
    });
    lab.append(inp); grid.append(lab); return inp;
  });
  const btn = el('button', 'btn primary', 'Ráðast á drekann! ⚔️');
  btn.onclick = attack;
  area.append(grid, btn);
  setTimeout(() => inputs[0].focus(), 60);
}

async function checkBoss(inputs) {
  const r = run, v = r.q.v, vals = inputs.map(i => norm(i.value));
  if (!vals.every(Boolean)) { feedback('Fylltu í alla þrjá reitina! ✍️', 'warn'); return; }
  const ok = [norm(v.inf) === vals[0], isAnswer(v.past, vals[1]), isAnswer(v.pp, vals[2])];
  inputs.forEach((inp, i) => { inp.classList.add(ok[i] ? 'ok' : 'bad'); inp.disabled = true; });
  r.busy = true;
  const m = mastery(v.id);
  if (ok.every(Boolean)) {
    m.past = Math.min(5, m.past + 1); m.pp = Math.min(5, m.pp + 1);
    r.combo++; r.correct++; r.bestCombo = Math.max(r.bestCombo, r.combo);
    const gain = 40 * multiplier(); r.xp += gain; save.xp += gain; persist();
    r.bossHp--;
    feedback(`${pick(PRAISE)} Drekinn öskrar af sársauka!<span class="row">${esc(rowText(v))}</span>`, 'good');
    sfx.good(); speak(sayRow(v));
    renderHud();
    await castSpell(true, r.bossHp <= 0);
    if (run !== r) return;
    floatText(`+${gain} XP`);
    await wait(1600);
    if (run === r) nextEncounter();
  } else {
    if (!ok[1]) m.past = Math.max(0, m.past - 2);
    if (!ok[2]) m.pp = Math.max(0, m.pp - 2);
    persist();
    r.wrong++; r.combo = 0; r.missed.add(v.id); r.hearts--;
    r.bossQueue.splice(Math.min(2, r.bossQueue.length), 0, v);
    renderHud(); sfx.bad(); monsterAttack(true);
    feedback(`Drekinn spúði eldi! 🔥 Rétt er:<span class="row">${esc(rowText(v))}</span>`, 'bad');
    speak(sayRow(v));
    if (r.hearts <= 0) { await wait(2200); if (run === r) endRun(false); return; }
    const b = el('button', 'btn primary next', 'Áfram ➜');
    b.onclick = () => { if (run === r) nextEncounter(); };
    $('#qArea').append(b); setTimeout(() => b.focus(), 50);
  }
}

// ---------- Lok ----------
function endRun(win) {
  const r = run; if (!r) return;
  run = null;
  if (win) { save.wins++; sfx.win(); confetti(); } else sfx.lose();
  save.best = Math.max(save.best, r.xp); persist();
  const starsN = win ? (r.hearts >= 4 ? 3 : r.hearts >= 2 ? 2 : 1) : 0;
  const missed = [...r.missed].map(id => VERBS.find(v => v.id === id));
  $('#endContent').innerHTML = `
    <div class="end-emoji">${win ? '🏆' : '🐉'}</div>
    <h2>${win ? 'Þú sigraðir Sagnadrekann!' : 'Skrímslin unnu í þetta sinn...'}</h2>
    ${win ? `<div class="big-stars">${'★'.repeat(starsN)}${'☆'.repeat(3 - starsN)}</div>`
          : '<p class="sub">En hver tilraun gerir þig sterkari. Reyndu aftur! 💪</p>'}
    <div class="stats">
      <div class="stat"><b>${r.xp}</b><span>XP</span></div>
      <div class="stat"><b>${r.correct}</b><span>Rétt svör</span></div>
      <div class="stat"><b>${r.bestCombo}</b><span>Lengsta combo</span></div>
    </div>
    ${missed.length
      ? `<h3>Sagnir til að æfa betur</h3><div class="miss-list">${missed.map(v =>
          `<div class="miss">${speakBtn(sayRow(v))} <b>${esc(v.inf)}</b> – ${esc(fmt(v.past))} – ${esc(fmt(v.pp))} <i>${esc(v.is)}</i></div>`).join('')}</div>`
      : '<p class="perfect">Engin mistök! Þú ert algjör sagnameistari! 🧙✨</p>'}
    <div class="menu-buttons">
      <button class="big-btn primary" data-go="battle">⚔️ Aftur í turninn</button>
      <button class="big-btn" data-go="cards">🃏 Æfa með spjöldum</button>
      <button class="big-btn" data-go="menu">🏠 Valmynd</button>
    </div>`;
  showScreen('end');
}

// ---------- Æfingaspjöld ----------
let deck = [], card = null;
const fillSentence = (s, w) => esc(s).replace('___', `<u>${esc(w)}</u>`);
function startCards() { deck = shuffle(VERBS); showScreen('cards'); drawCard(); }
function drawCard() {
  $('#cardControls').hidden = true;
  if (!deck.length) {
    $('#cardsLeft').textContent = '';
    $('#cardStage').innerHTML = `<div class="done-cards">🎉<h2>Þú fórst í gegnum öll spjöldin!</h2>
      <button class="big-btn primary" data-go="battle">⚔️ Prófaðu þig í turninum</button>
      <button class="big-btn" data-go="cards">🔁 Aftur</button></div>`;
    return;
  }
  card = deck[0];
  $('#cardsLeft').textContent = `${deck.length} ${deck.length === 1 ? 'spjald' : 'spjöld'} eftir`;
  $('#cardStage').innerHTML = `<div class="card" id="card"><div class="card-inner">
    <div class="card-face front">
      <div class="c-is">${esc(card.is)}</div>
      <div class="c-inf">${esc(card.inf)}</div>
      <div class="c-tap">Manstu þátíðina og lýsingarháttinn?<br>Smelltu til að snúa spjaldinu 👆</div>
    </div>
    <div class="card-face back">
      <div class="forms">
        <div><small>Infinitive</small><b>${esc(card.inf)}</b></div>
        <div><small>Past Simple</small><b>${esc(fmt(card.past))}</b></div>
        <div><small>Past Participle</small><b>${esc(fmt(card.pp))}</b></div>
      </div>
      ${card.sPast ? `<p class="ex">${fillSentence(card.sPast, card.past[0])}</p>` : ''}
      ${card.sPp ? `<p class="ex">${fillSentence(card.sPp, card.pp[0])}</p>` : ''}
      ${speakBtn(sayRow(card))}
    </div></div></div>`;
  $('#card').addEventListener('click', flipCard);
}
function flipCard(e) {
  if (e && e.target && e.target.closest && e.target.closest('[data-say]')) return;
  const c = $('#card'); if (!c) return;
  const flipped = c.classList.toggle('flipped'); sfx.click();
  if (flipped) { speak(sayRow(card)); $('#cardControls').hidden = false; }
}
$('#knewBtn').onclick = () => { sfx.good(); deck.shift(); drawCard(); };
$('#againBtn').onclick = () => { sfx.click(); const c = deck.shift(); deck.splice(Math.min(3, deck.length), 0, c); drawCard(); };

// ---------- Sagnabókin ----------
function renderBook() {
  const rows = VERBS.map(v => {
    const s = stars(v.id);
    return `<tr><td><b>${esc(v.inf)}</b></td><td>${esc(fmt(v.past))}</td><td>${esc(fmt(v.pp))}</td>
      <td class="is">${esc(v.is)}</td><td class="st">${'★'.repeat(s)}${'☆'.repeat(3 - s)}</td><td>${speakBtn(sayRow(v))}</td></tr>`;
  }).join('');
  $('#bookTable').innerHTML = `<thead><tr><th>Infinitive</th><th>Past Simple</th><th>Past Participle</th><th>Íslenska</th><th>Kunnátta</th><th></th></tr></thead><tbody>${rows}</tbody>`;
  showScreen('book');
}
$('#resetBtn').onclick = () => {
  if (!confirm(`Viltu eyða allri framvindu ${PLAYERS[playerId].name} (XP, stjörnum og sigrum)?`)) return;
  save.m = {}; save.xp = 0; save.wins = 0; save.best = 0; persist(); renderBook();
};

// ---------- Lyklaborð ----------
document.addEventListener('keydown', e => {
  if (isActive('battle') && run && run.q && !run.q.typed && !run.q.boss && !run.busy) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 4) { const b = $$('.opt')[n - 1]; if (b) b.click(); }
  }
  if (isActive('cards') && (e.key === ' ' || e.key === 'Enter') && $('#card') && !e.target.closest('button')) {
    e.preventDefault(); flipCard();
  }
});

try { speechSynthesis.getVoices(); } catch (e) {}
renderMute();
renderWho();
})();
