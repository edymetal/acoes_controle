# Análise técnica do projeto

Data da revisão: 12/07/2026

Escopo: código-fonte, dados publicados, automação de deploy, testes, build e configuração do projeto.

> Atualização: as correções locais recomendadas neste documento foram implementadas em 12/07/2026. A migração dos JSONs públicos depende da disponibilização de um backend autenticado; o frontend já aceita `VITE_DATA_BASE_URL` e envia o token Firebase para essa fonte.

## Resumo executivo

O projeto está organizado, usa TypeScript estrito, separa os cálculos financeiros da interface e passa nos testes e no build de produção. A principal fragilidade é de arquitetura: a autenticação Firebase protege apenas a renderização da interface, enquanto os dados financeiros continuam públicos no GitHub Pages e no próprio histórico do repositório.

Também há uma inconsistência conceitual no patrimônio consolidado, que soma valores atuais de renda variável a valores futuros de renda fixa e combina resultados realizados, não realizados e projetados como se fossem equivalentes.

## Achados prioritários

### 1. Crítico — os dados financeiros não são protegidos pela autenticação

Evidências:

- `AuthGate` autoriza o usuário no navegador comparando o e-mail recebido do Firebase com um e-mail embutido no bundle.
- `App` baixa os dados de caminhos estáticos em `data/*.json`.
- Os quatro JSONs estão versionados em `public/data/` e são copiados para o artefato público do GitHub Pages.
- Em 12/07/2026, `https://edymetal.github.io/acoes_controle/data/portfolio.json` e `https://edymetal.github.io/acoes_controle/data/fixed-income.json` responderam HTTP 200 sem autenticação.

Impacto: movimentações, quantidades, custos, resultados e posições podem ser consultados diretamente sem passar pela tela de login. O Firebase API key no frontend não é, por si só, um segredo; o problema é usar arquivos estáticos públicos como armazenamento de dados privados.

Recomendação: servir os dados por um backend autenticado, como Cloud Functions/Cloud Run ou Firestore/Cloud Storage com regras que validem o usuário autorizado. Enquanto houver requisito de privacidade, não publicar os JSONs no GitHub Pages nem mantê-los no Git. Após a migração, considerar a remoção dos dados históricos do repositório e revisar caches/CDN já publicados.

### 2. Alto — o patrimônio consolidado mistura bases incompatíveis

Em `Overview.tsx`, ações, FIIs e cripto usam valor de mercado atual. Renda fixa usa `netAmount`, descrito pela própria interface como “valor líquido a receber”. O resultado consolidado também soma lucros realizados/não realizados das carteiras com lucro futuro previsto da renda fixa.

Impacto: “patrimônio consolidado” e “resultado total” podem ficar superestimados ou representar datas e conceitos diferentes.

Recomendação: definir duas visões explícitas:

- patrimônio atual: valor de mercado/saldo líquido atual de todas as classes;
- projeção no vencimento: valor futuro e lucro previsto da renda fixa, separado do resultado já ocorrido.

Se a planilha não fornece saldo atual da renda fixa, usar temporariamente o valor aplicado no patrimônio atual e sinalizar a limitação.

### 3. Médio — operações no mesmo dia têm ordem artificial

`calculatePortfolio` ordena por data e, em empate, força compras antes de vendas. Como os dados não carregam horário ou uma sequência original estável, uma compra e uma venda do mesmo ticker na mesma data podem usar um custo médio diferente da ordem real.

Recomendação: incluir no JSON a ordem da linha da planilha ou um timestamp/índice de operação e usá-lo como desempate. Adicionar um teste com compra e venda no mesmo dia.

### 4. Médio — o botão de atualização não sincroniza a planilha

O botão apenas refaz o download dos JSONs já publicados, com cache busting. Ele não executa `sync:data` nem dispara o workflow. A mensagem “Dados atualizados com sucesso” pode dar a entender que uma nova leitura da planilha ocorreu.

Recomendação: renomear a ação para “Recarregar dados publicados” e mostrar `generatedAt`, ou implementar uma sincronização autenticada no backend e aguardar a nova versão.

### 5. Médio — validação de entrada é superficial

O carregamento valida apenas `schemaVersion` e a presença de `assets`/`investments`. Campos internos, datas, números e as demais coleções são aceitos por coerção de tipo TypeScript, que não existe em runtime.

Impacto: um JSON parcial ou corrompido pode produzir `NaN`, datas inválidas ou falhas de renderização em vez de uma mensagem controlada.

Recomendação: validar todo o payload em runtime, com schema próprio ou biblioteca dedicada, antes de calcular os modelos. Testar payload ausente, número inválido, data inválida e versão incompatível.

## Melhorias recomendadas

### Qualidade e testes

- Existem 12 testes em 5 arquivos, todos concentrados nas bibliotecas de cálculo e configurações.
- Faltam testes dos mapeadores de `sync-data.mjs`, do carregamento/erro/atualização de dados, da autenticação e dos principais fluxos de interface.
- Não há comando de lint, teste de acessibilidade ou teste E2E.

Prioridade sugerida: testar primeiro o sincronizador e os casos financeiros limítrofes (venda sem posição, venda acima da posição, operações no mesmo dia, números decimais e datas inválidas); depois adicionar smoke tests da interface.

### PWA e cache

Somente `portfolio.json` possui regra de cache em runtime. `fiis.json`, `crypto.json` e `fixed-income.json` não entram no precache nem recebem estratégia equivalente. Em uso offline ou rede instável, os módulos podem apresentar comportamentos diferentes.

Recomendação: aplicar a mesma política `NetworkFirst` aos quatro datasets, decidir explicitamente se o aplicativo deve funcionar offline e testar atualização do service worker com dados antigos.

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
- Cálculos financeiros isolados da interface e cobertos por testes unitários básicos.
- Build com code splitting por página.
- Sincronizador mantém credenciais fora do bundle e usa conta de serviço somente no workflow.
- Workflow usa instalação congelada, executa testes antes do build e restringe permissões do job.
- Tratamento de falhas parciais permite que módulos independentes continuem disponíveis.
- README documenta corretamente que o GitHub Pages e os JSONs são públicos.

## Verificações executadas

- `pnpm check`: aprovado.
- Vitest: 5 arquivos e 12 testes aprovados.
- TypeScript + Vite: build de produção aprovado.
- PWA: service worker e manifesto gerados; 41 entradas em precache.
- Git: branch `main` sincronizada com `origin/main` antes desta análise.
- Auditoria de dependências: inconclusiva devido ao erro TLS descrito acima.

## Ordem de ação sugerida

1. Decidir se os dados devem ser privados. Se sim, interromper a publicação dos JSONs e migrar a entrega para um backend autenticado.
2. Corrigir a definição do patrimônio e do resultado consolidados.
3. Preservar a ordem real das operações e ampliar os testes financeiros/sincronizador.
4. Adicionar validação runtime dos JSONs.
5. Uniformizar atualização e cache dos quatro datasets.
6. Endurecer dependências, workflow, source maps e exposição do e-mail.
