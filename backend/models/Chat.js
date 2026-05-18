const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true },
}, { _id: false, timestamps: true });

const chatSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  titulo: { type: String, default: 'Nova conversa' },
  mensagens: [messageSchema],
  tipo: { type: String, enum: ['chat', 'exercicio', 'resumo', 'plano'], default: 'chat' },
}, { timestamps: true });

// Índice para buscar conversas do usuário ordenadas
chatSchema.index({ usuarioId: 1, createdAt: -1 });

module.exports = mongoose.model('Chat', chatSchema);
