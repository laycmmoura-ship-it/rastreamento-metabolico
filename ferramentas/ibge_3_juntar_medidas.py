# Uso: python3 ferramentas/ibge_3_juntar_medidas.py med.json mapa.json app/dados/medidas.json
# Junta as medidas do IBGE (POF 2008-2009, Tabela de Medidas Referidas) às medidas do app,
# só para alimentos ligados com segurança à TACO e sem sobrescrever Web Diet / Pinheiro.
import json, sys, re, unicodedata
med = json.load(open(sys.argv[1])); mapa = json.load(open(sys.argv[2]))['mapa']; dest = sys.argv[3]
app = json.load(open(dest))
EXCLUIR = {'Couve|Cozido(a)', 'Couve|Ensopado', 'Couve|Não se aplica', 'Uva|Não se aplica', 'Fruta (não especificada)|Não se aplica',
  'Carne bovina|Assado(a)', 'Carne bovina|Frito(a)', 'Sopa (legumes, carne, etc.)|Não se aplica', 'Caruru (quiabo, camarão seco, amendoim, etc.)|Não se aplica',
  'Caruru (quiabo, amendoim, castanha de caju, camarão|Não se aplica', 'Pastel (queijo, carne, palmito, etc.)|Não se aplica', 'Croquete|Não se aplica',
  'Hambúrguer (sanduíche)|Não se aplica', 'Caldo de carne|Não se aplica', 'Canjica|Não se aplica'}
# ligações conferidas à mão (nomes regionais que a TACO escreve diferente)
PEIXE = 'Peixe de água doce (inteiro, em posta, em filé, etc.)'
MANUAL = {'Açaí|Não se aplica': (168, 'Açaí, polpa, congelada'), 'Farofa|Não se aplica': (131, 'Mandioca, farofa, temperada'),
  'Pão de sal|Não se aplica': (53, 'Pão, trigo, francês'), 'Pão de forma industrializado de qualquer marca|Não se aplica': (9004, 'Pão, de forma'),
  **{f'{PEIXE}|{p}': (9009, 'Peixe, cozido') for p in ('Cozido(a)', 'Assado(a)', 'Grelhado(a)/brasa/chur-', 'Ensopado', 'Não se aplica')}}
for k, (i, n) in MANUAL.items(): mapa[k] = {'id': i, 'nome': n}
LIMITE = {'colher de cafe': 10, 'colher de cha': 15, 'colher de sobremesa': 30, 'colher de sopa': 60, 'colher de servir': 150}
norm = lambda s: unicodedata.normalize('NFD', s).encode('ascii', 'ignore').decode().lower().strip()
def nome_medida(m):
    m = m.lower().strip()
    return 'colher de arroz' if m.startswith('colher de arroz') else m
# já cadastradas (fontes com prioridade)
ja = {(x['taco_id'], norm(x['medida'])) for x in app['medidas'] if x.get('taco_id') is not None}
# preparo igual ao da TACO vem antes de "Não se aplica", que vem antes de "Ensopado"
ordem = lambda r: (0 if r['prep'] not in ('Não se aplica', 'Ensopado') else 1 if r['prep'] == 'Não se aplica' else 2)
novas, descartes = {}, []
for r in sorted(med, key=ordem):
    k = r['alimento'] + '|' + r['prep']
    if k not in mapa or k in EXCLUIR or r['med_cod'] in (68, 94) or r['fonte_cod'] == 15: continue
    tid, med_n = mapa[k]['id'], nome_medida(r['medida'])
    lim = LIMITE.get(norm(med_n))
    if lim and r['gramas'] > lim: descartes.append((k, med_n, r['gramas'])); continue
    chave = (tid, norm(med_n))
    if chave in ja or chave in novas: continue
    novas[chave] = {'taco_id': tid, 'alimento': mapa[k]['nome'], 'medida': med_n, 'gramas': r['gramas'], 'livro': 'ibge',
                    'fonte': f"IBGE, POF 2008-2009, Tabela de Medidas Referidas – {r['alimento']}" + ('' if r['prep'] == 'Não se aplica' else f" ({r['prep']})")}
app['medidas'] = [x for x in app['medidas'] if x.get('livro') != 'ibge'] + list(novas.values())
app['fontes']['ibge'] = 'IBGE. Pesquisa de Orçamentos Familiares 2008-2009: Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil. Rio de Janeiro: IBGE, 2011'
json.dump(app, open(dest, 'w'), ensure_ascii=False, indent=1)
print(len(novas), 'medidas do IBGE;', len(set(t for t, _ in novas)), 'alimentos;', len(descartes), 'descartadas por peso implausível', file=sys.stderr)
for d in descartes[:15]: print('  descartada:', d, file=sys.stderr)
