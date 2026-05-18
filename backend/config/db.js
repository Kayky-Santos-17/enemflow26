const mongoose = require('mongoose');

/**
 * Conecta ao MongoDB usando a URI definida em .env
 * Exibe mensagens de status no console durante o desenvolvimento.
 */
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    const fallbackUri = 'mongodb+srv://enem_flow:enemflow20266034@cluster0.awsypn2.mongodb.net/enemflow?retryWrites=true&w=majority';
    const uri = process.env.MONGO_URI || fallbackUri;
    
    if (!uri) {
      throw new Error('Variável MONGO_URI ausente.');
    }
    const conn = await mongoose.connect(uri);
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
