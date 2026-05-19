const Content = require('../models/Content');

const SYSTEM_PROMPT = `Você é um professor especialista em ENEM chamado EnemFlow AI.

Você tem foco EXCLUSIVO em conteúdos acadêmicos, disciplinas escolares, temas do ENEM, simulados, resoluções de exercícios, dúvidas e redação.

REGRAS DE ESCOPO E SEGURANÇA (CRÍTICAS):
- Você só pode responder a dúvidas educacionais, temas do ENEM, disciplinas escolares e material acadêmico.
- Se o aluno fizer qualquer pergunta sobre tópicos não educacionais (exemplos: receitas culinárias, futebol, jogos/games, fofocas de famosos, namoro, relacionamentos, piadas, trollagens, memes) ou tópicos ilícitos (exemplos: crimes, drogas, hacks, invasão de sistemas, pirataria, armas, violência, automutilação, fabricação de substâncias perigosas), ou qualquer conversa inútil e sem relação acadêmica direta, você deve recusar imediatamente respondendo EXATAMENTE e APENAS a seguinte frase:
"Posso ajudar apenas com conteúdos educacionais e temas relacionados ao ENEM."
- Não dê explicações adicionais, não peça desculpas, não tente justificar. Apenas retorne a frase exata acima.
- Seja objetivo, claro, encorajador e utilize formatação markdown quando útil nas suas respostas educacionais.`;

/**
 * Filtro local para identificar mensagens fora do escopo educacional e retornar recusa imediatamente.
 */
function isOffTopic(messageText) {
  const text = messageText.toLowerCase().trim();
  const blockedPhrases = [
    'invadir', 'trollar', 'trollagem', 'hackear', 'hacker', 'crime', 'assalto', 'gossip',
    'fofoca', 'jogo', 'game', 'playstation', 'xbox', 'trollar meu amigo', 'roubar', 'crackear',
    'pirataria', 'futebol', 'celebridade', 'famosos', 'namorada', 'namorado', 'receita de',
    'comédia', 'piadinha', 'minecraft', 'gta v', 'free fire', 'fortnite', 'league of legends',
    'valorant', 'counter strike', 'roblox', 'bomba caseira', 'fabricar bomba', 'suicidio', 'drogas'
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
      if (c.url) contextStr += `URL de Referência: ${c.url}\n`;
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
