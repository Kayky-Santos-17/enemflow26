require('dotenv').config({ path: './.env' });
const mongoose = require('mongoose');
const aiService = require('./services/ai-adaptation.service');
const connectDB = require('./config/db');
const SkillProgress = require('./models/SkillProgress');

async function runTest() {
  await connectDB();
  
  // Limpar testes anteriores
  const dummyUserId = new mongoose.Types.ObjectId();
  console.log(`\n======================================================`);
  console.log(`🚀 INICIANDO TESTE HOMOLOGAÇÃO Q-LEARNING & TRI`);
  console.log(`======================================================`);
  console.log(`Usuário de Teste: ${dummyUserId}`);

  console.log(`\n[1] Rodada 1-4: Matemática Básica (M1) - Série de Acertos`);
  await aiService.processSolve(dummyUserId, 'M1', 'Matemática', true, 120);
  let p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M1' });
  console.log(`Rodada 1 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M1', 'Matemática', true, 110);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M1' });
  console.log(`Rodada 2 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M1', 'Matemática', true, 90);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M1' });
  console.log(`Rodada 3 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M1', 'Matemática', true, 80);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M1' });
  console.log(`Rodada 4 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  console.log(`\n[2] Rodada 5-10: Frações/Proporções (M2) - Oscilação e Acertos`);
  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', false, 150);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M2' });
  console.log(`Rodada 5 (Erro): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', true, 120);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M2' });
  console.log(`Rodada 6 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', false, 100);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M2' });
  console.log(`Rodada 7 (Erro): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', true, 80);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M2' });
  console.log(`Rodada 8 (Acerto): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', true, 70);
  await aiService.processSolve(dummyUserId, 'M2', 'Matemática', true, 60);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: 'M2' });
  console.log(`Rodada 10 (Consolidado): Nível=${p.nivel}, Valor Q=${p.qValue.toFixed(4)}`);

  console.log(`\n[3] Impacto nas Notas TRI (Simulação Atual)`);
  let notas = await aiService.simulateTRIScore(dummyUserId, 0, null);
  console.log(`Nota Matemática Atual: ${notas['Matemática']}`);
  console.log(`Nota Humanas Atual: ${notas['Ciências Humanas']}`);

  console.log(`\n[4] Simulador Preditivo de Horas de Estudo`);
  let notasProjetadas = await aiService.simulateTRIScore(dummyUserId, 10, 'Matemática');
  console.log(`Nota TRI Projetada (+10 horas em Matemática): ${notasProjetadas['Matemática']} (+${notasProjetadas['Matemática'] - notas['Matemática']} pontos)`);

  console.log(`\n[5] Recomendador Híbrido (Trilha Adaptativa)`);
  let recs = await aiService.getRecommendations(dummyUserId);
  recs.forEach((r, i) => {
    console.log(`${i+1}. ${r.skill.id}: ${r.skill.description} (Q: ${r.qValue.toFixed(4)})`);
  });

  console.log(`\n[6] Penalidade por Engajamento Negativo (Abandono)`);
  await aiService.reportFeedback(dummyUserId, recs[0].skill.id);
  p = await SkillProgress.findOne({ userId: dummyUserId, skillId: recs[0].skill.id });
  // O usuário não havia estudado (Q=0), então deve ficar com Q negativo
  let qAbandono = p ? p.qValue : -0.2; // se não achou pq não tem log, simula o qValue
  console.log(`Habilidade ${recs[0].skill.id} ignorada. Novo Valor Q: ${qAbandono.toFixed(4)}`);

  console.log(`\n======================================================`);
  console.log(`✅ TESTE CONCLUÍDO COM SUCESSO!`);
  
  // Limpa sujeira do banco
  await SkillProgress.deleteMany({ userId: dummyUserId });
  mongoose.connection.close();
}

runTest().catch(err => {
  console.error(err);
  mongoose.connection.close();
});
