const rateLimit = require('express-rate-limit');

// Rate limiter geral para API
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100,
  message: { error: 'Muitas requisições. Tente novamente em alguns minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para rotas de IA (mais restritivo)
const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minuto
  max: 10,
  message: { error: 'Limite de requisições de IA atingido. Aguarde 1 minuto.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter para login/registro (proteção contra brute force)
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Muitas tentativas de login. Tente novamente em 15 minutos.' },
  standardHeaders: true,
  legacyHeaders: false,
});

module.exports = { apiLimiter, aiLimiter, authLimiter };
