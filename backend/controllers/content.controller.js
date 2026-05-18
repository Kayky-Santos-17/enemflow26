const Content = require('../models/Content');

/**
 * Controller: content
 * Gerencia os materiais de estudo disponíveis na plataforma.
 */

// GET /contents — lista todos os conteúdos ativos
exports.list = async (req, res) => {
  try {
    const { materia } = req.query;

    const filter = { ativo: true };
    if (materia) filter.materia = materia;

    const contents = await Content.find(filter)
      .sort({ materia: 1, ordem: 1 })
      .select('-__v');

    res.json(contents);
  } catch (error) {
    console.error('[content.list]', error);
    res.status(500).json({ error: 'Erro ao buscar conteúdos.' });
  }
};

// GET /contents/:id — detalhe de um conteúdo
exports.getById = async (req, res) => {
  try {
    const content = await Content.findById(req.params.id).select('-__v');
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
