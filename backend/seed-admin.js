const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dns = require('dns');
try {
  dns.setServers(['8.8.8.8', '8.8.4.4']);
} catch (e) {}
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const User = require('./models/User');
  const email = 'enemflow2026@gmail.com';
  const senha = 'enemfl@w266034!#8#';
  const hash = await bcrypt.hash(senha, 10);
  
  await User.findOneAndUpdate(
    { email },
    { nome: 'Admin Supremo', email, senha: hash, role: 'admin' },
    { upsert: true, new: true }
  );
  
  console.log('✅ Conta de Administrador criada com sucesso!');
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
