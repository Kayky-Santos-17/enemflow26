const router = require('express').Router();
const {
  sendMessage,
  listChats,
  getChat,
  deleteChat,
  deleteMessage,
  generateExercise,
  generateSimulado,
  startContentContextChat,
  clearAllChats
} = require('../controllers/chat.controller');
const auth = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');

// Todas as rotas requerem autenticação
router.use(auth);

router.get('/', listChats);
router.get('/:id', getChat);
router.post('/', aiLimiter, sendMessage);
router.post('/exercise', aiLimiter, generateExercise);
router.post('/simulado', aiLimiter, generateSimulado);
router.post('/content-context', aiLimiter, startContentContextChat);
router.delete('/', clearAllChats);
router.delete('/:chatId/messages/:messageId', deleteMessage);
router.delete('/:id', deleteChat);


module.exports = router;
