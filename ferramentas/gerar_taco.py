"""Gera app/dados/taco.json a partir dos CSVs da TACO 4ª ed. (NEPA/UNICAMP, 2011).

Fonte dos CSVs: github.com/raulfdm/taco-api (references/csv), conferidos contra o PDF oficial.
Uso: python3 ferramentas/gerar_taco.py <pasta_csv> app/dados/taco.json
"""
import csv, json, sys

# Fibra ausente nos CSVs, copiada do PDF oficial da TACO 4ª ed.
FIBRA_DO_PDF = {387: 2.5, 388: 3.1, 442: 3.0, 537: 1.1, 538: 1.0, 548: 1.1}

def num(v):
    try:
        return round(float(v), 1)
    except (TypeError, ValueError):
        return 0  # "NA", "Tr" (traço) ou vazio

def gerar(pasta):
    cats = {r['id']: r['name'] for r in csv.DictReader(open(f'{pasta}/categories.csv', encoding='utf-8'))}
    nutr = {r['foodId']: r for r in csv.DictReader(open(f'{pasta}/nutrients.csv', encoding='utf-8'))}
    alimentos = []
    for r in csv.DictReader(open(f'{pasta}/food.csv', encoding='utf-8')):
        n = nutr[r['id']]
        i = int(r['id'])
        # [id, nome, categoria, kcal, proteína, carboidrato, lipídeos, fibra] por 100 g
        alimentos.append([i, r['name'], int(r['categoryId']), num(n['kcal']), num(n['protein']),
                          num(n['carbohydrates']), num(n['lipids']), FIBRA_DO_PDF.get(i, num(n['dietaryFiber']))])
    return {
        "fonte": "TACO – Tabela Brasileira de Composição de Alimentos, 4ª ed. revisada e ampliada. NEPA/UNICAMP, Campinas, 2011.",
        "unidade": "valores por 100 g da parte comestível",
        "campos": ["id", "nome", "categoria", "kcal", "prot", "carbo", "gord", "fibra"],
        "categorias": {int(k): v for k, v in cats.items()},
        "alimentos": alimentos,
    }

if __name__ == '__main__':
    d = gerar(sys.argv[1])
    json.dump(d, open(sys.argv[2], 'w', encoding='utf-8'), ensure_ascii=False, separators=(',', ':'))
    print(len(d['alimentos']), 'alimentos')
