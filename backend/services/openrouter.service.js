const SYSTEM_PROMPT = `Você é um professor especialista em ENEM chamado EnemFlow AI.

Você tem foco EXCLUSIVO em conteúdos acadêmicos, disciplinas escolares, temas do ENEM, simulados, resoluções de exercícios, dúvidas e redação.

REGRAS DE ESCOPO E SEGURANÇA (CRÍTICAS):
- Você só pode responder a dúvidas educacionais, temas do ENEM, disciplinas escolares e material acadêmico.
- Se o aluno fizer perguntas sobre jogos, games, fofocas, piadas, trollagens, crimes, invasão de sistemas, assuntos ilícitos, ou qualquer conversa inútil fora de contexto educativo, você deve RECUSAR IMEDIATAMENTE respondendo EXATAMENTE a seguinte frase (e absolutamente nada mais):
"Posso ajudar apenas com conteúdos educacionais e temas relacionados ao ENEM."
- Seja objetivo, claro, encorajador e utilize formatação markdown quando útil.`;

/**
 * Filtro local para identificar mensagens fora do escopo educacional e retornar recusa imediatamente.
 */
function isOffTopic(messageText) {
  const text = messageText.toLowerCase().trim();
  const blockedPhrases = [
    'invadir', 'trollar', 'trollagem', 'hackear', 'hacker', 'crime', 'assalto', 'gossip',
    'fofoca', 'jogo', 'game', 'playstation', 'xbox', 'trollar meu amigo', 'roubar', 'crackear',
    'pirataria', 'futebol', 'celebridade', 'famosos', 'namorada', 'namorado'
  ];
  return blockedPhrases.some(phrase => text.includes(phrase));
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

  const systemMsg = { role: 'system', content: systemOverride || SYSTEM_PROMPT };

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
