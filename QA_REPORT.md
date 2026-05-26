# QA — Projeto EnemFlow

---

## Problemas Críticos

- **Loop Bloqueante no Backend (Node.js)**: A função `getFolderSize` em `owner.controller.js` usa métodos síncronos (`fs.readdirSync`, `fs.statSync`). Em uma pasta de uploads grande, isso bloqueia a thread do Node.js inteira, travando o sistema para **todos** os usuários quando a rota de métricas é chamada.
- **Race Condition no Limite de Chats**: Em `chat.controller.js`, a rotina de limpeza (`enforceLimit`) roda após criar a conversa. Se múltiplos requests concorrentes forem feitos, a plataforma pode disparar dezenas de chamadas à API da OpenRouter antes do limite atuar.
- **Armazenamento de PDF Criptografado no DOM**: No `study.html`, a conversão `dataURLtoBlobURL` converte PDFs base64 direto na memória do cliente na hora do carregamento, travando abas do navegador em dispositivos móveis caso o PDF tenha muitos megabytes.

---

## Problemas Médios

- **Histórico IA Burro (`slice(-20)`)**: A IA no `chat.controller.js` pega apenas as últimas 20 mensagens estaticamente. Se houver textos massivos (ex: leitura de PDF), isso quebra o limite de tokens da LLM muito rapidamente e faz a IA "esquecer" seu propósito principal.
- **Falso Tela Cheia (PDF)**: O botão "Tela cheia" no `study.html` apenas colapsa a grade (`grid-template-columns: 1fr 0px`), mas não chama a *Fullscreen API* nativa do navegador (`element.requestFullscreen()`), deixando visíveis a barra de endereço e botões nativos no mobile.
- **Crescimento de Arrays MongoDB**: A coleção `Chat` usa subdocumentos para o array de `mensagens`. Documentos muito longos ficam lentos para dar *parse*. O ideal seria uma coleção separada de `Message` referenciando o `Chat` ou um limite hard na criação/push.

---

## Melhorias sugeridas

- **Integração de PDFs com Chat**: Atualmente, `sendPdfToAI` no `study.html` envia apenas a *URL* em `localStorage` (`pdfContextUrl`). Se a IA tentar acessar uma rota local/blob, ela falhará. É preciso extrair o texto no backend ou frontend antes de mandar para a IA.
- **Transição SPA Simples**: Vários links recarregam a página inteira (ex: `window.location.href = 'materias.html'`). Utilizar History API ou refatorar o carregamento dos conteúdos traria uma experiência fluida de Single Page App genuína.

---

## Sugestões UX

- O *Z-index* do `ef-mobile-sheet` (menu inferior no mobile) pode causar conflitos se acionado durante o "Modo Imersivo" do cronômetro.
- Se o usuário pausar o "Cronômetro", não há um botão nativo de "Pausar", apenas "Encerrar Sessão", o que obriga o aluno a iniciar uma nova se quiser ir beber água.

---

## Sugestões UI

- Unificar o *Glassmorphism*. Alguns elementos utilizam `backdrop-filter` com bordas roxas sólidas, enquanto os *subject-cards* de matérias possuem o `assunto-orb` que traz uma estética melhor. Aplicar o modelo *orb/glow* nos modais de "Tutor IA".
- O Loader do `dashboard.html` (skeleton) fica visível pouco tempo, mas pode ser mais estilizado com a logo do raio *pulsante* no centro da tela ao invés de barrinhas cinzas.

---

## Sugestões Mobile

- Em `dashboard.html`, a aba *Tutor IA* e o texto de XP quebram linha ou colidem em iPhones pequenos (ex: SE) na área superior direita (`header`).
- A "navbar" inferior flutuante (`ef-bottom-nav`) fica exatamente na zona de toque de swiping do iOS. Adicionar `padding-bottom: env(safe-area-inset-bottom)` real na `main` além da nav.

---

## Sugestões Performance

- **Lazy Loading nos Ícones**: `feather.replace()` é chamado múltiplas vezes a cada re-render (ex: abrir abas nas matérias). Ele recria SVGs inteiros em todos os `<i>`. Adicionar validação se o ícone já possui a classe SVG gerada evita render extra.
- Remover transições custosas (`backdrop-filter`) em estados ocultos ou de overflow escondido.

---

## Sugestões Banco de Dados

- Criar um `Index` composto `{ usuarioId: 1, tipo: 1, createdAt: -1 }` em `Chat` para acelerar o dashboard quando ele filtra apenas conversas do tipo *exercício* ou *chat*.
- Evitar usar o campo estrito `{ _id: false }` no `messageSchema` a menos que seja 100% garantido que as mensagens nunca precisarão ser editadas ou deletadas individualmente (ex: remover uma mensagem errada da IA).

---

## Sugestões IA

- O *System Prompt* gerador de Questão (ENEM) é muito genérico. Deveria forçar as diretrizes oficiais do TRI (Teoria da Resposta ao Item) e adicionar um limite de contexto restrito.
- Bloqueio de Assunto: O *System Prompt* do Tutor IA deve instruir ativamente a LLM a **recusar** pedidos que não sejam de cunho educacional.

---

## Sugestões Segurança

- Rotas sensíveis de Admin (`/owner.html`) expõem endpoints de limpar o banco (`deleteAllChats`). Eles devem requerer confirmação dupla e revalidação de senha.
- JWT não parece estar implementando checagem de "Lista Negra" ou tempo de vida curto com Refresh Token, abrindo brechas se o token for roubado (sessionStorage).

---

## Roadmap sugerido

### Prioridade Alta
- Corrigir o método síncrono `getFolderSize` no backend admin.
- Otimizar a lógica de histórico e truncagem do Tutor IA (`chat.controller.js`).
- Corrigir botões "Tela cheia" e experiência do PDF no mobile.

### Prioridade Média
- Melhorar System Prompt do Tutor IA e impedir respostas fora de contexto (ex: IA ajudando a hackear ou fazer bolo).
- Adicionar botão de "Pausar" no cronômetro (atualmente ele só finaliza e calcula o XP direto).
- Ajustar os z-index da navegação mobile vs visualizador de PDFs.

### Prioridade Baixa
- Mudar navegação manual para modelo SPA (History API) sem refresh completo.
- Refinar os ícones Feather via SVG estático ao invés de processar por JS via `feather.replace()`.
- Otimizar o design do Dashboard para que os "Cartões Recentes" sejam expansíveis.

---

## Checklist Final

[x] Análise do Frontend (HTML, CSS, Componentes)
[x] Análise de Responsividade & UI Mobile
[x] Revisão dos Fluxos de Aluno/Estudo
[x] Revisão do Código Admin
[x] Análise do Tutor IA / OpenRouter
[x] Análise do Banco de Dados / MongoDB
[x] Verificação de Gargalos de Performance
