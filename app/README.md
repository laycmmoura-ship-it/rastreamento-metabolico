# Lay IA — app das pacientes (protótipo)

Web app instalável (PWA) com assistente para as pacientes da Layane Moura.

## O que já funciona (etapa 1 — protótipo)
- Tela inicial com 4 atalhos: **Chef Lay**, **Lay no Restaurante**, **Lay no Mercado**, **Tirar dúvidas**
- Chat com envio de texto e de **foto** (câmera ou galeria; a foto é reduzida antes do envio)
- Menu lateral com link para o Rastreamento Metabólico
- Instalável na tela inicial do celular (manifest + service worker)
- **Respostas de exemplo** (`MODO_DEMO = true` em `index.html`) — ainda sem IA real

## Próximas etapas
1. Servidor (`/api/chat`) que guarda a chave da IA com segurança e as orientações da Layane
2. Acesso só para pacientes (código ou login) e, se desejado, dados do plano de cada paciente
3. Testes com a Layane e algumas pacientes antes de liberar

## Testar localmente
```
python3 -m http.server 8000
```
Abra http://localhost:8000/app/

## Receitas
- Tela "Receitas" com busca, filtro por categoria e página de cada receita
  (ingredientes para marcar, passo a passo, kcal e macros, dica e conservação).
- Para adicionar um livro: `python3 ferramentas/converter_receitas.py livro.txt app/receitas.json`
- `app/receitas.json` está no `.gitignore`: livros de outras autoras só devem ser
  publicados com autorização de uso.

## Cálculo nutricional (TACO)
- `app/dados/taco.json`: 597 alimentos da **TACO – Tabela Brasileira de Composição de Alimentos,
  4ª ed. revisada e ampliada. NEPA/UNICAMP, Campinas, 2011** (reprodução permitida com citação da fonte).
  Gerado por `ferramentas/gerar_taco.py` a partir dos CSVs de github.com/raulfdm/taco-api (MIT),
  conferidos contra o PDF oficial: 2.653 valores iguais; 6 fibras ausentes completadas pelo PDF.
- `app/nutricao.js`: encontra o alimento na TACO e calcula kcal e macros pelos gramas.
  Quando não acha o alimento, avisa ("não está na TACO") em vez de chutar outro.
- `app/dados/medidas.json`: **gramas das medidas caseiras, a preencher pela nutricionista**
  (enquanto estiver em branco, medidas como "colher" ficam fora do total).
- TBCA (USP/FoRC): não incluída. Os termos encontrados indicam licença CC BY-NC-ND e proibição de
  reprodução; usar só com autorização do FoRC.

## Identidade visual
- Paleta da marca: verde #4B5344, creme #F6F5F0, branco, dourado #A48E52 a #E0CC8F (lidos das logos).
- Fontes Poppins (texto) e Great Vibes (títulos), licença SIL OFL, servidas pelo próprio app em `app/fontes/`.
- `app/marca/`: símbolo (avatar do Instagram) e logo horizontal 1C verde, reduzidos para o app.
  Os ícones do celular (`apple-touch-icon.png`, `icon-192.png`, `icon-512.png`) usam o mesmo símbolo.

## Medidas caseiras (`app/dados/medidas.json`)
Cada medida traz a fonte. Ordem de preferência quando há mais de uma: Web Diet (print e planos exportados),
depois o livro de Pinheiro et al. e por último a tabela do IBGE.
- **Web Diet**: pesos tirados de prints e de planos exportados em PDF pela nutricionista
  (`ferramentas/medidas_do_webdiet.py`).
- **Pinheiro ABV, Lacerda EMA, Benzecry EH, Gomes MCS, Costa VM. Tabela para Avaliação de Consumo
  Alimentar em Medidas Caseiras. 4ª ed. São Paulo: Atheneu.** Apenas os pesos das medidas de cerca de
  30 alimentos comuns, com a página citada em cada item. O livro não é distribuído aqui.
  Conferência: cada peso lido por OCR só foi aceito quando batia com as kcal da mesma linha do livro;
  os demais foram lidos diretamente nas páginas.
- **IBGE. Pesquisa de Orçamentos Familiares 2008-2009: Tabela de Medidas Referidas para os Alimentos
  Consumidos no Brasil. Rio de Janeiro: IBGE, 2011.** Cerca de 1.450 medidas de 231 alimentos da TACO
  (ferramentas `ibge_1_ler_tabela.py`, `ibge_2_ligar_taco.js`, `ibge_3_juntar_medidas.py`). Só entram os
  alimentos ligados à TACO com todas as palavras iguais (mais alguns nomes regionais conferidos à mão,
  como açaí, farofa, pão de sal e peixe de água doce); linhas "grama/quilo" e pesos de colher implausíveis
  ficam de fora; não sobrescrevem medidas do Web Diet nem de Pinheiro. O PDF não é distribuído aqui.
- **Alimentos que nem a TACO nem Pinheiro têm** (`app/dados/ibge.json`, ids = código IBGE × 100 + preparo):
  cerca de 1.690 alimentos e preparações da **POF 2008-2009 do IBGE** (Tabelas de Composição Nutricional dos
  Alimentos Consumidos no Brasil, Tabela 1: kcal, proteína, lipídios, carboidrato e fibra por 100 g; Rio de
  Janeiro: IBGE, 2011), como tapioca de goma, vinagrete, pirão, beiju, peixe de água doce, com as medidas
  caseiras do mesmo alimento na Tabela de Medidas Referidas. Quem já tem equivalente conferido na TACO fica de
  fora, e na busca a TACO vence o IBGE quando as duas têm o alimento. O "açaí" do IBGE (fruto, 262 kcal) não
  entra: vale o açaí polpa da TACO. Ferramentas `ibge_4_ler_composicao.py` e `ibge_5_juntar_composicao.py`.
- **Produtos de redes** (`app/dados/marcas.json`, ids 3000000+): Burger King Brasil, tabela nutricional pública
  da ZAMP S.A. (versão jun/2026), ~100 produtos com kcal e macros convertidos para 100 g/ml e a medida "unidade" =
  porção do produto (`ferramentas/marcas_1_ler_bk.py`, `marcas_2_juntar.py`). Conferido por Atwater; "Molho Grogu"
  (603 kcal em 26 g) ficou de fora por erro evidente na tabela. Só entram quando todas as palavras batem, e não passam
  na frente da TACO para alimentos genéricos ("batata frita" continua TACO; "batata frita do bk" usa o BK).
  **Gelato Borelli**: tabela do site (gelatoborelli.com.br/tabela-nutricional), transcrita de prints em 20/10/2026
  (`ferramentas/marcas_3_borelli.py`): 59 gelatos ao leite, 19 sorbets, 21 zero açúcar e 6 extras, porção de 60 g
  por sabor (usada também como "bola" quando a paciente não diz o peso). Conferido por Atwater; a única divergência
  (Paçoca zero açúcar, 97 kcal × macros ≈ 81) foi mantida como está na fonte. A lista zero açúcar e os extras vieram
  incompletos nos prints.
- **Alimentos que a TACO não tem** (`app/dados/complementar.json`, campo `novos`, ids 9001+): 74 alimentos
  comuns e sem marca (macarrão cozido, pão de forma, peixes, ovo mexido, grão-de-bico, purê, strogonoff,
  lasanha, pizzas, bolos, biscoitos, sopas…), com kcal e macros por 100 g de Pinheiro et al. (4ª ed.) e a
  página citada. Conferência: kcal ≈ 4×P + 4×C + 9×G, comparação com uma segunda leitura e, nos casos
  duvidosos, leitura direta da página (corrigidos: brócolis refogado 81 kcal, maxixe cozido 6 kcal).
