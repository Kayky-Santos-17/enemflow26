const mongoose = require('mongoose');

/**
 * Model: User
 * Representa um estudante da plataforma EnemFlow.
 *
 * Campos de gamificação:
 *  - xp        → pontos de experiência acumulados
 *  - progresso → array com o avanço por conteúdo (tempo + conclusão)
 */
const progressoSchema = new mongoose.Schema(
  {
    contentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Content',
      required: true,
    },
    tempoEstudado: { type: Number, default: 0 }, // em segundos
    concluido: { type: Boolean, default: false },
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    nome: {
      type: String,
      required: [true, 'Nome é obrigatório'],
      trim: true,
    },
    email: {
      type: String,
      required: [true, 'E-mail é obrigatório'],
      unique: true,
      lowercase: true,
      trim: true,
    },
    senha: {
      type: String,
      required: [true, 'Senha é obrigatória'],
      select: false, // nunca retorna a senha em queries normais
    },
    avatarUrl: {
      type: String,
      default: '',
    },
    role: {
      type: String,
      enum: ['user', 'admin', 'owner'],
      default: 'user',
    },
    sessionToken: {
      type: String,
      default: '',
    },
    xp: { type: Number, default: 0 },
    tema: { type: String, enum: ['dark', 'light'], default: 'dark' },
    progresso: [progressoSchema],
    blocked: { type: Boolean, default: false },
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true, // createdAt e updatedAt automáticos
  }
);

userSchema.index({ role: 1, blocked: 1 });
userSchema.index({ resetPasswordToken: 1, resetPasswordExpires: 1 });

userSchema.pre('save', function capProgress(next) {
  if (this.progresso.length > 500) {
    this.progresso = this.progresso.slice(-500);
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
