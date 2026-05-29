const Content = require('../models/Content');
const { getPrompt } = require('./prompt.service');
const { buildContentContext } = require('./contentChunk.service');

const SYSTEM_PROMPT = getPrompt('tutor');

function isOffTopic(messageText) {
  const text = String(messageText || '').toLowerCase().trim();
  const blockedPhrases = [
    'fabricar bomba', 'bomba caseira', 'como fazer bomba',
    'hackear conta', 'invadir sistema', 'roubar senha',
    'como fazer drogas', 'fabricar drogas', 'como usar drogas',
    'conteudo sexual', 'me manda nude',
    'como se matar', 'metodo de suicidio', 'método de suicídio',
  ];
  const unrelatedRequests = [
    'receita de bolo', 'receita de comida', 'palpite de aposta', 'aposta esportiva',
    'fofoca', 'cantada', 'roteiro de filme', 'sinopse de filme',
    'melhor time', 'previsao do jogo', 'previsão do jogo',
  ];
  return blockedPhrases.some(phrase => text.includes(phrase)) ||
    unrelatedRequests.some(phrase => text.includes(phrase));
}

async function getRelevantContentContext(messages) {
  try {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return '';

    const text = String(lastUserMsg.content || '').toLowerCase();
    const allContents = await Content.find({ ativo: true })
      .select('titulo materia assunto tipo textoExtraido url')
      .limit(80)
      .lean();
    if (!allContents || allContents.length === 0) return '';

    const relevant = allContents.filter(c => {
      const titleMatch = c.titulo && text.includes(c.titulo.toLowerCase());
      const assuntoMatch = c.assunto && text.includes(c.assunto.toLowerCase());
      const materiaMatch = c.materia && text.includes(c.materia.toLowerCase());
      const textMatch = c.textoExtraido && text.split(' ').some(word => word.length > 4 && c.textoExtraido.toLowerCase().includes(word));
      return titleMatch || assuntoMatch || materiaMatch || textMatch;
    });

    if (relevant.length === 0) return '';

    let contextStr = '\n--- CONTEXTO DE MATERIAIS DE ESTUDO DA PLATAFORMA ---\n';
    contextStr += 'Use estes materiais como apoio quando forem relevantes. Se o texto estiver incompleto, sinalize isso.\n\n';

    for (const c of relevant.slice(0, 3)) {
      contextStr += `Material: "${c.titulo}" (${c.materia || 'Geral'} - ${c.tipo || 'material'})\n`;
      if (c.url && !c.url.startsWith('data:')) contextStr += `URL de referencia: ${c.url}\n`;
      const chunkContext = await buildContentContext(c._id, text, c.textoExtraido || '', {
        maxChunks: 2,
        fallbackChars: 2800,
      });
      if (chunkContext) {
        contextStr += `Conteudo extraido:\n${chunkContext}\n`;
      }
      contextStr += '\n';
    }
    contextStr += '-----------------------------------------------------\n';
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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function shouldRetry(status) {
  return [408, 409, 425, 429, 500, 502, 503, 504].includes(status);
}

async function chatCompletion(messages, systemOverride, options = {}) {
  const compactedMessages = compactMessages(messages, options.maxHistoryChars || 12000, options.maxMessageChars || 3500);
  const lastUserMsg = [...compactedMessages].reverse().find(m => m.role === 'user');
  if (lastUserMsg && isOffTopic(lastUserMsg.content)) {
    return 'Posso ajudar apenas com conteudos educacionais e temas relacionados ao ENEM.';
  }

  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_KEY nao configurada no servidor.');
  }

  let systemContent = systemOverride || SYSTEM_PROMPT;
  if (!options.skipDbContext) {
    const dbContext = await getRelevantContentContext(compactedMessages);
    if (dbContext) systemContent += `\n\n${dbContext}`;
  }

  const timeoutMs = Number(process.env.OPENROUTER_TIMEOUT_MS) || 45000;
  const retries = Math.max(0, Math.min(Number(options.retries ?? 2), 3));
  const requestBody = {
    model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano',
    messages: [{ role: 'system', content: systemContent }, ...compactedMessages],
    max_tokens: options.maxTokens || 2048,
    temperature: options.temperature ?? 0.7,
  };

  if (options.responseFormat === 'json') {
    requestBody.response_format = { type: 'json_object' };
  }

  let lastError;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://enemflow26.vercel.app',
          'X-Title': 'EnemFlow AI',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const message = err?.error?.message || 'Erro ao comunicar com a IA.';
        lastError = new Error(message);
        lastError.statusCode = response.status;
        console.error('[OpenRouter Error]', { status: response.status, message });

        if (attempt < retries && shouldRetry(response.status)) {
          await sleep(650 * (attempt + 1));
          continue;
        }

        throw lastError;
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content || typeof content !== 'string') {
        throw new Error('A IA retornou uma resposta vazia.');
      }

      return content;
    } catch (error) {
      if (error.name === 'AbortError') {
        lastError = new Error('A IA demorou mais que o esperado. Tente novamente em alguns instantes.');
      } else {
        lastError = error;
      }

      if (attempt < retries) {
        await sleep(650 * (attempt + 1));
        continue;
      }

      throw lastError;
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Erro ao comunicar com a IA.');
}

module.exports = { chatCompletion, SYSTEM_PROMPT, compactMessages };
