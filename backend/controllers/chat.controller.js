const Chat = require('../models/Chat');
const Content = require('../models/Content');
const mongoose = require('mongoose');
const { chatCompletion } = require('../services/openrouter.service');

const CHAT_LIMIT = 30;
const VALID_LETTERS = ['A', 'B', 'C', 'D', 'E'];

/** Garante que o usuário não tenha mais de 30 conversas */
async function enforceLimit(usuarioId) {
  const count = await Chat.countDocuments({ usuarioId });
  if (count > CHAT_LIMIT) {
    const oldest = await Chat.find({ usuarioId }).sort({ createdAt: 1 }).limit(count - CHAT_LIMIT).select('_id');
    await Chat.deleteMany({ _id: { $in: oldest.map(c => c._id) } });
  }
}

function extractJsonObject(text) {
  if (!text || typeof text !== 'string') return null;
  const cleaned = text
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;

  try {
    return JSON.parse(cleaned.slice(start, end + 1));
  } catch (error) {
    return null;
  }
}

function normalizeQuestion(question, index, materia, assunto) {
  const alternativas = Array.isArray(question.alternativas)
    ? question.alternativas
    : [];

  const normalizedAlternativas = VALID_LETTERS.map((letter, idx) => {
    const found = alternativas.find(alt => String(alt.letra || '').toUpperCase() === letter) || alternativas[idx] || {};
    return {
      letra: letter,
      texto: String(found.texto || found.content || '').trim()
    };
  });

  const respostaCorreta = String(question.respostaCorreta || question.gabarito || '').trim().toUpperCase();

  return {
    id: index + 1,
    materia,
    assunto: assunto || question.assunto || 'Geral',
    contexto: String(question.contexto || '').trim(),
    enunciado: String(question.enunciado || '').trim(),
    alternativas: normalizedAlternativas,
    respostaCorreta: VALID_LETTERS.includes(respostaCorreta) ? respostaCorreta : 'A',
    resolucao: String(question.resolucao || question.explicacao || '').trim(),
    habilidade: String(question.habilidade || '').trim(),
    dificuldade: String(question.dificuldade || 'Média').trim()
  };
}

function validateSimuladoPayload(payload, quantidade, materia, assunto) {
  if (!payload || !Array.isArray(payload.questoes)) {
    throw new Error('A IA retornou um simulado em formato inválido.');
  }

  const questoes = payload.questoes
    .slice(0, quantidade)
    .map((question, index) => normalizeQuestion(question, index, materia, assunto));

  if (questoes.length !== quantidade) {
    throw new Error('A IA retornou uma quantidade inesperada de questões.');
  }

  const invalidQuestion = questoes.find(question =>
    !question.contexto ||
    !question.enunciado ||
    question.alternativas.length !== 5 ||
    question.alternativas.some(alt => !alt.texto) ||
    !VALID_LETTERS.includes(question.respostaCorreta) ||
    !question.resolucao
  );

  if (invalidQuestion) {
    throw new Error('A IA retornou questões incompletas. Tente gerar novamente.');
  }

  return {
    titulo: String(payload.titulo || `Simulado EnemFlow - ${materia}`).trim(),
    materia,
    assunto: assunto || 'Geral',
    instrucoes: String(payload.instrucoes || 'Leia cada questão com atenção e marque apenas uma alternativa.').trim(),
    questoes
  };
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

// POST /api/chat/simulado — Gera um simulado completo estruturado
exports.generateSimulado = async (req, res) => {
  try {
    const { materia, assunto, quantidade } = req.body;
    if (!materia) return res.status(400).json({ error: 'Campo "materia" é obrigatório.' });

    const safeQuantidade = Math.max(3, Math.min(parseInt(quantidade, 10) || 5, 12));
    const tema = assunto ? `${materia} - ${assunto}` : materia;

    const prompt = `Crie um simulado completo do ENEM sobre: ${tema}.

Regras obrigatórias:
- Gere exatamente ${safeQuantidade} questões.
- Cada questão deve ter contexto, enunciado, cinco alternativas plausíveis e apenas uma resposta correta.
- Evite fatos inventados, datas duvidosas, números sem necessidade e fontes inexistentes.
- Quando houver cálculo, confira a conta antes de responder.
- As alternativas incorretas devem ser plausíveis, mas claramente refutáveis pela resolução.
- Use linguagem de prova, sem mencionar IA, modelo, prompt ou algoritmo.
- Não inclua markdown. Não inclua comentários fora do JSON.

Retorne somente um JSON válido no formato:
{
  "titulo": "Simulado EnemFlow - ${tema}",
  "instrucoes": "texto curto",
  "questoes": [
    {
      "contexto": "texto motivador",
      "enunciado": "pergunta",
      "alternativas": [
        { "letra": "A", "texto": "alternativa" },
        { "letra": "B", "texto": "alternativa" },
        { "letra": "C", "texto": "alternativa" },
        { "letra": "D", "texto": "alternativa" },
        { "letra": "E", "texto": "alternativa" }
      ],
      "respostaCorreta": "A",
      "resolucao": "explicação objetiva e conferida",
      "habilidade": "tema/habilidade em linguagem simples",
      "dificuldade": "Fácil | Média | Difícil"
    }
  ]
}`;

    const systemPrompt = `Você é um elaborador sênior de simulados do ENEM e revisor pedagógico.
Sua prioridade é precisão, coerência e formato estruturado.
Antes de responder, faça uma revisão silenciosa:
1. há exatamente cinco alternativas por questão;
2. só existe uma alternativa correta;
3. a resposta correta bate com a resolução;
4. não há afirmações factuais duvidosas;
5. o JSON é válido.
Responda somente o JSON final.`;

    const raw = await chatCompletion([{ role: 'user', content: prompt }], systemPrompt);
    const parsed = extractJsonObject(raw);
    const simulado = validateSimuladoPayload(parsed, safeQuantidade, materia, assunto);

    const chat = await Chat.create({
      usuarioId: req.userId,
      titulo: simulado.titulo,
      tipo: 'exercicio',
      mensagens: [
        { role: 'user', content: `Gerar simulado ENEM: ${tema}` },
        { role: 'assistant', content: JSON.stringify(simulado) },
      ],
    });
    await enforceLimit(req.userId);

    res.json({ chatId: chat._id, simulado });
  } catch (error) {
    console.error('[chat.generateSimulado]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar simulado.' });
  }
};

// POST /api/chat/content-context — inicia conversa usando o texto extraido de um material
exports.startContentContextChat = async (req, res) => {
  try {
    const { contentId, pergunta } = req.body;
    if (!contentId) {
      return res.status(400).json({ error: 'Campo "contentId" é obrigatório.' });
    }
    if (!mongoose.isValidObjectId(contentId)) {
      return res.status(400).json({ error: 'Material inválido.' });
    }

    const content = await Content.findById(contentId).select('titulo materia assunto tipo textoExtraido descricao ativo');
    if (!content || !content.ativo) {
      return res.status(404).json({ error: 'Material não encontrado.' });
    }

    const textoExtraido = String(content.textoExtraido || '').trim();
    if (!textoExtraido || textoExtraido.length < 40) {
      return res.status(400).json({
        error: 'Este material ainda não possui texto extraído suficiente para análise pela IA.'
      });
    }

    const safePergunta = String(pergunta || 'Analise este PDF e me ajude a estudar o conteúdo para o ENEM.').trim();
    const titulo = `PDF: ${content.titulo}`.slice(0, 80);
    const chat = await Chat.create({
      usuarioId: req.userId,
      titulo,
      tipo: 'chat',
      mensagens: [
        {
          role: 'user',
          content: `[Material: ${content.titulo}]\n\n${safePergunta}`
        }
      ],
    });
    await enforceLimit(req.userId);

    const systemOverride = `Você é o EnemFlow AI, tutor acadêmico especialista no ENEM.
O aluno abriu um material da plataforma e pediu ajuda sobre ele.

Use o conteúdo extraído abaixo como fonte principal. Se o texto estiver incompleto, diga isso claramente e complemente apenas com explicações educacionais seguras.

Material: ${content.titulo}
Matéria: ${content.materia || 'Geral'}
Assunto: ${content.assunto || 'Geral'}

Conteúdo extraído do PDF/material:
---
${textoExtraido.substring(0, 9000)}
---`;

    const resposta = await chatCompletion(
      [{ role: 'user', content: chat.mensagens[0].content }],
      systemOverride
    );

    chat.mensagens.push({ role: 'assistant', content: resposta });
    await chat.save();

    res.json({ chatId: chat._id, resposta, titulo: chat.titulo });
  } catch (error) {
    console.error('[chat.startContentContextChat]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar material.' });
  }
};

// DELETE /api/chat — Limpa todo o histórico de conversas do próprio estudante
exports.clearAllChats = async (req, res) => {
  try {
    await Chat.deleteMany({ usuarioId: req.userId });
    res.json({ message: 'Todas as suas conversas foram excluídas com sucesso.' });
  } catch (error) {
    console.error('[chat.clearAllChats]', error);
    res.status(500).json({ error: 'Erro ao excluir todas as conversas.' });
  }
};

