/* =========================================================
   CROWSREST · w95.js  (item 48 · imersão 1997)
   Sons do sistema ligados aos eventos, protetor de tela (corvos,
   labirinto de neblina, texto rolando), relógio da bandeja com os
   dois-pontos piscando, botão Iniciar, "Sobre o SIIC" e a barra
   "Imprimindo..." da impressora matricial.
   Tudo daqui fica só no aparelho (localStorage).
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, clamp, ls, aviso, janela, fecharJanela } = CRW;
const Som = CRW.Som;
const toque = () => matchMedia('(pointer:coarse)').matches;

/* =========================================================
   SONS DO SISTEMA
   ========================================================= */
const sonsOn = () => ls.get('w95:sons', true);
const S = {
  abrir() { Som.tom(523, 0, 0.06, 'triangle', 0.035); Som.tom(784, 0.05, 0.09, 'triangle', 0.035); },
  fechar() { Som.tom(784, 0, 0.05, 'triangle', 0.025); Som.tom(523, 0.04, 0.07, 'triangle', 0.025); },
  asterisco() { Som.tom(880, 0, 0.18, 'sine', 0.035); Som.tom(1318, 0.06, 0.22, 'sine', 0.025); },
  desligar() { [523.2, 392, 329.6, 261.6].forEach((f, i) => Som.tom(f, i * 0.16, 1.2 - i * 0.15, 'triangle', 0.06)); Som.tom(130.8, 0.1, 1.6, 'sine', 0.05); },
  menu() { Som.tom(1200, 0, 0.03, 'square', 0.02); },
};
CRW.on('janela', ({ id, aberta }) => {
  if (!sonsOn() || /^w9-imp/.test(id || '')) return;
  if (aberta) { const j = $(`#janelas [data-jan="${id}"] .jan`); if (j && j.classList.contains('msgbox')) return; S.abrir(); }
  else S.fechar();
});
// avisos comuns (os de erro já tocam o som de erro no núcleo)
let ultAviso = 0;
const avisoEl = $('#aviso');
if (avisoEl && window.MutationObserver) new MutationObserver(() => {
  if (avisoEl.hidden || avisoEl.classList.contains('erro') || !sonsOn()) return;
  const t = Date.now(); if (t - ultAviso < 1500) return; ultAviso = t; S.asterisco();
}).observe(avisoEl, { attributes: true, attributeFilter: ['hidden', 'class'], childList: true });
// desligar: o acorde de abertura ao contrário ao sair
let tinhaPerfil = false;
CRW.on('perfil', v => { const tem = !!(CRW.P.mestre || CRW.P.aux || CRW.P.pc); if (tinhaPerfil && !tem && sonsOn()) S.desligar(); tinhaPerfil = tem; });

/* =========================================================
   IMPRESSORA: barra "Imprimindo..." enquanto o som toca
   ========================================================= */
const impOrig = Som.impressora.bind(Som);
Som.impressora = function () {
  impOrig();
  const w = janela({ id: 'w9-imp', titulo: 'Imprimindo', classe: 'msgbox w9-imp', largura: '360px', modal: false, icone: '⎙', html: `
    <div class="w9-imp-c"><div class="w9-imp-ico" aria-hidden="true"></div><div><p>Imprimindo documento em <b>LPT1:</b></p><p class="mini">Epson LX-300 · formulário contínuo</p></div></div>
    <div class="w9-prog" role="progressbar" aria-valuemin="0" aria-valuemax="100"><div class="w9-prog-i"></div></div>
    <div class="msg-bts"><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  const barra = $('.w9-prog-i', w), pr = $('.w9-prog', w), t0 = Date.now(), dur = 2300;
  const passo = () => {
    if (!document.body.contains(w)) return;
    const p = clamp((Date.now() - t0) / dur, 0, 1), n = Math.floor(p * 20);
    barra.style.width = (n * 5) + '%'; pr.setAttribute('aria-valuenow', n * 5);
    if (p < 1) setTimeout(passo, 110); else setTimeout(() => fecharJanela('w9-imp', true), 350);
  };
  passo();
};

/* =========================================================
   PROTETOR DE TELA
   ========================================================= */
const cfgPadrao = () => ({ ativo: !toque(), min: 3, tipo: 'corvos' });
const cfg = () => ({ ...cfgPadrao(), ...(ls.get('w95:prot', {}) || {}) });
const TIPOS = [['corvos', 'Corvos voando'], ['labirinto', 'Labirinto de neblina'], ['texto', 'Texto rolando: VIGILAT IN TENEBRIS']];

/* --- desenhistas: cada um recebe (ctx, w, h) e devolve { quadro(t, dt) } --- */
function corvo(ctx, x, y, s, fase, cor, dir = 1) {
  const f = Math.sin(fase);
  ctx.save(); ctx.translate(x, y); ctx.scale(dir * s, s); ctx.fillStyle = cor;
  ctx.beginPath(); ctx.ellipse(0, 0, 0.5, 0.13, 0, 0, Math.PI * 2); ctx.fill();               // corpo
  ctx.beginPath(); ctx.arc(0.5, -0.04, 0.11, 0, Math.PI * 2); ctx.fill();                     // cabeça
  ctx.beginPath(); ctx.moveTo(0.58, -0.07); ctx.lineTo(0.8, -0.01); ctx.lineTo(0.58, 0.02); ctx.fill(); // bico
  ctx.beginPath(); ctx.moveTo(-0.42, -0.05); ctx.lineTo(-0.82, -0.14); ctx.lineTo(-0.86, 0.08); ctx.lineTo(-0.42, 0.06); ctx.fill(); // cauda
  // asas (a de trás mais escura e menor)
  for (const [k, a] of [[0.85, 0.55], [1, 1]]) {
    ctx.globalAlpha = a;
    ctx.beginPath(); ctx.moveTo(0.22, -0.05);
    ctx.quadraticCurveTo(0.05, -0.75 * f * k, -0.32, -1.0 * f * k - 0.05);
    ctx.quadraticCurveTo(-0.12, -0.35 * f * k, -0.2, -0.02);
    ctx.closePath(); ctx.fill();
  }
  ctx.restore();
}
function protCorvos(ctx, w, h) {
  const bandos = Array.from({ length: Math.round(clamp(w / 60, 8, 22)) }, () => novo(true));
  function novo(inicio) { const z = Math.random(); return { x: inicio ? Math.random() * w : -80 - Math.random() * 200, y: h * (0.12 + Math.random() * 0.62), z, v: 35 + z * 80, s: 22 + z * 52, f: Math.random() * 6, fv: 7 + Math.random() * 4, dy: Math.random() * 6 }; }
  const lua = { x: w * 0.78, y: h * 0.22, r: Math.min(w, h) * 0.07 };
  return { quadro(t, dt) {
    const g = ctx.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#0b111a'); g.addColorStop(0.6, '#25303c'); g.addColorStop(1, '#3a4652');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    const gl = ctx.createRadialGradient(lua.x, lua.y, lua.r * 0.2, lua.x, lua.y, lua.r * 3); gl.addColorStop(0, 'rgba(200,205,190,.55)'); gl.addColorStop(0.3, 'rgba(160,170,160,.12)'); gl.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#c9ccbf'; ctx.beginPath(); ctx.arc(lua.x, lua.y, lua.r, 0, Math.PI * 2); ctx.fill();
    // neblina baixa
    for (let i = 0; i < 3; i++) { const yy = h * (0.72 + i * 0.09), off = (t * (8 + i * 5)) % w; const nb = ctx.createLinearGradient(0, yy - 40, 0, yy + 60); nb.addColorStop(0, 'rgba(120,130,140,0)'); nb.addColorStop(0.5, 'rgba(120,130,140,' + (0.08 + i * 0.03) + ')'); nb.addColorStop(1, 'rgba(120,130,140,0)'); ctx.fillStyle = nb; ctx.fillRect(-off, yy - 40, w * 2, 100); }
    bandos.sort((a, b) => a.z - b.z).forEach((c, i) => {
      c.x += c.v * dt; c.f += c.fv * dt; const y = c.y + Math.sin(t * 0.8 + c.dy) * 8;
      const cinza = Math.round(52 - c.z * 50);
      corvo(ctx, c.x, y, c.s, c.f, `rgb(${cinza},${cinza},${cinza + 4})`);
      if (c.x > w + 100) bandos[i] = novo(false);
    });
    // silhueta dos morros
    ctx.fillStyle = '#030406'; ctx.beginPath(); ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, h * 0.9 - Math.sin(x / 140) * 18 - Math.sin(x / 57) * 7);
    ctx.lineTo(w, h); ctx.fill();
  } };
}
function protLabirinto(ctx, w, h) {
  // labirinto 13x13 gerado por busca em profundidade
  const N = 13, M = Array.from({ length: N }, () => Array(N).fill(1));
  const pilha = [[1, 1]]; M[1][1] = 0;
  while (pilha.length) {
    const [x, y] = pilha[pilha.length - 1];
    const viz = [[2, 0], [-2, 0], [0, 2], [0, -2]].map(([dx, dy]) => [x + dx, y + dy, dx, dy]).filter(([a, b]) => a > 0 && b > 0 && a < N - 1 && b < N - 1 && M[b][a]);
    if (!viz.length) { pilha.pop(); continue; }
    const [a, b, dx, dy] = viz[Math.floor(Math.random() * viz.length)];
    M[y + dy / 2][x + dx / 2] = 0; M[b][a] = 0; pilha.push([a, b]);
  }
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const livre = (x, y) => M[y] && M[y][x] === 0;
  const ag = { cx: 1, cy: 1, d: 0, de: { x: 1.5, y: 1.5, a: 0 }, para: null, t: 0 };
  function proximo() {
    const ordem = [(ag.d + 1) % 4, ag.d, (ag.d + 3) % 4, (ag.d + 2) % 4]; // mão direita na parede
    for (const nd of ordem) { const [dx, dy] = DIRS[nd]; if (livre(ag.cx + dx, ag.cy + dy)) return nd; }
    return ag.d;
  }
  const RW = Math.max(120, Math.min(320, Math.round(w / 3))), RH = Math.round(RW * h / w);
  const off = document.createElement('canvas'); off.width = RW; off.height = RH; const o = off.getContext('2d');
  const ang = d => d * Math.PI / 2;
  return { quadro(t, dt) {
    if (!ag.para) {
      const nd = proximo();
      if (nd !== ag.d) ag.para = { x: ag.cx + 0.5, y: ag.cy + 0.5, a: ang(nd), d: nd, cx: ag.cx, cy: ag.cy, dur: 0.55 };
      else { const [dx, dy] = DIRS[nd]; ag.para = { x: ag.cx + dx + 0.5, y: ag.cy + dy + 0.5, a: ang(nd), d: nd, cx: ag.cx + dx, cy: ag.cy + dy, dur: 0.75 }; }
      ag.t = 0; ag.ini = { ...ag.de };
      let da = ag.para.a - ag.ini.a; while (da > Math.PI) da -= Math.PI * 2; while (da < -Math.PI) da += Math.PI * 2; ag.para.a = ag.ini.a + da;
    }
    ag.t += dt / ag.para.dur; const k = Math.min(1, ag.t), e = k * k * (3 - 2 * k);
    ag.de = { x: ag.ini.x + (ag.para.x - ag.ini.x) * e, y: ag.ini.y + (ag.para.y - ag.ini.y) * e, a: ag.ini.a + (ag.para.a - ag.ini.a) * e };
    if (k >= 1) { ag.cx = ag.para.cx; ag.cy = ag.para.cy; ag.d = ag.para.d; ag.de.a = ang(ag.d); ag.para = null; }
    // céu e chão
    const gc = o.createLinearGradient(0, 0, 0, RH / 2); gc.addColorStop(0, '#1c2128'); gc.addColorStop(1, '#4a525c'); o.fillStyle = gc; o.fillRect(0, 0, RW, RH / 2);
    const gf = o.createLinearGradient(0, RH / 2, 0, RH); gf.addColorStop(0, '#4d5560'); gf.addColorStop(1, '#22262c'); o.fillStyle = gf; o.fillRect(0, RH / 2, RW, RH / 2);
    const fov = 1.05;
    for (let c = 0; c < RW; c++) {
      const ra = ag.de.a + (c / RW - 0.5) * fov, rx = Math.cos(ra), ry = Math.sin(ra);
      let mx = Math.floor(ag.de.x), my = Math.floor(ag.de.y);
      const ddx = Math.abs(1 / (rx || 1e-6)), ddy = Math.abs(1 / (ry || 1e-6));
      const sx = rx < 0 ? -1 : 1, sy = ry < 0 ? -1 : 1;
      let sdx = (rx < 0 ? ag.de.x - mx : mx + 1 - ag.de.x) * ddx, sdy = (ry < 0 ? ag.de.y - my : my + 1 - ag.de.y) * ddy, lado = 0, i = 0;
      while (i++ < 40) { if (sdx < sdy) { sdx += ddx; mx += sx; lado = 0; } else { sdy += ddy; my += sy; lado = 1; } if (!livre(mx, my)) break; }
      let dist = lado === 0 ? sdx - ddx : sdy - ddy; dist *= Math.cos(ra - ag.de.a); dist = Math.max(dist, 0.05);
      const alt = Math.min(RH * 3, RH / dist), nev = 1 - Math.exp(-dist * 0.42);
      const hit = lado === 0 ? ag.de.y + dist / Math.cos(ra - ag.de.a) * ry : ag.de.x + dist / Math.cos(ra - ag.de.a) * rx;
      const tij = (Math.floor((hit % 1) * 4) % 2) ? 0.92 : 1;
      const b = (lado ? 150 : 178) * tij, rr = Math.round(b * (1 - nev) + 74 * nev), gg = Math.round((b - 4) * (1 - nev) + 82 * nev), bb = Math.round((b - 10) * (1 - nev) + 92 * nev);
      o.fillStyle = `rgb(${rr},${gg},${bb})`; o.fillRect(c, (RH - alt) / 2, 1, alt);
    }
    // neblina que passa
    for (let i = 0; i < 2; i++) { const x = ((t * (14 + i * 9)) % (RW * 2)) - RW; const g = o.createRadialGradient(x + RW / 2, RH * (0.45 + i * 0.15), 4, x + RW / 2, RH * (0.45 + i * 0.15), RW * 0.6); g.addColorStop(0, 'rgba(140,150,160,.22)'); g.addColorStop(1, 'rgba(140,150,160,0)'); o.fillStyle = g; o.fillRect(0, 0, RW, RH); }
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, h);
  } };
}
function protTexto(ctx, w, h) {
  const txt = 'VIGILAT IN TENEBRIS', tam = Math.round(clamp(h / 7, 40, 140));
  let x = w, y = h / 2, cor = 0;
  ctx.font = `${tam}px VT323, "Courier New", monospace`;
  const tw = () => ctx.measureText(txt).width;
  return { quadro(t, dt) {
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, w, h);
    ctx.font = `${tam}px VT323, "Courier New", monospace`; ctx.textBaseline = 'middle';
    x -= dt * Math.max(90, w / 7);
    if (x < -tw()) { x = w; y = tam / 2 + Math.random() * (h - tam); cor = (cor + 1) % 4; }
    const c = ['#c0392b', '#d8d8d8', '#38d04a', '#4f7fbf'][cor];
    ctx.fillStyle = c; ctx.shadowColor = c; ctx.shadowBlur = 12; ctx.fillText(txt, x, y); ctx.shadowBlur = 0;
  } };
}
const DESENHO = { corvos: protCorvos, labirinto: protLabirinto, texto: protTexto };
// roda um protetor num canvas; devolve a função que para
function rodar(canvas, tipo) {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  let w, h, ctx, d, raf = 0, t0 = performance.now(), ult = t0, vivo = true;
  const medir = () => { w = canvas.clientWidth || 320; h = canvas.clientHeight || 200; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); ctx = canvas.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); d = (DESENHO[tipo] || protCorvos)(ctx, w, h); };
  medir();
  const laco = agora => { if (!vivo) return; const dt = Math.min(0.1, (agora - ult) / 1000); ult = agora; try { d.quadro((agora - t0) / 1000, dt); } catch (e) { console.warn('protetor', e); } raf = requestAnimationFrame(laco); };
  raf = requestAnimationFrame(laco);
  const rs = () => medir(); addEventListener('resize', rs);
  return () => { vivo = false; cancelAnimationFrame(raf); removeEventListener('resize', rs); };
}

let ocioso = Date.now(), protetor = null;
const mexeu = () => { ocioso = Date.now(); };
['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, mexeu, { passive: true, capture: true }));
let px = 0, py = 0;
addEventListener('pointermove', e => { if (Math.abs(e.clientX - px) + Math.abs(e.clientY - py) > 4) { px = e.clientX; py = e.clientY; mexeu(); } }, { passive: true, capture: true });
addEventListener('scroll', mexeu, { passive: true, capture: true });
function podeProteger() {
  if (CRW.TV || protetor) return false;
  const boot = $('#boot'); if (boot && !boot.classList.contains('hidden')) return false;
  const a = document.activeElement; if (a && a.matches && a.matches('input, textarea, select, [contenteditable="true"]')) return false;
  if ($$('#janelas .jan').some(j => !j.classList.contains('w9-prop') && $('textarea, input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]):not([type=color]), select', j))) return false;
  return true;
}
function ligarProtetor(tipo) {
  if (protetor) return;
  const c = cfg(); tipo = tipo || c.tipo;
  const ov = el('div', 'w9-protetor', '<canvas></canvas>'); ov.setAttribute('aria-hidden', 'true');
  document.body.appendChild(ov);
  const parar = rodar($('canvas', ov), tipo), t = Date.now();
  let sai = false;
  const sair = e => {
    if (Date.now() - t < 600) return;           // ignora o próprio clique que ligou
    if (e && e.type === 'keydown') { e.preventDefault(); e.stopPropagation(); }
    if (sai) return; sai = true; parar();
    // o toque que desliga não pode cair no botão de baixo: some só depois do clique
    const fim = () => { ov.remove(); protetor = null; mexeu(); };
    if (e && (e.type === 'pointerdown')) { ov.addEventListener('click', fim, { once: true }); setTimeout(fim, 700); } else fim();
    removeEventListener('keydown', sair, true); ov.removeEventListener('pointerdown', sair); ov.removeEventListener('mousemove', mm);
  };
  let mx0 = null;
  const mm = e => { if (mx0 === null) { mx0 = [e.clientX, e.clientY]; return; } if (Math.abs(e.clientX - mx0[0]) + Math.abs(e.clientY - mx0[1]) > 12) sair(e); };
  ov.addEventListener('pointerdown', sair); ov.addEventListener('mousemove', mm); addEventListener('keydown', sair, true);
  ov.addEventListener('wheel', sair, { passive: true });
  protetor = { parar, ov, sair };
}
setInterval(() => {
  const c = cfg(); if (!c.ativo || document.hidden) return;
  if (Date.now() - ocioso > clamp(num(c.min, 3), 1, 120) * 60000 && podeProteger()) ligarProtetor();
}, 4000);
CRW.protetor = { ligar: ligarProtetor, cfg, rodar };

/* ---------- janela "Propriedades de Vídeo" ---------- */
function abrirVideo() {
  const c = cfg();
  const w = janela({ id: 'w9-video', titulo: 'Propriedades de Vídeo', classe: 'w9-prop', largura: '420px', icone: '▭', html: `
    <div class="abas95"><button class="aba95 on">Proteção de tela</button></div>
    <div class="w9-prop-c">
      <div class="w9-monitor"><div class="w9-tela"><canvas></canvas></div><div class="w9-base"></div></div>
      <label class="campo">Protetor de tela<select class="w95-input" data-p="tipo">${TIPOS.map(([v, n]) => `<option value="${v}"${v === c.tipo ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select></label>
      <div class="linha95"><label class="campo w9-inl">Esperar<input class="w95-input" type="number" min="1" max="120" value="${int(c.min, 3)}" data-p="min"></label><span class="mini">minutos sem toque nem tecla</span></div>
      <label class="chk95"><input type="checkbox" data-p="ativo"${c.ativo ? ' checked' : ''}> Ligar o protetor de tela neste aparelho</label>
      <p class="mini">${toque() ? 'No celular ele vem desligado (gasta bateria); ligue se quiser.' : 'Neste computador ele vem ligado.'} Nunca liga na tela de TV nem enquanto você digita. Qualquer toque, tecla ou movimento do mouse sai dele.</p>
    </div>
    <div class="msg-bts"><button class="w95-btn" data-ver>Visualizar</button><button class="w95-btn pri" data-ok>OK</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  const cv = $('canvas', w); let parar = rodar(cv, c.tipo);
  const tipo = $('[data-p="tipo"]', w);
  tipo.addEventListener('change', () => { parar(); parar = rodar(cv, tipo.value); });
  const ler = () => ({ tipo: tipo.value, min: clamp(int($('[data-p="min"]', w).value, 3), 1, 120), ativo: $('[data-p="ativo"]', w).checked });
  w.parentElement._aoFechar = () => parar();
  $('[data-ver]', w).addEventListener('click', () => { ls.set('w95:prot', ler()); ligarProtetor(tipo.value); });
  $('[data-ok]', w).addEventListener('click', () => { ls.set('w95:prot', ler()); parar(); w.parentElement._aoFechar = null; fecharJanela('w9-video'); aviso('Propriedades de vídeo salvas neste aparelho.'); });
}

/* ---------- "Sobre o SIIC" e Data/Hora ---------- */
function abrirSobre() {
  janela({ id: 'w9-sobre', titulo: 'Sobre o SIIC', classe: 'msgbox w9-sobre', largura: '420px', html: `
    <div class="w9-sobre-c"><svg class="w9-sobre-selo" aria-hidden="true"><use href="#seal"></use></svg><div>
      <p><b>SIIC · Sistema Integrado de Investigação Criminal</b></p>
      <p>Versão 4.0 · compilação ${esc(CRW.VERSAO)}</p>
      <p class="mini">Copyright © 1994-1997 Divisão de Informática da Polícia Estadual de West Virginia, Charleston. Todos os direitos reservados.</p>
      <hr class="w9-hr">
      <p class="mini">Licenciado para:<br><b>Departamento do Xerife do Condado de Crowsrest</b><br>Terminal SO-CRW-02 · nº de série CCSO-0114-97</p>
      <hr class="w9-hr">
      <p class="mini">Memória física disponível: 16.384 KB<br>Recursos do sistema: 71% livres<br>Conexão: ${CRW.Rede.fb() ? 'base estadual (tempo real)' : 'modo local'}</p>
      <p class="mini">Programação: Equipe de Sistemas Policiais, Charleston WV · Suporte técnico: ramal 2207, das 8h às 17h.</p></div></div>
    <div class="msg-bts"><button class="w95-btn pri" data-fechar>OK</button></div>` });
}
function abrirDataHora() {
  const pintar = w => { const r = CRW.relogio(); $('.w9-dh', w).innerHTML = `<p class="w9-dh-h">${pad2(r.h)}:${pad2(r.m)}:${pad2(r.s)}</p><p>${esc(CRW.diaSemana(r.data))}, ${esc(r.data)}</p><p class="mini">${r.real ? 'O Mestre ainda não acertou o relógio do jogo: esta é a hora deste aparelho.' : 'Hora do jogo, acertada pelo Guardião da Luz.'} ${CRW.ehNoite(r) ? 'É noite em Crowsrest.' : 'É dia em Crowsrest.'}</p>`; };
  const w = janela({ id: 'w9-dh', titulo: 'Propriedades de Data/Hora', classe: 'msgbox', largura: '340px', html: `<div class="w9-dh"></div><div class="msg-bts"><button class="w95-btn pri" data-fechar>OK</button></div>` });
  pintar(w); const t = setInterval(() => { if (!document.body.contains(w)) return clearInterval(t); pintar(w); }, 1000);
}

/* =========================================================
   BARRA DE BAIXO: botão Iniciar e bandeja com o relógio
   ========================================================= */
function montarBarra() {
  const sb = $('.app-win .statusbar'); if (!sb || $('.w9-iniciar', sb)) return;
  const ini = el('button', 'w9-iniciar', '<svg class="tb-seal" aria-hidden="true"><use href="#seal"></use></svg><b>Iniciar</b>');
  ini.setAttribute('aria-haspopup', 'menu'); ini.setAttribute('aria-expanded', 'false');
  sb.prepend(ini);
  const tray = el('span', 'sb-cell sb-time w9-tray', `<button class="w9-tray-b" data-w9-video title="Propriedades de Vídeo" aria-label="Propriedades de Vídeo">▭</button><button class="w9-tray-h" data-w9-dh title="Data e hora do jogo" aria-label="Data e hora do jogo"><span data-w9h>--</span><span class="w9-dp">:</span><span data-w9m>--</span></button>`);
  sb.appendChild(tray);
  document.body.classList.add('w9-com-bandeja');
  const menu = el('div', 'w9-menu win', `<div class="w9-faixa"><span>SIIC <b>97</b></span></div><div class="w9-itens" role="menu">
    <button role="menuitem" data-abre="tutorial"><span>?</span>Como Usar</button>
    <button role="menuitem" data-w9-video><span>▭</span>Propriedades de Vídeo…</button>
    <button role="menuitem" data-w9-sons><span>♪</span>Sons das janelas: <b data-w9-sv></b></button>
    <button role="menuitem" data-w9-dh><span>◷</span>Data e hora…</button>
    <button role="menuitem" data-w9-sobre><span>i</span>Sobre o SIIC…</button>
    <hr><button role="menuitem" data-w9-sair><span>⏻</span>Encerrar sessão…</button></div>`);
  menu.hidden = true; document.body.appendChild(menu);
  const fechar = () => { menu.hidden = true; ini.classList.remove('on'); ini.setAttribute('aria-expanded', 'false'); };
  ini.addEventListener('click', e => {
    e.stopPropagation();
    if (!menu.hidden) return fechar();
    $('[data-w9-sv]', menu).textContent = sonsOn() ? 'ligados' : 'desligados';
    $('[data-w9-sair]', menu).hidden = !(CRW.P.mestre || CRW.P.aux || CRW.P.pc);
    const r = sb.getBoundingClientRect(); menu.style.bottom = (innerHeight - r.top + 2) + 'px'; menu.style.left = Math.max(2, r.left) + 'px';
    menu.hidden = false; ini.classList.add('on'); ini.setAttribute('aria-expanded', 'true'); S.menu();
  });
  menu.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.matches('[data-w9-sons]')) { ls.set('w95:sons', !sonsOn()); $('[data-w9-sv]', menu).textContent = sonsOn() ? 'ligados' : 'desligados'; if (sonsOn()) S.asterisco(); return; }
    fechar();
    if (b.matches('[data-w9-sair]')) CRW.sair();
  });
  addEventListener('pointerdown', e => { if (!menu.hidden && !menu.contains(e.target) && !ini.contains(e.target)) fechar(); }, true);
  addEventListener('keydown', e => { if (e.key === 'Escape' && !menu.hidden) fechar(); });
  // relógio com os dois-pontos piscando
  CRW.on('tick', r => { const h = $('[data-w9h]', tray), m = $('[data-w9m]', tray); if (h) { h.textContent = pad2(r.h); m.textContent = pad2(r.m); } tray.classList.toggle('w9-pisca', (Date.now() / 1000 | 0) % 2 === 1); });
}
document.addEventListener('click', e => {
  if (e.target.closest('[data-w9-video]')) abrirVideo();
  if (e.target.closest('[data-w9-sobre]')) abrirSobre();
  if (e.target.closest('[data-w9-dh]')) abrirDataHora();
});
if (!CRW.TV) montarBarra();

CRW.registrarAjuda({ id: 'w9', titulo: 'Imersão 1997: sons, protetor de tela, relógio e impressora', ordem: 30, para: ['todos'], html: `<ul>
<li><b>Sons</b>: o site toca os sons do sistema (modem discando ao conectar, acorde ao entrar, acorde ao contrário ao sair, janelas abrindo e fechando, aviso, erro, impressora). <b>🔊 / 🔇</b> na barra de menu desliga tudo; em <b>Iniciar · Sons das janelas</b> você desliga só os de abrir e fechar janela e de aviso.</li>
<li><b>Protetor de tela</b>: depois de alguns minutos sem toque nem tecla (padrão: 3 minutos no computador; no celular vem desligado), a tela mostra <b>Corvos voando</b>, o <b>Labirinto de neblina</b> ou o <b>Texto rolando: VIGILAT IN TENEBRIS</b>. Qualquer toque, tecla ou movimento do mouse volta ao sistema. Ele nunca liga na tela de TV nem enquanto você digita. Configure em <b>Iniciar · Propriedades de Vídeo…</b> (escolha, tempo, ligar ou desligar e Visualizar), ou toque no ícone ▭ ao lado do relógio. <button class="w95-btn" data-w9-video>Abrir Propriedades de Vídeo</button></li>
<li><b>Relógio</b>: no canto de baixo, com os dois-pontos piscando, mostra a hora do jogo. Toque nele para ver a data, o dia da semana e se é dia ou noite em Crowsrest.</li>
<li><b>Impressora matricial</b>: relatórios e o manual saem num formulário contínuo; enquanto a impressora "toca", aparece a barra <b>Imprimindo</b>. Na janela que abrir, mande imprimir ou salve em PDF. Se nada abrir, libere as janelas pop-up para este site.</li>
<li><b>Iniciar · Sobre o SIIC</b> mostra a versão do sistema (a mesma do rodapé).</li></ul>` });
})();
