const mongoose = require('mongoose');
const Plan = require('../models/Plan');
const { createChatWithMessages } = require('../services/chatMessage.service');
const { chatCompletion } = require('../services/openrouter.service');
const { getPrompt } = require('../services/prompt.service');

function sanitizeText(value, maxChars = 120) {
  const text = String(value || '').replace(/\u0000/g, '').trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

exports.generate = async (req, res) => {
  try {
    const materias = Array.isArray(req.body.materias)
      ? req.body.materias.map(item => sanitizeText(item, 80)).filter(Boolean).slice(0, 12)
      : [];
    const tempoDisponivel = sanitizeText(req.body.tempoDisponivel, 80);
    const dificuldade = sanitizeText(req.body.dificuldade || 'medio', 40);

    if (materias.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos uma materia.' });
    }

    const prompt = `Crie um plano de estudos personalizado para o ENEM com as seguintes informacoes:

Materias: ${materias.join(', ')}
Tempo disponivel por dia: ${tempoDisponivel || 'Nao informado'}
Nivel de dificuldade: ${dificuldade || 'Medio'}

O plano deve incluir:
1. Cronograma semanal organizado por dia
2. Distribuicao equilibrada das materias
3. Tempo para revisao
4. Intervalos de descanso com tecnica Pomodoro
5. Dicas de estudo para cada materia
6. Priorizacao por peso no ENEM

Formate o plano de forma clara usando markdown com tabelas quando possivel.`;

    const cronograma = await chatCompletion([{ role: 'user', content: prompt }], getPrompt('studyPlan'), {
      maxHistoryChars: 5000,
      maxMessageChars: 3500,
    });

    const plan = await Plan.create({
      usuarioId: req.userId,
      titulo: `Plano: ${materias.slice(0, 3).join(', ')}${materias.length > 3 ? '...' : ''}`,
      materias,
      tempoDisponivel,
      dificuldade,
      cronograma,
    });

    await createChatWithMessages({
      usuarioId: req.userId,
      titulo: plan.titulo,
      tipo: 'plano',
      mensagens: [
        { role: 'user', content: `Criar plano de estudos: ${materias.join(', ')}` },
        { role: 'assistant', content: cronograma },
      ],
    });

    res.json({ planId: plan._id, cronograma });
  } catch (error) {
    console.error('[plan.generate]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao gerar plano.' });
  }
};

exports.list = async (req, res) => {
  try {
    const plans = await Plan.find({ usuarioId: req.userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .select('titulo materias tempoDisponivel dificuldade createdAt updatedAt')
      .lean();
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar planos.' });
  }
};

exports.getById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Plano invalido.' });
    }
    const plan = await Plan.findOne({ _id: req.params.id, usuarioId: req.userId }).lean();
    if (!plan) return res.status(404).json({ error: 'Plano nao encontrado.' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar plano.' });
  }
};

exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Plano invalido.' });
    }
    await Plan.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Plano excluido.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir plano.' });
  }
};
