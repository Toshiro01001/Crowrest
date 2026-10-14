/* =========================================================
   CROWSREST · mestre.js
   Painel do Guardião da Luz: personagens, quem está conectado,
   ver pelos olhos de um jogador, tela de TV, diário e relatório da
   sessão, backup, restaurar e importação dos segredos.
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela } = CRW;
const ehM = () => CRW.P.mestre;

/* ---------- o módulo do painel ---------- */
CRW.registrarModulo({ id: 'mestre', titulo: 'Painel do Guardião', grupo: 'mestre', icone: '☼', ordem: 1,
  visivel: () => CRW.P.mestre || CRW.P.aux, render: sec => CRW.renderMestre(sec) });
CRW.on('segredos', () => {});

/* =========================================================
   PERSONAGENS (investigadores)
   ========================================================= */
const CORES = ['#c0392b', '#2e86c1', '#27ae60', '#d4ac0d', '#8e44ad', '#d35400', '#16a085', '#7f8c8d'];
function slug(t) { return String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 16) || 'pc' + Date.now().toString(36).slice(-4); }
function posInicial(i) { if (CRW.Mapa && typeof LOTES !== 'undefined') return CRW.Mapa.frente(LOTES.find(x => x.id === 'delegacia'), i); const l = (typeof LOTES !== 'undefined' ? LOTES : []).find(x => x.id === 'delegacia'); const x = l ? l.x + 1 + (i % 4) * 1.3 : 30, y = l ? l.y + l.h + 0.9 + Math.floor(i / 4) * 1 : 30; return { x: +x.toFixed(2), y: +y.toFixed(2) }; }
function blocoPersonagens(c) {
  const desenhar = () => {
    const l = CRW.pcs();
    c.innerHTML = `<p class="mini">Cada investigador entra no site escolhendo o próprio nome na tela de acesso. Cadastrar cria também a peça dele no mapa, na frente da delegacia.</p>
      <table class="dtable"><thead><tr><th>Nome</th><th>Jogador</th><th style="width:150px"></th></tr></thead><tbody>
      ${l.map(p => `<tr><td><span class="pc-cor" style="background:${esc(p.cor || '#888')}"></span> <b>${esc(p.nome)}</b>${p.papel ? `<br><span class="mini">${esc(p.papel)}${p.esp ? ' · ' + esc(p.esp) : ''}</span>` : ''}</td><td>${esc(p.jogador || '')}</td>
        <td><button class="w95-btn" data-pc-ed="${esc(p.id)}">Editar</button> <button class="w95-btn perigo" data-pc-del="${esc(p.id)}">×</button></td></tr>`).join('') || '<tr><td colspan="3" class="vazio95">Nenhum investigador cadastrado.</td></tr>'}
      </tbody></table>
      <div class="linha95"><button class="w95-btn pri" data-pc-novo>+ Novo investigador</button></div>`;
  };
  desenhar();
  const off = CRW.on('estado', () => { if (document.body.contains(c) && !c.querySelector(':focus')) desenhar(); });
  c.addEventListener('click', async e => {
    const ed = e.target.closest('[data-pc-ed]'), del = e.target.closest('[data-pc-del]'), novo = e.target.closest('[data-pc-novo]');
    if (novo || ed) editarPC(ed ? ed.dataset.pcEd : null);
    if (del) {
      const p = CRW.pc(del.dataset.pcDel);
      if (p && await confirmar(`Apagar o investigador ${p.nome}?\n\nA peça sai do mapa. A ficha dele continua salva com o jogador.`)) {
        Estado.definir(['pcs', p.id], null); Estado.definir(['tokens', p.id], null); CRW.diario('mesa', 'Investigador apagado: ' + p.nome);
      }
    }
  });
  void off;
}
function editarPC(id) {
  const p = id ? CRW.pc(id) : { nome: '', jogador: '', cor: CORES[CRW.pcs().length % CORES.length], papel: '', esp: '', foto: '' };
  const papeis = (typeof CANDELA !== 'undefined' ? CANDELA.papeis : []);
  const w = janela({ titulo: id ? 'Editar investigador' : 'Novo investigador', largura: '420px', html: `
    <label class="campo">Nome do personagem<input class="w95-input" data-f="nome" value="${esc(p.nome)}" maxlength="40"></label>
    <label class="campo">Jogador(a)<input class="w95-input" data-f="jogador" value="${esc(p.jogador || '')}" maxlength="40"></label>
    <div class="grade2"><label class="campo">Papel<input class="w95-input" data-f="papel" list="dlPapeis" value="${esc(p.papel || '')}"></label>
    <label class="campo">Especialidade<input class="w95-input" data-f="esp" list="dlEsp" value="${esc(p.esp || '')}"></label></div>
    <datalist id="dlPapeis">${papeis.map(x => `<option value="${esc(x.nome)}">`).join('')}</datalist>
    <datalist id="dlEsp">${papeis.flatMap(x => x.esp).map(x => `<option value="${esc(x)}">`).join('')}</datalist>
    <label class="campo">Cor no mapa<input class="w95-input" data-f="cor" type="color" value="${esc(p.cor || '#c0392b')}"></label>
    <label class="campo">Retrato (opcional)<input type="file" accept="image/*" data-f="foto"></label>
    ${p.foto ? `<img src="${esc(p.foto)}" alt="" style="width:64px;height:64px;object-fit:cover;border:2px inset #fff">` : ''}
    <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  let foto = p.foto || '';
  $('[data-f="foto"]', w).addEventListener('change', async e => { try { foto = await CRW.lerImagem(e.target.files[0], 240, 0.8); aviso('Retrato carregado.'); } catch (er) { aviso('Imagem inválida.', 'erro'); } });
  $('[data-ok]', w).addEventListener('click', () => {
    const g = k => ($(`[data-f="${k}"]`, w).value || '').trim();
    const nome = g('nome'); if (!nome) return aviso('Dê um nome ao investigador.', 'erro');
    let nid = id || slug(nome); if (!id && CRW.pc(nid)) nid += Date.now().toString(36).slice(-3);
    const dado = { nome, jogador: g('jogador'), cor: g('cor'), papel: g('papel'), esp: g('esp'), foto: foto || null, ordem: id ? (p.ordem || 0) : CRW.pcs().length + 1 };
    Estado.definir(['pcs', nid], dado);
    if (!id) { const pos = posInicial(CRW.pcs().length); Estado.definir(['tokens', nid], { id: nid, tipo: 'pc', loc: 'c', x: pos.x, y: pos.y }); }
    CRW.diario('mesa', (id ? 'Investigador editado: ' : 'Investigador cadastrado: ') + nome);
    fecharJanela(w.parentElement.dataset.jan);
  });
}

/* =========================================================
   QUEM ESTÁ CONECTADO · VER PELOS OLHOS · TV
   ========================================================= */
let presenca = {};
Rede.on('presenca', x => { presenca = x || {}; CRW.emit('presenca', presenca); });
function blocoConectados(c) {
  const desenhar = () => {
    const agora = Date.now();
    const l = Object.entries(presenca).filter(([, x]) => x && agora - num(x.ts) < 120000);
    c.innerHTML = l.length ? `<ul class="lista-con">${l.map(([id, x]) => `<li><span class="ponto-vivo"></span>${esc(x.n || id)}</li>`).join('')}</ul>` : '<p class="vazio95">Ninguém conectado agora.</p>';
  };
  desenhar(); const t = setInterval(() => { if (!document.body.contains(c)) return clearInterval(t); desenhar(); }, 15000);
  CRW.on('presenca', () => { if (document.body.contains(c)) desenhar(); });
}
function blocoEspiar(c) {
  const l = CRW.pcs();
  c.innerHTML = `<p class="mini">Mostra o site como um investigador vê (só na sua tela). Os segredos somem até você voltar.</p>
    <div class="linha95"><select class="w95-input" data-esp>${l.map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('')}</select>
    <button class="w95-btn" data-esp-ir ${l.length ? '' : 'disabled'}>Ver pelos olhos</button></div>
    <p class="mini" style="margin-top:10px">Tela de TV: só o mapa, com a visão dos jogadores, para projetar na mesa.</p>
    <div class="linha95"><button class="w95-btn" data-tv>Abrir a tela de TV</button></div>`;
  c.addEventListener('click', e => {
    if (e.target.closest('[data-esp-ir]')) espiar($('[data-esp]', c).value);
    if (e.target.closest('[data-tv]')) window.open(location.pathname + '?tv=1', '_blank');
  });
}
function espiar(id) {
  CRW.P.espiar = id || null;
  document.body.classList.toggle('espiando', !!id);
  let f = $('#faixaEspiar');
  if (!f) { f = el('div', 'faixa-espiar'); f.id = 'faixaEspiar'; document.body.appendChild(f); }
  f.hidden = !id;
  if (id) { f.innerHTML = `Vendo pelos olhos de <b>${esc((CRW.pc(id) || {}).nome || id)}</b> · <button class="w95-btn">Voltar à visão do Mestre</button>`; $('button', f).onclick = () => espiar(null); }
  CRW.emit('perfil', CRW.v());
  $$('#modulos > .mod').forEach(s => s.remove());
  CRW.montarMenu();
  CRW.abrirModulo(id ? 'mapa' : 'mestre', true);
}
CRW.espiar = espiar;

/* =========================================================
   DIÁRIO E RELATÓRIO DA SESSÃO
   ========================================================= */
function blocoDiario(c) {
  const ses = () => (Estado.get().sessao || {});
  const desenhar = () => {
    const sid = CRW.sessaoId(), d = Segredos.ler(['_diario', sid]) || {};
    const ls = Object.values(d).sort((a, b) => num(a.ts) - num(b.ts));
    c.innerHTML = `<p class="mini">Anota sozinho o que acontece na mesa (movimentos, revelações, rolagens, avisos). Só você lê.</p>
      <div class="linha95"><span class="etq azul">${esc(ses().nome || 'Sessão sem nome')}</span><span class="mini">${ls.length} registros</span></div>
      <div class="linha95"><button class="w95-btn" data-ses-nova>Marcar nova sessão</button><button class="w95-btn" data-ses-txt>Baixar diário (.txt)</button><button class="w95-btn" data-ses-rel>Relatório da sessão (imprimir ou PDF)</button></div>
      <ol class="diario95">${ls.slice(-80).reverse().map(x => `<li><span class="ts">${esc(x.d || '')} ${esc(x.h || '')}</span> <span class="etq">${esc(x.t)}</span> ${esc(x.x)}</li>`).join('') || '<li class="vazio95">Nada anotado nesta sessão.</li>'}</ol>`;
  };
  desenhar();
  CRW.on('segredos', () => { if (document.body.contains(c)) desenhar(); });
  c.addEventListener('click', async e => {
    if (e.target.closest('[data-ses-nova]')) {
      const nome = await pedirTexto('Nome da nova sessão (ex.: Sessão 2 · Noite na Hollow Mill)', '');
      if (nome === null) return;
      Estado.definir(['sessao'], { id: 's' + Date.now().toString(36), nome: nome.trim() || 'Sessão', inicio: Date.now() });
      setTimeout(() => CRW.diario('sessao', 'Início: ' + (nome || 'Sessão')), 200);
    }
    if (e.target.closest('[data-ses-txt]')) {
      const d = Object.values(Segredos.ler(['_diario', CRW.sessaoId()]) || {}).sort((a, b) => num(a.ts) - num(b.ts));
      CRW.baixar(`diario-${CRW.sessaoId()}.txt`, `DIÁRIO DA SESSÃO · ${ses().nome || ''}\n\n` + d.map(x => `[${x.d || ''} ${x.h || ''}] (${x.t}) ${x.x}`).join('\n'));
    }
    if (e.target.closest('[data-ses-rel]')) relatorioSessao();
  });
}
async function relatorioSessao() {
  const sid = CRW.sessaoId(), d = Object.values(Segredos.ler(['_diario', sid]) || {}).sort((a, b) => num(a.ts) - num(b.ts));
  const chat = Object.values((await Rede.once('chat/geral').catch(() => null)) || {}).sort((a, b) => num(a.ts) - num(b.ts)).filter(m => num(m.ts) >= num((Estado.get().sessao || {}).inicio));
  const tipos = {}; d.forEach(x => { tipos[x.t] = (tipos[x.t] || 0) + 1; });
  const corpo = `<h2>Resumo</h2><p>${esc((Estado.get().sessao || {}).nome || 'Sessão')} · ${d.length} registros no diário · ${chat.length} mensagens no chat geral.</p>
    <table><tr>${Object.keys(tipos).map(t => `<th>${esc(t)}</th>`).join('')}</tr><tr>${Object.values(tipos).map(n => `<td>${n}</td>`).join('')}</tr></table>
    <h2>Diário</h2>${d.map(x => `<div>[${esc(x.h || '')}] <b>${esc(x.t)}</b> · ${esc(x.x)}</div>`).join('') || '<p>Nada anotado.</p>'}
    <h2>Chat geral</h2>${chat.map(m => `<div>[${esc(m.h || '')}] <b>${esc(m.n || '')}</b>: ${esc(m.t || '')}</div>`).join('') || '<p>Sem mensagens.</p>'}
    <div class="ass"><div>Guardião da Luz</div></div>`;
  CRW.imprimir('Relatório da sessão', corpo, { sub: 'Relatório interno de sessão · uso do Mestre' });
}

/* =========================================================
   BACKUP, RESTAURAR, IMPORTAR SEGREDOS, HASH
   ========================================================= */
const NOS = ['estado', 'segredos', 'privado', 'caso', 'pedidos', 'votos', 'rolagens', 'entregas', 'conqJog', 'chat', 'fichas'];
// o que "Restaurar" pode zerar; módulos acrescentam itens com CRW.registrarRestauracao
[
  { id: 'mapa', nome: 'Mapa e jogo (peças, névoa, relógio, clima, bloqueios, faixas)', padrao: true, estado: ['tokens', 'rev', 'lotesRev', 'relogio', 'clima', 'bloqueios', 'sinais', 'rondas', 'persg', 'apagao', 'luz'], priv: ['tokens'] },
  { id: 'chat', nome: 'Chat, rádio e sussurros', padrao: true, nos: ['chat'] },
  { id: 'grupo', nome: 'Investigação do grupo (mural, anotações, marcadores, anexos, marcas nas fotos)', padrao: true, nos: ['caso'] },
  { id: 'pedidos', nome: 'Pedidos, votos e rolagens', padrao: true, nos: ['pedidos', 'votos', 'rolagens'] },
  { id: 'entregas', nome: 'Entregas pendentes aos jogadores', padrao: true, nos: ['entregas'] },
  { id: 'diario', nome: 'Diário do Mestre', padrao: true, seg: ['_diario', '_mov'] },
].forEach(r => CRW.registrarRestauracao(r));
const RESTAURA_L = () => CRW.restauracoes();
async function backupCompleto() {
  const dados = {};
  for (const n of NOS) dados[n] = await Rede.once(n).catch(() => null);
  return { formato: 'crowsrest-backup', versao: 1, ts: Date.now(), raiz: CRW.RAIZ, dados };
}
function blocoBackup(c) {
  c.innerHTML = `<p class="mini">O backup baixa tudo (mapa, segredos, chat, fichas dos jogadores, investigação do grupo) num arquivo .json. Guarde fora do GitHub: ele tem os segredos.</p>
    <div class="linha95"><button class="w95-btn pri" data-bk>Baixar backup</button><button class="w95-btn" data-rs>Restaurar backup…</button><input type="file" accept=".json,application/json" data-rs-arq hidden></div>
    <p class="mini" style="margin-top:10px">"Restaurar o site" apaga o que foi feito nos testes. Antes de apagar, o site baixa um backup completo. Personagens, segredos e fichas dos jogadores ficam.</p>
    <div class="linha95"><button class="w95-btn perigo" data-zera>Restaurar o site…</button></div>`;
  c.addEventListener('click', async e => {
    if (e.target.closest('[data-bk]')) { const b = await backupCompleto(); CRW.baixar(`backup-crowsrest-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(b), 'application/json'); aviso('Backup baixado. Guarde fora do GitHub.'); }
    if (e.target.closest('[data-rs]')) $('[data-rs-arq]', c).click();
    if (e.target.closest('[data-zera]')) restaurarSite();
  });
  $('[data-rs-arq]', c).addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let b; try { b = JSON.parse(await CRW.lerTexto(f)); } catch (er) { return aviso('Arquivo inválido.', 'erro'); }
    if (!b || b.formato !== 'crowsrest-backup' || !b.dados) return aviso('Este arquivo não é um backup do Crowsrest.', 'erro');
    if (!(await confirmar(`Restaurar o backup de ${new Date(b.ts).toLocaleString('pt-BR')}?\n\nTudo o que está no site agora será trocado pelo conteúdo do arquivo.`))) return;
    for (const n of NOS) if (n in b.dados) await Rede.set(n, b.dados[n]).catch(() => {});
    aviso('Backup restaurado.'); CRW.diario('sistema', 'Backup restaurado');
  });
}
async function restaurarSite() {
  const w = janela({ titulo: 'Restaurar o site', largura: '480px', html: `<p class="tx">Marque o que zerar. Personagens, segredos (locais, NPCs, senhas) e as fichas dos jogadores <b>não</b> são apagados. Antes de apagar, o site baixa um backup completo.</p>
    ${RESTAURA_L().map(r => `<label class="chk95"><input type="checkbox" data-r="${r.id}" ${r.padrao ? 'checked' : ''}> ${esc(r.nome)}</label>`).join('')}
    <label class="campo" style="margin-top:10px">Para confirmar, digite RESTAURAR<input class="w95-input" data-conf></label>
    <div class="msg-bts"><button class="w95-btn perigo" data-ir>Restaurar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  $('[data-ir]', w).addEventListener('click', async () => {
    if ($('[data-conf]', w).value.trim().toUpperCase() !== 'RESTAURAR') return aviso('Digite RESTAURAR para confirmar.', 'erro');
    const marcados = RESTAURA_L().filter(r => $(`[data-r="${r.id}"]`, w).checked);
    const b = await backupCompleto(); CRW.baixar(`backup-antes-de-restaurar-${Date.now()}.json`, JSON.stringify(b), 'application/json');
    for (const r of marcados) {
      for (const n of r.nos || []) await Rede.set(n, null).catch(() => {});
      for (const k of r.estado || []) await Rede.set('estado/' + k, null).catch(() => {});
      for (const k of r.priv || []) await Rede.set('privado/' + k, null).catch(() => {});
      for (const k of r.seg || []) await Rede.set('segredos/' + k, null).catch(() => {});
      if (r.fazer) { try { await r.fazer(); } catch (er) {} }
    }
    // peças dos investigadores voltam para a frente da delegacia
    if (marcados.some(r => r.id === 'mapa')) CRW.pcs().forEach((p, i) => { const pos = posInicial(i); Estado.definir(['tokens', p.id], { id: p.id, tipo: 'pc', loc: 'c', x: pos.x, y: pos.y }); });
    Estado.definir(['restauracao'], { ts: Date.now(), itens: marcados.map(r => r.id) });
    fecharJanela(w.parentElement.dataset.jan);
    aviso('Site restaurado. O backup foi baixado.');
  });
}
// cada aparelho, ao ver uma restauração nova, limpa o que guarda localmente
CRW.on('estado', s => {
  const r = s.restauracao; if (!r || !r.ts) return;
  if (CRW.ls.get('restauracaoVista', 0) >= r.ts) return;
  CRW.ls.set('restauracaoVista', r.ts);
  ['vistos', 'cfgLocal'].forEach(k => CRW.ls.del(k));
  CRW.emit('restaurado', r);
});

function blocoImportar(c) {
  c.innerHTML = `<p class="mini">Os segredos (o que existe em cada local, nas salas internas, nos NPCs, senhas dos subsolos, conquistas) não ficam no código do site. Ficam num arquivo .json fora do GitHub. Importe aqui; eles vão para a área que só você lê.</p>
    <div class="linha95"><button class="w95-btn pri" data-imp>Importar segredos…</button><button class="w95-btn" data-exp>Exportar segredos</button><input type="file" accept=".json,application/json" data-imp-arq hidden></div>
    <p class="mini" data-imp-st></p>`;
  const st = $('[data-imp-st]', c);
  const contar = () => { const s = Segredos.dados || {}; st.textContent = `Hoje no servidor: ${Object.keys(s.lotes || {}).length} locais com segredo, ${Object.keys(s.salas || {}).length} prédios com salas descritas, ${Object.keys(s.npcs || {}).length} NPCs fichados.`; };
  contar(); CRW.on('segredos', () => { if (document.body.contains(c)) contar(); });
  c.addEventListener('click', async e => {
    if (e.target.closest('[data-imp]')) $('[data-imp-arq]', c).click();
    if (e.target.closest('[data-exp]')) { const s = await Rede.once('segredos').catch(() => null); CRW.baixar('segredos-crowsrest.json', JSON.stringify({ formato: 'crowsrest-segredos', segredos: s || {} }, null, 1), 'application/json'); }
  });
  $('[data-imp-arq]', c).addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    let o; try { o = JSON.parse(await CRW.lerTexto(f)); } catch (er) { return aviso('Arquivo inválido.', 'erro'); }
    const seg = o && (o.segredos || o); if (!seg || typeof seg !== 'object') return aviso('Arquivo sem segredos.', 'erro');
    const ks = Object.keys(seg).filter(k => k !== 'formato');
    if (!(await confirmar(`Importar ${ks.length} grupos de segredos (${ks.join(', ')})?\n\nO que já existe com o mesmo nome é substituído; o resto fica.`))) return;
    for (const k of ks) {
      const atual = Segredos.ler([k]);
      const novo = (atual && typeof atual === 'object' && typeof seg[k] === 'object' && !Array.isArray(seg[k])) ? { ...atual, ...seg[k] } : seg[k];
      await Segredos.gravar([k], novo);
    }
    aviso('Segredos importados.'); CRW.diario('sistema', 'Segredos importados: ' + ks.join(', '));
  });
}
function blocoHash(c) {
  c.innerHTML = `<p class="mini">Só para o modo local (sem internet): gere a "impressão digital" de uma senha e cole no config.js. Com o Firebase, o Mestre entra com o e-mail e a senha da conta.</p>
    <div class="linha95"><input class="w95-input" type="password" data-h placeholder="senha"><button class="w95-btn" data-hb>Gerar hash</button></div><code class="hash95" data-hr></code>`;
  $('[data-hb]', c).addEventListener('click', async () => { $('[data-hr]', c).textContent = await CRW.hash($('[data-h]', c).value || ''); });
}

CRW.registrarMestre({ id: 'pcs', aba: 'mapa', titulo: 'Personagens (investigadores)', ordem: 1, render: blocoPersonagens });
CRW.registrarMestre({ id: 'conectados', aba: 'mapa', titulo: 'Quem está conectado', ordem: 2, aux: true, render: blocoConectados });
CRW.registrarMestre({ id: 'espiar', aba: 'mesa', titulo: 'Ver pelos olhos de · Tela de TV', ordem: 90, render: blocoEspiar });
CRW.registrarMestre({ id: 'diario', aba: 'sessao', titulo: 'Diário e relatório da sessão', ordem: 90, render: blocoDiario });
CRW.registrarMestre({ id: 'importar', aba: 'segredos', titulo: 'Segredos (importar e exportar)', ordem: 1, render: blocoImportar });
CRW.registrarMestre({ id: 'backup', aba: 'segredos', titulo: 'Backup e Restaurar', ordem: 80, render: blocoBackup });
CRW.registrarMestre({ id: 'hash', aba: 'segredos', titulo: 'Gerar hash de senha (modo local)', ordem: 95, render: blocoHash });
})();
CRW.registrarAjuda({ id: 'g-checklist', titulo: 'Guardião: preparar a primeira sessão', ordem: 79, para: ['mestre'], html: `
  <ol>
    <li><b>Entre</b> como Guardião da Luz (e-mail e senha da conta do Mestre).</li>
    <li>Painel, aba <b>Segredos</b>: <b>Importar segredos…</b> com o arquivo <b>segredos-crowsrest.json</b> (fica fora do GitHub). Ele traz o segredo de cada local e sala, gatilhos, testemunhas, rotinas dos NPCs, fichas de NPC, modelos do laboratório, registros SELADOS do terminal, documentos do Arquivo do Condado, as tarefas 2 a 4, rascunhos do Sentinel, modelos de mensagem, limiares da Sangria, modelos dos dados de contagem e o catálogo de distintivos.</li>
    <li>Ainda em Segredos: <b>Senhas dos andares trancados</b> (subsolos da fundição e porão do clube). Sem senha, só você abre.</li>
    <li>Aba <b>Mapa</b>: cadastre os <b>investigadores</b> (cada um ganha a peça na frente da delegacia), ajuste o <b>relógio</b> (o caso começa em 21/05/1997, 06:12) e, se quiser, ligue as <b>rotinas dos NPCs</b> e ponha NPCs e viaturas no mapa.</li>
    <li>Aba <b>Registro</b>: confira a <b>Tarefa 1</b>, o <b>Sentinel</b> do dia e os documentos que pretende liberar. Nos atestados do Arquivo do Condado, preencha os nomes sob tarja antes de revelar.</li>
    <li>Aba <b>Sessão</b>: <b>Marcar nova sessão</b> (o diário e o replay começam do zero), escolha a <b>abertura</b> (VHS, SIIC ou telejornal) e mande para as telas.</li>
    <li>Na mesa: abra a <b>tela de TV</b> (aba Mesa) no computador ligado à televisão.</li>
    <li>Depois de testar o site sozinho, use <b>Restaurar o site</b> (aba Segredos) para apagar os testes antes de jogar.</li>
  </ol>` });
