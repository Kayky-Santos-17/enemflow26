const router = require('express').Router();
const { 
  register, 
  login, 
  logout,
  me, 
  updateProfile, 
  getAllUsers, 
  deleteUser,
  forgotPassword,
  resetPassword,
  updatePassword,
  resetAllXP
} = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');
const adminMiddleware = require('../middlewares/admin');

// --- Públicas ---
router.post('/register', register);
router.post('/login', login);

router.post('/forgot-password', forgotPassword);
router.post('/reset-password', resetPassword);

// --- Privadas (Requer Auth) ---
router.get('/me', auth, me);
router.post('/logout', auth, logout);
router.put('/me', auth, updateProfile);
router.put('/password', auth, updatePassword);

// --- Admin ---
router.get('/users', auth, adminMiddleware, getAllUsers);
router.delete('/users/:id', auth, adminMiddleware, deleteUser);
router.post('/system/reset-all-xp', auth, adminMiddleware, resetAllXP);

module.exports = router;
