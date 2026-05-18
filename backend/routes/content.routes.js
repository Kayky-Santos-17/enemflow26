const router = require('express').Router();
const { list, getById, create, update, remove } = require('../controllers/content.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// GET /contents?materia=Matemática — público
router.get('/', list);

// GET /contents/:id — público
router.get('/:id', getById);

// POST /contents — requer auth + admin
router.post('/', auth, admin, create);

// PUT /contents/:id — requer auth + admin
router.put('/:id', auth, admin, update);

// DELETE /contents/:id — requer auth + admin (soft delete)
router.delete('/:id', auth, admin, remove);

module.exports = router;
