/* =========================================================
   CROWSREST · comunicacao.js
   Itens 22, 29, 30, 31, 32 e 33 do pedido:
   · Tarefas do Círculo (dossiês; o caso 24-1187 é a Tarefa 1)
   · Pager, secretária eletrônica e rádio da polícia (e a Caixa de mensagens)
   · Crowsrest Sentinel diário (edições, editor do Mestre, marcas do grupo)
   · Quadro de suspeitos
   · Acusação final da Tarefa (voto secreto até o Mestre encerrar)
   · Relatório de Investigação em PDF (Formulário CCSO-27)
   Nada de segredo neste arquivo: os títulos das próximas tarefas, os
   rascunhos do jornal e os modelos de mensagem do Mestre moram em
   segredos/ (chegam pelo arquivo de sementes, fora do GitHub).
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, copia, ls, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela, Som } = CRW;
const P = CRW.P;
const S = () => Estado.get() || {};
const agora = () => Date.now();
const appVisivel = () => { const a = $('#app'); return !!a && !a.classList.contains('hidden'); };
const logado = () => !!(P.pc || P.mestre || P.aux);

/* ---------- utilidades ---------- */
// ouvinte de evento que se desliga sozinho quando o elemento sai da tela
function vivoOn(ev, elm, fn) { const off = CRW.on(ev, x => { if (!document.body.contains(elm)) { off(); return; } fn(x); }); return off; }
// redesenha só quando a fatia do estado muda (o evento "estado" dispara a cada passo de peça no mapa)
function quandoMuda(elm, pegar, fn) {
  let ult = JSON.stringify(pegar(S()) || null);
  return vivoOn('estado', elm, s => { const j = JSON.stringify(pegar(s || {}) || null); if (j !== ult) { ult = j; fn(); } });
}
// assinaturas de dados protegidos: uma por nome, desligadas quando o perfil muda
const subs = {};
function assinar(nome, caminho, cb) { desassinar(nome); subs[nome] = Rede.on(caminho, cb, () => {}); return subs[nome]; }
function desassinar(nome) { if (subs[nome]) { try { subs[nome](); } catch (e) {} delete subs[nome]; } }
CRW.on('perfil', () => Object.keys(subs).forEach(desassinar));

function quemSou() { if (P.mestre) return 'Guardião da Luz'; if (P.aux) return P.nomeAux || 'Auxiliar'; const p = CRW.pc(P.pc); return p ? p.nome : (P.pc || '?'); }
function dataJogo() { const r = CRW.relogio(); return `${r.data} ${pad2(r.h)}:${pad2(r.m)}`; }
const idData = d => String(d || '').replace(/\D/g, '');
const ordId = id => { id = String(id); return id.slice(4, 8) + id.slice(2, 4) + id.slice(0, 2); };
const dataDeId = id => { id = String(id); return `${id.slice(0, 2)}/${id.slice(2, 4)}/${id.slice(4, 8)}`; };
const semAcento = t => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const tiraTags = h => String(h || '').replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ');
// texto do Mestre: escapado, com **negrito** e quebras de linha
const md = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>');
const ordDataHora = t => { const m = String(t || '').match(/(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/); return m ? `${m[3]}${m[2]}${m[1]}${m[4] || '00'}${m[5] || '00'}` : '0'; };
const SILHUETA = '<svg viewBox="0 0 100 130" aria-hidden="true"><path fill="#6a7890" d="M50 22c-13 0-22 10-22 24 0 9 4 16 9 20-10 4-21 13-24 27-1 5-1 9-1 9h76s0-4-1-9c-3-14-14-23-24-27 5-4 9-11 9-20 0-14-9-24-22-24z"/></svg>';
const lotes = () => (typeof LOTES !== 'undefined' ? LOTES : []);
const nomeLote = id => (lotes().find(l => l.id === id) || {}).nome || id || '';

/* ---------- camada dos efeitos (aparelhos e carimbos), um de cada vez ---------- */
function camada() { let c = $('#cm-camada'); if (!c) { c = el('div', 'cm-camada'); c.id = 'cm-camada'; document.body.appendChild(c); } return c; }
const fila = []; let tocando = false;
function enfileirar(fn) { fila.push(fn); if (!tocando) proxima(); }
function proxima() {
  const fn = fila.shift(); if (!fn) { tocando = false; return; }
  tocando = true; let feito = false;
  const fim = () => { if (feito) return; feito = true; setTimeout(proxima, 260); };
  try { fn(fim); } catch (e) { console.warn('efeito:', e); fim(); }
}
function carimbo(txt, sub, cor, fim) {
  Som.tom(90, 0, 0.3, 'sine', 0.25); Som.ruido(0, 0.2, 0.12, 500, 'lowpass');
  const f = el('div', 'cm-fundo cm-car-fundo');
  f.innerHTML = `<div class="cm-carimbo ${cor || 'verm'}" role="status"><div class="cm-car-t">${esc(txt)}</div>${sub ? `<div class="cm-car-s">${esc(sub)}</div>` : ''}<div class="cm-car-x">toque para fechar</div></div>`;
  camada().appendChild(f);
  let feito = false;
  const fechar = () => { if (feito) return; feito = true; f.classList.add('cm-sai'); setTimeout(() => f.remove(), 230); fim && fim(); };
  f.addEventListener('click', fechar); setTimeout(fechar, 5200);
}

/* =========================================================
   22 · TAREFAS (dossiês)
   estado/tarefas = { atual, lista: { <id>: { n, titulo, resumo, status, concluidaEm, abertaEm } },
                      carimbo: { n, titulo, ts }, situacao, situacaoCor, mostrarLacrado }
   segredos/tarefas/<id> = { n, titulo, resumo, notaMestre }  (sementes do Mestre)
   Dossiê "bloqueada" fica sem título no estado público: só o número aparece.
   ========================================================= */
const T1 = { n: 1, titulo: 'O Chevette', resumo: '', status: 'aberta' };
const STATUS_T = { aberta: ['EM ANDAMENTO', 'ambar'], concluida: ['CONCLUÍDA', 'verde'], bloqueada: ['LACRADA', 'verm'] };
function tarefas() {
  const t = S().tarefas;
  if (t && t.lista && Object.keys(t.lista).length) return { mostrarLacrado: true, ...copia(t) };
  return { atual: 't1', lista: { t1: { ...T1 } }, mostrarLacrado: true, padrao: true };
}
function ordenadas(t) { t = t || tarefas(); return Object.entries(t.lista || {}).filter(([, x]) => x).map(([id, x]) => ({ id, ...x })).sort((a, b) => num(a.n) - num(b.n)); }
function tarefaAtual(t) {
  t = t || tarefas(); const l = ordenadas(t);
  return l.find(x => x.id === t.atual && x.status !== 'bloqueada') || l.filter(x => x.status === 'aberta').pop() || l.filter(x => x.status === 'concluida').pop() || null;
}
function situacao() {
  const t = tarefas(), at = tarefaAtual(t), ac = S().acusacao || {};
  if (ac.aberta) return ['Acusação em votação', 'alert'];
  if (t.situacao) return [t.situacao, t.situacaoCor || 'open'];
  if (at && at.status === 'concluida') return [`Tarefa ${at.n} concluída`, 'ok'];
  return [(typeof CASO !== 'undefined' && CASO.situacao) || 'Em investigação', 'open'];
}
function atualizarCabecalho() {
  const at = tarefaAtual();
  const ct = $('#chTarefa'); if (ct) ct.textContent = at ? `${at.n} · ${at.titulo || 'Dossiê lacrado'}` : 'Sem tarefa';
  const cs = $('#chSituacao'); if (cs) { const [txt, cor] = situacao(); cs.textContent = txt; cs.className = 'chip ' + cor; }
}
CRW.on('estado', atualizarCabecalho); CRW.on('entrou', atualizarCabecalho);

// carimbo "CONCLUÍDA" para todos
let carVisto = num(ls.get('cmCarimbo', 0)), acVista = num(ls.get('cmAcusAberta', 0)), verVisto = num(ls.get('cmVeredito', 0));
function vigiarCarimbos() {
  if (!appVisivel()) return;
  const c = (S().tarefas || {}).carimbo;
  if (c && num(c.ts) > carVisto) {
    carVisto = num(c.ts); ls.set('cmCarimbo', carVisto);
    if (agora() - carVisto < 3 * 60000) enfileirar(fim => carimbo('CONCLUÍDA', `Tarefa ${int(c.n)} · ${c.titulo || ''}`, 'verm', fim));
  }
  const a = S().acusacao || {};
  if (a.aberta && num(a.ts) > acVista) {
    acVista = num(a.ts); ls.set('cmAcusAberta', acVista);
    if (agora() - num(a.ts) < 3 * 60000 && !P.mestre) enfileirar(fim => { Som.sirene(); carimbo('ACUSAÇÃO ABERTA', 'Votem: QUEM, COMO e ONDE (menu: Acusação final)', 'azul', fim); });
  }
  const r = a.resultado;
  if (r && num(r.ts) > verVisto) {
    verVisto = num(r.ts); ls.set('cmVeredito', verVisto);
    if (agora() - num(r.ts) < 3 * 60000) { const [t, cor] = VEREDITO(r.certo); enfileirar(fim => carimbo(t, 'Veredito da acusação · ' + (r.quem || ''), cor, fim)); }
  }
}
CRW.on('estado', vigiarCarimbos); CRW.on('entrou', () => setTimeout(vigiarCarimbos, 300));

function fichaT1() {
  const pi = (CASO.pessoaInteresse && CASO.pessoaInteresse.campos) || [];
  const nomePI = ((pi.find(c => c[0] === 'Nome') || [])[1] || '') + (pi.find(c => c[0] === 'Vulgo') ? ', ' + pi.find(c => c[0] === 'Vulgo')[1] : '');
  return `<div class="grid2 cm-t1">${[['Caso', CASO.numero], ['Classificação', CASO.classificacao], ['Aberto em', CASO.aberto], ['Responsável inicial', CASO.responsavel], ['Itens de evidência', String((CASO.evidencias || []).length)], ['Pessoa de interesse', nomePI]].map(([l, v]) => `<div class="f"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>`;
}
function acusacoesDe(idT) { return Object.entries(S().acusacoes || {}).map(([id, a]) => ({ id, ...a })).filter(a => a && a.tarefa === idT).sort((a, b) => num(a.ts) - num(b.ts)); }
function linhaAcus(a) {
  const r = a.resultado;
  const [t, cor] = r ? VEREDITO(r.certo) : ['SEM VEREDITO', ''];
  return `<div class="cm-acl"><span class="etq ${cor}">${esc(t)}</span> <span class="mini">${esc(a.dataJogo || '')}</span>${r ? `<div class="cm-acl-t"><b>Quem:</b> ${esc(r.quem || '?')} · <b>Como:</b> ${esc(r.como || '?')} · <b>Onde:</b> ${esc(r.onde || '?')}</div>${r.texto ? `<div class="cm-acl-t dim">${md(r.texto)}</div>` : ''}` : `<div class="cm-acl-t dim">${Object.keys(a.votos || {}).length} voto(s) registrados.</div>`}</div>`;
}
function pasta(x, sel, atual) {
  const lac = x.status === 'bloqueada';
  const st = lac ? 'Aguardando liberação' : x.status === 'concluida' ? 'Concluída ' + (x.concluidaEm ? 'em ' + x.concluidaEm : '') : atual ? 'Tarefa atual' : 'Em andamento';
  return `<button class="cm-pasta ${esc(x.status)}${sel ? ' sel' : ''}" data-t="${esc(x.id)}" aria-pressed="${sel}">
    <span class="cm-pasta-aba">DOSSIÊ Nº ${int(x.n)}</span>
    <span class="cm-pasta-corpo">
      <span class="cm-pasta-tit">${lac ? '<span class="cm-tarja">██████████</span>' : esc(x.titulo || '')}</span>
      <span class="cm-pasta-st">${esc(st)}</span>
      ${x.status === 'concluida' ? '<span class="cm-pasta-car">CONCLUÍDA</span>' : ''}
      ${lac ? '<span class="cm-lacre" aria-hidden="true"></span><span class="cm-fita">LACRADO</span>' : ''}
    </span></button>`;
}
function dossie(x) {
  if (!x) return '';
  if (x.status === 'bloqueada') return `<div class="cm-folha cm-folha-lac"><div class="cm-folha-cab"><span>DOSSIÊ Nº ${int(x.n)}</span><span class="etq verm">LACRADO</span></div><p class="tx">Este dossiê ainda está lacrado. O lacre é rompido pelo Guardião da Luz quando a tarefa anterior for concluída ou quando chegar a hora.</p></div>`;
  const t1 = x.id === 't1', [stx, stc] = STATUS_T[x.status] || ['', ''];
  const ac = S().acusacao || {};
  return `<div class="cm-folha">
    <div class="cm-folha-cab"><span>DOSSIÊ Nº ${int(x.n)} · TAREFA ${int(x.n)}</span><span class="etq ${stc}">${stx}</span></div>
    <h3 class="cm-folha-tit">${esc(x.titulo || '')}</h3>
    <div class="cm-folha-txt">${x.resumo ? md(x.resumo) : t1 ? CASO.resumo.lead : '<span class="dim">Sem resumo.</span>'}</div>
    ${t1 ? fichaT1() : ''}
    <p class="mini">${x.abertaEm ? 'Aberta em ' + esc(x.abertaEm) + '. ' : ''}${x.status === 'concluida' && x.concluidaEm ? 'Concluída em ' + esc(x.concluidaEm) + '.' : ''}</p>
    <div class="cm-sub">Acusações deste dossiê</div>
    ${acusacoesDe(x.id).map(linhaAcus).join('') || '<p class="vazio95">Nenhuma acusação registrada.</p>'}
    <div class="linha95"><button class="w95-btn" data-rel>Relatório de Investigação (PDF)</button>${ac.aberta && ac.tarefa === x.id ? '<button class="w95-btn pri" data-abre="acusacao">Votar na acusação</button>' : ''}</div>
  </div>`;
}
let tarefaSel = null;
function telaTarefas(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Tarefas do Círculo · Dossiês</h2><div class="meta">Caso ${esc(CASO.numero)}</div></div><div class="panel-b">
    <p class="mini">Cada tarefa é um dossiê. O caso ${esc(CASO.numero)} é a Tarefa 1. Quando uma tarefa é concluída, o Guardião da Luz rompe o lacre do próximo dossiê. Toque numa pasta para ler.</p>
    <div class="cm-arquivo" data-arq></div><div data-dos></div></div></div>`;
  const desenhar = () => {
    const t = tarefas(), l = ordenadas(t), at = tarefaAtual(t);
    const itens = l.slice();
    if (t.mostrarLacrado !== false && !l.some(x => x.status === 'bloqueada')) itens.push({ id: '_prox', n: l.reduce((m, x) => Math.max(m, num(x.n)), 0) + 1, status: 'bloqueada' });
    if (!tarefaSel || !itens.some(x => x.id === tarefaSel)) tarefaSel = at ? at.id : (itens[0] || {}).id;
    $('[data-arq]', sec).innerHTML = itens.map(x => pasta(x, x.id === tarefaSel, at && x.id === at.id)).join('');
    $('[data-dos]', sec).innerHTML = dossie(itens.find(x => x.id === tarefaSel));
  };
  desenhar();
  quandoMuda(sec, s => [s.tarefas, s.acusacoes, s.acusacao && s.acusacao.aberta], () => { if (tarefaSel === '_prox' || !(tarefas().lista || {})[tarefaSel]) tarefaSel = null; desenhar(); });
  sec.addEventListener('click', e => {
    const p = e.target.closest('[data-t]'); if (p) { tarefaSel = p.dataset.t; Som.clique(); desenhar(); $('[data-dos]', sec).scrollIntoView({ block: 'nearest', behavior: 'smooth' }); }
    if (e.target.closest('[data-rel]')) relatorio();
  });
}

/* ---- painel do Mestre: tarefas ---- */
const sementesT = () => Segredos.ler(['tarefas']) || {};
function proximaSemente(t, n) {
  const sd = sementesT();
  return Object.entries(sd).map(([id, x]) => ({ id, ...x })).filter(x => x && num(x.n) > num(n) && !['aberta', 'concluida'].includes(((t.lista || {})[x.id] || {}).status)).sort((a, b) => num(a.n) - num(b.n))[0] || null;
}
function blocoTarefasM(c) {
  const desenhar = () => {
    const t = tarefas(), sd = sementesT();
    const ids = [...new Set(['t1', ...Object.keys(sd), ...Object.keys(t.lista || {})])];
    const linhas = ids.map(id => { const pub = (t.lista || {})[id] || null, s = sd[id] || (id === 't1' ? T1 : {}); return { id, pub, s, n: num((pub && pub.n) || s.n, 99) }; }).sort((a, b) => a.n - b.n);
    c.innerHTML = `<p class="mini">Os jogadores só veem o título de uma tarefa quando você abre o dossiê. "Mostrar lacrada" põe a pasta na tela sem título. Concluir mostra o carimbo CONCLUÍDA em todas as telas e pode abrir o próximo dossiê. Os títulos das próximas tarefas vêm das sementes (aba Segredos) ou de "+ Nova tarefa".</p>
      ${t.padrao ? '<p class="mini"><b>Ainda sem progresso salvo:</b> o site mostra a Tarefa 1 aberta por padrão.</p>' : ''}
      ${linhas.map(L => {
        const st = L.pub ? L.pub.status : 'oculta', tit = (L.pub && L.pub.titulo) || L.s.titulo || '(sem título)', atual = (tarefaAtual(t) || {}).id === L.id;
        const [stx, stc] = st === 'oculta' ? ['NÃO LIBERADA', ''] : (STATUS_T[st] || ['?', '']);
        return `<div class="cm-tm"><div class="cm-tm-cab"><b>Nº ${int(L.n)} · ${esc(tit)}</b> <span class="etq ${stc}">${stx}</span>${atual ? ' <span class="etq azul">ATUAL</span>' : ''}</div>
          ${L.s.notaMestre ? `<div class="mini cm-tm-nota">Só você lê: ${esc(L.s.notaMestre)}</div>` : ''}
          <div class="linha95">
          ${st === 'oculta' ? `<button class="w95-btn" data-tm="lacrar" data-id="${esc(L.id)}">Mostrar lacrada</button>` : ''}
          ${st === 'oculta' || st === 'bloqueada' ? `<button class="w95-btn pri" data-tm="abrir" data-id="${esc(L.id)}">Abrir dossiê</button>` : ''}
          ${st === 'aberta' ? `<button class="w95-btn pri" data-tm="concluir" data-id="${esc(L.id)}">Concluir…</button>` : ''}
          ${st === 'aberta' && !atual ? `<button class="w95-btn" data-tm="atual" data-id="${esc(L.id)}">Tornar atual</button>` : ''}
          ${st === 'concluida' ? `<button class="w95-btn" data-tm="reabrir" data-id="${esc(L.id)}">Reabrir</button>` : ''}
          <button class="w95-btn" data-tm="editar" data-id="${esc(L.id)}">Editar</button>
          ${st !== 'oculta' && L.id !== 't1' ? `<button class="w95-btn perigo" data-tm="ocultar" data-id="${esc(L.id)}">Tirar da tela</button>` : ''}
          </div></div>`;
      }).join('')}
      <div class="linha95"><button class="w95-btn" data-tm="nova">+ Nova tarefa</button></div>
      <div class="cm-sub">Cabeçalho do caso</div>
      <div class="grade2"><label class="campo">Situação (vazio = automática)<input class="w95-input" data-tm-sit value="${esc(t.situacao || '')}" maxlength="40" placeholder="ex.: Arquivado pelo gabinete"></label>
      <label class="campo">Cor<select class="w95-input" data-tm-cor>${[['open', 'Âmbar'], ['alert', 'Vermelho'], ['ok', 'Verde'], ['cold', 'Azul']].map(([v, n]) => `<option value="${v}"${(t.situacaoCor || 'open') === v ? ' selected' : ''}>${n}</option>`).join('')}</select></label></div>
      <div class="linha95"><button class="w95-btn" data-tm="sit">Aplicar situação</button><span class="mini">Automática: "Em investigação", "Acusação em votação" ou "Tarefa N concluída".</span></div>
      <label class="chk95"><input type="checkbox" data-tm-lac ${t.mostrarLacrado !== false ? 'checked' : ''}> Mostrar aos jogadores o próximo dossiê como pasta lacrada (sem título)</label>`;
  };
  desenhar();
  quandoMuda(c, s => s.tarefas, () => { if (!c.querySelector('input:focus, select:focus')) desenhar(); });
  vivoOn('segredos', c, () => { if (!c.querySelector('input:focus, select:focus')) desenhar(); });
  c.addEventListener('click', e => { const b = e.target.closest('[data-tm]'); if (b) acaoTarefa(b.dataset.tm, b.dataset.id, c); });
  c.addEventListener('change', e => { if (e.target.matches('[data-tm-lac]')) { const t = tarefas(); delete t.padrao; t.mostrarLacrado = e.target.checked; Estado.definir(['tarefas'], t); } });
}
async function acaoTarefa(op, id, c) {
  const t = tarefas(); delete t.padrao; t.lista = t.lista || {};
  if (op === 'nova') return editarTarefa(null);
  if (op === 'editar') return editarTarefa(id);
  if (op === 'concluir') return concluirTarefa(id);
  if (op === 'sit') { t.situacao = ($('[data-tm-sit]', c).value || '').trim() || null; t.situacaoCor = $('[data-tm-cor]', c).value; await Estado.definir(['tarefas'], t); aviso('Situação aplicada.'); return; }
  const sd = Segredos.ler(['tarefas', id]) || (id === 't1' ? T1 : {}), pub = t.lista[id];
  const n = num((pub && pub.n) || sd.n, ordenadas(t).length + 1);
  if (op === 'lacrar') { t.lista[id] = { n, status: 'bloqueada' }; CRW.diario('tarefa', `Dossiê ${n} mostrado lacrado`); }
  if (op === 'abrir') {
    const titulo = sd.titulo || (pub && pub.titulo) || 'Tarefa ' + n;
    if (!(await confirmar(`Abrir o dossiê ${n} · ${titulo}?\n\nOs jogadores passam a ver o título e o resumo.`))) return;
    t.lista[id] = { n, titulo, resumo: sd.resumo || (pub && pub.resumo) || '', status: 'aberta', abertaEm: dataJogo() }; t.atual = id;
    CRW.diario('tarefa', `Dossiê aberto: Tarefa ${n} · ${titulo}`);
  }
  if (op === 'atual') t.atual = id;
  if (op === 'reabrir') { t.lista[id] = { ...pub, status: 'aberta' }; delete t.lista[id].concluidaEm; t.atual = id; CRW.diario('tarefa', `Tarefa ${n} reaberta`); }
  if (op === 'ocultar') {
    if (!(await confirmar('Tirar este dossiê da tela dos jogadores?\n\nA semente continua guardada com você.'))) return;
    delete t.lista[id]; if (t.atual === id) t.atual = (ordenadas(t).filter(x => x.status === 'aberta').pop() || {}).id || 't1';
  }
  await Estado.definir(['tarefas'], t);
}
function editarTarefa(id) {
  const t = tarefas(), novo = !id;
  if (novo) { const n = Math.max(1, ...ordenadas(t).map(x => num(x.n)), ...Object.values(sementesT()).map(x => num(x && x.n))) + 1; id = 't' + n; while (sementesT()[id] || (t.lista || {})[id]) id += 'b'; }
  const pub = (t.lista || {})[id] || {}, sd = Segredos.ler(['tarefas', id]) || (id === 't1' ? T1 : {});
  const x = { n: num(pub.n || sd.n, num(id.replace(/\D/g, ''), 1)), titulo: pub.titulo || sd.titulo || '', resumo: pub.resumo || sd.resumo || '', notaMestre: sd.notaMestre || '' };
  const w = janela({ titulo: novo ? 'Nova tarefa' : 'Editar tarefa', largura: '480px', html: `
    <div class="grade2"><label class="campo">Número<input class="w95-input" type="number" min="1" data-f="n" value="${int(x.n)}"></label>
    <label class="campo">Título<input class="w95-input" data-f="titulo" value="${esc(x.titulo)}" maxlength="60"></label></div>
    <label class="campo">Resumo do dossiê (os jogadores leem quando o dossiê é aberto; **negrito**)<textarea class="w95-input" rows="5" data-f="resumo">${esc(x.resumo)}</textarea></label>
    <label class="campo">Nota do Guardião (só você lê; nunca vai para a tela dos jogadores)<textarea class="w95-input" rows="4" data-f="notaMestre">${esc(x.notaMestre)}</textarea></label>
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', async () => {
    const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
    const nv = { n: Math.max(1, int(g('n'), 1)), titulo: g('titulo'), resumo: g('resumo'), notaMestre: g('notaMestre') };
    if (!nv.titulo) return aviso('Dê um título à tarefa.', 'erro');
    await Segredos.gravar(['tarefas', id], nv);
    const tt = tarefas();
    if (tt.lista && tt.lista[id]) {
      delete tt.padrao;
      if (tt.lista[id].status === 'bloqueada') tt.lista[id] = { n: nv.n, status: 'bloqueada' };
      else tt.lista[id] = { ...tt.lista[id], n: nv.n, titulo: nv.titulo, resumo: nv.resumo };
      await Estado.definir(['tarefas'], tt);
    }
    fecharJanela(w.parentElement.dataset.jan); aviso('Tarefa salva.');
  });
}
function concluirTarefa(id) {
  const t = tarefas(), x = (t.lista || {})[id]; if (!x) return;
  const prox = proximaSemente(t, x.n);
  const w = janela({ titulo: 'Concluir tarefa', largura: '440px', html: `<p class="tx">Concluir a <b>Tarefa ${int(x.n)} · ${esc(x.titulo)}</b>? Todas as telas (inclusive a TV) mostram o carimbo CONCLUÍDA.</p>
    ${prox ? `<label class="chk95"><input type="radio" name="cmprox" value="abrir" checked> Abrir agora o próximo dossiê (Tarefa ${int(prox.n)} · ${esc(prox.titulo || '')})</label>
      <label class="chk95"><input type="radio" name="cmprox" value="lacrar"> Mostrar o próximo dossiê lacrado (sem título)</label>
      <label class="chk95"><input type="radio" name="cmprox" value="nada"> Não mexer no próximo dossiê</label>` : '<p class="mini">Não há próxima tarefa nas sementes. Crie uma com "+ Nova tarefa" quando quiser.</p>'}
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Concluir</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ok]', w).addEventListener('click', async () => {
    const modo = prox ? ($('input[name=cmprox]:checked', w) || {}).value : 'nada';
    delete t.padrao;
    t.lista[id] = { ...x, status: 'concluida', concluidaEm: dataJogo() };
    t.carimbo = { n: x.n, titulo: x.titulo, ts: agora() };
    if (prox && modo === 'abrir') { t.lista[prox.id] = { n: prox.n, titulo: prox.titulo, resumo: prox.resumo || '', status: 'aberta', abertaEm: dataJogo() }; t.atual = prox.id; }
    if (prox && modo === 'lacrar') t.lista[prox.id] = { n: prox.n, status: 'bloqueada' };
    fecharJanela(w.parentElement.dataset.jan);
    await Estado.definir(['tarefas'], t);
    CRW.diario('tarefa', `Tarefa ${x.n} · ${x.titulo} CONCLUÍDA${prox && modo === 'abrir' ? '; aberto o dossiê ' + prox.n + ' · ' + prox.titulo : ''}`);
  });
}

/* =========================================================
   29 · PAGER, SECRETÁRIA ELETRÔNICA E RÁDIO DA POLÍCIA
   Para um investigador: CRW.entregar(pc, { tipo, de, txt, h, d, distorcida })
   Para todos: estado/transmissao { tipo, de, txt, h, d, ts } (+ histórico em estado/transmissoes)
   Histórico do Mestre: segredos/comunicacao/historico ; modelos: segredos/comunicacao/modelos
   ========================================================= */
const TIPOS = {
  pager: { nome: 'Pager', ico: '▣', de: 'CENTRAL CCSO', dica: 'Pager: texto curto (até umas 80 letras), aparece em MAIÚSCULAS rolando no visor verde, com bipe.' },
  secretaria: { nome: 'Secretária eletrônica', ico: '☎', de: 'Número não identificado', dica: 'Secretária: o telefone toca, a luz pisca "1 mensagem"; o jogador toca "Ouvir" e lê a transcrição. Pode ouvir uma voz do navegador (em português), normal ou distorcida.' },
  radio: { nome: 'Rádio da polícia', ico: '◉', de: 'Central CCSO', dica: 'Rádio: chamado com chiado. Use ~ para pôr um chiado no meio da frase (ex.: "unidade 3 ~ depósitos ~ agora"). Sem ~, o chiado entra sozinho a cada poucas palavras.' },
};
// modelos neutros (os específicos do caso ficam nas sementes do Mestre)
const MODELOS_BASE = [
  { tipo: 'pager', de: 'CENTRAL CCSO', txt: 'RETORNE À DELEGACIA 10-19' },
  { tipo: 'pager', de: '555-0114', txt: 'LIGUE URGENTE' },
  { tipo: 'pager', de: '???', txt: '911 911 911' },
  { tipo: 'secretaria', de: 'Número não identificado', txt: '(Silêncio. Uma respiração do outro lado. A linha cai.)' },
  { tipo: 'secretaria', de: 'Central CCSO', txt: 'Aqui é da central do Departamento do Xerife. Favor comparecer à delegacia assim que ouvir este recado.' },
  { tipo: 'radio', de: 'Central CCSO', txt: 'Central para todas as unidades: ~ neblina densa na Estrada do Vale ~ reduzam a velocidade. Câmbio.' },
  { tipo: 'radio', de: 'Central CCSO', txt: 'Central para unidade mais próxima: ~ ocorrência na Rodovia Hollow Mill. ~ Responda, câmbio.' },
];
const vozLigada = () => ls.get('cmVoz', true) !== false;
function falar(txt, dist) {
  try {
    if (!('speechSynthesis' in window) || !vozLigada()) return;
    const u = new SpeechSynthesisUtterance(String(txt || '').replace(/[~()]/g, ' '));
    u.lang = 'pt-BR';
    const vs = speechSynthesis.getVoices(); const v = vs.find(x => /pt[-_]BR/i.test(x.lang)) || vs.find(x => /^pt/i.test(x.lang)); if (v) u.voice = v;
    if (dist) { u.pitch = 0.1; u.rate = 0.72; } else { u.pitch = 1; u.rate = 0.98; }
    speechSynthesis.speak(u);
  } catch (e) {}
}
function calar() { try { window.speechSynthesis && speechSynthesis.cancel(); } catch (e) {} }
function digitar(alvo, txt, ms, aoFim) {
  const chars = [...String(txt || '')]; let i = 0, vivo = true;
  const passo = chars.length > 220 ? 3 : chars.length > 120 ? 2 : 1;
  const t = setInterval(() => { if (!vivo) return; i += passo; alvo.textContent = chars.slice(0, i).join(''); if (i >= chars.length) { clearInterval(t); vivo = false; aoFim && aoFim(); } }, ms);
  return () => { if (!vivo) return; vivo = false; clearInterval(t); alvo.textContent = chars.join(''); };
}
function aparelho(cls, html, fim, aoFechar) {
  const f = el('div', 'cm-fundo');
  f.innerHTML = `<div class="cm-aparelho ${cls}" role="dialog" aria-modal="true">${html}</div>`;
  camada().appendChild(f);
  let feito = false;
  const fechar = () => { if (feito) return; feito = true; try { aoFechar && aoFechar(); } catch (e) {} f.classList.add('cm-sai'); setTimeout(() => f.remove(), 230); fim && fim(); };
  f.addEventListener('click', e => { if (e.target.closest('[data-cm-ok]')) fechar(); });
  return { f, d: $('.cm-aparelho', f), fechar };
}
function tocarPager(m, fim) {
  const txt = String(m.txt || '').toUpperCase();
  let ts = [];
  const a = aparelho('cm-pager', `
    <div class="cm-rotulo">${m.geral ? 'TRANSMISSÃO GERAL' : 'BIPE RECEBIDO'}</div>
    <div class="cm-pg-caixa">
      <div class="cm-pg-topo"><span>BIP-97 · CCSO</span><span class="cm-pg-led"></span></div>
      <div class="cm-pg-lcd"><div class="cm-pg-l1"><span>${esc(String(m.de || '---').toUpperCase())}</span><span>${esc(m.h || '')}</span></div>
        <div class="cm-pg-rola"><span style="--dur:${Math.max(5, txt.length * 0.3).toFixed(1)}s">${esc(txt)}</span></div></div>
      <div class="cm-pg-bts"><button class="cm-pg-bt" data-ler>LER</button><button class="cm-pg-bt" data-cm-ok>OK</button></div>
    </div>`, fim, () => ts.forEach(clearTimeout));
  const bip = () => { Som.pager(); try { if (navigator.vibrate && navigator.userActivation && navigator.userActivation.hasBeenActive) navigator.vibrate([120, 80, 120, 80, 120]); } catch (e) {} };
  bip(); ts = [setTimeout(bip, 2300), setTimeout(bip, 4600)];
  $('[data-ler]', a.d).addEventListener('click', () => { ts.forEach(clearTimeout); a.d.classList.add('cm-lido'); });
}
function tocarSecretaria(m, fim) {
  let parar = null, voz = vozLigada(), ts = [];
  const a = aparelho('cm-secr', `
    <div class="cm-rotulo">${m.geral ? 'TRANSMISSÃO GERAL' : 'SECRETÁRIA ELETRÔNICA'}</div>
    <div class="cm-sc-caixa">
      <div class="cm-sc-topo">TAM-97 · SECRETÁRIA ELETRÔNICA</div>
      <div class="cm-sc-meio">
        <div class="cm-sc-fita"><span class="cm-sc-rolo"></span><span class="cm-sc-janela"></span><span class="cm-sc-rolo"></span></div>
        <div class="cm-sc-painel"><div class="cm-sc-cont" data-cont>1</div><div class="cm-sc-luz"><i></i><span data-luztxt>1 MENSAGEM</span></div></div>
      </div>
      <div class="cm-sc-trans" data-trans aria-live="polite"><span class="cm-sc-dica">Toque em OUVIR.</span></div>
      <div class="cm-sc-bts"><button class="w95-btn pri" data-play>▶ Ouvir</button><button class="w95-btn" data-voz aria-pressed="${voz}">Voz: ${voz ? 'ligada' : 'desligada'}</button><button class="w95-btn" data-cm-ok>Fechar</button></div>
    </div>`, fim, () => { parar && parar(); calar(); ts.forEach(clearTimeout); });
  const d = a.d;
  Som.telefone(); ts.push(setTimeout(() => Som.telefone(), 1400));
  $('[data-voz]', d).addEventListener('click', e => { voz = !voz; ls.set('cmVoz', voz); e.currentTarget.textContent = 'Voz: ' + (voz ? 'ligada' : 'desligada'); e.currentTarget.setAttribute('aria-pressed', voz); if (!voz) calar(); });
  $('[data-play]', d).addEventListener('click', () => {
    parar && parar(); calar(); ts.forEach(clearTimeout); ts = [];
    d.classList.remove('cm-ouvida'); d.classList.add('cm-tocando');
    const tr = $('[data-trans]', d); tr.innerHTML = '';
    Som.tom(1000, 0, 0.3, 'sine', 0.06);
    const l1 = el('p', 'cm-sc-sis'); tr.appendChild(l1);
    if (voz) falar('Você tem uma nova mensagem.', false);
    parar = digitar(l1, 'Você tem uma nova mensagem.', 34, () => {
      ts.push(setTimeout(() => {
        Som.tom(1400, 0, 0.45, 'sine', 0.07);
        tr.appendChild(el('p', 'cm-sc-de', `${esc(m.d || '')} ${esc(m.h || '')} · De: ${esc(m.de || 'Número não identificado')}`));
        const l2 = el('p', 'cm-sc-txt' + (m.distorcida ? ' cm-distorcida' : '')); tr.appendChild(l2);
        if (voz) falar(m.txt, m.distorcida);
        parar = digitar(l2, String(m.txt || ''), m.distorcida ? 55 : 40, () => {
          d.classList.remove('cm-tocando'); d.classList.add('cm-ouvida');
          $('[data-cont]', d).textContent = '0'; $('[data-luztxt]', d).textContent = 'NENHUMA NOVA';
          $('[data-play]', d).textContent = '▶ Ouvir de novo';
        });
      }, 650));
    });
  });
}
function partesRadio(txt) {
  if (txt.includes('~')) return txt.split('~').map(s => s.trim()).filter(Boolean);
  const pal = txt.split(/\s+/).filter(Boolean), out = []; let i = 0;
  while (i < pal.length) { const n = 5 + Math.floor(Math.random() * 4); out.push(pal.slice(i, i + n).join(' ')); i += n; }
  return out;
}
function transmitir(alvo, txt, aoFim) {
  const partes = partesRadio(String(txt || '')); let vivo = true, parar = null; const ts = [];
  const ir = i => { const s = el('span'); alvo.appendChild(s); parar = digitar(s, partes[i] + ' ', 36, () => prox(i + 1)); };
  const prox = i => {
    if (!vivo) return;
    if (i >= partes.length) { aoFim && aoFim(); return; }
    if (i === 0) return ir(0);
    const ch = el('span', 'cm-chiado', '▒▒░▒░ '); alvo.appendChild(ch);
    Som.ruido(0, 0.5, 0.07, 1300);
    ts.push(setTimeout(() => { ch.classList.add('fim'); ir(i); }, 520));
  };
  prox(0);
  return () => { vivo = false; ts.forEach(clearTimeout); parar && parar(); };
}
function tocarRadio(m, fim) {
  let parar = null;
  const a = aparelho('cm-radio', `
    <div class="cm-rotulo">${m.geral ? 'TRANSMISSÃO GERAL · TODAS AS UNIDADES' : 'RÁDIO DA POLÍCIA'}</div>
    <div class="cm-rd-caixa"><span class="cm-rd-antena" aria-hidden="true"></span>
      <div class="cm-rd-topo"><span>CCSO · CANAL 3</span><span class="cm-rd-led"></span></div>
      <div class="cm-rd-grade" aria-hidden="true"></div>
      <div class="cm-rd-tela"><div class="cm-rd-de">DE: ${esc(String(m.de || 'CENTRAL').toUpperCase())}${m.h ? ' · ' + esc(m.h) : ''}</div><div class="cm-rd-txt" data-txt aria-live="polite"></div></div>
      <div class="cm-rd-bts"><button class="w95-btn" data-rep>Repetir</button><button class="w95-btn pri" data-cm-ok>Câmbio, desligo</button></div>
    </div>`, fim, () => { parar && parar(); });
  const ir = () => {
    parar && parar();
    const alvo = $('[data-txt]', a.d); alvo.innerHTML = '';
    a.d.classList.add('cm-no-ar'); Som.radio();
    parar = transmitir(alvo, m.txt, () => { a.d.classList.remove('cm-no-ar'); Som.radio(); });
  };
  setTimeout(ir, 380);
  $('[data-rep]', a.d).addEventListener('click', ir);
}
function tocar(m, fim) { const f = { pager: tocarPager, secretaria: tocarSecretaria, radio: tocarRadio }[m && m.tipo]; if (!f) return fim && fim(); f(m, fim); }

// no aparelho do jogador: entregas individuais
const jaTocou = new Set();
['pager', 'secretaria', 'radio'].forEach(tipo => CRW.aoEntregar(tipo, m => {
  if (jaTocou.has(m.id)) return; jaTocou.add(m.id);
  badgeMensagens();
  if (agora() - num(m.ts) > 15 * 60000) { aviso('Mensagem nova na sua Caixa de mensagens.'); return; }
  enfileirar(fim => tocar(m, fim));
}));
// transmissão geral: todas as telas, inclusive a TV
let transVista = num(ls.get('cmTransVista', 0)), enviouTs = 0;
function vigiarTransmissao() {
  const t = S().transmissao; if (!t || !t.ts || num(t.ts) <= transVista) return;
  if (!appVisivel()) return;
  transVista = num(t.ts); ls.set('cmTransVista', transVista);
  badgeMensagens();
  if (agora() - num(t.ts) > 3 * 60000 || num(t.ts) === enviouTs) return;
  enfileirar(fim => tocar({ ...t, geral: true }, fim));
}
CRW.on('estado', vigiarTransmissao); CRW.on('entrou', () => setTimeout(vigiarTransmissao, 400));

/* ---- Caixa de mensagens (cada investigador) ---- */
function itensCaixa() {
  const v = CRW.v();
  const meus = (P.pc && !v.espiando ? CRW.caixa() : []).filter(m => m && TIPOS[m.tipo]).map(m => ({ ...m, quando: num(m.ts || m.recebida) }));
  const gerais = Object.entries(S().transmissoes || {}).filter(([, t]) => t && TIPOS[t.tipo]).map(([id, t]) => ({ id, ...t, geral: true, quando: num(t.ts) }));
  return [...meus, ...gerais].sort((a, b) => b.quando - a.quando);
}
function naoLidas() { if (!P.pc) return 0; const lido = num(ls.get('cmLido:' + P.pc, 0)); return itensCaixa().filter(m => m.quando > lido).length; }
function badgeMensagens() { CRW.badge('mensagens', CRW.moduloAtual() === 'mensagens' ? 0 : naoLidas()); }
function marcarLido() { if (P.pc) ls.set('cmLido:' + P.pc, agora()); badgeMensagens(); }
CRW.on('perfil', () => setTimeout(badgeMensagens, 50));
CRW.on('entrega', () => { badgeMensagens(); if (CRW.moduloAtual() === 'mensagens') CRW.emit('cmCaixa'); });
let ultTrans = '';
CRW.on('estado', s => { const j = JSON.stringify(s.transmissoes || null); if (j !== ultTrans) { ultTrans = j; badgeMensagens(); CRW.emit('cmCaixa'); } });
CRW.on('modulo', id => { if (id === 'mensagens') marcarLido(); else badgeMensagens(); });

let lidoAntes = 0;
function telaMensagens(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Caixa de mensagens</h2><div class="meta">pager · secretária · rádio</div></div><div class="panel-b">
    <p class="mini">Tudo o que o Guardião da Luz mandou para você (bipes, recados na secretária eletrônica e chamados de rádio) e as transmissões gerais para todos. Toque numa mensagem para ouvir ou ver de novo.</p>
    <div data-lista></div></div></div>`;
  const desenhar = () => {
    const l = itensCaixa(), v = CRW.v();
    $('[data-lista]', sec).innerHTML = (v.espiando ? '<p class="mini"><b>Vendo pelos olhos:</b> as mensagens individuais ficam guardadas no aparelho do jogador; aqui só aparecem as transmissões gerais.</p>' : '') +
      (l.length ? `<ul class="cm-cx">${l.map((m, i) => `<li><button class="cm-cx-b${m.quando > lidoAntes ? ' nova' : ''}" data-i="${i}">
        <span class="cm-cx-ico t-${esc(m.tipo)}" aria-hidden="true">${TIPOS[m.tipo].ico}</span>
        <span class="cm-cx-t"><span class="cm-cx-l1"><b>${esc(TIPOS[m.tipo].nome)}${m.geral ? ' · geral' : ''}</b>${m.quando > lidoAntes ? ' <span class="etq verm">NOVA</span>' : ''}</span>
        <span class="cm-cx-l2">${esc(m.d || '')} ${esc(m.h || '')} · de ${esc(m.de || '?')}</span>
        <span class="cm-cx-x">${esc(m.txt || '')}</span></span></button></li>`).join('')}</ul>` : '<p class="vazio95">Nenhuma mensagem ainda.</p>');
    sec._lista = l;
  };
  desenhar();
  vivoOn('cmCaixa', sec, desenhar);
  sec.addEventListener('click', e => { const b = e.target.closest('[data-i]'); if (!b) return; const m = (sec._lista || [])[+b.dataset.i]; if (m) enfileirar(fim => tocar(m, fim)); });
}

/* ---- painel do Mestre: compor e mandar ---- */
const rasc = { tipo: 'pager', de: '', txt: '', distorcida: false, todos: false, pcs: [] };
function modelos() {
  const meus = Object.entries(Segredos.ler(['comunicacao', 'modelos']) || {}).filter(([, m]) => m && TIPOS[m.tipo]).map(([id, m]) => ({ ...m, id }));
  return [...meus, ...MODELOS_BASE];
}
async function enviarMsg(m, dest) {
  const r = CRW.relogio();
  const msg = { tipo: m.tipo, de: (m.de || '').trim() || TIPOS[m.tipo].de, txt: String(m.txt || '').trim(), h: `${pad2(r.h)}:${pad2(r.m)}`, d: r.data };
  if (!msg.txt) { aviso('Escreva a mensagem.', 'erro'); return false; }
  if (m.tipo === 'secretaria' && m.distorcida) msg.distorcida = true;
  const para = [];
  if (dest.todos) {
    msg.ts = enviouTs = agora();
    await Estado.definir(['transmissao'], msg);
    await Estado.definir(['transmissoes', Rede.chave()], msg);
    const hist = Object.entries(S().transmissoes || {}).sort((a, b) => num(a[1] && a[1].ts) - num(b[1] && b[1].ts));
    for (const [k] of hist.slice(0, Math.max(0, hist.length - 30))) await Estado.definir(['transmissoes', k], null);
    para.push('todos');
  } else {
    for (const pc of dest.pcs || []) { const x = CRW.entregar(pc, msg); if (x) { para.push(pc); x.pronto && x.pronto.catch(() => aviso('O servidor recusou a entrega.', 'erro')); } }
  }
  if (!para.length) { aviso('Escolha para quem mandar (ou marque Todos).', 'erro'); return false; }
  Rede.push('segredos/comunicacao/historico', { ...msg, para, ts: agora() });
  const nomes = para.map(p => p === 'todos' ? 'todos' : ((CRW.pc(p) || {}).nome || p)).join(', ');
  CRW.diario('mensagem', `${TIPOS[m.tipo].nome} para ${nomes}: ${msg.txt}`);
  aviso(`${TIPOS[m.tipo].nome} enviado para ${nomes}.`);
  return true;
}
function blocoMensagensM(c) {
  c.innerHTML = `<p class="mini">Mensagem para um investigador chega só no aparelho dele (e fica na Caixa de mensagens). "Todos" é uma transmissão geral que aparece em todas as telas ao mesmo tempo, inclusive na TV.</p>
    <div class="cm-tipos" role="group" aria-label="Tipo">${Object.entries(TIPOS).map(([k, t]) => `<button class="w95-btn" data-cm-tipo="${k}">${t.ico} ${t.nome}</button>`).join('')}</div>
    <p class="mini" data-cm-dica></p>
    <label class="campo">De (aparece no aparelho)<input class="w95-input" data-cm-de maxlength="40"></label>
    <label class="campo">Mensagem<textarea class="w95-input" rows="3" data-cm-txt maxlength="600"></textarea></label>
    <label class="chk95" data-cm-distl><input type="checkbox" data-cm-dist> Voz distorcida (ligação anônima)</label>
    <div class="cm-sub">Destino</div>
    <label class="chk95"><input type="checkbox" data-cm-todos> Todos (transmissão geral, inclusive a TV)</label>
    <div data-cm-pcs class="cm-pcs"></div>
    <div class="linha95"><button class="w95-btn pri" data-cm-enviar>Enviar</button><button class="w95-btn" data-cm-testar>Testar aqui</button><button class="w95-btn" data-cm-salvar>Salvar como modelo</button></div>
    <details class="bloco95 cm-det"><summary>Modelos rápidos</summary><div class="bloco95-c"><div class="cm-modelos" data-cm-mods></div></div></details>
    <details class="bloco95 cm-det"><summary>Histórico do que você mandou</summary><div class="bloco95-c" data-cm-hist></div></details>`;
  const q = s => $(s, c);
  const lerForm = () => { rasc.de = q('[data-cm-de]').value; rasc.txt = q('[data-cm-txt]').value; rasc.distorcida = q('[data-cm-dist]').checked; rasc.todos = q('[data-cm-todos]').checked; rasc.pcs = $$('[data-cm-pc]:checked', c).map(x => x.dataset.cmPc); };
  const tipo = () => {
    $$('[data-cm-tipo]', c).forEach(b => b.classList.toggle('on', b.dataset.cmTipo === rasc.tipo));
    q('[data-cm-dica]').textContent = TIPOS[rasc.tipo].dica;
    q('[data-cm-de]').placeholder = TIPOS[rasc.tipo].de;
    q('[data-cm-distl]').hidden = rasc.tipo !== 'secretaria';
  };
  const pcsHtml = () => {
    const l = CRW.pcs();
    q('[data-cm-pcs]').innerHTML = l.length ? l.map(p => { const ok = !!CRW.chaveDoPC(p.id); return `<label class="chk95${ok ? '' : ' dim'}"><input type="checkbox" data-cm-pc="${esc(p.id)}" ${ok ? '' : 'disabled'} ${rasc.pcs.includes(p.id) && ok ? 'checked' : ''}> ${esc(p.nome)}${ok ? '' : ' (ainda não abriu o site)'}</label>`; }).join('') : '<p class="vazio95">Nenhum investigador cadastrado.</p>';
    q('[data-cm-pcs]').classList.toggle('cm-off', rasc.todos);
  };
  const mods = () => {
    q('[data-cm-mods]').innerHTML = modelos().map((m, i) => `<div class="cm-mod"><button class="cm-mod-b" data-cm-mod="${i}"><span aria-hidden="true">${TIPOS[m.tipo].ico}</span> <b>${esc(TIPOS[m.tipo].nome)}</b> · ${esc(m.txt)}</button>${m.id ? `<button class="w95-btn perigo cm-mod-x" data-cm-modx="${esc(m.id)}" aria-label="Apagar modelo">×</button>` : ''}</div>`).join('');
  };
  const hist = () => {
    const h = Object.values(Segredos.ler(['comunicacao', 'historico']) || {}).filter(Boolean).sort((a, b) => num(b.ts) - num(a.ts)).slice(0, 30);
    c._hist = h;
    q('[data-cm-hist]').innerHTML = h.length ? `<ul class="cm-hist">${h.map((m, i) => `<li><span class="mini">${esc(m.d || '')} ${esc(m.h || '')}</span> <b>${TIPOS[m.tipo] ? TIPOS[m.tipo].ico + ' ' + esc(TIPOS[m.tipo].nome) : esc(m.tipo)}</b> para ${esc((m.para || []).map(p => p === 'todos' ? 'todos' : ((CRW.pc(p) || {}).nome || p)).join(', '))}: ${esc(m.txt)} <button class="w95-btn cm-mini-b" data-cm-reu="${i}">Reusar</button></li>`).join('')}</ul>` : '<p class="vazio95">Nada enviado ainda.</p>';
  };
  q('[data-cm-de]').value = rasc.de; q('[data-cm-txt]').value = rasc.txt; q('[data-cm-dist]').checked = rasc.distorcida; q('[data-cm-todos]').checked = rasc.todos;
  tipo(); pcsHtml(); mods(); hist();
  vivoOn('fichas', c, () => { lerForm(); pcsHtml(); });
  quandoMuda(c, s => s.pcs, () => { lerForm(); pcsHtml(); });
  vivoOn('segredos', c, () => { mods(); hist(); });
  c.addEventListener('input', lerForm);
  c.addEventListener('change', e => { lerForm(); if (e.target.matches('[data-cm-todos]')) pcsHtml(); });
  c.addEventListener('click', async e => {
    const t = e.target.closest('[data-cm-tipo]'); if (t) { lerForm(); rasc.tipo = t.dataset.cmTipo; tipo(); return; }
    const mo = e.target.closest('[data-cm-mod]');
    if (mo) { const m = modelos()[+mo.dataset.cmMod]; if (m) { rasc.tipo = m.tipo; rasc.de = m.de || ''; rasc.txt = m.txt || ''; rasc.distorcida = !!m.distorcida; q('[data-cm-de]').value = rasc.de; q('[data-cm-txt]').value = rasc.txt; q('[data-cm-dist]').checked = rasc.distorcida; tipo(); aviso('Modelo carregado. Escolha o destino e envie.'); } return; }
    const mx = e.target.closest('[data-cm-modx]'); if (mx) { if (await confirmar('Apagar este modelo?')) Segredos.gravar(['comunicacao', 'modelos', mx.dataset.cmModx], null); return; }
    const ru = e.target.closest('[data-cm-reu]'); if (ru) { const m = (c._hist || [])[+ru.dataset.cmReu]; if (m) { rasc.tipo = m.tipo; rasc.de = m.de || ''; rasc.txt = m.txt || ''; rasc.distorcida = !!m.distorcida; q('[data-cm-de]').value = rasc.de; q('[data-cm-txt]').value = rasc.txt; q('[data-cm-dist]').checked = rasc.distorcida; tipo(); } return; }
    lerForm();
    if (e.target.closest('[data-cm-testar]')) { if (!rasc.txt.trim()) return aviso('Escreva a mensagem.', 'erro'); const r = CRW.relogio(); enfileirar(fim => tocar({ tipo: rasc.tipo, de: rasc.de || TIPOS[rasc.tipo].de, txt: rasc.txt, distorcida: rasc.distorcida, h: `${pad2(r.h)}:${pad2(r.m)}`, d: r.data, geral: rasc.todos }, fim)); }
    if (e.target.closest('[data-cm-salvar]')) { if (!rasc.txt.trim()) return aviso('Escreva a mensagem.', 'erro'); Segredos.gravar(['comunicacao', 'modelos', 'm' + Date.now().toString(36)], { tipo: rasc.tipo, de: rasc.de, txt: rasc.txt, distorcida: rasc.distorcida || null }); aviso('Modelo salvo.'); }
    if (e.target.closest('[data-cm-enviar]')) { const ok = await enviarMsg(rasc, { todos: rasc.todos, pcs: rasc.pcs }); if (ok) { rasc.txt = ''; q('[data-cm-txt]').value = ''; } }
  });
}

/* =========================================================
   30 · CROWSREST SENTINEL DIÁRIO
   estado/sentinel/<ddmmaaaa> = { data, preco, manchete, corpo:[], sub, corpo2:[], rodape, foto, legenda, lotes:[], ts }
   segredos/sentinel/<ddmmaaaa> = rascunhos do Mestre ; caso/sentinel/marcas/<ed>/<id> = trechos marcados pelo grupo
   A edição 1 é CASO.sentinel1 (dados.js).
   ========================================================= */
function edicoes() {
  const m = {};
  const e1 = typeof CASO !== 'undefined' && CASO.sentinel1;
  if (e1) m[idData(e1.data)] = { ...e1, html: true, base: true, lotes: ['chevette', 'trailers', 'praca', 'fundicao'] };
  Object.entries(S().sentinel || {}).forEach(([id, e]) => { if (e && typeof e === 'object') m[id] = { ...e }; });
  return Object.entries(m).map(([id, e]) => ({ ...e, id })).sort((a, b) => ordId(b.id).localeCompare(ordId(a.id)));
}
const textoEd = e => tiraTags([e.manchete, ...(e.corpo || []), e.sub, ...(e.corpo2 || []), e.legenda].filter(Boolean).join(' '));
function chavesLote(l) { const n = semAcento(l.nome), curto = semAcento(String(l.nome).replace(/\s*\(.*?\)\s*/g, ' ')); return [...new Set([n, curto])].filter(x => x.length >= 6); }
function edicoesQueCitam(lote) {
  const ks = chavesLote(lote);
  return edicoes().filter(e => lote.id === 'sentinel' || (e.lotes || []).includes(lote.id) || ks.some(k => semAcento(textoEd(e)).includes(k)));
}
// divide um parágrafo (HTML simples) em frases, sem cortar dentro de uma marca <...>
const ABREV = /\b(Dr|Dra|Sr|Sra|Dep|St|Av|km|Nº|n)\.$/i;
function frases(html) {
  const out = []; let buf = '', dentro = false;
  for (let i = 0; i < html.length; i++) {
    const ch = html[i]; buf += ch;
    if (ch === '<') dentro = true; else if (ch === '>') dentro = false;
    else if (!dentro && /[.!?]/.test(ch)) {
      while (i + 1 < html.length && /["'”»)]/.test(html[i + 1])) buf += html[++i];
      if ((i + 1 >= html.length || /\s/.test(html[i + 1])) && !ABREV.test(tiraTags(buf).trim())) { out.push(buf); buf = ''; }
    }
  }
  if (buf.trim()) out.push(buf);
  return out.map(s => s.trim()).filter(Boolean);
}
function fr(campo, p, txt, html, marcas) {
  const h = html ? String(txt || '') : md(txt);
  return frases(h).map((f, s) => { const k = `${campo}.${p}.${s}`, ms = marcas[k] || []; return `<span class="cm-fr${ms.length ? ' cm-marcado' : ''}" data-k="${k}"${ms.length ? ` title="Marcado por ${esc(ms.map(m => m.por).join(', '))}"` : ''}>${f}</span>`; }).join(' ');
}
function htmlEdicao(e, marcas) {
  marcas = marcas || {};
  return `<div class="news cm-news"><div class="mast">Crowsrest Sentinel</div>
    <div class="slug">Servindo Crowsrest desde 1811 · Edição de ${esc(e.data)}${e.data ? ' (' + esc(CRW.diaSemana(e.data)) + ')' : ''} · ${esc(e.preco || '$0,25')}</div>
    <div class="cols"><h2>${fr('manchete', 0, e.manchete, e.html, marcas)}</h2>
    ${e.foto ? `<figure class="cm-nfoto"><img src="${esc(e.foto)}" alt="${esc(e.legenda || 'Foto da edição')}">${e.legenda ? `<figcaption>${esc(e.legenda)}</figcaption>` : ''}</figure>` : ''}
    ${(e.corpo || []).map((t, i) => `<p class="${i === 0 ? 'drop' : ''}">${fr('corpo', i, t, e.html, marcas)}</p>`).join('')}
    ${e.sub ? `<h3>${fr('sub', 0, e.sub, e.html, marcas)}</h3>` : ''}
    ${(e.corpo2 || []).map((t, i) => `<p>${fr('corpo2', i, t, e.html, marcas)}</p>`).join('')}</div></div>`;
}
const vistasSent = () => ls.get('cmSentVistas', []);
function badgeSentinel() { const vs = vistasSent(); CRW.badge('jornal', P.mestre || !logado() ? 0 : edicoes().filter(e => !vs.includes(e.id)).length); }
function marcarVista(id) { const vs = vistasSent(); if (!vs.includes(id)) { vs.push(id); ls.set('cmSentVistas', vs.slice(-200)); } badgeSentinel(); }
let ultSent = null;
CRW.on('estado', s => {
  const j = JSON.stringify(s.sentinel || null); if (j === ultSent) return;
  const primeira = ultSent === null; ultSent = j; badgeSentinel(); CRW.emit('cmSentinel');
  if (primeira || P.mestre || !appVisivel()) return;
  const av = ls.get('cmSentAvisadas', []);
  Object.keys(s.sentinel || {}).forEach(id => { if (!av.includes(id) && agora() - num((s.sentinel[id] || {}).ts) < 5 * 60000) { av.push(id); aviso(`Saiu a edição de ${dataDeId(id)} do Crowsrest Sentinel.`); Som.impressora(); } });
  ls.set('cmSentAvisadas', av.slice(-200));
});
CRW.on('perfil', () => setTimeout(badgeSentinel, 50));

let edSel = null, marcando = false, marcasSent = {};
function telaSentinel(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Crowsrest Sentinel</h2><div class="meta" data-sn-meta></div></div><div class="panel-b">
    <div class="linha95 cm-sn-nav"><button class="w95-btn cm-seta" data-sn-ant aria-label="Edição anterior">◂</button><select class="w95-input" data-sn-sel aria-label="Escolher a edição"></select><button class="w95-btn cm-seta" data-sn-prox aria-label="Edição seguinte">▸</button></div>
    <div class="scanwrap cm-sn-scan" data-sn-jornal></div>
    <p class="mini" data-sn-rodape></p>
    <div class="linha95"><button class="w95-btn" data-sn-marcar aria-pressed="false">✎ Marcar trechos suspeitos</button></div>
    <p class="mini" data-sn-dica hidden>Modo marcação: toque numa frase do jornal para marcar (ou desmarcar). Todo o Círculo vê as marcas.</p>
    <div class="cm-sub">Trechos marcados pelo grupo</div><div data-sn-marcas></div>
    <div class="cm-sub">Todas as edições</div><div data-sn-lista></div></div></div>`;
  const q = s => $(s, sec);
  const lista = () => edicoes();
  const ed = () => lista().find(e => e.id === edSel) || lista()[0];
  const desenharJornal = () => {
    const e = ed(); if (!e) { q('[data-sn-jornal]').innerHTML = '<p class="vazio95">Nenhuma edição.</p>'; return; }
    const porK = {}; Object.entries(marcasSent).forEach(([id, m]) => { if (m && m.k) (porK[m.k] = porK[m.k] || []).push({ id, ...m }); });
    q('[data-sn-jornal]').innerHTML = htmlEdicao(e, porK);
    q('[data-sn-rodape]').innerHTML = e.rodape ? (e.html ? e.rodape : md(e.rodape)) : '';
    q('[data-sn-meta]').innerHTML = `Edição de ${esc(e.data)}<br>${esc(e.preco || '$0,25')}`;
    sec.classList.toggle('cm-marcando', marcando);
  };
  const desenharMarcas = () => {
    const l = Object.entries(marcasSent).map(([id, m]) => ({ id, ...m })).filter(m => m.k).sort((a, b) => num(a.ts) - num(b.ts));
    q('[data-sn-marcas]').innerHTML = !logado() ? '<p class="vazio95">Entre no sistema para ver as marcas.</p>' : l.length ? l.map(m => `<div class="cm-mk"><q>${esc(m.txt)}</q><div class="cm-mk-m">marcado por ${esc(m.por || '?')}${m.nota ? ` · <b>nota:</b> ${esc(m.nota)}` : ''}</div>
      <div class="linha95"><button class="w95-btn cm-mini-b" data-mk-nota="${esc(m.id)}">${m.nota ? 'Editar nota' : 'Anotar'}</button><button class="w95-btn perigo cm-mini-b" data-mk-del="${esc(m.id)}">Desmarcar</button></div></div>`).join('') : '<p class="vazio95">Nenhum trecho marcado nesta edição.</p>';
  };
  const desenharLista = () => {
    const l = lista(), e = ed();
    q('[data-sn-sel]').innerHTML = l.map(x => `<option value="${esc(x.id)}"${e && x.id === e.id ? ' selected' : ''}>${esc(x.data)} (${esc(CRW.diaSemana(x.data))})</option>`).join('');
    const vs = vistasSent();
    q('[data-sn-lista]').innerHTML = `<ul class="cm-sn-ed">${l.map(x => `<li><button class="cm-sn-edb${e && x.id === e.id ? ' on' : ''}" data-sn-ed="${esc(x.id)}"><span class="cm-sn-d">${esc(x.data)}${vs.includes(x.id) || P.mestre ? '' : ' <span class="etq verm">NOVA</span>'}</span><span class="cm-sn-m">${esc(tiraTags(x.manchete))}</span></button></li>`).join('')}</ul>`;
  };
  const ligarMarcas = () => {
    const e = ed(); marcasSent = {};
    if (e && logado()) assinar('snMarcas', 'caso/sentinel/marcas/' + e.id, x => { marcasSent = x || {}; if (document.body.contains(sec)) { desenharJornal(); desenharMarcas(); } });
    else desassinar('snMarcas');
  };
  const ir = id => { edSel = id; ligarMarcas(); desenharJornal(); desenharMarcas(); desenharLista(); const e = ed(); if (e && CRW.moduloAtual() === 'jornal') marcarVista(e.id); };
  ir((ed() || {}).id);
  vivoOn('cmSentinel', sec, () => { if (!lista().some(e => e.id === edSel)) edSel = null; ir((ed() || {}).id); });
  vivoOn('cmIrEdicao', sec, id => ir(id));
  q('[data-sn-sel]').addEventListener('change', e => ir(e.target.value));
  sec.addEventListener('click', async e => {
    const l = lista(), i = l.findIndex(x => x.id === (ed() || {}).id);
    if (e.target.closest('[data-sn-ant]') && i < l.length - 1) ir(l[i + 1].id);
    if (e.target.closest('[data-sn-prox]') && i > 0) ir(l[i - 1].id);
    const b = e.target.closest('[data-sn-ed]'); if (b) { ir(b.dataset.snEd); q('[data-sn-jornal]').scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    if (e.target.closest('[data-sn-marcar]')) {
      if (!logado()) return aviso('Entre no sistema para marcar.', 'erro');
      marcando = !marcando; sec.classList.toggle('cm-marcando', marcando); q('[data-sn-dica]').hidden = !marcando;
      const bt = q('[data-sn-marcar]'); bt.classList.toggle('on', marcando); bt.setAttribute('aria-pressed', marcando); bt.textContent = marcando ? '✎ Marcando… (toque para parar)' : '✎ Marcar trechos suspeitos';
    }
    const f = e.target.closest('.cm-fr');
    if (f && marcando) {
      const ed0 = ed(), k = f.dataset.k;
      const ja = Object.entries(marcasSent).filter(([, m]) => m && m.k === k);
      if (ja.length) { if (await confirmar('Desmarcar este trecho para todo o grupo?')) ja.forEach(([id]) => Rede.set(`caso/sentinel/marcas/${ed0.id}/${id}`, null).catch(() => aviso('O servidor recusou.', 'erro'))); }
      else { Rede.set(`caso/sentinel/marcas/${ed0.id}/${Rede.chave()}`, { k, txt: f.textContent.trim().slice(0, 400), por: quemSou(), pc: P.pc || null, ts: agora() }).catch(() => aviso('O servidor recusou.', 'erro')); Som.clique(); }
    }
    const mn = e.target.closest('[data-mk-nota]');
    if (mn) { const m = marcasSent[mn.dataset.mkNota] || {}; const t = await pedirTexto('Nota sobre este trecho (por que é suspeito?)', m.nota || '', { longo: true }); if (t !== null) Rede.set(`caso/sentinel/marcas/${ed().id}/${mn.dataset.mkNota}/nota`, t.trim() || null); }
    const md2 = e.target.closest('[data-mk-del]'); if (md2 && await confirmar('Desmarcar este trecho para todo o grupo?')) Rede.set(`caso/sentinel/marcas/${ed().id}/${md2.dataset.mkDel}`, null);
  });
}
CRW.Sentinel = { edicoes, edicoesQueCitam, html: htmlEdicao, abrir(id) { edSel = id; CRW.abrirModulo('jornal'); CRW.emit('cmIrEdicao', id); } };
CRW.on('modulo', id => { if (id === 'jornal') { const e = edicoes().find(x => x.id === edSel) || edicoes()[0]; if (e) marcarVista(e.id); } });

// Cartão do Local (mapa): edições que citam o lote
CRW.registrarCartao({ id: 'cm-sentinel', ordem: 70, render(lote, corpo) {
  const l = lote ? edicoesQueCitam(lote) : [];
  corpo.innerHTML = `<div class="cm-cartao"><div class="cm-sub">Crowsrest Sentinel</div>${l.length ? `<ul class="cm-sn-ed">${l.map(e => `<li><button class="cm-sn-edb" data-sn-ir="${esc(e.id)}"><span class="cm-sn-d">${esc(e.data)}</span><span class="cm-sn-m">${esc(tiraTags(e.manchete))}</span></button></li>`).join('')}</ul>` : '<p class="mini">Nenhuma edição do jornal cita este local.</p>'}</div>`;
  corpo.onclick = e => { const b = e.target.closest('[data-sn-ir]'); if (b) { $$('.jan-fundo').forEach(f => { if (f.contains(b)) fecharJanela(f.dataset.jan); }); CRW.Sentinel.abrir(b.dataset.snIr); } };
} });

/* ---- editor do Mestre ---- */
const novaEd = data => ({ data: data || CRW.relogio().data, preco: '$0,25', manchete: '', corpo: [], sub: '', corpo2: [], rodape: '', foto: null, legenda: '', lotes: [] });
let edEd = null;
const paraTexto = arr => (arr || []).map(t => String(t).replace(/<b>(.*?)<\/b>/g, '**$1**').replace(/<[^>]*>/g, '')).join('\n\n');
const deTexto = t => String(t || '').split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
const rascunhos = () => Segredos.ler(['sentinel']) || {};
function blocoSentinelM(c) {
  if (!edEd) edEd = novaEd();
  c.innerHTML = `<p class="mini">Uma edição por dia de jogo. Escreva, pré-visualize, guarde como rascunho (só você lê) e publique (todos veem na tela Crowsrest Sentinel). Quando o relógio do jogo vira o dia, o site pergunta se sai edição nova.</p>
    <p class="mini" data-sm-hoje></p>
    <div class="cm-sub">Rascunhos e edições publicadas</div><div data-sm-lista></div>
    <div class="cm-sub">Editor</div>
    <div class="grade2"><label class="campo">Data da edição (dd/mm/aaaa)<input class="w95-input" data-sm="data" maxlength="10" inputmode="numeric"></label><label class="campo">Preço<input class="w95-input" data-sm="preco" maxlength="10"></label></div>
    <label class="campo">Manchete<input class="w95-input" data-sm="manchete" maxlength="180"></label>
    <label class="campo">Matéria principal (parágrafos separados por uma linha em branco; **negrito**)<textarea class="w95-input" rows="7" data-sm="corpo"></textarea></label>
    <label class="campo">Título da segunda matéria<input class="w95-input" data-sm="sub" maxlength="120"></label>
    <label class="campo">Segunda matéria<textarea class="w95-input" rows="4" data-sm="corpo2"></textarea></label>
    <label class="campo">Nota abaixo do recorte (opcional)<input class="w95-input" data-sm="rodape" maxlength="240"></label>
    <div class="linha95"><label class="w95-btn cm-arq">Escolher foto…<input type="file" accept="image/*" data-sm-foto hidden></label><button class="w95-btn" data-sm-semfoto>Tirar a foto</button><span class="mini" data-sm-fotost></span></div>
    <label class="campo">Legenda da foto<input class="w95-input" data-sm="legenda" maxlength="140"></label>
    <details class="bloco95 cm-det"><summary>Locais citados (o cartão do local no mapa lista a edição)</summary><div class="bloco95-c cm-sm-lotes">${lotes().map(l => `<label class="chk95"><input type="checkbox" data-sm-lote="${esc(l.id)}"> ${esc(l.nome)}</label>`).join('')}</div></details>
    <div class="linha95"><button class="w95-btn" data-sm-prev>Pré-visualizar</button><button class="w95-btn" data-sm-rasc>Salvar rascunho</button><button class="w95-btn pri" data-sm-pub>Publicar</button><button class="w95-btn" data-sm-novo>Nova edição</button></div>`;
  const q = s => $(s, c);
  const campos = ['data', 'preco', 'manchete', 'sub', 'rodape', 'legenda'];
  const preencher = () => {
    campos.forEach(k => { q(`[data-sm="${k}"]`).value = edEd[k] || ''; });
    q('[data-sm="corpo"]').value = edEd.html ? paraTexto(edEd.corpo) : (edEd.corpo || []).join('\n\n');
    q('[data-sm="corpo2"]').value = edEd.html ? paraTexto(edEd.corpo2) : (edEd.corpo2 || []).join('\n\n');
    $$('[data-sm-lote]', c).forEach(x => { x.checked = (edEd.lotes || []).includes(x.dataset.smLote); });
    q('[data-sm-fotost]').textContent = edEd.foto ? `Foto anexada (${Math.round(edEd.foto.length / 1024)} KB)` : 'Sem foto.';
  };
  const ler = () => {
    campos.forEach(k => { edEd[k] = q(`[data-sm="${k}"]`).value.trim(); });
    edEd.corpo = deTexto(q('[data-sm="corpo"]').value); edEd.corpo2 = deTexto(q('[data-sm="corpo2"]').value);
    edEd.lotes = $$('[data-sm-lote]:checked', c).map(x => x.dataset.smLote);
    if (edEd.html) { delete edEd.html; delete edEd.base; if (edEd.rodape) edEd.rodape = tiraTags(edEd.rodape); }
    return edEd;
  };
  const hoje = () => {
    const r = CRW.relogio(), id = idData(r.data), pub = edicoes().some(e => e.id === id), ra = rascunhos()[id];
    q('[data-sm-hoje]').innerHTML = `Hoje no jogo: <b>${esc(r.data)}</b> (${esc(CRW.diaSemana(r.data))})${r.real ? ' · relógio do jogo parado no padrão' : ''}. Edição de hoje: <b>${pub ? 'publicada' : 'não publicada'}</b>${ra && !pub ? ' · há um rascunho pronto' : ''}.`;
  };
  const lista = () => {
    const pubs = edicoes(), ras = rascunhos();
    const ids = [...new Set([...pubs.map(e => e.id), ...Object.keys(ras)])].sort((a, b) => ordId(b).localeCompare(ordId(a)));
    q('[data-sm-lista]').innerHTML = ids.length ? `<ul class="cm-sm-l">${ids.map(id => {
      const p = pubs.find(e => e.id === id), r = ras[id];
      return `<li><div><b>${esc(dataDeId(id))}</b> ${p ? `<span class="etq verde">${p.base ? 'PUBLICADA (CASO)' : 'PUBLICADA'}</span>` : ''} ${r ? '<span class="etq ambar">RASCUNHO</span>' : ''}<div class="mini">${esc(tiraTags((r || p || {}).manchete || ''))}</div></div>
        <div class="linha95">${r ? `<button class="w95-btn cm-mini-b" data-sm-abr="r:${esc(id)}">Abrir rascunho</button>` : ''}${p ? `<button class="w95-btn cm-mini-b" data-sm-abr="p:${esc(id)}">Abrir publicada</button>` : ''}${p && !p.base ? `<button class="w95-btn perigo cm-mini-b" data-sm-desp="${esc(id)}">Despublicar</button>` : ''}${r ? `<button class="w95-btn perigo cm-mini-b" data-sm-delr="${esc(id)}">Apagar rascunho</button>` : ''}</div></li>`;
    }).join('')}</ul>` : '<p class="vazio95">Nada ainda.</p>';
  };
  preencher(); hoje(); lista();
  vivoOn('cmSentinel', c, () => { lista(); hoje(); });
  vivoOn('segredos', c, () => { lista(); hoje(); });
  let ultDia = CRW.relogio().data; vivoOn('tick', c, r => { if (r.data !== ultDia) { ultDia = r.data; hoje(); } });
  q('[data-sm-foto]').addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try { ler(); edEd.foto = await CRW.lerImagem(f, 900, 0.72); preencher(); aviso('Foto anexada. Ela vai para o estado público: prefira fotos pequenas.'); } catch (er) { aviso('Imagem inválida.', 'erro'); }
  });
  c.addEventListener('click', async e => {
    if (e.target.closest('[data-sm-semfoto]')) { ler(); edEd.foto = null; preencher(); }
    if (e.target.closest('[data-sm-novo]')) { if (await confirmar('Começar uma edição nova (para a data de hoje no jogo)?\n\nO que não foi salvo no editor se perde.')) { edEd = novaEd(); preencher(); } }
    const ab = e.target.closest('[data-sm-abr]');
    if (ab) { const [t, id] = ab.dataset.smAbr.split(':'); const src = t === 'r' ? rascunhos()[id] : edicoes().find(x => x.id === id); if (src) { edEd = { ...novaEd(src.data || dataDeId(id)), ...copia(src) }; delete edEd.id; delete edEd.ts; preencher(); q('[data-sm="manchete"]').scrollIntoView({ block: 'center', behavior: 'smooth' }); aviso('Carregado no editor.'); } }
    const dp = e.target.closest('[data-sm-desp]'); if (dp && await confirmar(`Despublicar a edição de ${dataDeId(dp.dataset.smDesp)}?\n\nEla some da tela dos jogadores (as marcas do grupo ficam guardadas).`)) { Estado.definir(['sentinel', dp.dataset.smDesp], null); CRW.diario('sentinel', 'Edição despublicada: ' + dataDeId(dp.dataset.smDesp)); }
    const dr = e.target.closest('[data-sm-delr]'); if (dr && await confirmar('Apagar este rascunho?')) Segredos.gravar(['sentinel', dr.dataset.smDelr], null);
    if (e.target.closest('[data-sm-prev]')) { ler(); janela({ titulo: 'Pré-visualização · Crowsrest Sentinel', largura: '720px', classe: 'cm-prev', html: `<div class="scanwrap">${htmlEdicao(edEd)}</div>${edEd.rodape ? `<p class="mini">${md(edEd.rodape)}</p>` : ''}<div class="msg-bts"><button class="w95-btn" data-fechar>Fechar</button></div>` }); }
    if (e.target.closest('[data-sm-rasc]') || e.target.closest('[data-sm-pub]')) {
      const pub = !!e.target.closest('[data-sm-pub]'); ler();
      if (!/^\d{2}\/\d{2}\/\d{4}$/.test(edEd.data)) return aviso('Data no formato dd/mm/aaaa.', 'erro');
      if (!edEd.manchete) return aviso('Escreva a manchete.', 'erro');
      const id = idData(edEd.data), dado = { ...copia(edEd), ts: agora() };
      Object.keys(dado).forEach(k => { if (dado[k] === '' || (Array.isArray(dado[k]) && !dado[k].length)) dado[k] = null; });
      if (!pub) { await Segredos.gravar(['sentinel', id], dado); aviso('Rascunho salvo (só você lê).'); return; }
      const ja = edicoes().find(x => x.id === id);
      if (!(await confirmar(`Publicar a edição de ${edEd.data}?${ja ? '\n\nJá existe uma edição publicada nesta data: ela será substituída.' : ''}\n\nTodos os investigadores passam a ver.`))) return;
      await Estado.definir(['sentinel', id], dado);
      if (rascunhos()[id]) Segredos.gravar(['sentinel', id, 'publicada'], true);
      CRW.diario('sentinel', `Edição publicada (${edEd.data}): ${edEd.manchete}`);
      aviso('Edição publicada.');
    }
  });
}
// relógio vira o dia: pergunta ao Mestre se sai edição nova
let diaVisto = null;
CRW.on('tick', r => {
  if (!P.mestre || r.real || r.data === diaVisto) return;
  diaVisto = r.data;
  if (ls.get('cmDiaAvisado', '') === r.data) return;
  ls.set('cmDiaAvisado', r.data);
  if (edicoes().some(e => e.id === idData(r.data))) return;
  const ra = rascunhos()[idData(r.data)];
  CRW.alertaMestre(`Virou o dia no jogo: ${r.data} (${CRW.diaSemana(r.data)}). Nova edição do Crowsrest Sentinel?${ra ? ' Há um rascunho pronto para esta data.' : ''} Painel, aba Registro.`, 'sentinel-dia');
});

/* =========================================================
   31 · QUADRO DE SUSPEITOS
   caso/suspeitos/<id> = { nome, foto, status, notas, motivo, meios, oportunidade, ligacoes:[ids], porQuem, ts }
   estado/suspeitos/<id> = { status, ts }  status oficial fixado pelo Mestre (só ele grava)
   ========================================================= */
const ST = { procurado: 'PROCURADO', interrogado: 'INTERROGADO', desaparecido: 'DESAPARECIDO', morto: 'MORTO', livre: 'LIVRE' };
let susp = {};
const statusDe = (id, s) => { const of = (S().suspeitos || {})[id]; return (of && ST[of.status]) ? of.status : (ST[s && s.status] ? s.status : 'procurado'); };
const oficial = id => { const of = (S().suspeitos || {})[id]; return !!(of && ST[of.status]); };
function retrato(s) { return s && s.foto ? `<img src="${esc(s.foto)}" alt="">` : SILHUETA; }
function rot(id) { let h = 0; for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) | 0; return ((Math.abs(h) % 7) - 3) * 0.8; }
function cartaSusp(id, s) {
  const st = statusDe(id, s), nl = (s.ligacoes || []).length;
  return `<button class="cm-sus st-${st}" data-s="${esc(id)}" style="--rot:${rot(id)}deg">
    <span class="cm-sus-foto">${retrato(s)}<span class="cm-sus-placa">CCSO · ${esc(String(id).slice(0, 8).toUpperCase())}</span><span class="cm-sus-car">${ST[st]}</span></span>
    <span class="cm-sus-nome">${esc(s.nome || '?')}</span>
    <span class="cm-sus-meta">${oficial(id) ? '★ oficial · ' : ''}${nl ? nl + (nl === 1 ? ' ligação' : ' ligações') : 'sem ligações'}</span></button>`;
}
function telaSuspeitos(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Quadro de suspeitos</h2><div class="meta">montado pelo Círculo</div></div><div class="panel-b">
    <p class="mini">O grupo monta o quadro: qualquer investigador acrescenta pessoas, troca o status e escreve motivo, meios e oportunidade. Toque numa ficha para abrir. Um status com ★ foi fixado pelo Guardião da Luz e só ele muda.</p>
    <div class="linha95"><button class="w95-btn" data-su-pi>+ Pessoa de interesse</button><button class="w95-btn" data-su-npc>+ Pessoa conhecida</button><button class="w95-btn" data-su-novo>+ Outra pessoa</button></div>
    <div class="cm-quadro" data-su-quadro><svg class="cm-fios" data-su-fios aria-hidden="true"></svg><div class="cm-quadro-g" data-su-grade></div></div>
    <p class="mini cm-leg">${Object.entries(ST).map(([k, n]) => `<span class="cm-leg-i st-${k}">${n}</span>`).join(' ')}</p>
    <div class="linha95"><button class="w95-btn" data-rel>Relatório de Investigação (PDF)</button></div></div></div>`;
  const q = s => $(s, sec);
  const fios = () => {
    const quadro = q('[data-su-quadro]'), svg = q('[data-su-fios]'); if (!quadro || !svg) return;
    const rq = quadro.getBoundingClientRect(); const pos = {};
    $$('[data-s]', quadro).forEach(b => { const r = b.getBoundingClientRect(); pos[b.dataset.s] = [r.left - rq.left + r.width / 2, r.top - rq.top + 4]; });
    const pares = new Set(); Object.entries(susp).forEach(([a, s]) => (s && s.ligacoes || []).forEach(b => { if (pos[a] && pos[b] && a !== b) pares.add([a, b].sort().join('|')); }));
    svg.setAttribute('viewBox', `0 0 ${Math.max(1, rq.width)} ${Math.max(1, rq.height)}`);
    svg.innerHTML = [...pares].map(p => { const [a, b] = p.split('|'); const [x1, y1] = pos[a], [x2, y2] = pos[b], mx = (x1 + x2) / 2, my = Math.max(y1, y2) + 26; return `<path d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"/>`; }).join('');
  };
  const desenhar = () => {
    const l = Object.entries(susp).filter(([, s]) => s).sort((a, b) => num(a[1].criado || a[1].ts) - num(b[1].criado || b[1].ts));
    q('[data-su-grade]').innerHTML = l.length ? l.map(([id, s]) => cartaSusp(id, s)).join('') : '<p class="cm-quadro-vazio">Quadro vazio. Comece pela pessoa de interesse ou por alguém que o Círculo já conhece.</p>';
    const pi = CASO.pessoaInteresse; q('[data-su-pi]').disabled = !pi || !!susp[pi.id];
    requestAnimationFrame(fios);
  };
  if (logado()) assinar('suspeitos', 'caso/suspeitos', x => { susp = x || {}; if (document.body.contains(sec)) desenhar(); });
  desenhar();
  quandoMuda(sec, s => s.suspeitos, desenhar);
  try { const ro = new ResizeObserver(() => { if (document.body.contains(sec)) fios(); else ro.disconnect(); }); ro.observe(q('[data-su-quadro]')); } catch (e) {}
  sec.addEventListener('click', async e => {
    if (e.target.closest('[data-rel]')) return relatorio();
    const c = e.target.closest('[data-s]'); if (c) return fichaSuspeito(c.dataset.s);
    if (!logado()) return;
    if (e.target.closest('[data-su-pi]')) {
      const pi = CASO.pessoaInteresse, npc = CRW.ser(pi.id) || {};
      const nome = npc.nome || (pi.campos.find(x => x[0] === 'Nome') || [])[1] || 'Pessoa de interesse';
      novoSuspeito(pi.id, { nome, status: ST[pi.status] ? pi.status : 'procurado', notas: `Ficha ${pi.ficha}. ${tiraTags(pi.ultima)}` });
    }
    if (e.target.closest('[data-su-npc]')) escolherNPC();
    if (e.target.closest('[data-su-novo]')) { const n = await pedirTexto('Nome da pessoa', ''); if (n && n.trim()) novoSuspeito('s' + CRW.chaveLocal(), { nome: n.trim().slice(0, 60), status: 'procurado' }); }
  });
}
function novoSuspeito(id, x) {
  if (susp[id]) return fichaSuspeito(id);
  const dado = { nome: x.nome, status: x.status || 'procurado', notas: x.notas || '', motivo: '', meios: '', oportunidade: '', ligacoes: [], foto: x.foto || null, porQuem: quemSou(), criado: agora(), ts: agora() };
  susp[id] = dado;
  Rede.set('caso/suspeitos/' + id, dado).then(() => aviso(`${x.nome} foi para o quadro.`)).catch(() => aviso('O servidor recusou.', 'erro'));
  if (P.mestre) CRW.diario('suspeito', 'No quadro de suspeitos: ' + x.nome);
}
function escolherNPC() {
  const l = CRW.npcs().filter(n => n.tipo !== 'viatura' && !susp[n.id]);
  const w = janela({ titulo: 'Pessoa conhecida', largura: '420px', html: l.length ? `<p class="mini">Pessoas que o Círculo já conhece. Escolha quem vai para o quadro.</p><div class="cm-npcs">${l.map(n => `<button class="cm-npc-b" data-n="${esc(n.id)}"><b>${esc(n.nome)}</b><span class="mini">${esc(n.pub || '')}</span></button>`).join('')}</div><div class="msg-bts"><button class="w95-btn" data-fechar>Fechar</button></div>` : '<p class="vazio95">Todas as pessoas conhecidas já estão no quadro.</p><div class="msg-bts"><button class="w95-btn" data-fechar>Fechar</button></div>' });
  w.addEventListener('click', e => { const b = e.target.closest('[data-n]'); if (!b) return; const n = CRW.ser(b.dataset.n) || {}; fecharJanela(w.parentElement.dataset.jan); novoSuspeito(b.dataset.n, { nome: n.nome || b.dataset.n, foto: n.foto || null, status: 'livre' }); });
}
function fichaSuspeito(id) {
  const s0 = susp[id]; if (!s0) return;
  const s = { ...s0 }, of = (S().suspeitos || {})[id], travado = oficial(id) && !P.mestre, mestre = P.mestre && !CRW.v().espiando;
  const pode = logado() && !CRW.v().espiando;
  const outros = Object.entries(susp).filter(([k, o]) => k !== id && o);
  const lig = new Set([...(s.ligacoes || []), ...outros.filter(([, o]) => (o.ligacoes || []).includes(id)).map(([k]) => k)]);
  let foto = s.foto || null;
  const w = janela({ titulo: 'Ficha de suspeito · ' + (s.nome || ''), largura: '560px', classe: 'cm-fs-jan', html: `
    <div class="cm-fs">
      <div class="cm-fs-foto"><div class="cm-sus-foto" data-fs-ret>${retrato(s)}<span class="cm-sus-car">${ST[statusDe(id, s)]}</span></div>
        ${pode ? `<label class="w95-btn cm-arq">Trocar foto<input type="file" accept="image/*" data-fs-foto hidden></label><button class="w95-btn" data-fs-semfoto>Sem foto</button>` : ''}</div>
      <div class="cm-fs-campos">
        <label class="campo">Nome<input class="w95-input" data-fs="nome" value="${esc(s.nome || '')}" maxlength="60"></label>
        <label class="campo">Status${travado ? ' (fixado pelo Guardião da Luz)' : ''}<select class="w95-input" data-fs="status" ${travado ? 'disabled' : ''}>${Object.entries(ST).map(([k, n]) => `<option value="${k}"${statusDe(id, s) === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        ${mestre ? `<label class="campo">Status oficial (só o Guardião)<select class="w95-input" data-fs-of><option value="">Não fixado: o grupo decide</option>${Object.entries(ST).map(([k, n]) => `<option value="${k}"${of && of.status === k ? ' selected' : ''}>${n}</option>`).join('')}</select></label>` : ''}
      </div></div>
    <label class="campo">Motivo<textarea class="w95-input" rows="2" data-fs="motivo">${esc(s.motivo || '')}</textarea></label>
    <label class="campo">Meios<textarea class="w95-input" rows="2" data-fs="meios">${esc(s.meios || '')}</textarea></label>
    <label class="campo">Oportunidade<textarea class="w95-input" rows="2" data-fs="oportunidade">${esc(s.oportunidade || '')}</textarea></label>
    <label class="campo">Notas<textarea class="w95-input" rows="3" data-fs="notas">${esc(s.notas || '')}</textarea></label>
    ${outros.length ? `<div class="cm-sub">Ligações (fio vermelho no quadro)</div><div class="cm-fs-lig">${outros.map(([k, o]) => `<label class="chk95"><input type="checkbox" data-fs-lig="${esc(k)}" ${lig.has(k) ? 'checked' : ''}> ${esc(o.nome)}</label>`).join('')}</div>` : ''}
    <p class="mini">${s.porQuem ? 'Última edição: ' + esc(s.porQuem) + (s.ts ? ', ' + esc(new Date(s.ts).toLocaleString('pt-BR')) : '') : ''}</p>
    <div class="msg-bts">${pode ? '<button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn perigo" data-del>Tirar do quadro</button>' : ''}<button class="w95-btn" data-fechar>${pode ? 'Cancelar' : 'Fechar'}</button></div>` });
  if (!pode) $$('input, textarea, select', w).forEach(x => { x.disabled = true; });
  const f = $('[data-fs-foto]', w);
  if (f) f.addEventListener('change', async e => { const fl = e.target.files[0]; e.target.value = ''; if (!fl) return; try { foto = await CRW.lerImagem(fl, 480, 0.75); $('[data-fs-ret] img, [data-fs-ret] svg', w).outerHTML = `<img src="${esc(foto)}" alt="">`; } catch (er) { aviso('Imagem inválida.', 'erro'); } });
  w.addEventListener('click', async e => {
    if (e.target.closest('[data-fs-semfoto]')) { foto = null; const x = $('[data-fs-ret] img, [data-fs-ret] svg', w); if (x) x.outerHTML = SILHUETA; }
    if (e.target.closest('[data-del]')) {
      if (!(await confirmar(`Tirar ${s.nome} do quadro?`))) return;
      const upd = { [id]: null }; outros.forEach(([k, o]) => { if ((o.ligacoes || []).includes(id)) upd[k + '/ligacoes'] = o.ligacoes.filter(x => x !== id); });
      Rede.update('caso/suspeitos', upd).catch(() => aviso('O servidor recusou.', 'erro'));
      if (P.mestre && oficial(id)) Estado.definir(['suspeitos', id], null);
      fecharJanela(w.parentElement.dataset.jan);
    }
    if (e.target.closest('[data-ok]')) {
      const g = k => ($(`[data-fs="${k}"]`, w).value || '').trim();
      const marcados = new Set($$('[data-fs-lig]:checked', w).map(x => x.dataset.fsLig));
      const novo = { ...s0, nome: g('nome') || s0.nome, motivo: g('motivo'), meios: g('meios'), oportunidade: g('oportunidade'), notas: g('notas'), foto: foto || null, ligacoes: [...marcados], porQuem: quemSou(), ts: agora() };
      if (!travado) novo.status = g('status');
      const upd = { [id]: novo };
      outros.forEach(([k, o]) => { if ((o.ligacoes || []).includes(id) && !marcados.has(k)) upd[k + '/ligacoes'] = o.ligacoes.filter(x => x !== id); });
      Rede.update('caso/suspeitos', upd).then(() => aviso('Ficha salva.')).catch(() => aviso('O servidor recusou.', 'erro'));
      if (mestre) {
        const v = $('[data-fs-of]', w).value, atual = of && of.status;
        if (v !== (atual || '')) { Estado.definir(['suspeitos', id], v ? { status: v, ts: agora() } : null); CRW.diario('suspeito', `Status oficial de ${novo.nome}: ${v ? ST[v] : 'liberado'}`); }
      }
      fecharJanela(w.parentElement.dataset.jan);
    }
  });
}
function blocoSuspeitosM(c) {
  const desenhar = () => {
    const l = Object.entries(susp).filter(([, s]) => s);
    c.innerHTML = `<p class="mini">O grupo monta o quadro (menu Investigação do grupo, "Quadro de suspeitos"). Aqui você fixa o status oficial: o grupo não consegue mudar um status fixado.</p>
      ${l.length ? `<table class="dtable"><thead><tr><th>Pessoa</th><th>Status do grupo</th><th>Oficial</th></tr></thead><tbody>${l.map(([id, s]) => { const of = (S().suspeitos || {})[id]; return `<tr><td>${esc(s.nome)}</td><td>${esc(ST[s.status] || '?')}</td><td><select class="w95-input" data-so="${esc(id)}"><option value="">Não fixado</option>${Object.entries(ST).map(([k, n]) => `<option value="${k}"${of && of.status === k ? ' selected' : ''}>${n}</option>`).join('')}</select></td></tr>`; }).join('')}</tbody></table>` : '<p class="vazio95">O quadro ainda está vazio.</p>'}`;
  };
  assinar('suspeitosM', 'caso/suspeitos', x => { susp = x || {}; if (document.body.contains(c) && !c.querySelector('select:focus')) desenhar(); });
  desenhar();
  quandoMuda(c, s => s.suspeitos, () => { if (!c.querySelector('select:focus')) desenhar(); });
  c.addEventListener('change', e => { const s = e.target.closest('[data-so]'); if (!s) return; Estado.definir(['suspeitos', s.dataset.so], s.value ? { status: s.value, ts: agora() } : null); CRW.diario('suspeito', `Status oficial de ${(susp[s.dataset.so] || {}).nome}: ${s.value ? ST[s.value] : 'liberado'}`); });
}

/* =========================================================
   32 · ACUSAÇÃO FINAL DA TAREFA
   estado/acusacao = { aberta, tarefa, rodada, ts, enunciado, encerradaEm, resultado:{quem,como,onde,certo,texto,ts} }
   votos/acusacao/<rodada>/<pc> = { quem, como, onde, nota, nome, ts }
   estado/acusacoes/<rodada> = { tarefa, n, titulo, ts, dataJogo, enunciado, votos, contagem, resultado }
   ========================================================= */
function VEREDITO(c) { return c === true ? ['PROCEDENTE', 'verde'] : c === 'parcial' ? ['PARCIALMENTE PROCEDENTE', 'ambar'] : c === false ? ['IMPROCEDENTE', 'verm'] : ['SEM VEREDITO', '']; }
let votos = {}, rodadaAss = null, votosCarregados = false;
function badgeAcus() { const a = S().acusacao || {}; CRW.badge('acusacao', P.pc && a.aberta && !votos[P.pc] && CRW.moduloAtual() !== 'acusacao' ? 1 : 0); }
function sincAcus() {
  const a = S().acusacao || {};
  if (a.aberta && a.rodada && logado()) {
    if (rodadaAss !== a.rodada) {
      rodadaAss = a.rodada; votos = {}; votosCarregados = false;
      assinar('acusVotos', 'votos/acusacao/' + a.rodada, x => {
        const ant = votos; votos = x || {};
        if (P.mestre && votosCarregados) Object.keys(votos).filter(k => !ant[k]).forEach(k => CRW.alertaMestre(`${(votos[k] || {}).nome || k} votou na acusação (${Object.keys(votos).length}/${CRW.pcs().length}).`, 'acus-voto'));
        votosCarregados = true; CRW.emit('cmVotos', votos); badgeAcus();
      });
    }
  } else if (rodadaAss) { rodadaAss = null; desassinar('acusVotos'); votos = {}; CRW.emit('cmVotos', votos); }
  badgeAcus();
}
CRW.on('estado', sincAcus);
CRW.on('perfil', () => { rodadaAss = null; votos = {}; setTimeout(sincAcus, 0); });
CRW.on('modulo', badgeAcus);
const norm = t => semAcento(t).replace(/[^a-z0-9 ]/g, '').trim();
function contar(vs) {
  const out = {};
  ['quem', 'como', 'onde'].forEach(c => {
    const m = {};
    Object.values(vs || {}).forEach(v => { const t = String((v && v[c]) || '').trim(); if (!t) return; const k = norm(t); (m[k] = m[k] || { t, n: 0 }).n++; });
    out[c] = Object.values(m).sort((a, b) => b.n - a.n).map(x => [x.t, x.n]);
  });
  return out;
}
function tabelaVotos(vs, mostrar) {
  const l = Object.entries(vs || {}).filter(([, v]) => v);
  if (!l.length) return '<p class="vazio95">Nenhum voto.</p>';
  return `<table class="dtable cm-vt"><thead><tr><th>Investigador</th><th>Quem</th><th>Como</th><th>Onde</th></tr></thead><tbody>${l.map(([pc, v]) => `<tr><td>${esc(v.nome || (CRW.pc(pc) || {}).nome || pc)}</td>${mostrar ? `<td>${esc(v.quem || '')}</td><td>${esc(v.como || '')}</td><td>${esc(v.onde || '')}${v.nota ? `<div class="mini">${esc(v.nota)}</div>` : ''}</td>` : '<td colspan="3" class="dim">voto secreto</td>'}</tr>`).join('')}</tbody></table>`;
}
function htmlContagem(ct) {
  if (!ct) return '';
  return `<div class="cm-cont">${[['quem', 'Quem'], ['como', 'Como'], ['onde', 'Onde']].map(([k, n]) => `<div><div class="cm-cont-t">${n}</div>${(ct[k] || []).map(([t, q]) => `<div class="cm-cont-l"><span>${esc(t)}</span><b>${q}</b></div>`).join('') || '<div class="dim">sem respostas</div>'}</div>`).join('')}</div>`;
}
function htmlVeredito(r) {
  if (!r) return '';
  const [t, cor] = VEREDITO(r.certo);
  return `<div class="cm-ver ${cor}"><span class="cm-ver-car">${esc(t)}</span>
    <div class="cm-ver-l"><b>Quem:</b> ${esc(r.quem || '?')}</div><div class="cm-ver-l"><b>Como:</b> ${esc(r.como || '?')}</div><div class="cm-ver-l"><b>Onde:</b> ${esc(r.onde || '?')}</div>
    ${r.texto ? `<div class="cm-ver-txt">${md(r.texto)}</div>` : ''}</div>`;
}
const nomeTarefa = id => { const x = (tarefas().lista || {})[id]; return x ? `Tarefa ${x.n}${x.titulo ? ' · ' + x.titulo : ''}` : (id || ''); };
async function listasVoto() {
  let su = susp;
  if (!Object.keys(su || {}).length && logado()) su = (await Rede.once('caso/suspeitos').catch(() => null)) || {};
  const quem = [...new Set([...Object.values(su || {}).filter(Boolean).map(s => s.nome), ...CRW.npcs().filter(n => n.tipo !== 'viatura').map(n => n.nome)])];
  return { quem, onde: lotes().map(l => l.nome) };
}
function telaAcusacao(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Acusação final da Tarefa</h2><div class="meta" data-ac-meta></div></div><div class="panel-b">
    <div data-ac-corpo></div><div class="cm-sub">Histórico de acusações</div><div data-ac-hist></div></div></div>
    <datalist id="cmDlQuem"></datalist><datalist id="cmDlOnde"></datalist>`;
  const q = s => $(s, sec);
  listasVoto().then(l => { q('#cmDlQuem').innerHTML = l.quem.map(x => `<option value="${esc(x)}">`).join(''); q('#cmDlOnde').innerHTML = l.onde.map(x => `<option value="${esc(x)}">`).join(''); });
  const desenharVotos = () => {
    const a = S().acusacao || {}, v = CRW.v(), alvo = q('[data-ac-votos]'); if (!alvo || !a.aberta) return;
    const ps = CRW.pcs();
    alvo.innerHTML = `<div class="cm-sub">Quem já votou (${Object.keys(votos).length}/${ps.length})</div><div class="cm-votaram">${ps.map(p => `<span class="cm-vtd${votos[p.id] ? ' ok' : ''}">${votos[p.id] ? '✓' : '…'} ${esc(p.nome)}</span>`).join('') || '<span class="dim">Nenhum investigador cadastrado.</span>'}</div>
      ${v.mestre || v.aux ? `<div class="cm-sub">Votos (só o Guardião e os auxiliares veem antes do encerramento)</div>${tabelaVotos(votos, true)}` : ''}`;
    const meu = P.pc && votos[P.pc]; const st = q('[data-ac-meu]');
    if (st) st.innerHTML = meu ? `Seu voto está registrado: <b>${esc(meu.quem)}</b> · ${esc(meu.como)} · ${esc(meu.onde)}. Você pode mudar até o encerramento.` : 'Você ainda não votou.';
    const bt = q('[data-ac-votar]'); if (bt) bt.textContent = meu ? 'Mudar meu voto' : 'Registrar meu voto';
  };
  const desenhar = () => {
    const a = S().acusacao || {}, v = CRW.v(), hist = Object.entries(S().acusacoes || {}).map(([id, x]) => ({ id, ...x })).filter(x => x && x.ts).sort((x, y) => num(y.ts) - num(x.ts));
    q('[data-ac-meta]').innerHTML = a.aberta ? 'VOTAÇÃO ABERTA' : a.rodada && !a.resultado ? 'AGUARDANDO VEREDITO' : 'Formulário CCSO-33';
    let h = '';
    if (a.aberta) {
      const meu = (P.pc && votos[P.pc]) || {};
      h = `<div class="alert-box"><div class="al">Votação aberta · ${esc(nomeTarefa(a.tarefa))}</div><p>${a.enunciado ? md(a.enunciado) : 'O Círculo acusa: QUEM fez, COMO fez e ONDE. Cada investigador vota sozinho; os votos ficam secretos até o Guardião da Luz encerrar.'}</p></div>
        ${P.pc && !v.espiando ? `<div class="cm-voto">
          <label class="campo">QUEM<input class="w95-input" data-av="quem" list="cmDlQuem" maxlength="80" value="${esc(meu.quem || '')}" placeholder="nome do culpado"></label>
          <label class="campo">COMO<input class="w95-input" data-av="como" maxlength="160" value="${esc(meu.como || '')}" placeholder="método, arma, quem ajudou"></label>
          <label class="campo">ONDE<input class="w95-input" data-av="onde" list="cmDlOnde" maxlength="80" value="${esc(meu.onde || '')}" placeholder="local"></label>
          <label class="campo">Justificativa (opcional)<textarea class="w95-input" rows="2" data-av="nota" maxlength="400">${esc(meu.nota || '')}</textarea></label>
          <div class="linha95"><button class="w95-btn pri" data-ac-votar>Registrar meu voto</button></div><p class="mini" data-ac-meu></p></div>`
          : v.espiando ? '<p class="mini">Vendo pelos olhos de um investigador: o voto é feito no aparelho dele.</p>' : ''}
        <div data-ac-votos></div>`;
    } else if (a.rodada && !a.resultado) {
      const reg = (S().acusacoes || {})[a.rodada] || {};
      h = `<div class="box"><div class="bl">Votação encerrada · ${esc(nomeTarefa(a.tarefa))}</div><p>Aguardando o veredito do Guardião da Luz.</p></div>${htmlContagem(reg.contagem)}${tabelaVotos(reg.votos, true)}`;
    } else if (a.resultado) {
      const reg = (S().acusacoes || {})[a.rodada] || {};
      h = `<div class="box"><div class="bl">Veredito · ${esc(nomeTarefa(a.tarefa))}</div>${htmlVeredito(a.resultado)}</div>${htmlContagem(reg.contagem)}${tabelaVotos(reg.votos, true)}`;
    } else h = '<p class="tx">Nenhuma acusação aberta. Quando o Círculo estiver pronto para acusar, o Guardião da Luz abre a votação: cada investigador vota QUEM, COMO e ONDE, em segredo.</p>';
    q('[data-ac-corpo]').innerHTML = h + '<div class="linha95"><button class="w95-btn" data-rel>Relatório de Investigação (PDF)</button></div>';
    q('[data-ac-hist]').innerHTML = hist.length ? hist.map(x => `<details class="bloco95 cm-det"><summary>${esc(x.dataJogo || '')} · ${esc(x.titulo ? 'Tarefa ' + x.n + ' · ' + x.titulo : nomeTarefa(x.tarefa))} · ${esc(VEREDITO(x.resultado ? x.resultado.certo : undefined)[0])}</summary><div class="bloco95-c">${x.enunciado ? `<p class="mini">${md(x.enunciado)}</p>` : ''}${htmlVeredito(x.resultado)}${htmlContagem(x.contagem)}${tabelaVotos(x.votos, true)}</div></details>`).join('') : '<p class="vazio95">Nenhuma acusação registrada.</p>';
    desenharVotos();
  };
  desenhar();
  quandoMuda(sec, s => [s.acusacao, s.acusacoes], () => { if (!sec.querySelector('[data-av]:focus')) desenhar(); else desenharVotos(); });
  vivoOn('cmVotos', sec, desenharVotos);
  sec.addEventListener('click', e => {
    if (e.target.closest('[data-rel]')) return relatorio();
    if (!e.target.closest('[data-ac-votar]')) return;
    const a = S().acusacao || {}; if (!a.aberta || !P.pc) return;
    const g = k => ($(`[data-av="${k}"]`, sec).value || '').trim();
    const voto = { quem: g('quem'), como: g('como'), onde: g('onde'), nota: g('nota') || null, nome: quemSou(), ts: agora() };
    if (!voto.quem || !voto.como || !voto.onde) return aviso('Preencha QUEM, COMO e ONDE.', 'erro');
    Rede.set(`votos/acusacao/${a.rodada}/${P.pc}`, voto).then(() => { Som.ding(); aviso('Voto registrado. Fica secreto até o encerramento.'); }).catch(() => aviso('O servidor recusou o voto.', 'erro'));
  });
}
function blocoAcusacaoM(c) {
  const desenhar = () => {
    const a = S().acusacao || {}, t = tarefas(), l = ordenadas(t).filter(x => x.status !== 'bloqueada'), at = tarefaAtual(t);
    const hist = Object.entries(S().acusacoes || {}).map(([id, x]) => ({ id, ...x })).filter(x => x && x.ts).sort((x, y) => num(y.ts) - num(x.ts));
    let h = '';
    if (a.aberta) {
      h = `<p class="tx">Votação <b>aberta</b> · ${esc(nomeTarefa(a.tarefa))}. Os jogadores veem quem já votou, mas não o voto.</p><div data-am-votos>${tabelaVotos(votos, true)}</div>
        <div class="linha95"><button class="w95-btn pri" data-am="encerrar">Encerrar votação</button><button class="w95-btn perigo" data-am="anular">Anular rodada</button></div>`;
    } else if (a.rodada && !a.resultado) {
      const reg = (S().acusacoes || {})[a.rodada] || {}, ct = reg.contagem || {}, top = k => ((ct[k] || [])[0] || [''])[0];
      h = `<p class="tx">Votação encerrada · ${esc(nomeTarefa(a.tarefa))}. Todos já veem os votos. Agora defina o veredito.</p>${htmlContagem(ct)}
        <div class="grade2"><label class="campo">Quem (veredito)<input class="w95-input" data-vr="quem" value="${esc(top('quem'))}"></label><label class="campo">Como<input class="w95-input" data-vr="como" value="${esc(top('como'))}"></label><label class="campo">Onde<input class="w95-input" data-vr="onde" value="${esc(top('onde'))}"></label>
        <label class="campo">O Círculo acertou?<select class="w95-input" data-vr="certo"><option value="true">Sim · PROCEDENTE</option><option value="parcial">Em parte · PARCIALMENTE PROCEDENTE</option><option value="false">Não · IMPROCEDENTE</option></select></label></div>
        <label class="campo">Texto do veredito (o que todos leem; **negrito**)<textarea class="w95-input" rows="3" data-vr="texto"></textarea></label>
        <div class="linha95"><button class="w95-btn pri" data-am="veredito">Publicar veredito</button><button class="w95-btn" data-am="reabrir">Reabrir a votação</button></div>`;
    } else {
      h = `${a.resultado ? `<p class="mini">Último veredito (${esc(nomeTarefa(a.tarefa))}):</p>${htmlVeredito(a.resultado)}` : ''}
        <div class="grade2"><label class="campo">Tarefa<select class="w95-input" data-am-t>${l.map(x => `<option value="${esc(x.id)}"${at && at.id === x.id ? ' selected' : ''}>Tarefa ${int(x.n)} · ${esc(x.titulo || '')}</option>`).join('')}</select></label></div>
        <label class="campo">Enunciado (opcional; aparece para os jogadores)<textarea class="w95-input" rows="2" data-am-en placeholder="ex.: Quem é o dono do Chevette, como os corpos chegaram às malas e onde estavam antes?"></textarea></label>
        <div class="linha95"><button class="w95-btn pri" data-am="abrir">Abrir votação</button></div>`;
    }
    c.innerHTML = `<p class="mini">Abra quando o Círculo estiver pronto para acusar. Cada investigador vota QUEM, COMO e ONDE; os votos ficam secretos para os jogadores até você encerrar. Depois você publica o veredito, que fica no histórico.</p>${h}
      <div class="cm-sub">Histórico</div>${hist.length ? `<ul class="cm-sm-l">${hist.map(x => `<li><div><b>${esc(x.dataJogo || '')}</b> · ${esc(x.titulo ? 'Tarefa ' + x.n + ' · ' + x.titulo : x.tarefa)} <span class="etq ${VEREDITO(x.resultado ? x.resultado.certo : undefined)[1]}">${esc(VEREDITO(x.resultado ? x.resultado.certo : undefined)[0])}</span></div><button class="w95-btn perigo cm-mini-b" data-am-del="${esc(x.id)}">Apagar</button></li>`).join('')}</ul>` : '<p class="vazio95">Nenhuma acusação ainda.</p>'}`;
  };
  desenhar();
  quandoMuda(c, s => [s.acusacao, s.acusacoes, s.tarefas], () => { if (!c.querySelector('input:focus, textarea:focus, select:focus')) desenhar(); });
  vivoOn('cmVotos', c, () => { const x = $('[data-am-votos]', c); if (x) x.innerHTML = tabelaVotos(votos, true); });
  c.addEventListener('click', async e => {
    const del = e.target.closest('[data-am-del]'); if (del) { if (await confirmar('Apagar esta acusação do histórico?')) Estado.definir(['acusacoes', del.dataset.amDel], null); return; }
    const b = e.target.closest('[data-am]'); if (!b) return;
    const a = S().acusacao || {}, op = b.dataset.am;
    if (op === 'abrir') {
      const idT = $('[data-am-t]', c).value; if (!idT) return aviso('Nenhuma tarefa aberta.', 'erro');
      const rodada = 'r' + Date.now().toString(36);
      await Estado.definir(['acusacao'], { aberta: true, tarefa: idT, rodada, ts: agora(), enunciado: ($('[data-am-en]', c).value || '').trim() || null });
      CRW.diario('acusacao', 'Votação da acusação aberta: ' + nomeTarefa(idT)); aviso('Votação aberta.');
    }
    if (op === 'encerrar') {
      if (!(await confirmar(`Encerrar a votação?\n\n${Object.keys(votos).length} de ${CRW.pcs().length} investigadores votaram. Os votos passam a ser vistos por todos.`))) return;
      const vs = (await Rede.once('votos/acusacao/' + a.rodada).catch(() => null)) || votos || {};
      const x = (tarefas().lista || {})[a.tarefa] || {};
      await Estado.definir(['acusacoes', a.rodada], { tarefa: a.tarefa, n: x.n || null, titulo: x.titulo || null, rodada: a.rodada, ts: agora(), dataJogo: dataJogo(), enunciado: a.enunciado || null, votos: vs, contagem: contar(vs) });
      await Estado.definir(['acusacao'], { ...a, aberta: false, encerradaEm: agora() });
      CRW.diario('acusacao', `Votação encerrada (${Object.keys(vs).length} votos)`);
    }
    if (op === 'reabrir') { await Estado.definir(['acusacao'], { ...a, aberta: true, ts: agora() }); await Estado.definir(['acusacoes', a.rodada], null); }
    if (op === 'anular') {
      if (!(await confirmar('Anular esta rodada? Os votos são apagados e nada vai para o histórico.'))) return;
      await Rede.set('votos/acusacao/' + a.rodada, null).catch(() => {});
      await Estado.definir(['acusacao'], null); CRW.diario('acusacao', 'Rodada de acusação anulada');
    }
    if (op === 'veredito') {
      const g = k => ($(`[data-vr="${k}"]`, c).value || '').trim();
      const cv = g('certo');
      const res = { quem: g('quem'), como: g('como'), onde: g('onde'), certo: cv === 'true' ? true : cv === 'false' ? false : 'parcial', texto: g('texto') || null, ts: agora() };
      if (!(await confirmar(`Publicar o veredito: ${VEREDITO(res.certo)[0]}?\n\nTodas as telas mostram o carimbo.`))) return;
      await Estado.definir(['acusacoes', a.rodada, 'resultado'], res);
      await Estado.definir(['acusacao', 'resultado'], res);
      CRW.diario('acusacao', `Veredito: ${VEREDITO(res.certo)[0]} · quem: ${res.quem} · como: ${res.como} · onde: ${res.onde}`);
    }
  });
}

/* =========================================================
   33 · RELATÓRIO DE INVESTIGAÇÃO (Formulário CCSO-27)
   Junta tudo e manda para a "impressora matricial" (imprimir ou salvar em PDF).
   Lê caso/coleta, caso/contradicoes e caso/anotacoes se existirem (outros módulos).
   ========================================================= */
const CAMPOS_TXT = ['titulo', 'nome', 'item', 'evidencia', 'desc', 'descricao', 'texto', 'txt', 't', 'frase', 'nota', 'resumo', 'conteudo', 'obs'];
function lista(obj) {
  return Object.entries(obj || {}).filter(([, v]) => v != null).map(([k, v]) => (v && typeof v === 'object') ? { _k: k, ...v } : { _k: k, texto: String(v) }).sort((a, b) => num(a.ts) - num(b.ts));
}
function textoGen(o) { const ps = []; CAMPOS_TXT.forEach(c => { const v = o[c]; if (typeof v === 'string' && v.trim() && !ps.includes(v)) ps.push(v); }); return ps.map(tiraTags).join(' · ') || tiraTags(JSON.stringify(o)).slice(0, 240); }
const autorGen = o => o.por || o.porQuem || o.autor || o.quem || o.nome_pc || (o.pc && (CRW.pc(o.pc) || {}).nome) || '';
const localGen = o => { const l = o.lote || o.local || o.onde; return l ? nomeLote(l) : ''; };
const quandoGen = o => [o.d || o.data || '', o.h || o.hora || ''].join(' ').trim() || (o.ts ? new Date(num(o.ts)).toLocaleString('pt-BR') : '');
function htmlRelatorio(d, op) {
  op = op || {};
  const sec = k => op[k] !== false;
  const t = tarefas(), at = tarefaAtual(t), r = CRW.relogio(), ac = S().acusacao || {};
  const linhas = (cab, rows) => rows.length ? `<table><tr>${cab.map(c => `<th>${esc(c)}</th>`).join('')}</tr>${rows.map(rw => `<tr>${rw.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</table>` : '<p>Nada registrado.</p>';
  let n = 0; const h2 = t2 => `<h2>${++n}. ${esc(t2)}</h2>`;
  let html = `<style>.cm-r-ass{display:grid;grid-template-columns:repeat(2,1fr);gap:34px 30px;margin-top:40px}.cm-r-ass div{border-top:1px solid #222;padding-top:4px;text-align:center;font-size:11px}.cm-r-q{font-style:italic}</style>`;
  html += `${h2('Identificação do caso')}${linhas(['Campo', 'Valor'], [['Caso', CASO.numero], ['Classificação', CASO.classificacao], ['Situação', situacao()[0]], ['Aberto em', CASO.aberto], ['Responsável inicial', CASO.responsavel], ['Unidade', CASO.unidade || ''], ['Tarefa atual', at ? `${at.n} · ${at.titulo || ''}` : ''], ['Data do relatório (jogo)', `${r.data} ${pad2(r.h)}:${pad2(r.m)}`]].map(([a, b]) => [esc(a), esc(b)]))}`;
  if (sec('tarefas')) html += `${h2('Tarefas do Círculo')}${linhas(['Nº', 'Tarefa', 'Situação', 'Datas'], ordenadas(t).map(x => [String(int(x.n)), x.status === 'bloqueada' ? '(dossiê lacrado)' : esc(x.titulo || ''), esc((STATUS_T[x.status] || [''])[0]), esc([x.abertaEm ? 'aberta ' + x.abertaEm : '', x.concluidaEm ? 'concluída ' + x.concluidaEm : ''].filter(Boolean).join('; '))]))}`;
  if (sec('evidencias')) {
    html += `${h2('Evidências')}${linhas(['Item', 'Descrição', 'Situação'], (CASO.evidencias || []).map(e => [esc(e.id), esc(tiraTags(e.desc)), esc(e.status || '')]))}`;
    const co = lista(d.coleta);
    html += `<p><b>Coletas em campo (cadeia de custódia):</b></p>${linhas(['Item', 'Local', 'Quem coletou', 'Quando'], co.map(o => [esc(textoGen(o)), esc(localGen(o)), esc(autorGen(o)), esc(quandoGen(o))]))}`;
  }
  if (sec('suspeitos')) {
    const su = Object.entries(d.suspeitos || {}).filter(([, s]) => s);
    html += `${h2('Suspeitos')}${linhas(['Nome', 'Status', 'Motivo / Meios / Oportunidade', 'Notas'], su.map(([id, s]) => [esc(s.nome || ''), esc(ST[statusDe(id, s)]) + (oficial(id) ? ' (oficial)' : ''), [s.motivo ? '<b>Motivo:</b> ' + esc(s.motivo) : '', s.meios ? '<b>Meios:</b> ' + esc(s.meios) : '', s.oportunidade ? '<b>Oportunidade:</b> ' + esc(s.oportunidade) : ''].filter(Boolean).join('<br>'), esc(s.notas || '') + ((s.ligacoes || []).length ? `<br><i>Ligado a: ${esc(s.ligacoes.map(k => (d.suspeitos[k] || {}).nome || k).join(', '))}</i>` : '')]))}`;
  }
  if (sec('contradicoes')) html += `${h2('Contradições apontadas')}${linhas(['Contradição', 'Apontada por', 'Quando'], lista(d.contradicoes).map(o => [esc(textoGen(o)), esc(autorGen(o)), esc(quandoGen(o))]))}`;
  if (sec('anotacoes')) html += `${h2('Anotações do grupo')}${linhas(['Anotação', 'Autor', 'Quando'], lista(d.anotacoes).map(o => [esc(textoGen(o)), esc(autorGen(o)), esc(quandoGen(o))]))}`;
  if (sec('marcas')) {
    const mk = []; Object.entries(d.marcas || {}).forEach(([ed, ms]) => lista(ms).forEach(m => mk.push([esc(dataDeId(ed)), `<span class="cm-r-q">"${esc(m.txt || '')}"</span>${m.nota ? '<br>' + esc(m.nota) : ''}`, esc(m.por || '')])));
    html += `${h2('Imprensa: trechos suspeitos do Crowsrest Sentinel')}${linhas(['Edição', 'Trecho', 'Marcado por'], mk)}`;
  }
  if (sec('linha')) {
    const ev = [];
    (CASO.resumo.log || []).forEach(([h, txt]) => ev.push([`${CASO.dataInicial} ${/\d/.test(h) ? h : '(sem hora)'}`, tiraTags(txt)]));
    edicoes().forEach(e => ev.push([e.data, 'Crowsrest Sentinel: ' + tiraTags(e.manchete)]));
    ordenadas(t).forEach(x => { if (x.status === 'bloqueada') return; if (x.abertaEm) ev.push([x.abertaEm, `Aberta a Tarefa ${x.n} · ${x.titulo}`]); if (x.concluidaEm) ev.push([x.concluidaEm, `Concluída a Tarefa ${x.n} · ${x.titulo}`]); });
    lista(d.coleta).forEach(o => { if (o.d || o.data) ev.push([quandoGen(o), 'Coleta: ' + textoGen(o)]); });
    Object.values(S().acusacoes || {}).forEach(x => { if (x && x.dataJogo) ev.push([x.dataJogo, `Acusação (${x.titulo ? 'Tarefa ' + x.n : x.tarefa}): ${VEREDITO(x.resultado ? x.resultado.certo : undefined)[0]}`]); });
    ev.sort((a, b) => ordDataHora(a[0]).localeCompare(ordDataHora(b[0])));
    html += `${h2('Linha do tempo')}${linhas(['Quando', 'Evento'], ev.map(([a, b]) => [esc(a), esc(b)]))}`;
  }
  if (sec('acusacao')) {
    const hs = Object.values(S().acusacoes || {}).filter(x => x && x.ts).sort((a, b) => num(a.ts) - num(b.ts));
    html += `${h2('Acusação')}${ac.aberta ? '<p><b>Votação em andamento</b> (votos secretos até o encerramento).</p>' : ''}${hs.length ? hs.map(x => { const res = x.resultado; return `<p><b>${esc(x.dataJogo || '')} · ${esc(x.titulo ? 'Tarefa ' + x.n + ' · ' + x.titulo : x.tarefa)}</b> · Veredito: <b>${esc(VEREDITO(res ? res.certo : undefined)[0])}</b>${res ? `<br>Quem: ${esc(res.quem || '')} · Como: ${esc(res.como || '')} · Onde: ${esc(res.onde || '')}${res.texto ? '<br>' + esc(res.texto) : ''}` : ''}</p>${linhas(['Investigador', 'Quem', 'Como', 'Onde'], Object.entries(x.votos || {}).map(([pc, v]) => [esc(v.nome || pc), esc(v.quem || ''), esc(v.como || ''), esc(v.onde || '')]))}`; }).join('') : '<p>Nenhuma acusação formalizada.</p>'}`;
  }
  if (op.obs) html += `${h2('Observações do relator')}<p>${esc(op.obs).replace(/\n/g, '<br>')}</p>`;
  const ps = CRW.pcs();
  html += `<h2>Assinaturas</h2><p class="mini">Declaramos que as informações acima correspondem ao apurado até a data deste relatório.</p>
    <div class="cm-r-ass">${(ps.length ? ps.map(p => `${esc(p.nome)}<br>Investigador(a)${p.papel ? ' · ' + esc(p.papel) : ''}`) : ['Investigador(a)', 'Investigador(a)']).map(x => `<div>${x}</div>`).join('')}<div>Recebido por<br>Gabinete do Xerife do Condado</div></div>`;
  return html;
}
async function dadosRelatorio() {
  const ler = c => logado() ? Rede.once(c).catch(() => null) : Promise.resolve(null);
  const [coleta, contradicoes, anotacoes, suspeitos, marcas] = await Promise.all(['caso/coleta', 'caso/contradicoes', 'caso/anotacoes', 'caso/suspeitos', 'caso/sentinel/marcas'].map(ler));
  return { coleta, contradicoes, anotacoes, suspeitos, marcas };
}
async function relatorio(op) {
  const d = await dadosRelatorio();
  CRW.imprimir('Relatório de Investigação · CCSO-27', htmlRelatorio(d, op), { sub: 'Formulário CCSO-27 · Relatório de Investigação' });
  if (P.mestre) CRW.diario('relatorio', 'Relatório de Investigação (CCSO-27) emitido');
}
CRW.relatorioInvestigacao = Object.assign(relatorio, { html: async op => htmlRelatorio(await dadosRelatorio(), op) });
const SECOES_R = [['tarefas', 'Tarefas do Círculo'], ['evidencias', 'Evidências e coletas'], ['suspeitos', 'Suspeitos'], ['contradicoes', 'Contradições'], ['anotacoes', 'Anotações do grupo'], ['marcas', 'Trechos suspeitos do jornal'], ['linha', 'Linha do tempo'], ['acusacao', 'Acusação']];
function telaRelatorio(sec) {
  sec.innerHTML = `<div class="panel"><div class="panel-h"><h2>Relatório de Investigação</h2><div class="meta">Formulário CCSO-27</div></div><div class="panel-b">
    <p class="tx">Monta o relatório oficial do Círculo num formulário de 1997 e manda para a impressora matricial: no celular ou no computador, escolha "Salvar como PDF" na janela de impressão.</p>
    <div class="cm-sub">O que entra</div><div class="cm-r-chk">${SECOES_R.map(([k, n]) => `<label class="chk95"><input type="checkbox" data-r="${k}" checked> ${n}</label>`).join('')}</div>
    <p class="mini" data-r-cont></p>
    <label class="campo">Observações do relator (opcional)<textarea class="w95-input" rows="3" data-r-obs maxlength="1500"></textarea></label>
    <div class="linha95"><button class="w95-btn pri" data-r-ir>⎙ Imprimir ou salvar PDF</button></div>
    <p class="mini">Se nada abrir, o navegador bloqueou a janela: libere os pop-ups deste site e toque de novo.</p></div></div>`;
  const cont = async () => { const d = await dadosRelatorio(); if (!document.body.contains(sec)) return; const pl = (n, a, b) => `${n} ${n === 1 ? a : b}`; $('[data-r-cont]', sec).textContent = `Hoje: ${pl((CASO.evidencias || []).length, 'evidência do caso', 'evidências do caso')}, ${pl(lista(d.coleta).length, 'coleta em campo', 'coletas em campo')}, ${pl(Object.keys(d.suspeitos || {}).length, 'suspeito', 'suspeitos')}, ${pl(lista(d.contradicoes).length, 'contradição', 'contradições')}, ${pl(lista(d.anotacoes).length, 'anotação', 'anotações')}, ${pl(Object.keys(S().acusacoes || {}).length, 'acusação', 'acusações')}.`; };
  sec._cont = cont; cont();
  sec.addEventListener('click', e => { if (!e.target.closest('[data-r-ir]')) return; const op = { obs: ($('[data-r-obs]', sec).value || '').trim() }; $$('[data-r]', sec).forEach(x => { op[x.dataset.r] = x.checked; }); relatorio(op); });
}

/* =========================================================
   REGISTROS: módulos, painel do Mestre, ajuda, restauração
   ========================================================= */
const comLogin = v => !!(v.pc || v.mestre || v.aux);
CRW.registrarModulo({ id: 'tarefas', titulo: 'Tarefas (dossiês)', grupo: 'caso', icone: '⚑', ordem: 12, visivel: comLogin, render: telaTarefas });
CRW.registrarModulo({ id: 'jornal', titulo: 'Crowsrest Sentinel', grupo: 'caso', icone: '▦', ordem: 40, visivel: comLogin, render: telaSentinel });
CRW.registrarModulo({ id: 'relatorio-inv', titulo: 'Relatório (CCSO-27)', grupo: 'caso', icone: '⎙', ordem: 90, visivel: comLogin, render: telaRelatorio, aoAbrir: s => s._cont && s._cont() });
CRW.registrarModulo({ id: 'suspeitos', titulo: 'Quadro de suspeitos', grupo: 'investigacao', icone: '◎', ordem: 20, visivel: comLogin, render: telaSuspeitos });
CRW.registrarModulo({ id: 'acusacao', titulo: 'Acusação final', grupo: 'investigacao', icone: '⚖', ordem: 80, visivel: comLogin, render: telaAcusacao });
CRW.registrarModulo({ id: 'mensagens', titulo: 'Caixa de mensagens', grupo: 'pessoal', icone: '✉', ordem: 30, visivel: v => !!v.pc, render: telaMensagens, aoAbrir: () => { lidoAntes = num(ls.get('cmLido:' + P.pc, 0)); marcarLido(); CRW.emit('cmCaixa'); } });

CRW.registrarMestre({ id: 'cm-mensagens', aba: 'mesa', titulo: 'Pager, secretária e rádio', ordem: 20, render: blocoMensagensM });
CRW.registrarMestre({ id: 'cm-acusacao', aba: 'mesa', titulo: 'Acusação final da Tarefa', ordem: 40, render: blocoAcusacaoM });
CRW.registrarMestre({ id: 'cm-tarefas', aba: 'registro', titulo: 'Tarefas e dossiês', ordem: 10, render: blocoTarefasM });
CRW.registrarMestre({ id: 'cm-sentinel', aba: 'registro', titulo: 'Crowsrest Sentinel · editor', ordem: 20, render: blocoSentinelM });
CRW.registrarMestre({ id: 'cm-suspeitos', aba: 'registro', titulo: 'Quadro de suspeitos · status oficial', ordem: 30, render: blocoSuspeitosM });

CRW.registrarAjuda({ id: 'cm-tarefas', titulo: 'Tarefas e dossiês', ordem: 22, para: ['todos'], html: `
  <p><b>O que é:</b> em Candela Obscura o Círculo cumpre <b>tarefas</b>. O caso ${esc(CASO.numero)} é a <b>Tarefa 1 · O Chevette</b>. Cada tarefa é um dossiê (uma pasta de arquivo); quando uma é concluída, o próximo dossiê é aberto.</p>
  <p><b>Quem vê:</b> todos os que entraram no sistema. O cabeçalho do caso mostra a tarefa atual e a situação.</p>
  <ul><li><b>Jogador:</b> menu <i>Caso</i>, <i>Tarefas (dossiês)</i>. Toque numa pasta para ler o resumo e as acusações daquele dossiê. Uma pasta <b>lacrada</b> ainda não foi liberada: o título só aparece quando o Guardião da Luz abre.</li>
  <li><b>Guardião da Luz:</b> Painel, aba <i>Registro</i>, <i>Tarefas e dossiês</i>: mostrar lacrada, abrir dossiê, concluir (todas as telas, inclusive a TV, veem o carimbo CONCLUÍDA e você escolhe se o próximo dossiê já abre), reabrir, editar, criar nova tarefa e mudar a situação do cabeçalho.</li>
  <li><b>De onde vem:</b> o progresso fica em estado/tarefas. Os títulos e resumos das próximas tarefas e a nota só do Mestre ficam em segredos/tarefas (arquivo de sementes, aba Segredos).</li></ul>` });
CRW.registrarAjuda({ id: 'cm-mensagens', titulo: 'Pager, secretária eletrônica e rádio', ordem: 23, para: ['todos'], html: `
  <p><b>O que é:</b> o Guardião da Luz manda mensagens que chegam como num aparelho de 1997: <b>pager</b> (bipe e visor verde com o texto rolando), <b>secretária eletrônica</b> (o telefone toca, a luz pisca "1 mensagem"; ao tocar <i>Ouvir</i> aparece "Você tem uma nova mensagem" e a transcrição; dá para ouvir uma voz do navegador, às vezes distorcida) e <b>rádio da polícia</b> (chamado com chiado no meio da frase).</p>
  <ul><li><b>Jogador:</b> a mensagem aparece sozinha na sua tela. Tudo fica guardado em <i>Meu personagem</i>, <i>Caixa de mensagens</i> (o número vermelho no menu mostra as não lidas); toque numa mensagem para ver de novo. O botão <i>Voz</i> liga ou desliga a fala da secretária (a escolha fica no seu aparelho). A caixa fica guardada no seu aparelho.</li>
  <li><b>Transmissão geral:</b> quando o Guardião manda para <i>Todos</i>, o efeito aparece em todas as telas ao mesmo tempo, inclusive na TV, e entra na Caixa de todos.</li>
  <li><b>Guardião da Luz:</b> Painel, aba <i>Mesa</i>, <i>Pager, secretária e rádio</i>: escolha o aparelho, quem aparece como remetente, o texto e o destino (um ou mais investigadores, ou Todos). <i>Testar aqui</i> mostra o efeito só na sua tela. Há modelos rápidos, "Salvar como modelo" e o histórico do que você mandou (com <i>Reusar</i>). No rádio, use <b>~</b> para pôr um chiado onde quiser.</li>
  <li><b>De onde vem:</b> mensagens individuais passam por entregas/ (somem do servidor quando chegam); transmissões gerais em estado/transmissao e estado/transmissoes (últimas 30); seus modelos e o histórico em segredos/comunicacao.</li></ul>` });
CRW.registrarAjuda({ id: 'cm-sentinel', titulo: 'Crowsrest Sentinel diário', ordem: 24, para: ['todos'], html: `
  <p><b>O que é:</b> o jornal da cidade, uma edição por dia de jogo. A primeira é a de 21/05/1997, já anexada ao caso. Leia com atenção: o que o jornal diz (e o que deixa de dizer) pode importar.</p>
  <ul><li><b>Jogador:</b> menu <i>Caso</i>, <i>Crowsrest Sentinel</i>. Troque de edição com as setas, a lista ou "Todas as edições". Toque em <i>Marcar trechos suspeitos</i> e depois numa frase para destacá-la para todo o grupo; abaixo do jornal, cada trecho marcado aceita uma nota. Edição nova aparece com o número vermelho no menu.</li>
  <li><b>No mapa:</b> o cartão de um local lista as edições que citam aquele lugar; toque para abrir.</li>
  <li><b>Guardião da Luz:</b> Painel, aba <i>Registro</i>, <i>Crowsrest Sentinel · editor</i>: data, preço, manchete, matéria principal, segunda matéria, foto opcional (pesa: prefira pequenas), legenda e os locais citados. <i>Pré-visualizar</i>, <i>Salvar rascunho</i> (só você lê) e <i>Publicar</i>. Quando o relógio do jogo vira o dia, aparece um aviso perguntando se sai edição nova.</li>
  <li><b>De onde vem:</b> edições publicadas em estado/sentinel; rascunhos em segredos/sentinel (as sementes trazem edições prontas); marcas do grupo em caso/sentinel/marcas.</li></ul>` });
CRW.registrarAjuda({ id: 'cm-suspeitos', titulo: 'Quadro de suspeitos', ordem: 25, para: ['todos'], html: `
  <p><b>O que é:</b> um quadro de cortiça com fotos de ficha policial. Cada pessoa tem um carimbo de status: <b>procurado</b>, <b>interrogado</b>, <b>desaparecido</b>, <b>morto</b> ou <b>livre</b>. Fios vermelhos ligam pessoas relacionadas.</p>
  <ul><li><b>Jogador:</b> menu <i>Investigação do grupo</i>, <i>Quadro de suspeitos</i>. Começa vazio: o Círculo monta. Use <i>+ Pessoa de interesse</i> (Dale Renner), <i>+ Pessoa conhecida</i> (NPCs públicos) ou <i>+ Outra pessoa</i>. Toque numa ficha para mudar foto, status, motivo, meios, oportunidade, notas e ligações. Qualquer investigador edita; o site guarda quem mexeu por último.</li>
  <li><b>Guardião da Luz:</b> na ficha (ou no Painel, aba <i>Registro</i>, <i>Quadro de suspeitos · status oficial</i>) você fixa o <b>status oficial</b>: ele aparece com ★ e o grupo não consegue trocar.</li>
  <li><b>De onde vem:</b> caso/suspeitos (o grupo grava); status oficial em estado/suspeitos (só o Mestre grava).</li></ul>` });
CRW.registrarAjuda({ id: 'cm-acusacao', titulo: 'Acusação final da Tarefa', ordem: 26, para: ['todos'], html: `
  <p><b>O que é:</b> o fechamento de cada tarefa. O Círculo acusa <b>QUEM</b> fez, <b>COMO</b> fez e <b>ONDE</b>. O voto é secreto até o Guardião da Luz encerrar; depois todos veem a contagem e o veredito (procedente, parcialmente procedente ou improcedente).</p>
  <ul><li><b>Jogador:</b> quando a votação abre, aparece um carimbo na tela e o número vermelho em <i>Acusação final</i>. Preencha os três campos (as listas sugerem nomes do quadro e locais da cidade) e toque em <i>Registrar meu voto</i>. Dá para mudar até o encerramento. Os outros veem só que você votou.</li>
  <li><b>Guardião da Luz:</b> Painel, aba <i>Mesa</i>, <i>Acusação final da Tarefa</i>: escolha a tarefa, escreva um enunciado se quiser e abra. Você vê os votos ao vivo e recebe um aviso a cada voto. <i>Encerrar</i> revela os votos a todos; então defina o veredito (o campo já vem com o mais votado) e publique: todas as telas mostram o carimbo. Tudo fica no histórico e no dossiê da tarefa.</li>
  <li><b>De onde vem:</b> estado/acusacao (rodada aberta e veredito), votos/acusacao/&lt;rodada&gt; (os votos), estado/acusacoes (histórico).</li>
  <li><b>Atenção:</b> o segredo do voto é garantido pela tela, não pelo servidor: quem souber abrir as ferramentas do navegador consegue ler os votos. Entre amigos de mesa, basta.</li></ul>` });
CRW.registrarAjuda({ id: 'cm-relatorio', titulo: 'Relatório de Investigação (PDF)', ordem: 27, para: ['todos'], html: `
  <p><b>O que é:</b> o relatório oficial do Círculo no <b>Formulário CCSO-27</b>, impresso na "impressora matricial" do SIIC: identificação do caso, tarefas, evidências e coletas em campo, suspeitos e status, contradições, anotações do grupo, trechos suspeitos do jornal, linha do tempo, acusações e campos de assinatura de cada investigador.</p>
  <ul><li><b>Todos:</b> menu <i>Caso</i>, <i>Relatório (CCSO-27)</i>; o mesmo botão aparece nas telas de Tarefas, Suspeitos e Acusação. Escolha as seções, escreva observações e toque em <i>Imprimir ou salvar PDF</i>. Na janela de impressão, escolha "Salvar como PDF". Se nada abrir, libere os pop-ups do site.</li>
  <li><b>De onde vem:</b> dados do caso (dados.js) e tudo o que o grupo construiu no servidor (caso/...). Segredos do Mestre nunca entram.</li></ul>` });

CRW.registrarRestauracao({ id: 'cm-tarefas', nome: 'Tarefas: progresso dos dossiês (volta à Tarefa 1)', padrao: false, estado: ['tarefas'] });
CRW.registrarRestauracao({ id: 'cm-mensagens', nome: 'Transmissões gerais e histórico de pager/secretária/rádio', padrao: true, estado: ['transmissao', 'transmissoes'], seg: ['comunicacao/historico'] });
CRW.registrarRestauracao({ id: 'cm-sentinel', nome: 'Crowsrest Sentinel: edições publicadas e marcas do grupo (os rascunhos ficam)', padrao: false, estado: ['sentinel'], nos: ['caso/sentinel'] });
CRW.registrarRestauracao({ id: 'cm-suspeitos', nome: 'Quadro de suspeitos e status oficiais', padrao: true, estado: ['suspeitos'], nos: ['caso/suspeitos'] });
CRW.registrarRestauracao({ id: 'cm-acusacao', nome: 'Acusações: votação, votos e histórico', padrao: true, estado: ['acusacao', 'acusacoes'], nos: ['votos/acusacao'] });
// cada aparelho limpa o que guarda localmente quando o Mestre restaura
CRW.on('restaurado', r => {
  const it = (r && r.itens) || [];
  if (it.includes('cm-mensagens')) { try { Object.keys(localStorage).filter(k => /^crw-(caixa:|cmLido:)/.test(k)).forEach(k => localStorage.removeItem(k)); } catch (e) {} badgeMensagens(); }
  if (it.includes('cm-sentinel')) { ls.del('cmSentVistas'); ls.del('cmSentAvisadas'); badgeSentinel(); }
});

/* ---------- API pública deste módulo ---------- */
CRW.Tarefas = { estado: tarefas, lista: ordenadas, atual: tarefaAtual, situacao };
CRW.Comunicacao = { tocar: (m, fim) => enfileirar(f => tocar(m, () => { f(); fim && fim(); })), enviar: enviarMsg, caixa: itensCaixa, TIPOS };
CRW.Suspeitos = { lista: () => copia(susp), STATUS: ST };
CRW.Acusacao = { estado: () => S().acusacao || null, votos: () => copia(votos), contar };
})();
