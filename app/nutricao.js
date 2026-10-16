// Cálculo nutricional pela TACO (valores por 100 g) + medidas caseiras cadastradas pela nutricionista.
// Na versão com IA, a IA só identifica alimentos e quantidades; as contas são feitas aqui.

const Nutricao = (() => {
  let taco = null, medidas = null;

  // Escolha padrão quando a pessoa escreve só o nome comum (ids da TACO 4ª ed.)
  const PADRAO = {
    'arroz': 3, 'arroz branco': 3, 'arroz integral': 1,
    'feijao': 561, 'feijao carioca': 561, 'feijao preto': 567,
    'frango': 410, 'peito de frango': 410, 'file de frango': 410, 'frango grelhado': 410,
    'ovo': 488, 'ovo cozido': 488, 'ovo frito': 490,
    'batata': 91, 'batata inglesa': 91, 'batata doce': 88,
    'patinho': 377, 'carne moida': 326,
    'mandioca': 129, 'aipim': 129, 'macaxeira': 129,
    'banana': 182, 'azeite': 260, 'cuscuz': 533, 'aveia': 7, 'iogurte': 448,
    'pao': 53, 'pao frances': 53, 'leite': 458, 'alface': 78, 'tomate': 157,
    // Sem versão pronta na TACO: melhor não calcular do que usar o alimento errado
    'macarrao': null, 'massa': null, 'tilapia': null, 'pao de forma': null
  };
  const PREPARADO = /\b(cozid|grelhad|assad|refogad)/;
  const PROCESSADO = /\b(calda|doce|industrializad|enlatad|frit|instantane|polpa|suco|geleia|sorvete|cristalizad|desidratad)/;
  let temVersaoPronta = new Set();   // nomes principais que têm versão cozida/grelhada (ex.: batata)

  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Palavras da frase que não fazem parte do nome do alimento ("tem dois ovos", "comi uns...")
  const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'no', 'na', 'em',
    'tem', 'tinha', 'teve', 'comi', 'comeu', 'era', 'eram', 'foi', 'foram', 'mais', 'cerca', 'aproximadamente', 'uns', 'umas',
    'so', 'apenas', 'meu', 'minha', 'meus', 'minhas', 'tambem', 'ai', 'aqui', 'isso', 'esse', 'essa']);
  // Singular simples para comparar: ovos -> ovo, fritos -> frito, feijoes -> feijao
  const sing = w => w.length > 3 ? w.replace(/(oes|aes)$/, 'ao').replace(/eses$/, 'es').replace(/s$/, '') : w;
  // Palavras que descrevem o pedaço/prato mas não precisam estar no nome da TACO
  const GENERICAS = new Set(['file', 'files', 'pedaco', 'fatia', 'salada', 'porcao', 'bife', 'prato', 'pouco', 'pouca']);

  async function carregar() {
    if (taco) return;
    const [t, m] = await Promise.all([
      fetch('dados/taco.json').then(r => r.json()),
      fetch('dados/medidas.json').then(r => r.ok ? r.json() : {medidas: []}).catch(() => ({medidas: []}))
    ]);
    taco = t.alimentos.map(a => ({id: a[0], nome: a[1], kcal: a[3], prot: a[4], carbo: a[5], gord: a[6], fibra: a[7], chave: norm(a[1])}));
    medidas = m.medidas || [];
    temVersaoPronta = new Set(taco.filter(a => PREPARADO.test(a.chave)).map(a => a.chave.split(' ')[0]));
  }

  function buscar(texto) {
    const q = norm(texto);
    if (!q) return null;
    const termos = q.split(' ').filter(t => t.length > 1 && !PALAVRAS_VAZIAS.has(t) && !(t in NUM) && !/^\d/.test(t)).map(sing);
    if (!termos.length) return null;
    const qs = termos.join(' ');
    // 1) nome comum conhecido, só quando o texto não traz outro detalhe (ex.: "batata frita" não é "batata")
    const sk = k => k.split(' ').map(sing).join(' ');
    const chave = Object.keys(PADRAO).filter(k => (' ' + qs + ' ').includes(' ' + sk(k) + ' ')).sort((a, b) => b.length - a.length)[0];
    if (chave && termos.every(t => sk(chave).split(' ').includes(t) || t === 'salada'))
      return PADRAO[chave] == null ? null : taco.find(a => a.id === PADRAO[chave]);
    // 2) pontuação por palavras em comum (aceita plural/feminino: cozido ~ cozida)
    const bate = (t, w) => { w = sing(w); return w === t || (t.length >= 5 && w.length >= 5 && w.slice(0, t.length - 1) === t.slice(0, -1)); };
    const querCru = termos.includes('cru') || termos.includes('crua');
    let melhor = null, pts = 0;
    for (const a of taco) {
      const palavras = a.chave.split(' ');
      // O alimento principal (1ª palavra importante) precisa estar no nome: tilápia ≠ merluza.
      // Detalhes que a TACO não tem ("amarela", "caseiro") só tiram um pouco de pontuação.
      const principalQ = termos.find(t => !GENERICAS.has(t));
      if (!principalQ || !palavras.some(w => bate(principalQ, w))) continue;
      // Palavras do começo pesam mais: em "farinha de mandioca amarela", mandioca vale mais que amarela.
      let p = 0;
      termos.forEach((t, k) => {
        const peso = 1 / (1 + 0.5 * k);
        if (palavras.some(w => bate(t, w))) p += peso; else if (!GENERICAS.has(t)) p -= 0.3 * peso;
      });
      if (/\bpo\b/.test(a.chave) && !termos.includes('po')) p -= 1;    // leite/cacau em pó só se pedir
      if (bate(principalQ, palavras[0])) p += 1;                         // nome principal bate
      const principal = palavras[0];
      // Cru só perde pontos se existir versão pronta (batata, carne...); fruta e salada ficam cruas mesmo.
      if (!querCru && /\bcrua?\b/.test(a.chave) && temVersaoPronta.has(principal)) p -= 1.5;
      if (!querCru && PREPARADO.test(a.chave)) p += 0.5;
      if (PROCESSADO.test(a.chave) && !termos.some(t => PROCESSADO.test(t))) p -= 1;
      p -= a.nome.length / 1000;                                         // desempate: nome mais simples
      if (p > pts) { pts = p; melhor = a; }
    }
    return pts >= 1 ? melhor : null;
  }

  // Gramas de uma medida caseira cadastrada (ex.: "colher de sopa" de arroz). null se não cadastrada.
  function gramasDaMedida(alimento, medida) {
    const m = norm(medida).replace(/s\b/g, '');
    const item = medidas.find(x => x.taco_id === alimento.id && norm(x.medida).replace(/s\b/g, '').startsWith(m.slice(0, 5)) && x.gramas);
    return item ? item.gramas : null;
  }

  const NUM = {'um': 1, 'uma': 1, 'meia': 0.5, 'meio': 0.5, 'dois': 2, 'duas': 2, 'tres': 3, 'quatro': 4, 'cinco': 5};
  const RX_GRAMAS = /(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml)\b/;
  const RX_CONTAGEM = /^(\d+(?:[.,]\d+)?|um|uma|meia|meio|dois|duas|tres|quatro|cinco)\s+(?=[a-z])/;
  const RX_MEDIDA = /(\d+(?:[.,]\d+)?|½|um|uma|meia|meio|dois|duas|tres|quatro|cinco)\s*(col(?:her(?:es)?)?\.?(?:\s*(?:de\s*)?(?:sopa|cha|sobremesa))?|conchas?|files?|bifes?|fatias?|unidades?|pedacos?|xicaras?|copos?|porcao|porcoes)\b/;

  // "almoço: 4 col. de arroz, 1 concha de feijão, 120g de frango" -> itens
  function lerPrato(texto) {
    const t = texto.replace(/½/g, ' meia ').replace(/^\s*(caf[eé] da manh[aã]|almo[cç]o|jantar|lanche|ceia)\s*:?/i, '');
    return t.split(/\s+e\s+|,|;|\+|\n/).map(norm).filter(Boolean).map(parte => {
      // tira palavras de conversa do começo ("tem dois ovos" -> "dois ovos")
      parte = parte.split(' ').filter((w, k, a) => !(PALAVRAS_VAZIAS.has(w) && !(w in NUM) && a.slice(0, k).every(x => PALAVRAS_VAZIAS.has(x) && !(x in NUM)))).join(' ');
      let gramas = null, medida = null, qtd = 1, resto = parte, porUnidade = '';
      const g = parte.match(RX_GRAMAS);
      let m = parte.match(RX_MEDIDA);
      if (!g && !m) {   // número sem medida = unidades
        const c = parte.match(RX_CONTAGEM);
        if (c) m = Object.assign([c[0].trim(), c[1], 'unidade'], {index: 0});
      }
      if (g) {
        gramas = parseFloat(g[1].replace(',', '.')); resto = parte.replace(g[0], ' ');
        // "2 ovos de 50g": número no começo + "de Xg" = peso de cada unidade
        const c = parte.match(RX_CONTAGEM);
        if (c && new RegExp('\\bde\\s*' + g[1].replace('.', '\\.') + '\\s*' + g[2]).test(parte)) {
          const n = NUM[c[1]] ?? parseFloat(c[1].replace(',', '.'));
          gramas *= n; resto = resto.replace(c[0], ' '); porUnidade = `${String(n).replace('.', ',')} × `;
        }
      }
      else if (m) { qtd = NUM[m[1]] ?? parseFloat(m[1].replace(',', '.')); medida = m[2]; resto = parte.replace(m[0], ' '); }
      const alimento = buscar(resto);
      if (alimento && medida && gramas == null) {
        const porMedida = gramasDaMedida(alimento, medida);
        if (porMedida) gramas = porMedida * qtd;
      }
      const qtdTexto = g ? porUnidade + g[0] : m ? (m[2] === 'unidade' && !/unidade/.test(m[0]) ? `${String(qtd).replace('.', ',')} ${qtd > 1 ? 'unidades' : 'unidade'}` : m[0]) : '';
      return {texto: parte, alimento, gramas, qtdTexto, semMedida: !!(alimento && !g && gramas == null)};
    }).filter(i => i.alimento || i.qtdTexto || i.texto.length > 2);
  }

  function calcular(itens) {
    const tot = {kcal: 0, prot: 0, carbo: 0, gord: 0, fibra: 0};
    for (const i of itens) {
      if (!i.alimento || i.gramas == null) continue;
      i.calc = {};
      for (const k in tot) { i.calc[k] = i.alimento[k] * i.gramas / 100; tot[k] += i.calc[k]; }
    }
    return tot;
  }

  return {carregar, buscar, lerPrato, calcular, fonte: 'TACO 4ª ed. (NEPA/UNICAMP, 2011)'};
})();
