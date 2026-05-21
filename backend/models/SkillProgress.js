const mongoose = require('mongoose');

const skillProgressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  skillId: {
    type: String, // ex: "M1", "M2", ..., "N1", ..., "H1", ..., "L1"
    required: true
  },
  area: {
    type: String, // "Matemática", "Natureza", "Humanas", "Linguagens", "Redação"
    required: true
  },
  acertos: { type: Number, default: 0 },
  total: { type: Number, default: 0 },
  tempoEstudado: { type: Number, default: 0 }, // em segundos
  nivel: {
    type: String,
    enum: ['Não avaliado', 'Iniciante', 'Em desenvolvimento', 'Proficiente'],
    default: 'Não avaliado'
  },
  qValue: { type: Number, default: 0.0 }, // Valor Q para o algoritmo de Aprendizado por Reforço
  historico: [{
    correto: Boolean,
    tempo: Number,
    timestamp: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

skillProgressSchema.index({ userId: 1, skillId: 1 }, { unique: true });

module.exports = mongoose.model('SkillProgress', skillProgressSchema);
