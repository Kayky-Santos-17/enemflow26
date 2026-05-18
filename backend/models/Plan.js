const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  titulo: { type: String, default: 'Plano de Estudos' },
  materias: [String],
  tempoDisponivel: { type: String, default: '' },
  dificuldade: { type: String, default: 'medio' },
  cronograma: { type: String, default: '' },
}, { timestamps: true });

planSchema.index({ usuarioId: 1, createdAt: -1 });

module.exports = mongoose.model('Plan', planSchema);
