const mongoose = require('mongoose');
const connectDB = require('./backend/config/db');
const Content = require('./backend/models/Content');
require('dotenv').config({ path: './backend/.env' });

async function check() {
  await connectDB();
  const contents = await Content.find();
  console.log('Total contents:', contents.length);
  contents.forEach(c => {
    console.log(`- ${c.titulo} | Materia: ${c.materia} | Tipo: ${c.tipo} | URL: ${c.url ? c.url.substring(0, 30) + '...' : 'none'}`);
  });
  process.exit();
}
check();
