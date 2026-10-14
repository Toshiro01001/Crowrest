/* =========================================================
   dados.js · tudo o que é PÚBLICO do Crowsrest
   Cidade (ruas, bairros, lotes, plantas internas), documentos do caso
   e os catálogos de Candela Obscura.
   NADA de segredo do culto aqui: este arquivo fica no GitHub.
   Os segredos ficam no servidor (aba Segredos do Mestre) e chegam aos
   jogadores só quando o Mestre libera.
   ========================================================= */

/* ---------- A CIDADE ----------
   Unidade do mapa: 1 = 25 metros. A cidade inteira cabe em 64 x 64 (1,6 km).
   Norte para cima. */
const CIDADE = {
  nome: 'Crowsrest',
  estado: 'West Virginia',
  fundada: 1723,
  lado: 64,
  metros: 25,
  rio: { nome: 'Rio Mill', largura: 3.2, pts: [[-2, 46], [12, 45], [22, 47], [34, 48], [46, 51], [58, 52], [66, 53]] },
  ruas: [
    { id: 'hollow', nome: 'Rodovia Hollow Mill', classe: 'rodovia', largura: 2.4, pts: [[-2, 14], [14, 17], [24, 20], [44, 20], [56, 22], [66, 24]] },
    { id: 'principal', nome: 'Rua Principal (Main St.)', classe: 'av', largura: 1.8, pts: [[24, 1], [24, 46]] },
    { id: 'vale', nome: 'Estrada do Vale', classe: 'rodovia', largura: 2.2, pts: [[24, 46], [25, 56], [28, 66]] },
    { id: 'cinder', nome: 'Avenida Cinder', classe: 'av', largura: 1.8, pts: [[40, 1], [40, 50]] },
    { id: 'kettle', nome: 'Rua Kettle', classe: 'rua', largura: 1.3, pts: [[12, 8], [54, 8]] },
    { id: 'elm', nome: 'Rua Elm', classe: 'rua', largura: 1.3, pts: [[4, 29], [40, 29]] },
    { id: 'harrow', nome: 'Rua Harrow', classe: 'rua', largura: 1.3, pts: [[24, 36], [58, 36]] },
    { id: 'pulp', nome: 'Rua Pulp', classe: 'rua', largura: 1.3, pts: [[0, 38], [24, 38]] },
    { id: 'beco', nome: 'Beco do Necrotério', classe: 'beco', largura: 0.9, pts: [[32, 29], [32, 36]] },
    { id: 'fundicao', nome: 'Estrada da Fundição', classe: 'rua', largura: 1.4, pts: [[44, 20], [48, 14], [52, 8], [56, -2]] },
    { id: 'cais', nome: 'Rua do Cais', classe: 'rua', largura: 1.1, pts: [[40, 47], [47, 48.6]] },
    { id: 'mina', nome: 'Trilha da Mina Velha', classe: 'trilha', largura: 0.8, pts: [[25, 56], [12, 57], [6, 60]] },
  ],
  // as quatro saídas da cidade (podem virar bloqueio policial)
  saidas: [
    { id: 'oeste', nome: 'Saída Oeste (Hollow Mill)', x: 0.5, y: 14.5 },
    { id: 'leste', nome: 'Saída Leste (Hollow Mill)', x: 63.5, y: 23.8 },
    { id: 'norte', nome: 'Saída Norte (Estrada da Fundição)', x: 55.6, y: 0.6 },
    { id: 'sul', nome: 'Saída Sul (Estrada do Vale)', x: 27.6, y: 63.4 },
  ],
  pontes: [
    { nome: 'Ponte da Rua Principal', x: 24, y: 46.6, ang: 90 },
    { nome: 'Ponte da Avenida Cinder', x: 40, y: 48.6, ang: 90 },
  ],
  // bairros: rótulo, área (para o som ambiente) e o som de cada um
  bairros: [
    { id: 'centro', nome: 'Centro Histórico', x: 18, y: 9, w: 22, h: 27, som: 'centro' },
    { id: 'kettle', nome: 'Colina de Kettle', x: 0, y: 0, w: 40, h: 8, som: 'vento' },
    { id: 'fundicao', nome: 'Distrito da Fundição', x: 41, y: 0, w: 23, h: 21, som: 'fabrica' },
    { id: 'pulptown', nome: 'Pulptown', x: 0, y: 17, w: 23, h: 28, som: 'pulptown' },
    { id: 'margem', nome: 'Margem do Mill', x: 25, y: 36, w: 39, h: 14, som: 'rio' },
    { id: 'vale', nome: 'Vale Sul', x: 0, y: 48, w: 64, h: 16, som: 'mata' },
  ],
};

/* Categorias dos locais (cor do prédio e ícone) */
const CATEGORIAS = {
  civico:      { nome: 'Cívico', cor: '#3f6fb5', ico: '▣' },
  saude:       { nome: 'Saúde', cor: '#3f9a6a', ico: '✚' },
  industrial:  { nome: 'Industrial', cor: '#8c6d2f', ico: '⚙' },
  comercio:    { nome: 'Comércio', cor: '#b5813a', ico: '$' },
  residencial: { nome: 'Residencial', cor: '#7d6aa8', ico: '⌂' },
  religioso:   { nome: 'Religioso', cor: '#9a8f78', ico: '✝' },
  social:      { nome: 'Social', cor: '#8a3b6a', ico: '◉' },
  cena:        { nome: 'Cena de crime', cor: '#b33a3a', ico: '!' },
  natureza:    { nome: 'Natureza', cor: '#4d6b44', ico: '♣' },
};

/* Lotes: x, y, w (largura), h (profundidade) em unidades de 25 m; alt = altura do prédio.
   conhecido: false = começa coberto pela névoa (o Mestre revela).
   interior: id da planta interna (tocar no prédio abre os andares).
   horario: [abre, fecha] em horas (24 = vira a noite aberto). */
const LOTES = [
  // ----- Centro Histórico -----
  { id: 'delegacia', nome: 'Departamento do Xerife (CCSO)', cat: 'civico', x: 25.5, y: 9.5, w: 7, h: 5.5, alt: 2.4, end: 'Rua Principal, 100', interior: 'delegacia', horario: [0, 24],
    pub: 'Sede do Departamento do Xerife do Condado. Prédio de tijolo dos anos 30, bandeira estadual na fachada. Onde o caso 24-1187 foi aberto.' },
  { id: 'biblioteca', nome: 'Biblioteca e Arquivo Histórico', cat: 'civico', x: 33.5, y: 9.5, w: 5.3, h: 4, alt: 1.8, end: 'Rua Kettle, 12', interior: 'biblioteca', horario: [9, 18],
    pub: 'Biblioteca pública com o arquivo histórico da cidade: jornais antigos, registros de fundação, mapas e a máquina de microfilme.' },
  { id: 'sentinel', nome: 'Redação do Crowsrest Sentinel', cat: 'civico', x: 33.5, y: 14.2, w: 5.3, h: 4, alt: 1.6, end: 'Rua Principal, 140', interior: 'sentinel', horario: [7, 22],
    pub: 'Jornal local, "servindo Crowsrest desde 1811". Redação pequena, tipografia nos fundos.' },
  { id: 'prefeitura', nome: 'Prefeitura e Cartório', cat: 'civico', x: 25.5, y: 15.6, w: 7, h: 3, alt: 1.9, end: 'Rua Principal, 120', horario: [8, 17],
    pub: 'Paço municipal com o cartório de registro civil: certidões de nascimento, casamento e óbito do condado.' },
  { id: 'igreja', nome: 'Igreja de Santo Aníbal', cat: 'religioso', x: 26, y: 21.8, w: 5, h: 5.6, alt: 3.2, torre: true, end: 'Rua Elm, 2', interior: 'igreja', horario: [6, 20],
    pub: 'Paróquia principal da cidade, estilo gótico modesto. Missa campal anual na praça da fundição.' },
  { id: 'clube', nome: 'Clube dos Veteranos do Vale', cat: 'social', x: 33, y: 21.8, w: 5.8, h: 5.6, alt: 2.1, end: 'Rua Elm, 30', interior: 'clube', horario: [17, 24],
    pub: 'Sociedade beneficente e recreativa da elite local. Sede em casarão de pedra no centro. Eventos de caridade e jantares fechados.' },
  { id: 'necroterio', nome: 'Necrotério Municipal', cat: 'saude', x: 25.5, y: 30.3, w: 5.8, h: 4.8, alt: 1.4, end: 'Beco do Necrotério, 1', interior: 'necroterio', horario: [0, 24],
    pub: 'Necrotério e serviço de verificação de óbitos da comarca. Anexo ao hospital. Prédio baixo, janelas foscas, sempre frio.' },
  { id: 'hospital', nome: 'Hospital St. Brigid', cat: 'saude', x: 33, y: 30.3, w: 5.8, h: 4.8, alt: 3, end: 'Rua Elm, 41', interior: 'hospital', horario: [0, 24],
    pub: 'Único hospital de Crowsrest. Fundado pela diocese, hoje municipal. Ala antiga desativada no subsolo.' },
  { id: 'farmacia', nome: 'Farmácia Hollow', cat: 'comercio', x: 16.2, y: 21.6, w: 6, h: 3, alt: 1.1, end: 'Rodovia Hollow Mill, 210', horario: [8, 21],
    pub: 'Farmácia com balcão de refrigerantes. O farmacêutico conhece a receita de metade da cidade.' },
  { id: 'diner', nome: "Rosie's Diner", cat: 'comercio', x: 16.2, y: 25, w: 6, h: 3, alt: 1.1, end: 'Rua Elm, 18', horario: [6, 23],
    pub: 'Lanchonete de balcão cromado e jukebox. Café ruim, torta boa, fofoca de graça.' },
  // ----- Colina de Kettle -----
  { id: 'mansao', nome: 'Mansão Wayne', cat: 'residencial', x: 14, y: 1, w: 7, h: 5, alt: 2.3, end: 'Alameda da Colina, 1', horario: null,
    pub: 'Residência do Xerife John Wayne e da família, no alto da Colina de Kettle. Muro de pedra e portão de ferro.' },
  { id: 'torre', nome: "Torre d'Água", cat: 'civico', x: 9.5, y: 9.2, w: 3, h: 3, alt: 4.5, end: 'Rua Kettle, alto', horario: null,
    pub: 'A torre d\'água da cidade, com o nome CROWSREST pintado em letras desbotadas. Dá para ver o vale inteiro lá de cima.' },
  { id: 'escola', nome: 'Crowsrest High School', cat: 'civico', x: 27.5, y: 1, w: 8, h: 5.5, alt: 1.8, end: 'Rua Kettle, 40', horario: [7, 17],
    pub: 'Escola de ensino médio do condado. Time de futebol americano "Os Corvos".' },
  { id: 'correios', nome: 'Agência dos Correios', cat: 'civico', x: 35.8, y: 1, w: 3, h: 4.5, alt: 1.3, end: 'Rua Kettle, 60', horario: [9, 17],
    pub: 'Agência dos correios. Caixas postais alugadas no saguão.' },
  { id: 'radio', nome: 'Rádio WCRS 1420 AM', cat: 'comercio', x: 41.2, y: 1, w: 4, h: 4.6, alt: 1.4, antena: true, end: 'Avenida Cinder, 5', horario: [5, 24],
    pub: 'A rádio da cidade: música country de dia, programa de pedidos de madrugada e os avisos do condado.' },
  { id: 'mirante', nome: 'Mirante do Corvo', cat: 'natureza', x: 1.5, y: 1, w: 5, h: 4, alt: 0.3, end: 'Estrada da Colina', horario: null, conhecido: false,
    pub: 'Um ressalto de pedra acima da cidade, onde os namorados estacionam. Corvos pousam nos fios o ano inteiro.' },
  // ----- Distrito da Fundição -----
  { id: 'fundicao', nome: 'Antiga Fundição Crowsrest Iron', cat: 'industrial', x: 57, y: 2.5, w: 6.5, h: 7, alt: 3.6, chamine: true, end: 'Estrada da Fundição, km 2', interior: 'fundicao', horario: null,
    pub: 'Fundição de ferro desativada, antiga espinha dorsal da economia da cidade. Fumaça ainda sai do subsolo por combustão interna. Área interditada.' },
  { id: 'praca', nome: 'Praça da Fundição', cat: 'natureza', x: 57.5, y: 11, w: 6, h: 4, alt: 0.1, end: 'Estrada da Fundição', horario: null,
    pub: 'Praça de terra batida diante da fundição, onde acontecem a missa campal e o desfile cívico anuais.' },
  { id: 'depositos', nome: 'Depósitos da Saída Norte', cat: 'industrial', x: 51.5, y: 12, w: 4.6, h: 4, alt: 1.6, end: 'Estrada da Fundição, km 1', interior: 'depositos', horario: null,
    pub: 'Galpões de estocagem perto da saída norte. Vários sem placa ou numeração.' },
  { id: 'galpoes', nome: 'Galpões sem placa', cat: 'industrial', x: 51.5, y: 16.4, w: 8, h: 3.2, alt: 1.5, end: 'Estrada da Fundição, km 1', horario: null, conhecido: false,
    pub: 'Fileira de galpões de chapa enferrujada, sem número nem dono aparente.' },
  { id: 'banco', nome: 'Banco do Vale', cat: 'comercio', x: 41.3, y: 10, w: 3.6, h: 3.6, alt: 1.9, end: 'Avenida Cinder, 40', horario: [9, 16],
    pub: 'O banco da cidade, com relógio na fachada e cofre do tempo da fundição.' },
  { id: 'chevette', nome: 'Cena do Chevette (Hollow Mill, km 4)', cat: 'cena', x: 47, y: 22.8, w: 3, h: 1.6, alt: 0.15, end: 'Rodovia Hollow Mill, km 4', horario: null,
    pub: 'Acostamento da Rodovia Hollow Mill, sentido saída norte. Local onde o veículo com as malas foi encontrado na manhã de 21/05/1997.' },
  { id: 'bombeiros', nome: 'Corpo de Bombeiros Voluntários', cat: 'civico', x: 41.2, y: 22.8, w: 4.5, h: 4, alt: 1.6, end: 'Avenida Cinder, 88', horario: [0, 24],
    pub: 'Quartel dos bombeiros voluntários. A sirene no telhado toca ao meio-dia, todo dia.' },
  // ----- Pulptown -----
  { id: 'trailers', nome: 'Parque de Trailers da Rua Pulp', cat: 'residencial', x: 2, y: 30.5, w: 9, h: 6, alt: 0.8, end: 'Rua Pulp, 300', horario: null,
    pub: 'Conjunto de trailers no bairro operário de Pulptown. Metade desocupado desde o fechamento da fundição.' },
  { id: 'mercearia', nome: 'Mercearia Kowalski', cat: 'comercio', x: 12, y: 31, w: 6, h: 4, alt: 1, end: 'Rua Pulp, 210', horario: [7, 21],
    pub: 'Mercearia de bairro com fiado no caderno. Vende de tudo um pouco, inclusive iscas e munição de caça.' },
  { id: 'penhores', nome: 'Penhores Pulptown', cat: 'comercio', x: 19, y: 31, w: 3.8, h: 4, alt: 1.2, end: 'Rua Pulp, 180', horario: [10, 19],
    pub: 'Casa de penhores atulhada: rádios, ferramentas, armas de caça, alianças. Ninguém pergunta de onde veio.' },
  { id: 'motel', nome: 'Motel Hollow Rest', cat: 'comercio', x: 2, y: 8.5, w: 6, h: 4.5, alt: 1.1, end: 'Rodovia Hollow Mill, km 1', horario: [0, 24],
    pub: 'Motel de beira de estrada na entrada oeste. Placa de neon com metade das letras apagadas.' },
  { id: 'cemiterio', nome: 'Cemitério de Crowsrest', cat: 'religioso', x: 6, y: 39.5, w: 12, h: 4, alt: 0.1, cruzes: true, end: 'Rua Pulp, fim', horario: [7, 18],
    pub: 'Cemitério municipal na beira do Rio Mill, com a parte antiga tomada pelo mato. Portões de ferro e capela mortuária.' },
  // ----- Margem do Mill -----
  { id: 'funeraria', nome: 'Funerária Vossler & Filhos', cat: 'comercio', x: 25.5, y: 37.5, w: 6, h: 4, alt: 1.6, end: 'Rua Harrow, 10', interior: 'funeraria', horario: [8, 20],
    pub: 'Casa funerária tradicional, atende a cidade há quatro gerações. Capela própria e frota de carros fúnebres.' },
  { id: 'taverna', nome: 'Taverna do Rio', cat: 'comercio', x: 33.5, y: 37.5, w: 5.3, h: 3.6, alt: 1.2, end: 'Rua Harrow, 34', horario: [16, 26],
    pub: 'Bar de madeira escura onde os operários da fundição bebiam. Hoje bebem os que sobraram.' },
  { id: 'posto', nome: 'Posto e Lanchonete Mill Stop', cat: 'comercio', x: 42, y: 37.5, w: 5, h: 3.6, alt: 1, end: 'Avenida Cinder, 300', horario: [0, 24],
    pub: 'Posto de gasolina 24h com lanchonete. Ponto de parada de caminhoneiros e o café que fica aberto a noite toda.' },
  { id: 'patio', nome: 'Pátio Municipal de Veículos', cat: 'civico', x: 42.5, y: 42.5, w: 5.4, h: 3.6, alt: 0.5, end: 'Avenida Cinder, 340', horario: [8, 17], conhecido: false,
    pub: 'Pátio cercado onde ficam os carros apreendidos e abandonados do condado.' },
  { id: 'ferrovelho', nome: 'Ferro-Velho Dutch', cat: 'industrial', x: 50, y: 38, w: 8, h: 5, alt: 0.8, end: 'Rua Harrow, 90', horario: [8, 18], conhecido: false,
    pub: 'Montanhas de sucata, carcaças de carro e um cachorro que não late. O dono compra qualquer coisa de metal.' },
  { id: 'cais', nome: 'Antigo Cais do Mill', cat: 'industrial', x: 47.5, y: 47.2, w: 7, h: 2.3, alt: 0.4, end: 'Rua do Cais', horario: null,
    pub: 'Cais de carga desativado na margem do Rio Mill, usado no auge da madeira e do minério. Estrutura de madeira apodrecida.' },
  // ----- Vale Sul (outra margem) -----
  { id: 'estacao', nome: 'Estação Ferroviária (desativada)', cat: 'civico', x: 6, y: 49.5, w: 8, h: 3, alt: 1.3, end: 'Estrada do Vale, desvio', horario: null, conhecido: false,
    pub: 'Estação de trem fechada desde 1971. Os trilhos somem no mato em direção às minas.' },
  { id: 'serraria', nome: 'Serraria Mill Lumber', cat: 'industrial', x: 30, y: 52.5, w: 9, h: 5, alt: 1.9, end: 'Estrada do Vale, km 1', horario: [6, 16],
    pub: 'A última serraria que ainda funciona. Cheiro de seiva e o grito da serra ouvido de longe.' },
  { id: 'mina', nome: 'Boca da Mina Velha', cat: 'natureza', x: 2, y: 57.5, w: 6, h: 5, alt: 0.6, end: 'Trilha da Mina Velha', horario: null, conhecido: false,
    pub: 'Entrada de uma mina de carvão abandonada, tapada com tábuas pregadas e placas de PERIGO.' },
  { id: 'fazenda', nome: 'Fazenda Harlan', cat: 'residencial', x: 55, y: 56, w: 7, h: 6, alt: 1.2, end: 'Estrada do Vale, km 3', horario: null, conhecido: false,
    pub: 'Fazenda de gado leiteiro do outro lado do rio, cercada de pasto e nevoeiro.' },
];

/* Residências sem nome: o site gera as casinhas nos bairros (endereço automático).
   Cada zona é um retângulo onde cabem casas de w x h com espaçamento. */
const ZONAS_RESIDENCIAIS = [
  { bairro: 'kettle', x: 0.5, y: 13.6, w: 8, h: 3.8, casa: [2.3, 1.8], rua: 'Rua Kettle' },
  { bairro: 'kettle', x: 44.6, y: 1, w: 8.5, h: 5.5, casa: [2.6, 2.2], rua: 'Alameda da Colina' },
  { bairro: 'kettle', x: 21.8, y: 1, w: 1, h: 1, casa: [2, 2], rua: 'Alameda da Colina' },
  { bairro: 'pulptown', x: 1.5, y: 20, w: 12.5, h: 7.4, casa: [2.6, 2.2], rua: 'Rua Elm' },
  { bairro: 'pulptown', x: 12, y: 35.6, w: 10.6, h: 1.6, casa: [2.4, 1.5], rua: 'Rua Pulp' },
  { bairro: 'margem', x: 44.5, y: 25.5, w: 13, h: 9.6, casa: [2.6, 2.2], rua: 'Rua Harrow' },
  { bairro: 'margem', x: 49, y: 30, w: 1, h: 1, casa: [2, 2], rua: 'Rua Harrow' },
  { bairro: 'vale', x: 40, y: 55, w: 12, h: 6, casa: [2.6, 2.2], rua: 'Estrada do Vale' },
];

/* Plantas internas: andares com salas numa grade de 12 x 10 (unidade = 2 m).
   trancado: o andar pede senha (o Mestre define a senha na aba Segredos).
   Os nomes das salas são públicos e neutros; o que existe nelas fica com o Mestre. */
const INTERIORES = {
  delegacia: { nome: 'Departamento do Xerife', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'recepcao', nome: 'Recepção e Plantão', x: 0, y: 6, w: 4, h: 4 },
      { id: 'delegados', nome: 'Sala dos Delegados', x: 4, y: 5, w: 5, h: 5 },
      { id: 'gabinete', nome: 'Gabinete do Xerife', x: 9, y: 6, w: 3, h: 4 },
      { id: 'celas', nome: 'Celas', x: 0, y: 0, w: 4, h: 4 },
      { id: 'provas', nome: 'Sala de Provas', x: 4, y: 0, w: 4, h: 3 },
      { id: 'almox', nome: 'Almoxarifado', x: 8, y: 0, w: 4, h: 3 },
      { id: 'radio', nome: 'Sala de Rádio', x: 9, y: 3, w: 3, h: 3 },
    ] },
    { id: 's', nome: 'Subsolo', salas: [
      { id: 'arquivo', nome: 'Arquivo Morto', x: 0, y: 0, w: 6, h: 5 },
      { id: 'garagem', nome: 'Garagem das Viaturas', x: 6, y: 0, w: 6, h: 6 },
      { id: 'caldeira', nome: 'Caldeira', x: 0, y: 5, w: 3, h: 5 },
      { id: 'lacrada', nome: 'Porta Lacrada', x: 3, y: 6, w: 4, h: 4 },
    ] },
  ] },
  necroterio: { nome: 'Necrotério Municipal', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'recepcao', nome: 'Recepção', x: 0, y: 6, w: 4, h: 4 },
      { id: 'autopsia', nome: 'Sala de Autópsia', x: 4, y: 3, w: 5, h: 5 },
      { id: 'camara', nome: 'Câmara Fria', x: 9, y: 0, w: 3, h: 6 },
      { id: 'legista', nome: 'Escritório do Legista', x: 0, y: 0, w: 4, h: 4 },
      { id: 'doca', nome: 'Doca de Carga', x: 9, y: 6, w: 3, h: 4 },
    ] },
  ] },
  hospital: { nome: 'Hospital St. Brigid', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'emergencia', nome: 'Emergência', x: 0, y: 5, w: 5, h: 5 },
      { id: 'recepcao', nome: 'Recepção', x: 5, y: 7, w: 4, h: 3 },
      { id: 'enfermaria', nome: 'Enfermaria', x: 0, y: 0, w: 6, h: 5 },
      { id: 'adm', nome: 'Administração e Óbitos', x: 6, y: 0, w: 6, h: 4 },
      { id: 'farmacia', nome: 'Farmácia Interna', x: 9, y: 5, w: 3, h: 5 },
    ] },
    { id: 's', nome: 'Subsolo (Ala Antiga)', salas: [
      { id: 'ala', nome: 'Ala Antiga Desativada', x: 0, y: 0, w: 7, h: 6 },
      { id: 'caldeiras', nome: 'Caldeiras', x: 7, y: 0, w: 5, h: 4 },
      { id: 'servico', nome: 'Corredor de Serviço', x: 0, y: 6, w: 12, h: 2 },
      { id: 'incinerador', nome: 'Incinerador', x: 7, y: 8, w: 5, h: 2 },
    ] },
  ] },
  funeraria: { nome: 'Funerária Vossler & Filhos', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'capela', nome: 'Capela', x: 0, y: 4, w: 6, h: 6 },
      { id: 'escritorio', nome: 'Escritório', x: 6, y: 7, w: 3, h: 3 },
      { id: 'preparo', nome: 'Sala de Preparação', x: 6, y: 2, w: 6, h: 5 },
      { id: 'garagem', nome: 'Garagem dos Carros Fúnebres', x: 0, y: 0, w: 6, h: 4 },
      { id: 'estoque', nome: 'Estoque de Caixões', x: 9, y: 7, w: 3, h: 3 },
    ] },
  ] },
  fundicao: { nome: 'Antiga Fundição Crowsrest Iron', andares: [
    { id: 't', nome: 'Pátio', salas: [
      { id: 'patio', nome: 'Pátio de Carga', x: 0, y: 5, w: 6, h: 5 },
      { id: 'forno', nome: 'Alto-Forno', x: 6, y: 0, w: 6, h: 6 },
      { id: 'moldagem', nome: 'Galpão de Moldagem', x: 0, y: 0, w: 6, h: 5 },
      { id: 'escritorio', nome: 'Escritório do Capataz', x: 6, y: 6, w: 3, h: 4 },
      { id: 'escada', nome: 'Escada de Serviço', x: 9, y: 7, w: 3, h: 3 },
    ] },
    { id: 's1', nome: 'Subsolo 1', trancado: true, salas: [
      { id: 'galerias', nome: 'Galerias', x: 0, y: 0, w: 12, h: 4 },
      { id: 'carvao', nome: 'Túnel do Carvão', x: 0, y: 4, w: 5, h: 6 },
      { id: 'deposito', nome: 'Depósito Escuro', x: 5, y: 4, w: 7, h: 6 },
    ] },
    { id: 's2', nome: 'Subsolo 2', trancado: true, salas: [
      { id: 'camara', nome: 'Câmara', x: 2, y: 1, w: 8, h: 8 },
      { id: 'antecamara', nome: 'Antecâmara', x: 0, y: 4, w: 2, h: 3 },
    ] },
  ] },
  clube: { nome: 'Clube dos Veteranos do Vale', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'salao', nome: 'Salão Nobre', x: 0, y: 3, w: 7, h: 7 },
      { id: 'bar', nome: 'Bar', x: 7, y: 6, w: 5, h: 4 },
      { id: 'biblioteca', nome: 'Biblioteca do Clube', x: 7, y: 0, w: 5, h: 6 },
      { id: 'escritorio', nome: 'Escritório da Diretoria', x: 0, y: 0, w: 7, h: 3 },
    ] },
    { id: 'p', nome: 'Porão', trancado: true, salas: [
      { id: 'adega', nome: 'Adega', x: 0, y: 0, w: 5, h: 10 },
      { id: 'fechada', nome: 'Sala Fechada', x: 5, y: 2, w: 7, h: 6 },
    ] },
  ] },
  biblioteca: { nome: 'Biblioteca e Arquivo Histórico', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'leitura', nome: 'Salão de Leitura', x: 0, y: 4, w: 7, h: 6 },
      { id: 'acervo', nome: 'Acervo', x: 0, y: 0, w: 7, h: 4 },
      { id: 'historico', nome: 'Arquivo Histórico', x: 7, y: 0, w: 5, h: 5 },
      { id: 'microfilme', nome: 'Sala do Microfilme', x: 7, y: 5, w: 5, h: 5 },
    ] },
  ] },
  depositos: { nome: 'Depósitos da Saída Norte', andares: [
    { id: 't', nome: 'Galpões', salas: [
      { id: 'g1', nome: 'Galpão 1', x: 0, y: 0, w: 4, h: 5 },
      { id: 'g2', nome: 'Galpão 2', x: 4, y: 0, w: 4, h: 5 },
      { id: 'g3', nome: 'Galpão 3', x: 8, y: 0, w: 4, h: 5 },
      { id: 'g4', nome: 'Galpão 4', x: 0, y: 5, w: 4, h: 5 },
      { id: 'g5', nome: 'Galpão 5', x: 4, y: 5, w: 4, h: 5 },
      { id: 'g6', nome: 'Galpão sem número', x: 8, y: 5, w: 4, h: 5 },
    ] },
  ] },
  igreja: { nome: 'Igreja de Santo Aníbal', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'nave', nome: 'Nave', x: 0, y: 0, w: 8, h: 10 },
      { id: 'sacristia', nome: 'Sacristia', x: 8, y: 0, w: 4, h: 4 },
      { id: 'casa', nome: 'Casa Paroquial', x: 8, y: 4, w: 4, h: 6 },
    ] },
  ] },
  sentinel: { nome: 'Redação do Crowsrest Sentinel', andares: [
    { id: 't', nome: 'Térreo', salas: [
      { id: 'redacao', nome: 'Redação', x: 0, y: 4, w: 8, h: 6 },
      { id: 'tipografia', nome: 'Tipografia', x: 0, y: 0, w: 8, h: 4 },
      { id: 'arquivo', nome: 'Arquivo do Jornal', x: 8, y: 0, w: 4, h: 10 },
    ] },
  ] },
};

/* ---------- PESSOAS ----------
   NPCs conhecidos publicamente (o que a cidade sabe deles).
   Os personagens dos jogadores são cadastrados pelo Mestre no painel. */
const NPCS = [
  { id: 'xerife', nome: 'Xerife John Wayne', curto: 'Xerife', tipo: 'npc', cor: '#c9a227', pub: 'Xerife do condado. Patriarca de uma linhagem de xerifes. Dono do Chevette.' },
  { id: 'wray', nome: 'Dep. Hollis Wray (114)', curto: 'Wray', tipo: 'npc', cor: '#4f7fbf', pub: 'Policial da Patrulha Rural 3. Abriu a ocorrência do caso 24-1187.' },
  { id: 'crane', nome: 'Dr. Edmund Crane', curto: 'Crane', tipo: 'npc', cor: '#7a8a96', pub: 'Legista-chefe da comarca.' },
  { id: 'brandt', nome: 'Nadia Brandt', curto: 'Brandt', tipo: 'npc', cor: '#5aa36f', pub: 'Assistente de perícia. Assinou o laudo preliminar.' },
  { id: 'furao', nome: 'Dale Renner, "o Furão"', curto: 'Furão', tipo: 'npc', cor: '#b5813a', pub: 'Ladrão de pequenos furtos, especialista em fechaduras. Pessoa de interesse no caso.' },
  { id: 'vossler', nome: 'Sr. Vossler', curto: 'Vossler', tipo: 'npc', cor: '#6f5a8a', pub: 'Dono da Funerária Vossler & Filhos.' },
  { id: 'parroco', nome: 'O Pároco de Santo Aníbal', curto: 'Pároco', tipo: 'npc', cor: '#9a8f78', pub: 'Padre da paróquia principal da cidade.' },
  { id: 'garconete', nome: 'Garçonete do Mill Stop', curto: 'Garçonete', tipo: 'npc', cor: '#c46b8a', pub: 'Trabalha no turno da noite do posto Mill Stop.' },
  { id: 'viatura01', nome: 'Viatura 01 · Gabinete do Xerife', curto: 'V-01', tipo: 'viatura', cor: '#1f2f4a', pub: 'Viatura do gabinete do xerife.' },
  { id: 'viatura03', nome: 'Viatura 03 · Patrulha Rural 3', curto: 'V-03', tipo: 'viatura', cor: '#2b4a6f', pub: 'Viatura da Patrulha Rural 3.' },
];

/* ---------- CANDELA OBSCURA ----------
   Termos conferidos no livro da Jambô: as três motivações e as nove ações,
   as marcas de Corpo, Mente e Sangria, cicatrizes, dado dourado, Iluminação,
   Guardião da Luz, Círculo, tarefas, Sangria e Clarão.
   Os nomes dos cinco papéis em português (exceto Estranho) não foram conferidos
   no livro: confira e corrija aqui se a tradução da Jambô for outra. */
const CANDELA = {
  motivacoes: [
    { id: 'vigor', nome: 'Vigor', acoes: ['Mover', 'Atacar', 'Controlar'] },
    { id: 'astucia', nome: 'Astúcia', acoes: ['Influenciar', 'Ler', 'Esconder'] },
    { id: 'intuicao', nome: 'Intuição', acoes: ['Avaliar', 'Focar', 'Sentir'] },
  ],
  marcas: [
    { id: 'corpo', nome: 'Corpo' },
    { id: 'mente', nome: 'Mente' },
    { id: 'sangria', nome: 'Sangria' },
  ],
  papeis: [
    { id: 'face', nome: 'Face', esp: ['Jornalista', 'Mágico'] },
    { id: 'musculo', nome: 'Músculo', esp: ['Explorador', 'Soldado'] },
    { id: 'erudito', nome: 'Erudito', esp: ['Doutor', 'Professor'] },
    { id: 'furtivo', nome: 'Furtivo', esp: ['Criminoso', 'Detetive'] },
    { id: 'estranho', nome: 'Estranho', esp: ['Médium', 'Ocultista'] },
  ],
};

/* ---------- O CASO 24-1187 (documentos oficiais já em posse do grupo) ---------- */
const CASO = {
  numero: '24-1187',
  classificacao: 'Homicídio (presumido) · vínculo múltiplo',
  situacao: 'Em investigação',
  aberto: '21/05/1997 · 06:12',
  responsavel: 'Dep. H. Wray (114)',
  unidade: 'Patrulha Rural 3',
  dataInicial: '21/05/1997',
  resumo: {
    lead: 'Veículo abandonado no acostamento da Rodovia Hollow Mill contendo restos humanos de <b>múltiplos indivíduos</b>. Indícios apontam descarte sistemático ao longo do tempo, e não um evento isolado. O veículo <b>não consta em nenhum registro oficial</b>.',
    stats: [['≥6', 'Indivíduos distintos (preliminar)', ''], ['07', 'Itens de evidência', ''], ['04', 'Anexos fotográficos ausentes', 'red'], ['01', 'Pessoa de interesse', '']],
    alerta: 'O sistema detectou itens retidos, registros selados e acesso anterior não justificado vinculados a este caso. Verifique o registro de atividade abaixo.',
    log: [
      ['06:12', 'Abertura da ocorrência · <b>Dep. H. Wray (114)</b>', ''],
      ['06:18', 'Comparecimento não solicitado · <b>viatura do Gabinete</b> antes da perícia', 'irregular'],
      ['06:31', 'Coleta de evidências · <b>Eq. Perícia 2</b>', ''],
      ['11:00', 'Laudo preliminar entregue · <b>N. Brandt</b>', ''],
      ['11:42', 'Laudo retido para revisão · <b>Dr. E. Crane</b>', 'alterado'],
      ['--:--', 'Consulta anterior ao chassi · operador <b>selado</b>', 'selado'],
      ['--:--', 'Fotografias 06 a 09 removidas do anexo · sem protocolo', 'sem registro'],
    ],
  },
  ocorrencia: {
    ref: 'BO 24-1187-A', meta: 'Agente H. Wray (114) · 06:12',
    relato: 'Atendi chamado de veículo abandonado na Rodovia Hollow Mill ao amanhecer. A neblina estava tão fechada que só achei o carro porque <b>o cheiro chegou antes</b>. Chevette castanho parado no acostamento, motor frio há horas, <b>sem placas dianteira ou traseira</b>. Sem ninguém por perto. Sem pegadas claras no orvalho, a não ser uma trilha que sai do carro e se perde no matagal em direção aos antigos depósitos.',
    texto: 'O porta-malas estava <b>destrancado e entreaberto</b>. Dentro, duas malas de viagem e um enxame de moscas que não devia existir numa manhã tão fria. Isolei a área e acionei a perícia e o legista. <b>Não localizei nenhum registro de apreensão nem de propriedade para este veículo.</b> Nem placa, nem ficha de pátio, nem boletim de furto. É como se o carro não existisse no sistema.',
    obs: 'Densidade de varejeiras (família Calliphoridae) incompatível com a temperatura da manhã. Sugere material em decomposição há vários dias, possivelmente transportado de ambiente mais quente. Encaminhado à perícia.',
    manuscrito: { texto: 'A central não tem registro da ligação que me mandou pra cá. Fui o primeiro a chegar. O segundo carro a chegar foi o do gabinete do xerife, antes da perícia. Não pedi por ele. O sargento mandou eu não anexar as fotos 6 a 9. Anotei aqui porque um dia alguém vai perguntar.', assinatura: 'Dep. Hollis Wray, 114' },
  },
  evidencias: [
    { id: 'E-01', desc: 'Chevrolet Chevette, castanho desbotado, sem placas. Chassi com numeração <b>parcialmente raspada</b>.', status: 'Recuperação pendente' },
    { id: 'E-02', desc: 'Mala rígida bege, 70x45 cm. Conteúdo: restos humanos (ver Laudo).', status: 'Lacrada · Perícia' },
    { id: 'E-03', desc: 'Mala de lona marrom. Conteúdo: restos humanos (ver Laudo).', status: 'Lacrada · Perícia' },
    { id: 'E-04', desc: 'Fios de cabelo do forro do porta-malas, de <b>cores e comprimentos diversos, origens múltiplas</b>.', status: 'Enviado p/ DNA' },
    { id: 'E-05', desc: 'Resíduo nos sulcos dos pneus: serragem fina e <b>limalha de ferro/escória</b>.', status: 'Origem industrial?' },
    { id: 'E-06', desc: '<b>Ausência total de crânios</b> ou segmentos cranianos em ambas as malas. Registrado por relevância.', status: 'Confirmar c/ legista', flag: true },
    { id: 'E-07', desc: 'Etiqueta de bagagem parcialmente queimada, presa a E-02, texto ilegível.', status: 'Recuperação pendente' },
  ],
  fotos: [
    { id: 'p1', img: 'img/foto01.jpg', titulo: 'FOTO 01 · 06:20', ref: 'ref 9f3a-e21 · veículo', cap: 'FOTO 01 · 06:20 · veículo' },
    { id: 'p2', img: 'img/foto02.jpg', titulo: 'FOTO 02 · 06:24', ref: 'ref 4c11-7be · porta-malas', cap: 'FOTO 02 · 06:24 · porta-malas' },
    { id: 'p3', img: 'img/foto03.jpg', titulo: 'FOTO 03 · 06:31', ref: 'ref b820-0af · malas', cap: 'FOTO 03 · 06:31 · malas' },
    { id: 'p4', img: 'img/foto04.jpg', titulo: 'FOTO 04 · pneu', ref: 'ref 1d77-c93 · resíduo E-05', cap: 'FOTO 04 · sulco do pneu' },
    { id: 'p5', img: 'img/foto05.jpg', titulo: 'FOTO 05 · etiqueta', ref: 'ref e0a2-55f · item E-07', cap: 'FOTO 05 · etiqueta E-07' },
  ],
  laudo: {
    ref: 'REF 24-1187-L', meta: 'Perita N. Brandt (assist.)',
    lead: 'Exame inicial dos itens E-02 e E-03. As partes recuperadas correspondem a <b>não menos de seis indivíduos distintos</b>, com base em segmentos anatômicos duplicados (múltiplos pares de mãos e pés de tamanhos incompatíveis entre si).',
    achados: [
      ['Achado 1 · cronologia', 'Os graus de decomposição variam <b>amplamente</b> entre as partes: algumas recentes, outras com meses. Incompatível com um evento único. Indica <b>deposição ao longo de período prolongado</b>. Material acumulado e descartado de uma só vez.'],
      ['Achado 2 · desarticulação', 'As marcas de corte nas articulações são <b>limpas, metódicas e repetidas</b>. Não há sinais de fúria ou improviso. Sugere-se mão treinada, com instrumento próprio e prática anterior.'],
      ['Achado 3 · ausência cranial', 'Nenhum crânio, mandíbula ou dentição recuperados. A separação da cabeça parece ter sido <b>a primeira e mais cuidadosa</b> de todas as etapas. As cabeças foram levadas. Finalidade desconhecida.'],
    ],
    texto: 'Painel de DNA solicitado para cotejo com a base de pessoas desaparecidas e <b>com registros de óbito da comarca</b>. Resultado pendente.',
    manuscrito: { texto: 'Entreguei isto ao Dr. Crane às 11h. Ele disse que "revisa antes de oficializar". A cópia que voltou pra mim estava com o Achado 1 cortado. Guardei esta.', assinatura: 'N. Brandt, assistente de perícia' },
  },
  // consulta do terminal (Consulta às Bases): o primeiro registro já carregado
  terminalInicial: [
    { p: 'DMV/CRW > ', t: 'consultar_veiculo --chassi 1G1A[######] --placa NENHUMA' },
    { o: '  buscando registro de propriedade ............' },
    { e: '  >> NENHUM REGISTRO ENCONTRADO (0 resultados)' },
    { o: '' },
    { p: 'DMV/CRW > ', t: 'consultar_veiculo --historico-patio' },
    { e: '  >> SEM FICHA DE PÁTIO / SEM APREENSÃO REGISTRADA' },
    { o: '' },
    { p: 'DMV/CRW > ', t: 'consultar_veiculo --boletim-furto' },
    { e: '  >> NENHUM BOLETIM DE FURTO ASSOCIADO' },
    { o: '' },
    { p: 'DMV/CRW > ', t: 'consultar_veiculo --acessos-anteriores' },
    { o: '  01 acesso anterior a este chassi:' },
    { r: '    data ... @@/@@   terminal ... SO-CRW-01   operador ... @@@@@@@' },
    { r: '    motivo ... @@@@@@@@@@' },
  ],
  sentinel1: {
    data: '21/05/1997', preco: '$0,25',
    manchete: 'Veículo abandonado causa transtorno na Hollow Mill; autoridades pedem calma',
    corpo: [
      'Um carro deixado no acostamento da Rodovia Hollow Mill mobilizou equipes do Departamento do Xerife John Wayne na manhã de ontem, gerando especulação entre moradores que passavam pela via na neblina.',
      'Em nota, um porta-voz do gabinete classificou o conteúdo do veículo como "provável descarte irregular de material de abatedouro" e pediu que a população "não alimente boatos infundados". A via foi reaberta ao tráfego ainda pela manhã.',
      '"Crowsrest é uma cidade segura e tranquila", afirmou a nota. "Não há motivo para alarme."',
    ],
    sub: 'Outra partida sem despedida',
    corpo2: [
      'Na mesma semana, vizinhos da Rua Pulp relataram a saída repentina de um morador antigo do bairro, que teria "deixado a cidade durante a noite" sem avisar parentes. É a <b>terceira</b> partida do tipo registrada neste ano. A família declinou de comentar.',
      'O Sentinel lembra que a missa campal e o desfile cívico anuais acontecem no próximo domingo, na praça da antiga fundição.',
    ],
    rodape: 'Anexo coletado por iniciativa do agente responsável. A propriedade do periódico remonta a um dos nomes mais antigos do vale.',
  },
  pessoaInteresse: {
    id: 'furao', ficha: 'CRW-PI-339', status: 'procurado',
    campos: [['Nome', 'Dale Renner'], ['Vulgo', '"o Furão"'], ['Idade', '36 anos'], ['Periculosidade', 'Baixa'], ['Últ. residência', 'Trailers da Rua Pulp (desocupado)'], ['Especialidade', 'Fechaduras, depósitos']],
    antecedentes: ['Arrombamento de depósito (x3), penas leves', 'Furto qualificado, condicional', 'Receptação, arquivado'],
    ultima: 'Visto pela última vez na madrugada da ocorrência, a pé, nas imediações dos <b>antigos depósitos da saída norte</b>, a mesma direção da trilha que parte da Chevette. Não retornou ao trailer. Acredita-se escondido na cidade, <b>com medo de algo que viu</b>.',
  },
};
