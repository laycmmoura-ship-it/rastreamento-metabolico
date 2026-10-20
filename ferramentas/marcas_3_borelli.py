# Gelato Borelli: tabela nutricional do site (gelatoborelli.com.br/tabela-nutricional), transcrita de prints enviados
# pela nutricionista em 20/10/2026. Por porção: kcal, carboidrato, proteína, gorduras totais, fibra.
# Uso: python3 ferramentas/marcas_3_borelli.py app/dados/marcas.json   (acrescenta/atualiza os itens "borelli")
import json, sys
AO_LEITE = """BANANA C/ BORELLA;108;17;2.1;3.6;0
BANOFFE;149;23;2.2;5.3;0
BAUNILHA COM FRUTAS VERMELHAS;98;16;2.8;2.3;1.6
BEM CASADO;142;21;2.9;5.8;0
BENE LATTE COM BORELLA;129;17;3.6;5.1;0
BENE LATTE COM CHOCOLATE BRANCO;182;20;3.4;10;0
BIANCOLLATE;167;17;2.4;9.6;0
BLACK BORELLI;112;20;2;2.7;1.4
BORELLA;180;17;2.6;12;1.1
BORELLITO;145;17;2.5;7.1;0
BRIGADEIRO;117;19;3.1;3.8;0
CACAO BUENO;171;18;2.5;8.7;0.4
CAFFÉ BIANCO;97;16;2.3;2.8;0
CARAMELLATO;135;15;3.1;6.8;0.5
CARAMELLO SALATO;107;19;2.1;2.6;0
CHEESECAKE;95;17;2.4;2.7;0
CHERRY BRAND;170;21;2.4;7.7;0
CHOCOTONE;135;18;2.9;5.6;1.4
CHOCOLATE BELGA;118;17;2.6;4.2;1.4
CIOCCOLATINI DUO;184;21;2.7;10;0.6
CHOCOLATE 100%;113;18;1.3;3.6;2.2
CHOCOLATE BIANCO;136;19;2.5;5.7;0
CHOCOLATE BIANCO COM FRUTTA DELLA PASSIONE;127;17;1.7;5.2;0
CHOCOLATE DUBAI;191;23;2.9;10;1.2
COOKIES;104;16;2;3.5;0
CREME DE BACURI;95;17;2;2.4;0.8
CREMINO;140;18;2.4;6.6;0.3
CURAU;98;15;1.7;2.9;0.1
DOCE DE LEITE;127;17;2.5;6;0
FIOR DI LATTE;104;15;2.2;3.7;0
GIANDUIA;126;15;2.7;5.7;0.5
GINGER BREAD;150;21;2.3;6.4;0
MACADAMIA;123;17;2.9;4.8;1.7
MANJAR;124;16;1.6;5.8;0.7
MERENGUE;106;19;2;2.4;0
NOCCIOLA;122;15;2.9;5.7;0.5
NOCCIOLITO;130;16;2.4;5.8;0
NOZES;140;16;2.9;7.5;0.4
NUTELLINO;118;17;2.3;4.8;0
PAÇOCA;127;16;3.8;5.6;0.7
PAÇOCA COM BIANCOLLITO;209;20;4.5;12;0.8
PAÇOCA COM BORELLA;173;19;3.7;9.3;1
PANETONE;126;17;2.9;5.1;1.4
PÃO DE MEL;170;21;2.4;7.7;0
PISTACHE;127;15;2.7;5.7;0.5
PISTACHE PERFEITO;192;22;3.6;10;0.7
PRESTIGIOSO;150;19;2.6;7.1;1.3
RICOTA COM FICHI;103;18;2.6;2.1;1.7
ROMEU E GIULIETTA;103;16;2.6;2.6;0
SACKER DE LARANJA;171;18;2.5;8.7;0.4
SENSAZIONE;115;17;2.3;4;0
STRACCIATELLA;107;17;2.8;2.8;1.8
TAPIOCA COM COCO;120;16;2.1;5.5;0
TIRAMISU;108;14;2.9;4.4;1.4
TORTA LIMONE;129;15;2.7;5.7;0.5
BAUNILHA;96;16;2.2;2.7;0
YOGURT COM AMARENA;89;14;1.8;2.3;1.1
YOGURT COM FRAGOLA;84;14;1.8;1.8;1.1
ZABAIONE;84;14;3;1.8;1.4"""
SEM_LEITE = """ABACAXI COM HORTELÃ;76;19;0;0;0.7
AÇAÍ;76;17;0;1.2;0.7
CAJÁ;68;17;0;0;0.4
CIRIGUELA;81;20;0.4;0.2;1.1
CUPUAÇU;68;17;0;0;0
FRAGOLA;81;18;0.7;0;1.7
FRUTAS VERMELHAS;72;18;0.3;0;1.3
FRUTTA DELLA PASSIONE;78;19;0;0;1.9
JABUTICABA;73;17;0;0;1.8
LAMPONE;78;20;0;0;2.5
LARANJA COM GENGIBRE;76;19;0;0;0.7
LIMONE COM MANJERICÃO;72;18;0;0;0.7
LIMONE SICILIANO;72;18;0;0;0.7
MANGA;80;21;0;0;0.4
MIRTILO;82;21;0;0;0.4
PITAYA;74;18;0.4;0;1
TAMARINDO;113;29;0.6;0;1.1
UMBU;71;18;0;0;0.4
UVA;71;17;0;0.2;1.7"""
ZERO = """ABACAXI;48;11;0;0.2;5.8
AVELÃ COM BORELLA;107;11;2.3;6.6;3.4
BANANA COM BORELLA;97;11;1.9;5.3;3.4
BANANA COM DOLCELLI;83;12;1.9;3.5;3.6
BENE LATTE COM BORELLA;87;7.5;2.8;5.7;1.1
BORELLITO;150;9.4;3.6;10;2.9
CHOCOLATE COM BORELLITO;141;8.4;3.3;9;3
CIOCCOLATO;67;8.4;2.2;2.4;2.9
COCO;89;8;1.3;5.9;3.4
COCO COM ABÓBORA;97;10;1.4;6.4;2.9
COCO COM BORELLA;113;10;1.8;7.6;3.6
COCO COM DOLCELLI;99;11;1.7;5.8;3.7
FRAGOLA;42;11;0;0;5.5
LIMÃO;43;10;0;0.2;6.6
MACADAMIA;126;9.1;2.4;9.5;3.5
MANGA;54;13;0;0.2;5.7
MARACUJÁ;58;14;0.5;0.3;8.2
NOCCIOLA;132;9.4;3.2;9.4;3.9
NOZES;132;9.5;3.1;10;3.7
NOZES COM DOLCELLI;113;11;2.7;7;3.6
PAÇOCA;97;8.7;1.9;4.3;2.2"""
# extras (por porção de 20 g; cascão 30 g). Chantilly: a tabela traz "21" de carboidrato com %VD 1, erro de digitação de 2,1
EXTRAS = """BORELLA;20;107;11;1.2;6.5;0.8
BORELLITO;20;148;11;1.4;11;0.3
NOCCIOLITO;20;124;8.6;2;9.1;0.5
PISTACCHIO PERFETTO;20;110;10;1.6;7;0.5
CASCÃO ARTESANAL;30;84;16;0.5;2;0
CHANTILLY;20;65;2.1;0;6.4;0"""
def tit(s): return ' '.join(w.lower() if w in ('E', 'DE', 'DA', 'DO', 'COM', 'DI', 'DELLA', 'C/') and i else w.capitalize() for i, w in enumerate(s.split()))
itens = []
def add(nome, por, kcal, c, p, g, f, tipo):
    k = 100 / por
    itens.append({'nome': nome, 'porcao': por, 'unidade': 'g', 'kcal': round(kcal * k, 1), 'prot': round(p * k, 2), 'carbo': round(c * k, 2),
                  'gord': round(g * k, 2), 'fibra': round(f * k, 2), 'marca': 'borelli', 'tipo': tipo})
for bloco, tipo, fmt in ((AO_LEITE, 'gelato', 'Gelato {} (Borelli)'), (SEM_LEITE, 'sorbet', 'Sorbet {} (Borelli)'), (ZERO, 'zero', 'Gelato {} zero açúcar (Borelli)')):
    for l in bloco.splitlines():
        n, kcal, c, p, g, f = l.split(';'); add(fmt.format(tit(n)), 60, *map(float, (kcal, c, p, g, f)), tipo)
for l in EXTRAS.splitlines():
    n, por, kcal, c, p, g, f = l.split(';'); add(f'{tit(n)} (Borelli, cobertura/extra)', float(por), *map(float, (kcal, c, p, g, f)), 'extra')
dest = sys.argv[1]; d = json.load(open(dest))
d['itens'] = [x for x in d['itens'] if x.get('marca') != 'borelli'] + itens
d['fontes']['borelli'] = 'Gelato Borelli, tabela nutricional do site (gelatoborelli.com.br/tabela-nutricional), transcrita em 20/10/2026; porção de 60 g por sabor'
json.dump(d, open(dest, 'w'), ensure_ascii=False, separators=(',', ':'))
ruins = [(x['nome'], x['kcal'], round(4 * x['prot'] + 4 * x['carbo'] + 9 * x['gord'])) for x in itens if abs(4 * x['prot'] + 4 * x['carbo'] + 9 * x['gord'] - x['kcal']) / x['kcal'] > 0.15]
# Paçoca zero açúcar: 97 kcal na tabela, mas os macros somam ~81 kcal por porção (mantido como está na fonte)
print(len(itens), 'itens Borelli; fora de Atwater 15%:', ruins, file=sys.stderr)
