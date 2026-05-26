const mongoose = require('mongoose');

/**
 * Model: QTable
 * Tabela de aprendizado do Agente Q-Learning.
 * Relaciona Usuário, Estado Discreto, Ação Escolhida e o Valor de Qualidade (Q-Value) esperado.
 */
const qTableSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    state: {
      type: String,
      required: true,
      index: true,
      description: 'Estado discreto gerado a partir do desempenho e frequência do usuário (ex: low_perf_high_freq)',
    },
    action: {
      type: Number,
      required: true,
      min: 0,
      max: 10,
      description: 'Ação tomada pelo agente (de 0 a 10)',
    },
    qValue: {
      type: Number,
      default: 0.0,
      description: 'Valor de recompensa esperada para este par estado-ação',
    },
  },
  {
    timestamps: true, // Adiciona createdAt e updatedAt automaticamente
  }
);

// Índice composto (userId, state, action) com unicidade
// Garante que para um determinado estado e ação de um usuário, exista apenas 1 qValue
qTableSchema.index({ userId: 1, state: 1, action: 1 }, { unique: true });

module.exports = mongoose.model('QTable', qTableSchema);
