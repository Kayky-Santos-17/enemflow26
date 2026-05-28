const User = require('../models/User');
const Chat = require('../models/Chat');
const Content = require('../models/Content');
const StudySession = require('../models/StudySession');
const SkillProgress = require('../models/SkillProgress');
const QTable = require('../models/QTable');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
const senhaValida = (senha) => typeof senha === 'string' && senha.length >= 8 && senha.length <= 128;

function ensureObjectId(id, label = 'ID') {
  if (!mongoose.isValidObjectId(id)) {
    const error = new Error(`${label} invalido.`);
    error.statusCode = 400;
    throw error;
  }
}

// Auxiliar: Calcula tamanho dos uploads
// Auxiliar: Calcula tamanho dos uploads assincronamente para não bloquear o event loop
const getFolderSizeAsync = async (dirPath) => {
  let size = 0;
  try {
    if (fs.existsSync(dirPath)) {
      const files = await fs.promises.readdir(dirPath);
      for (const file of files) {
        const filePath = path.join(dirPath, file);
        const stats = await fs.promises.stat(filePath);
        if (stats.isFile()) {
          size += stats.size;
        }
      }
    }
  } catch (err) {
    console.error('Erro ao ler pasta de uploads:', err);
  }
  return size;
};

// Auxiliar: Formatação de bytes para KB/MB
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const CONFIRMATIONS = {
  deleteStudent: 'EXCLUIR ALUNO',
  resetStudentPassword: 'REDEFINIR SENHA',
  resetStudentProgress: 'ZERAR PROGRESSO',
  resetStudentXP: 'ZERAR XP',
  deleteSpecificChat: 'APAGAR CHAT',
  deleteUserChats: 'APAGAR CHATS DO ALUNO',
  deleteAllChats: 'APAGAR TUDO',
  cleanupOldChats: 'LIMPAR CHATS ANTIGOS',
  truncateMessageHistory: 'OTIMIZAR MENSAGENS',
};

async function verifyOwnerAction(req, action) {
  const expectedConfirmation = CONFIRMATIONS[action];
  const { ownerPassword, confirmation } = req.body || {};

  if (!expectedConfirmation) {
    const error = new Error('Acao owner sem frase de confirmacao configurada.');
    error.statusCode = 500;
    throw error;
  }

  if (confirmation !== expectedConfirmation) {
    const error = new Error(`Digite exatamente "${expectedConfirmation}" para confirmar esta acao.`);
    error.statusCode = 400;
    throw error;
  }

  if (!ownerPassword) {
    const error = new Error('Senha do OWNER obrigatoria para confirmar esta acao.');
    error.statusCode = 400;
    throw error;
  }

  const owner = await User.findById(req.userId).select('+senha role');
  if (!owner || owner.role !== 'owner') {
    const error = new Error('Acesso negado. Apenas OWNER pode executar esta acao.');
    error.statusCode = 403;
    throw error;
  }

  const passwordOk = await bcrypt.compare(ownerPassword, owner.senha);
  if (!passwordOk) {
    const error = new Error('Senha do OWNER invalida.');
    error.statusCode = 403;
    throw error;
  }

  console.warn(`[OwnerAction] ${action} confirmado por ${owner._id} em ${new Date().toISOString()}`);
}

function handleOwnerActionError(res, error, fallbackMessage) {
  res.status(error.statusCode || 500).json({ error: error.message || fallbackMessage });
}

// ─── GERENCIAMENTO DE ALUNOS ───────────────────────────────────────────────────

// Listar todos os estudantes
exports.listStudents = async (req, res) => {
  try {
    const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 200, 500));
    const students = await User.find({ role: 'user' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('nome email xp role blocked createdAt updatedAt')
      .lean();
    res.json(students);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao listar alunos.' });
  }
};

// Criar aluno
exports.createStudent = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'Nome, e-mail e senha são obrigatórios.' });
    }

    if (!emailValido(email)) {
      return res.status(400).json({ error: 'E-mail invalido.' });
    }
    if (!senhaValida(senha)) {
      return res.status(400).json({ error: 'A senha deve ter entre 8 e 128 caracteres.' });
    }

    const jaExiste = await User.findOne({ email: email.toLowerCase() });
    if (jaExiste) {
      return res.status(400).json({ error: 'Este e-mail já está em uso.' });
    }

    const hash = await bcrypt.hash(senha, 10);
    const newStudent = await User.create({
      nome,
      email: email.toLowerCase(),
      senha: hash,
      role: 'user'
    });

    res.status(201).json({
      message: 'Estudante criado com sucesso.',
      student: {
        _id: newStudent._id,
        nome: newStudent.nome,
        email: newStudent.email,
        role: newStudent.role,
        xp: newStudent.xp,
        blocked: newStudent.blocked,
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao criar estudante.' });
  }
};

// Deletar aluno
exports.deleteStudent = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'deleteStudent');
    const { id } = req.params;
    ensureObjectId(id, 'Estudante');
    const deleted = await User.findOneAndDelete({ _id: id, role: 'user' });
    if (!deleted) return res.status(404).json({ error: 'Estudante nao encontrado.' });
    // Remove dados relacionados
    await Chat.deleteMany({ usuarioId: id });
    await StudySession.deleteMany({ $or: [{ userId: id }, { usuarioId: id }] });
    await SkillProgress.deleteMany({ userId: id });
    await QTable.deleteMany({ userId: id });
    res.json({ message: 'Estudante e seus dados foram excluídos.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao excluir estudante.');
  }
};

// Bloquear estudante
exports.blockStudent = async (req, res) => {
  try {
    const { id } = req.params;
    ensureObjectId(id, 'Estudante');
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Aluno não encontrado.' });

    user.blocked = true;
    user.sessionToken = ''; // Desloga sessões ativas
    await user.save();
    res.json({ message: 'Estudante bloqueado com sucesso.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao bloquear estudante.');
  }
};

// Desbloquear estudante
exports.unblockStudent = async (req, res) => {
  try {
    const { id } = req.params;
    ensureObjectId(id, 'Estudante');
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Aluno não encontrado.' });

    user.blocked = false;
    await user.save();
    res.json({ message: 'Estudante desbloqueado com sucesso.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao desbloquear estudante.');
  }
};

// Alterar senha de estudante
exports.resetStudentPassword = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'resetStudentPassword');
    const { id } = req.params;
    const { novaSenha } = req.body;
    ensureObjectId(id, 'Estudante');
    if (!senhaValida(novaSenha)) {
      return res.status(400).json({ error: 'A nova senha deve ter entre 8 e 128 caracteres.' });
    }

    const hash = await bcrypt.hash(novaSenha, 10);
    const user = await User.findByIdAndUpdate(id, { senha: hash, sessionToken: '' });
    if (!user) return res.status(404).json({ error: 'Estudante não encontrado.' });

    res.json({ message: 'Senha do estudante redefinida com sucesso.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao redefinir senha do aluno.');
  }
};

// Limpar progresso do estudante
exports.resetStudentProgress = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'resetStudentProgress');
    const { id } = req.params;
    ensureObjectId(id, 'Estudante');
    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Estudante não encontrado.' });

    user.progresso = [];
    await user.save();
    await StudySession.deleteMany({ $or: [{ userId: id }, { usuarioId: id }] });
    await SkillProgress.deleteMany({ userId: id });
    await QTable.deleteMany({ userId: id });

    res.json({ message: 'Progresso e sessões de estudo do aluno foram resetados.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao resetar progresso.');
  }
};

// Resetar XP do estudante
exports.resetStudentXP = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'resetStudentXP');
    const { id } = req.params;
    ensureObjectId(id, 'Estudante');
    const user = await User.findByIdAndUpdate(id, { xp: 0 });
    if (!user) return res.status(404).json({ error: 'Estudante não encontrado.' });

    res.json({ message: 'Pontos de XP do estudante foram zerados.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao resetar XP do aluno.');
  }
};

// ─── GERENCIAMENTO DE CHATS ───────────────────────────────────────────────────

// Excluir conversa específica
exports.deleteSpecificChat = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'deleteSpecificChat');
    const { id } = req.params;
    ensureObjectId(id, 'Conversa');
    const chat = await Chat.findByIdAndDelete(id);
    if (!chat) return res.status(404).json({ error: 'Conversa não encontrada.' });
    res.json({ message: 'Conversa deletada com sucesso.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao deletar conversa.');
  }
};

// Excluir conversas de um estudante específico
exports.deleteUserChats = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'deleteUserChats');
    const { userId } = req.params;
    ensureObjectId(userId, 'Estudante');
    await Chat.deleteMany({ usuarioId: userId });
    res.json({ message: 'Todas as conversas do estudante foram deletadas.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao deletar conversas do aluno.');
  }
};

// Excluir absolutamente todas as conversas do banco
exports.deleteAllChats = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'deleteAllChats');
    await Chat.deleteMany({});
    res.json({ message: 'Histórico completo de chats da plataforma foi deletado.' });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao limpar banco de chats.');
  }
};

// Limpar conversas antigas (inativas há mais de X dias)
exports.cleanupOldChats = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'cleanupOldChats');
    const { days } = req.body;
    const diasLimite = Math.max(7, Math.min(parseInt(days, 10) || 30, 365));
    const limiteData = new Date();
    limiteData.setDate(limiteData.getDate() - diasLimite);

    const result = await Chat.deleteMany({ updatedAt: { $lt: limiteData } });
    res.json({ message: `Limpeza concluída. ${result.deletedCount} conversas inativas há mais de ${diasLimite} dias foram excluídas.` });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao limpar conversas antigas.');
  }
};

// Limpar mensagens e evitar crescimento do MongoDB (limita a no máximo 30 mensagens por chat ou remove antigas)
exports.truncateMessageHistory = async (req, res) => {
  try {
    await verifyOwnerAction(req, 'truncateMessageHistory');
    const chats = Chat.find({ 'mensagens.25': { $exists: true } }).select('mensagens').cursor();
    let totalTruncated = 0;

    for await (const chat of chats) {
      if (chat.mensagens && chat.mensagens.length > 25) {
        // Deixa apenas as últimas 20 mensagens para otimizar espaço
        chat.mensagens = chat.mensagens.slice(-20);
        await chat.save();
        totalTruncated++;
      }
    }

    res.json({ message: `Banco de mensagens limpo. ${totalTruncated} chats longos foram otimizados.` });
  } catch (error) {
    handleOwnerActionError(res, error, 'Erro ao truncar historico de mensagens.');
  }
};

// ─── VISUALIZAR MÉTRICAS DO SISTEMA ──────────────────────────────────────────

// Métricas de uso da plataforma
exports.getSystemMetrics = async (req, res) => {
  try {
    const totalAlunos = await User.countDocuments({ role: 'user' });
    const totalVideos = await Content.countDocuments({ tipo: 'video' });
    const totalPDFs = await Content.countDocuments({ tipo: 'pdf' });
    const totalMaterial = await Content.countDocuments({});

    // Calcula espaço físico usado na pasta uploads
    const uploadsDir = path.join(__dirname, '../uploads');
    const uploadsSizeBytes = await getFolderSizeAsync(uploadsDir);

    // Estimativa de armazenamento do MongoDB para manter consistência sem depender de DB stats restritos na nuvem
    const mongoEstimateBytes = (await User.countDocuments() * 1500) + (await Chat.countDocuments() * 4000) + (await Content.countDocuments() * 2000);
    const espacoTotalBytes = uploadsSizeBytes + mongoEstimateBytes;

    // Lista os PDFs cadastrados no sistema
    const pdfsList = await Content.find({ tipo: 'pdf' })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('titulo materia ativo updatedAt')
      .lean();
    
    // Lista os Vídeos cadastrados
    const videosList = await Content.find({ tipo: 'video' })
      .sort({ updatedAt: -1 })
      .limit(100)
      .select('titulo materia ativo updatedAt')
      .lean();

    res.json({
      metrics: {
        totalAlunos,
        totalVideos,
        totalPDFs,
        totalMaterial,
        espacoUsadoFisico: formatBytes(uploadsSizeBytes),
        espacoEstimadoBanco: formatBytes(mongoEstimateBytes),
        espacoTotal: formatBytes(espacoTotalBytes),
      },
      pdfs: pdfsList,
      videos: videosList
    });
  } catch (error) {
    console.error('[owner.getSystemMetrics]', error);
    res.status(500).json({ error: 'Erro ao compilar métricas do sistema.' });
  }
};
