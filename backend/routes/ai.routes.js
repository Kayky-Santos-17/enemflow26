const router = require('express').Router();
const { chat } = require('../controllers/ai.controller');
const auth = require('../middlewares/auth');

// POST /ai/chat
router.post('/chat', auth, chat);

module.exports = router;
