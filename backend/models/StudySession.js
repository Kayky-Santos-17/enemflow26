const mongoose = require('mongoose');

/**
 * Model: StudySession
 * Registra cada sessão de estudo de um usuário.
 *
 * Por que um model separado em vez de só usar User.progresso?
 *  → Permite histórico completo de sessões (analytics, ranking, etc.)
 *  → Facilita calcular tempo médio por dia, streak de estudos, etc.
 */
const studySessionSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
    },
    iniciadaEm: {
      type: Date,
      default: Date.now,
    },
    encerradaEm: {
      type: Date,
    },
    duracao: {
      type: Number, // em segundos
      default: 0,
    },
    xpGanho: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Índices para queries de dashboard e ranking
studySessionSchema.index({ userId: 1, iniciadaEm: -1 });
studySessionSchema.index({ contentId: 1 });

module.exports = mongoose.model('StudySession', studySessionSchema);
