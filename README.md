# Controle de Investimentos

Dashboard moderno para acompanhar, em áreas separadas, carteiras de ações americanas, fundos imobiliários (FIIs) e criptomoedas a partir de uma planilha Google Sheets privada. O site é estático, responsivo e publicado gratuitamente no GitHub Pages.

O site pode ser instalado como aplicativo pelo Chrome no celular. Após abrir a página publicada, use **Adicionar à tela inicial** ou **Instalar app** no menu do navegador.

## Site

Quando o GitHub Pages estiver ativo, o endereço será:

**https://edymetal.github.io/acoes_controle/**

## Funcionalidades

- Dashboard com patrimônio, custo atual, compras acumuladas, lucro realizado, resultado em aberto e resultado total.
- Carteira atual com quantidade, preço médio, cotação, custo, valor de mercado, participação e rentabilidade.
- Histórico pesquisável e paginado, com lucro por venda, agrupamento por ação e resumo detalhado ao clicar no ticker.
- Estratégia anual com intensidade de compra abaixo da média, proximidade da máxima e rompimentos.
- Gráficos de distribuição da carteira e impacto por posição.
- Interface responsiva para desktop, tablet e celular.
- Área independente de FIIs com visão geral, carteira em reais e histórico de compras e vendas.
- Área independente de Cripto em dólares para Bitcoin, Ethereum e BNB, com visão geral, carteira e movimentações.
- Área independente de Renda Fixa, com valores em reais e conversão secundária em dólares, carteira detalhada e escada de vencimentos para os 12 meses.
- Carregamento privado direto da planilha após autorização Google de somente leitura.
- Sincronização imediata pelo botão de atualizar, sem publicar uma cópia dos dados no GitHub Pages.
- Indicadores explícitos de avaliação parcial quando uma posição está sem cotação, sem converter o custo da posição em prejuízo fictício.
- Suspensão automática dos sinais quando as estatísticas anuais precisaram ser reaproveitadas de uma atualização anterior.

## Arquitetura atual

```text
GitHub Actions ── testes, auditoria e build do aplicativo
        │
        ▼
GitHub Pages ── HTML, CSS, JavaScript e imagens

Conta Google autorizada
        │ Google Identity Services · OAuth 2.0 · spreadsheets.readonly
        ▼
Credencial Firebase no navegador ── Google Sheets API ── dados mantidos em memória
                  │
                  └── token temporário no sessionStorage da aba
```

O artefato do GitHub Pages não contém movimentações, posições ou valores financeiros. Ao autorizar a planilha, o navegador usa o modelo de token do Google Identity Services para solicitar o escopo `spreadsheets.readonly`, transforma o token em uma credencial Firebase e lê somente os intervalos documentados. O fluxo não usa o polling de janela do `signInWithPopup`. O token de acesso temporário é mantido no `sessionStorage` da aba até expirar, permitindo atualizar a página sem repetir a autorização. Tokens expirados, inválidos ou rejeitados são removidos automaticamente; os dados financeiros continuam somente em memória e fora do cache do PWA.

Como o GitHub Pages não oferece configuração de cabeçalhos HTTP, o service worker do PWA acrescenta `Cross-Origin-Opener-Policy: same-origin-allow-popups` às respostas de navegação que controla. Na primeira visita, o aplicativo recarrega uma única vez quando o worker assume o controle; isso mantém a comunicação exigida pelo popup OAuth e elimina os avisos de acesso bloqueado a `window.closed`.

A conta de serviço continua disponível apenas para diagnóstico local pelo comando `pnpm sync:data`. A credencial permanece em `auth/`, e os arquivos resultantes são gravados em `private-data/`; ambas as pastas são ignoradas pelo Git.

### Fonte de dados autenticada

Por padrão, o frontend lê a planilha privada diretamente. Opcionalmente, `VITE_DATA_BASE_URL` pode apontar para um backend que valide o token Firebase recebido em `Authorization: Bearer <token>` e devolva os quatro contratos JSON.

Os JSONs foram removidos da branch atual e do artefato publicado. O aplicativo também apaga o antigo cache `investment-data` ao iniciar. As versões anteriores ainda existem no histórico Git até que seja feita uma reescrita coordenada do repositório; essa operação exige force push e deve ser aprovada separadamente.

## Intervalos lidos

| Finalidade | Aba | Intervalo |
|---|---|---|
| Compras | `Ações Hist` | `F25:J1000` |
| Vendas | `Ações Hist` | `AJ25:AM1000` |
| Ativos, cotações e preços dos últimos 365 dias | `Ações Base` | `H12:Q1000` |
| Compras de FIIs | `FII Hist` | `F24:I1000` |
| Vendas de FIIs | `FII Hist` | `AJ85:AN1000` |
| Fundos e cotações atuais | `FII BASE` | `A16:G1000` |
| Cotação do dólar para conversão dos FIIs | `Dólar` | `G5` |
| Compras e vendas de cripto | `Cripto` | `A1:L1000` |
| Cotações atuais de Bitcoin, Ethereum e BNB | `Cripto Base` | `D2:E13` |
| Ativos de renda fixa, vencimentos e resultados | `Fixa Hist` | `B36:Q1000` |
| Cotação do dólar para conversão da renda fixa | `Dólar` | `G5` |

Planilha: `1cdPXA3O0DoSfOILOpc7GZjWHI7tHnhgRH9aMXdU-_F0`

Conta de serviço com acesso leitor: `sheetfiis@meuprojetofiis.iam.gserviceaccount.com`

## Cálculos

O motor consolida as movimentações cronologicamente usando custo médio móvel:

- compra: adiciona quantidade e custo;
- venda: baixa a quantidade pelo preço médio vigente;
- lucro realizado: valor da venda menos o custo baixado;
- lucro por venda: receita daquela operação menos o custo médio baixado na data da venda;
- resultado em aberto: valor de mercado menos o custo das posições atuais;
- resultado total: lucro realizado mais resultado em aberto.

O painel mostra separadamente o total histórico comprado e o custo ainda aberto para evitar ambiguidade em “total investido”.

No consolidado, ações, FIIs e cripto entram pelo valor de mercado atual. Como a planilha ainda não fornece saldo atualizado ou marcação a mercado para a renda fixa, essa classe entra apenas pelo principal aplicado, identificado como uma aproximação do valor atual. Valor bruto, valor líquido, lucro e retorno da renda fixa permanecem separados e rotulados como projeções no vencimento. A projeção não é somada ao resultado consolidado.

Quando há compra e venda do mesmo ativo no mesmo dia, a data é suficiente para o cálculo. O motor usa o horário preservado ou a ordem da fonte quando essas informações existem; na ausência delas, aplica de forma estável as compras antes das vendas. A falta de horário não bloqueia posição, custo, valor de mercado, lucros, rentabilidades ou sinais.

### Saúde e contingência dos dados

- Uma posição aberta sem cotação continua na carteira, mas seu preço, valor de mercado e resultado aparecem como indisponíveis.
- Os totais de patrimônio passam a ser identificados como valores conhecidos e parciais até que todas as posições tenham cotação.
- Resultado em aberto, resultado total e rentabilidade não são apresentados como definitivos enquanto a avaliação estiver parcial.
- Compras e vendas do mesmo ativo na mesma data continuam nos cálculos mesmo sem horário; o desempate padrão processa as compras antes das vendas.
- Quando a faixa anual atual é inválida, a sincronização preserva a data do último histórico válido, marca o dado como contingência e suspende o respectivo sinal.
- Leituras da API do Google Sheets usam limite de tempo e até três tentativas para erros transitórios (`408`, `429` e `5xx`), com espera exponencial e aleatória entre as tentativas.
- Antes dos cálculos, os quatro contratos são validados em runtime tanto no carregamento via backend quanto na leitura direta da planilha. A validação rejeita datas e horários impossíveis, números fora do domínio, IDs/tickers duplicados, contagens divergentes e relações financeiras essenciais incoerentes.
- Na renda fixa, uma inconsistência isolada entre os campos complementares bruto/IR e o valor líquido não bloqueia toda a carteira: esses campos são ignorados no registro afetado, o valor líquido conciliado com principal e lucro é preservado e um aviso de integridade é exibido.

## Estratégia anual

Para cotação `P`, média `M`, mínima `L` e máxima `H`:

- abaixo da média: intensidade `clamp((M - P) / (M - L), 0, 1)`;
- até 5% abaixo da máxima: alerta de proximidade;
- acima da máxima: sinal de rompimento com intensidade crescente;
- histórico ausente ou inválido: “dados insuficientes”.

Os sinais são indicadores matemáticos e não constituem recomendação de investimento.

## Desenvolvimento local

Requisitos: Node.js 24 e pnpm 11.

```bash
pnpm install
cp .env.example .env
pnpm dev
```

Preencha `VITE_FIREBASE_API_KEY` no `.env` antes de iniciar o site. A chave deve pertencer ao aplicativo Web do Firebase usado pelo projeto e aceitar a origem local. `VITE_GOOGLE_OAUTH_CLIENT_ID` é opcional e permite substituir o cliente OAuth público padrão; a origem exata do servidor local precisa estar autorizada nesse cliente. Deixe `VITE_DATA_BASE_URL` vazia para usar a leitura privada direta da planilha.

O comando opcional `pnpm sync:data` gera uma cópia local em `private-data/` para diagnóstico. O sincronizador procura uma credencial nesta ordem:

1. conteúdo JSON em `GOOGLE_SERVICE_ACCOUNT_JSON`;
2. caminho informado em `GOOGLE_APPLICATION_CREDENTIALS`;
3. primeiro arquivo `.json` dentro de `auth/`.

Para testar um backend autenticado, preencha também `VITE_DATA_BASE_URL`. O backend precisa permitir CORS para a origem local e validar o token Firebase; não basta hospedar os mesmos arquivos em outra URL pública.

Comandos úteis:

```bash
pnpm test       # testes dos contratos, sincronização e motor financeiro
pnpm build      # verificação TypeScript e build de produção
pnpm check      # testes + build + verificações de privacidade e COOP
```

## Configuração no GitHub

1. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
2. Em **Settings → Secrets and variables → Actions → Secrets**, mantenha `VITE_FIREBASE_API_KEY`.
3. Opcionalmente, defina `VITE_DATA_BASE_URL` em **Variables** para usar um backend autenticado.
4. Se trocar o cliente OAuth, defina `VITE_GOOGLE_OAUTH_CLIENT_ID` em **Variables** e autorize a origem do GitHub Pages no Google Cloud.
5. Execute manualmente o workflow **Validar e publicar no GitHub Pages** ou envie um commit para `main`.

O workflow publica apenas o aplicativo depois que testes, auditoria de dependências e build terminam com sucesso. Ele não recebe credenciais da planilha e não gera datasets financeiros.

Para publicar o login, defina `VITE_FIREBASE_API_KEY` em **Settings → Secrets and variables → Actions → Secrets** com uma chave Web nova do Firebase. Restrinja essa chave no Google Cloud às APIs e origens necessárias.

## Estrutura

```text
src/
  components/       layout e componentes compartilhados
  lib/              cálculos financeiros, sinais e formatadores
  pages/            Dashboard, Carteira, Movimentações e Estratégia
scripts/
  google-sheets-client.mjs
  sync-data.mjs     diagnóstico local; grava somente em private-data/
private-data/       saída local ignorada pelo Git
.github/workflows/
  deploy-pages.yml
```

O planejamento detalhado e os critérios de aceite estão em [`PLANO_PROJETO.md`](PLANO_PROJETO.md).
