/* Integração do escritório: GitHub Pages -> Cloudflare Worker -> Gemini. */
(function () {
  const WORKER_URL = 'https://restless-salad-4587escritorio-ia.advogados-acot.workers.dev';
  const MODEL = 'gemini-3.8-flash';
  const TIMEOUT_MS = 90000;

  async function fetchJson(url, options, timeoutMs) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {...options, signal: controller.signal});
      const raw = await response.text();
      let data = null;
      try { data = raw ? JSON.parse(raw) : null; } catch { data = { raw }; }
      return {response, data};
    } finally { clearTimeout(timer); }
  }

  function readableError(response, data) {
    const msg = data?.error || data?.message || data?.details?.error?.message || data?.raw;
    return msg ? String(msg).slice(0, 1500) : `Worker respondeu HTTP ${response?.status || 'desconhecido'}.`;
  }

  async function health() {
    try {
      const {response, data} = await fetchJson(WORKER_URL, {method:'GET'}, 15000);
      return {ok: response.ok && data?.ok === true, data, status: response.status};
    } catch (e) {
      return {ok:false, error:e?.name === 'AbortError' ? 'Tempo esgotado no teste do Worker.' : String(e)};
    }
  }

  async function executarGemini(pedido) {
    const dados = pedido || {};
    const tarefa = dados.tarefa || {};
    const prompt = [
      'Você é um agente de trabalho do Escritório Virtual de Marketing — Salário-Maternidade.',
      'Execute somente a etapa solicitada e entregue um resultado utilizável.',
      'Não invente fatos, dados, pesquisas, fontes, métricas ou ações externas.',
      'Se faltar informação essencial, sinalize claramente.', '',
      `Agente: ${dados.agente || 'Agente do escritório'}`,
      `Etapa: ${dados.etapa || 'Etapa não informada'}`,
      `Código: ${tarefa.code || 'não informado'}`,
      `Título: ${tarefa.title || 'não informado'}`,
      `Descrição: ${tarefa.desc || 'não informada'}`,
      `Tipo: ${tarefa.type || 'não informado'}`,
      `Prioridade: ${tarefa.priority || 'não informada'}`,
      `Prazo: ${tarefa.due || 'não informado'}`,
      `Observações: ${tarefa.notes || 'nenhuma'}`, '',
      'INSTRUÇÃO DE TRABALHO:', dados.instrucao || '', '',
      'Retorne somente o material produzido para esta etapa.'
    ].join('\n');

    for (let tentativa = 1; tentativa <= 2; tentativa++) {
      try {
        const {response, data} = await fetchJson(WORKER_URL, {
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({prompt})
        }, TIMEOUT_MS);
        if (response.ok && data?.ok && typeof data.text === 'string' && data.text.trim()) {
          return {ok:true, text:data.text.trim(), model:data.model || MODEL, tentativa};
        }
        const msg = readableError(response, data);
        if (tentativa === 2) return {ok:false, mensagem:msg, status:data?.status || response.status, details:data?.details || data};
        await new Promise(r => setTimeout(r, 1000));
      } catch (e) {
        if (tentativa === 2) return {ok:false, mensagem:e?.name === 'AbortError' ? 'Tempo esgotado ao chamar o Worker/Gemini.' : `Falha de conexão com o Worker: ${e?.message || e}`, status:502};
        await new Promise(r => setTimeout(r, 1000));
      }
    }
    return {ok:false, mensagem:'Falha desconhecida na integração Gemini.', status:502};
  }

  const ia = {
    provedores:{claude:{nome:'Claude API (Anthropic)',conectado:false},openai:{nome:'OpenAI API',conectado:false},gemini:{nome:'Gemini API (Google)',conectado:true}},
    mensagem:'Gemini 3.8 Flash via Cloudflare Worker.',
    conectada(){ return true; },
    executar:executarGemini,
    testar:health
  };

  const canais = {instagram:{nome:'Instagram',conectado:false},facebook:{nome:'Facebook',conectado:false},tiktok:{nome:'TikTok',conectado:false},metaAds:{nome:'Meta Ads',conectado:false},github:{nome:'GitHub',conectado:false},nuvem:{nome:'Armazenamento em nuvem',conectado:false}};
  window.EVIntegracoes = Object.freeze({ia,canais});
})();
