const mongoose = require('mongoose');

// Força o Node.js a usar os DNS públicos do Google e Cloudflare APENAS localmente
// Isso evita que a Vercel derrube o servidor devido às restrições de sandbox de rede dela.
if (!process.env.VERCEL) {
  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('⚡ DNS Bypass local ativado (Google/Cloudflare)');
  } catch (e) {
    console.warn('⚠️ Não foi possível configurar servidores DNS personalizados:', e.message);
  }
}

/**
 * Conecta ao MongoDB usando a URI definida em .env
 * Exibe mensagens de status no console durante o desenvolvimento.
 */
const connectDB = async () => {
  if (mongoose.connection.readyState >= 1) return;

  try {
    // 1. Tenta usar a variável de ambiente (Vercel Dashboard ou .env local)
    let uri = process.env.MONGO_URI;
    
    if (uri) {
      uri = uri.replace(/["']/g, "").trim();
      // Corrige a senha caso a variável de ambiente (Vercel ou local) esteja com a antiga
      if (uri.includes('enemfl%40w20266034!%238%23')) {
        uri = uri.replace('enemfl%40w20266034!%238%23', 'enemflow20266034');
      }
    } else {
      // 2. Fallback usando a connection string correta
      uri = 'mongodb+srv://enem_flow:enemflow20266034@cluster0.awsypn2.mongodb.net/enemflow?retryWrites=true&w=majority';
    }
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Timeout de 5s para evitar travar o Vercel Serverless
      connectTimeoutMS: 5000,
    });
    console.log(`✅ MongoDB conectado com sucesso via Réplica Set: ${conn.connection.host}`);
  } catch (error) {
    console.error(`❌ Erro catastrófico de conexão no Banco: ${error.message}`);
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
