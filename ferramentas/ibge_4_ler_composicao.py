# Uso: python3 ferramentas/ibge_4_ler_composicao.py liv50002.pdf comp.json
# Lê a Tabela 1 (energia, macronutrientes e fibra por 100 g) da POF 2008-2009
import re, json, sys, subprocess
txt = subprocess.run(['pdftotext', '-layout', '-f', '36', '-l', '96', sys.argv[1], '-'], capture_output=True, text=True).stdout
num = r'(-|\.\.\.|\.\.|\d+,\d+)'
L = re.compile(r'^(\d{7})\s+(.+?)\s{2,}(\d{1,2})\s+(.+?)\s{2,}' + r'\s+'.join([num] * 5) + r'\s*$')
val = lambda s: 0.0 if s == '-' else None if s.startswith('..') else float(s.replace(',', '.'))
rows, falhas = [], []
for l in txt.splitlines():
    l = l.strip()
    if not re.match(r'^\d{7}\s', l): continue
    m = L.match(l)
    if not m: falhas.append(l); continue
    g = m.groups()
    rows.append(dict(cod=g[0], alimento=g[1].strip(), prep_cod=int(g[2]), prep=g[3].strip(),
                     kcal=val(g[4]), prot=val(g[5]), gord=val(g[6]), carbo=val(g[7]), fibra=val(g[8])))
print(len(rows), 'linhas;', len(falhas), 'falhas', file=sys.stderr)
for f in falhas[:10]: print('FALHA:', f[:220], file=sys.stderr)
json.dump(rows, open(sys.argv[2], 'w'), ensure_ascii=False)
