const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema(
  {
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: 'Chat', required: true, index: true },
    usuarioId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, maxlength: 12000 },
  },
  { timestamps: true }
);

chatMessageSchema.index({ chatId: 1, createdAt: 1 });
chatMessageSchema.index({ usuarioId: 1, createdAt: -1 });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
