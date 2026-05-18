const mongoose = require('mongoose');

/**
 * Conecta ao MongoDB usando a URI definida em .env
 * Exibe mensagens de status no console durante o desenvolvimento.
 */
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    if (!process.env.MONGO_URI) {
      throw new Error('Variável MONGO_URI ausente.');
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`✅ MongoDB conectado: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erro no Banco: ${error.message}`);
  }
};

// Eventos de conexão para monitoramento
mongoose.connection.on('disconnected', () => {
  console.warn('⚠️  MongoDB desconectado');
});

mongoose.connection.on('reconnected', () => {
  console.log('🔄 MongoDB reconectado');
});

module.exports = connectDB;
