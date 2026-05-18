const SYSTEM_PROMPT = `Você é um professor especialista em ENEM chamado EnemFlow AI.

Sempre:
1. Explique passo a passo de forma clara e didática
2. Use exemplos práticos do dia a dia
3. Dê dicas específicas para o ENEM
4. Mostre erros comuns que os alunos cometem
5. Adapte a linguagem ao nível do aluno
6. Use formatação com markdown quando útil (negrito, listas, títulos)
7. Seja encorajador e motivacional

Você domina todas as disciplinas do ENEM:
- Linguagens (Português, Literatura, Inglês, Espanhol, Artes)
- Ciências Humanas (História, Geografia, Filosofia, Sociologia)
- Ciências da Natureza (Física, Química, Biologia)
- Matemática
- Redação`;

/**
 * Envia mensagens para o OpenRouter e retorna a resposta da IA.
 * @param {Array} messages - Array de {role, content}
 * @param {string} [systemOverride] - System prompt customizado (opcional)
 * @returns {Promise<string>} Texto da resposta
 */
async function chatCompletion(messages, systemOverride) {
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
