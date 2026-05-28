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
    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: 'JWT_SECRET nÃ£o configurado no servidor.' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Consulta o usuário no banco para checar o sessionToken, blocked e confirmar se a conta ainda é válida
    const User = require('../models/User');
    const user = await User.findById(decoded.id).select('role sessionToken blocked');
    
    if (!user) {
      return res.status(401).json({ error: 'Usuário não encontrado.' });
    }

    if (user.blocked) {
      return res.status(403).json({ error: 'Acesso recusado. Esta conta foi bloqueada pelo administrador OWNER.' });
    }

    // Verifica se o login foi sobrescrito, encerrado ou invalidado.
    if (decoded.sessionToken && user.sessionToken !== decoded.sessionToken) {
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
