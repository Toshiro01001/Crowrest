/* =========================================================
   CROWSREST · mapa.js
   O mapa funcional da cidade: vista 2.5D (girar, ISO e de cima, zoom,
   régua), lotes clicáveis com cartão, plantas internas com andares,
   peças, névoa, relógio com dia e noite, clima, bloqueios nas saídas,
   gatilhos, som por bairro, sinais e marcadores do grupo, replay e
   perseguição de carro.
   Desenho em <canvas> com projeção própria (leve no celular).
   1 unidade do mapa = 25 metros. A cidade tem 64 x 64 unidades.
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, clamp, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela } = CRW;
/* ---------- regiões (cada uma é um mapa, como os andares da Planta) ---------- */
const REGIOES = CIDADE.regioes;
const REG = Object.fromEntries(REGIOES.map(r => [r.id, r]));
const REG0 = REGIOES[0].id;
const regDe = o => (o && REG[o.reg]) ? o.reg : REG0;
const T = 16;                       // pixels por unidade com zoom 1
const ALT = 0.55;                   // altura do prédio = alt x ALT unidades
const LOTE = Object.fromEntries(LOTES.map(l => [l.id, l]));
const fmtM = m => m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 1 : 2).replace('.', ',') + ' km' : Math.round(m) + ' m';
const fmtMin = m => { m = Math.max(1, Math.round(m)); return m < 60 ? m + ' min' : `${Math.floor(m / 60)} h${m % 60 ? ' ' + pad2(m % 60) : ''}`; };
const veTudo = () => CRW.veTudo();
const ehM = () => CRW.P.mestre;

/* =========================================================
   GEOMETRIA
   ========================================================= */
function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
  let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0; t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}
function distPolilinha(px, py, pts) { let d = 1e9; for (let i = 0; i < pts.length - 1; i++) d = Math.min(d, distSeg(px, py, pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1])); return d; }
function rectToca(r, folga, rg) {
  // amostra o retângulo e confere ruas e rio da região
  const pts = []; for (let i = 0; i <= 4; i++) for (let j = 0; j <= 4; j++) pts.push([r.x + r.w * i / 4, r.y + r.h * j / 4]);
  for (const ru of rg.ruas) { const lim = ru.largura / 2 + folga; if (pts.some(([x, y]) => distPolilinha(x, y, ru.pts) < lim)) return true; }
  const rio = rg.rio; if (rio && pts.some(([x, y]) => distPolilinha(x, y, rio.pts) < rio.largura / 2 + folga)) return true;
  return false;
}
const sobrepoe = (a, b, f = 0) => a.x < b.x + b.w + f && b.x < a.x + a.w + f && a.y < b.y + b.h + f && b.y < a.y + a.h + f;
const dentro = (r, x, y, f = 0) => x >= r.x - f && x <= r.x + r.w + f && y >= r.y - f && y <= r.y + r.h + f;
function noPoligono(x, y, p) { let d = false; for (let i = 0, j = p.length - 1; i < p.length; j = i++) { if (((p[i][1] > y) !== (p[j][1] > y)) && (x < (p[j][0] - p[i][0]) * (y - p[i][1]) / (p[j][1] - p[i][1]) + p[i][0])) d = !d; } return d; }
const lotesDa = id => LOTES.filter(l => regDe(l) === id);

/* ---------- casas e árvores geradas (sempre as mesmas, por região) ---------- */
function prng(s) { return () => { s = (s * 1664525 + 1013904223) % 4294967296; return s / 4294967296; }; }
const CASAS_R = {}, ARVORES_R = {}, LAMP_R = {};
(() => {
  let n = 0;
  REGIOES.forEach((rg, ri) => {
    const r = prng(1723 + ri * 101), l = [], lotes = lotesDa(rg.id);
    (typeof ZONAS_RESIDENCIAIS !== 'undefined' ? ZONAS_RESIDENCIAIS : []).filter(z => (z.reg || REG0) === rg.id).forEach(z => {
      const [cw, ch] = z.casa, passo = [cw + 0.7, ch + 0.8];
      let numero = 100 + Math.floor(r() * 300);
      for (let y = z.y; y + ch <= z.y + z.h + 0.01; y += passo[1]) for (let x = z.x; x + cw <= z.x + z.w + 0.01; x += passo[0]) {
        const c = { x: +(x + r() * 0.3).toFixed(2), y: +(y + r() * 0.3).toFixed(2), w: +(cw - r() * 0.5).toFixed(2), h: +(ch - r() * 0.4).toFixed(2) };
        if (c.x + c.w > rg.lado - 0.3 || c.y + c.h > rg.lado - 0.3) continue;
        if (rectToca(c, 0.25, rg) || lotes.some(lt => sobrepoe(lt, c, 0.3))) continue;
        numero += 2 + Math.floor(r() * 6); n++;
        l.push({ id: 'casa' + n, reg: rg.id, nome: 'Residência', cat: 'residencial', ...c, alt: 0.9 + r() * 0.5, end: `${z.rua}, ${numero}`, gerada: true, bairro: z.bairro, telhado: r() > 0.5, horario: null,
          pub: 'Casa de moradores do bairro. Sem registro especial no sistema.' });
      }
    });
    CASAS_R[rg.id] = l;
    // árvores: muitas onde o bairro é mata, poucas no resto
    const ar = [], r2 = prng(1997 + ri * 7), alvo = Math.min(520, Math.round(rg.lado * rg.lado / 24));
    for (let i = 0; i < alvo * 3 && ar.length < alvo; i++) {
      const x = r2() * rg.lado, y = r2() * rg.lado;
      const b = rg.bairros.find(b => dentro(b, x, y));
      if (!b || (!b.mata && r2() > 0.12)) continue;
      const c = { x: x - 0.3, y: y - 0.3, w: 0.6, h: 0.6 };
      if (rectToca(c, 0.4, rg) || lotes.some(lt => sobrepoe(lt, c, 0.3) && lt.cat !== 'natureza') || l.some(k => sobrepoe(k, c, 0.2))) continue;
      ar.push({ x, y, s: 0.5 + r2() * 0.5 });
    }
    ARVORES_R[rg.id] = ar;
    // postes: só nas ruas da cidade (rodovia só no Centro)
    const lp = [];
    rg.ruas.forEach(ru => { if (['trilha', 'ferrovia'].includes(ru.classe) || (ru.classe === 'rodovia' && !rg.urbano)) return; for (let i = 0; i < ru.pts.length - 1; i++) { const [a, b] = [ru.pts[i], ru.pts[i + 1]], d = Math.hypot(b[0] - a[0], b[1] - a[1]); for (let k = 1.5; k < d; k += 3.4) { const t = k / d; lp.push([a[0] + (b[0] - a[0]) * t + 0.9, a[1] + (b[1] - a[1]) * t + 0.9]); } } });
    LAMP_R[rg.id] = lp;
  });
})();
const CASAS = [].concat(...REGIOES.map(r => CASAS_R[r.id]));
const TODOS = () => [...lotesDa(view.reg), ...CASAS_R[view.reg]];
function loteEm(x, y, rg = view.reg) { return LOTES.find(l => regDe(l) === rg && dentro(l, x, y, 0.15)) || null; }
function bairroEm(x, y, rg = view.reg) { return (REG[rg] || REG[REG0]).bairros.find(b => dentro(b, x, y)) || null; }
// a "calçada" de um lote: o lado mais perto de uma rua, fora de outros lotes
const ladoFrente = {};
function frente(l, i = 0) {
  const rg = REG[regDe(l)], LADO = rg.lado;
  if (!ladoFrente[l.id]) {
    const cands = [
      { x: l.x + l.w / 2, y: l.y + l.h + 0.7, dx: 1, dy: 0 }, { x: l.x + l.w / 2, y: l.y - 0.7, dx: 1, dy: 0 },
      { x: l.x - 0.7, y: l.y + l.h / 2, dx: 0, dy: 1 }, { x: l.x + l.w + 0.7, y: l.y + l.h / 2, dx: 0, dy: 1 },
    ].filter(c => c.x > 0.5 && c.y > 0.5 && c.x < LADO - 0.5 && c.y < LADO - 0.5 && !LOTES.some(o => o !== l && regDe(o) === rg.id && dentro(o, c.x, c.y, 0.2)));
    cands.forEach(c => { c.d = Math.min(...rg.ruas.map(r => distPolilinha(c.x, c.y, r.pts))); });
    ladoFrente[l.id] = cands.sort((a, b) => a.d - b.d)[0] || { x: l.x + l.w / 2, y: l.y + l.h + 0.7, dx: 1, dy: 0 };
  }
  // espalha as peças ao longo da calçada, sem sair da frente do lote
  const f = ladoFrente[l.id], meio = (f.dx ? l.w : l.h) / 2 - 0.4, k = clamp((((i * 3) % 7) - 3) * 0.75, -meio, meio);
  return { reg: rg.id, x: +clamp(f.x + f.dx * k, 0.4, LADO - 0.4).toFixed(2), y: +clamp(f.y + f.dy * k, 0.4, LADO - 0.4).toFixed(2) };
}

/* =========================================================
   DISTÂNCIAS E ROTAS ENTRE REGIÕES
   Dentro de uma região: linha reta x fatorEstrada. Entre regiões: até o portal,
   a estrada da ligação (km) e do portal até o destino (o caminho mais curto).
   ========================================================= */
const FATOR = CIDADE.fatorEstrada || 1.3, VEL = CIDADE.velocidade || { pe: 4.5, carro: 50 };
const SAIDAS = () => [].concat(...REGIOES.map(r => (r.saidas || []).map(s => ({ ...s, reg: r.id }))));
const PORTAL = {}; REGIOES.forEach(r => (r.portais || []).forEach(p => { PORTAL[p.id] = { ...p, reg: r.id }; }));
const kmEntre = (rg, a, b) => Math.hypot(b.x - a.x, b.y - a.y) * REG[rg].metros / 1000 * FATOR;
function rotaEntre(a, b) {
  // a, b = { reg, x, y }. Devolve { km, segs: [{ reg, a, b, km } | { estrada, km }] }
  a = { reg: regDe(a), x: num(a.x), y: num(a.y) }; b = { reg: regDe(b), x: num(b.x), y: num(b.y) };
  const nos = { A: a, B: b, ...PORTAL }, arestas = {};
  const liga = (u, v, km, seg) => { (arestas[u] = arestas[u] || []).push({ v, km, seg }); };
  const noReg = rg => Object.keys(nos).filter(k => regDe(nos[k]) === rg);
  REGIOES.forEach(rg => { const ks = noReg(rg.id); ks.forEach(u => ks.forEach(v => { if (u !== v && v !== 'A' && u !== 'B') liga(u, v, kmEntre(rg.id, nos[u], nos[v]), { reg: rg.id, a: [nos[u].x, nos[u].y], b: [nos[v].x, nos[v].y] }); })); });
  (CIDADE.ligacoes || []).forEach(([p, q, km, nome]) => { if (!PORTAL[p] || !PORTAL[q]) return; liga(p, q, km, { estrada: nome }); liga(q, p, km, { estrada: nome }); });
  const dist = { A: 0 }, ant = {}, feito = new Set();
  for (;;) {
    let u = null; Object.keys(dist).forEach(k => { if (!feito.has(k) && (u === null || dist[k] < dist[u])) u = k; });
    if (u === null || u === 'B') break; feito.add(u);
    (arestas[u] || []).forEach(e => { const d = dist[u] + e.km; if (dist[e.v] === undefined || d < dist[e.v]) { dist[e.v] = d; ant[e.v] = { u, e }; } });
  }
  if (dist.B === undefined) return null;
  const segs = []; let k = 'B';
  while (ant[k]) { segs.unshift({ ...ant[k].e.seg, km: ant[k].e.km }); k = ant[k].u; }
  return { km: dist.B, segs: segs.filter(s => s.km > 0.0005 || s.estrada), cruza: segs.some(s => s.estrada) || new Set(segs.filter(s => s.reg).map(s => s.reg)).size > 1 };
}
const minutosDe = (km, modo) => modo === 'carro' ? km / VEL.carro * 60 + (km > 0.3 ? 1 : 0) : km / VEL.pe * 60;

/* =========================================================
   ESTADO DO MAPA (lido de estado/ e de caso/)
   ========================================================= */
const S = () => Estado.get();
const conhecido = l => l.conhecido !== false || !!((S().lotesRev || {})[l.id]);
function aberto(l, r) {
  if (!l.horario) return null;
  r = r || CRW.relogio(); const h = r.h + r.m / 60, [a, f] = l.horario;
  if (a === 0 && f >= 24) return true;
  return f > 24 ? (h >= a || h < f - 24) : (h >= a && h < f);
}
function luzDoDia(r) {
  r = r || CRW.relogio(); const h = r.h + r.m / 60;
  if (h >= 7 && h < 18) return 0;
  if (h >= 18 && h < 20.5) return (h - 18) / 2.5;
  if (h >= 5 && h < 7) return 1 - (h - 5) / 2;
  return 1;
}
const clima = () => S().clima || {};
const semLuz = () => clima().luz === false || ((S().apagao || {}).tipo === 'energia');
const nivelNevoa = () => clamp(num(clima().neblina) + CRW.sangria() * 0.25 + ((S().apagao || {}).tipo === 'neblina' ? 3 : 0), 0, 5);
const cfgViagem = () => S().viagemCfg || {};
// minuto absoluto do jogo (para as viagens andarem com o relógio do jogo)
function agoraJogo() {
  const r = CRW.relogio(); if (r.real) return Date.now() / 60000;
  const [dd, mm, aa] = String(r.data).split('/').map(Number);
  return Date.UTC(aa || 1997, (mm || 1) - 1, dd || 1) / 60000 + r.minDia + r.s / 60;
}
const horaDe = abs => { const d = new Date(abs * 60000); return `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())}`; };
function tokens() {
  const v = CRW.v(); const t = S().tokens || {};
  return Object.values(t).filter(k => k && k.id && (!k.h || v.mestre || v.aux));
}
function nomeDe(tk) { const s = CRW.ser(tk.id) || {}; return s.nome || tk.nome || tk.id; }
function corDe(tk) { const s = CRW.ser(tk.id) || {}; return s.cor || tk.cor || (tk.tipo === 'pc' ? '#c0392b' : '#555'); }
function curtoDe(tk) { const s = CRW.ser(tk.id) || {}; return s.curto || CRW.iniciais(s.nome || tk.id); }
// posição de uma peça em ronda: calculada pelo relógio real (todos veem igual, sem gravar)
function posRonda(tk) {
  const r = tk.ronda; if (!r || !r.pts || r.pts.length < 2 || !r.ativo) return null;
  const pts = r.pts.map(p => typeof p === 'string' ? (LOTE[p] ? frente(LOTE[p]) : null) : { x: p[0], y: p[1], reg: regDe(tk) }).filter(Boolean);
  if (pts.length < 2) return null;
  const rg = pts[0].reg || REG0, ok = pts.filter(p => (p.reg || REG0) === rg); if (ok.length < 2) return null;
  const segs = []; let tot = 0;
  for (let i = 0; i < ok.length; i++) { const a = ok[i], b = ok[(i + 1) % ok.length]; const d = Math.hypot(b.x - a.x, b.y - a.y); segs.push([a, b, d]); tot += d; }
  let d = ((Date.now() - num(r.ts)) / 60000 * num(r.vel, 6)) % tot;
  for (const [a, b, l] of segs) { if (d <= l) { const k = l ? d / l : 0; return { reg: rg, x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k }; } d -= l; }
  return { reg: rg, x: ok[0].x, y: ok[0].y };
}
// viagem em andamento: { ini (minuto do jogo), dur (min), km, modo, rota: [segmentos], para: { reg, x, y, lote } }
function progressoViagem(vg) { if (!vg || !vg.ini) return 1; return clamp((agoraJogo() - num(vg.ini)) / Math.max(0.01, num(vg.dur)), 0, 1); }
function posViagem(vg) {
  const f = progressoViagem(vg); if (f >= 1) return null;
  const segs = vg.rota || []; let d = f * num(vg.km);
  for (const s of segs) {
    if (d <= num(s.km) + 1e-9) {
      if (s.estrada) return { reg: null, estrada: s.estrada, x: 0, y: 0 };
      const k = num(s.km) ? d / num(s.km) : 1; return { reg: s.reg, x: s.a[0] + (s.b[0] - s.a[0]) * k, y: s.a[1] + (s.b[1] - s.a[1]) * k, andando: true };
    }
    d -= num(s.km);
  }
  return null;
}
// veículos dos jogadores: definição em estado/veiculos (Guardião) e posição em caso/veiculos (qualquer um do grupo grava)
let veicPos = {};
const veicDefs = () => S().veiculos || {};
function posVeiculo(id) {
  const st = veicPos[id] || {}, def = veicDefs()[id]; if (!def) return null;
  const pv = st.viagem && posViagem(st.viagem); if (pv) return pv;
  if (st.viagem && st.viagem.para && progressoViagem(st.viagem) >= 1) return { reg: regDe(st.viagem.para), x: num(st.viagem.para.x), y: num(st.viagem.para.y) };
  if (st.reg || st.x != null) return { reg: regDe(st), x: num(st.x, 10), y: num(st.y, 10) };
  return { reg: regDe(def), x: num(def.x, 10), y: num(def.y, 10) };
}
function posDe(tk) {
  if (tk.veic && veicDefs()[tk.veic]) { const p = posVeiculo(tk.veic); if (p) return { ...p, carro: tk.veic }; }
  const pr = posRonda(tk); if (pr) return pr;
  const pv = tk.viagem && posViagem(tk.viagem); if (pv) return pv;
  if (tk.viagem && tk.viagem.para && progressoViagem(tk.viagem) >= 1) return { reg: regDe(tk.viagem.para), x: num(tk.viagem.para.x), y: num(tk.viagem.para.y) };
  const rg = REG[regDe(tk)];
  return { reg: rg.id, x: num(tk.x, rg.lado / 2), y: num(tk.y, rg.lado / 2) };
}
const emViagem = tk => !!(tk && ((tk.viagem && progressoViagem(tk.viagem) < 1) || (tk.veic && (veicPos[tk.veic] || {}).viagem && progressoViagem(veicPos[tk.veic].viagem) < 1)));
const naRua = tk => !tk.loc || tk.loc === 'c';
function ondeEsta(id) {
  const tk = (S().tokens || {})[id]; if (!tk) return null;
  if (!naRua(tk)) { const [, int] = tk.loc.split(':'); const l = LOTES.find(x => x.interior === int); return l ? l.id : null; }
  const p = posDe(tk); if (!p.reg || p.andando) return null; const l = lotePerto(p.x, p.y, p.reg); return l ? l.id : null;
}
// a peça conta como "no local" se estiver nele ou na calçada dele (até 1 unidade)
function distRect(r, x, y) { const dx = Math.max(r.x - x, 0, x - (r.x + r.w)), dy = Math.max(r.y - y, 0, y - (r.y + r.h)); return Math.hypot(dx, dy); }
function lotePerto(x, y, rg = view.reg) { let m = null, d0 = 1.01; LOTES.forEach(l => { if (regDe(l) !== rg) return; const d = distRect(l, x, y); if (d < d0) { d0 = d; m = l; } }); return m; }
// região onde a peça está agora (dentro de prédio: a do prédio)
function regiaoDe(tk) {
  if (!tk) return null;
  if (!naRua(tk)) { const [, int] = tk.loc.split(':'); const l = LOTES.find(x => x.interior === int); return l ? regDe(l) : REG0; }
  return posDe(tk).reg;
}
// grupo (assina depois do login: caso/ exige conta)
let marcadores = {}, sinais = {}, assinou = false;
function assinarGrupo() {
  if (assinou) return; assinou = true;
  Rede.on('caso/marcadores', x => { marcadores = x || {}; sujo(); }, () => {});
  Rede.on('caso/veiculos', x => { veicPos = x || {}; sujo(); vigiar(S()); if (raiz) { atualizarRegioes(); if (cartaoAtual && cartaoAtual.tipo === 'veic' && !$('.mp-cartao', raiz).contains(document.activeElement)) abrirVeiculo(cartaoAtual.id); } }, () => {});
  Rede.on('caso/sinais', x => {
    const novo = x || {};
    Object.entries(novo).forEach(([k, s]) => { if (!sinais[k] && s && Date.now() - num(s.ts) < 15000) { CRW.Som.tom(1568, 0, 0.12, 'sine', 0.06); CRW.Som.tom(2093, 0.12, 0.18, 'sine', 0.05); } });
    sinais = novo; sujo(true);
  }, () => {});
}

/* =========================================================
   CÂMERA E PROJEÇÃO
   rot: giro em graus; tilt: inclinação (0 = de cima); s: zoom; px/py: arrasto
   ========================================================= */
const cam = { rot: CRW.ls.get('mpRot', 18), tilt: CRW.ls.get('mpTilt', 46), s: 1, px: 0, py: 0 };
const camI = { rot: 0, tilt: 40, s: 1, px: 0, py: 0 };
const view = { modo: 'cidade', reg: REG[CRW.ls.get('mpReg', REG0)] ? CRW.ls.get('mpReg', REG0) : REG0, int: null, andar: null, sel: null, selTk: null, ferr: null, replay: null, salaSel: null };
const R = () => REG[view.reg] || REG[REG0];
let cv = null, cx = null, W = 0, H = 0, DPR = 1, raiz = null;
const mundo = () => view.modo === 'cidade' ? { c: cam, ox: R().lado / 2, oy: R().lado / 2, t: T } : { c: camI, ox: 6, oy: 5, t: 58 };
function proj(x, y, z = 0, m = mundo()) {
  const c = m.c, th = c.rot * Math.PI / 180, ti = c.tilt * Math.PI / 180;
  const ux = (x - m.ox) * m.t, uy = (y - m.oy) * m.t;
  const rx = ux * Math.cos(th) - uy * Math.sin(th), ry = ux * Math.sin(th) + uy * Math.cos(th);
  return [W / 2 + c.px + rx * c.s, H / 2 + c.py + (ry * Math.cos(ti) - z * m.t * Math.sin(ti)) * c.s, ry];
}
function telaParaChao(sx, sy, m = mundo()) {
  const c = m.c, th = c.rot * Math.PI / 180, ti = c.tilt * Math.PI / 180;
  const rx = (sx - W / 2 - c.px) / c.s, ry = (sy - H / 2 - c.py) / c.s / Math.max(0.2, Math.cos(ti));
  const ux = rx * Math.cos(th) + ry * Math.sin(th), uy = -rx * Math.sin(th) + ry * Math.cos(th);
  return { x: ux / m.t + m.ox, y: uy / m.t + m.oy };
}
const prof = (x, y, m = mundo()) => { const th = m.c.rot * Math.PI / 180; return (x - m.ox) * Math.sin(th) + (y - m.oy) * Math.cos(th); };
function enquadrar() {
  const m = mundo(), c = m.c, lado = view.modo === 'cidade' ? R().lado : 13;
  const ti = c.tilt * Math.PI / 180, alt = lado * m.t * (Math.cos(ti) + 0.25 * Math.sin(ti));
  c.s = clamp(Math.min(W / (lado * m.t * 1.12), H / (alt * 1.05)), 0.05, 6); c.px = 0; c.py = 0; sujo();
}
function focar(x, y, zoom) {
  const m = mundo(), c = m.c; if (zoom) c.s = clamp(zoom, 0.05, 6);
  const th = c.rot * Math.PI / 180, ti = c.tilt * Math.PI / 180, ux = (x - m.ox) * m.t, uy = (y - m.oy) * m.t;
  c.px = -(ux * Math.cos(th) - uy * Math.sin(th)) * c.s; c.py = -((ux * Math.sin(th) + uy * Math.cos(th)) * Math.cos(ti)) * c.s; sujo();
}
function zoomEm(sx, sy, k) {
  const c = mundo().c, novo = clamp(c.s * k, 0.05, 6); k = novo / c.s;
  const mx = sx - W / 2, my = sy - H / 2; c.px = mx - (mx - c.px) * k; c.py = my - (my - c.py) * k; c.s = novo; sujo();
}
function salvarCam() { CRW.ls.set('mpRot', cam.rot); CRW.ls.set('mpTilt', cam.tilt); }

/* =========================================================
   CORES (a noite escurece as cores; as luzes acendem por cima)
   ========================================================= */
const rgb = h => { h = String(h || '#888').replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); const n = parseInt(h, 16); return [n >> 16 & 255, n >> 8 & 255, n & 255]; };
let NOITE = 0, CHUVA = 0;
function cor(h, k = 1, a = 1) {
  const [r, g, b] = Array.isArray(h) ? h : rgb(h);
  const n = NOITE * 0.7, c = CHUVA * 0.12;
  const f = (v, alvo) => Math.round(clamp(v * k * (1 - n - c) + alvo * (n + c), 0, 255));
  return `rgba(${f(r, 14)},${f(g, 18)},${f(b, 40)},${a})`;
}
function poli(pts, fill, stroke, lw = 1) { cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.closePath(); if (fill) { cx.fillStyle = fill; cx.fill(); } if (stroke) { cx.strokeStyle = stroke; cx.lineWidth = lw; cx.stroke(); } }
function linha(pts, cor, lw, dash) { cx.beginPath(); pts.forEach((p, i) => i ? cx.lineTo(p[0], p[1]) : cx.moveTo(p[0], p[1])); cx.strokeStyle = cor; cx.lineWidth = lw; cx.setLineDash(dash || []); cx.lineCap = 'round'; cx.lineJoin = 'round'; cx.stroke(); cx.setLineDash([]); }

/* =========================================================
   DESENHO DA CIDADE
   ========================================================= */
let sujoF = true, animado = false, ultimo = 0, rotulos = [];
function sujo(anim) { sujoF = true; if (anim) animado = true; }
const relampago = { t: 0 };
let quadro = 0;
function desenhar() {
  if (!cx) return;
  quadro++;
  const r = CRW.relogio();
  NOITE = luzDoDia(r); CHUVA = num(clima().chuva);
  cx.setTransform(DPR, 0, 0, DPR, 0, 0);
  cx.fillStyle = cor('#2a3326'); cx.fillRect(0, 0, W, H);
  rotulos = [];
  if (view.modo === 'cidade') desenharCidade(r); else desenharInterior();
  efeitos(r);
}
function caixa(r, h, base, op = {}) {
  // r = {x,y,w,h}; h em unidades; desenha os lados visíveis e o telhado
  const z0 = op.z0 || 0, c = [[r.x, r.y], [r.x + r.w, r.y], [r.x + r.w, r.y + r.h], [r.x, r.y + r.h]];
  const th = cam.rot * Math.PI / 180, a = op.alpha == null ? 1 : op.alpha;
  const normais = [[0, -1], [1, 0], [0, 1], [-1, 0]];
  const lados = [];
  for (let i = 0; i < 4; i++) {
    const [nx, ny] = normais[i], nry = nx * Math.sin(th) + ny * Math.cos(th), nrx = nx * Math.cos(th) - ny * Math.sin(th);
    if (nry <= 0.001 || cam.tilt < 2) continue;
    const A = c[i], B = c[(i + 1) % 4];
    lados.push({ pts: [proj(A[0], A[1], z0), proj(B[0], B[1], z0), proj(B[0], B[1], z0 + h), proj(A[0], A[1], z0 + h)], k: 0.55 + 0.2 * nrx + 0.1 * nry, A, B });
  }
  lados.forEach(l => {
    poli(l.pts, cor(base, l.k, a), op.contorno ? cor('#000', 1, 0.35 * a) : null, 0.6);
    if (op.janelas && h > 0.35) janelasNoLado(l, h, z0, op.janelas);
  });
  const topo = c.map(([x, y]) => proj(x, y, z0 + h));
  poli(topo, cor(op.teto || base, op.kTeto || 1.12, a), cor('#000', 1, 0.3 * a), 0.7);
  return topo;
}
function janelasNoLado(l, h, z0, modo) {
  const [A, B] = [l.A, l.B], len = Math.hypot(B[0] - A[0], B[1] - A[1]), n = clamp(Math.floor(len / 0.9), 1, 8), andares = clamp(Math.floor(h / 0.45), 1, 5);
  const acesas = modo === 'acesas';
  for (let i = 0; i < n; i++) for (let j = 0; j < andares; j++) {
    const u0 = (i + 0.3) / n, u1 = (i + 0.7) / n, v0 = z0 + h * (j + 0.35) / (andares + 0.2), v1 = z0 + h * (j + 0.75) / (andares + 0.2);
    const P = (u, v) => proj(A[0] + (B[0] - A[0]) * u, A[1] + (B[1] - A[1]) * u, v);
    const liga = acesas && ((i * 7 + j * 3 + Math.floor(len * 10)) % 5 !== 0);
    poli([P(u0, v0), P(u1, v0), P(u1, v1), P(u0, v1)], liga ? `rgba(255,214,120,${0.55 + 0.4 * NOITE})` : cor('#1d2733', 1, 0.75));
  }
}
function desenharCidade(r) {
  const s = cam.s, rg = R(), LADO = rg.lado, urb = !!rg.urbano;
  // chão, bairros
  const borda = [[0, 0], [LADO, 0], [LADO, LADO], [0, LADO]].map(([x, y]) => proj(x, y));
  poli(borda, cor(urb ? '#55654a' : '#4e6145'));
  const tons = { centro: '#6b6e62', kettle: '#5d6e4c', fundicao: '#6a6253', cinder: '#655f54', pulptown: '#625f55', margem: '#5c6957', vale: '#4b6342', colina: '#566848', hollow: '#4d6244' };
  rg.bairros.forEach(b => poli([[b.x, b.y], [b.x + b.w, b.y], [b.x + b.w, b.y + b.h], [b.x, b.y + b.h]].map(([x, y]) => proj(x, y)), cor(tons[b.id] || '#5a6450', 1, 0.55)));
  // rio
  const rio = rg.rio;
  if (rio) { const rp = rio.pts.map(([x, y]) => proj(x, y)); linha(rp, cor('#2c4a63'), rio.largura * T * s * 1.05); linha(rp, cor('#3d6684'), rio.largura * T * s * 0.75); }
  // ruas
  const largEsc = k => Math.max(1.5, k * T * s);
  rg.ruas.forEach(ru => {
    const p = ru.pts.map(([x, y]) => proj(x, y));
    if (ru.classe === 'ferrovia') { linha(p, cor('#3a3128'), largEsc(ru.largura + 0.2)); linha(p, cor('#8a7a66', 1, 0.9), Math.max(1, largEsc(ru.largura) * 0.35), [Math.max(2, 3 * s), Math.max(2, 3 * s)]); return; }
    const base = ru.classe === 'trilha' ? '#7d6a4c' : ru.classe === 'beco' ? '#4a4a48' : '#3b3d40';
    linha(p, cor('#25272a'), largEsc(ru.largura + 0.35));
    linha(p, cor(base), largEsc(ru.largura));
    if (ru.classe === 'rodovia' || ru.classe === 'av') linha(p, cor('#c9a227', 1, 0.8), Math.max(1, 0.08 * T * s), [6 * s, 7 * s]);
  });
  (rg.pontes || []).forEach(pt => { const a = proj(pt.x, pt.y - 1.8), b = proj(pt.x, pt.y + 1.8); linha([a, b], cor('#8a8f96'), largEsc(2.2)); linha([a, b], cor('#45474b'), largEsc(1.7)); });
  // portais: placa da estrada para a outra região
  (rg.portais || []).forEach(pt => {
    const dest = destinoPortal(pt.id); if (!dest) return;
    const p = proj(pt.x, pt.y, 0.2);
    rotulos.push({ x: p[0], y: p[1], t: `➜ ${dest.reg.num} · ${dest.reg.nome}${dest.km ? ' · ' + fmtM(dest.km * 1000) : ''}`, cls: 'portal', pri: 8 });
  });
  // saídas do condado e bloqueios
  const bloq = S().bloqueios || {};
  (rg.saidas || []).forEach(sd => {
    const p = proj(sd.x, sd.y);
    if (bloq[sd.id]) {
      const pisca = Math.floor(Date.now() / 350) % 2;
      cx.fillStyle = pisca ? '#ff3030' : '#3060ff'; cx.beginPath(); cx.arc(p[0] - 9, p[1] - 10, 4, 0, 7); cx.fill();
      cx.fillStyle = pisca ? '#3060ff' : '#ff3030'; cx.beginPath(); cx.arc(p[0] + 9, p[1] - 10, 4, 0, 7); cx.fill();
      cx.save(); cx.translate(p[0], p[1]); cx.fillStyle = '#f0c419'; cx.fillRect(-14, -4, 28, 7); cx.fillStyle = '#111'; for (let i = -14; i < 14; i += 7) { cx.beginPath(); cx.moveTo(i, -4); cx.lineTo(i + 4, -4); cx.lineTo(i + 1, 3); cx.lineTo(i - 3, 3); cx.fill(); } cx.restore();
      animado = true;
      rotulos.push({ x: p[0], y: p[1] + 16, t: 'BLOQUEIO', cls: 'bloq', pri: 9 });
    } else rotulos.push({ x: p[0], y: p[1], t: 'SAÍDA DO CONDADO', cls: 'saida', pri: 2 });
  });
  // objetos com volume, do fundo para a frente
  const itens = [];
  const v = CRW.v();
  lotesDa(rg.id).forEach(l => itens.push({ d: prof(l.x + l.w / 2, l.y + l.h / 2), f: () => desenharLote(l, r, v) }));
  CASAS_R[rg.id].forEach(c => itens.push({ d: prof(c.x + c.w / 2, c.y + c.h / 2), f: () => desenharCasa(c) }));
  ARVORES_R[rg.id].forEach(a => itens.push({ d: prof(a.x, a.y), f: () => arvore(a) }));
  const dentroDe = {};
  tokensVisiveis().forEach(tk => {
    if (!naRua(tk)) { const [, int] = tk.loc.split(':'); dentroDe[int] = (dentroDe[int] || 0) + 1; return; }
    if (tk.veic && veicDefs()[tk.veic]) return; // vai dentro do carro
    const p = view.drag && view.drag.id === tk.id ? { ...view.drag, reg: rg.id } : posDe(tk);
    if (p.reg !== rg.id) return;
    if (p.andando) animado = true;
    itens.push({ d: prof(p.x, p.y) + 0.05, f: () => peca(tk, p) });
  });
  veiculosNaRegiao(rg.id).forEach(vc => { const p = view.drag && view.drag.id === 'v:' + vc.id ? view.drag : vc.p; if (vc.p.andando) animado = true; itens.push({ d: prof(p.x, p.y) + 0.06, f: () => carro(vc, p) }); });
  Object.entries(marcadores).forEach(([k, mk]) => { if (mk && regDe(mk) === rg.id) itens.push({ d: prof(mk.x, mk.y) + 0.02, f: () => marcador(k, mk) }); });
  itens.sort((a, b) => a.d - b.d).forEach(i => i.f());
  // quantos estão dentro de cada prédio
  Object.entries(dentroDe).forEach(([int, n]) => { const l = LOTES.find(x => x.interior === int); if (!l || regDe(l) !== rg.id || (!conhecido(l) && !v.mestre && !v.aux)) return; const p = proj(l.x + l.w / 2, l.y + l.h / 2, l.alt * ALT + 0.2); rotulos.push({ x: p[0], y: p[1] - 14, t: `● ${n} dentro`, cls: 'dentro', pri: 8 }); });
  // luzes de rua
  if (NOITE > 0.15 && !semLuz()) {
    cx.save(); cx.globalCompositeOperation = 'lighter';
    LAMP_R[rg.id].forEach(([x, y]) => { const p = proj(x, y, 0.15), rr = Math.max(6, 1.6 * T * s); const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); g.addColorStop(0, `rgba(255,200,110,${0.32 * NOITE})`); g.addColorStop(1, 'rgba(255,200,110,0)'); cx.fillStyle = g; cx.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2); });
    cx.restore();
  }
  // sirene
  if (Date.now() - num(clima().sirene) < 30000) {
    animado = true; const pisca = Math.floor(Date.now() / 300) % 2;
    ['bombeiros', 'delegacia'].forEach(id => { const l = LOTE[id]; if (!l || regDe(l) !== rg.id) return; const p = proj(l.x + l.w / 2, l.y + l.h / 2, l.alt * ALT + 0.4); const rr = 3 * T * s; cx.save(); cx.globalCompositeOperation = 'lighter'; const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); g.addColorStop(0, pisca ? 'rgba(255,40,40,.55)' : 'rgba(40,90,255,.55)'); g.addColorStop(1, 'rgba(0,0,0,0)'); cx.fillStyle = g; cx.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2); cx.restore(); });
  }
  // perseguição: linha entre perseguidor e fugitivo
  const pe = S().perseguicao;
  if (pe && pe.ativa) {
    const a = (S().tokens || {})[pe.a], b = (S().tokens || {})[pe.b];
    if (a && b) { const pa = posDe(a), pb = posDe(b); if (pa.reg === rg.id && pb.reg === rg.id) { linha([proj(pa.x, pa.y, 0.5), proj(pb.x, pb.y, 0.5)], Math.floor(Date.now() / 400) % 2 ? '#ff4040' : '#ffd040', 2.5, [8, 6]); animado = true; } }
  }
  desenharViagens(rg.id);
  desenharSinais(); desenharRegua(); desenharRotulos(s);
}
function desenharLote(l, r, v) {
  const s = cam.s, sel = view.sel === l.id, cat = CATEGORIAS[l.cat] || {}, h = l.alt * ALT;
  const conh = conhecido(l);
  if (!conh && !v.mestre && !v.aux) { nuvem(l); return; }
  const alfa = conh ? 1 : 0.55;
  if (l.cat === 'natureza' || l.cat === 'cena' || h < 0.12) {
    const pts = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]].map(([x, y]) => proj(x, y, 0.02));
    poli(pts, cor(l.cat === 'cena' ? '#4a3434' : l.id === 'praca' ? '#7a6f5a' : '#4f6a45', 1, alfa), sel ? '#ffe36b' : cor(cat.cor || '#888', 1, 0.8), sel ? 2.5 : 1.2);
    if (l.cat === 'cena') { caixa({ x: l.x + 0.8, y: l.y + 0.45, w: 1.3, h: 0.7 }, 0.35, '#7a5230', { alpha: alfa }); const fita = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h], [l.x, l.y]].map(([x, y]) => proj(x, y, 0.15)); linha(fita, '#f0c419', 1.5, [4, 3]); }
    if (l.id === 'mina') caixa({ x: l.x + 2, y: l.y + 1.5, w: 2, h: 1.2 }, 0.5, '#2b2620', { alpha: alfa });
    if (l.cruzes) for (let i = 0; i < 14; i++) { const x = l.x + 0.6 + (i % 7) * (l.w - 1.2) / 6, y = l.y + 0.8 + Math.floor(i / 7) * (l.h - 1.6); const a = proj(x, y, 0), b = proj(x, y, 0.35); linha([a, b], cor('#c9c3b5'), 1.3); const c1 = proj(x - 0.12, y, 0.26), c2 = proj(x + 0.12, y, 0.26); linha([c1, c2], cor('#c9c3b5'), 1.3); }
    if (l.id === 'mirante') { for (let i = 0; i < 5; i++) { const p = proj(l.x + 1 + i * 0.8, l.y + 1, 0.9); cx.fillStyle = cor('#111'); cx.beginPath(); cx.ellipse(p[0], p[1], 3, 1.6, 0, 0, 7); cx.fill(); } }
  } else {
    const teto = caixa(l, h, cat.cor || '#888', { alpha: alfa, contorno: true, janelas: NOITE > 0.25 && aberto(l, r) !== false && !semLuz() ? 'acesas' : 'apagadas', kTeto: 1.18 });
    if (sel) poli(teto, null, '#ffe36b', 3);
    if (l.torre) caixa({ x: l.x + l.w * 0.68, y: l.y + l.h * 0.15, w: 1.1, h: 1.1 }, h + 1.5, cat.cor, { alpha: alfa, contorno: true });
    if (l.chamine) caixa({ x: l.x + l.w - 1.4, y: l.y + 0.4, w: 0.8, h: 0.8 }, h + 2.4, '#5a4a3a', { alpha: alfa, contorno: true });
    if (l.id === 'torre') { caixa({ x: l.x + 0.4, y: l.y + 0.4, w: l.w - 0.8, h: l.h - 0.8 }, 0.8, '#8a9aa6', { z0: h, alpha: alfa, contorno: true }); }
    if (l.antena) { const a = proj(l.x + l.w / 2, l.y + l.h / 2, h), b = proj(l.x + l.w / 2, l.y + l.h / 2, h + 3); linha([a, b], cor('#aaa'), 1.4); if (Math.floor(Date.now() / 700) % 2) { cx.fillStyle = '#ff3030'; cx.beginPath(); cx.arc(b[0], b[1], 2.5, 0, 7); cx.fill(); } animado = true; }
    if (l.chamine && (Date.now() / 50) % 1 >= 0) { // fumaça do subsolo
      const p = proj(l.x + l.w - 1, l.y + 0.8, h + 2.6); animado = true;
      for (let i = 0; i < 4; i++) { const t = ((Date.now() / 2600) + i / 4) % 1; cx.fillStyle = `rgba(120,115,110,${0.35 * (1 - t)})`; cx.beginPath(); cx.arc(p[0] + t * 18 * s, p[1] - t * 30 * s, (4 + t * 10) * Math.max(0.6, s), 0, 7); cx.fill(); }
    }
  }
  // rótulo
  const c = proj(l.x + l.w / 2, l.y + l.h / 2, (l.torre ? h + 1.5 : h) + 0.3);
  const nome = conh ? (CRW.ls.get('mpNomesCurtos', true) ? (l.nome.replace(/\s*\(.*\)$/, '')) : l.nome) : '? ' + l.nome;
  rotulos.push({ x: c[0], y: c[1], t: nome, cls: 'lote ' + (sel ? 'sel' : ''), pri: sel ? 10 : (l.cat === 'cena' ? 7 : l.interior ? 5 : 3), cor: cat.cor, fechado: aberto(l, r) === false });
}
function desenharCasa(c) {
  const sel = view.sel === c.id;
  const t = caixa(c, c.alt * ALT, c.telhado ? '#8b7d6b' : '#7d7466', { contorno: true, teto: c.telhado ? '#6b4b3a' : '#5d5d58', janelas: NOITE > 0.3 && !semLuz() ? 'acesas' : null, kTeto: 1 });
  if (sel) poli(t, null, '#ffe36b', 2.5);
}
function nuvem(l) {
  const t = Date.now() / 4000; animado = true;
  for (let i = 0; i < 6; i++) {
    const x = l.x + l.w * (0.2 + 0.6 * ((i * 37) % 10) / 10), y = l.y + l.h * (0.2 + 0.6 * ((i * 53) % 10) / 10);
    const p = proj(x + Math.sin(t + i) * 0.3, y, 0.6), rr = Math.max(8, (0.9 + 0.3 * Math.sin(t * 1.3 + i)) * T * cam.s * 1.3);
    const g = cx.createRadialGradient(p[0], p[1], 0, p[0], p[1], rr); g.addColorStop(0, 'rgba(205,210,214,.85)'); g.addColorStop(1, 'rgba(205,210,214,0)');
    cx.fillStyle = g; cx.fillRect(p[0] - rr, p[1] - rr, rr * 2, rr * 2);
  }
}
function arvore(a) {
  const b = proj(a.x, a.y, 0), t = proj(a.x, a.y, 0.9 * a.s), rr = Math.max(2, 0.55 * a.s * T * cam.s);
  linha([b, t], cor('#3b2a1d'), Math.max(1, rr * 0.25));
  cx.fillStyle = cor('#2f4a2c'); cx.beginPath(); cx.arc(t[0], t[1], rr, 0, 7); cx.fill();
}
function tokensVisiveis() {
  if (view.replay) return view.replay.tokens();
  return tokens();
}
function raioPeca() { return clamp(5 + 4 * mundo().c.s, 8, 16); }
function peca(tk, p, z0 = 0) {
  const b = proj(p.x, p.y, z0), top = proj(p.x, p.y, z0 + (view.modo === 'cidade' ? 0.9 : 0.35)), r = raioPeca(), cr = corDe(tk);
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(b[0], b[1], r * 0.8, r * 0.35, 0, 0, 7); cx.fill();
  linha([b, top], '#111', 1.5);
  const meu = tk.id === CRW.v().pc, oculto = !!tk.h, sel = view.selTk === tk.id;
  cx.save(); if (oculto) cx.globalAlpha = 0.6;
  if (tk.tipo === 'viatura') {
    cx.fillStyle = cr; cx.strokeStyle = '#fff'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.roundRect ? cx.roundRect(top[0] - r * 1.2, top[1] - r * 0.7, r * 2.4, r * 1.4, 3) : cx.rect(top[0] - r * 1.2, top[1] - r * 0.7, r * 2.4, r * 1.4); cx.fill(); cx.stroke();
    const pisca = Math.floor(Date.now() / 300) % 2; if (tk.ronda && tk.ronda.ativo) animado = true;
    cx.fillStyle = pisca ? '#ff3b3b' : '#3b6bff'; cx.fillRect(top[0] - r * 0.6, top[1] - r * 0.95, r * 0.55, r * 0.3);
    cx.fillStyle = pisca ? '#3b6bff' : '#ff3b3b'; cx.fillRect(top[0] + r * 0.05, top[1] - r * 0.95, r * 0.55, r * 0.3);
    cx.fillStyle = '#fff'; cx.font = `bold ${Math.round(r * 0.75)}px Tahoma,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(curtoDe(tk), top[0], top[1] + 0.5);
  } else {
    cx.fillStyle = cr; cx.strokeStyle = meu ? '#ffe36b' : tk.tipo === 'pc' ? '#fff' : '#111'; cx.lineWidth = meu ? 3 : 2;
    if (oculto) cx.setLineDash([3, 2]);
    cx.beginPath(); cx.arc(top[0], top[1], r, 0, 7); cx.fill(); cx.stroke(); cx.setLineDash([]);
    const s = CRW.ser(tk.id) || {};
    cx.fillStyle = '#fff'; cx.font = `bold ${Math.round(r * 0.8)}px Tahoma,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.fillText(CRW.iniciais(s.nome || tk.id), top[0], top[1] + 0.5);
  }
  if (sel) { cx.strokeStyle = '#ffe36b'; cx.lineWidth = 2; cx.beginPath(); cx.arc(top[0], top[1], r + 5, 0, 7); cx.stroke(); }
  cx.restore();
  tk._tela = { x: top[0], y: top[1], r, q: quadro };
  if (mundo().c.s > 0.9 || meu || sel || p.andando) rotulos.push({ x: top[0], y: top[1] + r + 9, t: (p.andando ? '🚶 ' : '') + nomeDe(tk).replace(/\s*\(.*\)$/, '') + (oculto ? ' (oculto)' : ''), cls: 'peca', pri: meu ? 9 : 6 });
}
function marcador(k, mk) {
  const b = proj(mk.x, mk.y, 0), t = proj(mk.x, mk.y, 0.8);
  linha([b, t], '#222', 1.5);
  cx.fillStyle = mk.cor || '#e74c3c'; cx.beginPath(); cx.moveTo(t[0], t[1]); cx.lineTo(t[0] + 12, t[1] + 4); cx.lineTo(t[0], t[1] + 8); cx.closePath(); cx.fill(); cx.strokeStyle = '#000'; cx.lineWidth = 0.8; cx.stroke();
  if (mk.visitado) { cx.fillStyle = '#fff'; cx.font = 'bold 9px Tahoma'; cx.fillText('✓', t[0] + 4, t[1] + 5); }
  mk._tela = { x: t[0] + 5, y: t[1] + 4, r: 10, q: quadro };
  if (cam.s > 0.7) rotulos.push({ x: t[0] + 6, y: t[1] - 8, t: mk.titulo || 'marcador', cls: 'marca', pri: 4 });
}
function desenharSinais() {
  const agora = Date.now();
  Object.values(sinais).forEach(sg => {
    if (!sg || agora - num(sg.ts) > 9000) return; animado = true;
    if (view.modo === 'cidade' ? (sg.loc && sg.loc !== 'c') || regDe(sg) !== view.reg : sg.loc !== `i:${view.int}:${view.andar}`) return;
    const p = proj(sg.x, sg.y, 0), t = ((agora - sg.ts) % 1400) / 1400;
    cx.strokeStyle = sg.cor || '#ffe36b';
    for (let i = 0; i < 2; i++) { const k = (t + i * 0.5) % 1; cx.globalAlpha = 1 - k; cx.lineWidth = 3; cx.beginPath(); cx.ellipse(p[0], p[1], 6 + k * 40, (6 + k * 40) * Math.max(0.35, Math.cos(mundo().c.tilt * Math.PI / 180)), 0, 0, 7); cx.stroke(); }
    cx.globalAlpha = 1; rotulos.push({ x: p[0], y: p[1] - 18, t: '✱ ' + (sg.nome || ''), cls: 'sinal', pri: 9 });
  });
}
function desenharRotulos(s) {
  // do mais importante para o menos; pula o que encostar em outro
  const ocup = [];
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  rotulos.sort((a, b) => b.pri - a.pri).forEach(r => {
    const urb = view.modo !== 'cidade' || R().urbano;
    if (urb && r.cls.startsWith('lote') && r.pri < 5 && s < 0.75) return;
    if (urb && r.cls.startsWith('lote') && r.pri < 4 && s < 1.1) return;
    if (urb && r.cls === 'saida' && s < 0.6) return;
    const fs = r.cls.startsWith('lote') ? 11 : r.cls === 'peca' ? 10.5 : 10;
    cx.font = `${r.cls.startsWith('lote') ? 'bold ' : ''}${fs}px Tahoma,Verdana,sans-serif`;
    const w = cx.measureText(r.t).width + 8, h = fs + 5, box = { x: r.x - w / 2, y: r.y - h / 2, w, h };
    if (r.pri < 9 && ocup.some(o => sobrepoe(o, box, 1))) return;
    ocup.push(box);
    const fundo = r.cls === 'bloq' ? '#b00' : r.cls === 'sinal' ? '#000' : r.cls === 'dentro' ? '#003' : r.cls === 'saida' ? '#1f5f2f' : r.cls === 'portal' ? '#1d3f73' : r.cls === 'viagem' ? '#5a3d00' : 'rgba(255,255,240,.9)';
    cx.fillStyle = fundo; cx.fillRect(box.x, box.y, w, h);
    if (r.cls.startsWith('lote')) { cx.fillStyle = r.cor || '#888'; cx.fillRect(box.x, box.y, 3, h); cx.strokeStyle = r.cls.includes('sel') ? '#c90' : 'rgba(0,0,0,.45)'; cx.lineWidth = 1; cx.strokeRect(box.x + 0.5, box.y + 0.5, w - 1, h - 1); }
    cx.fillStyle = ['bloq', 'sinal', 'dentro', 'saida', 'portal', 'viagem'].includes(r.cls) ? '#fff' : r.fechado ? '#666' : '#111';
    cx.fillText(r.t, r.x + (r.cls.startsWith('lote') ? 1 : 0), r.y + 0.5);
  });
}

/* =========================================================
   REGIÕES, VEÍCULOS E VIAGENS
   Viagem a pé ou de carro: a peça sai do ponto atual e chega pelo relógio do jogo
   (com o relógio parado, ninguém chega; o Guardião pode adiantar a chegada).
   ========================================================= */
function destinoPortal(pid) {
  const lg = (CIDADE.ligacoes || []).find(l => l[0] === pid || l[1] === pid); if (!lg) return null;
  const o = PORTAL[lg[0] === pid ? lg[1] : lg[0]]; if (!o) return null;
  return { reg: REG[o.reg], portal: o, km: lg[2], nome: lg[3] };
}
function veiculosNaRegiao(rg) {
  const v = CRW.v();
  return Object.entries(veicDefs()).filter(([, d]) => d && (!d.h || v.mestre || v.aux)).map(([id, def]) => ({ id, def, p: posVeiculo(id) })).filter(x => x.p && x.p.reg === rg);
}
const ocupantes = id => Object.values(S().tokens || {}).filter(t => t && t.veic === id && naRua(t));
const motoristaDe = id => { const st = veicPos[id] || {}, oc = ocupantes(id); return oc.find(t => t.id === st.mot) || null; };
const temChave = (id, pc) => { const d = veicDefs()[id] || {}; return !!(d.todos || (d.chaves || {})[pc]); };
let carrosTela = {};
function carro(vc, p) {
  const top = proj(p.x, p.y, 0.45), b = proj(p.x, p.y, 0), r = raioPeca(), cr = vc.def.cor || '#7a8a99';
  const sel = view.selVc === vc.id, oc = ocupantes(vc.id), meu = !!(CRW.v().pc && oc.some(t => t.id === CRW.v().pc));
  cx.fillStyle = 'rgba(0,0,0,.35)'; cx.beginPath(); cx.ellipse(b[0], b[1], r * 1.3, r * 0.45, 0, 0, 7); cx.fill();
  cx.save();
  cx.fillStyle = cr; cx.strokeStyle = meu ? '#ffe36b' : '#111'; cx.lineWidth = meu ? 2.5 : 1.5;
  const w = r * 2.6, h = r * 1.3;
  cx.beginPath(); cx.roundRect ? cx.roundRect(top[0] - w / 2, top[1] - h / 2, w, h, 4) : cx.rect(top[0] - w / 2, top[1] - h / 2, w, h); cx.fill(); cx.stroke();
  cx.fillStyle = 'rgba(190,220,240,.85)'; cx.fillRect(top[0] - w * 0.18, top[1] - h * 0.38, w * 0.36, h * 0.3);
  cx.fillStyle = '#111'; [-0.3, 0.3].forEach(k => { cx.beginPath(); cx.arc(top[0] + w * k, top[1] + h * 0.52, r * 0.24, 0, 7); cx.fill(); });
  if (oc.length) { cx.fillStyle = '#ffe36b'; cx.beginPath(); cx.arc(top[0] + w / 2, top[1] - h / 2, r * 0.48, 0, 7); cx.fill(); cx.fillStyle = '#111'; cx.font = `bold ${Math.round(r * 0.6)}px Tahoma,sans-serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText(String(oc.length), top[0] + w / 2, top[1] - h / 2 + 0.5); }
  if (sel) { cx.strokeStyle = '#ffe36b'; cx.lineWidth = 2; cx.strokeRect(top[0] - w / 2 - 4, top[1] - h / 2 - 4, w + 8, h + 8); }
  cx.restore();
  carrosTela[vc.id] = { x: top[0], y: top[1], r: r * 1.3, q: quadro };
  rotulos.push({ x: top[0], y: top[1] + h + 6, t: (p.andando ? '🚗 ' : '') + (vc.def.nome || 'Carro'), cls: 'peca', pri: meu || sel ? 9 : 6 });
}
function desenharViagens(rg) {
  const v = CRW.v(), meu = v.pc, alvos = [];
  tokensVisiveis().forEach(tk => { if (tk.viagem && progressoViagem(tk.viagem) < 1 && naRua(tk) && !tk.veic && (v.mestre || v.aux || tk.id === meu)) alvos.push({ vg: tk.viagem, nome: nomeDe(tk), p: posDe(tk) }); });
  Object.keys(veicDefs()).forEach(id => { const st = veicPos[id] || {}; if (st.viagem && progressoViagem(st.viagem) < 1 && (v.mestre || v.aux || ocupantes(id).some(t => t.id === meu))) alvos.push({ vg: st.viagem, nome: (veicDefs()[id] || {}).nome || 'Carro', p: posVeiculo(id) }); });
  alvos.forEach(({ vg, nome, p }) => {
    const para = vg.para || {};
    if (p && p.reg === rg && regDe(para) === rg) linha([proj(p.x, p.y, 0.1), proj(num(para.x), num(para.y), 0.1)], 'rgba(255,227,107,.8)', 2, [6, 5]);
    if (regDe(para) === rg) { const q = proj(num(para.x), num(para.y), 0.6); cx.fillStyle = '#ffe36b'; cx.beginPath(); cx.arc(q[0], q[1], 4, 0, 7); cx.fill(); rotulos.push({ x: q[0], y: q[1] - 12, t: `⚑ ${nome}: chega ${horaDe(num(vg.ini) + num(vg.dur))}`, cls: 'viagem', pri: 8 }); }
    animado = true;
  });
}

/* ---------- barra das regiões (como os andares da Planta) ---------- */
function contagemRegioes() {
  const c = {}; REGIOES.forEach(r => { c[r.id] = 0; });
  tokens().forEach(tk => { if (tk.tipo !== 'pc') return; const rg = regiaoDe(tk); if (rg && c[rg] != null) c[rg]++; });
  return c;
}
function atualizarRegioes() {
  if (!raiz) return; const b = $('.mp-regioes', raiz); if (!b) return;
  const c = contagemRegioes(), v = CRW.v(), meu = v.pc && (S().tokens || {})[v.pc], minha = meu ? regiaoDe(meu) : null;
  const html = REGIOES.map(r => `<button class="w95-btn mp-reg${view.reg === r.id && view.modo === 'cidade' ? ' on' : ''}${minha === r.id ? ' minha' : ''}" data-mp="regiao" data-r="${esc(r.id)}" title="${esc(r.nome + ' · ' + r.sub)}"><b class="mp-reg-n">${r.num}</b><span class="mp-reg-t">${esc(r.nome)}</span>${c[r.id] ? `<i class="mp-reg-c" title="Investigadores aqui">${c[r.id]}</i>` : ''}</button>`).join('')
    + `<button class="w95-btn mp-reg mp-reg-cond" data-mp="condado" title="Mapa do condado: regiões, estradas e distâncias">🗺<span class="mp-reg-t">Condado</span></button>`;
  if (b.innerHTML !== html) b.innerHTML = html;
}
function trocarRegiao(id, semEnquadrar) {
  if (!REG[id]) return;
  if (view.modo !== 'cidade') { view.modo = 'cidade'; view.salaSel = null; }
  const mudou = view.reg !== id;
  view.reg = id; CRW.ls.set('mpReg', id);
  if (mudou) { view.sel = null; view.selTk = null; view.selVc = null; regua = null; fecharCartao(); }
  atualizarBarra(); atualizarRegioes();
  if (mudou && !semEnquadrar) enquadrar();
  sujo(); Amb.atualizar();
}

/* ---------- viagens ---------- */
const meuTk = () => { const v = CRW.v(); return v.pc ? (S().tokens || {})[v.pc] || null : null; };
const nomeLugar = d => d && d.lote && LOTE[d.lote] ? LOTE[d.lote].nome : d && d.nome ? d.nome : 'um ponto do mapa';
function descreverRota(rota) {
  const partes = []; rota.segs.forEach(sg => { const t = sg.estrada ? sg.estrada : REG[sg.reg].nome; if (partes[partes.length - 1] !== t) partes.push(t); });
  return partes.join(' → ');
}
function novaViagem(de, para, modo) {
  const rota = rotaEntre(de, para); if (!rota) return null;
  const dur = minutosDe(rota.km, modo);
  return { rota, vg: { ini: +agoraJogo().toFixed(3), dur: +dur.toFixed(2), km: +rota.km.toFixed(3), modo, rota: rota.segs.map(sg => sg.estrada ? { estrada: sg.estrada, km: +sg.km.toFixed(3) } : { reg: sg.reg, a: sg.a.map(n => +n.toFixed(2)), b: sg.b.map(n => +n.toFixed(2)), km: +sg.km.toFixed(3) }), para: { reg: para.reg, x: +num(para.x).toFixed(2), y: +num(para.y).toFixed(2), lote: para.lote || null, nome: nomeLugar(para) } } };
}
function partirAPe(tk, para) {
  const de = posDe(tk); if (!de.reg) return aviso('Você ainda está na estrada. Espere chegar.', 'erro');
  const cfg = cfgViagem(), nv = novaViagem(de, para, 'pe'); if (!nv) return aviso('Não há caminho até lá.', 'erro');
  if (nv.rota.cruza && !cfg.peLivre && !CRW.P.mestre) return aviso('É longe demais para ir a pé até outra região. Vá de carro (ou peça ao Guardião).', 'erro');
  const novo = { ...tk, loc: 'c', reg: de.reg, x: +de.x.toFixed(2), y: +de.y.toFixed(2) }; delete novo._tela; delete novo.veic;
  if (novo.ronda && novo.ronda.ativo) novo.ronda = { ...novo.ronda, ativo: false };
  if (cfg.instantaneo) { Object.assign(novo, { reg: para.reg, x: nv.vg.para.x, y: nv.vg.para.y }); delete novo.viagem; }
  else novo.viagem = nv.vg;
  Estado.definir(['tokens', tk.id], novo);
  if (!cfg.instantaneo) aviso(`A pé até ${nomeLugar(para)}: ${fmtM(nv.rota.km * 1000)}, ~${fmtMin(nv.vg.dur)} (chega ${horaDe(nv.vg.ini + nv.vg.dur)} no relógio do jogo).`);
  sujo(true);
}
function partirDeCarro(id, para) {
  const st = veicPos[id] || {}, de = posVeiculo(id); if (!de || !de.reg) return aviso('O carro ainda está na estrada.', 'erro');
  const cfg = cfgViagem(), nv = novaViagem(de, para, 'carro'); if (!nv) return aviso('Não há caminho até lá.', 'erro');
  const novo = { ...st, reg: de.reg, x: +de.x.toFixed(2), y: +de.y.toFixed(2), ts: Date.now() };
  if (CRW.P.pc) novo.mot = CRW.P.pc;
  if (cfg.instantaneo) { Object.assign(novo, { reg: para.reg, x: nv.vg.para.x, y: nv.vg.para.y }); delete novo.viagem; }
  else novo.viagem = nv.vg;
  veicPos = { ...veicPos, [id]: novo };
  Rede.set('caso/veiculos/' + id, novo).catch(() => aviso('Não foi possível gravar a viagem.', 'erro'));
  if (!cfg.instantaneo) aviso(`De carro até ${nomeLugar(para)}: ${fmtM(nv.rota.km * 1000)}, ~${fmtMin(nv.vg.dur)} (chega ${horaDe(nv.vg.ini + nv.vg.dur)}).`);
  sujo(true); atualizarRegioes();
}
// janela "como ir até lá": a pé, de carro (motorista) ou instantâneo (Guardião)
function abrirViagem(para, quem) {
  const G = CRW.P.mestre && !CRW.P.espiar, tk = quem || meuTk();
  if (!tk) return aviso('Seu personagem ainda não está no mapa.');
  if (!naRua(tk)) return aviso('Saia do prédio primeiro (toque na sua peça e em "Sair do prédio").');
  if (emViagem(tk) && !G) return aviso('Você já está a caminho. Espere chegar.');
  const de = posDe(tk); if (!de.reg) return aviso('Você está na estrada.');
  const rota = rotaEntre(de, para); if (!rota) return aviso('Não há caminho até lá.', 'erro');
  const cfg = cfgViagem(), mPe = minutosDe(rota.km, 'pe'), mCar = minutosDe(rota.km, 'carro'), agora = agoraJogo();
  const noCarro = tk.veic && veicDefs()[tk.veic], mot = noCarro && motoristaDe(tk.veic), souMot = noCarro && mot && mot.id === tk.id;
  const peOk = !rota.cruza || cfg.peLivre;
  const meus = Object.entries(veicDefs()).filter(([id]) => temChave(id, tk.id)).map(([id, d]) => { const p = posVeiculo(id); const r2 = p && p.reg ? rotaEntre(de, p) : null; return { id, d, p, km: r2 ? r2.km : null }; });
  const w = janela({ titulo: 'Ir até ' + nomeLugar(para), largura: '440px', icone: '🚗', html: `
    <p><b>${esc(fmtM(rota.km * 1000))}</b> pela estrada <span class="mini">(${esc(descreverRota(rota))})</span></p>
    <table class="dtable"><tbody>
      <tr><td>🚶 A pé</td><td>~${esc(fmtMin(mPe))}</td><td class="mini">chega ${esc(horaDe(agora + mPe))}</td></tr>
      <tr><td>🚗 De carro</td><td>~${esc(fmtMin(mCar))}</td><td class="mini">chega ${esc(horaDe(agora + mCar))}</td></tr>
    </tbody></table>
    ${cfg.instantaneo ? '<p class="mini">O Guardião ligou as viagens instantâneas: a peça chega na hora.</p>' : '<p class="mini">A viagem anda com o relógio do jogo. Com o relógio parado, a peça espera o Guardião avançar o tempo.</p>'}
    ${noCarro ? (souMot ? '' : `<p class="mini">Você está no banco do passageiro de <b>${esc(veicDefs()[tk.veic].nome || 'um carro')}</b>. Quem dirige é ${esc(mot ? nomeDe(mot) : 'ninguém ainda')}.</p>`)
      : (meus.length ? `<p class="mini">Seus carros: ${meus.map(m => `<b>${esc(m.d.nome || 'Carro')}</b> (${m.p && m.p.reg ? (m.km != null ? 'a ' + esc(fmtM(m.km * 1000)) : '') + ' · ' + esc(REG[m.p.reg].nome) : 'na estrada'})`).join(', ')}. Entre no carro (toque nele) para dirigir.</p>` : '<p class="mini">Você não tem chave de nenhum carro. Peça uma carona ou fale com o Guardião.</p>')}
    ${!peOk ? '<p class="mini">A pé, entre regiões, é longe demais. Vá de carro.</p>' : ''}
    <div class="msg-bts">
      ${!noCarro && (peOk || G) ? `<button class="w95-btn${noCarro ? '' : ' pri'}" data-v="pe">🚶 Ir a pé</button>` : ''}
      ${souMot ? '<button class="w95-btn pri" data-v="carro">🚗 Dirigir até lá</button>' : ''}
      ${G ? '<button class="w95-btn" data-v="ja">⚡ Levar já (Guardião)</button>' : ''}
      <button class="w95-btn" data-fechar>Cancelar</button></div>` });
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    const atual = (S().tokens || {})[tk.id] || tk;
    if (b.dataset.v === 'pe') partirAPe(atual, para);
    if (b.dataset.v === 'carro') partirDeCarro(atual.veic, para);
    if (b.dataset.v === 'ja') { const n = { ...atual, loc: 'c', reg: para.reg, x: +num(para.x).toFixed(2), y: +num(para.y).toFixed(2) }; delete n.viagem; delete n.veic; delete n._tela; Estado.definir(['tokens', tk.id], n); }
    fecharJanela(w.parentElement.dataset.jan);
    if (b.dataset.v !== 'ja' && CRW.v().pc === tk.id) setTimeout(() => irAteMim(true), 80);
  });
}
// lista de destinos (botão 🚗 Ir…): locais conhecidos, por região, com distância
function escolherDestino(quem) {
  const tk = quem || meuTk(); if (!tk) return aviso('Seu personagem ainda não está no mapa.');
  const v = CRW.v(), de = naRua(tk) ? posDe(tk) : null;
  const lista = LOTES.filter(l => conhecido(l) || v.mestre || v.aux).map(l => { const f = frente(l); const r2 = de && de.reg ? rotaEntre(de, f) : null; return { l, km: r2 ? r2.km : null }; });
  const html = REGIOES.map(rg => { const ls = lista.filter(x => regDe(x.l) === rg.id).sort((a, b) => (a.km ?? 1e9) - (b.km ?? 1e9)); return ls.length ? `<h4 class="mp-h4">${rg.num} · ${esc(rg.nome)}</h4><ul class="mp-lista mp-lista-curta">${ls.map(x => `<li><button class="mp-li" data-id="${esc(x.l.id)}"><span class="mp-cat" style="background:${esc((CATEGORIAS[x.l.cat] || {}).cor || '#888')}"></span><b>${esc(x.l.nome)}</b><span class="mini">${x.km != null ? `${esc(fmtM(x.km * 1000))} · 🚶 ${esc(fmtMin(minutosDe(x.km, 'pe')))} · 🚗 ${esc(fmtMin(minutosDe(x.km, 'carro')))}` : esc(x.l.end || '')}</span></button></li>`).join('')}</ul>` : ''; }).join('');
  const w = janela({ titulo: 'Para onde?', largura: '440px', icone: '🚗', html: `<input class="w95-input mp-busca" placeholder="Procurar local" style="width:100%">${html}` });
  const inp = $('.mp-busca', w);
  inp.addEventListener('input', () => { const q = inp.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); $$('.mp-li', w).forEach(b => { b.parentElement.hidden = q && !b.textContent.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q); }); });
  w.addEventListener('click', e => { const b = e.target.closest('.mp-li'); if (!b) return; fecharJanela(w.parentElement.dataset.jan); const l = LOTE[b.dataset.id]; abrirViagem({ ...frente(l, Object.keys(S().tokens || {}).indexOf(tk.id) % 8), lote: l.id }, tk); });
}

/* ---------- cartão do veículo ---------- */
function abrirVeiculo(id) {
  const def = veicDefs()[id]; if (!def) return;
  cartaoAtual = { tipo: 'veic', id }; view.selVc = id;
  const v = CRW.v(), G = v.mestre && !v.espiando, st = veicPos[id] || {}, p = posVeiculo(id), oc = ocupantes(id), mot = motoristaDe(id);
  const eu = meuTk(), dentroEu = eu && eu.veic === id, andando = !!(st.viagem && progressoViagem(st.viagem) < 1);
  const l = p && p.reg && !p.andando ? lotePerto(p.x, p.y, p.reg) : null;
  const dEu = eu && naRua(eu) && !dentroEu && p && p.reg ? (() => { const pe = posDe(eu); return pe.reg === p.reg ? Math.hypot(pe.x - p.x, pe.y - p.y) * REG[p.reg].metros : null; })() : null;
  const perto = dEu != null && dEu <= 150 && !emViagem(eu);
  const onde = !p ? '?' : !p.reg ? `na estrada (${esc(p.estrada || '')})` : `${esc(REG[p.reg].nome)}${l ? ' · ' + esc(l.nome) : ''}`;
  const c = mostrarCartao('🚗 ' + (def.nome || 'Carro'), `
    <div class="mp-cart-cab"><span class="mp-cat" style="background:${esc(def.cor || '#7a8a99')}"></span><span class="etq">veículo</span> <span class="mini">${int(def.lugares) || 4} lugares</span>${andando ? ' <span class="etq azul">rodando</span>' : ''}</div>
    <p class="mini">Onde: ${onde}${andando ? ` · chega ${esc(horaDe(num(st.viagem.ini) + num(st.viagem.dur)))} em ${esc(nomeLugar(st.viagem.para))}` : ''}</p>
    ${def.desc ? `<p class="tx">${esc(def.desc)}</p>` : ''}
    <div class="mp-sec"><b>Dentro</b>${oc.length ? `<ul class="mp-quem">${oc.map(t => `<li><span class="mp-cat" style="background:${esc(corDe(t))}"></span>${esc(nomeDe(t))}${mot && mot.id === t.id ? ' <span class="etq">ao volante</span>' : ''}</li>`).join('')}</ul>` : '<p class="mini">Vazio.</p>'}</div>
    <p class="mini">Chave: ${def.todos ? 'qualquer investigador' : Object.keys(def.chaves || {}).map(k => esc(nomeDe({ id: k }))).join(', ') || 'só o Guardião'}</p>
    <div class="linha95">
      ${eu && !G ? (dentroEu ? `${!andando ? '<button class="w95-btn" data-vc="sair">Sair do carro</button>' : ''}${temChave(id, eu.id) && (!mot || mot.id !== eu.id) ? '<button class="w95-btn" data-vc="volante">Assumir o volante</button>' : ''}${mot && mot.id === eu.id && !andando ? '<button class="w95-btn pri" data-vc="dirigir">🚗 Dirigir até…</button>' : ''}`
        : (perto ? (oc.length < (int(def.lugares) || 4) ? '<button class="w95-btn pri" data-vc="entrar">Entrar no carro</button>' : '<span class="mini">Lotado.</span>') : (dEu != null && !andando ? `<button class="w95-btn" data-vc="ate">🚶 Ir até o carro (${esc(fmtM(dEu * FATOR))})</button>` : ''))) : ''}
      <button class="w95-btn" data-vc="focar">◎ Focar</button>
    </div>
    ${G ? `<div class="mp-sec mp-mestre"><b>Guardião</b><p class="mini">Arraste o carro no mapa para mudar de lugar na hora.</p><label class="campo">Estacionar em<select class="w95-input" data-vc-l>${opcoesLotes()}</select></label>
      <div class="linha95"><button class="w95-btn" data-vc="estacionar">Estacionar</button>${andando ? '<button class="w95-btn" data-vc="chegar">Chegar agora</button>' : ''}<button class="w95-btn perigo" data-vc="apagar">Apagar o veículo</button></div></div>` : ''}`, 'veic');
  c.addEventListener('click', async e => {
    const b = e.target.closest('[data-vc]'); if (!b) return;
    const eu2 = meuTk(), st2 = veicPos[id] || {}, p2 = posVeiculo(id);
    switch (b.dataset.vc) {
      case 'focar': if (p2 && p2.reg) { trocarRegiao(p2.reg, true); focar(p2.x, p2.y, Math.max(cam.s, 1.3)); } break;
      case 'entrar': {
        if (!eu2 || !p2 || !p2.reg) return;
        const n = { ...eu2, veic: id, loc: 'c', reg: p2.reg, x: +p2.x.toFixed(2), y: +p2.y.toFixed(2) }; delete n.viagem; delete n._tela;
        if (n.ronda) delete n.ronda;
        Estado.definir(['tokens', eu2.id], n);
        if (!st2.reg) Rede.set('caso/veiculos/' + id, { reg: p2.reg, x: +p2.x.toFixed(2), y: +p2.y.toFixed(2), ts: Date.now() }).catch(() => {});
        if (!motoristaDe(id) && temChave(id, eu2.id)) Rede.update('caso/veiculos/' + id, { mot: eu2.id, ts: Date.now() }).catch(() => {});
        setTimeout(() => abrirVeiculo(id), 200); break;
      }
      case 'sair': {
        if (!eu2 || !p2 || !p2.reg) return;
        const n = { ...eu2, loc: 'c', reg: p2.reg, x: +clamp(p2.x + 0.6, 0.4, REG[p2.reg].lado - 0.4).toFixed(2), y: +clamp(p2.y + 0.5, 0.4, REG[p2.reg].lado - 0.4).toFixed(2) }; delete n.veic; delete n.viagem; delete n._tela;
        Estado.definir(['tokens', eu2.id], n); setTimeout(() => abrirVeiculo(id), 200); break;
      }
      case 'volante': if (eu2) { Rede.update('caso/veiculos/' + id, { ...(st2.reg ? {} : { reg: p2.reg, x: p2.x, y: p2.y }), mot: eu2.id, ts: Date.now() }).catch(() => {}); setTimeout(() => abrirVeiculo(id), 200); } break;
      case 'dirigir': escolherDestino(eu2); break;
      case 'ate': if (eu2 && p2) abrirViagem({ reg: p2.reg, x: p2.x + 0.6, y: p2.y + 0.5, nome: def.nome || 'o carro' }, eu2); break;
      case 'estacionar': { const lt = LOTE[$('[data-vc-l]', c).value]; if (!lt) return; const f = frente(lt, 6); Rede.set('caso/veiculos/' + id, { ...st2, reg: f.reg, x: f.x, y: f.y, viagem: null, ts: Date.now() }).catch(() => {}); trocarRegiao(f.reg, true); focar(f.x, f.y, Math.max(cam.s, 1.3)); CRW.diario('mapa', `${def.nome} estacionado em ${lt.nome}`); setTimeout(() => abrirVeiculo(id), 200); break; }
      case 'chegar': chegarAgora({ veic: id }); setTimeout(() => abrirVeiculo(id), 200); break;
      case 'apagar': if (await confirmar(`Apagar ${def.nome || 'o veículo'}? Quem estiver dentro desce no lugar.`)) { ocupantes(id).forEach(t => { const pp = posDe(t); const n = { ...t, reg: pp.reg || REG0, x: pp.x, y: pp.y }; delete n.veic; delete n.viagem; Estado.definir(['tokens', t.id], n); }); Estado.definir(['veiculos', id], null); Rede.set('caso/veiculos/' + id, null).catch(() => {}); fecharCartao(); } break;
    }
  });
}
const opcoesLotes = sel => REGIOES.map(rg => `<optgroup label="${rg.num} · ${esc(rg.nome)}">${lotesDa(rg.id).map(l => `<option value="${esc(l.id)}"${l.id === sel ? ' selected' : ''}>${esc(l.nome)}</option>`).join('')}</optgroup>`).join('');
function chegarAgora(alvo) {
  if (alvo.veic) { const st = veicPos[alvo.veic] || {}; const vg = st.viagem; if (!vg || !vg.para) return; const n = { ...st, reg: vg.para.reg, x: vg.para.x, y: vg.para.y, ts: Date.now() }; delete n.viagem; veicPos = { ...veicPos, [alvo.veic]: n }; Rede.set('caso/veiculos/' + alvo.veic, n).catch(() => {}); return; }
  const tk = (S().tokens || {})[alvo.tk]; if (!tk || !tk.viagem) return; const vg = tk.viagem;
  const n = { ...tk, reg: vg.para.reg, x: vg.para.x, y: vg.para.y }; delete n.viagem; delete n._tela; Estado.definir(['tokens', tk.id], n);
}
// viagens em andamento (para o Guardião e para os avisos de chegada)
function viagensAtivas() {
  const l = [];
  Object.values(S().tokens || {}).forEach(tk => { if (tk && tk.viagem && !tk.veic && progressoViagem(tk.viagem) < 1) l.push({ tipo: 'tk', id: tk.id, nome: nomeDe(tk), vg: tk.viagem }); });
  Object.entries(veicPos).forEach(([id, st]) => { if (st && st.viagem && veicDefs()[id] && progressoViagem(st.viagem) < 1) l.push({ tipo: 'veic', id, nome: (veicDefs()[id].nome || 'Carro') + (ocupantes(id).length ? ' (' + ocupantes(id).map(t => nomeDe(t)).join(', ') + ')' : ''), vg: st.viagem }); });
  return l;
}
// vigia de chegada: avisa o jogador (e o Guardião) e segue a peça para a região nova
let viagemVista = {}, minhaRegAntes = null;
function vigiarViagens() {
  const atuais = {};
  viagensAtivas().forEach(x => { atuais[x.tipo + ':' + x.id] = x; });
  Object.entries(viagemVista).forEach(([k, x]) => {
    if (atuais[k] || !x || !x.vg) return;
    const para = x.vg.para || {}; const quem = x.tipo === 'veic' ? x.nome : x.nome;
    const eu = CRW.v().pc, meu = (x.tipo === 'tk' && x.id === eu) || (x.tipo === 'veic' && ocupantes(x.id).some(t => t.id === eu));
    if (meu && progressoViagem(x.vg) >= 1) { aviso(`Chegou: ${nomeLugar(para)}.`); CRW.Som.ding && CRW.Som.ding(); }
    if (CRW.P.mestre && !CRW.P.espiar && progressoViagem(x.vg) >= 1) { CRW.alertaMestre(`🏁 ${quem} chegou: ${nomeLugar(para)}`, 'cheg-' + k); CRW.diario('mapa', `${quem} chegou a ${nomeLugar(para)}`); }
  });
  Object.entries(atuais).forEach(([k, x]) => {
    if (viagemVista[k] && viagemVista[k].vg.ini === x.vg.ini) return;
    if (CRW.P.mestre && !CRW.P.espiar && viagemVista.__pronto) { const txt = `${x.vg.modo === 'carro' ? '🚗' : '🚶'} ${x.nome} saiu para ${nomeLugar(x.vg.para)} (${fmtM(num(x.vg.km) * 1000)}, chega ${horaDe(num(x.vg.ini) + num(x.vg.dur))})`; CRW.alertaMestre(txt, 'via-' + k); CRW.diario('mapa', txt); }
  });
  viagemVista = { ...atuais, __pronto: true };
  // seguir a minha peça quando ela muda de região (se eu estava olhando a região dela)
  const eu = meuTk(); if (eu) { const rg = regiaoDe(eu); if (rg && minhaRegAntes && rg !== minhaRegAntes && view.reg === minhaRegAntes && view.modo === 'cidade' && raiz) { trocarRegiao(rg); const p = posDe(eu); if (p.reg) focar(p.x, p.y, Math.max(cam.s, 1.1)); } if (rg) minhaRegAntes = rg; }
  if (raiz) atualizarRegioes();
}

/* ---------- mapa do condado (visão geral das 4 regiões e distâncias) ---------- */
function abrirCondado() {
  const v = CRW.v(), de = (() => { const t = meuTk(); return t && naRua(t) ? posDe(t) : null; })();
  const ref = de && de.reg ? { p: de, nome: 'você' } : { p: frente(LOTE.delegacia), nome: 'a Delegacia' };
  const caixas = { kettle: [110, 14], centro: [110, 120], fundicao: [320, 120], vale: [110, 228] };
  const box = (rg) => { const [x, y] = caixas[rg.id] || [20, 20]; const c = contagemRegioes()[rg.id]; return `<g class="mp-cd-r" data-r="${esc(rg.id)}" style="cursor:pointer"><rect x="${x - 70}" y="${y}" width="140" height="54" rx="4" fill="${view.reg === rg.id ? '#ffe36b' : '#e8e8e0'}" stroke="#000"/><text x="${x}" y="${y + 22}" text-anchor="middle" font-size="13" font-weight="bold">${rg.num} · ${esc(rg.nome)}</text><text x="${x}" y="${y + 40}" text-anchor="middle" font-size="10">${(rg.lado * rg.metros / 1000).toFixed(1).replace('.', ',')} km de lado${c ? ` · ${c} aqui` : ''}</text></g>`; };
  const LG = CIDADE.ligacoes || [];
  const linhas = LG.map(([p, q], i) => { const a = PORTAL[p].reg, b = PORTAL[q].reg; const [x1, y1] = caixas[a], [x2, y2] = caixas[b]; const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + 27; return `<line x1="${x1}" y1="${y1 + 27}" x2="${x2}" y2="${y2 + 27}" stroke="#555" stroke-width="3"/><circle cx="${mx}" cy="${my}" r="9" fill="#000080"/><text x="${mx}" y="${my + 4}" text-anchor="middle" font-size="11" font-weight="bold" fill="#fff">${i + 1}</text>`; }).join('');
  const legLig = `<ol class="mp-cd-leg">${LG.map(([p, q, km, nome]) => `<li>${esc(REG[PORTAL[p].reg].nome)} ↔ ${esc(REG[PORTAL[q].reg].nome)}: ${esc(nome)}${km ? ' · ' + String(km).replace('.', ',') + ' km' : ' (a rodovia continua direto)'}</li>`).join('')}</ol>`;
  const linhasTab = LOTES.filter(l => conhecido(l) || v.mestre || v.aux).map(l => { const r2 = rotaEntre(ref.p, frente(l)); return { l, km: r2 ? r2.km : 0 }; }).sort((a, b) => a.km - b.km);
  const w = janela({ titulo: 'Condado de Crowsrest', largura: '520px', icone: '🗺', html: `
    <svg viewBox="0 0 420 292" class="mp-cd" role="img" aria-label="As quatro regiões de Crowsrest e as estradas entre elas">${linhas}${REGIOES.map(box).join('')}</svg>${legLig}
    <p class="mini">Toque numa região para abrir o mapa dela. As estradas ligam as regiões pelas placas ➜ que ficam na borda de cada mapa. A pé faz ${String(VEL.pe).replace('.', ',')} km/h; de carro, ${VEL.carro} km/h em média.</p>
    <h4 class="mp-h4">Distâncias a partir de ${esc(ref.nome)}</h4>
    <table class="dtable"><thead><tr><th>Local</th><th>Estrada</th><th>🚶</th><th>🚗</th></tr></thead><tbody>${linhasTab.map(x => `<tr><td>${esc(x.l.nome)} <span class="mini">${REG[regDe(x.l)].num}</span></td><td class="mp-nw">${esc(fmtM(x.km * 1000))}</td><td class="mp-nw">${esc(fmtMin(minutosDe(x.km, 'pe')))}</td><td class="mp-nw">${esc(fmtMin(minutosDe(x.km, 'carro')))}</td></tr>`).join('')}</tbody></table>` });
  w.addEventListener('click', e => { const g = e.target.closest('[data-r]'); if (!g) return; fecharJanela(w.parentElement.dataset.jan); CRW.abrirModulo('mapa', true); trocarRegiao(g.dataset.r); });
}

/* ---------- interior (planta do prédio, por andar) ---------- */
const trancado = (int, a) => { const an = (INTERIORES[int].andares || []).find(x => x.id === a); return !!(an && an.trancado); };
function destrancado(int, a) {
  if (!trancado(int, a)) return true;
  const v = CRW.v(); if (v.mestre || v.aux) return true;
  return !!((S().destrancado || {})[int + '_' + a]) || !!CRW.ls.get('abriu:' + int + '_' + a, false);
}
function desenharInterior() {
  const I = INTERIORES[view.int]; if (!I) return;
  const an = I.andares.find(a => a.id === view.andar) || I.andares[0];
  const placa = [[-0.4, -0.4], [12.4, -0.4], [12.4, 10.4], [-0.4, 10.4]].map(([x, y]) => proj(x, y, 0));
  poli(placa, cor(an.id.startsWith('s') || an.id === 'p' ? '#3b3a38' : '#8d8a80'), cor('#000'), 1.5);
  if (!destrancado(view.int, an.id)) {
    const c = proj(6, 5, 0.2); cx.fillStyle = 'rgba(0,0,0,.6)'; cx.fillRect(c[0] - 120, c[1] - 26, 240, 52);
    cx.fillStyle = '#ffd24a'; cx.font = 'bold 15px Tahoma'; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('🔒 ANDAR TRANCADO', c[0], c[1] - 8);
    cx.fillStyle = '#fff'; cx.font = '11px Tahoma'; cx.fillText('Toque em "Destrancar" e digite a senha', c[0], c[1] + 11);
    return;
  }
  const rev = ((S().salasRev || {})[view.int]) || {};
  // pisos
  an.salas.forEach(sa => {
    const pts = [[sa.x, sa.y], [sa.x + sa.w, sa.y], [sa.x + sa.w, sa.y + sa.h], [sa.x, sa.y + sa.h]].map(([x, y]) => proj(x + 0.06, y + 0.06, 0.01));
    const sel = view.salaSel === sa.id;
    poli(pts, cor(rev[sa.id] ? '#b9a77a' : (an.id.startsWith('s') || an.id === 'p' ? '#5b5850' : '#c8c2b2')), sel ? '#ffe36b' : null, 2.5);
  });
  // paredes (cada borda de sala), do fundo para a frente
  const pars = [];
  an.salas.forEach(sa => { const c = [[sa.x, sa.y], [sa.x + sa.w, sa.y], [sa.x + sa.w, sa.y + sa.h], [sa.x, sa.y + sa.h]]; for (let i = 0; i < 4; i++) pars.push([c[i], c[(i + 1) % 4]]); });
  const altP = 0.45;
  pars.map(([a, b]) => ({ a, b, d: prof((a[0] + b[0]) / 2, (a[1] + b[1]) / 2) })).sort((x, y) => x.d - y.d).forEach(({ a, b }) => {
    poli([proj(a[0], a[1], 0), proj(b[0], b[1], 0), proj(b[0], b[1], altP), proj(a[0], a[1], altP)], cor('#e8e2d0', 0.85, 0.8), cor('#000', 1, 0.5), 0.8);
  });
  // nomes das salas
  an.salas.forEach(sa => { const c = proj(sa.x + sa.w / 2, sa.y + sa.h / 2, 0.05); rotulos.push({ x: c[0], y: c[1], t: sa.nome + (rev[sa.id] ? ' ●' : ''), cls: 'lote' + (view.salaSel === sa.id ? ' sel' : ''), pri: 6, cor: '#7a6a4a' }); });
  // peças dentro deste andar
  const loc = `i:${view.int}:${an.id}`;
  tokensVisiveis().filter(tk => tk.loc === loc).map(tk => ({ tk, p: view.drag && view.drag.id === tk.id ? view.drag : { x: num(tk.x, 1.5), y: num(tk.y, 8.5) } }))
    .sort((a, b) => prof(a.p.x, a.p.y) - prof(b.p.x, b.p.y)).forEach(({ tk, p }) => peca(tk, p));
  desenharSinais(); desenharRegua(); desenharRotulos(2);
}

/* ---------- névoa, chuva, noite ---------- */
const puffs = Array.from({ length: 14 }, (_, i) => ({ x: (i * 0.137) % 1, y: (i * 0.291) % 1, r: 0.18 + (i % 5) * 0.05, v: 0.004 + (i % 3) * 0.003 }));
const gotas = Array.from({ length: 160 }, (_, i) => ({ x: Math.random(), y: Math.random(), v: 0.6 + Math.random() * 0.6 }));
function efeitos(r) {
  const v = CRW.v(), nv = nivelNevoa() * (v.mestre || v.aux ? 0.45 : 1);
  if (nv > 0.05) {
    animado = true;
    // véu geral
    cx.fillStyle = `rgba(196,200,204,${Math.min(0.5, nv * 0.07)})`; cx.fillRect(0, 0, W, H);
    // a visão se fecha ao redor do meu personagem (ou do centro da tela)
    let fx = W / 2, fy = H / 2;
    const meu = v.pc && (S().tokens || {})[v.pc];
    if (meu && view.modo === 'cidade' && naRua(meu)) { const p = posDe(meu); if (p.reg === view.reg) { const q = proj(p.x, p.y); fx = q[0]; fy = q[1]; } }
    // a visão em metros (400 m sem neblina, cai com a neblina), convertida para a escala da região
    const unid = mundo().t * mundo().c.s, r1 = Math.max(30, (view.modo === 'cidade' ? (400 - nv * 60) / R().metros : (16 - nv * 2.4) * 0.25) * unid), r2 = r1 * 2.3;
    const g = cx.createRadialGradient(fx, fy, r1, fx, fy, r2);
    g.addColorStop(0, 'rgba(206,210,214,0)'); g.addColorStop(1, `rgba(206,210,214,${Math.min(0.92, 0.18 + nv * 0.16)})`);
    cx.fillStyle = g; cx.fillRect(0, 0, W, H);
    const t = Date.now() / 1000;
    puffs.forEach(p => { const x = ((p.x + t * p.v) % 1.2 - 0.1) * W, y = p.y * H, rr = p.r * Math.max(W, H); const gg = cx.createRadialGradient(x, y, 0, x, y, rr); gg.addColorStop(0, `rgba(220,223,226,${Math.min(0.35, nv * 0.06)})`); gg.addColorStop(1, 'rgba(220,223,226,0)'); cx.fillStyle = gg; cx.fillRect(x - rr, y - rr, rr * 2, rr * 2); });
  }
  if (CHUVA > 0 && view.modo === 'cidade') {
    animado = true; const n = CHUVA >= 2 ? 160 : 80, dt = 0.018;
    cx.strokeStyle = 'rgba(190,205,225,.45)'; cx.lineWidth = 1;
    cx.beginPath();
    for (let i = 0; i < n; i++) { const g = gotas[i]; g.y += g.v * dt * (CHUVA >= 2 ? 1.6 : 1); g.x += 0.002; if (g.y > 1) { g.y -= 1; g.x = Math.random(); } if (g.x > 1) g.x -= 1; const x = g.x * W, y = g.y * H; cx.moveTo(x, y); cx.lineTo(x - 3, y + 11); }
    cx.stroke();
    if (CHUVA >= 2) { if (Math.random() < 0.002) relampago.t = Date.now(); const k = 1 - (Date.now() - relampago.t) / 220; if (k > 0) { cx.fillStyle = `rgba(235,240,255,${0.5 * k})`; cx.fillRect(0, 0, W, H); } }
  }
}

/* ---------- régua ---------- */
let regua = null;
function desenharRegua() {
  if (!regua) return;
  const a = proj(regua.a.x, regua.a.y, 0.05), b = proj(regua.b.x, regua.b.y, 0.05);
  linha([a, b], '#ffe36b', 3, [8, 5]);
  [a, b].forEach(p => { cx.fillStyle = '#ffe36b'; cx.beginPath(); cx.arc(p[0], p[1], 4, 0, 7); cx.fill(); });
  const un = Math.hypot(regua.b.x - regua.a.x, regua.b.y - regua.a.y) * (view.modo === 'cidade' ? R().metros : 2);
  const km = un / 1000 * FATOR, cid = view.modo === 'cidade' && un > 30;
  rotulos.push({ x: (a[0] + b[0]) / 2, y: (a[1] + b[1]) / 2 - 14, t: `📏 ${fmtM(un)} em linha reta${cid ? ` · pela estrada ~🚶 ${fmtMin(minutosDe(km, 'pe'))} · 🚗 ${fmtMin(minutosDe(km, 'carro'))}` : ''}`, cls: 'sinal', pri: 10 });
}

/* =========================================================
   LAÇO DE DESENHO (só enquanto o mapa está aberto)
   ========================================================= */
function laco(t) {
  requestAnimationFrame(laco);
  if (!cv || !document.body.contains(cv) || !cv.offsetParent) return;
  const intervalo = animado ? 1000 / 30 : 1000 / 8;
  if (!sujoF && !animado) return;
  if (t - ultimo < intervalo) return;
  ultimo = t; sujoF = false; animado = false;
  desenhar();
  atualizarStatus();
}
requestAnimationFrame(laco);
function redimensionar() {
  if (!cv) return;
  const r = cv.parentElement.getBoundingClientRect(); if (!r.width || !r.height) return;
  const novo = W !== r.width || H !== r.height;
  DPR = Math.min(2, window.devicePixelRatio || 1); W = r.width; H = r.height;
  cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
  if (novo && !redimensionar.feito) { redimensionar.feito = true; enquadrar(); focarInicio(); }
  sujo();
}
function focarInicio() {
  // ao abrir o mapa, o jogador começa na região onde o personagem dele está
  const v = CRW.v(), meu = v.pc && (S().tokens || {})[v.pc];
  if (meu && naRua(meu)) { const p = posDe(meu); if (p.reg) { if (p.reg !== view.reg) { trocarRegiao(p.reg, true); enquadrar(); } focar(p.x, p.y, W < 700 ? 1.1 : 1.3); } }
  else if (meu) { const rg = regiaoDe(meu); if (rg && rg !== view.reg) { trocarRegiao(rg); } }
}

/* =========================================================
   TOQUE, MOUSE E GESTOS
   1 dedo: arrasta o mapa (ou a sua peça); 2 dedos: zoom e giro;
   botão direito ou Shift: girar e inclinar; segurar: sinal.
   ========================================================= */
const ptrs = new Map(); let gesto = null, segurar = null;
function podeMover(tk) {
  if (!tk || view.replay) return false;
  const P = CRW.P; if (P.mestre && !P.espiar) return true;
  if (P.espiar) return false;
  if (tk.tipo === 'carro') { const mot = motoristaDe(tk.veicId), st = veicPos[tk.veicId] || {}; return !!(P.pc && mot && mot.id === P.pc && !(st.viagem && progressoViagem(st.viagem) < 1)); }
  if (P.aux) return tk.tipo !== 'pc';
  return P.pc && tk.id === P.pc && !tk.veic && !emViagem(tk);
}
function pecaEm(sx, sy) {
  let melhor = null, d0 = 1e9;
  tokensVisiveis().forEach(tk => { const t = tk._tela; if (!t || t.q !== quadro) return; const naVista = view.modo === 'cidade' ? naRua(tk) && !tk.veic : tk.loc === `i:${view.int}:${view.andar}`; if (!naVista) return; const d = Math.hypot(sx - t.x, sy - t.y); if (d < t.r + 6 && d < d0) { d0 = d; melhor = tk; } });
  if (view.modo === 'cidade') Object.entries(carrosTela).forEach(([id, t]) => { if (!t || t.q !== quadro || !veicDefs()[id]) return; const d = Math.hypot(sx - t.x, sy - t.y); if (d < t.r + 6 && d < d0) { d0 = d; melhor = { id: 'v:' + id, veicId: id, tipo: 'carro' }; } });
  return melhor;
}
function marcadorEm(sx, sy) { if (view.modo !== 'cidade') return null; for (const [k, m] of Object.entries(marcadores)) { const t = m && m._tela; if (t && t.q === quadro && Math.hypot(sx - t.x, sy - t.y) < t.r + 4) return k; } return null; }
function loteNaTela(sx, sy) {
  // testa o contorno projetado de cada prédio (o mais à frente ganha)
  let melhor = null, dm = -1e9; const v = CRW.v();
  TODOS().forEach(l => {
    const h = (l.cat === 'natureza' || l.cat === 'cena') ? 0.05 : l.alt * ALT;
    const c = [[l.x, l.y], [l.x + l.w, l.y], [l.x + l.w, l.y + l.h], [l.x, l.y + l.h]];
    const pts = [...c.map(([x, y]) => proj(x, y, 0)), ...c.map(([x, y]) => proj(x, y, h))];
    const casco = cascoConvexo(pts.map(p => [p[0], p[1]]));
    if (noPoligono(sx, sy, casco)) { const d = prof(l.x + l.w / 2, l.y + l.h / 2); if (d > dm) { dm = d; melhor = l; } }
  });
  void v; return melhor;
}
function cascoConvexo(p) {
  p = p.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (const q of p.reverse()) { while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
function salaEm(x, y) { const I = INTERIORES[view.int]; const an = I && I.andares.find(a => a.id === view.andar); return an ? an.salas.find(s => dentro(s, x, y)) : null; }
function ligarGestos(alvo) {
  alvo.addEventListener('contextmenu', e => e.preventDefault());
  alvo.addEventListener('pointerdown', e => {
    alvo.setPointerCapture(e.pointerId);
    const b = cv.getBoundingClientRect(), sx = e.clientX - b.left, sy = e.clientY - b.top;
    ptrs.set(e.pointerId, { x: sx, y: sy });
    clearTimeout(segurar);
    if (ptrs.size === 1) {
      const tk = pecaEm(sx, sy);
      if (view.ferr === 'regua') { const p = telaParaChao(sx, sy); regua = { a: p, b: p }; gesto = { tipo: 'regua' }; sujo(); return; }
      if (tk && podeMover(tk) && !(tk.ronda && tk.ronda.ativo && !CRW.P.mestre)) { gesto = { tipo: 'peca', tk, x: sx, y: sy, x0: sx, y0: sy, andou: false }; return; }
      gesto = { tipo: (e.button === 2 || e.shiftKey) ? 'girar' : 'mover', x: sx, y: sy, x0: sx, y0: sy, andou: false, tk };
      if (e.pointerType !== 'mouse' || e.button === 0) segurar = setTimeout(() => { if (gesto && !gesto.andou && ptrs.size === 1) { gesto.segurou = true; mandarSinal(telaParaChao(sx, sy)); } }, 600);
    } else if (ptrs.size === 2) {
      const [a, c] = [...ptrs.values()];
      gesto = { tipo: 'pinca', d: Math.hypot(a.x - c.x, a.y - c.y), ang: Math.atan2(c.y - a.y, c.x - a.x), mx: (a.x + c.x) / 2, my: (a.y + c.y) / 2, andou: true };
    }
  });
  alvo.addEventListener('pointermove', e => {
    if (!ptrs.has(e.pointerId) || !gesto) return;
    const b = cv.getBoundingClientRect(), sx = e.clientX - b.left, sy = e.clientY - b.top;
    ptrs.set(e.pointerId, { x: sx, y: sy });
    const c = mundo().c;
    if (gesto.tipo === 'pinca' && ptrs.size >= 2) {
      const [a, q] = [...ptrs.values()], d = Math.hypot(a.x - q.x, a.y - q.y), ang = Math.atan2(q.y - a.y, q.x - a.x), mx = (a.x + q.x) / 2, my = (a.y + q.y) / 2;
      zoomEm(mx, my, d / gesto.d);
      const da = (ang - gesto.ang) * 180 / Math.PI; if (Math.abs(da) < 40) c.rot += da;
      c.px += mx - gesto.mx; c.py += my - gesto.my;
      Object.assign(gesto, { d, ang, mx, my }); salvarCam(); sujo(); return;
    }
    if (gesto.tipo === 'regua') { regua.b = telaParaChao(sx, sy); sujo(); return; }
    const dx = sx - gesto.x, dy = sy - gesto.y;
    if (Math.abs(sx - (gesto.x0 ?? gesto.x)) + Math.abs(sy - (gesto.y0 ?? gesto.y)) > 6) { gesto.andou = true; clearTimeout(segurar); }
    if (gesto.tipo === 'peca') {
      if (!gesto.andou) return;
      const p = telaParaChao(sx, sy); const lim = view.modo === 'cidade' ? [0.3, R().lado - 0.3, 0.3, R().lado - 0.3] : [0.2, 11.8, 0.2, 9.8];
      view.drag = { id: gesto.tk.id, x: clamp(p.x, lim[0], lim[1]), y: clamp(p.y, lim[2], lim[3]) }; sujo(); return;
    }
    gesto.x = sx; gesto.y = sy;
    if (gesto.tipo === 'girar') { c.rot += dx * 0.35; c.tilt = clamp(c.tilt - dy * 0.25, 0, 65); salvarCam(); }
    else { c.px += dx; c.py += dy; }
    sujo();
  });
  const soltar = e => {
    if (!ptrs.has(e.pointerId)) return;
    ptrs.delete(e.pointerId); clearTimeout(segurar);
    const b = cv.getBoundingClientRect(), sx = e.clientX - b.left, sy = e.clientY - b.top;
    if (gesto && gesto.tipo === 'peca') {
      if (view.drag) { const d = view.drag; view.drag = null; moverPeca(gesto.tk, d.x, d.y); }
      else tocar(sx, sy);
    } else if (gesto && gesto.tipo === 'regua') { setTimeout(() => { if (view.ferr !== 'regua') { regua = null; sujo(); } }, 6000); }
    else if (gesto && !gesto.andou && !gesto.segurou && ptrs.size === 0) tocar(sx, sy);
    if (ptrs.size === 0) gesto = null;
    else if (ptrs.size === 1) { const [p] = [...ptrs.values()]; gesto = { tipo: 'mover', x: p.x, y: p.y, andou: true }; }
  };
  alvo.addEventListener('pointerup', soltar); alvo.addEventListener('pointercancel', soltar);
  alvo.addEventListener('wheel', e => { e.preventDefault(); const b = cv.getBoundingClientRect(); zoomEm(e.clientX - b.left, e.clientY - b.top, Math.exp(-e.deltaY * 0.0015)); }, { passive: false });
}
function tocar(sx, sy) {
  const tk = pecaEm(sx, sy); if (tk) { if (tk.tipo === 'carro') { view.selTk = null; abrirVeiculo(tk.veicId); sujo(); return; } view.selTk = tk.id; view.selVc = null; sujo(); abrirPeca(tk); return; }
  const mk = marcadorEm(sx, sy); if (mk) { abrirMarcador(mk); return; }
  const p = telaParaChao(sx, sy);
  if (view.ferr === 'sinal') { mandarSinal(p); return; }
  if (view.ferr === 'marcador') { novoMarcador(p); return; }
  if (view.modo === 'interior') { const sa = salaEm(p.x, p.y); view.salaSel = sa ? sa.id : null; sujo(); if (sa && destrancado(view.int, view.andar)) abrirSala(sa); else fecharCartao(); return; }
  const l = loteNaTela(sx, sy);
  if (l) { view.sel = l.id; view.selTk = null; sujo(); abrirLote(l.id); }
  else { view.sel = null; view.selTk = null; view.selVc = null; sujo(); fecharCartao(); }
}
function moverPeca(tk, x, y) {
  const G = CRW.P.mestre && !CRW.P.espiar;
  // carro: o Guardião muda na hora; o motorista abre a viagem
  if (tk.tipo === 'carro') {
    const id = tk.veicId;
    if (G) { const st = veicPos[id] || {}; const n = { ...st, reg: view.reg, x: +x.toFixed(2), y: +y.toFixed(2), ts: Date.now() }; delete n.viagem; veicPos = { ...veicPos, [id]: n }; Rede.set('caso/veiculos/' + id, n).catch(() => {}); sujo(); return; }
    const l = lotePerto(x, y); abrirViagem({ reg: view.reg, x, y, lote: l ? l.id : null, nome: l ? l.nome : 'ponto no mapa' }); sujo(); return;
  }
  const atual = (S().tokens || {})[tk.id] || tk;
  if (view.modo === 'cidade' && !G && CRW.P.pc === tk.id) {
    // passo curto (até 40 m) é na hora; mais longe vira viagem (a pé ou de carro)
    const p = posDe(atual), m = p.reg === view.reg ? Math.hypot(p.x - x, p.y - y) * R().metros : 1e9;
    if (m > 40) { const l = lotePerto(x, y); abrirViagem({ reg: view.reg, x, y, lote: l ? l.id : null, nome: l ? l.nome : 'ponto no mapa' }, atual); sujo(); return; }
  }
  const novo = { ...atual, x: +x.toFixed(2), y: +y.toFixed(2) };
  if (view.modo === 'cidade') { novo.reg = view.reg; delete novo.viagem; if (G) delete novo.veic; }
  if (novo.ronda && novo.ronda.ativo) novo.ronda = { ...novo.ronda, ativo: false };
  delete novo._tela;
  Estado.definir(['tokens', tk.id], novo);
  if (view.modo === 'cidade' && CRW.P.pc === tk.id) avisoSaida(novo);
  sujo();
}
function avisoSaida(tk) {
  const sd = (REG[regDe(tk)].saidas || []).find(s => Math.hypot(s.x - tk.x, s.y - tk.y) < 2.4); if (!sd) return;
  if ((S().bloqueios || {})[sd.id]) { aviso(`Bloqueio policial na ${sd.nome}. O Departamento do Xerife fechou a passagem.`, 'erro'); CRW.Som.sirene(); }
  else aviso(`Você está na ${sd.nome}. Sair da cidade é uma decisão de mesa: avise o Guardião da Luz.`);
}
function mandarSinal(p) {
  const v = CRW.v(); if (v.espiando) return aviso('Ver pelos olhos é só leitura.');
  const quem = CRW.P.mestre ? 'Guardião' : CRW.P.aux ? (CRW.P.nomeAux || 'Auxiliar') : nomeDe({ id: CRW.P.pc });
  const corS = CRW.P.pc ? corDe({ id: CRW.P.pc, tipo: 'pc' }) : '#ffe36b';
  const k = Rede.chave(), loc = view.modo === 'cidade' ? 'c' : `i:${view.int}:${view.andar}`;
  Rede.set('caso/sinais/' + k, { x: +p.x.toFixed(2), y: +p.y.toFixed(2), loc, reg: view.reg, nome: quem, cor: corS, ts: Date.now() }).catch(() => {});
  setTimeout(() => Rede.set('caso/sinais/' + k, null).catch(() => {}), 12000);
  if (navigator.vibrate) try { navigator.vibrate(30); } catch (e) {}
}

/* =========================================================
   O MÓDULO DO MAPA (tela)
   ========================================================= */
function render(sec) {
  assinarGrupo();
  sec.innerHTML = `<div class="mp-wrap">
    <div class="mp-regioes mp-so-cid" role="toolbar" aria-label="Regiões de Crowsrest"></div>
    <div class="mp-barra" role="toolbar" aria-label="Ferramentas do mapa">
      <span class="mp-grupo mp-so-int"><button class="w95-btn" data-mp="voltar" title="Voltar à cidade">◄ Cidade</button><span class="mp-andares"></span></span>
      <span class="mp-grupo"><button class="w95-btn mp-ic" data-mp="menos" title="Afastar" aria-label="Afastar">−</button><button class="w95-btn mp-ic" data-mp="mais" title="Aproximar" aria-label="Aproximar">+</button></span>
      <span class="mp-grupo"><button class="w95-btn mp-ic" data-mp="girarE" title="Girar para a esquerda" aria-label="Girar para a esquerda">⟲</button><button class="w95-btn mp-ic" data-mp="girarD" title="Girar para a direita" aria-label="Girar para a direita">⟳</button><button class="w95-btn" data-mp="iso" title="Vista em perspectiva">ISO</button><button class="w95-btn" data-mp="topo" title="Vista de cima">Topo</button></span>
      <span class="mp-grupo"><button class="w95-btn" data-mp="eu" title="Ir até o meu personagem">◎ Eu</button><button class="w95-btn" data-mp="viajar" title="Ir até um local (a pé ou de carro)">🚗 Ir…</button><button class="w95-btn" data-mp="buscar" title="Achar um local">⌕ Achar</button></span>
      <span class="mp-grupo"><button class="w95-btn" data-mp="regua" title="Medir distância">📏 Régua</button><button class="w95-btn" data-mp="sinal" title="Mandar um sinal no mapa para todos">✱ Sinal</button><button class="w95-btn mp-so-cid" data-mp="marcador" title="Criar marcador do grupo">⚑ Marcador</button></span>
      <span class="mp-grupo"><button class="w95-btn" data-mp="camadas" title="Legenda, marcadores e quem está no mapa">☰ Legenda</button><button class="w95-btn" data-mp="som" title="Som ambiente do bairro">♪</button></span>
    </div>
    <div class="mp-corpo">
      <div class="mp-vista"><canvas class="mp-cv" aria-label="Mapa de Crowsrest"></canvas>
        <div class="mp-status"></div>
        <div class="mp-persg" hidden></div>
        <div class="mp-replay" hidden></div>
        <div class="mp-dica">Arraste para mover · dois dedos para zoom e giro · toque num prédio para ver o cartão · segure para mandar um sinal</div>
      </div>
      <aside class="mp-cartao" hidden><div class="mp-cartao-h"><b class="mp-cartao-t"></b><button class="tbx x" data-mp="fechar" aria-label="Fechar">✕</button></div><div class="mp-cartao-c"></div></aside>
    </div></div>`;
  raiz = sec; cv = $('.mp-cv', sec); cx = cv.getContext('2d'); redimensionar.feito = false;
  ligarGestos(cv);
  new ResizeObserver(() => redimensionar()).observe($('.mp-vista', sec));
  $('.mp-barra', sec).addEventListener('click', e => { const b = e.target.closest('[data-mp]'); if (b) acao(b.dataset.mp, b); });
  $('.mp-regioes', sec).addEventListener('click', e => { const b = e.target.closest('[data-mp]'); if (b) acao(b.dataset.mp, b); });
  // a barra rola de lado no celular: um degradê mostra que há mais botões
  const barra = $('.mp-barra', sec), dica = () => { barra.classList.toggle('rola-dir', barra.scrollLeft + barra.clientWidth < barra.scrollWidth - 4); barra.classList.toggle('rola-esq', barra.scrollLeft > 4); };
  barra.addEventListener('scroll', dica, { passive: true }); new ResizeObserver(dica).observe(barra); setTimeout(dica, 50);
  $('.mp-cartao', sec).addEventListener('click', e => { const b = e.target.closest('[data-mp]'); if (b) acao(b.dataset.mp, b); });
  setTimeout(() => { const d = $('.mp-dica', sec); if (d) d.classList.add('some'); }, 7000);
  atualizarBarra(); atualizarRegioes(); atualizarPersg(); Amb.atualizar();
  if (CRW.TV) sec.classList.add('mp-tv');
}
function acao(a, b) {
  const c = mundo().c;
  switch (a) {
    case 'mais': zoomEm(W / 2, H / 2, 1.3); break;
    case 'menos': zoomEm(W / 2, H / 2, 0.77); break;
    case 'girarE': c.rot -= 45; salvarCam(); sujo(); break;
    case 'girarD': c.rot += 45; salvarCam(); sujo(); break;
    case 'iso': c.rot = view.modo === 'cidade' ? 45 : 30; c.tilt = 52; salvarCam(); enquadrar(); break;
    case 'topo': c.rot = 0; c.tilt = 0; salvarCam(); enquadrar(); break;
    case 'eu': irAteMim(); break;
    case 'buscar': buscar(); break;
    case 'regua': case 'sinal': case 'marcador':
      view.ferr = view.ferr === a ? null : a; if (a !== 'regua' || !view.ferr) regua = null;
      $$('[data-mp="regua"],[data-mp="sinal"],[data-mp="marcador"]', raiz).forEach(x => x.classList.toggle('on', x.dataset.mp === view.ferr));
      if (view.ferr === 'regua') aviso('Régua ligada: arraste no mapa para medir. Toque de novo para desligar.');
      if (view.ferr === 'sinal') aviso('Toque no mapa para mandar um sinal que todos veem por alguns segundos.');
      if (view.ferr === 'marcador') aviso('Toque no mapa onde quer pôr o marcador do grupo.');
      sujo(); break;
    case 'camadas': legenda(); break;
    case 'som': Amb.ligado = !Amb.ligado; CRW.ls.set('mpSom', Amb.ligado); Amb.atualizar(); aviso(Amb.ligado ? 'Som ambiente ligado (depende do som geral 🔊).' : 'Som ambiente desligado.'); atualizarBarra(); break;
    case 'voltar': sairInterior(); break;
    case 'fechar': fecharCartao(); view.sel = null; view.salaSel = null; sujo(); break;
    case 'andar': trocarAndar(b.dataset.a); break;
    case 'regiao': trocarRegiao(b.dataset.r); break;
    case 'condado': abrirCondado(); break;
    case 'viajar': if (CRW.P.mestre && !CRW.v().pc) aviso('Guardião: arraste as peças no mapa (vão na hora) ou toque numa peça.'); else escolherDestino(); break;
  }
}
function atualizarBarra() {
  if (!raiz) return;
  raiz.classList.toggle('mp-interior', view.modo === 'interior');
  const s = $('[data-mp="som"]', raiz); if (s) s.classList.toggle('on', Amb.ligado);
  const eu = $('[data-mp="eu"]', raiz); if (eu) eu.hidden = !CRW.v().pc;
  const vj = $('[data-mp="viajar"]', raiz); if (vj) vj.hidden = !CRW.v().pc || !!CRW.v().espiando;
  atualizarRegioes();
  const an = $('.mp-andares', raiz);
  if (an && view.modo === 'interior') {
    const I = INTERIORES[view.int];
    an.innerHTML = `<b class="mp-int-n">${esc(I.nome)}</b>` + I.andares.map(x => `<button class="w95-btn${x.id === view.andar ? ' on' : ''}" data-mp="andar" data-a="${esc(x.id)}">${destrancado(view.int, x.id) ? '' : '🔒 '}${esc(x.nome)}</button>`).join('');
  }
}
function atualizarStatus() {
  if (!raiz) return; const st = $('.mp-status', raiz); if (!st) return;
  const r = CRW.relogio(), cl = clima(), nv = num(cl.neblina), ch = num(cl.chuva);
  const partes = [`<b>${esc(r.data.slice(0, 5))} ${pad2(r.h)}:${pad2(r.m)}</b> ${esc(CRW.diaSemana(r.data))}`];
  partes.push(NOITE > 0.6 ? 'noite' : NOITE > 0.1 ? 'entardecer' : 'dia');
  if (nv) partes.push(['', 'neblina leve', 'neblina', 'neblina fechada'][clamp(nv, 0, 3)]);
  if (ch) partes.push(ch >= 2 ? 'temporal' : 'chuva');
  if (semLuz()) partes.push('<span class="mp-alerta">sem energia</span>');
  if (CRW.sangria() > 0 && (CRW.v().mestre || CRW.v().aux)) partes.push(`Sangria ${CRW.sangria()}`);
  const v = CRW.v();
  if (v.pc) {
    const tk = (S().tokens || {})[v.pc];
    if (tk && emViagem(tk)) { const vg = tk.veic ? (veicPos[tk.veic] || {}).viagem : tk.viagem, p = posDe(tk); partes.push(`<b>${vg && vg.modo === 'carro' ? '🚗' : '🚶'} a caminho de ${esc(nomeLugar(vg && vg.para))}</b>${p && !p.reg ? ' (na ' + esc(p.estrada || 'estrada') + ')' : ''} · chega ${esc(horaDe(num(vg.ini) + num(vg.dur)))}${CRW.relogio().real || (S().relogio || {}).rodando ? '' : ' <span class="mp-alerta">relógio parado</span>'}`); }
    else { const o = ondeEsta(v.pc); if (o) partes.push(`você: ${esc(LOTE[o].nome.replace(/\s*\(.*\)$/, ''))}`); else if (tk) { const rg = regiaoDe(tk); if (rg) partes.push(`você: ${esc(REG[rg].nome)}${tk.veic && veicDefs()[tk.veic] ? ' (no ' + esc(veicDefs()[tk.veic].nome || 'carro') + ')' : ''}`); } }
  }
  if (view.modo === 'cidade') partes.push(`<span class="mp-esc">mapa ${R().num} · ${esc(R().nome)} · ▢ = ${R().metros} m</span>`);
  if (view.replay) partes.unshift('<span class="mp-alerta">REPLAY</span>');
  const html = partes.join(' · ');
  if (st.innerHTML !== html) st.innerHTML = html;
}
function irAteMim(quieto) {
  const v = CRW.v(), tk = v.pc && (S().tokens || {})[v.pc];
  if (!tk) return aviso('Seu personagem ainda não está no mapa. O Guardião da Luz coloca as peças.');
  if (!naRua(tk)) { const [, int, an] = tk.loc.split(':'); entrarInterior(int, an); const p = { x: num(tk.x, 1.5), y: num(tk.y, 8.5) }; focar(p.x, p.y); }
  else {
    const p = posDe(tk);
    if (!p.reg) { if (!quieto) aviso(`Você está na estrada (${p.estrada || ''}). Assim que entrar numa região, o mapa mostra.`); return; }
    trocarRegiao(p.reg, true); focar(p.x, p.y, Math.max(cam.s, 1.2));
  }
  view.selTk = tk.id; sujo();
}
function buscar() {
  const v = CRW.v();
  const lista = LOTES.filter(l => conhecido(l) || v.mestre || v.aux).sort((a, b) => a.nome.localeCompare(b.nome));
  const w = janela({ titulo: 'Achar um local', largura: '420px', icone: '⌕', html: `<input class="w95-input mp-busca" placeholder="Digite parte do nome ou do endereço" style="width:100%">
    <ul class="mp-lista">${lista.map(l => `<li><button class="mp-li" data-id="${esc(l.id)}"><span class="mp-cat" style="background:${esc((CATEGORIAS[l.cat] || {}).cor || '#888')}"></span><b>${esc(l.nome)}</b><span class="mini">${REG[regDe(l)].num} · ${esc(REG[regDe(l)].nome)} · ${esc(l.end || '')}${conhecido(l) ? '' : ' · desconhecido dos jogadores'}</span></button></li>`).join('')}</ul>` });
  const inp = $('.mp-busca', w);
  inp.addEventListener('input', () => { const q = inp.value.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); $$('.mp-li', w).forEach(b => { b.parentElement.hidden = q && !b.textContent.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().includes(q); }); });
  w.addEventListener('click', e => { const b = e.target.closest('.mp-li'); if (!b) return; fecharJanela(w.parentElement.dataset.jan); irLote(b.dataset.id); });
  setTimeout(() => inp.focus(), 50);
}
function irLote(id) {
  const l = LOTE[id] || CASAS.find(c => c.id === id); if (!l) return;
  CRW.abrirModulo('mapa', true);
  setTimeout(() => { trocarRegiao(regDe(l), true); focar(l.x + l.w / 2, l.y + l.h / 2, Math.max(cam.s, 1.4)); view.sel = l.id; sujo(); abrirLote(l.id); }, 60);
}
function focarPeca(t) {
  if (!t) return;
  if (!naRua(t)) { const [, int, an] = t.loc.split(':'); entrarInterior(int, an); return; }
  const p = posDe(t); if (!p.reg) return aviso(`${nomeDe(t)} está na estrada (${p.estrada || ''}).`);
  trocarRegiao(p.reg, true); focar(p.x, p.y, Math.max(cam.s, 1.3)); view.selTk = t.id; sujo();
}
function legenda() {
  const v = CRW.v(), rg = R();
  const onde = t => { if (emViagem(t)) { const p = posDe(t); return p.reg ? 'a caminho · ' + REG[p.reg].nome : 'na estrada'; } const o = ondeEsta(t.id), r2 = regiaoDe(t); return (o ? LOTE[o].nome : 'na rua') + (r2 ? ' · ' + REG[r2].num : ''); };
  const tk = tokens().filter(t => !t.veic || !veicDefs()[t.veic]);
  const vs = Object.entries(veicDefs()).filter(([, d]) => d);
  const mks = Object.entries(marcadores).filter(([, m]) => m);
  janela({ titulo: 'Legenda do mapa', largura: '460px', icone: '☰', html: `
    <h4 class="mp-h4">Categorias</h4><div class="mp-leg">${Object.values(CATEGORIAS).map(c => `<span><i style="background:${c.cor}"></i>${esc(c.nome)}</span>`).join('')}</div>
    <p class="mini">Crowsrest tem 4 regiões, cada uma com o seu mapa (os botões 1 a 4 em cima). Esta é a <b>${rg.num} · ${esc(rg.nome)}</b>: 1 quadradinho = ${rg.metros} m, ${(rg.lado * rg.metros / 1000).toFixed(1).replace('.', ',')} km de lado.${rg.urbano ? '' : ' Fora do Centro, os prédios aparecem maiores que o real para dar para tocar; as distâncias e os tempos usam a escala certa.'} As placas ➜ na borda levam às outras regiões. Rótulos acinzentados: local fechado neste horário.</p>
    <h4 class="mp-h4">Investigadores e peças</h4><ul class="mp-lista">${tk.map(t => `<li><button class="mp-li" data-tk="${esc(t.id)}"><span class="mp-cat" style="background:${esc(corDe(t))}"></span><b>${esc(nomeDe(t))}</b><span class="mini">${esc(onde(t))}${t.h ? ' · oculto' : ''}${t.ronda && t.ronda.ativo ? ' · em ronda' : ''}</span></button></li>`).join('') || '<li class="vazio95">Nenhuma peça no mapa.</li>'}</ul>
    ${vs.length ? `<h4 class="mp-h4">Veículos</h4><ul class="mp-lista">${vs.map(([id, d]) => { const p = posVeiculo(id), oc = ocupantes(id); return `<li><button class="mp-li" data-vc="${esc(id)}"><span class="mp-cat" style="background:${esc(d.cor || '#7a8a99')}"></span><b>🚗 ${esc(d.nome || 'Carro')}</b><span class="mini">${p && p.reg ? esc(REG[p.reg].nome) : 'na estrada'}${oc.length ? ' · ' + esc(oc.map(t => nomeDe(t)).join(', ')) : ''}</span></button></li>`; }).join('')}</ul>` : ''}
    <h4 class="mp-h4">Marcadores do grupo</h4><ul class="mp-lista">${mks.map(([k, m]) => `<li><button class="mp-li" data-mk="${esc(k)}"><span class="mp-cat" style="background:${esc(m.cor || '#e74c3c')}"></span><b>${esc(m.titulo || 'marcador')}</b><span class="mini">${esc(m.nome || '')} · ${esc(REG[regDe(m)].nome)}${m.visitado ? ' · visitado' : ''}</span></button></li>`).join('') || '<li class="vazio95">Nenhum marcador. Use ⚑ Marcador.</li>'}</ul>
    ${v.mestre ? '<p class="mini">Guardião: os controles de relógio, clima, peças, veículos, viagens, névoa, bloqueios, rotinas, perseguição e replay ficam no Painel do Guardião, aba Mapa.</p>' : ''}`,
  }).addEventListener('click', e => {
    const b = e.target.closest('.mp-li'); if (!b) return;
    const j = b.closest('.jan-fundo'); if (j) fecharJanela(j.dataset.jan);
    if (b.dataset.tk) focarPeca((S().tokens || {})[b.dataset.tk]);
    if (b.dataset.vc) { const p = posVeiculo(b.dataset.vc); if (p && p.reg) { trocarRegiao(p.reg, true); focar(p.x, p.y, Math.max(cam.s, 1.3)); } abrirVeiculo(b.dataset.vc); }
    if (b.dataset.mk) { const m = marcadores[b.dataset.mk]; if (m) { trocarRegiao(regDe(m), true); focar(m.x, m.y, Math.max(cam.s, 1.3)); abrirMarcador(b.dataset.mk); } }
  });
}

/* =========================================================
   CARTÃO DO LOCAL (e de peças, marcadores e salas)
   ========================================================= */
let cartaoAtual = null;
function mostrarCartao(titulo, html, tipo) {
  if (!raiz) return; const a = $('.mp-cartao', raiz);
  $('.mp-cartao-t', a).textContent = titulo; const c = $('.mp-cartao-c', a);
  if (typeof html === 'string') c.innerHTML = html; else { c.innerHTML = ''; c.appendChild(html); }
  a.hidden = false; a.dataset.tipo = tipo || ''; c.scrollTop = 0; raiz.classList.add('mp-com-cartao');
  redimensionar();
  return c;
}
function fecharCartao() { if (!raiz) return; const a = $('.mp-cartao', raiz); a.hidden = true; cartaoAtual = null; raiz.classList.remove('mp-com-cartao'); redimensionar(); }
function quemNoLote(l) {
  return tokensVisiveis().filter(tk => {
    if (tk.loc && tk.loc !== 'c') return l.interior && tk.loc.split(':')[1] === l.interior;
    const p = posDe(tk); return lotePerto(p.x, p.y) === l;
  });
}
function horarioTxt(l) {
  if (!l.horario) return '';
  const [a, f] = l.horario, ab = aberto(l);
  if (a === 0 && f >= 24) return '<span class="etq verde">aberto 24 h</span>';
  return `<span class="etq ${ab ? 'verde' : 'verm'}">${ab ? 'aberto agora' : 'fechado agora'}</span> <span class="mini">${pad2(a)}h às ${pad2(f % 24)}h</span>`;
}
function abrirLote(id) {
  const l = LOTE[id] || CASAS.find(c => c.id === id); if (!l) return;
  cartaoAtual = { tipo: 'lote', id };
  const v = CRW.v(), conh = conhecido(l), G = v.mestre && !v.espiando, cat = CATEGORIAS[l.cat] || {};
  const b = bairroEm(l.x + l.w / 2, l.y + l.h / 2, regDe(l)), rgL = REG[regDe(l)];
  if (!conh && !v.mestre && !v.aux) {
    mostrarCartao('Local desconhecido', `<p class="tx">Neblina. O grupo ainda não sabe o que existe aqui.</p><p class="mini">${b ? esc(b.nome) : ''}</p>`, 'lote'); return;
  }
  const quem = quemNoLote(l);
  const segRev = (S().lotesSeg || {})[l.id];
  const fotos = Object.entries((S().fotosLote || {})[l.id] || {});
  const test = Object.entries((S().testemunhas || {})[l.id] || {});
  const meuTk = v.pc && (S().tokens || {})[v.pc];
  const souAqui = meuTk && ondeEsta(meuTk.id) === l.id && !emViagem(meuTk);
  const rotaEu = meuTk && naRua(meuTk) && !souAqui ? (() => { const p = posDe(meuTk); return p.reg ? rotaEntre(p, frente(l)) : null; })() : null;
  const corpo = el('div', 'mp-cart');
  corpo.innerHTML = `
    <div class="mp-cart-cab"><span class="mp-cat" style="background:${esc(cat.cor || '#888')}"></span><span class="etq">${esc(cat.nome || l.cat)}</span> ${horarioTxt(l)}${conh ? '' : ' <span class="etq ambar">oculto na névoa</span>'}</div>
    <p class="mini">${esc(l.end || '')}${b ? ' · ' + esc(b.nome) : ''} · região ${rgL.num} (${esc(rgL.nome)})</p>
    ${rotaEu ? `<p class="mini">Daqui: <b>${esc(fmtM(rotaEu.km * 1000))}</b> · 🚶 ${esc(fmtMin(minutosDe(rotaEu.km, 'pe')))} · 🚗 ${esc(fmtMin(minutosDe(rotaEu.km, 'carro')))}</p>` : souAqui ? '<p class="mini"><b>Você está aqui.</b></p>' : ''}
    <p class="tx">${esc(l.pub || '')}</p>
    ${segRev ? `<div class="mp-desc"><b>Descoberto pelo grupo</b><p>${esc(segRev)}</p></div>` : ''}
    <div class="mp-sec"><b>Quem está aqui</b>${quem.length ? `<ul class="mp-quem">${quem.map(t => `<li><span class="mp-cat" style="background:${esc(corDe(t))}"></span>${esc(nomeDe(t))}${t.loc && t.loc !== 'c' ? ' <span class="mini">(lá dentro)</span>' : ''}${t.h ? ' <span class="mini">(oculto)</span>' : ''}</li>`).join('')}</ul>` : '<p class="mini">Ninguém do lado de fora, que se veja.</p>'}</div>
    ${fotos.length || G ? `<div class="mp-sec"><b>Fotos do local</b><div class="mp-fotos">${fotos.map(([k, f]) => `<figure><img src="${esc(f.img)}" alt="" data-foto="${esc(k)}"><figcaption>${esc(f.legenda || '')}</figcaption>${G ? `<button class="w95-btn perigo" data-tira-foto="${esc(k)}">×</button>` : ''}</figure>`).join('') || '<p class="mini">Nenhuma foto.</p>'}</div>${G ? '<button class="w95-btn" data-add-foto>+ Foto</button><input type="file" accept="image/*" hidden data-arq-foto>' : ''}</div>` : ''}
    ${test.length || G ? `<div class="mp-sec"><b>Testemunhas</b>${test.length ? `<ul class="mp-test">${test.map(([, t]) => `<li><b>${esc(t.nome || '')}</b> <span class="mini">${esc(t.horario || '')}</span><br>${esc(t.relato || '')}</li>`).join('')}</ul>` : '<p class="mini">Ninguém disse nada ainda.</p>'}</div>` : ''}
    <div class="mp-extras"></div>
    <div class="linha95 mp-acoes">
      <button class="w95-btn" data-c="focar">◎ Focar</button>
      ${l.interior ? '<button class="w95-btn pri" data-c="entrar">▣ Ver por dentro</button>' : ''}
      ${meuTk && !G && !v.espiando ? `${souAqui ? '' : '<button class="w95-btn" data-c="ir">🚗 Ir até aqui</button>'}${l.interior && souAqui && naRua(meuTk) && !meuTk.veic ? '<button class="w95-btn" data-c="entrarPc">Entrar com o personagem</button>' : ''}` : ''}
      <button class="w95-btn" data-c="marcar">⚑ Marcar</button>
    </div>
    ${G ? blocoMestreLote(l) : ''}`;
  mostrarCartao(l.nome, corpo, 'lote');
  // seções dos outros módulos (coletas, mural, anexos, jornal)
  const ex = $('.mp-extras', corpo);
  CRW.cartoes().forEach(c => { const d = el('div', 'mp-sec mp-ext'); try { c.render(l, d, v); } catch (e) { console.warn('cartão ' + c.id, e); } if (d.innerHTML.trim()) ex.appendChild(d); });
  corpo.addEventListener('click', e => cliqueCartao(e, l));
  const arq = $('[data-arq-foto]', corpo);
  if (arq) arq.addEventListener('change', async e => { const f = e.target.files[0]; e.target.value = ''; if (!f) return; try { const img = await CRW.lerImagem(f, 900, 0.75); const leg = await pedirTexto('Legenda da foto (opcional)', ''); Estado.definir(['fotosLote', l.id, Rede.chave()], { img, legenda: leg || '', ts: Date.now() }); CRW.diario('mapa', 'Foto adicionada em ' + l.nome); setTimeout(() => abrirLote(l.id), 200); } catch (er) { aviso('Imagem inválida.', 'erro'); } });
  if (G) ligarMestreLote(corpo, l);
}
function cliqueCartao(e, l) {
  const b = e.target.closest('[data-c]'); const img = e.target.closest('[data-foto]');
  if (img) { janela({ titulo: l.nome, largura: '760px', icone: '▣', html: `<img src="${esc(img.src)}" alt="" style="width:100%;height:auto;display:block">` }); return; }
  const tf = e.target.closest('[data-tira-foto]'); if (tf) { Estado.definir(['fotosLote', l.id, tf.dataset.tiraFoto], null); setTimeout(() => abrirLote(l.id), 150); return; }
  if (e.target.closest('[data-add-foto]')) { $('[data-arq-foto]', e.target.closest('.mp-cart')).click(); return; }
  if (!b) return;
  const v = CRW.v(), tk = v.pc && (S().tokens || {})[v.pc];
  switch (b.dataset.c) {
    case 'focar': trocarRegiao(regDe(l), true); focar(l.x + l.w / 2, l.y + l.h / 2, Math.max(cam.s, 1.5)); break;
    case 'entrar': entrarInterior(l.interior); break;
    case 'ir': if (tk) {
      let t2 = tk;
      // dentro de um prédio: sai pela frente antes de partir
      if (!naRua(tk)) { const [, int] = tk.loc.split(':'); const lp = LOTES.find(x => x.interior === int); if (lp) { const f = frente(lp); t2 = { ...tk, loc: 'c', reg: f.reg, x: f.x, y: f.y }; delete t2.viagem; Estado.definir(['tokens', tk.id], t2); } }
      abrirViagem({ ...frente(l, Object.keys(S().tokens || {}).indexOf(tk.id) % 8), lote: l.id }, t2);
    } break;
    case 'entrarPc': if (tk) { if (ondeEsta(tk.id) !== l.id) return aviso('Vá até lá primeiro.'); const an = INTERIORES[l.interior].andares[0]; const n = { ...tk, loc: `i:${l.interior}:${an.id}`, x: 1.5, y: 8.5 }; delete n.viagem; Estado.definir(['tokens', tk.id], n); entrarInterior(l.interior, an.id); } break;
    case 'marcar': novoMarcador({ x: l.x + l.w / 2, y: l.y + l.h + 0.4 }, l.nome); break;
  }
}
function abrirPeca(tk) {
  const v = CRW.v(), s = CRW.ser(tk.id) || {}, o = ondeEsta(tk.id), G = v.mestre && !v.espiando;
  const loc = tk.loc && tk.loc !== 'c' ? tk.loc.split(':') : null;
  const c = mostrarCartao(nomeDe(tk), `
    <div class="mp-cart-cab"><span class="mp-cat" style="background:${esc(corDe(tk))}"></span><span class="etq">${tk.tipo === 'pc' ? 'investigador' : tk.tipo === 'viatura' ? 'viatura' : 'pessoa'}</span>${tk.h ? ' <span class="etq ambar">oculto</span>' : ''}${tk.ronda && tk.ronda.ativo ? ' <span class="etq azul">em ronda</span>' : ''}</div>
    ${s.foto ? `<img class="mp-retrato" src="${esc(s.foto)}" alt="">` : ''}
    <p class="tx">${esc(s.pub || (s.papel ? s.papel + (s.esp ? ' · ' + s.esp : '') : ''))}</p>
    <p class="mini">${(() => { if (emViagem(tk)) { const vg = tk.veic ? (veicPos[tk.veic] || {}).viagem : tk.viagem; return `${vg && vg.modo === 'carro' ? '🚗' : '🚶'} A caminho de ${esc(nomeLugar(vg && vg.para))} · chega ${esc(horaDe(num(vg.ini) + num(vg.dur)))}`; } const rg = regiaoDe(tk); return (o ? 'Em: ' + esc(LOTE[o].nome) : 'Na rua') + (rg ? ' · ' + esc(REG[rg].nome) : ''); })()}${tk.veic && veicDefs()[tk.veic] ? ' · no ' + esc(veicDefs()[tk.veic].nome || 'carro') : ''}${loc ? ' · ' + esc(((INTERIORES[loc[1]] || {}).andares || []).find(a => a.id === loc[2])?.nome || '') : ''}</p>
    <div class="linha95">${loc ? `<button class="w95-btn" data-pc="ver">▣ Ver o andar</button>${podeMover(tk) ? '<button class="w95-btn" data-pc="sair">Sair do prédio</button>' : ''}` : ''}<button class="w95-btn" data-pc="focar">◎ Focar</button></div>
    ${G ? `<div class="mp-sec mp-mestre"><b>Guardião</b><div class="linha95">${emViagem(tk) ? '<button class="w95-btn pri" data-pc="chegar">Chegar agora</button>' : ''}<button class="w95-btn" data-pc="levar">Levar para…</button><button class="w95-btn" data-pc="ocultar">${tk.h ? 'Mostrar a todos' : 'Ocultar dos jogadores'}</button><button class="w95-btn" data-pc="ronda">${tk.ronda && tk.ronda.ativo ? 'Parar ronda' : 'Ronda…'}</button><button class="w95-btn perigo" data-pc="tirar">Tirar do mapa</button></div></div>` : ''}`, 'peca');
  c.addEventListener('click', async e => {
    const b = e.target.closest('[data-pc]'); if (!b) return;
    const atual = (S().tokens || {})[tk.id] || tk;
    if (b.dataset.pc === 'focar') { if (loc) { entrarInterior(loc[1], loc[2]); focar(num(atual.x, 6), num(atual.y, 5)); } else focarPeca(atual); }
    if (b.dataset.pc === 'chegar') { if (atual.veic) chegarAgora({ veic: atual.veic }); else chegarAgora({ tk: atual.id }); setTimeout(() => abrirPeca((S().tokens || {})[tk.id] || tk), 200); }
    if (b.dataset.pc === 'levar') { const w = janela({ titulo: 'Levar ' + nomeDe(tk) + ' para…', largura: '400px', html: `<label class="campo">Local<select class="w95-input" data-l>${opcoesLotes()}</select></label><p class="mini">Vai na hora, sem viagem. Se estava num carro, desce.</p><div class="msg-bts"><button class="w95-btn pri" data-ok>Levar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` }); $('[data-ok]', w).onclick = () => { const lt = LOTE[$('[data-l]', w).value]; const f = frente(lt, Object.keys(S().tokens || {}).indexOf(tk.id) % 8); const n = { ...((S().tokens || {})[tk.id] || tk), loc: 'c', reg: f.reg, x: f.x, y: f.y }; delete n.viagem; delete n.veic; delete n._tela; if (n.ronda) n.ronda = { ...n.ronda, ativo: false }; Estado.definir(['tokens', tk.id], n); CRW.diario('mapa', `${nomeDe(tk)} levado para ${lt.nome}`); fecharJanela(w.parentElement.dataset.jan); trocarRegiao(f.reg, true); focar(f.x, f.y, Math.max(cam.s, 1.3)); }; }
    if (b.dataset.pc === 'ver' && loc) entrarInterior(loc[1], loc[2]);
    if (b.dataset.pc === 'sair' && loc) { const l = LOTES.find(x => x.interior === loc[1]); const p = frente(l); Estado.definir(['tokens', tk.id], { ...atual, loc: 'c', reg: p.reg, x: p.x, y: p.y }); sairInterior(); fecharCartao(); }
    if (b.dataset.pc === 'ocultar') { const n = { ...atual }; if (n.h) delete n.h; else n.h = true; delete n._tela; if (n.tipo === 'pc') { delete n.h; aviso('Investigadores ficam sempre visíveis.'); } Estado.definir(['tokens', tk.id], n); CRW.diario('mapa', `${nomeDe(tk)} ${n.h ? 'oculto' : 'visível'} no mapa`); setTimeout(() => abrirPeca(n), 150); }
    if (b.dataset.pc === 'tirar' && await confirmar(`Tirar ${nomeDe(tk)} do mapa?`)) { Estado.definir(['tokens', tk.id], null); fecharCartao(); }
    if (b.dataset.pc === 'ronda') { if (atual.ronda && atual.ronda.ativo) { const p = posDe(atual); Estado.definir(['tokens', tk.id], { ...atual, reg: p.reg || regDe(atual), x: +p.x.toFixed(2), y: +p.y.toFixed(2), ronda: { ...atual.ronda, ativo: false } }); } else editarRonda(atual); }
  });
}
function editarRonda(tk) {
  const atual = (tk.ronda && tk.ronda.pts) ? tk.ronda.pts.filter(p => typeof p === 'string') : ['delegacia', 'banco', 'posto'];
  const w = janela({ titulo: 'Ronda de ' + nomeDe(tk), largura: '440px', icone: '⟳', html: `<p class="mini">A peça percorre os locais em sequência e recomeça. Todos veem a peça andando, calculada pelo relógio (não gasta internet).</p>
    <label class="campo">Locais da rota, na ordem (separe com vírgula)<input class="w95-input" data-r value="${esc(atual.join(', '))}"></label>
    <p class="mini">Todos os locais da ronda precisam ser da mesma região. Ids por região: ${REGIOES.map(rg => `<b>${rg.num}</b> ${lotesDa(rg.id).map(l => l.id).join(', ')}`).join(' · ')}</p>
    <label class="campo">Velocidade (quadradinhos por minuto real)<input class="w95-input" type="number" min="1" max="60" data-v value="${esc(num((tk.ronda || {}).vel, 6))}"></label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Começar a ronda</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).onclick = () => {
    const pts = $('[data-r]', w).value.split(',').map(x => x.trim()).filter(x => LOTE[x]);
    if (pts.length < 2) return aviso('Informe pelo menos dois locais válidos.', 'erro');
    if (new Set(pts.map(x => regDe(LOTE[x]))).size > 1) return aviso('Os locais da ronda precisam ser da mesma região.', 'erro');
    const atualTk = (S().tokens || {})[tk.id] || tk;
    Estado.definir(['tokens', tk.id], { ...atualTk, loc: 'c', reg: regDe(LOTE[pts[0]]), viagem: null, ronda: { pts, vel: clamp(num($('[data-v]', w).value, 6), 1, 60), ts: Date.now(), ativo: true } });
    CRW.diario('mapa', `Ronda de ${nomeDe(tk)}: ${pts.join(' > ')}`);
    fecharJanela(w.parentElement.dataset.jan); sujo(true);
  };
}
async function novoMarcador(p, titulo0) {
  const v = CRW.v(); if (v.espiando) return aviso('Ver pelos olhos é só leitura.');
  const titulo = await pedirTexto('Nome do marcador (o grupo todo vê)', titulo0 || ''); if (titulo === null) return;
  const quem = CRW.P.mestre ? 'Guardião' : CRW.P.aux ? (CRW.P.nomeAux || 'Auxiliar') : nomeDe({ id: CRW.P.pc });
  const k = Rede.chave();
  Rede.set('caso/marcadores/' + k, { x: +p.x.toFixed(2), y: +p.y.toFixed(2), reg: view.reg, titulo: titulo.trim() || 'Marcador', nota: '', cor: CRW.P.pc ? corDe({ id: CRW.P.pc, tipo: 'pc' }) : '#e74c3c', pc: CRW.P.pc || null, nome: quem, ts: Date.now(), visitado: false }).catch(() => aviso('Não foi possível gravar o marcador.', 'erro'));
  if (view.ferr === 'marcador') { view.ferr = null; $$('[data-mp="marcador"]', raiz).forEach(x => x.classList.remove('on')); }
}
function abrirMarcador(k) {
  const m = marcadores[k]; if (!m) return;
  const v = CRW.v(), meu = m.pc && m.pc === CRW.P.pc, pode = !v.espiando && (meu || CRW.P.mestre || CRW.P.aux || true);
  const c = mostrarCartao('⚑ ' + (m.titulo || 'Marcador'), `<p class="mini">Criado por ${esc(m.nome || '')}${m.lote ? '' : ''}</p>
    <label class="campo">Nota do grupo<textarea class="w95-input" rows="4" data-n ${pode ? '' : 'disabled'}>${esc(m.nota || '')}</textarea></label>
    <label class="chk95"><input type="checkbox" data-vis ${m.visitado ? 'checked' : ''} ${pode ? '' : 'disabled'}> Já visitado</label>
    <div class="linha95">${pode ? '<button class="w95-btn pri" data-salvar>Salvar</button>' : ''}${meu || CRW.P.mestre || CRW.P.aux ? '<button class="w95-btn perigo" data-apagar>Apagar</button>' : ''}</div>`, 'marcador');
  c.addEventListener('click', async e => {
    if (e.target.closest('[data-salvar]')) { Rede.update('caso/marcadores/' + k, { nota: $('[data-n]', c).value, visitado: $('[data-vis]', c).checked }).catch(() => {}); aviso('Marcador salvo.'); }
    if (e.target.closest('[data-apagar]') && await confirmar('Apagar este marcador para todos?')) { Rede.set('caso/marcadores/' + k, null).catch(() => {}); fecharCartao(); }
  });
}

/* ---------- interiores ---------- */
function entrarInterior(int, andar) {
  if (!INTERIORES[int]) return;
  const nova = view.int !== int;
  view.modo = 'interior'; view.int = int; view.andar = andar || (view.int === int && view.andar) || INTERIORES[int].andares[0].id; view.salaSel = null;
  if (nova) { camI.rot = 0; camI.tilt = 40; }
  const lt = LOTES.find(x => x.interior === int); if (lt && regDe(lt) !== view.reg) { view.reg = regDe(lt); CRW.ls.set('mpReg', view.reg); }
  fecharCartao(); atualizarBarra(); enquadrar(); Amb.atualizar();
}
function sairInterior() {
  const l = LOTES.find(x => x.interior === view.int);
  view.modo = 'cidade'; view.salaSel = null;
  if (l && regDe(l) !== view.reg) { view.reg = regDe(l); CRW.ls.set('mpReg', view.reg); enquadrar(); }
  atualizarBarra(); fecharCartao();
  if (l) { focar(l.x + l.w / 2, l.y + l.h / 2); view.sel = l.id; }
  sujo(); Amb.atualizar();
}
async function trocarAndar(a) {
  if (!destrancado(view.int, a)) {
    const tr = (S().trancas || {})[view.int + '_' + a];
    if (!tr) { aviso('Este andar está trancado. Só o Guardião da Luz pode abrir.', 'erro'); view.andar = a; atualizarBarra(); sujo(); return; }
    const senha = await pedirTexto('Andar trancado. Digite a senha:', '', { tipo: 'password', titulo: 'Fechadura' });
    if (senha === null) return;
    if (await CRW.hash(senha.trim().toLowerCase()) !== tr) { CRW.Som.erro(); aviso('Senha incorreta.', 'erro'); view.andar = a; atualizarBarra(); sujo(); return; }
    CRW.ls.set('abriu:' + view.int + '_' + a, true); CRW.Som.ding();
    CRW.pedir('tranca', { interior: view.int, andar: a }).pronto.catch(() => {});
    aviso('Destrancado.');
  }
  view.andar = a; view.salaSel = null; atualizarBarra(); fecharCartao(); sujo();
}
function abrirSala(sa) {
  const v = CRW.v(), G = v.mestre && !v.espiando;
  const rev = (((S().salasRev || {})[view.int]) || {})[sa.id];
  const loc = `i:${view.int}:${view.andar}`, dentroS = tokensVisiveis().filter(t => t.loc === loc && dentro(sa, num(t.x), num(t.y)));
  const seg = G ? ((Segredos.ler(['salas', view.int, sa.id]) || {}).texto || Segredos.ler(['salas', view.int, sa.id]) || '') : '';
  const meuTk = v.pc && (S().tokens || {})[v.pc];
  const c = mostrarCartao(sa.nome, `<p class="mini">${esc(INTERIORES[view.int].nome)} · ${esc((INTERIORES[view.int].andares.find(a => a.id === view.andar) || {}).nome || '')}</p>
    ${rev ? `<div class="mp-desc"><b>O que o grupo descobriu</b><p>${esc(rev)}</p></div>` : '<p class="tx dim">Nada de especial anotado sobre esta sala.</p>'}
    <div class="mp-sec"><b>Quem está aqui</b>${dentroS.length ? `<ul class="mp-quem">${dentroS.map(t => `<li><span class="mp-cat" style="background:${esc(corDe(t))}"></span>${esc(nomeDe(t))}</li>`).join('')}</ul>` : '<p class="mini">Ninguém.</p>'}</div>
    ${meuTk && podeMover(meuTk) && !G ? '<div class="linha95"><button class="w95-btn" data-s="ir">Ir para esta sala</button></div>' : ''}
    ${G ? `<div class="mp-sec mp-mestre"><b>Guardião · segredo da sala</b><textarea class="w95-input" rows="4" data-seg placeholder="Só você lê. Revele quando o grupo descobrir.">${esc(typeof seg === 'string' ? seg : '')}</textarea>
      <div class="linha95"><button class="w95-btn" data-s="salvar">Salvar</button><button class="w95-btn pri" data-s="revelar">${rev ? 'Atualizar revelação' : 'Revelar ao grupo'}</button>${rev ? '<button class="w95-btn perigo" data-s="esconder">Esconder</button>' : ''}</div></div>` : ''}`, 'sala');
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-s]'); if (!b) return;
    const txt = ($('[data-seg]', c) || {}).value;
    if (b.dataset.s === 'ir' && meuTk) Estado.definir(['tokens', meuTk.id], { ...meuTk, loc, x: +(sa.x + sa.w / 2).toFixed(2), y: +(sa.y + sa.h / 2).toFixed(2) });
    if (b.dataset.s === 'salvar') { Segredos.gravar(['salas', view.int, sa.id], { texto: txt }); aviso('Segredo da sala salvo.'); }
    if (b.dataset.s === 'revelar') { if (!String(txt || '').trim()) return aviso('Escreva o que o grupo descobre.', 'erro'); Segredos.gravar(['salas', view.int, sa.id], { texto: txt }); Estado.definir(['salasRev', view.int, sa.id], txt.trim()); CRW.diario('revelacao', `Sala revelada: ${INTERIORES[view.int].nome} · ${sa.nome}`); setTimeout(() => abrirSala(sa), 150); }
    if (b.dataset.s === 'esconder') { Estado.definir(['salasRev', view.int, sa.id], null); setTimeout(() => abrirSala(sa), 150); }
  });
}

/* ---------- o que o Guardião vê no cartão do local ---------- */
function blocoMestreLote(l) {
  const seg = Segredos.ler(['lotes', l.id]) || {}, gat = Segredos.ler(['gatilhos', l.id]) || {}, tst = Segredos.ler(['testemunhas', l.id]) || {};
  const rev = (S().lotesSeg || {})[l.id];
  return `<div class="mp-sec mp-mestre"><b>Guardião da Luz</b>
    ${l.conhecido === false ? `<div class="linha95"><button class="w95-btn" data-g="nevoa">${conhecido(l) ? 'Cobrir de névoa de novo' : 'Revelar o local (tirar a névoa)'}</button></div>` : ''}
    <label class="campo">Segredo do local (só você lê)<textarea class="w95-input" rows="4" data-g-seg>${esc(seg.segredo || '')}</textarea></label>
    <div class="linha95"><button class="w95-btn" data-g="salvarSeg">Salvar</button><button class="w95-btn pri" data-g="revelarSeg">${rev ? 'Atualizar o que foi descoberto' : 'Revelar ao grupo'}</button>${rev ? '<button class="w95-btn perigo" data-g="esconderSeg">Esconder</button>' : ''}</div>
    <p class="mini">Revelar copia o texto acima para a área pública, no cartão do local. Edite antes, se quiser revelar só uma parte.</p>
    <label class="chk95"><input type="checkbox" data-g-gat ${gat.ativo ? 'checked' : ''}> Gatilho: me avise quando um investigador entrar aqui</label>
    <label class="campo">Lembrete do gatilho (aparece no seu alerta)<input class="w95-input" data-g-msg value="${esc(gat.msg || '')}" placeholder="ex.: a garçonete reconhece o Furão na foto"></label>
    <b class="mp-sub">Testemunhas do horário</b>
    <ul class="mp-test">${Object.entries(tst).map(([k, t]) => `<li><b>${esc(t.nome || '')}</b> <span class="mini">${esc(t.horario || '')}</span><br>${esc(t.relato || '')}<div class="linha95"><button class="w95-btn" data-g-tl="${esc(k)}">${(((S().testemunhas || {})[l.id]) || {})[k] ? 'Esconder' : 'Liberar'}</button><button class="w95-btn perigo" data-g-td="${esc(k)}">×</button></div></li>`).join('') || '<li class="mini">Nenhuma testemunha preparada.</li>'}</ul>
    <div class="linha95"><button class="w95-btn" data-g="novaTest">+ Testemunha</button></div>
  </div>`;
}
function ligarMestreLote(c, l) {
  const gatChk = $('[data-g-gat]', c), gatMsg = $('[data-g-msg]', c);
  const salvarGat = () => Segredos.gravar(['gatilhos', l.id], gatChk.checked || gatMsg.value ? { ativo: gatChk.checked, msg: gatMsg.value } : null);
  gatChk.addEventListener('change', () => { salvarGat(); aviso(gatChk.checked ? 'Gatilho ligado.' : 'Gatilho desligado.'); });
  gatMsg.addEventListener('change', salvarGat);
  c.addEventListener('click', async e => {
    const b = e.target.closest('[data-g]'), tl = e.target.closest('[data-g-tl]'), td = e.target.closest('[data-g-td]');
    const txt = ($('[data-g-seg]', c) || {}).value || '';
    if (b) switch (b.dataset.g) {
      case 'nevoa': { const ja = conhecido(l); Estado.definir(['lotesRev', l.id], ja ? null : true); CRW.diario('revelacao', (ja ? 'Névoa de volta: ' : 'Local revelado: ') + l.nome); setTimeout(() => abrirLote(l.id), 150); break; }
      case 'salvarSeg': Segredos.gravar(['lotes', l.id], { ...(Segredos.ler(['lotes', l.id]) || {}), segredo: txt }); aviso('Segredo salvo.'); break;
      case 'revelarSeg': if (!txt.trim()) return aviso('Escreva o que o grupo descobre.', 'erro'); Segredos.gravar(['lotes', l.id], { ...(Segredos.ler(['lotes', l.id]) || {}), segredo: txt }); Estado.definir(['lotesSeg', l.id], txt.trim()); CRW.diario('revelacao', 'Segredo revelado: ' + l.nome); setTimeout(() => abrirLote(l.id), 150); break;
      case 'esconderSeg': Estado.definir(['lotesSeg', l.id], null); setTimeout(() => abrirLote(l.id), 150); break;
      case 'novaTest': {
        const w = janela({ titulo: 'Nova testemunha · ' + l.nome, largura: '420px', html: `<label class="campo">Quem<input class="w95-input" data-n list="mpNpcs"></label><datalist id="mpNpcs">${CRW.npcs().map(n => `<option value="${esc(n.nome)}">`).join('')}</datalist>
          <label class="campo">Horário (ex.: madrugada de 21/05, 03h)<input class="w95-input" data-h></label><label class="campo">O que viu ou ouviu<textarea class="w95-input" rows="4" data-r></textarea></label>
          <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar (fica com você)</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
        $('[data-ok]', w).onclick = () => { const t = { nome: $('[data-n]', w).value.trim(), horario: $('[data-h]', w).value.trim(), relato: $('[data-r]', w).value.trim() }; if (!t.nome) return aviso('Diga quem é a testemunha.', 'erro'); Segredos.gravar(['testemunhas', l.id, Rede.chave()], t); fecharJanela(w.parentElement.dataset.jan); setTimeout(() => abrirLote(l.id), 150); };
        break;
      }
    }
    if (tl) { const k = tl.dataset.gTl, t = Segredos.ler(['testemunhas', l.id, k]); const ja = (((S().testemunhas || {})[l.id]) || {})[k]; Estado.definir(['testemunhas', l.id, k], ja ? null : t); if (!ja) CRW.diario('revelacao', `Testemunha liberada em ${l.nome}: ${t && t.nome}`); setTimeout(() => abrirLote(l.id), 150); }
    if (td && await confirmar('Apagar esta testemunha?')) { const k = td.dataset.gTd; Segredos.gravar(['testemunhas', l.id, k], null); Estado.definir(['testemunhas', l.id, k], null); setTimeout(() => abrirLote(l.id), 150); }
  });
}

/* =========================================================
   VIGIAS: gatilhos, saídas, replay e rotinas (no aparelho do Mestre)
   e o evento "entrouLote" (em todos)
   ========================================================= */
let ondeAntes = {}, posAntes = {}, filaMov = {}, timerMov = null;
const gatAcum = {};
function vigiar(s) {
  const toks = s.tokens || {};
  const agora = {};
  Object.values(toks).forEach(tk => { if (tk && tk.id) agora[tk.id] = ondeEsta(tk.id); });
  Object.entries(agora).forEach(([id, lote]) => {
    const tk = toks[id]; if (!tk || ondeAntes[id] === undefined || ondeAntes[id] === lote) return;
    if (lote) CRW.emit('entrouLote', { pc: tk.tipo === 'pc' ? id : null, id, lote });
    if (!CRW.P.mestre || tk.tipo !== 'pc' || !lote) return;
    const g = Segredos.ler(['gatilhos', lote]);
    if (g && g.ativo) {
      const a = gatAcum[lote] && Date.now() - gatAcum[lote].t < 20000 ? gatAcum[lote] : (gatAcum[lote] = { nomes: new Set(), t: Date.now() });
      a.nomes.add(nomeDe(tk)); a.t = Date.now();
      const ns = [...a.nomes], txt = (ns.length > 1 ? ns.slice(0, -1).join(', ') + ' e ' + ns[ns.length - 1] + ' entraram' : ns[0] + ' entrou') + ' em ' + LOTE[lote].nome + (g.msg ? ' · ' + g.msg : '');
      CRW.alertaMestre('⚑ Gatilho: ' + txt, 'gat-' + lote); CRW.diario('gatilho', txt);
    }
  });
  // saídas da cidade
  if (CRW.P.mestre) Object.values(toks).forEach(tk => {
    if (!tk || tk.tipo !== 'pc' || (tk.loc && tk.loc !== 'c')) return;
    const pp = posDe(tk), antes = posAntes[tk.id], sds = rg => (REG[rg] || {}).saidas || [];
    const sd = pp.reg && !pp.andando ? sds(pp.reg).find(x => Math.hypot(x.x - pp.x, x.y - pp.y) < 2.4) : null;
    const sdAntes = antes && antes.ef && sds(antes.ef.reg).find(x => Math.hypot(x.x - antes.ef.x, x.y - antes.ef.y) < 2.4);
    if (sd && (!sdAntes || sdAntes.id !== sd.id) && antes) CRW.alertaMestre(`${nomeDe(tk)} chegou à ${sd.nome}${(s.bloqueios || {})[sd.id] ? ' (BLOQUEADA)' : ''}`, 'saida-' + sd.id);
  });
  // replay: guarda os movimentos (só o Mestre grava)
  if (CRW.P.mestre && !CRW.TV) Object.values(toks).forEach(tk => {
    if (!tk || !tk.id) return; const a = posAntes[tk.id];
    const p = movDe(tk);
    if (a && (a.x !== p.x || a.y !== p.y || a.loc !== p.loc || a.reg !== p.reg)) { filaMov[tk.id] = p; if (!timerMov) timerMov = setTimeout(gravarMov, 1500); }
  });
  ondeAntes = agora;
  posAntes = Object.fromEntries(Object.values(toks).filter(t => t && t.id).map(t => [t.id, { ...movDe(t), ef: naRua(t) ? posDe(t) : null }]));
}
// para o replay: onde a peça vai ficar (a viagem grava o destino)
function movDe(tk) {
  const vg = tk.viagem && tk.viagem.para ? tk.viagem.para : null;
  return { x: num(vg ? vg.x : tk.x), y: num(vg ? vg.y : tk.y), reg: vg ? regDe(vg) : regDe(tk), loc: tk.loc || 'c' };
}
function gravarMov() {
  timerMov = null; const r = CRW.relogio();
  Object.entries(filaMov).forEach(([id, p]) => Rede.push('segredos/_mov/' + CRW.sessaoId(), { id, x: +p.x.toFixed(2), y: +p.y.toFixed(2), reg: p.reg, loc: p.loc, ts: Date.now(), h: `${pad2(r.h)}:${pad2(r.m)}`, d: r.data }).pronto.catch(() => {}));
  filaMov = {};
}
// rotinas dos NPCs: a cada minuto do jogo, o aparelho do Mestre leva cada NPC ao lugar do horário
let minRot = -1;
function hm(t) { const [h, m] = String(t || '0:0').split(':').map(Number); return (h || 0) * 60 + (m || 0); }
function rotinaAgora(lista, min) { return (lista || []).find(e => { const a = hm(e.de), b = hm(e.ate); return a <= b ? (min >= a && min < b) : (min >= a || min < b); }); }
function aplicarRotinas(forcar) {
  if (!CRW.P.mestre || CRW.P.espiar) return;
  const cfg = Segredos.ler(['rotinas']) || {}; if (!cfg._auto && !forcar) return;
  const r = CRW.relogio(); if (!forcar && r.minDia === minRot) return; minRot = r.minDia;
  const toks = S().tokens || {};
  Object.entries(cfg).forEach(([id, lista]) => {
    if (id.startsWith('_') || !Array.isArray(lista)) return;
    const e = rotinaAgora(lista, r.minDia); const tk = toks[id]; if (!e || !LOTE[e.lote]) return;
    if (!tk) { if (!cfg._criar) return; }
    else if (tk.ronda && tk.ronda.ativo) return;
    if (ondeEsta(id) === e.lote) return;
    const p = frente(LOTE[e.lote], (id.length * 3) % 8);
    const base = tk || { id, tipo: (CRW.ser(id) || {}).tipo === 'viatura' ? 'viatura' : 'npc' };
    const n = { ...base, loc: 'c', reg: p.reg, x: p.x, y: p.y }; delete n.viagem; Estado.definir(['tokens', id], n);
  });
}
CRW.on('tick', () => { aplicarRotinas(); if (view.replay && view.replay.tocando) view.replay.passo(); });
// pedidos de fechadura: o Mestre fica sabendo quem destrancou um andar
let pedTrancaVistos = CRW.ls.get('mpTrancaVistos', {});
CRW.on('perfil', v => {
  if (CRW.P.mestre && !assinouPed) { assinouPed = true; Rede.on('pedidos/tranca', x => { Object.entries(x || {}).forEach(([k, p]) => { if (pedTrancaVistos[k] || !p) return; pedTrancaVistos[k] = 1; CRW.ls.set('mpTrancaVistos', pedTrancaVistos); const I = INTERIORES[p.interior] || {}; const an = (I.andares || []).find(a => a.id === p.andar) || {}; CRW.alertaMestre(`🔓 ${p.nome || 'Alguém'} destrancou ${I.nome || ''} · ${an.nome || ''} com a senha`, 'tranca'); CRW.diario('mapa', `${p.nome} destrancou ${I.nome} · ${an.nome}`); Rede.set('pedidos/tranca/' + k, null).catch(() => {}); }); }, () => {}); }
  void v;
});
let assinouPed = false;

/* =========================================================
   SOM AMBIENTE POR BAIRRO (sintetizado)
   ========================================================= */
const Amb = {
  ligado: CRW.ls.get('mpSom', true), atual: null, nos: [], timer: null, mestre: null,
  bairroAlvo() {
    if (!raiz || !cv || !cv.offsetParent) return null;
    if (view.modo === 'interior') return 'interior';
    const v = CRW.v(), tk = v.pc && (S().tokens || {})[v.pc];
    let p = tk && naRua(tk) ? posDe(tk) : null;
    if (!p || p.reg !== view.reg) p = W ? telaParaChao(W / 2, H / 2) : { x: R().lado / 2, y: R().lado / 2 };
    const b = bairroEm(p.x, p.y, view.reg); return b ? b.som : 'mata';
  },
  atualizar() {
    const alvo = this.ligado && CRW.Som.ligado && CRW.moduloAtual() === 'mapa' ? this.bairroAlvo() : null;
    const chave = alvo ? alvo + (NOITE > 0.5 ? '-n' : '') + (CHUVA ? '-c' + CHUVA : '') : null;
    if (chave === this.atual) return;
    this.parar(); this.atual = chave; if (!alvo) return;
    const c = CRW.Som.pronto(); if (!c) { this.atual = null; return; }
    this.mestre = c.createGain(); this.mestre.gain.setValueAtTime(0.0001, c.currentTime); this.mestre.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.5); this.mestre.connect(c.destination);
    const ruidoLoop = (freq, tipo, vol, q = 0.7) => { const n = c.sampleRate * 2, b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; const s = c.createBufferSource(); s.buffer = b; s.loop = true; const f = c.createBiquadFilter(); f.type = tipo; f.frequency.value = freq; f.Q.value = q; const g = c.createGain(); g.gain.value = vol; s.connect(f).connect(g).connect(this.mestre); s.start(); this.nos.push(s); return g; };
    const lfo = (alvo2, taxa, prof) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.value = taxa; g.gain.value = prof; o.connect(g).connect(alvo2.gain); o.start(); this.nos.push(o); };
    const tom = (f, t0, d, tp, v) => { const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0; o.type = tp; o.frequency.setValueAtTime(f, t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(v, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(this.mestre); o.start(t); o.stop(t + d + 0.05); return o; };
    const noite = NOITE > 0.5;
    const eventos = [];
    if (alvo === 'rio') { const g = ruidoLoop(700, 'bandpass', 0.05, 0.6); lfo(g, 0.13, 0.02); ruidoLoop(260, 'lowpass', 0.03); }
    if (alvo === 'fabrica') { ruidoLoop(120, 'lowpass', 0.06); const o = c.createOscillator(), g = c.createGain(); o.type = 'sawtooth'; o.frequency.value = 52; g.gain.value = 0.012; o.connect(g).connect(this.mestre); o.start(); this.nos.push(o); eventos.push([4000, 9000, () => { tom(310, 0, 0.25, 'square', 0.03); tom(207, 0.12, 0.4, 'square', 0.02); }]); }
    if (alvo === 'centro') { ruidoLoop(350, 'lowpass', 0.025); eventos.push([18000, 40000, () => { [523.3, 659.3, 1046.5].forEach((f, i) => tom(f, 0, 3.2 - i * 0.6, 'sine', 0.035 - i * 0.008)); }]); }
    if (alvo === 'vento') { const g = ruidoLoop(500, 'lowpass', 0.04, 1.2); lfo(g, 0.08, 0.03); }
    if (alvo === 'pulptown') { ruidoLoop(260, 'lowpass', 0.03); eventos.push([9000, 26000, () => { tom(420, 0, 0.12, 'sawtooth', 0.025); tom(320, 0.16, 0.14, 'sawtooth', 0.02); }]); }
    if (alvo === 'mata') { ruidoLoop(400, 'lowpass', 0.02); eventos.push(noite ? [700, 1600, () => { for (let i = 0; i < 4; i++) tom(4600, i * 0.06, 0.04, 'square', 0.008); }] : [2500, 7000, () => { const f = 2600 + Math.random() * 1400; tom(f, 0, 0.12, 'sine', 0.02); tom(f * 1.2, 0.14, 0.1, 'sine', 0.015); }]); }
    if (alvo === 'interior') { ruidoLoop(90, 'lowpass', 0.035); eventos.push([8000, 20000, () => tom(140 + Math.random() * 40, 0, 0.5, 'triangle', 0.015)]); }
    if (CHUVA) ruidoLoop(3200, 'highpass', CHUVA >= 2 ? 0.05 : 0.025, 0.3);
    if (alvo !== 'interior' && Math.random() < 0.5) eventos.push([30000, 70000, () => CRW.Som.corvo()]);
    const agendar = ([a, b, fn]) => { const t = setTimeout(() => { if (this.atual !== chave) return; try { fn(); } catch (e) {} agendar([a, b, fn]); }, a + Math.random() * (b - a)); this.timers.push(t); };
    this.timers = []; eventos.forEach(agendar);
  },
  parar() {
    (this.timers || []).forEach(clearTimeout); this.timers = [];
    const c = CRW.Som.ctx, m = this.mestre, nos = this.nos; this.nos = []; this.mestre = null; this.atual = null;
    if (c && m) { try { m.gain.cancelScheduledValues(c.currentTime); m.gain.setValueAtTime(m.gain.value, c.currentTime); m.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.8); } catch (e) {} setTimeout(() => { nos.forEach(n => { try { n.stop(); } catch (e) {} }); try { m.disconnect(); } catch (e) {} }, 900); }
  },
};
setInterval(() => Amb.atualizar(), 2500);
CRW.on('som', () => Amb.atualizar());
CRW.on('modulo', () => Amb.atualizar());

/* =========================================================
   PERSEGUIÇÃO DE CARRO (turnos e cronômetro)
   estado/perseguicao = { ativa, a (perseguidor), b (fugitivo), dist 0..6,
   turno, max, seg (segundos por turno), fim (ts do fim do turno), log[], res }
   ========================================================= */
let persgVisto = 0;
function atualizarPersg() {
  const pe = S().perseguicao;
  if (pe && pe.ativa && pe.ts && pe.ts !== persgVisto && CRW.moduloAtual() !== 'mapa' && !CRW.TV) { persgVisto = pe.ts; aviso('Perseguição em andamento! Abra o Mapa.'); CRW.Som.sirene(); }
  if (pe && pe.ts) persgVisto = pe.ts;
  if (!raiz) return; const box = $('.mp-persg', raiz); if (!box) return;
  if (!pe || (!pe.ativa && !pe.res)) { box.hidden = true; return; }
  const G = CRW.P.mestre && !CRW.P.espiar, na = n => nomeDe({ id: n });
  const resta = Math.max(0, Math.ceil((num(pe.fim) - Date.now()) / 1000));
  const trilha = Array.from({ length: 7 }, (_, i) => `<i class="${i === 0 ? 'mp-pa' : ''}${i === num(pe.dist) ? ' mp-pb' : ''}"></i>`).join('');
  box.hidden = false;
  box.innerHTML = `<div class="mp-persg-h">🚨 PERSEGUIÇÃO · turno ${num(pe.turno)}/${num(pe.max, 6)} ${pe.ativa ? `<span class="mp-crono${resta <= 10 ? ' fim' : ''}">${pad2(Math.floor(resta / 60))}:${pad2(resta % 60)}</span>` : ''}</div>
    <div class="mp-persg-t"><span>${esc(na(pe.a))}</span><div class="mp-trilha">${trilha}</div><span>${esc(na(pe.b))}</span></div>
    <p class="mini">${pe.res ? `<b>${pe.res === 'capturado' ? 'CAPTURADO' : pe.res === 'escapou' ? 'ESCAPOU' : 'ENCERRADA'}</b> · ` : ''}distância ${num(pe.dist)} de 6 ${pe.log && pe.log.length ? '· ' + esc(pe.log[pe.log.length - 1]) : ''}</p>
    <div class="linha95">${!G && pe.ativa ? '<button class="w95-btn" data-pe="rolar">🎲 Rolar (Mover)</button>' : ''}
    ${G ? (pe.ativa ? `<button class="w95-btn" data-pe="perto">◄ Encostou</button><button class="w95-btn" data-pe="longe">Ganhou terreno ►</button><button class="w95-btn" data-pe="turno">Próximo turno</button><button class="w95-btn pri" data-pe="cap">Capturado</button><button class="w95-btn" data-pe="esc">Escapou</button>` : '<button class="w95-btn" data-pe="limpar">Tirar da tela</button>') : ''}</div>`;
  if (pe.ativa) animado = true;
}
function persg(op) {
  const pe = { ...(S().perseguicao || {}) }; const r = CRW.relogio(), h = `${pad2(r.h)}:${pad2(r.m)}`;
  pe.log = (pe.log || []).slice(-20);
  if (op === 'perto') { pe.dist = clamp(num(pe.dist) - 1, 0, 6); pe.log.push(`${h} o perseguidor encostou`); if (pe.dist === 0) { pe.ativa = false; pe.res = 'capturado'; } }
  if (op === 'longe') { pe.dist = clamp(num(pe.dist) + 1, 0, 6); pe.log.push(`${h} o fugitivo ganhou terreno`); if (pe.dist === 6) { pe.ativa = false; pe.res = 'escapou'; } }
  if (op === 'turno') { pe.turno = num(pe.turno) + 1; pe.fim = Date.now() + num(pe.seg, 60) * 1000; pe.log.push(`turno ${pe.turno}`); if (pe.turno > num(pe.max, 6)) { pe.ativa = false; pe.res = 'escapou'; } }
  if (op === 'cap') { pe.ativa = false; pe.res = 'capturado'; }
  if (op === 'esc') { pe.ativa = false; pe.res = 'escapou'; }
  if (op === 'limpar') { Estado.definir(['perseguicao'], null); return; }
  if (pe.res) CRW.diario('mesa', `Perseguição encerrada: ${pe.res}`);
  Estado.definir(['perseguicao'], pe);
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-pe]'); if (!b) return;
  if (b.dataset.pe === 'rolar') { if (CRW.rolar) CRW.rolar({ acao: 'Mover' }); else aviso('Rolador indisponível.'); return; }
  persg(b.dataset.pe);
});
let cronoAviso = 0;
setInterval(() => {
  const pe = S().perseguicao;
  if (pe && pe.ativa && raiz && CRW.moduloAtual() === 'mapa') atualizarPersg();
  if (pe && pe.ativa && CRW.P.mestre && num(pe.fim) && Date.now() > num(pe.fim) && cronoAviso !== pe.fim) { cronoAviso = pe.fim; CRW.alertaMestre('Perseguição: tempo do turno esgotado. Decida e passe ao próximo turno.', 'persg'); CRW.Som.erro(); }
}, 1000);

/* =========================================================
   REPLAY DA SESSÃO (só o Guardião)
   ========================================================= */
function abrirReplay() {
  const sid = CRW.sessaoId(); const movs = Object.values(Segredos.ler(['_mov', sid]) || {}).sort((a, b) => num(a.ts) - num(b.ts));
  if (!movs.length) return aviso('Ainda não há movimentos gravados nesta sessão.');
  const t0 = movs[0].ts, t1 = movs[movs.length - 1].ts;
  const base = {}; Object.values(S().tokens || {}).forEach(t => { if (t && t.id) base[t.id] = { ...t }; });
  const rp = { t: t0, t0, t1, tocando: false,
    tokens() { const est = {}; Object.values(base).forEach(t => { est[t.id] = { ...t, ronda: null, viagem: null, veic: null }; }); const ap = m => ({ x: m.x, y: m.y, loc: m.loc, reg: m.reg || REG0 }); const primeiro = {}; movs.forEach(m => { if (!primeiro[m.id]) primeiro[m.id] = m; }); Object.values(primeiro).forEach(m => { if (est[m.id]) Object.assign(est[m.id], ap(m)); }); movs.forEach(m => { if (m.ts <= this.t && est[m.id]) Object.assign(est[m.id], ap(m)); }); return Object.values(est).filter(t => !t.h || CRW.v().mestre); },
    passo() { this.t = Math.min(this.t1, this.t + (this.t1 - this.t0) / 60); if (this.t >= this.t1) this.tocando = false; desenharReplay(); sujo(); },
  };
  view.replay = rp; CRW.abrirModulo('mapa', true); if (view.modo !== 'cidade') sairInterior();
  rp.movs = movs; desenharReplay(); sujo();
}
function desenharReplay() {
  if (!raiz) return; const box = $('.mp-replay', raiz), rp = view.replay; if (!box) return;
  if (!rp) { box.hidden = true; return; }
  const atual = [...rp.movs].reverse().find(m => m.ts <= rp.t) || rp.movs[0];
  box.hidden = false;
  box.innerHTML = `<b>REPLAY</b> <span class="mini">${esc(atual.d || '')} ${esc(atual.h || '')} · ${rp.movs.length} movimentos</span>
    <input type="range" min="${rp.t0}" max="${rp.t1}" value="${rp.t}" class="mp-rp-r" aria-label="Linha do tempo">
    <span class="linha95"><button class="w95-btn" data-rp="play">${rp.tocando ? '❚❚ Pausar' : '▶ Tocar'}</button><button class="w95-btn" data-rp="ini">⏮</button><button class="w95-btn" data-rp="sair">■ Sair do replay</button></span>`;
  $('.mp-rp-r', box).oninput = e => { rp.t = +e.target.value; sujo(); const a2 = [...rp.movs].reverse().find(m => m.ts <= rp.t) || rp.movs[0]; $('.mini', box).textContent = `${a2.d || ''} ${a2.h || ''} · ${rp.movs.length} movimentos`; };
  box.onclick = e => { const b = e.target.closest('[data-rp]'); if (!b) return; if (b.dataset.rp === 'play') { if (rp.t >= rp.t1) rp.t = rp.t0; rp.tocando = !rp.tocando; } if (b.dataset.rp === 'ini') { rp.t = rp.t0; rp.tocando = false; } if (b.dataset.rp === 'sair') { view.replay = null; } desenharReplay(); sujo(); };
}

/* =========================================================
   PAINEL DO GUARDIÃO · aba Mapa (e Segredos)
   ========================================================= */
function vivo(c, ev, fn) { const off = CRW.on(ev, (x) => { if (!document.body.contains(c)) { off(); return; } if (c.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) return; fn(x); }); }
function blocoRelogio(c) {
  const desenhar = () => {
    const r = CRW.relogio(), rel = S().relogio || {};
    c.innerHTML = `<p class="mini">A hora do jogo muda a luz do mapa, o que está aberto ou fechado, as rotinas dos NPCs e os prazos do laboratório. Sem relógio definido, o site usa a hora do computador.</p>
      <div class="mp-rel-g"><b class="mp-rel-h">${esc(r.data)} · ${pad2(r.h)}:${pad2(r.m)}</b> <span class="mini">${esc(CRW.diaSemana(r.data))}${r.real ? ' · hora do computador' : rel.rodando ? ` · correndo ${num(rel.vel, 1)}x` : ' · parado'}</span></div>
      <div class="grade2"><label class="campo">Data<input class="w95-input" data-d value="${esc(r.data)}" placeholder="dd/mm/1997"></label><label class="campo">Hora<input class="w95-input" type="time" data-h value="${pad2(r.h)}:${pad2(r.m)}"></label></div>
      <div class="grade2"><label class="campo">Velocidade (minutos de jogo por minuto real)<select class="w95-input" data-v>${[1, 2, 5, 10, 15, 30, 60].map(x => `<option${num(rel.vel, 1) === x ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label class="chk95" style="align-self:end"><input type="checkbox" data-run ${rel.rodando ? 'checked' : ''}> Relógio correndo</label></div>
      <div class="linha95"><button class="w95-btn pri" data-r="def">Definir</button><button class="w95-btn" data-r="15">+15 min</button><button class="w95-btn" data-r="60">+1 h</button><button class="w95-btn" data-r="7">Amanhecer 07:00</button><button class="w95-btn" data-r="20">Anoitecer 20:00</button><button class="w95-btn" data-r="dia">Próximo dia 08:00</button><button class="w95-btn" data-r="pc">Usar hora do computador</button></div>`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  const t = setInterval(() => { if (!document.body.contains(c)) return clearInterval(t); const h = $('.mp-rel-h', c), r = CRW.relogio(); if (h) h.textContent = `${r.data} · ${pad2(r.h)}:${pad2(r.m)}`; }, 5000);
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-r]'); if (!b) return;
    const r = CRW.relogio(), rel = S().relogio || {}, run = $('[data-run]', c).checked, vel = num($('[data-v]', c).value, 1);
    let data = r.data, min = r.minDia;
    if (b.dataset.r === 'def') { const d = $('[data-d]', c).value.trim(); if (!/^\d{2}\/\d{2}\/\d{4}$/.test(d)) return aviso('Data no formato dd/mm/aaaa.', 'erro'); data = d; min = hm($('[data-h]', c).value); }
    if (b.dataset.r === '15') min += 15; if (b.dataset.r === '60') min += 60;
    if (b.dataset.r === '7') min = 420; if (b.dataset.r === '20') min = 1200;
    if (b.dataset.r === 'dia') { data = CRW.proximoDia(data); min = 480; }
    if (b.dataset.r === 'pc') { Estado.definir(['relogio'], null); return; }
    while (min >= 1440) { min -= 1440; data = CRW.proximoDia(data); }
    Estado.definir(['relogio'], { min, data, rodando: run, vel, ts: Date.now() });
    CRW.diario('relogio', `Relógio: ${data} ${pad2(Math.floor(min / 60))}:${pad2(min % 60)}`);
    void rel;
  });
  c.addEventListener('change', e => { if (e.target.matches('[data-run],[data-v]')) { const r = CRW.relogio(); if (r.real) return; Estado.definir(['relogio'], { min: r.minDia + (r.s / 60), data: r.data, rodando: $('[data-run]', c).checked, vel: num($('[data-v]', c).value, 1), ts: Date.now() }); } });
}
function blocoClima(c) {
  const desenhar = () => {
    const cl = clima();
    c.innerHTML = `<div class="grade2"><label class="campo">Neblina<select class="w95-input" data-cl="neblina">${['nenhuma', 'leve', 'média', 'fechada'].map((n, i) => `<option value="${i}"${num(cl.neblina) === i ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo">Chuva<select class="w95-input" data-cl="chuva">${['sem chuva', 'chuva', 'temporal (com relâmpagos)'].map((n, i) => `<option value="${i}"${num(cl.chuva) === i ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <label class="chk95"><input type="checkbox" data-luz ${cl.luz === false ? 'checked' : ''}> Corte de luz na cidade (postes e janelas apagam no mapa)</label>
      <div class="linha95"><button class="w95-btn" data-sirene>🚨 Tocar a sirene (todos ouvem)</button></div>
      <p class="mini">A neblina do mapa também engrossa sozinha com a Sangria da cidade (agora ${CRW.sangria()}). A "neblina total" e a queda de energia de tela cheia ficam na aba Sessão.</p>`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('change', e => {
    const s = e.target.closest('[data-cl]'); const cl = { ...clima() };
    if (s) cl[s.dataset.cl] = num(s.value);
    if (e.target.matches('[data-luz]')) cl.luz = e.target.checked ? false : true;
    Estado.definir(['clima'], cl); CRW.diario('clima', `Clima: neblina ${cl.neblina || 0}, chuva ${cl.chuva || 0}${cl.luz === false ? ', sem luz' : ''}`);
  });
  c.addEventListener('click', e => { if (e.target.closest('[data-sirene]')) { Estado.definir(['clima'], { ...clima(), sirene: Date.now() }); CRW.diario('clima', 'Sirene tocada'); } });
}
let sireneVista = 0;
CRW.on('estado', s => { const t = num((s.clima || {}).sirene); if (t && t !== sireneVista) { const novo = sireneVista !== 0 || Date.now() - t < 15000; sireneVista = t; if (novo && Date.now() - t < 15000) CRW.Som.sirene(); } });
function blocoPecas(c) {
  const desenhar = () => {
    const G = CRW.P.mestre, toks = S().tokens || {};
    const linhaN = n => { const tk = toks[n.id]; const o = tk && ondeEsta(n.id); return `<tr><td><span class="mp-cat" style="background:${esc(n.cor || '#666')}"></span> <b>${esc(n.nome)}</b>${n.oculto ? ' <span class="mini">(NPC oculto)</span>' : ''}</td><td class="mini">${tk ? (o ? esc(LOTE[o].nome) : 'na rua') + (tk.h ? ' · oculto' : '') + (tk.ronda && tk.ronda.ativo ? ' · ronda' : '') : 'fora do mapa'}</td>
      <td>${G ? (tk ? `<button class="w95-btn" data-pp-ir="${esc(n.id)}">Ver</button> <button class="w95-btn perigo" data-pp-tira="${esc(n.id)}">×</button>` : `<button class="w95-btn" data-pp-poe="${esc(n.id)}">Pôr…</button>`) : (tk ? `<button class="w95-btn" data-pp-ir="${esc(n.id)}">Ver</button>` : '')}</td></tr>`; };
    c.innerHTML = `<p class="mini">${G ? 'Ponha NPCs e viaturas no mapa, esconda ou mostre, faça rondas. No mapa, arraste qualquer peça. Toque numa peça para mais opções.' : 'Auxiliar: você move NPCs e viaturas que já estão no mapa (arrastando). Pôr e tirar peças é com o Guardião.'}</p>
      <table class="dtable"><thead><tr><th>Peça</th><th>Onde</th><th style="width:110px"></th></tr></thead><tbody>${CRW.npcs().map(linhaN).join('')}</tbody></table>
      ${G ? '<div class="linha95"><button class="w95-btn" data-pp-pcs>Investigadores de volta à delegacia</button></div>' : ''}`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('click', async e => {
    const ir = e.target.closest('[data-pp-ir]'), tira = e.target.closest('[data-pp-tira]'), poe = e.target.closest('[data-pp-poe]');
    if (ir) { CRW.abrirModulo('mapa'); const tk = (S().tokens || {})[ir.dataset.ppIr]; if (tk) setTimeout(() => { focarPeca(tk); view.selTk = tk.id; abrirPeca(tk); sujo(); }, 80); }
    if (tira && await confirmar('Tirar esta peça do mapa?')) Estado.definir(['tokens', tira.dataset.ppTira], null);
    if (poe) {
      const n = CRW.ser(poe.dataset.ppPoe) || { id: poe.dataset.ppPoe };
      const w = janela({ titulo: 'Pôr no mapa · ' + (n.nome || n.id), largura: '400px', html: `<label class="campo">Em frente a<select class="w95-input" data-l>${opcoesLotes()}</select></label>
        <label class="chk95"><input type="checkbox" data-h ${n.oculto ? 'checked' : ''}> Oculto (só você e os auxiliares veem)</label>
        <div class="msg-bts"><button class="w95-btn pri" data-ok>Pôr</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
      $('[data-ok]', w).onclick = () => { const l = LOTE[$('[data-l]', w).value], p = frente(l, 3); const tk = { id: n.id, tipo: n.tipo === 'viatura' ? 'viatura' : 'npc', loc: 'c', reg: p.reg, x: p.x, y: p.y }; if ($('[data-h]', w).checked) tk.h = true; Estado.definir(['tokens', n.id], tk); CRW.diario('mapa', `${n.nome || n.id} posto no mapa (${l.nome})${tk.h ? ', oculto' : ''}`); fecharJanela(w.parentElement.dataset.jan); };
    }
    if (e.target.closest('[data-pp-pcs]') && await confirmar('Levar todos os investigadores para a frente da delegacia?')) CRW.pcs().forEach((p, i) => { const f = frente(LOTE.delegacia, i); Estado.definir(['tokens', p.id], { id: p.id, tipo: 'pc', loc: 'c', reg: f.reg, x: f.x, y: f.y }); });
  });
}
function blocoNevoa(c) {
  const desenhar = () => {
    const l = LOTES.filter(x => x.conhecido === false);
    c.innerHTML = `<p class="mini">Locais que começam encobertos pela névoa. Os jogadores veem só uma nuvem até você revelar. Você também pode revelar pelo cartão do local.</p>
      <ul class="mp-lista">${l.map(x => `<li class="linha95"><label class="chk95"><input type="checkbox" data-nv="${esc(x.id)}" ${conhecido(x) ? 'checked' : ''}> ${esc(x.nome)}</label></li>`).join('')}</ul>
      <div class="linha95"><button class="w95-btn" data-nv-todos="1">Revelar todos</button><button class="w95-btn" data-nv-todos="0">Cobrir todos</button></div>`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('change', e => { const x = e.target.closest('[data-nv]'); if (x) { Estado.definir(['lotesRev', x.dataset.nv], x.checked ? true : null); CRW.diario('revelacao', (x.checked ? 'Local revelado: ' : 'Névoa de volta: ') + LOTE[x.dataset.nv].nome); } });
  c.addEventListener('click', e => { const b = e.target.closest('[data-nv-todos]'); if (b) LOTES.filter(x => x.conhecido === false).forEach(x => Estado.definir(['lotesRev', x.id], b.dataset.nvTodos === '1' ? true : null)); });
}
function blocoBloqueios(c) {
  const desenhar = () => {
    const bl = S().bloqueios || {};
    c.innerHTML = `<p class="mini">As quatro saídas da cidade. Bloqueada, aparece a barreira com viaturas; o jogador que levar a peça até lá recebe o aviso e você é alertado.</p>
      ${SAIDAS().map(s => `<label class="chk95"><input type="checkbox" data-bl="${esc(s.id)}" ${bl[s.id] ? 'checked' : ''}> ${esc(s.nome)} <span class="mini">(região ${REG[s.reg].num} · ${esc(REG[s.reg].nome)})</span></label>`).join('')}`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('change', e => { const x = e.target.closest('[data-bl]'); if (!x) return; Estado.definir(['bloqueios', x.dataset.bl], x.checked ? { ts: Date.now() } : null); CRW.diario('mapa', `${x.checked ? 'Bloqueio montado' : 'Bloqueio retirado'}: ${SAIDAS().find(s => s.id === x.dataset.bl).nome}`); });
}
function blocoRotinas(c) {
  const desenhar = () => {
    const cfg = Segredos.ler(['rotinas']) || {};
    c.innerHTML = `<p class="mini">Onde cada NPC fica em cada horário. Uma linha por período: <code>08:00-17:00 delegacia</code>. Com "seguir rotinas" ligado, seu aparelho leva as peças sozinho quando o relógio do jogo muda (precisa estar com o site aberto). NPC em ronda ou fora do mapa não é mexido, a não ser que "pôr no mapa" esteja marcado.</p>
      <label class="chk95"><input type="checkbox" data-auto ${cfg._auto ? 'checked' : ''}> Seguir rotinas automaticamente</label>
      <label class="chk95"><input type="checkbox" data-criar ${cfg._criar ? 'checked' : ''}> Pôr no mapa os NPCs que estiverem fora</label>
      ${CRW.npcs().map(n => `<label class="campo"><b>${esc(n.nome)}</b><textarea class="w95-input" rows="2" data-rt="${esc(n.id)}" placeholder="08:00-17:00 delegacia">${esc((Array.isArray(cfg[n.id]) ? cfg[n.id] : []).map(e => `${e.de}-${e.ate} ${e.lote}`).join('\n'))}</textarea></label>`).join('')}
      <div class="linha95"><button class="w95-btn pri" data-rt-salvar>Salvar rotinas</button><button class="w95-btn" data-rt-ja>Aplicar agora</button></div><p class="mini">Ids dos locais: ${LOTES.map(l => l.id).join(', ')}</p>`;
  };
  desenhar(); vivo(c, 'segredos', desenhar);
  c.addEventListener('click', e => {
    if (e.target.closest('[data-rt-salvar]')) {
      const cfg = { _auto: $('[data-auto]', c).checked, _criar: $('[data-criar]', c).checked }; const erros = [];
      $$('[data-rt]', c).forEach(t => { const l = t.value.split('\n').map(x => x.trim()).filter(Boolean).map(x => { const m = x.match(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})\s+([a-z0-9_-]+)/i); if (!m || !LOTE[m[3]]) { erros.push(x); return null; } return { de: m[1], ate: m[2], lote: m[3] }; }).filter(Boolean); if (l.length) cfg[t.dataset.rt] = l; });
      Segredos.gravar(['rotinas'], cfg); aviso(erros.length ? `Salvo. Linhas ignoradas: ${erros.join(' | ')}` : 'Rotinas salvas.', erros.length ? 'erro' : '');
    }
    if (e.target.closest('[data-rt-ja]')) { aplicarRotinas(true); aviso('Rotinas aplicadas para a hora atual.'); }
  });
}
function blocoPersg(c) {
  const toks = () => Object.values(S().tokens || {}).filter(t => t && t.id && (!t.loc || t.loc === 'c'));
  const desenhar = () => {
    const pe = S().perseguicao;
    c.innerHTML = `<p class="mini">Uma perseguição de carro no mapa, em turnos com cronômetro. A trilha de 0 a 6 mostra a distância: 0 = capturado, 6 = escapou. A cada turno, peça as rolagens (o jogador tem o botão de rolar na tela), decida quem ganhou terreno e passe o turno.</p>
      ${pe && pe.ativa ? `<p><span class="etq verm">em andamento</span> turno ${num(pe.turno)} · distância ${num(pe.dist)}</p><div class="linha95"><button class="w95-btn" data-pe="perto">Encostou</button><button class="w95-btn" data-pe="longe">Ganhou terreno</button><button class="w95-btn" data-pe="turno">Próximo turno</button><button class="w95-btn" data-pe="cap">Capturado</button><button class="w95-btn" data-pe="esc">Escapou</button></div>` : `
      <div class="grade2"><label class="campo">Perseguidor<select class="w95-input" data-a>${toks().map(t => `<option value="${esc(t.id)}">${esc(nomeDe(t))}</option>`).join('')}</select></label>
      <label class="campo">Fugitivo<select class="w95-input" data-b>${toks().map((t, i) => `<option value="${esc(t.id)}"${i === 1 ? ' selected' : ''}>${esc(nomeDe(t))}</option>`).join('')}</select></label>
      <label class="campo">Distância inicial (1 a 5)<input class="w95-input" type="number" min="1" max="5" value="3" data-d></label>
      <label class="campo">Turnos<input class="w95-input" type="number" min="1" max="20" value="6" data-t></label>
      <label class="campo">Segundos por turno<input class="w95-input" type="number" min="10" max="600" value="60" data-s></label></div>
      <div class="linha95"><button class="w95-btn pri" data-pe-ini>Começar a perseguição</button>${pe ? '<button class="w95-btn" data-pe="limpar">Tirar a última da tela</button>' : ''}</div>`}`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('click', e => {
    if (!e.target.closest('[data-pe-ini]')) return;
    const a = $('[data-a]', c).value, b = $('[data-b]', c).value; if (!a || !b || a === b) return aviso('Escolha duas peças diferentes que estejam na rua.', 'erro');
    const seg = clamp(num($('[data-s]', c).value, 60), 10, 600);
    Estado.definir(['perseguicao'], { ativa: true, a, b, dist: clamp(num($('[data-d]', c).value, 3), 1, 5), turno: 1, max: clamp(num($('[data-t]', c).value, 6), 1, 20), seg, fim: Date.now() + seg * 1000, ts: Date.now(), log: ['início'] });
    CRW.diario('mesa', `Perseguição: ${nomeDe({ id: a })} atrás de ${nomeDe({ id: b })}`); CRW.Som.sirene(); CRW.abrirModulo('mapa');
  });
}
function blocoVeiculos(c) {
  const desenhar = () => {
    const vs = Object.entries(veicDefs()).filter(([, d]) => d), pcs = CRW.pcs();
    c.innerHTML = `<p class="mini">Os carros dos investigadores. Quem tem a chave entra, assume o volante e dirige: a viagem anda com o relógio do jogo. Sem carro, entre regiões só a pé com a sua autorização (bloco Viagens). As viaturas do Departamento continuam no bloco Peças (NPCs).</p>
      <table class="dtable"><thead><tr><th>Veículo</th><th>Onde</th><th></th></tr></thead><tbody>${vs.map(([id, d]) => { const p = posVeiculo(id), oc = ocupantes(id); const l = p && p.reg && !p.andando ? lotePerto(p.x, p.y, p.reg) : null; return `<tr><td><span class="mp-cat" style="background:${esc(d.cor || '#7a8a99')}"></span> <b>${esc(d.nome || 'Carro')}</b><br><span class="mini">${int(d.lugares) || 4} lugares · chave: ${d.todos ? 'todos' : Object.keys(d.chaves || {}).map(k => esc(nomeDe({ id: k }))).join(', ') || 'ninguém'}</span></td><td class="mini">${p && p.reg ? esc(REG[p.reg].nome) + (l ? ' · ' + esc(l.nome) : '') : 'na estrada'}${oc.length ? '<br>' + esc(oc.map(t => nomeDe(t)).join(', ')) : ''}</td><td><button class="w95-btn" data-vv-ver="${esc(id)}">Ver</button> <button class="w95-btn" data-vv-ed="${esc(id)}">✎</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="mini">Nenhum veículo ainda.</td></tr>'}</tbody></table>
      <div class="linha95"><button class="w95-btn pri" data-vv-novo>+ Novo veículo</button></div>`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  const editar = id => {
    const d = (id && veicDefs()[id]) || { nome: '', cor: '#7a8a99', lugares: 4, chaves: {}, todos: false }, pcs = CRW.pcs();
    const st = id ? posVeiculo(id) : null, lAtual = st && st.reg ? (lotePerto(st.x, st.y, st.reg) || {}).id : 'delegacia';
    const w = janela({ titulo: id ? 'Veículo · ' + (d.nome || '') : 'Novo veículo', largura: '440px', icone: '🚗', html: `
      <label class="campo">Nome (aparece no mapa)<input class="w95-input" data-n value="${esc(d.nome || '')}" placeholder="ex.: Picape azul da Ada"></label>
      <div class="grade2"><label class="campo">Cor<input class="w95-input" type="color" data-c value="${esc(d.cor || '#7a8a99')}"></label><label class="campo">Lugares<input class="w95-input" type="number" min="1" max="12" data-l value="${esc(int(d.lugares) || 4)}"></label></div>
      <label class="campo">Descrição (opcional, todos leem)<input class="w95-input" data-d value="${esc(d.desc || '')}"></label>
      <b class="mp-sub">Quem tem a chave</b>
      <label class="chk95"><input type="checkbox" data-todos ${d.todos ? 'checked' : ''}> Qualquer investigador</label>
      ${pcs.map(p => `<label class="chk95"><input type="checkbox" data-ch="${esc(p.id)}" ${(d.chaves || {})[p.id] ? 'checked' : ''}> ${esc(p.nome)}</label>`).join('')}
      ${id ? '' : `<label class="campo">Estacionado em<select class="w95-input" data-onde>${opcoesLotes(lAtual)}</select></label>`}
      <label class="chk95"><input type="checkbox" data-h ${d.h ? 'checked' : ''}> Escondido dos jogadores (só você vê)</label>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button>${id ? '<button class="w95-btn perigo" data-apagar>Apagar</button>' : ''}<button class="w95-btn" data-fechar>Cancelar</button></div>` });
    w.addEventListener('click', async e => {
      if (e.target.closest('[data-apagar]')) { if (!(await confirmar('Apagar este veículo? Quem estiver dentro desce no lugar.'))) return; ocupantes(id).forEach(t => { const pp = posDe(t); const n = { ...t, reg: pp.reg || REG0, x: pp.x, y: pp.y }; delete n.veic; delete n.viagem; Estado.definir(['tokens', t.id], n); }); Estado.definir(['veiculos', id], null); Rede.set('caso/veiculos/' + id, null).catch(() => {}); fecharJanela(w.parentElement.dataset.jan); return; }
      if (!e.target.closest('[data-ok]')) return;
      const nome = $('[data-n]', w).value.trim(); if (!nome) return aviso('Dê um nome ao veículo.', 'erro');
      const chaves = {}; $$('[data-ch]', w).forEach(x => { if (x.checked) chaves[x.dataset.ch] = true; });
      const nid = id || 'v' + Rede.chave().slice(-8);
      const def = { nome, cor: $('[data-c]', w).value, lugares: clamp(int($('[data-l]', w).value) || 4, 1, 12), desc: $('[data-d]', w).value.trim(), todos: $('[data-todos]', w).checked, chaves, h: $('[data-h]', w).checked || null };
      if (!id) { const lt = LOTE[$('[data-onde]', w).value]; const f = frente(lt, 6); Object.assign(def, { reg: f.reg, x: f.x, y: f.y }); Rede.set('caso/veiculos/' + nid, { reg: f.reg, x: f.x, y: f.y, ts: Date.now() }).catch(() => {}); }
      else Object.assign(def, { reg: d.reg, x: d.x, y: d.y });
      Estado.definir(['veiculos', nid], def); CRW.diario('mapa', `Veículo ${id ? 'editado' : 'criado'}: ${nome}`);
      fecharJanela(w.parentElement.dataset.jan);
    });
  };
  c.addEventListener('click', e => {
    if (e.target.closest('[data-vv-novo]')) editar(null);
    const ed = e.target.closest('[data-vv-ed]'); if (ed) editar(ed.dataset.vvEd);
    const ver = e.target.closest('[data-vv-ver]'); if (ver) { CRW.abrirModulo('mapa'); setTimeout(() => { const p = posVeiculo(ver.dataset.vvVer); if (p && p.reg) { trocarRegiao(p.reg, true); focar(p.x, p.y, Math.max(cam.s, 1.3)); } abrirVeiculo(ver.dataset.vvVer); }, 80); }
  });
}
function blocoViagens(c) {
  const desenhar = () => {
    const cfg = cfgViagem(), vs = viagensAtivas(), rel = S().relogio || {}, parado = !CRW.relogio().real && !rel.rodando;
    const ultima = vs.reduce((m, x) => Math.max(m, num(x.vg.ini) + num(x.vg.dur)), 0);
    c.innerHTML = `<p class="mini">As distâncias de Crowsrest são de verdade: o Centro tem 1,6 km de lado e as outras regiões ficam de 2 a 20 km de distância. A pé faz ${String(VEL.pe).replace('.', ',')} km/h; de carro, ${VEL.carro} km/h. As viagens andam com o <b>relógio do jogo</b>${parado ? ' (que está <b>parado</b>: ninguém chega até você avançar o tempo)' : ''}.</p>
      <label class="chk95"><input type="checkbox" data-cf="instantaneo" ${cfg.instantaneo ? 'checked' : ''}> Viagens instantâneas (a peça chega na hora, sem tempo de viagem)</label>
      <label class="chk95"><input type="checkbox" data-cf="peLivre" ${cfg.peLivre ? 'checked' : ''}> Deixar ir a pé de uma região para outra (horas de caminhada)</label>
      <h4 class="mp-h4">Em andamento</h4>
      <table class="dtable"><tbody>${vs.map(x => `<tr><td>${x.vg.modo === 'carro' ? '🚗' : '🚶'} <b>${esc(x.nome)}</b><br><span class="mini">para ${esc(nomeLugar(x.vg.para))} · ${esc(fmtM(num(x.vg.km) * 1000))} · ${Math.round(progressoViagem(x.vg) * 100)}%</span></td><td class="mini">chega ${esc(horaDe(num(x.vg.ini) + num(x.vg.dur)))}</td><td><button class="w95-btn" data-vj-ch="${esc(x.tipo + ':' + x.id)}">Chegar agora</button></td></tr>`).join('') || '<tr><td class="mini">Ninguém viajando.</td></tr>'}</tbody></table>
      ${vs.length && !CRW.relogio().real ? `<div class="linha95"><button class="w95-btn" data-vj-rel>⏩ Avançar o relógio até a última chegada (${esc(horaDe(ultima))})</button></div>` : ''}`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  const t = setInterval(() => { if (!document.body.contains(c)) return clearInterval(t); if (!c.contains(document.activeElement)) desenhar(); }, 15000);
  c.addEventListener('change', e => { const x = e.target.closest('[data-cf]'); if (!x) return; Estado.definir(['viagemCfg', x.dataset.cf], x.checked || null); });
  c.addEventListener('click', e => {
    const ch = e.target.closest('[data-vj-ch]'); if (ch) { const [tp, id] = ch.dataset.vjCh.split(':'); chegarAgora(tp === 'veic' ? { veic: id } : { tk: id }); setTimeout(desenhar, 300); }
    if (e.target.closest('[data-vj-rel]')) {
      const vs = viagensAtivas(), fim = vs.reduce((m, x) => Math.max(m, num(x.vg.ini) + num(x.vg.dur)), 0); if (!fim) return;
      const r = CRW.relogio(), rel = S().relogio || {}, dia = Math.floor(fim / 1440), d = new Date(dia * 86400000);
      Estado.definir(['relogio'], { min: Math.ceil(fim - dia * 1440) + 0.01, data: `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`, rodando: !!rel.rodando, vel: num(rel.vel, 1), ts: Date.now() });
      CRW.diario('relogio', 'Relógio avançado até a chegada das viagens'); void r;
    }
  });
}
function blocoReplay(c) {
  const desenhar = () => { const n = Object.keys(Segredos.ler(['_mov', CRW.sessaoId()]) || {}).length; c.innerHTML = `<p class="mini">Seu aparelho grava cada movimento de peça desta sessão (só você lê). O replay mostra no mapa quem foi para onde, em ordem, com a hora do jogo. Use "Marcar nova sessão" (aba Sessão) para começar uma gravação nova.</p><p>${n} movimentos gravados nesta sessão.</p><div class="linha95"><button class="w95-btn pri" data-rp-ab ${n ? '' : 'disabled'}>▶ Abrir o replay no mapa</button><button class="w95-btn perigo" data-rp-ap ${n ? '' : 'disabled'}>Apagar os movimentos</button></div>`; };
  desenhar(); vivo(c, 'segredos', desenhar);
  c.addEventListener('click', async e => { if (e.target.closest('[data-rp-ab]')) abrirReplay(); if (e.target.closest('[data-rp-ap]') && await confirmar('Apagar os movimentos gravados desta sessão?')) Segredos.gravar(['_mov', CRW.sessaoId()], null); });
}
function blocoSenhas(c) {
  const andares = []; Object.entries(INTERIORES).forEach(([id, I]) => I.andares.forEach(a => { if (a.trancado) andares.push({ k: id + '_' + a.id, nome: I.nome + ' · ' + a.nome }); }));
  const desenhar = () => {
    const sen = Segredos.ler(['senhas']) || {}, tr = S().trancas || {}, ab = S().destrancado || {};
    c.innerHTML = `<p class="mini">Andares trancados das plantas internas. A senha fica com você; o site publica só a "impressão digital" dela, e o jogador que digitar certo destranca no aparelho dele (você é avisado). "Aberto para todos" destranca para o grupo inteiro. Maiúsculas e minúsculas não importam.</p>
      ${andares.map(a => `<div class="mp-senha"><b>${esc(a.nome)}</b> ${tr[a.k] ? '<span class="etq verde">senha ativa</span>' : '<span class="etq">sem senha</span>'}
        <div class="linha95"><input class="w95-input" data-sn="${esc(a.k)}" value="${esc(sen[a.k] || '')}" placeholder="senha"><button class="w95-btn" data-sn-ok="${esc(a.k)}">Salvar senha</button><label class="chk95"><input type="checkbox" data-ab="${esc(a.k)}" ${ab[a.k] ? 'checked' : ''}> Aberto para todos</label></div></div>`).join('')}`;
  };
  desenhar(); vivo(c, 'estado', desenhar);
  c.addEventListener('click', async e => { const b = e.target.closest('[data-sn-ok]'); if (!b) return; const k = b.dataset.snOk, v = $(`[data-sn="${k}"]`, c).value.trim(); Segredos.gravar(['senhas', k], v || null); Estado.definir(['trancas', k], v ? await CRW.hash(v.toLowerCase()) : null); aviso(v ? 'Senha salva.' : 'Senha removida: o andar só abre por você.'); });
  c.addEventListener('change', e => { const x = e.target.closest('[data-ab]'); if (x) { Estado.definir(['destrancado', x.dataset.ab], x.checked ? true : null); CRW.diario('mapa', (x.checked ? 'Andar aberto a todos: ' : 'Andar trancado de novo: ') + x.dataset.ab); } });
}
function blocoSegLotes(c) {
  const desenhar = () => {
    const sg = Segredos.ler(['lotes']) || {}, rv = S().lotesSeg || {}, gt = Segredos.ler(['gatilhos']) || {};
    c.innerHTML = `<p class="mini">O segredo de cada local fica no servidor, só para você. Toque em um local para abrir o cartão no mapa, editar, revelar e ligar o gatilho.</p>
      <table class="dtable"><thead><tr><th>Local</th><th>Situação</th></tr></thead><tbody>${LOTES.map(l => `<tr><td><button class="mp-link" data-sg="${esc(l.id)}">${esc(l.nome)}</button></td><td class="mini">${(sg[l.id] || {}).segredo ? 'tem segredo' : '·'}${rv[l.id] ? ' · revelado' : ''}${(gt[l.id] || {}).ativo ? ' · gatilho' : ''}</td></tr>`).join('')}</tbody></table>`;
  };
  desenhar(); vivo(c, 'segredos', desenhar); vivo(c, 'estado', desenhar);
  c.addEventListener('click', e => { const b = e.target.closest('[data-sg]'); if (b) irLote(b.dataset.sg); });
}
CRW.registrarMestre({ id: 'mp-relogio', aba: 'mapa', titulo: 'Relógio do jogo (dia e noite)', ordem: 10, render: blocoRelogio });
CRW.registrarMestre({ id: 'mp-clima', aba: 'mapa', titulo: 'Clima, energia e sirene', ordem: 11, render: blocoClima });
CRW.registrarMestre({ id: 'mp-pecas', aba: 'mapa', titulo: 'Peças no mapa (NPCs e viaturas)', ordem: 12, aux: true, render: blocoPecas });
CRW.registrarMestre({ id: 'mp-nevoa', aba: 'mapa', titulo: 'Névoa de guerra (locais desconhecidos)', ordem: 13, render: blocoNevoa });
CRW.registrarMestre({ id: 'mp-bloqueios', aba: 'mapa', titulo: 'Saídas da cidade e bloqueios', ordem: 14, render: blocoBloqueios });
CRW.registrarMestre({ id: 'mp-rotinas', aba: 'mapa', titulo: 'Rotinas dos NPCs por horário', ordem: 15, render: blocoRotinas });
CRW.registrarMestre({ id: 'mp-persg', aba: 'mapa', titulo: 'Perseguição de carro', ordem: 16, render: blocoPersg });
CRW.registrarMestre({ id: 'mp-replay', aba: 'mapa', titulo: 'Replay da sessão no mapa', ordem: 17, render: blocoReplay });
CRW.registrarMestre({ id: 'mp-veiculos', aba: 'mapa', titulo: 'Veículos dos investigadores', ordem: 12.5, render: blocoVeiculos });
CRW.registrarMestre({ id: 'mp-viagens', aba: 'mapa', titulo: 'Viagens e distâncias', ordem: 12.6, render: blocoViagens });
CRW.registrarMestre({ id: 'mp-segredos', aba: 'segredos', titulo: 'Segredos e gatilhos dos locais', ordem: 10, render: blocoSegLotes });
CRW.registrarMestre({ id: 'mp-senhas', aba: 'segredos', titulo: 'Senhas dos andares trancados', ordem: 11, render: blocoSenhas });

/* =========================================================
   LIGAÇÕES GERAIS
   ========================================================= */
let assinCartao = '';
function assinaturaCartao() {
  if (!cartaoAtual || cartaoAtual.tipo !== 'lote') return '';
  const id = cartaoAtual.id, l = LOTE[id] || CASAS.find(c => c.id === id); if (!l) return '';
  const s = S();
  return JSON.stringify([quemNoLote(l).map(t => t.id + (t.h ? 'h' : '')), (s.lotesSeg || {})[id], Object.keys((s.fotosLote || {})[id] || {}), Object.keys((s.testemunhas || {})[id] || {}), (s.lotesRev || {})[id]]);
}
CRW.on('estado', s => {
  vigiar(s); vigiarViagens(); sujo(); atualizarPersg();
  const a = assinaturaCartao();
  if (a && a !== assinCartao && raiz && !$('.mp-cartao', raiz).contains(document.activeElement)) { assinCartao = a; abrirLote(cartaoAtual.id); }
  else assinCartao = a;
});
CRW.on('segredos', () => sujo());
let minVisto = -1;
CRW.on('tick', r => {
  if (r.minDia !== minVisto) { minVisto = r.minDia; sujo(); }
  // viagens andando: redesenha, confere chegadas e gatilhos
  if (Object.keys(viagemVista).length > 1 || viagensAtivas().length) {
    vigiar(S()); vigiarViagens(); sujo(true);
    // cartão aberto de veículo ou peça que está andando: atualiza onde está
    if (raiz && cartaoAtual && !$('.mp-cartao', raiz).contains(document.activeElement)) {
      const sig = cartaoAtual.tipo === 'veic' ? (() => { const p = posVeiculo(cartaoAtual.id) || {}; return [p.reg, p.estrada, ocupantes(cartaoAtual.id).length, ((veicPos[cartaoAtual.id] || {}).viagem || {}).ini, emViagem({ veic: cartaoAtual.id })].join('|'); })() : '';
      if (sig && sig !== cartaoAtual.sig) { const id = cartaoAtual.id; abrirVeiculo(id); cartaoAtual.sig = sig; }
    }
  }
});
CRW.on('perfil', () => { view.modo = 'cidade'; view.replay = null; view.sel = null; view.selTk = null; view.selVc = null; view.ferr = null; regua = null; ondeAntes = {}; posAntes = {}; viagemVista = {}; minhaRegAntes = null; redimensionar.feito = false; if (CRW.v().pc || CRW.v().mestre || CRW.v().aux || CRW.TV) assinarGrupo(); });
CRW.on('restaurado', () => { Object.keys(localStorage).filter(k => k.startsWith('crw-abriu:')).forEach(k => localStorage.removeItem(k)); });
document.addEventListener('keydown', e => {
  if (CRW.moduloAtual() !== 'mapa' || e.target.matches('input,textarea,select')) return;
  const c = mundo().c;
  if (e.key === 'q' || e.key === 'Q') { c.rot -= 15; sujo(); } if (e.key === 'e' || e.key === 'E') { c.rot += 15; sujo(); }
  if (e.key === '+' || e.key === '=') zoomEm(W / 2, H / 2, 1.2); if (e.key === '-') zoomEm(W / 2, H / 2, 0.83);
  if (e.key === 'Escape') { fecharCartao(); view.ferr = null; regua = null; sujo(); }
});

CRW.registrarModulo({ id: 'mapa', titulo: 'Mapa de Crowsrest', grupo: 'caso', icone: '⌖', ordem: 0, cheio: true, render,
  aoAbrir: () => { setTimeout(() => { redimensionar(); sujo(); Amb.atualizar(); atualizarBarra(); atualizarPersg(); desenharReplay(); }, 30); } });

CRW.Mapa = {
  focar: irLote, lote: id => LOTE[id] || CASAS.find(c => c.id === id) || null, lotes: () => LOTES.slice(), casas: () => CASAS.slice(),
  ondeEsta, loteEm, bairroEm, abrirLote: id => irLote(id), sujo: () => sujo(), frente,
  regioes: () => REGIOES.slice(), regiao: id => REG[id] || null, regiaoDe: id => { const tk = (S().tokens || {})[id]; return tk ? regiaoDe(tk) : null; }, rota: rotaEntre, minutos: minutosDe, irRegiao: id => trocarRegiao(id),
};

CRW.registrarRestauracao({ id: 'mp-persg', nome: 'Mapa: perseguição em andamento', padrao: true, estado: ['perseguicao'] });
CRW.registrarRestauracao({ id: 'mp-revel', nome: 'Mapa: segredos revelados dos locais e salas, fotos, testemunhas e andares abertos', padrao: false, estado: ['lotesSeg', 'salasRev', 'fotosLote', 'testemunhas', 'destrancado'] });

/* =========================================================
   COMO USAR
   ========================================================= */
CRW.registrarAjuda({ id: 'mapa', titulo: 'Mapa de Crowsrest', ordem: 10, para: ['todos'], html: `
  <p>Crowsrest tem o tamanho de uma cidade de verdade e está dividida em <b>4 regiões</b>, cada uma com o seu mapa em 2.5D (como os andares da Planta): ${REGIOES.map(r => `<b>${r.num} · ${r.nome}</b> (${(r.lado * r.metros / 1000).toFixed(1).replace('.', ',')} km de lado)`).join(', ')}. São ${LOTES.length} locais com nome e ${CASAS.length} casas de moradores. Do Centro até as outras regiões são de 2 a 20 km: para ir longe, é preciso carro. Tudo é sincronizado: quando alguém se move, todos veem.</p>
  <ul>
    <li><b>Regiões:</b> os botões <b>1 a 4</b> no alto trocam de mapa. O número vermelho mostra quantos investigadores estão em cada região; a sua tem o contorno tracejado. Na borda de cada mapa, as placas <b>➜</b> mostram para onde cada estrada leva. <b>🗺 Condado</b> mostra as 4 regiões, as estradas e uma tabela de distâncias e tempos (a pé e de carro) a partir de onde você está.</li>
    <li><b>Mexer no mapa:</b> arraste com um dedo (ou o mouse) para andar; dois dedos afastam, aproximam e giram; no computador, a rodinha dá zoom e o botão direito (ou Shift) gira e inclina. Botões: <b>− +</b> zoom, <b>⟲ ⟳</b> girar, <b>ISO</b> perspectiva, <b>Topo</b> vista de cima, teclas Q e E giram.</li>
    <li><b>◎ Eu</b> leva até o seu personagem (troca de região se precisar). <b>⌕ Achar</b> procura um local pelo nome ou endereço, em qualquer região.</li>
    <li><b>Andar e viajar:</b> <b>🚗 Ir…</b> (ou "🚗 Ir até aqui" no cartão de um local) mostra a distância pela estrada e quanto tempo leva a pé e de carro. Arrastar a sua peça até um ponto também abre essa escolha (passos de até 40 m vão na hora). A viagem anda com o <b>relógio do jogo</b>: a peça vai se movendo, a barra de baixo mostra "a caminho de… · chega 21:40" e, ao chegar, aparece o aviso. Com o relógio parado, a peça espera o Guardião avançar o tempo. A pé você anda dentro da região; para outra região, só de carro (a não ser que o Guardião libere).</li>
    <li><b>Carros:</b> toque num carro para ver quem está dentro e quem tem a chave. Perto dele (até 150 m), <b>Entrar no carro</b>; quem tem a chave pode <b>Assumir o volante</b> e <b>Dirigir até…</b> (ou arrastar o carro no mapa). Os passageiros vão junto. Ao chegar, <b>Sair do carro</b>. Longe do carro, o cartão oferece ir a pé até ele.</li>
    <li><b>Cartão do local:</b> toque num prédio. Aparece endereço, região, a distância e o tempo até lá, horário (aberto ou fechado agora, pelo relógio do jogo), descrição, quem está ali, fotos, testemunhas que o Guardião liberou, o que o grupo descobriu, as coletas, pistas do mural, anexos e edições do jornal ligados ao lugar.</li>
    <li><b>Ver por dentro:</b> prédios importantes (delegacia, necrotério, hospital, funerária, fundição, clube, biblioteca, depósitos, igreja, redação do jornal) têm planta interna com andares. "Entrar com o personagem" aparece quando você está na porta do prédio; "Ir para esta sala" leva a peça até a sala. Andares com 🔒 pedem senha: quem acerta destranca no próprio aparelho (o Guardião fica sabendo).</li>
    <li><b>📏 Régua:</b> ligue e arraste para medir a distância em linha reta, com o tempo aproximado pela estrada a pé e de carro (cada região tem a sua escala; a barra de baixo mostra quanto vale 1 quadradinho).</li>
    <li><b>✱ Sinal:</b> toque no mapa (ou segure o dedo em qualquer lugar) para mandar um sinal piscante que todos veem por alguns segundos.</li>
    <li><b>⚑ Marcador:</b> marca um ponto para o grupo, com nome, nota e "já visitado". Todos editam; quem criou (e o Guardião) apaga.</li>
    <li><b>☰ Legenda:</b> cores das categorias, a escala da região, onde está cada um, os carros e a lista de marcadores.</li>
    <li><b>♪ Som ambiente:</b> cada bairro tem o seu som (rio, fábrica morta, sino da igreja, vento da colina, cachorros de Pulptown, mata com pássaros de dia e grilos à noite), mais chuva. Depende do som geral 🔊 estar ligado.</li>
  </ul>
  <p><b>Névoa:</b> locais ainda desconhecidos aparecem como nuvens até o Guardião revelar. A neblina do clima e a Sangria da cidade fecham a visão ao redor do seu personagem: quanto mais alta, menos se vê. <b>Dia e noite:</b> o relógio do jogo escurece o mapa, acende postes e janelas e fecha as lojas fora do horário (o rótulo fica cinza). <b>Clima:</b> neblina, chuva, temporal com relâmpagos, sirene e corte de luz. <b>Saídas do condado:</b> Oeste (no Centro), Leste e Norte (no Distrito da Fundição) e Sul (no Vale Sul) podem virar bloqueio policial (barreira com viaturas piscando); levar a peça até lá dá o aviso. <b>Perseguição:</b> quando o Guardião começa uma, aparece o painel com a distância, o turno e o cronômetro, e o botão para rolar.</p>
  <p class="mini">Fora do Centro, os prédios aparecem maiores que o real para dar para tocar neles; as distâncias e os tempos usam a escala certa.</p>` });
CRW.registrarAjuda({ id: 'mapa-mestre', titulo: 'Mapa: ferramentas do Guardião', ordem: 11, para: ['mestre'], html: `
  <p>No mapa você arrasta qualquer peça e ela vai <b>na hora</b>, para a região que estiver aberta (sem viagem). Toque numa peça para ocultar ou mostrar, <b>Levar para…</b> qualquer local de qualquer região, <b>Chegar agora</b> (se estiver viajando), mandar fazer <b>ronda</b> (locais da mesma região, que a peça percorre sozinha, igual em todas as telas) ou tirar do mapa. No cartão de cada local você tem: revelar o local (tirar a névoa), o <b>segredo do local</b> (só você lê; "Revelar ao grupo" publica o texto no cartão), o <b>gatilho</b> (alerta "Ada e Tom entraram no Cemitério", que também dispara quando uma viagem chega), <b>testemunhas</b> do horário e <b>fotos</b> do local. Nas plantas internas, toque numa sala para escrever e revelar o segredo dela.</p>
  <p>No Painel do Guardião, aba <b>Mapa</b>: <b>Relógio</b> (as viagens andam com ele), <b>Clima</b>, <b>Peças</b> (pôr NPCs e viaturas em qualquer região), <b>Veículos dos investigadores</b> (crie os carros, a cor, os lugares, quem tem a chave e onde estão estacionados), <b>Viagens e distâncias</b> (quem está a caminho, chegar agora, avançar o relógio até a última chegada, viagens instantâneas e liberar ir a pé entre regiões), <b>Névoa</b>, <b>Bloqueios</b> (as quatro saídas do condado), <b>Rotinas dos NPCs</b>, <b>Perseguição</b> e <b>Replay</b>. Aba <b>Segredos</b>: segredos e gatilhos dos locais e as <b>senhas dos andares trancados</b>.</p>
  <p class="mini">Você recebe alerta quando um investigador sai em viagem e quando chega. Os alertas de gatilho, de saída do condado, de andar destrancado e de tempo esgotado na perseguição aparecem no canto da sua tela. Gatilhos, rotinas, avisos de viagem e o replay dependem do seu aparelho estar com o site aberto.</p>` });
CRW.registrarAjuda({ id: 'mapa-aux', titulo: 'Mapa: o que o auxiliar faz', ordem: 12, para: ['aux'], html: `<p>Você vê as peças ocultas e pode arrastar NPCs e viaturas que já estão no mapa (as dos investigadores, não). Pôr ou tirar peças, revelar locais, clima, relógio e segredos são do Guardião.</p>` });
})();
