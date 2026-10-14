# SIIC · Crowsrest

Sistema Integrado de Investigação Criminal do Departamento do Xerife do Condado de Crowsrest (West Virginia, 1997). É o site da campanha de **Candela Obscura** do Dr. Rodrigo Terroso: um terminal policial no estilo Windows 95, em tempo real, com mapa funcional da cidade, ficha de Candela, investigação gamificada e as ferramentas do Guardião da Luz.

O manual completo está dentro do próprio site, em **Como Usar** (cada papel vê a parte que lhe cabe; o Guardião pode ver o manual como qualquer papel e imprimir). Este README explica a instalação, a estrutura e o que existe em cada parte.

---

## 1. Como o site funciona

- **Três papéis.** *Guardião da Luz* (o Mestre: vê e grava tudo, lê os segredos), *Mestres auxiliares* (veem o público e a área privada da mesa, leem fichas e pedidos, movem NPCs, falam no rádio) e *Investigadores* (os jogadores: cada um entra escolhendo o próprio personagem).
- **Tempo real.** Usa o mesmo projeto Firebase da Planta da A.C.F., num espaço separado chamado `crowsrest`. O que o Guardião libera aparece na hora para todos. Sem internet ou sem Firebase (`FIREBASE = null` no `config.js`), o site roda em **modo local**: tudo fica no navegador e só as abas do mesmo computador conversam.
- **Segredos fora do código.** Tudo o que vai para o GitHub é público. O que ainda não foi revelado mora no servidor, numa área que só o Guardião lê, e chega lá pelo arquivo `segredos-crowsrest.json` (fora do GitHub), importado no painel.
- **Celular primeiro.** Menu em gaveta, cabeçalho do caso recolhível, janelas em tela cheia, barras que rolam de lado. Testado em 360 px, 412 px e no computador, nos três papéis.

## 2. Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da janela do sistema, selo do departamento, carregamento dos módulos |
| `config.js` | Conexão Firebase, raiz `crowsrest`, e-mail dos auxiliares, impressões digitais das senhas do modo local |
| `dados.js` | Tudo o que é público: cidade (ruas, bairros, 38 locais, plantas internas), NPCs públicos, documentos do caso 24-1187, termos de Candela |
| `nucleo.js` | Motor: sincronização, papéis, login, módulos do menu, janelas Win95, sons, relógio do jogo, fichas e entregas, ajuda |
| `mapa.js` / `mapa.css` | O mapa da cidade (itens 6 a 17 e 39) |
| `caso.js` / `caso.css` | Como Usar, documentos do caso, fotos com marcas e vultos, Mural de Pistas, anexos, anotações |
| `chat.js` | Chat geral, rádio da polícia, sussurro ao Mestre, canal dos auxiliares |
| `ficha.js` / `ficha.css` | Ficha de Candela, rolador, rolagens da mesa, fichas de NPC |
| `investigacao.js` / `investigacao.css` | Interrogatório, laboratório, coleta e custódia, terminal de bases, Arquivo do Condado e microfilme |
| `comunicacao.js` / `comunicacao.css` | Tarefas, pager/secretária/rádio, Sentinel diário, quadro de suspeitos, acusação final, relatório |
| `sessao.js` / `sessao.css` | Sangria, contagens, aberturas, distintivos, Investigador da Semana, Mural de Honra, exposição, apagão, holofote, dilema, momentos, lojas |
| `mestre.js` | Painel do Guardião: personagens, conectados, ver pelos olhos, TV, diário, backup, restaurar, importar segredos |
| `w95.js` | Imersão 1997: sons, protetor de tela, menu Iniciar, relógio, barra de impressão |
| `style.css` | Tema Windows 95 e componentes comuns |
| `img/` | As cinco fotos do caso |

A versão aparece no rodapé (`SIIC v4.0 · 19970521a`).

## 3. Publicar e configurar

1. **GitHub.** Suba o conteúdo da pasta `crowsrest/` para o repositório (substituindo o site antigo). **Não suba** nada da pasta `fora-do-github/`.
2. **Regras do Firebase.** No console do projeto `a-planta-caixadefosforos`, em *Realtime Database > Regras*, cole o conteúdo de `fora-do-github/regras-firebase-combinadas.json` e publique. É o mesmo conjunto de regras da Planta, sem nenhuma alteração, mais o bloco `crowsrest`.
3. **Conta dos auxiliares (opcional).** Em *Authentication > Usuários*, crie `auxiliares@crowsrest.com` com a senha que quiser. Os auxiliares entram com o próprio nome e essa senha.
4. **Conta do Guardião.** É a mesma conta de Mestre da Planta (o UID já está nas regras).
5. **Segredos.** Entre como Guardião e importe `fora-do-github/segredos-crowsrest.json` (Painel, aba Segredos).
6. **Modo local.** Para testar sem servidor, troque `FIREBASE` por `null` no `config.js`. Senhas do modo local: Guardião `corvo`, auxiliares `vigilat` (troque pelo bloco "Gerar hash").

Projeto Firebase separado, se preferir: cole a configuração dele no `config.js`, troque `CRW_RAIZ` por `''` e use só o bloco `crowsrest` das regras como raiz, ajustando o UID do Mestre.

## 4. As 48 funções e onde estão

**A. Fundação**
1. Tempo real com papéis: `nucleo.js` (Firebase ou modo local).
2. Segredos fora do código: servidor + `segredos-crowsrest.json`; a senha "corvo" saiu do código e virou login de verdade.
3. Arquivos separados, imagens em `img/`, versão no rodapé.
4. Celular primeiro: gaveta, cabeçalho recolhível, testes em 412 e 360 px.
5. Backup e Restaurar: Painel, aba Segredos.

**B. Mapa da cidade** (menu Caso, *Mapa de Crowsrest*)
6. Mapa 2.5D: girar, ISO, de cima, zoom, régua em m e km (1 quadradinho = 25 m), 38 locais com nome e 30 casas de moradores (68 lotes clicáveis).
7. Cidade, prédio e andar: 10 prédios com planta interna; subsolos da fundição e porão do clube com senha.
8. Peças: cada jogador move só a sua; Guardião e auxiliares movem NPCs e viaturas; rondas por rota.
9. Névoa de guerra: locais desconhecidos viram nuvem; a neblina fecha a visão e engrossa com a Sangria.
10. Relógio, dia e noite: luz, postes, janelas, lojas abertas ou fechadas, rotinas dos NPCs por horário.
11. Clima: neblina, chuva, temporal com relâmpagos, sirene, corte de luz.
12. Quatro saídas com bloqueio policial.
13. Gatilhos e alertas ("Ada e Tom entraram no Cemitério").
14. Cartão do local: quem está ali, fotos, testemunhas, descobertas, coletas, pistas do mural, anexos e edições do jornal.
15. Som ambiente por bairro.
16. Sinal no mapa e marcadores do grupo, sincronizados.
17. Replay da sessão no mapa.

**C. Candela Obscura**
18. Ficha completa e sincronizada (o Guardião só lê): *Minha ficha* e *Fichas dos investigadores*.
19. Medidor de Sangria da cidade com limiares e manifestações: *Sangria e Contagens*.
20. Dados de contagem regressiva visíveis ou secretos: Painel, aba Sessão.
21. Rolador de Candela com dado dourado, destaque e rolagem secreta: botão Rolar na ficha e *Rolagens da mesa*.
22. Tarefas com dossiês: *Tarefas (dossiês)*.

**D. Investigação**
23. Sala de interrogatório com fita cassete e contradições.
24. Laboratório com prazo em horas de jogo e resultado por fax.
25. Coleta no local ("evidência coletada") e cadeia de custódia.
26. Consulta às bases no terminal, com registros SELADOS.
27. Arquivo do Condado com tarjas e rasuras, e microfilme com lupa.
28. Fotos que mudam (vulto) com a Sangria alta.
29. Pager, secretária eletrônica e rádio: *Caixa de mensagens*.
30. Crowsrest Sentinel diário.
31. Quadro de suspeitos com status.
32. Acusação final (quem, como, onde).
33. Relatório de Investigação (Formulário CCSO-27, imprimir ou PDF).

**E. Gamificação**
34. Aberturas: VHS "Anteriormente…", inicialização do SIIC, telejornal e encerramento.
35. Distintivos policiais secretos: *Meus distintivos*.
36. Investigador da Semana (votação secreta).
37. Mural de Honra e Arquivo Morto.
38. Exposição (no site, "quem está de olho", para não escrever "culto" no código público).
39. Perseguição de carro no mapa, com turnos e cronômetro.
40. Queda de energia (lanterna) e neblina total.
41. Holofote, dilema secreto e momentos marcantes.
42. Almoxarifado da delegacia e Penhores de Pulptown.
43. Chat com sussurros ao Mestre e canal do rádio.

**F. Guardião da Luz**
44. Painel com abas Mapa, Sessão, Mesa, Registro e Segredos.
45. NPCs fichados no padrão de Candela: Painel, aba Registro.
46. "Ver pelos olhos de" e tela de TV: Painel, aba Mesa.
47. Diário automático e relatório da sessão: Painel, aba Sessão.

**G. Imersão 1997**
48. Sons do Windows 95, discagem de modem ao conectar, protetor de tela (corvos, neblina, VIGILAT IN TENEBRIS) e impressora matricial nos relatórios.

## 5. Onde ficam os dados (Firebase, dentro de `crowsrest/`)

| Caminho | Lê | Grava |
|---|---|---|
| `estado` | todos | Guardião (jogadores só movem a própria peça) |
| `segredos` | Guardião | Guardião |
| `privado` | Guardião e auxiliares | Guardião e auxiliares |
| `caso` | quem está logado | quem está logado (mural, marcadores, coletas, suspeitos, anotações) |
| `pedidos/<tipo>` | Guardião e auxiliares | jogador cria, não altera |
| `votos`, `rolagens` | quem está logado | quem está logado (rolagem não se altera) |
| `fichas/<chave>` | dono, Guardião e auxiliares | só o dono |
| `entregas/<chave>`, `conqJog/<chave>` | o dono | Guardião |
| `chat` | conforme o canal | conforme o canal |
| `presenca` | todos | quem está logado |

A "chave" é um código de 32 letras guardado no aparelho do jogador. Em outro aparelho, ele recupera a ficha pelo "Código da ficha".

## 6. Limitações e pontos para conferir

- **Nomes dos papéis de Candela em português.** Só "Estranho" foi conferido no livro. Face, Músculo, Erudito e Furtivo são tradução provisória (ficam em `dados.js`, fácil de corrigir).
- **Números de regra não conferidos** e deixados editáveis: máximo de pontos por ação (3), de impulsos (9), tamanho da Iluminação (12), efeito do dado dourado (o padrão troca um dado comum; há opção de somar), regra de descida dos dados de contagem, escala da Sangria (0 a 10) e faixas de exposição.
- **Voto secreto.** A tela esconde os votos até o fim, mas as regras deixam quem está logado ler `votos/`. Para sigilo técnico total seria preciso restringir a leitura ao Guardião (o quadro de quem já votou deixaria de aparecer para os jogadores).
- **Depende do aparelho do Guardião aberto:** publicação automática do resultado do laboratório no prazo, gatilhos, rotinas dos NPCs e gravação do replay.
- **Atestados do Arquivo do Condado:** os nomes das vítimas não existem na campanha; estão sob tarja como "(preencher)". Preencha antes de revelar.
- **Rotinas dos NPCs** nas sementes são sugestões de horário (desligadas); ajuste à sua mesa.
- **Histórico do Git.** O site antigo tinha a senha "corvo" e o resultado do DNA no código. Mesmo substituído, isso continua no histórico do repositório.
