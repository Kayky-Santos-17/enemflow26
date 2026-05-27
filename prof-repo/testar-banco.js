const mongoose = require('mongoose');
const dns = require('dns');
require('dotenv').config({ path: './backend/.env' });

dns.setServers(['8.8.8.8', '1.1.1.1']);

const URI = process.env.MONGO_URI;

async function testar() {
  if (!URI) {
    console.log('MONGO_URI nao configurada. Defina a variavel em backend/.env antes de testar.');
    process.exit(1);
  }

  console.log('Tentando conectar ao MongoDB...');
  try {
    await mongoose.connect(URI);
    console.log('Conexao com o banco funcionou.');
    process.exit(0);
  } catch (error) {
    console.log('Falha ao conectar.');
    console.log('Detalhes do erro:');
    console.log(error.message);
    process.exit(1);
  }
}

testar();
