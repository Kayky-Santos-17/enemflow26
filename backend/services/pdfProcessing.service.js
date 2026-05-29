const axios = require('axios');
const fs = require('fs');
const path = require('path');
const pdfParse = require('pdf-parse');

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const MIN_TEXT_CHARS_PER_PAGE = 80;
const CHUNK_SIZE = 1800;
const CHUNK_OVERLAP = 220;

function normalizePdfText(value) {
  return String(value || '')
    .replace(/\u0000/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function isBase64PdfUrl(url) {
  return String(url || '').startsWith('data:application/pdf;base64,');
}

function assertNoBase64PdfUrl(url) {
  if (isBase64PdfUrl(url)) {
    const error = new Error('PDF em Base64/localStorage nao e mais aceito. Envie o arquivo via upload backend ou use uma URL segura.');
    error.statusCode = 400;
    error.code = 'PDF_BASE64_DISABLED';
    throw error;
  }
}

async function resolvePdfBuffer(url) {
  if (!url) return null;
  assertNoBase64PdfUrl(url);

  if (url.includes('/uploads/')) {
    const filename = decodeURIComponent(url.split('/uploads/')[1].split(/[?#]/)[0]);
    const filepath = path.join(__dirname, '../uploads', path.basename(filename));
    return fs.promises.readFile(filepath).catch(() => null);
  }

  if (url.startsWith('http')) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: Number(process.env.PDF_FETCH_TIMEOUT_MS) || 12000,
      maxContentLength: Number(process.env.PDF_FETCH_MAX_BYTES) || DEFAULT_MAX_BYTES,
      headers: { Accept: 'application/pdf,*/*' },
    });
    return Buffer.from(response.data);
  }

  return null;
}

async function runOcrFallback(buffer, metadata = {}) {
  const endpoint = process.env.OCR_ENDPOINT;
  if (!endpoint) {
    return {
      text: '',
      engine: 'none',
      warning: 'PDF aparenta ser escaneado. Configure OCR_ENDPOINT ou processe este arquivo com OCR antes de enviar ao Tutor IA.',
    };
  }

  const response = await axios.post(endpoint, {
    filename: metadata.filename || 'documento.pdf',
    contentType: 'application/pdf',
    base64: buffer.toString('base64'),
  }, {
    timeout: Number(process.env.OCR_TIMEOUT_MS) || 90000,
    maxBodyLength: Number(process.env.OCR_MAX_BODY_BYTES) || DEFAULT_MAX_BYTES + 1024 * 1024,
  });

  return {
    text: normalizePdfText(response.data?.text || ''),
    engine: response.data?.engine || 'external',
    warning: response.data?.warning || '',
  };
}

async function extractTextFromPdfBuffer(buffer, metadata = {}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    const error = new Error('Arquivo PDF invalido.');
    error.statusCode = 400;
    error.code = 'PDF_INVALID_BUFFER';
    throw error;
  }

  const parsed = await pdfParse(buffer);
  let text = normalizePdfText(parsed.text);
  const pageCount = parsed.numpages || 0;
  const textLength = text.length;
  const charsPerPage = pageCount ? textLength / pageCount : textLength;
  const scannedLike = pageCount > 0 && charsPerPage < MIN_TEXT_CHARS_PER_PAGE;

  const result = {
    text,
    pageCount,
    textLength,
    charsPerPage,
    scannedLike,
    extractionStatus: textLength >= 40 ? 'ok' : 'empty',
    extractionWarning: '',
    ocrEngine: '',
  };

  if (scannedLike || textLength < 40) {
    const ocr = await runOcrFallback(buffer, metadata);
    if (ocr.text && ocr.text.length > text.length) {
      text = ocr.text;
      result.text = text;
      result.textLength = text.length;
      result.charsPerPage = pageCount ? text.length / pageCount : text.length;
      result.extractionStatus = 'ocr';
      result.extractionWarning = ocr.warning || '';
      result.ocrEngine = ocr.engine;
      result.scannedLike = false;
      return result;
    }

    result.extractionStatus = 'needs_ocr';
    result.extractionWarning = ocr.warning;
  }

  return result;
}

function tokenizeQuery(query) {
  return String(query || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/[^a-z0-9]+/i)
    .filter(word => word.length >= 4);
}

function chunkText(text, chunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP) {
  const normalized = normalizePdfText(text);
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  while (start < normalized.length) {
    const end = Math.min(start + chunkSize, normalized.length);
    const raw = normalized.slice(start, end);
    chunks.push({
      index: chunks.length,
      start,
      end,
      text: raw.trim(),
    });
    if (end >= normalized.length) break;
    start = Math.max(0, end - overlap);
  }
  return chunks.filter(chunk => chunk.text.length >= 40);
}

function selectRelevantChunks(text, query, options = {}) {
  const maxChunks = Math.max(1, Math.min(Number(options.maxChunks) || 4, 8));
  const chunks = chunkText(text, options.chunkSize || CHUNK_SIZE, options.overlap || CHUNK_OVERLAP);
  if (!chunks.length) return [];

  const terms = tokenizeQuery(query);
  if (!terms.length) return chunks.slice(0, maxChunks);

  return chunks
    .map(chunk => {
      const lower = chunk.text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      const score = terms.reduce((sum, term) => sum + (lower.includes(term) ? 1 : 0), 0);
      return { ...chunk, score };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, maxChunks)
    .sort((a, b) => a.index - b.index);
}

function buildPdfContext(text, query, options = {}) {
  const chunks = selectRelevantChunks(text, query, options);
  return chunks
    .map(chunk => `[Trecho ${chunk.index + 1}]\n${chunk.text}`)
    .join('\n\n');
}

module.exports = {
  assertNoBase64PdfUrl,
  buildPdfContext,
  chunkText,
  extractTextFromPdfBuffer,
  isBase64PdfUrl,
  resolvePdfBuffer,
  selectRelevantChunks,
};
