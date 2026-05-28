# PRD - Novas Alteracoes e Melhorias EnemFlow26

## Visao Geral

Este documento consolida novas alteracoes recomendadas para o EnemFlow26 a partir de uma analise combinada de QA, web design e desenvolvimento web. O projeto ja possui os fluxos centrais em producao, com deploy ativo em `https://enemflow26.vercel.app`, banco conectado e melhorias recentes no gerador de simulados, Tutor IA, contexto de upload e diagnostico de ambiente.

O objetivo deste novo ciclo e elevar confiabilidade, seguranca, experiencia mobile, qualidade pedagogica e manutencao tecnica sem quebrar os fluxos existentes.

## Objetivos

- Reduzir riscos de seguranca em autenticacao, rotas administrativas e renderizacao de conteudo dinamico.
- Melhorar experiencia mobile e consistencia visual nas paginas principais.
- Tornar os fluxos de PDF, Tutor IA e simulados mais previsiveis para estudantes.
- Preparar a arquitetura para crescimento de usuarios, chats e materiais.
- Criar uma base minima de testes funcionais e smoke tests repetiveis antes de cada deploy.

## Estado Atual

### Pontos fortes

- Deploy Vercel funcional em `enemflow26.vercel.app`.
- `/health` retorna estado do MongoDB sem expor segredos.
- Gerador de simulados possui retry backend e fallback frontend para quantidade menor.
- Tutor IA ja compacta historico e reduz contexto excessivo em fluxos criticos.
- Progresso adaptativo ja registra `acertos` e `total`, nao apenas booleano.
- Sidebar foi verificada em UTF-8 e esta sem mojibake real no arquivo.

### Pontos de atencao

- Tokens ainda ficam em `localStorage`, o que aumenta risco em caso de XSS.
- Rotas Owner/Admin destrutivas precisam de confirmacao forte e revalidacao.
- Chat usa array de mensagens dentro do documento `Chat`, o que pode crescer demais.
- Varios scripts grandes estao inline em HTML, dificultando teste e manutencao.
- PDF e Tutor ainda precisam de melhor tratamento para PDF escaneado, OCR futuro e metadados de extracao.
- Design mobile precisa de revisao sistematica em larguras pequenas.

## Personas

- Estudante ENEM: quer estudar rapido, gerar simulados, receber correcao clara e acompanhar progresso.
- Administrador: quer cadastrar conteudos, gerenciar usuarios e manter a plataforma estavel.
- Owner: precisa de controle operacional seguro, metricas confiaveis e protecao contra acoes destrutivas acidentais.
- Desenvolvedor/Mantenedor: precisa de codigo mais modular, validavel e seguro para evoluir o produto.

## Prioridades

### P0 - Seguranca, privacidade e estabilidade

1. Migrar autenticacao de `localStorage` para cookie `HttpOnly`, `Secure`, `SameSite=Lax`.
2. Adicionar revalidacao de senha para acoes destrutivas do Owner.
3. Criar confirmacao dupla para limpar chats, excluir usuarios e resetar XP.
4. Sanitizar conteudo retornado pela IA antes de renderizar como HTML/Markdown.
5. Padronizar erros de login/recuperacao para reduzir enumeracao de e-mails.
6. Criar rate limit especifico para todas as rotas que chamam LLM.
7. Validar autorizacao em rotas de historico/estudo para impedir acesso cruzado entre usuarios.

### P1 - Experiencia do estudante

1. Adicionar botao "Pausar" e "Continuar" no modo foco do simulado.
2. Adicionar cancelamento visual ou timeout amigavel durante geracao de simulado.
3. Melhorar tela de erro quando OpenRouter falha, com sugestao de tentar menos questoes.
4. Criar resumo pos-simulado mais pedagogico: pontos fortes, pontos fracos e proximos estudos.
5. Melhorar navegacao mobile com `safe-area` real e evitar conflitos de z-index.
6. Revisar textos visiveis para acentos, consistencia e tom educacional.
7. Criar estado vazio mais util em Dashboard, Historico, Habilidades e Materias.

### P1 - Tutor IA e qualidade pedagogica

1. Separar prompts por fluxo: tutor livre, simulado, correcao, resumo, PDF e plano.
2. Criar guardrails de escopo educacional mais completos e testaveis.
3. Criar avaliacao local de respostas da IA com casos fixos.
4. Registrar feedback do aluno: "ajudou", "nao ajudou", "resposta incorreta".
5. Evitar que o Tutor responda com certeza excessiva quando o PDF estiver incompleto.
6. Adicionar citacao do trecho do material quando a resposta vier de PDF.

### P1 - PDF, materiais e estudo

1. Garantir `textoExtraido` em todo PDF cadastrado pelo admin.
2. Mostrar status de extracao: sucesso, parcial, falhou ou PDF escaneado.
3. Registrar metadados: paginas, tamanho, data de processamento e caracteres extraidos.
4. Evitar processamento pesado de base64 no navegador.
5. Planejar OCR para PDFs escaneados/imagens em uma fase posterior.
6. Corrigir fluxo "Enviar para Tutor IA" para sempre usar `contentId` e texto extraido do backend.

### P2 - Arquitetura e performance

1. Extrair scripts inline de `chat.html`, `exercises.html` e paginas grandes para arquivos `.js`.
2. Criar componentes/utilitarios compartilhados para toast, modal, loading, confirmacao e erro.
3. Adicionar indices MongoDB para chats, progresso e sessoes.
4. Normalizar mensagens em uma colecao `Message` quando o volume crescer.
5. Mover limpeza de chats antigos para job assinc/cron.
6. Reduzir chamadas repetidas a `feather.replace()` ou migrar icones estaticos.
7. Adicionar paginacao em listas de chats, usuarios, conteudos e historico.

### P2 - Design system e UI

1. Unificar raio de borda, sombras, glassmorphism e cores de estado.
2. Padronizar botoes primarios, secundarios, destrutivos e icon buttons.
3. Revisar contraste em textos roxos/cinzas sobre fundo escuro.
4. Criar layout responsivo testado para 360, 375, 390, 414, 768, 1366 e 1920 px.
5. Evitar cards aninhados e reduzir excesso de brilho em telas operacionais.
6. Criar estados consistentes: carregando, vazio, erro, sucesso e offline.

## Requisitos Funcionais

### RF1 - Autenticacao segura

- O backend deve aceitar sessao por cookie seguro.
- Logout deve invalidar a sessao do usuario.
- Rotas privadas devem continuar protegidas por middleware.
- A migracao deve preservar compatibilidade temporaria com o token atual ate todos os fluxos serem ajustados.

Critérios de aceite:

- Usuario consegue logar, navegar, atualizar perfil e sair.
- Token sensivel nao fica acessivel por JavaScript apos migracao final.
- Rotas privadas retornam 401 quando nao ha sessao valida.

### RF2 - Acoes destrutivas protegidas

- Owner deve confirmar a senha antes de executar acoes destrutivas.
- UI deve exigir digitacao de frase de confirmacao para resetar XP, limpar chats ou excluir usuario.
- Backend deve validar permissao, senha e frase esperada.

Critérios de aceite:

- Acoes destrutivas falham sem revalidacao.
- Logs do servidor registram acao, usuario e timestamp.
- A UI deixa claro o impacto antes da confirmacao.

### RF3 - Simulado com melhor experiencia

- Usuario pode pausar e continuar o cronometro.
- Geracao deve exibir tempo de espera, etapas e opcao de tentar menos questoes quando falhar.
- Resultado deve sugerir topicos de revisao com base nos erros.

Critérios de aceite:

- Pausar nao perde respostas.
- Fallback de quantidade menor e comunicado ao usuario.
- Correcao final mostra acertos, erros, topicos fracos e CTA para Tutor IA.

### RF4 - Tutor IA com escopo e feedback

- Cada fluxo deve usar prompt especifico.
- Respostas fora de escopo devem ser recusadas com redirecionamento educacional.
- Usuario deve poder avaliar resposta.
- Avaliacoes devem ser salvas para analise futura.

Critérios de aceite:

- Perguntas de estudo recebem resposta pedagogica.
- Perguntas claramente fora de escopo sao recusadas.
- Feedback aparece no banco associado ao chat/mensagem.

### RF5 - PDF confiavel

- Admin deve visualizar se o PDF teve texto extraido.
- Tutor deve usar o texto extraido do backend, nao apenas URL ou blob local.
- PDFs sem texto devem ter mensagem clara e sugestao de OCR futuro.

Critérios de aceite:

- PDF textual enviado ao Tutor gera resposta baseada no material.
- PDF escaneado mostra estado "texto nao extraivel".
- Metadados de extracao ficam salvos no conteudo.

### RF6 - Testes e validacao

- Criar smoke tests para health, auth, chat protegido e paginas estaticas principais.
- Criar testes de contrato para endpoints de simulado e progresso adaptativo.
- Criar checklist visual para mobile e desktop.

Critérios de aceite:

- `node --check` roda nos arquivos JS alterados.
- Smoke tests podem ser executados antes e depois do deploy.
- PR/commit so deve ser considerado pronto com checklist preenchido.

## Requisitos Nao Funcionais

- Performance: paginas principais devem carregar sem travar em mobile medio.
- Seguranca: nenhum segredo deve existir no codigo fonte.
- Acessibilidade: botoes com icones devem ter texto acessivel ou `aria-label`.
- Observabilidade: erros criticos devem ter logs claros sem expor dados sensiveis.
- Manutenibilidade: scripts novos devem preferir arquivos separados a blocos inline.
- Compatibilidade: manter funcionamento em navegadores modernos mobile e desktop.

## Plano de Execucao

### Fase 1 - Hardening de seguranca

Arquivos provaveis:

- `backend/controllers/auth.controller.js`
- `backend/middlewares/auth.js`
- `backend/routes/owner.routes.js`
- `backend/controllers/owner.controller.js`
- `frontend/login.html`
- `frontend/owner.html`
- `frontend/app.js`

Tarefas:

- Implementar cookies seguros.
- Adicionar revalidacao de senha para Owner.
- Criar confirmacoes destrutivas.
- Padronizar erros sensiveis.
- Revisar autorizacao de rotas de estudo/historico.

### Fase 2 - UX de simulados e Tutor

Arquivos provaveis:

- `frontend/exercises.html`
- `frontend/chat.html`
- `frontend/app.js`
- `backend/controllers/chat.controller.js`
- `backend/services/openrouter.service.js`

Tarefas:

- Pausar/continuar cronometro.
- Melhorar timeout/cancelamento de geracao.
- Criar resumo pedagogico pos-simulado.
- Separar prompts por fluxo.
- Adicionar feedback de resposta da IA.

### Fase 3 - PDF e materiais

Arquivos provaveis:

- `backend/routes/upload.routes.js`
- `backend/controllers/content.controller.js`
- `backend/models/Content.js`
- `frontend/study.html`
- `frontend/admin.html`
- `frontend/chat.html`

Tarefas:

- Salvar metadados de extracao.
- Exibir status de PDF no Admin.
- Garantir envio por `contentId`.
- Melhorar mensagens para PDF escaneado.
- Planejar OCR sem bloquear entrega atual.

### Fase 4 - Refatoracao frontend

Arquivos provaveis:

- `frontend/exercises.html`
- `frontend/chat.html`
- `frontend/sidebar.js`
- `frontend/app.js`
- novos arquivos em `frontend/js/`

Tarefas:

- Extrair scripts inline.
- Criar componentes compartilhados.
- Padronizar toasts/modais.
- Reduzir duplicacao de UI.
- Revisar z-index e safe-area mobile.

### Fase 5 - Banco, performance e testes

Arquivos provaveis:

- `backend/models/Chat.js`
- `backend/models/StudySession.js`
- `backend/models/SkillProgress.js`
- `backend/server.js`
- novos scripts de smoke test

Tarefas:

- Criar indices MongoDB.
- Adicionar paginacao.
- Criar smoke tests.
- Avaliar colecao `Message`.
- Tirar limpezas pesadas do request principal.

## Checklist QA

### Fluxos obrigatorios

- Registro, login, logout e recuperacao de senha.
- Dashboard carregando com banco conectado.
- Gerar simulado com 5, 10 e 15 questoes.
- Corrigir simulado e registrar progresso.
- Abrir Tutor IA e fazer pergunta educacional.
- Enviar pergunta fora de escopo e confirmar recusa.
- Abrir PDF textual e enviar ao Tutor.
- Abrir PDF escaneado e ver mensagem adequada.
- Owner executando acao destrutiva com e sem revalidacao.

### Responsividade

- Mobile 360 px.
- Mobile 375 px.
- Mobile 390 px.
- Mobile 414 px.
- Tablet 768 px.
- Desktop 1366 px.
- Desktop 1920 px.

### Acessibilidade basica

- Todos os botoes icon-only possuem `aria-label`.
- Modal prende foco enquanto aberto.
- Toast nao bloqueia acoes principais.
- Contraste de textos secundarios e suficiente.
- Navegacao por teclado funciona em formularios.

## Checklist Web Design

- Cabecalho mobile nao colide com XP/avatar.
- Bottom nav respeita `env(safe-area-inset-bottom)`.
- Estados vazios sao informativos e acionaveis.
- Telas operacionais nao usam excesso de elementos decorativos.
- Botoes destrutivos tem cor, texto e confirmacao claros.
- Cards nao ficam aninhados sem necessidade.
- Textos longos nao extrapolam botoes, cards ou modais.

## Checklist Dev Web

- `node --check` nos JS alterados.
- Scripts inline novos evitados.
- Nenhum segredo em codigo ou logs.
- Erros da API tem formato previsivel.
- Rotas protegidas testadas com e sem token.
- Queries frequentes possuem indice.
- Listas grandes tem paginacao ou limite.
- Deploy Vercel validado com `/health`.

## Riscos

- Migrar autenticacao para cookie pode afetar CORS e ambiente local.
- Reestruturar mensagens de chat pode exigir migracao de dados.
- OCR pode aumentar custo e tempo de processamento.
- Prompts mais rigidos podem aumentar recusas indevidas.
- Refatorar scripts inline pode introduzir regressao visual se nao houver smoke manual.

## Metricas de Sucesso

- Reducao de erros 500 em producao.
- Menor tempo medio de resposta em rotas de chat/listagem.
- Menor taxa de falha na geracao de simulado.
- Aumento de simulados corrigidos com progresso registrado.
- Menos feedback negativo nas respostas do Tutor IA.
- Zero acoes destrutivas executadas sem revalidacao.

## Ordem Recomendada

1. Proteger rotas destrutivas e autenticacao.
2. Melhorar UX do simulado e feedback pedagogico.
3. Fortalecer Tutor IA e fluxo de PDF.
4. Refatorar scripts inline e componentes compartilhados.
5. Adicionar indices, paginacao e smoke tests.
6. Fazer revisao visual mobile/desktop antes de cada novo deploy.

## Definicao de Pronto

Uma melhoria so deve ser considerada pronta quando:

- Foi implementada sem alterar fluxos fora do escopo.
- Passou em validacao sintatica.
- Tem smoke test manual ou automatizado documentado.
- Nao introduz segredo ou dado sensivel em codigo/logs.
- Foi testada em pelo menos um viewport mobile e um desktop.
- Foi documentada neste PRD ou em arquivo de continuidade.

## Nota de Execucao - Fase 1 / Parte 1

Status: implementado parcialmente.

Alteracoes feitas:

- Backend Owner agora exige `ownerPassword` e frase de confirmacao exata para acoes destrutivas.
- Acoes protegidas: excluir aluno, redefinir senha de aluno, zerar progresso, zerar XP, apagar chat especifico, apagar chats de um aluno, apagar todos os chats, limpar chats antigos e otimizar historicos.
- Exclusao/reset de aluno agora tambem limpa dados de `SkillProgress` e `QTable`, alem de sessoes antigas por `userId` e `usuarioId`.
- Frontend `owner.html` passou a solicitar frase de confirmacao e senha do OWNER antes de chamar rotas destrutivas.

Validacao local:

- `node --check backend/controllers/owner.controller.js`
- Compilacao dos scripts inline de `frontend/owner.html` via `vm.Script`

Proxima parte recomendada:

1. Criar modal proprio para confirmacoes Owner no lugar de `prompt`.
2. Padronizar erros sensiveis de login/recuperacao.
3. Revisar rotas de historico/estudo para impedir acesso cruzado.
4. Planejar migracao gradual de `localStorage` para cookie `HttpOnly`.
