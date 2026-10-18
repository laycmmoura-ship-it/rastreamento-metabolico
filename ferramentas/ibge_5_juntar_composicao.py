# Uso: python3 ferramentas/ibge_5_juntar_composicao.py comp.json med.json mapa.json app/dados/ibge.json
# Alimentos da POF 2008-2009 (IBGE) que a TACO não tem: kcal e macros por 100 g + medidas caseiras do mesmo alimento.
# Quem já está ligado à TACO (mapa.json, conferido) fica de fora: a TACO continua sendo a fonte principal.
import json, sys, re, unicodedata
comp, med, mapa = json.load(open(sys.argv[1])), json.load(open(sys.argv[2])), json.load(open(sys.argv[3]))['mapa']
EXCLUIR_LIGACAO = {'Couve|Cozido(a)', 'Couve|Ensopado', 'Couve|Não se aplica', 'Uva|Não se aplica', 'Fruta (não especificada)|Não se aplica',
  'Carne bovina|Assado(a)', 'Carne bovina|Frito(a)', 'Sopa (legumes, carne, etc.)|Não se aplica', 'Caruru (quiabo, camarão seco, amendoim, etc.)|Não se aplica',
  'Caruru (quiabo, amendoim, castanha de caju, camarão|Não se aplica', 'Pastel (queijo, carne, palmito, etc.)|Não se aplica', 'Croquete|Não se aplica',
  'Hambúrguer (sanduíche)|Não se aplica', 'Caldo de carne|Não se aplica', 'Canjica|Não se aplica'}
# açaí: a TACO (polpa congelada, 58 kcal) é o açaí que se toma no Pará; o "açaí" do IBGE é o fruto (262 kcal)
PULAR_COD = {'6601706', '6601709', '6601707', '6601712'}
norm = lambda s: unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower().strip()
ligados = {(r['cod'], r['prep_cod']) for r in med if (r['alimento'] + '|' + r['prep']) in mapa and (r['alimento'] + '|' + r['prep']) not in EXCLUIR_LIGACAO}
def nome(r):
    base = re.sub(r'\s*\([^)]*\)?', '', r['alimento']).strip()
    p = r['prep']
    if p == 'Não se aplica': return base
    p = p.replace('(a)', '').replace('/brasa/churrasco', '').replace('/brasa/chur-', '').replace('/à milanesa', '').lower()
    return f'{base}, {p}'
LIMITE = {'colher de cafe': 10, 'colher de cha': 15, 'colher de sobremesa': 30, 'colher de sopa': 60, 'colher de arroz': 150}
medidas_de = {}
for r in med:
    if r['med_cod'] in (68, 94) or r['fonte_cod'] == 15: continue
    m = r['medida'].lower(); m = 'colher de arroz' if m.startswith('colher de arroz') else m
    lim = LIMITE.get(norm(m))
    if lim and r['gramas'] > lim: continue
    medidas_de.setdefault((r['cod'], r['prep_cod']), {}).setdefault(m, r['gramas'])
alimentos, medidas, vistos = [], [], set()
for r in comp:
    if (r['cod'], r['prep_cod']) in ligados or r['cod'] in PULAR_COD or r['kcal'] is None: continue
    n = nome(r)
    if norm(n) in vistos: continue
    vistos.add(norm(n))
    i = int(r['cod']) * 100 + r['prep_cod']
    alimentos.append([i, n, r['kcal'], r['prot'], r['carbo'], r['gord'], r['fibra']])
    for m, g in (medidas_de.get((r['cod'], r['prep_cod'])) or medidas_de.get((r['cod'], 99)) or {}).items():
        medidas.append([i, m, g])
saida = {'fonte': 'IBGE. Pesquisa de Orçamentos Familiares 2008-2009: Tabelas de Composição Nutricional dos Alimentos Consumidos no Brasil (Tabela 1) e Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil. Rio de Janeiro: IBGE, 2011',
         'colunas': ['id', 'nome', 'kcal', 'prot', 'carbo', 'gord', 'fibra'], 'alimentos': alimentos, 'medidas': medidas}
json.dump(saida, open(sys.argv[4], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(alimentos), 'alimentos do IBGE;', len(medidas), 'medidas', file=sys.stderr)
for a in alimentos:
    if any(w in norm(a[1]) for w in ['vinagrete', 'tapioca', 'manicoba', 'peixe de agua doce', 'pirao', 'beiju', 'tacaca', 'pato']): print('  ', a, file=sys.stderr)
