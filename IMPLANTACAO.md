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
