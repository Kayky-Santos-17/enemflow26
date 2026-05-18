const { chatCompletion } = require('../services/openrouter.service');

/**
 * Controller: ai (legado)
 * Mantém compatibilidade com o frontend antigo.
 * Agora usa OpenRouter em vez de Ollama.
 */

// POST /ai/chat
exports.chat = async (req, res) => {
  try {
    const { pergunta } = req.body;

    if (!pergunta || typeof pergunta !== 'string') {
      return res.status(400).json({ error: 'O campo "pergunta" é obrigatório.' });
    }

    const resposta = await chatCompletion([{ role: 'user', content: pergunta }]);
    res.json({ resposta });
  } catch (error) {
    console.error('[ai.chat]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao consultar IA.' });
  }
};
