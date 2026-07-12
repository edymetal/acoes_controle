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
- Área independente de Cripto em dólares, restrita a Bitcoin e Ethereum, com visão geral, carteira e movimentações.
- Área independente de Renda Fixa, com valores em reais e conversão secundária em dólares, carteira detalhada e escada de vencimentos para os 12 meses.
- Atualização automática a cada 6 horas pelo GitHub Actions.

## Arquitetura atual

```text
Google Sheets privado
        │ conta de serviço (somente leitura)
        ▼
GitHub Actions ── coleta e valida os intervalos
        │
        ├── cotação atual: planilha
        ├── faixa anual: fechamentos diários de 1 ano
        ▼
JSON sanitizado ── build React/Vite ── GitHub Pages
```

A credencial nunca é incluída no JavaScript do navegador. Localmente ela permanece em `auth/`, que está ignorada pelo Git. No GitHub, o conteúdo completo do JSON é armazenado no secret `GOOGLE_SERVICE_ACCOUNT_JSON`.

> O GitHub Pages é público. As linhas dos intervalos usados pelo site são publicadas nos JSONs finais, embora a chave e o restante da planilha continuem privados. O login Firebase restringe a interface, mas não impede o acesso direto a esses arquivos.

### Fonte de dados autenticada

O frontend também aceita `VITE_DATA_BASE_URL`, que deve apontar para um backend capaz de validar o token Firebase recebido em `Authorization: Bearer <token>`. Quando a variável está configurada, os quatro JSONs são buscados nesse endpoint em vez de `public/data/`.

Para dados realmente privados:

1. publique os quatro arquivos por um backend autenticado;
2. configure a variável de repositório `VITE_DATA_BASE_URL` com a URL desse backend;
3. remova `public/data/*.json` e seu histórico do repositório somente depois de validar a migração;
4. revise caches e artefatos antigos já publicados.

Sem `VITE_DATA_BASE_URL`, o comportamento público atual é mantido por compatibilidade e a interface informa essa condição explicitamente.

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
| Cotações atuais de Bitcoin e Ethereum | `Cripto Base` | `D2:E4` |
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
pnpm sync:data
pnpm dev
```

O sincronizador procura uma credencial nesta ordem:

1. conteúdo JSON em `GOOGLE_SERVICE_ACCOUNT_JSON`;
2. caminho informado em `GOOGLE_APPLICATION_CREDENTIALS`;
3. primeiro arquivo `.json` dentro de `auth/`.

Copie `.env.example` para `.env` apenas se quiser testar uma fonte de dados autenticada. O backend precisa permitir CORS para a origem local e validar o token Firebase; não basta hospedar os mesmos arquivos em outra URL pública.

Comandos úteis:

```bash
pnpm test       # testes do motor financeiro e dos sinais
pnpm build      # verificação TypeScript e build de produção
pnpm check      # testes + build
```

## Configuração no GitHub

1. Em **Settings → Secrets and variables → Actions**, crie o secret `GOOGLE_SERVICE_ACCOUNT_JSON` com o conteúdo completo do arquivo da conta de serviço.
2. Em **Settings → Pages → Build and deployment**, selecione **GitHub Actions**.
3. Opcionalmente, em **Settings → Secrets and variables → Actions → Variables**, defina `VITE_DATA_BASE_URL` para usar o backend autenticado.
4. Execute manualmente o workflow **Sincronizar dados e publicar no GitHub Pages** ou envie um commit para `main`.

O workflow também roda automaticamente a cada 6 horas e publica um novo artefato somente se a sincronização, os testes e o build terminarem com sucesso.

Para publicar o login, defina `VITE_FIREBASE_API_KEY` em **Settings → Secrets and variables → Actions → Secrets** com uma chave Web nova do Firebase. Restrinja essa chave no Google Cloud às APIs e origens necessárias.

## Estrutura

```text
src/
  components/       layout e componentes compartilhados
  lib/              cálculos financeiros, sinais e formatadores
  pages/            Dashboard, Carteira, Movimentações e Estratégia
scripts/
  google-sheets-client.mjs
  sync-data.mjs
public/data/
  portfolio.json    dados sanitizados consumidos pelo site
  fiis.json         dados de FIIs, mantidos separados das ações
  crypto.json       dados de Bitcoin e Ethereum, isolados dos demais tópicos
  fixed-income.json dados de renda fixa e vencimentos, isolados dos demais tópicos
.github/workflows/
  deploy-pages.yml
```

O planejamento detalhado e os critérios de aceite estão em [`PLANO_PROJETO.md`](PLANO_PROJETO.md).
