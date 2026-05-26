const qLearningService = require('../services/qLearning.service');

/**
 * Retorna a recomendação da IA baseada na Q-Table do usuário.
 */
exports.getRecommendation = async (req, res) => {
  try {
    const userId = req.user.id; // Supondo middleware de auth existente
    
    // Adicionar um cache rápido na resposta (opcional, pode ser feito no front-end também)
    // Para performance, como solicitado, evitamos recalcular tudo pesadamente. 
    // O agent.getRecommendation() já faz uma query leve baseada nos dados do mongo.

    const recommendation = await qLearningService.getRecommendation(userId);
    
    res.status(200).json({
      success: true,
      data: recommendation
    });
  } catch (error) {
    console.error('[QLearning] Erro ao obter recomendação:', error);
    res.status(500).json({ success: false, error: 'Falha ao gerar recomendação inteligente.' });
  }
};

/**
 * Acionado ao final de um simulado ou estudo.
 * Processa o feedback, calcula a recompensa e atualiza a Q-Table (Bellman).
 */
exports.trainAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const { 
      actionTaken, 
      previousState,
      melhorouDesempenho, 
      aumentouFrequencia, 
      aumentouAcertos, 
      concluiuPlano,
      quedaDesempenho,
      abandonouEstudo,
      repetiuErros,
      baixaAtividade
    } = req.body;

    // Feedback object
    const feedback = {
      actionTaken,
      previousState,
      melhorouDesempenho,
      aumentouFrequencia,
      aumentouAcertos,
      concluiuPlano,
      quedaDesempenho,
      abandonouEstudo,
      repetiuErros,
      baixaAtividade
    };

    const result = await qLearningService.train(userId, feedback);

    res.status(200).json({
      success: true,
      message: 'Modelo treinado com sucesso.',
      data: result
    });
  } catch (error) {
    console.error('[QLearning] Erro ao treinar o agente:', error);
    res.status(500).json({ success: false, error: 'Falha ao treinar o agente de IA.' });
  }
};
