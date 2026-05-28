# PRD - Correcoes EnemFlow26: Simulados, Tutor IA e Aprendizado Adaptativo

## Objetivo

Estabilizar os fluxos centrais do EnemFlow26: Gerador de Simulados, Tutor IA, upload/análise de materiais, IA adaptativa e Q-learning. O foco é reduzir falhas em runtime, melhorar a previsibilidade da API de IA, preservar contexto educacional e registrar progresso de forma coerente.

## Escopo

- Backend Express/MongoDB.
- Frontend estático em `frontend/exercises.html`, `frontend/chat.html` e `frontend/app.js`.
- Serviço OpenRouter em `backend/services/openrouter.service.js`.
- Fluxos adaptativos em `backend/services/ai-adaptation.service.js` e `backend/services/qLearning.service.js`.
- Modelos `Chat`, `SkillProgress`, `QTable` e `StudySession`.

## Problemas Diagnosticados

### P0 - Gerador de Simulados falha por contrato frágil com a IA

O erro "A IA retornou uma quantidade inesperada de questões" nasce em `backend/controllers/chat.controller.js`, dentro de `validateSimuladoPayload`. A função espera exatamente `quantidade` questões depois do parse JSON. Se a IA retorna menos questões por truncamento, formato parcial, erro de JSON ou limite de tokens, o backend falha sem recuperação.

Também há outros pontos frágeis:

- `extractJsonObject` aceita apenas um objeto JSON e não tenta reparar casos comuns.
- `maxTokens` usa estimativa baixa para 30 questões complexas.
- A validação exige muitos campos pedagógicos obrigatórios, o que derruba respostas parcialmente úteis.
- O prompt pede JSON grande e rico, aumentando chance de truncamento.
- Não há retry automático com prompt corretivo.
- O erro devolvido ao frontend não informa quantas questões chegaram, dificultando depuração.

### P0 - Tutor IA com contexto e escopo instáveis

O tutor usa `slice(-20)` no histórico e manda mensagens possivelmente grandes diretamente para a LLM. Isso pode:

- perder o começo do contexto;
- estourar contexto com PDFs/simulados;
- misturar material da plataforma de forma ampla demais;
- gerar respostas fora do escopo ENEM quando a mensagem não bate em `blockedPhrases`.

O filtro `isOffTopic` é frágil, baseado em poucas frases bloqueadas. O system prompt é bom como intenção, mas ainda permite "cultura geral" ampla, o que abre margem para respostas erradas ou dispersas.

### P0 - Credencial MongoDB hardcoded

`backend/config/db.js` possui fallback com connection string real. Isso é risco de segurança e deve ser removido. O app deve falhar de forma clara se `MONGO_URI` não estiver configurada.

### P1 - IA adaptativa e Q-learning estão desalinhados

Existem dois mecanismos paralelos:

- `ai-adaptation.service.js`, usado pelo frontend em `/api/ai-adaptation/solve`.
- `qLearning.service.js`, exposto em `/api/ia/recomendacao` e `/api/ia/treinar`.

Eles não compartilham o mesmo contrato de evento. O frontend reporta apenas um resultado agregado do simulado, com `correto = hits/total >= .6`, então um simulado de 10 questões vira uma única atualização binária. Isso distorce `SkillProgress`.

Além disso:

- `mapMateriaToArea` no frontend usa nomes sem acento, enquanto o backend/TRI usa áreas com acento.
- `StudySession` usa `userId`, mas alguns fluxos antigos podem usar `usuarioId`, criando risco de métricas vazias.
- Q-learning clássico escolhe ação aleatória quando todos os Q-values são zero, podendo recomendar ações sem conexão com pontos fracos reais.
- Não há vínculo entre recomendação emitida e feedback posterior.

### P1 - Frontend de simulado precisa ser mais resiliente

`exercises.html` não trata respostas parciais nem mostra detalhes acionáveis quando o backend falha. O botão fica bloqueado durante geração, mas não há cancelamento/timeout visual nem fallback para gerar menos questões.

### P1 - Upload/análise do tutor pode gerar contexto excessivo

`upload.routes.js` envia até 6000 caracteres do texto extraído, mais histórico recente. O serviço OpenRouter ainda injeta materiais da plataforma automaticamente, aumentando o contexto sem controle. Para PDFs grandes e conversas longas, isso reduz qualidade e pode truncar resposta.

### P2 - Encoding e alteração local em sidebar

`frontend/sidebar.js` está alterado localmente com textos acentuados corrompidos. Isso deve ser revertido ou regravado como UTF-8 correto antes de qualquer entrega.

## Requisitos Funcionais

### RF1 - Simulados devem ser gerados de forma robusta

- Aceitar apenas JSON estruturado no contrato final.
- Se a IA retornar menos questões, tentar uma segunda chamada para completar apenas as questões faltantes.
- Se ainda faltar, retornar erro claro com quantidade recebida e quantidade solicitada.
- Normalizar campos ausentes quando possível, sem aceitar questão pedagogicamente inválida.
- Manter limite de 1 a 30 questões.

### RF2 - Tutor deve manter escopo educacional

- Enviar histórico compacto e limitado por caracteres.
- Preservar system prompt e contexto inicial.
- Recusar pedidos claramente fora de ENEM/estudo.
- Evitar injetar materiais da plataforma quando não há relação forte com a pergunta.

### RF3 - Progresso adaptativo deve ser coerente

- Registrar progresso por habilidade/área de forma proporcional ao resultado do simulado.
- Padronizar nomes de área entre frontend e backend.
- Evitar que um simulado inteiro conte como uma única questão.
- Integrar ou documentar a separação entre `ai-adaptation` e Q-learning clássico.

### RF4 - Segurança de ambiente

- Remover credencial MongoDB hardcoded.
- Exigir `MONGO_URI` em ambiente.
- Manter mensagens de erro úteis sem expor segredos.

## Plano de Execucao por Partes

### Parte 1 - Correção crítica do Gerador de Simulados

Arquivos:

- `backend/controllers/chat.controller.js`
- `backend/services/openrouter.service.js`
- `frontend/exercises.html`

Tarefas:

- Melhorar extração/parse de JSON.
- Separar validação de quantidade da validação de qualidade.
- Adicionar retry para completar questões faltantes.
- Ajustar `maxTokens` e prompt para reduzir truncamento.
- Melhorar erro retornado ao frontend.

Critério de aceite:

- Solicitações de 5, 10 e 15 questões não falham por quantidade quando a IA retorna JSON recuperável.
- Erros mostram contexto técnico suficiente: solicitadas, recebidas e motivo.

### Parte 2 - Tutor IA e contexto

Arquivos:

- `backend/services/openrouter.service.js`
- `backend/controllers/chat.controller.js`
- `backend/routes/upload.routes.js`
- `frontend/chat.html`

Tarefas:

- Criar compactação simples de histórico por limite de caracteres.
- Reduzir injeção automática de materiais quando a relevância é baixa.
- Fortalecer filtro de escopo educacional no system prompt e no guardrail local.
- Evitar envio redundante de contexto gigante em correção de simulado.

Critério de aceite:

- Tutor responde com foco em ENEM/estudos.
- Conversas longas continuam utilizáveis.
- Upload de PDF não degrada todo o histórico do chat.

### Parte 3 - IA adaptativa e Q-learning

Arquivos:

- `frontend/exercises.html`
- `backend/services/ai-adaptation.service.js`
- `backend/controllers/ai-adaptation.controller.js`
- `backend/services/qLearning.service.js`

Tarefas:

- Reportar acertos por quantidade, não apenas booleano agregado.
- Padronizar áreas com acentos/nomes oficiais.
- Atualizar `processSolve` para aceitar `acertos` e `total`.
- Melhorar recomendação inicial quando Q-table está vazia, usando `SkillProgress`.
- Documentar o papel de cada motor: progresso por habilidade vs recomendação estratégica.

Critério de aceite:

- Simulado de 10 questões altera `total` em 10, não em 1.
- Recomendações passam a refletir pontos fracos reais com mais frequência.

### Parte 4 - Segurança e limpeza

Arquivos:

- `backend/config/db.js`
- `frontend/sidebar.js`

Tarefas:

- Remover fallback com URI real do MongoDB.
- Corrigir/reverter mojibake local em `sidebar.js`.
- Verificar status git antes e depois.

Critério de aceite:

- Nenhum segredo real no código.
- `sidebar.js` volta a exibir acentos corretamente.

### Parte 5 - Validação

Tarefas:

- Rodar `node --check` nos arquivos alterados.
- Validar scripts inline principais de `exercises.html` e `chat.html`.
- Rodar servidor local se possível e testar endpoints sem chamar IA real quando não houver chave.

Critério de aceite:

- Sem erro sintático.
- Fluxos críticos têm mensagens de erro melhores.
- Alterações ficam documentadas para commit.

## Riscos

- Sem `OPENROUTER_KEY`, não é possível validar geração real de IA localmente.
- Dependência de modelo externo pode continuar variando; por isso o backend precisa tolerar pequenas variações.
- Alterar schema de progresso exige cuidado para não quebrar dados já existentes.

## Ordem Imediata de Execucao

1. Implementar robustez do simulado.
2. Corrigir tutor/contexto.
3. Corrigir relatório de progresso adaptativo.
4. Remover segredo MongoDB e limpar encoding.
5. Validar e entregar resumo das mudanças.

## Nota de Continuidade - 2026-05-27

As correcoes iniciais foram implementadas, validadas sintaticamente, commitadas e enviadas ao GitHub no commit `43de895` (`Corrige IA de simulados e prepara implantacao`).

Ponto onde paramos:

- Gerador de simulados: backend agora tenta completar questoes faltantes e retorna erro mais claro quando a IA devolve quantidade insuficiente.
- Tutor IA/OpenRouter: historico passou a ser compactado e a injecao automatica de materiais foi reduzida para evitar contexto ruidoso.
- IA adaptativa: simulados agora reportam `acertos` e `total`, nao apenas um booleano agregado.
- Q-learning: cold start passou a usar progresso real do aluno quando a Q-table esta vazia.
- Seguranca: removidos fallback de MongoDB hardcoded e fallback inseguro de `JWT_SECRET`.
- Documentacao: `IMPLANTACAO.md` foi criado com variaveis obrigatorias, validacao local e smoke tests.

Implantacao:

- O push para `origin/main` foi concluido.
- A Vercel ainda nao foi confirmada porque os dominios testados (`https://enemflow.vercel.app/health` e `https://enemflow-ai.vercel.app/health`) retornaram `DEPLOYMENT_NOT_FOUND`.
- Proximo analista deve conectar/verificar o projeto na Vercel, apontar para o repo `Kayky-Santos-17/enemflow26`, branch `main`, configurar `MONGO_URI`, `JWT_SECRET`, `OPENROUTER_KEY`, `OPENROUTER_MODEL`, `FRONTEND_URL` e `NODE_ENV`, e entao rodar os smoke tests descritos em `IMPLANTACAO.md`.

## Nota de Continuidade - 2026-05-27 (verificacao Vercel)

Verificacao executada a partir da pasta local `enemflow26-main`:

- `git fetch origin --prune` concluido; `main` local esta alinhada com `origin/main` no commit `00d18d1` (`Documenta ponto de continuidade no PRD`).
- GitHub API confirma `main` em `00d18d16fe07c2430418b05b47a1b91e50a7637f`.
- O dominio correto encontrado e funcional e `https://enemflow26.vercel.app`.
- `https://enemflow26.vercel.app/health` respondeu `200` com `{"status":"ok","connected":false,"env":"production"}`.
- Os dominios antigos `https://enemflow.vercel.app/health` e `https://enemflow-ai.vercel.app/health` continuam retornando `404`.
- Login de smoke com usuario inexistente retornou `500` com `Operation users.findOne() buffering timed out after 10000ms`, confirmando que os fluxos com banco estao bloqueados enquanto `connected:false`.
- `npx vercel whoami` nao retornou antes do timeout local, entao nao foi possivel confirmar login/link do projeto via CLI nesta maquina.
- Validacao sintatica local com `node --check` passou para `backend/server.js`, `chat.controller.js`, `openrouter.service.js`, `ai-adaptation.service.js`, `qLearning.service.js` e `db.js`.
- Smoke local de `http://localhost:3000/health` passou, mas tambem com `connected:false` quando `MONGO_URI` nao esta configurada.

Proximo passo real: entrar no projeto Vercel que serve `enemflow26.vercel.app`, corrigir/confirmar `MONGO_URI` e rede do MongoDB Atlas, redeployar e repetir `curl https://enemflow26.vercel.app/health` ate `connected:true`. Depois disso, testar login/registro, Tutor IA, simulado de 5/10 questoes e progresso adaptativo.

## Nota de Continuidade - 2026-05-27 (ajustes pos-verificacao)

Alteracoes aplicadas apos confirmar o projeto Vercel `enemflow26`:

- `backend/config/db.js`: conexao MongoDB agora reutiliza uma promise de conexao, desativa buffer de comandos e guarda erro sanitizado para diagnostico.
- `backend/server.js`: rotas que dependem de banco agora passam por guarda `requireDatabase`; quando o Mongo estiver indisponivel, retornam `503` rapido em vez de esperar timeout do Mongoose.
- `/health`: passou a expor `db.readyState`, `db.hasMongoUri` e `db.reason` sem expor segredos.
- `backend/controllers/chat.controller.js`: Tutor usa historico compacto por limite de caracteres, sem depender apenas de `slice(-20)`.
- `backend/routes/upload.routes.js`: analise de upload reduziu contexto enviado e desativou injecao automatica de materiais da plataforma nesse fluxo.
- `backend/services/openrouter.service.js`: fallback do `HTTP-Referer` atualizado para `https://enemflow26.vercel.app`.
- `backend/middlewares/auth.js`: ausencia de `JWT_SECRET` agora retorna erro claro de configuracao.

Validacao local apos ajustes:

- `node --check` passou para `backend/server.js`, `backend/config/db.js`, `backend/controllers/chat.controller.js`, `backend/routes/upload.routes.js`, `backend/services/openrouter.service.js` e `backend/middlewares/auth.js`.
- Smoke local sem `MONGO_URI`: `/health` retornou `connected:false` com motivo claro; `/auth/login` retornou `503` imediato com `Banco de dados temporariamente indisponivel`.

## Nota de Continuidade - 2026-05-27 (resiliencia frontend)

Alteracoes adicionais aplicadas no frontend:

- `frontend/app.js`: erros da API agora preservam `status`, `details` e `payload`, permitindo que telas reajam a falhas estruturadas do backend.
- `frontend/exercises.html`: quando a geracao de simulado falha por quantidade insuficiente (`422` com `expected/received`), a tela tenta automaticamente uma nova geracao com quantidade menor e avisa o aluno.
- `frontend/chat.html`: a correcao detalhada de simulado enviada ao Tutor IA agora limita e trunca questoes erradas, evitando contexto gigante em simulados longos.
- `frontend/sidebar.js`: verificado em UTF-8; os acentos estao corretos no arquivo, o mojibake observado era renderizacao do terminal.

## Nota de Continuidade - 2026-05-28 (pendencias de arquivos)

Alteracoes aplicadas nesta rodada:

- `backend/controllers/content.controller.js` e `backend/routes/content.routes.js`: adicionada rota `GET /contents/:id/media` para servir PDFs pelo backend, inclusive quando a origem esta salva como base64, sem expor o payload pesado ao DOM.
- `frontend/study.html`: removida conversao `data:application/pdf;base64` para BlobURL no navegador; o visualizador usa `mediaUrl` e o envio ao Tutor IA usa `contentId` para acionar o parser/texto extraido no backend.
- `backend/services/prompt.service.js` e `backend/services/openrouter.service.js`: escopo do Tutor reforcado para ENEM, vestibulares, escola e estudo, com recusas para pedidos perigosos ou claramente sem valor educacional.
- `frontend/sidebar.js`: padding mobile passa a considerar `env(safe-area-inset-bottom)` e o bottom sheet ganhou limite de altura/scroll para reduzir colisao com telas criticas.
- `frontend/dashboard.html`: link do historico recente ajustado para "Ver todos" apontando para `history.html`.
- `backend/controllers/chat.controller.js`: limpeza do limite de conversas passou a ser agendada de forma nao-bloqueante apos criacao de chat/exercicio/simulado.
- `backend/models/Chat.js`, `backend/controllers/chat.controller.js` e `backend/routes/chat.routes.js`: mensagens novas passam a ter `_id` e existe rota para remover mensagem especifica do banco.
- `backend/controllers/auth.controller.js`, `backend/routes/auth.routes.js`, `backend/middlewares/auth.js` e `frontend/app.js`: logout agora invalida o `sessionToken` no servidor e tokens antigos passam a ser recusados.
- `TASKS.md`: checklist atualizado para refletir pendencias ja resolvidas no codigo.

Validacao esperada: rodar `node --check` nos arquivos alterados e testar manualmente uma aula PDF, o botao "Enviar para Tutor IA" e o historico recente.

Pendencias arquiteturais preservadas para uma etapa propria:

- Converter a aplicacao estatica atual em SPA real com History API exige um roteador e carregamento parcial de telas; trocar links pontuais nao entregaria SPA de verdade.
- Migrar `Chat.mensagens` para collection separada exige script de migracao e ajuste de todos os fluxos de leitura/escrita; nesta rodada foi habilitada remocao individual para novas mensagens via `_id`.
