const Chat = require('../models/Chat');
const { chatCompletion } = require('../services/openrouter.service');

const CHAT_LIMIT = 30;

/** Garante que o usuário não tenha mais de 30 conversas */
async function enforceLimit(usuarioId) {
  const count = await Chat.countDocuments({ usuarioId });
  if (count > CHAT_LIMIT) {
    const oldest = await Chat.find({ usuarioId }).sort({ createdAt: 1 }).limit(count - CHAT_LIMIT).select('_id');
    await Chat.deleteMany({ _id: { $in: oldest.map(c => c._id) } });
  }
}

// POST /api/chat — Envia mensagem e recebe resposta da IA
exports.sendMessage = async (req, res) => {
  try {
    const { mensagem, chatId } = req.body;
    if (!mensagem || typeof mensagem !== 'string') {
      return res.status(400).json({ error: 'Campo "mensagem" é obrigatório.' });
    }

    let chat;
    if (chatId) {
      chat = await Chat.findOne({ _id: chatId, usuarioId: req.userId });
      if (!chat) return res.status(404).json({ error: 'Conversa não encontrada.' });
    } else {
      // Nova conversa
      const titulo = mensagem.substring(0, 60) + (mensagem.length > 60 ? '...' : '');
      chat = await Chat.create({ usuarioId: req.userId, titulo, tipo: 'chat', mensagens: [] });
      await enforceLimit(req.userId);
    }

    // Adiciona mensagem do usuário
    chat.mensagens.push({ role: 'user', content: mensagem });

    // Prepara histórico para a IA (últimas 20 mensagens para contexto)
    const historySlice = chat.mensagens.slice(-20).map(m => ({ role: m.role, content: m.content }));

    // Chama OpenRouter
    const resposta = await chatCompletion(historySlice);

    // Adiciona resposta
    chat.mensagens.push({ role: 'assistant', content: resposta });
    await chat.save();

    res.json({ chatId: chat._id, resposta, titulo: chat.titulo });
  } catch (error) {
    console.error('[chat.sendMessage]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao processar mensagem.' });
  }
};

// GET /api/chat — Lista conversas do usuário
exports.listChats = async (req, res) => {
  try {
    const chats = await Chat.find({ usuarioId: req.userId })
      .sort({ updatedAt: -1 })
      .select('titulo tipo createdAt updatedAt')
      .limit(CHAT_LIMIT);
    res.json(chats);
  } catch (error) {
    console.error('[chat.listChats]', error);
    res.status(500).json({ error: 'Erro ao buscar conversas.' });
  }
};

// GET /api/chat/:id — Detalhes de uma conversa
exports.getChat = async (req, res) => {
  try {
    const chat = await Chat.findOne({ _id: req.params.id, usuarioId: req.userId });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada.' });
    res.json(chat);
  } catch (error) {
    console.error('[chat.getChat]', error);
    res.status(500).json({ error: 'Erro ao buscar conversa.' });
  }
};

// DELETE /api/chat/:id — Deleta uma conversa
exports.deleteChat = async (req, res) => {
  try {
    await Chat.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Conversa excluída.' });
  } catch (error) {
    console.error('[chat.deleteChat]', error);
    res.status(500).json({ error: 'Erro ao excluir conversa.' });
  }
};

// POST /api/chat/exercise — Gera questão estilo ENEM
exports.generateExercise = async (req, res) => {
  try {
    const { materia, assunto } = req.body;
    if (!materia) return res.status(400).json({ error: 'Campo "materia" é obrigatório.' });

    const prompt = `Gere uma questão no estilo ENEM sobre ${materia}${assunto ? ` (assunto: ${assunto})` : ''}.

A questão DEVE seguir este formato EXATO:

**CONTEXTO:** [texto motivador relevante]

**ENUNCIADO:** [pergunta clara]

**A)** [alternativa]
**B)** [alternativa]
**C)** [alternativa]
**D)** [alternativa]
**E)** [alternativa]

**RESPOSTA CORRETA:** [letra]

**EXPLICAÇÃO:** [explicação detalhada do porquê a resposta está correta e as demais estão erradas]

**DICA ENEM:** [dica prática para o aluno]`;

    const systemPrompt = 'Você é um elaborador de questões do ENEM. Crie questões com contexto, 5 alternativas (A-E), resposta correta e explicação detalhada. Siga o formato solicitado com precisão.';
    const resposta = await chatCompletion([{ role: 'user', content: prompt }], systemPrompt);

    // Salvar no histórico
    const titulo = `Exercício: ${materia}${assunto ? ' - ' + assunto : ''}`;
    const chat = await Chat.create({
      usuarioId: req.userId,
      titulo,
      tipo: 'exercicio',
      mensagens: [
        { role: 'user', content: `Gerar questão ENEM: ${materia}${assunto ? ' - ' + assunto : ''}` },
        { role: 'assistant', content: resposta },
      ],
    });
    await enforceLimit(req.userId);

    res.json({ chatId: chat._id, resposta });
  } catch (error) {
    console.error('[chat.generateExercise]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar exercício.' });
  }
};
