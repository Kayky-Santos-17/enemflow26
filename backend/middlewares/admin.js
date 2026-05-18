const User = require('../models/User');

/**
 * Middleware: admin
 * Garante que o usuário autenticado tem role = 'admin'.
 *
 * DEVE ser usado após o middleware `auth` (que seta req.userId).
 *
 * Fluxo: auth → admin → controller
 */
module.exports = async (req, res, next) => {
  try {
    const user = await User.findById(req.userId).select('role');

    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.role !== 'admin') {
      return res.status(403).json({ error: 'Acesso negado. Requer permissão de administrador.' });
    }

    next();
  } catch (error) {
    console.error('[middleware.admin]', error);
    res.status(500).json({ error: 'Erro ao verificar permissões.' });
  }
};
