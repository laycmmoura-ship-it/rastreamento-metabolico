# Uso: pdftotext -layout -f 35 -l 544 liv50000.pdf med.txt && python3 ferramentas/ibge_1_ler_tabela.py med.txt med.json
import re, json, sys
linhas = open(sys.argv[1], encoding='utf-8').read().splitlines()
L = re.compile(r'^(\d{7}) (.+?)\s{2,}(\d{1,3}) (.+?)\s{2,}(\d{1,3}) (.+?)\s{2,}(\d{1,3}) (.+?)\s{2,}(\d+(?:,\d+)?)\s{2,}(\d{1,2}) (.*)$')
rows, falhas = [], []
for l in linhas:
    l = l.strip()
    if not re.match(r'^\d{7} ', l): continue
    m = L.match(l.rstrip())
    if not m: falhas.append(l); continue
    g = m.groups()
    rows.append(dict(cod=g[0], alimento=g[1].strip(), prep_cod=int(g[2]), prep=g[3].strip(), med_cod=int(g[4]), medida=g[5].strip(),
                     gramas=float(g[8].replace(',', '.')), fonte_cod=int(g[9]), fonte_desc=g[10].strip()))
print(len(rows), 'ok', len(falhas), 'falhas', file=sys.stderr)
for f in falhas[:8]: print('FALHA:', f[:200], file=sys.stderr)
json.dump(rows, open(sys.argv[2], 'w'), ensure_ascii=False)
