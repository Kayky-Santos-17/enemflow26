const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  content: { type: String, required: true, maxlength: 12000 },
}, { _id: false, timestamps: true });

const chatSchema = new mongoose.Schema({
  usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  titulo: { type: String, default: 'Nova conversa', maxlength: 120 },
  mensagens: [messageSchema],
  tipo: { type: String, enum: ['chat', 'exercicio', 'resumo', 'plano'], default: 'chat' },
}, { timestamps: true });

chatSchema.index({ usuarioId: 1, createdAt: -1 });
chatSchema.index({ usuarioId: 1, updatedAt: -1 });
chatSchema.index({ usuarioId: 1, tipo: 1, updatedAt: -1 });

chatSchema.pre('save', function capMessages(next) {
  if (this.mensagens.length > 60) {
    this.mensagens = this.mensagens.slice(-60);
  }
  next();
});

module.exports = mongoose.model('Chat', chatSchema);
