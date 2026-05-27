const Content = require('../models/Content');

const SYSTEM_PROMPT = `Você é o EnemFlow AI, um professor particular inteligente, didático e encorajador.

Seu objetivo é ajudar estudantes a aprender e se preparar para o ENEM e para a vida acadêmica em geral.

ESCOPO DE ATUAÇÃO:
- Responda a qualquer dúvida de cunho educacional, pedagógico ou acadêmico: matemática, física, química, biologia, história, geografia, português, literatura, filosofia, sociologia, artes, inglês, redação, raciocínio lógico, atualidades e ciências.
- Explique teoremas, fórmulas, conceitos, biografias históricas, fenômenos científicos, obras literárias, eventos históricos e tudo que um professor ensinaria em sala de aula.
- Ajude com resumos, exercícios, simulados, redações, mapas mentais e técnicas de estudo.
- Responda perguntas de cultura geral que tenham valor educacional.
- Seja sempre claro, objetivo, encorajador e use formatação markdown quando útil.

O QUE NÃO RESPONDER:
- Instruções para atividades ilegais, armas, crimes, invasões, roubo de senha ou hacks maliciosos.
- Conteúdo sexual ou violento explícito.
- Conversas completamente alheias ao aprendizado, como receitas culinárias, fofocas de famosos, apostas ou entretenimento puro sem valor educacional.

Quando precisar recusar, seja gentil e redirecione o aluno para um tema educacional relacionado.`;

function isOffTopic(messageText) {
  const text = String(messageText || '').toLowerCase().trim();
  const blockedPhrases = [
    'fabricar bomba', 'bomba caseira', 'como fazer bomba',
    'hackear conta', 'invadir sistema', 'roubar senha',
    'como fazer drogas', 'fabricar drogas', 'como usar drogas',
    'conteúdo sexual', 'conteudo sexual', 'me manda nude',
    'como se matar', 'metodo de suicidio', 'método de suicídio',
  ];
  return blockedPhrases.some(phrase => text.includes(phrase));
}

async function getRelevantContentContext(messages) {
  try {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return '';

    const text = String(lastUserMsg.content || '').toLowerCase();
    const allContents = await Content.find({ ativo: true }).select('titulo materia assunto tipo textoExtraido url');
    if (!allContents || allContents.length === 0) return '';

    const relevant = allContents.filter(c => {
      const titleMatch = c.titulo && text.includes(c.titulo.toLowerCase());
      const assuntoMatch = c.assunto && text.includes(c.assunto.toLowerCase());
      const materiaMatch = c.materia && text.includes(c.materia.toLowerCase());
      const textMatch = c.textoExtraido && text.split(' ').some(word => word.length > 4 && c.textoExtraido.toLowerCase().includes(word));
      return titleMatch || assuntoMatch || materiaMatch || textMatch;
    });

    if (relevant.length === 0) return '';

    let contextStr = '\n--- CONTEXTO DE MATERIAIS DE ESTUDO DA PLATAFORMA (PRIORIDADE MÁXIMA) ---\n';
    contextStr += 'O EnemFlow possui materiais didáticos sobre o assunto em questão. Baseie sua resposta preferencialmente nas informações abaixo:\n\n';

    relevant.slice(0, 3).forEach(c => {
      contextStr += `Material: "${c.titulo}" (${c.materia} - ${c.tipo})\n`;
      if (c.url && !c.url.startsWith('data:')) contextStr += `URL de Referência: ${c.url}\n`;
      if (c.textoExtraido) {
        contextStr += `Conteúdo do PDF/Artigo:\n${c.textoExtraido.substring(0, 3500)}\n`;
      }
      contextStr += '\n';
    });
    contextStr += '-------------------------------------------------------------------------\n';
    return contextStr;
  } catch (err) {
    console.error('[getRelevantContentContext] Erro ao recuperar contexto de materiais:', err);
    return '';
  }
}

function trimMessageContent(content, maxChars) {
  const text = String(content || '');
  if (text.length <= maxChars) return text;
  return `${text.slice(0, maxChars)}\n\n[conteudo truncado para preservar o contexto da conversa]`;
}

function compactMessages(messages, maxTotalChars = 12000, maxMessageChars = 3500) {
  const safeMessages = Array.isArray(messages) ? messages : [];
  const compacted = [];
  let used = 0;

  for (const message of [...safeMessages].reverse()) {
    const role = ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user';
    const content = trimMessageContent(message.content, maxMessageChars);
    if (!content.trim()) continue;
    if (used + content.length > maxTotalChars && compacted.length > 0) break;
    compacted.unshift({ role, content });
    used += content.length;
  }

  return compacted;
}

async function chatCompletion(messages, systemOverride, options = {}) {
  const compactedMessages = compactMessages(messages, options.maxHistoryChars || 12000, options.maxMessageChars || 3500);
  const lastUserMsg = [...compactedMessages].reverse().find(m => m.role === 'user');
  if (lastUserMsg && isOffTopic(lastUserMsg.content)) {
    return 'Posso ajudar apenas com conteúdos educacionais e temas relacionados ao ENEM.';
  }

  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_KEY não configurada no servidor.');
  }

  let systemContent = systemOverride || SYSTEM_PROMPT;
  if (!options.skipDbContext) {
    const dbContext = await getRelevantContentContext(compactedMessages);
    if (dbContext) systemContent += `\n\n${dbContext}`;
  }

  const controller = new AbortController();
  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS) || 45000;
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal: controller.signal,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://enemflow.vercel.app',
      'X-Title': 'EnemFlow AI',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano',
      messages: [{ role: 'system', content: systemContent }, ...compactedMessages],
      max_tokens: options.maxTokens || 2048,
      temperature: options.temperature ?? 0.7,
    }),
  }).catch(error => {
    if (error.name === 'AbortError') {
      throw new Error('A IA demorou mais que o esperado. Tente novamente em alguns instantes.');
    }
    throw error;
  }).finally(() => clearTimeout(timeout));

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('[OpenRouter Error]', err);
    throw new Error(err?.error?.message || 'Erro ao comunicar com a IA.');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sem resposta da IA.';
}

module.exports = { chatCompletion, SYSTEM_PROMPT };
