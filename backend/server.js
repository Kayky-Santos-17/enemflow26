require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const { getDbStatus } = require('./config/db');
const { apiLimiter, authLimiter } = require('./middlewares/rateLimiter');

// ── Conexão com MongoDB ──────────────────────────────────────────────────────
connectDB();

async function requireDatabase(req, res, next) {
  if (mongoose.connection.readyState !== 1) {
    await connectDB();
  }

  const status = getDbStatus();
  if (!status.connected) {
    return res.status(503).json({
      error: 'Banco de dados temporariamente indisponivel.',
      details: {
        connected: false,
        readyState: status.readyState,
        hasMongoUri: status.hasMongoUri,
        reason: status.lastError,
      },
    });
  }

  return next();
}

// ── App Express ──────────────────────────────────────────────────────────────
const app = express();

// Confia nos cabeçalhos de proxy (essencial na Vercel para o express-rate-limit)
app.set('trust proxy', 1);

// Middlewares globais
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ limit: '20mb', extended: false }));

// ── Servir Uploads ──────────────────────────────────────────────────────────
const path = require('path');
const fs = require('fs');
const uploadsDir = path.join(__dirname, 'uploads');

// Só tenta criar a pasta se não estiver em produção (evita erro na Vercel)
if (process.env.NODE_ENV !== 'production' && !fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir);
}
app.use('/uploads', express.static(uploadsDir));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

app.use(
  cors({
    origin: process.env.NODE_ENV === 'production' ? (process.env.FRONTEND_URL || '*') : '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// Rate limiter global
app.use('/api/', apiLimiter);

// Log de requisições (apenas em dev)
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Health check
app.get('/health', (req, res) => {
  const db = getDbStatus();
  res.json({
    status: 'ok',
    connected: db.connected,
    env: process.env.NODE_ENV,
    db: {
      readyState: db.readyState,
      hasMongoUri: db.hasMongoUri,
      reason: db.lastError,
    },
  });
});

// ── Rotas da API ─────────────────────────────────────────────────────────────

// Auth (com rate limit mais restritivo para login/registro)
app.use('/auth', requireDatabase, authLimiter, require('./routes/auth.routes'));

// Conteúdos e estudo (existentes)
app.use('/contents', requireDatabase, require('./routes/content.routes'));
app.use('/study',    requireDatabase, require('./routes/study.routes'));
app.use('/upload',   requireDatabase, require('./routes/upload.routes'));

// IA e novas funcionalidades
app.use('/api/chat',    requireDatabase, require('./routes/chat.routes'));
app.use('/api/plan',    requireDatabase, require('./routes/plan.routes'));
app.use('/api/summary', requireDatabase, require('./routes/summary.routes'));
app.use('/api/owner',   requireDatabase, require('./routes/owner.routes'));
app.use('/api/ai-adaptation', requireDatabase, require('./routes/ai-adaptation.routes'));
app.use('/api/ia', requireDatabase, require('./routes/qlearning.routes'));

// Rota legada (mantém compatibilidade com frontend antigo)
app.use('/ai', requireDatabase, require('./routes/ai.routes'));

// ── Handler de rotas não encontradas ─────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Rota ${req.method} ${req.path} não encontrada.` });
});

// ── Handler de erros globais ──────────────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('[GlobalError]', err.stack);
  res.status(500).json({ error: 'Erro interno do servidor.' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// Exporta o app para a Vercel
module.exports = app;

// Só inicia o servidor se não estiver na Vercel (localmente)
if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`🚀 EnemFlow API rodando → http://localhost:${PORT}`);
    console.log(`📋 Health check      → http://localhost:${PORT}/health`);
    console.log(`🌍 Ambiente          → ${process.env.NODE_ENV}`);
  });
}
