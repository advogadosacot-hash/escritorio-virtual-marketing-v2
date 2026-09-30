# Escritório Virtual de Marketing — Salário-Maternidade

Escritório 3D no navegador, com uma sala única onde ficam o gerente, a secretária e a equipe de marketing (pesquisa, copy, criativo, análise e social media). Você anda pela sala com as setas e conversa com os personagens.

A **Central de Tarefas** é o motor do escritório. Cada tarefa passa pelos agentes etapa por etapa, com responsáveis, progresso, histórico, arquivos e notificações.

Tudo o que aparece como feito foi registrado de verdade no sistema. Não há tarefas, arquivos, números nem respostas de IA simulados.

## Tecnologias

- HTML, CSS e JavaScript puros, sem etapa de compilação e sem servidor
- [Three.js r128](https://threejs.org/) por CDN (cdnjs) para a sala 3D
- Google Fonts por CDN
- IndexedDB do navegador para tarefas, histórico, notificações, configurações e arquivos

## Estrutura

```
escritorio-marketing/
├── index.html           estrutura da página
├── css/style.css        visual (painéis, fluxo, estante, responsivo)
├── js/integracoes.js    camada separada para futuras integrações (nada conectado)
├── js/app.js            sala 3D, personagens, Central de Tarefas, Estante, Secretária
├── .nojekyll
└── README.md
```

## Como executar localmente

Dê dois cliques em `index.html`. O Three.js e as fontes precisam de internet.

Se preferir um servidor local, rode dentro da pasta `python -m http.server 8000` e abra `http://localhost:8000`.

## Como publicar no GitHub Pages

1. Envie os arquivos para a raiz do repositório `escritorio-marketing`.
2. Abra **Settings → Pages**.
3. Escolha **Deploy from a branch**, a branch `main`, a pasta `/ (root)`, e clique em **Save**.

Todos os caminhos são relativos. O projeto é 100% estático.

## Funcionalidades

### Escritório 3D
- **Sala e personagens:**
  - Sala única, com o avatar controlado pelas setas (ou WASD) e animação de caminhada.
  - A câmera acompanha o avatar. `C` alterna para a visão geral, a roda do mouse dá zoom e no celular aparece um direcional na tela.
- **Equipe:**
  - Marcos, o gerente, tem a mesa maior.
  - Helena é a secretária. Lívia faz a pesquisa, Rafael faz copy e roteiro, Bia cuida do criativo, Otávio da análise e Carol das redes sociais.
- **Estado de cada personagem:** Disponível, Trabalhando, Aguardando, Em revisão ou Pausado. A animação de trabalho só aparece quando existe uma etapa real em andamento.
- **Interação:** chegue perto de alguém e aperte `E`, ou clique.
- **Estante física:** fica na parede da frente. As pastas acompanham a quantidade real de arquivos.

### Central de Tarefas
- **Campos de cada tarefa:**
  - Identificação: ID (T-0001…), título, descrição, tipo e prioridade (Urgente, Alta, Média ou Baixa).
  - Datas: prazo (com aviso de atrasada), criação, início, última atualização e conclusão.
  - Andamento: responsável atual, etapa atual, etapas concluídas, próximas etapas e próximos responsáveis.
  - Registro: progresso, histórico com data e hora, observações e arquivos.
- **Status:** Não iniciada, Aguardando, Em andamento, Em revisão, Concluída, Problema e Pausada.
- **Fluxo padrão com 9 etapas e um responsável padrão para cada uma:**
  - Pesquisa (Lívia), Copy (Rafael), Roteiro (Rafael), Criativo (Bia)
  - Revisão (Marcos), Finalização (Marcos)
  - Publicação (Carol), Análise (Otávio), Arquivamento (Helena)
- **Fluxo personalizado:** escolha as etapas, a ordem e os responsáveis. O tipo da tarefa sugere um fluxo.
- **Iniciar etapa e Concluir etapa:** registram data e hora, responsável, histórico, progresso e notificação.
  - Ao concluir, a próxima etapa é liberada automaticamente para o próximo responsável.
  - Nenhuma etapa é concluída sem um clique seu.
- **Painel da tarefa:** mostra o fluxo vertical com cada etapa marcada como concluída, atual, aguardando ou bloqueada.
  - Os responsáveis podem ser trocados, e a troca vai para o histórico.
  - Prioridade e prazo podem ser editados.
- **Ações:** Marcar problema (motivo e quem identificou, com aviso ao Gerente e à Secretária), Pausar tarefa, Retomar tarefa e Devolver para ajustes (com motivo e escolha da etapa de volta).
- **Filtros:** Todas, Minhas tarefas, Em andamento, Aguardando, Não iniciadas, Em revisão, Concluídas, Com problema, Pausadas e Atrasadas. Também há filtro por responsável e busca por ID ou título.
- **Backup:**
  - **Exportar dados** baixa um arquivo `.json` com tarefas, histórico, notificações, arquivos e configurações. O conteúdo dos arquivos pode entrar ou não.
  - **Importar backup** permite mesclar com os dados atuais ou substituir tudo, sempre com confirmação.

### Gerente, agentes e Secretária
- **Gerente:**
  - Mostra pendentes, em andamento, em revisão, com problema, concluídas, atrasadas e tarefas por agente.
  - Traz alertas e as listas com as ações de cada tarefa.
  - Permite mudar os responsáveis padrão das etapas.
- **Cada agente:** status, tarefa atual (título, etapa, progresso e prazo), números de pendentes e concluídas, e a fila de tarefas. Cada tarefa da fila abre com um clique.
- **Secretária Helena:** consulta os mesmos dados da Central e da Estante. Quando não encontra algo, responde "Não encontrei essa informação no sistema".
  - Exemplos: "Como estão as tarefas?", "Quantas estão concluídas?", "Qual é a tarefa do Rafael?", "Qual tarefa está parada?", "Onde está o arquivo da campanha X?", "Qual foi a última tarefa concluída?".

### Notificações
- **Quando aparecem:** tarefa atribuída, etapa iniciada ou concluída, tarefa em revisão, devolvida, com problema, concluída ou arquivada, e arquivo guardado.
- **O que dá para fazer:** ver o contador no ícone, visualizar, marcar como lida (uma por uma ou todas) e limpar, com confirmação.

### Estante / Arquivo
- **Organização:** por período (Hoje, Ontem, Esta semana, Semana passada, Este mês, Mês passado, Meses anteriores, Este ano, Ano passado e Todos) e por tipo (Vídeos, Imagens, Textos, Anúncios, Posts, Roteiros, Documentos, Relatórios e Outros).
- **Dados de cada arquivo:** nome, tipo, data, tarefa, responsável, etapa e tamanho, com os botões Abrir e Baixar.
- **Arquivos de texto (.txt):** você escreve o conteúdo usando os modelos Texto livre, Copy, Roteiro, Briefing ou Relatório. O modelo só traz os títulos das seções. Também existe o relatório da tarefa, montado a partir do histórico.

### Relatórios
- **Tarefas:** números reais de totais, não iniciadas, aguardando, em andamento, em revisão, com problema, pausadas, concluídas e atrasadas.
- **Recortes:** concluídas hoje e na semana, tarefas por agente e por etapa, tempo médio por etapa e arquivos por tipo e período.

## O que funciona sem internet

Depois que a página já está aberta, tudo roda no próprio navegador: Central, etapas, Secretária, notificações, Estante, relatórios, exportar e importar.

Para abrir a página pela primeira vez é preciso internet, porque o Three.js vem por CDN. Sem ele a sala 3D não carrega. As fontes também vêm por CDN, mas sem elas o navegador usa fontes parecidas.

## Limitações

- **Sem IA nos funcionários:**
  - Nenhum agente pesquisa, escreve ou cria sozinho. As etapas avançam quando você clica em Iniciar e Concluir.
  - Onde a IA entraria, o sistema mostra "Automação de IA ainda não conectada".
- **Dados só neste navegador:**
  - Não aparecem em outro aparelho, e limpar os dados do navegador apaga tudo.
  - Use **Exportar dados** para ter um backup.
- **Sem integrações:** Instagram, Facebook, TikTok, Meta Ads, GitHub e armazenamento em nuvem não estão conectados.
  - A publicação é feita por fora e registrada aqui.
  - Não existe botão que finja publicar.
- **Arquivos são enviados por você:** o sistema só gera arquivos de texto (.txt) e JSON. Vídeos, imagens e PDFs precisam ser enviados.

## Para desenvolvedores

- **`js/integracoes.js`:** reúne os provedores de IA (Claude, OpenAI e Gemini) e os canais de publicação, todos com `conectado: false`. Nenhuma chamada é feita.
- **`window.EscritorioVirtual`:** expõe as ações da Central (criar tarefa, iniciar e concluir etapa, devolver, pausar e guardar arquivo) para futuras automações.
- **Chaves de API:** nunca coloque chaves de API neste repositório público.
