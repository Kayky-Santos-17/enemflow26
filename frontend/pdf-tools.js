(function () {
  const DB_NAME = 'enemflow-device-files';
  const STORE = 'pdfs';
  const LS_KEY = 'enemflow_device_pdfs_fallback';
  const MAX_LOCAL_BYTES = 12 * 1024 * 1024;

  function escapeHtml(value) {
    return String(value || '')
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function stripHtml(value) {
    const div = document.createElement('div');
    div.innerHTML = String(value || '');
    div.querySelectorAll('script,style,iframe,object,embed,link,meta').forEach(el => el.remove());
    div.querySelectorAll('*').forEach(el => {
      [...el.attributes].forEach(attr => {
        if (/^on/i.test(attr.name) || attr.name === 'srcdoc' || attr.value.toLowerCase().startsWith('javascript:')) {
          el.removeAttribute(attr.name);
        }
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
    const day = 24 * 60 * 60 * 1000;
    if (diff < day) return 'Hoje';
    if (diff < day * 2) return 'Ontem';
    return `${Math.max(2, Math.floor(diff / day))} dias atras`;
  }

  function openDb() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('IndexedDB indisponivel.'));
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE, { keyPath: 'id' });
        }
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
    const response = await fetch(dataUrl);
    return response.blob();
  }

  async function saveFallback(record) {
    if (record.size > 4 * 1024 * 1024) {
      throw new Error('Arquivo muito grande para fallback localStorage.');
    }
    const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    const dataUrl = await blobToDataUrl(record.blob);
    const cleanRecord = { ...record, blob: undefined, dataUrl };
    const next = [cleanRecord, ...saved.filter(item => item.id !== record.id)].slice(0, 12);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
  }

  async function savePdfRecord(record) {
    if (record.size > MAX_LOCAL_BYTES) {
      throw new Error('PDF maior que o limite local permitido.');
    }
    try {
      await withStore('readwrite', store => store.put(record));
    } catch (error) {
      console.warn('[EnemFlowPdfTools] IndexedDB indisponivel, usando localStorage:', error);
      await saveFallback(record);
    }
    return record;
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
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      return saved.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
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
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
      const item = saved.find(record => record.id === id);
      if (item && item.dataUrl) item.blob = await dataUrlToBlob(item.dataUrl);
      return item || null;
    }
  }

  async function deletePdfRecord(id) {
    try {
      await withStore('readwrite', store => store.delete(id));
    } catch {
      const saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]').filter(item => item.id !== id);
      localStorage.setItem(LS_KEY, JSON.stringify(saved));
    }
  }

  async function renamePdfRecord(id, name) {
    const cleanName = sanitizeFileName(name || 'PDF EnemFlow.pdf');
    const record = await getPdfRecord(id);
    if (!record) return null;
    record.name = cleanName;
    await savePdfRecord(record);
    return record;
  }

  function sanitizeFileName(name) {
    const clean = String(name || 'PDF EnemFlow.pdf')
      .replace(/[\\/:*?"<>|]/g, '-')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 90);
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

  function buildPdfHtml({ title, theme, materia, sections = [], footer = 'ENEMFlow' }) {
    const safeSections = sections
      .filter(section => section && (section.content || section.items))
      .map(section => {
        const items = Array.isArray(section.items)
          ? `<ol>${section.items.map(item => `<li>${escapeHtml(sanitizeMarkdownToText(item))}</li>`).join('')}</ol>`
          : '';
        const content = section.content ? `<p>${escapeHtml(sanitizeMarkdownToText(section.content)).replace(/\n/g, '<br>')}</p>` : '';
        return `<section class="ef-pdf-section"><h2>${escapeHtml(section.title)}</h2>${content}${items}</section>`;
      }).join('');

    if (!safeSections.trim()) {
      throw new Error('PDF sem conteudo validado.');
    }

    return `
      <article class="ef-pdf-doc">
        <header class="ef-pdf-cover">
          <div class="ef-pdf-brand">ENEMFlow</div>
          <h1>${escapeHtml(title || 'Material ENEMFlow')}</h1>
          <p>${escapeHtml(theme || materia || 'Estudo inteligente')}</p>
          <small>${new Date().toLocaleString('pt-BR')}</small>
        </header>
        ${safeSections}
        <footer>${escapeHtml(footer)} • Gerado neste dispositivo</footer>
      </article>
    `;
  }

  function buildSimuladoPdfSections(simulado) {
    if (!simulado || !Array.isArray(simulado.questoes) || !simulado.questoes.length) {
      throw new Error('Simulado sem questoes validas.');
    }

    const questoes = simulado.questoes.map((question, index) => ({
      id: question.id || index + 1,
      contexto: question.contexto || question.textoMotivador || '',
      pergunta: question.pergunta || question.enunciado || '',
      alternativas: Array.isArray(question.alternativas) ? question.alternativas : [],
      respostaCorreta: question.respostaCorreta || '',
      resolucao: question.resolucao || question.explicacao || '',
      tema: question.tema || simulado.assunto || '',
      area: question.area || '',
      modeloTri: question.modeloTri || ''
    }));

    return [
      {
        title: 'Resumo do simulado',
        content: `${simulado.instrucoes || ''}\nMateria: ${simulado.materia || ''}\nTema: ${simulado.assunto || ''}\nQuestoes: ${questoes.length}`
      },
      {
        title: 'Questoes',
        content: questoes.map(question => {
          const alternativas = question.alternativas
            .map((option, optionIndex) => `${option.letra || String.fromCharCode(65 + optionIndex)}) ${option.texto || option}`)
            .join('\n');
          return `Questao ${question.id}\nTema: ${question.tema}\nArea: ${question.area}\nModelo TRI: ${question.modeloTri}\n\n${question.contexto}\n\n${question.pergunta}\n${alternativas}`;
        }).join('\n\n')
      },
      {
        title: 'Gabarito e explicacoes',
        content: questoes.map(question => `Questao ${question.id}: ${question.respostaCorreta}\n${question.resolucao}`).join('\n\n')
      }
    ];
  }

  function injectPdfStyles(container) {
    const style = document.createElement('style');
    style.textContent = `
      .ef-pdf-doc{width:794px;min-height:1123px;background:#fff;color:#171427;font-family:Inter,Arial,sans-serif;padding:44px;box-sizing:border-box;}
      .ef-pdf-cover{border-bottom:3px solid #7c5cfc;margin-bottom:26px;padding-bottom:20px;}
      .ef-pdf-brand{display:inline-block;background:linear-gradient(135deg,#7c5cfc,#ec4899);color:#fff;font-weight:800;border-radius:12px;padding:8px 12px;margin-bottom:18px;}
      .ef-pdf-doc h1{font-family:Sora,Inter,Arial,sans-serif;font-size:30px;line-height:1.15;margin:0 0 8px;color:#171427;}
      .ef-pdf-doc h2{font-family:Sora,Inter,Arial,sans-serif;font-size:18px;margin:24px 0 10px;color:#31265f;}
      .ef-pdf-doc p,.ef-pdf-doc li{font-size:12.5px;line-height:1.58;color:#2f2a3f;}
      .ef-pdf-doc ol{padding-left:22px;}
      .ef-pdf-section{page-break-inside:avoid;border-bottom:1px solid #ebe7ff;padding-bottom:12px;}
      .ef-pdf-doc footer{margin-top:28px;color:#6f6790;font-size:11px;text-align:center;}
    `;
    container.appendChild(style);
  }

  async function generatePdfBlob(html, filename) {
    console.info('[EnemFlowPdfTools] iniciando geracao de PDF:', filename);
    if (!html || stripHtml(html).trim().length < 20) {
      throw new Error('PDF sem conteudo suficiente.');
    }

    const wrapper = document.createElement('div');
    wrapper.style.position = 'fixed';
    wrapper.style.left = '-10000px';
    wrapper.style.top = '0';
    wrapper.style.width = '794px';
    wrapper.innerHTML = html;
    injectPdfStyles(wrapper);
    document.body.appendChild(wrapper);

    try {
      if (!window.html2pdf) {
        throw new Error('Biblioteca de PDF nao carregada.');
      }
      const blob = await window.html2pdf()
        .set({
          margin: 0,
          filename: sanitizeFileName(filename),
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
          jsPDF: { unit: 'pt', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css', 'legacy'] }
        })
        .from(wrapper)
        .outputPdf('blob');

      if (!blob || blob.size < 800) {
        throw new Error('PDF gerado sem conteudo valido.');
      }
      console.info('[EnemFlowPdfTools] PDF gerado:', blob.size);
      return blob;
    } finally {
      wrapper.remove();
    }
  }

  window.EnemFlowPdfTools = {
    escapeHtml,
    sanitizeMarkdownToText,
    stripHtml,
    buildPdfHtml,
    buildSimuladoPdfSections,
    generatePdfBlob,
    savePdfRecord,
    listPdfRecords,
    getPdfRecord,
    deletePdfRecord,
    renamePdfRecord,
    downloadBlob,
    openBlob,
    formatBytes,
    relativeDate,
    sanitizeFileName
  };
})();
