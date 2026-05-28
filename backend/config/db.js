const mongoose = require('mongoose');

let connectionPromise = null;
let lastConnectionError = null;

// Local DNS override only. Vercel must use its own network sandbox.
if (!process.env.VERCEL) {
  try {
    const dns = require('dns');
    dns.setServers(['8.8.8.8', '1.1.1.1']);
    console.log('DNS local configurado para Google/Cloudflare');
  } catch (error) {
    console.warn('Nao foi possivel configurar DNS local:', error.message);
  }
}

function sanitizeDbError(error) {
  if (!error) return null;
  const message = String(error.message || error);
  if (message.includes('MONGO_URI')) return message;
  if (message.includes('querySrv')) return 'Falha de DNS ao resolver o cluster MongoDB.';
  if (message.includes('bad auth') || message.includes('Authentication failed')) {
    return 'Falha de autenticacao no MongoDB. Confira usuario e senha da MONGO_URI.';
  }
  if (message.includes('timed out') || message.includes('ETIMEOUT')) {
    return 'Timeout ao conectar no MongoDB. Confira MONGO_URI e liberacao de rede no Atlas.';
  }
  return 'Falha ao conectar no MongoDB. Confira variaveis de ambiente e rede do Atlas.';
}

const connectDB = async () => {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  if (connectionPromise) return connectionPromise;

  connectionPromise = (async () => {
    let uri = process.env.MONGO_URI;

    if (!uri) {
      throw new Error('MONGO_URI nao configurada. Defina a connection string do MongoDB no .env ou no ambiente da Vercel.');
    }

    uri = uri.replace(/["']/g, '').trim();

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
      bufferCommands: false,
    });

    lastConnectionError = null;
    console.log(`MongoDB conectado: ${conn.connection.host}`);
    return conn.connection;
  })();

  try {
    return await connectionPromise;
  } catch (error) {
    lastConnectionError = error;
    console.error(`Erro de conexao MongoDB: ${sanitizeDbError(error)}`);
    return null;
  } finally {
    if (mongoose.connection.readyState !== 1) connectionPromise = null;
  }
};

function getDbStatus() {
  return {
    connected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    hasMongoUri: Boolean(process.env.MONGO_URI),
    lastError: sanitizeDbError(lastConnectionError),
  };
}

mongoose.connection.on('disconnected', () => {
  console.warn('MongoDB desconectado');
});

mongoose.connection.on('reconnected', () => {
  console.log('MongoDB reconectado');
});

module.exports = connectDB;
module.exports.getDbStatus = getDbStatus;
