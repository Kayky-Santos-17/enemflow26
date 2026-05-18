const mongoose = require('mongoose');
const dns = require('dns');

// Força DNS público para contornar bloqueio de SRV da operadora
dns.setServers(['8.8.8.8', '1.1.1.1']);

const URI = 'mongodb+srv://enem_flow:enemflow20266034@cluster0.awsypn2.mongodb.net/enemflow?retryWrites=true&w=majority';

async function testar() {
  console.log('⏳ Tentando conectar ao MongoDB Atlas...');
  try {
    await mongoose.connect(URI);
    console.log('✅ SUCESSO ABSOLUTO! A conexão com o banco funcionou perfeitamente.');
    process.exit(0);
  } catch (error) {
    console.log('❌ FALHA AO CONECTAR!');
    console.log('Detalhes do Erro:');
    console.log(error.message);
    process.exit(1);
  }
}

testar();
