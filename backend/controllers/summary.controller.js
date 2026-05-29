const mongoose = require('mongoose');
const Summary = require('../models/Summary');
const { createChatWithMessages } = require('../services/chatMessage.service');
const { chatCompletion } = require('../services/openrouter.service');
const { getPrompt } = require('../services/prompt.service');

exports.generate = async (req, res) => {
  try {
    const { texto, fonte } = req.body;
    if (!texto || typeof texto !== 'string' || texto.trim().length < 20) {
      return res.status(400).json({ error: 'Envie um texto com pelo menos 20 caracteres para resumir.' });
    }

    const safeText = texto.trim().slice(0, 8000);
    const prompt = `Crie um resumo inteligente e didatico do seguinte conteudo para estudo do ENEM:

---
${safeText}
---

O resumo deve:
1. Destacar os pontos mais importantes
2. Usar topicos e subtitulos organizados
3. Incluir palavras-chave em negrito
4. Adicionar dicas de como esse conteudo pode cair no ENEM
5. Criar um mini questionario com 3 perguntas rapidas ao final
6. Ser conciso mas completo`;

    const conteudo = await chatCompletion([{ role: 'user', content: prompt }], getPrompt('summary'), {
      maxHistoryChars: 9000,
      maxMessageChars: 8000,
    });

    const summary = await Summary.create({
      usuarioId: req.userId,
      titulo: `Resumo: ${safeText.substring(0, 50)}...`,
      textoOriginal: safeText.substring(0, 2000),
      conteudo,
      fonte: fonte || 'texto',
    });

    await createChatWithMessages({
      usuarioId: req.userId,
      titulo: summary.titulo,
      tipo: 'resumo',
      mensagens: [
        { role: 'user', content: `Resumir: ${safeText.substring(0, 200)}...` },
        { role: 'assistant', content: conteudo },
      ],
    });

    res.json({ summaryId: summary._id, conteudo });
  } catch (error) {
    console.error('[summary.generate]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar resumo.' });
  }
};

exports.list = async (req, res) => {
  try {
    const summaries = await Summary.find({ usuarioId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('titulo fonte createdAt')
      .lean();
    res.json(summaries);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar resumos.' });
  }
};

exports.getById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Resumo invalido.' });
    }
    const summary = await Summary.findOne({ _id: req.params.id, usuarioId: req.userId }).lean();
    if (!summary) return res.status(404).json({ error: 'Resumo nao encontrado.' });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar resumo.' });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Resumo invalido.' });
    }
    await Summary.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Resumo excluido.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir resumo.' });
  }
};
