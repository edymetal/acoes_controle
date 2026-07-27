# Plano do projeto — Controle de Ações Americanas

## 1. Objetivo

Criar um site moderno, profissional, responsivo e gratuito no GitHub Pages para acompanhar uma carteira de ações americanas. A fonte será a planilha Google Sheets informada, mantida privada e acessada em modo de leitura por uma conta de serviço.

O sistema apresentará posição atual, histórico de compras e vendas, capital investido, lucro realizado, resultado em aberto e sinais baseados no preço médio, mínima e máxima dos últimos 12 meses.

> Atualização de 27/07/2026: o GitHub Pages publica somente o aplicativo. Os dados financeiros não fazem parte do artefato e só são lidos da planilha privada após autenticação Firebase e autorização Google de somente leitura. Os datasets de versões antigas ainda precisam ser removidos do histórico Git por uma operação coordenada.

## 2. Escopo funcional

### Dashboard

- Patrimônio atual da carteira em USD.
- Custo atual das posições abertas.
- Total histórico de compras.
- Lucro ou prejuízo realizado.
- Lucro ou prejuízo não realizado (em aberto).
- Resultado total e rentabilidade da carteira.
- Quantidade de ativos e posições abertas.
- Distribuição da carteira por ativo.
- Maiores altas e quedas em aberto.
- Resumo dos sinais da estratégia anual.
- Data e hora da última sincronização.

### Carteira atual

- Ticker, quantidade, preço médio, cotação atual, custo, valor de mercado e participação.
- Lucro/prejuízo em aberto em USD e percentual.
- Mínima, média e máxima de 12 meses.
- Ordenação, busca e filtros.

### Histórico de movimentações

- Consulta unificada de compras e vendas.
- Filtros por ticker, tipo e período.
- Data, quantidade, preço unitário e valor total.
- Paginação e estado vazio quando não houver registros.

### Estratégia de 12 meses

- **Abaixo da média:** sinal de compra quando a cotação estiver abaixo da média anual.
- **Intensidade de compra:** aumenta conforme o preço se aproxima da mínima anual, usando a posição normalizada entre média e mínima.
- **Próxima da máxima:** alerta quando o preço estiver até 5% abaixo da máxima anual.
- **Rompimento:** sinal destacado quando a cotação superar a máxima anual, aumentando de intensidade conforme a distância acima da máxima.
- Legenda clara de cores e aviso de que os sinais são indicadores matemáticos, não recomendação de investimento.

## 3. Origem dos dados

- Planilha: `1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0`.
- Compras: aba `Ações Hist`, intervalo `F25:J1000`.
- Vendas: aba `Ações Hist`, intervalo `AJ25:AM1000`.
- Cotações e dados anuais: aba `Ações Base`, intervalo `H12:Q1000`.
- Os cabeçalhos imediatamente anteriores aos intervalos serão usados para validar o mapeamento real das colunas.
- Linhas vazias, fórmulas sem resultado e valores inválidos serão descartados ou sinalizados no relatório de sincronização.

## 4. Arquitetura

1. A planilha permanece privada e é compartilhada somente com as contas Google autorizadas.
2. O usuário entra pelo Firebase e autoriza temporariamente o escopo `spreadsheets.readonly`.
3. O navegador lê os intervalos pela API do Google Sheets e normaliza os dados apenas em memória.
4. O token OAuth e os dados financeiros não são persistidos no site nem adicionados ao cache do PWA.
5. O script Node.js com conta de serviço continua opcional para diagnóstico local e grava somente em `private-data/`, ignorado pelo Git.
6. O workflow executa testes, auditoria, build e verificação de privacidade antes de publicar somente o aplicativo no GitHub Pages.

## 5. Modelo financeiro e regras de cálculo

As movimentações serão ordenadas cronologicamente e processadas por ticker com custo médio móvel:

- **Compra:** aumenta quantidade e custo acumulado; o preço médio passa a ser `novo custo / nova quantidade`.
- **Venda:** reduz a quantidade pelo custo médio vigente e registra lucro realizado como `quantidade vendida × (preço de venda − preço médio vigente)`.
- **Custo da posição aberta:** `quantidade atual × preço médio`.
- **Valor de mercado:** `quantidade atual × cotação atual`.
- **Resultado em aberto:** `valor de mercado − custo da posição aberta`.
- **Rentabilidade aberta:** `resultado em aberto / custo da posição aberta`.
- **Resultado total:** `lucro realizado + resultado em aberto`.

Serão exibidos separadamente o total histórico comprado e o custo das posições ainda abertas, evitando ambiguidade no termo “total investido”. Vendas acima da posição disponível, valores ausentes ou datas inválidas serão reportados como avisos de integridade.

No patrimônio consolidado, a renda variável usa valor de mercado. A renda fixa usa temporariamente o principal aplicado como aproximação identificada, pois a origem não fornece saldo atual ou marcação a mercado; valores líquidos e lucros no vencimento ficam em uma projeção separada. Operações do mesmo ativo no mesmo dia usam horário ou sequência da fonte e bloqueiam resultados dependentes do custo médio quando a ordem não puder ser determinada.

## 6. Regra dos sinais anuais

Para preço atual `P`, média `M`, mínima `L` e máxima `H`:

- Se `P < M`, intensidade de compra = `clamp((M − P) / (M − L), 0, 1)`.
- Se `P <= L`, o sinal de compra recebe intensidade máxima.
- Se `H × 0,95 <= P <= H`, o ativo recebe alerta de proximidade da máxima.
- Se `P > H`, o ativo recebe sinal de rompimento; a intensidade cresce com `(P − H) / H`, limitada visualmente para não distorcer o painel.
- Dados anuais ausentes ou incoerentes não geram sinal e aparecem como “dados insuficientes”.

## 7. Experiência e identidade visual

- Aplicação React + TypeScript, construída com Vite.
- Visual financeiro contemporâneo, com fundo escuro, superfícies em camadas, alto contraste e cores semânticas.
- Menu responsivo para Dashboard, Carteira, Movimentações e Estratégia.
- Gráficos acessíveis, tabelas responsivas, indicadores com ícones e tooltips.
- Formatação brasileira para datas e formatação em USD para valores.
- Estados completos de carregamento, erro, ausência de dados e dados desatualizados.
- Acessibilidade por teclado, foco visível, rótulos e contraste adequado.

## 8. Etapas de execução

### Etapa 1 — Auditoria e segurança

- Validar acesso da conta de serviço e estrutura real dos intervalos.
- Confirmar cabeçalhos, tipos, datas, moedas e fórmulas retornadas.
- Proteger `auth/` no `.gitignore` e verificar que a chave nunca entrou no histórico Git.

### Etapa 2 — Coletor e contrato de dados

- Implementar autenticação OAuth da conta de serviço.
- Ler os três intervalos via Google Sheets API v4.
- Normalizar datas e números do locale da planilha.
- Gerar contrato JSON versionado, métricas de integridade e timestamp.
- Criar dados de demonstração seguros para desenvolvimento sem credencial.

### Etapa 3 — Motor de carteira

- Consolidar compras e vendas cronologicamente.
- Calcular posição, custo médio, lucro realizado e resultado em aberto.
- Implementar sinais da faixa anual.
- Cobrir regras e casos extremos com testes automatizados.

### Etapa 4 — Interface

- Construir layout, navegação e componentes reutilizáveis.
- Implementar Dashboard e gráficos.
- Implementar Carteira, Histórico e Estratégia.
- Adicionar busca, filtros, ordenação e responsividade.

### Etapa 5 — Qualidade

- Testes unitários dos cálculos e do parser.
- Verificação de build, lint e tipos.
- Teste visual em desktop e celular.
- Auditoria de acessibilidade, conteúdo, desempenho e ausência de segredos.

### Etapa 6 — Publicação e operação

- Criar workflow do GitHub Actions para sincronização e deploy.
- Documentar configuração do secret e ativação do GitHub Pages.
- Publicar na branch configurada e validar a URL final.
- Documentar atualização manual e diagnóstico de falhas.

## 9. Critérios de aceite

- Nenhuma credencial presente no código, build, logs ou histórico Git.
- Dados reais dos três intervalos carregados e mapeados corretamente.
- Totais financeiros conciliados com as movimentações.
- Posição atual e sinais anuais exibidos para todos os tickers válidos.
- Filtros, tabelas e navegação funcionais em desktop e celular.
- Build reproduzível e testes aprovados.
- GitHub Actions apto a sincronizar e publicar no GitHub Pages gratuitamente.
- README com configuração, segurança, regras de cálculo e operação.

## 10. Entregáveis

- Código-fonte completo do site.
- Script seguro de sincronização da planilha.
- Arquivo JSON sanitizado usado pela interface.
- Testes automatizados.
- Workflows de atualização e publicação.
- Documentação técnica e operacional.
