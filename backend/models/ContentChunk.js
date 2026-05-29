const mongoose = require('mongoose');

const contentChunkSchema = new mongoose.Schema(
  {
    contentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Content', required: true, index: true },
    chunkIndex: { type: Number, required: true },
    start: { type: Number, default: 0 },
    end: { type: Number, default: 0 },
    text: { type: String, required: true, maxlength: 6000 },
    tokenCountEstimate: { type: Number, default: 0 },
    embedding: { type: [Number], default: undefined },
    embeddingModel: { type: String, default: '' },
    embeddingStatus: {
      type: String,
      enum: ['pending', 'indexed', 'skipped', 'error'],
      default: 'pending',
      index: true,
    },
    embeddingError: { type: String, default: '' },
  },
  { timestamps: true }
);

contentChunkSchema.index({ contentId: 1, chunkIndex: 1 }, { unique: true });
contentChunkSchema.index({ text: 'text' });

module.exports = mongoose.model('ContentChunk', contentChunkSchema);
