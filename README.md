# SIIC · Crowsrest

Sistema Integrado de Investigação Criminal do Departamento do Xerife do Condado de Crowsrest (West Virginia, 1997). É o site da campanha de **Candela Obscura** do Dr. Rodrigo Terroso: um terminal policial no estilo Windows 95, em tempo real, com mapa funcional da cidade, ficha de Candela, investigação gamificada e as ferramentas do Guardião da Luz.

O manual completo está dentro do próprio site, em **Como Usar** (cada papel vê a parte que lhe cabe; o Guardião pode ver o manual como qualquer papel e imprimir). Este README explica a instalação, a estrutura e o que existe em cada parte.

---

## 1. Como o site funciona

- **Papéis.** *Guardião da Luz* (o Mestre: vê e grava tudo, lê os segredos) e *Investigadores* (os jogadores: cada um entra escolhendo o próprio personagem). O site também sabe trabalhar com *Mestres auxiliares*, mas nesta campanha eles estão desligados (`CRW_AUXILIARES = false` no `config.js`): a opção nem aparece no login e as regras do servidor não dão poder a ninguém além do Guardião.
- **Tempo real.** Usa um projeto Firebase só do Crowsrest (`crowsrest-ab58b`), separado da Planta da A.C.F. Os dados ficam na pasta `crowsrest` do banco. Só a conta cujo UID está no `config.js` e nas regras é tratada como Mestre; qualquer outra conta de e-mail é recusada. Sem internet (`FIREBASE = null` no `config.js`), o site roda em **modo local**: tudo fica no navegador e só as abas do mesmo computador conversam.
- **Segredos fora do código.** Tudo o que vai para o GitHub é público. O que ainda não foi revelado mora no servidor, numa área que só o Guardião lê, e chega lá pelo arquivo `segredos-crowsrest.json` (fora do GitHub), importado no painel.
- **Cidade em tamanho real, em 4 regiões.** O mapa é dividido como os andares da Planta: **1 · Centro** (1,6 km de lado), **2 · Colina de Kettle** (5,8 km), **3 · Distrito da Fundição** (9,6 km) e **4 · Vale Sul** (16 km). Do Centro até os outros locais são de 2 a 22 km. Os jogadores andam a pé dentro da região e precisam de **carro** para ir de uma região para outra. As viagens andam com o relógio do jogo.
- **Celular primeiro.** Menu em gaveta, cabeçalho do caso recolhível, janelas em tela cheia, barras que rolam de lado. Testado em 360 px, 412 px e no computador, nos três papéis.

## 2. Arquivos

| Arquivo | O que faz |
|---|---|
| `index.html` | Estrutura da janela do sistema, selo do departamento, carregamento dos módulos |
| `config.js` | Conexão Firebase (projeto crowsrest-ab58b), raiz `crowsrest`, UID do Guardião, auxiliares (desligados), impressões digitais das senhas do modo local |
| `dados.js` | Tudo o que é público: as 4 regiões da cidade (escala, ruas, bairros, placas de estrada, saídas do condado e as estradas entre as regiões), 38 locais, plantas internas, NPCs públicos, documentos do caso 24-1187, termos de Candela |
| `nucleo.js` | Motor: sincronização, papéis, login, módulos do menu, janelas Win95, sons, relógio do jogo, fichas e entregas, ajuda |
| `mapa.js` / `mapa.css` | O mapa da cidade (itens 6 a 17 e 39): regiões, rotas, viagens e veículos |
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

A versão aparece no rodapé (`SIIC v4.0 · 19970521e`).

## 3. Publicar e configurar

Projeto Firebase: **crowsrest-ab58b** (a Planta continua no projeto dela, sem nenhuma alteração).

1. **GitHub.** Suba os arquivos do site para o repositório (substituindo o site antigo). **Não suba** `segredos-crowsrest.json` nem `regras-firebase-crowsrest.json`.
2. **Authentication > Método de login:** ative **E-mail/senha** (a conta do Guardião) e **Anônimo** (o login dos jogadores).
3. **Authentication > Usuários:** a conta do Guardião já existe (UID `ggtj9tdNUFer52DfdYeeHPjTDWc2`, o mesmo que está no `config.js` e nas regras).
4. **Realtime Database > Regras:** apague o conteúdo e cole `regras-firebase-crowsrest.json`. Publique.
5. **Segredos.** Entre como Guardião e importe `segredos-crowsrest.json` (Painel, aba Segredos).
6. **Modo local.** Para testar sem servidor, troque `FIREBASE` por `null` no `config.js`. Senha do Guardião no modo local: `corvo` (troque pelo bloco "Gerar hash").

Se um dia trocar a conta do Guardião, o UID novo precisa ir para o `config.js` (`CRW_UID_MESTRE`) e para as regras.

## 4. As 48 funções e onde estão

**A. Fundação**
1. Tempo real com papéis: `nucleo.js` (Firebase ou modo local).
2. Segredos fora do código: servidor + `segredos-crowsrest.json`; a senha "corvo" saiu do código e virou login de verdade.
3. Arquivos separados, imagens em `img/`, versão no rodapé.
4. Celular primeiro: gaveta, cabeçalho recolhível, testes em 412 e 360 px.
5. Backup e Restaurar: Painel, aba Segredos.

**B. Mapa da cidade** (menu Caso, *Mapa de Crowsrest*)
6. Mapa 2.5D em 4 regiões (botões 1 a 4, como os andares da Planta, sem senha): girar, ISO, de cima, zoom, régua com o tempo a pé e de carro (cada região tem a sua escala: 25, 60, 75 e 100 m por quadradinho), 38 locais com nome e as casas de moradores. **🗺 Condado** mostra as regiões, as estradas e a tabela de distâncias.
   - **Viagens:** "🚗 Ir…", "🚗 Ir até aqui" no cartão do local ou arrastar a peça abre a escolha a pé ou de carro, com a distância pela estrada e a hora de chegada. A peça anda com o relógio do jogo e o Guardião é avisado da saída e da chegada. A pé, só dentro da região (o Guardião pode liberar).
   - **Carros dos investigadores:** o Guardião cria os carros (nome, cor, lugares, quem tem a chave, onde estão). Quem está perto entra; quem tem a chave assume o volante e dirige; os passageiros vão junto.
7. Cidade, prédio e andar: 10 prédios com planta interna; subsolos da fundição e porão do clube com senha.
8. Peças: cada jogador move só a sua (passos curtos na hora, o resto vira viagem); o Guardião move qualquer peça na hora e tem "Levar para…" e "Chegar agora"; NPCs e viaturas com rondas por rota (na mesma região).
9. Névoa de guerra: locais desconhecidos viram nuvem; a neblina fecha a visão e engrossa com a Sangria.
10. Relógio, dia e noite: luz, postes, janelas, lojas abertas ou fechadas, rotinas dos NPCs por horário.
11. Clima: neblina, chuva, temporal com relâmpagos, sirene, corte de luz.
12. Quatro saídas do condado com bloqueio policial: Oeste (Centro), Leste e Norte (Distrito da Fundição) e Sul (Vale Sul).
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
| `estado` | todos | Guardião (jogadores só movem a própria peça). Inclui `veiculos` (os carros) e `viagemCfg` (viagens instantâneas, a pé entre regiões) |
| `segredos` | Guardião | Guardião |
| `privado` | Guardião | Guardião |
| `caso` | quem está logado | quem está logado (mural, marcadores, coletas, suspeitos, anotações e `veiculos`: onde cada carro está, quem dirige e a viagem dele) |
| `pedidos/<tipo>` | Guardião | jogador cria, não altera |
| `votos`, `rolagens` | quem está logado | quem está logado (rolagem não se altera) |
| `fichas/<chave>` | dono e Guardião | só o dono |
| `entregas/<chave>`, `conqJog/<chave>` | o dono | Guardião |
| `chat` | conforme o canal | conforme o canal |
| `presenca` | todos | quem está logado |

A "chave" é um código de 32 letras guardado no aparelho do jogador. Em outro aparelho, ele recupera a ficha pelo "Código da ficha".

## 6. Limitações e pontos para conferir

- **Regiões e distâncias (decisões de mapa, confira).** Para a cidade ter tamanho real, alguns locais mudaram de região e de endereço: a **Serraria** saiu do Centro e foi para o Vale Sul (km 1 da Estrada do Vale); a **Fazenda Harlan** passou de "Estrada do Vale, km 3" para **km 10**; os **Depósitos** e os **Galpões sem placa** ficam à beira da **Rodovia Hollow Mill, km 6** (como no material antigo, "às margens da Rodovia Hollow Mill, perto da saída norte"), ligados à Cena do Chevette (km 4) por uma trilha; o **Mirante** ficou no topo da Estrada da Colina. A Fundição continua no km 2 da Estrada da Fundição. Nomes, descrições e segredos não mudaram. Tudo isso fica em `dados.js` e é fácil de mexer.
- **Prédios fora de escala fora do Centro.** Nas regiões 2 a 4, os prédios aparecem maiores que o real para dar para tocar; a régua, as viagens e a tabela do Condado usam a escala certa.
- **Viagens dependem do relógio do jogo.** Com o relógio parado, ninguém chega. Use "⏩ Avançar o relógio até a última chegada" (bloco Viagens) ou "Chegar agora". Sem relógio definido (hora do computador), a viagem leva o tempo real.
- **Peças antigas.** Quem estava no mapa antes desta versão fica na região 1 (Centro) com a posição antiga; peças que estavam na Fundição, na Colina ou no Vale precisam ser recolocadas ("Levar para…" ou "Investigadores de volta à delegacia"). Marcadores antigos também ficam no Centro.
- **Nomes dos papéis de Candela em português.** Só "Estranho" foi conferido no livro. Face, Músculo, Erudito e Furtivo são tradução provisória (ficam em `dados.js`, fácil de corrigir).
- **Números de regra não conferidos** e deixados editáveis: máximo de pontos por ação (3), de impulsos (9), tamanho da Iluminação (12), efeito do dado dourado (o padrão troca um dado comum; há opção de somar), regra de descida dos dados de contagem, escala da Sangria (0 a 10) e faixas de exposição.
- **Voto secreto.** A tela esconde os votos até o fim, mas as regras deixam quem está logado ler `votos/`. Para sigilo técnico total seria preciso restringir a leitura ao Guardião (o quadro de quem já votou deixaria de aparecer para os jogadores).
- **Depende do aparelho do Guardião aberto:** publicação automática do resultado do laboratório no prazo, gatilhos, rotinas dos NPCs e gravação do replay.
- **Atestados do Arquivo do Condado:** os nomes das vítimas não existem na campanha; estão sob tarja como "(preencher)". Preencha antes de revelar.
- **Rotinas dos NPCs** nas sementes são sugestões de horário (desligadas); ajuste à sua mesa.
- **Histórico do Git.** O site antigo tinha a senha "corvo" e o resultado do DNA no código. Mesmo substituído, isso continua no histórico do repositório.
