# Ligar a IA do app (Supabase + Claude)

A mesma função atende o "Meu prato" (lista de alimentos para o cálculo pela TACO) e a conversa dos
modos Chef, Restaurante, Mercado e Dúvidas (campo `modo`), no tom da Layane. Regras da conversa:
não fala de medicamentos, suplementos, sinais ou sintomas, e encaminha para a Layane no WhatsApp
(o app também barra essas palavras antes de chamar a IA). Depois de mudar o `index.ts`, publique de
novo (Edge Functions → interpretar-prato → Code → colar → Deploy).

A função `interpretar-prato` recebe a frase ou a foto da refeição, pede ao Claude só a **lista de
alimentos e quantidades** e devolve para o app. As calorias continuam sendo calculadas no app,
pela TACO e pelas medidas caseiras (Web Diet e Pinheiro et al.). A chave da IA fica só no Supabase.

## 1. Chave da API da Anthropic
1. Entre em https://console.anthropic.com, crie a conta e cadastre a forma de pagamento (cobrança por uso).
2. Em **API Keys**, crie uma chave. Copie e guarde: ela aparece uma vez só.
3. Não mande a chave por chat, e-mail ou GitHub. Ela vai direto no passo 3.

## 2. Projeto no Supabase
1. Em https://supabase.com crie o projeto `lay-ia` (região São Paulo, se houver).
2. Em **Project Settings → API**, anote a **Project URL** e a chave **anon public** (pode mandar essas duas).

## 3. Segredos da função
Em **Edge Functions → Secrets** (ou Project Settings → Edge Functions), adicione:
| Nome | Valor |
|---|---|
| `ANTHROPIC_API_KEY` | a chave do passo 1 |
| `MODELO_PRATO` | opcional. Modelo do "Meu prato"; sem ele, usa `claude-sonnet-5-5` (mais barato: `claude-haiku-5-5`) |
| `MODELO_CONVERSA` | opcional. Modelo da conversa; sem ele, usa `claude-opus-5-5` (ou o antigo `MODELO_IA`) |

## 4. Publicar a função
Pelo painel: **Edge Functions → Deploy a new function**, nome `interpretar-prato`, e cole o conteúdo de
`supabase/functions/interpretar-prato/index.ts`.
Ou pelo terminal, com a Supabase CLI: `supabase functions deploy interpretar-prato`.

## 5. Ligar no app
Preencha `app/config.js` com a URL da função
(`https://SEU-PROJETO.supabase.co/functions/v1/interpretar-prato`) e a anon key.
Sem isso o app continua funcionando com o leitor local.

## 6. Preparações da nutricionista (opcional)
Para cadastrar preparações que a TACO não tem (pizza de frango com catupiry, tapioca, receitas da clínica):
1. **SQL Editor → New query**: cole `supabase/preparacoes.sql` e clique em **Run**.
2. **Authentication → Users → Add user → Create new user**: seu e-mail e uma senha forte, marcando *Auto Confirm User*.
3. No SQL Editor, rode (com o seu e-mail): `insert into public.admins (user_id) select id from auth.users where email = 'SEU-EMAIL';`
4. Abra `app/admin.html` (…/rastreamento-metabolico/app/admin.html), entre e cadastre. O app das pacientes lê as preparações ao abrir.
