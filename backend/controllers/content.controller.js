const Content = require('../models/Content');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

/**
 * Helper para extrair conteúdo textual de PDF ou de artigo.
 */
async function resolvePdfBuffer(url) {
  if (!url) return null;

  if (url.includes('/uploads/')) {
    const filename = url.split('/uploads/')[1];
    const filepath = path.join(__dirname, '../uploads', filename);
    return fs.promises.readFile(filepath).catch(() => null);
  }

  if (url.startsWith('data:application/pdf;base64,')) {
    const base64Data = url.split(',')[1];
    return Buffer.from(base64Data, 'base64');
  }

  if (url.startsWith('http')) {
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: Number(process.env.PDF_FETCH_TIMEOUT_MS) || 12000,
      maxContentLength: Number(process.env.PDF_FETCH_MAX_BYTES) || 10 * 1024 * 1024,
    });
    return Buffer.from(response.data);
  }

  return null;
}

async function extractTextFromContent(tipo, url, titulo, descricao) {
  if (tipo === 'artigo') {
    return `${titulo}\n\n${descricao}`;
  }

  if (tipo === 'pdf' && url) {
    try {
      const buffer = await resolvePdfBuffer(url);

      if (buffer) {
        const data = await pdfParse(buffer);
        return data.text;
      }
    } catch (err) {
      console.error('[extractTextFromContent] Erro ao extrair PDF:', err.message);
    }
  }

  return '';
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
    };

    if (payload.tipo === 'pdf') {
      payload.mediaUrl = `/contents/${payload._id}/media`;
      if (String(payload.url || '').startsWith('data:application/pdf;base64,')) {
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

    const textoExtraido = await extractTextFromContent(tipo, url, titulo, descricao);

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
      textoExtraido,
      criadoPor: req.userId,
    });

    res.status(201).json(content);
  } catch (error) {
    console.error('[content.create]', error);
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
    
    // Se o tipo ou URL mudaram, atualiza o texto extraído
    if (tipo !== undefined || url !== undefined || titulo !== undefined || descricao !== undefined) {
      const current = await Content.findById(req.params.id);
      if (current) {
        req.body.textoExtraido = await extractTextFromContent(
          tipo !== undefined ? tipo : current.tipo,
          url !== undefined ? url : current.url,
          titulo !== undefined ? titulo : current.titulo,
          descricao !== undefined ? descricao : current.descricao
        );
      }
    }

    const content = await Content.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true }
    );
    if (!content) return res.status(404).json({ error: 'Conteúdo não encontrado.' });

    res.json(content);
  } catch (error) {
    console.error('[content.update]', error);
    res.status(500).json({ error: 'Erro ao atualizar conteúdo.' });
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

    res.json({ message: 'Conteúdo desativado com sucesso.' });
  } catch (error) {
    console.error('[content.remove]', error);
    res.status(500).json({ error: 'Erro ao desativar conteúdo.' });
  }
};
