# Implantacao - EnemFlow26

## Status atual

O projeto esta preparado para implantacao com as correcoes iniciais de:

- Gerador de simulados com retry para completar questoes faltantes.
- Tutor IA com historico compactado e contexto menos ruidoso.
- IA adaptativa registrando `acertos` e `total` reais do simulado.
- Q-learning com cold start baseado em progresso real.
- Remocao de credenciais hardcoded do MongoDB e fallback inseguro de JWT.

## Variaveis obrigatorias

Configure estas variaveis no ambiente local e na Vercel:

```env
MONGO_URI=mongodb+srv://<usuario>:<senha>@<cluster>/<database>?retryWrites=true&w=majority
JWT_SECRET=<chave-forte-com-32-ou-mais-caracteres>
JWT_EXPIRES_IN=7d
OPENROUTER_KEY=<sua-chave-openrouter>
OPENROUTER_MODEL=openai/gpt-4.1-nano
FRONTEND_URL=https://<seu-dominio-ou-projeto-vercel>
NODE_ENV=production
```

`FRONTEND_URL` aceita uma lista separada por virgulas quando houver mais de um dominio autorizado, por exemplo preview e producao.

## Variaveis recomendadas de seguranca e performance

```env
JSON_BODY_LIMIT=5mb
FORM_BODY_LIMIT=5mb
API_RATE_LIMIT_MAX=180
AI_RATE_LIMIT_MAX=6
AUTH_RATE_LIMIT_MAX=20
OPENROUTER_TIMEOUT_MS=45000
UPLOAD_MAX_BYTES=10485760
PDF_FETCH_TIMEOUT_MS=12000
PDF_FETCH_MAX_BYTES=10485760
LEGACY_ADMIN_EMAIL=<somente-se-precisar-promover-um-admin-antigo>
```

Observacoes:

- `JWT_SECRET` precisa ter 32 ou mais caracteres em producao.
- `AUTH_RATE_LIMIT_MAX` deve ficar baixo o suficiente para reduzir brute force sem bloquear testes reais.
- `AI_RATE_LIMIT_MAX` protege custo e estabilidade do Tutor IA e do Gerador de Simulados.
- `UPLOAD_MAX_BYTES` e `PDF_FETCH_MAX_BYTES` devem acompanhar o limite real suportado pelo provedor de deploy.
- Se `FRONTEND_URL` nao estiver configurada em producao, chamadas CORS vindas de outro dominio serao bloqueadas.

Para desenvolvimento local, copie `backend/.env.example` para `backend/.env` e preencha os valores reais.

## Validacao local

Execute antes de subir:

```bash
npm install
node --check backend/server.js
node --check backend/controllers/chat.controller.js
node --check backend/services/openrouter.service.js
node --check backend/services/ai-adaptation.service.js
node --check backend/services/qLearning.service.js
node --check backend/middlewares/rateLimiter.js
node testar-banco.js
npm start
```

Depois de iniciar o servidor local:

```bash
curl http://localhost:3000/health
```

Resultado esperado:

```json
{
  "status": "ok",
  "connected": true,
  "env": "development"
}
```

## Deploy na Vercel

1. Confirme que as variaveis obrigatorias foram cadastradas em Project Settings > Environment Variables.
2. Confirme que `vercel.json` esta usando:
   - `backend/server.js` como funcao Node.
   - `frontend/**` como arquivos estaticos.
   - rewrites para `/auth`, `/api`, `/contents`, `/study`, `/upload`, `/health` e frontend.
3. Suba o codigo para o GitHub.
4. Execute o deploy pela Vercel conectada ao repositorio ou pelo CLI:

```bash
vercel --prod
```

## Smoke tests pos-deploy

Troque `<url>` pela URL final da Vercel:

```bash
curl https://<url>/health
```

URL verificada em 2026-05-27:

```bash
curl https://enemflow26.vercel.app/health
```

Resultado observado:

```json
{
  "status": "ok",
  "connected": false,
  "env": "production"
}
```

Interpretacao: o deploy existe e o backend responde em producao, mas o MongoDB nao esta conectado. Antes do ajuste de continuidade, um login de smoke com usuario inexistente retornava `500` com timeout em `users.findOne()`. O backend agora possui guarda de banco para retornar `503` rapidamente quando a conexao estiver indisponivel. Verifique se `MONGO_URI` foi cadastrada corretamente na Vercel, se a senha esta URL-encoded, se o banco/database existe e se o MongoDB Atlas permite conexoes vindas da Vercel.

Depois do proximo deploy, o `/health` deve incluir `db.readyState`, `db.hasMongoUri` e `db.reason` para facilitar diagnostico sem expor a connection string.

Fluxos manuais obrigatorios:

- Login/registro.
- Abrir dashboard.
- Gerar simulado com 5 questoes.
- Gerar simulado com 10 questoes.
- Abrir Tutor IA e fazer uma pergunta de estudo.
- Corrigir simulado e conferir se o progresso aparece em habilidades.
- Upload/analisar PDF pequeno, se aplicavel.

## Observacoes importantes

- Sem `OPENROUTER_KEY`, o Tutor IA e o Gerador de Simulados nao funcionam.
- Sem `MONGO_URI`, o backend sobe sem conexao util e deve falhar nos fluxos de dados.
- Nao commitar `backend/.env`.
- Se a IA retornar JSON incompleto, o backend tenta completar as questoes faltantes automaticamente.
