const fs = require('fs');

const areas = [
  { prefix: 'M', name: 'Matemática', count: 30 },
  { prefix: 'N', name: 'Ciências da Natureza', count: 30 },
  { prefix: 'H', name: 'Ciências Humanas', count: 30 },
  { prefix: 'L', name: 'Linguagens e Códigos', count: 30 },
  { prefix: 'R', name: 'Redação e Competências', count: 30 }
];

const skills = [];

areas.forEach(area => {
  for (let i = 1; i <= area.count; i++) {
    const id = `${area.prefix}${i}`;
    let preReqs = [];
    if (i > 1) {
      preReqs.push(`${area.prefix}${i - 1}`); // Dependência linear simples para a matriz
    }
    
    // Nomes fictícios/descritivos baseados na área para simular a Matriz do ENEM
    let desc = `Habilidade ${i} de ${area.name}`;
    if (area.prefix === 'M') {
      if (i <= 5) desc = `Matemática Básica e Operações (${i})`;
      else if (i <= 10) desc = `Geometria e Medidas (${i})`;
      else if (i <= 15) desc = `Estatística e Probabilidade (${i})`;
      else if (i <= 20) desc = `Álgebra e Funções (${i})`;
      else desc = `Matemática Avançada e Problemas Complexos (${i})`;
    } else if (area.prefix === 'N') {
      if (i <= 10) desc = `Física: Mecânica, Termologia e Óptica (${i})`;
      else if (i <= 20) desc = `Química: Físico-Química e Orgânica (${i})`;
      else desc = `Biologia: Ecologia, Genética e Citologia (${i})`;
    } else if (area.prefix === 'H') {
      if (i <= 15) desc = `História e Sociedade (${i})`;
      else desc = `Geografia, Política e Economia (${i})`;
    } else if (area.prefix === 'L') {
      if (i <= 15) desc = `Compreensão de Texto e Literatura (${i})`;
      else desc = `Gramática, Artes e Educação Física (${i})`;
    } else if (area.prefix === 'R') {
      desc = `Competência ${Math.ceil(i/6)} da Redação (Critério ${i})`;
    }

    skills.push({
      id: id,
      area: area.name,
      description: desc,
      prerequisites: preReqs
    });
  }
});

fs.writeFileSync('enem_skills_matrix.json', JSON.stringify(skills, null, 2));
console.log('enem_skills_matrix.json gerado com sucesso com 180 habilidades.');
