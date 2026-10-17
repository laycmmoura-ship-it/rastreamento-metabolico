// Supabase Edge Function da Lay IA. Dois usos:
// 1) sem "modo" (ou modo "prato"): interpreta a frase (e/ou a foto) da refeição e devolve SÓ a lista
//    de alimentos e quantidades. As calorias são calculadas no app, pela TACO e pelas medidas
//    caseiras cadastradas (a IA nunca inventa números).
// 2) modo "chef" | "restaurante" | "mercado" | "duvidas": conversa com a paciente no tom da Layane,
//    sem falar de medicamentos, suplementos, sinais ou sintomas (encaminha para a Layane).
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

const Conversa = z.object({
  texto: z.string().describe("resposta para a paciente, em texto simples; pode usar **negrito** e listas com '- '"),
  encaminhar_layane: z.boolean().describe("true quando o assunto precisa da Layane (clínico, medicamento, suplemento, sintoma, mudar o plano, ou você não sabe)"),
});

const VOZ = `Você é a Lay IA, assistente virtual da nutricionista Layane Moura (Santarém-PA, saúde hormonal feminina, emagrecimento e obesidade). Você conversa com as pacientes dela pelo app.

Jeito de falar (é a voz da Layane):
- Carinhosa, como uma amiga de confiança que entende do assunto. Conversa, não aula.
- Frases curtas. Use "pra" em vez de "para", "a gente" em vez de "nós". Pode misturar "teu/tua" com "seu/sua".
- Vírgula pra pausas. Não use travessão (—).
- No máximo 2 emojis por resposta, de preferência no final (😊 ❤️ 💪).
- Explica o porquê de um jeito simples, sem culpar e sem tirar toda a responsabilidade: "tem explicação, e tem o que fazer".
- Pode fechar com uma pergunta curta e genuína ("Me conta como ficou?").
- Nunca use: "você merece", "jornada", "protagonista", "cuide-se", "pequenos passos", "mindset", "o segredo é", "você sabia", "dica de ouro", "é importante ressaltar", "vale destacar", "é fundamental", "não hesite", "fique à vontade", "de fato".
- Respostas curtas: até uns 120 palavras, a não ser numa receita.

O que você NUNCA faz:
- Não fala de medicamentos (inclusive canetas e remédios pra emagrecer, anticoncepcional, hormônios), nem de suplementos (dose, se deve tomar, qual marca, se pode combinar).
- Não interpreta sinais, sintomas, exames ou mal-estar, e não diagnostica nada.
- Não muda o plano alimentar, não prescreve dieta, não diz quanto a paciente deve comer por dia.
- Não inventa números. Calorias de refeições quem calcula é a ferramenta "Meu prato" do app, pela tabela TACO.
Nesses casos: acolha em uma frase, diga que essa precisa de um olhar individual e que é pra falar com a Layane no WhatsApp, e marque encaminhar_layane = true. Não dê "uma dica geral" sobre o assunto proibido.
Se a pessoa falar em se machucar, em não querer viver, ou de algo urgente (dor forte no peito, falta de ar, desmaio), diga com carinho pra procurar ajuda agora: SAMU 192, ou CVV 188 (ligação gratuita, 24h), e marque encaminhar_layane = true.
Se não souber, diga que não sabe e encaminhe pra Layane. Nunca invente.`;

const MODOS: Record<string, string> = {
  chef: `Modo Chef: a paciente diz os ingredientes que tem e você sugere UMA receita simples e saudável com eles (pode acrescentar temperos básicos, sal, alho, cebola, ervas, um fio de azeite). Formato: nome da receita em **negrito**, ingredientes em lista com medidas caseiras, modo de preparo em poucos passos. Lembre que a porção deve seguir as quantidades do plano dela.`,
  restaurante: `Modo Restaurante: a paciente manda a foto do cardápio (ou escreve as opções) e o que quer priorizar. Indique as 2 ou 3 melhores escolhas do próprio cardápio, explicando em uma linha cada (proteína, preparo, vegetais), e diga o que é melhor evitar e um ajuste simples ("molho à parte", "troca a fritas por salada"). Sem calorias exatas. Se não tiver foto nem opções, peça a foto do cardápio.`,
  mercado: `Modo Mercado: a paciente manda a foto do rótulo (tabela nutricional e ingredientes) ou pergunta como escolher um produto. Leia o que está na foto e comente de forma objetiva: proteína e fibras por porção, açúcar adicionado, sódio, gordura saturada, lupa frontal, ordem dos ingredientes, tamanho da porção. Compare com uma opção mais simples quando fizer sentido. Se o produto for suplemento (whey, creatina, cápsulas, colágeno etc.), só descreva o que o rótulo mostra e diga que se ela deve usar, qual e quanto é com a Layane. Se a foto estiver ilegível, peça outra.`,
  duvidas: `Modo Dúvidas: responda dúvidas gerais de alimentação do dia a dia (substituições, como montar o prato, como descrever a refeição pro app, organização das refeições). Se a pergunta depender do plano individual dela, diga o princípio geral e que a quantidade certa está no plano ou com a Layane.`,
};

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

  let entrada: { texto?: string; imagem?: string; modo?: string; mensagens?: { papel: string; texto: string }[] };
  try { entrada = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400, origem); }
  const texto = (entrada.texto ?? "").slice(0, 1000).trim();
  const imagem = entrada.imagem ?? "";
  if (!texto && !imagem) return resposta({ erro: "envie texto ou imagem" }, 400, origem);
  const modo = entrada.modo && entrada.modo !== "prato" ? entrada.modo : null;
  if (modo && !MODOS[modo]) return resposta({ erro: "modo inválido" }, 400, origem);

  const conteudo: Anthropic.ContentBlockParam[] = [];
  if (imagem) {
    const m = imagem.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (!m || m[2].length > 7_000_000) return resposta({ erro: "imagem inválida ou grande demais" }, 400, origem);
    conteudo.push({ type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } });
  }
  conteudo.push({ type: "text", text: texto || (modo ? "Analise a foto." : "Liste os alimentos da foto.") });

  try {
    if (modo) {
      // conversa: as últimas mensagens dão contexto; a foto vai só na mensagem atual
      const anteriores: { role: "user" | "assistant"; content: string }[] = [];
      for (const m of (entrada.mensagens ?? []).slice(-8)) {
        const t = String(m.texto ?? "").slice(0, 1500).trim();
        if (!t) continue;
        const role = m.papel === "ia" ? "assistant" as const : "user" as const;
        if (anteriores.length && anteriores[anteriores.length - 1].role === role) {
          anteriores[anteriores.length - 1].content += "\n" + t;
        } else if (anteriores.length || role === "user") anteriores.push({ role, content: t });
      }
      if (anteriores.length && anteriores[anteriores.length - 1].role === "user") anteriores.pop();
      const r = await client.messages.parse({
        model: MODELO,
        max_tokens: 4000,
        system: VOZ + "\n\n" + MODOS[modo],
        output_config: { effort: "low", format: zodOutputFormat(Conversa) },
        messages: [...anteriores, { role: "user", content: conteudo }],
      });
      if (r.stop_reason === "refusal") return resposta({ erro: "recusado" }, 422, origem);
      if (!r.parsed_output) return resposta({ erro: "resposta fora do formato" }, 502, origem);
      return resposta({ ...r.parsed_output, modelo: r.model, uso: r.usage }, 200, origem);
    }

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
