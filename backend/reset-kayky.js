const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const User = require('./models/User');

async function resetUserPassword() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const email = 'kayky.ys29@gmail.com';
    const novaSenha = 'kayky123';
    const hash = await bcrypt.hash(novaSenha, 10);

    const user = await User.findOneAndUpdate(
      { email: email.toLowerCase() },
      { senha: hash },
      { new: true }
    );

    if (user) {
      console.log(`✅ Senha resetada com sucesso para o usuário: ${email}`);
      console.log(`🔑 Nova senha temporária: ${novaSenha}`);
    } else {
      console.log(`❌ Usuário ${email} não encontrado no banco de dados.`);
    }
    process.exit(0);
  } catch (err) {
    console.error('Erro ao resetar senha:', err);
    process.exit(1);
  }
}

resetUserPassword();
