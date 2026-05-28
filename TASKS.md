# Tasks - EnemFlow

# Dashboard

- [x] Melhorar espaçamento do card de "Tutor IA" no mobile (evitar colisão de texto).
- [x] Otimizar ícones (`feather.replace`) para lazy load ou SVGs estáticos.
- [x] Adicionar botão "Ver todos" funcional no histórico recente.
- [x] Mudar loader esqueleto padrão por um skeleton pulsante com formato de raio.

---

# Sidebar & Navegação

- [x] Corrigir padding inferior no mobile para compensar a barra nativa do iOS (safe-area).
- [x] Corrigir z-index do modal `ef-mobile-sheet` para não sobrepor telas críticas.
- [ ] Converter cliques em navegação History API (SPA) em vez de window.location.

---

# Modo Estudo (PDF & Vídeo)

- [x] Implementar a Fullscreen API nativa no botão "Tela Cheia".
- [x] Adicionar botão "Pausar" no cronômetro do Modo Foco.
- [x] Impedir processamento de base64 no DOM (modificar extração de BlobURL no backend em vez de em runtime no navegador).
- [x] Enviar texto do PDF real (via parser backend) no clique de "Enviar para Tutor IA".

---

# Tutor IA (Chat)

- [x] Limitar array de histórico estrito sem perder contexto inicial (system prompt).
- [x] Refinar o "System Prompt" de Questões (aplicar diretrizes do TRI).
- [x] Bloquear assuntos que fujam de Enem, Vestibular e Estudos.
- [x] Substituir o `slice(-20)` burro por um sumário automático do chat ou compressão de tokens.

---

# Admin & Owner Backend

- [x] Corrigir o método síncrono `getFolderSize` no backend (`owner.controller.js`) usando versão assíncrona (`fs.promises`).
- [x] Adicionar revalidação de senha na rota de excluir chats.
- [x] Adicionar Rate Limit (throttle) nas rotas de chamada da LLM.
- [x] Separar a lógica de limpeza (`enforceLimit`) para rodar como job (cron) ou de forma não-bloqueante no request.

---

# Perfil & Banco de Dados

- [ ] Mover array de "Mensagens" do Chat para uma Collection individual (esquema normalizado) para suportar logs infinitos.
- [x] Adicionar validação de tokens expirados/Lista Negra de JWT ao deslogar.
- [x] Permitir a remoção individual de uma mensagem específica no banco.
