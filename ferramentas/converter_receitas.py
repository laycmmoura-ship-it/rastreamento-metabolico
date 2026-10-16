"""Converte um livro de receitas em .txt (formato "CAFÉS DA MANHÃ QUE SACIAM") para o JSON do app.

Uso: python3 ferramentas/converter_receitas.py entrada.txt saida.json
"""
import json, re, sys

def converter(texto):
    linhas = texto.splitlines()
    livro = {"titulo": linhas[0].strip(), "autoria": linhas[1].strip(), "descricao": "", "categorias": []}

    # Nomes com acentuação correta vêm do sumário ("  01. Mingau de Aveia").
    nomes = {int(m[1]): m[2].strip() for m in re.finditer(r'^\s+(\d{2})\. (.+)$', texto, re.M)}

    # Descrição: parágrafo antes do primeiro "====".
    ini = texto.split('=' * 10)[0].splitlines()[3:]
    livro["descricao"] = ' '.join(l.strip() for l in ini if l.strip())

    blocos = re.split(r'^={20,}\s*$', texto, flags=re.M)
    cat = None
    for i, bloco in enumerate(blocos):
        b = bloco.strip()
        cab = re.match(r'^(\S+)\s+(.+?)\s+—\s+(.+)$', b)
        if cab and '\n' not in b:
            cat = {"icone": cab[1], "nome": cab[2].title().replace(' De ', ' de ').replace(' Do ', ' do ').replace(' Com ', ' com ').replace(' Em ', ' em '),
                   "subtitulo": cab[3], "receitas": []}
            livro["categorias"].append(cat)
            continue
        if not cat:
            continue
        # Cada receita vem como um bloco "NN. TITULO" seguido do bloco com o conteúdo.
        pedacos = [p.strip() for p in re.split(r'^-{20,}\s*$', b, flags=re.M)]
        for j, r in enumerate(pedacos):
            m = re.fullmatch(r'(\d{2})\. (.+)', r)
            if m:
                corpo = pedacos[j + 1] if j + 1 < len(pedacos) else ''
                cat["receitas"].append(ler_receita(int(m[1]), nomes.get(int(m[1]), m[2].title()), corpo, cat))
    return livro

def ler_receita(num, nome, corpo, cat):
    rec = {"id": num, "nome": nome, "categoria": cat["nome"], "ingredientes": [], "preparo": [], "dica": "", "obs": "", "conservacao": "", "porcao": "", "nutri": {}}
    secao = None
    for linha in corpo.splitlines():
        l = linha.rstrip()
        s = l.strip()
        if not s:
            continue
        if s.startswith('Ingredientes:'): secao = 'ing'; continue
        if s.startswith('Modo de preparo:'): secao = 'prep'; continue
        if s.startswith('Dica:'): rec["dica"] = s[5:].strip(); secao = 'dica'; continue
        if s.startswith('Obs.:'): rec["obs"] = s[5:].strip(); secao = 'obs'; continue
        if s.startswith('Conservação:'): rec["conservacao"] = s[12:].strip(); secao = None; continue
        m = re.match(r'Informação Nutricional \((.+)\):', s)
        if m: rec["porcao"] = m[1]; secao = 'nutri'; continue
        if secao == 'nutri':
            for chave, rx in [('kcal', r'([\d,]+)\s*Kcal'), ('carbo', r'Carboidratos:\s*([\d,]+)g'), ('prot', r'Proteína:\s*([\d,]+)g'), ('gord', r'Gordura:\s*([\d,]+)g')]:
                v = re.search(rx, s)
                if v: rec["nutri"][chave] = float(v[1].replace(',', '.'))
            continue
        if secao == 'ing' and s.startswith('- '): rec["ingredientes"].append(s[2:]); continue
        if secao == 'ing' and rec["ingredientes"]: rec["ingredientes"][-1] += ' ' + s; continue
        if secao == 'prep':
            p = re.match(r'^\d+\.\s+(.*)', s)
            if p: rec["preparo"].append(p[1])
            elif rec["preparo"]: rec["preparo"][-1] += ' ' + s
            continue
        if secao in ('dica', 'obs'): rec[secao] += ' ' + s
    return rec

if __name__ == '__main__':
    livro = converter(open(sys.argv[1], encoding='utf-8').read())
    json.dump(livro, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    n = sum(len(c["receitas"]) for c in livro["categorias"])
    print(f'{len(livro["categorias"])} categorias, {n} receitas')
