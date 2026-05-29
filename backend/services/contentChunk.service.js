const ContentChunk = require('../models/ContentChunk');
const { chunkText } = require('./pdfProcessing.service');

function estimateTokens(text) {
  return Math.ceil(String(text || '').length / 4);
}

function tokenizeQuery(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter(word => word.length >= 4);
}

function scoreChunk(chunk, terms) {
  if (!terms.length) return 0;
  const text = String(chunk.text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
  return terms.reduce((score, term) => score + (text.includes(term) ? 1 : 0), 0);
}

async function replaceChunksForContent(contentId, text, options = {}) {
  await ContentChunk.deleteMany({ contentId });

  const chunks = chunkText(text, options.chunkSize, options.overlap);
  if (!chunks.length) return { count: 0 };

  const docs = chunks.map(chunk => ({
    contentId,
    chunkIndex: chunk.index,
    start: chunk.start,
    end: chunk.end,
    text: chunk.text,
    tokenCountEstimate: estimateTokens(chunk.text),
    embeddingStatus: options.skipEmbeddings ? 'skipped' : 'pending',
  }));

  await ContentChunk.insertMany(docs, { ordered: true });
  return { count: docs.length };
}

async function deleteChunksForContent(contentIds) {
  const ids = (Array.isArray(contentIds) ? contentIds : [contentIds]).filter(Boolean);
  if (!ids.length) return { deletedCount: 0 };
  return ContentChunk.deleteMany({ contentId: { $in: ids } });
}

async function getRelevantChunksForContent(contentId, query, options = {}) {
  const maxChunks = Math.max(1, Math.min(Number(options.maxChunks) || 4, 8));
  const chunks = await ContentChunk.find({ contentId })
    .sort({ chunkIndex: 1 })
    .limit(Number(options.scanLimit) || 300)
    .lean();

  if (!chunks.length) return [];

  const terms = tokenizeQuery(query);
  if (!terms.length) return chunks.slice(0, maxChunks);

  return chunks
    .map(chunk => ({ ...chunk, score: scoreChunk(chunk, terms) }))
    .sort((a, b) => b.score - a.score || a.chunkIndex - b.chunkIndex)
    .slice(0, maxChunks)
    .sort((a, b) => a.chunkIndex - b.chunkIndex);
}

async function buildContentContext(contentId, query, fallbackText = '', options = {}) {
  const chunks = await getRelevantChunksForContent(contentId, query, options);
  if (chunks.length) {
    return chunks
      .map(chunk => `[Trecho ${chunk.chunkIndex + 1}]\n${chunk.text}`)
      .join('\n\n');
  }

  return String(fallbackText || '').slice(0, Number(options.fallbackChars) || 6000);
}

module.exports = {
  buildContentContext,
  deleteChunksForContent,
  getRelevantChunksForContent,
  replaceChunksForContent,
};
