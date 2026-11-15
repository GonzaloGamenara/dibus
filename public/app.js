(() => {
  'use strict';

  /* ======================================================================
     Dibus · app.js
     Vanilla JS, sin dependencias. Estado en localStorage.
     ====================================================================== */

  const CATS = window.DIBUS_CATS || [];
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rand = n => Math.floor(Math.random() * n);
  const sum = a => a.reduce((x, y) => x + y, 0);
  const fmtN = n => n.toLocaleString('es-AR');

  const KEY = 'dibus:v1';
  const PC = ['#ef5b5f', '#f6b40e', '#35b47b', '#4a8fd4', '#a56cf0', '#ff8a3d', '#1fbfae', '#ee5fa7', '#8bc34a', '#8d99ae', '#18a8d8', '#c28b2c'];
  const MAX_PLAYERS = 12;

  const OPT = {
    rounds: [3, 5, 8, 10, 15, 20, 30, 0],
    drawSec: [10, 15, 20, 30, 45, 60, 90, 120, 180, 240, 300, 600],
    pauseSec: [0, 3, 5, 8, 10, 15, 20, 30, 60]
  };

  const TWISTS = [
    'Con la mano que no usás', 'Sin levantar el lápiz', 'Con los ojos cerrados', 'En solo 5 trazos',
    'Solo con líneas rectas', 'Solo con círculos', 'Con el papel al revés', 'Lo más feo posible 🤪',
    'Agregale un sombrero', 'Dibujalo enojado', 'Dibujalo muy contento', 'Dibujalo de espaldas',
    'Dibujalo de perfil', 'Dibujalo bien chiquito en una esquina', 'Que ocupe toda la hoja',
    'Dibujalo comiendo un alfajor', 'Dibujalo tomando mate', 'Estilo nene de 3 años',
    'Sin mirar el papel', 'Agregale un bigote', 'Con la hoja apoyada en la rodilla'
  ];

  /* ---------------------------- estado ---------------------------- */
  const defaults = () => ({
    settings: {
      rounds: 10, drawSec: 60, pauseSec: 5, judging: 'each', twist: 'off',
      sound: true, vibrate: true, wake: true, noRepeat: true, showOrigin: true, allowReroll: true, theme: 'auto'
    },
    players: [], off: { escenas: true }, excluded: {}, custom: [], seen: {}, history: [], hideInstall: false
  });

  let S = load();
  function load() {
    const d = defaults();
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const p = JSON.parse(raw);
        return { ...d, ...p, settings: { ...d.settings, ...(p.settings || {}) } };
      }
    } catch (e) { /* modo privado o storage bloqueado */ }
    return d;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* noop */ } }

  const UI = { tab: 'play', open: null, q: '' };

  /* ---------------------------- catálogo ---------------------------- */
  const parseItems = txt => String(txt).split('\n').map(l => l.trim()).filter(Boolean).map(l => {
    const [n, ...o] = l.split('|');
    return { n: n.trim(), o: o.join('|').trim() };
  });
  const allCats = () => CATS.concat(S.custom.map(c => ({ id: c.id, emoji: c.emoji || '⭐', name: c.name, custom: true, items: parseItems(c.text) })));
  const ikey = (cid, it) => cid + '|' + it.n;
  const activeCats = () => allCats()
    .filter(c => !S.off[c.id])
    .map(c => ({ ...c, items: c.items.filter(it => !S.excluded[ikey(c.id, it)]) }))
    .filter(c => c.items.length);
  const poolSize = () => sum(activeCats().map(c => c.items.length));

  /* ---------------------------- utilidades UI ---------------------------- */
  let toastT;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), 2200);
  }
  const fmtDur = s => s < 60 ? `${s} seg` : (s % 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} min` : `${s / 60} min`);
  const fmtClock = s => s >= 60 ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : String(s);
  const fmtDate = ts => new Date(ts).toLocaleDateString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isStandalone = () => window.navigator.standalone === true || (window.matchMedia && matchMedia('(display-mode: standalone)').matches);

  function applyTheme() {
    const r = document.documentElement;
    if (S.settings.theme === 'auto') r.removeAttribute('data-theme'); else r.setAttribute('data-theme', S.settings.theme);
  }

  /* Alto real de la pantalla: en iOS (app instalada) a veces el viewport queda más corto que la pantalla
     y se ve una franja vacía abajo. Lo fijamos a mano. */
  function fit() {
    let h = window.innerHeight;
    if (isStandalone() && matchMedia('(orientation: portrait)').matches) h = Math.max(h, Math.max(screen.width, screen.height));
    document.documentElement.style.setProperty('--app-h', h + 'px');
  }
  fit();
  window.addEventListener('resize', fit);
  window.addEventListener('orientationchange', () => setTimeout(fit, 250));
  function diagInfo() {
    let sab = '?';
    try {
      const p = document.createElement('div');
      p.style.cssText = 'position:fixed;bottom:0;padding-bottom:env(safe-area-inset-bottom);visibility:hidden';
      document.body.appendChild(p);
      sab = parseFloat(getComputedStyle(p).paddingBottom) || 0;
      p.remove();
    } catch (e) { /* noop */ }
    return `${window.innerWidth}×${window.innerHeight} · pantalla ${screen.width}×${screen.height} · margen inferior ${sab}px · ${isStandalone() ? 'app instalada' : 'navegador'}`;
  }

  /* sheets */
  let sheetFns = [];
  function openSheet(html) {
    const s = $('#sheet');
    s.innerHTML = `<div class="sheet-in"><div class="grab"></div>${html}</div>`;
    s.dataset.a = 'close-sheet'; s.hidden = false;
  }
  function closeSheet() { $('#sheet').hidden = true; $('#sheet').innerHTML = ''; sheetFns = []; }
  function ask(title, text, buttons) {
    sheetFns = buttons.map(b => b.fn);
    openSheet(`<h3>${title}</h3>${text ? `<p>${text}</p>` : ''}` +
      buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-a="sheet-btn" data-i="${i}">${b.t}</button>`).join(''));
  }

  /* ---------------------------- audio / háptico / wake lock ---------------------------- */
  let AC = null;
  function unlockAudio() {
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS: que suene aunque esté en silencio (si el navegador lo permite)
      AC = AC || new (window.AudioContext || window.webkitAudioContext)();
      if (AC.state !== 'running') AC.resume();
    } catch (e) { /* noop */ }
  }
  /* Sonidos sintetizados (sin archivos): tienen que sonar a juego de mesa, no a alarma de computadora. */
  // compresor general: evita que se sature cuando suenan varias cosas juntas (fanfarria + aplausos)
  function out() {
    if (!AC._out) {
      const c = AC.createDynamicsCompressor(); c.threshold.value = -14; c.ratio.value = 8;
      const m = AC.createGain(); m.gain.value = .9; c.connect(m); m.connect(AC.destination); AC._out = c;
    }
    return AC._out;
  }
  let NB = null;
  function noiseBuf() {
    if (NB) return NB;
    NB = AC.createBuffer(1, AC.sampleRate, AC.sampleRate);
    const d = NB.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return NB;
  }
  // un tono con envolvente rápida; sweep = frecuencia final (para boings y pops)
  function tone(freq, dur = .12, type = 'sine', vol = .25, when = 0, sweep = 0) {
    if (!S.settings.sound || !AC) return;
    try {
      const t = AC.currentTime + when;
      const o = AC.createOscillator(), g = AC.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (sweep) o.frequency.exponentialRampToValueAtTime(sweep, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + .008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g); g.connect(out());
      o.start(t); o.stop(t + dur + .03);
    } catch (e) { /* noop */ }
  }
  // ruido filtrado: raspados, clicks, aplausos
  function noise(dur, when, f1, f2, q = 1, vol = .3, type = 'bandpass') {
    if (!S.settings.sound || !AC) return;
    try {
      const t = AC.currentTime + when;
      const src = AC.createBufferSource(), f = AC.createBiquadFilter(), g = AC.createGain();
      src.buffer = noiseBuf(); src.loop = true;
      f.type = type; f.Q.value = q;
      f.frequency.setValueAtTime(f1, t);
      if (f2 !== f1) f.frequency.exponentialRampToValueAtTime(f2, t + dur);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + Math.min(.01, dur / 3));
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f); f.connect(g); g.connect(out());
      src.start(t, Math.random()); src.stop(t + dur + .03);
    } catch (e) { /* noop */ }
  }
  // campanita metálica (parciales inarmónicos que decaen distinto)
  function bell(freq, when = 0, vol = .22, dur = .9) {
    [[1, 1], [2.76, .6], [5.4, .35], [8.93, .2]].forEach(([m, a]) => tone(freq * m, dur / m ** .4, 'sine', vol * a, when));
  }
  // trompeta de dibujito: sierra + filtro pasabajos + vibrato
  function horn(freq, dur, when, vol = .16) {
    if (!S.settings.sound || !AC) return;
    try {
      const t = AC.currentTime + when;
      const g = AC.createGain(), f = AC.createBiquadFilter(), lfo = AC.createOscillator(), lg = AC.createGain();
      f.type = 'lowpass'; f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(3200, t + .06);
      lfo.frequency.value = 6; lg.gain.value = freq * .012; lfo.connect(lg);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .03);
      g.gain.setValueAtTime(vol, t + dur - .05); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      [0, 6].forEach(det => {
        const o = AC.createOscillator(); o.type = 'sawtooth'; o.frequency.value = freq; o.detune.value = det;
        lg.connect(o.frequency); o.connect(f); o.start(t); o.stop(t + dur + .05);
      });
      f.connect(g); g.connect(out()); lfo.start(t); lfo.stop(t + dur + .05);
    } catch (e) { /* noop */ }
  }
  let tickFlip = false;
  const sfx = {
    // tic-tac de reloj en los últimos 3 segundos
    tick: () => { tickFlip = !tickFlip; noise(.045, 0, tickFlip ? 2400 : 1500, tickFlip ? 1800 : 1100, 6, .5); tone(tickFlip ? 1300 : 900, .05, 'triangle', .12); },
    // arranca la ronda: garabato de lápiz + "plop"
    go: () => { [0, .09, .18].forEach((w, i) => noise(.09, w, 2600 + i * 500, 5200 - i * 300, 1.4, .32)); tone(300, .14, 'sine', .3, .3, 720); },
    // se terminó el tiempo: campanita de cocina, riiing
    end: () => {
      for (let i = 0; i < 9; i++) { tone(2093, .07, 'sine', .22, i * .075); tone(2637, .07, 'sine', .14, i * .075); }
      bell(1568, .72, .2, 1.1);
    },
    // elegir ganador, apretar un botón: burbuja
    pick: () => tone(380, .09, 'sine', .3, 0, 900),
    point: () => { tone(520, .09, 'sine', .26, 0, 880); tone(780, .12, 'sine', .26, .08, 1300); },
    // cambiar personaje: dado sacudido
    dice: () => { [0, .07, .13, .2, .25].forEach(w => noise(.03, w + Math.random() * .02, 900 + Math.random() * 900, 700, 3, .4)); tone(180, .08, 'triangle', .18, .3, 120); },
    add: () => { bell(1760, 0, .18, .5); },
    // ganó alguien: fanfarria + aplausos
    win: () => {
      horn(392, .13, 0); horn(523, .13, .15); horn(659, .13, .3); horn(784, .65, .45, .2);
      noise(1.6, .5, 2800, 2200, .7, .35);
      for (let i = 0; i < 14; i++) noise(.04, .55 + i * .09 + Math.random() * .05, 1800 + Math.random() * 1500, 1500, 2, .45);
    }
  };
  const vib = p => { if (S.settings.vibrate && navigator.vibrate) { try { navigator.vibrate(p); } catch (e) { /* noop */ } } };

  let WL = null;
  async function wake() {
    if (!S.settings.wake || !('wakeLock' in navigator)) return;
    try { WL = await navigator.wakeLock.request('screen'); } catch (e) { /* noop */ }
  }
  function unwake() { try { if (WL) WL.release(); } catch (e) { /* noop */ } WL = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.hidden || !G) return;
    wake();
    if (AC && AC.state !== 'running') AC.resume().catch(() => { });
  });

  /* ======================================================================
     VISTAS (tabs)
     ====================================================================== */
  const stepper = (k, label, sub, val) => `
    <div class="row"><div class="lbl"><b>${label}</b><small>${sub}</small></div>
      <div class="stepper"><button data-a="step" data-k="${k}" data-d="-1" aria-label="Menos">−</button><output>${val}</output><button data-a="step" data-k="${k}" data-d="1" aria-label="Más">+</button></div></div>`;
  const seg = (k, opts, cur) => `<div class="seg">${opts.map(([v, t]) => `<button data-a="seg" data-k="${k}" data-v="${v}" class="${cur === v ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  const sw = (k, label, sub) => `
    <div class="row"><div class="lbl"><b>${label}</b>${sub ? `<small>${sub}</small>` : ''}</div>
      <button class="sw" role="switch" aria-checked="${!!S.settings[k]}" aria-label="${label}" data-a="toggle" data-k="${k}"></button></div>`;

  const initial = n => esc(([...n.trim()][0] || '?').toUpperCase());
  const PRESETS = [30, 60, 120, 180];

  function viewPlay() {
    const s = S.settings, n = poolSize(), nc = activeCats().length;
    const np = S.players.length;
    const hint = np === 0 ? 'Sin jugadores = modo libre: solo personajes y cronómetro.'
      : np === 1 ? 'Sumá al menos un jugador más para llevar el puntaje.'
        : 'Se juega con puntaje: 1 punto por cada ronda ganada.';
    const install = (isIOS && !isStandalone() && !S.hideInstall) ? `
      <div class="install"><b>📲 Instalala en tu iPhone</b>
      <p>Tocá <b>Compartir</b> en Safari y elegí <b>“Agregar a pantalla de inicio”</b>. Se abre a pantalla completa y anda sin internet.</p>
      <button data-a="hide-install" aria-label="Cerrar">✕</button></div>` : '';
    return `${install}
    <section class="card">
      <div class="card-h"><h2><span class="ico">👥</span>Jugadores</h2><span class="count">${np}/${MAX_PLAYERS}</span></div>
      ${np ? `<div class="players">${S.players.map((p, i) => `<span class="pl" style="--pc:${PC[i % PC.length]}"><i>${initial(p)}</i><span>${esc(p)}</span><button data-a="rm-player" data-i="${i}" aria-label="Quitar a ${esc(p)}">✕</button></span>`).join('')}</div>`
        : `<div class="noone">Todavía no hay nadie 👇<br>Sumá a los que van a dibujar</div>`}
      <form class="add" data-form="player" autocomplete="off">
        <input type="text" name="n" maxlength="16" placeholder="Nombre del jugador" enterkeyhint="done" autocapitalize="words" autocomplete="off" autocorrect="off">
        <button class="btn sm yellow" type="submit">＋ Sumar</button>
      </form>
      <p class="hint">${hint}</p>
    </section>
    <section class="card">
      <div class="card-h"><h2><span class="ico">⏱️</span>La partida</h2></div>
      ${stepper('rounds', 'Personajes', 'cuántas rondas', s.rounds === 0 ? '∞' : s.rounds)}
      ${stepper('drawSec', 'Tiempo para dibujar', 'por personaje', fmtDur(s.drawSec))}
      <div class="presets">${PRESETS.map(v => `<button class="pre ${s.drawSec === v ? 'on' : ''}" data-a="preset" data-k="drawSec" data-v="${v}">${fmtDur(v).replace(' seg', ' s')}</button>`).join('')}</div>
      ${stepper('pauseSec', 'Pausa entre personajes', 'cuenta regresiva', s.pauseSec === 0 ? 'Sin pausa' : fmtDur(s.pauseSec))}
      <div class="row col"><div class="lbl"><b>Elegir ganador</b><small>${s.judging === 'each' ? 'Al terminar cada dibujo, votan' : 'Dibujan todos seguidos y votan al final'}</small></div>
        ${seg('judging', [['each', 'Cada ronda'], ['end', 'Al final']], s.judging)}</div>
      <div class="row col"><div class="lbl"><b>Retos extra</b><small>Condiciones locas para dibujar</small></div>
        ${seg('twist', [['off', 'No'], ['sometimes', 'A veces'], ['always', 'Siempre']], s.twist)}</div>
    </section>
    <button class="catcard" data-a="tab" data-t="cats">
      <span class="ico">🎲</span>
      <span><b>${fmtN(n)} personajes</b><small>${nc} categoría${nc === 1 ? '' : 's'} activa${nc === 1 ? '' : 's'} · tocá para elegir</small></span>
      <span class="chev">›</span>
    </button>`;
  }

  function ctaHTML() {
    const s = S.settings, np = S.players.length, n = poolSize();
    const sum = [s.rounds === 0 ? '∞ rondas' : `${s.rounds} ronda${s.rounds === 1 ? '' : 's'}`, fmtDur(s.drawSec), np >= 2 ? `${np} jugadores` : 'modo libre'].join(' · ');
    return `<div class="cta-sum">${sum}</div><button class="btn big" data-a="start" ${n ? '' : 'disabled'}>¡A dibujar! ✏️</button>`;
  }

  function catListHTML() {
    const q = (UI.q || '').trim().toLowerCase();
    const cats = allCats();
    let out = '', shown = 0;
    cats.forEach(c => {
      const nameHit = !q || c.name.toLowerCase().includes(q);
      const items = c.items.map((it, i) => ({ it, i })).filter(x => !q || nameHit || x.it.n.toLowerCase().includes(q) || x.it.o.toLowerCase().includes(q));
      if (q && !nameHit && !items.length) return;
      shown++;
      const on = !S.off[c.id];
      const ex = c.items.filter(it => S.excluded[ikey(c.id, it)]).length;
      const open = UI.open === c.id || (q && !nameHit && items.length > 0);
      out += `<div class="cat ${on ? '' : 'off'}">
        <div class="cat-top">
          <button class="cat-open" data-a="expand" data-id="${esc(c.id)}" aria-expanded="${open}">
            <span class="cat-emoji">${esc(c.emoji)}</span>
            <span><b>${esc(c.name)}${c.custom ? '<span class="badge">MÍA</span>' : ''}</b><small>${c.items.length - ex} personajes${ex ? ` · ${ex} sacados` : ''} · ${open ? 'cerrar ▴' : 'ver ▾'}</small></span>
          </button>
          <button class="sw" role="switch" aria-checked="${on}" aria-label="Activar ${esc(c.name)}" data-a="cat-toggle" data-id="${esc(c.id)}"></button>
        </div>
        ${open ? `<div class="cat-body">
          <p class="hint">Tocá un personaje para sacarlo (o volver a ponerlo) del sorteo.</p>
          <div class="items">${items.map(({ it, i }) => `<button class="item ${S.excluded[ikey(c.id, it)] ? 'x' : ''}" data-a="toggle-item" data-c="${esc(c.id)}" data-i="${i}">${esc(it.n)}${it.o ? ` <small>· ${esc(it.o)}</small>` : ''}</button>`).join('')}</div>
          ${c.custom ? `<div class="cat-actions"><button class="btn sm" data-a="edit-cat" data-id="${esc(c.id)}">✎ Editar</button><button class="btn sm ghost" data-a="del-cat" data-id="${esc(c.id)}">🗑 Borrar</button></div>` : (ex ? `<div class="cat-actions"><button class="btn sm ghost" data-a="reset-items" data-id="${esc(c.id)}">Volver a poner los sacados</button></div>` : '')}
        </div>` : ''}
      </div>`;
    });
    return shown ? out : `<div class="nores">No encontré nada con “${esc(UI.q)}” 🤔</div>`;
  }

  function viewCats() {
    const n = poolSize(), nc = activeCats().length, tot = allCats().length;
    return `<div class="catbar">
        <div class="total"><b>${fmtN(n)} personajes</b><span>${nc} de ${tot} categorías</span></div>
        <input type="search" id="q" placeholder="Buscar personaje o categoría…" value="${esc(UI.q || '')}" autocomplete="off" autocorrect="off" autocapitalize="off" enterkeyhint="search">
        <div class="tools"><button class="link" data-a="cats-all">Todas</button><button class="link" data-a="cats-none">Ninguna</button>
          <button class="btn sm yellow" data-a="new-cat">＋ Mi categoría</button></div>
      </div>
      <div id="catlist">${catListHTML()}</div>
      <p class="hint" style="text-align:center">Podés crear tus propias categorías con los personajes que quieras (tu familia, tus amigos, chistes internos).</p>`;
  }

  function viewHist() {
    const H = S.history;
    if (!H.length) return `<div class="empty"><div class="big">🏆</div>Todavía no hay partidas.<br>Jugá una con 2 o más jugadores y queda guardada acá.</div>`;
    const tot = {};
    H.forEach(g => {
      const top = Math.max(...g.scores);
      g.players.forEach((p, i) => {
        const k = p.trim().toLowerCase();
        tot[k] = tot[k] || { name: p, wins: 0, games: 0, pts: 0 };
        tot[k].games++; tot[k].pts += g.scores[i];
        if (top > 0 && g.scores[i] === top) tot[k].wins++;
      });
    });
    const rank = Object.values(tot).sort((a, b) => b.wins - a.wins || b.pts - a.pts);
    const medals = ['🥇', '🥈', '🥉'];
    return `<section class="card"><div class="card-h"><h2><span class="ico">🏆</span>Ranking de victorias</h2></div>
      ${rank.map((r, i) => `<div class="rank-row"><div class="medal">${medals[i] || (i + 1)}</div><div class="nm">${esc(r.name)}<small>${r.games} partida${r.games > 1 ? 's' : ''} · ${r.pts} punto${r.pts === 1 ? '' : 's'} en total</small></div><div class="pts">${r.wins}</div></div>`).join('')}
    </section>
    <section class="card"><div class="card-h"><h2><span class="ico">🕘</span>Últimas partidas</h2></div>
      ${H.slice(0, 25).map(g => {
        const top = Math.max(...g.scores);
        const ws = top > 0 ? g.players.filter((_, i) => g.scores[i] === top) : [];
        return `<div class="game-row"><b>${ws.length ? '🏆 ' + esc(ws.join(' y ')) : 'Sin ganador'}</b><small>${fmtDate(g.ts)} · ${g.total} ronda${g.total > 1 ? 's' : ''} · ${g.players.map((p, i) => `${esc(p)} ${g.scores[i]}`).join(' · ')}</small></div>`;
      }).join('')}
      <div style="margin-top:12px"><button class="btn sm ghost" data-a="clear-hist">Borrar historial</button></div>
    </section>`;
  }

  function viewSet() {
    const s = S.settings;
    return `<section class="card"><div class="card-h"><h2><span class="ico">🔔</span>Durante el juego</h2></div>
      ${sw('sound', 'Sonidos', 'Beeps al final de cada tiempo')}
      ${sw('vibrate', 'Vibración', 'Solo en teléfonos que la permiten')}
      ${sw('wake', 'Mantener pantalla prendida', 'Para que no se apague mientras dibujan')}
      ${sw('allowReroll', 'Botón “Otro”', 'Cambiar el personaje de la ronda')}
      ${sw('showOrigin', 'Mostrar de dónde es', 'Ej: “Felipe · Mafalda”')}
    </section>
    <section class="card"><div class="card-h"><h2><span class="ico">🎲</span>Sorteo</h2></div>
      ${sw('noRepeat', 'No repetir personajes', 'Hasta agotar el catálogo, entre partidas también')}
      <div class="row"><div class="lbl"><b>Personajes ya vistos</b><small>${fmtN(Object.keys(S.seen).length)} en memoria</small></div><button class="btn sm ghost" data-a="reset-seen">Reiniciar</button></div>
    </section>
    <section class="card"><div class="card-h"><h2><span class="ico">🎨</span>Apariencia</h2></div>
      <div class="row col"><div class="lbl"><b>Tema</b></div>${seg('theme', [['auto', 'Automático'], ['light', 'Claro'], ['dark', 'Oscuro']], s.theme)}</div>
    </section>
    <section class="card"><div class="card-h"><h2><span class="ico">ℹ️</span>Tips</h2></div>
      <p class="hint" style="margin-top:0">• Si no suena en el iPhone, fijate que no esté el <b>modo silencio</b> (switch lateral) y que el volumen esté arriba.<br>• Para instalarla: Safari → <b>Compartir</b> → <b>Agregar a pantalla de inicio</b>.<br>• Cada jugador dibuja en su hoja (o en su propio cuaderno). Cuando termina el tiempo, se muestran los dibus y se vota.</p>
    </section>
    <section class="card"><div class="card-h"><h2><span class="ico">🧹</span>Datos</h2></div>
      <button class="btn sm ghost" data-a="reset-all">Restablecer todo</button>
      <p class="hint">Se guarda todo en este dispositivo. Dibus v1.1 · hecho con ❤️ para dibujar con amigos.</p>
      <p class="hint" style="font-size:11.5px;opacity:.7;margin-top:0">${diagInfo()}</p>
    </section>`;
  }

  const VIEWS = { play: viewPlay, cats: viewCats, hist: viewHist, set: viewSet };

  function render(keep = true) {
    const v = $('#view');
    const top = keep ? v.scrollTop : 0;
    v.innerHTML = VIEWS[UI.tab]();
    v.scrollTop = top;
    $$('#tabbar button').forEach(b => b.classList.toggle('on', b.dataset.t === UI.tab));
    const cta = $('#cta');
    cta.hidden = UI.tab !== 'play';
    if (!cta.hidden) cta.innerHTML = ctaHTML();
  }

  /* ======================================================================
     JUEGO
     ====================================================================== */
  const gameEl = $('#game');
  let G = null, loopId = null;

  function pickTwist() {
    const m = G.st.twist;
    if (m === 'off') return null;
    if (m === 'sometimes' && Math.random() > .35) return null;
    return TWISTS[rand(TWISTS.length)];
  }

  function pickChar() {
    const cats = activeCats();
    let avail = cats.map(c => ({ c, items: c.items.filter(it => !G.used.has(ikey(c.id, it))) })).filter(x => x.items.length);
    if (!avail.length) { G.used.clear(); avail = cats.map(c => ({ c, items: c.items })); }
    if (S.settings.noRepeat) {
      const fresh = avail.map(x => ({ c: x.c, items: x.items.filter(it => !S.seen[ikey(x.c.id, it)]) })).filter(x => x.items.length);
      if (fresh.length) avail = fresh;
      else cats.forEach(c => c.items.forEach(it => { delete S.seen[ikey(c.id, it)]; }));
    }
    // se sortea primero la categoría (con peso raíz del tamaño) y después el personaje, así no gana siempre la más grande
    const w = avail.map(x => Math.sqrt(x.items.length));
    let r = Math.random() * sum(w), i = 0;
    while (i < w.length - 1 && (r -= w[i]) > 0) i++;
    const x = avail[i], it = x.items[rand(x.items.length)];
    const k = ikey(x.c.id, it);
    G.used.add(k); S.seen[k] = 1; save();
    return { n: it.n, o: it.o, cat: x.c.name, emoji: x.c.emoji };
  }

  function startGame() {
    if (!poolSize()) { toast('Activá al menos una categoría 🗂️'); return; }
    unlockAudio();
    const st = { ...S.settings };
    G = {
      st, players: S.players.slice(), scoring: S.players.length >= 2, rounds: [], phase: 'pause', first: true,
      used: new Set(), paused: false, userPaused: false, total: st.rounds, to: null, startedAt: Date.now()
    };
    gameEl.hidden = false;
    wake();
    enterPause();
    clearInterval(loopId); loopId = setInterval(tick, 100);
    vib(30);
  }

  function exitGame() {
    clearInterval(loopId); clearTimeout(G && G.to); unwake();
    G = null; gameEl.hidden = true; gameEl.innerHTML = '';
    closeSheet(); render();
  }

  const curRound = () => G.rounds[G.rounds.length - 1];
  const calcScores = () => G.players.map((_, i) => G.rounds.filter(r => r.winner === i).length);

  function enterPause() {
    clearTimeout(G.to);
    const secs = G.first ? 3 : G.st.pauseSec;
    if (secs <= 0) { beginDraw(); return; }
    G.phase = 'pause'; G.dur = secs * 1000; G.endAt = Date.now() + G.dur;
    G.paused = false; G.userPaused = false; G.lastBeep = null;
    renderGame();
  }

  function beginDraw() {
    G.first = false;
    G.rounds.push({ ch: pickChar(), twist: pickTwist(), winner: null });
    G.phase = 'draw'; G.dur = G.st.drawSec * 1000; G.endAt = Date.now() + G.dur;
    G.paused = false; G.userPaused = false; G.lastBeep = null;
    sfx.go(); vib(60);
    renderGame();
  }

  function endDraw() {
    G.phase = 'timeup';
    sfx.end(); vib([250, 100, 250]);
    renderGame();
    if (!(G.scoring && G.st.judging === 'each')) G.to = setTimeout(afterRound, 2300);
  }

  function afterRound() {
    clearTimeout(G.to);
    const done = G.total > 0 && G.rounds.length >= G.total;
    if (!done) return enterPause();
    if (G.scoring && G.st.judging === 'end') { G.phase = 'review'; renderGame(); } else finish();
  }

  function finish() {
    clearTimeout(G.to); unwake();
    if (!G.rounds.length) return exitGame();
    G.phase = 'final';
    if (G.scoring) {
      S.history.unshift({
        id: Date.now(), ts: Date.now(), players: G.players, scores: calcScores(), total: G.rounds.length,
        rounds: G.rounds.map(r => ({ n: r.ch.n, o: r.ch.o, e: r.ch.emoji, w: r.winner }))
      });
      S.history = S.history.slice(0, 60); save();
    }
    renderGame();
    sfx.win(); vib([100, 60, 100, 60, 300]);
    if (G.scoring) setTimeout(confetti, 150);
  }

  function endEarly() {
    if (G.phase === 'review') return finish();
    if (G.phase === 'draw') G.rounds.pop();
    if (G.scoring && G.st.judging === 'each') G.rounds = G.rounds.filter(r => r.winner !== null);
    clearTimeout(G.to);
    if (!G.rounds.length) return exitGame();
    if (G.scoring && G.st.judging === 'end') { G.phase = 'review'; renderGame(); } else finish();
  }

  /* timer */
  function holdTimer() { if (G.paused) return false; G.paused = true; G.pausedAt = Date.now(); return true; }
  function releaseTimer() { if (!G.paused) return; G.endAt += Date.now() - G.pausedAt; G.paused = false; }

  function tick() {
    if (!G || (G.phase !== 'pause' && G.phase !== 'draw') || G.paused) return;
    const rem = Math.max(0, G.endAt - Date.now());
    paintTimer(rem);
    if (rem <= 0) { if (G.phase === 'pause') beginDraw(); else endDraw(); }
  }

  const C = 2 * Math.PI * 54;
  function paintTimer(rem) {
    const sec = Math.ceil(rem / 1000);
    if (G.phase === 'draw') {
      const t = $('#g-time'), ring = $('#g-ring');
      if (!t) return;
      const txt = fmtClock(sec);
      if (t.textContent !== txt) t.textContent = txt;
      ring.style.strokeDashoffset = String(C * (1 - rem / G.dur));
      gameEl.classList.toggle('urgent', sec <= (G.dur >= 30000 ? 10 : 5));
    } else {
      const t = $('#g-count'), ring = $('#g-ring');
      if (t && t.textContent !== String(sec)) t.textContent = sec;
      if (ring) ring.style.strokeDashoffset = String(C * (1 - rem / G.dur));
    }
    if (sec <= 3 && sec > 0 && G.lastBeep !== sec) { G.lastBeep = sec; sfx.tick(); vib(25); }
  }

  /* render */
  const head = title => `<div class="g-head"><button class="ibtn" data-a="g-quit" aria-label="Salir">✕</button><div class="g-round">${title}</div><button class="ibtn" data-a="g-sound" aria-label="Sonido">${S.settings.sound ? '🔊' : '🔇'}</button></div>`;
  const roundNo = () => G.phase === 'pause' ? G.rounds.length + 1 : G.rounds.length;
  const roundLabel = () => G.total ? `Ronda ${roundNo()} de ${G.total}` : `Ronda ${roundNo()}`;
  const prog = () => {
    if (!G.total) return '<div class="g-prog"><i style="width:100%;opacity:.25"></i></div>';
    const d = G.rounds.length - (G.phase === 'draw' || G.phase === 'timeup' || G.phase === 'judge' ? 1 : 0);
    return `<div class="g-prog"><i style="width:${Math.max(4, Math.min(100, d / G.total * 100))}%"></i></div>`;
  };
  const scoresStrip = () => {
    if (!G.scoring) return '';
    const sc = calcScores();
    return `<div class="g-scores">${G.players.map((p, i) => `<span class="spill" style="--pc:${PC[i % PC.length]}"><i></i>${esc(p)} <b>${sc[i]}</b></span>`).join('')}</div>`;
  };
  const nameCls = n => n.length > 28 ? 'xl' : n.length > 14 ? 'long' : '';

  const GV = {
    pause() {
      const first = G.first;
      const tips = ['Tomá un poco de agua 💧', 'Estirá la mano ✋', 'Cambiá de hoja 📄', 'Afilá el lápiz ✏️', 'Respirá hondo 😮‍💨', 'Mostrá tu mejor trazo 😎'];
      return `${head(roundLabel())}${prog()}${scoresStrip()}
      <div class="g-main">
        <div class="g-kicker">${first ? '¡Preparate! Agarrá lápiz y papel ✏️' : 'Siguiente personaje en…'}</div>
        <div class="g-timer big"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" id="g-ring" cx="60" cy="60" r="54" style="stroke-dashoffset:0"/></svg>
          <div class="g-time" id="g-count">${Math.ceil(G.dur / 1000)}</div></div>
        <div class="g-sub">${first ? 'El personaje aparece al llegar a cero. ¡No espíes!' : tips[rand(tips.length)]}</div>
      </div>
      <div class="g-actions" style="grid-template-columns:1fr 1fr">
        <button class="btn gbtn" data-a="g-pausebtn"><span>${G.paused ? '▶️' : '⏸️'}</span>${G.paused ? 'Seguir' : 'Pausa'}</button>
        <button class="btn" data-a="g-skip">¡Ya! ▶</button>
      </div>`;
    },
    draw() {
      const r = curRound(), ch = r.ch;
      const btns = [`<button class="btn gbtn" data-a="g-pausebtn"><span>${G.paused ? '▶️' : '⏸️'}</span>${G.paused ? 'Seguir' : 'Pausa'}</button>`];
      if (G.st.allowReroll) btns.push(`<button class="btn gbtn" data-a="g-reroll"><span>🔄</span>Otro</button>`);
      btns.push(`<button class="btn gbtn" data-a="g-add"><span>➕</span>30 seg</button>`);
      return `${head(roundLabel())}${prog()}${scoresStrip()}
      <div class="g-main">
        <div class="g-card">
          <div class="g-emoji">${esc(ch.emoji)}</div>
          <div class="g-cat">${esc(ch.cat)}</div>
          <h1 class="g-name ${nameCls(ch.n)}">${esc(ch.n)}</h1>
          ${ch.o && G.st.showOrigin ? `<div class="g-origin">${esc(ch.o)}</div>` : ''}
          ${r.twist ? `<div class="g-twist">🎯 ${esc(r.twist)}</div>` : ''}
        </div>
      </div>
      <div class="g-timer"><svg viewBox="0 0 120 120"><circle class="bg" cx="60" cy="60" r="54"/><circle class="fg" id="g-ring" cx="60" cy="60" r="54" style="stroke-dashoffset:0"/></svg>
        <div class="g-time" id="g-time"></div>${G.paused ? '<div class="g-paused">EN PAUSA</div>' : ''}</div>
      <div class="g-actions" style="grid-template-columns:repeat(${btns.length},1fr)">${btns.join('')}
        <button class="btn full" style="grid-column:1/-1" data-a="g-done">✔ ¡Listo, terminé!</button></div>`;
    },
    timeup() {
      const ch = curRound().ch, needJudge = G.scoring && G.st.judging === 'each';
      return `${head(roundLabel())}${prog()}${scoresStrip()}
      <div class="g-main timeup">
        <div class="g-emoji">⏰</div>
        <div class="g-title">¡Tiempo!</div>
        <div class="g-sub">Soltá el lápiz y mostrá tu dibu 👀</div>
        <div class="g-cat" style="margin-top:10px">${esc(ch.emoji)} ${esc(ch.n)}</div>
      </div>
      <div class="g-actions" style="grid-template-columns:1fr">
        ${needJudge ? `<button class="btn" data-a="g-tojudge">Elegir ganador 🏆</button>` : `<button class="btn" data-a="g-next">Siguiente ▶</button>`}
      </div>`;
    },
    judge() {
      const r = curRound(), ch = r.ch;
      return `${head(roundLabel())}${prog()}${scoresStrip()}
      <div class="g-main" style="justify-content:flex-start;padding-top:18px">
        <div class="g-card" style="padding:14px 14px 16px">
          <div class="g-cat">${esc(ch.emoji)} ${esc(ch.cat)}</div>
          <div class="g-name ${nameCls(ch.n)}" style="font-size:clamp(26px,8vw,40px)">${esc(ch.n)}</div>
        </div>
        <div class="g-title" style="font-size:clamp(22px,6.5vw,30px);margin-top:14px">¿Quién lo dibujó mejor?</div>
        <div class="pgrid">${G.players.map((p, i) => `<button class="pbtn ${r.winner === i ? 'sel' : ''}" style="--pc:${PC[i % PC.length]}" data-a="g-win" data-w="${i}"><i></i>${esc(p)}</button>`).join('')}
          <button class="pbtn tie ${r.winner === -1 ? 'sel' : ''}" data-a="g-win" data-w="-1">🤝 Empate / Nadie</button></div>
      </div>`;
    },
    review() {
      return `${head('Votación final')}${scoresStrip()}
      <div class="g-sub" style="text-align:center;margin:0 auto 8px">Tocá quién ganó cada personaje.</div>
      <div class="review">${G.rounds.map((r, ri) => `<div class="rcard"><h4>${esc(r.ch.emoji)} ${esc(r.ch.n)}${r.ch.o ? `<small>${esc(r.ch.o)}</small>` : ''}</h4>
        <div class="pgrid">${G.players.map((p, i) => `<button class="pbtn ${r.winner === i ? 'sel' : ''}" style="--pc:${PC[i % PC.length]}" data-a="g-rwin" data-r="${ri}" data-w="${i}"><i></i>${esc(p)}</button>`).join('')}
        <button class="pbtn tie ${r.winner === -1 ? 'sel' : ''}" data-a="g-rwin" data-r="${ri}" data-w="-1">🤝 Empate / Nadie</button></div></div>`).join('')}</div>
      <div class="final-actions"><button class="btn" data-a="g-results">Ver resultados 🏆</button></div>`;
    },
    final() {
      const n = G.rounds.length;
      if (!G.scoring) {
        return `${head('¡Terminó!')}
        <div class="final"><div class="trophy">🎨</div><div class="winner">¡${n} dibujo${n > 1 ? 's' : ''}!</div><div class="sub">Buen laburo, artistas.</div>
          <div class="recap">${G.rounds.map(r => `<div class="rr"><em>${esc(r.ch.emoji)}</em><div>${esc(r.ch.n)}${r.ch.o ? `<small>${esc(r.ch.o)}</small>` : ''}</div></div>`).join('')}</div></div>
        <div class="final-actions"><button class="btn" data-a="g-again">🔁 Otra vuelta</button><button class="btn ghost" data-a="g-exit">Volver al inicio</button></div>`;
      }
      const order = rankOrder(), top = order[0] ? order[0].s : 0, max = Math.max(1, top);
      const winners = top > 0 ? order.filter(o => o.s === top) : [];
      const medals = ['🥇', '🥈', '🥉'];
      const title = winners.length === 1 ? `¡Ganó ${esc(winners[0].p)}!` : winners.length > 1 ? `¡Empate!` : 'Sin ganadores';
      const sub = winners.length > 1 ? esc(winners.map(w => w.p).join(' y ')) + ` con ${top} punto${top > 1 ? 's' : ''}` : winners.length ? `${top} punto${top > 1 ? 's' : ''} en ${n} ronda${n > 1 ? 's' : ''}` : 'Nadie se llevó puntos esta vez';
      return `${head('Resultados')}
      <div class="final"><canvas id="confetti"></canvas>
        <div class="trophy">${winners.length ? '🏆' : '🤷'}</div><div class="winner">${title}</div><div class="sub">${sub}</div>
        <div class="bars">${order.map(o => `<div class="bar" style="--pc:${PC[o.i % PC.length]}"><div class="m">${medals[o.pos - 1] || o.pos}</div><div><div class="nm">${esc(o.p)}</div><div class="track"><i style="width:${o.s / max * 100}%"></i></div></div><div class="pp">${o.s}</div></div>`).join('')}</div>
        <div class="recap">${G.rounds.map(r => `<div class="rr"><em>${esc(r.ch.emoji)}</em><div>${esc(r.ch.n)}${r.ch.o ? `<small>${esc(r.ch.o)}</small>` : ''}</div>${r.winner != null && r.winner >= 0 ? `<span style="--pc:${PC[r.winner % PC.length]}"><i></i>${esc(G.players[r.winner])}</span>` : '<span>🤝</span>'}</div>`).join('')}</div>
      </div>
      <div class="final-actions"><div class="row2"><button class="btn" data-a="g-again">🔁 Revancha</button><button class="btn blue" data-a="g-share">📤 Compartir</button></div>
        <button class="btn ghost" data-a="g-exit">Volver al inicio</button></div>`;
    }
  };

  function rankOrder() {
    const sc = calcScores();
    const order = G.players.map((p, i) => ({ p, i, s: sc[i] })).sort((a, b) => b.s - a.s || a.i - b.i);
    let pos = 0, prev = null;
    order.forEach((o, k) => { if (o.s !== prev) { pos = k + 1; prev = o.s; } o.pos = pos; });
    return order;
  }

  function renderGame() {
    if (!G) return;
    const keep = {};
    ['.review', '.final'].forEach(s => { const e = $(s, gameEl); if (e) keep[s] = e.scrollTop; });
    gameEl.className = 'game ph-' + G.phase;
    gameEl.innerHTML = GV[G.phase]();
    Object.keys(keep).forEach(s => { const e = $(s, gameEl); if (e) e.scrollTop = keep[s]; });
    tick();
  }

  function shareResults() {
    const order = rankOrder(), medals = ['🥇', '🥈', '🥉'];
    const txt = `🎨 Dibus · ${G.rounds.length} ronda${G.rounds.length > 1 ? 's' : ''}\n` +
      order.map(o => `${medals[o.pos - 1] || o.pos + '.'} ${o.p} — ${o.s}`).join('\n') + '\n\n¿Quién dibuja mejor? ✏️';
    if (navigator.share) navigator.share({ text: txt }).catch(() => { });
    else if (navigator.clipboard) navigator.clipboard.writeText(txt).then(() => toast('Resultados copiados 📋'));
  }

  function confetti() {
    const cv = $('#confetti'); if (!cv) return;
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth, h = cv.clientHeight;
    cv.width = w * dpr; cv.height = h * dpr;
    const ctx = cv.getContext('2d'); ctx.scale(dpr, dpr);
    const cols = ['#75aadb', '#f6b40e', '#ffffff', '#ef5b5f', '#35b47b'];
    const ps = Array.from({ length: 110 }, () => ({ x: Math.random() * w, y: -20 - Math.random() * h * .6, vx: (Math.random() - .5) * 2.2, vy: 2 + Math.random() * 3.5, s: 5 + Math.random() * 7, r: Math.random() * 6, vr: (Math.random() - .5) * .3, c: cols[rand(cols.length)] }));
    let f = 0;
    (function frame() {
      if (!G || G.phase !== 'final' || !cv.isConnected) return;
      ctx.clearRect(0, 0, w, h);
      ps.forEach(p => { p.x += p.vx; p.y += p.vy; p.r += p.vr; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.fillStyle = p.c; ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); ctx.restore(); });
      if (++f < 260) requestAnimationFrame(frame); else ctx.clearRect(0, 0, w, h);
    })();
  }

  /* ======================================================================
     ACCIONES
     ====================================================================== */
  const A = {
    tab(el) { UI.tab = el.dataset.t; render(false); $('#view').focus({ preventScroll: true }); },
    'hide-install'() { S.hideInstall = true; save(); render(); },
    start: startGame,

    'rm-player'(el) { S.players.splice(+el.dataset.i, 1); save(); render(); },
    step(el) {
      const k = el.dataset.k, arr = OPT[k], d = +el.dataset.d;
      let i = arr.indexOf(S.settings[k]);
      if (i < 0) i = 0;
      S.settings[k] = arr[Math.max(0, Math.min(arr.length - 1, i + d))];
      save(); render();
    },
    preset(el) { S.settings[el.dataset.k] = +el.dataset.v; save(); render(); },
    seg(el) { S.settings[el.dataset.k] = el.dataset.v; save(); if (el.dataset.k === 'theme') applyTheme(); render(); },
    toggle(el) { S.settings[el.dataset.k] = !S.settings[el.dataset.k]; save(); render(); },

    expand(el) { UI.open = UI.open === el.dataset.id ? null : el.dataset.id; render(); },
    'cat-toggle'(el) { const id = el.dataset.id; if (S.off[id]) delete S.off[id]; else S.off[id] = true; save(); render(); },
    'cats-all'() { S.off = {}; save(); render(); },
    'cats-none'() { allCats().forEach(c => { S.off[c.id] = true; }); save(); render(); },
    'toggle-item'(el) {
      const c = allCats().find(x => x.id === el.dataset.c); if (!c) return;
      const k = ikey(c.id, c.items[+el.dataset.i]);
      if (S.excluded[k]) delete S.excluded[k]; else S.excluded[k] = 1;
      save(); render();
    },
    'reset-items'(el) {
      const c = allCats().find(x => x.id === el.dataset.id); if (!c) return;
      c.items.forEach(it => { delete S.excluded[ikey(c.id, it)]; });
      save(); render();
    },
    'new-cat'() { catEditor(); },
    'edit-cat'(el) { catEditor(el.dataset.id); },
    'del-cat'(el) {
      const id = el.dataset.id, c = S.custom.find(x => x.id === id); if (!c) return;
      ask('¿Borrar “' + esc(c.name) + '”?', 'Se pierden los personajes que cargaste.', [
        { t: 'Sí, borrar', cls: 'red', fn: () => { S.custom = S.custom.filter(x => x.id !== id); delete S.off[id]; UI.open = null; save(); closeSheet(); render(); } },
        { t: 'Cancelar', cls: 'ghost', fn: closeSheet }
      ]);
    },
    'save-cat'(el) {
      const name = $('#ce-name').value.trim(), emoji = ($('#ce-emoji').value.trim() || '⭐').slice(0, 4), text = $('#ce-text').value;
      const n = parseItems(text).length;
      if (!name) return toast('Ponele un nombre a la categoría');
      if (!n) return toast('Agregá al menos un personaje');
      const id = el.dataset.id;
      if (id) { const c = S.custom.find(x => x.id === id); Object.assign(c, { name, emoji, text }); }
      else { const nid = 'c_' + Date.now().toString(36); S.custom.push({ id: nid, name, emoji, text }); UI.open = nid; }
      save(); closeSheet(); render(); toast('¡Categoría guardada! ✅');
    },

    'clear-hist'() { ask('¿Borrar el historial?', 'Se borra el ranking y las partidas guardadas.', [{ t: 'Sí, borrar', cls: 'red', fn: () => { S.history = []; save(); closeSheet(); render(); } }, { t: 'Cancelar', cls: 'ghost', fn: closeSheet }]); },
    'reset-seen'() { S.seen = {}; save(); render(); toast('Listo, todos los personajes vuelven al sorteo 🎲'); },
    'reset-all'() { ask('¿Restablecer todo?', 'Se borran jugadores, ajustes, categorías propias e historial.', [{ t: 'Sí, restablecer', cls: 'red', fn: () => { S = defaults(); save(); applyTheme(); closeSheet(); render(); } }, { t: 'Cancelar', cls: 'ghost', fn: closeSheet }]); },

    'close-sheet'(el, e) { if (e.target === el) closeSheet(); },
    'sheet-btn'(el) { const f = sheetFns[+el.dataset.i]; if (f) f(); },

    /* juego */
    'g-sound'() { S.settings.sound = !S.settings.sound; save(); renderGame(); if (S.settings.sound) { unlockAudio(); sfx.pick(); } },
    'g-pausebtn'() { if (G.userPaused) { G.userPaused = false; releaseTimer(); } else { G.userPaused = true; holdTimer(); } renderGame(); },
    'g-skip'() { G.endAt = Date.now(); G.paused = false; tick(); },
    'g-reroll'() { const r = curRound(); r.ch = pickChar(); sfx.dice(); vib(20); renderGame(); },
    'g-add'() { G.endAt += 30000; G.dur += 30000; sfx.add(); toast('+30 segundos ⏱️'); tick(); },
    'g-done'() { releaseTimer(); G.userPaused = false; endDraw(); },
    'g-tojudge'() { G.phase = 'judge'; renderGame(); },
    'g-next'() { afterRound(); },
    'g-win'(el) {
      if (G.judging) return;
      const r = curRound(), w = +el.dataset.w;
      r.winner = w; G.judging = true; (w >= 0 ? sfx.point : sfx.pick)(); vib(20); renderGame();
      setTimeout(() => { G.judging = false; if (G) afterRound(); }, 550);
    },
    'g-rwin'(el) { G.rounds[+el.dataset.r].winner = +el.dataset.w; sfx.pick(); renderGame(); },
    'g-results'() { finish(); },
    'g-again'() { const was = G; exitGame(); if (was) startGame(); },
    'g-share': shareResults,
    'g-exit': exitGame,
    'g-quit'() {
      G.modalHeld = holdTimer();
      const resume = () => { closeSheet(); if (G && G.modalHeld) { releaseTimer(); G.modalHeld = false; } };
      const btns = [];
      const played = G.rounds.length;
      if (G.phase === 'final') return exitGame();
      if (played > 0) btns.push({ t: '🏁 Terminar y ver resultados', fn: () => { G.modalHeld = false; closeSheet(); endEarly(); } });
      btns.push({ t: 'Salir sin guardar', cls: 'red', fn: () => { G.modalHeld = false; exitGame(); } });
      btns.push({ t: 'Seguir jugando', cls: 'ghost', fn: resume });
      ask('¿Salir de la partida?', '', btns);
    }
  };

  function catEditor(id) {
    const c = id ? S.custom.find(x => x.id === id) : null;
    openSheet(`<h3>${c ? 'Editar categoría' : 'Nueva categoría'}</h3>
      <p>Un personaje por línea. Si querés, agregá de dónde es con una barra: <b>Fede|Mi familia</b></p>
      <div class="grid2"><div><label class="f" style="margin-top:0">Emoji</label><input type="text" id="ce-emoji" maxlength="4" value="${esc(c ? c.emoji : '⭐')}" style="text-align:center;width:100%"></div>
        <div><label class="f" style="margin-top:0">Nombre</label><input type="text" id="ce-name" maxlength="30" placeholder="Ej: Mi familia" value="${esc(c ? c.name : '')}" style="width:100%"></div></div>
      <label class="f">Personajes</label>
      <textarea id="ce-text" placeholder="Tío Carlos&#10;La abuela|Mi familia&#10;El gato Bigotes" autocapitalize="sentences">${esc(c ? c.text : '')}</textarea>
      <button class="btn" data-a="save-cat" ${c ? `data-id="${esc(c.id)}"` : ''}>Guardar</button>
      <button class="btn ghost" data-a="sheet-btn" data-i="0">Cancelar</button>`);
    sheetFns = [closeSheet];
  }

  const FORMS = {
    player(f) {
      const inp = f.elements.n, name = inp.value.trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (S.players.length >= MAX_PLAYERS) return toast(`Máximo ${MAX_PLAYERS} jugadores`);
      if (S.players.some(p => p.toLowerCase() === name.toLowerCase())) { inp.value = ''; return toast('Ya hay alguien con ese nombre'); }
      S.players.push(name); save(); render();
      const i = $('input[name=n]'); if (i) i.focus();
    }
  };

  /* ---------------------------- eventos ---------------------------- */
  document.addEventListener('click', e => {
    const el = e.target.closest('[data-a]');
    if (!el) return;
    const fn = A[el.dataset.a];
    if (fn) { fn(el, e); }
  });
  document.addEventListener('input', e => {
    if (e.target.id !== 'q') return;
    UI.q = e.target.value;
    const l = $('#catlist'); if (l) l.innerHTML = catListHTML();
  });
  document.addEventListener('submit', e => {
    const f = e.target.closest('[data-form]');
    if (!f) return;
    e.preventDefault();
    FORMS[f.dataset.form](f);
  });

  /* ---------------------------- arranque ---------------------------- */
  applyTheme();
  render(false);

  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => { }));
  }
})();
