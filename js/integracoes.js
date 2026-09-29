/* =====================================================================
   INTEGRAÇÕES FUTURAS — camada separada do restante do escritório.

   Nada aqui está conectado. Nenhuma API é chamada. Nenhuma resposta
   de IA é simulada. Cada provedor tem "conectado: false" e qualquer
   pedido devolve a mensagem de "não conectado".

   Para conectar no futuro (ex.: Claude API), implemente a função
   `executar` do provedor e mude `conectado` para true. O restante do
   sistema já consulta este objeto antes de oferecer a automação.
   Atenção: chaves de API NÃO devem ficar neste arquivo público do
   GitHub Pages — use um serviço intermediário seguro quando chegar a hora.
   ===================================================================== */
(function () {
  const MSG_IA = 'Automação de IA ainda não conectada.';
  const naoConectado = nome => ({ nome, conectado: false, executar: async () => ({ ok: false, mensagem: `${nome}: integração ainda não conectada.` }) });

  const ia = {
    provedores: {
      claude: { nome: 'Claude API (Anthropic)', conectado: false },
      openai: { nome: 'OpenAI API', conectado: false },
      gemini: { nome: 'Gemini API (Google)', conectado: false },
    },
    mensagem: MSG_IA,
    conectada() { return Object.values(this.provedores).some(p => p.conectado); },
    /* pedido: { agente, etapa, tarefa, instrucao } — hoje sempre recusa, sem inventar conteúdo */
    async executar(pedido) { return { ok: false, mensagem: MSG_IA, pedido }; },
  };

  const canais = {
    instagram: naoConectado('Instagram'),
    facebook: naoConectado('Facebook'),
    tiktok: naoConectado('TikTok'),
    metaAds: naoConectado('Meta Ads'),
    github: naoConectado('GitHub'),
    nuvem: naoConectado('Armazenamento em nuvem'),
  };

  window.EVIntegracoes = Object.freeze({ ia, canais });
})();
