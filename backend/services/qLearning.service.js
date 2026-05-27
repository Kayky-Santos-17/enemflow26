const QTable = require('../models/QTable');
const SkillProgress = require('../models/SkillProgress');
const StudySession = require('../models/StudySession');

/**
 * Mapeamento das Ações do Agente Q-Learning
 */
const ACTIONS = {
  0: { id: 0, nome: 'Recomendar Matemática', type: 'materia', target: 'Matemática' },
  1: { id: 1, nome: 'Recomendar Linguagens', type: 'materia', target: 'Linguagens e Códigos' },
  2: { id: 2, nome: 'Recomendar Humanas', type: 'materia', target: 'Ciências Humanas' },
  3: { id: 3, nome: 'Recomendar Natureza', type: 'materia', target: 'Ciências da Natureza' },
  4: { id: 4, nome: 'Gerar Revisão', type: 'revisao' },
  5: { id: 5, nome: 'Gerar Flashcards', type: 'flashcard' },
  6: { id: 6, nome: 'Sugerir Simulado', type: 'simulado' },
  7: { id: 7, nome: 'Aumentar Dificuldade', type: 'ajuste_dificuldade', value: 1 },
  8: { id: 8, nome: 'Reduzir Dificuldade', type: 'ajuste_dificuldade', value: -1 },
  9: { id: 9, nome: 'Modo Foco', type: 'foco' },
  10: { id: 10, nome: 'Reforçar Assunto Fraco', type: 'reforco' },
};

/**
 * Serviço de Inteligência Artificial usando Q-Learning.
 * A IA aprende automaticamente as melhores estratégias para cada aluno.
 */
class QLearningAgent {
  constructor() {
    this.alpha = 0.1; // Learning rate
    this.gamma = 0.95; // Discount factor (visão de longo prazo)
    this.epsilon = 0.1; // Epsilon fixo/inicial para exploração (exploration vs exploitation)
    this.numActions = 11; // 0 a 10
  }

  /**
   * Transforma dados brutos do usuário em um "Estado Discreto".
   * Agrupa métricas em categorias (ex: Baixo/Médio/Alto) para simplificar a matriz Q.
   * @param {Object} data Dados consolidados do usuário
   * @returns {String} Estado discreto (ex: "perf_low_freq_high_diff_med")
   */
  discretizeState(data) {
    const { hitRate, frequenciaSemanal, tempoTotalEstudo, dificuldadeMedia } = data;

    // Desempenho (Taxa de Acertos)
    let perf = 'med';
    if (hitRate < 0.4) perf = 'low';
    else if (hitRate >= 0.7) perf = 'high';

    // Frequência (Dias na semana ou sessões recentes)
    let freq = 'med';
    if (frequenciaSemanal <= 1) freq = 'low';
    else if (frequenciaSemanal >= 4) freq = 'high';

    // Tempo de estudo total
    let tempo = 'med';
    if (tempoTotalEstudo < 3600 * 5) tempo = 'low'; // Menos de 5h
    else if (tempoTotalEstudo > 3600 * 20) tempo = 'high'; // Mais de 20h

    // Dificuldade
    let diff = 'med';
    if (dificuldadeMedia < 0.3) diff = 'low';
    else if (dificuldadeMedia > 0.7) diff = 'high';

    return `perf_${perf}_freq_${freq}_time_${tempo}_diff_${diff}`;
  }

  /**
   * Coleta dados reais do MongoDB para compor o State.
   * @param {String} userId ID do usuário
   * @returns {Promise<String>} Estado discreto gerado
   */
  async getCurrentState(userId) {
    const progresses = await SkillProgress.find({ userId }).lean();
    
    let totalAcertos = 0;
    let totalQuestoes = 0;
    let tempoTotalEstudo = 0;

    progresses.forEach(p => {
      totalAcertos += p.acertos || 0;
      totalQuestoes += p.total || 0;
      tempoTotalEstudo += p.tempoEstudado || 0;
    });

    const hitRate = totalQuestoes > 0 ? totalAcertos / totalQuestoes : 0;

    // Calcula frequência semanal simples (Sessões nos últimos 7 dias)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sessions = await StudySession.find({ userId, iniciadaEm: { $gte: sevenDaysAgo } }).lean();
    
    // Agrupa sessões por dia para saber os dias distintos
    const diasDistintos = new Set(sessions.map(s => new Date(s.iniciadaEm).toDateString())).size;

    // Dificuldade média (Mock: 0.5 fixo se não houver um tracking complexo no banco ainda)
    const dificuldadeMedia = 0.5;

    return this.discretizeState({
      hitRate,
      frequenciaSemanal: diasDistintos,
      tempoTotalEstudo,
      dificuldadeMedia
    });
  }

  /**
   * Obtém todos os Q-Values para um Estado e Usuário específico
   */
  async getQValues(userId, state) {
    const records = await QTable.find({ userId, state }).lean();
    const qValues = new Array(this.numActions).fill(0.0);
    
    records.forEach(r => {
      if (r.action >= 0 && r.action < this.numActions) {
        qValues[r.action] = r.qValue;
      }
    });

    return qValues;
  }

  /**
   * Escolhe uma ação utilizando Política Epsilon-Greedy.
   * Exploração (aleatório) vs Explotação (melhor qValue)
   */
  async chooseAction(userId, state) {
    // Epsilon decay ou fixo
    // Adicionamos um pequeno decay baseado na existência de records
    const recordsCount = await QTable.countDocuments({ userId });
    if (recordsCount === 0) {
      return { action: await this.getColdStartAction(userId), isExploration: true };
    }
    // Quando mais registros o user tem, menos exploração (min 0.05)
    let currentEpsilon = Math.max(0.05, this.epsilon - (recordsCount * 0.001));

    if (Math.random() < currentEpsilon) {
      // Exploration: ação aleatória
      return { 
        action: Math.floor(Math.random() * this.numActions),
        isExploration: true 
      };
    } else {
      // Exploitation: melhor ação conhecida para este estado
      const qValues = await this.getQValues(userId, state);
      let maxQ = -Infinity;
      let bestAction = 0;

      for (let i = 0; i < this.numActions; i++) {
        if (qValues[i] > maxQ) {
          maxQ = qValues[i];
          bestAction = i;
        }
      }
      
      // Se todos forem 0, escolhe aleatório pra começar a tabela
      if (maxQ === 0) {
        bestAction = await this.getColdStartAction(userId);
        return { action: bestAction, isExploration: true };
      }

      return { action: bestAction, isExploration: false };
    }
  }

  async getColdStartAction(userId) {
    const progresses = await SkillProgress.find({ userId }).lean();
    if (!progresses.length) return 6;

    const areaScores = new Map();
    progresses.forEach(progress => {
      const total = Math.max(progress.total || 0, 1);
      const hitRate = (progress.acertos || 0) / total;
      const current = areaScores.get(progress.area) || { hitRateSum: 0, count: 0, totalQuestoes: 0 };
      current.hitRateSum += hitRate;
      current.count += 1;
      current.totalQuestoes += progress.total || 0;
      areaScores.set(progress.area, current);
    });

    let weakestArea = null;
    let weakestScore = Infinity;
    for (const [area, data] of areaScores.entries()) {
      const avgHitRate = data.hitRateSum / Math.max(data.count, 1);
      const confidencePenalty = data.totalQuestoes < 5 ? 0.15 : 0;
      const score = avgHitRate - confidencePenalty;
      if (score < weakestScore) {
        weakestScore = score;
        weakestArea = area;
      }
    }

    const normalizedArea = String(weakestArea || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (normalizedArea.includes('matematica')) return 0;
    if (normalizedArea.includes('linguagem') || normalizedArea.includes('codigo')) return 1;
    if (normalizedArea.includes('humana')) return 2;
    if (normalizedArea.includes('natureza')) return 3;
    return 10;
  }

  /**
   * Calcula a Recompensa Real (Feedback do Ambiente)
   * @param {Object} feedback Dados de resultado da ação executada
   */
  calculateReward(feedback) {
    let reward = 0;
    
    // Recompensas positivas
    if (feedback.melhorouDesempenho) reward += 10;
    if (feedback.aumentouFrequencia) reward += 5;
    if (feedback.aumentouAcertos) reward += 8;
    if (feedback.concluiuPlano) reward += 4;
    
    // Recompensas negativas
    if (feedback.quedaDesempenho) reward -= 10;
    if (feedback.abandonouEstudo) reward -= 6;
    if (feedback.repetiuErros) reward -= 5;
    if (feedback.baixaAtividade) reward -= 3;

    return reward;
  }

  /**
   * Atualiza a Q-Table usando a Equação de Bellman
   * Q(s,a) = Q(s,a) + α[r + γ * maxQ(s',a') - Q(s,a)]
   */
  async updateQTable(userId, state, action, reward, nextState) {
    // 1. Pega Q(s, a)
    let currentRecord = await QTable.findOne({ userId, state, action });
    let currentQ = currentRecord ? currentRecord.qValue : 0.0;

    // 2. Pega maxQ(s', a') (O melhor Q no próximo estado)
    const nextQValues = await this.getQValues(userId, nextState);
    const maxNextQ = Math.max(...nextQValues);

    // 3. Aplica Bellman
    const newQ = currentQ + this.alpha * (reward + this.gamma * maxNextQ - currentQ);

    // 4. Persiste no banco
    if (currentRecord) {
      currentRecord.qValue = newQ;
      await currentRecord.save();
    } else {
      await QTable.create({ userId, state, action, qValue: newQ });
    }

    return newQ;
  }

  /**
   * Executa o Treinamento.
   * Acionado após o aluno completar um fluxo (simulado, estudo).
   */
  async train(userId, feedback) {
    // Para simplificar o pipeline de treinamento assíncrono:
    // Nós guardamos o último estado visitado e ação (poderia estar em cache/redis).
    // Aqui assumimos que calculamos o estado ANTERIOR, a ação que foi sugerida, e o estado ATUAL.
    
    // Simulando: se não temos o estado anterior armazenado, nós criamos o estado atual
    // e atualizamos baseado na recompensa genérica associada à última ação (ou distribuída).
    // Uma implementação stateful real usaria Redis para buscar: const { lastState, lastAction } = getCache(userId);

    const currentState = await this.getCurrentState(userId);
    const action = feedback.actionTaken !== undefined ? feedback.actionTaken : 0; // fallback se não for enviado
    const reward = this.calculateReward(feedback);

    // Como é um treinamento posterior, consideramos currentState como nextState e simulamos
    // o state anterior (em um app real isso vem do Redis)
    const previousState = feedback.previousState || currentState;

    await this.updateQTable(userId, previousState, action, reward, currentState);
    return { success: true, reward, newState: currentState };
  }

  /**
   * Retorna a Recomendação Formatada para a API e Dashboard
   */
  async getRecommendation(userId) {
    const state = await this.getCurrentState(userId);
    const { action, isExploration } = await this.chooseAction(userId, state);
    const actionObj = ACTIONS[action];

    // Formatação amigável do nível do usuário com base no State gerado
    let nivelName = "Iniciante";
    if (state.includes("perf_high")) nivelName = "Avançado";
    else if (state.includes("perf_med")) nivelName = "Intermediário";

    // Gera um motivo para a IA ter escolhido essa ação
    let motivo = "Identificamos que esta é a melhor estratégia para o seu momento atual.";
    if (actionObj.type === 'materia') {
      motivo = isExploration 
        ? `Vamos explorar seu conhecimento em ${actionObj.target} para equilibrar seus estudos.` 
        : `Você costuma ter um excelente aproveitamento estudando ${actionObj.target} com a sua frequência atual.`;
    } else if (actionObj.type === 'reforco') {
      motivo = "Notei repetição de erros recentes. É hora de focar nos seus pontos mais fracos.";
    } else if (actionObj.type === 'simulado') {
      motivo = "Seu desempenho tem sido estável. É o momento perfeito para medir seus conhecimentos na prática.";
    }

    return {
      materiaRecomendada: actionObj.target || 'Geral',
      nivel: nivelName,
      motivo: motivo,
      confianca: isExploration ? 60 + Math.floor(Math.random()*15) : 85 + Math.floor(Math.random()*14),
      acao: actionObj,
      rawState: state,
    };
  }
}

module.exports = new QLearningAgent();
