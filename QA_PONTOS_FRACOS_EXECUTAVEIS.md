# QA - Pontos fracos executáveis do EnemFlow

Relatório criado após correções no fluxo de PDF para IA, rolagem do visualizador e textos em português.

## Correções aplicadas agora

- O botão "Enviar para Tutor IA" passou a enviar o `contentId` do material.
- O chat agora chama `POST /api/chat/content-context` e usa o `textoExtraido` salvo no backend como contexto principal da IA.
- O visualizador de PDF deixou de forçar `scrollbar=0`, o que melhora a rolagem com mouse no centro do PDF.
- O `iframe` do PDF recebe foco ao passar o mouse, ajudando o navegador a direcionar eventos de rolagem para o visualizador.
- Textos visíveis com mojibake foram corrigidos em pontos críticos do frontend, como Dashboard, Anotações e Habilidades.

## Fase 1 - Segurança crítica

Execute primeiro, em uma janela de manutenção curta.

1. Remover credenciais MongoDB hardcoded de `backend/config/db.js`.
2. Rotacionar a senha do usuário MongoDB exposto.
3. Remover fallback de `JWT_SECRET` em `backend/controllers/auth.controller.js`.
4. Bloquear o boot do backend quando `MONGO_URI`, `JWT_SECRET` ou `OPENROUTER_KEY` estiverem ausentes.
5. Trocar token em `localStorage` por cookie `HttpOnly`, `Secure` e `SameSite=Lax`.

Risco se não executar: vazamento de banco, sequestro de sessão e acesso indevido.

## Fase 2 - Autorização e privacidade

Execute depois da Fase 1, com testes manuais de login.

1. Corrigir `GET /study/history/:userId` para permitir apenas o próprio usuário ou admin.
2. Adicionar revalidação de senha nas ações destrutivas do Owner.
3. Adicionar confirmação dupla para excluir todos os chats.
4. Garantir que admins não consigam alterar usuários Owner.
5. Padronizar respostas de erro para não revelar se um e-mail existe.

Risco se não executar: vazamento de histórico de estudo e exclusões acidentais.

## Fase 3 - PDF e Tutor IA

Execute em partes pequenas, validando um PDF por vez.

1. Garantir que todo PDF criado pelo admin salve `textoExtraido`.
2. Mostrar mensagem amigável quando o PDF não tiver texto extraível.
3. Adicionar OCR futuro para PDFs escaneados/imagens.
4. Salvar metadados de extração: tamanho, quantidade de páginas e data de processamento.
5. Limitar o contexto enviado à IA por tokens, não apenas por `substring`.

Risco se não executar: respostas incompletas da IA ou falhas silenciosas em PDFs escaneados.

## Fase 4 - Frontend e UX

Execute por página, começando por `study.html` e `chat.html`.

1. Remover `innerHTML` onde entra conteúdo dinâmico de usuário ou IA.
2. Sanitizar Markdown retornado pela IA antes de renderizar.
3. Criar componente único de toast, modal e botão para reduzir inconsistência visual.
4. Revisar rolagem em páginas com `body overflow-hidden`.
5. Testar mobile em largura 375px, 390px, 414px e desktop 1366px.

Risco se não executar: XSS, textos quebrados e navegação ruim em mobile.

## Fase 5 - IA, ML e qualidade pedagógica

Execute sem bloquear o uso atual do sistema.

1. Separar prompts por caso: tutor, simulado, resumo, plano e PDF.
2. Criar testes com entradas fixas para avaliar formato das respostas.
3. Medir taxa de respostas recusadas, respostas fora de escopo e falhas JSON.
4. Registrar feedback do aluno sobre utilidade da recomendação.
5. Validar o Q-learning com métricas simples antes de chamar de modelo adaptativo.

Risco se não executar: recomendações inconsistentes e respostas pedagógicas instáveis.

## Fase 6 - Banco e performance

Execute em horários de baixo uso.

1. Criar índice `{ usuarioId: 1, tipo: 1, updatedAt: -1 }` em `Chat`.
2. Separar mensagens em coleção própria quando o histórico crescer.
3. Criar job de limpeza de chats antigos fora do request do usuário.
4. Evitar PDFs base64 grandes no MongoDB.
5. Adicionar paginação em listas de chats, usuários e conteúdos.

Risco se não executar: lentidão no dashboard, documentos MongoDB grandes e aumento de custo.

## Fase 7 - Testes recomendados

Execute antes de publicar.

1. Login, registro, logout e troca de senha.
2. Upload de PDF com texto selecionável.
3. Upload de PDF escaneado.
4. Botão "Enviar para Tutor IA" em PDF válido.
5. Rolagem com mouse no centro do PDF.
6. Chat com pergunta normal, pergunta fora de escopo e pergunta longa.
7. Owner: listar alunos, bloquear aluno e limpar chats com confirmação.
8. Mobile: Dashboard, Matérias, Study e Chat.

## Critérios de aceite

- PDF abre, rola pelo centro da tela e não depende apenas da barra lateral.
- Tutor IA responde usando o conteúdo real do PDF quando `textoExtraido` existir.
- Textos em português aparecem com acentos corretos.
- Nenhuma ação destrutiva roda sem autenticação e confirmação adequada.
- O sistema continua utilizável mesmo quando a IA falha ou demora.
