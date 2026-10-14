/* =========================================================
   CROWSREST · ficha.js
   Item 18 · Ficha de Candela: o jogador edita a dele (fichas/<chave>);
             o Guardião da Luz e os auxiliares veem todas, só leitura.
   Item 21 · Rolador de Candela: rolagem pública (rolagens/<id>), faixa
             em destaque para a mesa, holofote do Mestre e rolagem secreta.
   Item 45 · NPCs fichados no padrão de Candela (painel do Mestre, aba
             Registro), em segredos/npcs/<id> (só o Mestre lê e grava).
   API exposta: CRW.rolar(op), CRW.FichaCandela (utilidades), eventos
   'rolagem' (cada rolagem nova) e 'cicatriz' (ficha ganhou cicatriz).
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, clamp, copia, pad2, ls, ss, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela } = CRW;

/* ---------- catálogo de Candela (dados.js) ---------- */
const CAND = (typeof CANDELA !== 'undefined' && CANDELA) || {
  motivacoes: [
    { id: 'vigor', nome: 'Vigor', acoes: ['Mover', 'Atacar', 'Controlar'] },
    { id: 'astucia', nome: 'Astúcia', acoes: ['Influenciar', 'Ler', 'Esconder'] },
    { id: 'intuicao', nome: 'Intuição', acoes: ['Avaliar', 'Focar', 'Sentir'] },
  ],
  marcas: [{ id: 'corpo', nome: 'Corpo' }, { id: 'mente', nome: 'Mente' }, { id: 'sangria', nome: 'Sangria' }],
  papeis: [],
};
const sem = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const MOTS = CAND.motivacoes;
const ACOES = MOTS.flatMap(m => m.acoes.map(a => ({ id: sem(a), nome: a, mot: m.id, motNome: m.nome })));
const acaoPor = x => { const s = sem(x); return ACOES.find(a => a.id === s || sem(a.nome) === s) || null; };
const MARCAS = CAND.marcas;
const PAPEIS = CAND.papeis || [];
const NPCS_BASE = new Set((typeof NPCS !== 'undefined' ? NPCS : []).map(x => x.id));
// números de regra NÃO conferidos no livro: ficam editáveis (ver Como Usar)
const MAX_ACAO = 3, MAX_IMP = 9, MAX_ILUM = 12;
const RES = { critico: 'CRÍTICO', sucesso: 'SUCESSO', parcial: 'PARCIAL', falha: 'FALHA' };
const RES_TX = { critico: 'dois ou mais 6', sucesso: 'maior dado 6', parcial: 'maior dado 4 ou 5', falha: 'maior dado de 1 a 3' };
const CAMPOS = ['nome', 'pronomes', 'papel', 'esp', 'estilo', 'circulo', 'maxAcao', 'acoes', 'dourado', 'imp', 'res', 'marcas', 'cicatrizes', 'ilum', 'hab', 'equip', 'relacoes', 'notas', 'foto'];
const ABAS = [['id', 'Identidade', 'Identidade'], ['acoes', 'Ações', 'Motivações e ações'], ['marcas', 'Marcas', 'Marcas e cicatrizes'], ['ilum', 'Iluminação', 'Iluminação e habilidades'], ['equip', 'Equipamento', 'Equipamento, relações e notas']];

/* ---------- utilidades ---------- */
const lista = x => Array.isArray(x) ? x.filter(v => v != null) : (x && typeof x === 'object' ? Object.keys(x).sort((a, b) => a - b).map(k => x[k]).filter(v => v != null) : []);
const str = (v, max = 4000) => v == null ? '' : String(v).slice(0, max);
const agoraH = () => { const r = CRW.relogio(); return { h: `${pad2(r.h)}:${pad2(r.m)}`, d: r.data }; };
const slug = t => sem(t).replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'npc' + Date.now().toString(36).slice(-4);
function dado6() { try { const a = new Uint32Array(1); crypto.getRandomValues(a); return 1 + (a[0] % 6); } catch (e) { return 1 + Math.floor(Math.random() * 6); } }
const calmo = () => { try { return matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } };
const nomePC = id => (CRW.pc(id) || {}).nome || id || '';
// só o próprio jogador, no aparelho dele, grava a ficha (o Mestre e os auxiliares só leem)
function podeEditar() {
  const P = CRW.P, v = CRW.v();
  return !!(P.pc && !P.mestre && !P.aux && !v.espiando && v.pc === P.pc);
}

/* ---------- normalização da ficha ---------- */
function normalizar(f, pcid) {
  f = (f && typeof f === 'object') ? f : {};
  const o = { pc: f.pc || pcid || null, nome: str(f.nome, 60), criada: num(f.criada, 0) || null, ts: num(f.ts, 0) };
  ['pronomes', 'papel', 'esp', 'circulo'].forEach(k => { o[k] = str(f[k], 60); });
  ['estilo', 'relacoes', 'notas'].forEach(k => { o[k] = str(f[k]); });
  o.foto = typeof f.foto === 'string' && /^data:image\//.test(f.foto) ? f.foto : '';
  o.maxAcao = clamp(int(f.maxAcao, MAX_ACAO), 1, 6);
  const a = f.acoes || {}, d = f.dourado || {};
  o.acoes = {}; o.dourado = {};
  ACOES.forEach(x => { o.acoes[x.id] = clamp(int(a[x.id], 0), 0, o.maxAcao); o.dourado[x.id] = !!d[x.id]; });
  o.imp = {}; o.res = {};
  MOTS.forEach(m => {
    const x = (f.imp || {})[m.id] || {}, max = clamp(int(x.max, MAX_IMP), 1, 20);
    o.imp[m.id] = { v: clamp(int(x.v, 0), 0, max), max };
    const r = (f.res || {})[m.id]; o.res[m.id] = (r === '' || r == null) ? '' : clamp(int(r, 0), 0, 9);
  });
  o.marcas = {}; MARCAS.forEach(m => { o.marcas[m.id] = clamp(int((f.marcas || {})[m.id], 0), 0, 3); });
  o.cicatrizes = lista(f.cicatrizes).map(c => ({ marca: str(c.marca, 20), txt: str(c.txt, 600), ts: num(c.ts, 0) }));
  const il = f.ilum || {}; o.ilum = { max: clamp(int(il.max, MAX_ILUM), 1, 40) }; o.ilum.v = clamp(int(il.v, 0), 0, o.ilum.max);
  o.hab = lista(f.hab).map(h => ({ nome: str(h.nome, 80), txt: str(h.txt, 1500) }));
  o.equip = lista(f.equip).map(e => ({ nome: str(e.nome, 80), qtd: clamp(int(e.qtd, 1), 0, 999), desc: str(e.desc, 600), origem: str(e.origem, 60), ent: str(e.ent, 40) }));
  return o;
}
function normalizarNPC(s) {
  s = (s && typeof s === 'object') ? s : {};
  const o = { maxAcao: clamp(int(s.maxAcao, MAX_ACAO), 1, 6), acoes: {}, dourado: {}, imp: {}, marcas: {} };
  ACOES.forEach(x => { o.acoes[x.id] = clamp(int((s.acoes || {})[x.id], 0), 0, o.maxAcao); o.dourado[x.id] = !!(s.dourado || {})[x.id]; });
  MOTS.forEach(m => { const x = (s.imp || {})[m.id] || {}, max = clamp(int(x.max, MAX_IMP), 1, 20); o.imp[m.id] = { v: clamp(int(x.v, 0), 0, max), max }; });
  MARCAS.forEach(m => { o.marcas[m.id] = clamp(int((s.marcas || {})[m.id], 0), 0, 3); });
  ['quer', 'teme', 'segredos', 'ganchos', 'notas'].forEach(k => { o[k] = str(s[k]); });
  return o;
}

/* =========================================================
   PEDAÇOS DE HTML
   ========================================================= */
// bolinhas tocáveis (ou só desenhadas, na leitura)
function pontos(n, max, attrs, ro, rot) {
  let h = `<span class="fx-pts" role="group" aria-label="${esc(rot || '')}: ${n} de ${max}">`;
  for (let i = 1; i <= max; i++) h += ro ? `<i class="fx-pt${i <= n ? ' on' : ''}"></i>` : `<button type="button" class="fx-pt${i <= n ? ' on' : ''}" ${attrs} data-i="${i}" aria-label="${esc(rot || '')} ${i}"></button>`;
  return h + '</span>';
}
function campo(rot, k, F, ro, op = {}) {
  const v = F[k] || '';
  if (ro) return `<div class="campo fx-c"><span>${esc(rot)}</span><div class="fx-v${op.longo ? ' longo' : ''}">${v ? esc(v) : '<span class="dim">·</span>'}</div></div>`;
  return op.longo
    ? `<label class="campo fx-c">${esc(rot)}<textarea class="w95-input" rows="${op.rows || 3}" data-f="${k}" maxlength="${op.max || 4000}"${op.ph ? ` placeholder="${esc(op.ph)}"` : ''}>${esc(v)}</textarea></label>`
    : `<label class="campo fx-c">${esc(rot)}<input class="w95-input" data-f="${k}" value="${esc(v)}" maxlength="${op.max || 60}"${op.ph ? ` placeholder="${esc(op.ph)}"` : ''}></label>`;
}
function selPapel(F, ro) {
  if (ro) return `<div class="grade2">${campo('Papel', 'papel', F, true)}${campo('Especialidade', 'esp', F, true)}</div>`;
  const nomes = PAPEIS.map(p => p.nome), pap = PAPEIS.find(p => p.nome === F.papel);
  const esps = pap ? pap.esp : [...new Set(PAPEIS.flatMap(p => p.esp))];
  const outroP = !!F.papel && !nomes.includes(F.papel), outroE = !!F.esp && !esps.includes(F.esp);
  const sel = (k, rot, ops, outro, val) => `<div class="campo fx-c"><span>${rot}</span>
    <select class="w95-input" data-sel="${k}" aria-label="${rot}"><option value="">(escolha)</option>${ops.map(n => `<option${n === val ? ' selected' : ''}>${esc(n)}</option>`).join('')}<option value="__outro"${outro ? ' selected' : ''}>Outro (digitar)</option></select>
    <input class="w95-input fx-outro" data-f="${k}" value="${esc(val)}" maxlength="40" placeholder="digite ${rot.toLowerCase()}" aria-label="${rot} (digitado)"${outro ? '' : ' hidden'}></div>`;
  return `<div class="grade2">${sel('papel', 'Papel', nomes, outroP, F.papel)}${sel('esp', 'Especialidade', esps, outroE, F.esp)}</div>`;
}
function paneId(F, ro, op) {
  const nomeBase = op.pcNome || '';
  return `<div class="fx-idt">
    <div class="fx-retrato">${F.foto ? `<img src="${esc(F.foto)}" alt="Retrato de ${esc(F.nome || nomeBase)}">` : '<div class="fx-semfoto">SEM<br>RETRATO</div>'}
      ${ro ? '' : `<div class="fx-ret-bts"><button class="w95-btn" data-foto-btn>${F.foto ? 'Trocar' : 'Pôr retrato'}</button>${F.foto ? '<button class="w95-btn perigo" data-foto-del>Tirar</button>' : ''}<input type="file" accept="image/*" data-foto hidden></div>`}</div>
    <div class="fx-idc">
      ${ro ? campo('Nome', 'nome', { nome: F.nome || nomeBase }, true) : campo('Nome', 'nome', F, false, { ph: nomeBase })}
      <div class="grade2">${campo('Pronomes', 'pronomes', F, ro, { ph: 'ele/dele, ela/dela…' })}${campo('Círculo (nome do grupo)', 'circulo', F, ro)}</div>
    </div></div>
    ${selPapel(F, ro)}
    ${campo('Estilo e aparência', 'estilo', F, ro, { longo: true, rows: 3, ph: 'roupas, jeito, cicatrizes visíveis, objetos que sempre carrega…' })}`;
}
function linhaAcao(F, a, ro, op) {
  const d = F.dourado[a.id];
  return `<div class="fx-acao${d ? ' dour' : ''}" data-acao="${a.id}">
    <span class="fx-an">${esc(a.nome)}</span>
    ${pontos(F.acoes[a.id], F.maxAcao, `data-set="acao" data-a="${a.id}"`, ro, a.nome)}
    ${ro ? `<span class="fx-dour${d ? ' on' : ''}" title="${d ? 'Ação dourada' : 'Ação comum'}">${d ? '★' : '☆'}</span>` : `<button type="button" class="fx-dour${d ? ' on' : ''}" data-dour="${a.id}" aria-pressed="${d}" title="Marcar ou desmarcar como ação dourada" aria-label="Ação dourada: ${esc(a.nome)}">${d ? '★' : '☆'}</button>`}
    ${op.rolar ? `<button type="button" class="w95-btn fx-rolar" data-rolar="${a.id}" aria-label="Rolar ${esc(a.nome)}">Rolar</button>` : ''}
  </div>`;
}
function linhaImp(F, m, ro, pref) {
  const x = F.imp[m.id];
  if (ro) return `<div class="fx-imp"><span>Impulsos <b>${x.v}</b> de ${x.max}</span>${F.res ? `<span>Resistência <b>${F.res[m.id] === '' ? '·' : esc(F.res[m.id])}</b></span>` : ''}</div>`;
  return `<div class="fx-imp"><span class="fx-impc">Impulsos <button type="button" class="w95-btn fx-mm" data-${pref}imp="${m.id}" data-d="-1" aria-label="Menos um impulso de ${m.nome}">−</button><b data-impv="${m.id}">${x.v}</b><button type="button" class="w95-btn fx-mm" data-${pref}imp="${m.id}" data-d="1" aria-label="Mais um impulso de ${m.nome}">+</button>
      de <input class="w95-input fx-num" type="number" inputmode="numeric" min="1" max="20" data-${pref}impmax="${m.id}" value="${x.max}" aria-label="Máximo de impulsos de ${m.nome}"></span>
    ${F.res ? `<label class="fx-impc">Resistência <input class="w95-input fx-num" type="number" inputmode="numeric" min="0" max="9" data-res="${m.id}" value="${esc(F.res[m.id])}" aria-label="Resistência de ${m.nome}"></label>` : ''}</div>`;
}
function paneAcoes(F, ro, op) {
  return `<div class="fx-mots">${MOTS.map(m => `<div class="fx-mot">
      <div class="fx-mot-h">${esc(m.nome)}</div>
      ${linhaImp(F, m, ro, '')}
      ${ACOES.filter(a => a.mot === m.id).map(a => linhaAcao(F, a, ro, op)).join('')}
    </div>`).join('')}</div>
    ${ro ? `<p class="mini">Máximo de pontos por ação: ${F.maxAcao}. ★ = ação dourada.</p>`
      : `<div class="linha95 mini fx-maxl"><label>Máximo de pontos por ação <input class="w95-input fx-num" type="number" inputmode="numeric" min="1" max="6" data-maxacao value="${F.maxAcao}"></label><span>(padrão ${MAX_ACAO}; confira no livro)</span></div>
      <p class="mini">Toque numa bolinha para marcar pontos; toque de novo na última acesa para apagar uma. A estrela ★ marca a ação como <b>dourada</b> (rola com o dado dourado). "Rolar" abre o rolador já com os dados da ação.</p>`}`;
}
function paneMarcas(F, ro) {
  const nomeM = id => (MARCAS.find(m => m.id === id) || {}).nome || id || 'outra';
  return `<div class="fx-marcas">${MARCAS.map(m => { const v = F.marcas[m.id]; return `<div class="fx-marca" data-marca-l="${m.id}">
      <span class="fx-mn">${esc(m.nome)}</span>
      <span class="fx-cxs">${[1, 2, 3].map(i => ro ? `<i class="fx-cx${i <= v ? ' on' : ''}"></i>` : `<button type="button" class="fx-cx${i <= v ? ' on' : ''}" data-marca="${m.id}" data-i="${i}" aria-label="${esc(m.nome)}: marca ${i}"></button>`).join('')}
      ${ro ? '' : `<button type="button" class="fx-cx fx-cx4" data-cic="${m.id}" title="Marcar a 4ª: vira cicatriz e a trilha zera" aria-label="${esc(m.nome)}: 4ª marca (vira cicatriz)">4ª</button>`}</span>
      <span class="fx-mv">${v}/3</span></div>`; }).join('')}</div>
    <p class="mini">Três caixas por trilha. ${ro ? '' : 'A <b>4ª marca</b> vira uma <b>cicatriz</b>: o site pede a descrição, registra a cicatriz e zera a trilha.'}</p>
    <h4 class="fx-sub">Cicatrizes</h4>
    <ol class="fx-cics">${F.cicatrizes.map((c, i) => `<li><span class="etq ${c.marca === 'sangria' ? 'verm' : c.marca === 'mente' ? 'azul' : 'ambar'}">${esc(nomeM(c.marca))}</span> <span class="fx-cict">${esc(c.txt) || '<span class="dim">(sem descrição)</span>'}</span>${ro ? '' : ` <button type="button" class="fx-x" data-cic-del="${i}" aria-label="Apagar cicatriz">✕</button>`}</li>`).join('') || '<li class="vazio95">Nenhuma cicatriz.</li>'}</ol>
    ${ro ? '' : '<div class="linha95"><button type="button" class="w95-btn" data-cic-add>+ Registrar cicatriz</button></div>'}`;
}
function paneIlum(F, ro) {
  const il = F.ilum;
  let cx = '';
  for (let i = 1; i <= il.max; i++) cx += ro ? `<i class="fx-cx${i <= il.v ? ' on' : ''}"></i>` : `<button type="button" class="fx-cx${i <= il.v ? ' on' : ''}" data-ilum="${i}" aria-label="Iluminação ${i}"></button>`;
  return `<div class="fx-ilum"><div class="fx-ilum-h"><b>Iluminação</b> <span class="fx-mv">${il.v}/${il.max}</span></div><div class="fx-cxs fx-ilum-cx">${cx}</div>
    ${ro ? '' : `<div class="linha95 mini"><label>Tamanho da trilha <input class="w95-input fx-num" type="number" inputmode="numeric" min="1" max="40" data-ilummax value="${il.max}"></label><span>(padrão ${MAX_ILUM}; confira no livro)</span></div>`}</div>
    <h4 class="fx-sub">Habilidades</h4>
    <div class="fx-lista">${F.hab.map((h, i) => ro
      ? `<div class="fx-item"><b>${esc(h.nome) || '(sem nome)'}</b>${h.txt ? `<div class="fx-v longo">${esc(h.txt)}</div>` : ''}</div>`
      : `<div class="fx-item"><div class="fx-itl"><input class="w95-input" data-hab="${i}" data-k="nome" value="${esc(h.nome)}" placeholder="nome da habilidade" maxlength="80" aria-label="Nome da habilidade"><button type="button" class="fx-x" data-hab-del="${i}" aria-label="Apagar habilidade">✕</button></div>
         <textarea class="w95-input" rows="2" data-hab="${i}" data-k="txt" maxlength="1500" placeholder="o que ela faz (copie do livro)" aria-label="Texto da habilidade">${esc(h.txt)}</textarea></div>`).join('') || '<p class="vazio95">Nenhuma habilidade anotada.</p>'}</div>
    ${ro ? '' : '<div class="linha95"><button type="button" class="w95-btn" data-hab-add>+ Habilidade</button></div>'}`;
}
function paneEquip(F, ro) {
  return `<div class="fx-lista">${F.equip.map((e, i) => ro
      ? `<div class="fx-item"><b>${esc(e.nome) || '(sem nome)'}</b> <span class="mini">x${e.qtd}</span>${e.origem ? ` <span class="etq">${esc(e.origem)}</span>` : ''}${e.desc ? `<div class="fx-v longo">${esc(e.desc)}</div>` : ''}</div>`
      : `<div class="fx-item"><div class="fx-itl"><input class="w95-input" data-eq="${i}" data-k="nome" value="${esc(e.nome)}" placeholder="item" maxlength="80" aria-label="Nome do item"><input class="w95-input fx-num" type="number" inputmode="numeric" min="0" max="999" data-eq="${i}" data-k="qtd" value="${e.qtd}" aria-label="Quantidade"><button type="button" class="fx-x" data-eq-del="${i}" aria-label="Apagar item">✕</button></div>
         ${e.origem ? `<span class="etq">${esc(e.origem)}</span>` : ''}<textarea class="w95-input" rows="1" data-eq="${i}" data-k="desc" maxlength="600" placeholder="descrição (opcional)" aria-label="Descrição do item">${esc(e.desc)}</textarea></div>`).join('') || '<p class="vazio95">Nada no equipamento.</p>'}</div>
    ${ro ? '' : '<div class="linha95"><button type="button" class="w95-btn" data-eq-add>+ Item</button><span class="mini">Itens entregues pelo Guardião da Luz chegam aqui sozinhos.</span></div>'}
    ${campo('Relações (contatos, aliados, desafetos)', 'relacoes', F, ro, { longo: true, rows: 3 })}
    ${campo('Notas', 'notas', F, ro, { longo: true, rows: 4 })}`;
}
const PANES = { id: paneId, acoes: paneAcoes, marcas: paneMarcas, ilum: paneIlum, equip: paneEquip };
function htmlFicha(F, ro, aba, op = {}) {
  return `<div class="fx-ficha${ro ? ' fx-ro' : ''}">
    <div class="abas95 fx-abas" role="tablist">${ABAS.map(([id, n]) => `<button type="button" class="aba95${id === aba ? ' on' : ''}" data-fx-aba="${id}" role="tab" aria-selected="${id === aba}">${n}</button>`).join('')}</div>
    <div class="fx-panes">${ABAS.map(([id, , longo]) => `<section class="fx-pane${id === aba ? ' on' : ''}" data-pane="${id}"><h3 class="fx-ph">${longo}</h3>${PANES[id](F, ro, op)}</section>`).join('')}</div></div>`;
}
function trocarAba(raiz, aba) {
  $$('[data-fx-aba]', raiz).forEach(b => { const on = b.dataset.fxAba === aba; b.classList.toggle('on', on); b.setAttribute('aria-selected', on); });
  $$('.fx-pane', raiz).forEach(p => p.classList.toggle('on', p.dataset.pane === aba));
}

/* =========================================================
   FICHA DO JOGADOR (edição com gravação automática)
   ========================================================= */
const FX = { F: null, sujo: new Set(), t: null, salvando: false, pendente: false, aba: ls.get('fxAba', 'id'), st: '', stTs: 0 };
function fichaAtual() { if (!FX.F) FX.F = normalizar(CRW.Fichas.minha, CRW.P.pc); return FX.F; }
function sujar(...cs) {
  if (!podeEditar()) return;
  cs.forEach(c => FX.sujo.add(c));
  clearTimeout(FX.t); FX.t = setTimeout(salvar, 600);
  status('salvando');
}
async function salvar() {
  clearTimeout(FX.t); FX.t = null;
  if (!podeEditar() || !FX.F) { FX.sujo.clear(); return; }
  if (!FX.sujo.size) return;
  const k = CRW.minhaChave(); if (!k) return;
  const campos = [...FX.sujo]; FX.sujo.clear();
  const up = { ts: Date.now(), pc: CRW.P.pc };
  if (!FX.F.criada) { FX.F.criada = Date.now(); up.criada = FX.F.criada; }
  campos.forEach(c => { const v = FX.F[c]; up[c] = (v === undefined || v === '') ? null : copia(v); });
  FX.F.ts = up.ts; FX.salvando = true;
  try { await Rede.update('fichas/' + k, up); status('salvo'); }
  catch (e) { campos.forEach(c => FX.sujo.add(c)); status('erro'); aviso('A ficha não foi salva. Tente de novo em instantes.', 'erro'); }
  FX.salvando = false;
  // o que chegou do servidor enquanto gravava (outro aparelho) entra agora
  if (!FX.sujo.size && !FX.t) adotar(CRW.Fichas.minha);
}
function status(s) {
  FX.st = s; if (s === 'salvo') FX.stTs = Date.now();
  const e = $('#mod-ficha [data-fx-st]'); if (!e) return;
  const d = new Date(FX.stTs);
  e.textContent = s === 'salvando' ? '● salvando…' : s === 'salvo' ? `✓ salvo ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}` : s === 'erro' ? '✕ não salvo' : s === 'ro' ? 'somente leitura' : 'gravação automática';
  e.classList.toggle('fx-st-erro', s === 'erro');
}
const semTs = f => { const o = { ...f }; delete o.ts; delete o.criada; return JSON.stringify(o); };
function adotar(x) {
  if (!CRW.P.pc || !podeEditar()) return;
  if (FX.sujo.size || FX.t || FX.salvando) return;
  const n = normalizar(x || { pc: CRW.P.pc }, CRW.P.pc);
  if (FX.F && semTs(n) === semTs(FX.F)) { FX.F.ts = n.ts; return; }
  FX.F = n;
  const sec = $('#mod-ficha');
  if (sec && sec.contains(document.activeElement) && document.activeElement.matches('input,textarea,select')) FX.pendente = true;
  else redesenharFicha();
}
CRW.on('minhaFicha', adotar);
CRW.on('perfil', () => { FX.F = null; FX.sujo.clear(); clearTimeout(FX.t); FX.t = null; });

function redesenharFicha() {
  const sec = $('#mod-ficha'); if (!sec) return;
  const corpo = $('.fx-corpo', sec), bar = $('[data-fx-bar]', sec); if (!corpo) return;
  const main = $('#main'), y = main ? main.scrollTop : 0;
  const ed = podeEditar(), v = CRW.v();
  let F = null;
  if (ed) F = fichaAtual();
  else { const f = CRW.fichaDoPC(v.pc); F = f ? normalizar(f, v.pc) : null; }
  const pcNome = nomePC(v.pc);
  $('.fx-titulo', sec).textContent = (F && F.nome) || pcNome || 'Investigador';
  corpo.innerHTML = F ? htmlFicha(F, !ed, FX.aba, { rolar: ed, pcNome })
    : `<p class="vazio95">${esc(pcNome)} ainda não abriu a ficha neste caso.</p>`;
  bar.innerHTML = ed
    ? `<button type="button" class="w95-btn" data-fx-rolador>⚄ Rolador avulso</button><button type="button" class="w95-btn" data-fx-codigo>Código da ficha</button><button type="button" class="w95-btn" data-fx-exp>Exportar</button><button type="button" class="w95-btn" data-fx-imp>Importar</button><button type="button" class="w95-btn" data-fx-print>Imprimir</button><input type="file" accept=".json,application/json" data-fx-imparq hidden>`
    : (F ? '<span class="etq ambar">Somente leitura</span><button type="button" class="w95-btn" data-fx-print>Imprimir</button>' : '');
  status(ed ? (FX.st && FX.st !== 'ro' ? FX.st : '') : 'ro');
  if (main) main.scrollTop = y;
  FX.pendente = false;
}
function renderFicha(sec) {
  sec.innerHTML = `<div class="panel fx"><div class="panel-h"><h2>Ficha de Investigador · <span class="fx-titulo"></span></h2><div class="meta" data-fx-st></div></div>
    <div class="panel-b"><div class="linha95 fx-bar" data-fx-bar></div><div class="fx-corpo"></div></div></div>`;
  ligarEdicao(sec);
  redesenharFicha();
}
// o Mestre espiando ou os auxiliares: a ficha vista acompanha as mudanças do jogador
CRW.on('fichas', () => { if ($('#mod-ficha') && !podeEditar()) redesenharFicha(); });

function ligarEdicao(sec) {
  sec.addEventListener('click', async e => {
    const t = e.target;
    const aba = t.closest('[data-fx-aba]');
    if (aba) { FX.aba = aba.dataset.fxAba; ls.set('fxAba', FX.aba); trocarAba(sec, FX.aba); return; }
    if (t.closest('[data-fx-print]')) { const F = podeEditar() ? fichaAtual() : normalizar(CRW.fichaDoPC(CRW.v().pc)); imprimirFicha(F); return; }
    if (!podeEditar()) return;
    const F = fichaAtual();
    const pt = t.closest('.fx-pt[data-set="acao"]');
    if (pt) { const a = pt.dataset.a, i = int(pt.dataset.i); F.acoes[a] = F.acoes[a] === i ? i - 1 : i; sujar('acoes'); acenderPts(pt.parentElement, F.acoes[a]); return; }
    const dr = t.closest('[data-dour]');
    if (dr) { const a = dr.dataset.dour; F.dourado[a] = !F.dourado[a]; sujar('dourado'); dr.classList.toggle('on', F.dourado[a]); dr.textContent = F.dourado[a] ? '★' : '☆'; dr.setAttribute('aria-pressed', F.dourado[a]); dr.closest('.fx-acao').classList.toggle('dour', F.dourado[a]); return; }
    const im = t.closest('[data-imp][data-d]');
    if (im) { const m = im.dataset.imp, x = F.imp[m]; x.v = clamp(x.v + int(im.dataset.d), 0, x.max); sujar('imp'); const b = $(`[data-impv="${m}"]`, sec); if (b) b.textContent = x.v; return; }
    const mc = t.closest('[data-marca][data-i]');
    if (mc) { const m = mc.dataset.marca, i = int(mc.dataset.i); F.marcas[m] = F.marcas[m] === i ? i - 1 : i; sujar('marcas'); redesenharFicha(); return; }
    const cic = t.closest('[data-cic]');
    if (cic) { quartaMarca(cic.dataset.cic); return; }
    const cd = t.closest('[data-cic-del]');
    if (cd) { if (await confirmar('Apagar esta cicatriz da ficha?')) { F.cicatrizes.splice(int(cd.dataset.cicDel), 1); sujar('cicatrizes'); redesenharFicha(); } return; }
    if (t.closest('[data-cic-add]')) { novaCicatriz(null); return; }
    const il = t.closest('[data-ilum]');
    if (il) { const i = int(il.dataset.ilum); F.ilum.v = F.ilum.v === i ? i - 1 : i; sujar('ilum'); redesenharFicha(); return; }
    if (t.closest('[data-hab-add]')) { F.hab.push({ nome: '', txt: '' }); sujar('hab'); redesenharFicha(); focarUltimo(sec, '[data-hab][data-k="nome"]'); return; }
    const hd = t.closest('[data-hab-del]');
    if (hd) { const h = F.hab[int(hd.dataset.habDel)]; if (!h || (!h.nome && !h.txt) || await confirmar(`Apagar a habilidade "${h.nome || 'sem nome'}"?`)) { F.hab.splice(int(hd.dataset.habDel), 1); sujar('hab'); redesenharFicha(); } return; }
    if (t.closest('[data-eq-add]')) { F.equip.push({ nome: '', qtd: 1, desc: '', origem: '', ent: '' }); sujar('equip'); redesenharFicha(); focarUltimo(sec, '[data-eq][data-k="nome"]'); return; }
    const ed = t.closest('[data-eq-del]');
    if (ed) { const it = F.equip[int(ed.dataset.eqDel)]; if (!it || !it.nome || await confirmar(`Tirar "${it.nome}" do equipamento?`)) { F.equip.splice(int(ed.dataset.eqDel), 1); sujar('equip'); redesenharFicha(); } return; }
    const rl = t.closest('[data-rolar]');
    if (rl) { abrirRolador({ acao: rl.dataset.rolar, pc: CRW.P.pc }); return; }
    if (t.closest('[data-fx-rolador]')) { abrirRolador({ pc: CRW.P.pc }); return; }
    if (t.closest('[data-foto-btn]')) { const i = $('[data-foto]', sec); if (i) i.click(); return; }
    if (t.closest('[data-foto-del]')) { if (await confirmar('Tirar o retrato da ficha?')) { F.foto = ''; sujar('foto'); redesenharFicha(); } return; }
    if (t.closest('[data-fx-codigo]')) { janelaCodigo(); return; }
    if (t.closest('[data-fx-exp]')) { exportarFicha(); return; }
    if (t.closest('[data-fx-imp]')) { const i = $('[data-fx-imparq]', sec); if (i) i.click(); return; }
  });
  sec.addEventListener('input', e => {
    if (!podeEditar()) return;
    const t = e.target, F = fichaAtual();
    if (t.dataset.f) { F[t.dataset.f] = t.value; sujar(t.dataset.f); if (t.dataset.f === 'nome') { const ti = $('.fx-titulo', sec); if (ti) ti.textContent = t.value || nomePC(CRW.P.pc); } return; }
    if (t.dataset.hab != null && t.dataset.k) { const h = F.hab[int(t.dataset.hab)]; if (h) { h[t.dataset.k] = t.value; sujar('hab'); } return; }
    if (t.dataset.eq != null && t.dataset.k) { const it = F.equip[int(t.dataset.eq)]; if (it) { it[t.dataset.k] = t.dataset.k === 'qtd' ? clamp(int(t.value, 0), 0, 999) : t.value; sujar('equip'); } return; }
    if (t.dataset.res) { F.res[t.dataset.res] = t.value === '' ? '' : clamp(int(t.value, 0), 0, 9); sujar('res'); return; }
  });
  sec.addEventListener('change', async e => {
    if (!podeEditar()) return;
    const t = e.target, F = fichaAtual();
    if (t.dataset.sel) {
      const k = t.dataset.sel, inp = t.parentElement.querySelector(`[data-f="${k}"]`);
      if (t.value === '__outro') { inp.hidden = false; inp.value = ''; F[k] = ''; inp.focus(); }
      else { F[k] = t.value; if (k === 'papel') { const p = PAPEIS.find(x => x.nome === t.value); if (p && F.esp && !p.esp.includes(F.esp)) { F.esp = ''; sujar('esp'); } } redesenharFicha(); }
      sujar(k); return;
    }
    if (t.dataset.impmax) { const x = F.imp[t.dataset.impmax]; x.max = clamp(int(t.value, MAX_IMP), 1, 20); x.v = Math.min(x.v, x.max); sujar('imp'); redesenharFicha(); return; }
    if (t.hasAttribute('data-maxacao')) { F.maxAcao = clamp(int(t.value, MAX_ACAO), 1, 6); ACOES.forEach(a => { F.acoes[a.id] = Math.min(F.acoes[a.id], F.maxAcao); }); sujar('maxAcao', 'acoes'); redesenharFicha(); return; }
    if (t.hasAttribute('data-ilummax')) { F.ilum.max = clamp(int(t.value, MAX_ILUM), 1, 40); F.ilum.v = Math.min(F.ilum.v, F.ilum.max); sujar('ilum'); redesenharFicha(); return; }
    if (t.hasAttribute('data-foto')) {
      const f = t.files[0]; t.value = ''; if (!f) return;
      try { F.foto = await CRW.lerImagem(f, 900, 0.75); sujar('foto'); redesenharFicha(); aviso('Retrato colocado na ficha.'); } catch (er) { aviso('Imagem inválida.', 'erro'); }
      return;
    }
    if (t.hasAttribute('data-fx-imparq')) { const f = t.files[0]; t.value = ''; if (f) importarFicha(f); }
  });
  // terminou de digitar: se chegou algo de outro aparelho no meio, mostra agora
  sec.addEventListener('focusout', () => setTimeout(() => { if (FX.pendente && !sec.contains(document.activeElement)) redesenharFicha(); }, 80));
}
function acenderPts(span, n) { $$('.fx-pt', span).forEach((b, i) => b.classList.toggle('on', i < n)); }
function focarUltimo(sec, sel) { const l = $$(sel, sec); if (l.length) l[l.length - 1].focus(); }

/* ---------- 4ª marca vira cicatriz ---------- */
async function quartaMarca(m) {
  const nome = (MARCAS.find(x => x.id === m) || {}).nome || m;
  if (!(await confirmar(`Marcar a 4ª marca de ${nome}?\n\nEla vira uma cicatriz: você descreve a cicatriz, ela fica registrada na ficha e a trilha de ${nome} volta a zero.`, { titulo: 'Cicatriz', icone: 'a', ok: 'Continuar' }))) return;
  novaCicatriz(m);
}
async function novaCicatriz(m) {
  let marca = m;
  if (!marca) {
    const txt = await pedirTexto('De que trilha veio a cicatriz? (Corpo, Mente ou Sangria)', 'Corpo');
    if (txt === null) return;
    const x = MARCAS.find(y => sem(y.nome) === sem(txt) || y.id === sem(txt)); marca = x ? x.id : sem(txt).slice(0, 20);
  }
  const d = await pedirTexto('Descreva a cicatriz (o que ela é e como aparece no investigador)', '', { longo: true, titulo: 'Nova cicatriz' });
  if (d === null) return;
  const F = fichaAtual();
  F.cicatrizes.push({ marca, txt: d.trim().slice(0, 600), ts: Date.now() });
  if (m) F.marcas[m] = 0;
  sujar('cicatrizes', 'marcas'); await salvar();
  redesenharFicha();
  CRW.Som.tom(330, 0, 0.3, 'sawtooth', 0.05); CRW.Som.tom(247, 0.25, 0.5, 'sawtooth', 0.05);
  aviso('Cicatriz registrada' + (m ? '; a trilha voltou a zero.' : '.'));
}

/* ---------- itens entregues pelo Mestre (CRW.entregar(pc, {tipo:'item', nome, desc, origem, qtd})) ---------- */
async function receberItem(e) {
  if (!CRW.P.pc || !e) return;
  const vistos = ls.get('fxEnt:' + CRW.P.pc, []);
  if (e.id && vistos.includes(e.id)) return;
  if (e.id) ls.set('fxEnt:' + CRW.P.pc, [...vistos, e.id].slice(-300));
  const it = { nome: str(e.nome || 'Item', 80), qtd: clamp(int(e.qtd, 1), 0, 999), desc: str(e.desc, 600), origem: str(e.origem || 'Entregue pelo Guardião', 60), ent: str(e.id, 40) };
  if (!FX.F && !CRW.Fichas.minha && Rede.fb()) { try { FX.F = normalizar(await Rede.once('fichas/' + CRW.minhaChave()), CRW.P.pc); } catch (er) {} }
  const F = fichaAtual();
  if (it.ent && F.equip.some(x => x.ent === it.ent)) return;
  F.equip.push(it); FX.sujo.add('equip'); await salvar();
  if ($('#mod-ficha')) redesenharFicha();
  CRW.Som.ding(); aviso(`Item recebido: ${it.nome}${it.qtd > 1 ? ' x' + it.qtd : ''}. Está no seu equipamento.`);
}
CRW.aoEntregar('item', receberItem);

/* ---------- código da ficha (outro aparelho) ---------- */
function janelaCodigo() {
  const k = CRW.minhaChave();
  const w = janela({ id: 'fxCodigo', titulo: 'Código da ficha', icone: '⚿', largura: '460px', html: `
    <p class="tx">Este é o código secreto da sua ficha. <b>Anote ou guarde</b> (mande para você mesmo). Em outro celular ou computador, entre com o mesmo investigador, abra "Minha ficha", toque em "Código da ficha" e cole o código em "Usar ficha de outro aparelho".</p>
    <div class="linha95"><input class="w95-input fx-cod" readonly value="${esc(k)}" aria-label="Código da ficha"><button type="button" class="w95-btn pri" data-copiar>Copiar</button></div>
    <p class="mini">Não passe este código para outros jogadores: quem tem o código pode mexer na sua ficha.</p>
    <hr class="fx-hr">
    <label class="campo">Usar ficha de outro aparelho (cole o código)<input class="w95-input" data-nova autocomplete="off" spellcheck="false" placeholder="32 letras e números"></label>
    <div class="linha95"><button type="button" class="w95-btn" data-usar>Usar este código</button><button type="button" class="w95-btn" data-fechar>Fechar</button></div>` });
  $('[data-copiar]', w).addEventListener('click', () => {
    const i = $('.fx-cod', w);
    const fb = () => { i.select(); try { document.execCommand('copy'); aviso('Código copiado.'); } catch (e) { aviso('Selecione e copie o código à mão.'); } };
    if (navigator.clipboard) navigator.clipboard.writeText(k).then(() => aviso('Código copiado.'), fb); else fb();
  });
  $('[data-usar]', w).addEventListener('click', async () => {
    const n = ($('[data-nova]', w).value || '').trim();
    if (n.length < 24) return aviso('Código curto demais: confira se colou inteiro.', 'erro');
    if (n === k) return aviso('Este já é o código deste aparelho.');
    let f = null; try { f = await Rede.once('fichas/' + n); } catch (er) {}
    if (!f) return aviso('Nenhuma ficha com esse código.', 'erro');
    if (f.pc && f.pc !== CRW.P.pc && !(await confirmar(`Essa ficha é de ${f.nome || nomePC(f.pc)}, não de ${nomePC(CRW.P.pc)}. Usar mesmo assim?`))) return;
    if (!(await confirmar(`Trocar para a ficha "${f.nome || nomePC(f.pc)}"?\n\nA ficha atual continua guardada com o código antigo:\n${k}`))) return;
    await salvar();
    FX.F = null;
    CRW.usarChave(n);
    fecharJanela('fxCodigo');
    aviso('Ficha trocada. Este aparelho agora usa o novo código.');
    setTimeout(redesenharFicha, 300);
  });
}

/* ---------- exportar, importar, imprimir ---------- */
function exportarFicha() {
  const F = fichaAtual();
  CRW.baixar(`ficha-${slug(F.nome || nomePC(CRW.P.pc))}.json`, JSON.stringify({ formato: 'crowsrest-ficha', versao: 1, exportada: Date.now(), ficha: F }, null, 1), 'application/json');
  aviso('Ficha exportada (.json). Guarde o arquivo.');
}
async function importarFicha(file) {
  let o; try { o = JSON.parse(await CRW.lerTexto(file)); } catch (e) { return aviso('Arquivo inválido.', 'erro'); }
  const f = o && (o.ficha || o);
  if (!f || typeof f !== 'object' || !(f.acoes || f.marcas || f.nome)) return aviso('Este arquivo não é uma ficha do Crowsrest.', 'erro');
  if (!(await confirmar(`Importar a ficha "${f.nome || 'sem nome'}"?\n\nTudo o que está na sua ficha agora será trocado pelo conteúdo do arquivo.`))) return;
  const atual = fichaAtual();
  FX.F = normalizar({ ...f, pc: CRW.P.pc, criada: atual.criada }, CRW.P.pc);
  CAMPOS.forEach(c => FX.sujo.add(c));
  await salvar(); redesenharFicha(); aviso('Ficha importada.');
}
function imprimirFicha(F) {
  if (!F) return;
  const nm = id => (MARCAS.find(m => m.id === id) || {}).nome || id;
  const bol = (n, max) => '●'.repeat(n) + '○'.repeat(Math.max(0, max - n));
  const corpo = `${F.foto ? `<img src="${F.foto}" alt="" style="float:right;width:110px;height:140px;object-fit:cover;border:1px solid #555;margin:0 0 8px 12px">` : ''}
    <h2>Identificação</h2>
    <table><tr><th>Nome</th><td>${esc(F.nome || nomePC(F.pc))}</td><th>Pronomes</th><td>${esc(F.pronomes)}</td></tr>
    <tr><th>Papel</th><td>${esc(F.papel)}</td><th>Especialidade</th><td>${esc(F.esp)}</td></tr>
    <tr><th>Círculo</th><td colspan="3">${esc(F.circulo)}</td></tr>
    <tr><th>Estilo</th><td colspan="3">${esc(F.estilo).replace(/\n/g, '<br>')}</td></tr></table>
    <h2>Motivações e ações</h2>
    <table>${MOTS.map(m => `<tr><th colspan="2">${esc(m.nome)} · impulsos ${F.imp[m.id].v}/${F.imp[m.id].max}${F.res && F.res[m.id] !== '' ? ' · resistência ' + esc(F.res[m.id]) : ''}</th></tr>
      ${ACOES.filter(a => a.mot === m.id).map(a => `<tr><td>${esc(a.nome)}${F.dourado[a.id] ? ' ★ dourada' : ''}</td><td>${bol(F.acoes[a.id], F.maxAcao)}</td></tr>`).join('')}`).join('')}</table>
    <h2>Marcas</h2><table><tr>${MARCAS.map(m => `<th>${esc(m.nome)}</th><td>${bol(F.marcas[m.id], 3)}</td>`).join('')}</tr></table>
    <h2>Cicatrizes</h2>${F.cicatrizes.length ? `<ol>${F.cicatrizes.map(c => `<li>[${esc(nm(c.marca))}] ${esc(c.txt)}</li>`).join('')}</ol>` : '<p>Nenhuma.</p>'}
    <h2>Iluminação</h2><p>${F.ilum.v} de ${F.ilum.max} · ${bol(F.ilum.v, F.ilum.max)}</p>
    <h2>Habilidades</h2>${F.hab.length ? F.hab.map(h => `<p><b>${esc(h.nome)}</b><br>${esc(h.txt).replace(/\n/g, '<br>')}</p>`).join('') : '<p>Nenhuma.</p>'}
    <h2>Equipamento</h2>${F.equip.length ? `<table><tr><th>Item</th><th>Qtd.</th><th>Descrição</th><th>Origem</th></tr>${F.equip.map(e => `<tr><td>${esc(e.nome)}</td><td>${e.qtd}</td><td>${esc(e.desc)}</td><td>${esc(e.origem)}</td></tr>`).join('')}</table>` : '<p>Nada.</p>'}
    <h2>Relações</h2><p>${esc(F.relacoes).replace(/\n/g, '<br>') || '·'}</p>
    <h2>Notas</h2><p>${esc(F.notas).replace(/\n/g, '<br>') || '·'}</p>
    <div class="ass"><div>Investigador</div><div>Guardião da Luz</div></div>`;
  CRW.imprimir('Ficha · ' + (F.nome || nomePC(F.pc)), corpo, { sub: 'Formulário CCSO-18 · Ficha de Investigador' });
}

/* =========================================================
   FICHAS DE TODOS (Guardião da Luz e auxiliares) · só leitura
   ========================================================= */
const FM = { sel: null, aba: ls.get('fxAbaM', 'id') };
function renderFichas(sec) {
  sec.innerHTML = `<div class="panel fx"><div class="panel-h"><h2>Fichas dos investigadores</h2><div class="meta">somente leitura</div></div>
    <div class="panel-b"><p class="mini">Você vê todas as fichas em tempo real, mas <b>não altera nada</b>: quem edita é o jogador, no aparelho dele. Toque num investigador para abrir a ficha.</p>
    <div class="fx-resumo" data-fm-res></div>
    <div class="linha95 fx-fmsel"><label class="mini" for="fxFmSel">Ficha</label><select id="fxFmSel" class="w95-input" data-fm-sel></select><button type="button" class="w95-btn" data-fx-print>Imprimir</button></div>
    <div class="fx-corpo"></div></div></div>`;
  sec.addEventListener('click', e => {
    const aba = e.target.closest('[data-fx-aba]');
    if (aba) { FM.aba = aba.dataset.fxAba; ls.set('fxAbaM', FM.aba); trocarAba(sec, FM.aba); return; }
    const c = e.target.closest('[data-fm-ver]');
    if (c) { FM.sel = c.dataset.fmVer; desenharFichasM(); const cp = $('.fx-corpo', sec); if (cp && cp.scrollIntoView) cp.scrollIntoView({ block: 'start' }); return; }
    if (e.target.closest('[data-fx-print]')) { const f = (CRW.Fichas.todas || {})[FM.sel]; if (f) imprimirFicha(normalizar(f)); }
  });
  sec.addEventListener('change', e => { if (e.target.matches('[data-fm-sel]')) { FM.sel = e.target.value; desenharFichasM(); } });
  desenharFichasM();
}
function desenharFichasM() {
  const sec = $('#mod-fichas'); if (!sec) return;
  const todas = CRW.Fichas.todas || {}, lst = CRW.fichas();
  const pcs = CRW.pcs(), ids = new Set(pcs.map(p => p.id));
  const opcoes = [];
  pcs.forEach(p => {
    const k = CRW.chaveDoPC(p.id);
    if (!k) { opcoes.push({ k: '', t: `${p.nome} · ainda sem ficha`, off: true }); return; }
    opcoes.push({ k, t: p.nome, pc: p.id });
    lst.filter(f => f.pc === p.id && f.chave !== k).sort((a, b) => num(b.ts) - num(a.ts)).forEach(f => { const d = new Date(num(f.ts)); opcoes.push({ k: f.chave, t: `${p.nome} · outro aparelho (${pad2(d.getDate())}/${pad2(d.getMonth() + 1)} ${pad2(d.getHours())}:${pad2(d.getMinutes())})` }); });
  });
  lst.filter(f => !ids.has(f.pc)).forEach(f => opcoes.push({ k: f.chave, t: `${f.nome || f.pc || '?'} · investigador fora da lista` }));
  if (!FM.sel || !todas[FM.sel]) { const pr = opcoes.find(o => o.k); FM.sel = pr ? pr.k : null; }
  const sel = $('[data-fm-sel]', sec);
  sel.innerHTML = opcoes.length ? opcoes.map(o => `<option value="${esc(o.k)}"${o.off ? ' disabled' : ''}${o.k && o.k === FM.sel ? ' selected' : ''}>${esc(o.t)}</option>`).join('') : '<option value="">Nenhum investigador cadastrado</option>';
  // resumo da mesa
  $('[data-fm-res]', sec).innerHTML = pcs.map(p => {
    const k = CRW.chaveDoPC(p.id), F = k ? normalizar(todas[k], p.id) : null;
    if (!F) return `<div class="fx-rc vazio"><b>${esc(p.nome)}</b><span class="mini">sem ficha ainda</span></div>`;
    return `<button type="button" class="fx-rc${k === FM.sel ? ' on' : ''}" data-fm-ver="${esc(k)}"><b>${esc(F.nome || p.nome)}</b><span class="mini">${esc([F.papel, F.esp].filter(Boolean).join(' · ') || 'sem papel')}</span>
      <span class="fx-rcm">${MARCAS.map(m => `<span title="${esc(m.nome)}">${esc(m.nome[0])} ${'■'.repeat(F.marcas[m.id])}${'□'.repeat(3 - F.marcas[m.id])}</span>`).join('')}</span>
      <span class="mini">Ilum. ${F.ilum.v}/${F.ilum.max} · ${F.cicatrizes.length} cicatriz${F.cicatrizes.length === 1 ? '' : 'es'}</span></button>`;
  }).join('') || '<p class="vazio95">Nenhum investigador cadastrado (aba Mapa do painel, "Personagens").</p>';
  const corpo = $('.fx-corpo', sec), main = $('#main'), y = main ? main.scrollTop : 0;
  const f = FM.sel ? todas[FM.sel] : null;
  corpo.innerHTML = f ? htmlFicha(normalizar(f), true, FM.aba, { pcNome: nomePC(f.pc) }) : '<p class="vazio95">Nenhuma ficha aberta ainda. A ficha nasce quando o jogador entra no site.</p>';
  if (main) main.scrollTop = y;
}
// avisa o Mestre quando uma ficha ganha cicatriz
let cicBase = null;
CRW.on('fichas', t => {
  const cont = {}; Object.entries(t || {}).forEach(([k, f]) => { cont[k] = lista(f && f.cicatrizes).length; });
  if (cicBase && CRW.P.mestre) Object.entries(cont).forEach(([k, n]) => {
    if (cicBase[k] != null && n > cicBase[k]) {
      const f = t[k], c = lista(f.cicatrizes).slice(-1)[0] || {}, nm = (MARCAS.find(m => m.id === c.marca) || {}).nome || c.marca || '';
      const quem = f.nome || nomePC(f.pc);
      CRW.alertaMestre(`${quem} ganhou uma cicatriz${nm ? ' (' + nm + ')' : ''}: ${c.txt || ''}`, 'cic-' + k);
      CRW.diario('ficha', `Cicatriz de ${quem}${nm ? ' (' + nm + ')' : ''}: ${c.txt || ''}`);
      CRW.emit('cicatriz', { pc: f.pc, nome: quem, chave: k, ...c });
    }
  });
  cicBase = cont;
  desenharFichasM();
});

/* =========================================================
   ROLADOR DE CANDELA
   ========================================================= */
function avaliar(dados, zero) {
  if (!dados.length) return { res: 'falha', val: 0 };
  if (zero) { const m = Math.min(...dados); return { res: m === 6 ? 'sucesso' : m >= 4 ? 'parcial' : 'falha', val: m }; }
  const m = Math.max(...dados), seis = dados.filter(d => d === 6).length;
  return { res: seis >= 2 ? 'critico' : m === 6 ? 'sucesso' : m >= 4 ? 'parcial' : 'falha', val: m };
}
// n = dados da parada (ação + impulsos); dourado troca um dado comum (ou soma um, se extra)
function sortear(n, dourado, extra) {
  n = clamp(int(n, 0), 0, 12);
  const tot = n + (dourado && extra ? 1 : 0), zero = tot <= 0;
  const qtd = zero ? 2 : tot;
  const dados = Array.from({ length: qtd }, dado6);
  const dour = (!zero && dourado) ? [qtd - 1] : [];
  return { dados, dour, zero, n: tot, ...avaliar(dados, zero) };
}
const htmlDado = (v, dour, cls) => `<span class="fx-d${dour ? ' dour' : ''}${cls ? ' ' + cls : ''}" data-v="${v}" role="img" aria-label="${dour ? 'dado dourado ' : 'dado '}${v}">${'<i></i>'.repeat(9)}</span>`;
function somResultado(res) {
  const S = CRW.Som;
  if (res === 'critico') { [523, 659, 784, 1046].forEach((f, i) => S.tom(f, i * 0.09, 0.5, 'square', 0.05)); S.tom(1318, 0.4, 0.6, 'sine', 0.06); }
  else if (res === 'sucesso') S.ding();
  else if (res === 'parcial') { S.tom(587, 0, 0.18, 'square', 0.05); S.tom(523, 0.16, 0.3, 'square', 0.05); }
  else { S.tom(196, 0, 0.3, 'sawtooth', 0.05); S.tom(147, 0.2, 0.45, 'sawtooth', 0.05); }
}
// anima os dados no estilo dos joguinhos dos anos 90 e acende os que valem
function animarDados(box, r, op = {}) {
  return new Promise(ok => {
    box.innerHTML = r.dados.map((v, i) => htmlDado(1 + ((i * 3) % 6), r.dour.includes(i), 'rola')).join('');
    const ds = $$('.fx-d', box), dur = calmo() ? 0 : (op.rapido ? 420 : 720), passo = 80;
    const fim = () => {
      ds.forEach((d, i) => { d.classList.remove('rola'); d.dataset.v = r.dados[i]; d.setAttribute('aria-label', (r.dour.includes(i) ? 'dado dourado ' : 'dado ') + r.dados[i]); });
      const alvo = r.val;
      ds.forEach((d, i) => d.classList.add(r.dados[i] === alvo ? 'vale' : 'fora'));
      if (op.som !== false) somResultado(r.res);
      ok();
    };
    if (!dur) return fim();
    let t = 0;
    const it = setInterval(() => {
      t += passo;
      let rolando = 0;
      ds.forEach((d, i) => { if (!d.classList.contains('rola')) return; if (t >= dur + i * 110) { d.classList.remove('rola'); d.dataset.v = r.dados[i]; } else { d.dataset.v = dado6(); rolando++; } });
      if (op.som !== false && rolando) CRW.Som.tom(240 + Math.random() * 520, 0, 0.025, 'square', 0.025);
      if (!rolando) { clearInterval(it); fim(); }
    }, passo);
  });
}

/* ---------- a janela do rolador: CRW.rolar({ acao, n, dourado, pc, secreta, nome, npc }) ---------- */
function fonteDe(op) {
  const P = CRW.P;
  if (op.npc && P.mestre) return { tipo: 'npc', id: op.npc, S: (npcAberto && npcAberto.id === op.npc) ? npcAberto.S : normalizarNPC(Segredos.ler(['npcs', op.npc])), gasta: true };
  if (op.pc && op.pc === P.pc && podeEditar()) return { tipo: 'pc', S: fichaAtual(), gasta: true };
  if (op.pc && (P.mestre || P.aux)) { const f = CRW.fichaDoPC(op.pc); return f ? { tipo: 'pcro', S: normalizar(f, op.pc), gasta: false } : null; }
  return null;
}
function abrirRolador(op = {}) {
  const P = CRW.P;
  if (!(P.mestre || P.aux || P.pc)) { aviso('Entre no sistema para rolar dados.', 'erro'); return null; }
  op = { ...op };
  const fonte = fonteDe(op);
  const npc = op.npc ? CRW.npcs().find(x => x.id === op.npc) : null;
  const quem = op.nome || (npc && npc.nome) || (op.pc ? ((fonte && fonte.S.nome) || nomePC(op.pc)) : P.mestre ? 'Guardião da Luz' : P.aux ? (P.nomeAux || 'Auxiliar') : ((FX.F && FX.F.nome) || nomePC(P.pc)));
  const a0 = op.acao ? acaoPor(op.acao) : null;
  const st = {
    a: a0 ? a0.id : '', rot: (!a0 && op.acao) ? String(op.acao).slice(0, 40) : '',
    n: op.n != null ? clamp(int(op.n, 0), 0, 12) : (a0 && fonte ? fonte.S.acoes[a0.id] : 1),
    imp: 0, dour: op.dourado != null ? !!op.dourado : !!(a0 && fonte && fonte.S.dourado[a0.id]),
    extra: !!ls.get('fxDourExtra', false), sec: P.mestre ? (op.secreta != null ? !!op.secreta : !!op.npc) : false,
  };
  const w = janela({ id: 'fxRolador', titulo: 'Rolador de Candela · CCSO-21', icone: '⚄', largura: '460px', classe: 'fx-rolwin', html: `<div class="fx-rol">
    <p class="mini">Rolando como <b>${esc(quem)}</b>${fonte && fonte.tipo === 'pcro' ? ' (pelo Guardião; a ficha não muda)' : ''}</p>
    <label class="campo">Ação<select class="w95-input" data-r-acao>
      <option value="">${st.rot ? esc(st.rot) : 'Rolagem avulsa (sem ação)'}</option>
      ${MOTS.map(m => `<optgroup label="${esc(m.nome)}">${ACOES.filter(a => a.mot === m.id).map(a => `<option value="${a.id}"${a.id === st.a ? ' selected' : ''}>${esc(a.nome)}${fonte ? ' · ' + fonte.S.acoes[a.id] + (fonte.S.dourado[a.id] ? ' ★' : '') : ''}</option>`).join('')}</optgroup>`).join('')}
    </select></label>
    <div class="fx-rl"><span>Dados da ação</span><span class="fx-step"><button type="button" class="w95-btn fx-mm" data-r-n="-1" aria-label="Menos um dado">−</button><b data-r-nv></b><button type="button" class="w95-btn fx-mm" data-r-n="1" aria-label="Mais um dado">+</button></span></div>
    <div class="fx-rl" data-r-impbox><span>Impulsos gastos <span class="mini">(+1 dado cada)</span></span><span class="fx-step"><button type="button" class="w95-btn fx-mm" data-r-i="-1" aria-label="Menos um impulso">−</button><b data-r-iv>0</b><button type="button" class="w95-btn fx-mm" data-r-i="1" aria-label="Mais um impulso">+</button></span><span class="mini" data-r-idisp></span></div>
    <label class="chk95"><input type="checkbox" data-r-dour${st.dour ? ' checked' : ''}> <span class="fx-dourtx">★ Dado dourado</span></label>
    <label class="chk95 fx-recuo"><input type="checkbox" data-r-extra${st.extra ? ' checked' : ''}> Somar o dourado como dado extra (em vez de trocar um dado comum)</label>
    ${P.mestre ? `<label class="chk95"><input type="checkbox" data-r-sec${st.sec ? ' checked' : ''}> Rolagem secreta (só você vê; vai para o diário)</label>` : ''}
    <div class="fx-total" data-r-total></div>
    <button type="button" class="w95-btn pri fx-rolarbtn" data-r-ir>ROLAR</button>
    <div class="fx-mesa" data-r-mesa aria-live="polite"></div>
    <div class="fx-rres" data-r-res></div>
    <p class="mini fx-regra">Vale o <b>maior</b> dado: 6 sucesso, 4 ou 5 parcial, 1 a 3 falha. Dois ou mais 6: crítico. Com zero dados, rola 2 e fica com o <b>menor</b>.</p></div>` });
  const mot = () => { const a = ACOES.find(x => x.id === st.a); return a ? a.mot : null; };
  const disp = () => { const m = mot(); return (fonte && m) ? fonte.S.imp[m].v : null; };
  const atual = () => {
    $('[data-r-nv]', w).textContent = st.n;
    const m = mot(), d = disp(), box = $('[data-r-impbox]', w);
    box.hidden = !m;
    if (m) { if (d != null && fonte.gasta) st.imp = Math.min(st.imp, d); $('[data-r-iv]', w).textContent = st.imp; $('[data-r-idisp]', w).textContent = d != null ? `disponíveis: ${d} de ${(MOTS.find(x => x.id === m) || {}).nome}` : ''; }
    else st.imp = 0;
    const base = st.n + st.imp, tot = base + (st.dour && st.extra ? 1 : 0);
    $('[data-r-total]', w).innerHTML = tot <= 0 ? 'Parada: <b>zero dados</b> · rola 2 e fica com o menor'
      : `Parada: <b>${tot} dado${tot > 1 ? 's' : ''}</b>${st.dour ? ' · 1 dourado' : ''}${st.imp ? ` · ${st.imp} de impulso` : ''}`;
    $('[data-r-extra]', w).closest('label').hidden = !st.dour;
  };
  atual();
  w.addEventListener('change', e => {
    const t = e.target;
    if (t.matches('[data-r-acao]')) { st.a = t.value; st.imp = 0; if (fonte && st.a) { st.n = fonte.S.acoes[st.a]; st.dour = !!fonte.S.dourado[st.a]; $('[data-r-dour]', w).checked = st.dour; } atual(); }
    if (t.matches('[data-r-dour]')) { st.dour = t.checked; atual(); }
    if (t.matches('[data-r-extra]')) { st.extra = t.checked; ls.set('fxDourExtra', st.extra); atual(); }
    if (t.matches('[data-r-sec]')) st.sec = t.checked;
  });
  w.addEventListener('click', async e => {
    const bn = e.target.closest('[data-r-n]'); if (bn) { st.n = clamp(st.n + int(bn.dataset.rN), 0, 12); atual(); return; }
    const bi = e.target.closest('[data-r-i]');
    if (bi) { const d = disp(), lim = (d != null && fonte.gasta) ? d : 6; st.imp = clamp(st.imp + int(bi.dataset.rI), 0, lim); if (int(bi.dataset.rI) > 0 && st.imp === lim && d != null && fonte.gasta && d === 0) aviso('Sem impulsos disponíveis nessa motivação.'); atual(); return; }
    const ir = e.target.closest('[data-r-ir]'); if (!ir || ir.disabled) return;
    ir.disabled = true;
    const a = ACOES.find(x => x.id === st.a);
    const r = sortear(st.n + st.imp, st.dour, st.extra);
    const rol = { ts: Date.now(), pc: op.pc || (op.npc ? null : P.pc) || null, nome: quem, acao: a ? a.nome : (st.rot || 'Avulsa'), dados: r.dados, dourado: r.dour, res: r.res, n: r.n, ...agoraH() };
    if (st.imp) rol.imp = st.imp;
    if (r.zero) rol.zero = true;
    if (op.npc) rol.npc = op.npc;
    let id = null;
    if (!st.sec) {
      // a chave entra na lista das minhas antes de gravar (no modo local o aviso chega na hora)
      id = Rede.chave(); minhasRol.add(id);
      Rede.set('rolagens/' + id, rol).catch(() => aviso('O servidor recusou a rolagem pública.', 'erro'));
      if (P.mestre) CRW.diario('rolagem', `${quem} · ${rol.acao}: [${r.dados.join(' ')}] ${RES[r.res]}`);
    } else guardarSecreta(rol);
    // gasta os impulsos da ficha (do jogador ou do NPC)
    if (st.imp && fonte && fonte.gasta && a) gastarImpulso(fonte, a.mot, st.imp);
    st.imp = 0;
    $('[data-r-res]', w).innerHTML = '';
    await animarDados($('[data-r-mesa]', w), r);
    const dv = r.dour.length ? r.dados[r.dour[0]] : null;
    $('[data-r-res]', w).innerHTML = `<div class="fx-rt res-${r.res}">${RES[r.res]}</div>
      <div class="mini">${r.zero ? 'Zero dados: rolou 2 e ficou com o menor' : 'Vale o maior'}: <b>${r.val}</b>${dv != null ? ` · dado dourado: <b>${dv}</b>${dv === r.val ? ' (o dourado ficou com o resultado que vale)' : ''}` : ''}.
      ${st.sec ? 'Rolagem <b>secreta</b>: só você viu; anotada no diário.' : 'Rolagem <b>pública</b>: a mesa inteira viu.'}</div>`;
    CRW.emit('rolagem', { id, ...rol, secreta: st.sec });
    atual(); ir.disabled = false;
  });
  return w;
}
function gastarImpulso(fonte, m, k) {
  if (fonte.tipo === 'pc' && podeEditar()) {
    const F = fichaAtual(); F.imp[m].v = Math.max(0, F.imp[m].v - k); sujar('imp'); salvar();
    if ($('#mod-ficha')) redesenharFicha();
  } else if (fonte.tipo === 'npc' && CRW.P.mestre) {
    fonte.S.imp[m].v = Math.max(0, fonte.S.imp[m].v - k);
    if (npcAberto && npcAberto.id === fonte.id) { npcAberto.S = fonte.S; npcAberto.sujar(); npcAberto.redesenhar(); }
    else Segredos.gravar(['npcs', fonte.id], fonte.S);
  }
}
function guardarSecreta(r) {
  const l = ss.get('fxSec', []); l.push(r); ss.set('fxSec', l.slice(-40));
  CRW.diario('rolagem', `SECRETA · ${r.nome} · ${r.acao}: [${r.dados.join(' ')}] ${RES[r.res]}`);
  desenharRolagens();
}
CRW.rolar = abrirRolador;

/* ---------- rolagens da mesa: histórico, faixa em destaque, holofote ---------- */
const minhasRol = new Set();
let offRol = null, rolCache = {}, rolPrimeira = true, naoVistas = 0;
function ligarRolagens() {
  if (offRol) { offRol(); offRol = null; }
  rolCache = {}; rolPrimeira = true; naoVistas = 0; CRW.badge('rolagens', 0);
  const P = CRW.P; if (!(P.mestre || P.aux || P.pc)) return;
  offRol = Rede.on('rolagens', x => aoRolagens(x || {}), () => {});
}
function aoRolagens(x) {
  const ant = rolCache; rolCache = x;
  if (rolPrimeira) { rolPrimeira = false; desenharRolagens(); return; }
  const novas = Object.entries(x).filter(([id, r]) => r && !ant[id]).map(([id, r]) => ({ id, ...r })).sort((a, b) => num(a.ts) - num(b.ts));
  const holo = Object.entries(x).filter(([id, r]) => r && r.dest && ant[id] && ant[id].dest !== r.dest).map(([id, r]) => ({ id, ...r })).sort((a, b) => num(a.dest) - num(b.dest));
  let mostrar = null;
  novas.forEach(r => {
    if (!minhasRol.has(r.id)) { CRW.emit('rolagem', r); mostrar = r; }
    if (CRW.P.mestre && !minhasRol.has(r.id) && num(r.ts) > ls.get('fxDiarioRol', 0)) { ls.set('fxDiarioRol', num(r.ts)); CRW.diario('rolagem', `${r.nome || '?'} · ${r.acao || ''}: [${lista(r.dados).join(' ')}] ${RES[r.res] || ''}`); }
    if (CRW.moduloAtual() !== 'rolagens' && !minhasRol.has(r.id)) naoVistas++;
  });
  CRW.badge('rolagens', naoVistas);
  if (holo.length) faixa(holo[holo.length - 1], true);
  else if (mostrar) faixa(mostrar, false);
  desenharRolagens();
}
CRW.on('perfil', ligarRolagens);
let faixaT = null;
function faixa(r, holofote) {
  if (CRW.TV) return;
  let f = $('#fxFaixa');
  if (!f) { f = el('div', 'fx-faixa'); f.id = 'fxFaixa'; f.setAttribute('role', 'status'); document.body.appendChild(f); f.addEventListener('click', () => { f.hidden = true; }); }
  const dados = lista(r.dados).map(int), dour = lista(r.dourado).map(int);
  f.className = 'fx-faixa res-' + r.res + (holofote ? ' holofote' : '');
  f.innerHTML = `<div class="fx-ft">${holofote ? '<span class="fx-holo">☼ EM DESTAQUE</span> ' : ''}<b>${esc(r.nome || '?')}</b> · ${esc(r.acao || 'Avulsa')}</div>
    <div class="fx-fd"></div><div class="fx-fr">${RES[r.res] || ''}</div><div class="fx-fx">toque para fechar</div>`;
  f.hidden = false;
  const v = r.zero ? Math.min(...dados) : Math.max(...dados);
  animarDados($('.fx-fd', f), { dados, dour, res: r.res, val: v }, { rapido: true, som: true });
  if (holofote) CRW.Som.tom(880, 0, 0.5, 'triangle', 0.05);
  clearTimeout(faixaT); faixaT = setTimeout(() => { f.hidden = true; }, holofote ? 9000 : 6000);
}
function htmlRol(r, grande) {
  const dados = lista(r.dados).map(int), dour = lista(r.dourado).map(int);
  const v = r.zero ? Math.min(...dados) : Math.max(...dados);
  return `<span class="fx-dados${grande ? '' : ' mini'}">${dados.map((d, i) => htmlDado(d, dour.includes(i), d === v ? 'vale' : 'fora')).join('')}</span>`;
}
function desenharRolagens() {
  const sec = $('#mod-rolagens'); if (!sec) return;
  const l = Object.entries(rolCache || {}).filter(([, r]) => r).map(([id, r]) => ({ id, ...r })).sort((a, b) => num(b.ts) - num(a.ts));
  const ult = l.slice().sort((a, b) => Math.max(num(b.ts), num(b.dest)) - Math.max(num(a.ts), num(a.dest)))[0];
  const M = CRW.P.mestre;
  $('[data-rl-ult]', sec).innerHTML = ult ? `<div class="fx-ult res-${esc(ult.res)}${num(ult.dest) >= num(ult.ts) && ult.dest ? ' holofote' : ''}">
      <div class="fx-ft">${ult.dest ? '<span class="fx-holo">☼ EM DESTAQUE</span> ' : ''}<b>${esc(ult.nome || '?')}</b> · ${esc(ult.acao || 'Avulsa')} <span class="mini">${esc(ult.h || '')}</span></div>
      ${htmlRol(ult, true)}<div class="fx-fr">${RES[ult.res] || ''}</div></div>` : '<p class="vazio95">Ninguém rolou ainda.</p>';
  $('[data-rl-lista]', sec).innerHTML = l.slice(0, 60).map(r => `<li class="fx-hl res-${esc(r.res)}${r.dest ? ' holofote' : ''}">
      <span class="fx-hts">${esc(r.h || '')}</span>
      <span class="fx-hq"><b>${esc(r.nome || '?')}</b> · ${esc(r.acao || 'Avulsa')}${r.imp ? ` <span class="mini">(+${int(r.imp)} imp.)</span>` : ''}</span>
      ${htmlRol(r, false)}<span class="etq fx-etq-${esc(r.res)}">${RES[r.res] || ''}</span>
      ${M ? `<button type="button" class="w95-btn fx-holob" data-holo="${esc(r.id)}" title="Pôr esta rolagem em destaque para a mesa">☼ Destaque</button>` : ''}</li>`).join('') || '<li class="vazio95">Sem rolagens.</li>';
  const sb = $('[data-rl-sec]', sec);
  if (sb) {
    const s = ss.get('fxSec', []).slice().reverse();
    sb.innerHTML = s.length ? s.map(r => `<li class="fx-hl res-${esc(r.res)}"><span class="fx-hts">${esc(r.h || '')}</span><span class="fx-hq"><b>${esc(r.nome)}</b> · ${esc(r.acao)}</span>${htmlRol(r, false)}<span class="etq fx-etq-${esc(r.res)}">${RES[r.res]}</span></li>`).join('') : '<li class="vazio95">Nenhuma rolagem secreta nesta sessão.</li>';
  }
}
function renderRolagens(sec) {
  const M = CRW.P.mestre;
  sec.innerHTML = `<div class="panel fx"><div class="panel-h"><h2>Rolagens da mesa</h2><div class="meta">${M ? 'Guardião da Luz' : 'tempo real'}</div></div><div class="panel-b">
      <div class="linha95"><button type="button" class="w95-btn pri" data-rl-abrir>⚄ Abrir o rolador</button>${CRW.P.pc && podeEditar() ? '<button type="button" class="w95-btn" data-rl-ficha>Rolar pela ficha</button>' : ''}</div>
      <p class="mini">Pool de d6, vale o maior: 6 sucesso, 4 ou 5 parcial, 1 a 3 falha; dois ou mais 6, crítico. Com zero dados, rola 2 e fica com o menor. O dado <span class="fx-dourtx">dourado</span> aparece em ouro.</p>
      <h3 class="fx-sub">Última rolagem</h3><div data-rl-ult></div>
      <h3 class="fx-sub">Histórico</h3><ol class="fx-hist" data-rl-lista></ol>
      ${M ? `<div class="linha95"><button type="button" class="w95-btn perigo" data-rl-limpar>Apagar o histórico…</button></div>
        <h3 class="fx-sub">Suas rolagens secretas (só nesta tela)</h3><ol class="fx-hist" data-rl-sec></ol>` : ''}
    </div></div>`;
  sec.addEventListener('click', async e => {
    if (e.target.closest('[data-rl-abrir]')) abrirRolador(CRW.P.pc && podeEditar() ? { pc: CRW.P.pc } : {});
    if (e.target.closest('[data-rl-ficha]')) CRW.abrirModulo('ficha');
    const h = e.target.closest('[data-holo]');
    if (h && CRW.P.mestre) {
      const r = rolCache[h.dataset.holo]; if (!r) return;
      Rede.update('rolagens/' + h.dataset.holo, { dest: Date.now() }).catch(() => aviso('O servidor recusou o destaque.', 'erro'));
      CRW.diario('rolagem', `Destaque na rolagem de ${r.nome || '?'} (${r.acao || ''}): ${RES[r.res] || ''}`);
    }
    if (e.target.closest('[data-rl-limpar]') && CRW.P.mestre && await confirmar('Apagar todo o histórico de rolagens da mesa?\n\nIsso some para todos.')) {
      Rede.set('rolagens', null).catch(() => aviso('O servidor recusou.', 'erro')); CRW.diario('rolagem', 'Histórico de rolagens apagado');
    }
  });
  desenharRolagens();
}

/* =========================================================
   NPCs FICHADOS (painel do Mestre, aba Registro)
   segredos/npcs/<id> = { acoes, dourado, imp, marcas, quer, teme, segredos, ganchos, notas }
   ========================================================= */
let npcAberto = null;
function listaNPCs() { return CRW.npcs().filter(x => x.tipo !== 'viatura'); }
function blocoNPCs(c) {
  let ult = '';
  const desenhar = (forca) => {
    if (!document.body.contains(c) && !forca) return;
    const l = listaNPCs(), fs = Segredos.ler(['npcs']) || {};
    const ass = JSON.stringify([l.map(n => [n.id, n.nome, n.cor, !!n.oculto]), Object.keys(fs)]);
    if (ass === ult && !forca) return; ult = ass;
    c.innerHTML = `<p class="mini">Ficha de cada NPC no padrão de Candela (motivações, ações, impulsos, marcas, o que quer, o que teme, segredos e ganchos). Só você lê: fica na área de segredos do servidor. "Rolar" abre o rolador em nome do NPC (secreta por padrão).</p>
      <div class="fx-npcs">${l.map(n => `<div class="fx-npc"><span class="fx-cor" style="background:${esc(n.cor || '#888')}"></span>
        <span class="fx-npcn"><b>${esc(n.nome)}</b><span class="mini">${n.oculto ? 'oculto' : 'público'}${NPCS_BASE.has(n.id) ? '' : ' · criado no painel'} · ${fs[n.id] ? 'fichado' : 'sem ficha'}</span></span>
        <span class="fx-npcb"><button type="button" class="w95-btn" data-npc-f="${esc(n.id)}">Ficha</button><button type="button" class="w95-btn" data-npc-r="${esc(n.id)}">⚄ Rolar</button></span></div>`).join('') || '<p class="vazio95">Nenhum NPC.</p>'}</div>
      <div class="linha95"><button type="button" class="w95-btn pri" data-npc-novo>+ Novo NPC</button></div>`;
  };
  desenhar(true);
  const fn = () => desenhar(false);
  ['segredos', 'estado', 'privado'].forEach(ev => { const off = CRW.on(ev, () => { if (!document.body.contains(c)) { off(); return; } fn(); }); });
  c.addEventListener('click', e => {
    const f = e.target.closest('[data-npc-f]'); if (f) abrirFichaNPC(f.dataset.npcF);
    const r = e.target.closest('[data-npc-r]'); if (r) { const n = listaNPCs().find(x => x.id === r.dataset.npcR); abrirRolador({ npc: r.dataset.npcR, nome: n ? n.nome : r.dataset.npcR, secreta: true }); }
    if (e.target.closest('[data-npc-novo]')) editarNPC(null);
  });
}
function abrirFichaNPC(id) {
  if (!CRW.P.mestre) return;
  const n = listaNPCs().find(x => x.id === id); if (!n) return aviso('NPC não encontrado.', 'erro');
  const base = NPCS_BASE.has(id);
  const st = { id, S: normalizarNPC(Segredos.ler(['npcs', id])), t: null };
  const w = janela({ id: 'fxNpc', titulo: 'Ficha de NPC · ' + n.nome, icone: '▦', largura: '660px', classe: 'fx-npcwin', html: '<div class="fx-npcf"></div>',
    aoFechar: () => { if (st.t) { clearTimeout(st.t); gravar(); } npcAberto = null; } });
  const corpo = $('.fx-npcf', w);
  const gravar = () => { st.t = null; Segredos.gravar(['npcs', id], copia(st.S)); const e = $('[data-n-st]', w); if (e) { const d = new Date(); e.textContent = `✓ salvo ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`; } };
  const sujarN = () => { clearTimeout(st.t); st.t = setTimeout(gravar, 600); const e = $('[data-n-st]', w); if (e) e.textContent = '● salvando…'; };
  const linhas = t => clamp(String(t || '').split('\n').reduce((n, l) => n + Math.max(1, Math.ceil(l.length / 46)), 0) + 1, 3, 9);
  const txt = (k, rot, ph) => `<label class="campo">${rot}<textarea class="w95-input" rows="${linhas(st.S[k])}" data-n-f="${k}" maxlength="4000"${ph ? ` placeholder="${esc(ph)}"` : ''}>${esc(st.S[k])}</textarea></label>`;
  const desenhar = () => {
    const S = st.S, nn = listaNPCs().find(x => x.id === id) || n;
    corpo.innerHTML = `<div class="fx-npch"><span class="fx-cor" style="background:${esc(nn.cor || '#888')}"></span><b>${esc(nn.nome)}</b> <span class="etq ${nn.oculto ? 'ambar' : 'verde'}">${nn.oculto ? 'oculto' : 'público'}</span> <span class="mini" data-n-st>gravação automática</span></div>
      ${nn.pub ? `<p class="mini"><b>O que a cidade sabe:</b> ${esc(nn.pub)}</p>` : ''}
      ${base ? '' : `<div class="linha95"><button type="button" class="w95-btn" data-n-ed>Editar nome e texto público</button><button type="button" class="w95-btn" data-n-vis>${nn.oculto ? 'Tornar público' : 'Ocultar dos jogadores'}</button><button type="button" class="w95-btn perigo" data-n-del>Apagar NPC</button></div>`}
      <h4 class="fx-sub">Motivações e ações</h4>
      <div class="fx-mots">${MOTS.map(m => `<div class="fx-mot"><div class="fx-mot-h">${esc(m.nome)}</div>
        <div class="fx-imp"><span class="fx-impc">Impulsos <button type="button" class="w95-btn fx-mm" data-nimp="${m.id}" data-d="-1" aria-label="Menos um impulso">−</button><b>${S.imp[m.id].v}</b><button type="button" class="w95-btn fx-mm" data-nimp="${m.id}" data-d="1" aria-label="Mais um impulso">+</button> de <input class="w95-input fx-num" type="number" inputmode="numeric" min="1" max="20" data-nimpmax="${m.id}" value="${S.imp[m.id].max}" aria-label="Máximo de impulsos"></span></div>
        ${ACOES.filter(a => a.mot === m.id).map(a => `<div class="fx-acao${S.dourado[a.id] ? ' dour' : ''}"><span class="fx-an">${esc(a.nome)}</span>${pontos(S.acoes[a.id], S.maxAcao, `data-nset="${a.id}"`, false, a.nome)}
          <button type="button" class="fx-dour${S.dourado[a.id] ? ' on' : ''}" data-ndour="${a.id}" aria-label="Ação dourada">${S.dourado[a.id] ? '★' : '☆'}</button>
          <button type="button" class="w95-btn fx-rolar" data-nrol="${a.id}">Rolar</button></div>`).join('')}</div>`).join('')}</div>
      <div class="linha95 mini"><label>Máximo de pontos por ação <input class="w95-input fx-num" type="number" inputmode="numeric" min="1" max="6" data-nmax value="${S.maxAcao}"></label></div>
      <h4 class="fx-sub">Marcas</h4>
      <div class="fx-marcas">${MARCAS.map(m => `<div class="fx-marca"><span class="fx-mn">${esc(m.nome)}</span><span class="fx-cxs">${[1, 2, 3].map(i => `<button type="button" class="fx-cx${i <= S.marcas[m.id] ? ' on' : ''}" data-nmarca="${m.id}" data-i="${i}" aria-label="${esc(m.nome)} ${i}"></button>`).join('')}</span><span class="fx-mv">${S.marcas[m.id]}/3</span></div>`).join('')}</div>
      <div class="grade2">${txt('quer', 'O que quer')}${txt('teme', 'O que teme')}</div>
      ${txt('segredos', 'Segredos (só o Guardião)')}${txt('ganchos', 'Ganchos para a mesa')}${txt('notas', 'Notas de cena', 'onde estava, o que disse, como reagiu…')}
      <div class="msg-bts"><button type="button" class="w95-btn pri" data-nrol="">⚄ Rolar pelo NPC</button><button type="button" class="w95-btn" data-fechar>Fechar</button></div>`;
  };
  npcAberto = { id, get S() { return st.S; }, set S(v) { st.S = v; }, sujar: sujarN, redesenhar: desenhar };
  desenhar();
  w.addEventListener('input', e => { const t = e.target; if (t.dataset.nF) { st.S[t.dataset.nF] = t.value; sujarN(); } });
  w.addEventListener('change', e => {
    const t = e.target, S = st.S;
    if (t.dataset.nimpmax) { const x = S.imp[t.dataset.nimpmax]; x.max = clamp(int(t.value, MAX_IMP), 1, 20); x.v = Math.min(x.v, x.max); sujarN(); desenhar(); }
    if (t.hasAttribute('data-nmax')) { S.maxAcao = clamp(int(t.value, MAX_ACAO), 1, 6); ACOES.forEach(a => { S.acoes[a.id] = Math.min(S.acoes[a.id], S.maxAcao); }); sujarN(); desenhar(); }
  });
  w.addEventListener('click', async e => {
    const t = e.target, S = st.S;
    const p = t.closest('[data-nset]'); if (p) { const a = p.dataset.nset, i = int(p.dataset.i); S.acoes[a] = S.acoes[a] === i ? i - 1 : i; sujarN(); acenderPts(p.parentElement, S.acoes[a]); return; }
    const d = t.closest('[data-ndour]'); if (d) { S.dourado[d.dataset.ndour] = !S.dourado[d.dataset.ndour]; sujarN(); desenhar(); return; }
    const im = t.closest('[data-nimp]'); if (im) { const x = S.imp[im.dataset.nimp]; x.v = clamp(x.v + int(im.dataset.d), 0, x.max); sujarN(); desenhar(); return; }
    const mc = t.closest('[data-nmarca]'); if (mc) { const m = mc.dataset.nmarca, i = int(mc.dataset.i); S.marcas[m] = S.marcas[m] === i ? i - 1 : i; sujarN(); desenhar(); return; }
    const r = t.closest('[data-nrol]'); if (r) { if (st.t) { clearTimeout(st.t); gravar(); } const nn = listaNPCs().find(x => x.id === id) || n; abrirRolador({ npc: id, nome: nn.nome, acao: r.dataset.nrol || undefined, secreta: true }); return; }
    if (t.closest('[data-n-ed]')) { editarNPC(id); return; }
    if (t.closest('[data-n-vis]')) { const nn = listaNPCs().find(x => x.id === id); if (nn) { moverNPC(nn, !nn.oculto); setTimeout(desenhar, 50); } return; }
    if (t.closest('[data-n-del]')) {
      if (!(await confirmar(`Apagar o NPC ${n.nome}?\n\nSai da lista, do mapa e a ficha dele é apagada.`))) return;
      clearTimeout(st.t); st.t = null;
      Estado.definir(['npcs', id], null); CRW.Priv.gravar(['npcs', id], null); Segredos.gravar(['npcs', id], null);
      CRW.diario('mesa', 'NPC apagado: ' + n.nome); npcAberto = null; fecharJanela('fxNpc');
    }
  });
}
function dadosPublicosNPC(n) { return { nome: n.nome, curto: n.curto || '', cor: n.cor || '#888888', pub: n.pub || '', tipo: 'npc' }; }
function moverNPC(n, ocultar) {
  const d = dadosPublicosNPC(n);
  if (ocultar) { CRW.Priv.gravar(['npcs', n.id], d); Estado.definir(['npcs', n.id], null); }
  else { Estado.definir(['npcs', n.id], d); CRW.Priv.gravar(['npcs', n.id], null); }
  CRW.diario('mesa', `NPC ${ocultar ? 'ocultado' : 'publicado'}: ${n.nome}`);
}
function editarNPC(id) {
  const n = id ? listaNPCs().find(x => x.id === id) : null;
  const p = n || { nome: '', curto: '', cor: '#6f6f6f', pub: '', oculto: false };
  const w = janela({ id: 'fxNpcEd', titulo: id ? 'Editar NPC' : 'Novo NPC', icone: '▦', largura: '440px', html: `
    <label class="campo">Nome completo<input class="w95-input" data-e="nome" value="${esc(p.nome)}" maxlength="60"></label>
    <div class="grade2"><label class="campo">Nome curto (peça do mapa)<input class="w95-input" data-e="curto" value="${esc(p.curto || '')}" maxlength="14"></label>
    <label class="campo">Cor<input class="w95-input" type="color" data-e="cor" value="${esc(/^#[0-9a-f]{6}$/i.test(p.cor || '') ? p.cor : '#6f6f6f')}"></label></div>
    <label class="campo">O que a cidade sabe (texto público)<textarea class="w95-input" rows="3" data-e="pub" maxlength="600">${esc(p.pub || '')}</textarea></label>
    ${id ? '' : `<label class="chk95"><input type="radio" name="fxVis" value="pub" checked> Público: os jogadores veem o nome e o texto público</label>
    <label class="chk95"><input type="radio" name="fxVis" value="oc"> Oculto: só o Guardião e os auxiliares veem</label>`}
    <p class="mini">Segredos do NPC não vão aqui: escreva na ficha dele (só você lê).</p>
    <div class="msg-bts"><button type="button" class="w95-btn pri" data-ok>Salvar</button><button type="button" class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', () => {
    const g = k => ($(`[data-e="${k}"]`, w).value || '').trim();
    const nome = g('nome'); if (!nome) return aviso('Dê um nome ao NPC.', 'erro');
    const d = { nome, curto: g('curto') || nome.split(/\s+/)[0].slice(0, 14), cor: g('cor'), pub: g('pub'), tipo: 'npc' };
    if (id) { if (n.oculto) CRW.Priv.gravar(['npcs', id], d); else Estado.definir(['npcs', id], d); CRW.diario('mesa', 'NPC editado: ' + nome); }
    else {
      let nid = slug(nome); while (CRW.ser(nid) || NPCS_BASE.has(nid)) nid = slug(nome).slice(0, 12) + Date.now().toString(36).slice(-3);
      const oc = ($('input[name="fxVis"]:checked', w) || {}).value === 'oc';
      if (oc) CRW.Priv.gravar(['npcs', nid], d); else Estado.definir(['npcs', nid], d);
      CRW.diario('mesa', `NPC criado (${oc ? 'oculto' : 'público'}): ${nome}`);
    }
    fecharJanela('fxNpcEd');
    if (npcAberto && npcAberto.id === id) setTimeout(() => npcAberto && npcAberto.redesenhar(), 60);
    aviso('NPC salvo.');
  });
}

/* =========================================================
   REGISTROS NO NÚCLEO
   ========================================================= */
CRW.registrarModulo({ id: 'ficha', titulo: 'Minha ficha', grupo: 'pessoal', icone: '▤', ordem: 10, visivel: v => !!v.pc, render: renderFicha,
  aoAbrir: () => { if (FX.pendente) redesenharFicha(); } });
CRW.registrarModulo({ id: 'fichas', titulo: 'Fichas dos investigadores', grupo: 'mestre', icone: '▤', ordem: 20, visivel: v => !!(v.mestre || v.aux), render: renderFichas });
CRW.registrarModulo({ id: 'rolagens', titulo: 'Rolagens da mesa', grupo: 'investigacao', icone: '⚄', ordem: 90, visivel: v => !!(v.mestre || v.aux || v.pc), render: renderRolagens,
  aoAbrir: () => { naoVistas = 0; CRW.badge('rolagens', 0); } });
CRW.registrarMestre({ id: 'npcs-ficha', aba: 'registro', titulo: 'NPCs fichados (padrão Candela)', ordem: 20, render: blocoNPCs });

CRW.registrarRestauracao({ id: 'rolagens-tela', nome: 'Rolagens secretas guardadas na tela do Mestre', padrao: true, fazer: async () => { ss.set('fxSec', []); desenharRolagens(); } });
CRW.registrarRestauracao({ id: 'npcs-criados', nome: 'NPCs criados no painel (os NPCs da cidade e as fichas de NPC ficam)', padrao: false, estado: ['npcs'], priv: ['npcs'] });
CRW.on('restaurado', () => { naoVistas = 0; CRW.badge('rolagens', 0); const f = $('#fxFaixa'); if (f) f.hidden = true; });

CRW.registrarAjuda({ id: 'ficha', titulo: 'Ficha de Candela', ordem: 30, para: ['todos'], html: `
  <p><b>O que é:</b> a ficha do seu investigador no padrão de Candela Obscura, salva no servidor e sincronizada em tempo real. Fica em "Meu personagem", <b>Minha ficha</b>.</p>
  <p><b>Quem vê:</b> <span class="papel">jog</span> só a própria ficha, e só o dono altera. <span class="papel">mestre</span> <span class="papel">aux</span> veem todas em "Fichas dos investigadores", <b>somente leitura</b>: não existe nenhum botão que altere a ficha de um jogador. No "Ver pelos olhos de", o Guardião também vê a ficha daquele investigador só para ler.</p>
  <p><b>Abas</b> (no celular): Identidade, Ações, Marcas, Iluminação e Equipamento. No computador de tela larga tudo aparece lado a lado.</p>
  <ul>
    <li><b>Identidade:</b> nome, pronomes, Círculo (o nome do grupo), papel e especialidade (escolha da lista ou "Outro" para digitar), estilo e aparência, retrato (a foto é reduzida antes de subir).</li>
    <li><b>Ações:</b> as três motivações, <b>Vigor</b> (Mover, Atacar, Controlar), <b>Astúcia</b> (Influenciar, Ler, Esconder) e <b>Intuição</b> (Avaliar, Focar, Sentir). Toque numa bolinha para marcar pontos; tocar de novo na última acesa apaga uma. Cada motivação tem <b>impulsos</b> (− e +, com máximo editável) e um campo de <b>resistência</b>, se a mesa usar.</li>
    <li><b>Dado dourado:</b> a estrela ★ marca a ação como dourada. Ao rolar essa ação, um dos dados vem em ouro.</li>
    <li><b>Marcas:</b> Corpo, Mente e Sangria, 3 caixas cada. Tocar na caixa <b>4ª</b> pede confirmação e a descrição da <b>cicatriz</b>; a cicatriz fica na lista e a trilha volta a zero. Também dá para registrar uma cicatriz à mão.</li>
    <li><b>Iluminação:</b> a trilha de crescimento do investigador. Toque nas caixas para marcar.</li>
    <li><b>Habilidades e equipamento:</b> listas com nome e texto. Itens entregues pelo Guardião (almoxarifado, penhores, achados) entram sozinhos no equipamento, com a origem anotada.</li>
  </ul>
  <p><b>Gravação automática:</b> tudo salva sozinho meio segundo depois de mexer. O canto do título mostra "salvando…" e depois "✓ salvo".</p>
  <p><b>Outro aparelho:</b> a ficha está presa a um código secreto guardado no seu aparelho. Toque em <b>Código da ficha</b>, copie e guarde. No celular novo, entre com o mesmo investigador, abra a ficha, toque em "Código da ficha" e cole o código em <b>Usar ficha de outro aparelho</b>. Não passe o código para ninguém.</p>
  <p><b>Exportar e importar:</b> baixa a ficha num arquivo .json (cópia de segurança) e carrega de volta. <b>Imprimir</b> abre a ficha em formulário de impressora matricial (imprimir ou salvar em PDF).</p>
  <p><b>Números a conferir no livro:</b> o máximo de pontos por ação (padrão 3), o máximo de impulsos (padrão 9) e o tamanho da trilha de Iluminação (padrão 12) não foram conferidos no livro da Jambô. Todos são editáveis na própria ficha.</p>` });
CRW.registrarAjuda({ id: 'rolador', titulo: 'Rolador de Candela e Rolagens da mesa', ordem: 31, para: ['todos'], html: `
  <p><b>Como rolar:</b> na ficha, o botão <b>Rolar</b> de cada ação abre o rolador já com os pontos da ação e o dourado. Também há o <b>Rolador avulso</b> (na ficha e em "Rolagens da mesa"). Antes de rolar você ajusta o número de dados com − e +, escolhe quantos <b>impulsos</b> gastar (+1 dado cada; eles saem da ficha na hora) e liga ou desliga o dado dourado.</p>
  <p><b>Regras:</b> rola uma parada de d6 e vale o <b>maior</b> dado. <b>6</b> é sucesso, <b>4 ou 5</b> parcial, <b>1 a 3</b> falha. <b>Dois ou mais 6</b>: crítico. Com <b>zero dados</b>, rola 2 e fica com o <b>menor</b> (sem crítico).</p>
  <p><b>Dado dourado:</b> aparece em ouro, diferente dos outros. Por padrão ele <b>troca</b> um dado comum da parada; se a sua mesa usa o dourado como dado a mais, marque "Somar o dourado como dado extra" (o site lembra a escolha). O efeito exato do dourado deve ser conferido no livro.</p>
  <p><b>Rolagem pública:</b> toda a mesa vê uma faixa grande no alto da tela por alguns segundos, e a rolagem fica no histórico de <b>Rolagens da mesa</b>.</p>
  <p><span class="papel">mestre</span> <b>Rolagem secreta:</b> marque "Rolagem secreta" e ninguém mais vê: o resultado fica na sua tela, na lista "Suas rolagens secretas" e no diário da sessão. <b>Destaque:</b> no histórico, o botão ☼ Destaque joga uma rolagem de novo na tela de todos, com holofote. O Guardião também pode apagar o histórico.</p>` });
CRW.registrarAjuda({ id: 'npcs-ficha', titulo: 'NPCs fichados (padrão Candela)', ordem: 32, para: ['mestre'], html: `
  <p><b>Onde:</b> painel do Guardião, aba <b>Registro</b>, bloco "NPCs fichados". Só você vê: as fichas moram na área de segredos do servidor (os auxiliares não leem).</p>
  <ul>
    <li><b>Ficha:</b> motivações e ações com pontos (e ★ dourada), impulsos, marcas de Corpo, Mente e Sangria, o que o NPC quer, o que teme, segredos, ganchos e notas de cena. Grava sozinha.</li>
    <li><b>Rolar:</b> abre o rolador em nome do NPC, secreto por padrão. Desmarque "Rolagem secreta" para a mesa ver a rolagem com o nome do NPC. Impulsos gastos saem da ficha do NPC.</li>
    <li><b>Novo NPC:</b> nome, nome curto, cor e o texto público. <b>Público</b>: todos veem o nome e o texto. <b>Oculto</b>: só você e os auxiliares. Depois dá para publicar ou ocultar, editar e apagar (só os criados no painel; os da cidade ficam).</li>
    <li><b>Sementes:</b> as fichas iniciais (Xerife, Wray, Crane, Brandt, Furão, Vossler, Pároco e a garçonete) chegam no arquivo de segredos importado na aba Segredos. Sem o arquivo, o bloco funciona e você ficha cada um à mão.</li>
  </ul>` });

CRW.FichaCandela = { normalizar, normalizarNPC, sortear, avaliar, ACOES, imprimirFicha };
})();
