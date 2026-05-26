const express = require('express');
const router = express.Router();
const qLearningController = require('../controllers/qlearning.controller');
const verifyToken = require('../middlewares/auth');

// Rotas protegidas (Requer login)
router.use(verifyToken);

// GET /api/ia/recomendacao
router.get('/recomendacao', qLearningController.getRecommendation);

// POST /api/ia/treinar
router.post('/treinar', qLearningController.trainAgent);

module.exports = router;
