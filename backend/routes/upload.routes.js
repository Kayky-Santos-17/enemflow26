const router = require('express').Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
const auth = require('../middlewares/auth');
const { aiLimiter } = require('../middlewares/rateLimiter');
const { chatCompletion } = require('../services/openrouter.service');
const { getPrompt } = require('../services/prompt.service');
const { appendMessagesToChat, getMessagesForChat } = require('../services/chatMessage.service');
const { buildPdfContext, extractTextFromPdfBuffer } = require('../services/pdfProcessing.service');

const uploadDir = path.join(__dirname, '../uploads');
if (process.env.NODE_ENV !== 'production') {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = process.env.VERCEL
  ? multer.memoryStorage()
  : multer.diskStorage({
      destination(req, file, cb) {
        cb(null, uploadDir);
      },
      filename(req, file, cb) {
        const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
        cb(null, uniqueSuffix + path.extname(file.originalname));
      }
    });

const upload = multer({
  storage,
  limits: { fileSize: Number(process.env.UPLOAD_MAX_BYTES) || 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.png', '.jpg', '.jpeg', '.gif', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    return cb(new Error('Tipo de arquivo nao suportado. Use PDF, imagem ou TXT.'));
  }
});

function sanitizeText(value, maxChars = 1000) {
  const text = String(value || '').replace(/\u0000/g, '').trim();
  return text.length > maxChars ? text.slice(0, maxChars) : text;
}

router.post('/', auth, upload.single('file'), (req, res) => {
  if (process.env.VERCEL) {
    return res.status(400).json({
      error: 'Upload de arquivo fisico desativado na Vercel. Use a opcao de link externo.'
    });
  }
  if (!req.file) {
    return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
  }
  const url = `${req.protocol}://${req.get('host')}/uploads/${req.file.filename}`;
  res.json({ url });
});

router.post('/analyze', auth, aiLimiter, upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Nenhum arquivo enviado.' });
    }

    let textoExtraido = '';
    const ext = path.extname(req.file.originalname).toLowerCase();

    if (ext === '.txt') {
      textoExtraido = req.file.buffer
        ? req.file.buffer.toString('utf-8')
        : await fs.promises.readFile(req.file.path, 'utf-8');
    } else if (ext === '.pdf') {
      try {
        const buffer = req.file.buffer || await fs.promises.readFile(req.file.path);
        const extraction = await extractTextFromPdfBuffer(buffer, { filename: req.file.originalname });
        textoExtraido = extraction.text;
        if (extraction.extractionStatus === 'needs_ocr') {
          if (req.file.path) await fs.promises.unlink(req.file.path).catch(() => {});
          return res.status(422).json({
            error: extraction.extractionWarning || 'Este PDF parece escaneado e precisa de OCR antes de ser analisado.',
            code: 'PDF_OCR_REQUIRED',
            details: {
              pages: extraction.pageCount,
              textLength: extraction.textLength,
              charsPerPage: Math.round(extraction.charsPerPage || 0),
            },
          });
        }
      } catch (pdfErr) {
        console.error('[upload.analyze] PDF parse error:', pdfErr.message);
        if (req.file.path) await fs.promises.unlink(req.file.path).catch(() => {});
        return res.status(400).json({ error: 'Nao foi possivel extrair texto do PDF.' });
      }
    } else if (['.png', '.jpg', '.jpeg', '.gif'].includes(ext)) {
      textoExtraido = `[Imagem enviada pelo aluno em formato ${ext}. Analise o conteudo educacional desta imagem.]`;
    }

    if (!textoExtraido || textoExtraido.trim().length < 10) {
      if (req.file.path) await fs.promises.unlink(req.file.path).catch(() => {});
      return res.status(400).json({ error: 'Nao foi possivel extrair texto suficiente do arquivo.' });
    }

    const pergunta = sanitizeText(req.body.pergunta || 'Analise e resuma este conteudo para estudo do ENEM.', 1200);
    const pdfContext = buildPdfContext(textoExtraido, pergunta, { maxChunks: 4 });
    const chatId = req.body.chatId;
    const Chat = require('../models/Chat');

    let chat;
    if (chatId && chatId !== 'null') {
      if (!mongoose.isValidObjectId(chatId)) {
        return res.status(400).json({ error: 'Conversa invalida.' });
      }
      chat = await Chat.findOne({ _id: chatId, usuarioId: req.userId });
    }

    if (!chat) {
      chat = await Chat.create({
        usuarioId: req.userId,
        titulo: `Analise: ${req.file.originalname}`.slice(0, 120),
        tipo: 'chat',
        mensagens: []
      });
    }

    const userMsgContent = `[Arquivo anexado: ${req.file.originalname}]\n\nSolicitacao: ${pergunta}`;
    await appendMessagesToChat(chat, { role: 'user', content: userMsgContent });

    const systemOverride = `${getPrompt('pdfAnalysis')}

O aluno anexou um arquivo para esta aula. Responda a duvida dele seguindo esta ordem de prioridades:
1. Use as informacoes extraidas do arquivo PDF/texto anexado pelo aluno.
2. Use materiais e conteudos teoricos da plataforma quando forem relevantes.
3. Use conhecimento geral do ENEM apenas como complemento.

Nunca invente fatos. Se o arquivo ou pedido for completamente fora do contexto educacional do ENEM, recuse de forma breve e redirecione para estudo.

Conteudo extraido do arquivo enviado pelo aluno:
---
${pdfContext || textoExtraido.substring(0, 5000)}
---`;

    const historySlice = (await getMessagesForChat(chat, 8)).map(m => ({ role: m.role, content: m.content }));
    const resposta = await chatCompletion(historySlice, systemOverride, {
      maxHistoryChars: 8000,
      maxMessageChars: 2000,
      skipDbContext: true,
    });

    await appendMessagesToChat(chat, { role: 'assistant', content: resposta });

    if (req.file.path) {
      await fs.promises.unlink(req.file.path).catch(() => {});
    }

    res.json({ chatId: chat._id, resposta, textoExtraido: textoExtraido.substring(0, 500) });
  } catch (error) {
    console.error('[upload.analyze]', error.message);
    res.status(500).json({ error: error.message || 'Erro ao analisar arquivo.' });
  }
});

module.exports = router;
