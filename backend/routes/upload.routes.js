const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const auth = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');
const { chatCompletion } = require('../services/openrouter.service');

// Certifique-se de que a pasta existe
const uploadDir = path.join(__dirname, '../uploads');
if (process.env.NODE_ENV !== 'production') {
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
  }
}

const storage = process.env.VERCEL
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination: function (req, file, cb) { cb(null, uploadDir); },
      filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não suportado. Use PDF, imagem ou TXT.'));
    }
  }
});

// POST /upload — Upload simples (foto de perfil, etc.)
router.post('/', auth, upload.single('file'), (req, res) => {
  if (process.env.VERCEL) {
    return res.status(400).json({
      error: 'Upload de arquivo físico desativado na Vercel. Use a opção de link externo.'
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

// POST /upload/analyze — Upload + extração de texto + envio para IA
router.post('/analyze', auth, aiLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    let textoExtraido = '';
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.txt') {
      // Texto direto
      if (req.file.buffer) {
        textoExtraido = req.file.buffer.toString('utf-8');
      } else {
        textoExtraido = fs.readFileSync(req.file.path, 'utf-8');
      }
    } else if (ext === '.pdf') {
      // Extração de PDF
      try {
        const pdfParse = require('pdf-parse');
        const buffer = req.file.buffer || fs.readFileSync(req.file.path);
        const data = await pdfParse(buffer);
        textoExtraido = data.text;
      } catch (pdfErr) {
        console.error('[upload.analyze] PDF parse error:', pdfErr.message);
        return res.status(400).json({ error: 'Não foi possível extrair texto do PDF.' });
      }
    } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
      // Para imagens, pedimos à IA para descrever
      const base64 = (req.file.buffer || fs.readFileSync(req.file.path)).toString('base64');
      const mimeType = req.file.mimetype || 'image/png';
      textoExtraido = `[Imagem enviada pelo aluno em formato ${ext}. Analise o conteúdo educacional desta imagem.]`;
      // Se o modelo suportar visão, enviamos a imagem
    }

    if (!textoExtraido || textoExtraido.trim().length < 10) {
      return res.status(400).json({ error: 'Não foi possível extrair texto suficiente do arquivo.' });
    }

    const pergunta = req.body.pergunta || 'Analise e resuma este conteúdo para estudo do ENEM.';

    const prompt = `O aluno enviou o seguinte conteúdo extraído de um arquivo (${ext}):

---
${textoExtraido.substring(0, 6000)}
---

Solicitação do aluno: ${pergunta}`;

    const resposta = await chatCompletion([{ role: 'user', content: prompt }]);

    // Limpa arquivo do disco (se não for Vercel)
    if (req.file.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.json({ resposta, textoExtraido: textoExtraido.substring(0, 500) });
  } catch (error) {
    console.error('[upload.analyze]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar arquivo.' });
  }
});

module.exports = router;
