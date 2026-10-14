/* =========================================================
   CROWSREST · investigacao.js
   Investigação do grupo (itens 23 a 27 do pedido):
   23 Sala de Interrogatório (ficha do NPC, perguntas liberadas pelo
      Mestre, fita cassete com botão de tocar e contradições)
   24 Laboratório com prazo em horas de jogo (resultado chega por fax)
   25 Coleta no local e Cadeia de Custódia
   26 Consulta às Bases no terminal (comandos de verdade, registros SELADOS)
   27 Arquivo do Condado (tarjas e rasuras) e Microfilme com lupa
   Nada de segredo neste arquivo: o que o Mestre ainda não revelou mora em
   segredos/interrog, segredos/lab, segredos/coleta, segredos/bases e
   segredos/arquivo (sementes fora do GitHub).
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, pad2, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela, ls, ss } = CRW;
const Som = CRW.Som;

/* =========================================================
   UTILIDADES
   ========================================================= */
const semAcento = s => String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '');
const chaveDe = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9_]/g, '').slice(0, 60);
const busca = s => semAcento(s).toUpperCase().replace(/[^A-Z0-9]/g, '');
const pad3 = n => String(Math.max(0, Math.floor(n)) % 1000).padStart(3, '0');
const est = k => (Estado.get() || {})[k] || {};
const conta = o => Object.keys(o || {}).length;
const lotes = () => (typeof LOTES !== 'undefined' ? LOTES : []);
const loteDe = id => lotes().find(l => l.id === id) || null;
const loteNome = id => (loteDe(id) || {}).nome || id || 'local não informado';
const evidCaso = () => (typeof CASO !== 'undefined' && CASO.evidencias) || [];
// dia corrido a partir de 01/01/1970 (para somar horas de jogo)
function diaNum(d) { const [dd, mm, aa] = String(d || '').split('/').map(Number); return Math.round(Date.UTC(aa || 1997, (mm || 1) - 1, dd || 1) / 86400000); }
function absDe(data, hora) { const [h, m] = String(hora || '0:0').split(':').map(Number); return diaNum(data) * 1440 + (h || 0) * 60 + (m || 0); }
function deAbs(abs) {
  abs = num(abs); const d = Math.floor(abs / 1440), x = new Date(d * 86400000), mi = Math.floor(abs - d * 1440);
  return { data: `${pad2(x.getUTCDate())}/${pad2(x.getUTCMonth() + 1)}/${x.getUTCFullYear()}`, hora: `${pad2(Math.floor(mi / 60))}:${pad2(mi % 60)}` };
}
function agora() { const r = CRW.relogio(); return { data: r.data, hora: `${pad2(r.h)}:${pad2(r.m)}`, abs: diaNum(r.data) * 1440 + r.h * 60 + r.m + r.s / 60 }; }
const dm = data => String(data || '').slice(0, 5);
function duracao(min) {
  min = Math.max(0, Math.ceil(min));
  const d = Math.floor(min / 1440), h = Math.floor((min % 1440) / 60), m = min % 60;
  return (d ? d + 'd ' : '') + (d || h ? h + 'h ' : '') + pad2(m) + 'min';
}
// quem está agindo (para registros do grupo)
function quem() {
  const P = CRW.P;
  if (P.pc) return { pc: P.pc, nome: (CRW.pc(P.pc) || {}).nome || P.pc };
  if (P.aux) return { pc: 'aux', nome: P.nomeAux || 'Auxiliar' };
  if (P.mestre) return { pc: 'mestre', nome: 'Guardião da Luz' };
  return { pc: null, nome: '' };
}
const logado = () => { const P = CRW.P; return !!(P.mestre || P.aux || P.pc); };
// HTML simples do Mestre: escapa tudo e devolve só algumas marcas sem atributos
function htmlSimples(t) {
  return esc(t)
    .replace(/&lt;(\/?)(b|i|u|em|strong|small|center|p|h3|h4|br|hr)\s*\/?&gt;/gi, (m, f, tag) => `<${f}${tag.toLowerCase()}>`)
    .replace(/\r?\n/g, '<br>');
}
// mantém um ouvinte vivo enquanto o nó estiver na página
function vivo(no, ev, fn) { const off = CRW.on(ev, d => { if (!document.body.contains(no)) { off(); return; } fn(d); }); return off; }
// redesenha sem perder o que a pessoa está digitando
function seguro(cont, fn) {
  const a = document.activeElement;
  const digitando = x => x && cont.contains(x) && /^(INPUT|TEXTAREA|SELECT)$/.test(x.tagName) && !/^(checkbox|button|file)$/.test(x.type);
  if (digitando(a)) {
    if (!cont._ivPend) {
      cont._ivPend = true;
      const f = () => setTimeout(() => { if (digitando(document.activeElement)) return; cont.removeEventListener('focusout', f); cont._ivPend = false; fn(); }, 80);
      cont.addEventListener('focusout', f);
    }
    return;
  }
  fn();
}
// o que cada pessoa já viu fica no aparelho, separado por perfil
const eu = () => { const P = CRW.P; return P.pc ? P.pc : P.mestre ? 'm' : P.aux ? 'a' : '_'; };
const lsg = (k, d) => ls.get(k + ':' + eu(), d);
const lss = (k, v) => ls.set(k + ':' + eu(), v);
const VISTOS = ['ivLabVisto', 'ivLabLido', 'ivColVistas', 'ivColConh', 'ivFalasVistas', 'ivRev', 'ivDocsVistos', 'ivAutPedidas', 'ivLabMeus'];
function limparVistos() { try { Object.keys(localStorage).filter(k => VISTOS.some(v => k.startsWith('crw-' + v + ':'))).forEach(k => localStorage.removeItem(k)); } catch (e) {} }
const somClique = () => Som.tom(140, 0, 0.06, 'square', 0.05);
const somRevela = () => { Som.ruido(0, 0.25, 0.04, 2600, 'highpass'); Som.tom(660, 0.05, 0.12, 'triangle', 0.05); };

/* =========================================================
   DADOS DO GRUPO E PEDIDOS (assinados depois do login)
   ========================================================= */
const C = { contr: {}, coleta: {}, consultas: {}, ped: { pergunta: {}, lab: {}, autorizacao: {} } };
let offs = [];
function ligar() {
  offs.forEach(f => { try { f(); } catch (e) {} }); offs = [];
  C.contr = {}; C.coleta = {}; C.consultas = {}; C.ped = { pergunta: {}, lab: {}, autorizacao: {} };
  const P = CRW.P;
  if (!logado()) return;
  const ouvir = (cam, fn) => offs.push(Rede.on(cam, fn, () => {}));
  ouvir('caso/contradicoes', x => { C.contr = x || {}; CRW.emit('iv:contr'); });
  ouvir('caso/coleta', x => { C.coleta = x || {}; CRW.emit('iv:coleta'); verColetasNovas(); });
  ouvir('caso/consultas', x => { C.consultas = x || {}; CRW.emit('iv:consultas'); });
  if (P.mestre || P.aux) ['pergunta', 'lab', 'autorizacao'].forEach(t => ouvir('pedidos/' + t, x => { C.ped[t] = x || {}; avisarPedidos(t); CRW.emit('iv:ped', t); }));
  badges();
}
CRW.on('perfil', ligar);
CRW.on('entrou', () => { verFaxNovos(); verColetasNovas(); badges(); });
function avisarPedidos(t) {
  const vistos = ls.get('ivPed:' + t, {}), novo = {};
  Object.entries(C.ped[t] || {}).forEach(([k, p]) => {
    if (!p) return; novo[k] = 1; if (vistos[k]) return;
    const quemP = p.nome || 'Um investigador';
    const txt = t === 'pergunta' ? `Interrogatório: ${quemP} sugeriu uma pergunta: "${String(p.texto || '').slice(0, 90)}"`
      : t === 'lab' ? `Laboratório: ${quemP} enviou ${p.item || 'uma evidência'} para ${p.tipo || 'análise'}.`
      : `Bases: ${quemP} pediu autorização para "${p.titulo || p.chave || 'registro selado'}".`;
    CRW.alertaMestre(txt, 'iv-' + t);
  });
  ls.set('ivPed:' + t, novo); badges();
}
// fatias do estado que este arquivo usa; avisa só quando mudam
const ultEst = {};
CRW.on('estado', s => {
  const mud = {};
  ['interrog', 'lab', 'arquivo', 'bases'].forEach(k => {
    const j = JSON.stringify((s || {})[k] || null, (kk, vv) => kk === 'img' ? (vv ? String(vv).length : 0) : vv);
    if (j !== ultEst[k]) { mud[k] = true; ultEst[k] = j; }
  });
  if (!Object.keys(mud).length) return;
  if (mud.lab) verFaxNovos();
  if (mud.bases) basesMudou();
  CRW.emit('iv:estado', mud);
  badges();
});
CRW.on('segredos', () => CRW.emit('iv:seg'));

function badges() {
  const v = CRW.v();
  if (!logado()) return;
  if (v.mestre) {
    CRW.badge('interrog', conta(C.ped.pergunta)); CRW.badge('lab', conta(C.ped.lab)); CRW.badge('bases', conta(C.ped.autorizacao));
    CRW.badge('arquivo', 0); CRW.badge('coleta', 0); return;
  }
  // interrogatórios: falas novas
  const vist = lsg('ivFalasVistas', {}); let nf = 0;
  Object.entries(est('interrog')).forEach(([id, it]) => { if (it) nf += Math.max(0, conta(it.falas) - num(vist[id])); });
  CRW.badge('interrog', CRW.moduloAtual() === 'interrog' ? 0 : nf);
  const lv = lsg('ivLabLido', {});
  CRW.badge('lab', CRW.moduloAtual() === 'lab' ? 0 : Object.entries(est('lab')).filter(([id, x]) => x && x.resultado && !lv[id]).length);
  const dv = lsg('ivDocsVistos', {}), rv = lsg('ivRev', {});
  let na = 0;
  Object.entries(est('arquivo')).forEach(([id, d]) => { if (!d) return; if (!dv[id]) na++; else na += reveladosDe(d).filter(n => !(rv[id] || []).includes(n)).length; });
  CRW.badge('arquivo', CRW.moduloAtual() === 'arquivo' ? 0 : na);
}
CRW.on('modulo', () => badges());

/* =========================================================
   23 · SALA DE INTERROGATÓRIO
   estado/interrog/<id> = { npc, npcNome, titulo, aberto, ts, falas: { <k>: { p, r, ts } } }
   segredos/interrog/<id> = { npc, titulo, criado, perguntas: { <k>: { p, r, ord, liberada } } }
   caso/contradicoes/<id> = { a, b, aTxt, bTxt, nota, pc, nome, data, hora, ts }   (a, b = "<interrog>/<fala>")
   pedidos/pergunta/<id> = { interrog, titulo, texto, pc, nome, ts }
   ========================================================= */
function interrogsPub() {
  return Object.entries(est('interrog')).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }))
    .sort((a, b) => (b.aberto ? 1 : 0) - (a.aberto ? 1 : 0) || num(b.ts) - num(a.ts));
}
function falasDe(it) {
  return Object.entries((it && it.falas) || {}).filter(([, f]) => f).map(([k, f]) => ({ k, ...f }))
    .sort((a, b) => num(a.ts) - num(b.ts)).map((f, i) => ({ ...f, n: i + 1 }));
}
function npcDe(it) {
  const s = it && it.npc ? CRW.ser(it.npc) : null;
  const nome = (s && s.nome) || (it && it.npcNome) || 'Interrogado';
  return { nome, curto: (s && s.curto) || nome.split(/[\s,]+/)[0], cor: (s && s.cor) || '#5a5a5a', pub: (s && s.pub) || '', foto: (s && s.foto) || '' };
}
function falaPorRef(ref) {
  const [iid, k] = String(ref || '').split('/'); const it = est('interrog')[iid]; if (!it) return null;
  const f = falasDe(it).find(x => x.k === k); if (!f) return null;
  return { it: { id: iid, ...it }, f, npc: npcDe(it) };
}
function textoFala(ref) {
  const x = falaPorRef(ref); if (!x) return '';
  return `${x.npc.curto} (fala ${pad2(x.f.n)} · ${x.it.titulo || ''}): ${x.f.r || x.f.p || ''}`;
}
function retratoHtml(npc, cls) {
  return `<div class="iv-ret ${cls || ''}" style="--c:${esc(npc.cor || '#555')}"><span class="iv-ret-cab">CCSO</span>${npc.foto ? `<img src="${esc(npc.foto)}" alt="">` : `<b>${esc(CRW.iniciais(npc.nome))}</b>`}</div>`;
}

let marcando = null; // contradição em montagem: { ref, txt }
let vozLista = [];
function vozPt() {
  try { if (!vozLista.length) vozLista = speechSynthesis.getVoices(); } catch (e) { return null; }
  return vozLista.find(x => /^pt[-_]BR/i.test(x.lang)) || vozLista.find(x => /^pt/i.test(x.lang)) || null;
}
try { if (window.speechSynthesis) speechSynthesis.onvoiceschanged = () => { vozLista = speechSynthesis.getVoices(); }; } catch (e) {}

function rInterrog(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Sala de Interrogatório</h2><div class="meta">Formulário CCSO-23<br>gravação em fita</div></div><div class="panel-b iv-int"></div></div>`;
  const corpo = $('.iv-int', sec);
  let sel = ls.get('ivIntSel', '');
  const ultimas = {}; // quantas falas já estavam na tela (para destacar as novas)
  const fita = { tocando: false, pos: 0, cont: 0, t: null, chiado: null, pend: false, linhas: [] };

  const desenhar = () => {
    if (fita.tocando) { fita.pend = true; return; }
    seguro(corpo, desenharJa);
  };
  const desenharJa = () => {
    const lista = interrogsPub(), v = CRW.v();
    if (!lista.find(x => x.id === sel)) sel = lista.length ? lista[0].id : '';
    const it = lista.find(x => x.id === sel);
    let h = '';
    if (!it) {
      h = `<p class="vazio95">Nenhum interrogatório gravado ainda.</p><p class="mini">Quando o Guardião da Luz abrir um interrogatório, a ficha do interrogado, a fita e as perguntas aparecem aqui.</p>`;
    } else {
      const npc = npcDe(it), falas = falasDe(it), refsC = refsContradicao();
      const ant = ultimas[it.id]; ultimas[it.id] = falas.length;
      const novas = ant != null && falas.length > ant ? falas.slice(ant).map(f => f.k) : [];
      if (novas.length) Som.tom(880, 0, 0.08, 'square', 0.03);
      const vist = lsg('ivFalasVistas', {}); vist[it.id] = falas.length; lss('ivFalasVistas', vist); setTimeout(badges, 0);
      h = `<label class="campo">Interrogatório<select class="w95-input" data-sel>${lista.map(x => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${x.aberto ? '● ' : ''}${esc(x.titulo || 'Interrogatório')}</option>`).join('')}</select></label>
        <div class="iv-npc">${retratoHtml(npc)}<div class="iv-npc-t"><div class="iv-npc-n">${esc(npc.nome)}</div><div class="mini">${esc(npc.pub || 'Sem ficha pública.')}</div>
          <div class="linha95">${it.aberto ? '<span class="etq verm iv-rec">● REC · em andamento</span>' : '<span class="etq">encerrado</span>'}<span class="etq azul">${falas.length} ${falas.length === 1 ? 'fala' : 'falas'}</span></div></div></div>
        <div class="iv-deck" data-deck>
          <div class="iv-deck-topo"><span>CCSO · GRAVADOR DE INTERROGATÓRIO</span><span class="iv-cont" data-cont>${pad3(fita.cont)}</span></div>
          <div class="iv-fita"><div class="iv-fita-rot"><span>FITA ${esc(String(it.ts || '').slice(-4) || '0001')} · LADO A</span><b>${esc(it.titulo || '')}</b></div>
            <div class="iv-fita-jan"><span class="iv-carr"></span><span class="iv-fita-fio"></span><span class="iv-carr"></span></div></div>
          <div class="iv-teclas"><button class="iv-tecla" data-f="rew" aria-label="Rebobinar">◀◀<small>REBOBINAR</small></button><button class="iv-tecla" data-f="play" aria-label="Tocar">▶<small>TOCAR</small></button><button class="iv-tecla" data-f="stop" aria-label="Parar">■<small>PARAR</small></button></div>
          <label class="chk95 iv-voz"><input type="checkbox" data-voz${ls.get('ivVoz', false) ? ' checked' : ''}> Voz sintética em português (lê a transcrição em voz alta)</label>
        </div>
        <div class="iv-transc" data-transc>
          <div class="iv-transc-cab">TRANSCRIÇÃO DA FITA · ${esc((it.titulo || '').toUpperCase())}</div>
          ${falas.map(f => { const ref = it.id + '/' + f.k, mk = marcando && marcando.ref === ref; return `<div class="iv-fala${refsC.has(ref) ? ' contra' : ''}${novas.includes(f.k) ? ' nova' : ''}${mk ? ' marcando' : ''}">
            <div class="iv-fala-n">${pad2(f.n)}</div>
            <div class="iv-fala-t">${f.p ? `<p><b>INVESTIGADOR:</b> ${esc(f.p)}</p>` : ''}${f.r ? `<p><b>${esc(npc.curto.toUpperCase())}:</b> ${esc(f.r)}</p>` : ''}${refsC.has(ref) ? '<span class="etq verm">contradição</span>' : ''}</div>
            ${logado() ? `<button class="w95-btn iv-mk${mk ? ' on' : ''}" data-mk="${esc(ref)}" title="Marcar como contraditória" aria-label="Marcar contradição">⚑</button>` : ''}</div>`; }).join('') || '<p class="vazio95">A fita ainda está em branco. As perguntas aparecem aqui quando o Guardião libera.</p>'}
        </div>
        ${it.aberto && !v.mestre && !v.espiando && logado() ? `<div class="iv-sug"><label class="campo">Sugerir uma pergunta ao Guardião da Luz<textarea class="w95-input" rows="2" maxlength="400" data-sug placeholder="Ex.: Onde o senhor estava na madrugada de 21/05?"></textarea></label><button class="w95-btn" data-sug-ir>Enviar sugestão</button></div>` : ''}`;
    }
    h += marcando ? `<div class="iv-marca"><b>Fala marcada:</b> ${esc(marcando.txt.slice(0, 160))}<br><span class="mini">Toque em ⚑ em outra fala (pode ser de outro interrogatório) para ligar as duas, ou registre só esta.</span>
      <div class="linha95"><button class="w95-btn pri" data-mk-so>Registrar só esta</button><button class="w95-btn" data-mk-cancela>Cancelar</button></div></div>` : '';
    h += `<h3 class="iv-h3">Contradições marcadas pelo grupo</h3>${htmlContradicoes()}`;
    corpo.innerHTML = h;
    fita.linhas = it ? linhasFita(it) : [];
  };
  function linhasFita(it) {
    const npc = npcDe(it), L = [{ q: 'sis', t: `Gravação · ${it.titulo || ''}` }];
    falasDe(it).forEach(f => { if (f.p) L.push({ q: 'inv', t: f.p }); if (f.r) L.push({ q: 'npc', t: f.r, quem: npc.curto.toUpperCase() }); });
    L.push({ q: 'sis', t: 'Fim da gravação' });
    return L;
  }
  const nomeLinha = ln => ln.q === 'inv' ? 'INVESTIGADOR' : ln.q === 'npc' ? ln.quem : '';
  function tocar() {
    if (fita.tocando || !fita.linhas.length) return;
    const deck = $('[data-deck]', corpo), tr = $('[data-transc]', corpo); if (!deck || !tr) return;
    somClique(); fita.tocando = true; deck.classList.add('tocando');
    if (fita.pos >= fita.linhas.length) fita.pos = 0;
    tr.innerHTML = '<div class="iv-transc-cab">REPRODUZINDO A FITA</div>';
    fita.linhas.slice(0, fita.pos).forEach(ln => tr.appendChild(el('p', 'iv-ln ' + ln.q, (nomeLinha(ln) ? `<b>${esc(nomeLinha(ln))}:</b> ` : '') + esc(ln.t))));
    Som.ruido(0, 0.5, 0.03, 900);
    fita.chiado = setInterval(() => Som.ruido(0, 1.3, 0.012, 5200, 'highpass'), 1200);
    proxima();
  }
  function proxima() {
    if (!fita.tocando) return;
    const tr = $('[data-transc]', corpo), ct = $('[data-cont]', corpo);
    if (!tr || fita.pos >= fita.linhas.length) { parar(true); return; }
    const ln = fita.linhas[fita.pos], d = el('p', 'iv-ln ' + ln.q + ' agora', (nomeLinha(ln) ? `<b>${esc(nomeLinha(ln))}:</b> ` : '') + '<span></span><i class="iv-cursor"></i>');
    tr.appendChild(d);
    try { d.scrollIntoView({ block: 'nearest' }); } catch (e) {}
    const span = $('span', d), voz = ls.get('ivVoz', false) && window.speechSynthesis;
    let i = 0, digitou = false, falou = !voz;
    const fim = () => { if (!(digitou && falou) || !fita.tocando) return; d.classList.remove('agora'); fita.pos++; fita.t = setTimeout(proxima, 420); };
    if (voz && ln.q !== 'sis') {
      try {
        const u = new SpeechSynthesisUtterance(ln.t); u.lang = 'pt-BR'; const vz = vozPt(); if (vz) u.voice = vz;
        u.rate = 1.02; u.pitch = ln.q === 'npc' ? 0.75 : 1.1;
        let feito = false; const ok = () => { if (feito) return; feito = true; falou = true; fim(); };
        u.onend = ok; u.onerror = ok; setTimeout(ok, 1800 + ln.t.length * 95);
        speechSynthesis.speak(u);
      } catch (e) { falou = true; }
    } else falou = true;
    const vel = voz ? 55 : 24;
    const tipo = () => {
      if (!fita.tocando) return;
      i++; span.textContent = ln.t.slice(0, i);
      if (i % 3 === 0) { fita.cont++; if (ct) ct.textContent = pad3(fita.cont); }
      if (i < ln.t.length) fita.t = setTimeout(tipo, vel); else { digitou = true; fim(); }
    };
    tipo();
  }
  function parar(fimDaFita) {
    clearTimeout(fita.t); clearInterval(fita.chiado);
    try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {}
    const eraTocando = fita.tocando; fita.tocando = false;
    const deck = $('[data-deck]', corpo); if (deck) deck.classList.remove('tocando');
    if (eraTocando) somClique();
    if (fimDaFita) { fita.pos = 0; Som.tom(1000, 0.1, 0.3, 'sine', 0.03); setTimeout(() => { if (!fita.tocando) desenharJa(); }, 1400); return; }
    if (fita.pend) { fita.pend = false; desenharJa(); }
  }
  function rebobinar() {
    parar(false); fita.pos = 0;
    const c0 = fita.cont; fita.cont = 0;
    const c = Som.pronto(); if (c && c0) { Som.tom(300, 0, 0.5, 'sawtooth', 0.015); Som.tom(500, 0.2, 0.5, 'sawtooth', 0.015); }
    desenharJa();
  }

  corpo.addEventListener('change', e => {
    if (e.target.matches('[data-sel]')) { parar(false); fita.pos = 0; fita.cont = 0; sel = e.target.value; ls.set('ivIntSel', sel); desenharJa(); }
    if (e.target.matches('[data-voz]')) { ls.set('ivVoz', e.target.checked); if (!e.target.checked) try { speechSynthesis.cancel(); } catch (er) {} if (e.target.checked && !window.speechSynthesis) aviso('Este navegador não tem voz sintética.', 'erro'); }
  });
  corpo.addEventListener('click', async e => {
    const f = e.target.closest('[data-f]');
    if (f) { if (f.dataset.f === 'play') tocar(); else if (f.dataset.f === 'stop') parar(false); else rebobinar(); return; }
    const mk = e.target.closest('[data-mk]');
    if (mk) {
      const ref = mk.dataset.mk;
      if (!marcando) { marcando = { ref, txt: textoFala(ref) }; CRW.emit('iv:marcando'); return; }
      if (marcando.ref === ref) { marcando = null; CRW.emit('iv:marcando'); return; }
      const a = marcando; const nota = await pedirTexto('Por que essas falas se contradizem? (opcional)', '', { titulo: 'Ligar contradição', longo: true });
      if (nota === null) return;
      salvarContradicao(a.ref, ref, nota, a.txt, textoFala(ref)); marcando = null; CRW.emit('iv:marcando'); return;
    }
    if (e.target.closest('[data-mk-so]') && marcando) {
      const a = marcando; const nota = await pedirTexto('O que há de contraditório nesta fala? (opcional)', '', { titulo: 'Marcar contradição', longo: true });
      if (nota === null) return;
      salvarContradicao(a.ref, null, nota, a.txt, ''); marcando = null; CRW.emit('iv:marcando'); return;
    }
    if (e.target.closest('[data-mk-cancela]')) { marcando = null; CRW.emit('iv:marcando'); return; }
    const del = e.target.closest('[data-ct-del]');
    if (del && await confirmar('Apagar esta contradição do quadro do grupo?')) { Rede.set('caso/contradicoes/' + del.dataset.ctDel, null).catch(() => aviso('Não foi possível apagar.', 'erro')); return; }
    if (e.target.closest('[data-sug-ir]')) {
      const t = $('[data-sug]', corpo), txt = (t.value || '').trim(); if (!txt) return aviso('Escreva a pergunta antes de enviar.', 'erro');
      const it = est('interrog')[sel] || {};
      const r = CRW.pedir('pergunta', { interrog: sel, titulo: it.titulo || '', texto: txt.slice(0, 400) });
      r.pronto.then(() => { aviso('Sugestão enviada ao Guardião da Luz.'); Som.ding(); }).catch(() => aviso('O servidor recusou o envio.', 'erro'));
      t.value = ''; t.blur();
    }
  });
  desenharJa();
  vivo(sec, 'iv:estado', m => { if (m.interrog) desenhar(); });
  vivo(sec, 'iv:contr', desenhar);
  vivo(sec, 'iv:marcando', desenhar);
}
function refsContradicao() { const s = new Set(); Object.values(C.contr || {}).forEach(c => { if (!c) return; if (c.a) s.add(c.a); if (c.b) s.add(c.b); }); return s; }
function htmlContradicoes() {
  const l = Object.entries(C.contr || {}).filter(([, c]) => c).map(([id, c]) => ({ id, ...c })).sort((a, b) => num(b.ts) - num(a.ts));
  if (!l.length) return '<p class="vazio95">Nenhuma contradição marcada. Toque em ⚑ ao lado de uma fala para marcar.</p>';
  const v = CRW.v(), eu = quem().pc;
  return l.map(c => `<div class="iv-contra">
    <div class="iv-contra-q">“${esc(c.aTxt || textoFala(c.a) || c.a)}”</div>
    ${c.b ? `<div class="iv-contra-x">✕ contradiz ✕</div><div class="iv-contra-q">“${esc(c.bTxt || textoFala(c.b) || c.b)}”</div>` : '<div class="iv-contra-x">fala marcada como contraditória</div>'}
    ${c.nota ? `<div class="iv-contra-nota">${esc(c.nota)}</div>` : ''}
    <div class="mini">marcada por ${esc(c.nome || '?')} · ${esc(c.data || '')} ${esc(c.hora || '')}${(v.mestre || c.pc === eu) ? ` · <button class="iv-lnk" data-ct-del="${esc(c.id)}">apagar</button>` : ''}</div></div>`).join('');
}
function salvarContradicao(a, b, nota, aTxt, bTxt) {
  const q = quem(), t = agora();
  Rede.push('caso/contradicoes', { a, b: b || null, aTxt: aTxt || '', bTxt: bTxt || '', nota: String(nota || '').trim().slice(0, 500), pc: q.pc, nome: q.nome, data: t.data, hora: t.hora, ts: Date.now() })
    .pronto.then(() => { aviso('Contradição registrada no quadro do grupo.'); Som.tom(330, 0, 0.15, 'square', 0.04); }).catch(() => aviso('O servidor recusou.', 'erro'));
  CRW.diario('interrogatorio', 'Contradição marcada por ' + q.nome);
}

/* ---------- Mestre: interrogatório ao vivo ---------- */
function interrogsTodos() {
  const ids = new Set([...Object.keys(Segredos.ler(['interrog']) || {}), ...Object.keys(est('interrog'))]);
  return [...ids].map(id => { const s = Segredos.ler(['interrog', id]) || {}, e = est('interrog')[id] || null; return { id, s, e, titulo: (e && e.titulo) || s.titulo || 'Interrogatório', ts: num((e && e.ts) || s.criado) }; })
    .sort((a, b) => ((b.e && b.e.aberto) ? 1 : 0) - ((a.e && a.e.aberto) ? 1 : 0) || b.ts - a.ts);
}
function publicarInterrog(iid, aberto = true) {
  const s = Segredos.ler(['interrog', iid]) || {}, e = est('interrog')[iid];
  if (e) return Estado.definir(['interrog', iid, 'aberto'], !!aberto);
  const n = CRW.ser(s.npc) || {};
  Estado.definir(['interrog', iid], { npc: s.npc || null, npcNome: n.nome || s.npcNome || '', titulo: s.titulo || 'Interrogatório', aberto: !!aberto, ts: Date.now() });
  CRW.diario('interrogatorio', 'Interrogatório aberto: ' + (s.titulo || ''));
}
function liberarPergunta(iid, k) {
  const q = Segredos.ler(['interrog', iid, 'perguntas', k]); if (!q) return;
  if (!est('interrog')[iid]) publicarInterrog(iid, true);
  Estado.definir(['interrog', iid, 'falas', k], { p: q.p || '', r: q.r || '', ts: Date.now() });
  Segredos.gravar(['interrog', iid, 'perguntas', k, 'liberada'], true);
  CRW.diario('interrogatorio', 'Pergunta liberada: ' + String(q.p || q.r).slice(0, 80));
}
function mInterrog(c) {
  let sel = ls.get('ivMIntSel', '');
  c.innerHTML = `<p class="mini">Prepare o roteiro (pergunta e resposta) e libere uma a uma: cada fala liberada entra na fita dos jogadores na hora. Só você vê o roteiro.</p>
    <div class="linha95"><select class="w95-input iv-flex" data-sel></select><button class="w95-btn pri" data-novo>+ Novo interrogatório</button></div>
    <div data-cab></div>
    <div class="iv-mform"><label class="campo">Pergunta do investigador<textarea class="w95-input" rows="2" data-p maxlength="600"></textarea></label>
      <label class="campo">Resposta do interrogado<textarea class="w95-input" rows="3" data-r maxlength="1500"></textarea></label>
      <div class="linha95"><button class="w95-btn" data-add>Pôr no roteiro</button><button class="w95-btn pri" data-add-lib>Pôr e liberar agora</button></div></div>
    <div data-lista></div>`;
  const desenhar = () => seguro(c, () => {
    const todos = interrogsTodos();
    if (!todos.find(x => x.id === sel)) sel = todos.length ? todos[0].id : '';
    $('[data-sel]', c).innerHTML = todos.map(x => `<option value="${esc(x.id)}"${x.id === sel ? ' selected' : ''}>${x.e && x.e.aberto ? '● ' : x.e ? '' : '(rascunho) '}${esc(x.titulo)}</option>`).join('') || '<option value="">nenhum interrogatório</option>';
    const x = todos.find(y => y.id === sel);
    $('.iv-mform', c).hidden = !x;
    if (!x) { $('[data-cab]', c).innerHTML = '<p class="vazio95">Crie o primeiro interrogatório.</p>'; $('[data-lista]', c).innerHTML = pedidosPerguntaHtml(null); return; }
    const npc = npcDe(x.e || x.s);
    $('[data-cab]', c).innerHTML = `<div class="iv-npc mini-npc">${retratoHtml(npc, 'peq')}<div class="iv-npc-t"><b>${esc(npc.nome)}</b><div class="linha95">${x.e ? (x.e.aberto ? '<span class="etq verm">● aberto na sala</span>' : '<span class="etq">encerrado</span>') : '<span class="etq ambar">rascunho (jogadores não veem)</span>'}</div></div></div>
      <div class="linha95">${!x.e || !x.e.aberto ? '<button class="w95-btn pri" data-abrir>Abrir na sala</button>' : '<button class="w95-btn" data-fechar-int>Encerrar</button>'}<button class="w95-btn" data-ren>Renomear</button><button class="w95-btn perigo" data-apagar>Apagar</button></div>`;
    const pergs = Object.entries((x.s && x.s.perguntas) || {}).filter(([, q]) => q).map(([k, q]) => ({ k, ...q })).sort((a, b) => num(a.ord) - num(b.ord));
    const falas = falasDe(x.e || {});
    $('[data-lista]', c).innerHTML = `<h4 class="iv-h4">Roteiro (${pergs.filter(q => !q.liberada).length} a liberar)</h4>
      ${pergs.map((q, i) => `<div class="iv-mq${q.liberada ? ' lib' : ''}"><div class="iv-mq-t"><b>${pad2(i + 1)} P:</b> ${esc(q.p || '(sem pergunta)')}<br><b>R:</b> ${esc(q.r || '(sem resposta)')}</div>
        <div class="linha95">${q.liberada ? '<span class="etq verde">liberada</span>' : `<button class="w95-btn pri" data-lib="${esc(q.k)}">Liberar</button>`}<button class="w95-btn" data-ed="${esc(q.k)}">Editar</button><button class="w95-btn perigo" data-del="${esc(q.k)}">×</button></div></div>`).join('') || '<p class="vazio95">Roteiro vazio.</p>'}
      ${pedidosPerguntaHtml(sel)}
      <h4 class="iv-h4">Na fita dos jogadores (${falas.length})</h4>
      ${falas.map(f => `<div class="iv-mq lib"><div class="iv-mq-t"><b>${pad2(f.n)}</b> ${esc(f.p || '')}<br><i>${esc(f.r || '')}</i></div><button class="w95-btn perigo" data-retira="${esc(f.k)}" title="Retirar da fita">Retirar</button></div>`).join('') || '<p class="vazio95">Nada liberado ainda.</p>'}`;
  });
  function pedidosPerguntaHtml(iid) {
    const l = Object.entries(C.ped.pergunta || {}).filter(([, p]) => p && (!iid || !p.interrog || p.interrog === iid || !est('interrog')[p.interrog])).sort((a, b) => num(a[1].ts) - num(b[1].ts));
    return `<h4 class="iv-h4">Perguntas sugeridas pelo grupo (${l.length})</h4>` + (l.map(([k, p]) => `<div class="iv-mq ped"><div class="iv-mq-t"><b>${esc(p.nome || '?')}</b>: ${esc(p.texto || '')}</div>
      <div class="linha95"><button class="w95-btn pri" data-pr-resp="${esc(k)}">Responder e liberar</button><button class="w95-btn" data-pr-rot="${esc(k)}">Usar no roteiro</button><button class="w95-btn perigo" data-pr-del="${esc(k)}">Descartar</button></div></div>`).join('') || '<p class="vazio95">Nenhuma sugestão pendente.</p>');
  }
  const novaPergunta = (p, r, liberar) => {
    if (!sel) return aviso('Crie um interrogatório primeiro.', 'erro');
    if (!p && !r) return aviso('Escreva a pergunta ou a resposta.', 'erro');
    const k = Rede.chave();
    Segredos.gravar(['interrog', sel, 'perguntas', k], { p, r, ord: Date.now(), liberada: false });
    if (liberar) liberarPergunta(sel, k);
    return k;
  };
  c.addEventListener('change', e => { if (e.target.matches('[data-sel]')) { sel = e.target.value; ls.set('ivMIntSel', sel); desenhar(); } });
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    const d = b.dataset;
    if ('novo' in d) { const id = await novoInterrog(); if (id) { sel = id; ls.set('ivMIntSel', id); desenhar(); } }
    else if ('abrir' in d) { publicarInterrog(sel, true); aviso('Interrogatório aberto na sala.'); }
    else if ('fecharInt' in d) { Estado.definir(['interrog', sel, 'aberto'], false); CRW.diario('interrogatorio', 'Interrogatório encerrado'); }
    else if ('ren' in d) {
      const x = interrogsTodos().find(y => y.id === sel); const t = await pedirTexto('Título do interrogatório', x ? x.titulo : ''); if (!t) return;
      Segredos.gravar(['interrog', sel, 'titulo'], t.trim()); if (est('interrog')[sel]) Estado.definir(['interrog', sel, 'titulo'], t.trim());
    } else if ('apagar' in d) {
      if (!(await confirmar('Apagar este interrogatório (roteiro e fita)?\n\nAs contradições já marcadas pelo grupo continuam no quadro.'))) return;
      Segredos.gravar(['interrog', sel], null); Estado.definir(['interrog', sel], null); sel = ''; desenhar();
    } else if ('add' in d || 'addLib' in d) {
      const p = $('[data-p]', c).value.trim(), r = $('[data-r]', c).value.trim();
      if (novaPergunta(p, r, 'addLib' in d)) { $('[data-p]', c).value = ''; $('[data-r]', c).value = ''; }
    } else if (d.lib) liberarPergunta(sel, d.lib);
    else if (d.ed) editarPergunta(sel, d.ed);
    else if (d.del) { if (await confirmar('Tirar esta pergunta do roteiro?')) Segredos.gravar(['interrog', sel, 'perguntas', d.del], null); }
    else if (d.retira) { if (await confirmar('Retirar esta fala da fita dos jogadores?')) { Estado.definir(['interrog', sel, 'falas', d.retira], null); Segredos.gravar(['interrog', sel, 'perguntas', d.retira, 'liberada'], false); } }
    else if (d.prResp) {
      const p = C.ped.pergunta[d.prResp]; if (!p) return;
      const r = await pedirTexto(`Resposta do interrogado a: "${p.texto}"`, '', { longo: true, titulo: 'Responder e liberar' }); if (r === null) return;
      const alvo = p.interrog && interrogsTodos().find(x => x.id === p.interrog) ? p.interrog : sel;
      const antes = sel; sel = alvo; novaPergunta(p.texto, r.trim(), true); sel = antes;
      Rede.set('pedidos/pergunta/' + d.prResp, null);
    } else if (d.prRot) {
      const p = C.ped.pergunta[d.prRot]; if (!p) return;
      $('[data-p]', c).value = p.texto || ''; $('[data-r]', c).focus(); Rede.set('pedidos/pergunta/' + d.prRot, null);
    } else if (d.prDel) Rede.set('pedidos/pergunta/' + d.prDel, null);
  });
  desenhar();
  vivo(c, 'iv:estado', m => { if (m.interrog) desenhar(); });
  vivo(c, 'iv:seg', desenhar);
  vivo(c, 'iv:ped', t => { if (t === 'pergunta') desenhar(); });
}
function novoInterrog() {
  return new Promise(ok => {
    const l = CRW.npcs().filter(n => n.tipo !== 'viatura');
    const w = janela({ titulo: 'Novo interrogatório', largura: '420px', aoFechar: () => ok(null), html: `
      <label class="campo">Interrogado (NPC)<select class="w95-input" data-npc>${l.map(n => `<option value="${esc(n.id)}">${esc(n.nome)}${n.oculto ? ' (oculto)' : ''}</option>`).join('')}</select></label>
      <label class="campo">Título<input class="w95-input" data-tit maxlength="80"></label>
      <label class="chk95"><input type="checkbox" data-ab> Abrir na sala agora (os jogadores já veem a ficha e a fita)</label>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Criar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    const tit = $('[data-tit]', w), npcS = $('[data-npc]', w);
    const sug = () => { const n = l.find(x => x.id === npcS.value); if (!tit.dataset.mexeu) tit.value = 'Interrogatório de ' + (n ? (n.curto || n.nome) : ''); };
    sug(); npcS.addEventListener('change', sug); tit.addEventListener('input', () => { tit.dataset.mexeu = 1; });
    $('[data-ok]', w).addEventListener('click', () => {
      const id = 'i' + Date.now().toString(36);
      Segredos.gravar(['interrog', id], { npc: npcS.value, titulo: tit.value.trim() || 'Interrogatório', criado: Date.now(), perguntas: {} });
      if ($('[data-ab]', w).checked) setTimeout(() => publicarInterrog(id, true), 50);
      w.parentElement._aoFechar = null; fecharJanela(w.parentElement.dataset.jan); ok(id);
    });
  });
}
function editarPergunta(iid, k) {
  const q = Segredos.ler(['interrog', iid, 'perguntas', k]) || {};
  const w = janela({ titulo: 'Editar pergunta', largura: '460px', html: `<label class="campo">Pergunta<textarea class="w95-input" rows="3" data-p>${esc(q.p || '')}</textarea></label>
    <label class="campo">Resposta<textarea class="w95-input" rows="5" data-r>${esc(q.r || '')}</textarea></label>
    ${q.liberada ? '<p class="mini">Esta fala já está na fita: salvar atualiza também o que os jogadores veem.</p>' : ''}
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', () => {
    const p = $('[data-p]', w).value.trim(), r = $('[data-r]', w).value.trim();
    Segredos.gravar(['interrog', iid, 'perguntas', k], { ...q, p, r });
    if (q.liberada && ((est('interrog')[iid] || {}).falas || {})[k]) Estado.definir(['interrog', iid, 'falas', k], { ...est('interrog')[iid].falas[k], p, r });
    fecharJanela(w.parentElement.dataset.jan);
  });
}

/* =========================================================
   24 · LABORATÓRIO COM PRAZO
   pedidos/lab/<id> = { item, tipo, obs, data, hora, pc, nome, ts }
   estado/lab/<id> = { item, tipo, ref, obs, pedido:{data,hora}, pedidoPor, inicio, pronto (minutos absolutos de jogo), prontoTxt:{data,hora}, status:'analise'|'pronto', ts, resultado? }
   segredos/lab/<id> = { ref, texto }        segredos/lab/_modelos/<k> = { ref, item, tipo, titulo, texto }
   ========================================================= */
const TIPOS_LAB = ['DNA', 'Digitais', 'Balística', 'Toxicologia', 'Outro'];
function itensParaLab() {
  const l = evidCaso().map(e => ({ cod: e.id, nome: String(e.desc || '').replace(/<[^>]+>/g, '').slice(0, 50) }));
  Object.values(C.coleta || {}).filter(x => x && x.codigo).sort((a, b) => num(a.ts) - num(b.ts)).forEach(x => l.push({ cod: x.codigo, nome: x.nome || '' }));
  return l;
}
function rLab(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Laboratório Estadual · Pedidos de Análise</h2><div class="meta">Formulário CCSO-24<br>prazos em horas de jogo</div></div><div class="panel-b">
    <div data-form></div><h3 class="iv-h3">Fila do laboratório</h3><div data-fila></div></div></div>`;
  const fForm = $('[data-form]', sec), fila = $('[data-fila]', sec);
  const desenharForm = () => seguro(fForm, () => {
    const v = CRW.v();
    if (v.mestre) { fForm.innerHTML = '<p class="mini">Como Guardião da Luz, você aceita os pedidos e cria análises no seu painel (aba Mesa, "Laboratório"). Os jogadores enviam pelo formulário que aparece aqui para eles.</p>'; return; }
    if (v.espiando) { fForm.innerHTML = '<p class="mini">O formulário de envio aparece aqui para o investigador.</p>'; return; }
    const pre = ls.get('ivLabItem', '');
    const its = itensParaLab();
    fForm.innerHTML = `<details class="bloco95" open><summary>Enviar evidência para análise</summary><div class="bloco95-c">
      <div class="grade2"><label class="campo">Evidência<select class="w95-input" data-it>${its.map(i => `<option value="${esc(i.cod)}"${i.cod === pre ? ' selected' : ''}>${esc(i.cod)} · ${esc(i.nome)}</option>`).join('')}<option value="_outro">Outro item (descrever)</option></select></label>
      <label class="campo">Exame<select class="w95-input" data-tp>${TIPOS_LAB.map(t => `<option>${t}</option>`).join('')}</select></label></div>
      <label class="campo" data-outro-c hidden>Descrição do item<input class="w95-input" data-outro maxlength="120"></label>
      <label class="campo">O que o grupo quer saber<textarea class="w95-input" rows="2" data-obs maxlength="400" placeholder="Ex.: comparar com os registros de óbito da comarca"></textarea></label>
      <label class="chk95"><input type="checkbox" data-cad checked> Registrar "enviado ao laboratório" na cadeia de custódia</label>
      <div class="linha95"><button class="w95-btn pri" data-env>Enviar ao laboratório</button></div>
      <p class="mini">O Guardião da Luz define o prazo em horas do relógio do jogo. Quando a hora chegar, o resultado chega a todos por fax.</p></div></details>`;
    if (pre) ls.del('ivLabItem');
    const itS = $('[data-it]', fForm);
    itS.addEventListener('change', () => { $('[data-outro-c]', fForm).hidden = itS.value !== '_outro'; });
  });
  fForm.addEventListener('click', e => {
    if (!e.target.closest('[data-env]')) return;
    const itV = $('[data-it]', fForm).value, item = itV === '_outro' ? ($('[data-outro]', fForm).value || '').trim() : itV;
    if (!item) return aviso('Descreva o item.', 'erro');
    const tipo = $('[data-tp]', fForm).value, obs = ($('[data-obs]', fForm).value || '').trim().slice(0, 400), t = agora();
    const r = CRW.pedir('lab', { item, tipo, obs, data: t.data, hora: t.hora });
    const meus = lsg('ivLabMeus', []); meus.push({ id: r.key, item, tipo, data: t.data, hora: t.hora, ts: Date.now() }); lss('ivLabMeus', meus.slice(-30));
    r.pronto.then(() => { aviso('Evidência enviada ao Laboratório Estadual.'); Som.ding(); }).catch(() => aviso('O servidor recusou o pedido.', 'erro'));
    if ($('[data-cad]', fForm).checked && itV !== '_outro') registrarCadeia(idDoItem(itV), { acao: 'enviado ao laboratório', para: 'Laboratório Estadual', nota: tipo + (obs ? ': ' + obs : '') });
    $('[data-obs]', fForm).value = '';
    desenharFila();
  });
  const desenharFila = () => {
    const lab = est('lab'), a = agora().abs, meus = lsg('ivLabMeus', []), v = CRW.v();
    const l = Object.entries(lab).filter(([, x]) => x).map(([id, x]) => ({ id, ...x }))
      .sort((x, y) => (x.resultado ? 1 : 0) - (y.resultado ? 1 : 0) || (x.resultado ? num(y.resultado.ts) - num(x.resultado.ts) : num(x.pronto) - num(y.pronto)));
    const pend = v.mestre ? [] : meus.filter(m => !lab[m.id] && Date.now() - num(m.ts) < 3 * 86400e3);
    fila.innerHTML = (pend.map(m => `<div class="iv-lab-it esp"><div class="iv-lab-cab"><span class="etq azul">${esc(m.item)}</span> <b>${esc(m.tipo)}</b> <span class="etq">aguardando protocolo</span></div><div class="mini">Enviado em ${esc(dm(m.data))} ${esc(m.hora)} · o laboratório ainda não registrou o pedido.</div></div>`).join('')
      + l.map(x => {
        const pronto = !!x.resultado, falta = num(x.pronto) - a, tot = Math.max(1, num(x.pronto) - num(x.inicio)), pct = pronto ? 100 : Math.max(0, Math.min(100, (1 - falta / tot) * 100));
        return `<div class="iv-lab-it${pronto ? ' ok' : ''}"><div class="iv-lab-cab"><span class="etq azul">${esc(x.item || '?')}</span> <b>${esc(x.tipo || '')}</b> <span class="etq ${pronto ? 'verde' : 'ambar'}">${pronto ? 'resultado recebido' : 'em análise'}</span></div>
          <div class="mini">${esc(x.ref || '')}${x.ref ? ' · ' : ''}Pedido: ${esc(dm((x.pedido || {}).data))} ${esc((x.pedido || {}).hora || '')} · Previsto: ${esc(dm((x.prontoTxt || {}).data))} ${esc((x.prontoTxt || {}).hora || '')}</div>
          <div class="iv-barra"><span style="width:${pct.toFixed(1)}%"></span></div>
          <div class="iv-lab-cd" data-cd="${esc(x.id)}">${pronto ? 'Fax recebido em ' + esc(dm(x.resultado.data)) + ' ' + esc(x.resultado.hora || '') : textoFalta(falta)}</div>
          ${pronto ? `<button class="w95-btn" data-fax="${esc(x.id)}">Ver o fax</button>` : ''}</div>`;
      }).join('')) || '<p class="vazio95">Nenhuma análise na fila.</p>';
  };
  fila.addEventListener('click', e => { const b = e.target.closest('[data-fax]'); if (b) abrirFax(b.dataset.fax); });
  desenharForm(); desenharFila();
  vivo(sec, 'iv:estado', m => { if (m.lab) desenharFila(); });
  vivo(sec, 'iv:coleta', desenharForm);
  vivo(sec, 'tick', () => {
    if (!sec.offsetParent) return;
    const lab = est('lab'), a = agora().abs;
    $$('[data-cd]', fila).forEach(d => { const x = lab[d.dataset.cd]; if (!x || x.resultado) return; d.textContent = textoFalta(num(x.pronto) - a); const bar = d.previousElementSibling && d.previousElementSibling.firstElementChild; if (bar) bar.style.width = Math.max(0, Math.min(100, (1 - (num(x.pronto) - a) / Math.max(1, num(x.pronto) - num(x.inicio))) * 100)).toFixed(1) + '%'; });
  });
}
const textoFalta = f => f > 0 ? `Faltam ${duracao(f)} de jogo` : 'Prazo cumprido · aguardando o fax do laboratório';
function labAoAbrir(sec) {
  const lv = lsg('ivLabLido', {}); Object.entries(est('lab')).forEach(([id, x]) => { if (x && x.resultado) lv[id] = 1; }); lss('ivLabLido', lv);
  const s = $('[data-it]', sec), pre = ls.get('ivLabItem', '');
  if (s && pre) { s.value = pre; ls.del('ivLabItem'); }
  badges();
}
// o aparelho do Mestre publica o resultado quando o relógio do jogo passa da hora
const labSemTexto = new Set();
CRW.on('tick', () => {
  if (!CRW.P.mestre || !Segredos.pronto) return;
  const a = agora().abs;
  Object.entries(est('lab')).forEach(([id, x]) => {
    if (!x || x.resultado || x.status === 'pronto' || a < num(x.pronto)) return;
    publicarLab(id, true);
  });
});
function publicarLab(id, auto) {
  const x = est('lab')[id], s = Segredos.ler(['lab', id]);
  if (!x) return;
  if (!s || !s.texto) {
    if (!labSemTexto.has(id)) { labSemTexto.add(id); CRW.alertaMestre(`Laboratório: chegou a hora de ${x.item} (${x.tipo}), mas o resultado não foi escrito. Escreva no painel (Mesa).`, 'iv-labsem'); }
    if (auto) return;
    return aviso('Escreva o resultado antes de liberar.', 'erro');
  }
  const t = agora();
  Estado.definir(['lab', id], { ...x, status: 'pronto', resultado: { ref: s.ref || x.ref || '', texto: s.texto, data: t.data, hora: t.hora, ts: Date.now() } });
  CRW.diario('laboratorio', `Resultado publicado: ${x.item} (${x.tipo})${auto ? ' no prazo' : ' antes do prazo'}`);
}
// fila de faxes que chegam a este aparelho
const faxFila = [];
function verFaxNovos() {
  const P = CRW.P; if (!logado() || P.espiar || CRW.TV) return;
  const vistos = lsg('ivLabVisto', {}); let mud = false;
  Object.entries(est('lab')).forEach(([id, x]) => {
    if (!x || !x.resultado || vistos[id]) return;
    vistos[id] = 1; mud = true;
    if (Date.now() - num(x.resultado.ts) < 6 * 3600e3 && !faxFila.includes(id)) faxFila.push(id);
  });
  if (mud) lss('ivLabVisto', vistos);
  if (faxFila.length && !CRW.janelaAberta('iv-fax')) abrirFax(faxFila.shift(), true);
}
function abrirFax(id, chegando) {
  const x = est('lab')[id]; if (!x || !x.resultado) return;
  const r = x.resultado, lv = lsg('ivLabLido', {}); lv[id] = 1; lss('ivLabLido', lv); badges();
  const w = janela({ id: 'iv-fax', titulo: 'FAX · Laboratório Estadual', largura: '500px', classe: 'iv-faxjan', icone: '☎',
    aoFechar: () => { if (faxFila.length) setTimeout(() => abrirFax(faxFila.shift(), true), 400); },
    html: `<div class="iv-fax${chegando ? ' chegando' : ''}">
      <div class="iv-fax-maq"><span class="iv-fax-luz"></span><span>${chegando ? 'RECEBENDO · 9600 bps' : 'CÓPIA DO FAX RECEBIDO'}</span><span>PÁG 01/01</span></div>
      <div class="iv-fax-boca"></div>
      <div class="iv-fax-jan"><div class="iv-fax-papel">
        <div class="iv-fax-linha">${esc(dm(r.data))}/${esc(String(r.data || '').slice(-2))} ${esc(r.hora || '')}  DE: LAB EST CRIMINALISTICA  PARA: CCSO CROWSREST</div>
        <div class="iv-fax-cab">ESTADO DE WEST VIRGINIA<br><b>LABORATÓRIO ESTADUAL DE CRIMINALÍSTICA</b><br>Divisão de Análises Forenses</div>
        <div class="iv-fax-ref">${esc(r.ref || x.ref || '')}</div>
        <table class="iv-fax-t"><tr><td>CASO</td><td>${esc(typeof CASO !== 'undefined' ? CASO.numero : '')}</td></tr><tr><td>ITEM</td><td>${esc(x.item || '')}</td></tr><tr><td>EXAME</td><td>${esc(x.tipo || '')}</td></tr>
          <tr><td>SOLICITADO</td><td>${esc(dm((x.pedido || {}).data))} ${esc((x.pedido || {}).hora || '')}${x.pedidoPor ? ' · ' + esc(x.pedidoPor) : ''}</td></tr></table>
        <div class="iv-fax-res"><b>RESULTADO</b><div>${htmlSimples(r.texto)}</div></div>
        <div class="iv-fax-ass">______________________________<br>Perito responsável (assinatura ilegível)</div>
        <div class="iv-fax-linha">*** FIM DA TRANSMISSÃO ***</div>
      </div></div>
      <div class="linha95"><button class="w95-btn" data-imp>Imprimir cópia</button><button class="w95-btn pri" data-fechar>Arquivar</button></div></div>` });
  if (chegando) Som.fax();
  $('[data-imp]', w).addEventListener('click', () => CRW.imprimir('Fax do laboratório ' + (r.ref || ''), `<h2>${esc(r.ref || x.ref || 'Resultado de laboratório')}</h2><table><tr><th>Item</th><td>${esc(x.item)}</td></tr><tr><th>Exame</th><td>${esc(x.tipo)}</td></tr><tr><th>Recebido</th><td>${esc(r.data)} ${esc(r.hora)}</td></tr></table><h2>Resultado</h2><p>${htmlSimples(r.texto)}</p>`, { sub: 'Cópia de fax · Laboratório Estadual de Criminalística' }));
}

/* ---------- Mestre: laboratório ---------- */
function mLab(c) {
  c.innerHTML = `<p class="mini">Os pedidos do grupo chegam aqui. Defina o prazo em horas <b>de jogo</b> e escreva o resultado: ele fica guardado só com você e o seu aparelho publica sozinho quando o relógio do jogo passar da hora (deixe o site aberto). "Liberar agora" pula o prazo.</p>
    <div data-ped></div><div class="linha95"><button class="w95-btn" data-nova>+ Nova análise sem pedido</button><button class="w95-btn" data-modelo>+ Novo modelo de resultado</button></div>
    <h4 class="iv-h4">Fila</h4><div data-fila></div><h4 class="iv-h4">Modelos de resultado</h4><div data-mod></div>`;
  const desenhar = () => {
    const ped = Object.entries(C.ped.lab || {}).filter(([, p]) => p).sort((a, b) => num(a[1].ts) - num(b[1].ts));
    $('[data-ped]', c).innerHTML = `<h4 class="iv-h4">Pedidos do grupo (${ped.length})</h4>` + (ped.map(([k, p]) => `<div class="iv-mq ped"><div class="iv-mq-t"><b>${esc(p.nome || '?')}</b> enviou <b>${esc(p.item)}</b> para <b>${esc(p.tipo)}</b> · ${esc(dm(p.data))} ${esc(p.hora || '')}${p.obs ? `<br><i>${esc(p.obs)}</i>` : ''}</div>
      <div class="linha95"><button class="w95-btn pri" data-aceita="${esc(k)}">Aceitar e definir prazo…</button><button class="w95-btn perigo" data-recusa="${esc(k)}">Recusar</button></div></div>`).join('') || '<p class="vazio95">Nenhum pedido pendente.</p>');
    const a = agora().abs;
    const l = Object.entries(est('lab')).filter(([, x]) => x).sort((x, y) => num(x[1].pronto) - num(y[1].pronto));
    $('[data-fila]', c).innerHTML = l.map(([id, x]) => { const s = Segredos.ler(['lab', id]) || {}; return `<div class="iv-mq${x.resultado ? ' lib' : ''}"><div class="iv-mq-t"><b>${esc(x.item)}</b> · ${esc(x.tipo)} · ${esc(x.ref || '')}<br>
      ${x.resultado ? `<span class="etq verde">publicado ${esc(dm(x.resultado.data))} ${esc(x.resultado.hora)}</span>` : `<span class="etq ambar">pronto em ${esc(dm((x.prontoTxt || {}).data))} ${esc((x.prontoTxt || {}).hora || '')}</span> <span class="mini">${esc(textoFalta(num(x.pronto) - a))}</span>`}
      ${s.texto ? '' : ' <span class="etq verm">sem resultado escrito</span>'}</div>
      <div class="linha95">${x.resultado ? `<button class="w95-btn" data-ver="${esc(id)}">Ver fax</button>` : `<button class="w95-btn pri" data-lib="${esc(id)}">Liberar agora</button><button class="w95-btn" data-prazo="${esc(id)}">Prazo…</button>`}<button class="w95-btn" data-res="${esc(id)}">Resultado…</button><button class="w95-btn perigo" data-del="${esc(id)}">×</button></div></div>`; }).join('') || '<p class="vazio95">Fila vazia.</p>';
    const mods = Object.entries(Segredos.ler(['lab', '_modelos']) || {}).filter(([, m]) => m);
    $('[data-mod]', c).innerHTML = mods.map(([k, m]) => `<div class="iv-mq"><div class="iv-mq-t"><b>${esc(m.titulo || m.ref || k)}</b> · ${esc(m.ref || '')} · item ${esc(m.item || '?')} · ${esc(m.tipo || '')}</div><div class="linha95"><button class="w95-btn" data-usa="${esc(k)}">Usar em nova análise</button><button class="w95-btn" data-mod-ed="${esc(k)}">Editar</button><button class="w95-btn perigo" data-mod-del="${esc(k)}">×</button></div></div>`).join('') || '<p class="vazio95">Nenhum modelo. Importe as sementes (aba Segredos) para ter o resultado de DNA pronto.</p>';
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if (d.aceita) janelaAnalise({ pedidoId: d.aceita, ...(C.ped.lab[d.aceita] || {}) });
    else if (d.recusa) { if (await confirmar('Recusar e apagar este pedido?')) Rede.set('pedidos/lab/' + d.recusa, null); }
    else if ('nova' in d) janelaAnalise({});
    else if ('modelo' in d) janelaModelo(null);
    else if (d.usa) { const m = Segredos.ler(['lab', '_modelos', d.usa]) || {}; janelaAnalise({ item: m.item, tipo: m.tipo, modelo: d.usa }); }
    else if (d.modEd) janelaModelo(d.modEd);
    else if (d.modDel) { if (await confirmar('Apagar este modelo?')) Segredos.gravar(['lab', '_modelos', d.modDel], null); }
    else if (d.lib) publicarLab(d.lib, false);
    else if (d.ver) abrirFax(d.ver);
    else if (d.prazo) {
      const h = await pedirTexto('Novo prazo: quantas horas de jogo a partir de agora?', '2', { tipo: 'number' }); if (h === null) return;
      const p = agora().abs + Math.max(0, num(h)) * 60; Estado.definir(['lab', d.prazo, 'pronto'], p); Estado.definir(['lab', d.prazo, 'prontoTxt'], deAbs(p));
    } else if (d.res) {
      const s = Segredos.ler(['lab', d.res]) || {}, x = est('lab')[d.res] || {};
      const w = janela({ titulo: 'Resultado da análise', largura: '480px', html: `<label class="campo">Referência<input class="w95-input" data-ref value="${esc(s.ref || x.ref || '')}"></label><label class="campo">Resultado (aceita &lt;b&gt;, &lt;i&gt;, &lt;br&gt;)<textarea class="w95-input" rows="7" data-tx>${esc(s.texto || '')}</textarea></label>
        ${x.resultado ? '<p class="mini">Já publicado: salvar atualiza o fax que os jogadores veem.</p>' : ''}<div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
      $('[data-ok]', w).addEventListener('click', () => {
        const ref = $('[data-ref]', w).value.trim(), texto = $('[data-tx]', w).value.trim();
        Segredos.gravar(['lab', d.res], { ref, texto }); labSemTexto.delete(d.res);
        if (x.resultado) Estado.definir(['lab', d.res, 'resultado'], { ...x.resultado, ref, texto });
        fecharJanela(w.parentElement.dataset.jan);
      });
    } else if (d.del) { if (await confirmar('Apagar esta análise da fila (e o resultado guardado)?')) { Estado.definir(['lab', d.del], null); Segredos.gravar(['lab', d.del], null); } }
  });
  desenhar();
  vivo(c, 'iv:estado', m => { if (m.lab) desenhar(); });
  vivo(c, 'iv:seg', desenhar);
  vivo(c, 'iv:ped', t => { if (t === 'lab') desenhar(); });
}
function janelaAnalise(p) {
  const mods = Object.entries(Segredos.ler(['lab', '_modelos']) || {}).filter(([, m]) => m);
  const tp = p.tipo || 'DNA';
  const refPadrao = t => `REF ${typeof CASO !== 'undefined' ? CASO.numero : ''}-${busca(t).slice(0, 3) || 'LAB'}-${pad2(conta(est('lab')) + 1)}`;
  const w = janela({ titulo: p.pedidoId ? 'Aceitar pedido de análise' : 'Nova análise', largura: '500px', html: `
    ${p.pedidoId ? `<p class="mini">Pedido de <b>${esc(p.nome || '?')}</b> em ${esc(p.data || '')} ${esc(p.hora || '')}${p.obs ? ': ' + esc(p.obs) : ''}</p>` : ''}
    <div class="grade2"><label class="campo">Item<input class="w95-input" data-it value="${esc(p.item || '')}" list="ivLabItens"></label>
    <label class="campo">Exame<select class="w95-input" data-tp>${TIPOS_LAB.map(t => `<option${t === tp ? ' selected' : ''}>${t}</option>`).join('')}</select></label></div>
    <datalist id="ivLabItens">${itensParaLab().map(i => `<option value="${esc(i.cod)}">`).join('')}</datalist>
    <div class="grade2"><label class="campo">Prazo (horas de jogo)<input class="w95-input" type="number" min="0" step="0.5" data-h value="6"></label>
    <label class="campo">Referência<input class="w95-input" data-ref value="${esc(refPadrao(tp))}"></label></div>
    <label class="campo">Usar modelo<select class="w95-input" data-mod><option value="">(nenhum)</option>${mods.map(([k, m]) => `<option value="${esc(k)}"${k === p.modelo ? ' selected' : ''}>${esc(m.titulo || m.ref || k)}</option>`).join('')}</select></label>
    <label class="campo">Resultado (só você vê até a hora chegar)<textarea class="w95-input" rows="6" data-tx></textarea></label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Iniciar análise</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  const usar = () => { const m = Segredos.ler(['lab', '_modelos', $('[data-mod]', w).value]); if (!m) return; $('[data-tx]', w).value = m.texto || ''; if (m.ref) $('[data-ref]', w).value = m.ref; if (m.item && !$('[data-it]', w).value) $('[data-it]', w).value = m.item; if (m.tipo) $('[data-tp]', w).value = m.tipo; };
  $('[data-mod]', w).addEventListener('change', usar); if (p.modelo) usar();
  $('[data-ok]', w).addEventListener('click', () => {
    const item = $('[data-it]', w).value.trim(); if (!item) return aviso('Informe o item.', 'erro');
    const id = p.pedidoId || ('l' + Date.now().toString(36)), t = agora(), h = Math.max(0, num($('[data-h]', w).value, 6));
    const ref = $('[data-ref]', w).value.trim(), texto = $('[data-tx]', w).value.trim();
    Segredos.gravar(['lab', id], { ref, texto });
    Estado.definir(['lab', id], { item, tipo: $('[data-tp]', w).value, ref, obs: p.obs || '', pedido: { data: p.data || t.data, hora: p.hora || t.hora }, pedidoPor: p.nome || '', inicio: t.abs, pronto: t.abs + h * 60, prontoTxt: deAbs(t.abs + h * 60), status: 'analise', ts: Date.now() });
    if (p.pedidoId) Rede.set('pedidos/lab/' + p.pedidoId, null);
    CRW.diario('laboratorio', `Análise iniciada: ${item} (${$('[data-tp]', w).value}), prazo ${h}h de jogo`);
    fecharJanela(w.parentElement.dataset.jan); aviso('Análise na fila do laboratório.');
  });
}
function janelaModelo(k) {
  const m = k ? (Segredos.ler(['lab', '_modelos', k]) || {}) : {};
  const w = janela({ titulo: k ? 'Editar modelo' : 'Novo modelo de resultado', largura: '480px', html: `<label class="campo">Nome do modelo<input class="w95-input" data-ti value="${esc(m.titulo || '')}"></label>
    <div class="grade2"><label class="campo">Referência<input class="w95-input" data-ref value="${esc(m.ref || '')}"></label><label class="campo">Item<input class="w95-input" data-it value="${esc(m.item || '')}"></label></div>
    <label class="campo">Exame<select class="w95-input" data-tp>${TIPOS_LAB.map(t => `<option${t === m.tipo ? ' selected' : ''}>${t}</option>`).join('')}</select></label>
    <label class="campo">Texto do resultado<textarea class="w95-input" rows="6" data-tx>${esc(m.texto || '')}</textarea></label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', () => {
    const g = s => $(s, w).value.trim();
    Segredos.gravar(['lab', '_modelos', k || ('m' + Date.now().toString(36))], { titulo: g('[data-ti]'), ref: g('[data-ref]'), item: g('[data-it]'), tipo: g('[data-tp]'), texto: g('[data-tx]') });
    fecharJanela(w.parentElement.dataset.jan);
  });
}

/* =========================================================
   25 · COLETA NO LOCAL E CADEIA DE CUSTÓDIA
   segredos/coleta/<id> = { lote, nome, desc, foto?, entregue? }
   caso/coleta/<id> = { codigo, nome, desc, lote, foto, achadoPor, achadoNome, data, hora, ts, cadeia: { <k>: { de, para, acao, pc, nome, data, hora, ts, nota?, quebra? } } }
   caso/coleta/E-0n/cadeia/<k> = movimentações dos itens E-01 a E-07 (custódia inicial vem de dados.js)
   ========================================================= */
const ACOES = ['coletado', 'transferido', 'enviado ao laboratório', 'devolvido', 'lacrado'];
const CUSTODIA_INICIAL = { de: 'Cena · Rodovia Hollow Mill, km 4', para: 'Eq. Perícia 2', acao: 'coletado', nome: 'Eq. Perícia 2', data: '21/05/1997', hora: '06:31', base: true };
function itensColeta() {
  const l = evidCaso().map(e => ({ id: e.id, codigo: e.id, nome: '', descHtml: e.desc, status: e.status, flag: e.flag, lote: 'chevette', base: true, data: '21/05/1997', hora: '06:31', achadoNome: 'Eq. Perícia 2' }));
  Object.entries(C.coleta || {}).filter(([, x]) => x && x.codigo).sort((a, b) => num(a[1].ts) - num(b[1].ts)).forEach(([id, x]) => l.push({ id, ...x }));
  return l;
}
function idDoItem(cod) { const it = itensColeta().find(x => x.codigo === cod); return it ? it.id : null; }
function cadeiaDe(it) {
  const extra = Object.entries(((C.coleta || {})[it.id] || {}).cadeia || {}).filter(([, x]) => x).map(([k, x]) => ({ k, ...x }));
  const l = (it.base ? [{ k: '_ini', ...CUSTODIA_INICIAL }] : []).concat(extra).sort((a, b) => (a.base ? -1 : b.base ? 1 : 0) || num(a.ts) - num(b.ts));
  // quebras: quem entregou não era quem tinha o item, data que volta no tempo, ou marcação manual
  l.forEach((x, i) => {
    x.motivos = [];
    if (x.quebra) x.motivos.push('marcada como quebra');
    if (i > 0) {
      const ant = l[i - 1];
      if (busca(x.de) && busca(ant.para) && busca(x.de) !== busca(ant.para)) x.motivos.push(`saiu de "${x.de}", mas estava com "${ant.para}"`);
      if (x.data && ant.data && absDe(x.data, x.hora) < absDe(ant.data, ant.hora)) x.motivos.push('data anterior à movimentação de antes');
    }
  });
  return l;
}
function registrarCadeia(id, op) {
  if (!id) return;
  const it = itensColeta().find(x => x.id === id); if (!it) return;
  const cad = cadeiaDe(it), ult = cad[cad.length - 1] || {}, q = quem(), t = agora();
  return Rede.push(`caso/coleta/${id}/cadeia`, { de: op.de || ult.para || '', para: op.para || '', acao: op.acao || 'transferido', pc: q.pc, nome: q.nome, data: op.data || t.data, hora: op.hora || t.hora, nota: op.nota || '', quebra: !!op.quebra, ts: Date.now() })
    .pronto.catch(() => aviso('O servidor recusou o registro de custódia.', 'erro'));
}
function rColeta(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Evidências e Cadeia de Custódia</h2><div class="meta">Formulário CCSO-25<br>livro de custódia</div></div><div class="panel-b">
    <p class="mini">Cada evidência tem a sua cadeia de custódia: quem coletou, com quem ficou, quando foi ao laboratório. Toda movimentação precisa sair de quem estava com o item; se não sair, o sistema acusa <b class="iv-verm">quebra de custódia</b>.</p>
    <div data-lista></div></div></div>`;
  const lista = $('[data-lista]', sec), abertos = new Set(ls.get('ivColAbertos', []));
  const desenhar = () => {
    const v = CRW.v();
    lista.innerHTML = itensColeta().map(it => {
      const cad = cadeiaDe(it), ult = cad[cad.length - 1] || {}, quebra = cad.some(x => x.motivos.length);
      return `<details class="iv-ev${quebra ? ' quebra' : ''}" data-ev="${esc(it.id)}"${abertos.has(it.id) ? ' open' : ''}><summary>
        <span class="iv-ev-cod">${esc(it.codigo)}</span><span class="iv-ev-n">${it.base ? it.descHtml : esc(it.nome)}</span>
        <span class="iv-ev-st"><span class="etq">com: ${esc(ult.para || '?')}</span>${quebra ? '<span class="etq verm">quebra de custódia</span>' : ''}</span></summary>
        <div class="iv-ev-c">
          ${it.foto ? `<img class="iv-ev-foto" src="${esc(it.foto)}" alt="Foto da evidência ${esc(it.codigo)}" data-foto="${esc(it.id)}">` : ''}
          ${it.base ? `<p class="mini">Situação no caso: <b>${esc(it.status || '')}</b></p>` : `<p class="tx">${esc(it.desc || '')}</p>`}
          <p class="mini">Local: <b>${esc(loteNome(it.lote))}</b> · coletado por <b>${esc(it.achadoNome || '?')}</b> em ${esc(it.data || '')} ${esc(it.hora || '')}</p>
          <ol class="iv-cad">${cad.map(x => `<li class="${x.motivos.length ? 'quebra' : ''}"><span class="iv-cad-ts">${esc(dm(x.data))} ${esc(x.hora || '')}</span>
            <span class="iv-cad-t"><b>${esc(x.acao || '')}</b> · de ${esc(x.de || '?')} para <b>${esc(x.para || '?')}</b>${x.nome ? ` · registrado por ${esc(x.nome)}` : ''}${x.nota ? `<br><i>${esc(x.nota)}</i>` : ''}
            ${x.motivos.length ? `<br><b class="iv-verm">QUEBRA DE CUSTÓDIA:</b> ${esc(x.motivos.join('; '))}` : ''}</span>
            ${v.mestre && !x.base ? `<button class="iv-lnk" data-cad-del="${esc(it.id)}|${esc(x.k)}">apagar</button>` : ''}</li>`).join('')}</ol>
          ${logado() && !v.espiando ? `<div class="linha95"><button class="w95-btn pri" data-mov="${esc(it.id)}">Registrar movimentação…</button><button class="w95-btn" data-lab="${esc(it.codigo)}">Pedir análise</button><button class="w95-btn" data-etq="${esc(it.id)}">Etiqueta</button></div>` : ''}
        </div></details>`;
    }).join('');
  };
  lista.addEventListener('toggle', e => { const d = e.target.closest('[data-ev]'); if (!d) return; d.open ? abertos.add(d.dataset.ev) : abertos.delete(d.dataset.ev); ls.set('ivColAbertos', [...abertos]); }, true);
  lista.addEventListener('click', async e => {
    const b = e.target.closest('[data-mov],[data-lab],[data-etq],[data-cad-del],[data-foto]'); if (!b) return;
    if (b.dataset.mov) janelaMov(b.dataset.mov);
    else if (b.dataset.lab) { ls.set('ivLabItem', b.dataset.lab); CRW.abrirModulo('lab'); }
    else if (b.dataset.etq) { const it = itensColeta().find(x => x.id === b.dataset.etq); if (it) telaColeta({ cid: it.id, codigo: it.codigo, nome: it.nome || String(it.descHtml || '').replace(/<[^>]+>/g, ''), desc: it.desc || '', lote: it.lote, loteNome: loteNome(it.lote), data: it.data, hora: it.hora, achadoNome: it.achadoNome }, true); }
    else if (b.dataset.cadDel) { const [id, k] = b.dataset.cadDel.split('|'); if (await confirmar('Apagar esta movimentação da cadeia de custódia?')) Rede.set(`caso/coleta/${id}/cadeia/${k}`, null); }
    else if (b.dataset.foto) { const it = itensColeta().find(x => x.id === b.dataset.foto); if (it && it.foto) janela({ titulo: it.codigo + ' · foto', largura: '720px', html: `<img src="${esc(it.foto)}" alt="" style="width:100%;height:auto;display:block">` }); }
  });
  desenhar();
  vivo(sec, 'iv:coleta', desenhar);
}
function janelaMov(id) {
  const it = itensColeta().find(x => x.id === id); if (!it) return;
  const cad = cadeiaDe(it), ult = cad[cad.length - 1] || {}, t = agora();
  const nomes = [...new Set(['Sala de Provas', 'Laboratório Estadual', 'Eq. Perícia 2', 'Necrotério Municipal', ...CRW.pcs().map(p => p.nome)])];
  const w = janela({ titulo: `Movimentar ${it.codigo}`, largura: '440px', html: `
    <label class="campo">Ação<select class="w95-input" data-acao>${ACOES.filter(a => a !== 'coletado').map(a => `<option>${a}</option>`).join('')}</select></label>
    <div class="grade2"><label class="campo">De (quem estava com o item)<input class="w95-input" data-de value="${esc(ult.para || '')}" list="ivNomesCad"></label>
    <label class="campo">Para<input class="w95-input" data-para list="ivNomesCad" value="${esc(quem().nome)}"></label></div>
    <datalist id="ivNomesCad">${nomes.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
    <div class="grade2"><label class="campo">Data<input class="w95-input" data-data value="${esc(t.data)}"></label><label class="campo">Hora<input class="w95-input" data-hora value="${esc(t.hora)}"></label></div>
    <label class="campo">Observação<input class="w95-input" data-nota maxlength="200" placeholder="Ex.: lacre 0457 conferido"></label>
    <label class="chk95"><input type="checkbox" data-qb> Registrar como quebra de custódia (lacre rompido, item fora de controle, sumiço)</label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Registrar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-acao]', w).addEventListener('change', e => { if (e.target.value === 'enviado ao laboratório') $('[data-para]', w).value = 'Laboratório Estadual'; if (e.target.value === 'lacrado') $('[data-para]', w).value = $('[data-de]', w).value; });
  $('[data-ok]', w).addEventListener('click', () => {
    const g = s => $(s, w).value.trim();
    if (!g('[data-para]')) return aviso('Diga para quem o item foi.', 'erro');
    if (!/^\d{2}\/\d{2}\/\d{4}$/.test(g('[data-data]')) || !/^\d{1,2}:\d{2}$/.test(g('[data-hora]'))) return aviso('Data no formato dd/mm/aaaa e hora hh:mm.', 'erro');
    registrarCadeia(id, { acao: g('[data-acao]'), de: g('[data-de]'), para: g('[data-para]'), data: g('[data-data]'), hora: g('[data-hora]'), nota: g('[data-nota]'), quebra: $('[data-qb]', w).checked });
    Som.tom(520, 0, 0.08, 'square', 0.04);
    fecharJanela(w.parentElement.dataset.jan);
  });
}
function proximoCodigo() {
  let m = 0;
  evidCaso().forEach(e => { m = Math.max(m, num(String(e.id).replace(/\D/g, ''))); });
  Object.values(C.coleta || {}).forEach(x => { if (x && x.codigo) m = Math.max(m, num(String(x.codigo).replace(/\D/g, ''))); });
  return 'E-' + pad2(m + 1);
}
// a tela "EVIDÊNCIA COLETADA" (no aparelho de quem achou; também abre como etiqueta)
function telaColeta(e, soEtiqueta) {
  const x = (C.coleta || {})[e.cid] || {};
  const foto = x.foto || e.foto || '';
  const w = janela({ id: 'iv-coleta', titulo: soEtiqueta ? 'Etiqueta de evidência' : 'Evidência coletada', largura: '460px', classe: 'iv-coljan', icone: '⚑', html: `
    ${soEtiqueta ? '' : '<div class="iv-flash"></div><div class="iv-col-carimbo">EVIDÊNCIA COLETADA</div>'}
    <div class="iv-etq"><span class="iv-etq-furo"></span>
      <div class="iv-etq-cab">CCSO · CONDADO DE CROWSREST · EVIDÊNCIA</div>
      <div class="iv-etq-cod">${esc(e.codigo || x.codigo || '')}</div>
      <div class="iv-etq-l"><span>Caso</span><b>${esc(typeof CASO !== 'undefined' ? CASO.numero : '')}</b></div>
      <div class="iv-etq-l"><span>Item</span><b>${esc(e.nome || x.nome || '')}</b></div>
      ${(e.desc || x.desc) ? `<div class="iv-etq-l"><span>Descrição</span><b>${esc(e.desc || x.desc)}</b></div>` : ''}
      <div class="iv-etq-l"><span>Local</span><b>${esc(e.loteNome || loteNome(e.lote || x.lote))}</b></div>
      <div class="iv-etq-l"><span>Coletado por</span><b>${esc(e.achadoNome || x.achadoNome || (CRW.pc(e.pc || x.achadoPor) || {}).nome || '')}</b></div>
      <div class="iv-etq-l"><span>Data e hora</span><b>${esc(e.data || x.data || '')} ${esc(e.hora || x.hora || '')}</b></div>
      ${foto ? `<img class="iv-etq-foto" src="${esc(foto)}" alt="">` : ''}
      <div class="iv-etq-ass"><span>Lacre nº ${esc(String(e.cid || '').slice(-6).toUpperCase())}</span><span>Assinatura: ______________</span></div>
    </div>
    <p class="mini">${soEtiqueta ? '' : 'O item entrou no livro de evidências do grupo, com a cadeia de custódia aberta em seu nome.'}</p>
    <div class="msg-bts"><button class="w95-btn pri" data-ir>Ver na cadeia de custódia</button><button class="w95-btn" data-fechar>Fechar</button></div>` });
  if (!soEtiqueta) { Som.ruido(0, 0.08, 0.12, 3200, 'highpass'); Som.tom(1500, 0.02, 0.05, 'square', 0.04); Som.tom(1200, 0.35, 0.3, 'triangle', 0.06); setTimeout(() => Som.ding(), 500); }
  $('[data-ir]', w).addEventListener('click', () => { fecharJanela('iv-coleta'); const ab = new Set(ls.get('ivColAbertos', [])); ab.add(e.cid); ls.set('ivColAbertos', [...ab]); CRW.refazerModulo('coleta'); CRW.abrirModulo('coleta'); });
}
CRW.aoEntregar('coleta', e => { const vis = lsg('ivColVistas', {}); if (vis[e.cid]) return; vis[e.cid] = 1; lss('ivColVistas', vis); telaColeta(e); });
function verColetasNovas() {
  const P = CRW.P; if (!logado() || P.espiar || CRW.TV) return;
  const vis = lsg('ivColVistas', {}), conh = lsg('ivColConh', {}); let m1 = false, m2 = false;
  Object.entries(C.coleta || {}).forEach(([cid, x]) => {
    if (!x || !x.codigo) return;
    const recente = Date.now() - num(x.ts) < 2 * 3600e3;
    if (P.pc && x.achadoPor === P.pc && !vis[cid]) { vis[cid] = 1; m1 = true; if (recente) telaColeta({ cid, ...x }); conh[cid] = 1; m2 = true; return; }
    if (!conh[cid]) { conh[cid] = 1; m2 = true; if (recente && !P.mestre) aviso(`Nova evidência no livro: ${x.codigo} · ${x.nome} (achada por ${x.achadoNome || '?'})`); }
  });
  if (m1) lss('ivColVistas', vis); if (m2) lss('ivColConh', conh);
}
/* ---------- Mestre: coletas escondidas ---------- */
async function entregarColeta(id, pcid, data, hora) {
  const s = Segredos.ler(['coleta', id]); if (!s) return;
  const p = CRW.pc(pcid); if (!p) return aviso('Escolha quem encontrou.', 'erro');
  const codigo = proximoCodigo(), cid = Rede.chave(), lnome = loteNome(s.lote), ts = Date.now();
  const reg = { codigo, nome: s.nome || '', desc: s.desc || '', lote: s.lote || '', foto: s.foto || null, achadoPor: pcid, achadoNome: p.nome, data, hora, ts, origem: id,
    cadeia: { ['c' + ts.toString(36)]: { de: 'Local: ' + lnome, para: p.nome, acao: 'coletado', pc: pcid, nome: p.nome, data, hora, ts } } };
  C.coleta[cid] = reg;
  try { await Rede.set('caso/coleta/' + cid, reg); } catch (e) { return aviso('O servidor recusou a coleta.', 'erro'); }
  Segredos.gravar(['coleta', id, 'entregue'], { codigo, cid, pc: pcid, ts });
  CRW.entregar(pcid, { tipo: 'coleta', cid, codigo, nome: reg.nome, desc: reg.desc, lote: reg.lote, loteNome: lnome, data, hora, achadoNome: p.nome });
  CRW.diario('coleta', `${codigo} · ${reg.nome} entregue a ${p.nome} (${lnome})`);
  aviso(`${codigo} entregue a ${p.nome}.`);
}
function janelaEntregar(id) {
  const s = Segredos.ler(['coleta', id]) || {}, l = CRW.pcs(), t = agora();
  if (!l.length) return aviso('Cadastre os investigadores primeiro.', 'erro');
  const w = janela({ titulo: 'Entregar coleta', largura: '400px', html: `<p class="tx"><b>${esc(s.nome || '')}</b> · ${esc(loteNome(s.lote))}<br>Vai virar <b>${esc(proximoCodigo())}</b>.</p>
    <label class="campo">Quem encontrou<select class="w95-input" data-pc>${l.map(p => `<option value="${esc(p.id)}"${CRW.Mapa && CRW.Mapa.ondeEsta && CRW.Mapa.ondeEsta(p.id) === s.lote ? ' selected' : ''}>${esc(p.nome)}</option>`).join('')}</select></label>
    <div class="grade2"><label class="campo">Data<input class="w95-input" data-d value="${esc(t.data)}"></label><label class="campo">Hora<input class="w95-input" data-h value="${esc(t.hora)}"></label></div>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Entregar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', () => { entregarColeta(id, $('[data-pc]', w).value, $('[data-d]', w).value.trim(), $('[data-h]', w).value.trim()); fecharJanela(w.parentElement.dataset.jan); });
}
function mColeta(c) {
  const ls2 = lotes().slice().sort((a, b) => a.nome.localeCompare(b.nome));
  c.innerHTML = `<p class="mini">Esconda evidências em um local. Quando o grupo encontrar, toque em "Entregar coleta" e escolha quem achou: abre para ele a tela "Evidência coletada", o item recebe o próximo número (E-08, E-09...) e entra na cadeia de custódia.</p>
    <div class="iv-mform"><div class="grade2"><label class="campo">Local<select class="w95-input" data-lote>${ls2.map(l => `<option value="${esc(l.id)}">${esc(l.nome)}</option>`).join('')}</select></label>
      <label class="campo">Nome da evidência<input class="w95-input" data-nome maxlength="80" placeholder="Ex.: luva de látex rasgada"></label></div>
      <label class="campo">Descrição (o jogador lê ao coletar)<textarea class="w95-input" rows="2" data-desc maxlength="600"></textarea></label>
      <div class="linha95"><label class="campo iv-flex">Foto (opcional)<input type="file" accept="image/*" data-foto></label><button class="w95-btn pri" data-add>Esconder no local</button></div></div>
    <div data-lista></div>`;
  let foto = '';
  $('[data-foto]', c).addEventListener('change', async e => { try { foto = await CRW.lerImagem(e.target.files[0], 1000, 0.75); aviso('Foto carregada.'); } catch (er) { aviso('Imagem inválida.', 'erro'); } });
  const desenhar = () => {
    const s = Object.entries(Segredos.ler(['coleta']) || {}).filter(([, x]) => x && typeof x === 'object');
    const grupos = {}; s.forEach(([id, x]) => { (grupos[x.lote || ''] = grupos[x.lote || ''] || []).push({ id, ...x }); });
    $('[data-lista]', c).innerHTML = Object.keys(grupos).sort((a, b) => loteNome(a).localeCompare(loteNome(b))).map(lt => `<h4 class="iv-h4">${esc(loteNome(lt))}</h4>` + grupos[lt].map(x => `<div class="iv-mq${x.entregue ? ' lib' : ''}">
      <div class="iv-mq-t">${x.foto ? '▣ ' : ''}<b>${esc(x.nome || '')}</b>${x.desc ? `<br><span class="mini">${esc(x.desc)}</span>` : ''}${x.entregue ? `<br><span class="etq verde">entregue como ${esc(x.entregue.codigo)} a ${esc((CRW.pc(x.entregue.pc) || {}).nome || x.entregue.pc)}</span>` : ''}</div>
      <div class="linha95">${x.entregue ? '' : `<button class="w95-btn pri" data-ent="${esc(x.id)}">Entregar coleta…</button>`}<button class="w95-btn perigo" data-del="${esc(x.id)}">×</button></div></div>`).join('')).join('') || '<p class="vazio95">Nenhuma evidência escondida.</p>';
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return;
    if ('add' in b.dataset) {
      const nome = $('[data-nome]', c).value.trim(); if (!nome) return aviso('Dê um nome à evidência.', 'erro');
      Segredos.gravar(['coleta', 'c' + Date.now().toString(36)], { lote: $('[data-lote]', c).value, nome, desc: $('[data-desc]', c).value.trim(), foto: foto || null });
      $('[data-nome]', c).value = ''; $('[data-desc]', c).value = ''; $('[data-foto]', c).value = ''; foto = '';
      aviso('Evidência escondida no local.');
    } else if (b.dataset.ent) janelaEntregar(b.dataset.ent);
    else if (b.dataset.del) { if (await confirmar('Apagar esta evidência escondida? (o que já foi entregue continua no livro do grupo)')) Segredos.gravar(['coleta', b.dataset.del], null); }
  });
  desenhar(); vivo(c, 'iv:seg', desenhar); vivo(c, 'iv:coleta', desenhar);
}
CRW.registrarCartao({ id: 'iv-coleta', ordem: 40, render(lote, corpo, v) {
  const l = itensColeta().filter(x => x.lote === lote.id);
  const esc2 = v && v.mestre ? Object.entries(Segredos.ler(['coleta']) || {}).filter(([, x]) => x && x.lote === lote.id && !x.entregue) : [];
  if (!l.length && !esc2.length) return;
  const d = el('div', 'iv-cartao');
  d.innerHTML = `<b>Evidências coletadas aqui</b>${l.length ? `<ul>${l.map(x => `<li><b>${esc(x.codigo)}</b> ${x.base ? esc(String(x.descHtml || '').replace(/<[^>]+>/g, '').slice(0, 60)) : esc(x.nome)} <span class="mini">· ${esc(x.achadoNome || '')} ${esc(dm(x.data))} ${esc(x.hora || '')}</span></li>`).join('')}</ul>` : '<p class="mini">Nenhuma ainda.</p>'}
    ${esc2.length ? `<b>Escondidas (só você vê)</b><ul>${esc2.map(([id, x]) => `<li>${esc(x.nome)} <button class="w95-btn" data-iv-ent="${esc(id)}">Entregar…</button></li>`).join('')}</ul>` : ''}
    <div class="linha95"><button class="w95-btn" data-iv-livro>Abrir a cadeia de custódia</button></div>`;
  d.addEventListener('click', e => { const b = e.target.closest('[data-iv-ent]'); if (b) janelaEntregar(b.dataset.ivEnt); if (e.target.closest('[data-iv-livro]')) CRW.abrirModulo('coleta'); });
  corpo.appendChild(d);
} });

/* =========================================================
   26 · CONSULTA ÀS BASES (terminal DOS)
   estado/bases/<base>/<chave> = { titulo, linhas:[...], alias:[...], selado:false } | { titulo, selado:true } | { oculto:true }
   segredos/bases/<base>/<chave> = { titulo, linhas:[...] }   (conteúdo dos SELADOS)
   caso/consultas/<k> = { cmd, pc, nome, data, hora, n, ts }
   pedidos/autorizacao/<id> = { base, chave, titulo, motivo, pc, nome, ts }
   Registros públicos que já existem em dados.js (o Chevette, o BO, a ficha
   pública do Furão) entram como "padrão" e o Mestre pode editar ou ocultar.
   ========================================================= */
const BASES = { placa: 'Placas', chassi: 'Chassi', nome: 'Pessoas', endereco: 'Endereços', bo: 'Boletins de ocorrência' };
const semTags = h => String(h || '').replace(/<[^>]+>/g, '');
let padraoCache = null;
function basesPadrao() {
  if (padraoCache) return padraoCache;
  const K = typeof CASO !== 'undefined' ? CASO : {}, pi = K.pessoaInteresse || {}, oc = K.ocorrencia || {};
  padraoCache = {
    chassi: {
      '1G1A': { titulo: 'CHEVROLET CHEVETTE · CHASSI 1G1A[######]', alias: ['CHEVETTE'], linhas: ['cor ............ castanho desbotado', 'placas ......... NENHUMA (dianteira e traseira ausentes)', 'chassi ......... numeração PARCIALMENTE RASPADA', 'propriedade .... NENHUM REGISTRO ENCONTRADO', 'pátio .......... SEM FICHA DE PÁTIO / SEM APREENSÃO', 'furto .......... NENHUM BOLETIM ASSOCIADO', 'vínculo ........ caso ' + (K.numero || '') + ' · item E-01'] },
      '1G1A_ACESSO': { titulo: 'ACESSO ANTERIOR A ESTE CHASSI · TERMINAL SO-CRW-01', alias: ['CHEVETTE'], selado: true },
    },
    placa: { NENHUMA: { titulo: 'VEÍCULO SEM PLACAS · CASO ' + (K.numero || ''), linhas: ['Chevette castanho encontrado sem placa dianteira nem traseira.', 'Consulte pelo chassi: CHASSI 1G1A'] } },
    nome: pi.campos ? { DALERENNER: { titulo: `FICHA ${pi.ficha || ''} · PESSOA DE INTERESSE`, alias: ['FURAO', 'RENNER'], linhas: [
      ...pi.campos.map(([k, x]) => (k + ' ').padEnd(17, '.') + ' ' + x), 'situação ........ ' + String(pi.status || '').toUpperCase(), 'antecedentes:', ...(pi.antecedentes || []).map(a => '  · ' + a), 'última vez visto: ' + semTags(pi.ultima)] } } : {},
    bo: oc.ref ? { [busca(oc.ref.replace(/^BO\s*/i, ''))]: { titulo: oc.ref + ' · ' + (oc.meta || ''), linhas: ['natureza ....... veículo abandonado com restos humanos', 'local .......... Rodovia Hollow Mill, km 4', 'aberto em ...... ' + (K.aberto || ''), 'responsável .... ' + (K.responsavel || '') + ' · ' + (K.unidade || ''), 'situação ....... ' + (K.situacao || ''), 'relato: ' + semTags(oc.relato)] } } : {},
    endereco: {},
  };
  return padraoCache;
}
function registros(base) {
  const pad = basesPadrao()[base] || {}, pub = est('bases')[base] || {}, out = {};
  Object.entries(pad).forEach(([k, r]) => { out[k] = { ...r, chave: k, padrao: true }; });
  Object.entries(pub).forEach(([k, r]) => { if (!r) return; if (r.oculto) { delete out[k]; return; } out[k] = { ...r, chave: k, padrao: false }; });
  return Object.values(out);
}
function procurar(base, q) {
  const qq = busca(q); if (!qq) return [];
  return registros(base).filter(r => busca(r.chave).includes(qq) || (r.alias || []).some(a => busca(a).includes(qq) || (qq.length >= 4 && qq.includes(busca(a)))) || (qq.length >= 4 && busca(r.titulo).includes(qq)))
    .sort((a, b) => (busca(b.chave) === qq ? 1 : 0) - (busca(a.chave) === qq ? 1 : 0) || (a.selado ? 1 : 0) - (b.selado ? 1 : 0));
}
let basesAnt = null;
function basesMudou() {
  const agoraB = JSON.parse(JSON.stringify(est('bases')));
  if (basesAnt) Object.entries(agoraB).forEach(([b, rs]) => Object.entries(rs || {}).forEach(([k, r]) => {
    const a = (basesAnt[b] || {})[k] || ((basesPadrao()[b] || {})[k]);
    if (a && a.selado && r && !r.selado && !r.oculto) CRW.emit('iv:liberado', { base: b, chave: k, titulo: r.titulo });
  }));
  basesAnt = agoraB;
}
const PROMPT = 'DMV/CRW > ';
function rBases(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Consulta às Bases · Terminal Estadual</h2><div class="meta">Terminal SO-CRW-02<br>Formulário CCSO-26</div></div><div class="panel-b">
    <div class="console iv-con" data-con><div class="iv-con-saida" data-out></div><div class="iv-con-linha"><span class="pr">${esc(PROMPT)}</span><input class="iv-con-in" data-in autocomplete="off" autocapitalize="off" spellcheck="false" enterkeyhint="go" aria-label="Comando"></div></div>
    <div class="iv-atalhos">${['ajuda', 'placa ', 'chassi ', 'nome ', 'endereco ', 'bo ', 'historico', 'limpar'].map(c => `<button class="w95-btn" data-cmd="${esc(c)}">${esc(c.trim().toUpperCase())}</button>`).join('')}<button class="w95-btn pri" data-exec>EXECUTAR ⏎</button></div>
    <p class="mini">Toque num atalho, complete o que falta e execute. Registros <b>SELADOS</b> exigem autorização do Guardião da Luz: peça pelo botão que aparece na resposta.</p></div></div>`;
  const out = $('[data-out]', sec), inp = $('[data-in]', sec), con = $('[data-con]', sec);
  const hist = []; let hi = 0, fila = [], escrevendo = false;
  const rola = () => { con.scrollTop = con.scrollHeight; };
  const redact = s => esc(s).replace(/@+/g, m => `<span class="redact">${m.replace(/@/g, '#')}</span>`);
  // escreve as linhas uma a uma (efeito de terminal)
  function escrever(linhas, rapido) {
    fila.push(...linhas); if (escrevendo) return; escrevendo = true;
    const passo = () => {
      if (!document.body.contains(sec)) return;
      const ln = fila.shift(); if (!ln) { escrevendo = false; rola(); return; }
      const d = el('div', 'iv-con-l ' + (ln.c || ''));
      if (ln.bt) d.innerHTML = `<button class="iv-con-bt" data-pedir="${esc(ln.bt.base)}|${esc(ln.bt.chave)}">[ PEDIR AUTORIZAÇÃO ]</button>`;
      else if (ln.p != null) d.innerHTML = `<span class="pr">${esc(ln.p)}</span>${esc(ln.t || '')}`;
      else if (ln.r) d.innerHTML = redact(ln.t);
      else d.textContent = ln.t || ' ';
      out.appendChild(d); rola();
      setTimeout(passo, rapido ? 0 : (ln.p != null ? 90 : 28));
    };
    passo();
  }
  // a tela inicial: o histórico que já veio no caso (CASO.terminalInicial)
  const ini = (typeof CASO !== 'undefined' && CASO.terminalInicial) || [];
  const linIni = ini.map(l => l.p != null ? { p: l.p, t: l.t } : l.e != null ? { t: l.e, c: 'err' } : l.r != null ? { t: l.r, r: true } : { t: l.o || '' });
  escrever([...linIni, { t: '' }, { t: 'Digite AJUDA para ver os comandos.', c: 'dim' }], !!ss.get('ivConIni', false));
  ss.set('ivConIni', true);

  function exec(txt) {
    txt = String(txt || '').trim(); if (!txt) return;
    hist.push(txt); hi = hist.length;
    escrever([{ p: PROMPT, t: txt }]);
    const [c0, ...resto] = txt.split(/\s+/), cmd = semAcento(c0).toLowerCase(), arg = resto.join(' ');
    let L = [], n = 0;
    const v = CRW.v();
    const mostra = (base, r) => {
      const l = [{ t: '  >> ' + (r.titulo || r.chave), c: 'ok' }];
      if (r.selado) {
        const s = v.mestre ? Segredos.ler(['bases', base, r.chave]) : null;
        if (s) { l.push({ t: '  ** REGISTRO SELADO · você vê porque é o Guardião da Luz **', c: 'sel' }); (s.linhas || []).forEach(x => l.push({ t: '    ' + x, c: 'sel' })); }
        else { l.push({ t: '  ** REGISTRO SELADO · AUTORIZAÇÃO NECESSÁRIA **', c: 'err' }); if (!v.mestre && !v.espiando) l.push({ bt: { base, chave: r.chave } }); }
      } else (r.linhas || []).forEach(x => l.push({ t: '    ' + x }));
      if (!r.selado && r.liberado) l.push({ t: '    (acesso autorizado pelo Gabinete)', c: 'dim' });
      return l;
    };
    const consultaBase = (base, rot) => {
      if (!arg) return [{ t: `  uso: ${cmd.toUpperCase()} <${rot}>`, c: 'err' }];
      const rs = procurar(base, arg); n = rs.length;
      if (!rs.length) return null;
      const l = [{ t: `  buscando em ${BASES[base].toUpperCase()} ............ ${rs.length} resultado(s)` }];
      rs.slice(0, 5).forEach(r => l.push(...mostra(base, r)));
      if (rs.length > 5) l.push({ t: `  ... e mais ${rs.length - 5}: refine a busca.`, c: 'dim' });
      return l;
    };
    const nada = () => [{ t: '  buscando registro ............' }, { t: '  >> NENHUM REGISTRO ENCONTRADO (0 resultados)', c: 'err' }];
    switch (cmd) {
      case 'ajuda': case 'help': case '?':
        L = [['AJUDA', 'esta lista'], ['PLACA <placa>', 'veículos pela placa'], ['CHASSI <número>', 'veículos pelo chassi (aceita parte)'], ['NOME <nome>', 'pessoas, fichas e cadastro do condado'], ['ENDERECO <texto>', 'imóveis e registros pelo endereço'], ['BO <número>', 'boletins de ocorrência'], ['HISTORICO', 'consultas feitas pelo grupo'], ['LIMPAR', 'limpa a tela']].map(([a, b]) => ({ t: '  ' + a.padEnd(18, ' ') + b }));
        break;
      case 'limpar': case 'cls': case 'clear': out.innerHTML = ''; fila = []; return;
      case 'historico': {
        const l = Object.values(C.consultas || {}).filter(Boolean).sort((a, b) => num(a.ts) - num(b.ts)).slice(-15);
        L = l.length ? [{ t: '  CONSULTAS DO GRUPO (últimas ' + l.length + '):' }, ...l.map(x => ({ t: `  [${dm(x.data)} ${x.hora || ''}] ${String(x.nome || '').toUpperCase()} · ${x.cmd} (${x.n || 0})` }))] : [{ t: '  nenhuma consulta registrada.', c: 'dim' }];
        break;
      }
      case 'placa': L = consultaBase('placa', 'placa') || nada(); break;
      case 'chassi': L = consultaBase('chassi', 'número') || nada(); break;
      case 'bo': L = consultaBase('bo', 'número') || nada(); break;
      case 'nome': {
        L = consultaBase('nome', 'nome') || [];
        if (arg) {
          const qq = busca(arg), achadas = procurar('nome', arg).map(r => busca(r.chave));
          const ns = qq.length >= 3 ? CRW.npcs().filter(x => x.tipo !== 'viatura' && !x.oculto && busca(x.nome).includes(qq) && !achadas.some(a => a && busca(x.nome).includes(a))) : [];
          ns.slice(0, 4).forEach(x => L.push({ t: '  >> CADASTRO DO CONDADO · ' + String(x.nome).toUpperCase(), c: 'ok' }, { t: '    ' + (x.pub || 'sem observações') }));
          n += ns.length;
          if (!L.length) L = nada();
        }
        break;
      }
      case 'endereco': case 'end': {
        L = consultaBase('endereco', 'texto') || [];
        if (arg) {
          const qq = busca(arg);
          const lt = qq.length >= 3 ? lotes().filter(l => busca(l.nome).includes(qq) || busca(l.end).includes(qq)) : [];
          lt.slice(0, 4).forEach(l => {
            const hr = l.horario ? (l.horario[0] === 0 && l.horario[1] >= 24 ? '24 horas' : `${pad2(l.horario[0])}h às ${pad2(l.horario[1] % 24)}h`) : 'não se aplica';
            L.push({ t: '  >> REGISTRO PÚBLICO DO IMÓVEL · ' + String(l.nome).toUpperCase(), c: 'ok' }, { t: '    endereço ....... ' + (l.end || '') }, { t: '    uso ............ ' + ((typeof CATEGORIAS !== 'undefined' && CATEGORIAS[l.cat]) ? CATEGORIAS[l.cat].nome : l.cat) }, { t: '    funcionamento .. ' + hr }, { t: '    descrição ...... ' + (l.pub || '') });
          });
          if (lt.length > 4) L.push({ t: '  ... outros: ' + lt.slice(4).map(l => l.nome).join(', '), c: 'dim' });
          n += lt.length;
          if (!L.length) L = nada();
        }
        break;
      }
      default: L = [{ t: `  COMANDO DESCONHECIDO: ${c0.toUpperCase()}. Digite AJUDA.`, c: 'err' }];
    }
    escrever([...L, { t: '' }]);
    if (['placa', 'chassi', 'nome', 'endereco', 'end', 'bo'].includes(cmd) && arg && !CRW.P.mestre) {
      const q = quem(), t = agora();
      Rede.push('caso/consultas', { cmd: (cmd === 'end' ? 'endereco' : cmd) + ' ' + arg.slice(0, 60), pc: q.pc, nome: q.nome, data: t.data, hora: t.hora, n, ts: Date.now() }).pronto.catch(() => {});
    }
    if (n === 0 && ['placa', 'chassi', 'nome', 'endereco', 'end', 'bo'].includes(cmd)) Som.erro(); else Som.clique();
  }
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') { e.preventDefault(); exec(inp.value); inp.value = ''; }
    else if (e.key === 'ArrowUp') { if (hi > 0) { hi--; inp.value = hist[hi] || ''; } e.preventDefault(); }
    else if (e.key === 'ArrowDown') { if (hi < hist.length) { hi++; inp.value = hist[hi] || ''; } e.preventDefault(); }
  });
  con.addEventListener('click', async e => {
    const b = e.target.closest('[data-pedir]');
    if (!b) { if (!matchMedia('(pointer:coarse)').matches && (!window.getSelection || !String(window.getSelection()))) inp.focus({ preventScroll: true }); return; }
    const [base, chave] = b.dataset.pedir.split('|'), pedidos = lsg('ivAutPedidas', {});
    if (pedidos[base + '/' + chave]) { escrever([{ t: '  SOLICITAÇÃO JÁ ENVIADA · aguarde a liberação do Gabinete.', c: 'dim' }]); return; }
    const motivo = await pedirTexto('Motivo do pedido de autorização (vai para o Guardião da Luz)', '', { titulo: 'Pedir autorização' });
    if (motivo === null) return;
    const r = registros(base).find(x => x.chave === chave) || {};
    CRW.pedir('autorizacao', { base, chave, titulo: r.titulo || chave, motivo: motivo.trim().slice(0, 300) }).pronto
      .then(() => { pedidos[base + '/' + chave] = Date.now(); lss('ivAutPedidas', pedidos); escrever([{ t: `  SOLICITAÇÃO DE ACESSO REGISTRADA · PROTOCOLO ${String(Date.now()).slice(-5)}`, c: 'ok' }, { t: '' }]); Som.ding(); })
      .catch(() => escrever([{ t: '  FALHA AO ENVIAR A SOLICITAÇÃO.', c: 'err' }]));
  });
  sec.addEventListener('click', e => {
    const b = e.target.closest('[data-cmd],[data-exec]'); if (!b) return;
    if (b.dataset.exec != null) { exec(inp.value); inp.value = ''; return; }
    const c = b.dataset.cmd; if (/\s$/.test(c)) { inp.value = c; inp.focus(); } else exec(c);
  });
  vivo(sec, 'iv:liberado', x => { escrever([{ t: '' }, { t: `  ** AUTORIZAÇÃO CONCEDIDA: ${x.titulo || x.chave} · consulte de novo **`, c: 'ok' }, { t: '' }]); });
}
CRW.on('iv:liberado', x => { if (logado() && !CRW.P.mestre) aviso('Bases: acesso autorizado a ' + (x.titulo || x.chave) + '.'); });

/* ---------- Mestre: editor de registros ---------- */
function liberarRegistro(base, k) {
  const s = Segredos.ler(['bases', base, k]); if (!s) return aviso('Este registro não tem conteúdo guardado nos segredos.', 'erro');
  const pub = (est('bases')[base] || {})[k] || (basesPadrao()[base] || {})[k] || {};
  Estado.definir(['bases', base, k], { titulo: s.titulo || pub.titulo || k, linhas: s.linhas || [], alias: pub.alias || s.alias || null, selado: false, liberado: Date.now() });
  Object.entries(C.ped.autorizacao || {}).forEach(([pk, p]) => { if (p && p.base === base && p.chave === k) Rede.set('pedidos/autorizacao/' + pk, null); });
  CRW.diario('bases', 'Registro liberado: ' + (s.titulo || k));
}
function selarRegistro(base, k) {
  const pub = (est('bases')[base] || {})[k] || (basesPadrao()[base] || {})[k] || {};
  if (!Segredos.ler(['bases', base, k])) Segredos.gravar(['bases', base, k], { titulo: pub.titulo || k, linhas: pub.linhas || [] });
  Estado.definir(['bases', base, k], { titulo: pub.titulo || k, alias: pub.alias || null, selado: true });
}
function mBases(c) {
  c.innerHTML = `<p class="mini">Registros públicos aparecem no terminal para todos. Os SELADOS aparecem só como "REGISTRO SELADO · AUTORIZAÇÃO NECESSÁRIA" e o conteúdo fica nos seus segredos até você liberar. "Padrão" é o que já vem do caso (dados.js).</p>
    <div data-ped></div><div class="linha95"><button class="w95-btn pri" data-novo>+ Novo registro</button></div><div data-regs></div>
    <details class="bloco95"><summary>Histórico de consultas do grupo</summary><div class="bloco95-c" data-hist></div></details>`;
  const desenhar = () => {
    const ped = Object.entries(C.ped.autorizacao || {}).filter(([, p]) => p);
    $('[data-ped]', c).innerHTML = `<h4 class="iv-h4">Pedidos de autorização (${ped.length})</h4>` + (ped.map(([k, p]) => `<div class="iv-mq ped"><div class="iv-mq-t"><b>${esc(p.nome || '?')}</b> pede: ${esc(BASES[p.base] || p.base)} · <b>${esc(p.titulo || p.chave)}</b>${p.motivo ? `<br><i>${esc(p.motivo)}</i>` : ''}</div>
      <div class="linha95"><button class="w95-btn pri" data-lib="${esc(p.base)}|${esc(p.chave)}">Liberar</button><button class="w95-btn perigo" data-nega="${esc(k)}">Negar</button></div></div>`).join('') || '<p class="vazio95">Nenhum pedido.</p>');
    const seg = Segredos.ler(['bases']) || {};
    $('[data-regs]', c).innerHTML = Object.keys(BASES).map(b => {
      const pubs = {}; registros(b).forEach(r => { pubs[r.chave] = r; });
      Object.keys(seg[b] || {}).forEach(k => { if (!pubs[k] && seg[b][k]) pubs[k] = { chave: k, titulo: seg[b][k].titulo, selado: true, soSeg: true }; });
      Object.entries((est('bases')[b] || {})).forEach(([k, r]) => { if (r && r.oculto) pubs[k] = { chave: k, titulo: ((basesPadrao()[b] || {})[k] || {}).titulo || k, oculto: true }; });
      const rs = Object.values(pubs); if (!rs.length) return '';
      return `<h4 class="iv-h4">${esc(BASES[b])}</h4>` + rs.map(r => {
        const temSeg = !!(seg[b] || {})[r.chave];
        const st = r.oculto ? '<span class="etq">oculto</span>' : r.selado ? `<span class="etq verm">selado</span>${r.soSeg ? ' <span class="etq ambar">fora do terminal</span>' : ''}` : temSeg ? '<span class="etq verde">liberado</span>' : r.padrao ? '<span class="etq">padrão</span>' : '<span class="etq azul">público</span>';
        const kk = esc(b) + '|' + esc(r.chave);
        return `<div class="iv-mq"><div class="iv-mq-t"><code>${esc(r.chave)}</code> ${st}<br>${esc(r.titulo || '')}</div><div class="linha95">
          ${r.oculto ? `<button class="w95-btn" data-mostra="${kk}">Mostrar de novo</button>` : `<button class="w95-btn" data-ed="${kk}">Editar</button>`}
          ${r.selado && temSeg ? `<button class="w95-btn pri" data-lib="${kk}">Liberar</button>` : ''}${r.soSeg ? `<button class="w95-btn" data-poe="${kk}">Pôr no terminal (selado)</button>` : ''}
          ${!r.selado && !r.oculto && temSeg ? `<button class="w95-btn" data-sela="${kk}">Selar de novo</button>` : ''}
          ${r.oculto ? '' : `<button class="w95-btn perigo" data-del="${kk}">×</button>`}</div></div>`;
      }).join('');
    }).join('');
    const h = Object.entries(C.consultas || {}).filter(([, x]) => x).sort((a, b) => num(b[1].ts) - num(a[1].ts)).slice(0, 40);
    $('[data-hist]', c).innerHTML = (h.map(([, x]) => `<div class="mini">[${esc(dm(x.data))} ${esc(x.hora || '')}] <b>${esc(x.nome || '')}</b> · ${esc(x.cmd || '')} (${num(x.n)})</div>`).join('') || '<p class="vazio95">Nenhuma consulta.</p>') + (h.length ? '<div class="linha95"><button class="w95-btn perigo" data-limpa>Limpar histórico</button></div>' : '');
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    const par = s => s.split('|');
    if ('novo' in d) editarRegistro(null, null);
    else if (d.ed) editarRegistro(...par(d.ed));
    else if (d.lib) { liberarRegistro(...par(d.lib)); aviso('Registro liberado no terminal.'); }
    else if (d.sela) selarRegistro(...par(d.sela));
    else if (d.poe) { const [bb, k] = par(d.poe); const s = Segredos.ler(['bases', bb, k]) || {}; Estado.definir(['bases', bb, k], { titulo: s.titulo || k, alias: s.alias || null, selado: true }); }
    else if (d.mostra) { const [bb, k] = par(d.mostra); Estado.definir(['bases', bb, k], null); }
    else if (d.nega) { if (await confirmar('Negar e apagar este pedido?')) Rede.set('pedidos/autorizacao/' + d.nega, null); }
    else if (d.del) {
      const [bb, k] = par(d.del);
      if (!(await confirmar('Apagar este registro do terminal?' + ((basesPadrao()[bb] || {})[k] ? '\n\nÉ um registro padrão do caso: ele fica oculto (dá para mostrar de novo).' : '')))) return;
      if ((basesPadrao()[bb] || {})[k]) Estado.definir(['bases', bb, k], { oculto: true }); else Estado.definir(['bases', bb, k], null);
      Segredos.gravar(['bases', bb, k], null);
    } else if ('limpa' in d) { if (await confirmar('Apagar o histórico de consultas do grupo?')) Rede.set('caso/consultas', null); }
  });
  desenhar();
  vivo(c, 'iv:estado', m => { if (m.bases) desenhar(); });
  vivo(c, 'iv:seg', desenhar); vivo(c, 'iv:consultas', desenhar);
  vivo(c, 'iv:ped', t => { if (t === 'autorizacao') desenhar(); });
}
function editarRegistro(base, k) {
  const pub = base ? ((est('bases')[base] || {})[k] || (basesPadrao()[base] || {})[k] || {}) : {};
  const s = base ? (Segredos.ler(['bases', base, k]) || {}) : {};
  const selado = !!pub.selado, linhas = (selado ? s.linhas : pub.linhas) || s.linhas || [];
  const w = janela({ titulo: base ? 'Editar registro' : 'Novo registro', largura: '500px', html: `
    <div class="grade2"><label class="campo">Base<select class="w95-input" data-b${base ? ' disabled' : ''}>${Object.entries(BASES).map(([b, n]) => `<option value="${b}"${b === base ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="campo">Chave (o que se digita)<input class="w95-input" data-k value="${esc(k || '')}"${base ? ' disabled' : ''} placeholder="Ex.: 3BX-447 ou DALE RENNER"></label></div>
    <label class="campo">Título<input class="w95-input" data-t value="${esc(pub.titulo || s.titulo || '')}"></label>
    <label class="campo">Linhas (uma por linha)<textarea class="w95-input iv-mono" rows="8" data-l>${esc(linhas.join('\n'))}</textarea></label>
    <label class="campo">Outros termos que acham este registro (separados por vírgula)<input class="w95-input" data-a value="${esc((pub.alias || s.alias || []).join(', '))}"></label>
    <label class="chk95"><input type="checkbox" data-s${selado ? ' checked' : ''}> SELADO (conteúdo só com você; o terminal mostra "autorização necessária")</label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', () => {
    const b = $('[data-b]', w).value, kk = base ? k : chaveDe($('[data-k]', w).value.trim().replace(/\s+/g, ''));
    if (!kk) return aviso('Informe a chave.', 'erro');
    const titulo = $('[data-t]', w).value.trim() || kk, ls2 = $('[data-l]', w).value.split('\n').map(x => x.replace(/\s+$/, '')).filter((x, i, a) => x || i < a.length - 1);
    const alias = $('[data-a]', w).value.split(',').map(x => chaveDe(x.trim().replace(/\s+/g, ''))).filter(Boolean);
    if ($('[data-s]', w).checked) { Segredos.gravar(['bases', b, kk], { titulo, linhas: ls2 }); Estado.definir(['bases', b, kk], { titulo, alias: alias.length ? alias : null, selado: true }); }
    else Estado.definir(['bases', b, kk], { titulo, linhas: ls2, alias: alias.length ? alias : null, selado: false, liberado: (s && s.titulo) ? Date.now() : null });
    fecharJanela(w.parentElement.dataset.jan);
  });
}

/* =========================================================
   27 · ARQUIVO DO CONDADO E MICROFILME
   segredos/arquivo/<id> = { tipo, titulo, data, fonte, texto (com [[tarja:...]] e [[rasura:...]]), micro, img, nota, publicado }
   estado/arquivo/<id> = { tipo, titulo, data, fonte, texto (com [[T:n]] e [[R:n]]), tarjas:[{tipo,len,t?}], revelado:{n:true}, micro, img, ts }
   O texto escondido nunca vai para o estado antes da revelação: só o tamanho da barra.
   ========================================================= */
const TIPOS_DOC = { jornal: 'Jornal', nascimento: 'Certidão de nascimento', casamento: 'Certidão de casamento', obito: 'Certidão de óbito', atestado: 'Atestado de óbito', registro: 'Registro antigo', outro: 'Documento' };
function compilar(txt) {
  const marcas = [];
  const texto = String(txt || '').replace(/\[\[(tarja|rasura):([\s\S]*?)\]\]/gi, (m, tp, c) => { const r = tp.toLowerCase() === 'rasura'; marcas.push({ tipo: r ? 'r' : 't', t: c.trim() }); return `[[${r ? 'R' : 'T'}:${marcas.length - 1}]]`; });
  return { texto, marcas };
}
const reveladosDe = d => { const r = (d && d.revelado) || {}; return Object.keys(r).filter(k => r[k]).map(Number); };
// HTML do documento. op: { prev: [textos] (prévia do Mestre), animar: [n...] }
function docHtml(d, op = {}) {
  const tj = d.tarjas || [], anim = op.animar || [];
  const corpo = htmlSimples(d.texto || '').replace(/\[\[(T|R):(\d+)\]\]/g, (m, t, n) => {
    n = +n; const x = tj[n] || {}, cls = (x.tipo || (t === 'R' ? 'r' : 't')) === 'r' ? 'ras' : 'tar';
    const rev = x.t != null && x.t !== '';
    if (rev) return `<span class="iv-tj ${cls} rev${anim.includes(n) ? ' anim' : ''}" data-n="${n}"><span class="iv-tj-t">${esc(x.t)}</span></span>`;
    const pv = op.prev && op.prev[n] != null ? `<span class="iv-tj-pv">${esc(op.prev[n])}</span>` : '';
    return `<span class="iv-tj ${cls}" data-n="${n}" style="--n:${Math.max(3, Math.min(60, num(x.len, 8)))}" aria-label="${cls === 'tar' ? 'trecho sob tarja' : 'trecho rasurado'}">${pv}</span>`;
  });
  const tipo = d.tipo || 'outro', rot = TIPOS_DOC[tipo] || 'Documento';
  const cab = tipo === 'jornal' ? `<div class="iv-doc-mast">${esc(d.fonte || 'Crowsrest Sentinel')}</div><div class="iv-doc-slug">${esc(d.data || '')}</div><h3 class="iv-doc-tit">${esc(d.titulo || '')}</h3>`
    : ['nascimento', 'casamento', 'obito'].includes(tipo) ? `<div class="iv-doc-ofc">ESTADO DE WEST VIRGINIA · CONDADO DE CROWSREST<br>CARTÓRIO DE REGISTRO CIVIL</div><div class="iv-doc-big">${esc(rot.toUpperCase())}</div><div class="iv-doc-sub">${esc(d.titulo || '')}${d.data ? ' · ' + esc(d.data) : ''}</div>`
    : tipo === 'atestado' ? `<div class="iv-doc-ofc">CONDADO DE CROWSREST · DECLARAÇÃO MÉDICA</div><div class="iv-doc-big">ATESTADO DE ÓBITO</div><div class="iv-doc-sub">${esc(d.titulo || '')}${d.data ? ' · ' + esc(d.data) : ''}</div>`
    : `<div class="iv-doc-sub2">${esc(rot)}${d.fonte ? ' · ' + esc(d.fonte) : ''}</div><h3 class="iv-doc-tit">${esc(d.titulo || '')}</h3>${d.data ? `<div class="iv-doc-slug">${esc(d.data)}</div>` : ''}`;
  return `<div class="iv-doc t-${esc(tipo)}">${cab}${d.img ? `<img class="iv-doc-img" src="${esc(d.img)}" alt="Imagem escaneada">` : ''}<div class="iv-doc-corpo">${corpo}</div>${['nascimento', 'casamento', 'obito'].includes(tipo) ? '<div class="iv-doc-selo">CARTÓRIO<br>CROWSREST</div>' : ''}</div>`;
}
// quais revelações este aparelho ainda não viu (para animar uma vez)
function revNovas(id, d) {
  const rv = lsg('ivRev', {}), vistas = rv[id] || [], todas = reveladosDe(d), novas = todas.filter(n => !vistas.includes(n));
  if (novas.length || vistas.length !== todas.length) { rv[id] = todas; lss('ivRev', rv); }
  if (novas.length) setTimeout(somRevela, 250);
  return novas;
}
function marcarDocVisto(id) { const dv = lsg('ivDocsVistos', {}); if (!dv[id]) { dv[id] = 1; lss('ivDocsVistos', dv); } }
function abrirDoc(id, op = {}) {
  const d = op.doc || est('arquivo')[id]; if (!d) return;
  marcarDocVisto(id);
  const w = janela({ id: 'iv-doc', titulo: (TIPOS_DOC[d.tipo] || 'Documento') + ' · ' + (d.titulo || ''), largura: '640px', classe: 'iv-docjan', icone: '▦',
    html: `<div class="iv-doc-mesa" data-doc-id="${esc(id)}">${docHtml(d, { prev: op.prev, animar: op.prev ? [] : revNovas(id, d) })}</div>
      <div class="linha95">${!op.prev && d.micro ? '<button class="w95-btn" data-mf>Ver no microfilme</button>' : ''}<button class="w95-btn" data-imp>Imprimir cópia</button><button class="w95-btn pri" data-fechar>Fechar</button></div>
      ${op.prev ? '<p class="mini">Prévia do Guardião: o texto cinza sobre a tarja é o que está escondido.</p>' : ''}` });
  $('[data-imp]', w).addEventListener('click', () => CRW.imprimir(d.titulo || 'Documento', `<style>.iv-tj{display:inline-block;background:#111;color:#111;min-width:3em}.iv-tj.rev{background:none;color:inherit}</style><h2>${esc(TIPOS_DOC[d.tipo] || 'Documento')} · ${esc(d.titulo || '')}</h2><p>${esc(d.data || '')} ${esc(d.fonte || '')}</p><div>${htmlSimples(d.texto || '').replace(/\[\[(T|R):(\d+)\]\]/g, (m, t, n) => { const x = (d.tarjas || [])[+n] || {}; return x.t ? esc(x.t) : '<span class="iv-tj">' + '&#9608;'.repeat(Math.max(3, Math.min(30, num(x.len, 8)))) + '</span>'; })}</div>`, { sub: 'Cópia do Arquivo do Condado' }));
  const mf = $('[data-mf]', w); if (mf) mf.addEventListener('click', () => { ls.set('ivArqAba', 'micro'); ls.set('ivMfDoc', id); fecharJanela('iv-doc'); CRW.refazerModulo('arquivo'); CRW.abrirModulo('arquivo'); });
}
// atualiza a janela aberta quando o Mestre revela uma tarja
CRW.on('iv:estado', m => {
  if (!m.arquivo) return;
  const box = $('#janelas [data-doc-id]'); if (!box) return;
  const id = box.dataset.docId, d = est('arquivo')[id]; if (!d) return;
  if (box.querySelector('.iv-tj-pv')) return; // prévia do Mestre
  box.innerHTML = docHtml(d, { animar: revNovas(id, d) });
});
function rArquivo(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Arquivo do Condado</h2><div class="meta">Requisição CCSO-72<br>cartório · biblioteca</div></div>
    <div class="abas95"><button class="aba95" data-aba="docs">Documentos</button><button class="aba95" data-aba="micro">Microfilme</button></div><div class="panel-b" data-corpo></div></div>`;
  const corpo = $('[data-corpo]', sec);
  let aba = ls.get('ivArqAba', 'docs'), filtro = '';
  const abas = () => $$('.aba95', sec).forEach(b => b.classList.toggle('on', b.dataset.aba === aba));
  const desenhar = () => {
    abas();
    const docs = Object.entries(est('arquivo')).filter(([, d]) => d).map(([id, d]) => ({ id, ...d })).sort((a, b) => num(b.ts) - num(a.ts));
    if (aba === 'micro') return microfilme(corpo, docs.filter(d => d.micro));
    const dv = lsg('ivDocsVistos', {}), rv = lsg('ivRev', {});
    const tipos = [...new Set(docs.map(d => d.tipo || 'outro'))];
    corpo.innerHTML = `<p class="mini">Jornais antigos, certidões e atestados liberados pelo Guardião da Luz. Trechos sob <b>tarja</b> ou <b>rasura</b> se revelam quando o grupo descobre o que está escondido.</p>
      ${tipos.length > 1 ? `<div class="linha95 iv-filtros"><button class="w95-btn${!filtro ? ' on' : ''}" data-ft="">Todos</button>${tipos.map(t => `<button class="w95-btn${filtro === t ? ' on' : ''}" data-ft="${esc(t)}">${esc(TIPOS_DOC[t] || t)}</button>`).join('')}</div>` : ''}
      <div class="iv-docs">${docs.filter(d => !filtro || d.tipo === filtro).map(d => {
        const tot = (d.tarjas || []).length, rev = reveladosDe(d).length, novo = !dv[d.id], novaRev = reveladosDe(d).some(n => !(rv[d.id] || []).includes(n));
        return `<button class="iv-doc-card t-${esc(d.tipo || 'outro')}" data-doc="${esc(d.id)}"><span class="etq">${esc(TIPOS_DOC[d.tipo] || 'Documento')}</span>${novo ? '<span class="etq verm">novo</span>' : novaRev ? '<span class="etq ambar">tarja revelada</span>' : ''}
          <b>${esc(d.titulo || '')}</b><span class="mini">${esc(d.data || '')}${d.micro ? ' · microfilme' : ''}${tot ? ` · ${rev}/${tot} tarjas reveladas` : ''}</span></button>`;
      }).join('') || '<p class="vazio95">Nenhum documento liberado ainda.</p>'}</div>`;
  };
  sec.addEventListener('click', e => {
    const a = e.target.closest('[data-aba]'); if (a) { aba = a.dataset.aba; ls.set('ivArqAba', aba); desenhar(); return; }
    const f = e.target.closest('[data-ft]'); if (f) { filtro = f.dataset.ft; desenhar(); return; }
    const d = e.target.closest('[data-doc]'); if (d) { abrirDoc(d.dataset.doc); setTimeout(desenhar, 50); }
  });
  desenhar();
  vivo(sec, 'iv:estado', m => { if (m.arquivo && !(aba === 'micro' && sec._mfLupa)) desenhar(); });
}
function microfilme(corpo, docs) {
  if (!docs.length) { corpo.innerHTML = '<div class="iv-mf vazio"><p>LEITOR DE MICROFILME · nenhum rolo liberado.</p><p class="mini">Quando o Guardião liberar documentos da biblioteca em microfilme, eles aparecem aqui.</p></div>'; return; }
  const alvo = ls.get('ivMfDoc', ''); ls.del('ivMfDoc');
  const anims = {}; docs.forEach(d => { anims[d.id] = revNovas(d.id, d); marcarDocVisto(d.id); });
  corpo.innerHTML = `<div class="iv-mf"><div class="iv-mf-topo"><span>LEITOR DE MICROFILME · BIBLIOTECA E ARQUIVO HISTÓRICO</span><span data-mf-n>QUADRO 1/${docs.length}</span></div>
    <div class="iv-mf-rolo" data-rolo>${docs.map((d, i) => `<div class="iv-mf-quadro" data-q="${i}" data-id="${esc(d.id)}"><div class="iv-mf-doc">${docHtml(d, { animar: anims[d.id] })}</div></div>`).join('')}</div>
    <div class="iv-mf-ctl"><button class="w95-btn" data-mf="-1" aria-label="Quadro anterior">◀ Voltar</button><button class="w95-btn" data-lupa>Lupa</button><button class="w95-btn" data-mf="1" aria-label="Próximo quadro">Avançar ▶</button></div>
    <p class="mini iv-mf-dica">Arraste o rolo para os lados ou use os botões. Com a <b>Lupa</b> ligada, passe o dedo ou o mouse sobre o quadro para ampliar.</p></div>`;
  const rolo = $('[data-rolo]', corpo), nEl = $('[data-mf-n]', corpo), sec = corpo.closest('.mod');
  const atual = () => Math.round(rolo.scrollLeft / Math.max(1, rolo.clientWidth));
  rolo.addEventListener('scroll', () => { nEl.textContent = `QUADRO ${atual() + 1}/${docs.length}`; }, { passive: true });
  const i0 = docs.findIndex(d => d.id === alvo); if (i0 > 0) setTimeout(() => { rolo.scrollLeft = i0 * rolo.clientWidth; }, 30);
  let lupa = false;
  corpo.addEventListener('click', e => {
    const b = e.target.closest('[data-mf]');
    if (b) { Som.tom(90, 0, 0.12, 'sawtooth', 0.03); Som.ruido(0, 0.25, 0.02, 700); rolo.scrollTo({ left: (atual() + num(b.dataset.mf)) * rolo.clientWidth, behavior: 'smooth' }); }
    if (e.target.closest('[data-lupa]')) {
      lupa = !lupa; if (sec) sec._mfLupa = lupa; e.target.closest('[data-lupa]').classList.toggle('on', lupa); rolo.classList.toggle('lupa', lupa);
      if (!lupa) $$('.iv-lente', rolo).forEach(x => x.remove());
    }
  });
  const mover = e => {
    if (!lupa) return;
    const q = e.target.closest('.iv-mf-quadro'); if (!q) return;
    const doc = $('.iv-mf-doc', q); if (!doc) return;
    e.preventDefault();
    let lente = $('.iv-lente', q);
    if (!lente) { $$('.iv-lente', rolo).forEach(x => x.remove()); lente = el('div', 'iv-lente'); const cl = doc.cloneNode(true); cl.classList.add('iv-lente-c'); lente.appendChild(cl); q.appendChild(lente); }
    const r = q.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, Z = 2.3, R = lente.offsetWidth / 2;
    const dx = x + q.scrollLeft - doc.offsetLeft, dy = y + q.scrollTop - doc.offsetTop;
    lente.style.left = (x + q.scrollLeft - R) + 'px'; lente.style.top = (y + q.scrollTop - R) + 'px';
    const cl = lente.firstChild; cl.style.width = doc.offsetWidth + 'px';
    cl.style.transform = `translate(${R - dx * Z}px, ${R - dy * Z}px) scale(${Z})`;
  };
  rolo.addEventListener('pointerdown', mover); rolo.addEventListener('pointermove', mover);
}

/* ---------- Mestre: documentos e tarjas ---------- */
function docsTodos() {
  const seg = Segredos.ler(['arquivo']) || {}, pub = est('arquivo');
  const ids = new Set([...Object.keys(seg), ...Object.keys(pub)]);
  return [...ids].map(id => ({ id, s: seg[id] || null, e: pub[id] || null })).filter(x => x.s || x.e)
    .sort((a, b) => ((b.e ? 1 : 0) - (a.e ? 1 : 0)) || String((a.s || a.e).titulo || '').localeCompare(String((b.s || b.e).titulo || '')));
}
function publicarDoc(id) {
  const s = Segredos.ler(['arquivo', id]); if (!s) return;
  const { texto, marcas } = compilar(s.texto), e = est('arquivo')[id], rev = (e && e.revelado) || {};
  const tarjas = marcas.map((m, n) => ({ tipo: m.tipo, len: Math.max(3, Math.min(60, m.t.length)), ...(rev[n] ? { t: m.t } : {}) }));
  const revelado = {}; marcas.forEach((m, n) => { if (rev[n]) revelado[n] = true; });
  Estado.definir(['arquivo', id], { tipo: s.tipo || 'outro', titulo: s.titulo || '', data: s.data || '', fonte: s.fonte || '', texto, tarjas, revelado, micro: !!s.micro, img: s.img || null, ts: (e && e.ts) || Date.now() });
  Segredos.gravar(['arquivo', id, 'publicado'], true);
  CRW.diario('arquivo', (e ? 'Documento atualizado: ' : 'Documento publicado: ') + (s.titulo || id));
}
function revelarTarja(id, n, sim) {
  const s = Segredos.ler(['arquivo', id]), e = est('arquivo')[id]; if (!s || !e) return;
  const m = compilar(s.texto).marcas[n]; if (!m) return;
  const tj = (e.tarjas || [])[n] || { tipo: m.tipo, len: m.t.length };
  Estado.definir(['arquivo', id, 'tarjas', String(n)], sim ? { ...tj, tipo: m.tipo, t: m.t } : { tipo: m.tipo, len: tj.len || m.t.length });
  Estado.definir(['arquivo', id, 'revelado', String(n)], sim ? true : null);
  if (sim) CRW.diario('arquivo', `Tarja revelada em ${s.titulo || id}: ${m.t.slice(0, 60)}`);
}
function mArquivo(c) {
  c.innerHTML = `<p class="mini">Escreva o documento com <code>[[tarja:texto escondido]]</code> (barra preta) e <code>[[rasura:texto]]</code> (rasura de caneta). Ao publicar, os jogadores veem só as barras; o texto escondido continua nos seus segredos até você revelar, tarja a tarja.</p>
    <div class="linha95"><button class="w95-btn pri" data-novo>+ Novo documento</button></div><div data-lista></div>`;
  const desenhar = () => {
    $('[data-lista]', c).innerHTML = docsTodos().map(({ id, s, e }) => {
      const d = s || e, tot = s ? compilar(s.texto).marcas.length : (e.tarjas || []).length, rev = e ? reveladosDe(e).length : 0;
      return `<div class="iv-mq${e ? ' lib' : ''}"><div class="iv-mq-t"><span class="etq">${esc(TIPOS_DOC[d.tipo] || 'Documento')}</span> ${e ? '<span class="etq verde">publicado</span>' : '<span class="etq ambar">rascunho</span>'}${d.micro ? ' <span class="etq azul">microfilme</span>' : ''}
        <br><b>${esc(d.titulo || '(sem título)')}</b> <span class="mini">${esc(d.data || '')}${tot ? ` · tarjas ${rev}/${tot}` : ''}</span>${s && s.nota ? `<br><span class="mini">Nota: ${esc(s.nota)}</span>` : ''}</div>
        <div class="linha95">${s ? `<button class="w95-btn" data-ed="${esc(id)}">Editar</button><button class="w95-btn pri" data-pub="${esc(id)}">${e ? 'Atualizar' : 'Publicar'}</button>` : ''}
          ${e && s && tot ? `<button class="w95-btn" data-tj="${esc(id)}">Tarjas…</button>` : ''}${s ? `<button class="w95-btn" data-pv="${esc(id)}">Prévia</button>` : ''}
          ${e ? `<button class="w95-btn" data-desp="${esc(id)}">Despublicar</button>` : ''}<button class="w95-btn perigo" data-del="${esc(id)}">×</button></div></div>`;
    }).join('') || '<p class="vazio95">Nenhum documento. Importe as sementes (aba Segredos) ou crie um.</p>';
  };
  c.addEventListener('click', async e => {
    const b = e.target.closest('button'); if (!b) return; const d = b.dataset;
    if ('novo' in d) editarDoc(null);
    else if (d.ed) editarDoc(d.ed);
    else if (d.pub) { publicarDoc(d.pub); aviso('Documento publicado no Arquivo do Condado.'); }
    else if (d.tj) janelaTarjas(d.tj);
    else if (d.pv) { const s = Segredos.ler(['arquivo', d.pv]) || {}, cp = compilar(s.texto), e2 = est('arquivo')[d.pv] || {}; abrirDoc(d.pv, { doc: { ...s, texto: cp.texto, tarjas: cp.marcas.map((m, n) => ({ tipo: m.tipo, len: m.t.length, ...((e2.revelado || {})[n] ? { t: m.t } : {}) })) }, prev: cp.marcas.map(m => m.t) }); }
    else if (d.desp) { if (await confirmar('Tirar este documento do Arquivo dos jogadores? (o rascunho fica)')) { Estado.definir(['arquivo', d.desp], null); Segredos.gravar(['arquivo', d.desp, 'publicado'], false); } }
    else if (d.del) { if (await confirmar('Apagar o documento (rascunho e publicação)?')) { Estado.definir(['arquivo', d.del], null); Segredos.gravar(['arquivo', d.del], null); } }
  });
  desenhar(); vivo(c, 'iv:seg', desenhar); vivo(c, 'iv:estado', m => { if (m.arquivo) desenhar(); });
}
function editarDoc(id) {
  const s = id ? (Segredos.ler(['arquivo', id]) || {}) : { tipo: 'jornal', micro: false };
  let img = s.img || '';
  const w = janela({ titulo: id ? 'Editar documento' : 'Novo documento', largura: '600px', html: `
    <div class="grade2"><label class="campo">Tipo<select class="w95-input" data-tipo>${Object.entries(TIPOS_DOC).map(([k, n]) => `<option value="${k}"${k === s.tipo ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="campo">Data (como aparece)<input class="w95-input" data-data value="${esc(s.data || '')}" placeholder="Ex.: 14/03/1923"></label></div>
    <label class="campo">Título<input class="w95-input" data-tit value="${esc(s.titulo || '')}"></label>
    <label class="campo">Fonte (jornal, livro, folha)<input class="w95-input" data-fonte value="${esc(s.fonte || '')}" placeholder="Ex.: Livro C de óbitos, fl. 41"></label>
    <label class="campo">Texto · [[tarja:...]] [[rasura:...]] · aceita &lt;b&gt; &lt;i&gt; &lt;u&gt; &lt;p&gt; &lt;h3&gt; &lt;hr&gt; &lt;small&gt;<textarea class="w95-input iv-mono" rows="10" data-tx>${esc(s.texto || '')}</textarea></label>
    <label class="campo">Nota só para você<input class="w95-input" data-nota value="${esc(s.nota || '')}"></label>
    <label class="chk95"><input type="checkbox" data-micro${s.micro ? ' checked' : ''}> Está no microfilme da biblioteca</label>
    <div class="linha95"><label class="campo iv-flex">Imagem escaneada (opcional)<input type="file" accept="image/*" data-img></label>${img ? '<button class="w95-btn" data-semimg>Tirar imagem</button>' : ''}</div>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar rascunho</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-img]', w).addEventListener('change', async e => { try { img = await CRW.lerImagem(e.target.files[0], 1000, 0.72); aviso('Imagem carregada.'); } catch (er) { aviso('Imagem inválida.', 'erro'); } });
  const si = $('[data-semimg]', w); if (si) si.addEventListener('click', () => { img = ''; si.remove(); aviso('A imagem sai ao salvar.'); });
  $('[data-ok]', w).addEventListener('click', () => {
    const g = q => $(q, w).value.trim();
    const nid = id || ('d' + Date.now().toString(36));
    Segredos.gravar(['arquivo', nid], { ...s, tipo: g('[data-tipo]'), data: g('[data-data]'), titulo: g('[data-tit]'), fonte: g('[data-fonte]'), texto: $('[data-tx]', w).value, nota: g('[data-nota]'), micro: $('[data-micro]', w).checked, img: img || null });
    fecharJanela(w.parentElement.dataset.jan);
    if (est('arquivo')[nid]) aviso('Rascunho salvo. Toque em "Atualizar" para os jogadores verem a mudança.');
  });
}
function janelaTarjas(id) {
  const desenhar = w => {
    const s = Segredos.ler(['arquivo', id]) || {}, e = est('arquivo')[id] || {}, ms = compilar(s.texto).marcas, rev = e.revelado || {};
    $('.jan-corpo', w).innerHTML = `<p class="mini">${esc(s.titulo || '')}</p>${ms.map((m, n) => `<div class="iv-mq${rev[n] ? ' lib' : ''}"><div class="iv-mq-t"><span class="etq">${m.tipo === 'r' ? 'rasura' : 'tarja'} ${n + 1}</span> ${esc(m.t)}</div>
      ${rev[n] ? `<button class="w95-btn" data-n="${n}" data-s="0">Cobrir de novo</button>` : `<button class="w95-btn pri" data-n="${n}" data-s="1">Revelar</button>`}</div>`).join('')}
      <div class="msg-bts"><button class="w95-btn" data-todas>Revelar todas</button><button class="w95-btn" data-fechar>Fechar</button></div>`;
  };
  const w = janela({ id: 'iv-tarjas', titulo: 'Tarjas e rasuras', largura: '480px', html: '' });
  desenhar(w);
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-n]');
    if (b) { revelarTarja(id, +b.dataset.n, b.dataset.s === '1'); setTimeout(() => desenhar(w), 30); }
    if (e.target.closest('[data-todas]')) { const s = Segredos.ler(['arquivo', id]) || {}; compilar(s.texto).marcas.forEach((m, n) => revelarTarja(id, n, true)); setTimeout(() => desenhar(w), 30); }
  });
}

/* =========================================================
   REGISTROS NO SITE
   ========================================================= */
const todos = v => !!(v.mestre || v.aux || v.pc);
CRW.registrarModulo({ id: 'interrog', titulo: 'Sala de Interrogatório', grupo: 'investigacao', icone: '◙', ordem: 20, visivel: todos, render: rInterrog, aoAbrir: () => badges() });
CRW.registrarModulo({ id: 'lab', titulo: 'Laboratório', grupo: 'investigacao', icone: '⚗︎', ordem: 21, visivel: todos, render: rLab, aoAbrir: labAoAbrir });
CRW.registrarModulo({ id: 'coleta', titulo: 'Evidências e Custódia', grupo: 'investigacao', icone: '⚑', ordem: 22, visivel: todos, render: rColeta });
CRW.registrarModulo({ id: 'bases', titulo: 'Consulta às Bases', grupo: 'investigacao', icone: '▤', ordem: 23, visivel: todos, render: rBases, aoAbrir: sec => { const i = $('[data-in]', sec); if (i && !matchMedia('(pointer:coarse)').matches) setTimeout(() => i.focus({ preventScroll: true }), 50); } });
CRW.registrarModulo({ id: 'arquivo', titulo: 'Arquivo do Condado', grupo: 'investigacao', icone: '▦', ordem: 24, visivel: todos, render: rArquivo, aoAbrir: () => badges() });

CRW.registrarMestre({ id: 'iv-interrog', aba: 'mesa', titulo: 'Interrogatório ao vivo', ordem: 20, render: mInterrog });
CRW.registrarMestre({ id: 'iv-lab', aba: 'mesa', titulo: 'Laboratório · pedidos, prazos e resultados', ordem: 21, render: mLab });
CRW.registrarMestre({ id: 'iv-coleta', aba: 'mesa', titulo: 'Coletas escondidas nos locais', ordem: 22, render: mColeta });
CRW.registrarMestre({ id: 'iv-bases', aba: 'registro', titulo: 'Consulta às Bases · registros e autorizações', ordem: 20, render: mBases });
CRW.registrarMestre({ id: 'iv-arquivo', aba: 'registro', titulo: 'Arquivo do Condado · documentos e tarjas', ordem: 21, render: mArquivo });

/* ---------- Como Usar ---------- */
const J = '<span class="papel">JOGADOR</span>', M = '<span class="papel">GUARDIÃO</span>', A = '<span class="papel">AUXILIAR</span>';
CRW.registrarAjuda({ id: 'iv-interrog', titulo: 'Sala de Interrogatório (fita cassete e contradições)', ordem: 40, para: ['todos'], html: `
  <p>Quando o grupo interroga um NPC, a sala mostra a <b>ficha pública</b> dele (retrato, quem é) e a <b>fita</b> com as perguntas e respostas que o Guardião libera, uma a uma, durante a cena.</p>
  <ul><li>${J} Escolha o interrogatório no topo. <b>▶ TOCAR</b> reproduz a transcrição linha a linha, com chiado de fita e o contador girando; <b>■ PARAR</b> pausa; <b>◀◀ REBOBINAR</b> volta ao começo. Marque <b>Voz sintética</b> para o aparelho ler em voz alta (português, se o celular tiver a voz; desligada por padrão).</li>
  <li>${J} <b>Sugerir pergunta</b>: escreva e envie; a sugestão vai só para o Guardião, que pode responder na hora.</li>
  <li>${J} <b>Contradições</b>: toque em ⚑ numa fala, depois em ⚑ em outra (pode ser de outro interrogatório) e escreva por que não batem. Ou registre só uma fala. O quadro de contradições é visto por todos.</li>
  <li>${M} Painel, aba <b>Mesa</b>, "Interrogatório ao vivo": crie o interrogatório escolhendo o NPC, prepare o <b>roteiro</b> (pergunta e resposta, só você vê) e toque em <b>Liberar</b> em cada fala no momento certo. "Pôr e liberar agora" improvisa. As sugestões do grupo aparecem ali com "Responder e liberar". "Abrir na sala" mostra a ficha antes da primeira pergunta; "Encerrar" apaga a luz vermelha de gravação.</li>
  <li>${A} Vê e toca as fitas, marca contradições e sugere perguntas como um jogador.</li></ul>
  <p class="mini">Dados: roteiro em segredos/interrog; falas liberadas em estado/interrog; contradições em caso/contradicoes.</p>` });
CRW.registrarAjuda({ id: 'iv-lab', titulo: 'Laboratório com prazo (resultado por fax)', ordem: 41, para: ['todos'], html: `
  <p>O grupo manda uma evidência para o Laboratório Estadual (DNA, digitais, balística, toxicologia ou outro). O resultado só chega depois de algumas <b>horas do relógio do jogo</b>, como um <b>fax</b> que toca e imprime na tela de todos.</p>
  <ul><li>${J} Módulo <b>Laboratório</b>: escolha a evidência (E-01 a E-07 do caso e as que o grupo coletou), o exame e o que querem saber, e envie. O pedido aparece como "aguardando protocolo" até o Guardião aceitar; depois a fila mostra a contagem regressiva em horas de jogo. Quando o fax chega, ele abre sozinho; "Ver o fax" mostra de novo e "Imprimir cópia" usa a impressora matricial.</li>
  <li>${M} Aba <b>Mesa</b>, "Laboratório": cada pedido chega com um alerta. "Aceitar e definir prazo" pede as horas de jogo e o texto do resultado (fica só com você). Quando o relógio do jogo passa da hora, <b>o seu aparelho publica o resultado</b> e todos recebem o fax: deixe o site aberto na mesa. "Liberar agora" pula o prazo; "Prazo…" muda a hora. Os <b>modelos</b> guardam resultados prontos (as sementes trazem o resultado de DNA REF 24-1187-DNA do item E-04).</li></ul>
  <p class="mini">Dados: pedidos/lab (pedidos), estado/lab (fila pública, sem o texto), segredos/lab (resultados até a hora). Com o relógio do jogo parado, a contagem também para.</p>` });
CRW.registrarAjuda({ id: 'iv-coleta', titulo: 'Coleta no local e Cadeia de Custódia', ordem: 42, para: ['todos'], html: `
  <p>Evidências encontradas nos locais entram no livro do grupo com número (E-08, E-09...) e uma <b>cadeia de custódia</b>: quem coletou, com quem ficou, quando foi ao laboratório.</p>
  <ul><li>${J} Quando o Guardião entrega uma coleta a você, abre a tela <b>EVIDÊNCIA COLETADA</b> com a etiqueta do item. No módulo <b>Evidências e Custódia</b>, abra o item e use <b>Registrar movimentação</b> (transferido, enviado ao laboratório, devolvido, lacrado). Cada movimentação deve sair de quem estava com o item: se não sair, ou se a data voltar no tempo, a linha fica <b>vermelha</b> como <b>quebra de custódia</b>. Também dá para marcar a quebra à mão (lacre rompido, sumiço). "Pedir análise" leva o item ao Laboratório.</li>
  <li>${M} Aba <b>Mesa</b>, "Coletas escondidas": escolha o local, nome, descrição e foto e toque em "Esconder no local". Quando o grupo achar, "Entregar coleta" e escolha quem encontrou. O Cartão do Local (mapa) mostra as coletas daquele lugar e, para você, as que ainda estão escondidas. Você pode apagar movimentações erradas.</li></ul>
  <p class="mini">Os itens E-01 a E-07 já vêm com a custódia inicial: Eq. Perícia 2, 21/05/1997 06:31. Dados: segredos/coleta (escondidas), caso/coleta (livro do grupo).</p>` });
CRW.registrarAjuda({ id: 'iv-bases', titulo: 'Consulta às Bases (terminal)', ordem: 43, para: ['todos'], html: `
  <p>O terminal da delegacia consulta as bases estaduais e do condado com comandos de verdade. Ele já abre com a consulta do Chevette feita no começo do caso.</p>
  <ul><li>${J} Comandos: <b>AJUDA</b>, <b>PLACA</b> &lt;placa&gt;, <b>CHASSI</b> &lt;número ou parte&gt;, <b>NOME</b> &lt;nome&gt;, <b>ENDERECO</b> &lt;rua, número ou nome do lugar&gt; (devolve também o registro público do imóvel), <b>BO</b> &lt;número&gt;, <b>HISTORICO</b> (consultas do grupo) e <b>LIMPAR</b>. No celular, toque num atalho, complete e toque em EXECUTAR. Sem registro, a resposta é "NENHUM REGISTRO ENCONTRADO".</li>
  <li>${J} Registro <b>SELADO</b>: aparece só o título e "AUTORIZAÇÃO NECESSÁRIA". Toque em [ PEDIR AUTORIZAÇÃO ] e diga o motivo; quando o Guardião liberar, o terminal avisa e a consulta passa a mostrar tudo.</li>
  <li>${M} Aba <b>Registro</b>, "Consulta às Bases": crie e edite registros (base, chave, linhas, termos de busca), marque SELADO para guardar o conteúdo só com você, libere ou sele de novo, e veja os pedidos de autorização e o histórico de consultas do grupo. No terminal, você enxerga o conteúdo selado.</li></ul>
  <p class="mini">Dados: estado/bases (público), segredos/bases (selados), caso/consultas (histórico). O Chevette, o BO 24-1187-A e a ficha pública do Furão já vêm do caso.</p>` });
CRW.registrarAjuda({ id: 'iv-arquivo', titulo: 'Arquivo do Condado e Microfilme', ordem: 44, para: ['todos'], html: `
  <p>Jornais antigos, certidões de nascimento, casamento e óbito, atestados de óbito e registros antigos. Trechos cobertos por <b>tarja</b> preta ou <b>rasura</b> se revelam quando o Guardião decide, com animação na tela de todos.</p>
  <ul><li>${J} Aba <b>Documentos</b>: toque num documento para ler; "novo" e "tarja revelada" marcam o que mudou. Aba <b>Microfilme</b>: o leitor da biblioteca, em negativo; arraste o rolo para os lados ou use Voltar e Avançar. Ligue a <b>Lupa</b> e passe o dedo ou o mouse sobre o quadro para ampliar.</li>
  <li>${M} Aba <b>Registro</b>, "Arquivo do Condado": escreva o documento com <b>[[tarja:texto]]</b> e <b>[[rasura:texto]]</b>, marque se está no microfilme e anexe a imagem escaneada, se quiser. "Publicar" manda só as barras para os jogadores; "Tarjas…" revela uma a uma (ou cobre de novo). "Prévia" mostra o que está por baixo. As sementes trazem documentos não publicados (atestados assinados pelo Dr. Crane, registros de fundação que se contradizem): <b>preencha os nomes sob tarja antes de revelar</b>.</li></ul>
  <p class="mini">Dados: segredos/arquivo (rascunhos com o texto escondido), estado/arquivo (publicado, só com o tamanho das tarjas até a revelação).</p>` });

/* ---------- Restaurar o site ---------- */
CRW.registrarRestauracao({ id: 'iv-vivo', nome: 'Investigação: interrogatórios na sala, fila do laboratório, coletas e custódia, contradições e consultas; recobre as tarjas e sela de novo o que foi liberado nas bases', padrao: true, estado: ['interrog', 'lab'],
  async fazer() {
    for (const k of ['caso/contradicoes', 'caso/coleta', 'caso/consultas']) await Rede.set(k, null).catch(() => {});
    const si = Segredos.ler(['interrog']) || {};
    for (const [id, x] of Object.entries(si)) for (const k of Object.keys((x && x.perguntas) || {})) await Segredos.gravar(['interrog', id, 'perguntas', k, 'liberada'], false);
    for (const [id, x] of Object.entries(Segredos.ler(['coleta']) || {})) if (x && x.entregue) await Segredos.gravar(['coleta', id, 'entregue'], null);
    for (const id of Object.keys(Segredos.ler(['lab']) || {})) if (id !== '_modelos') await Segredos.gravar(['lab', id], null);
    for (const [id, d] of Object.entries(est('arquivo'))) if (d) { await Estado.definir(['arquivo', id, 'revelado'], null); await Estado.definir(['arquivo', id, 'tarjas'], (Array.isArray(d.tarjas) ? d.tarjas : Object.values(d.tarjas || {})).map(t => ({ tipo: (t || {}).tipo || 't', len: (t || {}).len || 8 }))); }
    const sb = Segredos.ler(['bases']) || {};
    for (const [b, rs] of Object.entries(sb)) for (const [k, r] of Object.entries(rs || {})) { const pub = ((est('bases')[b] || {})[k]) || ((basesPadrao()[b] || {})[k]); if (r && pub && !pub.selado) await Estado.definir(['bases', b, k], { titulo: r.titulo || pub.titulo || k, alias: pub.alias || null, selado: true }); }
    limparVistos();
  } });
CRW.registrarRestauracao({ id: 'iv-pub', nome: 'Arquivo do Condado e bases: despublicar todos os documentos e apagar os registros públicos criados (rascunhos e sementes ficam)', padrao: false, estado: ['arquivo', 'bases'],
  async fazer() { for (const [id, x] of Object.entries(Segredos.ler(['arquivo']) || {})) if (x && x.publicado) await Segredos.gravar(['arquivo', id, 'publicado'], false); } });
// cada aparelho esquece o que já tinha visto quando o Mestre restaura
CRW.on('restaurado', r => { if (r && (r.itens || []).includes('iv-vivo')) limparVistos(); });

/* ---------- API pública ---------- */
CRW.Investigacao = {
  entregarColeta, abrirFax, abrirDoc, publicarLab, liberarRegistro, revelarTarja, publicarDoc, liberarPergunta,
  coletas: itensColeta, cadeiaDe, contradicoes: () => ({ ...(C.contr || {}) }), proximoCodigo,
};
})();
