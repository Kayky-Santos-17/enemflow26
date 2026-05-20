const Content = require('../models/Content');

const SYSTEM_PROMPT = `Você é o EnemFlow AI, um professor particular inteligente, didático e encorajador.

Seu objetivo é ajudar estudantes a aprender e se preparar para o ENEM e para a vida acadêmica em geral.

ESCOPO DE ATUAÇÃO:
- Responda a qualquer dúvida de cunho educacional, pedagógico ou acadêmico: matemática, física, química, biologia, história, geografia, português, literatura, filosofia, sociologia, artes, inglês, redação, raciocínio lógico, atualidades, ciências, etc.
- Explique teoremas, fórmulas, conceitos, biografias históricas, fenômenos científicos, obras literárias, eventos históricos e tudo que um professor ensinaria em sala de aula.
- Ajude com resumos, exercícios, simulados, redações, mapas mentais e técnicas de estudo.
- Responda perguntas de cultura geral que tenham valor educacional.
- Seja sempre claro, objetivo, encorajador e use formatação markdown quando útil.

O QUE NÃO RESPONDER (recuse apenas isso):
- Instruções para atividades ilegais (fabricar drogas, armas, crimes, hacks maliciosos).
- Conteúdo sexual ou violento explícito.
- Conversas completamente alheias ao aprendizado, como pedir receitas culinárias, fofocas de famosos, jogadas de apostas ou entretenimento puro sem valor educacional.

Quando precisar recusar, seja gentil e redirecione o aluno: explique brevemente por que não pode ajudar com aquilo e sugira um tema educacional relacionado se possível.`;

/**
 * Filtro local — bloqueia apenas pedidos claramente ilegais ou sem qualquer valor educacional.
 * Não bloqueia termos científicos, históricos ou pedagógicos.
 */
function isOffTopic(messageText) {
  const text = messageText.toLowerCase().trim();
  const blockedPhrases = [
    'fabricar bomba', 'bomba caseira', 'como fazer bomba',
    'hackear conta', 'invadir sistema', 'roubar senha',
    'como fazer drogas', 'fabricar drogas', 'como usar drogas',
    'conteúdo sexual', 'me manda nude',
    'como se matar', 'metodo de suicidio',
  ];
  return blockedPhrases.some(phrase => text.includes(phrase));
}

/**
 * Busca e compila contexto de materiais publicados relevantes
 */
async function getRelevantContentContext(messages) {
  try {
    const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
    if (!lastUserMsg) return '';

    const text = lastUserMsg.content.toLowerCase();
    
    // Busca todos os conteúdos ativos no banco
    const allContents = await Content.find({ ativo: true }).select('titulo materia assunto tipo textoExtraido url');
    if (!allContents || allContents.length === 0) return '';

    // Filtra materiais relevantes com base na mensagem do usuário
    const relevant = allContents.filter(c => {
      const titleMatch = c.titulo && text.includes(c.titulo.toLowerCase());
      const assuntoMatch = c.assunto && text.includes(c.assunto.toLowerCase());
      const materiaMatch = c.materia && text.includes(c.materia.toLowerCase());
      const textMatch = c.textoExtraido && text.split(' ').some(word => word.length > 4 && c.textoExtraido.toLowerCase().includes(word));
      
      return titleMatch || assuntoMatch || materiaMatch || textMatch;
    });

    if (relevant.length === 0) {
      // Se não houver correspondência exata, envia os títulos dos primeiros materiais disponíveis como referência
      const availableTitles = allContents.slice(0, 5).map(c => `- ${c.titulo} (${c.materia} - ${c.tipo})`).join('\n');
      return `\nMateriais de Estudo Ativos no Sistema:\n${availableTitles}\n`;
    }

    // Monta bloco de contexto prioritário para a IA
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

/**
 * Envia mensagens para o OpenRouter e retorna a resposta da IA.
 * @param {Array} messages - Array de {role, content}
 * @param {string} [systemOverride] - System prompt customizado (opcional)
 * @returns {Promise<string>} Texto da resposta
 */
async function chatCompletion(messages, systemOverride) {
  // Verifica se a última mensagem é off-topic
  const lastUserMsg = [...messages].reverse().find(m => m.role === 'user');
  if (lastUserMsg && isOffTopic(lastUserMsg.content)) {
    return "Posso ajudar apenas com conteúdos educacionais e temas relacionados ao ENEM.";
  }
  const apiKey = process.env.OPENROUTER_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_KEY não configurada no servidor.');
  }

  let systemContent = systemOverride || SYSTEM_PROMPT;

  // Integra contexto de materiais da base de dados
  const dbContext = await getRelevantContentContext(messages);
  if (dbContext) {
    systemContent += `\n\n${dbContext}`;
  }

  const systemMsg = { role: 'system', content: systemContent };

  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': process.env.FRONTEND_URL || 'https://enemflow.vercel.app',
      'X-Title': 'EnemFlow AI',
    },
    body: JSON.stringify({
      model: process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-nano',
      messages: [systemMsg, ...messages],
      max_tokens: 2048,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    console.error('[OpenRouter Error]', err);
    throw new Error(err?.error?.message || 'Erro ao comunicar com a IA.');
  }

  const data = await response.json();
  return data.choices?.[0]?.message?.content || 'Sem resposta da IA.';
}

module.exports = { chatCompletion, SYSTEM_PROMPT };
