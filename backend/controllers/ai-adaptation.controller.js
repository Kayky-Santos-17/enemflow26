const aiService = require('../services/ai-adaptation.service');
const enemSkillsMatrix = require('../config/enem_skills_matrix.json');
const SkillProgress = require('../models/SkillProgress');

async function getSkills(req, res) {
  try {
    const userId = req.userId; // req.userId é populado pelo middleware de auth
    const progresses = await SkillProgress.find({ userId });
    
    // Mapeia para entregar pro frontend a estrutura das habilidades + progresso
    const responseData = enemSkillsMatrix.map(skill => {
      const prog = progresses.find(p => p.skillId === skill.id);
      return {
        ...skill,
        nivel: prog ? prog.nivel : 'Não avaliado',
        qValue: prog ? prog.qValue : 0,
        acertos: prog ? prog.acertos : 0,
        total: prog ? prog.total : 0,
        tempoEstudado: prog ? prog.tempoEstudado : 0,
        historico: prog ? prog.historico : []
      };
    });

    res.json(responseData);
  } catch (error) {
    console.error('Erro em getSkills:', error);
    res.status(500).json({ error: 'Erro ao buscar habilidades' });
  }
}

async function getRecommendations(req, res) {
  try {
    const userId = req.userId;
    const recs = await aiService.getRecommendations(userId);
    res.json(recs);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao gerar recomendações' });
  }
}

async function solveQuestion(req, res) {
  try {
    const userId = req.userId;
    const { skillId, area, correto, tempoEmSegundos, acertos, total } = req.body;
    
    if (!skillId || !area || typeof correto === 'undefined') {
      return res.status(400).json({ error: 'Dados incompletos' });
    }

    const { progress, reward } = await aiService.processSolve(userId, skillId, area, correto, tempoEmSegundos, acertos, total);
    
    // Calcula notas atualizadas
    const notas = await aiService.simulateTRIScore(userId, 0, null);

    res.json({
      message: 'Progresso atualizado com sucesso!',
      progress,
      reward,
      notasTRI: notas
    });
  } catch (error) {
    console.error('Erro em solveQuestion:', error);
    res.status(500).json({ error: 'Erro ao processar resolução' });
  }
}

async function simulateScore(req, res) {
  try {
    const userId = req.userId;
    const { horasAdicionais, areaTarget } = req.body;
    
    const notas = await aiService.simulateTRIScore(userId, horasAdicionais, areaTarget);
    res.json({ notas });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao simular notas' });
  }
}

async function reportFeedback(req, res) {
  try {
    const userId = req.userId;
    const { skillId } = req.body;
    
    await aiService.reportFeedback(userId, skillId);
    res.json({ message: 'Feedback reportado com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao reportar feedback' });
  }
}

module.exports = {
  getSkills,
  getRecommendations,
  solveQuestion,
  simulateScore,
  reportFeedback
};
