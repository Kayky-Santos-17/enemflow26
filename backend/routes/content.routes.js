const router = require('express').Router();
const { list, getById, media, create, update, reindex, remove } = require('../controllers/content.controller');
const auth = require('../middlewares/auth');
const admin = require('../middlewares/admin');

// GET /contents?materia=Matemática — público
router.get('/', list);

// GET /contents/:id — público
router.get('/:id/media', media);
router.get('/:id', getById);

// POST /contents — requer auth + admin
router.post('/', auth, admin, create);

// PUT /contents/:id — requer auth + admin
router.put('/:id', auth, admin, update);

// POST /contents/:id/reindex — reprocessa texto e chunks (admin)
router.post('/:id/reindex', auth, admin, reindex);

// DELETE /contents/:id — requer auth + admin (soft delete)
router.delete('/:id', auth, admin, remove);

module.exports = router;
