const aiService = require('../services/ai-adaptation.service');
const enemSkillsMatrix = require('../config/enem_skills_matrix.json');
const SkillProgress = require('../models/SkillProgress');
const StudySession = require('../models/StudySession');

const AREA_TO_MATERIAS = {
  'Matemática': ['Matemática'],
  'Linguagens': ['Português', 'Literatura', 'Artes', 'Inglês', 'Espanhol', 'Linguagens'],
  'Humanas': ['História', 'Geografia', 'Filosofia', 'Sociologia', 'Humanas'],
  'Natureza': ['Física', 'Química', 'Biologia', 'Natureza'],
  'Redação': ['Redação']
};

function normalizeText(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeArea(value) {
  const text = normalizeText(value);
  if (text.includes('mat')) return 'Matemática';
  if (text.includes('ling') || text.includes('port') || text.includes('liter') || text.includes('ingles') || text.includes('espanhol') || text.includes('artes')) return 'Linguagens';
  if (text.includes('human') || text.includes('hist') || text.includes('geo') || text.includes('filo') || text.includes('socio')) return 'Humanas';
  if (text.includes('nature') || text.includes('fis') || text.includes('quim') || text.includes('bio')) return 'Natureza';
  if (text.includes('red')) return 'Redação';
  return 'Geral';
}

function buildHybridStatus(acertoPercent, horasEstudadas) {
  if (acertoPercent < 50 && horasEstudadas < 2) {
    return { status: 'Crítico', sugestao: 'Aumente a carga horária e resolva questões básicas antes do próximo simulado.' };
  }
  if (acertoPercent < 60 || horasEstudadas < 3) {
    return { status: 'Em desenvolvimento', sugestao: 'Mantenha revisões curtas e conecte o estudo teórico com simulados semanais.' };
  }
  return { status: 'Bom', sugestao: 'Continue alternando materiais e simulados para consolidar desempenho.' };
}

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

async function getHybridMap(req, res) {
  try {
    const userId = req.userId;
    const [progresses, sessions] = await Promise.all([
      SkillProgress.find({ userId }).lean(),
      StudySession.find({ userId })
        .populate('contentId', 'titulo materia tipo')
        .sort({ iniciadaEm: -1 })
        .lean(),
    ]);

    const areas = Object.keys(AREA_TO_MATERIAS).map(area => ({
      area,
      materias: AREA_TO_MATERIAS[area],
      tempoEstudado: 0,
      sessoes: 0,
      acertos: 0,
      total: 0,
      ultimaSessao: null,
    }));

    progresses.forEach(progress => {
      const area = normalizeArea(progress.area || progress.skillId);
      const target = areas.find(item => item.area === area);
      if (!target) return;
      target.acertos += progress.acertos || 0;
      target.total += progress.total || 0;
    });

    sessions.forEach(session => {
      const materia = session.materia || session.contentId?.materia || 'Geral';
      const area = normalizeArea(materia);
      const target = areas.find(item => item.area === area);
      if (!target) return;
      target.tempoEstudado += session.duracao || 0;
      target.sessoes += 1;
      if (!target.ultimaSessao || new Date(session.iniciadaEm) > new Date(target.ultimaSessao)) {
        target.ultimaSessao = session.iniciadaEm;
      }
    });

    const mapa = areas.map(item => {
      const acertoPercent = item.total > 0 ? Math.round((item.acertos / item.total) * 100) : 0;
      const horasEstudadas = Number((item.tempoEstudado / 3600).toFixed(1));
      const statusInfo = buildHybridStatus(acertoPercent, horasEstudadas);
      return {
        ...item,
        acertoPercent,
        horasEstudadas,
        status: statusInfo.status,
        sugestao: statusInfo.sugestao,
      };
    });

    res.json({
      generatedAt: new Date().toISOString(),
      mapa,
      foco: [...mapa].sort((a, b) => {
        const order = { 'Crítico': 0, 'Em desenvolvimento': 1, 'Bom': 2 };
        return order[a.status] - order[b.status] || a.acertoPercent - b.acertoPercent || a.horasEstudadas - b.horasEstudadas;
      })[0],
    });
  } catch (error) {
    console.error('Erro em getHybridMap:', error);
    res.status(500).json({ error: 'Erro ao montar mapa hÃ­brido' });
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
  getHybridMap,
  getRecommendations,
  solveQuestion,
  simulateScore,
  reportFeedback
};
