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
Cada medida traz a fonte. Ordem de preferência quando há mais de uma: Web Diet (print e planos exportados)
e depois o livro abaixo.
- **Web Diet**: pesos tirados de prints e de planos exportados em PDF pela nutricionista
  (`ferramentas/medidas_do_webdiet.py`).
- **Pinheiro ABV, Lacerda EMA, Benzecry EH, Gomes MCS, Costa VM. Tabela para Avaliação de Consumo
  Alimentar em Medidas Caseiras. 4ª ed. São Paulo: Atheneu.** Apenas os pesos das medidas de cerca de
  30 alimentos comuns, com a página citada em cada item. O livro não é distribuído aqui.
  Conferência: cada peso lido por OCR só foi aceito quando batia com as kcal da mesma linha do livro;
  os demais foram lidos diretamente nas páginas.
