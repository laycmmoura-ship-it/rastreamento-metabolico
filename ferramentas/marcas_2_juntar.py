# Uso: python3 ferramentas/marcas_2_juntar.py bk.json app/dados/marcas.json
# Itens de marca (tabela nutricional pública do restaurante) -> valores por 100 g/ml + medida "unidade" = porção
import json, sys, re
itens = json.load(open(sys.argv[1]))
FONTE = 'Burger King Brasil (ZAMP S.A.), tabela nutricional pública, versão de jun/2026'
EXCLUIR = {('Molho Grogu', 26.0)}            # 603 kcal em 26 g: impossível, provável erro na tabela
saida, vistos = [], set()
for x in itens:
    nome = re.sub(r'\s+', ' ', x['nome'].replace('Ov omaltine', 'Ovomaltine').replace('Biscof f', 'Biscoff').replace('Uv a', 'Uva').replace('v erde', 'verde').replace('indiv idual', 'individual')).replace(' ®', '®').strip()
    if not nome or (x['nome'], x['porcao']) in EXCLUIR or nome in vistos: continue   # repetidos = embalagens grandes de molho / sazonais
    vistos.add(nome)
    f = 100 / x['porcao']
    saida.append({'nome': f'{nome} (Burger King)', 'porcao': x['porcao'], 'unidade': x['unidade'],
                  'kcal': round(x['kcal'] * f, 1), 'prot': round(x['prot'] * f, 2), 'carbo': round(x['carbo'] * f, 2), 'gord': round(x['gord'] * f, 2), 'fibra': round(x['fibra'] * f, 2)})
json.dump({'fontes': {'bk': FONTE}, 'itens': [{**i, 'marca': 'bk'} for i in saida]}, open(sys.argv[2], 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(saida), 'itens', file=sys.stderr)
