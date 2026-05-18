const router = require('express').Router();
const { generate, list, getById, remove } = require('../controllers/plan.controller');
const auth = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');

router.use(auth);

router.get('/', list);
router.get('/:id', getById);
router.post('/', aiLimiter, generate);
router.delete('/:id', remove);

module.exports = router;
