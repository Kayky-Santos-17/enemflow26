# PRD - CORRINDO_O_BACK

## Objetivo
Corrigir completamente o fluxo de geracao de simulados do EnemFlow:

Frontend -> API -> OpenRouter -> JSON valido -> MongoDB -> exibicao no frontend

## Diagnostico Inicial
- [x] Mapear rota `/api/chat/simulado`.
- [x] Conferir middleware de autenticacao.
- [x] Conferir carregamento de variaveis de ambiente.
- [x] Conferir integracao OpenRouter.
- [x] Conferir parser JSON do retorno da IA.
- [x] Conferir timeout, contexto e `max_tokens`.
- [x] Conferir salvamento no MongoDB.
- [x] Conferir frontend `exercises.html` e `App.api`.

## Causas Provaveis do Erro 500
- [x] `maxTokens` estava alto demais para simulados (`safeQuantidade * 1250`, teto 16000), aumentando chance de timeout/context length.
- [x] `responseFormat: 'json'` dependia de conversao interna limitada; agora aceita objeto `{ type: 'json_object' }`.
- [x] Erros do OpenRouter eram pouco estruturados para debugging.
- [x] Parser JSON aceitava apenas o primeiro objeto extraido, mas nao reaproveitava bem respostas com markdown.
- [x] Salvamento do simulado completo no historico podia gravar payload grande demais.
- [x] `backend/.env` nao existe nesta pasta local; ha apenas `backend/.env.example`.

## Etapas Executaveis

### 1. OpenRouter e ENV
- [x] Garantir `dotenv` no servico OpenRouter.
- [x] Validar `OPENROUTER_KEY` antes de chamar a IA.
- [x] Retornar erro claro quando a chave nao estiver configurada.
- [x] Melhorar logs com status, tentativa, modelo e detalhes seguros.
- [x] Normalizar `response_format`.
- [x] Preservar retry para erros temporarios.

### 2. Simulado Backend
- [x] Reduzir `maxTokens` principal para `Math.min(6000, Math.max(2500, safeQuantidade * 450))`.
- [x] Reduzir tokens da geracao complementar.
- [x] Criar `safeJsonParse`.
- [x] Enxugar prompt do simulado.
- [x] Limitar descricao e quantidade.
- [x] Retornar JSON padrao com `success`.
- [x] Incluir logs completos no catch.
- [x] Limitar salvamento do JSON no MongoDB a 50000 caracteres.

### 3. Autenticacao
- [x] Confirmar que `chat.routes.js` aplica `router.use(auth)`.
- [x] Fazer middleware preencher `req.user` alem de `req.userId`.
- [x] Adicionar guarda e log caso o controller seja chamado sem usuario.

### 4. Frontend
- [x] Melhorar leitura de erro da API quando vier `success: false`.
- [x] Aumentar timeout do simulado para acomodar geracao segura.
- [x] Manter fallback por quantidade menor em erro 422.

### 5. Validacao
- [x] Rodar `node --check` nos arquivos alterados.
- [x] Validar scripts inline de `frontend/exercises.html`.
- [x] Rodar `git diff --check`.
- [x] Ajustar `maxDuration` da funcao Vercel para evitar timeout serverless no simulado.
- [x] Fazer handler global retornar detalhes de erro para endpoints de API.
- [x] Corrigir CORS em producao para aceitar `FRONTEND_URL`, `enemflow26.vercel.app` e previews `.vercel.app`.
- [ ] Testar chamada real com OpenRouter e MongoDB configurados. Bloqueado nesta copia local porque `backend/.env` nao existe.
- [x] Commit e push final.

## Resultado Esperado
- [x] `/api/chat/simulado` retorna JSON valido em sucesso.
- [x] Erros de ENV/OpenRouter/parse retornam JSON util para o frontend.
- [x] Prompt e tokens ficam dentro de limites mais seguros.
- [x] Historico salva payload truncado para reduzir carga no MongoDB.
- [x] Frontend exibe erro real em vez de mensagem generica.

## Observacao Operacional
Para ambiente local/producao, configure obrigatoriamente:

```env
OPENROUTER_KEY=sk-or-v1-...
OPENROUTER_MODEL=openai/gpt-4.1-nano
OPENROUTER_TIMEOUT_MS=60000
JWT_SECRET=...
MONGO_URI=...
```
