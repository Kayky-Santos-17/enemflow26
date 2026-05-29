const Content = require('../models/Content');
const mongoose = require('mongoose');
const {
  assertNoBase64PdfUrl,
  extractTextFromPdfBuffer,
  isBase64PdfUrl,
  resolvePdfBuffer,
} = require('../services/pdfProcessing.service');
const {
  deleteChunksForContent,
  replaceChunksForContent,
} = require('../services/contentChunk.service');

async function persistContentChunks(content, text) {
  const sourceText = String(text || '').trim();
  if (!content) return { count: 0 };

  if (sourceText.length < 40) {
    await deleteChunksForContent(content._id);
    content.chunkCount = 0;
    content.chunkedAt = undefined;
    await content.save();
    return { count: 0 };
  }

  const result = await replaceChunksForContent(content._id, sourceText, {
    skipEmbeddings: !process.env.EMBEDDINGS_ENDPOINT,
  });
  content.chunkCount = result.count;
  content.chunkedAt = new Date();
  await content.save();
  return result;
}

/**
 * Helper para extrair conteúdo textual de PDF ou de artigo.
 */
async function extractTextFromContent(tipo, url, titulo, descricao) {
  if (tipo === 'artigo') {
    const textoExtraido = `${titulo || ''}\n\n${descricao || ''}`.trim();
    return {
      textoExtraido,
      extractionStatus: 'ok',
      extractionWarning: '',
      pdfPageCount: 0,
      pdfTextLength: textoExtraido.length,
    };
  }

  if (tipo === 'pdf' && url) {
    try {
      assertNoBase64PdfUrl(url);
      const buffer = await resolvePdfBuffer(url);

      if (buffer) {
        const result = await extractTextFromPdfBuffer(buffer, { filename: titulo });
        return {
          textoExtraido: result.text,
          extractionStatus: result.extractionStatus,
          extractionWarning: result.extractionWarning,
          pdfPageCount: result.pageCount,
          pdfTextLength: result.textLength,
        };
      }
    } catch (err) {
      console.error('[extractTextFromContent] Erro ao extrair PDF:', err.message);
      return {
        textoExtraido: '',
        extractionStatus: 'error',
        extractionWarning: err.message,
        pdfPageCount: 0,
        pdfTextLength: 0,
      };
    }
  }

  return {
    textoExtraido: '',
    extractionStatus: tipo === 'pdf' ? 'empty' : 'pending',
    extractionWarning: tipo === 'pdf' ? 'Nao foi possivel localizar o PDF para extracao.' : '',
    pdfPageCount: 0,
    pdfTextLength: 0,
  };
}

/**
 * Controller: content
 * Gerencia os materiais de estudo disponíveis na plataforma.
 */

// GET /contents — lista todos os conteúdos ativos
exports.list = async (req, res) => {
  try {
    const { materia } = req.query;
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 100, 200));

    const filter = { ativo: true };
    if (materia) filter.materia = materia;

    // Remove campos pesados (url com base64 e textoExtraido) para otimizar o carregamento
    const contents = await Content.find(filter)
      .sort({ materia: 1, ordem: 1 })
      .limit(limit)
      .select('-__v -textoExtraido -url')
      .lean();

    res.json(contents);
  } catch (error) {
    console.error('[content.list]', error);
    res.status(500).json({ error: 'Erro ao buscar conteúdos.' });
  }
};

// GET /contents/:id — detalhe de um conteúdo
exports.getById = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conteudo invalido.' });
    }
    const content = await Content.findById(req.params.id).select('-__v').lean();
    if (!content) return res.status(404).json({ error: 'Conteúdo não encontrado.' });

    const payload = {
      ...content,
      hasTextoExtraido: Boolean(String(content.textoExtraido || '').trim()),
      extractionStatus: content.extractionStatus,
      extractionWarning: content.extractionWarning,
      pdfPageCount: content.pdfPageCount,
      pdfTextLength: content.pdfTextLength,
    };

    if (payload.tipo === 'pdf') {
      payload.mediaUrl = `/contents/${payload._id}/media`;
      if (isBase64PdfUrl(payload.url)) {
        delete payload.url;
      }
    }

    delete payload.textoExtraido;
    res.json(payload);
  } catch (error) {
    console.error('[content.getById]', error);
    res.status(500).json({ error: 'Erro ao buscar conteúdo.' });
  }
};

// GET /contents/:id/media - entrega PDFs sem expor base64 ao navegador
exports.media = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conteudo invalido.' });
    }

    const content = await Content.findById(req.params.id).select('tipo url titulo ativo').lean();
    if (!content || !content.ativo) return res.status(404).json({ error: 'Conteudo nao encontrado.' });
    if (content.tipo !== 'pdf' || !content.url) {
      return res.status(400).json({ error: 'Este conteudo nao possui PDF para exibir.' });
    }
    if (isBase64PdfUrl(content.url)) {
      return res.status(410).json({
        error: 'Este PDF antigo esta salvo em Base64 e precisa ser reenviado pelo painel admin.',
        code: 'PDF_BASE64_DISABLED',
      });
    }

    const buffer = await resolvePdfBuffer(content.url);
    if (!buffer) return res.status(404).json({ error: 'Arquivo PDF nao encontrado.' });

    const safeTitle = String(content.titulo || 'enemflow')
      .replace(/[^\w\s.-]/g, '')
      .trim()
      .replace(/\s+/g, '_') || 'enemflow';

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Length', buffer.length);
    res.setHeader('Content-Disposition', `inline; filename="${safeTitle}.pdf"`);
    res.setHeader('Cache-Control', 'private, max-age=300');
    res.send(buffer);
  } catch (error) {
    console.error('[content.media]', error.message);
    res.status(500).json({ error: 'Erro ao carregar PDF.' });
  }
};

// POST /contents — cria novo conteúdo (admin)
exports.create = async (req, res) => {
  try {
    const { titulo, descricao, materia, assunto, subassunto, tipo, url, tempoMedio, ordem } = req.body;

    if (tipo === 'pdf') assertNoBase64PdfUrl(url);
    const extraction = await extractTextFromContent(tipo, url, titulo, descricao);

    const content = await Content.create({
      titulo,
      descricao,
      materia,
      assunto,
      subassunto,
      tipo,
      url,
      tempoMedio,
      ordem,
      ...extraction,
      criadoPor: req.userId,
    });
    await persistContentChunks(content, extraction.textoExtraido).catch(error => {
      console.error('[content.create.chunks]', error.message);
    });

    res.status(201).json(content);
  } catch (error) {
    console.error('[content.create]', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Erro ao criar conteúdo.' });
  }
};

// PUT /contents/:id — atualiza conteúdo (admin)
exports.update = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conteudo invalido.' });
    }
    const { tipo, url, titulo, descricao } = req.body;
    if ((tipo === 'pdf' || url !== undefined) && isBase64PdfUrl(url)) {
      assertNoBase64PdfUrl(url);
    }
    
    // Se o tipo ou URL mudaram, atualiza o texto extraído
    const shouldReprocess = tipo !== undefined || url !== undefined || titulo !== undefined || descricao !== undefined;
    if (shouldReprocess) {
      const current = await Content.findById(req.params.id);
      if (current) {
        Object.assign(req.body, await extractTextFromContent(
          tipo !== undefined ? tipo : current.tipo,
          url !== undefined ? url : current.url,
          titulo !== undefined ? titulo : current.titulo,
          descricao !== undefined ? descricao : current.descricao
        ));
      }
    }

    const content = await Content.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!content) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
    if (shouldReprocess) {
      await persistContentChunks(content, content.textoExtraido).catch(error => {
        console.error('[content.update.chunks]', error.message);
      });
    }

    res.json(content);
  } catch (error) {
    console.error('[content.update]', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao atualizar conteúdo.' });
  }
};

// POST /contents/:id/reindex - reprocessa texto e chunks de um conteudo (admin)
exports.reindex = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conteudo invalido.' });
    }

    const content = await Content.findById(req.params.id);
    if (!content) return res.status(404).json({ error: 'Conteudo nao encontrado.' });

    const extraction = await extractTextFromContent(
      content.tipo,
      content.url,
      content.titulo,
      content.descricao
    );

    Object.assign(content, extraction);
    await content.save();

    const chunks = await persistContentChunks(content, extraction.textoExtraido);
    res.json({
      message: 'Conteudo reindexado com sucesso.',
      contentId: content._id,
      extractionStatus: content.extractionStatus,
      extractionWarning: content.extractionWarning,
      chunkCount: chunks.count,
    });
  } catch (error) {
    console.error('[content.reindex]', error);
    if (error.statusCode) {
      return res.status(error.statusCode).json({ error: error.message, code: error.code });
    }
    res.status(500).json({ error: 'Erro ao reindexar conteudo.' });
  }
};

// DELETE /contents/:id — desativa conteúdo (soft delete)
exports.remove = async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Conteudo invalido.' });
    }
    const content = await Content.findByIdAndUpdate(
      req.params.id,
      { ativo: false },
      { new: true }
    );
    if (!content) return res.status(404).json({ error: 'Conteúdo não encontrado.' });
    await deleteChunksForContent(content._id);

    res.json({ message: 'Conteúdo desativado com sucesso.' });
  } catch (error) {
    console.error('[content.remove]', error);
    res.status(500).json({ error: 'Erro ao desativar conteúdo.' });
  }
};
