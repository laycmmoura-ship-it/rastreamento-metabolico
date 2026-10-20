# Uso: pdftotext -layout TABELA_NUTRICIONAL_BK.pdf bk.txt && python3 ferramentas/marcas_1_ler_bk.py bk.txt bk.json
# Tabela nutricional Burger King (ZAMP, documento público) -> itens com porção, kcal, P, C, G, fibra
import re, json, sys
L = open(sys.argv[1], encoding='utf-8').read().splitlines()
POR = re.compile(r'^(\d+(?:,\d+)?) ?(g|ml)$')
NUMC = re.compile(r'^(\*|0\*|<\s*\d+|\d[\d.,]*\*?)(\s*\([^)]*\)?)?$')
def num(s):
    s = s.strip().split('(')[0].strip().rstrip('*')
    if not s or s.startswith('<'): return 0.0
    if re.match(r'^\d{1,3}\.\d{3}$', s): s = s.replace('.', '')
    return float(s.replace(',', '.'))
# nomes que no PDF ficaram na linha de cima/baixo: (porção, kcal) -> nome
NOMES = {(352, 901): 'WHOPPER® Rodeio', (534, 1083): 'Baldão de Brownie', (342, 1054): 'Mega Stacker 2.0', (163, 336): 'Sundae de Chocolate',
         (325, 933): 'Mega Stacker Cheddar 2.0', (180, 378): 'Sundae de Doce de Leite', (417, 1259): 'Mega Stacker Rodeio 2.0', (193, 393): 'BK® Mix de Brownie',
         (178, 455): 'Cheeseburger Duplo', (206, 498): 'BK® Mix Brownie com Nutella®', (310, 140): 'Schweppes®', (300, 153): 'Suco de Uva Natural One®',
         (200, 0): 'Coca Cola® Sem açúcar', (144, 444): 'Rodeio', (130, 313): 'Onion Rings – grande', (205, 530): 'Batata Suprema – individual',
         (200, 64): 'Lipton® Pêssego', (410, 1059): 'Batata Suprema – grande', (200, 74): 'Lipton® Limão', (204, 521): 'Batata Furiosa – individual'}
out = []
for l in L:
    cells = [c.strip() for c in re.split(r'\s{2,}', l.strip()) if c.strip()]
    for k, c in enumerate(cells):
        m = POR.match(c)
        if not m: continue
        vals = []
        for c2 in cells[k + 1:]:
            if NUMC.match(c2): vals.append(c2)
            else: break
        nome = cells[k - 1] if k > 0 and not NUMC.match(cells[k - 1]) and not POR.match(cells[k - 1]) else ''
        por = float(m.group(1).replace(',', '.'))
        v = [num(x) for x in vals]
        if len(v) >= 11: kcal, carb, prot, gord, fib = v[0], v[2], v[5], v[6], v[9]
        elif len(v) == 9: kcal, carb, prot, gord, fib = v[0], v[2], v[3], v[4], v[7]
        else: print('?? colunas', len(v), nome, c, vals, file=sys.stderr); continue
        if not nome or 'Porção' in nome or 'Sódio' in nome or re.match(r'^\d', nome): nome = NOMES.get((int(por), int(kcal)), '')
        out.append(dict(nome=nome, porcao=por, unidade=m.group(2), kcal=kcal, prot=prot, carbo=carb, gord=gord, fibra=fib, ncol=len(v)))
json.dump(out, open(sys.argv[2], 'w'), ensure_ascii=False, indent=0)
print(len(out), 'itens', file=sys.stderr)
