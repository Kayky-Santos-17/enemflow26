const Content = require('../models/Content');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const mongoose = require('mongoose');

/**
 * Helper para extrair conteúdo textual de PDF ou de artigo.
 */
async function extractTextFromContent(tipo, url, titulo, descricao) {
  if (tipo === 'artigo') {
    return `${titulo}\n\n${descricao}`;
  }

  if (tipo === 'pdf' && url) {
    try {
      let buffer;
      if (url.includes('/uploads/')) {
        // Arquivo local
        const filename = url.split('/uploads/')[1];
        const filepath = path.join(__dirname, '../uploads', filename);
        buffer = await fs.promises.readFile(filepath).catch(() => null);
      } else if (url.startsWith('data:application/pdf;base64,')) {
        // Arquivo Base64 (Comum em serverless como Vercel)
        const base64Data = url.split(',')[1];
        buffer = Buffer.from(base64Data, 'base64');
      }

      if (!buffer && url.startsWith('http')) {
        // Se for link externo, tenta fazer download
        const response = await axios.get(url, {
          responseType: 'arraybuffer',
          timeout: Number(process.env.PDF_FETCH_TIMEOUT_MS) || 12000,
          maxContentLength: Number(process.env.PDF_FETCH_MAX_BYTES) || 10 * 1024 * 1024,
        });
        buffer = Buffer.from(response.data);
      }

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

    res.json(content);
  } catch (error) {
    console.error('[content.getById]', error);
    res.status(500).json({ error: 'Erro ao buscar conteúdo.' });
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
