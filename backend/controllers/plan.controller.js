const Plan = require('../models/Plan');
const Chat = require('../models/Chat');
const { chatCompletion } = require('../services/openrouter.service');

// POST /api/plan — Gera plano de estudos personalizado
exports.generate = async (req, res) => {
  try {
    const { materias, tempoDisponivel, dificuldade } = req.body;
    if (!materias || !Array.isArray(materias) || materias.length === 0) {
      return res.status(400).json({ error: 'Selecione ao menos uma matéria.' });
    }

    const prompt = `Crie um plano de estudos personalizado para o ENEM com as seguintes informações:

**Matérias:** ${materias.join(', ')}
**Tempo disponível por dia:** ${tempoDisponivel || 'Não informado'}
**Nível de dificuldade:** ${dificuldade || 'Médio'}

O plano deve incluir:
1. Cronograma semanal organizado por dia
2. Distribuição equilibrada das matérias
3. Tempo para revisão
4. Intervalos de descanso (técnica Pomodoro)
5. Dicas de estudo para cada matéria
6. Priorização por peso no ENEM

Formate o plano de forma clara usando markdown com tabelas quando possível.`;

    const systemPrompt = 'Você é um especialista em planejamento de estudos para o ENEM. Crie cronogramas realistas, motivadores e estratégicos. Use formatação markdown com tabelas, listas e destaques.';
    const cronograma = await chatCompletion([{ role: 'user', content: prompt }], systemPrompt);

    const plan = await Plan.create({
      usuarioId: req.userId,
      titulo: `Plano: ${materias.slice(0, 3).join(', ')}${materias.length > 3 ? '...' : ''}`,
      materias,
      tempoDisponivel: tempoDisponivel || '',
      dificuldade: dificuldade || 'medio',
      cronograma,
    });

    // Salvar também como chat para o histórico
    await Chat.create({
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

// GET /api/plan — Lista planos do usuário
exports.list = async (req, res) => {
  try {
    const plans = await Plan.find({ usuarioId: req.userId }).sort({ createdAt: -1 }).limit(20);
    res.json(plans);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar planos.' });
  }
};

// GET /api/plan/:id
exports.getById = async (req, res) => {
  try {
    const plan = await Plan.findOne({ _id: req.params.id, usuarioId: req.userId });
    if (!plan) return res.status(404).json({ error: 'Plano não encontrado.' });
    res.json(plan);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar plano.' });
  }
};

// DELETE /api/plan/:id
exports.remove = async (req, res) => {
  try {
    await Plan.findOneAndDelete({ _id: req.params.id, usuarioId: req.userId });
    res.json({ message: 'Plano excluído.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao excluir plano.' });
  }
};
