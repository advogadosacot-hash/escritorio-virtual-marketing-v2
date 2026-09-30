/* =====================================================================
   INTEGRAÇÃO REAL COM A IA DO ESCRITÓRIO

   O GitHub Pages nunca recebe a chave da Gemini.
   Ele chama o Cloudflare Worker, e o Worker chama a Gemini com a chave
   armazenada como segredo no Cloudflare.
   ===================================================================== */
(function () {
  const WORKER_URL = 'https://restless-salad-4587escritorio-ia.advogados-acot.workers.dev';
  const MSG_IA = 'IA conectada ao Cloudflare Worker.';
  const TIMEOUT_MS = 60000;

  async function executarGemini(pedido) {
    const dados = pedido || {};
    const agente = dados.agente || 'Agente do escritório';
    const etapa = dados.etapa || 'Etapa não informada';
    const tarefa = dados.tarefa || {};
    const instrucao = dados.instrucao || '';

    const prompt = [
      'Você é um agente de trabalho do Escritório Virtual de Marketing — Salário-Maternidade.',
      'Execute a tarefa solicitada de forma objetiva, profissional e útil.',
      'Não invente fatos, dados, arquivos, pesquisas, resultados ou ações que não foram fornecidos.',
      'Se faltar informação essencial, informe claramente o que está faltando em vez de inventar.',
      '',
      `Agente responsável: ${agente}`,
      `Etapa: ${etapa}`,
      `Código da tarefa: ${tarefa.code || 'não informado'}`,
      `Título: ${tarefa.title || 'não informado'}`,
      `Descrição: ${tarefa.desc || 'não informada'}`,
      `Tipo: ${tarefa.type || 'não informado'}`,
      `Prioridade: ${tarefa.priority || 'não informada'}`,
      `Prazo: ${tarefa.due || 'não informado'}`,
      `Observações: ${tarefa.notes || 'nenhuma'}`,
      '',
      'INSTRUÇÃO DE TRABALHO:',
      instrucao,
      '',
      'Retorne somente o resultado produzido para esta etapa, sem fingir que executou ações externas que não foram realmente executadas.'
    ].join('\n');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const response = await fetch(WORKER_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });

      let data;
      try {
        data = await response.json();
      } catch {
        return {
          ok: false,
          mensagem: 'O Worker respondeu em um formato inválido.',
          status: response.status
        };
      }

      if (!response.ok || !data.ok) {
        return {
          ok: false,
          mensagem: data.error || 'A IA não conseguiu executar a tarefa.',
          status: data.status || response.status,
          details: data.details || null
        };
      }

      return {
        ok: true,
        text: typeof data.text === 'string' ? data.text.trim() : '',
        model: data.model || 'gemini-3.8-flash',
        agente,
        etapa,
        executadoEm: new Date().toISOString()
      };
    } catch (error) {
      if (error && error.name === 'AbortError') {
        return {
          ok: false,
          mensagem: 'A IA demorou mais de 60 segundos para responder. A tarefa não foi marcada como concluída.',
          status: 408
        };
      }

      return {
        ok: false,
        mensagem: 'Não foi possível conectar ao Worker de IA.',
        status: 502,
        details: String(error)
      };
    } finally {
      clearTimeout(timer);
    }
  }

  const ia = {
    provedores: {
      claude: { nome: 'Claude API (Anthropic)', conectado: false },
      openai: { nome: 'OpenAI API', conectado: false },
      gemini: { nome: 'Gemini API (Google)', conectado: true }
    },
    mensagem: MSG_IA,
    conectada() {
      return this.provedores.gemini.conectado === true;
    },
    executar(pedido) {
      return executarGemini(pedido);
    }
  };

  const canais = {
    instagram: { nome: 'Instagram', conectado: false },
    facebook: { nome: 'Facebook', conectado: false },
    tiktok: { nome: 'TikTok', conectado: false },
    metaAds: { nome: 'Meta Ads', conectado: false },
    github: { nome: 'GitHub', conectado: false },
    nuvem: { nome: 'Armazenamento em nuvem', conectado: false }
  };

  window.EVIntegracoes = Object.freeze({ ia, canais });
})();
