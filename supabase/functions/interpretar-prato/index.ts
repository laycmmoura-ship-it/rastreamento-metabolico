// Supabase Edge Function: interpreta a frase (e/ou a foto) da refeição com o Claude
// e devolve SÓ a lista de alimentos e quantidades. As calorias são calculadas no app,
// pela TACO e pelas medidas caseiras cadastradas (a IA nunca inventa números).
//
// Segredos (Supabase → Project Settings → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  chave da API da Anthropic (nunca vai para o app nem para o GitHub)
//   MODELO_IA          opcional; padrão claude-opus-5-5. Para testar o mais barato: claude-haiku-5-5
//   ORIGENS            opcional; sites que podem chamar a função, separados por vírgula

import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";

const MODELO = Deno.env.get("MODELO_IA") ?? "claude-opus-5-5";
const ORIGENS = (Deno.env.get("ORIGENS") ??
  "https://laycmmoura-ship-it.github.io,http://localhost:8000,http://localhost:8766").split(",").map((s) => s.trim());

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const Item = z.object({
  alimento: z.string().describe("nome comum do alimento em português, sem marca, singular. Ex.: arroz, feijão carioca, bife de patinho"),
  preparo: z.string().nullable().describe("cozido, grelhado, frito, assado, cru, refogado, mexido... ou null se não disse"),
  quantidade: z.number().nullable().describe("número de medidas; meia = 0.5; null se não disse"),
  medida: z.string().nullable().describe("medida caseira no singular (colher de sopa, colher de servir, concha, escumadeira, unidade, fatia, pedaço, filé, bife, xícara, copo, folha) ou g / ml; null se não disse"),
  tamanho: z.string().nullable().describe("rasa, cheia, pequeno, médio, grande, duplo... ou null"),
});
const Saida = z.object({
  e_refeicao: z.boolean().describe("true se a mensagem descreve algo que a pessoa comeu ou bebeu"),
  itens: z.array(Item),
});

const INSTRUCOES = `Você lê o que uma paciente de nutrição escreveu (e às vezes a foto do prato) e lista os alimentos.
Regras:
- Liste cada alimento separado, mesmo sem vírgula entre eles ("2 colheres de arroz uma concha de feijão" são dois itens).
- Corrija erros de digitação ("bije" = bife, "fejão" = feijão) e use o nome comum em português.
- Quantidade e medida exatamente como a pessoa disse. "Um pedaço médio" = quantidade 1, medida pedaço, tamanho médio.
- Preparações compostas que a pessoa nomeou como um prato (strogonoff, lasanha, feijoada, pizza) ficam como um item só.
- Ingredientes óbvios do preparo que ela não citou (óleo, sal) NÃO entram.
- Se houver foto: identifique os alimentos visíveis e estime a quantidade em medida caseira (colher de sopa, concha, unidade, fatia...). Se o texto disser a quantidade, vale o texto.
- Não calcule calorias nem dê conselhos: só a lista.
- Se a mensagem for uma pergunta ou não falar de comida, e_refeicao = false e itens = [].`;

function cors(origem: string | null) {
  const permitida = origem && ORIGENS.includes(origem) ? origem : ORIGENS[0];
  return {
    "Access-Control-Allow-Origin": permitida,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
  };
}

function resposta(corpo: unknown, status: number, origem: string | null) {
  return new Response(JSON.stringify(corpo), { status, headers: { ...cors(origem), "Content-Type": "application/json" } });
}

Deno.serve(async (req) => {
  const origem = req.headers.get("Origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origem) });
  if (req.method !== "POST") return resposta({ erro: "use POST" }, 405, origem);

  let entrada: { texto?: string; imagem?: string };
  try { entrada = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400, origem); }
  const texto = (entrada.texto ?? "").slice(0, 1000).trim();
  const imagem = entrada.imagem ?? "";
  if (!texto && !imagem) return resposta({ erro: "envie texto ou imagem" }, 400, origem);

  const conteudo: Anthropic.ContentBlockParam[] = [];
  if (imagem) {
    const m = imagem.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (!m || m[2].length > 7_000_000) return resposta({ erro: "imagem inválida ou grande demais" }, 400, origem);
    conteudo.push({ type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } });
  }
  conteudo.push({ type: "text", text: texto || "Liste os alimentos da foto." });

  try {
    const r = await client.messages.parse({
      model: MODELO,
      max_tokens: 4000,
      system: INSTRUCOES,
      output_config: { effort: "low", format: zodOutputFormat(Saida) },
      messages: [{ role: "user", content: conteudo }],
    });
    if (r.stop_reason === "refusal") return resposta({ erro: "recusado", categoria: r.stop_details?.category ?? null }, 422, origem);
    if (!r.parsed_output) return resposta({ erro: "resposta fora do formato" }, 502, origem);
    return resposta({ ...r.parsed_output, modelo: r.model, uso: r.usage }, 200, origem);
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return resposta({ erro: "muitas mensagens, tente de novo" }, 429, origem);
    if (e instanceof Anthropic.AuthenticationError) return resposta({ erro: "chave da IA inválida" }, 500, origem);
    if (e instanceof Anthropic.APIError) return resposta({ erro: `IA indisponível (${e.status})` }, 502, origem);
    return resposta({ erro: "falha inesperada" }, 500, origem);
  }
});
