/* =========================================================
   CROWSREST · chat.js  (item 43)
   Canais: Geral (todos), Rádio da polícia (Mestre e auxiliares
   transmitem; todos ouvem), Sussurro ao Mestre (conversa privada de
   cada investigador com o Guardião da Luz) e Auxiliares (Mestre e
   auxiliares). Cada mensagem leva a data e a hora do jogo.
   Caminhos: chat/geral/<id>, chat/radio/<id>, chat/aux/<id>,
   chat/sus/<chave da ficha>/<id>.
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, pad2, ls, Rede, aviso, confirmar } = CRW;

const NOMES = { geral: 'Geral', radio: 'Rádio', sus: 'Sussurro ao Mestre', aux: 'Auxiliares' };
const UNIDADES = ['Central', 'V-01', 'V-03', 'Patrulha Rural 3', 'Unidade 114', 'Gabinete', 'Perícia 2', 'Bombeiros'];
const D = { geral: {}, radio: {}, aux: {}, sus: {} };   // sus: { <chave>: { <id>: msg } }
let offs = [], carregado = {}, ultimoTs = {};
const P = () => CRW.P;
const ehMestre = () => P().mestre && !P().espiar;
const quem = () => P().mestre ? 'mestre' : P().aux ? 'aux:' + (P().nomeAux || '') : (P().pc || '');
const minhaChaveSus = () => P().pc ? CRW.minhaChave() : null;

/* ---------- quais canais cada papel usa ---------- */
function canais() {
  const p = P();
  if (p.mestre && p.espiar) return ['geral', 'radio', 'sus'];
  if (p.mestre) return ['geral', 'radio', 'sus', 'aux'];
  if (p.aux) return ['geral', 'radio', 'aux'];
  if (p.pc) return ['geral', 'radio', 'sus'];
  return [];
}
const podeEscrever = c => {
  const p = P(); if (p.espiar) return false;
  if (c === 'radio') return p.mestre || p.aux;
  if (c === 'aux') return p.mestre || p.aux;
  if (c === 'sus') return p.mestre || !!p.pc;
  return !!(p.mestre || p.aux || p.pc);
};
const podeApagar = c => { const p = P(); if (p.espiar) return false; return p.mestre || (p.aux && (c === 'radio' || c === 'aux')); };

/* ---------- assinaturas (uma vez por perfil) ---------- */
function ligar() {
  offs.forEach(f => { try { f(); } catch (e) {} }); offs = [];
  D.geral = {}; D.radio = {}; D.aux = {}; D.sus = {}; carregado = {}; ultimoTs = {};
  const cs = canais(); if (!cs.length || CRW.TV) { badges(); return; }
  if (!ls.get(kDesde(), 0)) ls.set(kDesde(), Date.now());
  const sub = (c, cam, tr) => offs.push(Rede.on(cam, x => { D[c] = tr ? tr(x) : (x || {}); chegou(c); }, () => { D[c] = {}; chegou(c); }));
  sub('geral', 'chat/geral'); sub('radio', 'chat/radio');
  if (cs.includes('aux')) sub('aux', 'chat/aux');
  if (P().mestre) sub('sus', 'chat/sus');
  else if (P().pc) { const k = minhaChaveSus(); sub('sus', 'chat/sus/' + k, x => ({ [k]: x || {} })); }
}
CRW.on('perfil', () => setTimeout(ligar, 0));
CRW.on('fichas', () => { if (ehMestre()) { badges(); CRW.emit('chat', 'sus'); } });

/* ---------- lidas e não lidas (guardado no aparelho) ---------- */
const kDesde = () => 'chatDesde:' + quem();
const kLido = (c, k) => 'chatLido:' + quem() + ':' + c + (k ? ':' + k : '');
const lido = (c, k) => ls.get(kLido(c, k), ls.get(kDesde(), Date.now()));
const msgs = o => Object.entries(o || {}).filter(([, m]) => m && typeof m === 'object').map(([id, m]) => ({ id, ...m })).sort((a, b) => num(a.ts) - num(b.ts));
const minha = (c, m) => c === 'sus' ? (P().mestre ? m.de === 'mestre' : m.de !== 'mestre') : m.pc === quem();
function naoLidas(c, k) {
  if (c === 'sus' && ehMestre() && !k) return Object.keys(D.sus).reduce((s, ch) => s + naoLidas('sus', ch), 0);
  if (c === 'sus') { const ch = k || minhaChaveSus(); if (!ch) return 0; const l = lido('sus', ehMestre() ? ch : ''); return msgs(D.sus[ch]).filter(m => num(m.ts) > l && !minha(c, m)).length; }
  const l = lido(c); return msgs(D[c]).filter(m => num(m.ts) > l && !minha(c, m)).length;
}
function marcarLido(c, k) {
  const lista = c === 'sus' ? msgs(D.sus[k]) : msgs(D[c]);
  const t = lista.length ? num(lista[lista.length - 1].ts) : Date.now();
  if (t > lido(c, c === 'sus' && ehMestre() ? k : '')) ls.set(kLido(c, c === 'sus' && ehMestre() ? k : ''), t);
}
function badges() {
  if (P().espiar) return CRW.badge('chat', 0);
  CRW.badge('chat', canais().reduce((s, c) => s + naoLidas(c), 0));
}

/* ---------- chegada de mensagens: som e aviso ---------- */
let atual = ls.get('chatCanal', 'geral'), susAtual = null;
function chegou(c) {
  const lista = c === 'sus' ? Object.entries(D.sus).flatMap(([k, o]) => msgs(o).map(m => ({ ...m, _k: k }))) : msgs(D[c]);
  const maior = lista.reduce((s, m) => Math.max(s, num(m.ts)), 0);
  if (carregado[c] && maior > num(ultimoTs[c])) {
    const novas = lista.filter(m => num(m.ts) > num(ultimoTs[c]) && !minha(c, m));
    if (novas.length) avisar(c, novas[novas.length - 1]);
  }
  carregado[c] = true; ultimoTs[c] = Math.max(num(ultimoTs[c]), maior);
  CRW.emit('chat', c); badges();
}
function avisar(c, m) {
  const aberto = CRW.moduloAtual() === 'chat' && atual === c && !document.hidden;
  if (c === 'radio') { CRW.Som.radio(); if (!aberto && !P().mestre && !P().aux) aviso('Rádio · ' + (m.n || 'Central') + ': ' + String(m.t || '').slice(0, 70)); return; }
  if (c === 'sus') {
    if (P().mestre) { CRW.alertaMestre('Sussurro de ' + (m.n || '?') + ': ' + String(m.t || '').slice(0, 80), 'sus-' + (m._k || '')); return; }
    CRW.Som.tom(660, 0, 0.12, 'sine', 0.05); CRW.Som.tom(990, 0.13, 0.18, 'sine', 0.05);
    if (!aberto) aviso('Sussurro do Guardião da Luz: ' + String(m.t || '').slice(0, 70));
    return;
  }
  CRW.Som.tom(aberto ? 1400 : 1046, 0, 0.07, 'sine', aberto ? 0.025 : 0.04);
}

/* ---------- conversas de sussurro (Mestre) ---------- */
function conversas() {
  const fs = CRW.fichas().filter(f => f.pc);
  const ks = new Set([...fs.map(f => f.chave), ...Object.keys(D.sus)]);
  const porPc = {};
  const l = [...ks].map(k => {
    const f = fs.find(x => x.chave === k) || {}, ms = msgs(D.sus[k]);
    const pc = f.pc || (ms.find(m => m.pc) || {}).pc || '';
    const nome = (CRW.pc(pc) || {}).nome || f.nome || (ms.find(m => m.de !== 'mestre') || {}).n || 'Investigador';
    return { k, pc, nome, ult: ms.length ? num(ms[ms.length - 1].ts) : 0, n: ms.length, ts: num(f.ts) };
  }).filter(x => x.pc || x.n);
  l.sort((a, b) => b.ult - a.ult || a.nome.localeCompare(b.nome));
  l.forEach(x => { porPc[x.pc] = (porPc[x.pc] || 0) + 1; x.ap = porPc[x.pc]; });
  l.forEach(x => { if ((l.filter(y => y.pc === x.pc).length) > 1) x.nome += ' (aparelho ' + x.ap + ')'; });
  return l;
}

/* =========================================================
   O MÓDULO
   ========================================================= */
function render(sec) {
  const cs = canais();
  if (!cs.includes(atual)) atual = cs[0] || 'geral';
  sec.innerHTML = `<div class="cm-wrap win">
    <div class="titlebar"><span class="tb-title"><span class="tb-ico">✉</span> Comunicação · SIIC</span><span class="cm-hora mini" data-relogio></span></div>
    <div class="abas95 cm-abas" role="tablist">${cs.map(c => `<button class="aba95${c === atual ? ' on' : ''}" data-c="${c}">${esc(c === 'sus' && ehMestre() ? 'Sussurros' : NOMES[c])}<span class="nav-badge" data-cb="${c}" hidden></span></button>`).join('')}</div>
    <div class="cm-topo"></div>
    <div class="cm-msgs" role="log" aria-live="polite"></div>
    <button class="cm-novas w95-btn" hidden>▼ mensagens novas</button>
    <div class="cm-barra"></div></div>`;
  const lista = $('.cm-msgs', sec), topo = $('.cm-topo', sec), barra = $('.cm-barra', sec), novas = $('.cm-novas', sec);
  const pertoDoFim = () => lista.scrollHeight - lista.scrollTop - lista.clientHeight < 90;
  const rolarFim = () => { lista.scrollTop = lista.scrollHeight; novas.hidden = true; };
  const chaveSus = () => {
    if (P().pc && !P().espiar) return minhaChaveSus();
    if (P().espiar) return CRW.chaveDoPC(P().espiar);
    const cv = conversas();
    if (!susAtual || !cv.some(x => x.k === susAtual)) susAtual = (cv[0] || {}).k || null;
    return susAtual;
  };
  const pintarTopo = () => {
    if (atual === 'sus' && ehMestre()) {
      const cv = conversas(), k = chaveSus();
      topo.innerHTML = cv.length ? `<label class="cm-conv">Conversa com <select class="w95-input" data-conv>${cv.map(x => { const n = naoLidas('sus', x.k); return `<option value="${esc(x.k)}"${x.k === k ? ' selected' : ''}>${esc(x.nome)}${n ? ' (' + n + ' nova' + (n > 1 ? 's' : '') + ')' : ''}</option>`; }).join('')}</select></label>`
        : '<p class="mini">Nenhum investigador abriu o site ainda: as conversas aparecem quando cada um entra pela primeira vez.</p>';
    } else if (atual === 'sus') topo.innerHTML = `<p class="cm-nota">Conversa privada: só você e o Guardião da Luz leem.${P().espiar ? ' (vendo pelos olhos do investigador: só leitura)' : ''}</p>`;
    else if (atual === 'radio') topo.innerHTML = `<p class="cm-nota cm-radio-n">▲ Frequência do Departamento · 155.475 MHz${podeEscrever('radio') ? ' · você transmite' : ' · só escuta'}</p>`;
    else if (atual === 'aux') topo.innerHTML = '<p class="cm-nota">Canal da mesa: só o Guardião da Luz e os auxiliares leem.</p>';
    else topo.innerHTML = '';
  };
  const pintarBarra = () => {
    if (!podeEscrever(atual) || (atual === 'sus' && ehMestre() && !chaveSus())) {
      barra.innerHTML = `<p class="cm-so">${P().espiar ? 'Vendo pelos olhos de um investigador: o chat fica só de leitura.' : atual === 'radio' ? 'Canal só de escuta. Para falar com o grupo, use o Geral; para falar só com o Mestre, use o Sussurro.' : 'Sem conversa selecionada.'}</p>`;
      return;
    }
    const como = atual === 'radio' ? `<select class="w95-input cm-como" data-como aria-label="Unidade">${UNIDADES.map(u => `<option${u === ls.get('chatUnidade', 'Central') ? ' selected' : ''}>${esc(u)}</option>`).join('')}</select>`
      : atual === 'geral' && (P().mestre || P().aux) ? `<select class="w95-input cm-como" data-como aria-label="Falar como"><option value="">${esc(P().mestre ? 'Guardião da Luz' : (P().nomeAux || 'Auxiliar'))}</option>${CRW.npcs().filter(n => n.tipo !== 'viatura').map(n => `<option value="${esc(n.id)}"${ls.get('chatComo', '') === n.id ? ' selected' : ''}>${esc(n.curto || n.nome)}</option>`).join('')}</select>` : '';
    barra.innerHTML = `${como}<textarea class="w95-input cm-txt" rows="1" maxlength="600" placeholder="${atual === 'radio' ? 'Transmitir…' : atual === 'sus' ? (ehMestre() ? 'Responder em particular…' : 'Sussurrar ao Mestre…') : 'Mensagem…'}" aria-label="Mensagem"></textarea><button class="w95-btn pri cm-env" data-env>${atual === 'radio' ? 'PTT' : 'Enviar'}</button>`;
  };
  const pintarMsgs = (rolar) => {
    const ia = pertoDoFim() || rolar;
    let l, c = atual;
    if (c === 'sus') { const k = chaveSus(); l = k ? msgs(D.sus[k]) : []; } else l = msgs(D[c]);
    l = l.slice(-250);
    lista.classList.toggle('cm-radio', c === 'radio');
    lista.innerHTML = l.map(m => {
      const eu = minha(c, m), d = String(m.d || '').slice(0, 5);
      const nome = c === 'radio' ? String(m.n || 'Central').toUpperCase() : (m.n || '?');
      return `<div class="cm-msg${eu ? ' eu' : ''}${m.npc ? ' npc' : ''}${(m.pc === 'mestre' || m.de === 'mestre') && !m.npc ? ' gm' : ''}" data-id="${esc(m.id)}"><div class="cm-cab"><b>${esc(nome)}</b><span class="cm-h">${esc(d)}${d ? ' · ' : ''}${esc(m.h || '')}</span>${podeApagar(c) ? `<button class="cm-x" data-del="${esc(m.id)}" aria-label="Apagar mensagem">×</button>` : ''}</div><div class="cm-t">${esc(m.t || '').replace(/\n/g, '<br>')}</div></div>`;
    }).join('') || `<p class="vazio95 cm-vazio">${c === 'radio' ? 'Nenhuma transmissão ainda. Só chiado.' : 'Nenhuma mensagem ainda.'}</p>`;
    if (ia) rolarFim(); else if (l.length) novas.hidden = false;
    if (CRW.moduloAtual() === 'chat' && !document.hidden) { marcarLido(c, c === 'sus' ? chaveSus() : ''); badges(); }
    $$('[data-cb]', sec).forEach(b => { const n = b.dataset.cb === atual ? 0 : naoLidas(b.dataset.cb); b.hidden = !n; b.textContent = n; });
  };
  const trocar = c => {
    atual = c; ls.set('chatCanal', c);
    $$('.cm-abas .aba95', sec).forEach(b => b.classList.toggle('on', b.dataset.c === c));
    pintarTopo(); pintarBarra(); pintarMsgs(true);
  };
  trocar(atual);
  const off = CRW.on('chat', c => {
    if (!document.body.contains(sec)) return off();
    if (c === atual) { if (c === 'sus' && ehMestre()) pintarTopo(); pintarMsgs(false); }
    else $$('[data-cb]', sec).forEach(b => { const n = naoLidas(b.dataset.cb); b.hidden = !n; b.textContent = n; });
  });
  const offM = CRW.on('modulo', id => { if (!document.body.contains(sec)) return offM(); if (id === 'chat') { pintarMsgs(true); } });

  const enviar = () => {
    const ta = $('.cm-txt', sec); if (!ta) return;
    const t = ta.value.trim(); if (!t) return;
    const r = CRW.relogio(), h = pad2(r.h) + ':' + pad2(r.m);
    const base = { t: t.slice(0, 600), ts: Date.now(), h, d: r.data };
    let cam, m;
    if (atual === 'sus') {
      const k = chaveSus(); if (!k) return;
      cam = 'chat/sus/' + k;
      m = ehMestre() ? { ...base, de: 'mestre', pc: 'mestre', n: 'Guardião da Luz' } : { ...base, de: 'pc', pc: P().pc, n: (CRW.pc(P().pc) || {}).nome || P().pc };
      if (ehMestre()) CRW.diario('sussurro', 'Para ' + ((conversas().find(x => x.k === k) || {}).nome || '?') + ': ' + t.slice(0, 120));
    } else if (atual === 'radio') {
      const u = ($('[data-como]', sec) || {}).value || 'Central'; ls.set('chatUnidade', u);
      cam = 'chat/radio'; m = { ...base, pc: quem(), n: u };
      CRW.Som.radio();
    } else {
      cam = 'chat/' + atual;
      const como = ($('[data-como]', sec) || {}).value || '';
      if (atual === 'geral' && como) { const n = CRW.ser(como) || {}; ls.set('chatComo', como); m = { ...base, pc: quem(), n: n.nome || como, npc: true }; }
      else { if (atual === 'geral') ls.set('chatComo', ''); m = { ...base, pc: quem(), n: P().mestre ? 'Guardião da Luz' : P().aux ? (P().nomeAux || 'Auxiliar') : ((CRW.pc(P().pc) || {}).nome || P().pc) }; }
    }
    Rede.push(cam, m).pronto.catch(() => aviso('O servidor recusou a mensagem.', 'erro'));
    ta.value = ''; ta.style.height = ''; ta.focus(); rolarFim();
  };
  sec.addEventListener('click', async e => {
    const ab = e.target.closest('[data-c]'); if (ab) { trocar(ab.dataset.c); CRW.Som.clique(); }
    if (e.target.closest('[data-env]')) enviar();
    if (e.target.closest('.cm-novas')) rolarFim();
    const d = e.target.closest('[data-del]');
    if (d && await confirmar('Apagar esta mensagem para todos?')) {
      const cam = atual === 'sus' ? 'chat/sus/' + chaveSus() : 'chat/' + atual;
      Rede.set(cam + '/' + d.dataset.del, null).catch(() => aviso('O servidor recusou essa ação.', 'erro'));
    }
  });
  sec.addEventListener('change', e => { if (e.target.matches('[data-conv]')) { susAtual = e.target.value; pintarMsgs(true); pintarTopo(); } });
  sec.addEventListener('keydown', e => { if (e.target.matches('.cm-txt') && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); enviar(); } });
  sec.addEventListener('input', e => { if (e.target.matches('.cm-txt')) { const ta = e.target; ta.style.height = ''; ta.style.height = Math.min(ta.scrollHeight + 4, 110) + 'px'; } });
  lista.addEventListener('scroll', () => { if (pertoDoFim()) novas.hidden = true; });
  // teclado do celular: o campo sobe junto (o navegador nem sempre encolhe a página)
  const wrap = $('.cm-wrap', sec);
  const vv = window.visualViewport;
  if (vv) {
    const ajustar = () => {
      if (!document.body.contains(sec)) { vv.removeEventListener('resize', ajustar); vv.removeEventListener('scroll', ajustar); return; }
      const kb = Math.max(0, innerHeight - vv.height - vv.offsetTop);
      wrap.style.paddingBottom = kb > 60 ? kb + 'px' : '';
      if (kb > 60 && document.activeElement && document.activeElement.matches('.cm-txt')) rolarFim();
    };
    vv.addEventListener('resize', ajustar); vv.addEventListener('scroll', ajustar);
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden && document.body.contains(sec) && CRW.moduloAtual() === 'chat') pintarMsgs(false); });
}

CRW.registrarModulo({ id: 'chat', titulo: 'Chat e Rádio', grupo: 'investigacao', icone: '✉', ordem: 2, cheio: true,
  visivel: v => !!(v.mestre || v.aux || v.pc), render });

CRW.registrarAjuda({ id: 'cm-chat', titulo: 'Chat e Rádio', ordem: 23, para: ['todos'], html: `<p>Grupo <b>Investigação do grupo</b>, módulo <b>Chat e Rádio</b>. Cada mensagem leva a <b>data e a hora do jogo</b>. O número vermelho no menu conta as mensagens que você ainda não leu; um som discreto avisa quando chega mensagem nova.</p>
<ul><li><b>Geral</b>: todos (investigadores, auxiliares e Mestre) leem e escrevem. O Mestre e os auxiliares podem falar como um NPC (campo ao lado da mensagem).</li>
<li><b>Rádio</b>: o rádio da polícia, com chiado e prefixo de unidade (Central, V-01, V-03…). Só o Mestre e os auxiliares transmitem (botão <b>PTT</b>); os investigadores escutam. Para falar, os investigadores usam o Geral.</li>
<li><b>Sussurro ao Mestre</b>: conversa privada entre você e o Guardião da Luz. Ninguém mais lê, nem os auxiliares. Bom para ações escondidas ou perguntas que o grupo não deve ouvir.</li>
<li><b>Auxiliares</b>: canal da mesa, só do Mestre e dos auxiliares.</li></ul>
<p>Escreva no campo de baixo e toque em <b>Enviar</b> (ou aperte Enter; Shift+Enter quebra a linha). O campo fica sempre visível, mesmo com o teclado do celular aberto. Se você estiver lendo mensagens antigas, aparece "▼ mensagens novas" para voltar ao fim.</p>` });
CRW.registrarAjuda({ id: 'cm-chat-m', titulo: 'Chat: sussurros e moderação', ordem: 89, para: ['mestre'], html: `<ul><li>Na aba <b>Sussurros</b>, escolha a conversa em "Conversa com" (um investigador por linha, com o número de mensagens novas). As conversas nascem quando cada investigador entra no site pela primeira vez (a chave da ficha dele). Se o mesmo jogador usar dois aparelhos, aparece "(aparelho 2)".</li>
<li>Sussurro novo de um jogador chega também como balão amarelo de aviso. As suas respostas vão para o diário da sessão.</li>
<li>O <b>×</b> em cada mensagem apaga para todos (em qualquer canal). Os auxiliares apagam no Rádio e no canal Auxiliares.</li>
<li>No rádio, escolha a unidade antes de transmitir (Central, V-01, V-03, Patrulha Rural 3…).</li>
<li>O "Restaurar o site" já tem o item "Chat, rádio e sussurros". O Relatório da sessão inclui as mensagens do Geral.</li></ul>` });
})();
