// Uso: node ferramentas/ibge_2_ligar_taco.js app med.json mapa.json
// Liga cada alimento+preparo do IBGE a um alimento da TACO (só quando todas as palavras batem)
const fs = require('fs'), path = require('path');
const raiz = process.argv[2], rows = JSON.parse(fs.readFileSync(process.argv[3]));
global.fetch = async u => ({ ok: true, json: async () => JSON.parse(fs.readFileSync(path.join(raiz, u))) });
eval(fs.readFileSync(path.join(raiz, 'nutricao.js'), 'utf8') + ';global.Nutricao=Nutricao');
const PREP = {'Assado(a)': 'assado', 'Cozido(a)': 'cozido', 'Cru(a)': 'cru', 'Frito(a)': 'frito', 'Grelhado(a)/brasa/churrasco': 'grelhado',
  'Grelhado(a)/brasa/chur-': 'grelhado', 'Refogado(a)': 'refogado', 'Ensopado': 'cozido', 'Empanado(a)/à milanesa': 'empanado'};
const N = t => t.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(w => w && !['de','da','do','com','e','em','a','o'].includes(w)).map(w => w.length > 3 ? w.replace(/s$/, '') : w);
// todas as palavras do IBGE estão no nome da TACO (palavra igual, não parecida), a 1ª é a mesma,
// e a TACO não traz uma variedade diferente (seca, em pó, em conserva...)
const VARIEDADE = /^(seca|seco|salgad|conserva|po|desidratad|cristalizad|calda|enlatad|instantane|industrializad|light|diet|doce|frit|empanad|polpa|suco)/;
function confere(base, prep, nomeTaco) {
  const qi = N(base), t = N(nomeTaco);
  if (!qi.length || qi[0] !== t[0] || !qi.every(w => t.includes(w))) return false;
  const extras = t.filter(w => !qi.includes(w));
  const prepW = N(prep);
  return !extras.some(w => VARIEDADE.test(w) && !prepW.some(p => w.startsWith(p.slice(0, 4))));
}
(async () => {
  await Nutricao.carregar();
  const pares = {}; for (const r of rows) pares[r.alimento + '|' + r.prep] = r;
  const mapa = {}, semTaco = [];
  for (const k of Object.keys(pares)) {
    const r = pares[k];
    if (!(r.prep in PREP) && r.prep !== 'Não se aplica') { semTaco.push(k); continue; }
    const base = r.alimento.replace(/\([^)]*\)?/g, ' ').replace(/\s+/g, ' ').trim();
    const q = base + (PREP[r.prep] ? ' ' + PREP[r.prep] : '');
    const [i] = Nutricao.lerPrato(q);
    if (i && i.alimento && i.exato && !i.foraDaTaco && i.alimento.kcal != null && confere(base, r.prep, i.alimento.nome)) mapa[k] = {id: i.alimento.id, nome: i.alimento.nome, q};
    else semTaco.push(k);
  }
  fs.writeFileSync(process.argv[4], JSON.stringify({mapa, semTaco}, null, 1));
  console.log('pares', Object.keys(pares).length, 'ligados', Object.keys(mapa).length, 'sem TACO', semTaco.length);
  for (const k of Object.keys(mapa).slice(0, 400).filter((_, j) => j % 10 === 0)) console.log('  ', k.padEnd(55), '->', mapa[k].nome);
})();
