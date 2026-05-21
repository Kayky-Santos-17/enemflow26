const express = require('express');
const router = express.Router();
const aiAdaptationController = require('../controllers/ai-adaptation.controller');
const authMiddleware = require('../middlewares/auth');

// Todas as rotas de IA Adaptativa são protegidas
router.use(authMiddleware);

// GET /api/ai-adaptation/skills
router.get('/skills', aiAdaptationController.getSkills);

// GET /api/ai-adaptation/recommendations
router.get('/recommendations', aiAdaptationController.getRecommendations);

// POST /api/ai-adaptation/solve
router.post('/solve', aiAdaptationController.solveQuestion);

// POST /api/ai-adaptation/simulate
router.post('/simulate', aiAdaptationController.simulateScore);

// POST /api/ai-adaptation/feedback
router.post('/feedback', aiAdaptationController.reportFeedback);

module.exports = router;
