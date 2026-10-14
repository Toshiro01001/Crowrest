/* =========================================================
   CROWSREST · sessao.js
   A mesa de jogo: Sangria da cidade (medidor, limiares e
   manifestações, efeitos globais), dados de contagem regressiva,
   aberturas e encerramento anos 90, queda de energia e neblina
   total, holofote, dilema secreto, momentos marcantes, distintivos,
   Investigador da Semana, Mural de Honra e Arquivo Morto,
   exposição de cada investigador e as duas lojas (Almoxarifado do
   CCSO e Penhores Pulptown).
   Nada de segredo aqui: limiares, distintivos e o que o Mestre
   prepara ficam em segredos/... no servidor.
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, clamp, copia, ls, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela, Som } = CRW;

/* =========================================================
   UTILIDADES DO MÓDULO
   ========================================================= */
const ehM = () => !!CRW.P.mestre;                 // pode gravar como Mestre
const S = () => Estado.get() || {};
const RM = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const appVisivel = () => { const a = $('#app'); return !!a && !a.classList.contains('hidden'); };
const quem = () => CRW.P.mestre ? 'm' : CRW.P.aux ? 'a' : (CRW.P.pc || 'tv');
// memória local por perfil (Mestre e jogador no mesmo navegador não se confundem)
const visto = { get(k, d) { return ls.get('ss-' + k + ':' + quem(), d); }, set(k, v) { ls.set('ss-' + k + ':' + quem(), v); } };
const nid = () => Rede.chave();
const pcNome = id => (CRW.pc(id) || {}).nome || id || '?';
const hoje = () => CRW.relogio().data;
const horaJogo = () => { const r = CRW.relogio(); return pad2(r.h) + ':' + pad2(r.m); };
const txt = t => esc(t || '').replace(/\n/g, '<br>');
const lista = o => (Array.isArray(o) ? o.map((x, i) => [String(i), x]) : Object.entries(o || {})).filter(([, x]) => x);
const ativo = sec => document.body.contains(sec);
// assina um evento do núcleo enquanto o elemento existir
function vivo(no, ev, fn) { let off = null; off = CRW.on(ev, x => { if (!ativo(no)) { if (off) off(); return; } fn(x); }); return off; }
// assina um caminho da Rede enquanto o elemento existir
const ligacoes = [];
function redeViva(no, cam, fn) {
  const l = { no, off: null };
  l.off = Rede.on(cam, x => { if (!ativo(no)) { if (l.off) l.off(); l.off = null; return; } fn(x); }, () => {});
  ligacoes.push(l); return l;
}
function limparLigacoes() { for (let i = ligacoes.length - 1; i >= 0; i--) { const l = ligacoes[i]; if (!ativo(l.no)) { if (l.off) l.off(); ligacoes.splice(i, 1); } } }
// redesenha sem atrapalhar quem está digitando
function semFoco(c) { const f = document.activeElement; return !(f && c.contains(f) && /INPUT|TEXTAREA|SELECT/.test(f.tagName)); }
function retrato(p, cls) {
  p = p || {};
  if (p.foto) return `<span class="ss-3x4 ${cls || ''}"><img src="${esc(p.foto)}" alt=""></span>`;
  return `<span class="ss-3x4 ss-3x4-vazio ${cls || ''}" style="--c:${esc(p.cor || '#56606b')}"><b>${esc(CRW.iniciais(p.nome))}</b></span>`;
}
function opcoesPCs(sel, excluir) { return CRW.pcs().filter(p => p.id !== excluir).map(p => `<option value="${esc(p.id)}"${p.id === sel ? ' selected' : ''}>${esc(p.nome)}</option>`).join(''); }
function fecharCamada(no) { if (!no || !no.parentNode) return; no.classList.add('ss-saindo'); setTimeout(() => no.remove(), RM() ? 0 : 260); }
// toque ou tecla fecha (com um respiro para o clique que abriu não fechar na hora)
function fechavel(no, aoFechar) {
  let pronto = false; setTimeout(() => { pronto = true; }, 450);
  const fim = () => { if (!pronto) return; document.removeEventListener('keydown', tecla, true); fecharCamada(no); if (aoFechar) aoFechar(); };
  const tecla = e => { if (!document.body.contains(no)) return document.removeEventListener('keydown', tecla, true); if (e.key === 'Tab') return; e.preventDefault(); fim(); };
  no.addEventListener('click', fim); document.addEventListener('keydown', tecla, true);
  no.tabIndex = -1; setTimeout(() => { try { no.focus({ preventScroll: true }); } catch (e) {} }, 30);
  return fim;
}
function camada(id, cls, html) {
  const velho = document.getElementById(id); if (velho) velho.remove();
  const d = el('div', 'ss-camada ' + cls, html); d.id = id; d.setAttribute('role', 'dialog'); d.setAttribute('aria-modal', 'true');
  document.body.appendChild(d); return d;
}
function escreverAos(alvo, texto, ms) {
  // texto datilografado (com movimento reduzido aparece de uma vez)
  if (RM() || !texto) { alvo.innerHTML = txt(texto); return; }
  let i = 0; const t = String(texto);
  const passo = () => { if (!document.body.contains(alvo)) return; i += Math.max(1, Math.round(t.length / 220)); alvo.innerHTML = txt(t.slice(0, i)) + (i < t.length ? '<span class="ss-cursor">_</span>' : ''); if (i < t.length) setTimeout(passo, ms || 28); };
  passo();
}

/* ---------- sons próprios (sintetizados com CRW.Som) ---------- */
const Sx = {
  varre(f0, f1, dur, tipo = 'sawtooth', vol = 0.05, t0 = 0) {
    const c = Som.pronto(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = tipo; o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  vhs() { Som.ruido(0, 0.22, 0.07, 500, 'lowpass'); Som.tom(90, 0.02, 0.18, 'square', 0.05); this.varre(80, 240, 0.7, 'sawtooth', 0.02, 0.25); Som.ruido(0.3, 1.4, 0.022, 3200); },
  bios() { Som.tom(1000, 0, 0.16, 'square', 0.05); for (let i = 0; i < 7; i++) Som.ruido(0.5 + i * 0.14, 0.07, 0.05, 600 + i * 120); },
  jornal() { [[392, 0], [523.2, 0.16], [659.3, 0.32], [784, 0.48]].forEach(([f, t]) => { Som.tom(f, t, 0.45, 'sawtooth', 0.03); Som.tom(f / 2, t, 0.45, 'triangle', 0.04); }); Som.tom(1046.5, 0.7, 1.3, 'triangle', 0.05); Som.tom(523.2, 0.7, 1.3, 'sawtooth', 0.025); },
  stop() { this.varre(320, 40, 1.0, 'sawtooth', 0.05); Som.ruido(0, 0.2, 0.06, 400, 'lowpass'); Som.tom(70, 1.0, 0.16, 'square', 0.06); },
  holofote() { Som.ruido(0, 0.14, 0.09, 260, 'lowpass'); Som.tom(55, 0, 0.35, 'square', 0.05); Som.tom(110, 0.05, 1.6, 'sine', 0.03); },
  medalha() { [659.3, 784, 987.8, 1318.5].forEach((f, i) => Som.tom(f, i * 0.12, 0.55, 'triangle', 0.06)); Som.tom(1318.5, 0.5, 1, 'sine', 0.04); },
  alarme() { [0, 0.5, 1].forEach(t => { Som.tom(880, t, 0.24, 'square', 0.045); Som.tom(660, t + 0.25, 0.24, 'square', 0.045); }); },
  apagao() { this.varre(140, 30, 1.2, 'sawtooth', 0.06); Som.ruido(0, 0.3, 0.06, 300, 'lowpass'); },
  sinal() { Som.tom(48, 0, 1.6, 'sine', 0.06); Som.ruido(0, 0.7, 0.02, 200, 'lowpass'); },
  manif() { Som.ruido(0, 1.2, 0.04, 900); this.varre(220, 60, 1.6, 'sine', 0.05, 0.1); },
  dado() { for (let i = 0; i < 5; i++) Som.ruido(i * 0.07, 0.05, 0.05, 1800 - i * 200); },
  carimbo() { Som.ruido(0, 0.08, 0.09, 500, 'lowpass'); Som.tom(80, 0, 0.12, 'square', 0.05); Som.ruido(0.25, 0.06, 0.06, 2400); },
  rotativa() { for (let i = 0; i < 10; i++) Som.ruido(i * 0.09, 0.07, 0.045, 700 + (i % 2) * 500); },
};
let zum = null;
function zumbido(ligar) {
  if (zum) { const z = zum; zum = null; try { z.g.gain.setTargetAtTime(0.0001, z.c.currentTime, 0.15); setTimeout(() => { try { z.o.stop(); z.o2.stop(); } catch (e) {} }, 700); } catch (e) {} }
  if (!ligar) return;
  const c = Som.pronto(); if (!c) return;
  try {
    const o = c.createOscillator(), o2 = c.createOscillator(), f = c.createBiquadFilter(), g = c.createGain();
    o.type = 'sawtooth'; o.frequency.value = 60; o2.type = 'sine'; o2.frequency.value = 120;
    f.type = 'lowpass'; f.frequency.value = 280; g.gain.value = 0.0001; g.gain.setTargetAtTime(0.016, c.currentTime, 0.4);
    o.connect(f); o2.connect(f); f.connect(g).connect(c.destination); o.start(); o2.start();
    zum = { c, o, o2, g };
  } catch (e) { zum = null; }
}

/* =========================================================
   19 · SANGRIA DA CIDADE
   estado/sangria = { nivel 0..10, ts, marcos:[2,4,..], liberados:{L2:ts},
                      manif:{ L2:{n,titulo,texto,efeito,ts,data} } }
   segredos/sangria/limiares/L<n> = { n, titulo, texto, efeito, nota }
   ========================================================= */
const MARCOS_PADRAO = [2, 4, 6, 8, 10];
const LEITURA = ['ESTÁVEL', 'ESTÁVEL', 'OSCILANTE', 'OSCILANTE', 'INSTÁVEL', 'INSTÁVEL', 'PERTURBADO', 'PERTURBADO', 'CRÍTICO', 'CRÍTICO', 'RUPTURA'];
const EFEITOS = [['corvo', 'Corvo cruza a tela (com grasnado)'], ['falha', 'Falha de vídeo'], ['treme', 'Texto que treme'], ['piscar', 'Luzes piscam'], ['estatica', 'Estática forte'], ['nenhum', 'Sem efeito (só o texto)']];
const sangriaObj = () => S().sangria || {};
const chaveL = n => 'L' + int(n);
function marcos() {
  const m = sangriaObj().marcos;
  const l = Array.isArray(m) ? m : (m && typeof m === 'object' ? Object.values(m) : null);
  return [...new Set((l && l.length ? l : MARCOS_PADRAO).map(Number).filter(n => n >= 1 && n <= 10))].sort((a, b) => a - b);
}
// limiares que o Mestre preparou (aceita chave "L4", "4" ou lista)
function limiaresSeg() {
  return lista(Segredos.ler(['sangria', 'limiares'])).map(([k, x]) => ({ ...x, n: clamp(int(x.n != null ? x.n : String(k).replace(/\D/g, '')), 1, 10), k }))
    .filter(x => x.n >= 1).sort((a, b) => a.n - b.n);
}
const manifs = () => lista(sangriaObj().manif).map(([k, x]) => ({ ...x, k, n: int(x.n != null ? x.n : String(k).replace(/\D/g, '')) })).sort((a, b) => a.n - b.n);

/* ---------- efeitos visuais globais ---------- */
const SVG_CORVO = `<svg viewBox="0 0 120 70" aria-hidden="true"><g class="ss-asa ss-asa1"><path d="M58 34 C44 10 22 6 4 12 C22 16 34 24 46 38 Z"/></g><path d="M40 38 C52 30 74 28 88 34 L104 30 L96 38 C92 44 80 48 64 46 C54 46 46 44 40 38 Z"/><path d="M40 38 L22 44 L28 38 L18 36 L38 34 Z"/><circle cx="92" cy="33" r="1.4" fill="#933"/><g class="ss-asa ss-asa2"><path d="M62 36 C70 12 90 4 110 8 C92 14 80 24 72 40 Z"/></g></svg>`;
function garantirCamadasFx() {
  if (!$('#ssGrao')) { const g = el('div', 'ss-grao'); g.id = 'ssGrao'; g.setAttribute('aria-hidden', 'true'); document.body.appendChild(g); }
  if (!$('#ssVinheta')) { const v = el('div', 'ss-vinheta'); v.id = 'ssVinheta'; v.setAttribute('aria-hidden', 'true'); document.body.appendChild(v); }
}
function corvoCruza() {
  const c = el('div', 'ss-corvo' + (RM() ? ' parado' : ''), SVG_CORVO);
  c.setAttribute('aria-hidden', 'true');
  c.style.top = (8 + Math.random() * 52).toFixed(1) + 'vh';
  if (Math.random() < 0.5) c.classList.add('volta');
  document.body.appendChild(c);
  Som.corvo();
  setTimeout(() => c.remove(), RM() ? 2600 : 5200);
}
function falha() {
  if (RM()) return;
  document.body.classList.add('ss-falha'); Som.ruido(0, 0.35, 0.05, 2600);
  setTimeout(() => document.body.classList.remove('ss-falha'), 520);
}
function treme() {
  if (RM()) return;
  const alvos = $$('#modulos > .mod.show h2, #modulos > .mod.show h3, #modulos > .mod.show p, #modulos > .mod.show .tx, #modulos > .mod.show td').filter(e => e.offsetParent && e.textContent.trim().length > 3);
  for (let i = 0; i < Math.min(3, alvos.length); i++) { const e = alvos[Math.floor(Math.random() * alvos.length)]; e.classList.add('ss-treme'); setTimeout(() => e.classList.remove('ss-treme'), 2600); }
}
function piscar() { const p = el('div', 'ss-pisca' + (RM() ? ' calmo' : '')); p.setAttribute('aria-hidden', 'true'); document.body.appendChild(p); Som.ruido(0, 0.2, 0.04, 200, 'lowpass'); setTimeout(() => p.remove(), 1500); }
function estatica() { const p = el('div', 'ss-estatica' + (RM() ? ' calmo' : '')); p.setAttribute('aria-hidden', 'true'); document.body.appendChild(p); Som.ruido(0, 0.9, 0.06, 3000); setTimeout(() => p.remove(), 1000); }
function efeito(tipo) {
  if (!tipo || tipo === 'nenhum') return;
  ({ corvo: corvoCruza, falha, treme, piscar, estatica }[tipo] || (() => {}))();
  CRW.emit('sangriaEfeito', tipo);
}
// efeitos ambientes aleatórios: cada tela sorteia os seus (não sincroniza)
let efT = null;
function agendarEfeitos() {
  clearTimeout(efT);
  const n = CRW.sangria(); if (n < 2) return;
  const base = Math.max(50, 560 - n * 52) * 1000;     // nível 2: ~7 min · nível 10: ~1 min (média)
  efT = setTimeout(() => { efeitoAmbiente(); agendarEfeitos(); }, base * (0.6 + Math.random() * 0.8));
}
function efeitoAmbiente() {
  if (document.hidden || !appVisivel()) return;
  const n = CRW.sangria(); const op = ['corvo', 'corvo'];
  if (n >= 5) op.push('falha'); if (n >= 7) op.push('treme', 'falha');
  efeito(op[Math.floor(Math.random() * op.length)]);
}

/* ---------- o canto discreto (barra de status) ---------- */
function desenharCanto() {
  let c = $('#ssCanto');
  if (!c) {
    c = el('button', 'sb-cell ss-canto'); c.id = 'ssCanto'; c.type = 'button';
    c.addEventListener('click', () => CRW.abrirModulo('ss-sangria'));
    const sb = $('.statusbar'), t = $('#sbClock');
    if (CRW.TV || !sb) { c.classList.add('ss-canto-tv'); document.body.appendChild(c); } else sb.insertBefore(c, t);
  }
  const n = CRW.sangria(), mk = marcos();
  c.title = `Sangria da cidade: nível ${n} de 10`; c.setAttribute('aria-label', c.title);
  c.innerHTML = `<span class="ss-canto-l">SANGRIA</span><span class="ss-segs">${Array.from({ length: 10 }, (_, i) => `<i class="${i < n ? 'on ' : ''}${mk.includes(i + 1) ? 'mk ' : ''}s${i + 1}"></i>`).join('')}</span>`;
}

/* ---------- reação de todas as telas ao estado/sangria ---------- */
let sangAnt = null, sangVista = '';
function aplicarSangria() {
  const n = CRW.sangria();
  garantirCamadasFx();
  if (n !== sangAnt) {
    for (let i = 0; i <= 10; i++) document.body.classList.toggle('sangria-' + i, i === n);
    const ant = sangAnt; sangAnt = n;
    CRW.emit('sangria', { nivel: n, anterior: ant });
    agendarEfeitos();
  }
  const fatia = JSON.stringify([n, sangriaObj().marcos || null]);
  if (fatia !== sangVista) { sangVista = fatia; desenharCanto(); }
  if (!appVisivel()) return;
  const vistos = visto.get('manif', {}); let mudou = false;
  manifs().forEach(m => {
    if (!m.ts || vistos[m.k] === m.ts) return;
    vistos[m.k] = m.ts; mudou = true;
    if (Date.now() - num(m.ts) < 30 * 60000) mostrarManifestacao(m);
  });
  if (mudou) visto.set('manif', vistos);
}
function mostrarManifestacao(m) {
  const d = camada('ssManif', 'ss-manif', `<div class="ss-manif-c"><div class="ss-manif-cab">SIIC · ALERTA DO MONITOR CCSO-SM · LIMIAR ${pad2(m.n)}</div>
    ${m.titulo ? `<h2>${esc(m.titulo)}</h2>` : ''}${m.texto ? `<p data-t></p>` : ''}<div class="ss-ab-dica">toque ou tecle para fechar</div></div>`);
  Sx.manif();
  if (m.texto) escreverAos($('[data-t]', d), m.texto, 30);
  fechavel(d);
  setTimeout(() => efeito(m.efeito || 'corvo'), 600);
  CRW.emit('sangriaManif', m);
}

/* ---------- o sismógrafo (módulo) ---------- */
function sismografo(cv, sec) {
  const ctx = cv.getContext('2d'); const pts = []; let fase = 0, raf = 0, ult = 0, W = 0, H = 0, dpr = 1;
  const medir = () => { dpr = Math.min(2, window.devicePixelRatio || 1); const w = Math.max(200, cv.clientWidth), h = cv.clientHeight || 130; if (w !== W || h !== H) { W = w; H = h; cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); } };
  const amostra = () => {
    const n = CRW.sangria(), amp = 2 + n * 3.1;
    let v = (Math.random() * 2 - 1) * amp * 0.45 + Math.sin(fase) * amp * 0.35; fase += 0.33 + n * 0.05;
    if (n >= 3 && Math.random() < n * 0.012) v = (Math.random() < 0.5 ? -1 : 1) * amp * (1.6 + Math.random() * 1.4);
    return clamp(v, -H / 2 + 6, H / 2 - 6);
  };
  const desenhar = () => {
    const n = CRW.sangria();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#f3efdc'; ctx.fillRect(0, 0, W, H);
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 12) { ctx.strokeStyle = x % 60 === 0 ? 'rgba(170,60,60,.35)' : 'rgba(170,60,60,.13)'; ctx.beginPath(); ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, H); ctx.stroke(); }
    for (let y = 0; y < H; y += 12) { ctx.strokeStyle = 'rgba(170,60,60,.13)'; ctx.beginPath(); ctx.moveTo(0, y + 0.5); ctx.lineTo(W, y + 0.5); ctx.stroke(); }
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.moveTo(0, H / 2 + 0.5); ctx.lineTo(W, H / 2 + 0.5); ctx.stroke();
    ctx.strokeStyle = n >= 8 ? '#8a0f0f' : n >= 5 ? '#5a1d1d' : '#14204a'; ctx.lineWidth = 1.4; ctx.beginPath();
    const x0 = W - 18 - pts.length * 3;
    pts.forEach((v, i) => { const x = x0 + i * 3, y = H / 2 + v; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); });
    ctx.stroke();
    const yu = H / 2 + (pts[pts.length - 1] || 0);
    ctx.fillStyle = '#b01e1e'; ctx.beginPath(); ctx.arc(W - 18, yu, 3, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(W - 18, yu); ctx.lineTo(W - 2, H / 2 - 30); ctx.stroke();
  };
  const encher = () => { medir(); pts.length = 0; const max = Math.ceil((W - 18) / 3); for (let i = 0; i < max; i++) pts.push(amostra()); desenhar(); };
  const passo = t => {
    if (!document.body.contains(cv)) { cancelAnimationFrame(raf); return; }
    raf = requestAnimationFrame(passo);
    if (!sec.classList.contains('show') || document.hidden || RM()) return;
    if (t - ult < 55) return; ult = t;
    medir(); pts.push(amostra()); const max = Math.ceil((W - 18) / 3); if (pts.length > max) pts.splice(0, pts.length - max);
    desenhar();
  };
  encher(); raf = requestAnimationFrame(passo);
  return { refazer: encher };
}

function medidorHtml(n) {
  const mk = marcos();
  return `<div class="ss-med-cab"><span class="ss-med-n">${pad2(n)}</span><span class="ss-med-l">NÍVEL DE SANGRIA<br><b>${LEITURA[n]}</b></span></div>
    <div class="ss-barra" role="meter" aria-valuemin="0" aria-valuemax="10" aria-valuenow="${n}" aria-label="Sangria da cidade">${Array.from({ length: 10 }, (_, i) => `<span class="ss-seg s${i + 1}${i < n ? ' on' : ''}${mk.includes(i + 1) ? ' mk' : ''}"><em>${i + 1}</em></span>`).join('')}</div>
    <div class="ss-escala"><span>0</span><span>▼ = limiar</span><span>10</span></div>`;
}

/* =========================================================
   20 · DADOS DE CONTAGEM REGRESSIVA
   visíveis: estado/contagens/<id>  ·  secretos: segredos/contagens/<id>
   { nome, dado:'d6', valor, visivel, regra, ult:{r,antes,depois,ts}, zerou, ts }
   ========================================================= */
const DADOS = ['d4', 'd6', 'd8', 'd10', 'd12', 'd20'];
const lados = d => clamp(int(String(d || 'd6').replace(/\D/g, ''), 6) || 6, 2, 100);
const REGRAS = {
  um: 'Rola o dado; se sair 1, o valor desce 1.',
  encolhe: 'Rola o dado; se sair 1, o dado diminui (d12, d10, d8, d6, d4); um 1 no d4 zera.',
  sempre: 'Cada toque em Rolar desce 1 (relógio simples; o dado é só visual).',
};
// modelos de relógio: os nomes ficam nos segredos (segredos/contagensModelos), fora do código público
const MODELOS_PADRAO = [{ nome: 'Relógio de pressão', dado: 'd6' }, { nome: 'Prazo da investigação', dado: 'd8' }];
const MODELOS_L = () => { const m = Segredos.ler(['contagensModelos']); const l = m ? Object.values(m).filter(x => x && x.nome) : []; return l.length ? l : MODELOS_PADRAO; };
const contVis = () => lista(S().contagens).map(([id, x]) => ({ ...x, id, visivel: true }));
const contSec = () => lista(Segredos.ler(['contagens'])).map(([id, x]) => ({ ...x, id, visivel: false }));
const contTodas = () => [...contVis(), ...contSec()].sort((a, b) => num(a.ts) - num(b.ts));
function gravarCont(c) {
  const dado = { nome: c.nome, dado: c.dado, valor: int(c.valor), visivel: !!c.visivel, regra: c.regra || 'um', ult: c.ult || null, zerou: c.zerou || null, ts: c.ts || Date.now() };
  if (c.visivel) { Estado.definir(['contagens', c.id], dado); if (Segredos.ler(['contagens', c.id])) Segredos.gravar(['contagens', c.id], null); }
  else { Segredos.gravar(['contagens', c.id], dado); if ((S().contagens || {})[c.id]) Estado.definir(['contagens', c.id], null); }
}
function rolarCont(c) {
  const f = lados(c.dado), r = 1 + Math.floor(Math.random() * f), antes = int(c.valor);
  let valor = antes, dado = c.dado;
  if ((c.regra || 'um') === 'um' && r === 1) valor -= 1;
  if (c.regra === 'sempre') valor -= 1;
  if (c.regra === 'encolhe' && r === 1) { const i = DADOS.indexOf(dado); if (i <= 0) valor = 0; else { dado = DADOS[i - 1]; valor = lados(dado); } }
  valor = Math.max(0, valor);
  const novo = { ...c, dado, valor, ult: { r, antes, depois: valor, ts: Date.now() } };
  if (valor === 0 && antes > 0) novo.zerou = Date.now();
  gravarCont(novo); Sx.dado();
  CRW.diario('contagem', `${c.nome} (${c.visivel ? 'visível' : 'secreta'}): rolou ${r} no ${c.dado}, ${antes} → ${valor}`);
  if (novo.zerou && novo.zerou !== c.zerou) { CRW.alertaMestre(`Contagem zerada: ${c.nome}`, 'ss-cont-' + c.id); CRW.diario('contagem', 'ZEROU: ' + c.nome); }
  return r;
}
function dadoHtml(c, grande) {
  const z = int(c.valor) <= 0;
  return `<div class="ss-dado-card${z ? ' zero' : ''}${grande ? ' grande' : ''}" data-cid="${esc(c.id)}">
    <div class="ss-dado ${esc(c.dado)}"><span class="ss-dado-v">${z ? '0' : int(c.valor)}</span><span class="ss-dado-t">${esc(c.dado)}</span></div>
    <div class="ss-dado-nome">${esc(c.nome)}</div>
    ${c.ult ? `<div class="mini">última rolagem: <b>${int(c.ult.r)}</b>${c.ult.antes !== c.ult.depois ? ` · ${int(c.ult.antes)} → ${int(c.ult.depois)}` : ' · sem mudança'}</div>` : '<div class="mini">ainda não rolado</div>'}
    ${z ? '<div class="ss-dado-fim">ZERADA</div>' : ''}</div>`;
}
// todas as telas: avisos de contagens visíveis
function aplicarContagens() {
  if (!appVisivel()) return;
  const vist = visto.get('cont', {}); let mudou = false;
  contVis().forEach(c => {
    const u = c.ult && c.ult.ts, z = c.zerou;
    const k = c.id, prev = vist[k] || {};
    if (u && prev.u !== u) { if (prev.u != null && Date.now() - u < 120000 && !z) aviso(`Contagem "${c.nome}": rolou ${c.ult.r}${c.ult.antes !== c.ult.depois ? `, agora em ${c.ult.depois}` : ', nada muda'}.`); prev.u = u; mudou = true; }
    if (z && prev.z !== z) { if (Date.now() - z < 10 * 60000) mostrarContagemZerada(c); prev.z = z; mudou = true; }
    vist[k] = prev;
  });
  if (mudou) visto.set('cont', vist);
}
function mostrarContagemZerada(c) {
  const d = camada('ssContZ', 'ss-contz', `<div class="ss-contz-c"><div class="ss-contz-cab">⚑ CONTAGEM ENCERRADA</div>${dadoHtml({ ...c, valor: 0 }, true)}<p>O tempo de <b>${esc(c.nome)}</b> acabou.</p><div class="ss-ab-dica">toque ou tecle para fechar</div></div>`);
  Sx.alarme(); fechavel(d); CRW.emit('contagemZerada', { id: c.id, nome: c.nome });
}

/* =========================================================
   34 · ABERTURA E ENCERRAMENTO ANOS 90
   estado/abertura = { tipo:'vhs'|'bios'|'telejornal'|'encerramento', titulo, texto, manchete, letreiro, ts }
   ========================================================= */
const ABERTURAS = { vhs: 'VHS "Anteriormente…"', bios: 'Inicialização do SIIC', telejornal: 'Telejornal local', encerramento: 'Encerramento (fita parando)' };
let contadorT = null;
function mostrarAbertura(ab, previa) {
  clearInterval(contadorT);
  const tipo = ABERTURAS[ab.tipo] ? ab.tipo : 'vhs';
  let html = '';
  if (tipo === 'vhs') html = `<div class="ss-vhs-osd"><span class="ss-play">PLAY ▶</span><span class="ss-sp">SP <b data-cont>0:00:00</b></span></div>
      <div class="ss-vhs-track"></div><div class="ss-vhs-track b"></div>
      <div class="ss-ab-corpo"><h1>${esc(ab.titulo || 'Anteriormente…')}</h1><div class="ss-ab-txt" data-t></div></div>`;
  if (tipo === 'bios') html = `<div class="ss-ab-corpo"><pre class="ss-bios" data-bios></pre><h1 class="ss-bios-tit" hidden>${esc(ab.titulo || 'SIIC pronto')}</h1><div class="ss-ab-txt" data-t></div></div>`;
  if (tipo === 'telejornal') html = `<div class="ss-tj-barras" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <div class="ss-tj-tela"><div class="ss-tj-logo">CANAL 8<small>JORNAL DO VALE</small></div><div class="ss-tj-vivo">● AO VIVO · ${horaJogo()}</div>
      <div class="ss-ab-corpo"><h1>${esc(ab.titulo || 'Jornal do Vale')}</h1><div class="ss-ab-txt" data-t></div></div>
      <div class="ss-tj-terco"><span class="ss-tj-tag">URGENTE</span><b>${esc(ab.manchete || 'Crowsrest, ' + hoje())}</b></div>
      <div class="ss-tj-letreiro"><span>${esc(ab.letreiro || 'Previsão: neblina nas primeiras horas do dia em todo o vale · Departamento do Xerife pede cautela na Rodovia Hollow Mill')}</span></div></div>`;
  if (tipo === 'encerramento') html = `<div class="ss-vhs-osd"><span class="ss-play">STOP ■</span><span class="ss-sp">SP <b data-cont>1:58:41</b></span></div>
      <div class="ss-vhs-track"></div><div class="ss-ab-corpo"><h1>${esc(ab.titulo || 'continua...')}</h1><div class="ss-ab-txt" data-t></div></div>`;
  const d = camada('ssAbertura', 'ss-ab ss-ab-' + tipo, html + '<div class="ss-ab-dica">toque ou tecle para fechar</div>');
  d.dataset.ts = ab.ts || ''; if (previa) d.dataset.previa = '1';
  ({ vhs: () => Sx.vhs(), bios: () => Sx.bios(), telejornal: () => Sx.jornal(), encerramento: () => Sx.stop() })[tipo]();
  const corpoTxt = $('[data-t]', d);
  if (tipo === 'vhs') {
    let s = 0; const cont = $('[data-cont]', d);
    contadorT = setInterval(() => { if (!document.body.contains(d)) return clearInterval(contadorT); s++; cont.textContent = `${Math.floor(s / 3600)}:${pad2(Math.floor(s / 60) % 60)}:${pad2(s % 60)}`; }, 1000);
    setTimeout(() => { d.classList.add('rodando'); escreverAos(corpoTxt, ab.texto, 26); }, RM() ? 0 : 1500);
  } else if (tipo === 'bios') {
    const pre = $('[data-bios]', d);
    const linhas = ['CCSO Crowsrest · SIIC BIOS v4.0', '(C) 1997 State of West Virginia', '', 'Processador: 486DX2-66 ...... OK', 'Memória: @MEM@', 'Unidade A: 1.44 MB ......... OK', 'Unidade C: 540 MB .......... OK', 'Carregando HIMEM.SYS ........ OK', 'Carregando SIIC.SYS ......... OK', 'Sessão de investigação ...... ABERTA', ''];
    let i = 0, mem = 0;
    const passo = () => {
      if (!document.body.contains(d)) return;
      if (i >= linhas.length) { $('.ss-bios-tit', d).hidden = false; d.classList.add('rodando'); escreverAos(corpoTxt, ab.texto, 22); return; }
      const l = linhas[i];
      if (l.includes('@MEM@')) {
        mem = Math.min(640, mem + (RM() ? 640 : 64));
        pre.textContent = linhas.slice(0, i).join('\n') + '\n' + `Memória: ${mem}K ${mem >= 640 ? '...... OK' : ''}`;
        if (mem < 640) return setTimeout(passo, 60);
        linhas[i] = `Memória: 640K ............. OK`;
      }
      i++; pre.textContent = linhas.slice(0, i).join('\n');
      setTimeout(passo, RM() ? 0 : 140);
    };
    passo();
  } else if (tipo === 'telejornal') {
    setTimeout(() => { d.classList.add('rodando'); escreverAos(corpoTxt, ab.texto, 22); }, RM() ? 0 : 1300);
  } else {
    d.classList.add('parando');
    setTimeout(() => { d.classList.add('rodando'); escreverAos(corpoTxt, ab.texto, 34); }, RM() ? 0 : 1400);
  }
  fechavel(d, () => clearInterval(contadorT));
  CRW.emit('abertura', { tipo, previa: !!previa });
}
function aplicarAbertura() {
  const ab = S().abertura;
  const atual = $('#ssAbertura');
  if (!ab || !ab.ts) { if (atual && !atual.dataset.previa) fecharCamada(atual); return; }
  if (!appVisivel() && !CRW.TV) return;
  if (visto.get('abert', 0) === ab.ts) return;
  visto.set('abert', ab.ts);
  if (Date.now() - num(ab.ts) < 20 * 60000) mostrarAbertura(ab);
}

/* =========================================================
   40 · QUEDA DE ENERGIA OU NEBLINA TOTAL
   estado/apagao = { tipo:'energia'|'neblina', ts, ate? }
   ========================================================= */
let apAtual = '', apT = null, luzPos = null;
const apagaoAtivo = () => { const a = S().apagao; return a && (a.tipo === 'energia' || a.tipo === 'neblina') && (!a.ate || Date.now() < num(a.ate)) ? a : null; };
function moverLuz(x, y) {
  luzPos = [x, y];
  const o = $('#ssApagao'); if (o) { o.style.setProperty('--lx', x + 'px'); o.style.setProperty('--ly', y + 'px'); }
}
['pointermove', 'pointerdown'].forEach(ev => window.addEventListener(ev, e => { if (apAtual) moverLuz(e.clientX, e.clientY); }, { passive: true }));
window.addEventListener('touchmove', e => { if (apAtual && e.touches[0]) moverLuz(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
function aplicarApagao() {
  const a = apagaoAtivo(), tipo = a ? a.tipo : '';
  clearTimeout(apT);
  if (a && a.ate) apT = setTimeout(() => { aplicarApagao(); if (ehM() && S().apagao && S().apagao.ts === a.ts) { Estado.definir(['apagao'], null); CRW.diario('apagao', 'Fim automático: ' + a.tipo); } }, Math.max(500, num(a.ate) - Date.now() + 200));
  const chave = a ? tipo + ':' + a.ts : '';
  if (chave === apAtual) return;
  const antes = apAtual; apAtual = chave;
  document.body.classList.toggle('apagao-energia', tipo === 'energia');
  document.body.classList.toggle('neblina-total', tipo === 'neblina');
  let o = $('#ssApagao');
  if (!tipo) { if (o) fecharCamada(o); zumbido(false); CRW.emit('apagao', null); return; }
  if (o) o.remove();
  o = el('div', 'ss-apagao ss-ap-' + tipo + (CRW.P.mestre && !CRW.P.espiar ? ' ss-mestre' : '') + (RM() ? ' calmo' : ''), tipo === 'neblina' ? '<i></i><i></i><i></i>' : '');
  o.id = 'ssApagao'; o.setAttribute('aria-hidden', 'true');
  document.body.appendChild(o);
  moverLuz(...(luzPos || [innerWidth / 2, innerHeight * 0.45]));
  if (tipo === 'energia') { if (antes.split(':')[0] !== 'energia') Sx.apagao(); setTimeout(() => { if (apAtual === chave) zumbido(true); }, 900); }
  else { zumbido(false); Som.ruido(0, 1.5, 0.02, 400, 'lowpass'); }
  CRW.emit('apagao', { tipo, ate: a.ate || null });
}
CRW.on('som', l => { if (apAtual.startsWith('energia')) zumbido(l); });

/* =========================================================
   41 · HOLOFOTE, DILEMA SECRETO, MOMENTOS MARCANTES
   estado/holofote = { pc, frase, ts, origem:'mestre'|'critico' }
   segredos/dilemas/<id> = { pc, pergunta, opcoes:[], ts, data, resposta:{i,texto,ts} }
   estado/momentos/<id> = { pc, titulo, texto, tipo:'critico'|'cicatriz'|'cena', data, ts }
   ========================================================= */
let holoT = null;
function mostrarHolofote(h) {
  const p = CRW.pc(h.pc) || { nome: h.nome || h.pc };
  clearTimeout(holoT);
  const d = camada('ssHolofote', 'ss-holo' + (RM() ? ' calmo' : ''), `<div class="ss-holo-luz" aria-hidden="true"></div><div class="ss-holo-c">
    <div class="ss-holo-cab">${h.origem === 'critico' ? '★ CRÍTICO ★' : 'NO HOLOFOTE'}</div>${retrato(p, 'ss-holo-foto')}
    <div class="ss-holo-nome">${esc(p.nome)}</div>${p.papel ? `<div class="ss-holo-papel">${esc(p.papel)}${p.esp ? ' · ' + esc(p.esp) : ''}</div>` : ''}
    ${h.frase ? `<div class="ss-holo-frase">“${esc(h.frase)}”</div>` : ''}</div><div class="ss-ab-dica">toque ou tecle para fechar</div>`);
  d.dataset.ts = h.ts || '';
  Sx.holofote(); fechavel(d);
  holoT = setTimeout(() => fecharCamada(d), 20000);
  CRW.emit('holofote', h);
}
function aplicarHolofote() {
  const h = S().holofote, atual = $('#ssHolofote');
  if (!h || !h.ts) { if (atual) fecharCamada(atual); return; }
  if (!appVisivel() && !CRW.TV) return;
  if (visto.get('holo', 0) === h.ts) return;
  visto.set('holo', h.ts);
  if (Date.now() - num(h.ts) < 5 * 60000) mostrarHolofote(h);
}
function acenderHolofote(pc, frase, origem) {
  if (!ehM() || !CRW.pc(pc)) return;
  Estado.definir(['holofote'], { pc, frase: String(frase || '').slice(0, 200), ts: Date.now(), origem: origem || 'mestre' });
  CRW.diario('holofote', `Holofote em ${pcNome(pc)}${frase ? ': ' + frase : ''}`);
}
// dilema: o jogador recebe e responde
const pendDil = () => ls.get('ss-dilemas:' + CRW.P.pc, []);
function mostrarDilema(e) {
  if (!e || !e.id) return;
  const ops = (Array.isArray(e.opcoes) ? e.opcoes : Object.values(e.opcoes || {})).filter(Boolean);
  const w = janela({ id: 'ssDilema-' + e.id, titulo: 'Formulário confidencial · Dilema', icone: '?', largura: '440px', fecharFora: false, classe: 'ss-dil-jan',
    html: `<div class="ss-dil"><div class="ss-dil-cab">SÓ PARA OS SEUS OLHOS · o Guardião da Luz espera a sua escolha</div>
      <p class="ss-dil-perg">${txt(e.pergunta)}</p>
      <div class="ss-dil-ops">${ops.map((o, i) => `<button class="w95-btn" data-op="${i}">${String.fromCharCode(65 + i)}. ${esc(o)}</button>`).join('')}</div>
      <p class="mini">Ninguém do Círculo vê esta escolha. Se fechar agora, ela volta na próxima vez que você entrar.</p></div>` });
  Som.pager();
  w.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-op]'); if (!b) return;
    const i = int(b.dataset.op);
    if (!(await confirmar(`Confirmar a escolha?\n\n${String.fromCharCode(65 + i)}. ${ops[i]}`))) return;
    try { await CRW.pedir('dilema', { dilema: e.id, escolha: i, texto: String(ops[i]).slice(0, 300) }).pronto; } catch (er) { return aviso('Não foi possível enviar a escolha. Tente de novo.', 'erro'); }
    ls.set('ss-dilemas:' + CRW.P.pc, pendDil().filter(x => x.id !== e.id));
    fecharJanela('ssDilema-' + e.id); aviso('Escolha enviada ao Guardião da Luz.');
  });
}
CRW.aoEntregar('dilema', e => {
  const id = e.dilema || e.id; const d = { id, pergunta: e.pergunta, opcoes: e.opcoes };
  const l = pendDil().filter(x => x.id !== id); l.push(d); ls.set('ss-dilemas:' + CRW.P.pc, l.slice(-10));
  if (appVisivel()) mostrarDilema(d);
});
CRW.aoEntregar('holofote', e => { if (e && e.pc) mostrarHolofote({ ...e, ts: e.ts || Date.now() }); });
const TIPOS_MOM = { critico: ['★', 'Crítico'], cicatriz: ['✚', 'Cicatriz'], cena: ['▣', 'Cena'] };

/* =========================================================
   35 · DISTINTIVOS (conquistas secretas)
   catálogo: segredos/distintivos/catalogo/<id> = { titulo, desc, icone }
   concedidos (cópia do Mestre): segredos/distintivos/concedidos/<pc>/<id> = { ts, data }
   do jogador: conqJog/<chave>/<id> = { titulo, desc, icone, ts }
   público: estado/distintivos = { total } (só a quantidade, para as silhuetas)
   ========================================================= */
const catalogo = () => lista(Segredos.ler(['distintivos', 'catalogo'])).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(a.ordem, 99) - num(b.ordem, 99) || String(a.titulo).localeCompare(String(b.titulo)));
const concedidos = pc => Segredos.ler(['distintivos', 'concedidos', pc]) || {};
function medalhaHtml(d, nova) {
  if (!d) return `<div class="ss-med silhueta" title="Distintivo ainda não obtido"><div class="ss-med-fita"></div><div class="ss-med-disco"><span>?</span></div><div class="ss-med-t">???</div></div>`;
  return `<div class="ss-med${nova ? ' nova' : ''}"><div class="ss-med-fita"></div><div class="ss-med-disco"><span>${esc(d.icone || '★')}</span></div><div class="ss-med-t">${esc(d.titulo)}</div>${d.desc ? `<div class="ss-med-d">${esc(d.desc)}</div>` : ''}${d.data ? `<div class="ss-med-dt">${esc(d.data)}</div>` : ''}</div>`;
}
async function concederDistintivo(pc, id, publicar) {
  const d = catalogo().find(x => x.id === id); if (!d || !CRW.pc(pc)) return false;
  const k = CRW.chaveDoPC(pc);
  if (!k) { aviso('Esse investigador ainda não abriu o site neste caso (sem ficha): não dá para entregar o distintivo.', 'erro'); return false; }
  const reg = { titulo: d.titulo, desc: d.desc || '', icone: d.icone || '★', ts: Date.now(), data: hoje() };
  try { await Rede.set(`conqJog/${k}/${id}`, reg); } catch (e) { aviso('O servidor recusou o distintivo.', 'erro'); return false; }
  Segredos.gravar(['distintivos', 'concedidos', pc, id], { ts: reg.ts, data: reg.data });
  CRW.entregar(pc, { tipo: 'distintivo', id, titulo: reg.titulo, desc: reg.desc, icone: reg.icone });
  if (publicar) Estado.definir(['honra', nid()], { pc, nome: pcNome(pc), titulo: 'Distintivo: ' + reg.titulo, data: reg.data, texto: reg.desc, tipo: 'distintivo', ts: reg.ts });
  CRW.diario('distintivo', `${pcNome(pc)} recebeu o distintivo "${reg.titulo}"`);
  return true;
}
function publicarTotalDistintivos() {
  if (!ehM() || !Segredos.pronto) return;
  const n = catalogo().length;
  if (int((S().distintivos || {}).total, -1) !== n) Estado.definir(['distintivos'], { total: n });
}
function mostrarMedalha(e) {
  const d = camada('ssMedalha', 'ss-medalha' + (RM() ? ' calmo' : ''), `<div class="ss-medalha-c"><div class="ss-medalha-cab">NOVO DISTINTIVO</div>${medalhaHtml({ titulo: e.titulo, desc: e.desc, icone: e.icone }, true)}<div class="ss-ab-dica">toque ou tecle para fechar</div></div>`);
  Sx.medalha(); fechavel(d);
}
CRW.aoEntregar('distintivo', e => { const vai = () => mostrarMedalha(e); if (appVisivel()) vai(); else { const off = CRW.on('entrou', () => { off(); vai(); }); } });

/* =========================================================
   38 · EXPOSIÇÃO (o quanto a cidade está de olho em cada investigador)
   público: estado/exposicao/<pc> = { faixa 0..4, ts }   (só a faixa vaga)
   do Mestre: segredos/exposicao/<pc> = { nivel 0..10, log:{<id>:{delta,nivel,motivo,ts,data,h}} }
   ========================================================= */
const FAIXAS = [
  { nome: 'Desconhecido', min: 0, txt: 'Ninguém na cidade parece reparar em você.' },
  { nome: 'Notado', min: 2, txt: 'Alguém, em algum lugar, já sabe o seu nome.' },
  { nome: 'Vigiado', min: 4, txt: 'Você tem a impressão de estar sendo observado.' },
  { nome: 'Marcado', min: 6, txt: 'Os olhares na rua demoram um pouco mais em você.' },
  { nome: 'Alvo', min: 8, txt: 'Um corvo pousou do lado de fora e não foi embora.' },
];
const faixaDe = nivel => { let f = 0; FAIXAS.forEach((x, i) => { if (int(nivel) >= x.min) f = i; }); return f; };
const expoSeg = pc => Segredos.ler(['exposicao', pc]) || { nivel: 0, log: {} };
const faixaPub = pc => { const x = (S().exposicao || {})[pc]; return x ? clamp(int(x.faixa), 0, 4) : 0; };
function ajustarExposicao(pc, delta, motivo) {
  const e = expoSeg(pc), antes = clamp(int(e.nivel), 0, 10), nivel = clamp(antes + int(delta), 0, 10);
  if (nivel === antes && !motivo) return;
  const r = CRW.relogio();
  Segredos.gravar(['exposicao', pc, 'nivel'], nivel);
  Segredos.gravar(['exposicao', pc, 'log', nid()], { delta: nivel - antes, nivel, motivo: String(motivo || '').slice(0, 200), ts: Date.now(), data: r.data, h: pad2(r.h) + ':' + pad2(r.m) });
  const f = faixaDe(nivel);
  if (f !== faixaPub(pc) || !(S().exposicao || {})[pc]) Estado.definir(['exposicao', pc], { faixa: f, ts: Date.now() });
  CRW.diario('exposicao', `${pcNome(pc)}: exposição ${antes} → ${nivel}${motivo ? ' (' + motivo + ')' : ''}`);
}
function aplicarExposicao() {
  const pc = CRW.P.pc; if (!pc || !appVisivel()) return;
  const f = faixaPub(pc), k = 'ss-expo:' + pc, ant = ls.get(k, null);
  if (ant === null) { ls.set(k, f); return; }
  if (f !== ant) { ls.set(k, f); if (f > ant) sinalExposicao(f); CRW.emit('exposicao', { pc, faixa: f, anterior: ant }); }
}
function sinalExposicao(f) {
  const d = el('div', 'ss-sinal' + (RM() ? ' calmo' : ''), `<span>${esc(FAIXAS[f].txt)}</span>`); d.setAttribute('role', 'status');
  document.body.appendChild(d); Sx.sinal();
  if (f >= 4) setTimeout(corvoCruza, 900);
  setTimeout(() => fecharCamada(d), 6500);
  d.addEventListener('click', () => fecharCamada(d));
}

/* =========================================================
   36 · INVESTIGADOR DA SEMANA
   estado/semana = { rodada, aberta, titulo, inicio, resultado:{pc,votos,total,ts} }
   votos/semana/<rodada>/<pc> = { voto, ts }
   ========================================================= */
function mostrarJornal(sem) {
  const r = sem.resultado; const p = CRW.pc(r.pc) || { nome: r.nome || r.pc };
  const d = camada('ssJornal', 'ss-jornal' + (RM() ? ' calmo' : ''), `<div class="ss-jornal-pg news">
    <div class="mast">Crowsrest Sentinel</div><div class="slug">EDIÇÃO EXTRA · ${esc(r.data || hoje())} · $0,25</div>
    <div class="ss-jornal-corpo">${retrato(p, 'ss-jornal-foto')}<div><div class="ss-jornal-pre">INVESTIGADOR DA SEMANA</div><h2>${esc(p.nome)}</h2>
    <p>${esc(sem.titulo || 'Votação do Círculo')} · escolhido(a) pelos colegas com ${int(r.votos)} de ${int(r.total)} voto${int(r.total) === 1 ? '' : 's'}.</p>
    <p class="mini">A placa vai para o Mural de Honra da Delegacia.</p></div></div></div><div class="ss-ab-dica">toque ou tecle para fechar</div>`);
  Sx.rotativa(); setTimeout(() => Sx.medalha(), 1000); fechavel(d);
}
function aplicarSemana() {
  const s = S().semana || {};
  if (CRW.P.pc) {
    const k = 'ss-votei:' + CRW.P.pc + ':' + (s.rodada || '');
    CRW.badge('ss-honra', s.aberta && !ls.get(k, false) ? 1 : 0);
  }
  const r = s.resultado; if (!r || !r.ts || !appVisivel()) return;
  if (visto.get('semana', 0) === r.ts) return;
  visto.set('semana', r.ts);
  if (Date.now() - num(r.ts) < 30 * 60000) mostrarJornal(s);
}

/* =========================================================
   42 · ALMOXARIFADO DO CCSO E PENHORES PULPTOWN
   estado/loja/<loja> = { fechada, itens:{<id>:{nome,desc,preco ('requisição' ou número),estoque}} }
   pedidos/loja/<id> (CRW.pedir) · entrega { tipo:'item' } e { tipo:'loja' } (recibo)
   ========================================================= */
const LOJAS = { almox: 'Almoxarifado do CCSO', penhores: 'Penhores Pulptown' };
const R = 'requisição';
// catálogo inicial (mundano, 1997); o Mestre edita no painel
const PADRAO = {
  almox: [
    ['lanterna', 'Lanterna Maglite (4 pilhas D)', 'Lanterna de alumínio de patrulha, facho regulável. Serve de cassetete numa emergência.', 6],
    ['pilhas', 'Pilhas D (caixa com 12)', 'Para lanternas e rádios.', 10],
    ['radio', 'Rádio portátil de patrulha', 'Rádio HT com bateria carregada. Alcance curto nos vales; chiado nas encostas.', 4],
    ['polaroid', 'Câmera Polaroid', 'Revelação instantânea. Boa para registrar a cena antes que mudem algo.', 2],
    ['filmepol', 'Filme instantâneo (10 poses)', 'Cartucho para a Polaroid.', 8],
    ['cam35', 'Câmera 35 mm com flash', 'Câmera de perícia. O filme vai para a revelação.', 2],
    ['filme35', 'Filme 35 mm (36 poses)', 'Rolo de filme colorido ISO 400.', 12],
    ['digitais', 'Kit de coleta de digitais', 'Pó preto e magnético, pincéis, fita de levantamento e cartões.', 3],
    ['evidencia', 'Sacos de evidência e lacres', 'Pacote com 25 sacos, etiquetas de custódia e lacres numerados.', 15],
    ['luvas', 'Luvas de látex (caixa)', 'Caixa com 100 luvas.', 10],
    ['gravador', 'Gravador cassete portátil', 'Para depoimentos e entrevistas. Acompanha microfone de lapela.', 3],
    ['fitas', 'Fitas cassete virgens (3 un.)', 'Fitas de 60 minutos.', 12],
    ['pecabra', 'Pé de cabra', 'Barra de aço de 60 cm.', 2],
    ['algemas', 'Algemas com chave', 'Par de algemas de aço.', 6],
    ['colete', 'Colete balístico', 'Colete de patrulha. Pesado e quente.', 2],
    ['binoculo', 'Binóculo 7x50', 'Binóculo de campanha.', 2],
    ['socorros', 'Kit de primeiros socorros', 'Gaze, ataduras, antisséptico, tesoura e talas.', 5],
    ['mapa', 'Mapa rodoviário do condado', 'Mapa dobrável com estradas e trilhas.', 8],
    ['capa', 'Capa de chuva amarela', 'Capa de plástico com capuz e faixa refletiva.', 6],
    ['municao', 'Munição .38 (caixa com 50)', 'Para o revólver de serviço. Assinatura do sargento no livro de cautela.', 6],
  ],
  penhores: [
    ['radiorel', 'Rádio-relógio', 'Ponteiros fosforescentes, alarme que funciona às vezes.', 8, 1],
    ['faca', 'Faca de caça com bainha', 'Lâmina de 15 cm, cabo de osso.', 18, 2],
    ['binusado', 'Binóculo usado', 'Uma lente embaçada.', 22, 1],
    ['walkman', 'Toca-fitas portátil com fone', 'Pilhas não incluídas.', 15, 2],
    ['isqueiro', 'Isqueiro de metal', 'Gravado com iniciais de outra pessoa.', 6, 3],
    ['microcass', 'Gravador de microcassete', 'Cabe no bolso do paletó.', 30, 1],
    ['chaves', 'Jogo de chaves e ferramentas', 'Maleta de ferramentas de mecânico.', 25, 1],
    ['pecabrau', 'Pé de cabra usado', 'Com marcas de uso.', 5, 2],
    ['espingarda', 'Espingarda de caça usada', 'Calibre 12, cano simples. Recibo assinado na hora.', 120, 1],
    ['alianca', 'Aliança de ouro', 'Sem gravação.', 60, 1],
    ['polusada', 'Câmera Polaroid usada', 'Funciona. Sem filme.', 25, 1],
    ['scanner', 'Rádio scanner de frequências', 'Pega a frequência da polícia e dos bombeiros, quando o tempo ajuda.', 80, 1],
    ['maquina', 'Máquina de escrever portátil', 'Falta a tecla do "ç".', 35, 1],
    ['corrente', 'Corrente com cadeado', 'Dois metros de corrente grossa.', 12, 2],
    ['lampiao', 'Lampião a querosene', 'Para quando a luz cai.', 14, 2],
  ],
};
function catalogoPadrao(loja) {
  const o = {};
  PADRAO[loja].forEach(([id, nome, desc, a, b], i) => { o[id] = loja === 'almox' ? { nome, desc, preco: R, estoque: a, ordem: i } : { nome, desc, preco: a, estoque: b, ordem: i }; });
  return o;
}
const lojaObj = l => (S().loja || {})[l] || {};
const lojaItens = l => { const it = lojaObj(l).itens; return lista(it && Object.keys(it).length ? it : catalogoPadrao(l)).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(a.ordem, 999) - num(b.ordem, 999) || String(a.nome).localeCompare(String(b.nome))); };
const precoTxt = p => p === R || p == null || p === '' ? 'requisição' : '$' + num(p).toFixed(2).replace('.', ',');
const estoqueTxt = e => e == null || e === '' ? 'à vontade' : int(e) <= 0 ? 'esgotado' : int(e) + ' em estoque';
function gravarItem(loja, id, item) {
  if (!(lojaObj(loja).itens && Object.keys(lojaObj(loja).itens).length)) {
    const cat = catalogoPadrao(loja); if (item) cat[id] = item; else delete cat[id];
    return Estado.definir(['loja', loja, 'itens'], cat);
  }
  return Estado.definir(['loja', loja, 'itens', id], item);
}
const meusPed = () => ls.get('ss-lojaPed:' + CRW.P.pc, []);
CRW.aoEntregar('loja', e => {
  const l = meusPed(); const p = l.find(x => x.id === e.pedido);
  if (p) { p.status = e.status; p.resposta = e.texto || ''; p.valor = e.valor; ls.set('ss-lojaPed:' + CRW.P.pc, l); }
  const ok = e.status === 'aprovado';
  if (appVisivel()) {
    aviso(`${LOJAS[e.loja] || 'Loja'}: pedido ${ok ? 'aprovado' : 'negado'}.`);
    janela({ id: 'ssRecibo', titulo: (e.loja === 'almox' ? 'CCSO-31 · ' : 'Penhores Pulptown · ') + (ok ? 'Recibo' : 'Devolução'), icone: '$', largura: '400px',
      html: `<div class="ss-recibo"><div class="ss-recibo-cab">${esc(LOJAS[e.loja] || 'Loja')}</div><p class="tx">${ok ? '<b>APROVADO.</b> ' : '<b>NEGADO.</b> '}${txt(e.texto)}</p>
        ${e.valor != null && e.valor !== '' ? `<p class="tx">Valor: <b>${esc(precoTxt(e.valor))}</b></p>` : ''}<p class="mini">Itens recebidos entram no equipamento da sua ficha. Dinheiro: anote na sua ficha.</p>
        <div class="msg-bts"><button class="w95-btn" data-fechar>OK</button></div></div>` });
  }
  CRW.emit('loja', e);
  const s = $('#mod-ss-lojas'); if (s && s._redesenhar) s._redesenhar();
});

/* =========================================================
   37 · MURAL DE HONRA E ARQUIVO MORTO
   estado/honra/<id> = { pc, nome, titulo, data, texto, tipo }
   estado/arquivoMorto/<id> = { nome, tipo:'investigador'|'caso'|'npc', data, epitafio, pc }
   ========================================================= */
const honraL = () => lista(S().honra).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(b.ts) - num(a.ts));
const momentosL = () => lista(S().momentos).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(b.ts) - num(a.ts));
const arquivoL = () => lista(S().arquivoMorto).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(b.ts) - num(a.ts));
const TIPOS_ARQ = { investigador: 'Investigador', caso: 'Caso encerrado', npc: 'Pessoa da cidade' };

/* =========================================================
   REAÇÃO GERAL AO ESTADO (todas as telas)
   ========================================================= */
let fatiaGeral = '';
function aplicarTudo() {
  aplicarSangria(); aplicarApagao();
  const s = S();
  const f = JSON.stringify([s.abertura, s.holofote, s.contagens, s.semana, s.exposicao]);
  if (f === fatiaGeral) return; fatiaGeral = f;
  aplicarAbertura(); aplicarHolofote(); aplicarContagens(); aplicarSemana(); aplicarExposicao();
}
CRW.on('estado', aplicarTudo);
CRW.on('entrou', () => {
  fatiaGeral = ''; sangVista = ''; aplicarTudo();
  if (CRW.P.pc) pendDil().forEach(d => mostrarDilema(d));
});
CRW.on('perfil', () => {
  limparLigacoes(); fatiaGeral = ''; ligarMestre(); setTimeout(aplicarTudo, 0);
  const o = $('#ssApagao'); if (o) o.classList.toggle('ss-mestre', !!(CRW.P.mestre && !CRW.P.espiar));
});
CRW.on('restaurado', () => { visto.set('manif', {}); visto.set('cont', {}); });
document.addEventListener('visibilitychange', () => { if (!document.hidden) aplicarApagao(); });

/* =========================================================
   VIGIAS DO MESTRE (pedidos, dilemas, críticos)
   ========================================================= */
const ped = { loja: {}, momento: {} };
let offsM = [], inicioM = 0;
function avisarNovos(tipo, obj, fmt) {
  const ja = ls.get('ss-avisados', []);
  const novos = Object.entries(obj || {}).filter(([id]) => !ja.includes(id));
  novos.forEach(([id, p]) => { CRW.alertaMestre(fmt(p), 'ss-' + tipo); ja.push(id); });
  if (novos.length) ls.set('ss-avisados', ja.slice(-300));
}
function ehCritico(x) {
  if (!x || x.secreta || x.secreto) return false;
  if (x.critico === true || x.crit === true) return true;
  if (/cr[ií]tic/i.test(String(x.resultado || x.res || x.r || ''))) return true;
  const d = Array.isArray(x.dados) ? x.dados : Array.isArray(x.d) ? x.d : null;
  return !!(d && !x.zero && d.filter(v => int(v) === 6).length >= 2);
}
function ligarMestre() {
  offsM.forEach(f => { try { f(); } catch (e) {} }); offsM = [];
  if (!CRW.P.mestre) return;
  inicioM = Date.now();
  offsM.push(Rede.on('pedidos/loja', x => {
    ped.loja = x || {};
    avisarNovos('loja', ped.loja, p => `${p.nome || 'Investigador'}: ${p.loja === 'almox' ? 'requisição no Almoxarifado' : p.op === 'vender' ? 'quer vender nos Penhores' : 'quer comprar nos Penhores'} (aba Mesa).`);
    CRW.emit('ss-pedidos');
  }, () => {}));
  offsM.push(Rede.on('pedidos/momento', x => {
    ped.momento = x || {};
    avisarNovos('momento', ped.momento, p => `${p.nome || 'Investigador'} propôs um momento marcante (aba Mesa).`);
    CRW.emit('ss-pedidos');
  }, () => {}));
  offsM.push(Rede.on('pedidos/dilema', x => {
    Object.entries(x || {}).forEach(([id, p]) => {
      if (!p || !p.dilema) { Rede.set('pedidos/dilema/' + id, null).catch(() => {}); return; }
      Segredos.gravar(['dilemas', p.dilema, 'resposta'], { i: int(p.escolha), texto: String(p.texto || ''), ts: num(p.ts, Date.now()) });
      CRW.alertaMestre(`${p.nome || pcNome(p.pc)} respondeu ao dilema: ${p.texto || ''}`, 'ss-dil-' + p.dilema);
      CRW.diario('dilema', `${p.nome || pcNome(p.pc)} escolheu: ${p.texto || ''}`);
      Rede.set('pedidos/dilema/' + id, null).catch(() => {});
    });
  }, () => {}));
  offsM.push(Rede.on('rolagens', x => {
    const feitos = ls.get('ss-crits', []); let mudou = false;
    Object.entries(x || {}).forEach(([id, r]) => {
      if (!r || num(r.ts) < inicioM - 2000 || feitos.includes(id) || !ehCritico(r)) return;
      feitos.push(id); mudou = true;
      const pc = r.pc && CRW.pc(r.pc) ? r.pc : null; if (!pc) return;
      if (ls.get('ss-holoAuto', false)) acenderHolofote(pc, r.acao ? `Crítico em ${r.acao}!` : 'Crítico!', 'critico');
      else CRW.alertaMestre(`Crítico de ${pcNome(pc)}${r.acao ? ' em ' + r.acao : ''}. Use o Holofote ou registre um momento marcante.`, 'ss-crit');
    });
    if (mudou) ls.set('ss-crits', feitos.slice(-200));
  }, () => {}));
  const offSeg = CRW.on('segredos', () => publicarTotalDistintivos()); offsM.push(offSeg);
}

/* =========================================================
   MÓDULOS DO MENU
   ========================================================= */

/* ---------- Sangria e Contagens (todos) ---------- */
function modSangria(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Sangria da Cidade · Monitor CCSO-SM</h2><div class="meta" data-meta></div></div>
    <div class="panel-b"><div class="ss-sismo"><canvas data-sismo></canvas><div class="ss-sismo-rot"><span>ESTAÇÃO 03 · VALE DO MILL</span><span data-hora></span></div></div>
    <div class="ss-medidor" data-medidor></div>
    <p class="mini">Quanto mais alto o nível, mais a cidade "sangra": a neblina engrossa, as telas falham e coisas aparecem onde não deveriam. Cada ▼ é um limiar: ao chegar nele, algo se manifesta.</p></div></div>
    <div class="panel"><div class="panel-h"><h2>Manifestações registradas</h2></div><div class="panel-b" data-manifs></div></div>
    <div class="panel"><div class="panel-h"><h2>Dados de contagem regressiva</h2><div class="meta">à vista do Círculo</div></div><div class="panel-b" data-conts></div></div>`;
  const sis = sismografo($('[data-sismo]', sec), sec);
  let ult = '';
  const desenhar = () => {
    const n = CRW.sangria(), mf = manifs(), cs = contVis();
    const f = JSON.stringify([n, marcos(), mf, cs]); if (f === ult) return; ult = f;
    $('[data-meta]', sec).textContent = `nível ${n}/10`;
    $('[data-medidor]', sec).innerHTML = medidorHtml(n);
    $('[data-manifs]', sec).innerHTML = mf.length ? `<ol class="ss-mf-lista">${mf.map(m => `<li><span class="ss-mf-n">LIMIAR ${pad2(m.n)}</span><b>${esc(m.titulo || 'Manifestação')}</b>${m.data ? ` <span class="mini">${esc(m.data)}</span>` : ''}${m.texto ? `<p class="tx">${txt(m.texto)}</p>` : ''}<button class="w95-btn" data-rever="${esc(m.k)}">Rever</button></li>`).join('')}</ol>` : '<p class="vazio95">Nada registrado. Por enquanto, a cidade está quieta.</p>';
    $('[data-conts]', sec).innerHTML = cs.length ? `<div class="ss-dados">${cs.map(c => dadoHtml(c)).join('')}</div><p class="mini">O Guardião da Luz rola estes dados. Quando um chega a zero, algo acontece.</p>` : '<p class="vazio95">Nenhum relógio à vista.</p>';
    if (RM()) sis.refazer();
  };
  desenhar();
  vivo(sec, 'estado', desenhar);
  vivo(sec, 'tick', r => { const h = $('[data-hora]', sec); if (h) h.textContent = `${r.data} ${pad2(r.h)}:${pad2(r.m)}:${pad2(r.s)}`; });
  sec.addEventListener('click', e => { const b = e.target.closest('[data-rever]'); if (b) { const m = manifs().find(x => x.k === b.dataset.rever); if (m) mostrarManifestacao(m); } });
}

/* ---------- Mural de Honra e Arquivo Morto (todos) ---------- */
function modHonra(sec) {
  let aba = ls.get('ss-abaHonra', 'mural');
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Mural de Honra da Delegacia</h2><div class="meta">CCSO · Crowsrest</div></div>
    <div class="abas95"><button class="aba95" data-aba="mural">Mural de Honra</button><button class="aba95" data-aba="arquivo">Arquivo Morto</button></div>
    <div class="panel-b"><div data-votacao></div><div data-corpo></div></div></div>`;
  let ult = '', meuVoto = null, offVoto = null, rodadaVoto = '';
  const ligarVoto = () => {
    const s = S().semana || {}, pc = CRW.v().pc;
    if (!s.aberta || !pc || CRW.v().espiando) { if (offVoto) { offVoto.off && offVoto.off(); offVoto = null; } rodadaVoto = ''; meuVoto = null; return; }
    if (rodadaVoto === s.rodada) return;
    if (offVoto && offVoto.off) offVoto.off();
    rodadaVoto = s.rodada;
    offVoto = redeViva(sec, `votos/semana/${s.rodada}/${pc}`, x => { meuVoto = x && x.voto; ls.set('ss-votei:' + pc + ':' + s.rodada, !!meuVoto); aplicarSemana(); ult = ''; desenhar(); });
  };
  const votacao = () => {
    const s = S().semana || {}, v = CRW.v();
    if (!s.aberta) {
      const r = s.resultado;
      return r ? `<div class="ss-sem-ult">${retrato(CRW.pc(r.pc) || { nome: r.nome }, 'ss-sem-foto')}<div><div class="ss-jornal-pre">INVESTIGADOR DA SEMANA</div><b>${esc(pcNome(r.pc))}</b><div class="mini">${esc(s.titulo || '')} · ${int(r.votos)} de ${int(r.total)} votos</div></div></div>` : '';
    }
    const cab = `<div class="ss-sem-cab">⚑ VOTAÇÃO ABERTA · Investigador da Semana${s.titulo ? ' · ' + esc(s.titulo) : ''}</div>`;
    if (!v.pc) return `<div class="ss-sem">${cab}<p class="mini">Só os investigadores votam. O Guardião da Luz acompanha a contagem no painel (aba Mesa).</p></div>`;
    if (v.espiando) return `<div class="ss-sem">${cab}<p class="mini">Visão do Mestre: o voto é só do jogador.</p></div>`;
    const outros = CRW.pcs().filter(p => p.id !== v.pc);
    return `<div class="ss-sem">${cab}<p class="mini">Voto secreto: ninguém vê em quem você votou. Não dá para votar em si. Pode trocar até o Mestre encerrar.</p>
      <div class="ss-sem-ops">${outros.map(p => `<button class="ss-sem-op${meuVoto === p.id ? ' on' : ''}" data-voto="${esc(p.id)}">${retrato(p)}<span>${esc(p.nome)}</span>${meuVoto === p.id ? '<em>SEU VOTO</em>' : ''}</button>`).join('') || '<p class="vazio95">Não há outros investigadores para votar.</p>'}</div></div>`;
  };
  const placa = h => `<div class="ss-placa ss-placa-${esc(h.tipo || 'honra')}">${retrato(CRW.pc(h.pc) || { nome: h.nome || h.titulo }, 'ss-placa-foto')}<div class="ss-placa-txt"><div class="ss-placa-tit">${esc(h.titulo || '')}</div><div class="ss-placa-nome">${esc(h.pc ? pcNome(h.pc) : (h.nome || ''))}</div>${h.texto ? `<div class="ss-placa-t">${txt(h.texto)}</div>` : ''}<div class="ss-placa-dt">${esc(h.data || '')}</div></div></div>`;
  const desenhar = () => {
    ligarVoto();
    const f = JSON.stringify([aba, S().semana, S().honra, S().momentos, S().arquivoMorto, meuVoto, CRW.pcs().map(p => [p.id, p.nome, !!p.foto])]);
    if (f === ult) return; ult = f;
    $$('.aba95', sec).forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
    $('[data-votacao]', sec).innerHTML = votacao();
    const c = $('[data-corpo]', sec);
    if (aba === 'mural') {
      const hs = honraL(), ms = momentosL(), v = CRW.v();
      c.innerHTML = `<h3 class="ss-h3">Placas</h3>${hs.length ? `<div class="ss-placas">${hs.map(placa).join('')}</div>` : '<p class="vazio95">Nenhuma placa ainda. Vencedores do Investigador da Semana, distintivos e feitos entram aqui.</p>'}
        <h3 class="ss-h3">Momentos marcantes</h3>${ms.length ? `<ul class="ss-moms">${ms.map(m => `<li class="ss-mom-${esc(m.tipo || 'cena')}"><span class="ss-mom-i" title="${esc((TIPOS_MOM[m.tipo] || TIPOS_MOM.cena)[1])}">${(TIPOS_MOM[m.tipo] || TIPOS_MOM.cena)[0]}</span><div><b>${esc(m.titulo || '')}</b> <span class="mini">${esc(m.pc ? pcNome(m.pc) : '')}${m.data ? ' · ' + esc(m.data) : ''}</span>${m.texto ? `<p class="tx">${txt(m.texto)}</p>` : ''}</div></li>`).join('')}</ul>` : '<p class="vazio95">Nenhum momento registrado.</p>'}
        ${v.pc && !v.espiando ? '<div class="linha95"><button class="w95-btn" data-propor>Propor um momento marcante</button></div>' : ''}`;
    } else {
      const as = arquivoL();
      c.innerHTML = as.length ? `<div class="ss-arqs">${as.map(a => `<div class="ss-arq ss-arq-${esc(a.tipo || 'caso')}"><div class="ss-arq-carimbo">ARQUIVADO</div>${a.tipo === 'caso' ? '<span class="ss-3x4 ss-3x4-vazio ss-arq-pasta"><b>▤</b></span>' : retrato(CRW.pc(a.pc) || { nome: a.nome }, 'ss-arq-foto')}
        <div class="ss-arq-txt"><div class="ss-arq-tipo">${esc(TIPOS_ARQ[a.tipo] || 'Registro')}</div><div class="ss-arq-nome">${esc(a.nome || '')}</div><div class="ss-arq-dt">${esc(a.data || '')}</div>${a.epitafio ? `<div class="ss-arq-ep">${txt(a.epitafio)}</div>` : ''}</div></div>`).join('')}</div>` : '<p class="vazio95">O Arquivo Morto está vazio. Que continue assim.</p>';
    }
  };
  desenhar();
  vivo(sec, 'estado', desenhar);
  sec.addEventListener('click', async e => {
    const a = e.target.closest('[data-aba]'); if (a) { aba = a.dataset.aba; ls.set('ss-abaHonra', aba); desenhar(); return; }
    const vb = e.target.closest('[data-voto]');
    if (vb) {
      const s = S().semana || {}, pc = CRW.P.pc; if (!s.aberta || !pc || vb.dataset.voto === pc) return;
      try { await Rede.set(`votos/semana/${s.rodada}/${pc}`, { voto: vb.dataset.voto, ts: Date.now() }); meuVoto = vb.dataset.voto; ls.set('ss-votei:' + pc + ':' + s.rodada, true); Som.clique(); aviso('Voto registrado. Só o Guardião da Luz vê a contagem.'); aplicarSemana(); ult = ''; desenhar(); }
      catch (er) { aviso('O voto não foi aceito.', 'erro'); }
      return;
    }
    if (e.target.closest('[data-propor]')) proporMomento();
  });
}
function proporMomento() {
  const w = janela({ id: 'ssPropor', titulo: 'Propor momento marcante', largura: '440px', html: `<p class="mini">O Guardião da Luz lê a proposta e decide se ela entra no Mural de Honra.</p>
    <label class="campo">Quem<select class="w95-input" data-f="pc">${opcoesPCs(CRW.P.pc)}</select></label>
    <label class="campo">Tipo<select class="w95-input" data-f="tipo"><option value="cena">Cena memorável</option><option value="critico">Crítico</option><option value="cicatriz">Cicatriz</option></select></label>
    <label class="campo">Título<input class="w95-input" data-f="titulo" maxlength="80" placeholder="ex.: A porta do necrotério"></label>
    <label class="campo">O que aconteceu<textarea class="w95-input" data-f="texto" rows="4" maxlength="600"></textarea></label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Enviar ao Mestre</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', async () => {
    const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
    if (!g('titulo')) return aviso('Dê um título ao momento.', 'erro');
    try { await CRW.pedir('momento', { alvo: g('pc'), tipo: g('tipo'), titulo: g('titulo').slice(0, 80), texto: g('texto').slice(0, 600) }).pronto; } catch (er) { return aviso('Não foi possível enviar.', 'erro'); }
    fecharJanela('ssPropor'); aviso('Proposta enviada ao Guardião da Luz.');
  });
}

/* ---------- Meus distintivos (jogador) ---------- */
function modDistintivos(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Meus distintivos</h2><div class="meta" data-meta></div></div><div class="panel-b">
    <p class="mini">Conquistas secretas da delegacia. O Guardião da Luz entrega quando você faz por merecer; as que faltam aparecem como silhueta.</p><div class="ss-meds" data-meds></div></div></div>`;
  let meus = {};
  const desenhar = () => {
    const total = int((S().distintivos || {}).total, 0);
    const l = lista(meus).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(a.ts) - num(b.ts));
    const falta = Math.max(0, total - l.length);
    $('[data-meta]', sec).textContent = total ? `${l.length} de ${total}` : `${l.length}`;
    $('[data-meds]', sec).innerHTML = l.map(d => medalhaHtml(d)).join('') + Array.from({ length: falta }, () => medalhaHtml(null)).join('') || '<p class="vazio95">Nenhum distintivo por enquanto.</p>';
  };
  const v = CRW.v();
  if (v.espiando) {
    const doMestre = () => { const cat = catalogo(); meus = {}; Object.entries(concedidos(v.pc)).forEach(([id, x]) => { const d = cat.find(c => c.id === id); if (d) meus[id] = { ...d, ...x }; }); desenhar(); };
    doMestre(); vivo(sec, 'segredos', doMestre);
  } else if (CRW.P.pc) {
    redeViva(sec, 'conqJog/' + CRW.minhaChave(), x => { meus = x || {}; desenhar(); });
  }
  desenhar(); vivo(sec, 'estado', desenhar);
}

/* ---------- Minha exposição (jogador) ---------- */
function modExposicao(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Exposição</h2><div class="meta">o quanto você chamou atenção</div></div><div class="panel-b" data-c></div></div>`;
  let ult = -1;
  const desenhar = () => {
    const f = faixaPub(CRW.v().pc); if (f === ult) return; ult = f;
    $('[data-c]', sec).innerHTML = `<div class="ss-expo">${FAIXAS.map((x, i) => `<div class="ss-expo-f f${i}${i === f ? ' on' : ''}${i < f ? ' passou' : ''}"><span>${esc(x.nome)}</span></div>`).join('')}</div>
      <p class="ss-expo-txt">${esc(FAIXAS[f].txt)}</p>
      <p class="mini">Perguntas demais, portas arrombadas, nomes ditos em voz alta: tudo o que chama atenção faz esta faixa subir. Ninguém além de você e do Guardião da Luz vê a sua.</p>`;
  };
  desenhar(); vivo(sec, 'estado', desenhar);
}

/* ---------- Almoxarifado e Penhores (todos; só jogador pede) ---------- */
function modLojas(sec) {
  let aba = ls.get('ss-abaLoja', 'almox');
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Almoxarifado e Penhores</h2><div class="meta" data-meta></div></div>
    <div class="abas95"><button class="aba95" data-aba="almox">Almoxarifado CCSO</button><button class="aba95" data-aba="penhores">Penhores Pulptown</button><button class="aba95" data-aba="meus">Meus pedidos</button></div>
    <div class="panel-b" data-c></div></div>`;
  const podePedir = () => !!CRW.P.pc && !CRW.v().espiando;
  const desenhar = () => {
    $$('.aba95', sec).forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
    const c = $('[data-c]', sec);
    const aviso95 = podePedir() ? '' : `<p class="mini ss-so-ver">${CRW.P.mestre || CRW.P.aux ? 'Visão do Mestre: só leitura. Os pedidos chegam no painel (aba Mesa).' : 'Entre como investigador para fazer pedidos.'}</p>`;
    if (aba === 'almox') {
      const it = lojaItens('almox'), fech = lojaObj('almox').fechada;
      $('[data-meta]', sec).textContent = 'Formulário CCSO-31';
      c.innerHTML = `${aviso95}<div class="ss-form31"><div class="ss-form31-cab"><b>DEPARTAMENTO DO XERIFE DO CONDADO DE CROWSREST</b><br>Formulário CCSO-31 · Requisição de Material de Almoxarifado</div>
        ${fech ? '<p class="alert-box"><b>ALMOXARIFADO FECHADO.</b> Volte mais tarde.</p>' : ''}
        <table class="dtable ss-itens"><thead><tr><th>Item</th><th class="ss-q">Qtd.</th></tr></thead><tbody>
        ${it.map(x => { const esg = x.estoque != null && x.estoque !== '' && int(x.estoque) <= 0; return `<tr${esg ? ' class="ss-esg"' : ''}><td><b>${esc(x.nome)}</b><div class="mini">${esc(x.desc || '')} · ${esc(estoqueTxt(x.estoque))}</div></td>
          <td class="ss-q"><input class="w95-input" type="number" min="0" max="${x.estoque != null && x.estoque !== '' ? int(x.estoque) : 9}" value="0" inputmode="numeric" data-q="${esc(x.id)}" ${esg || fech || !podePedir() ? 'disabled' : ''} aria-label="Quantidade de ${esc(x.nome)}"></td></tr>`; }).join('')}
        </tbody></table>
        <label class="campo">Justificativa (diligência, local, caso)<textarea class="w95-input" rows="3" data-just maxlength="400" ${fech || !podePedir() ? 'disabled' : ''}></textarea></label>
        <div class="ss-form31-ass"><span>Requisitante: <b>${esc(CRW.P.pc ? pcNome(CRW.P.pc) : '________')}</b></span><span>Data: ${esc(hoje())}</span></div>
        <div class="linha95"><button class="w95-btn pri" data-req ${fech || !podePedir() ? 'disabled' : ''}>Assinar e enviar requisição</button></div></div>`;
    } else if (aba === 'penhores') {
      const it = lojaItens('penhores'), fech = lojaObj('penhores').fechada, l = (typeof LOTES !== 'undefined' ? LOTES : []).find(x => x.id === 'penhores');
      const r = CRW.relogio(), hor = l && l.horario, aberto = !hor || (r.h >= hor[0] && r.h < hor[1]);
      $('[data-meta]', sec).textContent = l ? l.end : 'Rua Pulp';
      c.innerHTML = `${aviso95}<div class="ss-penh-cab"><b>PENHORES PULPTOWN</b><span>compra · venda · troca · ninguém pergunta</span></div>
        ${fech ? '<p class="alert-box"><b>FECHADO.</b> Grade abaixada.</p>' : hor && !aberto ? `<p class="mini">Pelo relógio do jogo a loja abre das ${hor[0]}h às ${hor[1]}h. O Guardião da Luz decide se alguém atende fora de hora.</p>` : ''}
        <div class="ss-vitrine">${it.map(x => { const esg = x.estoque != null && x.estoque !== '' && int(x.estoque) <= 0; return `<div class="ss-etiq${esg ? ' ss-esg' : ''}"><div class="ss-etiq-p">${esc(precoTxt(x.preco))}</div><b>${esc(x.nome)}</b><div class="mini">${esc(x.desc || '')}</div><div class="mini">${esc(estoqueTxt(x.estoque))}</div>
          <button class="w95-btn" data-comprar="${esc(x.id)}" ${esg || fech || !podePedir() ? 'disabled' : ''}>Fazer oferta</button></div>`; }).join('')}</div>
        <div class="linha95"><button class="w95-btn" data-vender ${fech || !podePedir() ? 'disabled' : ''}>Vender ou penhorar algo</button></div>`;
    } else {
      const l = podePedir() ? meusPed().slice().reverse() : [];
      $('[data-meta]', sec).textContent = l.length + ' pedido(s)';
      c.innerHTML = `${aviso95}${l.length ? `<table class="dtable"><thead><tr><th>Pedido</th><th>Situação</th></tr></thead><tbody>${l.map(p => `<tr><td><b>${esc(p.resumo)}</b><div class="mini">${esc(LOJAS[p.loja] || '')} · ${esc(p.data || '')}</div>${p.resposta ? `<div class="mini">${esc(p.resposta)}</div>` : ''}</td><td><span class="etq ${p.status === 'aprovado' ? 'verde' : p.status === 'negado' ? 'verm' : 'ambar'}">${esc(p.status || 'aguardando')}</span></td></tr>`).join('')}</tbody></table>` : '<p class="vazio95">Nenhum pedido feito neste aparelho.</p>'}`;
    }
  };
  sec._redesenhar = desenhar;
  let ultLoja = '';
  desenhar();
  vivo(sec, 'estado', s => { const f = JSON.stringify(s.loja || null); if (f !== ultLoja) { ultLoja = f; if (semFoco(sec)) desenhar(); } });
  const registrar = (id, loja, resumo) => { const l = meusPed(); l.push({ id, loja, resumo, data: hoje() + ' ' + horaJogo(), status: 'aguardando' }); ls.set('ss-lojaPed:' + CRW.P.pc, l.slice(-60)); };
  sec.addEventListener('click', async e => {
    const a = e.target.closest('[data-aba]'); if (a) { aba = a.dataset.aba; ls.set('ss-abaLoja', aba); desenhar(); return; }
    if (!podePedir()) return;
    if (e.target.closest('[data-req]')) {
      const itens = $$('[data-q]', sec).map(i => ({ id: i.dataset.q, qtd: clamp(int(i.value), 0, 99) })).filter(x => x.qtd > 0)
        .map(x => ({ ...x, nome: (lojaItens('almox').find(y => y.id === x.id) || {}).nome || x.id }));
      if (!itens.length) return aviso('Marque a quantidade de pelo menos um item.', 'erro');
      const just = ($('[data-just]', sec).value || '').trim();
      if (!just) return aviso('Preencha a justificativa: o sargento não assina requisição em branco.', 'erro');
      try { const p = CRW.pedir('loja', { loja: 'almox', itens, justificativa: just.slice(0, 400) }); await p.pronto; registrar(p.key, 'almox', itens.map(x => x.qtd + 'x ' + x.nome).join(', ')); }
      catch (er) { return aviso('A requisição não foi enviada.', 'erro'); }
      Sx.carimbo(); aviso('Requisição CCSO-31 enviada. Aguarde a aprovação.'); aba = 'meus'; desenhar(); return;
    }
    const cb = e.target.closest('[data-comprar]');
    if (cb) {
      const x = lojaItens('penhores').find(y => y.id === cb.dataset.comprar); if (!x) return;
      const v = await pedirTexto(`Sua oferta por "${x.nome}" (etiqueta: ${precoTxt(x.preco)})`, String(num(x.preco)), { titulo: 'Penhores Pulptown', tipo: 'number' });
      if (v === null) return;
      const oferta = Math.max(0, num(String(v).replace(',', '.')));
      try { const p = CRW.pedir('loja', { loja: 'penhores', op: 'comprar', item: { id: x.id, nome: x.nome }, oferta }); await p.pronto; registrar(p.key, 'penhores', `Comprar ${x.nome} por ${precoTxt(oferta)}`); }
      catch (er) { return aviso('A oferta não foi enviada.', 'erro'); }
      aviso('Oferta feita. O penhorista vai pensar.'); return;
    }
    if (e.target.closest('[data-vender]')) {
      const w = janela({ id: 'ssVender', titulo: 'Penhores Pulptown · Vender ou penhorar', icone: '$', largura: '420px', html: `
        <label class="campo">O que você quer vender<input class="w95-input" data-f="nome" maxlength="80"></label>
        <label class="campo">Descrição (estado, de onde veio)<textarea class="w95-input" rows="3" data-f="desc" maxlength="300"></textarea></label>
        <label class="campo">Quanto você pede ($)<input class="w95-input" type="number" min="0" data-f="preco" inputmode="decimal"></label>
        <p class="mini">Se o Mestre aprovar, tire o item do equipamento da sua ficha e anote o dinheiro.</p>
        <div class="msg-bts"><button class="w95-btn pri" data-ok>Oferecer</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
      $('[data-ok]', w).addEventListener('click', async () => {
        const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
        if (!g('nome')) return aviso('Diga o que você quer vender.', 'erro');
        const pedida = Math.max(0, num(g('preco').replace(',', '.')));
        try { const p = CRW.pedir('loja', { loja: 'penhores', op: 'vender', item: { nome: g('nome').slice(0, 80), desc: g('desc').slice(0, 300) }, pedida }); await p.pronto; registrar(p.key, 'penhores', `Vender ${g('nome')} por ${precoTxt(pedida)}`); }
        catch (er) { return aviso('A oferta não foi enviada.', 'erro'); }
        fecharJanela('ssVender'); aviso('Oferta de venda enviada.');
      });
    }
  });
}

/* =========================================================
   PAINEL DO MESTRE · aba Sessão
   ========================================================= */
function blocoSangria(c) {
  const abertos = new Set();
  const cardLimiar = (l, m) => `<details class="ss-lim${m ? ' lib' : ''}" data-n="${l.n}" ${abertos.has(l.n) ? 'open' : ''}><summary><span class="ss-mf-n">LIMIAR ${pad2(l.n)}</span> ${esc(l.titulo || '(sem título)')} ${m ? '<span class="etq verm">liberada</span>' : CRW.sangria() >= l.n ? '<span class="etq ambar">pronta</span>' : ''}</summary>
    <div class="ss-lim-c"><div class="grade2"><label class="campo">Limiar (nível 1 a 10)<input class="w95-input" type="number" min="1" max="10" data-l="n" value="${l.n}"></label>
    <label class="campo">Efeito na tela de todos<select class="w95-input" data-l="efeito">${EFEITOS.map(([k, t]) => `<option value="${k}"${(l.efeito || 'corvo') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <label class="campo">Título (os jogadores veem)<input class="w95-input" data-l="titulo" value="${esc(l.titulo || '')}" maxlength="80"></label>
    <label class="campo">Texto da manifestação (os jogadores veem; vazio = só o efeito)<textarea class="w95-input" rows="3" data-l="texto" maxlength="800">${esc(l.texto || '')}</textarea></label>
    <label class="campo">Nota do Guardião (só você vê)<textarea class="w95-input" rows="2" data-l="nota" maxlength="800">${esc(l.nota || '')}</textarea></label>
    <div class="linha95"><button class="w95-btn" data-lsalvar>Salvar</button>${m ? '<button class="w95-btn" data-lrecolher>Recolher (tirar da lista dos jogadores)</button>' : '<button class="w95-btn pri" data-lliberar>Liberar agora</button>'}<button class="w95-btn" data-lteste>Ver o efeito aqui</button><button class="w95-btn perigo" data-lapagar>Apagar</button></div></div></details>`;
  let ult = '';
  const desenhar = (forcar) => {
    const n = CRW.sangria(), lim = limiaresSeg(), mf = sangriaObj().manif || {};
    const f = JSON.stringify([n, lim, Object.keys(mf)]); if (!forcar && f === ult) return; ult = f;
    c.innerHTML = `<p class="mini">O nível vale para a cidade inteira e todos veem (canto da barra de status e o módulo "Sangria e Contagens"). Cada limiar libera a manifestação que você preparou.</p>
      <div class="ss-mlinha"><button class="w95-btn" data-sg="-1">▼ Baixar</button><span class="ss-mnum">${pad2(n)}</span><button class="w95-btn" data-sg="1">▲ Subir</button></div>
      <input type="range" min="0" max="10" step="1" value="${n}" data-sgr class="ss-range" aria-label="Nível da Sangria">
      <label class="chk95"><input type="checkbox" data-autolib ${ls.get('ss-autoLib', false) ? 'checked' : ''}> Ao cruzar um limiar subindo, liberar a manifestação sem perguntar</label>
      <h4 class="ss-h4">Limiares e manifestações</h4>
      ${lim.map(l => cardLimiar(l, mf[chaveL(l.n)])).join('') || '<p class="vazio95">Nenhum limiar preparado. Importe as sementes (aba Segredos) ou crie um novo.</p>'}
      <div class="linha95"><button class="w95-btn" data-lnovo>+ Novo limiar</button><button class="w95-btn" data-teste-amb>Testar efeitos ambientes</button></div>
      <p class="mini">Efeitos automáticos por nível: granulação a partir de 1; corvo cruzando a tela a partir de 2; falhas de vídeo a partir de 5; texto que treme a partir de 7; vinheta escura a partir de 8. Quem pede movimento reduzido no aparelho vê versões paradas.</p>`;
  };
  desenhar(true);
  vivo(c, 'estado', () => { if (semFoco(c)) desenhar(); });
  vivo(c, 'segredos', () => { if (semFoco(c)) desenhar(); });
  c.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('details.ss-lim'); if (d) { if (d.open) abertos.add(int(d.dataset.n)); else abertos.delete(int(d.dataset.n)); } }, true);
  const lerCard = d => { const g = k => ($(`[data-l="${k}"]`, d) || {}).value || ''; return { n: clamp(int(g('n')), 1, 10), titulo: g('titulo').trim(), texto: g('texto').trim(), efeito: g('efeito'), nota: g('nota').trim() }; };
  const salvarMarcos = () => setTimeout(() => { const l = limiaresSeg().map(x => x.n); Estado.definir(['sangria', 'marcos'], l.length ? l : MARCOS_PADRAO); }, 60);
  const liberar = n => {
    const l = limiaresSeg().find(x => x.n === n); if (!l) return;
    const ts = Date.now();
    Estado.definir(['sangria', 'manif', chaveL(n)], { n, titulo: l.titulo || '', texto: l.texto || '', efeito: l.efeito || 'corvo', ts, data: hoje() });
    Estado.definir(['sangria', 'liberados', chaveL(n)], ts);
    CRW.diario('sangria', `Manifestação liberada (limiar ${n}): ${l.titulo || ''}`);
    aviso(`Manifestação do limiar ${n} liberada para todas as telas.`);
  };
  const definirNivel = async n => {
    const ant = CRW.sangria(); n = clamp(int(n), 0, 10); if (n === ant) return;
    const o = copia(sangriaObj()) || {}; o.nivel = n; o.ts = Date.now();
    if (!o.marcos) { const l = limiaresSeg().map(x => x.n); o.marcos = l.length ? l : MARCOS_PADRAO; }
    Estado.definir(['sangria'], o);
    CRW.diario('sangria', `Sangria da cidade: ${ant} → ${n}`);
    if (n > ant) {
      const mf = o.manif || {};
      const cruz = limiaresSeg().filter(l => l.n > ant && l.n <= n && !mf[chaveL(l.n)]);
      for (const l of cruz) {
        if (ls.get('ss-autoLib', false) || await confirmar(`A Sangria chegou ao limiar ${l.n}.\n\nLiberar agora a manifestação "${l.titulo || 'sem título'}" para todas as telas?`, { ok: 'Liberar', cancelar: 'Depois' })) liberar(l.n);
      }
    }
  };
  c.addEventListener('change', e => {
    if (e.target.matches('[data-sgr]')) definirNivel(e.target.value);
    if (e.target.matches('[data-autolib]')) ls.set('ss-autoLib', e.target.checked);
  });
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.sg) return definirNivel(CRW.sangria() + int(b.dataset.sg));
    if (b.hasAttribute('data-teste-amb')) { ['corvo', 'falha', 'treme'].forEach((t, i) => setTimeout(() => efeito(t), i * 1800)); return; }
    if (b.hasAttribute('data-lnovo')) {
      const usados = limiaresSeg().map(x => x.n); const n = [2, 4, 6, 8, 10, 1, 3, 5, 7, 9].find(x => !usados.includes(x));
      if (!n) return aviso('Todos os 10 níveis já têm limiar.', 'erro');
      abertos.add(n); await Segredos.gravar(['sangria', 'limiares', chaveL(n)], { n, titulo: '', texto: '', efeito: 'corvo', nota: '' }); salvarMarcos(); desenhar(true); return;
    }
    const d = b.closest('details.ss-lim'); if (!d) return;
    const n0 = int(d.dataset.n), l = limiaresSeg().find(x => x.n === n0) || {};
    if (b.hasAttribute('data-lsalvar')) {
      const x = lerCard(d);
      if (x.n !== n0 && limiaresSeg().some(y => y.n === x.n)) return aviso('Já existe um limiar nesse nível.', 'erro');
      if (x.n !== n0) await Segredos.gravar(['sangria', 'limiares', l.k || chaveL(n0)], null);
      abertos.delete(n0); abertos.add(x.n);
      await Segredos.gravar(['sangria', 'limiares', x.n !== n0 ? chaveL(x.n) : (l.k || chaveL(x.n))], x);
      salvarMarcos(); aviso('Limiar salvo.'); desenhar(true);
    }
    if (b.hasAttribute('data-lliberar')) { const x = lerCard(d); await Segredos.gravar(['sangria', 'limiares', l.k || chaveL(n0)], { ...x, n: n0 }); liberar(n0); }
    if (b.hasAttribute('data-lrecolher')) { Estado.definir(['sangria', 'manif', chaveL(n0)], null); Estado.definir(['sangria', 'liberados', chaveL(n0)], null); CRW.diario('sangria', 'Manifestação recolhida: limiar ' + n0); }
    if (b.hasAttribute('data-lteste')) { const x = lerCard(d); mostrarManifestacao({ ...x, n: n0, ts: Date.now() }); }
    if (b.hasAttribute('data-lapagar')) { if (await confirmar(`Apagar o limiar ${n0}?`)) { await Segredos.gravar(['sangria', 'limiares', l.k || chaveL(n0)], null); salvarMarcos(); desenhar(true); } }
  });
}

function blocoContagens(c) {
  let ult = '';
  const desenhar = forcar => {
    const l = contTodas(); const f = JSON.stringify(l); if (!forcar && f === ult) return; ult = f;
    c.innerHTML = `<p class="mini">Relógios do Guardião. <b>Visíveis</b> aparecem para todos como um dado grande; <b>secretos</b> só aqui. Ao zerar, o site avisa (todos, se visível; só você, se secreto).</p>
      ${l.length ? `<div class="ss-mconts">${l.map(x => `<div class="ss-mcont${int(x.valor) <= 0 ? ' zero' : ''}" data-id="${esc(x.id)}">${dadoHtml(x)}
        <div class="ss-mcont-c"><span class="etq ${x.visivel ? 'azul' : ''}">${x.visivel ? 'visível' : 'secreto'}</span> <span class="mini">${esc(REGRAS[x.regra || 'um'] || '')}</span>
        <div class="linha95"><button class="w95-btn pri" data-rolar>Rolar ${esc(x.dado)}</button><button class="w95-btn" data-mais="-1" aria-label="Diminuir">−1</button><button class="w95-btn" data-mais="1" aria-label="Aumentar">+1</button></div>
        <div class="linha95"><button class="w95-btn" data-vis>${x.visivel ? 'Esconder' : 'Mostrar a todos'}</button><button class="w95-btn" data-ed>Editar</button><button class="w95-btn perigo" data-del>Apagar</button></div></div></div>`).join('')}</div>` : '<p class="vazio95">Nenhum relógio. Crie um a partir de um modelo ou do zero.</p>'}
      <div class="linha95"><select class="w95-input" data-mod><option value="">Novo relógio do zero</option>${MODELOS_L().map((m, i) => `<option value="${i}">Modelo: ${esc(m.nome)} (${m.dado})</option>`).join('')}</select><button class="w95-btn" data-novo>Criar</button></div>
      <p class="mini">Regra de descida: escolha no Editar. A regra padrão do site é "desce 1 quando sai 1"; confira no livro de Candela Obscura a regra exata dos dados de contagem regressiva e use a que for a da sua mesa.</p>`;
  };
  desenhar(true);
  vivo(c, 'estado', () => desenhar()); vivo(c, 'segredos', () => desenhar());
  const editar = x => {
    const w = janela({ id: 'ssContEd', titulo: x.id ? 'Editar relógio' : 'Novo relógio', largura: '420px', html: `
      <label class="campo">Nome<input class="w95-input" data-f="nome" value="${esc(x.nome || '')}" maxlength="60"></label>
      <div class="grade2"><label class="campo">Dado<select class="w95-input" data-f="dado">${DADOS.map(d => `<option${d === x.dado ? ' selected' : ''}>${d}</option>`).join('')}</select></label>
      <label class="campo">Valor atual<input class="w95-input" type="number" min="0" max="100" data-f="valor" value="${int(x.valor)}"></label></div>
      <label class="campo">Regra de descida<select class="w95-input" data-f="regra">${Object.entries(REGRAS).map(([k, t]) => `<option value="${k}"${(x.regra || 'um') === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
      <label class="chk95"><input type="checkbox" data-f="visivel" ${x.visivel ? 'checked' : ''}> Visível para todos</label>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    $('[data-f="dado"]', w).addEventListener('change', e => { if (!x.id) $('[data-f="valor"]', w).value = lados(e.target.value); });
    $('[data-ok]', w).addEventListener('click', () => {
      const g = k => $(`[data-f="${k}"]`, w);
      const nome = g('nome').value.trim(); if (!nome) return aviso('Dê um nome ao relógio.', 'erro');
      const novo = { ...x, id: x.id || nid(), nome, dado: g('dado').value, valor: clamp(int(g('valor').value), 0, 100), regra: g('regra').value, visivel: g('visivel').checked };
      if (int(novo.valor) > 0) novo.zerou = null;
      gravarCont(novo); CRW.diario('contagem', `${x.id ? 'Relógio editado' : 'Relógio criado'}: ${nome} (${novo.visivel ? 'visível' : 'secreto'})`);
      fecharJanela('ssContEd');
    });
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-novo')) { const m = MODELOS_L()[$('[data-mod]', c).value]; editar({ nome: m ? m.nome : '', dado: m ? m.dado : 'd6', valor: lados(m ? m.dado : 'd6'), regra: 'um', visivel: false }); return; }
    const card = b.closest('[data-id]'); if (!card) return;
    const x = contTodas().find(y => y.id === card.dataset.id); if (!x) return;
    if (b.hasAttribute('data-rolar')) { const r = rolarCont(x); aviso(`${x.nome}: saiu ${r}.`); }
    if (b.dataset.mais) { const v = clamp(int(x.valor) + int(b.dataset.mais), 0, 100); const n = { ...x, valor: v }; if (v === 0 && int(x.valor) > 0) { n.zerou = Date.now(); CRW.alertaMestre('Contagem zerada: ' + x.nome, 'ss-cont-' + x.id); } if (v > 0) n.zerou = null; gravarCont(n); }
    if (b.hasAttribute('data-vis')) gravarCont({ ...x, visivel: !x.visivel });
    if (b.hasAttribute('data-ed')) editar(x);
    if (b.hasAttribute('data-del') && await confirmar(`Apagar o relógio "${x.nome}"?`)) { if (x.visivel) Estado.definir(['contagens', x.id], null); else Segredos.gravar(['contagens', x.id], null); }
  });
}

function blocoAbertura(c) {
  const r = ls.get('ss-rascAb', {});
  c.innerHTML = `<p class="mini">Dispara uma abertura ou encerramento na tela de todos (cada um fecha tocando na tela ou numa tecla). Escreva, veja aqui antes e depois envie.</p>
    <label class="campo">Tipo<select class="w95-input" data-f="tipo">${Object.entries(ABERTURAS).map(([k, t]) => `<option value="${k}"${(r.tipo || 'vhs') === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select></label>
    <label class="campo">Título<input class="w95-input" data-f="titulo" maxlength="80" value="${esc(r.titulo || '')}" placeholder="vazio = padrão do tipo (Anteriormente…, continua...)"></label>
    <label class="campo" data-so="vhs bios encerramento telejornal">Texto (no VHS: o resumo da sessão anterior)<textarea class="w95-input" rows="5" data-f="texto" maxlength="2000">${esc(r.texto || '')}</textarea></label>
    <label class="campo" data-so="telejornal">Manchete (faixa de baixo)<input class="w95-input" data-f="manchete" maxlength="100" value="${esc(r.manchete || '')}"></label>
    <label class="campo" data-so="telejornal">Letreiro rolando<input class="w95-input" data-f="letreiro" maxlength="300" value="${esc(r.letreiro || '')}"></label>
    <div class="linha95"><button class="w95-btn" data-ver>Ver só aqui</button><button class="w95-btn pri" data-enviar>Enviar para todas as telas</button><button class="w95-btn" data-tirar>Tirar das telas</button></div>
    <p class="mini" data-st></p>`;
  const ler = () => { const o = {}; ['tipo', 'titulo', 'texto', 'manchete', 'letreiro'].forEach(k => { o[k] = ($(`[data-f="${k}"]`, c).value || '').trim(); }); return o; };
  const mostrar = () => { const t = $('[data-f="tipo"]', c).value; $$('[data-so]', c).forEach(x => { x.hidden = !x.dataset.so.split(' ').includes(t); }); };
  const st = () => { const a = S().abertura; $('[data-st]', c).textContent = a && a.ts ? `No ar: ${ABERTURAS[a.tipo] || a.tipo}, enviada às ${new Date(a.ts).toLocaleTimeString('pt-BR').slice(0, 5)} (hora real).` : 'Nada no ar.'; };
  mostrar(); st(); vivo(c, 'estado', st);
  c.addEventListener('input', () => ls.set('ss-rascAb', ler()));
  c.addEventListener('change', e => { if (e.target.matches('[data-f="tipo"]')) mostrar(); ls.set('ss-rascAb', ler()); });
  c.addEventListener('click', e => {
    if (e.target.closest('[data-ver]')) mostrarAbertura({ ...ler(), ts: Date.now() }, true);
    if (e.target.closest('[data-enviar]')) { const o = { ...ler(), ts: Date.now() }; Estado.definir(['abertura'], o); CRW.diario('abertura', `${ABERTURAS[o.tipo]} enviada${o.titulo ? ': ' + o.titulo : ''}`); aviso('Enviada para todas as telas.'); }
    if (e.target.closest('[data-tirar]')) { Estado.definir(['abertura'], null); const a = $('#ssAbertura'); if (a) fecharCamada(a); }
  });
}

function blocoApagao(c) {
  const desenhar = () => {
    const a = apagaoAtivo();
    c.innerHTML = `<p class="mini">Escurece ou cobre de névoa a tela de todos, por cima de qualquer módulo (inclusive o mapa). Dá para continuar clicando: na queda de energia, uma lanterna segue o dedo ou o mouse. Na sua tela o efeito fica mais fraco.</p>
      <div class="linha95"><span class="etq ${a ? 'verm' : 'verde'}">${a ? (a.tipo === 'energia' ? 'SEM ENERGIA' : 'NEBLINA TOTAL') : 'normal'}</span>${a && a.ate ? `<span class="mini">até ${new Date(a.ate).toLocaleTimeString('pt-BR').slice(0, 5)} (hora real)</span>` : ''}</div>
      <div class="grade2"><label class="campo">Tipo<select class="w95-input" data-tipo><option value="energia">Queda de energia (lanterna)</option><option value="neblina">Neblina total</option></select></label>
      <label class="campo">Duração em minutos reais (0 = até desligar)<input class="w95-input" type="number" min="0" max="240" value="${int(ls.get('ss-apDur', 0))}" data-dur></label></div>
      <div class="linha95"><button class="w95-btn pri" data-ligar>Ligar</button><button class="w95-btn" data-desligar ${a ? '' : 'disabled'}>Desligar</button><button class="w95-btn" data-piscar>Só piscar as luzes</button></div>`;
  };
  desenhar();
  let ult = ''; vivo(c, 'estado', s => { const f = JSON.stringify(s.apagao || null); if (f !== ult) { ult = f; if (semFoco(c)) desenhar(); } });
  c.addEventListener('click', e => {
    if (e.target.closest('[data-ligar]')) {
      const tipo = $('[data-tipo]', c).value, dur = clamp(int($('[data-dur]', c).value), 0, 240); ls.set('ss-apDur', dur);
      const o = { tipo, ts: Date.now() }; if (dur) o.ate = Date.now() + dur * 60000;
      Estado.definir(['apagao'], o); CRW.diario('apagao', `${tipo === 'energia' ? 'Queda de energia' : 'Neblina total'}${dur ? ' por ' + dur + ' min' : ''}`);
    }
    if (e.target.closest('[data-desligar]')) { Estado.definir(['apagao'], null); CRW.diario('apagao', 'Fim do apagão/neblina'); }
    if (e.target.closest('[data-piscar]')) piscar();
  });
}

function blocoHolofote(c) {
  const desenhar = () => {
    const h = S().holofote, pcs = CRW.pcs();
    c.innerHTML = `<p class="mini">Põe um investigador em destaque na tela de todos: retrato grande, nome e uma frase.</p>
      ${h && h.ts ? `<div class="linha95"><span class="etq ambar">no ar</span> <b>${esc(pcNome(h.pc))}</b><button class="w95-btn" data-apagar>Apagar holofote</button></div>` : ''}
      ${pcs.length ? `<div class="grade2"><label class="campo">Investigador<select class="w95-input" data-pc>${opcoesPCs()}</select></label>
      <label class="campo">Frase<input class="w95-input" data-frase maxlength="200" placeholder="ex.: Abriu o porta-malas sem tremer."></label></div>
      <div class="linha95"><button class="w95-btn pri" data-acender>Acender holofote</button></div>` : '<p class="vazio95">Cadastre investigadores primeiro (aba Mapa).</p>'}
      <label class="chk95"><input type="checkbox" data-auto ${ls.get('ss-holoAuto', false) ? 'checked' : ''}> Holofote automático quando um investigador rolar um crítico (lido do histórico de rolagens)</label>
      <p class="mini">Sem a opção, um crítico rolado só gera um alerta para você.</p>`;
  };
  desenhar();
  let ult = ''; vivo(c, 'estado', s => { const f = JSON.stringify([s.holofote || null, CRW.pcs().map(p => p.id + p.nome)]); if (f !== ult) { ult = f; if (semFoco(c)) desenhar(); } });
  c.addEventListener('change', e => { if (e.target.matches('[data-auto]')) ls.set('ss-holoAuto', e.target.checked); });
  c.addEventListener('click', e => {
    if (e.target.closest('[data-acender]')) acenderHolofote($('[data-pc]', c).value, $('[data-frase]', c).value.trim());
    if (e.target.closest('[data-apagar]')) Estado.definir(['holofote'], null);
  });
}

/* =========================================================
   PAINEL DO MESTRE · aba Mesa
   ========================================================= */
function blocoExposicao(c) {
  const abertos = new Set();
  const desenhar = () => {
    const pcs = CRW.pcs();
    c.innerHTML = `<p class="mini">O quanto quem manda na cidade está de olho em cada investigador (0 a 10). Suba quando alguém fizer algo chamativo. O jogador vê só a faixa vaga (Desconhecido, Notado, Vigiado, Marcado, Alvo) e recebe um sinal sutil quando ela sobe. O número e os motivos ficam só com você.</p>
      <label class="campo">Motivo do próximo ajuste (opcional)<input class="w95-input" data-motivo maxlength="200" placeholder="ex.: perguntou pelo Chevette no balcão do Rosie's"></label>
      ${pcs.length ? `<table class="dtable ss-expo-t"><thead><tr><th>Investigador</th><th>Nível</th><th>Ajuste</th></tr></thead><tbody>${pcs.map(p => { const e = expoSeg(p.id), n = clamp(int(e.nivel), 0, 10); return `<tr data-pc="${esc(p.id)}"><td><b>${esc(p.nome)}</b><div class="mini">faixa: ${esc(FAIXAS[faixaDe(n)].nome)}</div></td>
        <td class="ss-expo-n"><b>${n}</b>/10</td><td><div class="linha95"><button class="w95-btn" data-d="-1" aria-label="Baixar">−1</button><button class="w95-btn pri" data-d="1" aria-label="Subir">+1</button><button class="w95-btn" data-d="2">+2</button></div></td></tr>
        <tr class="ss-expo-log"><td colspan="3"><details data-log="${esc(p.id)}" ${abertos.has(p.id) ? 'open' : ''}><summary class="mini">Registro (${Object.keys(e.log || {}).length})</summary><ol class="ss-log">${lista(e.log).map(([, x]) => x).sort((a, b) => num(b.ts) - num(a.ts)).slice(0, 15).map(x => `<li><span class="mini">${esc(x.data || '')} ${esc(x.h || '')}</span> <b>${x.delta > 0 ? '+' : ''}${int(x.delta)}</b> → ${int(x.nivel)} ${esc(x.motivo || '')}</li>`).join('') || '<li class="mini">nada ainda</li>'}</ol></details></td></tr>`; }).join('')}</tbody></table>` : '<p class="vazio95">Cadastre investigadores primeiro.</p>'}
      <p class="mini">Faixas do site: 0-1 Desconhecido, 2-3 Notado, 4-5 Vigiado, 6-7 Marcado, 8-10 Alvo. É uma convenção desta mesa, não do livro.</p>`;
  };
  desenhar();
  const refazer = () => { if (!semFoco(c)) return; const m = ($('[data-motivo]', c) || {}).value || ''; desenhar(); const i = $('[data-motivo]', c); if (i) i.value = m; };
  vivo(c, 'segredos', refazer);
  let ultP = ''; vivo(c, 'estado', () => { const f = JSON.stringify(CRW.pcs().map(p => p.id + p.nome)); if (f !== ultP) { ultP = f; refazer(); } });
  c.addEventListener('toggle', e => { const d = e.target.closest && e.target.closest('[data-log]'); if (d) { if (d.open) abertos.add(d.dataset.log); else abertos.delete(d.dataset.log); } }, true);
  c.addEventListener('click', e => {
    const b = e.target.closest('[data-d]'); if (!b) return;
    const pc = b.closest('[data-pc]').dataset.pc, mot = $('[data-motivo]', c);
    ajustarExposicao(pc, int(b.dataset.d), mot.value.trim()); mot.value = '';
    setTimeout(refazer, 50);
  });
}

function blocoDilema(c) {
  const desenhar = () => {
    const pcs = CRW.pcs();
    const hist = lista(Segredos.ler(['dilemas'])).map(([id, x]) => ({ ...x, id })).sort((a, b) => num(b.ts) - num(a.ts)).slice(0, 12);
    c.innerHTML = `<p class="mini">Uma escolha secreta para um só jogador, com 2 ou 3 opções. A resposta volta só para você (alerta e diário).</p>
      ${pcs.length ? `<label class="campo">Para<select class="w95-input" data-f="pc">${opcoesPCs()}</select></label>
      <label class="campo">Situação e pergunta<textarea class="w95-input" rows="3" data-f="perg" maxlength="600"></textarea></label>
      <div class="grade2"><label class="campo">Opção A<input class="w95-input" data-f="o0" maxlength="120"></label><label class="campo">Opção B<input class="w95-input" data-f="o1" maxlength="120"></label></div>
      <label class="campo">Opção C (opcional)<input class="w95-input" data-f="o2" maxlength="120"></label>
      <div class="linha95"><button class="w95-btn pri" data-enviar>Enviar dilema</button></div>` : '<p class="vazio95">Cadastre investigadores primeiro.</p>'}
      <h4 class="ss-h4">Dilemas enviados</h4>
      ${hist.length ? `<ul class="ss-dil-hist">${hist.map(d => `<li><b>${esc(pcNome(d.pc))}</b> <span class="mini">${esc(d.data || '')}</span><div class="mini">${esc(d.pergunta || '')}</div>${d.resposta ? `<div>→ <b>${esc(d.resposta.texto)}</b></div>` : '<div class="mini">aguardando resposta…</div>'}</li>`).join('')}</ul>` : '<p class="vazio95">Nenhum.</p>'}`;
  };
  desenhar();
  vivo(c, 'segredos', () => { if (semFoco(c)) desenhar(); });
  c.addEventListener('click', async e => {
    if (!e.target.closest('[data-enviar]')) return;
    const g = k => ($(`[data-f="${k}"]`, c).value || '').trim();
    const pc = g('pc'), pergunta = g('perg'), opcoes = [g('o0'), g('o1'), g('o2')].filter(Boolean);
    if (!pergunta || opcoes.length < 2) return aviso('Escreva a pergunta e pelo menos duas opções.', 'erro');
    const id = nid();
    const r = CRW.entregar(pc, { tipo: 'dilema', id, dilema: id, pergunta, opcoes }); if (!r) return;
    await Segredos.gravar(['dilemas', id], { pc, pergunta, opcoes, ts: Date.now(), data: hoje() });
    CRW.diario('dilema', `Dilema para ${pcNome(pc)}: ${pergunta}`); aviso('Dilema enviado.'); desenhar();
  });
}

function blocoLojas(c) {
  let lojaEd = 'almox';
  const resumo = p => p.loja === 'almox' ? (p.itens || []).map(i => `${int(i.qtd)}x ${i.nome}`).join(', ') : p.op === 'vender' ? `VENDER: ${(p.item || {}).nome} (pede ${precoTxt(p.pedida)})` : `COMPRAR: ${(p.item || {}).nome} (oferta ${precoTxt(p.oferta)})`;
  const desenhar = () => {
    const pend = Object.entries(ped.loja || {}).filter(([, p]) => p).sort((a, b) => num(a[1].ts) - num(b[1].ts));
    const it = lojaItens(lojaEd), o = lojaObj(lojaEd);
    c.innerHTML = `<h4 class="ss-h4">Pedidos aguardando (${pend.length})</h4>
      ${pend.length ? `<ul class="ss-peds">${pend.map(([id, p]) => `<li data-ped="${esc(id)}"><span class="etq ${p.loja === 'almox' ? 'azul' : 'ambar'}">${p.loja === 'almox' ? 'CCSO-31' : 'Penhores'}</span> <b>${esc(p.nome || pcNome(p.pc))}</b><div>${esc(resumo(p))}</div>${p.justificativa ? `<div class="mini">Justificativa: ${esc(p.justificativa)}</div>` : ''}${p.item && p.item.desc ? `<div class="mini">${esc(p.item.desc)}</div>` : ''}
        <div class="linha95"><button class="w95-btn pri" data-aprovar>Aprovar</button><button class="w95-btn" data-negar>Negar</button></div></li>`).join('')}</ul>` : '<p class="vazio95">Nenhum pedido.</p>'}
      <h4 class="ss-h4">Estoque e catálogo</h4>
      <div class="linha95"><select class="w95-input" data-loja>${Object.entries(LOJAS).map(([k, n]) => `<option value="${k}"${k === lojaEd ? ' selected' : ''}>${esc(n)}</option>`).join('')}</select>
        <label class="chk95"><input type="checkbox" data-fechada ${o.fechada ? 'checked' : ''}> Fechada</label></div>
      <table class="dtable ss-cat"><thead><tr><th>Item</th><th>Preço</th><th>Estoque</th><th></th></tr></thead><tbody>
      ${it.map(x => `<tr data-it="${esc(x.id)}"><td><b>${esc(x.nome)}</b></td><td>${esc(precoTxt(x.preco))}</td><td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-est="-1" aria-label="Menos">−</button> ${x.estoque == null || x.estoque === '' ? '∞' : int(x.estoque)} <button class="w95-btn ss-mini-b" data-est="1" aria-label="Mais">+</button></td>
        <td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-ited>Editar</button><button class="w95-btn ss-mini-b perigo" data-itdel aria-label="Apagar">×</button></td></tr>`).join('')}</tbody></table>
      <div class="linha95"><button class="w95-btn" data-itnovo>+ Novo item</button><button class="w95-btn" data-padrao>Voltar ao catálogo padrão</button></div>
      <p class="mini">Aprovar entrega os itens na ficha do jogador (tipo "item") e um recibo; o estoque desce sozinho. Dinheiro não é controlado pelo site: o jogador anota na ficha.</p>`;
  };
  desenhar();
  vivo(c, 'ss-pedidos', () => { if (semFoco(c)) desenhar(); });
  let ultL = ''; vivo(c, 'estado', s => { const f = JSON.stringify(s.loja || null); if (f !== ultL) { ultL = f; if (semFoco(c)) desenhar(); } });
  const editarItem = x => {
    const w = janela({ id: 'ssItEd', titulo: x.id ? 'Editar item' : 'Novo item', largura: '420px', html: `
      <label class="campo">Nome<input class="w95-input" data-f="nome" value="${esc(x.nome || '')}" maxlength="80"></label>
      <label class="campo">Descrição<textarea class="w95-input" rows="2" data-f="desc" maxlength="300">${esc(x.desc || '')}</textarea></label>
      <div class="grade2"><label class="campo">Preço ($; vazio = requisição)<input class="w95-input" data-f="preco" value="${x.preco === R || x.preco == null ? '' : esc(x.preco)}" inputmode="decimal"></label>
      <label class="campo">Estoque (vazio = sem limite)<input class="w95-input" data-f="estoque" value="${x.estoque == null ? '' : esc(x.estoque)}" inputmode="numeric"></label></div>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    $('[data-ok]', w).addEventListener('click', () => {
      const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
      if (!g('nome')) return aviso('Dê um nome ao item.', 'erro');
      const id = x.id || nid();
      gravarItem(lojaEd, id, { nome: g('nome'), desc: g('desc'), preco: g('preco') === '' ? R : Math.max(0, num(g('preco').replace(',', '.'))), estoque: g('estoque') === '' ? null : Math.max(0, int(g('estoque'))), ordem: x.ordem != null ? x.ordem : 999 });
      fecharJanela('ssItEd');
    });
  };
  const fechar = (id, p, status, texto, valor) => {
    CRW.entregar(p.pc, { tipo: 'loja', pedido: id, loja: p.loja, status, texto, valor: valor == null ? null : valor });
    Rede.set('pedidos/loja/' + id, null).catch(() => {});
    CRW.diario('loja', `${p.nome || pcNome(p.pc)} · ${resumo(p)} · ${status}`);
  };
  const baixarEstoque = (loja, itemId, qtd) => {
    const x = lojaItens(loja).find(y => y.id === itemId); if (!x || x.estoque == null || x.estoque === '') return;
    const { id, ...resto } = x; gravarItem(loja, id, { ...resto, estoque: Math.max(0, int(x.estoque) - int(qtd)) });
  };
  c.addEventListener('change', e => {
    if (e.target.matches('[data-loja]')) { lojaEd = e.target.value; desenhar(); }
    if (e.target.matches('[data-fechada]')) Estado.definir(['loja', lojaEd, 'fechada'], e.target.checked || null);
  });
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const li = b.closest('[data-ped]');
    if (li) {
      const id = li.dataset.ped, p = (ped.loja || {})[id]; if (!p) return;
      if (!CRW.chaveDoPC(p.pc)) return aviso('Esse investigador não tem ficha neste caso: não dá para entregar.', 'erro');
      if (b.hasAttribute('data-negar')) { const m = await pedirTexto('Motivo (o jogador lê; opcional)', p.loja === 'almox' ? 'Sem estoque ou sem justificativa suficiente.' : 'O penhorista não aceitou.'); if (m === null) return; fechar(id, p, 'negado', m); return; }
      if (p.loja === 'almox') {
        (p.itens || []).forEach(i => { const x = lojaItens('almox').find(y => y.id === i.id) || { nome: i.nome }; CRW.entregar(p.pc, { tipo: 'item', nome: x.nome, desc: x.desc || '', origem: 'Almoxarifado do CCSO (requisição CCSO-31)', qtd: int(i.qtd) }); baixarEstoque('almox', i.id, i.qtd); });
        fechar(id, p, 'aprovado', 'Requisição CCSO-31 assinada pelo sargento. Retire o material no balcão: ' + resumo(p) + '.');
      } else if (p.op === 'vender') {
        const v = await pedirTexto(`Quanto o penhorista paga por "${(p.item || {}).nome}"?`, String(num(p.pedida)), { tipo: 'number' }); if (v === null) return;
        const valor = Math.max(0, num(String(v).replace(',', '.')));
        if (await confirmar('Pôr o item vendido à venda na vitrine dos Penhores?', { ok: 'Sim', cancelar: 'Não' })) gravarItem('penhores', nid(), { nome: (p.item || {}).nome || 'Item', desc: (p.item || {}).desc || '', preco: Math.round(valor * 1.8), estoque: 1, ordem: 999 });
        fechar(id, p, 'aprovado', `Venda fechada: ${(p.item || {}).nome}. Receba o dinheiro e tire o item da sua ficha.`, valor);
      } else {
        const x = lojaItens('penhores').find(y => y.id === (p.item || {}).id) || { nome: (p.item || {}).nome };
        const v = await pedirTexto(`Valor final de "${x.nome}" (oferta do jogador: ${precoTxt(p.oferta)})`, String(num(p.oferta)), { tipo: 'number' }); if (v === null) return;
        const valor = Math.max(0, num(String(v).replace(',', '.')));
        CRW.entregar(p.pc, { tipo: 'item', nome: x.nome, desc: x.desc || '', origem: 'Penhores Pulptown', qtd: 1, preco: valor });
        if (x.id) baixarEstoque('penhores', x.id, 1);
        fechar(id, p, 'aprovado', `Negócio fechado: ${x.nome}. Pague o valor e anote na sua ficha.`, valor);
      }
      aviso('Pedido aprovado e entregue.'); return;
    }
    if (b.hasAttribute('data-itnovo')) return editarItem({});
    if (b.hasAttribute('data-padrao')) { if (await confirmar(`Voltar o catálogo de ${LOJAS[lojaEd]} ao padrão? O estoque editado se perde.`)) Estado.definir(['loja', lojaEd, 'itens'], catalogoPadrao(lojaEd)); return; }
    const tr = b.closest('[data-it]'); if (!tr) return;
    const x = lojaItens(lojaEd).find(y => y.id === tr.dataset.it); if (!x) return;
    const { id, ...resto } = x;
    if (b.dataset.est) { const atual = x.estoque == null || x.estoque === '' ? 0 : int(x.estoque); gravarItem(lojaEd, id, { ...resto, estoque: Math.max(0, atual + int(b.dataset.est)) }); }
    if (b.hasAttribute('data-ited')) editarItem(x);
    if (b.hasAttribute('data-itdel') && await confirmar(`Tirar "${x.nome}" do catálogo?`)) gravarItem(lojaEd, id, null);
  });
}

function blocoSemana(c) {
  let votos = {}, rod = '', offV = null;
  const ligar = () => {
    const s = S().semana || {};
    if (s.rodada === rod) return; rod = s.rodada || '';
    if (offV && offV.off) offV.off(); offV = null; votos = {};
    if (rod) offV = redeViva(c, 'votos/semana/' + rod, x => { votos = x || {}; desenhar(); });
  };
  const contagem = () => { const t = {}; Object.entries(votos || {}).forEach(([q, v]) => { if (v && v.voto && v.voto !== q && CRW.pc(v.voto)) t[v.voto] = (t[v.voto] || 0) + 1; }); return t; };
  function desenhar() {
    const s = S().semana || {}, t = contagem(), total = Object.values(t).reduce((a, b) => a + b, 0), pcs = CRW.pcs();
    const votaram = Object.keys(votos || {}).filter(q => CRW.pc(q));
    c.innerHTML = `<p class="mini">Votação secreta entre os investigadores. Ninguém vota em si. Só você vê a contagem. O vencedor aparece numa capa de jornal em todas as telas e ganha uma placa no Mural de Honra.</p>
      ${s.aberta ? `<div class="linha95"><span class="etq verm">ABERTA</span> <b>${esc(s.titulo || 'Investigador da Semana')}</b> <span class="mini">${votaram.length} de ${pcs.length} votaram</span></div>
        <table class="dtable"><thead><tr><th>Investigador</th><th>Votos</th></tr></thead><tbody>${pcs.map(p => `<tr><td>${esc(p.nome)}${votaram.includes(p.id) ? ' <span class="mini">(já votou)</span>' : ''}</td><td><b>${t[p.id] || 0}</b></td></tr>`).join('')}</tbody></table>
        <div class="linha95"><button class="w95-btn pri" data-encerrar ${total ? '' : 'disabled'}>Encerrar e anunciar</button><button class="w95-btn" data-cancelar>Cancelar votação</button></div>`
      : `${s.resultado ? `<p class="tx">Último: <b>${esc(pcNome(s.resultado.pc))}</b> (${esc(s.titulo || '')}, ${int(s.resultado.votos)} de ${int(s.resultado.total)} votos). <button class="w95-btn" data-reanunciar>Anunciar de novo</button></p>` : ''}
        <label class="campo">Nome da rodada<input class="w95-input" data-tit maxlength="60" value="${esc('Semana de ' + hoje())}"></label>
        <div class="linha95"><button class="w95-btn pri" data-abrir ${pcs.length >= 2 ? '' : 'disabled'}>Abrir votação</button></div>${pcs.length < 2 ? '<p class="mini">Precisa de pelo menos 2 investigadores.</p>' : ''}`}`;
  }
  ligar(); desenhar();
  vivo(c, 'estado', () => { ligar(); if (semFoco(c)) desenhar(); });
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const s = S().semana || {};
    if (b.hasAttribute('data-abrir')) { const tit = ($('[data-tit]', c).value || '').trim(); Estado.definir(['semana'], { rodada: 'r' + Date.now().toString(36), aberta: true, titulo: tit, inicio: Date.now() }); CRW.diario('semana', 'Votação aberta: ' + tit); }
    if (b.hasAttribute('data-cancelar') && await confirmar('Cancelar a votação sem anunciar ninguém?')) Estado.definir(['semana'], { ...s, aberta: false, resultado: s.resultado || null, cancelada: Date.now() });
    if (b.hasAttribute('data-reanunciar') && s.resultado) Estado.definir(['semana', 'resultado', 'ts'], Date.now());
    if (b.hasAttribute('data-encerrar')) {
      const t = contagem(), total = Object.values(t).reduce((a, x) => a + x, 0); if (!total) return;
      const max = Math.max(...Object.values(t)); const emp = Object.keys(t).filter(k => t[k] === max);
      let pc = emp[0];
      if (emp.length > 1) {
        pc = await new Promise(ok => {
          const w = janela({ id: 'ssDesempate', titulo: 'Empate', largura: '380px', aoFechar: () => ok(null), html: `<p class="tx">Empate com ${max} voto(s). Quem leva?</p><div class="ss-dil-ops">${emp.map(k => `<button class="w95-btn" data-k="${esc(k)}">${esc(pcNome(k))}</button>`).join('')}</div>` });
          w.addEventListener('click', ev => { const x = ev.target.closest('[data-k]'); if (x) { w.parentElement._aoFechar = null; fecharJanela('ssDesempate'); ok(x.dataset.k); } });
        });
        if (!pc) return;
      }
      const res = { pc, nome: pcNome(pc), votos: t[pc], total, ts: Date.now(), data: hoje() };
      Estado.definir(['semana'], { ...s, aberta: false, resultado: res });
      Estado.definir(['honra', nid()], { pc, nome: pcNome(pc), titulo: 'Investigador da Semana', data: hoje(), texto: `${s.titulo || 'Votação do Círculo'} · ${t[pc]} de ${total} votos`, tipo: 'semana', ts: Date.now() });
      CRW.diario('semana', `Investigador da Semana: ${pcNome(pc)} (${t[pc]} de ${total})`);
    }
  });
}

function blocoDistintivos(c) {
  const desenhar = () => {
    const cat = catalogo(), pcs = CRW.pcs();
    c.innerHTML = `<p class="mini">Conquistas secretas. O catálogo fica no servidor (só você lê); os jogadores veem só as que ganharam e silhuetas "???" das que faltam. Nenhum distintivo deve revelar segredo da campanha.</p>
      ${cat.length && pcs.length ? `<div class="grade2"><label class="campo">Investigador<select class="w95-input" data-pc>${opcoesPCs()}</select></label>
        <label class="campo">Distintivo<select class="w95-input" data-di>${cat.map(d => `<option value="${esc(d.id)}">${esc(d.icone || '★')} ${esc(d.titulo)}</option>`).join('')}</select></label></div>
        <label class="chk95"><input type="checkbox" data-pub ${ls.get('ss-pubDist', true) ? 'checked' : ''}> Pôr também uma placa no Mural de Honra</label>
        <div class="linha95"><button class="w95-btn pri" data-conceder>Conceder</button><button class="w95-btn" data-reenviar>Reenviar a todos (aparelho novo)</button></div>` : ''}
      <table class="dtable ss-cat"><thead><tr><th>Distintivo</th><th>Quem tem</th><th></th></tr></thead><tbody>
      ${cat.map(d => `<tr data-d="${esc(d.id)}"><td><span class="ss-di-i">${esc(d.icone || '★')}</span> <b>${esc(d.titulo)}</b><div class="mini">${esc(d.desc || '')}</div></td><td class="mini">${pcs.filter(p => concedidos(p.id)[d.id]).map(p => esc(p.nome)).join(', ') || '-'}</td>
        <td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-ed>Editar</button><button class="w95-btn ss-mini-b perigo" data-del aria-label="Apagar">×</button></td></tr>`).join('') || '<tr><td colspan="3" class="vazio95">Catálogo vazio. Importe as sementes (aba Segredos) ou crie.</td></tr>'}</tbody></table>
      <div class="linha95"><button class="w95-btn" data-novo>+ Novo distintivo</button></div>`;
  };
  desenhar(); publicarTotalDistintivos();
  vivo(c, 'segredos', () => { if (semFoco(c)) desenhar(); });
  const editar = d => {
    const w = janela({ id: 'ssDiEd', titulo: d.id ? 'Editar distintivo' : 'Novo distintivo', largura: '400px', html: `
      <label class="campo">Título<input class="w95-input" data-f="titulo" value="${esc(d.titulo || '')}" maxlength="60"></label>
      <label class="campo">Descrição (o jogador lê quando ganha)<textarea class="w95-input" rows="2" data-f="desc" maxlength="200">${esc(d.desc || '')}</textarea></label>
      <label class="campo">Ícone (um símbolo: ★ ✚ ☕ ⚖ ▤ ◎ ☏ ✎ ⌕ ⚑ ☾ ▶)<input class="w95-input" data-f="icone" value="${esc(d.icone || '★')}" maxlength="2"></label>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    $('[data-ok]', w).addEventListener('click', async () => {
      const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
      if (!g('titulo')) return aviso('Dê um título.', 'erro');
      await Segredos.gravar(['distintivos', 'catalogo', d.id || nid()], { titulo: g('titulo'), desc: g('desc'), icone: g('icone') || '★', ordem: d.ordem != null ? d.ordem : 99 });
      fecharJanela('ssDiEd'); publicarTotalDistintivos();
    });
  };
  c.addEventListener('change', e => { if (e.target.matches('[data-pub]')) ls.set('ss-pubDist', e.target.checked); });
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-novo')) return editar({});
    if (b.hasAttribute('data-conceder')) {
      const pc = $('[data-pc]', c).value, id = $('[data-di]', c).value;
      if (concedidos(pc)[id] && !(await confirmar(`${pcNome(pc)} já tem este distintivo. Entregar de novo?`))) return;
      if (await concederDistintivo(pc, id, $('[data-pub]', c).checked)) aviso('Distintivo concedido.');
      return;
    }
    if (b.hasAttribute('data-reenviar')) {
      let n = 0; const cat = catalogo();
      for (const p of CRW.pcs()) { const k = CRW.chaveDoPC(p.id); if (!k) continue; for (const [id, x] of Object.entries(concedidos(p.id))) { const d = cat.find(y => y.id === id); if (!d) continue; await Rede.set(`conqJog/${k}/${id}`, { titulo: d.titulo, desc: d.desc || '', icone: d.icone || '★', ts: num(x.ts, Date.now()), data: x.data || '' }).catch(() => {}); n++; } }
      aviso(`${n} distintivo(s) reenviado(s) aos aparelhos atuais.`); return;
    }
    const tr = b.closest('[data-d]'); if (!tr) return;
    const d = catalogo().find(x => x.id === tr.dataset.d); if (!d) return;
    if (b.hasAttribute('data-ed')) editar(d);
    if (b.hasAttribute('data-del') && await confirmar(`Apagar "${d.titulo}" do catálogo? Quem já ganhou continua com ele.`)) { await Segredos.gravar(['distintivos', 'catalogo', d.id], null); publicarTotalDistintivos(); }
  });
}

function blocoMural(c) {
  const desenhar = () => {
    const props = Object.entries(ped.momento || {}).filter(([, p]) => p).sort((a, b) => num(a[1].ts) - num(b[1].ts));
    const ms = momentosL(), hs = honraL(), as = arquivoL();
    c.innerHTML = `<p class="mini">Momentos marcantes (críticos, cicatrizes, cenas), placas do Mural de Honra e o Arquivo Morto (investigadores mortos ou aposentados, casos encerrados, gente da cidade). Tudo aqui é público para o grupo.</p>
      <h4 class="ss-h4">Propostas do grupo (${props.length})</h4>
      ${props.length ? `<ul class="ss-peds">${props.map(([id, p]) => `<li data-prop="${esc(id)}"><b>${esc(p.titulo || '')}</b> <span class="mini">${esc((TIPOS_MOM[p.tipo] || TIPOS_MOM.cena)[1])} · ${esc(pcNome(p.alvo || p.pc))} · proposto por ${esc(p.nome || '')}</span><div class="mini">${esc(p.texto || '')}</div>
        <div class="linha95"><button class="w95-btn pri" data-aprovar>Aprovar</button><button class="w95-btn" data-editar>Editar e aprovar</button><button class="w95-btn" data-negar>Recusar</button></div></li>`).join('')}</ul>` : '<p class="vazio95">Nenhuma proposta.</p>'}
      <div class="linha95"><button class="w95-btn" data-nmom>+ Momento marcante</button><button class="w95-btn" data-nhonra>+ Placa no Mural</button><button class="w95-btn" data-narq>+ Arquivo Morto</button></div>
      <h4 class="ss-h4">Registros</h4>
      <table class="dtable ss-cat"><tbody>
      ${ms.map(m => `<tr data-x="momentos/${esc(m.id)}"><td><span class="etq">${esc((TIPOS_MOM[m.tipo] || TIPOS_MOM.cena)[1])}</span> <b>${esc(m.titulo)}</b> <span class="mini">${esc(pcNome(m.pc))}</span></td><td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-xed>Editar</button><button class="w95-btn ss-mini-b perigo" data-xdel aria-label="Apagar">×</button></td></tr>`).join('')}
      ${hs.map(h => `<tr data-x="honra/${esc(h.id)}"><td><span class="etq ambar">placa</span> <b>${esc(h.titulo)}</b> <span class="mini">${esc(h.pc ? pcNome(h.pc) : h.nome || '')}</span></td><td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-xed>Editar</button><button class="w95-btn ss-mini-b perigo" data-xdel aria-label="Apagar">×</button></td></tr>`).join('')}
      ${as.map(a => `<tr data-x="arquivoMorto/${esc(a.id)}"><td><span class="etq">arquivo</span> <b>${esc(a.nome)}</b> <span class="mini">${esc(TIPOS_ARQ[a.tipo] || '')}</span></td><td class="ss-nowrap"><button class="w95-btn ss-mini-b" data-xed>Editar</button><button class="w95-btn ss-mini-b perigo" data-xdel aria-label="Apagar">×</button></td></tr>`).join('')}
      ${ms.length + hs.length + as.length ? '' : '<tr><td class="vazio95">Nada registrado.</td></tr>'}</tbody></table>`;
  };
  desenhar();
  vivo(c, 'ss-pedidos', () => { if (semFoco(c)) desenhar(); });
  let ult = ''; vivo(c, 'estado', s => { const f = JSON.stringify([s.honra, s.momentos, s.arquivoMorto]); if (f !== ult) { ult = f; if (semFoco(c)) desenhar(); } });
  const form = (tipo, x) => {
    const campos = tipo === 'momentos'
      ? `<label class="campo">Quem<select class="w95-input" data-f="pc">${opcoesPCs(x.pc)}</select></label><label class="campo">Tipo<select class="w95-input" data-f="tipo">${Object.entries(TIPOS_MOM).map(([k, [, n]]) => `<option value="${k}"${(x.tipo || 'cena') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
         <label class="campo">Título<input class="w95-input" data-f="titulo" value="${esc(x.titulo || '')}" maxlength="80"></label><label class="campo">Texto<textarea class="w95-input" rows="3" data-f="texto" maxlength="600">${esc(x.texto || '')}</textarea></label>`
      : tipo === 'honra'
        ? `<label class="campo">Investigador (ou ninguém)<select class="w95-input" data-f="pc"><option value="">(nenhum: usar o nome abaixo)</option>${opcoesPCs(x.pc)}</select></label><label class="campo">Nome na placa (se não for investigador)<input class="w95-input" data-f="nome" value="${esc(x.pc ? '' : x.nome || '')}" maxlength="60"></label>
           <label class="campo">Título da placa<input class="w95-input" data-f="titulo" value="${esc(x.titulo || '')}" maxlength="80"></label><label class="campo">Texto<textarea class="w95-input" rows="3" data-f="texto" maxlength="400">${esc(x.texto || '')}</textarea></label>`
        : `<label class="campo">Tipo<select class="w95-input" data-f="tipo">${Object.entries(TIPOS_ARQ).map(([k, n]) => `<option value="${k}"${(x.tipo || 'investigador') === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
           <label class="campo">Investigador (para a foto 3x4; opcional)<select class="w95-input" data-f="pc"><option value="">(nenhum)</option>${opcoesPCs(x.pc)}</select></label>
           <label class="campo">Nome (pessoa ou caso)<input class="w95-input" data-f="nome" value="${esc(x.nome || '')}" maxlength="80"></label><label class="campo">Epitáfio ou desfecho<textarea class="w95-input" rows="3" data-f="epitafio" maxlength="400">${esc(x.epitafio || '')}</textarea></label>`;
    const w = janela({ id: 'ssMurEd', titulo: { momentos: 'Momento marcante', honra: 'Placa do Mural de Honra', arquivoMorto: 'Arquivo Morto' }[tipo], largura: '440px', html: `${campos}
      <label class="campo">Data<input class="w95-input" data-f="data" value="${esc(x.data || hoje())}" maxlength="20"></label>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    return new Promise(ok => {
      $('[data-ok]', w).addEventListener('click', () => {
        const o = {}; $$('[data-f]', w).forEach(i => { o[i.dataset.f] = i.value.trim(); });
        if (tipo === 'honra' && o.pc) o.nome = pcNome(o.pc);
        if (tipo === 'arquivoMorto' && !o.nome && o.pc) o.nome = pcNome(o.pc);
        if (!(o.titulo || o.nome)) return aviso('Preencha o título ou o nome.', 'erro');
        if (!o.pc) o.pc = null;
        const id = x.id || nid();
        Estado.definir([tipo, id], { ...o, ts: x.ts || Date.now() });
        CRW.diario('mural', `${tipo === 'momentos' ? 'Momento' : tipo === 'honra' ? 'Placa' : 'Arquivo Morto'}: ${o.titulo || o.nome}`);
        fecharJanela('ssMurEd'); ok(true);
      });
    });
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.hasAttribute('data-nmom')) return form('momentos', {});
    if (b.hasAttribute('data-nhonra')) return form('honra', {});
    if (b.hasAttribute('data-narq')) return form('arquivoMorto', {});
    const li = b.closest('[data-prop]');
    if (li) {
      const id = li.dataset.prop, p = (ped.momento || {})[id]; if (!p) return;
      const base = { pc: p.alvo || p.pc, tipo: TIPOS_MOM[p.tipo] ? p.tipo : 'cena', titulo: p.titulo || '', texto: p.texto || '', data: hoje() };
      if (b.hasAttribute('data-aprovar')) { Estado.definir(['momentos', nid()], { ...base, ts: Date.now(), por: p.nome || '' }); CRW.diario('mural', 'Momento aprovado: ' + base.titulo); }
      else if (b.hasAttribute('data-editar')) { if (!(await form('momentos', base))) return; }
      else if (!(await confirmar('Recusar esta proposta?'))) return;
      Rede.set('pedidos/momento/' + id, null).catch(() => {});
      return;
    }
    const tr = b.closest('[data-x]'); if (!tr) return;
    const [tipo, id] = tr.dataset.x.split('/'); const x = { ...((S()[tipo] || {})[id] || {}), id };
    if (b.hasAttribute('data-xed')) form(tipo, x);
    if (b.hasAttribute('data-xdel') && await confirmar(`Apagar "${x.titulo || x.nome}"?`)) Estado.definir([tipo, id], null);
  });
}

/* =========================================================
   REGISTROS NO NÚCLEO
   ========================================================= */
CRW.registrarModulo({ id: 'ss-sangria', titulo: 'Sangria e Contagens', grupo: 'caso', icone: '≋', ordem: 60, render: modSangria });
CRW.registrarModulo({ id: 'ss-honra', titulo: 'Mural de Honra', grupo: 'caso', icone: '✪', ordem: 62, render: modHonra });
CRW.registrarModulo({ id: 'ss-distintivos', titulo: 'Meus distintivos', grupo: 'pessoal', icone: '★', ordem: 60, visivel: v => !!v.pc, render: modDistintivos });
CRW.registrarModulo({ id: 'ss-exposicao', titulo: 'Minha exposição', grupo: 'pessoal', icone: '◉', ordem: 62, visivel: v => !!v.pc, render: modExposicao });
CRW.registrarModulo({ id: 'ss-lojas', titulo: 'Almoxarifado e Penhores', grupo: 'pessoal', icone: '$', ordem: 64, visivel: v => !!(v.pc || v.mestre || v.aux), render: modLojas });

CRW.registrarMestre({ id: 'ss-m-sangria', aba: 'sessao', titulo: 'Sangria da cidade e manifestações', ordem: 10, render: blocoSangria });
CRW.registrarMestre({ id: 'ss-m-contagens', aba: 'sessao', titulo: 'Dados de contagem regressiva', ordem: 20, render: blocoContagens });
CRW.registrarMestre({ id: 'ss-m-abertura', aba: 'sessao', titulo: 'Abertura e encerramento (anos 90)', ordem: 30, render: blocoAbertura });
CRW.registrarMestre({ id: 'ss-m-apagao', aba: 'sessao', titulo: 'Queda de energia e neblina total', ordem: 40, render: blocoApagao });
CRW.registrarMestre({ id: 'ss-m-holofote', aba: 'sessao', titulo: 'Holofote', ordem: 50, render: blocoHolofote });
CRW.registrarMestre({ id: 'ss-m-exposicao', aba: 'mesa', titulo: 'Exposição (quem está de olho)', ordem: 10, render: blocoExposicao });
CRW.registrarMestre({ id: 'ss-m-dilema', aba: 'mesa', titulo: 'Dilema secreto', ordem: 20, render: blocoDilema });
CRW.registrarMestre({ id: 'ss-m-lojas', aba: 'mesa', titulo: 'Almoxarifado e Penhores (pedidos e estoque)', ordem: 30, render: blocoLojas });
CRW.registrarMestre({ id: 'ss-m-semana', aba: 'mesa', titulo: 'Investigador da Semana', ordem: 40, render: blocoSemana });
CRW.registrarMestre({ id: 'ss-m-distintivos', aba: 'mesa', titulo: 'Distintivos (conquistas secretas)', ordem: 50, render: blocoDistintivos });
CRW.registrarMestre({ id: 'ss-m-mural', aba: 'mesa', titulo: 'Momentos marcantes, Mural de Honra e Arquivo Morto', ordem: 60, render: blocoMural });

/* ---------- Como Usar ---------- */
CRW.registrarAjuda({ id: 'ss-sangria', titulo: 'Sangria da cidade e dados de contagem', ordem: 60, para: ['todos'], html: `
  <p><b>O que é:</b> a Sangria é o quanto Crowsrest está "sangrando" para o outro lado, de 0 a 10. Aparece para todos no canto da barra de status (os quadradinhos ao lado do relógio; toque para abrir) e no módulo <b>Sangria e Contagens</b>, com um sismógrafo e um medidor segmentado.</p>
  <ul><li><b>Limiares</b> (os ▼ no medidor): ao chegar num deles, o Guardião da Luz libera uma <b>manifestação</b>: um aviso na tela de todos, com um efeito (um corvo cruzando a tela, falha de vídeo, luzes piscando). As manifestações ficam listadas no módulo e podem ser revistas.</li>
  <li><b>Efeitos por nível</b> (em todas as telas): granulação a partir de 1; um corvo pode cruzar a tela a partir de 2; falhas de vídeo a partir de 5; textos que tremem a partir de 7; vinheta escura a partir de 8. Nada disso bloqueia toques. Se o aparelho pede <b>movimento reduzido</b>, os efeitos ficam parados.</li>
  <li><b>Dados de contagem regressiva</b>: relógios do Guardião. Os visíveis aparecem como um dado grande com o número; quando um chega a zero, todas as telas recebem o aviso "Contagem encerrada".</li></ul>
  <p><b>Regras a conferir no livro:</b> o site usa por padrão "o valor desce 1 quando o dado sai 1" e oferece outras duas regras (o dado encolhe; desce 1 por rolagem). Confira no livro de Candela Obscura a regra exata dos dados de contagem regressiva. A escala 0 a 10 e a posição dos limiares são convenções desta mesa.</p>
  <p><b>De onde vêm os dados:</b> o nível e as manifestações liberadas ficam em <code>estado/sangria</code> (público); os limiares preparados, em <code>segredos/sangria</code> (só o Mestre, vindos do arquivo de sementes); relógios visíveis em <code>estado/contagens</code>, secretos em <code>segredos/contagens</code>.</p>` });
CRW.registrarAjuda({ id: 'ss-abertura', titulo: 'Aberturas, encerramento, apagão e holofote', ordem: 61, para: ['todos'], html: `
  <p><b>Abertura e encerramento:</b> o Guardião da Luz dispara para todas as telas uma vinheta anos 90: <b>VHS "Anteriormente…"</b> (tela azul PLAY ▶, contador SP, linhas de rastreio e o resumo da sessão anterior), <b>Inicialização do SIIC</b> (tela de BIOS), <b>Telejornal local</b> (Canal 8, manchete e letreiro rolando) e <b>Encerramento</b> (a fita para, STOP, "continua..."). Toque na tela ou aperte qualquer tecla para fechar.</p>
  <p><b>Queda de energia:</b> a tela escurece e só uma lanterna (um círculo de luz que segue o dedo ou o mouse) deixa ler; um zumbido baixo toca. <b>Neblina total:</b> névoa branca cobre tudo; perto do dedo ela abre um pouco. Os dois funcionam por cima de qualquer módulo, inclusive o mapa, e dá para continuar tocando e clicando normalmente. Janelas e formulários abrem por cima, legíveis.</p>
  <p><b>Holofote:</b> retrato grande, nome e uma frase de um investigador na tela de todos (fecha com um toque ou sozinho em 20 segundos).</p>
  <p><b>Dados:</b> <code>estado/abertura</code>, <code>estado/apagao</code> (o corpo da página ganha a classe <code>apagao-energia</code> ou <code>neblina-total</code>) e <code>estado/holofote</code>.</p>` });
CRW.registrarAjuda({ id: 'ss-honra', titulo: 'Mural de Honra, Investigador da Semana e distintivos', ordem: 62, para: ['todos'], html: `
  <p><b>Mural de Honra</b> (menu Caso): placas com foto 3x4 dos vencedores do Investigador da Semana, distintivos e feitos, e a lista de <b>momentos marcantes</b> (críticos, cicatrizes, cenas). A aba <b>Arquivo Morto</b> guarda investigadores mortos ou aposentados, casos encerrados e gente da cidade que se foi.</p>
  <ul><li><b>Investigador da Semana:</b> quando o Guardião abre a votação, aparece uma faixa no Mural de Honra (e um número vermelho no menu). Toque no colega que merece; o voto é secreto, ninguém vota em si e dá para trocar até o fim. O vencedor sai numa capa de jornal em todas as telas e ganha uma placa.</li>
  <li><b>Propor um momento:</b> no Mural, "Propor um momento marcante". O Guardião aprova (ou edita) antes de aparecer.</li>
  <li><b>Meus distintivos</b> (menu Meu personagem): conquistas secretas da delegacia. As que você ganhou aparecem com título; as que faltam, como silhueta "???". Quando o Guardião entrega uma, a medalha aparece animada na sua tela.</li></ul>
  <p><b>Dados:</b> <code>estado/honra</code>, <code>estado/momentos</code>, <code>estado/arquivoMorto</code>, <code>estado/semana</code> e <code>votos/semana/&lt;rodada&gt;/&lt;investigador&gt;</code>; distintivos do jogador em <code>conqJog/&lt;chave&gt;</code>; catálogo em <code>segredos/distintivos</code>.</p>` });
CRW.registrarAjuda({ id: 'ss-pessoal', titulo: 'Exposição, dilemas e as lojas', ordem: 63, para: ['todos'], html: `
  <p><b>Minha exposição</b> (menu Meu personagem): o quanto você chamou atenção na cidade, numa faixa vaga: <b>Desconhecido, Notado, Vigiado, Marcado, Alvo</b>. Só você (e o Guardião) vê a sua. Quando sobe de faixa, aparece um sinal sutil na tela.</p>
  <p><b>Dilema secreto:</b> às vezes o Guardião manda só para você uma escolha com 2 ou 3 opções. Escolha e confirme; ninguém do Círculo vê. Se fechar sem responder, ela volta quando você entrar de novo.</p>
  <p><b>Almoxarifado e Penhores</b> (menu Meu personagem): no <b>Almoxarifado do CCSO</b> você preenche o <b>Formulário CCSO-31</b> (quantidades e justificativa) e espera a aprovação; nos <b>Penhores Pulptown</b> você faz uma oferta por um item da vitrine ou oferece algo seu para vender. Aprovado, o item cai no equipamento da sua ficha e chega um recibo; o dinheiro você anota na ficha. A aba "Meus pedidos" mostra a situação de cada um.</p>
  <p><b>Dados:</b> a faixa pública fica em <code>estado/exposicao</code>; o número e os motivos em <code>segredos/exposicao</code>; dilemas em <code>segredos/dilemas</code>; lojas em <code>estado/loja</code>; pedidos em <code>pedidos/loja</code>, <code>pedidos/momento</code> e <code>pedidos/dilema</code>.</p>` });

CRW.registrarAjuda({ id: 'ss-mestre', titulo: 'Guardião da Luz: abas Sessão e Mesa (Sangria, contagens, aberturas, apagão, holofote, exposição, dilemas, lojas, votação, distintivos, mural)', ordem: 64, para: ['mestre'], html: `
  <p><b>Aba Sessão</b></p><ul>
  <li><b>Sangria da cidade e manifestações:</b> ▲ Subir / ▼ Baixar ou a régua. Cada limiar tem título e texto (os jogadores veem), efeito (corvo, falha de vídeo, texto que treme, luzes piscando, estática ou nenhum) e uma nota só sua. Ao subir e cruzar um limiar, o site pergunta se libera a manifestação (ou libera sozinho, com a opção marcada). "Liberar agora", "Recolher" (tira da lista dos jogadores), "Ver o efeito aqui", "+ Novo limiar", "Apagar". Os 5 limiares iniciais (2, 4, 6, 8, 10) vêm do arquivo de sementes: do corvo onde não deveria haver um até a lenda em carne.</li>
  <li><b>Dados de contagem regressiva:</b> modelos prontos (os nomes vêm do arquivo de segredos importado; sem ele aparecem modelos neutros) ou do zero; começam vazios. Cada relógio: dado (d4 a d20), valor, regra de descida, visível ou secreto. "Rolar", "−1", "+1", "Mostrar a todos" / "Esconder", "Editar", "Apagar". Ao zerar: alerta para você; se for visível, aviso "Contagem encerrada" em todas as telas. Confira no livro a regra oficial dos dados de contagem regressiva.</li>
  <li><b>Abertura e encerramento:</b> VHS "Anteriormente…" (escreva o resumo da sessão anterior), Inicialização do SIIC, Telejornal local (manchete e letreiro) e Encerramento. "Ver só aqui", "Enviar para todas as telas", "Tirar das telas". O rascunho fica guardado neste aparelho. Quem entrar até 20 minutos depois ainda vê.</li>
  <li><b>Queda de energia e neblina total:</b> tipo, duração em minutos reais (0 = até desligar), "Ligar", "Desligar", "Só piscar as luzes". Na sua tela o efeito é mais fraco. Com duração, o fim é automático.</li>
  <li><b>Holofote:</b> investigador e frase. Opção de holofote automático quando alguém rolar um crítico público no rolador (sem ela, o crítico vira um alerta para você).</li></ul>
  <p><b>Aba Mesa</b></p><ul>
  <li><b>Exposição:</b> 0 a 10 por investigador, com "+1", "+2", "−1" e o motivo (opcional) no campo de cima; o registro guarda data, hora e motivo. O jogador só vê a faixa (0-1 Desconhecido, 2-3 Notado, 4-5 Vigiado, 6-7 Marcado, 8-10 Alvo; convenção desta mesa) e recebe um sinal sutil quando ela sobe.</li>
  <li><b>Dilema secreto:</b> para quem, a pergunta e 2 ou 3 opções. A resposta chega como alerta, vai para o diário e fica na lista "Dilemas enviados".</li>
  <li><b>Almoxarifado e Penhores:</b> pedidos aguardando ("Aprovar" entrega os itens na ficha e um recibo e baixa o estoque; nos Penhores você define o valor final; numa venda, pode pôr o item na vitrine; "Negar" pede um motivo). Estoque com − e +, "Editar", "×", "+ Novo item", "Fechada" e "Voltar ao catálogo padrão". O site não controla dinheiro: o jogador anota na ficha.</li>
  <li><b>Investigador da Semana:</b> "Abrir votação", contagem ao vivo (só você vê), "Encerrar e anunciar" (em empate, você escolhe), "Cancelar votação", "Anunciar de novo". O vencedor ganha placa no Mural de Honra.</li>
  <li><b>Distintivos:</b> catálogo secreto (18 nas sementes, nenhum revela segredo da campanha), "Conceder" com a opção de placa no Mural, "Reenviar a todos" quando um jogador troca de aparelho, "+ Novo distintivo", "Editar", "×".</li>
  <li><b>Momentos marcantes, Mural de Honra e Arquivo Morto:</b> aprovar, editar e aprovar ou recusar as propostas do grupo; "+ Momento marcante", "+ Placa no Mural", "+ Arquivo Morto" (investigador, caso encerrado ou pessoa da cidade, com epitáfio); editar e apagar registros.</li></ul>
  <p><b>Restaurar o site</b> (aba Segredos): Sangria, exposição, contagens, Mural de Honra, distintivos concedidos e lojas vêm <b>desmarcados</b> (são progresso da campanha); abertura, apagão, holofote, votação e histórico de dilemas vêm marcados. Os limiares e o catálogo de distintivos (sementes) nunca são apagados.</p>` });

/* ---------- Restaurar o site ---------- */
[
  { id: 'ss-sangria', nome: 'Sangria da cidade (nível e manifestações liberadas)', padrao: false, estado: ['sangria'] },
  { id: 'ss-exposicao', nome: 'Exposição dos investigadores (faixas e níveis)', padrao: false, estado: ['exposicao'], seg: ['exposicao'] },
  { id: 'ss-contagens', nome: 'Dados de contagem regressiva (visíveis e secretos)', padrao: false, estado: ['contagens'], seg: ['contagens'] },
  { id: 'ss-abertura', nome: 'Abertura/encerramento no ar', padrao: true, estado: ['abertura'] },
  { id: 'ss-apagao', nome: 'Queda de energia ou neblina total', padrao: true, estado: ['apagao'] },
  { id: 'ss-holofote', nome: 'Holofote no ar', padrao: true, estado: ['holofote'] },
  { id: 'ss-semana', nome: 'Investigador da Semana (votação atual e último resultado)', padrao: true, estado: ['semana'] },
  { id: 'ss-honra', nome: 'Mural de Honra, momentos marcantes e Arquivo Morto', padrao: false, estado: ['honra', 'momentos', 'arquivoMorto'] },
  { id: 'ss-distintivos', nome: 'Distintivos concedidos (o catálogo fica)', padrao: false, nos: ['conqJog'], seg: ['distintivos/concedidos'] },
  { id: 'ss-lojas', nome: 'Lojas (estoque e catálogo editado voltam ao padrão)', padrao: false, estado: ['loja'] },
  { id: 'ss-dilemas', nome: 'Histórico de dilemas secretos', padrao: true, seg: ['dilemas'] },
].forEach(r => CRW.registrarRestauracao(r));

/* ---------- API para os outros módulos ---------- */
CRW.Sessao = {
  sangria: () => CRW.sangria(), marcos, manifestacoes: manifs, efeito,
  apagao: () => apagaoAtivo(),
  faixaExposicao: pc => faixaPub(pc || CRW.v().pc), FAIXAS_EXPOSICAO: FAIXAS.map(f => f.nome),
  nivelExposicao: pc => ehM() ? clamp(int(expoSeg(pc).nivel), 0, 10) : null,
  ajustarExposicao: (pc, delta, motivo) => ehM() && ajustarExposicao(pc, delta, motivo),
  contagensVisiveis: contVis,
  abertura: (tipo, op) => mostrarAbertura({ tipo, ...(op || {}), ts: Date.now() }, true),
  holofote: (pc, frase) => acenderHolofote(pc, frase),
  lojaItens,
};
})();
