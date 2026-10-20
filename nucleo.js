/* =========================================================
   CROWSREST · SIIC · nucleo.js
   O motor do site: sincronização (Firebase ou modo local), papéis
   (Guardião da Luz, auxiliares, investigadores), módulos do menu,
   janelas no estilo Windows 95, sons, relógio do jogo e avisos.
   Todos os outros arquivos usam o objeto global CRW criado aqui.
   ========================================================= */
(() => {
'use strict';
const VERSAO = '19970521e';
const RAIZ = (typeof CRW_RAIZ === 'string' ? CRW_RAIZ : 'crowsrest').replace(/^\/+|\/+$/g, '');
const TV = new URLSearchParams(location.search).has('tv');

/* ---------- utilidades ---------- */
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = t => String(t == null ? '' : t).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = (v, d = 0) => { const n = Number(v); return Number.isFinite(n) ? n : d; };
const int = (v, d = 0) => Math.round(num(v, d));
const pad2 = n => String(n).padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const copia = v => v == null ? null : JSON.parse(JSON.stringify(v));
function el(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
const ls = {
  get(k, d) { try { const v = localStorage.getItem('crw-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('crw-' + k, JSON.stringify(v)); return true; } catch (e) { return false; } },
  del(k) { try { localStorage.removeItem('crw-' + k); } catch (e) {} },
};
const ss = {
  get(k, d) { try { const v = sessionStorage.getItem('crw-' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { sessionStorage.setItem('crw-' + k, JSON.stringify(v)); } catch (e) {} },
};
function chaveLocal() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 9); }
function chaveLonga() { let s = ''; while (s.length < 32) s += Math.random().toString(36).slice(2); return s.slice(0, 32); }
async function hash(txt) {
  const d = new TextEncoder().encode((typeof CRW_SAL === 'string' ? CRW_SAL : 'crowsrest::') + txt);
  const b = await crypto.subtle.digest('SHA-256', d);
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* ---------- eventos ---------- */
const ouvintes = {};
function on(ev, fn) { (ouvintes[ev] = ouvintes[ev] || []).push(fn); return () => { ouvintes[ev] = ouvintes[ev].filter(f => f !== fn); }; }
function emit(ev, dado) { (ouvintes[ev] || []).slice().forEach(fn => { try { fn(dado); } catch (e) { console.warn('evento ' + ev + ':', e); } }); }

/* =========================================================
   PERFIL E PAPÉIS
   perfil: 'mestre' | 'aux' | 'jog:<id do personagem>' | ''
   ========================================================= */
const P = { mestre: false, aux: false, pc: null, nomeAux: '', espiar: null };
const lerPerfil = () => ss.get('perfil', ls.get('perfil', ''));
function salvarPerfil(v) { ss.set('perfil', v); ls.set('perfil', v); }
// "ver pelos olhos de": o Mestre enxerga como um jogador (só na tela dele)
function v() {
  if (P.mestre && P.espiar) return { mestre: false, aux: false, pc: P.espiar, espiando: true };
  return { mestre: P.mestre, aux: P.aux, pc: P.pc, espiando: false };
}
const ehMestre = () => P.mestre;
const ehAux = () => P.aux;
const meuPC = () => P.pc;
const veTudo = () => { const x = v(); return x.mestre || x.aux; };

/* =========================================================
   SINCRONIA: Firebase ou modo local
   Rede: leitura e gravação em caminhos relativos à raiz do Crowsrest.
   ========================================================= */
const Rede = {
  modo: 'local', db: null, auth: null, conectado: false,
  arvore: {}, ouv: [], canal: null, pronto: false,
  fb() { return this.modo === 'firebase'; },
  cam(c) { c = String(c || '').replace(/^\/+|\/+$/g, ''); return RAIZ ? (c ? RAIZ + '/' + c : RAIZ) : c; },
  partes(c) { return String(c).split('/').filter(Boolean); },
  iniciarLocal() {
    if (this.pronto) return; this.pronto = true;
    try { this.arvore = JSON.parse(localStorage.getItem('crw-rede') || '{}') || {}; } catch (e) { this.arvore = {}; }
    try {
      this.canal = new BroadcastChannel('crw-rede');
      this.canal.onmessage = ev => { this.gravarLocal(ev.data.c, ev.data.v); this.notificar(ev.data.c); };
    } catch (e) {}
  },
  ler(c) { let o = this.arvore; for (const k of this.partes(c)) { if (o == null || typeof o !== 'object') return null; o = o[k]; } return o === undefined ? null : o; },
  gravarLocal(c, val) {
    const ps = this.partes(c); if (!ps.length) { this.arvore = copia(val) || {}; return; }
    let o = this.arvore;
    for (let i = 0; i < ps.length - 1; i++) { if (!o[ps[i]] || typeof o[ps[i]] !== 'object') o[ps[i]] = {}; o = o[ps[i]]; }
    if (val === null || val === undefined) delete o[ps[ps.length - 1]]; else o[ps[ps.length - 1]] = copia(val);
  },
  async set(c, val) {
    if (val === undefined) val = null;
    if (this.fb()) { await garantirLogin(); return this.db.ref(this.cam(c)).set(val); }
    this.iniciarLocal(); this.gravarLocal(c, val);
    try { localStorage.setItem('crw-rede', JSON.stringify(this.arvore)); } catch (e) { aviso('Sem espaço no navegador para guardar isso (modo local).'); }
    try { this.canal && this.canal.postMessage({ c, v: copia(val) }); } catch (e) {}
    this.notificar(c);
  },
  async update(c, obj) {
    if (this.fb()) { await garantirLogin(); return this.db.ref(this.cam(c)).update(obj); }
    for (const [k, val] of Object.entries(obj)) await this.set(c + '/' + k, val);
  },
  chave() { return this.fb() ? this.db.ref('_').push().key : chaveLocal(); },
  push(c, val) { const k = this.chave(); return { key: k, pronto: this.set(c + '/' + k, val) }; },
  on(c, cb, erro) {
    if (this.fb()) {
      // leituras protegidas esperam o login (anônimo para jogadores); estado e presença são públicos
      let r = null, vivo = true; const h = s => cb(s.val());
      const ligar = () => { if (!vivo) return; r = this.db.ref(this.cam(c)); r.on('value', h, erro || (e => console.warn('leitura ' + c + ':', e && e.message))); };
      if (this.auth.currentUser || /^(estado|presenca)(\/|$)/.test(c)) ligar(); else garantirLogin().then(ligar).catch(e => erro && erro(e));
      return () => { vivo = false; if (r) r.off('value', h); };
    }
    this.iniciarLocal();
    const o = { c, cb }; this.ouv.push(o); cb(copia(this.ler(c)));
    return () => { this.ouv = this.ouv.filter(x => x !== o); };
  },
  once(c) {
    if (this.fb()) return garantirLogin().then(() => this.db.ref(this.cam(c)).once('value')).then(s => s.val());
    this.iniciarLocal(); return Promise.resolve(copia(this.ler(c)));
  },
  notificar(c) {
    const ps = this.partes(c).join('/');
    this.ouv.slice().forEach(o => {
      const oc = this.partes(o.c).join('/');
      if (ps === oc || ps.startsWith(oc + '/') || oc.startsWith(ps + '/') || !ps || !oc) o.cb(copia(this.ler(o.c)));
    });
  },
};
let loginAnon = null;
function garantirLogin() {
  if (!Rede.fb() || Rede.auth.currentUser) return Promise.resolve();
  if (!loginAnon) loginAnon = Rede.auth.signInAnonymously().finally(() => { loginAnon = null; });
  return loginAnon;
}
function erroGravacao(e) {
  console.warn('Gravação recusada:', e && e.message ? e.message : e);
  aviso('O servidor recusou essa ação.', 'erro');
}

/* ---------- Estado público do jogo (estado/...) ----------
   Todos leem. O Mestre grava tudo; investigadores só movem a própria peça
   (as regras do Firebase conferem o mesmo). Os módulos podem liberar outros
   caminhos para os jogadores com CRW.permitir(). */
const Estado = {
  s: {}, priv: {}, pub: {},
  get() { return this.s; },
  compor() { this.s = { ...(this.pub || {}) }; this.s.tokens = { ...((this.pub || {}).tokens || {}), ...((this.priv || {}).tokens || {}) }; },
  definir(caminho, valor) {
    if (typeof caminho === 'string') caminho = caminho.split('/').filter(Boolean);
    if (!P.mestre) { const m = recusa(caminho, valor); if (m) { aviso(m, 'erro'); emit('estado', this.s); return Promise.resolve(false); } }
    // peças ocultas de NPC moram no caminho privado (só Mestre e auxiliares leem)
    if (caminho[0] === 'tokens' && caminho.length === 2) {
      const id = caminho[1], naPub = !!((this.pub.tokens || {})[id]), naPriv = !!((this.priv.tokens || {})[id]);
      const vaiPriv = valor && valor.h && valor.tipo !== 'pc';
      const ops = [];
      if (valor === null) { if (naPub || !naPriv) ops.push(['estado/tokens/' + id, null]); if (naPriv) ops.push(['privado/tokens/' + id, null]); }
      else if (vaiPriv) { ops.push(['privado/tokens/' + id, valor]); if (naPub) ops.push(['estado/tokens/' + id, null]); }
      else { ops.push(['estado/tokens/' + id, valor]); if (naPriv) ops.push(['privado/tokens/' + id, null]); }
      aplicarLocal(vaiPriv ? this.priv : this.pub, caminho, valor);
      if (valor !== null && !vaiPriv && naPriv) aplicarLocal(this.priv, caminho, null);
      if (valor !== null && vaiPriv && naPub) aplicarLocal(this.pub, caminho, null);
      if (valor === null) { aplicarLocal(this.pub, caminho, null); aplicarLocal(this.priv, caminho, null); }
      this.compor(); emit('estado', this.s);
      return Promise.all(ops.map(([c, x]) => Rede.set(c, x))).catch(erroGravacao);
    }
    aplicarLocal(this.pub, caminho, valor); this.compor(); emit('estado', this.s);
    return Rede.set('estado/' + caminho.join('/'), valor).catch(erroGravacao);
  },
};
function aplicarLocal(obj, caminho, valor) {
  let o = obj;
  for (let i = 0; i < caminho.length - 1; i++) { if (!o[caminho[i]] || typeof o[caminho[i]] !== 'object') o[caminho[i]] = {}; o = o[caminho[i]]; }
  const k = caminho[caminho.length - 1];
  if (valor === null || valor === undefined) delete o[k]; else o[k] = copia(valor);
}
const permissoes = [];
function permitir(fn) { permissoes.push(fn); }
function recusa(caminho, valor) {
  for (const fn of permissoes) { try { const r = fn(caminho, valor, P); if (r === true) return ''; if (typeof r === 'string') return r; } catch (e) {} }
  if (caminho[0] === 'tokens' && caminho.length === 2) {
    const atual = (Estado.s.tokens || {})[caminho[1]];
    if (!atual || !valor) return 'Só o Guardião da Luz coloca ou tira peças do mapa.';
    if (P.aux && atual.tipo !== 'pc') return '';
    if (!P.pc || caminho[1] !== P.pc) return 'Você só pode mover o seu próprio personagem.';
    if (valor.id !== atual.id || !!valor.h !== !!atual.h || valor.tipo !== atual.tipo) return 'Só o Guardião da Luz muda isso.';
    return '';
  }
  return 'Só o Guardião da Luz pode fazer isso.';
}

/* ---------- Segredos (só o Mestre) e Privado (Mestre e auxiliares) ---------- */
const Segredos = {
  dados: {}, pronto: false, off: null,
  ligar(sim) {
    if (sim && !this.off) this.off = Rede.on('segredos', x => { this.dados = x || {}; this.pronto = true; emit('segredos', this.dados); }, () => {});
    if (!sim && this.off) { this.off(); this.off = null; this.dados = {}; this.pronto = false; emit('segredos', this.dados); }
  },
  ler(caminho) { let o = this.dados; for (const k of (typeof caminho === 'string' ? caminho.split('/') : caminho)) { if (o == null) return null; o = o[k]; } return o === undefined ? null : o; },
  gravar(caminho, valor) {
    if (typeof caminho === 'string') caminho = caminho.split('/').filter(Boolean);
    if (valor === '' || valor === undefined) valor = null;
    aplicarLocal(this.dados, caminho, valor); emit('segredos', this.dados);
    return Rede.set('segredos/' + caminho.join('/'), valor).catch(erroGravacao);
  },
};
const Priv = {
  dados: {}, pronto: false, off: null,
  ligar(sim) {
    if (sim && !this.off) this.off = Rede.on('privado', x => { this.dados = x || {}; this.pronto = true; Estado.priv = this.dados; Estado.compor(); emit('privado', this.dados); emit('estado', Estado.s); }, () => {});
    if (!sim && this.off) { this.off(); this.off = null; this.dados = {}; this.pronto = false; Estado.priv = {}; Estado.compor(); emit('estado', Estado.s); }
  },
  gravar(caminho, valor) {
    if (typeof caminho === 'string') caminho = caminho.split('/').filter(Boolean);
    aplicarLocal(this.dados, caminho, valor);
    return Rede.set('privado/' + caminho.join('/'), valor === '' ? null : valor).catch(erroGravacao);
  },
};

/* ---------- conexão ---------- */
function carregarScript(src) {
  return new Promise((ok, falha) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = falha; document.head.appendChild(s); });
}
async function conectar() {
  if (typeof FIREBASE === 'undefined' || !FIREBASE) { Rede.modo = 'local'; Rede.iniciarLocal(); return 'local'; }
  const vv = '10.12.2';
  try {
    await carregarScript(`https://www.gstatic.com/firebasejs/${vv}/firebase-app-compat.js`);
    await carregarScript(`https://www.gstatic.com/firebasejs/${vv}/firebase-auth-compat.js`);
    await carregarScript(`https://www.gstatic.com/firebasejs/${vv}/firebase-database-compat.js`);
  } catch (e) { Rede.modo = 'local'; Rede.iniciarLocal(); aviso('Sem conexão com a base estadual: modo local.', 'erro'); return 'local'; }
  Rede.modo = 'firebase';
  try { firebase.app(); } catch (e) { firebase.initializeApp(FIREBASE); }
  Rede.db = firebase.database(); Rede.auth = firebase.auth();
  try { await Rede.auth.setPersistence(firebase.auth.Auth.Persistence.SESSION); } catch (e) {}
  Rede.db.ref('.info/connected').on('value', s => { Rede.conectado = !!s.val(); mostrarConexao(); });
  // espera o login guardado (no máximo 12 s, para nunca travar a tela de início)
  await Promise.race([new Promise(ok => { const off = Rede.auth.onAuthStateChanged(u => { off(); ok(u); }); }), new Promise(ok => setTimeout(ok, 12000))]);
  Rede.auth.onAuthStateChanged(u => aoMudarConta(u));
  return 'firebase';
}
function contaAtual() { return Rede.fb() ? Rede.auth.currentUser : null; }
const EMAIL_AUX = (typeof CRW_EMAIL_AUX === 'string' ? CRW_EMAIL_AUX : 'auxiliares@crowsrest.com').toLowerCase();
const UID_MESTRE = typeof CRW_UID_MESTRE === 'string' ? CRW_UID_MESTRE : '';
const AUX_LIGADOS = typeof CRW_AUXILIARES === 'undefined' ? true : !!CRW_AUXILIARES;
function tipoConta(u) {
  if (!u || u.isAnonymous) return 'anon';
  if (AUX_LIGADOS && (u.email || '').toLowerCase() === EMAIL_AUX) return 'aux';
  // só a conta do Guardião (pelo UID) é Mestre; qualquer outra conta de e-mail não tem papel
  return !UID_MESTRE || u.uid === UID_MESTRE ? 'mestre' : 'outra';
}
function aoMudarConta(u) {
  const t = tipoConta(u), pf = lerPerfil();
  if (pf === 'mestre' && t !== 'mestre' && iniciou) { definirPerfil(''); mostrarLogin(); }
  if (pf.startsWith('aux') && t !== 'aux' && t !== 'mestre' && iniciou) { definirPerfil(''); mostrarLogin(); }
}
let jaConectou = false;
function mostrarConexao() {
  const s = $('#syncStatus'); if (!s) return;
  if (!Rede.fb()) { s.textContent = '● MODO LOCAL'; s.className = 'tb-sync local'; return; }
  if (Rede.conectado) jaConectou = true;
  s.textContent = Rede.conectado ? '● AO VIVO' : (jaConectou ? '○ RECONECTANDO' : '○ CONECTANDO');
  s.className = 'tb-sync ' + (Rede.conectado ? 'vivo' : 'off');
  const f = $('#faixaConexao'); if (f) f.hidden = !jaConectou || Rede.conectado || TV;
}

/* =========================================================
   AVISOS, ALERTAS E JANELAS
   ========================================================= */
let avisoT = null;
function aviso(txt, tipo) {
  const a = $('#aviso'); if (!a) return;
  a.textContent = txt; a.className = 'aviso ' + (tipo || ''); a.hidden = false;
  clearTimeout(avisoT); avisoT = setTimeout(() => { a.hidden = true; }, 4200);
  const sb = $('#sbStatus'); if (sb) sb.textContent = txt;
  if (tipo === 'erro') Som.erro();
}
// alertas do Mestre: avisos que ficam até ele fechar; iguais em sequência viram um só
function alertaMestre(txt, chave) {
  if (!P.mestre) return;
  const c = $('#alertasMestre'); if (!c) return;
  const ja = chave && $$('.alerta-m', c).find(x => x.dataset.k === chave && Date.now() - +x.dataset.t < 20000);
  if (ja) { $('span', ja).textContent = txt; ja.dataset.t = Date.now(); return; }
  const d = el('div', 'alerta-m', `<span>${esc(txt)}</span><button aria-label="Fechar">×</button>`);
  if (chave) d.dataset.k = chave; d.dataset.t = Date.now();
  $('button', d).onclick = () => { d.remove(); arrumarAlertas(); };
  c.prepend(d); arrumarAlertas();
  setTimeout(() => { d.remove(); arrumarAlertas(); }, 30000);
  Som.tom(740, 0, 0.16, 'square', 0.08); Som.tom(988, 0.18, 0.22, 'square', 0.08);
}
function arrumarAlertas() {
  const c = $('#alertasMestre'); if (!c) return;
  const n = $$('.alerta-m', c).length; let t = $('.alertas-todos', c);
  if (n >= 2) { if (!t) { t = el('button', 'alertas-todos w95-btn'); t.onclick = () => { c.innerHTML = ''; }; c.appendChild(t); } t.textContent = `Fechar todos (${n})`; }
  else if (t) t.remove();
}

/* Janela no estilo Windows 95. Devolve o elemento da janela.
   op: { id, titulo, html, largura, classe, modal (padrão true), aoFechar, icone } */
function janela(op) {
  const id = op.id || ('j' + chaveLocal());
  fecharJanela(id, true);
  const fundo = el('div', 'jan-fundo' + (op.modal === false ? ' sem-fundo' : ''));
  fundo.dataset.jan = id;
  const w = el('div', 'win jan ' + (op.classe || ''));
  if (op.largura) w.style.width = op.largura;
  w.innerHTML = `<div class="titlebar"><span class="tb-title">${op.icone ? `<span class="tb-ico">${op.icone}</span>` : '<svg class="tb-seal"><use href="#seal"></use></svg>'} ${esc(op.titulo || '')}</span><span class="tb-btns"><b class="tbx x" data-fechar aria-label="Fechar" role="button">✕</b></span></div><div class="jan-corpo"></div>`;
  const corpo = $('.jan-corpo', w);
  if (typeof op.html === 'string') corpo.innerHTML = op.html; else if (op.html) corpo.appendChild(op.html);
  fundo.appendChild(w);
  fundo.addEventListener('click', e => {
    if (e.target.closest('[data-fechar]') || (e.target === fundo && op.fecharFora !== false)) fecharJanela(id);
  });
  fundo._aoFechar = op.aoFechar;
  $('#janelas').appendChild(fundo);
  emit('janela', { id, aberta: true });
  return w;
}
function fecharJanela(id, quieto) {
  $$(`#janelas [data-jan="${id}"]`).forEach(f => { if (!quieto && f._aoFechar) { try { f._aoFechar(); } catch (e) {} } f.remove(); });
  if (!quieto) emit('janela', { id, aberta: false });
}
const janelaAberta = id => !!$(`#janelas [data-jan="${id}"]`);
// caixa de mensagem (ok/cancelar), no lugar do confirm() do navegador
function confirmar(txt, op = {}) {
  return new Promise(ok => {
    const w = janela({ titulo: op.titulo || 'SIIC', classe: 'msgbox', largura: '380px', fecharFora: false,
      html: `<div class="msg"><span class="msg-ico ${op.icone || 'q'}"></span><div class="msg-txt">${op.html ? txt : esc(txt).replace(/\n/g, '<br>')}</div></div>
        <div class="msg-bts"><button class="w95-btn" data-r="1">${esc(op.ok || 'OK')}</button>${op.soOk ? '' : `<button class="w95-btn" data-r="0">${esc(op.cancelar || 'Cancelar')}</button>`}</div>`,
      aoFechar: () => ok(false) });
    Som.ding();
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (!b) return; const r = b.dataset.r === '1'; w.parentElement._aoFechar = null; fecharJanela(w.parentElement.dataset.jan); ok(r); });
    setTimeout(() => { const b = $('[data-r="1"]', w); b && b.focus(); }, 30);
  });
}
function alerta(txt, titulo) { return confirmar(txt, { titulo, soOk: true, icone: 'i' }); }
function pedirTexto(rotulo, padrao, op = {}) {
  return new Promise(ok => {
    const w = janela({ titulo: op.titulo || 'SIIC', classe: 'msgbox', largura: '400px', fecharFora: false,
      html: `<label class="campo">${esc(rotulo)}${op.longo ? `<textarea class="w95-input" rows="5">${esc(padrao || '')}</textarea>` : `<input class="w95-input" type="${op.tipo || 'text'}" value="${esc(padrao || '')}">`}</label>
        <div class="msg-bts"><button class="w95-btn" data-r="1">OK</button><button class="w95-btn" data-r="0">Cancelar</button></div>`,
      aoFechar: () => ok(null) });
    const inp = $('input, textarea', w);
    const fim = r => { w.parentElement._aoFechar = null; fecharJanela(w.parentElement.dataset.jan); ok(r ? inp.value : null); };
    w.addEventListener('click', e => { const b = e.target.closest('[data-r]'); if (b) fim(b.dataset.r === '1'); });
    inp.addEventListener('keydown', e => { if (e.key === 'Enter' && !op.longo) fim(true); });
    setTimeout(() => { inp.focus(); inp.select && inp.select(); }, 30);
  });
}

/* =========================================================
   SONS (sintetizados; nada de arquivo de áudio)
   ========================================================= */
const Som = {
  ctx: null, ligado: ls.get('som', true),
  pronto() {
    if (!this.ligado) return null;
    try { if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); if (this.ctx.state === 'suspended') this.ctx.resume(); } catch (e) { return null; }
    return this.ctx;
  },
  tom(freq, t0 = 0, dur = 0.2, tipo = 'sine', vol = 0.12) {
    const c = this.pronto(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + t0;
    o.type = tipo; o.frequency.setValueAtTime(freq, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.05);
  },
  ruido(t0 = 0, dur = 0.5, vol = 0.08, filtro = 1800, tipo = 'bandpass') {
    const c = this.pronto(); if (!c) return;
    const n = Math.max(1, Math.floor(c.sampleRate * dur)), b = c.createBuffer(1, n, c.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + t0;
    s.buffer = b; f.type = tipo; f.frequency.value = filtro; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(c.destination); s.start(t); s.stop(t + dur + 0.05);
  },
  ding() { this.tom(1318, 0, 0.35, 'sine', 0.1); this.tom(1760, 0.01, 0.4, 'sine', 0.05); },
  erro() { this.tom(220, 0, 0.25, 'square', 0.07); this.tom(196, 0.12, 0.3, 'square', 0.06); },
  clique() { this.tom(2000, 0, 0.02, 'square', 0.03); },
  // o acorde de abertura do sistema
  abertura() { [261.6, 329.6, 392, 523.2].forEach((f, i) => this.tom(f, i * 0.12, 1.6 - i * 0.2, 'triangle', 0.07)); this.tom(130.8, 0, 2, 'sine', 0.06); },
  // discagem de modem: tons DTMF, chiado e o "aperto de mão"
  modem() {
    const dtmf = [[697, 1209], [770, 1336], [852, 1477], [941, 1336], [697, 1477], [770, 1209], [852, 1336]];
    dtmf.forEach(([a, b], i) => { this.tom(a, i * 0.11, 0.08, 'sine', 0.05); this.tom(b, i * 0.11, 0.08, 'sine', 0.05); });
    this.tom(2100, 0.9, 0.6, 'sine', 0.04); this.tom(1650, 1.5, 0.35, 'square', 0.025); this.tom(1850, 1.85, 0.35, 'square', 0.025);
    this.ruido(1.2, 1.2, 0.04, 2400); this.tom(980, 2.4, 0.5, 'sawtooth', 0.02); this.ruido(2.9, 0.6, 0.03, 3200);
  },
  pager() { [0, 0.18, 0.36].forEach(t => this.tom(2900, t, 0.12, 'square', 0.05)); },
  telefone() { [0, 0.45].forEach(t => { this.tom(440, t, 0.4, 'sine', 0.05); this.tom(480, t, 0.4, 'sine', 0.05); }); },
  fax() { this.tom(1100, 0, 0.5, 'sine', 0.04); this.tom(2100, 0.6, 0.9, 'sine', 0.04); this.ruido(1.5, 1.2, 0.03, 1500); },
  radio() { this.ruido(0, 0.35, 0.06, 1200); this.tom(1000, 0.33, 0.06, 'sine', 0.04); },
  sirene() { const c = this.pronto(); if (!c) return; const o = c.createOscillator(), g = c.createGain(), t = c.currentTime; o.type = 'sawtooth'; o.frequency.setValueAtTime(600, t); for (let i = 0; i < 6; i++) { o.frequency.linearRampToValueAtTime(950, t + i * 0.6 + 0.3); o.frequency.linearRampToValueAtTime(600, t + i * 0.6 + 0.6); } g.gain.setValueAtTime(0.03, t); g.gain.linearRampToValueAtTime(0.0001, t + 3.6); o.connect(g).connect(c.destination); o.start(t); o.stop(t + 3.7); },
  impressora() { for (let i = 0; i < 14; i++) { this.ruido(i * 0.12, 0.09, 0.05, 900 + (i % 3) * 300); this.tom(180, i * 0.12, 0.05, 'square', 0.015); } },
  corvo() { const c = this.pronto(); if (!c) return; [0, 0.35].forEach(t0 => { const o = c.createOscillator(), g = c.createGain(), f = c.createBiquadFilter(), t = c.currentTime + t0; o.type = 'sawtooth'; o.frequency.setValueAtTime(820, t); o.frequency.exponentialRampToValueAtTime(380, t + 0.25); f.type = 'bandpass'; f.frequency.value = 1200; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28); o.connect(f).connect(g).connect(c.destination); o.start(t); o.stop(t + 0.3); }); this.ruido(0, 0.25, 0.03, 2500); },
  alternar() { this.ligado = !this.ligado; ls.set('som', this.ligado); if (this.ligado) { this.pronto(); this.ding(); } emit('som', this.ligado); return this.ligado; },
};
['pointerdown', 'keydown'].forEach(ev => window.addEventListener(ev, () => { if (Som.ligado && Som.ctx && Som.ctx.state === 'suspended') Som.ctx.resume(); }, { passive: true }));

/* =========================================================
   RELÓGIO DO JOGO
   estado/relogio = { min (minutos desde 00:00 do dia), data 'dd/mm/1997',
   rodando, vel (minutos de jogo por minuto real), ts (quando foi definido) }.
   Sem relógio definido, mostra a hora do computador e a data inicial do caso.
   ========================================================= */
function relogio() {
  const r = Estado.s.relogio;
  if (!r || r.min == null) { const d = new Date(); return { h: d.getHours(), m: d.getMinutes(), s: d.getSeconds(), data: (typeof CASO !== 'undefined' ? CASO.dataInicial : '21/05/1997'), real: true, minDia: d.getHours() * 60 + d.getMinutes() }; }
  let min = num(r.min);
  if (r.rodando) min += (Date.now() - num(r.ts, Date.now())) / 60000 * num(r.vel, 1);
  let data = r.data || (typeof CASO !== 'undefined' ? CASO.dataInicial : '21/05/1997');
  while (min >= 1440) { min -= 1440; data = proximoDia(data); }
  const h = Math.floor(min / 60), m = Math.floor(min % 60), s = Math.floor((min * 60) % 60);
  return { h, m, s, data, real: false, minDia: Math.floor(min) };
}
function proximoDia(d) {
  const [dd, mm, aa] = String(d).split('/').map(Number); const x = new Date(aa || 1997, (mm || 1) - 1, (dd || 1) + 1);
  return `${pad2(x.getDate())}/${pad2(x.getMonth() + 1)}/${x.getFullYear()}`;
}
const DIAS = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado'];
function diaSemana(d) { const [dd, mm, aa] = String(d).split('/').map(Number); return DIAS[new Date(aa || 1997, (mm || 1) - 1, dd || 1).getDay()]; }
const ehNoite = r => { r = r || relogio(); return r.h >= 20 || r.h < 6; };
function tickRelogio() {
  const r = relogio(), t = `${pad2(r.h)}:${pad2(r.m)}`;
  $$('[data-relogio]').forEach(e => { e.textContent = t; });
  $$('[data-data]').forEach(e => { e.textContent = r.data; });
  const sb = $('#sbClock'); if (sb) sb.textContent = `${t}:${pad2(r.s)}`;
  emit('tick', r);
}

/* =========================================================
   PRESENÇA, DIÁRIO DO MESTRE
   ========================================================= */
let presTimer = null;
function marcarPresenca() {
  clearInterval(presTimer);
  const id = P.mestre ? 'mestre' : P.aux ? 'aux-' + (P.nomeAux || 'aux').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12) : P.pc;
  if (!id || TV) return;
  const bater = () => Rede.set('presenca/' + id, { ts: Date.now(), n: P.mestre ? 'Guardião da Luz' : P.aux ? (P.nomeAux || 'Auxiliar') : (pc(P.pc) || {}).nome || P.pc }).catch(() => {});
  bater(); presTimer = setInterval(bater, 45000);
}
function sessaoId() { const r = relogio(); return (Estado.s.sessao && Estado.s.sessao.id) || ('d' + r.data.replace(/\//g, '')); }
function diario(tipo, txt) {
  if (!P.mestre) return;
  const r = relogio();
  Rede.push('segredos/_diario/' + sessaoId(), { t: tipo, x: String(txt).slice(0, 400), ts: Date.now(), h: `${pad2(r.h)}:${pad2(r.m)}`, d: r.data });
}

/* =========================================================
   PERSONAGENS E PEÇAS
   estado/pcs: personagens dos jogadores (o Mestre cadastra).
   NPCs: dados.js (públicos) + estado/npcs (os que o Mestre cria).
   ========================================================= */
function pcs() { return Object.entries(Estado.s.pcs || {}).map(([id, x]) => ({ id, ...x, tipo: 'pc' })).sort((a, b) => num(a.ordem, 99) - num(b.ordem, 99) || String(a.nome).localeCompare(String(b.nome))); }
function pc(id) { const x = (Estado.s.pcs || {})[id]; return x ? { id, ...x, tipo: 'pc' } : null; }
function npcs() {
  const base = (typeof NPCS !== 'undefined' ? NPCS : []).map(x => ({ ...x }));
  const extra = Object.entries(Estado.s.npcs || {}).map(([id, x]) => ({ id, ...x }));
  const priv = veTudo() ? Object.entries((Priv.dados && Priv.dados.npcs) || {}).map(([id, x]) => ({ id, ...x, oculto: true })) : [];
  const m = new Map(); [...base, ...extra, ...priv].forEach(x => m.set(x.id, { ...(m.get(x.id) || {}), ...x }));
  return [...m.values()];
}
function ser(id) { return pc(id) || npcs().find(x => x.id === id) || null; }
const iniciais = n => String(n || '?').replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || '?';


/* =========================================================
   AJUDA ("Como Usar"): cada módulo explica o que faz
   a: { id, titulo, ordem, para: ['todos'] | ['mestre'] | ['jog','aux',...], html }
   ========================================================= */
const ajudasL = [];
function registrarAjuda(a) { a.ordem = num(a.ordem, 50); a.para = a.para || ['todos']; const i = ajudasL.findIndex(x => x.id === a.id); if (i >= 0) ajudasL[i] = a; else ajudasL.push(a); emit('ajuda', a); }
function ajudas() { return ajudasL.slice().sort((a, b) => a.ordem - b.ordem); }

/* =========================================================
   O QUE PODE SER ZERADO NO "RESTAURAR" (o painel do Mestre lista)
   r: { id, nome, padrao, nos:[], estado:[], priv:[], seg:[], fazer: async fn }
   ========================================================= */
const restauracoesL = [];
function registrarRestauracao(r) { restauracoesL.push(r); }
const restauracoes = () => restauracoesL.slice();

/* =========================================================
   SANGRIA DA CIDADE (0 a 10) · lida por todos os módulos
   estado/sangria = { nivel, ... } (sessao.js grava)
   ========================================================= */
const sangria = () => clamp(int((Estado.s.sangria || {}).nivel, 0), 0, 10);

/* =========================================================
   FICHAS, CHAVES E ENTREGAS
   Cada investigador tem uma "chave" longa (32 letras) guardada no aparelho
   dele. A ficha mora em fichas/<chave>; entregas do Mestre para ele
   (itens, bipes, distintivos) chegam em entregas/<chave>/<id>.
   O Mestre e os auxiliares leem todas as fichas (só leitura).
   ========================================================= */
const Fichas = {
  todas: {}, off: null, minha: null, offMinha: null,
  ligar() {
    if (this.off) { this.off(); this.off = null; }
    if (this.offMinha) { this.offMinha(); this.offMinha = null; }
    this.todas = {}; this.minha = null;
    if (P.mestre || P.aux) this.off = Rede.on('fichas', x => { this.todas = x || {}; emit('fichas', this.todas); }, () => {});
    else if (P.pc) {
      const k = minhaChave();
      this.offMinha = Rede.on('fichas/' + k, x => { this.minha = x; emit('minhaFicha', x); }, () => {});
      ouvirEntregas(k);
    }
  },
};
function minhaChave(pcid) {
  pcid = pcid || P.pc; if (!pcid) return null;
  let k = ls.get('chave:' + pcid, null);
  if (!k || String(k).length < 24) {
    k = chaveLonga(); ls.set('chave:' + pcid, k);
    const p = pc(pcid) || {};
    Rede.set('fichas/' + k, { pc: pcid, nome: p.nome || pcid, criada: Date.now(), ts: Date.now() }).catch(() => {});
  }
  return k;
}
// troca a chave deste aparelho (recuperar a ficha em outro celular)
function usarChave(k, pcid) { pcid = pcid || P.pc; if (!pcid || !k || String(k).length < 24) return false; ls.set('chave:' + pcid, String(k).trim()); Fichas.ligar(); return true; }
function fichas() { return Object.entries(Fichas.todas || {}).map(([k, f]) => ({ chave: k, ...(f || {}) })); }
// a ficha mais recente de um investigador (para o Mestre)
function chaveDoPC(pcid) { const l = fichas().filter(f => f.pc === pcid).sort((a, b) => num(b.ts) - num(a.ts)); return l.length ? l[0].chave : null; }
function fichaDoPC(pcid) { const k = chaveDoPC(pcid); return k ? { chave: k, ...Fichas.todas[k] } : null; }
// Mestre entrega algo a um investigador: CRW.entregar('adamarlowe', { tipo: 'pager', ... })
function entregar(pcid, obj) {
  const k = chaveDoPC(pcid);
  if (!k) { aviso('Esse investigador ainda não abriu o site neste caso (sem ficha): a entrega fica impossível.', 'erro'); return null; }
  return Rede.push('entregas/' + k, { ...obj, ts: Date.now() });
}
const entregaH = {};
function aoEntregar(tipo, fn) { (entregaH[tipo] = entregaH[tipo] || []).push(fn); }
let offEnt = null;
function ouvirEntregas(k) {
  if (offEnt) offEnt();
  offEnt = Rede.on('entregas/' + k, x => {
    Object.entries(x || {}).forEach(([id, e]) => {
      if (!e) return;
      const caixa = ls.get('caixa:' + P.pc, []);
      if (!caixa.some(c => c.id === id)) { caixa.push({ id, ...e, recebida: Date.now() }); ls.set('caixa:' + P.pc, caixa.slice(-200)); }
      (entregaH[e.tipo] || []).forEach(fn => { try { fn({ id, ...e }); } catch (er) { console.warn('entrega ' + e.tipo, er); } });
      emit('entrega', { id, ...e });
      Rede.set('entregas/' + k + '/' + id, null).catch(() => {});
    });
  }, () => {});
}
// caixa de entrada local do investigador (tudo o que já recebeu)
const caixa = () => ls.get('caixa:' + P.pc, []);


/* ---------- seções do Cartão do Local (mapa) ----------
   Outros módulos acrescentam coisas ao cartão de um lote:
   CRW.registrarCartao({ id, ordem, render(lote, corpo, v) }) ; lote = objeto de LOTES (+ id) */
const cartoesL = [];
function registrarCartao(c) { c.ordem = num(c.ordem, 50); cartoesL.push(c); }
const cartoes = () => cartoesL.slice().sort((a, b) => a.ordem - b.ordem);

/* ---------- pedidos dos jogadores ao Mestre ----------
   CRW.pedir('lab', { item: 'E-04', ... }) grava em pedidos/lab/<id>
   com quem pediu e quando. O Mestre lê; os jogadores não. */
function pedir(tipo, obj) {
  const p = pc(P.pc) || {};
  return Rede.push('pedidos/' + tipo, { ...obj, pc: P.pc || null, nome: P.aux ? (P.nomeAux || 'Auxiliar') : (p.nome || ''), ts: Date.now() });
}

/* =========================================================
   ARQUIVOS: imagens reduzidas, baixar, imprimir
   ========================================================= */
function lerImagem(file, max = 1000, q = 0.82) {
  return new Promise((ok, falha) => {
    if (!file) return falha(new Error('sem arquivo'));
    const r = new FileReader();
    r.onload = () => {
      if (!/^image\//.test(file.type) || /svg|gif/.test(file.type)) return ok(r.result);
      const im = new Image();
      im.onload = () => { const k = Math.min(1, max / Math.max(im.width, im.height)); const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', q)); };
      im.onerror = () => ok(r.result); im.src = r.result;
    };
    r.onerror = () => falha(r.error); r.readAsDataURL(file);
  });
}
function lerTexto(file) { return new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsText(file); }); }
function baixar(nome, conteudo, tipo = 'text/plain;charset=utf-8') {
  const b = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const a = el('a'); a.href = URL.createObjectURL(b); a.download = nome; document.body.appendChild(a); a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
}
// impressora matricial: abre uma página com papel de formulário contínuo e manda imprimir (ou salvar em PDF)
function imprimir(titulo, corpoHtml, op = {}) {
  Som.impressora();
  const w = window.open('', '_blank');
  if (!w) { aviso('O navegador bloqueou a janela de impressão. Libere pop-ups para este site.', 'erro'); return; }
  const r = relogio();
  w.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(titulo)}</title>
  <style>@page{size:A4;margin:14mm 16mm}body{font:12.5px/1.55 "Courier New",Courier,monospace;color:#1c1c1c;margin:0;background:#fff}
  .papel{background:repeating-linear-gradient(#fff 0 24px,#eef5ee 24px 48px);padding:18px 26px;border-left:14px dotted #ccc;border-right:14px dotted #ccc}
  h1{font-size:17px;letter-spacing:.12em;margin:0 0 4px;text-transform:uppercase}h2{font-size:14px;letter-spacing:.08em;margin:18px 0 6px;text-transform:uppercase;border-bottom:1px dashed #555}
  .cab{display:flex;justify-content:space-between;border-bottom:2px solid #222;padding-bottom:6px;margin-bottom:12px}.mini{font-size:11px;color:#555}
  table{border-collapse:collapse;width:100%}td,th{border:1px solid #888;padding:3px 6px;text-align:left;vertical-align:top}img{max-width:100%}
  .ass{margin-top:40px;display:flex;gap:40px}.ass div{flex:1;border-top:1px solid #222;padding-top:4px;text-align:center;font-size:11px}
  @media print{.papel{border:0;padding:0;background:none}}</style></head><body><div class="papel">
  <div class="cab"><div><h1>${esc(op.cabecalho || 'Departamento do Xerife do Condado de Crowsrest')}</h1><div class="mini">SIIC · Sistema Integrado de Investigação Criminal · ${esc(op.sub || 'Formulário CCSO')}</div></div>
  <div class="mini" style="text-align:right">Emitido em ${esc(r.data)} ${pad2(r.h)}:${pad2(r.m)}<br>Caso ${typeof CASO !== 'undefined' ? CASO.numero : ''}</div></div>
  ${corpoHtml}</div><script>setTimeout(()=>print(),400)<\/script></body></html>`);
  w.document.close();
}

/* =========================================================
   MÓDULOS DO MENU E PAINEL DO MESTRE
   ========================================================= */
const GRUPOS = [
  ['sistema', 'Sistema'], ['caso', 'Caso 24-1187'], ['investigacao', 'Investigação do grupo'],
  ['pessoal', 'Meu personagem'], ['mestre', 'Guardião da Luz'],
];
const modulos = [];
let moduloAtual = null;
/* m: { id, titulo, grupo, icone, ordem, render(corpo), aoAbrir(corpo), visivel(v) -> bool,
        cheio (true: ocupa a área toda, sem cabeçalho do caso) } */
function registrarModulo(m) { m.ordem = num(m.ordem, 50); modulos.push(m); if (iniciou) montarMenu(); }
function moduloVisivel(m) { try { return m.visivel ? !!m.visivel(v()) : true; } catch (e) { return false; } }
function montarMenu() {
  const nav = $('#nav'); if (!nav) return;
  const atual = moduloAtual;
  nav.innerHTML = '';
  GRUPOS.forEach(([g, nome]) => {
    const ms = modulos.filter(m => m.grupo === g && moduloVisivel(m)).sort((a, b) => a.ordem - b.ordem);
    if (!ms.length) return;
    nav.appendChild(el('div', 'seclbl', esc(nome)));
    ms.forEach(m => {
      const b = el('button', 'nav' + (m.id === atual ? ' active' : ''), `<span class="nico">${m.icone || '▪'}</span><span class="nav-t">${esc(m.titulo)}</span><span class="nav-badge" data-badge="${m.id}" hidden></span>`);
      b.dataset.m = m.id;
      b.addEventListener('click', () => { abrirModulo(m.id); fecharGaveta(); });
      nav.appendChild(b);
    });
  });
  atualizarBadges();
}
const badges = {};
function badge(id, n) { badges[id] = n; atualizarBadges(); }
function atualizarBadges() {
  $$('[data-badge]').forEach(b => { const n = badges[b.dataset.badge]; b.hidden = !n; b.textContent = n > 99 ? '99+' : n; });
  const tot = Object.entries(badges).reduce((s, [k, n]) => s + (k !== moduloAtual ? num(n) : 0), 0);
  const g = $('#btnGaveta .nav-badge'); if (g) { g.hidden = !tot; g.textContent = tot; }
}
function abrirModulo(id, quieto) {
  const m = modulos.find(x => x.id === id && moduloVisivel(x)) || modulos.find(x => moduloVisivel(x));
  if (!m) return;
  moduloAtual = m.id;
  ls.set('modulo', m.id);
  $$('#nav .nav').forEach(b => b.classList.toggle('active', b.dataset.m === m.id));
  const main = $('#main');
  let sec = $('#mod-' + m.id);
  if (!sec) {
    sec = el('section', 'mod'); sec.id = 'mod-' + m.id;
    $('#modulos').appendChild(sec);
    try { m.render && m.render(sec); } catch (e) { console.error('módulo ' + m.id, e); sec.innerHTML = '<p class="tx">Erro ao abrir este módulo.</p>'; }
  }
  $$('#modulos > .mod').forEach(s => s.classList.toggle('show', s === sec));
  document.body.classList.toggle('mod-cheio', !!m.cheio);
  main.scrollTop = 0;
  const sb = $('#sbModule'); if (sb) sb.textContent = m.titulo;
  if (!quieto) Som.clique();
  try { m.aoAbrir && m.aoAbrir(sec); } catch (e) { console.error('módulo ' + m.id, e); }
  emit('modulo', m.id);
  atualizarBadges();
}
// redesenha um módulo (quando o conteúdo depende do papel)
function refazerModulo(id) { const s = $('#mod-' + id); if (s) s.remove(); if (moduloAtual === id) abrirModulo(id, true); }

/* Blocos do painel do Mestre: { id, aba, titulo, ordem, render(corpo), aux (true: auxiliares também veem) } */
const ABAS_MESTRE = [['mapa', 'Mapa'], ['sessao', 'Sessão'], ['mesa', 'Mesa'], ['registro', 'Registro'], ['segredos', 'Segredos']];
const blocosMestre = [];
function registrarMestre(b) { b.ordem = num(b.ordem, 50); blocosMestre.push(b); if (iniciou && $('#mod-mestre')) refazerModulo('mestre'); }
let abaMestre = ls.get('abaMestre', 'mapa');
function renderMestre(sec) {
  const ehM = P.mestre && !P.espiar;
  sec.innerHTML = `<div class="panel mestre-painel"><div class="panel-h"><h2>Painel do Guardião da Luz</h2><div class="meta">${ehM ? 'acesso total' : 'auxiliar'}</div></div>
    <div class="abas95" role="tablist">${ABAS_MESTRE.filter(([a]) => ehM || blocosMestre.some(b => b.aba === a && b.aux)).map(([a, n]) => `<button class="aba95${a === abaMestre ? ' on' : ''}" data-aba="${a}">${n}</button>`).join('')}</div>
    <div class="panel-b mestre-corpo"></div></div>`;
  const corpo = $('.mestre-corpo', sec);
  const desenhar = () => {
    corpo.innerHTML = '';
    const bs = blocosMestre.filter(b => b.aba === abaMestre && (ehM || b.aux)).sort((a, b) => a.ordem - b.ordem);
    if (!bs.length) corpo.innerHTML = '<p class="tx dim">Nada aqui ainda.</p>';
    bs.forEach(b => {
      const d = el('details', 'bloco95'); d.open = ls.get('bloco-' + b.id, true);
      d.innerHTML = `<summary>${esc(b.titulo)}</summary><div class="bloco95-c"></div>`;
      d.addEventListener('toggle', () => ls.set('bloco-' + b.id, d.open));
      corpo.appendChild(d);
      try { b.render($('.bloco95-c', d)); } catch (e) { console.error('bloco ' + b.id, e); $('.bloco95-c', d).textContent = 'Erro neste bloco.'; }
    });
  };
  $('.abas95', sec).addEventListener('click', e => {
    const b = e.target.closest('[data-aba]'); if (!b) return;
    abaMestre = b.dataset.aba; ls.set('abaMestre', abaMestre);
    $$('.aba95', sec).forEach(x => x.classList.toggle('on', x === b)); desenhar();
  });
  desenhar();
}

/* ---------- gaveta (celular) ---------- */
function abrirGaveta() { document.body.classList.add('gaveta-aberta'); }
function fecharGaveta() { document.body.classList.remove('gaveta-aberta'); }

/* =========================================================
   LOGIN (tela de acesso ao sistema)
   ========================================================= */
let iniciou = false;
function definirPerfil(pf, nomeAux) {
  salvarPerfil(pf);
  P.mestre = pf === 'mestre';
  P.aux = pf.startsWith('aux');
  P.nomeAux = P.aux ? (nomeAux || pf.slice(4) || ls.get('nomeAux', 'Auxiliar')) : '';
  P.pc = pf.startsWith('jog:') ? pf.slice(4) : null;
  P.espiar = null;
  document.body.classList.toggle('eh-mestre', P.mestre);
  document.body.classList.toggle('eh-aux', P.aux);
  document.body.classList.toggle('eh-jog', !!P.pc);
  Segredos.ligar(P.mestre);
  Priv.ligar(P.mestre || P.aux);
  Fichas.ligar();
  const u = $('#tbUsuario');
  if (u) u.textContent = P.mestre ? 'GUARDIÃO DA LUZ' : P.aux ? ('AUX · ' + P.nomeAux).toUpperCase() : P.pc ? ((pc(P.pc) || {}).nome || P.pc).toUpperCase() : 'SEM SESSÃO';
  marcarPresenca();
  emit('perfil', v());
  if (iniciou) { $$('#modulos > .mod').forEach(s => s.remove()); montarMenu(); abrirModulo(ls.get('modulo', 'tutorial'), true); }
}
function mostrarLogin() {
  $('#app').classList.add('hidden');
  const l = $('#login'); l.classList.remove('hidden');
  desenharLogin();
}
function desenharLogin() {
  const corpo = $('#loginCorpo'); if (!corpo) return;
  const lista = pcs();
  let modo = ss.get('loginModo', 'jog'); if (modo === 'aux' && !AUX_LIGADOS) modo = 'jog';
  corpo.innerHTML = `
    <div class="lf-row"><label>Perfil:</label><select id="lgPerfil" class="w95-input">
      <option value="jog"${modo === 'jog' ? ' selected' : ''}>Investigador (jogador)</option>
      ${AUX_LIGADOS ? `<option value="aux"${modo === 'aux' ? ' selected' : ''}>Mestre Auxiliar</option>` : ''}
      <option value="mestre"${modo === 'mestre' ? ' selected' : ''}>Guardião da Luz (Mestre)</option></select></div>
    <div id="lgCampos"></div>
    <p class="lg-erro" id="lgErro" hidden></p>
    <div class="lf-actions"><button class="w95-btn" id="loginBtn">Entrar</button><button class="w95-btn" id="loginCancel">Cancelar</button></div>
    <p class="lg-mini">${Rede.fb() ? 'Conectado à base estadual.' : 'Modo local: sem internet, tudo fica neste navegador.'}</p>
    ${Rede.negado ? '<p class="lg-erro">O servidor recusou a leitura do Crowsrest. As regras do Firebase ainda não têm o bloco "crowsrest": o Guardião precisa publicar o arquivo regras-firebase-crowsrest.json no console do Firebase do projeto crowsrest-ab58b (Realtime Database, Regras) e recarregar a página.</p>' : ''}`;
  const campos = () => {
    const m = $('#lgPerfil').value; ss.set('loginModo', m);
    const c = $('#lgCampos');
    if (m === 'jog') c.innerHTML = lista.length
      ? `<div class="lf-row"><label>Usuário:</label><select id="lgPc" class="w95-input">${lista.map(x => `<option value="${esc(x.id)}">${esc(x.nome)}${x.jogador ? ' · ' + esc(x.jogador) : ''}</option>`).join('')}</select></div><div class="lf-row"><label>Caso:</label><input class="w95-input" value="${typeof CASO !== 'undefined' ? CASO.numero : ''}" readonly></div>`
      : '<p class="lg-mini">Nenhum investigador cadastrado ainda. O Guardião da Luz cadastra os personagens no painel dele (aba Mapa, "Personagens").</p>';
    else if (m === 'aux') c.innerHTML = `<div class="lf-row"><label>Nome:</label><input id="lgNomeAux" class="w95-input" value="${esc(ls.get('nomeAux', ''))}" placeholder="seu nome"></div><div class="lf-row"><label>Senha:</label><input id="lgSenha" type="password" class="w95-input" autocomplete="off"></div>`;
    else c.innerHTML = `${Rede.fb() ? `<div class="lf-row"><label>E-mail:</label><input id="lgEmail" class="w95-input" type="email" value="${esc(ls.get('emailMestre', ''))}" autocomplete="username"></div>` : ''}<div class="lf-row"><label>Senha:</label><input id="lgSenha" type="password" class="w95-input" autocomplete="current-password"></div>`;
  };
  $('#lgPerfil').addEventListener('change', campos); campos();
  corpo.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.matches('input')) $('#loginBtn').click(); });
  $('#loginCancel').onclick = () => { $('#lgErro').hidden = true; };
  $('#loginBtn').onclick = entrar;
}
async function entrar() {
  const m = $('#lgPerfil').value, erro = t => { const e = $('#lgErro'); e.textContent = t; e.hidden = false; Som.erro(); };
  try {
    if (m === 'jog') {
      const id = ($('#lgPc') || {}).value; if (!id) return erro('Escolha um investigador.');
      if (Rede.fb()) { const u = contaAtual(); if (u && !u.isAnonymous) await Rede.auth.signOut(); await garantirLogin(); }
      definirPerfil('jog:' + id);
    } else if (m === 'aux') {
      const nome = ($('#lgNomeAux').value || '').trim() || 'Auxiliar', senha = $('#lgSenha').value;
      if (!senha) return erro('Digite a senha dos auxiliares.');
      ls.set('nomeAux', nome);
      if (Rede.fb()) {
        const u = contaAtual();
        if (!(u && tipoConta(u) === 'mestre')) await Rede.auth.signInWithEmailAndPassword(EMAIL_AUX, senha);
      } else if (await hash(senha) !== CRW_SENHA_AUX) return erro('Senha incorreta.');
      definirPerfil('aux:' + nome, nome);
    } else {
      const senha = $('#lgSenha').value; if (!senha) return erro('Digite a senha.');
      if (Rede.fb()) { const email = ($('#lgEmail').value || '').trim(); ls.set('emailMestre', email); await Rede.auth.signInWithEmailAndPassword(email, senha); if (tipoConta(contaAtual()) !== 'mestre') return erro('Esta conta não é a do Mestre.'); }
      else if (await hash(senha) !== CRW_SENHA_MESTRE) return erro('Senha incorreta.');
      definirPerfil('mestre');
    }
    entrarNoApp();
  } catch (e) { erro(/password|credential|user/i.test(String(e && (e.code || e.message))) ? 'E-mail ou senha incorretos.' : 'Não foi possível entrar: ' + (e && (e.code || e.message))); }
}
function entrarNoApp() {
  $('#login').classList.add('hidden'); $('#boot').classList.add('hidden');
  $('#app').classList.remove('hidden');
  Som.abertura();
  if (!iniciou) { iniciou = true; montarMenu(); }
  abrirModulo(ls.get('modulo', 'tutorial'), true);
  emit('entrou', v());
}
async function sair() {
  if (!(await confirmar('Encerrar a sessão neste aparelho?\n\nVocê volta para a tela de acesso.'))) return;
  clearInterval(presTimer);
  const id = P.mestre ? 'mestre' : P.pc; if (id) Rede.set('presenca/' + id, null).catch(() => {});
  if (Rede.fb() && contaAtual() && !contaAtual().isAnonymous && P.mestre) { /* mantém a conta: pode voltar sem digitar de novo nesta aba */ }
  definirPerfil(''); mostrarLogin();
}

/* =========================================================
   INÍCIO
   ========================================================= */
const BOOT = () => [
  { t: 'Crowsrest County Sheriff · SIIC BIOS v4.0', c: '' },
  { t: '(C) 1997 State of West Virginia · Law Enforcement Division', c: '' },
  { t: '', c: '' },
  { t: 'Testando memória ............... 640K OK', c: 'ok' },
  { t: 'Detectando unidades ............ C: D: A:', c: 'ok' },
  { t: 'Carregando SIIC.SYS ............ OK', c: 'ok' },
  { t: 'Discando para a base estadual ..', c: '', modem: true },
];
async function iniciarInterno() {
  document.title = `SIIC · Caso ${typeof CASO !== 'undefined' ? CASO.numero : ''} · CCSO Crowsrest`;
  if (TV) document.body.classList.add('tv');
  $('#versao').textContent = 'SIIC v4.0 · ' + VERSAO;
  setInterval(tickRelogio, 1000); tickRelogio();
  // menu e botões do topo
  $('#btnGaveta').addEventListener('click', () => document.body.classList.contains('gaveta-aberta') ? fecharGaveta() : abrirGaveta());
  $('#gavetaFundo').addEventListener('click', fecharGaveta);
  $('#btnSom').addEventListener('click', () => { const l = Som.alternar(); $('#btnSom').textContent = l ? '🔊' : '🔇'; });
  $('#btnSom').textContent = Som.ligado ? '🔊' : '🔇';
  $('#btnSair').addEventListener('click', sair);
  $('#btnCasoHdr').addEventListener('click', () => { document.body.classList.toggle('casohdr-aberto'); });
  // boot com discagem real: enquanto o modem toca, o site conecta de verdade
  const log = $('#bootLog');
  const linha = (t, c) => { log.insertAdjacentHTML('beforeend', `<span class="${c || ''}">${esc(t)}</span>\n`); };
  const pular = ss.get('bootFeito', false) || TV;
  let conexao = null;
  for (const l of BOOT()) {
    if (!pular) await new Promise(r => setTimeout(r, l.t ? 170 : 60));
    if (l.modem) { linha(l.t, ''); if (!pular) Som.modem(); conexao = conectar(); }
    else linha(l.t, l.c);
  }
  const modo = await conexao;
  linha(modo === 'firebase' ? 'Conectado a 28.8 Kbps .......... OK' : 'Sem linha: MODO LOCAL ........ OK', modo === 'firebase' ? 'ok' : 'warn');
  // estado público
  // estado público: se o servidor recusar (regras sem o bloco "crowsrest") ou demorar, avisa em vez de travar
  const leitura = await new Promise(ok => {
    let primeiro = true; const fim = r => { if (primeiro) { primeiro = false; clearTimeout(t); ok(r); } };
    const t = setTimeout(() => fim('lento'), 15000);
    Rede.on('estado', x => { Estado.pub = x || {}; Estado.compor(); emit('estado', Estado.s); fim('ok'); }, e => { console.warn('leitura estado:', e && e.message); fim('negado'); });
  });
  Rede.negado = leitura === 'negado';
  if (leitura === 'negado') {
    linha('ERRO: a base estadual RECUSOU o acesso.', 'err');
    linha('  Guardião: publique no Firebase as regras com o bloco "crowsrest"', 'warn');
    linha('  (arquivo regras-firebase-crowsrest.json) e recarregue.', 'warn');
  } else if (leitura === 'lento') linha('AVISO: a base estadual não respondeu. Seguindo assim mesmo.', 'warn');
  linha('Verificando integridade do caso ' + (typeof CASO !== 'undefined' ? CASO.numero : '') + ' ...', '');
  linha('  AVISO: 4 anexos ausentes, 1 laudo alterado', 'warn');
  linha('  AVISO: acesso selado detectado no histórico', 'warn');
  mostrarConexao();
  // perfil salvo nesta aba
  const pf = lerPerfil();
  let ok = false;
  if (pf === 'mestre') ok = Rede.fb() ? tipoConta(contaAtual()) === 'mestre' : ls.get('mestreLocal', false) && ss.get('perfil', '') === 'mestre';
  else if (pf.startsWith('aux')) ok = Rede.fb() ? ['aux', 'mestre'].includes(tipoConta(contaAtual())) : ss.get('perfil', '') === pf;
  else if (pf.startsWith('jog:')) ok = !!pc(pf.slice(4));
  if (TV) { definirPerfil(''); entrarNoApp(); abrirModulo('mapa', true); return; }
  if (ok) { definirPerfil(pf); ss.set('bootFeito', true); $('#boot').classList.add('hidden'); entrarNoApp(); return; }
  linha('', ''); linha('Toque na tela ou pressione ENTER para acessar o sistema_', '');
  const ir = ev => { if (ev.type === 'keydown' && ev.key !== 'Enter') return; document.removeEventListener('keydown', ir); $('#boot').removeEventListener('click', ir); ss.set('bootFeito', true); $('#boot').classList.add('hidden'); definirPerfil(''); mostrarLogin(); };
  if (pular) ir({ type: 'click' }); else { document.addEventListener('keydown', ir); $('#boot').addEventListener('click', ir); }
}

/* Se algo der errado na inicialização, a tela de início mostra o erro em vermelho
   e deixa seguir para a tela de acesso (nunca fica preta e parada). */
function bootErro(e) {
  const log = $('#bootLog'); const b = $('#boot');
  if (!log || !b || b.classList.contains('hidden')) return;
  const msg = String((e && (e.message || e.reason && e.reason.message || e.reason)) || e || 'desconhecido').slice(0, 220);
  log.insertAdjacentHTML('beforeend', `<span class="err">ERRO NA INICIALIZAÇÃO: ${esc(msg)}</span>\n<span class="warn">Toque na tela para ir à tela de acesso. Se repetir, mande uma foto desta tela.</span>\n`);
  const ir = () => { b.removeEventListener('click', ir); document.removeEventListener('keydown', ir); b.classList.add('hidden'); try { definirPerfil(''); mostrarLogin(); } catch (er) { console.error(er); } };
  b.addEventListener('click', ir); document.addEventListener('keydown', ir);
}
window.addEventListener('error', ev => bootErro(ev.error || ev.message));
async function iniciar() { try { await iniciarInterno(); } catch (e) { console.error('inicialização:', e); bootErro(e); } }
// o modo local lembra o Mestre só nesta aba
on('perfil', x => { if (!Rede.fb()) ls.set('mestreLocal', !!x.mestre); });
on('estado', () => { if (!iniciou && !$('#login').classList.contains('hidden')) { /* lista de personagens chega depois */ const sel = $('#lgPerfil'); if (sel && sel.value === 'jog' && !$('#lgPc')) desenharLogin(); } });

/* ---------- API pública ---------- */
window.CRW = {
  VERSAO, RAIZ, TV,
  $, $$, esc, el, num, int, pad2, clamp, copia, ls, ss, hash, chaveLocal, chaveLonga,
  on, emit,
  v, ehMestre, ehAux, meuPC, veTudo, P, definirPerfil,
  Rede, Estado, Segredos, Priv, permitir, garantirLogin, contaAtual,
  aviso, alertaMestre, janela, fecharJanela, janelaAberta, confirmar, alerta, pedirTexto,
  Som, relogio, diaSemana, ehNoite, proximoDia,
  pcs, pc, npcs, ser, iniciais,
  lerImagem, lerTexto, baixar, imprimir,
  registrarModulo, abrirModulo, refazerModulo, montarMenu, badge, moduloAtual: () => moduloAtual,
  registrarMestre, renderMestre, ABAS_MESTRE,
  diario, sessaoId, marcarPresenca, sair, mostrarLogin, abrirGaveta, fecharGaveta,
  iniciar,
  registrarAjuda, ajudas, registrarRestauracao, restauracoes, sangria,
  registrarCartao, cartoes,
  Fichas, minhaChave, usarChave, fichas, chaveDoPC, fichaDoPC, entregar, aoEntregar, caixa, pedir,
};
})();
