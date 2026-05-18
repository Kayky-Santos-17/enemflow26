const mongoose = require('mongoose');

const summarySchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  titulo: { type: String, default: 'Resumo' },
  textoOriginal: { type: String, default: '' },
  conteudo: { type: String, required: true },
  fonte: { type: String, enum: ['texto', 'pdf', 'imagem', 'txt'], default: 'texto' },
}, { timestamps: true });

summarySchema.index({ usuarioId: 1, createdAt: -1 });

module.exports = mongoose.model('Summary', summarySchema);
