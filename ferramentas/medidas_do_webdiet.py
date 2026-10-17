"""Extrai pesos de medidas caseiras de planos alimentares exportados do Web Diet (PDF ou texto do pdftotext).

Cada linha do plano tem o formato:
  "Aveia em flocos 1.5 Colher(es) de sopa cheia(s) (22.6g)"
Daí sai o peso de UMA medida: 22,6 g / 1,5 = 15 g por colher de sopa cheia.

Uso: python3 ferramentas/medidas_do_webdiet.py plano1.pdf [plano2.pdf ...] > saida.json
Só nomes de alimentos, medidas e gramas vão para a saída (nada do paciente).
"""
import json, re, subprocess, sys
from collections import defaultdict

LINHA = re.compile(
    r'(?P<nome>[A-ZÀ-Úa-zà-ú](?:[^()\n]|\([^)\n]*\))*?)\s+(?P<qtd>\d+(?:[.,]\d+)?)\s+'
    r'(?P<medida>[A-ZÀ-Úa-zà-ú](?:[^()\n]|\((?:es|s)\))*?)\s+\((?P<peso>\d+(?:[.,]\d+)?)\s*(?P<un>g|ml)\)')

def limpar_medida(m):
    # "Colher(es) de sopa cheia(s)" -> "colher de sopa cheia"; "Copo(s) americano(s) duplo(s)" -> "copo americano duplo"
    m = re.sub(r'\((?:es|s)\)', '', m.lower())
    return re.sub(r'\s+', ' ', m).strip()

def texto_do_arquivo(caminho):
    if caminho.lower().endswith('.pdf'):
        t = subprocess.run(['pdftotext', '-layout', caminho, '-'], capture_output=True, text=True, check=True).stdout
        return t.replace('ﬂ', 'fl').replace('ﬁ', 'fi').replace('ﬀ', 'ff')
    return open(caminho, encoding='utf-8').read()

def extrair(textos):
    vistos = defaultdict(list)
    for texto in textos:
        for linha in texto.splitlines():
            # o PDF tem duas colunas (principal | substituição); cada uma pode ter um item
            for parte in re.split(r'\s{3,}|→', linha):
                m = LINHA.search(parte.strip())
                if not m:
                    continue
                qtd = float(m['qtd'].replace(',', '.'))
                if qtd <= 0:
                    continue
                peso = float(m['peso'].replace(',', '.'))
                vistos[(m['nome'].strip(), limpar_medida(m['medida']), m['un'])].append(round(peso / qtd, 1))
    saida = []
    for (nome, medida, un), pesos in sorted(vistos.items()):
        # o mesmo alimento/medida deve dar sempre o mesmo peso; se variar, avisa
        saida.append({"nome_webdiet": nome, "medida": medida, "gramas": max(set(pesos), key=pesos.count),
                      "unidade": un, "ocorrencias": len(pesos), "variacao": sorted(set(pesos)) if len(set(pesos)) > 1 else None})
    return saida

if __name__ == '__main__':
    itens = extrair(texto_do_arquivo(c) for c in sys.argv[1:])
    json.dump(itens, sys.stdout, ensure_ascii=False, indent=1)
    print(f'\n{len(itens)} medidas', file=sys.stderr)
