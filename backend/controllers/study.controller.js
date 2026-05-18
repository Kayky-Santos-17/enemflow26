const User = require('../models/User');
const StudySession = require('../models/StudySession');

/**
 * Controller: study
 * Gerencia o timer de estudos e o registro de sessões.
 *
 * Fluxo:
 *  1. POST /study/start  → retorna o timestamp de início
 *  2. POST /study/end    → calcula duração, salva sessão e atualiza XP do usuário
 */

// POST /study/start
exports.start = (req, res) => {
  const session = { startTime: Date.now() };
  console.log(`[study.start] Sessão iniciada em ${new Date(session.startTime).toISOString()}`);
  res.json(session);
};

// POST /study/end
exports.end = async (req, res) => {
  try {
    const { startTime, contentId } = req.body;

    if (!startTime || !contentId) {
      return res.status(400).json({ error: 'startTime e contentId são obrigatórios.' });
    }

    const duracao = Math.max(0, Math.floor((Date.now() - startTime) / 1000)); // em segundos
    // 10 XP a cada 1 hora (3600 segundos). Logo, 1 XP a cada 360 segundos (6 minutos de foco).
    const xpGanho = Math.floor(duracao / 360);

    // req.userId é injetado pelo middleware auth
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: 'Usuário não autenticado.' });
    }

    if (userId) {
      // Salva a sessão no histórico
      await StudySession.create({ 
        userId, 
        contentId, 
        duracao, 
        xpGanho, 
        iniciadaEm: new Date(startTime),
        encerradaEm: new Date() 
      });

      // Atualiza progresso e XP no User
      const user = await User.findById(userId);
      if (user) {
        let prog = user.progresso.find((p) => p.contentId?.toString() === contentId);
        if (!prog) {
          user.progresso.push({ contentId, tempoEstudado: duracao, concluido: false });
        } else {
          prog.tempoEstudado += duracao;
        }
        user.xp += xpGanho;
        await user.save();
      }
    }

    res.json({ duracao, xpGanho });
  } catch (error) {
    console.error('[study.end]', error);
    res.status(500).json({ error: 'Erro ao encerrar sessão de estudo.' });
  }
};

// GET /study/history/:userId — histórico de sessões (para dashboard)
exports.history = async (req, res) => {
  try {
    const sessions = await StudySession.find({ userId: req.params.userId })
      .sort({ iniciadaEm: -1 })
      .limit(20)
      .populate('contentId', 'titulo materia');

    res.json(sessions);
  } catch (error) {
    console.error('[study.history]', error);
    res.status(500).json({ error: 'Erro ao buscar histórico.' });
  }
};
