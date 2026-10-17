// Cálculo nutricional pela TACO (valores por 100 g) + medidas caseiras cadastradas pela nutricionista.
// Na versão com IA, a IA só identifica alimentos e quantidades; as contas são feitas aqui.

const Nutricao = (() => {
  let taco = null, medidas = null;

  // Escolha padrão quando a pessoa escreve só o nome comum (ids da TACO 4ª ed.)
  const PADRAO = {
    'arroz': 3, 'arroz branco': 3, 'arroz integral': 1,
    'feijao': 561, 'feijao carioca': 561, 'feijao preto': 567,
    'frango': 410, 'peito de frango': 410, 'file de frango': 410, 'frango grelhado': 410,
    'ovo': 488, 'ovo cozido': 488, 'ovo frito': 490, 'ovo mexido': 490, // mexido leva gordura no preparo, como o frito
    'batata': 91, 'batata inglesa': 91, 'batata doce': 88,
    'patinho': 377, 'carne moida': 326,
    'mandioca': 129, 'aipim': 129, 'macaxeira': 129,
    'banana': 182, 'azeite': 260, 'cuscuz': 533, 'aveia': 7, 'iogurte': 448,
    'pao': 53, 'pao frances': 53, 'leite': 458, 'alface': 78, 'tomate': 157,
    // Sem versão pronta na TACO: melhor não calcular do que usar o alimento errado
    'macarrao': null, 'massa': null, 'tilapia': null, 'pao de forma': null,
    'cacau': null, 'cacau em po': null, 'chia': null, 'semente de chia': null, 'tapioca': null, 'goma de tapioca': null,
    'whey': null, 'whey protein': null, 'farinha de aveia': null,
    // grafias comuns que a TACO escreve diferente
    'mussarela': 463, 'mucarela': 463, 'muzzarela': 463, 'queijo mussarela': 463, 'queijo mucarela': 463
  };
  const PREPARADO = /\b(cozid|grelhad|assad|refogad)/;
  const PROCESSADO = /\b(calda|doce|industrializad|enlatad|frit|instantane|polpa|suco|geleia|sorvete|cristalizad|desidratad)/;
  let temVersaoPronta = new Set();   // nomes principais que têm versão cozida/grelhada (ex.: batata)

  const CORRECOES = {bije: 'bife', bifi: 'bife', fejao: 'feijao', fijao: 'feijao', arros: 'arroz', aroz: 'arroz', frago: 'frango',
    franco: 'frango', patinio: 'patinho', mandiocca: 'mandioca', macarao: 'macarrao', iorgute: 'iogurte', iogute: 'iogurte'};
  const corrige = s => s.split(' ').map(w => CORRECOES[w] || w).join(' ');
  const norm = s => corrige(normBase(s));
  const normBase = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
  // Palavras da frase que não fazem parte do nome do alimento ("tem dois ovos", "comi uns...")
  const PALAVRAS_VAZIAS = new Set(['de', 'da', 'do', 'das', 'dos', 'com', 'e', 'a', 'o', 'as', 'os', 'um', 'uma', 'no', 'na', 'em',
    'tem', 'tinha', 'teve', 'comi', 'comeu', 'era', 'eram', 'foi', 'foram', 'mais', 'cerca', 'aproximadamente', 'uns', 'umas',
    'so', 'apenas', 'meu', 'minha', 'meus', 'minhas', 'tambem', 'ai', 'aqui', 'isso', 'esse', 'essa']);
  // Singular simples para comparar: ovos -> ovo, fritos -> frito, feijoes -> feijao
  const sing = w => w.length > 3 ? w.replace(/(oes|aes)$/, 'ao').replace(/eses$/, 'es').replace(/(lh|[^e])eres$/, '$1er').replace(/s$/, '') : w;
  // Palavras que descrevem o pedaço/prato mas não precisam estar no nome da TACO
  const GENERICAS = new Set(['file', 'files', 'pedaco', 'fatia', 'salada', 'porcao', 'bife', 'prato', 'pouco', 'pouca',
    'rasa', 'cheia', 'nivelada', 'pequena', 'pequeno', 'media', 'medio', 'grande', 'duplo', 'dupla', 'americano']);

  async function carregar() {
    if (taco) return;
    const [t, m, c] = await Promise.all([
      fetch('dados/taco.json').then(r => r.json()),
      fetch('dados/medidas.json').then(r => r.ok ? r.json() : {medidas: []}).catch(() => ({medidas: []})),
      fetch('dados/complementar.json').then(r => r.ok ? r.json() : {alimentos: []}).catch(() => ({alimentos: []}))
    ]);
    taco = t.alimentos.map(a => ({id: a[0], nome: a[1], kcal: a[3], prot: a[4], carbo: a[5], gord: a[6], fibra: a[7], chave: norm(a[1])}));
    medidas = m.medidas || [];
    // Alimentos que a TACO deixou sem valores ("*"), completados com outra fonte citada
    for (const x of c.alimentos || []) {
      const a = taco.find(a => a.id === x.taco_id);
      if (a && a.kcal == null) Object.assign(a, {kcal: x.kcal, prot: x.prot, carbo: x.carbo, gord: x.gord, fibra: x.fibra ?? 0, fonte: x.fonte});
    }
    temVersaoPronta = new Set(taco.filter(a => PREPARADO.test(a.chave)).map(a => a.chave.split(' ')[0]));
    // Medidas vindas do Web Diet: liga ao alimento da TACO pelo nome (sem a marca entre parênteses)
    for (const x of medidas) if (x.taco_id == null && x.nome_webdiet && !x.sem_taco) {
      const a = buscar(x.nome_webdiet.replace(/\([^)]*\)/g, ' '));
      if (a) x.taco_id = a.id;
    }
  }

  const buscar = texto => buscarDetalhe(texto).alimento;
  // exato = todas as palavras importantes bateram (senão o app pede confirmação à paciente)
  function buscarDetalhe(texto) {
    const nada = {alimento: null, exato: false};
    const q = norm(texto);
    if (!q) return nada;
    const termos = q.split(' ').filter(t => t.length > 1 && !PALAVRAS_VAZIAS.has(t) && !(t in NUM) && !/^\d/.test(t)).map(sing);
    if (!termos.length) return nada;
    const qs = termos.join(' ');
    // 1) nome comum conhecido, só quando o texto não traz outro detalhe (ex.: "batata frita" não é "batata")
    const sk = k => k.split(' ').filter(w => !PALAVRAS_VAZIAS.has(w)).map(sing).join(' ');
    const chave = Object.keys(PADRAO).filter(k => (' ' + qs + ' ').includes(' ' + sk(k) + ' ')).sort((a, b) => b.length - a.length)[0];
    // palavras que já estão no nome do alimento padrão também contam ("feijão cozido" = Feijão, carioca, cozido)
    const alvoPadrao = chave && PADRAO[chave] != null ? (taco.find(a => a.id === PADRAO[chave])?.chave || '').split(' ').map(sing) : [];
    if (chave && termos.every(t => sk(chave).split(' ').includes(t) || GENERICAS.has(t) || alvoPadrao.includes(t)))
      return {alimento: PADRAO[chave] == null ? null : taco.find(a => a.id === PADRAO[chave]), exato: true, foraDaTaco: PADRAO[chave] == null};
    // 2) pontuação por palavras em comum (aceita plural/feminino: cozido ~ cozida)
    // Iguais ignorando masculino/feminino (cozido = cozida); "cacau" não bate com "cação"
    const raiz = w => w.length >= 5 ? w.replace(/[aoe]$/, '') : w;
    const bate = (t, w) => { w = sing(w); return w === t || raiz(w) === raiz(t); };
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
      if (/\b(gema|clara)\b/.test(a.chave) && !termos.some(t => t === 'gema' || t === 'clara')) p -= 1;  // ovo = ovo inteiro
      if (bate(principalQ, palavras[0])) p += 1;                         // nome principal bate
      const principal = palavras[0];
      // Cru só perde pontos se existir versão pronta (batata, carne...); fruta e salada ficam cruas mesmo.
      if (!querCru && /\bcrua?\b/.test(a.chave) && temVersaoPronta.has(principal)) p -= 1.5;
      if (!querCru && PREPARADO.test(a.chave)) p += 0.5;
      if (PROCESSADO.test(a.chave) && !termos.some(t => PROCESSADO.test(t))) p -= 1;
      p -= a.nome.length / 1000;                                         // desempate: nome mais simples
      if (p > pts) { pts = p; melhor = a; }
    }
    if (!(pts > 0.5)) return nada;   // o alimento principal já é obrigatório acima
    const ws = melhor.chave.split(' ');
    return {alimento: melhor, exato: termos.every(t => GENERICAS.has(t) || ws.some(w => bate(t, w)))};
  }

  // Distância de edição (quantas letras trocar/incluir/tirar): "bije" -> "bife" = 1
  function distancia(a, b) {
    if (Math.abs(a.length - b.length) > 2) return 9;
    let ant = Array.from({length: b.length + 1}, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      const at = [i];
      for (let j = 1; j <= b.length; j++) at[j] = Math.min(ant[j] + 1, at[j - 1] + 1, ant[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      ant = at;
    }
    return ant[b.length];
  }

  // Até n alimentos parecidos com o texto, tolerando erros de digitação, para a paciente escolher
  function sugerir(texto, n = 4) {
    const termos = norm(texto).split(' ').filter(t => t.length > 1 && !PALAVRAS_VAZIAS.has(t) && !(t in NUM) && !/^\d/.test(t) && !GENERICAS.has(t)).map(sing);
    if (!termos.length) return [];
    const parecida = (t, w) => {
      w = sing(w);
      if (w === t || (w.length >= 5 && t.length >= 5 && w.replace(/[aoe]$/, '') === t.replace(/[aoe]$/, ''))) return 1;
      const d = distancia(t, w);
      return t.length >= 4 && d <= 1 ? 0.75 : t.length >= 7 && d <= 2 ? 0.5 : (w.startsWith(t) && t.length >= 4 ? 0.6 : 0);
    };
    const pontos = taco.filter(a => a.kcal != null).map(a => {
      const ws = a.chave.split(' ');
      let p = 0;
      termos.forEach((t, k) => { p += Math.max(0, ...ws.map(w => parecida(t, w))) / (1 + 0.5 * k); });
      if (parecida(termos[0], ws[0]) > 0) p += 0.5;
      if (/\bcrua?\b/.test(a.chave) && temVersaoPronta.has(ws[0])) p -= 0.4;
      if (PROCESSADO.test(a.chave)) p -= 0.3;
      return [p - a.nome.length / 1000, a];
    }).filter(([p]) => p > 0.6).sort((x, y) => y[0] - x[0]);
    return pontos.slice(0, n).map(([, a]) => a);
  }

  // Medidas cadastradas de um alimento (para a paciente escolher quando a dela não tem peso)
  function medidasDe(alimento) {
    if (!alimento) return [];
    const vistos = new Set();
    return medidas.filter(x => x.taco_id === alimento.id && x.gramas)
      .filter(x => { const k = norm(x.medida); if (vistos.has(k)) return false; vistos.add(k); return true; })
      .map(x => ({medida: x.medida, gramas: x.gramas, unidade: /^(copo|xicara|xícara)/i.test(x.medida) ? 'ml' : 'g'}));
  }

  // Gramas de uma medida caseira cadastrada (ex.: "colher de sopa" de arroz). null se não cadastrada.
  // Ex.: medida "colheres de sopa" + tamanho "rasa" -> procura "colher de sopa rasa" daquele alimento.
  // Sem tamanho informado, usa a medida marcada como padrão (ou a única cadastrada).
  const TAMANHOS = ['rasa', 'cheia', 'nivelada', 'pequena', 'media', 'grande', 'pequeno', 'medio', 'americano', 'duplo'];
  function gramasDaMedida(alimento, medida, tamanho) {
    const base = s => norm(s).split(' ').filter(w => !TAMANHOS.includes(w) && w !== 'de').map(sing).join(' ');
    let mb = base(medida);
    // "colher" sozinha = colher de sopa ("1 colher de arroz" é uma colher de sopa com arroz);
    // a "colher de arroz" das tabelas é a colher de servir
    if (/^col(her)?$/.test(mb)) mb = 'colher sopa';
    if (/servir$/.test(mb)) mb = 'colher arroz';
    const daMedida = x => x.gramas && (mb.startsWith('colher') ? base(x.medida).startsWith(mb) : base(x.medida).startsWith(mb.slice(0, 5)));
    let doAlimento = medidas.filter(x => x.taco_id === alimento.id && daMedida(x));
    // Unidade e fatia pesam o mesmo no cru, cozido ou frito (ovo, pão): usa a do mesmo alimento principal
    if (!doAlimento.length && /^(unidade|fatia)/.test(mb)) {
      // mesmo alimento, só muda o preparo (ovo cru/cozido/frito); batata-doce ≠ batata-inglesa
      const semPreparo = c => c.split(' ').filter(w => !/^(cru|crua|cozid|grelhad|assad|frit|refogad|cozido|cozida|frito|frita|\d)/.test(w)).join(' ');
      const alvo = semPreparo(alimento.chave);
      doAlimento = medidas.filter(x => daMedida(x) && semPreparo(taco.find(a => a.id === x.taco_id)?.chave || '') === alvo);
    }
    if (!doAlimento.length && /^pedaco/.test(mb)) {
      for (const alt of ['bife', 'file']) {
        doAlimento = medidas.filter(x => x.taco_id === alimento.id && x.gramas && base(x.medida).startsWith(alt));
        if (doAlimento.length) break;
      }
    }
    if (!doAlimento.length) return null;
    if (tamanho) {
      const t = sing(tamanho);
      const certo = doAlimento.find(x => norm(x.medida).split(' ').map(sing).includes(t));
      if (certo) return certo.gramas;
      // medida sem tamanho no cadastro ("colher de sopa") serve para qualquer tamanho; "cheia" nunca vira "rasa"
      const semTam = doAlimento.find(x => !norm(x.medida).split(' ').some(w => TAMANHOS.includes(sing(w)) && w !== 'americano'));
      return semTam ? semTam.gramas : null;
    }
    const temPalavra = (x, re) => norm(x.medida).split(' ').some(w => re.test(w));
    return (doAlimento.find(x => x.padrao) || doAlimento.find(x => temPalavra(x, /^medi[oa]$/)) ||
            doAlimento.find(x => !temPalavra(x, /^(grande|pequen[oa]|duplo|cheia|rasa)$/)) || doAlimento[0]).gramas;
  }

  const NUM = {'um': 1, 'uma': 1, 'meia': 0.5, 'meio': 0.5, 'dois': 2, 'duas': 2, 'tres': 3, 'quatro': 4, 'cinco': 5};
  const RX_GRAMAS = /(\d+(?:[.,]\d+)?)\s*(g|gr|gramas?|ml)\b/;
  const RX_CONTAGEM = /^(\d+(?:[.,]\d+)?|um|uma|meia|meio|dois|duas|tres|quatro|cinco)\s+(?=[a-z])/;
  const RX_MEDIDA = /(\d+(?:[.,]\d+)?|½|um|uma|meia|meio|dois|duas|tres|quatro|cinco)\s*(col(?:her(?:es)?)?\.?(?:\s*(?:de\s*)?(?:sopa|cha|sobremesa|cafe|servir))?|escumadeiras?|folhas?|conchas?|files?|bifes?|fatias?|unidades?|pedacos?|xicaras?|copos?(?:\s+americanos?)?|dosador(?:es)?|scoops?|porcao|porcoes)\b/;

  // "pão com manteiga" e "arroz com feijão" são dois alimentos; "frango com pele" é um só (existe assim na TACO).
  function separarCom(parte) {
    const [esq, ...resto] = parte.split(/\s+com\s+/);
    if (!resto.length) return [parte];
    const dir = resto.join(' com ');
    const termos = norm(parte).split(' ').filter(t => t.length > 1 && !PALAVRAS_VAZIAS.has(t) && !(t in NUM) && !/^\d/.test(t) && !GENERICAS.has(t)).map(sing);
    const junto = buscar(parte), ws = junto ? junto.chave.split(' ').map(sing) : [];
    const juntoNaTaco = !!junto && termos.every(t => ws.includes(t));
    return juntoNaTaco || !buscar(dir) ? [parte] : [esq, dir];
  }

  // "almoço: 4 col. de arroz, 1 concha de feijão, 120g de frango" -> itens
  function lerPrato(texto) {
    const t = texto.replace(/½/g, ' meia ').replace(/^\s*(caf[eé] da manh[aã]|almo[cç]o|jantar|lanche|ceia)\s*:?/i, '');
    const QTD = '(?=\\d|um |uma |dois |duas |tr[eê]s |quatro |cinco |meia |meio )';
    const MED = '(?:col|colher|concha|fil[eé]|bife|fatia|unidade|peda[cç]o|x[ií]cara|copo|escumadeira|folha|dosador|scoop|por[cç])';
    const NOVA_QTD = `(?<!\\bde)\\s+(?=(?:\\d+(?:[.,]\\d+)?|um|uma|dois|duas|tr[eê]s|quatro|cinco|meia|meio)\\s+${MED})`;
    const NOVO_NUM = `(?<!\\bde)\\s+(?=\\d+(?:[.,]\\d+)?\\s+(?!g\\b|gr\\b|gramas?\\b|ml\\b)[a-zà-ú])`;  // "2 ovos 1 banana"
    const partes = t.split(new RegExp(`\\s+e\\s+|,|;|\\+|\\n|\\s+(?:com|mais)\\s+${QTD}|${NOVA_QTD}|${NOVO_NUM}`, 'i')).map(norm).filter(Boolean)
      .flatMap(separarCom);
    return partes.map(parte => {
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
      const {alimento, exato, foraDaTaco} = buscarDetalhe(resto);
      const tam = m && (parte.match(/\b(rasas?|cheias?|niveladas?|pequen[oa]s?|medi[oa]s?|grandes?|duplos?)\b/) || [])[1];
      if (alimento && medida && gramas == null) {
        const porMedida = gramasDaMedida(alimento, medida, tam);
        if (porMedida) gramas = porMedida * qtd;
      }
      const qtdTexto = g ? porUnidade + g[0] : m ? (m[2] === 'unidade' && !/unidade/.test(m[0]) ? `${String(qtd).replace('.', ',')} ${qtd > 1 ? 'unidades' : 'unidade'}` : m[0] + (tam ? ' ' + tam : '')) : '';
      const unidade = (g && /ml/.test(g[2])) || (medida && /^(copo|xicara)/.test(medida)) ? 'ml' : 'g';
      // texto do alimento sem sobras da quantidade ("rasa de farinha" -> "farinha")
      const busca = resto.trim().split(/\s+/).filter((w, k, arr) => !(arr.slice(0, k + 1).every(x => PALAVRAS_VAZIAS.has(x) || GENERICAS.has(x)))).join(' ') || resto.trim();
      return {texto: parte, busca, qtd, exato, foraDaTaco: !!foraDaTaco, alimento, gramas, unidade, qtdTexto, semDado: !!(alimento && alimento.kcal == null),
              semMedida: !!(alimento && alimento.kcal != null && !g && gramas == null)};
    }).filter(i => i.alimento || i.qtdTexto || i.texto.length > 2);
  }

  function calcular(itens) {
    const tot = {kcal: 0, prot: 0, carbo: 0, gord: 0, fibra: 0};
    for (const i of itens) {
      if (!i.alimento || i.gramas == null || i.alimento.kcal == null) continue;
      i.calc = {};
      for (const k in tot) { i.calc[k] = i.alimento[k] * i.gramas / 100; tot[k] += i.calc[k]; }
    }
    return tot;
  }

  // Paciente escolheu outro alimento ou outra medida: atualiza o item
  function ajustar(item, {alimento, gramas, medida, unidade}) {
    if (alimento) {
      item.alimento = alimento; item.exato = true; item.semDado = alimento.kcal == null;
      if (item.gramas == null && item.qtdTexto && !/\d\s*(g|ml)\b/.test(item.qtdTexto)) {
        const m = item.qtdTexto.match(/^\S+\s+(.+)$/);
        const porMedida = m && gramasDaMedida(alimento, m[1]);
        if (porMedida) item.gramas = porMedida * (item.qtd || 1);
      }
    }
    if (gramas != null) { item.gramas = gramas; item.qtdTexto = medida; item.unidade = unidade || 'g'; }
    item.semMedida = !!(item.alimento && item.alimento.kcal != null && item.gramas == null);
    delete item.calc;
  }

  const porId = id => taco.find(a => a.id === id);
  return {carregar, buscar, lerPrato, calcular, sugerir, medidasDe, ajustar, porId, fonte: 'TACO 4ª ed. (NEPA/UNICAMP, 2011)'};
})();
