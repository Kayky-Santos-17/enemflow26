const Summary = require('../models/Summary');
const Chat = require('../models/Chat');
const { chatCompletion } = require('../services/openrouter.service');

// POST /api/summary — Gera resumo a partir de texto
exports.generate = async (req, res) => {
  try {
    const { texto, fonte } = req.body;
    if (!texto || typeof texto !== 'string' || texto.trim().length < 20) {
      return res.status(400).json({ error: 'Envie um texto com pelo menos 20 caracteres para resumir.' });
    }

    const prompt = `Crie um resumo inteligente e didático do seguinte conteúdo para estudo do ENEM:

---
${texto.substring(0, 8000)}
---

O resumo deve:
1. Destacar os pontos mais importantes
2. Usar tópicos e subtópicos organizados
3. Incluir palavras-chave em negrito
4. Adicionar dicas de como esse conteúdo pode cair no ENEM
5. Criar um mini questionário com 3 perguntas rápidas ao final
6. Ser conciso mas completo`;

    const systemPrompt = 'Você é um especialista em resumos acadêmicos para o ENEM. Crie resumos claros, organizados e estratégicos usando formatação markdown.';
    const conteudo = await chatCompletion([{ role: 'user', content: prompt }], systemPrompt);

    const summary = await Summary.create({
      usuarioId: req.userId,
      titulo: `Resumo: ${texto.substring(0, 50)}...`,
      textoOriginal: texto.substring(0, 2000),
      conteudo,
      fonte: fonte || 'texto',
    });

    // Salvar também no histórico de chat
    await Chat.create({
      usuarioId: req.userId,
      titulo: summary.titulo,
      tipo: 'resumo',
      mensagens: [
        { role: 'user', content: `Resumir: ${texto.substring(0, 200)}...` },
        { role: 'assistant', content: conteudo },
      ],
    });

    res.json({ summaryId: summary._id, conteudo });
  } catch (error) {
    console.error('[summary.generate]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar resumo.' });
  }
};

// GET /api/summary — Lista resumos
exports.list = async (req, res) => {
  try {
    const summaries = await Summary.find({ usuarioId: req.userId })
      .sort({ createdAt: -1 }).limit(20)
      .select('titulo fonte createdAt');
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar resumos.' });
  }
};

// GET /api/summary/:id
exports.getById = async (req, res) => {
  try {
    const summary = await Summary.findOne({ _id: req.params.id, usuarioId: req.userId });
    if (!summary) return res.status(404).json({ error: 'Resumo não encontrado.' });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar resumo.' });
  }
};

// DELETE /api/summary/:id
exports.remove = async (req, res) => {
  try {
    await Summary.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Resumo excluído.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir resumo.' });
  }
};
