const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Gera um JWT assinado com o id do usuário e o token de sessão atual.
 * Expira conforme JWT_EXPIRES_IN definido no .env (padrão: 7d).
 */
const gerarToken = (userId, role = 'user', sessionToken = '') =>
  jwt.sign({ id: userId, role, sessionToken }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

/**
 * Validação básica de e-mail.
 */
const emailValido = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

// ─── Controllers ─────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Cria um novo usuário com senha hasheada.
 *
 * Body: { nome, email, senha }
 */
exports.register = async (req, res) => {
  try {
    const { nome, email, senha } = req.body;

    // Validações
    if (!nome || !email || !senha) {
      return res.status(400).json({ error: 'nome, email e senha são obrigatórios.' });
    }
    if (!emailValido(email)) {
      return res.status(400).json({ error: 'E-mail inválido.' });
    }
    if (senha.length < 6) {
      return res.status(400).json({ error: 'A senha deve ter no mínimo 6 caracteres.' });
    }

    // Verifica duplicidade
    const jaExiste = await User.findOne({ email: email.toLowerCase() });
    if (jaExiste) {
      return res.status(409).json({ error: 'E-mail já cadastrado.' });
    }

    // Hash da senha
    const hash = await bcrypt.hash(senha, 10);
    
    const sessionToken = crypto.randomBytes(16).toString('hex');

    const user = await User.create({
      nome: nome.trim(),
      email: email.toLowerCase().trim(),
      senha: hash,
      sessionToken
    });

    const token = gerarToken(user._id, user.role, sessionToken);

    res.status(201).json({
      message: 'Usuário criado com sucesso.',
      token,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        xp: user.xp,
      },
    });
  } catch (error) {
    console.error('[auth.register]', error);
    res.status(500).json({ error: 'Erro ao criar usuário.' });
  }
};

/**
 * POST /auth/login
 * Autentica um usuário e retorna JWT.
 *
 * Body: { email, senha }
 */
exports.login = async (req, res) => {
  try {
    const { email, senha } = req.body;

    if (!email || !senha) {
      return res.status(400).json({ error: 'E-mail e senha são obrigatórios.' });
    }

    // Busca incluindo a senha (campo com select:false no model)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+senha');
    if (!user) {
      return res.status(401).json({ error: 'E-mail não cadastrado. Que tal criar uma conta gratuita no botão abaixo?' });
    }

    // Compara senha com o hash
    const senhaCorreta = await bcrypt.compare(senha, user.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Senha incorreta. Verifique suas credenciais ou clique em "Esqueci minha senha".' });
    }

    // Controle de Sessão: Alunos geram novo token a cada login (deslogando outros aparelhos)
    let sessionToken = user.sessionToken;
    if (user.role !== 'admin') {
      sessionToken = crypto.randomBytes(16).toString('hex');
      user.sessionToken = sessionToken;
      await user.save();
    }

    const token = gerarToken(user._id, user.role, sessionToken);

    res.json({
      token,
      user: {
        id: user._id,
        nome: user.nome,
        email: user.email,
        role: user.role,
        xp: user.xp,
      },
    });
  } catch (error) {
    console.error('[auth.login]', error);
    res.status(500).json({ error: 'Erro ao fazer login.' });
  }
};

/**
 * GET /auth/me
 * Retorna os dados do usuário autenticado.
 * Requer middleware auth (req.userId definido).
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('-__v').populate('progresso.contentId', 'titulo materia');

    if (!user) {
      return res.status(404).json({ error: 'Usuário não encontrado.' });
    }

    res.json(user);
  } catch (error) {
    console.error('[auth.me]', error);
    res.status(500).json({ error: 'Erro ao buscar perfil.' });
  }
};

// PUT /auth/me
exports.updateProfile = async (req, res) => {
  try {
    const { nome, avatarUrl } = req.body;
    
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    if (nome) user.nome = nome;
    if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
    
    await user.save();
    
    res.json({ message: 'Perfil atualizado com sucesso!', user });
  } catch (error) {
    console.error('[auth.updateProfile]', error);
    res.status(500).json({ error: 'Erro ao atualizar perfil.' });
  }
};

// PUT /auth/password
exports.updatePassword = async (req, res) => {
  try {
    const { senhaAtual, novaSenha } = req.body;
    const user = await User.findById(req.userId).select('+senha');

    if (!user) return res.status(404).json({ error: 'Usuário não encontrado.' });

    const senhaCorreta = await bcrypt.compare(senhaAtual, user.senha);
    if (!senhaCorreta) {
      return res.status(401).json({ error: 'Senha atual incorreta.' });
    }

    user.senha = await bcrypt.hash(novaSenha, 10);
    await user.save();

    res.json({ message: 'Senha atualizada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar senha.' });
  }
};

// GET /auth/users (Apenas Admin)
exports.getAllUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }).select('nome email xp');
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar alunos.' });
  }
};

// DELETE /auth/users/:id (Apenas Admin)
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ message: 'Aluno banido com sucesso.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao deletar aluno.' });
  }
};

// ─── Password Recovery ────────────────────────────────────────────────────────

// POST /auth/forgot-password
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      return res.status(404).json({ error: 'E-mail não encontrado.' });
    }

    const token = crypto.randomBytes(20).toString('hex');
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hora
    await user.save();

    // MOCK EMAIL: Em produção, envie via Nodemailer. 
    // Aqui imprimimos no console para você testar.
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5500';
    const resetUrl = `${frontendUrl}/reset-password.html?token=${token}`;
    console.log(`\n[EMAIL MOCK] Assunto: Recuperação de Senha - EnemFlow`);
    console.log(`Para: ${user.email}`);
    console.log(`Link para resetar sua senha: ${resetUrl}\n`);

    res.json({ message: 'E-mail de recuperação enviado! Verifique o console do servidor.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao processar recuperação de senha.' });
  }
};

// POST /auth/reset-password
exports.resetPassword = async (req, res) => {
  try {
    const { token, novaSenha } = req.body;

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ error: 'Token inválido ou expirado.' });
    }

    user.senha = await bcrypt.hash(novaSenha, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({ message: 'Senha alterada com sucesso!' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resetar senha.' });
  }
};

// POST /auth/system/reset-all-xp (Apenas Admin)
exports.resetAllXP = async (req, res) => {
  try {
    await User.updateMany({}, { xp: 0, progresso: [] });
    res.json({ message: 'A plataforma foi resetada para o lançamento! Todo XP e Progresso foram limpos.' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao resetar sistema.' });
  }
};
