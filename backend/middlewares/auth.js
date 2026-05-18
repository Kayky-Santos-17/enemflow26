const jwt = require('jsonwebtoken');

/**
 * Middleware: auth
 * Verifica o JWT enviado no header Authorization (Bearer <token>).
 *
 * Em caso de sucesso, injeta req.userId para uso nos controllers.
 * Em caso de falha, retorna 401 imediatamente.
 */
module.exports = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  // Verifica se o header existe e tem o formato correto
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticação não fornecido.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Consulta o usuário no banco para checar o sessionToken e confirmar se a conta ainda é válida
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('role sessionToken');
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    // Se não for admin, verifica se o login foi sobrescrito por outro aparelho
    if (user.role !== 'admin' && user.sessionToken !== decoded.sessionToken) {
      return res.status(401).json({ error: 'Sessão expirada. Alguém acessou esta conta em outro dispositivo.' });
    }

    req.userId = decoded.id; // disponível em todos os controllers seguintes
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expirado. Faça login novamente.' });
    }
    return res.status(401).json({ error: 'Token inválido.' });
  }
};
