const SkillProgress = require('../models/SkillProgress');
const enemSkillsMatrix = require('../config/enem_skills_matrix.json');

// Parâmetros Q-Learning
const ALPHA = 0.1; // Taxa de aprendizado
const GAMMA = 0.9; // Fator de desconto

function normalizeArea(area) {
  const value = String(area || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  if (value.includes('matematica')) return 'Matemática';
  if (value.includes('natureza')) return 'Ciências da Natureza';
  if (value.includes('humana')) return 'Ciências Humanas';
  if (value.includes('linguagem') || value.includes('codigo')) return 'Linguagens e Códigos';
  if (value.includes('redacao')) return 'Redação e Competências';
  return area || 'Geral';
}

/**
 * 1. Filtro Híbrido: Recomenda os temas de estudo
 * Analisa as habilidades do catálogo, cruza com as proficiências do usuário
 * e prioriza aquelas com menores níveis ou valores Q, além de checar pré-requisitos.
 */
async function getRecommendations(userId) {
  // Buscar o progresso atual do usuário
  const userProgress = await SkillProgress.find({ userId }).lean();
  const progressMap = new Map();
  userProgress.forEach(p => progressMap.set(p.skillId, p));

  const candidates = [];

  for (const skill of enemSkillsMatrix) {
    const prog = progressMap.get(skill.id);
    
    // Se ainda não estudou, o Q-Value é 0
    let qValue = 0;
    let nivel = 'Não avaliado';
    if (prog) {
      qValue = prog.qValue;
      nivel = prog.nivel;
    }

    // Não recomenda se já for proficiente, a menos que seja para revisão (foco primário: não proficiente)
    if (nivel !== 'Proficiente') {
      // Checa se os pré-requisitos foram cumpridos (básico)
      let reqsMet = true;
      for (const req of skill.prerequisites) {
        const reqProg = progressMap.get(req);
        if (!reqProg || reqProg.nivel === 'Não avaliado' || reqProg.nivel === 'Iniciante') {
          reqsMet = false;
          break;
        }
      }

      if (reqsMet) {
        candidates.push({
          skill,
          qValue,
          nivel
        });
      }
    }
  }

  // Ordena por menor valor Q primeiro (para focar no que o estudante mais precisa evoluir)
  candidates.sort((a, b) => a.qValue - b.qValue);
  
  // Retorna os top 5
  return candidates.slice(0, 5);
}

/**
 * 2. Reinforcement Learning Agent (Q-Learning MDP)
 * Atualiza o valor Q de uma habilidade e calcula o novo nível baseado em acerto/erro.
 */
async function processSolve(userId, skillId, area, correto, tempoEmSegundos, acertosInput, totalInput) {
  let progress = await SkillProgress.findOne({ userId, skillId });
  if (!progress) {
    progress = new SkillProgress({ userId, skillId, area: normalizeArea(area) });
  }
  progress.area = normalizeArea(area || progress.area);

  // Define recompensa base
  let reward = 0;
  const nivelAnterior = progress.nivel;
  const totalDelta = Math.max(1, Number(totalInput) || 1);
  const acertosDelta = Math.max(0, Math.min(totalDelta, Number(acertosInput) || (correto ? 1 : 0)));
  const hitRateDelta = acertosDelta / totalDelta;

  progress.acertos += acertosDelta;
  progress.total += totalDelta;
  progress.tempoEstudado += Math.max(0, Number(tempoEmSegundos) || 0);

  if (hitRateDelta >= 0.8) reward = 0.8;
  else if (hitRateDelta >= 0.6) reward = 0.45;
  else if (hitRateDelta >= 0.4) reward = 0.05;
  else reward = -0.2;

  // Calcula taxa de acerto para determinar nível
  const hitRate = progress.acertos / progress.total;
  
  // Lógica de evolução de nível
  if (progress.total >= 3) {
    if (hitRate >= 0.8) {
      progress.nivel = 'Proficiente';
    } else if (hitRate >= 0.5) {
      progress.nivel = 'Em desenvolvimento';
    } else {
      progress.nivel = 'Iniciante';
    }
  } else {
    // Se fez 1 ou 2, só com 100% vira "Em desenvolvimento", senão "Iniciante"
    if (hitRate === 1.0) {
      progress.nivel = 'Em desenvolvimento';
    } else {
      progress.nivel = 'Iniciante';
    }
  }

  // Bônus se subiu de nível
  if (nivelAnterior === 'Não avaliado' && progress.nivel === 'Em desenvolvimento') reward += 0.5;
  if (nivelAnterior === 'Iniciante' && progress.nivel === 'Em desenvolvimento') reward += 1.3;
  if (nivelAnterior === 'Em desenvolvimento' && progress.nivel === 'Proficiente') reward += 2.0;

  // Q-Learning Simplificado (Bellman Equation)
  // Q(s,a) = Q(s,a) + alpha * (Reward + gamma * MaxQ(s') - Q(s,a))
  // Aqui, simplificamos assumindo MaxQ(s') ~ Q(s,a) atual
  progress.qValue = progress.qValue + ALPHA * (reward - progress.qValue);

  // Registro de histórico
  progress.historico.push({
    correto: hitRateDelta >= 0.6,
    tempo: Math.max(0, Number(tempoEmSegundos) || 0),
    acertos: acertosDelta,
    total: totalDelta
  });

  await progress.save();
  return { progress, reward };
}

/**
 * 3. Simulador TRI
 * Estima a nota baseada na proficiência das habilidades estudadas.
 */
async function simulateTRIScore(userId, horasAdicionais, areaTarget) {
  // Nota base fixa aproximada (min) para o ENEM em cada área
  const NOTA_BASE = 368;
  const NOTA_MAX = 980; // Apenas referência

  const progresses = await SkillProgress.find({ userId });
  
  let notasPorArea = {
    'Matemática': NOTA_BASE,
    'Ciências da Natureza': NOTA_BASE,
    'Ciências Humanas': NOTA_BASE,
    'Linguagens e Códigos': NOTA_BASE,
    'Redação e Competências': NOTA_BASE
  };

  // Calcula ganhos reais já obtidos
  progresses.forEach(p => {
    let ganho = 0;
    if (p.nivel === 'Iniciante') ganho = 5;
    if (p.nivel === 'Em desenvolvimento') ganho = 15;
    if (p.nivel === 'Proficiente') ganho = 25;
    
    // Ajusta o ganho pelo valor Q (se tiver muito alto, significa mais confiança)
    if (p.qValue > 0) {
      ganho += p.qValue * 10;
    }

    if (notasPorArea[p.area] !== undefined) {
      notasPorArea[p.area] += ganho;
    }
  });

  // Se o aluno pediu pra simular "E se eu estudar X horas?"
  if (horasAdicionais && horasAdicionais > 0 && areaTarget) {
    // Curva de aprendizado logarítmica: mais horas dão ganhos, mas vão diminuindo (plateau)
    // Supondo que 1 hora = ganho de 5 a 15 pontos, diminuindo logaritmicamente
    const ganhoSimulado = Math.round(15 * Math.log(horasAdicionais + 1) + (horasAdicionais * 2));
    
    if (notasPorArea[areaTarget] !== undefined) {
      notasPorArea[areaTarget] += ganhoSimulado;
    }
  }

  // Caps notas em 1000 (ou próximo do max do TRI real)
  for (let key in notasPorArea) {
    if (notasPorArea[key] > NOTA_MAX) notasPorArea[key] = NOTA_MAX;
    notasPorArea[key] = Math.round(notasPorArea[key]);
  }

  return notasPorArea;
}

/**
 * Reporta feedback negativo (ex: abandono)
 */
async function reportFeedback(userId, skillId) {
  let progress = await SkillProgress.findOne({ userId, skillId });
  if (progress) {
    // Penalidade por abandono
    progress.qValue -= 0.2;
    await progress.save();
  }
}

module.exports = {
  getRecommendations,
  processSolve,
  simulateTRIScore,
  reportFeedback
};
