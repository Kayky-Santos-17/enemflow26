const router = require('express').Router();
const { start, end, history } = require('../controllers/study.controller');
const auth = require('../middlewares/auth');

// POST /study/start
router.post('/start', auth, start);

// POST /study/end
router.post('/end', auth, end);

// GET /study/history/:userId
router.get('/history/:userId', auth, history);

module.exports = router;
