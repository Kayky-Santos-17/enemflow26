const locks = new Map();

async function withRequestLock(key, task) {
  if (locks.has(key)) {
    const err = new Error('Ja existe uma operacao em andamento para este recurso. Aguarde a conclusao antes de tentar novamente.');
    err.statusCode = 409;
    throw err;
  }

  locks.set(key, Date.now());
  try {
    return await task();
  } finally {
    locks.delete(key);
  }
}

module.exports = { withRequestLock };
