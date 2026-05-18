const mongoose = require('mongoose');

/**
 * Model: Content
 * Representa um material de estudo disponível na plataforma.
 *
 * Campos principais:
 *  - titulo      → nome do conteúdo exibido ao aluno
 *  - descricao   → resumo do que será estudado
 *  - materia     → disciplina do ENEM (ex: "Matemática", "Redação")
 *  - tipo        → formato do conteúdo (video, pdf, artigo, exercicio)
 *  - url         → link para o recurso externo ou arquivo
 *  - tempoMedio  → tempo estimado de estudo em minutos
 *  - ordem       → posição na trilha de aprendizado
 *  - ativo       → controla visibilidade sem deletar
 */
const contentSchema = new mongoose.Schema(
  {
    titulo: {
      type: String,
      default: 'Material de Estudo',
      trim: true,
    },
    descricao: {
      type: String,
      default: '',
      trim: true,
    },
    materia: {
      type: String,
      required: [true, 'Matéria é obrigatória'],
      trim: true,
    },
    assunto: {
      type: String,
      default: 'Geral',
      trim: true,
    },
    subassunto: {
      type: String,
      default: '',
      trim: true,
    },
    tipo: {
      type: String,
      enum: ['video', 'pdf', 'artigo', 'exercicio'],
      default: 'artigo',
    },
    url: {
      type: String,
      default: '',
    },
    tempoMedio: {
      type: Number, // em minutos
      default: 30,
    },
    ordem: {
      type: Number,
      default: 0,
    },
    ativo: {
      type: Boolean,
      default: true,
    },
    criadoPor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  },
  {
    timestamps: true,
  }
);

// Índice para facilitar busca por matéria e ordenação
contentSchema.index({ materia: 1, ordem: 1 });

module.exports = mongoose.model('Content', contentSchema);
