# Análise técnica do projeto

Data da revisão: 12/07/2026

Escopo: código-fonte, dados publicados, automação de deploy, testes, build e configuração do projeto.

> Atualização de 27/07/2026: a entrega pública dos JSONs foi removida. O aplicativo lê a planilha privada diretamente após autorização Google, o workflow publica somente o frontend e o cache legado é apagado na inicialização. A limpeza dos arquivos no histórico Git ainda depende de uma reescrita coordenada e force push.
>
> Atualização de 28/07/2026: os quatro contratos agora são validados integralmente em runtime, inclusive após a leitura direta da planilha. A suíte foi ampliada para 70 testes em 14 arquivos, cobrindo contratos, sincronização e casos financeiros limítrofes.

## Resumo executivo

O projeto está organizado, usa TypeScript estrito, separa os cálculos financeiros da interface e passa nos testes e no build de produção. A exposição no GitHub Pages foi corrigida: a autenticação Firebase protege a interface e a planilha privada só é lida no navegador depois da autorização Google de somente leitura. Permanece uma pendência histórica, pois os datasets antigos continuam acessíveis em commits anteriores do repositório até uma reescrita coordenada.

## Achados prioritários

### 1. Crítico — exposição atual corrigida; histórico Git pendente

Evidências:

- `AuthGate` autoriza o usuário no navegador comparando o e-mail recebido do Firebase com um e-mail embutido no bundle.
- `App` baixa os dados de caminhos estáticos em `data/*.json`.
- Os quatro JSONs estão versionados em `public/data/` e são copiados para o artefato público do GitHub Pages.
- Em 12/07/2026, `https://edymetal.github.io/acoes_controle/data/portfolio.json` e `https://edymetal.github.io/acoes_controle/data/fixed-income.json` responderam HTTP 200 sem autenticação.

Impacto: movimentações, quantidades, custos, resultados e posições podem ser consultados diretamente sem passar pela tela de login. O Firebase API key no frontend não é, por si só, um segredo; o problema é usar arquivos estáticos públicos como armazenamento de dados privados.

Recomendação: servir os dados por um backend autenticado, como Cloud Functions/Cloud Run ou Firestore/Cloud Storage com regras que validem o usuário autorizado. Enquanto houver requisito de privacidade, não publicar os JSONs no GitHub Pages nem mantê-los no Git. Após a migração, considerar a remoção dos dados históricos do repositório e revisar caches/CDN já publicados.

Solução implementada: o modo padrão usa OAuth no navegador e consulta a API do Google Sheets diretamente, sem persistir token ou dados. O workflow não recebe credenciais da planilha, o build falha se um dos datasets financeiros for incluído e o aplicativo remove o cache legado. A recomendação de backend permanece como alternativa para cenários multiusuário ou maior controle operacional.

### 2. Alto — o patrimônio consolidado mistura bases incompatíveis

> Atualização de 27/07/2026: corrigido. O consolidado usa valor de mercado para renda variável e principal aplicado como aproximação explicitamente identificada para renda fixa. Valores e lucros no vencimento são tratados como projeções e não entram no resultado atual.

Em `Overview.tsx`, ações, FIIs e cripto usam valor de mercado atual. Renda fixa usa `netAmount`, descrito pela própria interface como “valor líquido a receber”. O resultado consolidado também soma lucros realizados/não realizados das carteiras com lucro futuro previsto da renda fixa.

Impacto: “patrimônio consolidado” e “resultado total” podem ficar superestimados ou representar datas e conceitos diferentes.

Recomendação: definir duas visões explícitas:

- patrimônio atual: valor de mercado/saldo líquido atual de todas as classes;
- projeção no vencimento: valor futuro e lucro previsto da renda fixa, separado do resultado já ocorrido.

Se a planilha não fornece saldo atual da renda fixa, usar temporariamente o valor aplicado no patrimônio atual e sinalizar a limitação.

### 3. Médio — operações no mesmo dia têm ordem artificial

> Atualização de 27/07/2026: corrigido com controle de integridade. O sincronizador preserva o horário existente na célula e a ordem da fonte quando a tabela é cronológica. Sem informação suficiente, o cálculo é marcado como ambíguo; a posição é excluída dos totais conhecidos e posição, custos, resultados e sinais deixam de ser exibidos.

`calculatePortfolio` ordena por data e, em empate, força compras antes de vendas. Como os dados não carregam horário ou uma sequência original estável, uma compra e uma venda do mesmo ticker na mesma data podem usar um custo médio diferente da ordem real.

Recomendação: incluir no JSON a ordem da linha da planilha ou um timestamp/índice de operação e usá-lo como desempate. Adicionar um teste com compra e venda no mesmo dia.

### 4. Médio — o botão de atualização não sincroniza a planilha

> Atualização: corrigido. No modo estático, o botão agora solicita acesso Google de somente leitura e busca novamente todos os intervalos da planilha na sessão atual.

Antes da correção, o botão apenas refazia o download dos JSONs já publicados, com cache busting. Ele não executava `sync:data` nem disparava o workflow. A mensagem “Dados atualizados com sucesso” podia dar a entender que uma nova leitura da planilha ocorreu.

Solução implementada: a conta Google autorizada concede o escopo `spreadsheets.readonly`, o frontend relê a planilha diretamente e só informa sucesso depois de construir todas as bases com um novo `generatedAt`.

### 5. Médio — validação de entrada é superficial

> Atualização de 28/07/2026: corrigido. Os contratos de ações, FIIs, cripto e renda fixa validam estrutura e semântica antes dos cálculos, tanto para respostas de backend quanto para a atualização direta da planilha. A validação inclui versões, timestamps UTC, datas e horários reais, domínios numéricos, unicidade, contagens de integridade e relações financeiras/cronológicas.

O carregamento valida apenas `schemaVersion` e a presença de `assets`/`investments`. Campos internos, datas, números e as demais coleções são aceitos por coerção de tipo TypeScript, que não existe em runtime.

Impacto: um JSON parcial ou corrompido pode produzir `NaN`, datas inválidas ou falhas de renderização em vez de uma mensagem controlada.

Recomendação: validar todo o payload em runtime, com schema próprio ou biblioteca dedicada, antes de calcular os modelos. Testar payload ausente, número inválido, data inválida e versão incompatível.

## Melhorias recomendadas

### Qualidade e testes

- Existem 70 testes em 14 arquivos, cobrindo os contratos em runtime, a atualização direta da planilha, cálculos financeiros, consolidação, retentativas de rede, erros de autenticação, cache legado, configurações, ordenação e internacionalização.
- Ainda faltam testes E2E da autenticação e dos principais fluxos de interface.
- Não há comando de lint, teste de acessibilidade ou teste E2E.

Prioridade sugerida: adicionar smoke tests dos fluxos autenticados e, em seguida, testes de acessibilidade e responsividade.

### PWA e cache

> Atualização: corrigido para o modelo privado. Os datasets não são mais publicados ou mantidos no cache do service worker. O cache legado `investment-data` é removido quando a nova versão inicia; o aplicativo offline conserva apenas os arquivos estáticos da interface, nunca os dados financeiros.

### Dependências e cadeia de fornecimento

- Várias dependências usam `latest` no `package.json`. O lockfile torna a instalação atual reproduzível, mas uma atualização futura do lockfile pode trazer versões principais sem intenção.
- As actions do workflow são fixadas por tags principais (`@v4`, `@v5`, `@v6`), não por SHA imutável.
- O `pnpm audit --prod` não pôde ser concluído neste ambiente por falha TLS `UNABLE_TO_VERIFY_LEAF_SIGNATURE`; portanto esta revisão não declara ausência de vulnerabilidades conhecidas.

Recomendação: usar versões/ranges explícitos, automatizar atualizações com Dependabot/Renovate, fixar actions por SHA e executar auditoria de dependências em CI.

### Exposição desnecessária no frontend

- O e-mail autorizado é exibido na tela pública de login.
- O build de produção gera source maps públicos.

Esses itens não são a causa da exposição dos dados, mas aumentam a divulgação de detalhes internos. Remover o e-mail da interface e desabilitar source maps públicos, salvo quando houver um serviço privado de observabilidade que os exija.

### Manutenibilidade

`App.tsx` repete quatro funções de fetch e vários blocos de estado/renderização para datasets semelhantes. Uma camada genérica de carregamento com validação por schema reduziria duplicação e tornaria erros, retries e mensagens consistentes.

## Pontos positivos

- TypeScript em modo estrito, incluindo verificações de símbolos e parâmetros não usados.
- Cálculos financeiros e contratos de dados isolados da interface e cobertos por testes unitários.
- Build com code splitting por página.
- Sincronizador mantém credenciais fora do bundle e usa conta de serviço somente no workflow.
- Workflow usa instalação congelada, executa testes antes do build e restringe permissões do job.
- Tratamento de falhas parciais permite que módulos independentes continuem disponíveis.
- README documenta corretamente que o GitHub Pages e os JSONs são públicos.

## Verificações executadas

- `pnpm check`: aprovado.
- Vitest: 14 arquivos e 70 testes aprovados.
- TypeScript + Vite: build de produção aprovado.
- PWA: service worker e manifesto gerados; 45 entradas em precache.
- Git: branch `main` sincronizada com `origin/main` antes desta análise.
- Auditoria de dependências: inconclusiva devido ao erro TLS descrito acima.

## Ordem de ação sugerida

1. Decidir se os dados devem ser privados. Se sim, interromper a publicação dos JSONs e migrar a entrega para um backend autenticado.
2. ~~Corrigir a definição do patrimônio e do resultado consolidados.~~ Concluído em 27/07/2026.
3. ~~Preservar a ordem real das operações e ampliar os testes financeiros/sincronizador.~~ Concluído em 27/07/2026; registros sem horário são sinalizados como ambíguos.
4. ~~Adicionar validação runtime dos JSONs e da sincronização direta.~~ Concluído em 28/07/2026.
5. Uniformizar atualização e cache dos quatro datasets.
6. Endurecer dependências, workflow, source maps e exposição do e-mail.
