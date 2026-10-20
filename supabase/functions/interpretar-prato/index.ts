// Supabase Edge Function da Lay IA. Dois usos:
// 1) sem "modo" (ou modo "prato"): interpreta a frase (e/ou a foto) da refeição e devolve SÓ a lista
//    de alimentos e quantidades. As calorias são calculadas no app, pela TACO e pelas medidas
//    caseiras cadastradas (a IA nunca inventa números).
// 2) modo "chef" | "restaurante" | "mercado" | "duvidas": conversa com a paciente no tom da Layane,
//    sem falar de medicamentos, suplementos, sinais ou sintomas (encaminha para a Layane).
//
// Segredos (Supabase → Project Settings → Edge Functions → Secrets):
//   ANTHROPIC_API_KEY  chave da API da Anthropic (nunca vai para o app nem para o GitHub)
//   MODELO_PRATO       opcional; modelo do "Meu prato" (só lista alimentos). Padrão claude-sonnet-5-5; mais barato: claude-haiku-5-5
//   MODELO_CONVERSA    opcional; modelo da conversa (Chef, Restaurante, Mercado, Dúvidas). Padrão claude-opus-5-5
//   MODELO_IA          nome antigo de MODELO_CONVERSA (ainda vale)
//   ORIGENS            opcional; sites que podem chamar a função, separados por vírgula

import Anthropic from "npm:@anthropic-ai/sdk";
import { z } from "npm:zod";
import { zodOutputFormat } from "npm:@anthropic-ai/sdk/helpers/zod";

const MODELO_PRATO = Deno.env.get("MODELO_PRATO") ?? "claude-sonnet-5-5";
const MODELO_CONVERSA = Deno.env.get("MODELO_CONVERSA") ?? Deno.env.get("MODELO_IA") ?? "claude-opus-5-5";
const ORIGENS = (Deno.env.get("ORIGENS") ??
  "https://laycmmoura-ship-it.github.io,http://localhost:8000,http://localhost:8766").split(",").map((s) => s.trim());

const client = new Anthropic(); // lê ANTHROPIC_API_KEY do ambiente

const Item = z.object({
  alimento: z.string().describe("nome comum do alimento em português, sem marca, singular. Ex.: arroz, feijão carioca, bife de patinho"),
  preparo: z.string().nullable().describe("cozido, grelhado, frito, assado, cru, refogado, mexido... ou null se não disse"),
  quantidade: z.number().nullable().describe("número de medidas; meia = 0.5; null se não disse"),
  medida: z.string().nullable().describe("medida caseira no singular (colher de sopa, colher de servir, concha, escumadeira, unidade, fatia, pedaço, filé, bife, xícara, copo, folha) ou g / ml; null se não disse"),
  tamanho: z.string().nullable().describe("rasa, cheia, pequeno, médio, grande, duplo... ou null"),
  gramas_estimados: z.number().nullable().describe("peso aproximado em gramas do item inteiro (toda a quantidade), estimado por você; preencha sempre que houver foto, cardápio com peso, prato regional ou medida pouco comum"),
  equivalente: z.string().nullable().describe("alimento simples e comum mais parecido, como estaria numa tabela de composição (ex.: tambaqui assado -> peixe assado; açaí na tigela -> açaí polpa; vinagrete -> salada de tomate com cebola); null se o próprio nome já é simples"),
});
const Saida = z.object({
  e_refeicao: z.boolean().describe("true se a mensagem descreve algo que a pessoa comeu ou bebeu, ou corrige/completa a refeição anterior"),
  acao: z.enum(["nova", "corrige", "soma"]).describe("nova = outra refeição; corrige = a paciente está corrigindo ou completando a refeição anterior desta conversa (devolva a lista COMPLETA já corrigida); soma = comeu mais alguma coisa além da anterior (devolva só o que é novo)"),
  itens: z.array(Item),
});

const INSTRUCOES = `Você lê o que uma paciente de nutrição escreveu (e às vezes a foto do prato) e lista os alimentos.
Regras:
- Liste cada alimento separado, mesmo sem vírgula entre eles ("2 colheres de arroz uma concha de feijão" são dois itens).
- Corrija erros de digitação ("bije" = bife, "fejão" = feijão) e use o nome comum em português.
- Quantidade e medida exatamente como a pessoa disse. "Um pedaço médio" = quantidade 1, medida pedaço, tamanho médio.
- Pratos típicos com nome próprio (strogonoff, lasanha, feijoada, pizza, maniçoba, baião de dois) ficam como um item só.
- Sanduíche, misto, tapioca recheada, cuscuz recheado, salada montada, açaí com complementos: separe nos componentes, cada um com quantidade e gramas_estimados (ex.: misto quente = pão de forma 2 fatias 50 g, queijo muçarela 1 fatia 20 g, presunto 1 fatia 15 g, manteiga 5 g).
- Sorveteria/gelateria: cada sabor é sorvete. Use alimento "sorvete de <sabor>" (ou "sorbet de <sabor>") e equivalente "sorvete"; açaí de sorveteria é sorvete de açaí, não polpa. Copo pequeno de gelato ≈ 100 a 120 g, 1 bola ≈ 60 a 70 g.
- Bebidas: preparo null ("suco de laranja", não "suco de laranja cru"). Se der pra ver, diga se é natural ou de caixinha no nome.
- quantidade e medida caseira: preencha sempre que der (1 fatia, 2 colheres de sopa, 1 copo, 1 unidade), mesmo vindo de foto. O app usa o peso oficial da medida quando tem.
- gramas_estimados: preencha SEMPRE com a melhor estimativa do peso total do item (porção típica de adulto se a pessoa não disse a quantidade). Copo de suco: some só o líquido.
- Porções de referência (não exagere): 1 fatia de queijo muçarela ou prato ≈ 20 g; 1 fatia de presunto ≈ 15 g; 1 fatia de pão de forma ≈ 25 g; pão francês ≈ 50 g; manteiga ou requeijão na ponta da faca ≈ 5 g; 1 ovo ≈ 50 g; copo de suco 200 a 300 ml; colher de sopa de arroz ≈ 25 g; concha de feijão ≈ 140 g. Num sanduíche comum, conte 1 fatia de cada recheio, a não ser que se veja ou a pessoa diga mais.
- Ingredientes óbvios do preparo que ela não citou (óleo, sal) NÃO entram.
- Recipiente não é alimento: "tigela de açaí" = alimento açaí, medida tigela; "copo de suco" = suco, medida copo.
- Pratos regionais e preparações (tambaqui, baião de dois, farofa, vinagrete, maniçoba): mantenha o nome e preencha equivalente com o alimento simples mais parecido.
- Se houver foto (pode ter mais de uma, da mesma refeição): identifique os alimentos visíveis e estime a quantidade em medida caseira (colher de sopa, concha, unidade, fatia...) e em gramas_estimados. Se o texto disser a quantidade, vale o texto.
- Conversa: se vier "Refeição já registrada nesta conversa", a mensagem atual pode estar corrigindo ou completando essa refeição ("o queijo é muçarela", "você esqueceu o pão", "eram 2 fatias", "não sei o peso, estima"). Nesse caso acao = corrige e devolva a refeição inteira já corrigida, mantendo o que estava certo. Se ela contar outra coisa que comeu junto ("também tomei um café"), acao = soma. Se for claramente outra refeição, acao = nova.
- Não calcule calorias nem dê conselhos: só a lista.
- Se a mensagem for uma pergunta ou não falar de comida, e_refeicao = false e itens = [].`;

const Conversa = z.object({
  texto: z.string().describe("resposta para a paciente, em texto simples; pode usar **negrito** e listas com '- '"),
  encaminhar_layane: z.boolean().describe("true quando o assunto precisa da Layane (clínico, medicamento, suplemento, sintoma, mudar o plano, ou você não sabe)"),
  foto_e_refeicao: z.boolean().describe("só no modo Restaurante: true se a foto mostra comida ou bebida já servida (prato, lanche, copo), e não um cardápio; nos outros modos, false"),
  estimativas: z.array(z.object({
    nome: z.string().describe("nome do prato como está no cardápio"),
    porcao: z.string().describe("o que conta como 1 pessoa, ex.: '1/2 do prato (serve 2)' ou '1 prato individual'"),
    itens: z.array(Item).describe("o que vai no prato de UMA pessoa, com gramas_estimados de cada componente"),
  })).describe("só no modo Restaurante: os pratos indicados, decompostos por pessoa, pra o app calcular as calorias pela TACO; nos outros modos, lista vazia"),
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
- Não fala de medicamentos (inclusive canetas e remédios pra emagrecer, anticoncepcional, hormônios), nem de suplementos (dose, se deve tomar, qual marca, se pode combinar). Única exceção: no modo Mercado você pode ler e explicar o rótulo de um suplemento (veja as regras do modo), sem nunca dizer qual usar.
- Não interpreta sinais, sintomas, exames ou mal-estar, e não diagnostica nada.
- Não muda o plano alimentar, não prescreve dieta, não diz quanto a paciente deve comer por dia.
- Não inventa números. Calorias de refeições quem calcula é a ferramenta "Meu prato" do app, pela tabela TACO.
Nesses casos: acolha em uma frase, diga que essa precisa de um olhar individual e que é pra falar com a Layane no WhatsApp, e marque encaminhar_layane = true. Não dê "uma dica geral" sobre o assunto proibido.
Se a pessoa falar em se machucar, em não querer viver, ou de algo urgente (dor forte no peito, falta de ar, desmaio), diga com carinho pra procurar ajuda agora: SAMU 192, ou CVV 188 (ligação gratuita, 24h), e marque encaminhar_layane = true.
Se não souber, diga que não sabe e encaminhe pra Layane. Nunca invente.`;

const MODOS: Record<string, string> = {
  chef: `Modo Chef: a paciente diz os ingredientes que tem e você sugere UMA receita simples e saudável com eles (pode acrescentar temperos básicos, sal, alho, cebola, ervas, um fio de azeite). Formato: nome da receita em **negrito**, ingredientes em lista com medidas caseiras, modo de preparo em poucos passos. Lembre que a porção deve seguir as quantidades do plano dela.`,
  restaurante: `Modo Restaurante: a paciente manda fotos do cardápio (podem ser várias páginas; leia todas) ou escreve as opções, e diz o que quer priorizar, ou qual prato escolheu. Indique as 2 ou 3 melhores escolhas do próprio cardápio, explicando em uma linha cada (proteína, preparo, vegetais), diga o que é melhor evitar e um ajuste simples ("molho à parte", "troca a fritas por salada"). Se ela disser qual prato escolheu, foque nele.
Calorias: NÃO escreva números de calorias no texto. Em vez disso, preencha estimativas com cada prato indicado (e o escolhido, se houver): decomponha em componentes simples (peixe assado, arroz branco, feijão, farofa, batata...) com gramas_estimados por pessoa, usando o peso e o "serve N pessoas" do cardápio quando houver. O app calcula pela tabela TACO e mostra junto da tua resposta. No texto, pode dizer que a estimativa por pessoa aparece logo abaixo.
Porções por pessoa realistas: 1 fatia de queijo ≈ 20 g, 1 fatia de presunto ≈ 15 g, pão francês ≈ 50 g, filé de peixe ou carne de restaurante 120 a 200 g, colher de servir de arroz ≈ 45 g.
Se a foto for de comida já servida (o prato ou lanche que ela vai comer, e não um cardápio), marque foto_e_refeicao = true e escreva só uma frase curta: o app vai registrar a refeição.
Se não tiver foto nem opções, peça a foto do cardápio.`,
  mercado: `Modo Mercado: a paciente manda a foto do rótulo (tabela nutricional e ingredientes) ou pergunta como escolher um produto. Leia o que está na foto e comente de forma objetiva: proteína e fibras por porção, açúcar adicionado, sódio, gordura saturada, lupa frontal, ordem dos ingredientes, tamanho da porção. Compare com uma opção mais simples quando fizer sentido. Suplementos (whey, creatina, colágeno, cápsulas etc.): pode ler o rótulo e explicar de forma objetiva o que ele mostra, por exemplo, no whey, proteína por dose (scoop) e a proporção de proteína na dose (24 g em 30 g = 80%), se é concentrado, isolado ou hidrolisado, carboidratos e açúcares, gorduras, sódio, adoçantes, aromatizantes, espessantes e a ordem dos ingredientes. Se mandar dois rótulos, pode mostrar as diferenças lado a lado. NUNCA diga qual usar, qual é melhor, se ela deve usar, quanto, quando ou por quanto tempo, nem dê nota ou ranking: termine dizendo que a escolha e o uso é com a Layane, no plano dela, e marque encaminhar_layane = true. Se a foto estiver ilegível, peça outra.`,
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

  let entrada: { texto?: string; imagem?: string; imagens?: string[]; modo?: string; mensagens?: { papel: string; texto: string }[]; anterior?: string };
  try { entrada = await req.json(); } catch { return resposta({ erro: "JSON inválido" }, 400, origem); }
  const texto = (entrada.texto ?? "").slice(0, 1000).trim();
  // até 4 fotos por mensagem (ex.: cardápio de várias páginas)
  const imagens = (Array.isArray(entrada.imagens) ? entrada.imagens : entrada.imagem ? [entrada.imagem] : []).slice(0, 4);
  if (!texto && !imagens.length) return resposta({ erro: "envie texto ou imagem" }, 400, origem);
  const modo = entrada.modo && entrada.modo !== "prato" ? entrada.modo : null;
  if (modo && !MODOS[modo]) return resposta({ erro: "modo inválido" }, 400, origem);

  const conteudo: Anthropic.ContentBlockParam[] = [];
  for (const imagem of imagens) {
    const m = String(imagem).match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
    if (!m || m[2].length > 5_000_000) return resposta({ erro: "imagem inválida ou grande demais" }, 400, origem);
    conteudo.push({ type: "image", source: { type: "base64", media_type: m[1] as "image/jpeg", data: m[2] } });
  }
  // no "Meu prato", a refeição já registrada e as últimas falas da paciente entram como contexto (pra entender correções)
  const anterior = !modo ? String(entrada.anterior ?? "").slice(0, 2000).trim() : "";
  const falas = !modo ? (entrada.mensagens ?? []).filter((m) => m.papel !== "ia").slice(-4).map((m) => String(m.texto ?? "").slice(0, 300).trim()).filter(Boolean) : [];
  const contexto = anterior ? `Refeição já registrada nesta conversa:\n${anterior}\n` + (falas.length ? `Mensagens anteriores da paciente: ${falas.map((f) => `"${f}"`).join(" | ")}\n` : "") + "\nMensagem atual: " : "";
  conteudo.push({ type: "text", text: contexto + (texto || (modo ? "Analise a foto." : "Liste os alimentos da foto.")) });

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
        model: MODELO_CONVERSA,
        max_tokens: 8000,
        system: VOZ + "\n\n" + MODOS[modo],
        output_config: { effort: "low", format: zodOutputFormat(Conversa) },
        messages: [...anteriores, { role: "user", content: conteudo }],
      });
      if (r.stop_reason === "refusal") return resposta({ erro: "recusado" }, 422, origem);
      if (!r.parsed_output) return resposta({ erro: "resposta fora do formato" }, 502, origem);
      if (modo !== "restaurante") { r.parsed_output.estimativas = []; r.parsed_output.foto_e_refeicao = false; }
      return resposta({ ...r.parsed_output, modelo: r.model, uso: r.usage }, 200, origem);
    }

    const r = await client.messages.parse({
      model: MODELO_PRATO,
      max_tokens: 8000,
      system: INSTRUCOES,
      // foto ou correção pedem mais raciocínio; frase simples segue rápida e barata
      output_config: { effort: imagens.length || anterior ? "medium" : "low", format: zodOutputFormat(Saida) },
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
