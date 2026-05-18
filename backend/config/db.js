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
    // Usamos a string de conexão padrão (non-SRV) do MongoDB Atlas.
    // Esta URI especifica os 3 nós exatos do replica set e o nome do cluster,
    // o que ignora completamente a resolução SRV DNS (que falha na Vercel).
    const nonSrvUri = 'mongodb://enem_flow:enemflow20266034@ac-rqbu7rt-shard-00-00.awsypn2.mongodb.net:27017,ac-rqbu7rt-shard-00-01.awsypn2.mongodb.net:27017,ac-rqbu7rt-shard-00-02.awsypn2.mongodb.net:27017/enemflow?ssl=true&replicaSet=atlas-143j8a-shard-0&authSource=admin&retryWrites=true&w=majority';
    
    let uri = nonSrvUri;
    
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000, // Falha rapidamente (5s) em vez de travar por 30s se houver queda
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
