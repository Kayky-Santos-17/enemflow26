const router = require('express').Router();
const ownerController = require('../controllers/owner.controller');
const auth = require('../middlewares/auth');
const User = require('../models/User');

// Middleware rígido: Apenas usuários com a role 'owner' podem acessar
const ownerOnly = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role');
    if (!user || user.role !== 'owner') {
      return res.status(403).json({ error: 'Acesso negado. Esta é uma ferramenta exclusiva do OWNER.' });
    }
    next();
  } catch (error) {
    res.status(500).json({ error: 'Erro ao verificar permissão do owner.' });
  }
};

// ─── Rotas do Painel Master Admin (OWNER) ───────────────────────────────────────

// Alunos
router.get('/users', auth, ownerOnly, ownerController.listStudents);
router.post('/users', auth, ownerOnly, ownerController.createStudent);
router.delete('/users/:id', auth, ownerOnly, ownerController.deleteStudent);
router.post('/users/:id/block', auth, ownerOnly, ownerController.blockStudent);
router.post('/users/:id/unblock', auth, ownerOnly, ownerController.unblockStudent);
router.post('/users/:id/reset-password', auth, ownerOnly, ownerController.resetStudentPassword);
router.post('/users/:id/reset-progress', auth, ownerOnly, ownerController.resetStudentProgress);
router.post('/users/:id/reset-xp', auth, ownerOnly, ownerController.resetStudentXP);

// Gerenciamento de Chats
router.delete('/chats/:id', auth, ownerOnly, ownerController.deleteSpecificChat);
router.delete('/chats/user/:userId', auth, ownerOnly, ownerController.deleteUserChats);
router.delete('/chats', auth, ownerOnly, ownerController.deleteAllChats);
router.post('/chats/cleanup', auth, ownerOnly, ownerController.cleanupOldChats);
router.post('/chats/truncate', auth, ownerOnly, ownerController.truncateMessageHistory);

// Métricas de Armazenamento e Recursos
router.get('/metrics', auth, ownerOnly, ownerController.getSystemMetrics);

module.exports = router;
