const mongoose = require('mongoose');
const Chat = require('../models/Chat');
const ChatMessage = require('../models/ChatMessage');

const CHAT_CACHE_LIMIT = 60;

function normalizeMessage(message) {
  return {
    role: ['user', 'assistant', 'system'].includes(message.role) ? message.role : 'user',
    content: String(message.content || '').slice(0, 12000),
  };
}

function toClientMessage(message) {
  return {
    _id: message._id,
    role: message.role,
    content: message.content,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt,
  };
}

async function appendMessagesToChat(chat, messages) {
  const normalized = (Array.isArray(messages) ? messages : [messages])
    .map(normalizeMessage)
    .filter(message => message.content.trim());

  if (!normalized.length) return [];

  const created = await ChatMessage.insertMany(
    normalized.map(message => ({
      ...message,
      chatId: chat._id,
      usuarioId: chat.usuarioId,
    })),
    { ordered: true }
  );

  chat.mensagens.push(...created.map(toClientMessage));
  if (chat.mensagens.length > CHAT_CACHE_LIMIT) {
    chat.mensagens = chat.mensagens.slice(-CHAT_CACHE_LIMIT);
  }
  await chat.save();

  return created.map(toClientMessage);
}

async function createChatWithMessages({ usuarioId, titulo, tipo = 'chat', mensagens = [] }) {
  const chat = await Chat.create({ usuarioId, titulo, tipo, mensagens: [] });
  await appendMessagesToChat(chat, mensagens);
  return chat;
}

async function getMessagesForChat(chat, limit = 500) {
  const normalizedLimit = Math.max(1, Math.min(Number(limit) || 500, 1000));
  const cachedMessages = (chat.mensagens || []).map(toClientMessage);
  const messages = await ChatMessage.find({ chatId: chat._id })
    .sort({ createdAt: -1 })
    .limit(normalizedLimit)
    .lean();

  if (messages.length) {
    const dbMessages = messages.reverse().map(toClientMessage);
    if (cachedMessages.length > dbMessages.length) {
      return cachedMessages.slice(-normalizedLimit);
    }
    return dbMessages;
  }
  return cachedMessages.slice(-normalizedLimit);
}

async function deleteMessageFromChat(chat, messageId) {
  let deleted = false;

  if (mongoose.isValidObjectId(messageId)) {
    const result = await ChatMessage.deleteOne({ _id: messageId, chatId: chat._id });
    deleted = result.deletedCount > 0;
    const originalLength = chat.mensagens.length;
    chat.mensagens = chat.mensagens.filter(message => String(message._id || '') !== messageId);
    deleted = deleted || chat.mensagens.length < originalLength;
  } else {
    const index = Number.isInteger(Number(messageId)) ? Number(messageId) : -1;
    const messages = await getMessagesForChat(chat);
    const target = index >= 0 && index < messages.length ? messages[index] : null;

    if (target?._id && mongoose.isValidObjectId(target._id)) {
      const result = await ChatMessage.deleteOne({ _id: target._id, chatId: chat._id });
      deleted = result.deletedCount > 0;
      chat.mensagens = chat.mensagens.filter(message => String(message._id || '') !== String(target._id));
    } else if (index >= 0 && index < chat.mensagens.length) {
      chat.mensagens.splice(index, 1);
      deleted = true;
    }
  }

  if (deleted) await chat.save();
  return deleted;
}

async function deleteMessagesForChats(chatIds) {
  const ids = (Array.isArray(chatIds) ? chatIds : [chatIds]).filter(Boolean);
  if (!ids.length) return { deletedCount: 0 };
  return ChatMessage.deleteMany({ chatId: { $in: ids } });
}

async function deleteMessagesForUser(usuarioId) {
  return ChatMessage.deleteMany({ usuarioId });
}

async function deleteAllMessages() {
  return ChatMessage.deleteMany({});
}

async function countMessages() {
  return ChatMessage.countDocuments();
}

module.exports = {
  appendMessagesToChat,
  createChatWithMessages,
  getMessagesForChat,
  deleteMessageFromChat,
  deleteMessagesForChats,
  deleteMessagesForUser,
  deleteAllMessages,
  countMessages,
};
