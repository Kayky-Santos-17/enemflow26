const Chat = require('../models/Chat');
const Content = require('../models/Content');
const mongoose = require('mongoose');
const { chatCompletion } = require('../services/openrouter.service');
const { getPrompt } = require('../services/prompt.service');
const { withRequestLock } = require('../utils/requestLock');

const CHAT_LIMIT = 30;
const MESSAGE_LIMIT = 60;
const MAX_USER_MESSAGE_CHARS = 4000;
const VALID_LETTERS = ['A', 'B', 'C', 'D', 'E'];
const VALID_DIFFICULTIES = ['facil', 'media', 'dificil'];
const STOPWORDS = new Set([
  'a', 'o', 'as', 'os', 'um', 'uma', 'de', 'da', 'do', 'das', 'dos', 'em', 'no', 'na', 'nos', 'nas',
  'para', 'por', 'com', 'sem', 'sobre', 'entre', 'tema', 'assunto', 'enem', 'questao', 'questoes',
  'simulado', 'materia', 'disciplina', 'geral'
]);
const TOPIC_KEYWORDS = {
  geometria: ['geometria', 'geometrico', 'geometrica', 'area', 'perimetro', 'volume', 'angulo', 'triangulo', 'quadrado', 'retangulo', 'circulo', 'circunferencia', 'poligono', 'plano cartesiano', 'semelhanca'],
  algebra: ['algebra', 'equacao', 'funcao', 'inequacao', 'sistema', 'polinomio', 'raiz', 'coeficiente'],
  estatistica: ['estatistica', 'media', 'mediana', 'moda', 'probabilidade', 'grafico', 'tabela', 'amostra'],
  termodinamica: ['termodinamica', 'calor', 'temperatura', 'energia interna', 'gas', 'pressao', 'volume'],
  'era vargas': ['era vargas', 'getulio', 'estado novo', 'trabalhismo', 'clt', 'industrializacao'],
  redacao: ['redacao', 'tese', 'argumento', 'intervencao', 'competencia', 'dissertativo']
};
const AREA_BY_MATERIA = {
  matematica: 'Matematica e suas Tecnologias',
  fisica: 'Ciencias da Natureza e suas Tecnologias',
  quimica: 'Ciencias da Natureza e suas Tecnologias',
  biologia: 'Ciencias da Natureza e suas Tecnologias',
  historia: 'Ciencias Humanas e suas Tecnologias',
  geografia: 'Ciencias Humanas e suas Tecnologias',
  filosofia: 'Ciencias Humanas e suas Tecnologias',
  sociologia: 'Ciencias Humanas e suas Tecnologias',
  literatura: 'Linguagens, Codigos e suas Tecnologias',
  portugues: 'Linguagens, Codigos e suas Tecnologias',
  artes: 'Linguagens, Codigos e suas Tecnologias',
  ingles: 'Linguagens, Codigos e suas Tecnologias',
  espanhol: 'Linguagens, Codigos e suas Tecnologias',
  redacao: 'Redacao'
};

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

function buildHttpError(message, statusCode = 400, details) {
  const err = new Error(message);
  err.statusCode = statusCode;
  if (details) err.details = details;
  return err;
}

function sanitizeUserText(value, maxChars = MAX_USER_MESSAGE_CHARS) {
  const text = String(value || '').replace(/\u0000/g, '').trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

function capChatMessages(chat) {
  if (chat.mensagens.length > MESSAGE_LIMIT) {
    chat.mensagens = chat.mensagens.slice(-MESSAGE_LIMIT);
  }
}

function buildSimuladoQuantityError(expected, received, details) {
  const err = new Error(`A IA retornou ${received} questoes, mas o simulado solicitou ${expected}. Tente novamente ou reduza a quantidade.`);
  err.statusCode = 422;
  err.details = { expected, received, ...(details || {}) };
  return err;
}

function stripDiacritics(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

function tokenize(value) {
  return stripDiacritics(value)
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));
}

function uniqueTokens(values) {
  return [...new Set(values.flatMap(tokenize))];
}

function getTopicKeywords(materia, assunto) {
  const normalizedAssunto = stripDiacritics(assunto);
  const exact = TOPIC_KEYWORDS[normalizedAssunto] || [];
  const partial = Object.entries(TOPIC_KEYWORDS)
    .filter(([key]) => normalizedAssunto && (normalizedAssunto.includes(key) || key.includes(normalizedAssunto)))
    .flatMap(([, keywords]) => keywords);
  return uniqueTokens([materia, assunto, ...exact, ...partial]);
}

function getAreaFromMateria(materia) {
  return AREA_BY_MATERIA[stripDiacritics(materia)] || 'Area do ENEM';
}

function normalizeDifficulty(value) {
  const normalized = stripDiacritics(value || 'media');
  if (VALID_DIFFICULTIES.includes(normalized)) return normalized;
  if (normalized.includes('fac')) return 'facil';
  if (normalized.includes('dif')) return 'dificil';
  return 'media';
}

function questionSearchText(question) {
  return [
    question.contexto,
    question.textoMotivador,
    question.enunciado,
    question.pergunta,
    question.resolucao,
    question.habilidade,
    question.competencia,
    question.tema,
    question.area,
    ...(question.alternativas || []).map(alt => alt.texto)
  ].join(' ');
}

function scoreQuestionTopic(question, materia, assunto) {
  const topicTokens = getTopicKeywords(materia, assunto);
  if (!assunto || topicTokens.length === 0) return { score: 1, matched: [] };

  const textTokens = new Set(tokenize(questionSearchText(question)));
  const matched = topicTokens.filter(token => textTokens.has(token));
  return { score: matched.length / Math.max(topicTokens.length, 1), matched };
}

function validateThemeCoverage(questoes, materia, assunto) {
  if (!assunto || !String(assunto).trim()) {
    return { ok: true, confidence: 1, matchedQuestions: questoes.length, scores: [] };
  }

  const scores = questoes.map(question => scoreQuestionTopic(question, materia, assunto));
  const matchedQuestions = scores.filter(item => item.score >= 0.18 || item.matched.length >= 2).length;
  const confidence = matchedQuestions / Math.max(questoes.length, 1);

  return {
    ok: confidence >= 0.7,
    confidence,
    matchedQuestions,
    scores: scores.map(item => ({ score: Number(item.score.toFixed(3)), matched: item.matched.slice(0, 8) }))
  };
}

function normalizeQuestion(question, index, materia, assunto, topico) {
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
  const pergunta = String(question.pergunta || question.enunciado || '').trim();
  const resolucao = String(question.resolucao || question.explicacao || '').trim();
  const area = String(question.area || getAreaFromMateria(materia)).trim();

  return {
    id: index + 1,
    materia,
    assunto: assunto || question.assunto || question.tema || 'Geral',
    topico: topico || question.topico || question.tema || assunto || 'Geral',
    contexto: String(question.contexto || '').trim(),
    textoMotivador: String(question.textoMotivador || question.texto_motivador || question.contexto || '').trim(),
    imagemSugerida: String(question.imagemSugerida || question.imagem || '').trim(),
    interpretacao: String(question.interpretacao || '').trim(),
    enunciado: pergunta,
    pergunta,
    alternativas: normalizedAlternativas,
    respostaCorreta: VALID_LETTERS.includes(respostaCorreta) ? respostaCorreta : 'A',
    resolucao,
    explicacao: String(question.explicacao || resolucao).trim(),
    competencia: String(question.competencia || '').trim(),
    habilidade: String(question.habilidade || '').trim(),
    tema: String(question.tema || assunto || 'Geral').trim(),
    area,
    modeloTri: String(question.modeloTri || question.modelo_TRI || question.tri || '').trim(),
    dificuldade: normalizeDifficulty(question.dificuldade)
  };
}

function validateSimuladoPayload(payload, quantidade, materia, assunto, topico, descricao) {
  const effectiveTopico = topico || assunto || 'Geral';
  if (!payload || !Array.isArray(payload.questoes)) {
    throw new Error('A IA retornou um simulado em formato inválido.');
  }

  const questoes = payload.questoes
    .slice(0, quantidade)
    .map((question, index) => normalizeQuestion(question, index, materia, assunto, topico));

  if (questoes.length !== quantidade) {
    throw buildSimuladoQuantityError(quantidade, questoes.length);
  }

  const invalidQuestion = questoes.find(question =>
    !question.contexto ||
    question.contexto.length < 120 ||
    !question.textoMotivador ||
    !question.pergunta ||
    question.pergunta.length < 30 ||
    !question.enunciado ||
    question.alternativas.length !== 5 ||
    question.alternativas.some(alt => !alt.texto) ||
    !VALID_LETTERS.includes(question.respostaCorreta) ||
    !question.resolucao ||
    !question.competencia ||
    !question.habilidade ||
    !question.tema ||
    !question.area ||
    !question.modeloTri
  );

  if (invalidQuestion) {
    throw new Error('A IA retornou questões incompletas. Tente gerar novamente.');
  }

  const coverage = validateThemeCoverage(questoes, materia, effectiveTopico);
  if (!coverage.ok) {
    const err = new Error('Poucas questões encontradas para este tema.');
    err.statusCode = 422;
    err.details = coverage;
    throw err;
  }

  return {
    titulo: String(payload.titulo || `Simulado EnemFlow - ${materia}`).trim(),
    materia,
    assunto: assunto || 'Geral',
    topico: effectiveTopico,
    descricao: descricao || '',
    instrucoes: String(payload.instrucoes || 'Leia cada questão com atenção e marque apenas uma alternativa.').trim(),
    validacaoTema: coverage,
    questoes
  };
}

function mergeSimuladoPayloads(primaryPayload, completionPayload, quantidade) {
  const primaryQuestions = Array.isArray(primaryPayload?.questoes) ? primaryPayload.questoes : [];
  const completionQuestions = Array.isArray(completionPayload?.questoes) ? completionPayload.questoes : [];
  return {
    ...(primaryPayload || {}),
    questoes: [...primaryQuestions, ...completionQuestions].slice(0, quantidade)
  };
}

async function completeMissingSimuladoQuestions({ payload, quantidade, materia, assunto, topico, descricao, temaCentral, tema }) {
  const currentCount = Array.isArray(payload?.questoes) ? payload.questoes.length : 0;
  const missing = quantidade - currentCount;
  if (missing <= 0) return payload;

  const prompt = `O JSON anterior do simulado veio incompleto.

Gere SOMENTE as ${missing} questoes faltantes para completar o simulado.

Regras:
- Tema: ${tema}.
- Foco central: "${temaCentral}".
- Nao repita questoes ja geradas.
- Comece a numeracao conceitual a partir da questao ${currentCount + 1}, mas retorne somente objetos dentro de "questoes".
- Mantenha o mesmo formato JSON, com contexto, textoMotivador, pergunta, 5 alternativas A-E, respostaCorreta, resolucao, competencia, habilidade, tema, area, modeloTri e dificuldade.
- Nao inclua markdown nem texto fora do JSON.

Descricao opcional do aluno: "${descricao || 'sem descricao adicional'}".

Retorne somente:
{
  "questoes": []
}`;

  const systemPrompt = `Voce corrige geracoes incompletas de simulados ENEM.
Responda somente JSON valido. Gere exatamente ${missing} questoes completas, aderentes ao tema e sem markdown.`;

  const raw = await chatCompletion(
    [{ role: 'user', content: prompt }],
    systemPrompt,
    {
      maxTokens: Math.min(16000, Math.max(4096, missing * 1200)),
      temperature: 0.3,
      skipDbContext: true,
      responseFormat: 'json',
      retries: 2,
    }
  );
  const completionPayload = extractJsonObject(raw);
  const merged = mergeSimuladoPayloads(payload, completionPayload, quantidade);
  const mergedCount = Array.isArray(merged.questoes) ? merged.questoes.length : 0;
  if (mergedCount !== quantidade) {
    throw buildSimuladoQuantityError(quantidade, mergedCount, { initialReceived: currentCount, missing });
  }
  return merged;
}

// POST /api/chat - Envia mensagem e recebe resposta da IA
exports.sendMessage = async (req, res) => {
  try {
    const { chatId } = req.body;
    const mensagem = sanitizeUserText(req.body.mensagem);
    if (!mensagem || typeof mensagem !== 'string') {
      return res.status(400).json({ error: 'Campo "mensagem" é obrigatório.' });
    }

    const result = await withRequestLock(`chat:${req.userId}:${chatId || 'new'}`, async () => {
      let chat;
      if (chatId) {
        if (!mongoose.isValidObjectId(chatId)) throw buildHttpError('Conversa invalida.', 400);
        chat = await Chat.findOne({ _id: chatId, usuarioId: req.userId });
        if (!chat) throw buildHttpError('Conversa nao encontrada.', 404);
      } else {
        const titulo = mensagem.substring(0, 60) + (mensagem.length > 60 ? '...' : '');
        chat = await Chat.create({ usuarioId: req.userId, titulo, tipo: 'chat', mensagens: [] });
        await enforceLimit(req.userId);
      }

      chat.mensagens.push({ role: 'user', content: mensagem });
      capChatMessages(chat);

      const history = chat.mensagens.map(m => ({ role: m.role, content: m.content }));
      const resposta = await chatCompletion(history, getPrompt('tutor'), {
        maxHistoryChars: 9000,
        maxMessageChars: 2200,
      });

      chat.mensagens.push({ role: 'assistant', content: resposta });
      capChatMessages(chat);
      await chat.save();

      return { chatId: chat._id, resposta, titulo: chat.titulo };
    });

    res.json(result);
  } catch (error) {
    console.error('[chat.sendMessage]', error.message);
    res.status(error.statusCode || 500).json({ error: error.message || 'Erro ao processar mensagem.' });
  }
};

// GET /api/chat - Lista conversas do usuário
exports.listChats = async (req, res) => {
  try {
    const chats = await Chat.find({ usuarioId: req.userId })
      .sort({ updatedAt: -1 })
      .select('titulo tipo createdAt updatedAt')
      .limit(CHAT_LIMIT)
      .lean();
    res.json(chats);
  } catch (error) {
    console.error('[chat.listChats]', error);
    res.status(500).json({ error: 'Erro ao buscar conversas.' });
  }
};

// GET /api/chat/:id - Detalhes de uma conversa
exports.getChat = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conversa invalida.' });
    }
    const chat = await Chat.findOne({ _id: req.params.id, usuarioId: req.userId });
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada.' });
    res.json(chat);
  } catch (error) {
    console.error('[chat.getChat]', error);
    res.status(500).json({ error: 'Erro ao buscar conversa.' });
  }
};

// DELETE /api/chat/:id - Deleta uma conversa
exports.deleteChat = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conversa invalida.' });
    }
    await Chat.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Conversa excluída.' });
  } catch (error) {
    console.error('[chat.deleteChat]', error);
    res.status(500).json({ error: 'Erro ao excluir conversa.' });
  }
};

// POST /api/chat/exercise - Gera questão estilo ENEM
exports.generateExercise = async (req, res) => {
  try {
    const materia = sanitizeUserText(req.body.materia, 80);
    const assunto = sanitizeUserText(req.body.assunto, 140);
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
    const resposta = await chatCompletion([{ role: 'user', content: prompt }], systemPrompt, {
      maxHistoryChars: 4500,
      maxMessageChars: 2500,
    });

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

// POST /api/chat/simulado - Gera um simulado completo estruturado
exports.generateSimulado = async (req, res) => {
  try {
    const materia = sanitizeUserText(req.body.materia, 80);
    const assunto = sanitizeUserText(req.body.assunto, 140);
    const topico = sanitizeUserText(req.body.topico, 140);
    const descricao = sanitizeUserText(req.body.descricao, 800);
    const { quantidade } = req.body;
    if (!materia) return res.status(400).json({ error: 'Campo "materia" é obrigatório.' });
    if (!assunto) return res.status(400).json({ error: 'Campo "assunto" é obrigatório. Tópico e breve descrição são opcionais.' });

    const result = await withRequestLock(`simulado:${req.userId}`, async () => {
      const safeQuantidade = Math.max(1, Math.min(parseInt(quantidade, 10) || 10, 20));
      const safeTopico = String(topico || '').trim();
      const safeDescricao = String(descricao || '').trim();
      const temaCentral = safeTopico || assunto;
      const tema = [materia, assunto, safeTopico].filter(Boolean).join(' - ');

      const prompt = `Crie um simulado completo do ENEM sobre: ${tema}.

Regras obrigatorias:
- Gere exatamente ${safeQuantidade} questoes.
- Siga exatamente a hierarquia: Materia "${materia}", Assunto "${assunto}", Topico "${temaCentral}".
- O campo Topico e opcional; quando ele vier vazio, use o assunto como foco principal.
- A descricao opcional do aluno e: "${safeDescricao || 'sem descricao adicional'}".
- O foco principal de TODAS as questoes deve ser "${temaCentral}". Nao use questoes genericas que apenas citam a materia.
- Cada questao deve parecer uma questao real do ENEM: situacao-problema, texto motivador, interpretacao, comando claro e alternativas plausiveis.
- O contexto/texto motivador deve ter pelo menos 120 caracteres e nunca ser uma frase curta.
- Cada pergunta deve exigir interpretacao, leitura, raciocinio ou aplicacao. Nao use perguntas diretas como "quanto e 2+2".
- Cada questao deve ter contexto, textoMotivador, interpretacao, pergunta, cinco alternativas plausiveis e apenas uma resposta correta.
- Evite fatos inventados, datas duvidosas, numeros sem necessidade e fontes inexistentes.
- Quando houver calculo, confira a conta antes de responder.
- As alternativas incorretas devem ser plausiveis, mas claramente refutaveis pela resolucao.
- Classifique dificuldade apenas como: facil, media ou dificil.
- Preencha metadata pedagogica: competencia, habilidade, tema, area e modeloTri.
- Use linguagem de prova, sem mencionar IA, modelo, prompt ou algoritmo.
- Nao inclua markdown. Nao inclua comentarios fora do JSON.

Retorne somente um JSON valido no formato:
{
  "titulo": "Simulado EnemFlow - ${tema}",
  "instrucoes": "texto curto",
  "questoes": [
    {
      "contexto": "texto motivador com situacao-problema em estilo ENEM",
      "textoMotivador": "texto de apoio da questao",
      "imagemSugerida": "descricao curta de imagem/tabela/grafico se necessario, ou string vazia",
      "interpretacao": "o que o aluno precisa interpretar para resolver",
      "pergunta": "comando da questao",
      "enunciado": "mesmo texto de pergunta",
      "alternativas": [
        { "letra": "A", "texto": "alternativa" },
        { "letra": "B", "texto": "alternativa" },
        { "letra": "C", "texto": "alternativa" },
        { "letra": "D", "texto": "alternativa" },
        { "letra": "E", "texto": "alternativa" }
      ],
      "respostaCorreta": "A",
      "resolucao": "explicacao objetiva e conferida",
      "explicacao": "explicacao opcional para estudo",
      "competencia": "competencia do ENEM em linguagem simples",
      "habilidade": "habilidade do ENEM em linguagem simples",
      "tema": "${temaCentral}",
      "topico": "${temaCentral}",
      "area": "${getAreaFromMateria(materia)}",
      "modeloTri": "baixa | media | alta discriminacao, com justificativa curta",
      "dificuldade": "facil | media | dificil"
    }
  ]
}`;

      const systemPrompt = getPrompt('simulado');

      const raw = await chatCompletion(
        [{ role: 'user', content: prompt }],
        systemPrompt,
        {
          maxTokens: Math.min(16000, Math.max(4096, safeQuantidade * 1250)),
          temperature: 0.32,
          skipDbContext: true,
          responseFormat: 'json',
          retries: 2,
        }
      );
      let parsed = extractJsonObject(raw);
      if (!parsed || !Array.isArray(parsed.questoes)) {
        const err = new Error('A IA retornou um simulado em formato invalido. Tente gerar novamente.');
        err.statusCode = 422;
        err.details = { parseFailed: true };
        throw err;
      }
      if (parsed.questoes.length !== safeQuantidade) {
        parsed = await completeMissingSimuladoQuestions({
          payload: parsed,
          quantidade: safeQuantidade,
          materia,
          assunto,
          topico: safeTopico,
          descricao: safeDescricao,
          temaCentral,
          tema
        });
      }
      const simulado = validateSimuladoPayload(parsed, safeQuantidade, materia, assunto, safeTopico, safeDescricao);

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

      return { chatId: chat._id, simulado };
    });

    res.json(result);
  } catch (error) {
    console.error('[chat.generateSimulado]', error.message, error.details || '');
    res.status(error.statusCode || 500).json({
      error: error.message || 'Erro ao gerar simulado.',
      details: error.details
    });
  }
};
// POST /api/chat/content-context - inicia conversa usando o texto extraído de um material
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

    const safePergunta = sanitizeUserText(pergunta || 'Analise este PDF e me ajude a estudar o conteudo para o ENEM.', 1200);
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

    const systemOverride = `${getPrompt('pdfAnalysis')}

O aluno abriu um material da plataforma e pediu ajuda sobre ele.

Use o conteúdo extraído abaixo como fonte principal. Se o texto estiver incompleto, diga isso claramente e complemente apenas com explicações educacionais seguras.

Material: ${content.titulo}
Matéria: ${content.materia || 'Geral'}
Assunto: ${content.assunto || 'Geral'}

Conteúdo extraído do PDF/material:
---
${textoExtraido.substring(0, 6000)}
---`;

    const resposta = await chatCompletion(
      [{ role: 'user', content: chat.mensagens[0].content }],
      systemOverride,
      {
        maxHistoryChars: 8000,
        maxMessageChars: 2000,
        skipDbContext: true,
      }
    );

    chat.mensagens.push({ role: 'assistant', content: resposta });
    capChatMessages(chat);
    await chat.save();

    res.json({ chatId: chat._id, resposta, titulo: chat.titulo });
  } catch (error) {
    console.error('[chat.startContentContextChat]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar material.' });
  }
};

// DELETE /api/chat - Limpa todo o histórico de conversas do próprio estudante
exports.clearAllChats = async (req, res) => {
  try {
    await Chat.deleteMany({ usuarioId: req.userId });
    res.json({ message: 'Todas as suas conversas foram excluídas com sucesso.' });
  } catch (error) {
    console.error('[chat.clearAllChats]', error);
    res.status(500).json({ error: 'Erro ao excluir todas as conversas.' });
  }
};




