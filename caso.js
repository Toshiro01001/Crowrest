/* =========================================================
   CROWSREST · caso.js
   "Como Usar" (o manual que junta as ajudas de todos os módulos),
   os documentos do caso 24-1187 (Resumo, Ocorrência, Evidências,
   Laudo, Pessoa de Interesse) com as liberações do Mestre, as fotos
   com marcações do grupo e o vulto (item 28), o Mural de Pistas,
   os Anexos do grupo e as Anotações.
   Caminhos: caso/mural, caso/ligacoes, caso/anexos, caso/anotacoes,
   caso/marcas/<foto>; estado/liberado, estado/docs, estado/vultos;
   segredos/docs (rascunhos do Mestre).
   Nada de segredo aqui: o conteúdo liberado vem do servidor.
   ========================================================= */
(() => {
'use strict';
const { $, $$, esc, el, num, int, pad2, clamp, ls, Rede, Estado, Segredos, aviso, confirmar, pedirTexto, janela, fecharJanela } = CRW;

/* =========================================================
   UTILIDADES
   ========================================================= */
const V = () => CRW.v();
const logado = () => { const v = CRW.P; return !!(v.mestre || v.aux || v.pc); };
const moderador = () => (CRW.P.mestre || CRW.P.aux) && !CRW.P.espiar;
const mestreReal = () => CRW.P.mestre && !CRW.P.espiar;
function eu() {
  const P = CRW.P;
  if (P.mestre) return { pc: 'mestre', nome: 'Guardião da Luz' };
  if (P.aux) return { pc: 'aux:' + (P.nomeAux || 'Auxiliar'), nome: P.nomeAux || 'Auxiliar' };
  const p = CRW.pc(P.pc) || {}; return { pc: P.pc || '', nome: p.nome || P.pc || '' };
}
const quemSouChave = () => CRW.P.mestre ? 'mestre' : CRW.P.aux ? 'aux' : (CRW.P.pc || 'anon');
function agoraJogo() { const r = CRW.relogio(); return { data: r.data, hora: pad2(r.h) + ':' + pad2(r.m) }; }
const lista = o => Object.entries(o || {}).filter(([, x]) => x && typeof x === 'object').map(([id, x]) => ({ id, ...x }));
const porTs = (a, b) => num(a.ts) - num(b.ts);
const LOTES_ = () => (typeof LOTES !== 'undefined' ? LOTES : []);
const nomeLote = id => { const l = LOTES_().find(x => x.id === id); return l ? l.nome : ''; };
const opcoesLote = sel => `<option value="">Sem local</option>` + LOTES_().slice().sort((a, b) => a.nome.localeCompare(b.nome)).map(l => `<option value="${esc(l.id)}"${l.id === sel ? ' selected' : ''}>${esc(l.nome)}</option>`).join('');
function tam(b) { b = num(b); return b < 1024 ? b + ' B' : b < 1048576 ? Math.round(b / 1024) + ' KB' : (b / 1048576).toFixed(1) + ' MB'; }
// ouvinte que se desliga sozinho quando a seção sai da tela
function ouvir(no, ev, fn) {
  const t0 = Date.now();
  const off = CRW.on(ev, x => {
    if (!document.body.contains(no)) { if (Date.now() - t0 > 4000) off(); return; }
    fn(x);
  });
  return off;
}
// HTML vindo do Mestre: texto comum vira parágrafos; HTML passa por uma limpeza
function limpaHtml(h) {
  const d = new DOMParser().parseFromString('<div>' + String(h || '') + '</div>', 'text/html');
  d.querySelectorAll('script,iframe,object,embed,link,meta,style,base,form,input,button,textarea,select').forEach(x => x.remove());
  d.querySelectorAll('*').forEach(x => [...x.attributes].forEach(a => {
    if (/^on/i.test(a.name) || (/^(href|src|xlink:href|action)$/i.test(a.name) && /^\s*(javascript|vbscript):/i.test(a.value))) x.removeAttribute(a.name);
  }));
  return d.body.firstChild ? d.body.firstChild.innerHTML : '';
}
function paraHtml(t) {
  t = String(t || '').trim();
  if (/<(p|div|ul|ol|table|h[1-6]|br|blockquote|section)\b/i.test(t)) return limpaHtml(t);
  const temTag = /<[a-z][\s\S]*>/i.test(t);
  return limpaHtml(t.split(/\n\s*\n/).map(p => '<p class="tx">' + (temTag ? p : esc(p)).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\n/g, '<br>') + '</p>').join(''));
}
function dataUrlParaBlob(u) { return fetch(u).then(r => r.blob()); }
async function abrirArquivo(a) {
  try {
    const b = await dataUrlParaBlob(a.dados); const url = URL.createObjectURL(b);
    const x = el('a'); x.href = url; x.target = '_blank'; x.rel = 'noopener'; document.body.appendChild(x); x.click();
    setTimeout(() => { x.remove(); URL.revokeObjectURL(url); }, 60000);
  } catch (e) { aviso('Não foi possível abrir o arquivo.', 'erro'); }
}
async function baixarArquivo(a) { try { CRW.baixar(a.nome || 'anexo', await dataUrlParaBlob(a.dados)); } catch (e) { aviso('Não foi possível baixar.', 'erro'); } }

/* =========================================================
   LOJA: assinaturas compartilhadas dos caminhos do grupo
   (uma por perfil; os módulos ouvem o evento 'cs:<caminho>')
   ========================================================= */
const Loja = {
  d: {}, offs: {},
  usar(c) {
    if (!(c in this.offs)) {
      if (!logado()) return null;
      this.offs[c] = null;
      const off = Rede.on(c, x => { this.d[c] = x || {}; CRW.emit('cs:' + c, this.d[c]); }, () => { this.d[c] = {}; CRW.emit('cs:' + c, {}); });
      this.offs[c] = off;
    }
    return this.d[c];
  },
  zerar() { Object.values(this.offs).forEach(f => { try { f && f(); } catch (e) {} }); this.offs = {}; this.d = {}; },
};
CRW.casoLoja = Loja;

/* ---------- badges: novidades dos outros desde a última visita ---------- */
const BADGES = { mural: 'caso/mural', anotacoes: 'caso/anotacoes', anexos: 'caso/anexos' };
function chaveVisto(mod) { return 'visto:' + mod + ':' + quemSouChave(); }
function contarBadge(mod) {
  if (!logado()) return CRW.badge(mod, 0);
  const d = Loja.d[BADGES[mod]]; if (!d) return;
  if (CRW.moduloAtual() === mod) { ls.set(chaveVisto(mod), Date.now()); return CRW.badge(mod, 0); }
  let visto = ls.get(chaveVisto(mod), 0);
  if (!visto) { visto = Date.now(); ls.set(chaveVisto(mod), visto); }
  const me = eu().pc;
  CRW.badge(mod, lista(d).filter(x => num(x.ts) > visto && x.pc !== me).length);
}
Object.entries(BADGES).forEach(([mod, c]) => CRW.on('cs:' + c, () => contarBadge(mod)));
CRW.on('modulo', id => { if (BADGES[id]) contarBadge(id); if (DOC_MODS.includes(id)) marcarDocsVistos(id); });

CRW.on('perfil', () => {
  Loja.zerar();
  Object.keys(BADGES).forEach(m => CRW.badge(m, 0));
  if (!logado()) return;
  setTimeout(() => { if (logado()) { Loja.usar('caso/mural'); Loja.usar('caso/ligacoes'); Loja.usar('caso/anotacoes'); Loja.usar('caso/marcas'); } }, 400);
  setTimeout(() => { if (logado()) Loja.usar('caso/anexos'); }, 4000);
  setTimeout(contarDocs, 600);
});

/* =========================================================
   1. COMO USAR (tutorial)
   ========================================================= */
const PAPEL_NOME = { todos: 'todos', jog: 'investigadores', aux: 'auxiliares', mestre: 'Guardião' };
function papelAtual() { const v = V(); return v.mestre ? 'mestre' : v.aux ? 'aux' : v.pc ? 'jog' : ''; }
function ajudasVisiveis(como) {
  const p = como || papelAtual();
  return CRW.ajudas().filter(a => p === 'tudo' || (a.para || ['todos']).includes('todos') || (p && (a.para || []).includes(p)));
}
function renderTutorial(sec) {
  const ehM = mestreReal();
  let como = ehM ? ls.get('tutComo', 'mestre') : '';
  sec.innerHTML = `<div class="panel cs-tut"><div class="panel-h"><h2>Como Usar o Sistema</h2><div class="meta">SIIC · manual do operador<br>Formulário CCSO-01</div></div>
    <div class="panel-b">
      <p class="lead">Este é o manual do <b>SIIC</b>, o terminal de investigação do caso <b>24-1187</b>. Cada parte do site está explicada aqui, do jeito que o seu papel usa. Toque num título do índice para ir direto à seção.</p>
      <div class="linha95 cs-tut-bts">${ehM ? `<label class="cs-tut-como">Ver o manual como <select class="w95-input" data-como>
        <option value="mestre">Guardião da Luz</option><option value="aux">Auxiliar</option><option value="jog">Investigador</option><option value="tudo">Tudo (todas as seções)</option></select></label>` : ''}
        <button class="w95-btn" data-imprimir>Imprimir manual</button></div>
      <nav class="cs-indice" aria-label="Índice"></nav>
      <div class="cs-tut-corpo"></div>
    </div></div>`;
  const sel = $('[data-como]', sec); if (sel) sel.value = como;
  const desenhar = () => {
    const as = ajudasVisiveis(ehM ? como : '');
    $('.cs-indice', sec).innerHTML = `<div class="cs-ind-t">Índice</div><ol>${as.map(a => `<li><button class="cs-ind" data-ir="${esc(a.id)}">${esc(a.titulo)}</button></li>`).join('')}</ol>`;
    $('.cs-tut-corpo', sec).innerHTML = as.map(a => `<section class="cs-tsec" id="tut-${esc(a.id)}">
        <h3 class="tut-sec">${esc(a.titulo)} ${(a.para || ['todos']).includes('todos') ? '' : (a.para || []).map(p => `<span class="cs-para">${esc(PAPEL_NOME[p] || p)}</span>`).join('')}</h3>
        <div class="tut">${a.html || ''}</div><button class="cs-topo" data-topo>▲ voltar ao índice</button></section>`).join('') || '<p class="vazio95">Nenhuma seção de ajuda registrada.</p>';
    montarChave(sec);
  };
  desenhar();
  let t = null;
  ouvir(sec, 'ajuda', () => { clearTimeout(t); t = setTimeout(desenhar, 120); });
  sec.addEventListener('change', e => { if (e.target.matches('[data-como]')) { como = e.target.value; ls.set('tutComo', como); desenhar(); } });
  sec.addEventListener('click', e => {
    const ir = e.target.closest('[data-ir]');
    if (ir) { const alvo = $('#tut-' + CSS.escape(ir.dataset.ir), sec); if (alvo) alvo.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (e.target.closest('[data-topo]')) $('.cs-indice', sec).scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (e.target.closest('[data-imprimir]')) {
      const as = ajudasVisiveis(ehM ? como : '');
      const corpo = as.map(a => `<h2>${esc(a.titulo)}</h2>${(a.html || '').replace(/<button[\s\S]*?<\/button>/g, '').replace(/<div data-cs-chave[^>]*><\/div>/g, '')}`).join('');
      CRW.imprimir('Manual do SIIC', `<p>Manual do operador do Sistema Integrado de Investigação Criminal · versão ${esc(CRW.VERSAO)}.</p>${corpo}`, { sub: 'Formulário CCSO-01 · Manual do operador' });
    }
  });
}
// quadro da chave da ficha (só para o investigador no próprio aparelho)
function montarChave(sec) {
  const slot = $('[data-cs-chave]', sec); if (!slot) return;
  const P = CRW.P;
  if (!P.pc || P.espiar) { slot.innerHTML = ''; return; }
  slot.innerHTML = `<div class="box cs-chave"><div class="bl">A chave da sua ficha neste aparelho</div>
    <p>Guarde num lugar seguro. Quem tem a chave abre a sua ficha.</p>
    <code class="cs-chave-v" hidden></code>
    <div class="linha95"><button class="w95-btn" data-ch="ver">Mostrar chave</button><button class="w95-btn" data-ch="copiar">Copiar</button><button class="w95-btn" data-ch="usar">Usar outra chave…</button></div></div>`;
  slot.onclick = async e => {
    const b = e.target.closest('[data-ch]'); if (!b) return;
    const k = CRW.minhaChave(), c = $('.cs-chave-v', slot);
    if (b.dataset.ch === 'ver') { c.hidden = !c.hidden; c.textContent = k; b.textContent = c.hidden ? 'Mostrar chave' : 'Esconder chave'; }
    if (b.dataset.ch === 'copiar') { try { await navigator.clipboard.writeText(k); aviso('Chave copiada.'); } catch (er) { c.hidden = false; c.textContent = k; aviso('Selecione e copie a chave na tela.'); } }
    if (b.dataset.ch === 'usar') {
      const n = await pedirTexto('Cole a chave da sua ficha (32 letras e números). A chave atual deste aparelho será trocada.', '', { titulo: 'Usar outra chave' });
      if (n === null) return;
      if (CRW.usarChave(n.trim())) { aviso('Chave trocada: a ficha daquela chave foi carregada.'); CRW.refazerModulo('tutorial'); }
      else aviso('Chave inválida (precisa ter pelo menos 24 caracteres).', 'erro');
    }
  };
}

/* =========================================================
   2. DOCUMENTOS DO CASO
   ========================================================= */
const DOC_MODS = ['resumo', 'ocorrencia', 'evidencias', 'laudo', 'furao'];
const ALVOS = [['resumo', 'Resumo'], ['ocorrencia', 'Ocorrência'], ['evidencias', 'Evidências'], ['laudo', 'Laudo'], ['furao', 'Pessoa de Interesse']];
// documentos que o Mestre liberou: estado/docs/<id> com estado/liberado/<id> = true
function docsLiberados(alvo) {
  const s = Estado.get(), lib = s.liberado || {};
  return lista(s.docs).filter(d => lib[d.id] === true && (!alvo || d.alvo === alvo)).sort(porTs);
}
CRW.docsLiberados = docsLiberados;
function htmlDocs(alvo) {
  return docsLiberados(alvo).map(d => `<div class="panel cs-doc-lib" id="doc-${esc(d.id)}"><div class="panel-h"><h2>${esc(d.titulo || 'Documento')}</h2><div class="meta">${d.ref ? esc(d.ref) + '<br>' : ''}<span class="cs-carimbo">LIBERADO</span></div></div>
    <div class="panel-b">${limpaHtml(d.html || '')}</div></div>`).join('');
}
function chaveDocsVistos() { return 'docsVistos:' + quemSouChave(); }
function marcarDocsVistos(mod) {
  const vistos = ls.get(chaveDocsVistos(), {}); let mudou = false;
  docsLiberados(mod).forEach(d => { const k = d.id + ':' + num(d.ts); if (!vistos[k]) { vistos[k] = 1; mudou = true; } });
  if (mudou) ls.set(chaveDocsVistos(), vistos);
  CRW.badge(mod, 0);
}
let docsAssin = '';
function contarDocs() {
  if (CRW.TV) return;
  const vistos = ls.get(chaveDocsVistos(), null);
  const todos = docsLiberados();
  if (vistos === null) { const v = {}; todos.forEach(d => { v[d.id + ':' + num(d.ts)] = 1; }); ls.set(chaveDocsVistos(), v); return; }
  const novos = {};
  todos.forEach(d => { if (!vistos[d.id + ':' + num(d.ts)] && DOC_MODS.includes(d.alvo)) novos[d.alvo] = (novos[d.alvo] || 0) + 1; });
  DOC_MODS.forEach(m => { if (CRW.moduloAtual() === m && novos[m]) { marcarDocsVistos(m); novos[m] = 0; } CRW.badge(m, novos[m] || 0); });
  // aviso único por documento novo
  const avis = ls.get('docsAvisados:' + quemSouChave(), {});
  todos.forEach(d => {
    const k = d.id + ':' + num(d.ts);
    if (!vistos[k] && !avis[k] && logado() && !CRW.P.mestre) { avis[k] = 1; aviso('Novo documento no caso: ' + (d.titulo || 'documento') + ' (' + ((ALVOS.find(a => a[0] === d.alvo) || [])[1] || d.alvo) + ').'); CRW.Som.fax(); }
  });
  ls.set('docsAvisados:' + quemSouChave(), avis);
}
CRW.on('estado', s => {
  const a = JSON.stringify([s.docs || null, s.liberado || null]);
  if (a === docsAssin) return; docsAssin = a;
  if (logado()) contarDocs();
  CRW.emit('docsLiberados', docsLiberados());
});
function extraDocs(sec, alvo) {
  const box = $('.cs-extra', sec); if (!box) return;
  const pintar = () => { box.innerHTML = htmlDocs(alvo); };
  pintar(); ouvir(sec, 'docsLiberados', pintar);
}
function cab(titulo, meta) { return `<div class="panel-h"><h2>${titulo}</h2><div class="meta">${meta}</div></div>`; }
function annot(m) { return m ? `<div class="annot"><div class="al">Anotação manuscrita anexa</div><div class="at">${esc(m.texto)}<span class="sig">${esc(m.assinatura)}</span></div></div>` : ''; }

function renderResumo(sec) {
  const r = CASO.resumo;
  sec.innerHTML = `<div class="panel">${cab('Resumo do Caso', `REF ${esc(CASO.numero)}<br>Aberto ${esc(CASO.aberto)}`)}
    <div class="panel-b"><p class="lead">${r.lead}</p>
      <div class="stats">${r.stats.map(([n, k, c]) => `<div class="stat"><div class="n ${esc(c)}">${esc(n)}</div><div class="k">${esc(k)}</div></div>`).join('')}</div>
      <div class="alert-box"><div class="al">⚠ Alerta de integridade do arquivo</div><p>${esc(r.alerta)}</p></div></div></div>
    <div class="panel">${cab('Registro de Atividade', 'Trilha de auditoria')}
      <div class="panel-b"><ul class="alog">${r.log.map(([t, ev, tag]) => `<li${tag ? ' class="flag"' : ''}><span class="ts">${esc(t)}</span><span class="ev">${ev}${tag ? `<span class="tag">${esc(tag)}</span>` : ''}</span></li>`).join('')}</ul></div></div>
    <div class="cs-extra"></div>
    <div class="panel cs-mov" ${logado() ? '' : 'hidden'}>${cab('Movimento do grupo no caso', 'ao vivo')}<div class="panel-b"><ul class="alog cs-mov-l"></ul></div></div>`;
  extraDocs(sec, 'resumo');
  if (!logado()) return;
  const mov = () => {
    const m = lista(Loja.usar('caso/mural')).map(x => ({ ts: x.ts, h: x.hora, t: `<b>${esc(x.nome || '')}</b> fixou no mural: ${esc(String(x.texto || '').slice(0, 80))}` }));
    const a = lista(Loja.usar('caso/anotacoes')).map(x => ({ ts: x.ts, h: x.hora, t: `<b>${esc(x.nome || '')}</b> anotou: ${esc(String(x.texto || '').slice(0, 80))}` }));
    const d = docsLiberados().map(x => ({ ts: x.ts, h: '', t: `Documento liberado: <b>${esc(x.titulo || '')}</b>` }));
    const l = [...m, ...a, ...d].sort((x, y) => num(y.ts) - num(x.ts)).slice(0, 8);
    $('.cs-mov-l', sec).innerHTML = l.map(x => `<li><span class="ts">${esc(x.h || '--:--')}</span><span class="ev">${x.t}</span></li>`).join('') || '<li class="vazio95">Nada ainda. O que o grupo fizer no mural e nas anotações aparece aqui.</li>';
  };
  mov();
  ['cs:caso/mural', 'cs:caso/anotacoes', 'docsLiberados'].forEach(ev => ouvir(sec, ev, mov));
}
function renderOcorrencia(sec) {
  const o = CASO.ocorrencia;
  sec.innerHTML = `<div class="panel">${cab('Boletim de Ocorrência', `${esc(o.ref)}<br>${esc(o.meta)}`)}
    <div class="panel-b"><div class="box"><div class="bl">Relato do agente</div><p>${o.relato}</p></div>
      <p class="tx">${o.texto}</p>
      <div class="box"><div class="bl">Observação anexa</div><p>${o.obs}</p></div>
      ${annot(o.manuscrito)}</div></div><div class="cs-extra"></div>`;
  extraDocs(sec, 'ocorrencia');
}
function renderLaudo(sec) {
  const l = CASO.laudo;
  sec.innerHTML = `<div class="panel">${cab('Laudo Pericial Preliminar', `${esc(l.ref)}<br>${esc(l.meta)}`)}
    <div class="panel-b"><div class="linha95" style="margin-bottom:12px"><span class="chip cold">Preliminar</span><span class="chip alert">Revisão pendente</span></div>
      <p class="lead">${l.lead}</p>
      ${l.achados.map(([t, x]) => `<div class="box"><div class="bl">${esc(t)}</div><p>${x}</p></div>`).join('')}
      <p class="tx">${l.texto}</p>${annot(l.manuscrito)}</div></div><div class="cs-extra"></div>`;
  extraDocs(sec, 'laudo');
}
const ST_PI = { procurado: ['Procurado p/ oitiva', 'alert'], interrogado: ['Interrogado', 'cold'], desaparecido: ['Desaparecido', 'open'], morto: ['Morto', 'alert'] };
function renderFurao(sec) {
  const pi = CASO.pessoaInteresse;
  const desenhar = () => {
    const sx = ((Estado.get().suspeitos || {})[pi.id] || {}).status || pi.status;
    const [st, cl] = ST_PI[sx] || [sx, 'open'];
    sec.innerHTML = `<div class="panel">${cab('Pessoa de Interesse', `Ficha ${esc(pi.ficha)}<br>${esc(st)}`)}
      <div class="panel-b"><div class="poi">
        <div class="mug"><div class="hd">CCSO · ${esc(pi.ficha.replace('CRW-', ''))}</div>
          <svg viewBox="0 0 100 130" aria-hidden="true"><path fill="#6a7890" d="M50 22c-13 0-22 10-22 24 0 9 4 16 9 20-10 4-21 13-24 27-1 5-1 9-1 9h76s0-4-1-9c-3-14-14-23-24-27 5-4 9-11 9-20 0-14-9-24-22-24z"/></svg>
          <div class="sc"><span>50</span><span>55</span><span>60</span><span>65</span><span>70</span></div></div>
        <div><div class="linha95"><span class="chip ${cl}">${esc(st)}</span></div>
          <div class="grid2">${pi.campos.map(([l, v]) => `<div class="f"><div class="l">${esc(l)}</div><div class="v">${esc(v)}</div></div>`).join('')}</div>
          <div class="priors"><b>Antecedentes:</b><ul>${pi.antecedentes.map(a => `<li>${esc(a)}</li>`).join('')}</ul></div></div>
      </div>
      <div class="box" style="margin-top:18px"><div class="bl">Última informação</div><p>${pi.ultima}</p></div></div></div><div class="cs-extra"></div>`;
    extraDocs(sec, 'furao');
  };
  desenhar();
  let a = JSON.stringify((Estado.get().suspeitos || {})[pi.id] || null);
  ouvir(sec, 'estado', s => { const b = JSON.stringify((s.suspeitos || {})[pi.id] || null); if (b !== a) { a = b; desenhar(); } });
}

/* ---------- Evidências, fotos, marcações e vultos ---------- */
const FOTOS = () => CASO.fotos;
const vistas = () => ls.get('fotosVistas', {});
function marcarVista(id) { const v = vistas(); if (!v[id]) { v[id] = Date.now(); ls.set('fotosVistas', v); } }
const meusVultos = () => ls.get('vultosMeus:' + (CRW.P.pc || ''), {});
CRW.aoEntregar('vulto', e => {
  if (!e.foto) return;
  const m = meusVultos();
  if (e.remover) delete m[e.foto]; else m[e.foto] = { ativo: true, x: num(e.x, 50), y: num(e.y, 50), escala: num(e.escala, 0.18), opacidade: num(e.opacidade, 0.35), forma: e.forma || 'homem' };
  ls.set('vultosMeus:' + (CRW.P.pc || ''), m);
  CRW.emit('vultos', null);
});
CRW.on('restaurado', () => { ls.del('fotosVistas'); ls.del('vultosMeus:' + (CRW.P.pc || '')); CRW.emit('vultos', null); });
const cfgVultos = () => Estado.get().vultos || {};
const limiarVulto = () => clamp(int(cfgVultos().limiar, 6), 0, 10);
// o vulto que este espectador deve ver nesta foto (ou null). jaVista: a foto já tinha sido vista antes
function vultoPara(foto, jaVista) {
  const v = V(), g = cfgVultos()[foto];
  if (v.mestre || v.aux) return g && g.ativo ? { ...g, previa: true } : null;
  if (!jaVista) return null;
  const meu = meusVultos()[foto];
  if (meu && meu.ativo) return meu;
  if (g && g.ativo && CRW.sangria() >= limiarVulto()) return g;
  return null;
}
const FORMAS = {
  homem: { vb: '0 0 100 200', d: 'M50 10c-10 0-17 8-17 19 0 9 4 15 10 19l-1 7c-13 3-26 10-30 23-5 15-6 45-7 82h90c-1-37-2-67-7-82-4-13-17-20-30-23l-1-7c6-4 10-10 10-19 0-11-7-19-17-19z', ar: 2 },
  corvo: { vb: '0 0 120 100', d: 'M16 41l16-6c4-8 13-12 22-9 6 3 8 8 12 12 16 2 30 10 38 22l14 18-14-4c-6 0-12-2-18-4-6 6-16 10-26 10l-2 12h-2l-1-12c-8-2-14-8-16-18-2-8-2-16-4-20z', ar: 100 / 120 },
};
function svgVulto(cfg) {
  const f = FORMAS[cfg.forma] || FORMAS.homem, gid = 'cvg' + Math.random().toString(36).slice(2, 7);
  return `<svg viewBox="${f.vb}" preserveAspectRatio="xMidYMid meet" aria-hidden="true"><defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#050507" stop-opacity="1"/><stop offset=".7" stop-color="#050507" stop-opacity=".85"/><stop offset="1" stop-color="#050507" stop-opacity="0"/></linearGradient></defs><path d="${f.d}" fill="url(#${gid})"/></svg>`;
}
// põe o vulto dentro de "caixa", que mostra a imagem "img" (cover = object-fit:cover)
function porVulto(caixa, img, cfg, cover) {
  let v = $('.cs-vulto', caixa);
  if (!cfg) { if (v) v.remove(); return; }
  if (!v) { v = el('div', 'cs-vulto'); caixa.appendChild(v); }
  v.innerHTML = `<div class="cs-vulto-i">${svgVulto(cfg)}</div>`;
  v.classList.toggle('previa', !!cfg.previa);
  const f = FORMAS[cfg.forma] || FORMAS.homem;
  const posicionar = () => {
    const bw = caixa.clientWidth, bh = caixa.clientHeight, iw = img.naturalWidth || 1000, ih = img.naturalHeight || 600;
    if (!bw || !bh) return;
    let dw, dh, ox = 0, oy = 0;
    if (cover) { const k = Math.max(bw / iw, bh / ih); dw = iw * k; dh = ih * k; ox = (bw - dw) / 2; oy = (bh - dh) / 2; }
    else { dw = img.clientWidth || bw; dh = img.clientHeight || bh; }
    const w = clamp(num(cfg.escala, 0.18), 0.04, 0.9) * dw;
    v.style.width = w + 'px'; v.style.height = (w * f.ar) + 'px';
    v.style.left = (ox + num(cfg.x, 50) / 100 * dw) + 'px'; v.style.top = (oy + num(cfg.y, 50) / 100 * dh) + 'px';
    v.style.opacity = Math.max(clamp(num(cfg.opacidade, 0.35), 0.03, 0.9), cfg.previa ? 0.5 : 0);
  };
  if (img.complete) posicionar(); else img.addEventListener('load', posicionar, { once: true });
  if (window.ResizeObserver && !caixa._csRO) { caixa._csRO = new ResizeObserver(() => { const p = caixa._csPos; p && p(); }); caixa._csRO.observe(caixa); }
  caixa._csPos = posicionar;
}

function renderEvidencias(sec) {
  sec.innerHTML = `<div class="panel">${cab('Inventário de Evidências', `Coleta Eq. Perícia 2<br>${pad2(CASO.evidencias.length)} itens registrados`)}
    <div class="panel-b" style="padding:0"><table class="dtable cs-evtab"><thead><tr><th style="width:62px">Item</th><th>Descrição</th><th class="cs-col-st" style="width:150px">Cadeia / status</th></tr></thead>
      <tbody>${CASO.evidencias.map(e => `<tr${e.flag ? ' class="flag"' : ''}><td class="id">${esc(e.id)}</td><td>${e.desc}<span class="cs-st-m">${esc(e.status)}</span></td><td class="cs-col-st">${esc(e.status)}</td></tr>`).join('')}</tbody></table></div></div>
    <div class="panel">${cab('Anexos Fotográficos', `${pad2(FOTOS().length)} anexados · 04 ausentes`)}
      <div class="panel-b"><p class="mini cs-dica">Toque numa foto para ampliar e marcar pontos. As marcas aparecem para todo o grupo.</p><div class="anexos cs-fotos"></div></div></div>
    <div class="panel cs-ev-anx" ${logado() ? '' : 'hidden'}>${cab('Anexos do grupo', 'documentos enviados pelos investigadores')}<div class="panel-b"><p class="tx cs-ev-anx-t"></p><button class="w95-btn" data-abre="anexos">Abrir Anexos do grupo</button></div></div>
    <div class="cs-extra"></div>`;
  const grade = $('.cs-fotos', sec);
  const pintar = () => {
    const marcas = Loja.d['caso/marcas'] || {}, vs = vistas();
    grade.innerHTML = FOTOS().map(f => { const n = Object.keys(marcas[f.id] || {}).length; return `<div class="anexo${n ? ' marked' : ''}" data-foto="${esc(f.id)}" role="button" tabindex="0" aria-label="Ampliar ${esc(f.titulo)}"><div class="img"><img src="${esc(f.img)}" alt="${esc(f.cap)}" loading="lazy"><span class="zoomico">⌕</span></div>
      <div class="mx"><div class="t">${esc(f.titulo)}</div><div class="h">${esc(f.ref)}</div>${n ? `<div class="cs-nm">${n} ${n === 1 ? 'marca' : 'marcas'} do grupo</div>` : ''}</div></div>`; }).join('')
      + `<div class="anexo missing"><div class="img"><span class="ph">AUSENTES<br>DO ARQUIVO</span></div><div class="mx"><div class="t">FOTOS 06 A 09</div><div class="h">removidas · sem protocolo</div></div></div>`;
    $$('.anexo[data-foto]', grade).forEach(a => { const id = a.dataset.foto; porVulto($('.img', a), $('img', a), vultoPara(id, !!vs[id]), true); });
  };
  pintar();
  if (logado()) Loja.usar('caso/marcas');
  ouvir(sec, 'cs:caso/marcas', pintar); ouvir(sec, 'vultos', pintar);
  let va = JSON.stringify([cfgVultos(), CRW.sangria()]);
  ouvir(sec, 'estado', () => { const b = JSON.stringify([cfgVultos(), CRW.sangria()]); if (b !== va) { va = b; pintar(); } });
  grade.addEventListener('click', e => { const a = e.target.closest('[data-foto]'); if (a) abrirFoto(a.dataset.foto, pintar); });
  grade.addEventListener('keydown', e => { const a = e.target.closest('[data-foto]'); if (a && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); abrirFoto(a.dataset.foto, pintar); } });
  const anx = () => { const n = lista(Loja.d['caso/anexos']).length; const t = $('.cs-ev-anx-t', sec); if (t) t.textContent = Loja.d['caso/anexos'] ? `${n} ${n === 1 ? 'documento anexado' : 'documentos anexados'} pelo grupo.` : 'Imagens, PDFs e textos que o grupo encontrar ficam no módulo Anexos do grupo.'; };
  anx(); ouvir(sec, 'cs:caso/anexos', anx);
  extraDocs(sec, 'evidencias');
}

/* lightbox: foto ampliada com as marcas do grupo */
function abrirFoto(id, aoFechar) {
  const f = FOTOS().find(x => x.id === id); if (!f) return;
  const jaVista = !!vistas()[id];
  const w = janela({ id: 'cs-foto', titulo: f.cap, classe: 'cs-lbw', largura: '920px', icone: '▣', aoFechar: () => { aoFechar && aoFechar(); } , html: `
    <div class="cs-lb-palco"><div class="lb-stage cs-stage"><img src="${esc(f.img)}" alt="${esc(f.cap)}"><div class="cs-mks"></div></div></div>
    <div class="cs-vinfo" hidden></div>
    <div class="lb-tools"><button class="w95-btn" data-mk="marcar">Marcar ponto</button><button class="w95-btn" data-mk="desfazer">Desfazer minha marca</button><button class="w95-btn" data-mk="limpar">${moderador() ? 'Limpar todas' : 'Apagar as minhas'}</button>
      <span class="lb-hint">${logado() ? 'Toque em "Marcar ponto" e depois na foto para circular algo. Todo o grupo vê as marcas.' : 'Entre no sistema para marcar a foto.'}</span></div>
    <ol class="cs-mlist"></ol>` });
  const stage = $('.cs-stage', w), img = $('img', stage), mks = $('.cs-mks', stage);
  let marcando = false;
  const marcas = () => lista((Loja.d['caso/marcas'] || {})[id]).sort(porTs);
  const pintar = () => {
    if (!document.body.contains(w)) return;
    const l = marcas(), me = eu().pc;
    mks.innerHTML = l.map((m, i) => `<button class="cs-mk${m.pc === me ? ' meu' : ''}" style="left:${clamp(num(m.x), 0, 100)}%;top:${clamp(num(m.y), 0, 100)}%" data-mi="${esc(m.id)}" title="${esc((m.n || '') + (m.txt ? ': ' + m.txt : ''))}"><span>${i + 1}</span></button>`).join('');
    $('.cs-mlist', w).innerHTML = l.map((m, i) => `<li data-li="${esc(m.id)}"><b>${i + 1}</b> ${m.txt ? esc(m.txt) : '<span class="dim">sem observação</span>'} <span class="mini">· ${esc(m.n || '')}${m.hora ? ' · ' + esc(m.hora) : ''}</span>${(m.pc === me || moderador()) && logado() ? ` <button class="cs-x" data-del="${esc(m.id)}" aria-label="Apagar marca">×</button>` : ''}</li>`).join('');
  };
  const cfg = vultoPara(id, jaVista);
  porVulto(stage, img, cfg, false);
  if (cfg && cfg.previa) { const vi = $('.cs-vinfo', w); vi.hidden = false; vi.innerHTML = `<span class="etq verm">vulto ligado</span> só aparece para quem já viu esta foto antes, com Sangria ${limiarVulto()} ou mais (agora: ${CRW.sangria()}), ou para quem recebeu o vulto em particular.`; }
  if (cfg && !cfg.previa) setTimeout(() => { CRW.Som.ruido(0, 0.9, 0.012, 300, 'lowpass'); }, 1400);
  if (!V().mestre && !V().aux) marcarVista(id);
  if (logado()) Loja.usar('caso/marcas');
  pintar();
  const off = CRW.on('cs:caso/marcas', pintar);
  const offV = CRW.on('vultos', () => { if (document.body.contains(w)) porVulto(stage, img, vultoPara(id, true), false); else offV(); });
  w.parentElement._aoFechar = () => { off(); offV(); aoFechar && aoFechar(); };
  if (!logado()) $$('[data-mk]', w).forEach(b => { b.disabled = true; });
  w.addEventListener('click', async e => {
    const b = e.target.closest('[data-mk]');
    if (b && b.dataset.mk === 'marcar') { marcando = !marcando; b.classList.toggle('on', marcando); stage.classList.toggle('marking', marcando); CRW.Som.clique(); }
    if (b && b.dataset.mk === 'desfazer') { const m = marcas().filter(x => x.pc === eu().pc).pop(); if (m) Rede.set(`caso/marcas/${id}/${m.id}`, null).catch(() => aviso('O servidor recusou essa ação.', 'erro')); else aviso('Você não tem marcas nesta foto.'); }
    if (b && b.dataset.mk === 'limpar') {
      const todas = moderador(), alvo = todas ? marcas() : marcas().filter(x => x.pc === eu().pc);
      if (!alvo.length) return aviso('Nada para apagar.');
      if (!(await confirmar(todas ? `Apagar as ${alvo.length} marcas desta foto (de todo o grupo)?` : `Apagar as suas ${alvo.length} marcas desta foto?`))) return;
      if (todas) Rede.set('caso/marcas/' + id, null).catch(() => {}); else alvo.forEach(m => Rede.set(`caso/marcas/${id}/${m.id}`, null).catch(() => {}));
    }
    const d = e.target.closest('[data-del]');
    if (d) Rede.set(`caso/marcas/${id}/${d.dataset.del}`, null).catch(() => {});
    const mk = e.target.closest('[data-mi]');
    if (mk && !marcando) { const li = $(`[data-li="${CSS.escape(mk.dataset.mi)}"]`, w); if (li) { $$('.cs-mlist li', w).forEach(x => x.classList.remove('on')); li.classList.add('on'); li.scrollIntoView({ block: 'nearest' }); } }
  });
  stage.addEventListener('click', async e => {
    if (!marcando || e.target.closest('.cs-mk')) return;
    const r = img.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width * 100, y = (e.clientY - r.top) / r.height * 100;
    if (x < 0 || x > 100 || y < 0 || y > 100) return;
    marcando = false; stage.classList.remove('marking'); const bm = $('[data-mk="marcar"]', w); bm && bm.classList.remove('on');
    const txt = await pedirTexto('Observação sobre esta marca (opcional)', '', { titulo: 'Marcar ponto na foto' });
    if (txt === null) return;
    const q = eu(), h = agoraJogo();
    Rede.push('caso/marcas/' + id, { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10, n: q.nome, pc: q.pc, txt: txt.trim().slice(0, 200), hora: h.hora, data: h.data, ts: Date.now() }).pronto.catch(() => aviso('O servidor recusou essa ação.', 'erro'));
  });
}

/* =========================================================
   3. MURAL DE PISTAS (quadro de cortiça sincronizado)
   ========================================================= */
const CATS = [['Pessoa', 'Pessoa'], ['Local', 'Local'], ['Objeto', 'Objeto'], ['Contradicao', 'Contradição'], ['Outro', 'Outro']];
const nomeCat = c => (CATS.find(x => x[0] === c) || [c, c])[1];
const QW = 1600, QH = 1100, CW = 168;
function renderMural(sec) {
  sec.innerHTML = `<div class="panel cs-mural">${'<div class="panel-h"><h2>Mural de Pistas</h2><div class="nb-tools"><span class="nb-status" data-cont>0 pistas</span></div></div>'}
    <div class="panel-b">
      <div class="clueform cs-form"><select class="w95-input csel" data-f="cat" aria-label="Tipo">${CATS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select>
        <input class="w95-input" type="text" data-f="texto" maxlength="200" placeholder="Descreva a pista encontrada..." aria-label="Pista">
        <select class="w95-input csel cs-lote" data-f="lote" aria-label="Local">${opcoesLote('')}</select>
        <button class="w95-btn pri" data-add>Fixar no mural</button></div>
      <div class="clue-help">Arraste os cartões. <b>Ligar</b> e depois toque em outro cartão: barbante. Toque no barbante para tirá-lo.</div>
      <div class="linha95 cs-mural-bts"><button class="w95-btn" data-z="-" aria-label="Diminuir">−</button><span class="cs-zoom" data-zv>100%</span><button class="w95-btn" data-z="+" aria-label="Aumentar">+</button><button class="w95-btn" data-z="fit">Ver tudo</button>
        <button class="w95-btn" data-lista>Ver em lista</button></div>
      <div class="cs-ligando" hidden>Toque no cartão de destino para ligar. <button class="w95-btn" data-cancel>Cancelar</button></div>
      <div class="cs-cork-vp"><div class="cs-cork-sz"><div class="corkboard cs-cork"><svg class="cork-lines" width="${QW}" height="${QH}" viewBox="0 0 ${QW} ${QH}"></svg><p class="cork-empty">Nenhuma pista fixada ainda. Use o campo acima.</p></div></div></div>
      <div class="cs-mlista" hidden></div>
    </div></div>`;
  const vp = $('.cs-cork-vp', sec), sz = $('.cs-cork-sz', sec), quadro = $('.cs-cork', sec), svg = $('svg', quadro);
  let esc_ = ls.get('mural:zoom', 1);
  let cards = {}, ligs = {}, ligando = null, arrastando = null;
  const els = {};
  const aplicarZoom = () => {
    esc_ = clamp(esc_, 0.3, 1.6);
    quadro.style.transform = `scale(${esc_})`; sz.style.width = QW * esc_ + 'px'; sz.style.height = QH * esc_ + 'px';
    $('[data-zv]', sec).textContent = Math.round(esc_ * 100) + '%'; ls.set('mural:zoom', esc_);
  };
  aplicarZoom();
  const ctro = id => { const c = cards[id], e = els[id]; if (!c || !e) return null; return { x: num(c.x) + e.offsetWidth / 2, y: num(c.y) + e.offsetHeight / 2 }; };
  const linhas = () => {
    svg.innerHTML = lista(ligs).map(l => { const A = ctro(l.a), B = ctro(l.b); if (!A || !B) return ''; return `<g data-lig="${esc(l.id)}"><line class="cs-hit" x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/><line x1="${A.x}" y1="${A.y}" x2="${B.x}" y2="${B.y}"/></g>`; }).join('');
  };
  const htmlCard = c => `<span class="cc-tag ${esc(c.cat || 'Outro')}">${esc(nomeCat(c.cat || 'Outro'))}</span><div class="cc-body">${esc(c.texto || '')}</div>
    ${c.nota ? `<div class="cs-cc-nota">${esc(c.nota)}</div>` : ''}${c.lote ? `<div class="cs-cc-lote">⌖ ${esc(nomeLote(c.lote) || c.lote)}</div>` : ''}
    <div class="cc-meta">${esc(c.nome || '')}${c.data ? ' · ' + esc(String(c.data).slice(0, 5)) : ''} ${esc(c.hora || '')}</div>
    <div class="cc-actions"><button class="cc-conn" data-a="ligar">Ligar</button><button class="cs-cc-ed" data-a="editar">Editar</button><button class="cc-del" data-a="tirar">Tirar</button></div>`;
  const pintar = () => {
    const ids = Object.keys(cards);
    Object.keys(els).forEach(id => { if (!cards[id]) { els[id].remove(); delete els[id]; } });
    ids.forEach(id => {
      const c = cards[id]; let e = els[id];
      if (!e) { e = el('div', 'clue-card'); e.dataset.id = id; quadro.appendChild(e); els[id] = e; }
      if (arrastando && arrastando.id === id) return;
      const h = htmlCard(c); if (e._h !== h) { e.innerHTML = h; e._h = h; }
      e.style.left = clamp(num(c.x, 20), 0, QW - CW) + 'px'; e.style.top = clamp(num(c.y, 20), 0, QH - 60) + 'px';
      e.style.setProperty('--rot', num(c.rot) + 'deg');
      e.classList.toggle('connecting', ligando === id);
    });
    $('.cork-empty', quadro).style.display = ids.length ? 'none' : 'block';
    $('[data-cont]', sec).textContent = ids.length + (ids.length === 1 ? ' pista' : ' pistas') + ' · ' + Object.keys(ligs).length + ' ligações';
    linhas();
    if (!$('.cs-mlista', sec).hidden) pintarLista();
  };
  const pintarLista = () => {
    const l = lista(cards).sort(porTs), byId = Object.fromEntries(l.map(c => [c.id, c]));
    $('.cs-mlista', sec).innerHTML = `<table class="dtable"><thead><tr><th>Pista</th><th style="width:96px"></th></tr></thead><tbody>${l.map(c => `<tr><td><span class="etq">${esc(nomeCat(c.cat))}</span> ${esc(c.texto || '')}${c.lote ? `<br><span class="mini">⌖ ${esc(nomeLote(c.lote))}</span>` : ''}<br><span class="mini">${esc(c.nome || '')} ${esc(c.hora || '')}</span></td>
      <td><button class="w95-btn" data-l-ver="${esc(c.id)}">Achar</button><button class="w95-btn" data-l-ed="${esc(c.id)}">Editar</button></td></tr>`).join('') || '<tr><td colspan="2" class="vazio95">Nenhuma pista.</td></tr>'}</tbody></table>
      <p class="mini" style="margin-top:8px"><b>Ligações</b></p><ul class="cs-ligl">${lista(ligs).map(g => `<li>${esc((byId[g.a] || {}).texto || '?')} ⟷ ${esc((byId[g.b] || {}).texto || '?')} <button class="w95-btn" data-l-des="${esc(g.id)}">Tirar</button></li>`).join('') || '<li class="vazio95">Nenhuma ligação.</li>'}</ul>
      <div class="linha95"><button class="w95-btn" data-exp>Exportar .txt</button>${moderador() ? '<button class="w95-btn perigo" data-limpar>Limpar tudo</button>' : ''}</div>`;
  };
  const doServ = () => { cards = Loja.d['caso/mural'] || {}; ligs = Loja.d['caso/ligacoes'] || {}; if (!arrastando) pintar(); };
  Loja.usar('caso/mural'); Loja.usar('caso/ligacoes'); doServ();
  ouvir(sec, 'cs:caso/mural', doServ); ouvir(sec, 'cs:caso/ligacoes', doServ);
  ouvir(sec, 'modulo', id => { if (id === 'mural') requestAnimationFrame(linhas); });
  const rec = () => aviso('O servidor recusou essa ação.', 'erro');
  // novo cartão: aparece no meio do que se está vendo
  const fixar = () => {
    const t = $('[data-f="texto"]', sec), txt = (t.value || '').trim(); if (!txt) { t.focus(); return aviso('Escreva a pista antes de fixar.'); }
    const q = eu(), h = agoraJogo();
    // procura um lugar livre em espiral a partir do meio do que se está vendo
    const cx = (vp.scrollLeft + vp.clientWidth / 2) / esc_ - CW / 2, cy = (vp.scrollTop + vp.clientHeight / 2) / esc_ - 60;
    const ocupado = (x, y) => Object.entries(cards).some(([id, c]) => { const h2 = (els[id] && els[id].offsetHeight) || 170; return x < num(c.x) + CW + 10 && x + CW + 10 > num(c.x) && y < num(c.y) + h2 + 10 && y + 175 > num(c.y); });
    let x = cx, y = cy;
    for (let i = 0, a = 0, r = 0; i < 160 && ocupado(x, y); i++) { a += 0.9; r += 9; x = clamp(cx + Math.cos(a) * r, 6, QW - CW - 6); y = clamp(cy + Math.sin(a) * r * 0.8, 6, QH - 180); }
    x = clamp(x, 6, QW - CW - 6); y = clamp(y, 6, QH - 160);
    Rede.push('caso/mural', { cat: $('[data-f="cat"]', sec).value, texto: txt.slice(0, 200), lote: $('[data-f="lote"]', sec).value || null, x: Math.round(x), y: Math.round(y), rot: +(Math.random() * 4 - 2).toFixed(1), pc: q.pc, nome: q.nome, data: h.data, hora: h.hora, ts: Date.now() }).pronto.catch(rec);
    t.value = ''; CRW.Som.clique();
    vp.scrollTo({ left: x * esc_ - vp.clientWidth / 2 + CW * esc_ / 2, top: y * esc_ - vp.clientHeight / 2 + 60 * esc_, behavior: 'smooth' });
  };
  $('[data-add]', sec).addEventListener('click', fixar);
  $('[data-f="texto"]', sec).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); fixar(); } });
  const pararLigar = () => { ligando = null; $('.cs-ligando', sec).hidden = true; pintar(); };
  const ligar = (a, b) => {
    if (a === b) return pararLigar();
    const ja = lista(ligs).some(l => (l.a === a && l.b === b) || (l.a === b && l.b === a));
    if (!ja) Rede.push('caso/ligacoes', { a, b, pc: eu().pc, ts: Date.now() }).pronto.catch(rec);
    CRW.Som.clique(); pararLigar();
  };
  const editar = id => {
    const c = cards[id]; if (!c) return;
    const w = janela({ titulo: 'Editar pista', largura: '420px', icone: '⌗', html: `<label class="campo">Tipo<select class="w95-input" data-e="cat">${CATS.map(([v, n]) => `<option value="${v}"${v === c.cat ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="campo">Pista<textarea class="w95-input" rows="3" maxlength="200" data-e="texto">${esc(c.texto || '')}</textarea></label>
      <label class="campo">Nota (detalhe, de onde veio)<textarea class="w95-input" rows="2" maxlength="300" data-e="nota">${esc(c.nota || '')}</textarea></label>
      <label class="campo">Local da cidade (aparece no cartão do local no mapa)<select class="w95-input" data-e="lote">${opcoesLote(c.lote || '')}</select></label>
      <p class="mini">Fixado por ${esc(c.nome || '?')} em ${esc(c.data || '')} ${esc(c.hora || '')}.</p>
      <div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    $('[data-ok]', w).addEventListener('click', () => {
      const g = k => $(`[data-e="${k}"]`, w).value.trim();
      if (!g('texto')) return aviso('A pista não pode ficar vazia.', 'erro');
      Rede.update('caso/mural/' + id, { cat: g('cat'), texto: g('texto').slice(0, 200), nota: g('nota').slice(0, 300) || null, lote: g('lote') || null }).catch(rec);
      fecharJanela(w.parentElement.dataset.jan);
    });
  };
  const tirar = async id => {
    const c = cards[id]; if (!c) return;
    if (!(await confirmar(`Tirar a pista do mural?\n\n"${String(c.texto || '').slice(0, 80)}"\n\nAs ligações dela também saem.`))) return;
    lista(ligs).filter(l => l.a === id || l.b === id).forEach(l => Rede.set('caso/ligacoes/' + l.id, null).catch(() => {}));
    Rede.set('caso/mural/' + id, null).catch(rec);
  };
  const achar = id => {
    const c = cards[id]; if (!c) return;
    $('.cs-mlista', sec).hidden = true; $('[data-lista]', sec).classList.remove('on'); vp.hidden = false;
    vp.scrollTo({ left: num(c.x) * esc_ - vp.clientWidth / 2 + CW * esc_ / 2, top: num(c.y) * esc_ - vp.clientHeight / 2 + 60 * esc_, behavior: 'smooth' });
    const e = els[id]; if (e) { e.classList.add('cs-pisca'); setTimeout(() => e.classList.remove('cs-pisca'), 1600); }
  };
  sec.addEventListener('click', async e => {
    const z = e.target.closest('[data-z]');
    if (z) {
      const cx = (vp.scrollLeft + vp.clientWidth / 2) / esc_, cy = (vp.scrollTop + vp.clientHeight / 2) / esc_;
      if (z.dataset.z === 'fit') esc_ = Math.min(vp.clientWidth / QW, 1); else esc_ = esc_ * (z.dataset.z === '+' ? 1.2 : 1 / 1.2);
      aplicarZoom(); vp.scrollLeft = cx * esc_ - vp.clientWidth / 2; vp.scrollTop = cy * esc_ - vp.clientHeight / 2;
    }
    if (e.target.closest('[data-lista]')) { const l = $('.cs-mlista', sec), b = e.target.closest('[data-lista]'); l.hidden = !l.hidden; vp.hidden = !l.hidden; b.classList.toggle('on', !l.hidden); b.textContent = l.hidden ? 'Ver em lista' : 'Ver o quadro'; if (!l.hidden) pintarLista(); else requestAnimationFrame(linhas); }
    if (e.target.closest('[data-exp]')) {
      const l = lista(cards).sort(porTs), byId = Object.fromEntries(l.map(c => [c.id, c.texto]));
      CRW.baixar(`mural-pistas-${CASO.numero}.txt`, `MURAL DE PISTAS · CASO ${CASO.numero} · CROWSREST\nExportado em ${agoraJogo().data} ${agoraJogo().hora} (hora do jogo)\n\n` +
        l.map(c => `[${nomeCat(c.cat)}] ${c.texto}${c.nota ? ' · ' + c.nota : ''}${c.lote ? ' · local: ' + nomeLote(c.lote) : ''}  (${c.nome || ''}, ${c.data || ''} ${c.hora || ''})`).join('\n') +
        (Object.keys(ligs).length ? '\n\nLIGAÇÕES:\n' + lista(ligs).map(g => `  ${byId[g.a] || '?'}  <->  ${byId[g.b] || '?'}`).join('\n') : ''));
    }
    if (e.target.closest('[data-limpar]') && moderador()) {
      if (!(await confirmar('Apagar TODAS as pistas e ligações do mural, para todo o grupo?'))) return;
      Rede.set('caso/mural', null).catch(rec); Rede.set('caso/ligacoes', null).catch(rec);
    }
    if (e.target.closest('[data-cancel]')) pararLigar();
    const lv = e.target.closest('[data-l-ver]'); if (lv) achar(lv.dataset.lVer);
    const le = e.target.closest('[data-l-ed]'); if (le) editar(le.dataset.lEd);
    const ld = e.target.closest('[data-l-des]'); if (ld) Rede.set('caso/ligacoes/' + ld.dataset.lDes, null).catch(rec);
  });
  // barbante: tocar remove
  svg.addEventListener('click', async e => {
    const g = e.target.closest('[data-lig]'); if (!g) return;
    if (await confirmar('Tirar este barbante?')) Rede.set('caso/ligacoes/' + g.dataset.lig, null).catch(rec);
  });
  // arrastar cartões e o fundo (ponteiro: mouse, dedo ou caneta)
  quadro.addEventListener('pointerdown', e => {
    const card = e.target.closest('.clue-card');
    if (!card) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      const s = { x: e.clientX, y: e.clientY, l: vp.scrollLeft, t: vp.scrollTop };
      const mv = ev => { vp.scrollLeft = s.l - (ev.clientX - s.x); vp.scrollTop = s.t - (ev.clientY - s.y); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); quadro.classList.remove('cs-pan'); };
      quadro.classList.add('cs-pan'); addEventListener('pointermove', mv); addEventListener('pointerup', up);
      return;
    }
    if (e.target.closest('button')) return;
    const id = card.dataset.id, c = cards[id]; if (!c) return;
    arrastando = { id, sx: e.clientX, sy: e.clientY, ox: num(c.x), oy: num(c.y), mexeu: false };
    try { card.setPointerCapture(e.pointerId); } catch (er) {}
  });
  quadro.addEventListener('pointermove', e => {
    if (!arrastando) return;
    const dx = (e.clientX - arrastando.sx) / esc_, dy = (e.clientY - arrastando.sy) / esc_;
    if (!arrastando.mexeu && Math.hypot(dx, dy) * esc_ < 5) return;
    const card = els[arrastando.id]; if (!card) return;
    if (!arrastando.mexeu) { arrastando.mexeu = true; card.classList.add('dragging'); }
    const nx = clamp(arrastando.ox + dx, 0, QW - card.offsetWidth), ny = clamp(arrastando.oy + dy, 0, QH - card.offsetHeight);
    card.style.left = nx + 'px'; card.style.top = ny + 'px';
    cards[arrastando.id] = { ...cards[arrastando.id], x: nx, y: ny }; linhas();
    // rola o quadro quando o cartão chega na borda
    const r = vp.getBoundingClientRect(), m = 30;
    if (e.clientX > r.right - m) vp.scrollLeft += 12; else if (e.clientX < r.left + m) vp.scrollLeft -= 12;
    if (e.clientY > r.bottom - m) vp.scrollTop += 12; else if (e.clientY < r.top + m) vp.scrollTop -= 12;
  });
  const soltar = () => {
    if (!arrastando) return;
    const a = arrastando; arrastando = null;
    const card = els[a.id]; if (card) card.classList.remove('dragging');
    if (a.mexeu) { const c = cards[a.id]; Rede.update('caso/mural/' + a.id, { x: Math.round(num(c.x)), y: Math.round(num(c.y)) }).catch(rec); }
    else if (ligando && ligando !== a.id) ligar(ligando, a.id);
    pintar();
  };
  quadro.addEventListener('pointerup', soltar); quadro.addEventListener('pointercancel', soltar);
  quadro.addEventListener('click', e => {
    const b = e.target.closest('[data-a]'); if (!b) return;
    const id = b.closest('.clue-card').dataset.id;
    if (b.dataset.a === 'ligar') {
      if (ligando === id) return pararLigar();
      if (ligando) return ligar(ligando, id);
      ligando = id; $('.cs-ligando', sec).hidden = false; CRW.Som.clique(); pintar();
    }
    if (b.dataset.a === 'editar') editar(id);
    if (b.dataset.a === 'tirar') tirar(id);
  });
  addEventListener('keydown', e => { if (e.key === 'Escape' && ligando && document.body.contains(sec)) pararLigar(); });
  // começa perto dos cartões mais recentes
  requestAnimationFrame(() => { const l = lista(cards).sort(porTs).pop(); if (l) { vp.scrollLeft = num(l.x) * esc_ - vp.clientWidth / 2 + CW * esc_ / 2; vp.scrollTop = num(l.y) * esc_ - vp.clientHeight / 3; } });
}

/* =========================================================
   4. ANEXOS DO GRUPO E ANOTAÇÕES
   ========================================================= */
const MAX_ARQ = 700 * 1024;
function lerDataUrl(f) { return new Promise((ok, falha) => { const r = new FileReader(); r.onload = () => ok(String(r.result)); r.onerror = () => falha(r.error); r.readAsDataURL(f); }); }
async function enviarAnexos(files, lote) {
  const q = eu(); let n = 0;
  for (const f of files) {
    let dados;
    try {
      if (/^image\//.test(f.type) && !/svg|gif/.test(f.type)) dados = await CRW.lerImagem(f, 1000, 0.75);
      else { if (f.size > MAX_ARQ) { aviso(`"${f.name}" passa de 700 KB: reduza o arquivo antes de anexar.`, 'erro'); continue; } dados = await lerDataUrl(f); }
    } catch (e) { aviso(`Não foi possível ler "${f.name}".`, 'erro'); continue; }
    if (dados.length > MAX_ARQ * 1.4) { aviso(`"${f.name}" ficou grande demais para o servidor.`, 'erro'); continue; }
    const h = agoraJogo();
    const tipo = /^data:([^;,]+)/.exec(dados);
    try { await Rede.push('caso/anexos', { nome: String(f.name || 'arquivo').slice(0, 80), tipo: (tipo && tipo[1]) || f.type || 'application/octet-stream', dados, tam: Math.round(dados.length * 0.75), pc: q.pc, autor: q.nome, data: h.data, hora: h.hora, lote: lote || null, ts: Date.now() }).pronto; n++; }
    catch (e) { aviso('O servidor recusou o anexo.', 'erro'); }
  }
  if (n) { aviso(n === 1 ? 'Anexo enviado ao grupo.' : `${n} anexos enviados ao grupo.`); CRW.Som.ding(); }
}
function cardAnexo(a, podeApagar) {
  const img = /^image\//.test(a.tipo || '');
  const ext = (String(a.nome || '').split('.').pop() || 'doc').toUpperCase().slice(0, 5);
  return `<div class="anexo cs-anx" data-anx="${esc(a.id)}"><div class="img"${img ? ' data-ver role="button" tabindex="0"' : ''}>${img ? `<img src="${esc(a.dados)}" alt="${esc(a.nome)}" loading="lazy">` : `<div class="fileicon"><span class="big">▦</span>${esc(ext)}</div>`}</div>
    <div class="mx"><div class="t">${esc(a.nome || 'arquivo')}</div><div class="h">${esc(a.autor || '')} · ${esc(String(a.data || '').slice(0, 5))} ${esc(a.hora || '')} · ${tam(a.tam)}</div>${a.lote ? `<div class="h">⌖ ${esc(nomeLote(a.lote))}</div>` : ''}
      <div class="att-actions"><button data-x="abrir">abrir</button><button data-x="baixar">baixar</button><button data-x="local">local</button>${podeApagar ? '<button data-x="tirar" class="cs-red">remover</button>' : ''}</div></div></div>`;
}
function verImagem(a) { janela({ titulo: a.nome || 'Imagem', classe: 'cs-lbw', largura: '920px', icone: '▣', html: `<div class="cs-lb-palco"><img class="cs-ver" src="${esc(a.dados)}" alt="${esc(a.nome || '')}"></div><p class="mini">${esc(a.autor || '')} · ${esc(a.data || '')} ${esc(a.hora || '')}${a.lote ? ' · ' + esc(nomeLote(a.lote)) : ''}</p>` }); }
async function acaoAnexo(id, x) {
  const a = (Loja.d['caso/anexos'] || {})[id]; if (!a) return;
  const ax = { id, ...a };
  if (x === 'abrir') /^image\//.test(a.tipo || '') ? verImagem(ax) : abrirArquivo(ax);
  if (x === 'baixar') baixarArquivo(ax);
  if (x === 'local') {
    const w = janela({ titulo: 'Ligar o anexo a um local', largura: '400px', html: `<label class="campo">Local da cidade<select class="w95-input" data-l>${opcoesLote(a.lote || '')}</select></label><p class="mini">O anexo aparece no cartão desse local, no mapa.</p><div class="msg-bts"><button class="w95-btn pri" data-ok>Salvar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
    $('[data-ok]', w).onclick = () => { Rede.set(`caso/anexos/${id}/lote`, $('[data-l]', w).value || null).catch(() => aviso('O servidor recusou essa ação.', 'erro')); fecharJanela(w.parentElement.dataset.jan); };
  }
  if (x === 'tirar' && await confirmar(`Remover "${a.nome}" dos anexos do grupo?`)) Rede.set('caso/anexos/' + id, null).catch(() => aviso('O servidor recusou essa ação.', 'erro'));
}
function renderAnexos(sec) {
  sec.innerHTML = `<div class="panel">${cab('Anexos do grupo', 'imagens, PDFs e textos<br>sincronizados')}
    <div class="panel-b"><div class="uploader"><input type="file" multiple accept="image/*,application/pdf,.txt,.doc,.docx,.rtf" hidden data-arq>
      <label class="cs-lb-lote">Local (opcional) <select class="w95-input" data-lote>${opcoesLote('')}</select></label>
      <button class="w95-btn pri" data-anexar>+ Anexar documento</button></div>
      <p class="att-hint">Imagens são reduzidas para no máximo 1000 px. PDFs e outros arquivos: até 700 KB. Todo o grupo vê o que for anexado.</p>
      <div class="anexos cs-anxs"></div><p class="att-empty" data-vazio>Carregando…</p></div></div>`;
  const grade = $('.cs-anxs', sec);
  const pintar = () => {
    const d = Loja.usar('caso/anexos');
    if (d === undefined) return;
    const l = lista(d).sort((a, b) => num(b.ts) - num(a.ts)), me = eu().pc;
    grade.innerHTML = l.map(a => cardAnexo(a, a.pc === me || moderador())).join('');
    const vz = $('[data-vazio]', sec); vz.hidden = !!l.length; vz.textContent = 'Nenhum documento anexado ainda.';
  };
  pintar(); ouvir(sec, 'cs:caso/anexos', pintar);
  $('[data-anexar]', sec).onclick = () => $('[data-arq]', sec).click();
  $('[data-arq]', sec).addEventListener('change', async e => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) { aviso('Enviando…'); await enviarAnexos(fs, $('[data-lote]', sec).value); } });
  grade.addEventListener('click', e => {
    const c = e.target.closest('[data-anx]'); if (!c) return;
    const b = e.target.closest('[data-x]'); if (b) return acaoAnexo(c.dataset.anx, b.dataset.x);
    if (e.target.closest('[data-ver]')) acaoAnexo(c.dataset.anx, 'abrir');
  });
}
function renderAnotacoes(sec) {
  const kPess = 'notaPessoal:' + quemSouChave();
  sec.innerHTML = `<div class="panel">${cab('Anotações do grupo', '<span data-cont>0 registros</span>')}
    <div class="panel-b"><div class="noteform"><textarea class="w95-input notearea" maxlength="1500" placeholder="Escreva uma anotação e toque em Registrar. Cada registro recebe a data e a hora do jogo e o seu nome. Todo o grupo vê."></textarea>
      <div class="linha95"><button class="w95-btn pri" data-reg>Registrar anotação</button><button class="w95-btn" data-exp>Exportar .txt</button></div></div>
      <div class="notelog"></div><p class="att-empty" data-vazio>Carregando…</p></div></div>
    <details class="bloco95 cs-pess"${ls.get('pessAberto', true) ? ' open' : ''}><summary>Bloco de notas pessoal (só neste aparelho)</summary><div class="bloco95-c">
      <textarea class="w95-input notearea cs-pess-t" rows="8" placeholder="Rascunhos, palpites, nomes. Fica só neste aparelho e não vai para o grupo nem para o Mestre.">${esc(ls.get(kPess, ''))}</textarea>
      <p class="mini" data-pst>Salvo automaticamente neste navegador.</p><div class="linha95"><button class="w95-btn" data-pexp>Baixar .txt</button></div></div></details>`;
  const log = $('.notelog', sec);
  const pintar = () => {
    const d = Loja.usar('caso/anotacoes'); if (d === undefined) return;
    const l = lista(d).sort((a, b) => num(b.ts) - num(a.ts)), me = eu().pc;
    log.innerHTML = l.map(n => `<div class="note-entry"><div class="ne-time">${esc(n.data || '')} ${esc(n.hora || '')} · ${esc(n.nome || '')}</div><div class="ne-body">${esc(n.texto || '')}</div>${n.pc === me || moderador() ? `<button class="ne-del" data-del="${esc(n.id)}">excluir</button>` : ''}</div>`).join('');
    $('[data-cont]', sec).textContent = l.length + (l.length === 1 ? ' registro' : ' registros');
    const vz = $('[data-vazio]', sec); vz.hidden = !!l.length; vz.textContent = 'Nenhuma anotação registrada ainda.';
  };
  pintar(); ouvir(sec, 'cs:caso/anotacoes', pintar);
  const ta = $('.notearea', sec);
  $('[data-reg]', sec).onclick = () => {
    const t = (ta.value || '').trim(); if (!t) return aviso('Escreva a anotação antes de registrar.');
    const q = eu(), h = agoraJogo();
    Rede.push('caso/anotacoes', { texto: t.slice(0, 1500), pc: q.pc, nome: q.nome, data: h.data, hora: h.hora, ts: Date.now() }).pronto.catch(() => aviso('O servidor recusou essa ação.', 'erro'));
    ta.value = ''; CRW.Som.clique();
  };
  $('[data-exp]', sec).onclick = () => {
    const l = lista(Loja.d['caso/anotacoes']).sort(porTs);
    CRW.baixar(`anotacoes-${CASO.numero}.txt`, `ANOTAÇÕES DO GRUPO · CASO ${CASO.numero} · CROWSREST\n\n` + l.map(n => `[${n.data || ''} ${n.hora || ''}] ${n.nome || ''}: ${n.texto}`).join('\n\n'));
  };
  log.addEventListener('click', async e => { const d = e.target.closest('[data-del]'); if (d && await confirmar('Excluir esta anotação para todo o grupo?')) Rede.set('caso/anotacoes/' + d.dataset.del, null).catch(() => aviso('O servidor recusou essa ação.', 'erro')); });
  const pt = $('.cs-pess-t', sec); let t = null;
  pt.addEventListener('input', () => { clearTimeout(t); $('[data-pst]', sec).textContent = 'Salvando…'; t = setTimeout(() => { $('[data-pst]', sec).textContent = ls.set(kPess, pt.value) ? 'Salvo neste aparelho.' : 'Sem espaço no navegador para salvar.'; }, 500); });
  $('.cs-pess', sec).addEventListener('toggle', e => ls.set('pessAberto', e.target.open));
  $('[data-pexp]', sec).onclick = () => CRW.baixar('notas-pessoais.txt', pt.value || '');
}

/* ---------- cartão do local (mapa): pistas e anexos daquele lote ---------- */
function cartaoLista(caminho, filtro, html) {
  return (lote, corpo) => {
    if (!logado()) { corpo.innerHTML = ''; return; }
    const pintar = () => {
      const d = Loja.usar(caminho);
      if (d === undefined) { corpo.innerHTML = '<p class="mini">Carregando…</p>'; return; }
      const l = lista(d).filter(x => filtro(x, lote)).sort(porTs);
      corpo.innerHTML = l.length ? html(l) : '';
      corpo.hidden = !l.length;
    };
    pintar(); ouvir(corpo, 'cs:' + caminho, pintar);
  };
}
CRW.registrarCartao({ id: 'cs-mural', ordem: 40, render: cartaoLista('caso/mural', (c, l) => c.lote === l.id, l => `<div class="cs-cart"><b>Pistas do mural (${l.length})</b><ul>${l.map(c => `<li><span class="etq">${esc(nomeCat(c.cat))}</span> ${esc(c.texto || '')} <span class="mini">· ${esc(c.nome || '')}</span></li>`).join('')}</ul><button class="w95-btn" data-abre="mural">Abrir o mural</button></div>`) });
CRW.registrarCartao({ id: 'cs-anexos', ordem: 41, render: cartaoLista('caso/anexos', (a, l) => a.lote === l.id, l => `<div class="cs-cart"><b>Anexos do grupo (${l.length})</b><div class="cs-cart-anx">${l.map(a => /^image\//.test(a.tipo || '') ? `<img src="${esc(a.dados)}" alt="${esc(a.nome)}" title="${esc(a.nome)}">` : `<span class="etq">${esc(a.nome)}</span>`).join('')}</div><button class="w95-btn" data-abre="anexos">Abrir os anexos</button></div>`) });

/* =========================================================
   PAINEL DO MESTRE
   ========================================================= */
// aba Registro: rascunhos em segredos/docs, liberação em estado/docs + estado/liberado
function blocoDocs(c) {
  const desenhar = () => {
    const rasc = Segredos.ler(['docs']) || {}, pub = Estado.get().docs || {}, lib = Estado.get().liberado || {};
    const ids = [...new Set([...Object.keys(rasc), ...Object.keys(pub)])];
    c.innerHTML = `<p class="mini">Documentos extras do caso (resultado de laboratório, depoimento, laudo completo). O rascunho fica só com você (segredos); ao <b>liberar</b>, o documento aparece no fim do módulo escolhido para todos, com o carimbo LIBERADO. <b>Recolher</b> tira de novo da tela dos jogadores.</p>
      <table class="dtable"><thead><tr><th>Documento</th><th style="width:110px">Situação</th><th style="width:170px"></th></tr></thead><tbody>
      ${ids.map(id => { const d = rasc[id] || pub[id] || {}, on = lib[id] === true && pub[id]; return `<tr><td><b>${esc(d.titulo || id)}</b><br><span class="mini">em ${esc((ALVOS.find(a => a[0] === d.alvo) || [])[1] || d.alvo || '?')}${d.ref ? ' · ' + esc(d.ref) : ''}</span></td>
        <td>${on ? '<span class="etq verde">liberado</span>' : '<span class="etq">rascunho</span>'}</td>
        <td><button class="w95-btn" data-d-ed="${esc(id)}">Editar</button> ${on ? `<button class="w95-btn" data-d-rec="${esc(id)}">Recolher</button>` : `<button class="w95-btn pri" data-d-lib="${esc(id)}">Liberar</button>`} <button class="w95-btn perigo" data-d-del="${esc(id)}" aria-label="Apagar">×</button></td></tr>`; }).join('') || '<tr><td colspan="3" class="vazio95">Nenhum documento. Crie um ou importe os segredos.</td></tr>'}
      </tbody></table><div class="linha95"><button class="w95-btn pri" data-d-novo>+ Novo documento</button></div>`;
  };
  desenhar();
  ouvir(c, 'segredos', desenhar);
  let a = '';
  ouvir(c, 'estado', s => { const b = JSON.stringify([s.docs || null, s.liberado || null]); if (b !== a) { a = b; desenhar(); } });
  c.addEventListener('click', async e => {
    const g = k => { const b = e.target.closest(`[data-d-${k}]`); return b ? b.getAttribute('data-d-' + k) : null; };
    if (e.target.closest('[data-d-novo]')) editarDoc(null);
    const ed = g('ed'); if (ed) editarDoc(ed);
    const lb = g('lib'); if (lb) liberarDoc(lb);
    const rc = g('rec'); if (rc) { Estado.definir(['liberado', rc], false); Estado.definir(['docs', rc], null); CRW.diario('revelacao', 'Documento recolhido: ' + ((Segredos.ler(['docs', rc]) || {}).titulo || rc)); }
    const dl = g('del');
    if (dl && await confirmar('Apagar este documento (rascunho e versão liberada)?')) { Segredos.gravar(['docs', dl], null); Estado.definir(['docs', dl], null); Estado.definir(['liberado', dl], null); }
  });
}
function liberarDoc(id) {
  const d = Segredos.ler(['docs', id]) || (Estado.get().docs || {})[id]; if (!d) return;
  Estado.definir(['docs', id], { alvo: d.alvo || 'evidencias', titulo: d.titulo || 'Documento', ref: d.ref || null, html: paraHtml(d.html || ''), ts: Date.now() });
  Estado.definir(['liberado', id], true);
  CRW.diario('revelacao', 'Documento liberado: ' + (d.titulo || id) + ' (' + (d.alvo || '') + ')');
  aviso('Documento liberado para todos.');
}
function editarDoc(id) {
  const d = id ? (Segredos.ler(['docs', id]) || (Estado.get().docs || {})[id] || {}) : { alvo: 'evidencias', titulo: '', ref: '', html: '' };
  const w = janela({ titulo: id ? 'Editar documento' : 'Novo documento', largura: '560px', icone: '▤', html: `
    <label class="campo">Título<input class="w95-input" data-e="titulo" maxlength="80" value="${esc(d.titulo || '')}" placeholder="ex.: Resultado do laboratório"></label>
    <div class="grade2"><label class="campo">Aparece no fim de<select class="w95-input" data-e="alvo">${ALVOS.map(([v, n]) => `<option value="${v}"${v === d.alvo ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
    <label class="campo">Referência (opcional)<input class="w95-input" data-e="ref" maxlength="40" value="${esc(d.ref || '')}" placeholder="ex.: REF 24-1187-X"></label></div>
    <label class="campo">Conteúdo (texto comum: linha em branco separa parágrafos, **assim** fica em negrito; ou HTML)<textarea class="w95-input" rows="9" data-e="html">${esc(d.html || '')}</textarea></label>
    <details class="bloco95"><summary>Pré-visualização</summary><div class="bloco95-c cs-prev"></div></details>
    <div class="msg-bts"><button class="w95-btn" data-ok="0">Salvar rascunho</button><button class="w95-btn pri" data-ok="1">Salvar e liberar</button><button class="w95-btn" data-fechar>Cancelar</button></div>` });
  const g = k => $(`[data-e="${k}"]`, w).value.trim();
  const prev = () => { $('.cs-prev', w).innerHTML = paraHtml(g('html')) || '<p class="mini">Vazio.</p>'; };
  $('[data-e="html"]', w).addEventListener('input', prev); prev();
  w.addEventListener('click', e => {
    const b = e.target.closest('[data-ok]'); if (!b) return;
    if (!g('titulo')) return aviso('Dê um título ao documento.', 'erro');
    const nid = id || ('d' + Date.now().toString(36));
    Segredos.gravar(['docs', nid], { titulo: g('titulo'), alvo: g('alvo'), ref: g('ref') || null, html: g('html') });
    if (b.dataset.ok === '1') setTimeout(() => liberarDoc(nid), 50);
    else if ((Estado.get().liberado || {})[nid] === true) setTimeout(() => liberarDoc(nid), 50);
    fecharJanela(w.parentElement.dataset.jan);
  });
}

// aba Sessão: fotos que mudam (item 28)
function blocoVultos(c) {
  let foto = ls.get('vultoFoto', FOTOS()[0].id), tmp = null;
  const base = () => ({ ativo: false, x: 50, y: 55, escala: 0.18, opacidade: 0.35, forma: 'homem', ...(cfgVultos()[foto] || {}) });
  const desenhar = () => {
    const f = FOTOS().find(x => x.id === foto) || FOTOS()[0]; foto = f.id;
    if (!tmp || tmp.foto !== foto) tmp = { foto, ...base() };
    const ativos = FOTOS().filter(x => (cfgVultos()[x.id] || {}).ativo).map(x => x.titulo);
    c.innerHTML = `<p class="mini">Com a Sangria alta, uma foto que o investigador <b>já viu</b> passa a mostrar um vulto que não estava lá. Quem nunca abriu a foto vê a foto normal na primeira vez; o vulto só aparece da segunda vez em diante. Toque na prévia para posicionar.</p>
      <div class="linha95"><label class="campo cs-inl">Foto<select class="w95-input" data-v="foto">${FOTOS().map(x => `<option value="${x.id}"${x.id === foto ? ' selected' : ''}>${esc(x.titulo)}</option>`).join('')}</select></label>
        <label class="campo cs-inl">Forma<select class="w95-input" data-v="forma"><option value="homem"${tmp.forma === 'homem' ? ' selected' : ''}>Silhueta humana</option><option value="corvo"${tmp.forma === 'corvo' ? ' selected' : ''}>Corvo</option></select></label></div>
      <div class="cs-vprev"><img src="${esc(f.img)}" alt=""><span class="cs-vmira"></span></div>
      <div class="grade2"><label class="campo">Tamanho <span data-vt="escala"></span><input type="range" min="0.05" max="0.6" step="0.01" value="${tmp.escala}" data-v="escala"></label>
        <label class="campo">Opacidade <span data-vt="opacidade"></span><input type="range" min="0.05" max="0.8" step="0.01" value="${tmp.opacidade}" data-v="opacidade"></label></div>
      <label class="chk95"><input type="checkbox" data-v="ativo"${tmp.ativo ? ' checked' : ''}> Vulto ligado nesta foto (para todos, quando a Sangria chegar ao limiar)</label>
      <div class="linha95"><label class="campo cs-inl">Limiar da Sangria<input class="w95-input" type="number" min="0" max="10" value="${limiarVulto()}" data-v="limiar" style="width:70px"></label><span class="mini">Sangria agora: <b>${CRW.sangria()}</b> · ${CRW.sangria() >= limiarVulto() ? 'vultos ligados já aparecem' : 'ainda não aparecem'}</span></div>
      <div class="linha95"><button class="w95-btn pri" data-v-salvar>Salvar</button>${tmp.ativo || (cfgVultos()[foto] || {}).ativo ? '<button class="w95-btn" data-v-desl>Desligar nesta foto</button>' : ''}</div>
      <div class="linha95"><select class="w95-input" data-v="pc">${CRW.pcs().map(p => `<option value="${esc(p.id)}">${esc(p.nome)}</option>`).join('') || '<option value="">(nenhum investigador)</option>'}</select><button class="w95-btn" data-v-ent>Mandar só para ele</button><button class="w95-btn" data-v-tir>Tirar dele</button></div>
      <p class="mini">"Mandar só para ele" mostra este vulto só para aquele investigador, sem depender da Sangria (ainda só a partir da segunda vez que ele abrir a foto). Fotos com vulto ligado: ${ativos.length ? esc(ativos.join(', ')) : 'nenhuma'}.</p>`;
    pintarPrev();
  };
  const pintarPrev = () => {
    const pv = $('.cs-vprev', c); if (!pv) return;
    $('[data-vt="escala"]', c).textContent = Math.round(tmp.escala * 100) + '%';
    $('[data-vt="opacidade"]', c).textContent = Math.round(tmp.opacidade * 100) + '%';
    porVulto(pv, $('img', pv), { ...tmp, opacidade: Math.max(tmp.opacidade, 0.15) }, false);
    const m = $('.cs-vmira', pv); m.style.left = tmp.x + '%'; m.style.top = tmp.y + '%';
  };
  desenhar();
  let a = JSON.stringify([cfgVultos(), CRW.sangria(), CRW.pcs().length]);
  ouvir(c, 'estado', () => { const b = JSON.stringify([cfgVultos(), CRW.sangria(), CRW.pcs().length]); if (b !== a) { a = b; if (!c.querySelector(':focus')) { tmp = null; desenhar(); } } });
  c.addEventListener('input', e => {
    const k = e.target.dataset.v; if (!k) return;
    if (k === 'escala' || k === 'opacidade') { tmp[k] = num(e.target.value); pintarPrev(); }
  });
  c.addEventListener('change', e => {
    const k = e.target.dataset.v; if (!k) return;
    if (k === 'foto') { foto = e.target.value; ls.set('vultoFoto', foto); tmp = null; desenhar(); }
    if (k === 'forma') { tmp.forma = e.target.value; pintarPrev(); }
    if (k === 'ativo') tmp.ativo = e.target.checked;
    if (k === 'limiar') { Estado.definir(['vultos', 'limiar'], clamp(int(e.target.value, 6), 0, 10)); CRW.diario('sessao', 'Limiar dos vultos: Sangria ' + clamp(int(e.target.value, 6), 0, 10)); }
  });
  c.addEventListener('click', e => {
    const pv = e.target.closest('.cs-vprev');
    if (pv) { const img = $('img', pv), r = img.getBoundingClientRect(); tmp.x = Math.round(clamp((e.clientX - r.left) / r.width * 100, 0, 100) * 10) / 10; tmp.y = Math.round(clamp((e.clientY - r.top) / r.height * 100, 0, 100) * 10) / 10; pintarPrev(); }
    const cfg = () => ({ ativo: !!tmp.ativo, x: tmp.x, y: tmp.y, escala: tmp.escala, opacidade: tmp.opacidade, forma: tmp.forma });
    const tit = (FOTOS().find(x => x.id === foto) || {}).titulo || foto;
    if (e.target.closest('[data-v-salvar]')) { Estado.definir(['vultos', foto], cfg()); CRW.diario('sessao', `Vulto ${tmp.ativo ? 'ligado' : 'salvo (desligado)'} em ${tit}`); aviso('Vulto salvo.'); }
    if (e.target.closest('[data-v-desl]')) { tmp.ativo = false; Estado.definir(['vultos', foto], cfg()); CRW.diario('sessao', 'Vulto desligado em ' + tit); }
    const pc = ($('[data-v="pc"]', c) || {}).value;
    if (e.target.closest('[data-v-ent]') && pc) { const r = CRW.entregar(pc, { tipo: 'vulto', foto, ...cfg(), ativo: true }); if (r) { CRW.diario('entrega', `Vulto em ${tit} só para ${(CRW.pc(pc) || {}).nome || pc}`); aviso('Vulto entregue.'); } }
    if (e.target.closest('[data-v-tir]') && pc) { const r = CRW.entregar(pc, { tipo: 'vulto', foto, remover: true }); if (r) aviso('O vulto particular foi retirado.'); }
  });
}

/* =========================================================
   REGISTROS
   ========================================================= */
const logadoV = v => !!(v.mestre || v.aux || v.pc);
CRW.registrarModulo({ id: 'tutorial', titulo: 'Como Usar', grupo: 'sistema', icone: '?', ordem: 1, render: renderTutorial });
CRW.registrarModulo({ id: 'resumo', titulo: 'Resumo do Caso', grupo: 'caso', icone: '▤', ordem: 1, render: renderResumo });
CRW.registrarModulo({ id: 'ocorrencia', titulo: 'Ocorrência', grupo: 'caso', icone: '§', ordem: 2, render: renderOcorrencia });
CRW.registrarModulo({ id: 'evidencias', titulo: 'Evidências', grupo: 'caso', icone: '▣', ordem: 3, render: renderEvidencias });
CRW.registrarModulo({ id: 'laudo', titulo: 'Laudo', grupo: 'caso', icone: '✚', ordem: 4, render: renderLaudo });
CRW.registrarModulo({ id: 'furao', titulo: 'Pessoa de Interesse', grupo: 'caso', icone: '◉', ordem: 6, render: renderFurao });
CRW.registrarModulo({ id: 'mural', titulo: 'Mural de Pistas', grupo: 'investigacao', icone: '⌗', ordem: 10, visivel: logadoV, render: renderMural });
CRW.registrarModulo({ id: 'anexos', titulo: 'Anexos do grupo', grupo: 'investigacao', icone: '▦', ordem: 40, visivel: logadoV, render: renderAnexos });
CRW.registrarModulo({ id: 'anotacoes', titulo: 'Anotações', grupo: 'investigacao', icone: '✎', ordem: 41, visivel: logadoV, render: renderAnotacoes });
CRW.registrarMestre({ id: 'cs-docs', aba: 'registro', titulo: 'Documentos do caso · liberações', ordem: 10, render: blocoDocs });
CRW.registrarMestre({ id: 'cs-vultos', aba: 'sessao', titulo: 'Fotos que mudam (vulto)', ordem: 60, render: blocoVultos });
CRW.registrarRestauracao({ id: 'cs-docs', nome: 'Documentos liberados (voltam a ficar ocultos; os rascunhos ficam)', padrao: false, estado: ['liberado', 'docs'] });
CRW.registrarRestauracao({ id: 'cs-vultos', nome: 'Fotos que mudam (desliga todos os vultos e o limiar)', padrao: false, estado: ['vultos'] });

/* ---------- textos do "Como Usar" ---------- */
const A = (id, titulo, ordem, para, html) => CRW.registrarAjuda({ id, titulo, ordem, para, html });
A('g-siic', 'O que é o SIIC', 1, ['todos'], `<p>O <b>SIIC</b> (Sistema Integrado de Investigação Criminal) é o terminal do <b>Departamento do Xerife do Condado de Crowsrest</b>, uma cidade dos Apalaches, em <b>West Virginia</b>, no ano de <b>1997</b>. É o site da nossa campanha de <b>Candela Obscura</b>: tudo o que o Círculo descobre no caso 24-1187 passa por aqui.</p>
<ul><li>Os <b>documentos oficiais</b> do caso: Resumo, Ocorrência, Evidências, Laudo e Pessoa de Interesse.</li>
<li>O que o grupo constrói junto: <b>Mural de Pistas</b>, <b>Anexos do grupo</b>, <b>Anotações</b>, marcas nas fotos e o <b>Chat</b>.</li>
<li>O mapa da cidade, a ficha do seu personagem e as ferramentas da mesa, cada um explicado na própria seção deste manual.</li></ul>
<p>O visual imita um Windows 95 de delegacia do interior: janelas cinzas, barras azuis e sons sintetizados pelo próprio navegador (nenhum arquivo de áudio).</p>`);
A('g-papeis', 'Papéis', 2, ['todos'], `<ul><li><span class="papel">Guardião da Luz</span> é o Mestre. Vê e grava tudo, lê os segredos (o que ainda não foi revelado), libera documentos, move NPCs e viaturas, cadastra os personagens e cuida do site (backup e restauração).</li>
<li><span class="papel">Auxiliares</span> (nesta campanha estão desligados: tudo fica com o Guardião) ajudam o Mestre na mesa quando ligados no config.js. Veem tudo o que é público e a área privada da mesa, leem as fichas e os pedidos dos jogadores, ajudam a mover NPCs e falam no rádio da polícia. <b>Não</b> leem os segredos.</li>
<li><span class="papel">Investigadores</span> são os jogadores. Veem o que é público, movem a própria peça, preenchem a própria ficha, escrevem no mural, nas anotações, nos anexos e no chat, e mandam pedidos e sussurros ao Mestre.</li></ul>
<p>Cada pessoa vê só o que o papel dela permite, e as regras do servidor conferem a mesma coisa: se alguém tentar algo que o papel não permite, o servidor recusa e aparece o aviso "O servidor recusou essa ação."</p>`);
A('g-entrar', 'Entrar e sair', 3, ['todos'], `<ul><li>Ao abrir o site, a tela preta (BIOS) testa a memória e <b>disca o modem</b> para a base estadual; enquanto isso o site conecta de verdade. Toque na tela ou aperte ENTER para seguir.</li>
<li>Na janela <b>Acesso ao Sistema</b>, escolha o perfil: <b>Investigador</b> (escolha o seu nome; só aparece quem o Mestre cadastrou), <b>Mestre Auxiliar</b> (seu nome e a senha dos auxiliares) ou <b>Guardião da Luz</b> (e-mail e senha da conta do Mestre; no modo local, só a senha).</li>
<li>O <b>✕</b> no canto direito da barra azul de cima encerra a sessão neste aparelho (pede confirmação) e volta para a tela de acesso. O menu <b>Iniciar</b> também tem "Encerrar sessão".</li>
<li><b>Modo local x tempo real</b>: com o servidor configurado, todos veem as mesmas coisas ao mesmo tempo. No modo local (sem servidor), tudo fica só neste navegador: abas do mesmo computador conversam entre si, mas outro aparelho não vê nada.</li>
<li><b>O que fica salvo neste aparelho</b>: o perfil (para não pedir de novo nesta aba), a chave da sua ficha, som ligado ou desligado, o último módulo aberto, o bloco de notas pessoal, as fotos que você já viu, as mensagens já lidas do chat e a configuração do protetor de tela. Limpar os dados do navegador apaga isso; o que é do grupo continua no servidor.</li>
<li><b>A chave da ficha</b>: no primeiro acesso de um investigador, o site cria uma chave de 32 letras e números e guarda neste aparelho. A ficha, as entregas do Mestre e os sussurros ficam presos a essa chave. Para jogar em outro celular, copie a chave aqui e, no aparelho novo, use "Usar outra chave…".</li></ul><div data-cs-chave></div>`);
A('g-menu', 'Menu e celular', 4, ['todos'], `<ul><li>No computador, o menu dos módulos fica à esquerda, em grupos: Sistema, Caso 24-1187, Investigação do grupo, Meu personagem e Guardião da Luz.</li>
<li>No celular, o menu vira uma <b>gaveta</b>: toque em <b>☰ Menu</b> no alto para abrir; toque num módulo ou fora da gaveta para fechar.</li>
<li>O <b>cabeçalho do caso</b> (número, classificação, situação, tarefa) fica recolhido no celular para sobrar espaço: toque em <b>CASO 24-1187 ▾</b> na barra cinza para abrir ou fechar.</li>
<li><b>Badges</b>: o número vermelho ao lado de um módulo mostra novidades que você ainda não viu (mensagens, pistas, anotações, anexos, documentos liberados). No celular, a soma aparece no botão ☰ Menu. Abrir o módulo zera o número.</li>
<li><b>🔊 / 🔇</b> na barra de menu liga e desliga todos os sons do site neste aparelho.</li>
<li><b>Ajuda</b> abre este manual. O botão <b>Iniciar</b>, no canto de baixo, abre o menu do sistema (Sobre o SIIC, protetor de tela, sons, encerrar sessão).</li>
<li>A barra de baixo mostra o último aviso do sistema e o relógio do jogo. No celular as janelas abrem em tela cheia; feche no <b>✕</b>.</li></ul>`);
A('g-tempo', 'Tempo real', 5, ['todos'], `<ul><li><b>O que sincroniza</b>: mapa e peças, relógio e clima do jogo, documentos liberados, mural, anotações, anexos, marcas nas fotos, chat, pedidos, votações, rolagens e fichas. Quando alguém muda algo, os outros veem em segundos, sem recarregar a página.</li>
<li>O indicador na barra cinza de cima mostra a ligação: <b>● AO VIVO</b> (conectado), <b>○ CONECTANDO</b> (abrindo a ligação), <b>○ RECONECTANDO</b> (a internet caiu e o site tenta voltar) e <b>● MODO LOCAL</b> (sem servidor: nada sai deste navegador).</li>
<li>Se a conexão cair depois de ter funcionado, aparece uma <b>faixa vermelha</b> embaixo: "SEM CONEXÃO COM A BASE ESTADUAL". O que você fizer nesse intervalo fica esperando e sobe quando a conexão voltar, desde que a página continue aberta; os outros só veem depois.</li>
<li>Se o servidor recusar uma ação, aparece o aviso "O servidor recusou essa ação." e nada muda para os outros.</li></ul>`);
A('g-passos', 'Primeiros passos', 6, ['todos'], `<div class="steps">
<div class="step"><div class="sn">1</div><div><b>Leia o Resumo do Caso.</b> Depois Ocorrência, Evidências, Laudo e Pessoa de Interesse. Releia as anotações manuscritas: elas dizem o que o documento oficial não diz.</div></div>
<div class="step"><div class="sn">2</div><div><b>Abra as fotos.</b> Em Evidências, toque numa foto para ampliar e marcar pontos de interesse. O grupo inteiro vê as marcas.</div></div>
<div class="step"><div class="sn">3</div><div><b>Monte o Mural de Pistas.</b> Cada descoberta vira um cartão; ligue os cartões com barbante para montar a teia.</div></div>
<div class="step"><div class="sn">4</div><div><b>Anexe e anote.</b> Fotos e documentos que vocês encontrarem vão em Anexos do grupo; conclusões e dúvidas, em Anotações.</div></div>
<div class="step"><div class="sn">5</div><div><b>Fale com o grupo e com o Mestre.</b> No Chat: o canal Geral é de todos; o Sussurro ao Mestre é só entre você e ele.</div></div></div>`);
A('cs-docs', 'Documentos do caso', 10, ['todos'], `<p>Grupo <b>Caso 24-1187</b> do menu. São os papéis oficiais que o grupo já tem:</p>
<ul><li><b>Resumo do Caso</b>: o que se sabe, os números do caso, o alerta de integridade, o registro de atividade (trilha de auditoria, com as irregularidades em vermelho) e o movimento do grupo ao vivo (pistas, anotações e documentos novos).</li>
<li><b>Ocorrência</b>: o boletim do Dep. Wray, com a observação anexa e a anotação manuscrita dele.</li>
<li><b>Evidências</b>: o inventário E-01 a E-07 e os anexos fotográficos. Toque numa foto para ampliar.</li>
<li><b>Laudo</b>: o laudo pericial preliminar com os três achados e a anotação manuscrita da perita.</li>
<li><b>Pessoa de Interesse</b>: a ficha de Dale Renner, "o Furão", com a situação atual.</li></ul>
<p><b>Marcas nas fotos</b>: na foto ampliada, toque em <b>Marcar ponto</b> e depois no lugar da foto; escreva uma observação (opcional). A marca aparece com número para todo o grupo, e a lista embaixo diz quem marcou e quando (hora do jogo). <b>Desfazer minha marca</b> tira a sua última; cada um apaga as próprias marcas, e o Mestre e os auxiliares podem limpar todas.</p>
<p><b>Documentos liberados</b>: quando o Mestre libera um documento novo (um resultado de laboratório, por exemplo), ele aparece no fim do módulo certo, com o carimbo <b>LIBERADO</b>; o módulo ganha um número vermelho e toca o fax.</p>`);
A('cs-docs-m', 'Liberar documentos', 87, ['mestre'], `<ul><li>Painel, aba <b>Registro</b>, bloco <b>Documentos do caso · liberações</b>. <b>+ Novo documento</b>: título, módulo onde aparece (Resumo, Ocorrência, Evidências, Laudo ou Pessoa de Interesse), referência opcional e o conteúdo.</li>
<li>O conteúdo pode ser texto comum (linha em branco separa parágrafos; <b>**palavra**</b> vira negrito) ou HTML. A pré-visualização mostra como fica.</li>
<li><b>Salvar rascunho</b> guarda só para você, em segredos (fica fora do código e vai junto no "Exportar segredos"). <b>Salvar e liberar</b> ou <b>Liberar</b> publica para todos. <b>Recolher</b> tira da tela dos jogadores (o rascunho fica). <b>×</b> apaga de vez.</li>
<li>O arquivo de segredos pode trazer rascunhos prontos (por exemplo, um resultado de laboratório); depois de importar, eles aparecem nesta lista para você liberar na hora certa. Cada liberação vai para o diário da sessão.</li>
<li>No "Restaurar o site", o item "Documentos liberados" (desmarcado por padrão) volta tudo a ficar oculto.</li></ul>`);
A('cs-mural', 'Mural de Pistas', 20, ['todos'], `<p>Grupo <b>Investigação do grupo</b>. O quadro de cortiça do grupo, igual para todos e ao vivo.</p>
<ul><li>Escolha o tipo (<b>Pessoa, Local, Objeto, Contradição, Outro</b>), escreva a pista, escolha o local da cidade se houver e toque em <b>Fixar no mural</b>. O cartão aparece no meio da parte do quadro que você está vendo, com o seu nome e a hora do jogo.</li>
<li><b>Arrastar</b>: segure o cartão com o dedo ou o mouse e solte onde quiser. Para andar pelo quadro, arraste o fundo (no computador, arraste com o mouse; no celular, deslize o dedo fora dos cartões). <b>−</b> e <b>+</b> mudam o zoom; <b>Ver tudo</b> mostra o quadro inteiro.</li>
<li><b>Ligar</b>: toque em Ligar num cartão e depois toque em outro cartão: um barbante vermelho liga os dois. Toque no barbante para tirá-lo.</li>
<li><b>Editar</b> muda tipo, texto, uma nota de detalhe e o local; <b>Tirar</b> remove o cartão e os barbantes dele.</li>
<li>Pista com local aparece também no <b>cartão do local</b>, no mapa.</li>
<li><b>Ver em lista</b> mostra tudo em tabela (bom para tela pequena), com <b>Achar</b> para pular até o cartão no quadro. <b>Exportar .txt</b> baixa as pistas e as ligações. O Mestre e os auxiliares têm <b>Limpar tudo</b>.</li></ul>`);
A('cs-anexos', 'Anexos do grupo', 21, ['todos'], `<ul><li>Grupo <b>Investigação do grupo</b>. Toque em <b>+ Anexar documento</b> e escolha um ou mais arquivos: fotos que vocês tirarem, PDFs, textos.</li>
<li>Imagens são reduzidas para no máximo 1000 px antes de subir. PDFs e outros arquivos podem ter até <b>700 KB</b>; maior que isso o site recusa e avisa.</li>
<li>Escolha um <b>local</b> antes de anexar (ou depois, em "local") para o anexo aparecer no cartão daquele lugar, no mapa.</li>
<li><b>abrir</b> mostra a imagem ou abre o PDF numa aba nova; <b>baixar</b> salva no aparelho; <b>remover</b> aparece para quem anexou e para o Mestre e os auxiliares.</li></ul>`);
A('cs-anotacoes', 'Anotações', 22, ['todos'], `<ul><li><b>Anotações do grupo</b>: escreva e toque em <b>Registrar anotação</b>. Cada registro leva o seu nome e a data e a hora do jogo, e aparece para todos. Cada um exclui as próprias; o Mestre e os auxiliares podem excluir qualquer uma. <b>Exportar .txt</b> baixa todas.</li>
<li><b>Bloco de notas pessoal</b>: o quadro de baixo é só seu, fica <b>só neste aparelho</b> e salva sozinho enquanto você digita. Ninguém mais lê, nem o Mestre. Use <b>Baixar .txt</b> para guardar uma cópia.</li></ul>`);
A('cs-vultos', 'Fotos que mudam', 88, ['mestre', 'aux'], `<ul><li>Painel, aba <b>Sessão</b>, bloco <b>Fotos que mudam (vulto)</b>. Escolha a foto, a forma (silhueta humana ou corvo), toque na prévia para posicionar e ajuste tamanho e opacidade. Marque <b>Vulto ligado</b> e toque em <b>Salvar</b>.</li>
<li>O vulto só aparece para o investigador quando: a Sangria da cidade está no <b>limiar</b> ou acima (padrão 6, você muda no campo "Limiar da Sangria") <b>e</b> ele <b>já tinha visto</b> aquela foto antes. Quem nunca abriu a foto vê a foto normal na primeira vez; da segunda em diante, o vulto está lá. Ele também aparece na miniatura.</li>
<li><b>Mandar só para ele</b> entrega o vulto a um investigador (sem depender da Sangria); <b>Tirar dele</b> desfaz.</li>
<li>Você e os auxiliares sempre veem os vultos ligados, com a etiqueta "vulto ligado" na foto ampliada, para conferir a posição. Use "Ver pelos olhos de" para ver como o jogador vê.</li>
<li>No "Restaurar o site", o item "Fotos que mudam" (desmarcado por padrão) desliga todos. Cada aparelho esquece as fotos vistas depois de uma restauração.</li></ul>`);
A('g-painel', 'Painel do Guardião', 80, ['mestre', 'aux'], `<p>Módulo <b>Painel do Guardião</b>, no grupo Guardião da Luz do menu. Tem cinco abas; cada aba junta blocos recolhíveis (toque no título do bloco para abrir ou fechar; o site lembra a escolha).</p>
<ul><li><b>Mapa</b>: Personagens (investigadores), Quem está conectado e os blocos do mapa.</li>
<li><b>Sessão</b>: o que se usa durante a cena, como Fotos que mudam, e o Diário e relatório da sessão.</li>
<li><b>Mesa</b>: ferramentas da mesa e Ver pelos olhos de · Tela de TV.</li>
<li><b>Registro</b>: registros do caso, como Documentos do caso · liberações.</li>
<li><b>Segredos</b>: Segredos (importar e exportar), Backup e Restaurar e Gerar hash de senha.</li></ul>
<p>Cada módulo do site acrescenta os seus blocos na aba que faz sentido; cada bloco está explicado na seção do módulo dele neste manual.</p>
<p>Os <b>auxiliares</b> veem o painel só com os blocos liberados para eles (por exemplo, Quem está conectado); as abas sem bloco para eles não aparecem.</p>
<p>Avisos para o Mestre (pedido novo, jogador entrou num lugar) aparecem em balões amarelos no canto; somem sozinhos em 30 segundos ou no ×. Com dois ou mais, aparece "Fechar todos".</p>`);
A('g-pcs', 'Personagens', 81, ['mestre'], `<ul><li>Painel, aba <b>Mapa</b>, bloco <b>Personagens (investigadores)</b>. <b>+ Novo investigador</b> abre o cadastro: nome do personagem, jogador(a), papel e especialidade (com sugestões de Candela), cor da peça no mapa e retrato opcional.</li>
<li>Cadastrar cria a peça do personagem no mapa, na frente da delegacia, e o nome passa a aparecer na tela de acesso dos jogadores. Cadastre <b>antes</b> de os jogadores entrarem.</li>
<li><b>Editar</b> muda os dados; <b>×</b> apaga o investigador e tira a peça do mapa (a ficha do jogador continua salva com ele).</li></ul>`);
A('g-espiar', 'Ver pelos olhos de e TV', 82, ['mestre'], `<ul><li>Painel, aba <b>Mesa</b>, bloco <b>Ver pelos olhos de · Tela de TV</b>. Escolha um investigador e toque em <b>Ver pelos olhos</b>: o site mostra só o que aquele jogador vê (menu, documentos, mapa) e os segredos somem da sua tela. Uma faixa lembra quem você está vendo; <b>Voltar à visão do Mestre</b> desfaz. Isso muda só a sua tela. Enquanto espia, o chat fica só de leitura.</li>
<li><b>Abrir a tela de TV</b> abre uma aba nova (endereço terminado em ?tv=1) só com o mapa na visão dos jogadores, sem menus e sem login, para projetar na TV da mesa. Nessa tela o protetor de tela nunca liga.</li></ul>`);
A('g-diario', 'Diário e relatório', 83, ['mestre'], `<ul><li>Painel, aba <b>Sessão</b>, bloco <b>Diário e relatório da sessão</b>. O site anota sozinho o que acontece na mesa (revelações, entregas, cadastros, importações, rolagens importantes) com a data e a hora do jogo. Só você lê.</li>
<li><b>Marcar nova sessão</b> dá nome à sessão (ex.: "Sessão 2") e começa um diário novo.</li>
<li><b>Baixar diário (.txt)</b> salva o texto; <b>Relatório da sessão</b> imprime (ou salva em PDF) o resumo, o diário e as mensagens do chat geral daquela sessão, no papel de formulário contínuo da impressora matricial.</li></ul>`);
A('g-segredos', 'Segredos fora do código', 84, ['mestre'], `<ul><li>O código do site fica público no GitHub. Por isso, <b>nada que ainda não foi revelado</b> (o que existe em cada local, salas, NPCs fichados, senhas dos subsolos, documentos ainda não liberados) fica nos arquivos do site.</li>
<li>Os segredos ficam num arquivo <b>segredos-crowsrest.json</b>, guardado <b>fora do GitHub</b> (no seu computador ou na sua nuvem pessoal). Painel, aba <b>Segredos</b>, bloco <b>Segredos (importar e exportar)</b>: <b>Importar segredos…</b> manda o conteúdo do arquivo para a área do servidor que só você lê. O que já existe com o mesmo nome é substituído; o resto fica.</li>
<li><b>Exportar segredos</b> baixa o que está no servidor agora (inclusive o que você criou pelo painel), para guardar a versão atualizada.</li>
<li>Nunca suba esse arquivo para o GitHub nem mande no grupo dos jogadores.</li></ul>`);
A('g-backup', 'Backup e Restaurar', 85, ['mestre'], `<ul><li>Painel, aba <b>Segredos</b>, bloco <b>Backup e Restaurar</b>. <b>Baixar backup</b> salva tudo (mapa, segredos, chat, fichas, investigação do grupo) num arquivo .json. Guarde fora do GitHub: ele tem os segredos.</li>
<li><b>Restaurar backup…</b> troca o conteúdo do site pelo de um arquivo de backup (pede confirmação).</li>
<li><b>Restaurar o site…</b> zera o que foi feito em testes: marque os itens (mapa e jogo, chat, investigação do grupo, pedidos, entregas, diário e os itens de cada módulo) e digite RESTAURAR. Antes de apagar, o site baixa um backup completo. Personagens, segredos e fichas dos jogadores nunca são apagados.</li>
<li>Depois de uma restauração, cada aparelho limpa sozinho o que guardava sobre o jogo (fotos já vistas, por exemplo).</li></ul>`);
A('g-hash', 'Gerar hash', 86, ['mestre'], `<ul><li>Só para o modo local (sem servidor). O site não guarda senha em texto: guarda a "impressão digital" (hash SHA-256) dela no config.js.</li>
<li>Painel, aba <b>Segredos</b>, bloco <b>Gerar hash de senha</b>: digite a senha nova, toque em <b>Gerar hash</b> e cole o resultado no config.js, em CRW_SENHA_MESTRE (Mestre) ou CRW_SENHA_AUX (auxiliares).</li>
<li>Com o servidor (Firebase), o Mestre entra com o e-mail e a senha da conta dele, e os auxiliares com a senha da conta de auxiliares criada no Authentication.</li></ul>`);
})();
