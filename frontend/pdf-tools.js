(function () {
  const DB_NAME = 'enemflow-device-files';
  const STORE = 'pdfs';
  const LS_KEY = 'enemflow_device_pdfs_fallback';
  const MAX_LOCAL_BYTES = 18 * 1024 * 1024;

  const escapeHtml = value => String(value || '')
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;').replaceAll("'", '&#039;');

  function stripHtml(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '');
    div.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        const attrValue = String(attr.value || '').toLowerCase();
        if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || attrValue.startsWith('javascript:')) el.removeAttribute(attr.name);
      });
    });
    return div.textContent || div.innerText || '';
  }

  function sanitizeMarkdownToText(value) {
    return stripHtml(value)
      .replace(/```[\s\S]*?```/g, block => block.replace(/```/g, ''))
      .replace(/[#*_>`~-]/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 KB';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${(bytes / Math.pow(1024, index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function relativeDate(dateValue) {
    const date = new Date(dateValue);
    const diff = Date.now() - date.getTime();
    const day = 86400000;
    if (diff < day) return 'Hoje';
    if (diff < day * 2) return 'Ontem';
    return `${Math.max(2, Math.floor(diff / day))} dias atras`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponivel.'));
      const request = indexedDB.open(DB_NAME, 2);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error('Falha ao abrir IndexedDB.'));
    });
  }

  async function withStore(mode, callback) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      const result = callback(store);
      tx.oncomplete = () => resolve(result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  }

  function blobToDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    });
  }

  async function dataUrlToBlob(dataUrl) {
    return (await fetch(dataUrl)).blob();
  }

  async function saveFallback(record) {
    if (record.size > 4 * 1024 * 1024) throw new Error('Arquivo muito grande para fallback localStorage.');
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const dataUrl = await blobToDataUrl(record.blob);
    const cleanRecord = { ...record, blob: undefined, dataUrl };
    localStorage.setItem(LS_KEY, JSON.stringify([cleanRecord, ...saved.filter(item => item.id !== record.id)].slice(0, 16)));
  }

  async function savePdfRecord(record) {
    if (record.size > MAX_LOCAL_BYTES) throw new Error('PDF maior que o limite local permitido.');
    const normalized = {
      tipo: 'material',
      materia: 'Geral',
      assunto: 'Geral',
      topico: 'Geral',
      createdAt: new Date().toISOString(),
      ...record
    };
    try {
      await withStore('readwrite', store => store.put(normalized));
    } catch (error) {
      console.warn('[EnemFlowPdfTools] IndexedDB indisponivel, usando localStorage:', error);
      await saveFallback(normalized);
    }
    return normalized;
  }

  async function listPdfRecords() {
    try {
      return await new Promise(async (resolve, reject) => {
        const db = await openDb();
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).getAll();
        request.onsuccess = () => resolve(request.result.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)));
        request.onerror = () => reject(request.error);
      });
    } catch {
      return JSON.parse(localStorage.getItem(LS_KEY) || '[]').sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
  }

  async function getPdfRecord(id) {
    try {
      return await new Promise(async (resolve, reject) => {
        const db = await openDb();
        const tx = db.transaction(STORE, 'readonly');
        const request = tx.objectStore(STORE).get(id);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      });
    } catch {
      const item = JSON.parse(localStorage.getItem(LS_KEY) || '[]').find(record => record.id === id);
      if (item?.dataUrl) item.blob = await dataUrlToBlob(item.dataUrl);
      return item || null;
    }
  }

  async function deletePdfRecord(id) {
    try {
      await withStore('readwrite', store => store.delete(id));
    } catch {
      localStorage.setItem(LS_KEY, JSON.stringify(JSON.parse(localStorage.getItem(LS_KEY) || '[]').filter(item => item.id !== id)));
    }
  }

  async function renamePdfRecord(id, name) {
    const record = await getPdfRecord(id);
    if (!record) return null;
    record.name = sanitizeFileName(name || record.name);
    await savePdfRecord(record);
    return record;
  }

  function sanitizeFileName(name) {
    const clean = String(name || 'PDF EnemFlow.pdf')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 100);
    return clean.toLowerCase().endsWith('.pdf') ? clean : `${clean}.pdf`;
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = sanitizeFileName(filename);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  }

  function openBlob(blob) {
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank', 'noopener,noreferrer');
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  function renderSection(section) {
    const title = `<h2>${escapeHtml(section.title)}</h2>`;
    if (section.html) return `<section class="ef-pdf-section">${title}${section.html}</section>`;
    const items = Array.isArray(section.items)
      ? `<ol>${section.items.map(item => `<li>${escapeHtml(sanitizeMarkdownToText(item))}</li>`).join('')}</ol>`
      : '';
    const content = section.content
      ? `<p>${escapeHtml(sanitizeMarkdownToText(section.content)).replace(/\n/g, '<br>')}</p>`
      : '';
    return `<section class="ef-pdf-section">${title}${content}${items}</section>`;
  }

  function buildPdfHtml({ title, theme, materia, sections = [], footer = 'EnemFlow26' }) {
    const safeSections = sections.filter(section => section && (section.content || section.items || section.html)).map(renderSection).join('');
    if (!safeSections.trim()) throw new Error('PDF sem conteudo validado.');
    return `
      <article class="ef-pdf-doc">
        <header class="ef-pdf-cover">
          <div class="ef-pdf-brand-row">
            <span class="ef-pdf-logo"><img src="favicon.svg" alt=""></span>
            <div>
              <div class="ef-pdf-brand">EnemFlow26</div>
              <small>Plataforma de estudo inteligente para o ENEM</small>
            </div>
          </div>
          <h1>${escapeHtml(title || 'Material ENEMFlow')}</h1>
          <p>${escapeHtml(theme || materia || 'Estudo inteligente')}</p>
          <div class="ef-pdf-cover-meta">
            <span>${escapeHtml(materia || 'Estudo')}</span>
            <span>${new Date().toLocaleString('pt-BR')}</span>
          </div>
        </header>
        ${safeSections}
        <footer>${escapeHtml(footer)} - Gerado neste dispositivo</footer>
      </article>
    `;
  }

  function buildSimuladoPdfSections(simulado) {
    if (!simulado || !Array.isArray(simulado.questoes) || !simulado.questoes.length) throw new Error('Simulado sem questoes validas.');
    const header = {
      title: 'Dados do simulado',
      html: `
        <div class="ef-pdf-meta">
          <span>Materia: ${escapeHtml(simulado.materia || 'Geral')}</span>
          <span>Assunto: ${escapeHtml(simulado.assunto || 'Geral')}</span>
          <span>Topico: ${escapeHtml(simulado.topico || simulado.assunto || 'Geral')}</span>
          <span>Questoes: ${simulado.questoes.length}</span>
        </div>
        ${simulado.descricao ? `<p>${escapeHtml(simulado.descricao)}</p>` : ''}
        <p>${escapeHtml(simulado.instrucoes || 'Leia cada questão com atenção e marque apenas uma alternativa.')}</p>
      `
    };
    const questions = simulado.questoes.map((question, index) => {
      const id = question.id || index + 1;
      const alternativas = (question.alternativas || []).map((option, optionIndex) => `
        <li><strong>${escapeHtml(option.letra || String.fromCharCode(65 + optionIndex))})</strong> ${escapeHtml(option.texto || option)}</li>
      `).join('');
      return {
        title: `Questao ${id}`,
        html: `
          <p class="ef-pdf-question-meta">${escapeHtml(question.tema || simulado.topico || '')} ${question.dificuldade ? '- ' + escapeHtml(question.dificuldade) : ''}</p>
          <p>${escapeHtml(question.contexto || question.textoMotivador || '')}</p>
          ${question.interpretacao ? `<p><strong>Interpretacao:</strong> ${escapeHtml(question.interpretacao)}</p>` : ''}
          <p><strong>${escapeHtml(question.pergunta || question.enunciado || '')}</strong></p>
          <ol class="ef-pdf-options">${alternativas}</ol>
        `
      };
    });
    const answers = {
      title: 'Gabarito e explicacoes',
      html: simulado.questoes.map((question, index) => `
        <div class="ef-pdf-answer">
          <p><strong>Questao ${question.id || index + 1}: ${escapeHtml(question.respostaCorreta || '')}</strong></p>
          <p>${escapeHtml(question.resolucao || question.explicacao || '')}</p>
        </div>
      `).join('')
    };
    return [header, ...questions, answers];
  }

  function injectPdfStyles(container) {
    const style = document.createElement('style');
    style.textContent = `
      .ef-pdf-doc{width:794px;min-height:1123px;background:#fff;color:#171427;font-family:Inter,Arial,sans-serif;padding:46px 48px 54px;box-sizing:border-box;}
      .ef-pdf-cover{border-bottom:3px solid #7c5cfc;margin-bottom:24px;padding-bottom:18px;break-after:avoid;page-break-after:avoid;}
      .ef-pdf-brand-row{display:flex;align-items:center;gap:12px;margin-bottom:18px;}
      .ef-pdf-logo{width:44px;height:44px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;background:#f4f1ff;border:1px solid #e5dcff;}
      .ef-pdf-logo img{width:28px;height:28px;object-fit:contain;}
      .ef-pdf-brand{font-family:Sora,Inter,Arial,sans-serif;font-size:15px;color:#31265f;font-weight:900;letter-spacing:.01em;}
      .ef-pdf-cover small{font-size:10px;color:#756a9a;font-weight:700;}
      .ef-pdf-cover-meta{display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;}
      .ef-pdf-cover-meta span{background:#f5f3ff;border:1px solid #e8e2ff;border-radius:999px;padding:5px 9px;font-size:10px;font-weight:800;color:#5c4b95;}
      .ef-pdf-doc h1{font-family:Sora,Inter,Arial,sans-serif;font-size:30px;line-height:1.13;margin:0 0 8px;color:#171427;letter-spacing:0;}
      .ef-pdf-doc h2{font-family:Sora,Inter,Arial,sans-serif;font-size:16px;margin:0 0 10px;color:#31265f;letter-spacing:0;}
      .ef-pdf-doc p,.ef-pdf-doc li,.ef-pdf-doc span{font-size:11.6px;line-height:1.58;color:#2f2a3f;}
      .ef-pdf-section{break-inside:auto;page-break-inside:auto;border-bottom:1px solid #ebe7ff;padding:0 0 13px;margin:0 0 17px;}
      .ef-pdf-options{padding-left:22px;margin:8px 0 0;}
      .ef-pdf-options li{margin:5px 0;}
      .ef-pdf-meta{display:grid;grid-template-columns:1fr 1fr;gap:6px 12px;margin-bottom:10px;}
      .ef-pdf-meta span{background:#f5f3ff;border:1px solid #e8e2ff;border-radius:8px;padding:6px 8px;font-weight:700;}
      .ef-pdf-question-meta{font-size:10.5px!important;color:#6d5ba8!important;text-transform:uppercase;font-weight:800;letter-spacing:.02em;}
      .ef-pdf-answer{break-inside:avoid;page-break-inside:avoid;border:1px solid #e8e2ff;border-radius:10px;padding:8px 10px;margin:8px 0;background:#fbfaff;}
      .ef-pdf-doc footer{margin-top:24px;color:#6f6790;font-size:10px;text-align:center;border-top:1px solid #ebe7ff;padding-top:12px;}
    `;
    container.appendChild(style);
  }

  async function waitForPdfAssets(container) {
    if (document.fonts?.ready) await document.fonts.ready.catch(() => {});
    const images = [...container.querySelectorAll('img')];
    await Promise.all(images.map(img => {
      if (img.complete && img.naturalWidth) return Promise.resolve();
      if (img.decode) return img.decode().catch(() => {});
      return new Promise(resolve => {
        img.onload = resolve;
        img.onerror = resolve;
      });
    }));
  }

  async function generatePdfBlob(html, filename) {
    if (!html || stripHtml(html).trim().length < 20) throw new Error('PDF sem conteudo suficiente.');
    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.style.width = '794px';
    wrapper.innerHTML = html;
    injectPdfStyles(wrapper);
    document.body.appendChild(wrapper);
    try {
      if (!window.html2pdf) throw new Error('Biblioteca de PDF nao carregada.');
      await waitForPdfAssets(wrapper);
      const canvasScale = window.matchMedia && window.matchMedia('(max-width: 700px)').matches ? 1.45 : 2;
      const worker = window.html2pdf()
        .set({
          margin: [18, 14, 28, 14],
          filename: sanitizeFileName(filename),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: canvasScale, useCORS: true, backgroundColor: '#ffffff', logging: false, letterRendering: true },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait', compress: true },
          pagebreak: { mode: ['css', 'legacy'], avoid: ['.ef-pdf-answer', '.ef-pdf-cover'] }
        })
        .from(wrapper)
        .toPdf();
      const pdf = await worker.get('pdf');
      const pages = pdf.internal.getNumberOfPages();
      for (let page = 1; page <= pages; page += 1) {
        pdf.setPage(page);
        const width = pdf.internal.pageSize.getWidth();
        const height = pdf.internal.pageSize.getHeight();
        pdf.setDrawColor(232, 226, 255);
        pdf.setLineWidth(0.4);
        pdf.line(38, 24, width - 38, 24);
        pdf.line(38, height - 30, width - 38, height - 30);
        pdf.setFontSize(9);
        pdf.setTextColor(110, 103, 144);
        pdf.text('EnemFlow26', 42, height - 14);
        pdf.text(`Pagina ${page} de ${pages}`, width - 86, height - 14);
      }
      const blob = await worker.outputPdf('blob');
      if (!blob || blob.size < 800) throw new Error('PDF gerado sem conteudo valido.');
      return blob;
    } finally {
      wrapper.remove();
    }
  }

  window.EnemFlowPdfTools = {
    escapeHtml, sanitizeMarkdownToText, stripHtml, buildPdfHtml, buildSimuladoPdfSections,
    generatePdfBlob, savePdfRecord, listPdfRecords, getPdfRecord, deletePdfRecord,
    renamePdfRecord, downloadBlob, openBlob, formatBytes, relativeDate, sanitizeFileName
  };
})();

