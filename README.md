# Moove

Rastreamento em tempo real de vans, ônibus e peruas escolares. Motoristas
compartilham a localização do veículo durante a rota via GPS do navegador;
pais e responsáveis, depois de vinculados por convite, acompanham a
localização num mapa embutido na própria tela.

Esta fase do projeto cobre apenas o sistema **web** (responsivo, mobile-first
para o motorista). App nativo fica para uma fase futura.

## Stack

- **Next.js 15** (App Router, TypeScript) — front-end e API (Route Handlers) no mesmo projeto.
- **PostgreSQL + Prisma** — banco de dados e ORM/migrations.
- **Leaflet + OpenStreetMap** (`react-leaflet`) — mapa, sem custo de API key.
- **Storage compatível com S3** (`@aws-sdk/client-s3`) — documentos do veículo (AWS S3, Cloudflare R2, etc.).
- **Sessão via cookie httpOnly + JWT** (`jose`) — autenticação própria, separada para Motorista e Responsável.
- **Tailwind CSS v4** — estilos.
- **Zod** — validação de entrada.

> Next.js foi fixado em `15.5.x` (não a última major, 16) e Prisma em `6.19.x`
> deliberadamente: ambos tiveram mudanças estruturais recentes nas versões
> mais novas, e a prioridade aqui foi ter a base de autenticação e das regras
> de vínculo/segurança construída sobre versões bem conhecidas e estáveis.
> Vale revisitar a atualização depois que o produto estiver rodando.

## Modelo de dados

Ver `prisma/schema.prisma`. Os campos usam `camelCase` no código/Prisma e são
mapeados via `@map`/`@@map` para `snake_case` no banco, preservando os nomes
de coluna do modelo de dados especificado (`motorista_id`, `senha_hash`,
etc.) enquanto mantém a convenção idiomática do ecossistema TypeScript.

Entidades: `Motorista`, `Veiculo`, `Responsavel`, `Convite`, `Vinculo`,
`Localizacao`, `Assinatura`, `Pagamento`. `Plano`, `Cobranca` e
`CobrancaVinculo` são do modelo de cobrança antigo (por aluno excedente,
sem gateway) e ficam apenas para histórico — foram substituídos pelas
assinaturas pré-pagas, ver [Assinaturas e pagamento](#assinaturas-e-pagamento-mercado-pago).

## Rodando localmente

### 1. Pré-requisitos

- Node.js 20.9+
- PostgreSQL 14+ (local ou via Docker)

### 2. Banco de dados

Suba um Postgres local com Docker:

```bash
docker compose up -d
```

Ou aponte `DATABASE_URL` para um Postgres já existente.

### 3. Variáveis de ambiente

```bash
cp .env.example .env
```

Preencha pelo menos `DATABASE_URL`, `AUTH_SECRET_MOTORISTA` e
`AUTH_SECRET_RESPONSAVEL` (gere valores fortes, ex: `openssl rand -base64 48`
para cada). O storage (`STORAGE_*`) só é necessário para testar upload de
documentos — sem ele, o cadastro de veículo funciona normalmente e o upload
retorna um aviso. O envio de e-mail (`RESEND_API_KEY`) também é opcional em
dev — sem ele, o código de verificação aparece no log do servidor em vez de
ser enviado de verdade (ver seção "Verificação por e-mail" abaixo).

### 4. Instalar dependências e migrar o banco

```bash
npm install
npm run prisma:migrate   # aplica as migrations em prisma/migrations
```

### 5. Rodar

```bash
npm run dev
```

Acesse `http://localhost:3000`.

## Autenticação

Motorista e Responsável são entidades completamente separadas (tabelas,
sessões e segredos JWT distintos — `AUTH_SECRET_MOTORISTA` /
`AUTH_SECRET_RESPONSAVEL`). A sessão é um JWT assinado (HS256, `jose`)
guardado em cookie **httpOnly**, então não é acessível via JavaScript no
navegador. Cada Server Component de página autenticada (`src/app/motorista/**`,
`src/app/responsavel/**`) valida a sessão diretamente contra o banco
(`src/lib/auth/guards.ts`) antes de renderizar — não há middleware
interceptando rotas: a checagem de autorização vive no mesmo lugar em toda a
aplicação (páginas e API), para reduzir a chance de uma rota esquecer de
validar.

## Verificação por e-mail (cadastro e login)

Tanto o cadastro quanto o login — de Motorista e de Responsável — exigem um
código de 6 dígitos enviado por e-mail, além da senha:

- **Cadastro**: `POST /api/auth/{role}/register` valida os dados e **envia o
  código, mas não cria a conta ainda** — os dados ficam guardados (com a
  senha já hasheada) junto do próprio registro do código em
  `CodigoVerificacao.payload`, já que a conta não existe até o código ser
  confirmado. Só `POST /api/auth/{role}/register/verificar` (com o e-mail e
  o código) efetivamente cria a conta e a sessão. Isso evita contas "fantasma"
  de e-mails digitados errado ou nunca confirmados.
- **Login**: `POST /api/auth/{role}/login` valida e-mail+senha como antes,
  mas em vez de criar sessão já envia um código novo por e-mail. A sessão só
  é criada em `POST /api/auth/{role}/login/verificar`. Ou seja, é um segundo
  fator obrigatório em todo login, não só uma confirmação única no cadastro.
- **Reenvio**: `POST /api/auth/{role}/reenviar-codigo` (com `{ email,
  proposito }`) gera e envia um novo código, reaproveitando os dados
  pendentes do cadastro quando `proposito = "CADASTRO"`.

Detalhes de segurança (`src/lib/email/verification.ts`): código de 6 dígitos
gerado com `crypto.randomInt`, guardado como hash SHA-256 (nunca em texto
puro), expira em 10 minutos, no máximo 5 tentativas erradas antes de exigir
um novo código, e um intervalo mínimo de 45s entre envios para o mesmo
e-mail/propósito — tanto para proteger a cota gratuita do provedor de
e-mail quanto para dificultar abuso.

**Envio de e-mail** (`src/lib/email/mailer.ts`): usa a API do
[Resend](https://resend.com) (plano gratuito: 100 e-mails/dia, 3000/mês) via
`RESEND_API_KEY`. Sem essa variável configurada, cai automaticamente para um
`ConsoleMailer` que só imprime o código no log do servidor — assim dá para
testar o fluxo inteiro localmente sem precisar de conta em nenhum provedor.

## Segurança da busca por placa (regra de negócio mais crítica)

`GET /api/responsavel/buscar-placa?placa=...` é o único caminho para obter a
localização de um motorista. A cada chamada — sem cache de autorização — o
endpoint:

1. Exige responsável autenticado (401 se não).
2. Resolve a placa para o motorista dono do veículo (404 se a placa não existir).
3. Consulta se existe um `Vinculo` com `status = ATIVO` entre esse
   responsável e esse motorista (403 se não existir).
4. Só então retorna a localização.

O front-end do responsável faz *polling* nesse mesmo endpoint a cada 10s
enquanto o mapa está aberto (`src/components/responsavel/BuscarPlacaClient.tsx`),
o que significa que uma revogação de vínculo pelo motorista bloqueia o acesso
em, no máximo, um ciclo de polling — não é preciso invalidar nenhum cache.

Testado manualmente ponta a ponta (registro → convite → vínculo → busca
permitida → revogação → busca voltando a ser negada → isolamento entre
responsáveis) durante o desenvolvimento.

## Convites e vínculos

- Código de 8 caracteres (alfabeto sem `0/O/1/I` para evitar ambiguidade),
  único, válido por 7 dias (`CONVITE_VALIDADE_DIAS` em `src/lib/convite.ts`).
- Uso único: ao ser resgatado, o `Convite` muda de `PENDENTE` para `USADO`
  dentro de uma transação (com revalidação do status na própria transação,
  para não haver corrida entre duas tentativas simultâneas de resgatar o
  mesmo código).
- Convites pendentes vencidos são marcados `EXPIRADO` de forma preguiçosa
  (toda leitura da lista de convites ou tentativa de resgate sincroniza isso
  primeiro) — não depende de um cron dedicado.
- Um responsável não pode ter dois vínculos ativos simultâneos com o mesmo
  motorista (um convite representa uma família).

## Localização em tempo real

- **Motorista**: `src/hooks/useLocationSharing.ts` usa
  `navigator.geolocation.watchPosition`, envia a posição para
  `POST /api/motorista/localizacao` no máximo a cada 12s, e precisa ser
  ativado manualmente a cada nova sessão (o estado não é persistido entre
  recarregamentos — é assim que a regra "GPS obrigatório a cada sessão" é
  cumprida).
- **Responsável**: o mapa (`src/components/map/VehicleMap.tsx`, Leaflet
  carregado só no cliente via `next/dynamic({ ssr: false })`) faz polling da
  localização a cada 10s. Se a última atualização for mais antiga que 45s
  (`LOCATION_STALE_SECONDS` em `src/lib/location.ts`), a localização é
  marcada como desatualizada na resposta da API e a UI mostra um aviso em vez
  de fingir que o dado é atual.

### Limitação conhecida: abas em segundo plano

Em navegadores mobile — principalmente iOS/Safari — o sistema operacional
suspende ou reduz a atividade de uma aba minimizada após um tempo, o que pode
interromper o envio de localização. Isso é uma limitação da plataforma web,
não do código. O motorista é avisado na tela de compartilhamento para manter
a aba aberta e a tela ligada durante a rota. Transformar o app em PWA com
Service Worker pode estender minimamente essa janela numa fase futura, mas
não elimina a limitação — não foi implementado nesta fase.

## Rota do dia (motorista)

Tela principal do motorista (`/motorista/dashboard`, item "Rota" na navegação —
`src/components/motorista/RotaPanel.tsx` + `src/components/map/RotaMap*.tsx`).
Cobre tanto a ida (casa → escola) quanto a volta (escola → casa), com o mapa
sempre mostrando só o necessário no momento: o balão azul do motorista e,
quando um destino está em foco, a rota até ele — nada de traçado
pré-calculado com todas as paradas de uma vez.

- **Lista de alunos + "Ir"**: cada aluno vinculado aparece numa lista sempre
  visível, com um botão "Ir" que foca o mapa nesse aluno específico (estilo
  Uber/99 — um destino de cada vez) e os botões "Embarcou"/"Ausente" pra
  registrar o status do dia. Os quatro botões de ação (Ir/Cancelar, Embarcou,
  Ausente, Desfazer) têm sempre a mesma largura e ficam na mesma linha.
- **Marcadores do mapa**: alunos aparecem como balões laranjas com as
  **iniciais do nome** (ex.: "Levi Brune" → "LB"), não números — fica visível
  de longe quem é quem sem precisar abrir o popup. Fica **verde** com "✓"
  quando o aluno já embarcou/foi entregue, e **vermelho** com "✕" quando foi
  marcado ausente (`src/components/map/RotaMapInner.tsx`).
- **Retorno (volta pra casa)**: botão "Iniciar retorno" no topo do painel
  alterna o `sentido` da rota entre `IDA` e `VOLTA`
  (`EmbarqueDia.sentido`, migração `20260817220000_embarque_sentido_ida_volta`)
  — cada sentido tem seu próprio registro de embarque por dia
  (`@@unique([vinculoId, data, sentido])`), então marcar um aluno na volta
  não mexe no que já foi registrado na ida.
  - **Fase 1 — buscar na escola**: ao iniciar o retorno, o destino de cada
    aluno é a escola em que está matriculado.
  - **Fase 2 — levar pra casa**: assim que o aluno é marcado "Embarcou" na
    volta, o destino muda automaticamente pro endereço residencial dele — a
    troca é recalculada a cada request no backend
    (`src/app/api/motorista/rota/route.ts`), nunca fica só no estado do
    cliente.
  - **Ausente na ida não entra na volta**: se um aluno foi marcado ausente na
    ida, ele é automaticamente excluído da lista/mapa de retorno do mesmo
    dia (não faz sentido buscar na escola quem não foi levado).

## Painel (dashboard financeiro/operacional)

`/motorista/painel` (item "Painel" na navegação,
`src/components/motorista/PainelDashboard.tsx` +
`src/lib/painel/dashboard-data.ts`) — visão geral do mês, com 7 cards
coloridos e clicáveis:

- **Alunos vinculados** / **Escolas vinculadas** — contagem de vínculos
  vigentes em algum ponto do mês selecionado (considera `criadoEm`/
  `revogadoEm` do `Vinculo`, não só o status atual, pra fazer sentido também
  em meses passados).
- **Entrada prevista** — soma de todas as `MensalidadeTransporte` do mês
  (pendente + paga, exceto cancelada).
- **Pagamentos recebidos** — soma das mensalidades com status `PAGO` no mês.
- **Pagamentos pendentes** / **Pagamentos atrasados** — mensalidades
  `PENDENTE` são divididas comparando o vencimento de cada vínculo
  (`diaPagamentoMensalidade`, truncado pro último dia do mês quando
  necessário) com a data de **hoje** — não com o mês filtrado. Isso é o que
  permite ver corretamente, por exemplo, um mês passado inteiro como
  "atrasado" e o mês corrente como "pendente" até o dia do vencimento
  chegar.
- **Km rodados** — é a única exceção ao filtro de mês: é sempre uma janela
  móvel dos **últimos 30 dias corridos** a partir de hoje (soma de
  `PercursoDia.distanciaMetros`), igual ao rótulo diz.

Cada card abre um modal com o detalhamento (lista de alunos/escolas/
mensalidades/dias, conforme o card). O filtro de mês (setas + seletor dos
últimos 12 meses) atualiza a URL (`?mes=YYYY-MM`) e reprocessa tudo no
servidor — sem estado duplicado no cliente. No mobile o grid usa 2 colunas
mesmo na tela pequena (em vez de empilhar 7 cards), pra caber numa tela só
sem precisar rolar demais.

## Assinaturas e pagamento (Mercado Pago)

Substituiu o modelo antigo de cobrança mensal por aluno excedente. Motoristas
assinam um dos três planos pré-pagos e pagam via Mercado Pago (Checkout Pro);
o pagamento é validado no próprio sistema, sem intervenção manual.

- **Planos** (`src/lib/subscription/plans.ts`, módulo puro — usado tanto no
  cliente para o preview de preço quanto no servidor como fonte de verdade):
  - **Basic** — R$ 33,00, cobrança mensal, 7 dias de teste, sem alunos
    grátis, + R$ 1,00/aluno.
  - **Pró** — R$ 178,20, cobrança semestral (10% de economia vs. Basic ×6),
    7 dias de teste, 5 alunos grátis, + R$ 1,00/aluno excedente.
  - **Max** — R$ 356,40, cobrança anual (10% de economia vs. Basic ×12), 7
    dias de teste, 10 alunos grátis, acesso ao módulo de gestão de alunos,
    + R$ 1,00/aluno excedente. Único plano que aceita **anos adicionais**:
    cada ano extra soma o valor cheio do plano anual
    (`valorTotal = valorBase + alunosExcedentes×1 + anosAdicionais×valorBase`).
  - O valor é sempre recalculado no servidor a partir dos parâmetros brutos
    (`tipoPlano`, `qtdAlunos`, `anosAdicionais`) antes de gerar a cobrança —
    nunca confiamos num total vindo do cliente.
- **Ciclo de vida da assinatura** (`src/lib/subscription/service.ts`):
  1. Ao escolher um plano em `/motorista/planos` e informar a quantidade de
     alunos, `POST /api/motorista/assinatura/checkout` cria uma `Assinatura`
     (status `TESTE`, 7 dias a partir de agora) e uma preference de checkout
     no Mercado Pago — o motorista já tem acesso liberado durante o teste,
     mesmo antes de pagar.
  2. Ao aprovar o pagamento, o webhook (`POST /api/webhooks/mercadopago`)
     ativa a assinatura (`ATIVA`, com `expiraEm` calculado pelo ciclo de
     cobrança) e cancela qualquer outra assinatura `TESTE`/`ATIVA` do mesmo
     motorista — cobre tanto upgrade de plano quanto renovação.
  3. Status expira preguiçosamente (mesmo padrão usado nos convites): na
     primeira leitura após `testeExpiraEm`/`expiraEm`, o status é corrigido
     para `EXPIRADA`, sem precisar de cron.
- **Validação do pagamento**: o webhook recebe só um `id` de pagamento — o
  corpo da notificação nunca é a fonte de verdade. `confirmarPagamentoMercadoPago`
  sempre revalida direto na API do Mercado Pago (`GET /v1/payments/{id}`) com
  nosso próprio access token antes de ativar qualquer coisa, e confere se o
  valor recebido bate com o valor originalmente cobrado.
- **Renovação é manual** (não há cobrança recorrente automática ainda): ao
  final do ciclo pago, o motorista volta a `/motorista/planos` e refaz o
  checkout. Fica para uma fase futura assinatura recorrente de fato.
- **Alerta de dias de teste**: `MotoristaShell` busca a assinatura atual do
  motorista e mostra uma faixa discreta no topo, em todas as abas, com os
  dias restantes de teste (ou aviso de expiração) — `src/components/motorista/TrialBanner.tsx`.
- **Bloqueio de acesso quando expira**: sem assinatura `TESTE`/`ATIVA`,
  `POST /api/motorista/convites` retorna 402 e a geração de novos convites
  fica bloqueada até assinar um plano (vínculos/alunos existentes continuam
  funcionando normalmente).
- Variáveis de ambiente: `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET`
  (opcional — ver comentário no `.env.example`) e `NEXT_PUBLIC_APP_URL` (usada
  para montar as URLs de retorno e do webhook).
- O antigo fechamento mensal por aluno excedente (`src/lib/billing/service.ts`,
  `POST /api/cron/fechamento-mensal`) foi desativado — o cron correspondente
  foi removido de `vercel.json` para não gerar cobranças do modelo antigo em
  paralelo às assinaturas.

## Documentos do veículo

Armazenados num bucket compatível com S3 (`src/lib/storage/index.ts`). Só a
*key* do objeto é guardada no banco (`Veiculo.documentoUrl`) — a URL de
acesso é sempre resolvida sob demanda: pública, se `STORAGE_PUBLIC_BASE_URL`
estiver configurada, ou uma *signed URL* de 5 minutos caso contrário. **Não
há etapa de aprovação/validação manual** dos documentos, conforme
especificado — eles são apenas armazenados para consulta.

## LGPD

- Cadastro de motorista e de responsável exige aceite explícito (checkbox,
  não pré-marcado) de uma política de privacidade antes de criar a conta —
  ver `Motorista.consentimentoLgpdAceitoEm` / `Responsavel.consentimentoLgpdAceitoEm`
  e `src/components/auth/RegisterForm.tsx`.
- Política de privacidade acessível em `/privacidade`
  (`src/app/privacidade/page.tsx`), cobrindo especificamente o tratamento de
  localização em tempo real e de dados relacionados a rotas de crianças.
- A localização só é compartilhada quando o motorista ativa manualmente o
  GPS a cada sessão — nunca por padrão.

## Estrutura do projeto

```
prisma/schema.prisma          modelo de dados + migrations
scripts/fechamento-mensal.ts  job standalone do modelo de cobrança antigo (desativado, ver Assinaturas)

src/lib/
  auth/                       sessão (JWT/cookie), hash de senha, guards de autenticação
  email/                      envio de e-mail (Resend) e código de verificação (cadastro/login)
  storage/                    upload e resolução de URL de documentos (S3-compatível)
  billing/                    modelo de cobrança antigo por aluno excedente (desativado)
  subscription/               planos (Basic/Pró/Max), cálculo de preço e ciclo de vida da assinatura
  payment/mercadopago.ts      integração com o Mercado Pago (Checkout Pro + validação de pagamento)
  validation/schemas.ts       schemas Zod de entrada
  convite.ts                  geração/expiração de código de convite
  location.ts                 regra de "localização desatualizada"
  percurso.ts                 abertura/fechamento de PercursoDia (resumo da rota, km rodado)
  mensalidade/mensalidade-transporte.ts   cron: gera MensalidadeTransporte do mês quando o dia de pagamento chega
  painel/dashboard-data.ts    agregação dos 7 cards do Painel (mês selecionado + km últimos 30 dias)

src/contexts/LocationSharingContext.tsx   compartilhamento de GPS + alerta de confirmação ao interromper

src/app/
  api/auth/{motorista,responsavel}/{register,register/verificar,login,login/verificar,logout,reenviar-codigo}
  api/motorista/{veiculos,convites,vinculos,localizacao,assinatura,assinatura/checkout,rota,embarques,mensalidades,me}
  api/responsavel/{convites/usar,vinculos,buscar-placa,me}
  api/webhooks/mercadopago
  api/cron/{fechamento-mensal,mensalidades}   (fechamento-mensal desativado — ver Assinaturas e pagamento)
  motorista/{login,cadastro,dashboard,painel,veiculos,convites,vinculos,relatorios,cobrancas,planos}
  responsavel/{login,cadastro,dashboard,vincular,buscar}
  privacidade

src/components/
  auth/                       formulários, verificação de código e shell de login/cadastro, reusados pelas duas roles
  motorista/ , responsavel/   componentes específicos de cada painel
  motorista/{PlanCard,PlanosClient,TrialBanner}.tsx   cards de plano, checkout e alerta de dias de teste
  motorista/RotaPanel.tsx     rota do dia (ida/volta, lista de alunos, Ir/Embarcou/Ausente)
  motorista/PainelDashboard.tsx   dashboard financeiro/operacional (7 cards + filtro de mês)
  map/                        mapa Leaflet (client-only) — marcadores por iniciais, cores por estado do aluno
  layout/AppHeader.tsx        header responsivo com menu hambúrguer no mobile

src/hooks/useLocationSharing.ts   watchPosition + envio throttled de localização
```

## Testes

Duas suítes, propositalmente separadas:

### Unitários (`npm test`)

Cobrem só lógica **pura** — sem Prisma, sem banco, sem runtime do Next.
Rodam em menos de 2s, então rodam sempre (inclusive antes de commitar).

```bash
npm test          # roda uma vez
npm run test:watch
```

Alguns módulos que originalmente misturavam lógica pura com acesso ao
Prisma (`geocoding.ts`, `subscription/cobranca-aluno.ts`,
`subscription/cobranca-aluno-pagamento.ts`) tiveram a parte pura extraída
pra um arquivo próprio sem `import "server-only"`/Prisma (ex.:
`geo/endereco-texto.ts`, `date-utils.ts`,
`subscription/cobranca-aluno-pagamento-regras.ts`), reexportada do módulo
original pra não quebrar quem já importava de lá. Isso existe só pra viabilizar
teste unitário rápido — a lógica em si não mudou.

### Integração (`npm run test:integration`)

Batem num Postgres de teste de verdade via Prisma — cobrem fluxos com
estado (ex.: `processarCobrancasAlunoVencidas` com o ranking dinâmico da
faixa grátis, `processarMensalidadesTransporteVencidas` com a geração
idempotente). Mais lentos, exigem infra local, por isso ficam fora do
`npm test` padrão (arquivos `*.integration.test.ts`, config separada em
`vitest.integration.config.ts`).

```bash
docker compose -f docker-compose.test.yml up -d   # Postgres só de teste, porta 5434
cp .env.test.example .env.test                    # ajuste se mudar porta/credenciais
npm run test:integration:migrate                   # só na 1a vez / após mudar o schema
npm run test:integration
```

`docker-compose.test.yml` é um Postgres **separado** do
`docker-compose.yml` de desenvolvimento (porta/usuário/banco diferentes) —
os testes de integração truncam tabelas inteiras entre cada `it()` (ver
`src/test/db.ts`), então nunca devem apontar pro banco de dev. Por
segurança, `src/test/db.ts` recusa rodar se `DATABASE_URL` não contiver
"test" no nome.

`npm run test:all` roda as duas suítes em sequência.

## Deploy (Vercel + Neon)

Stack de hospedagem recomendada — gratuita pra começar, sem servidor pra
gerenciar:

1. **Banco de dados**: crie um projeto no [Neon](https://neon.tech) (Postgres
   serverless, free tier). Copie a **connection string com pooling**
   (termina em `-pooler...`, não a direta) — funções serverless da Vercel
   abrem muitas conexões simultâneas, e sem o pooler o banco esgota conexões
   rápido. Acrescente `?pgbouncer=true&connection_limit=1` no fim dessa URL
   (recomendação oficial do Prisma para o pooler da Neon, evita erros
   esporádicos de "prepared statement already exists" em produção).
2. **App**: em [vercel.com](https://vercel.com), "Add New → Project" e
   importe o repositório `hello-inova/moove` do GitHub. A Vercel detecta o
   Next.js automaticamente.
3. **Variáveis de ambiente**: no dashboard do projeto na Vercel, em
   *Settings → Environment Variables*, configure as mesmas chaves do
   `.env.example` (`DATABASE_URL` apontando pro Neon com pooler,
   `AUTH_SECRET_MOTORISTA`, `AUTH_SECRET_RESPONSAVEL`, `RESEND_API_KEY`,
   `EMAIL_FROM`, `CRON_SECRET`, `STORAGE_*` se for usar upload de documentos,
   e `NEXT_PUBLIC_APP_URL` + `MERCADOPAGO_ACCESS_TOKEN` (produção) para as
   assinaturas — ver [Assinaturas e pagamento](#assinaturas-e-pagamento-mercado-pago)).
4. **Deploy**: clique em Deploy. O build (`vercel.json`/`package.json`) já
   roda `prisma migrate deploy` automaticamente antes do `next build`, então
   as tabelas são criadas/atualizadas em todo deploy sem passo manual.
5. **Fechamento mensal**: o `vercel.json` já declara um Cron Job da Vercel
   chamando `POST /api/cron/fechamento-mensal` todo dia 1 às 03:00 UTC. A
   Vercel injeta automaticamente o header `Authorization: Bearer
   $CRON_SECRET` usando a env var `CRON_SECRET` configurada no projeto — não
   precisa de nenhum agendador externo.

> O plano gratuito ("Hobby") da Vercel é destinado a uso pessoal/não
> comercial nos termos deles — bom para validar o produto, mas migre para o
> plano Pro (pago) quando o Moove estiver em operação real.

## App mobile (Android/iOS)

O app nativo **não é um bundle separado** — é uma casca nativa (via
[Capacitor](https://capacitorjs.com)) que carrega o site em produção de
verdade dentro de um WebView (`server.url` em `capacitor.config.ts`). Tudo
que já existe (páginas, API routes, autenticação por cookie, cron jobs)
continua funcionando exatamente igual e sem duplicação — um deploy novo no
site já reflete no app, sem precisar publicar uma versão nova na loja (só é
preciso reconstruir/republicar quando algo *nativo* mudar: plugin,
permissão, ícone etc.).

Estrutura:

- `capacitor.config.ts` — configuração raiz, incluindo `appId`
  (`br.com.helloinova.moove`) e a URL de produção. **O `appId` fica
  praticamente permanente depois da primeira publicação numa loja** —
  confirme antes de publicar a primeira versão.
- `android/` — projeto nativo Android (Gradle/Android Studio).
- `ios/` — projeto nativo iOS (Xcode). Usa Swift Package Manager, não exige
  CocoaPods.
- `www/` — conteúdo local mínimo exigido pelo Capacitor (`webDir`); na
  prática nunca aparece, é só um fallback — o app carrega a URL real.

### Build/rodar localmente

Requer Android Studio (Android) ou um Mac com Xcode (iOS) — nenhum dos dois
roda dentro deste ambiente sandbox, só numa máquina com as ferramentas
instaladas.

```bash
npm install                # instala @capacitor/* junto com o resto
npx cap sync                # sincroniza config/plugins nas pastas nativas
npx cap open android        # abre no Android Studio
npx cap open ios            # abre no Xcode (só em macOS)
```

A partir daí, Run/Play normal em cada IDE — o app abre já carregando
`https://app.mooveraster.com.br`.

### O que falta pra publicar de verdade nas lojas

O wrapper básico já funciona (é o que este commit entrega), mas duas coisas
que a web sozinha não resolve bem ainda precisam de plugin nativo antes de
submeter às lojas de verdade:

1. **Localização em segundo plano** — hoje o compartilhamento de GPS do
   motorista depende da aba/app estar em primeiro plano (limitação do
   navegador, mais severa no iOS). Resolve com um plugin de background
   geolocation (ex.: `@capacitor-community/background-geolocation`,
   gratuito, ou a opção paga da Transistor Software, mais robusta) —
   decisão de custo que fica pra quando formos configurar isso.
2. **Push nativo** — hoje usa Web Push (VAPID, já implementado). Pra
   confiabilidade melhor dentro do app nativo, trocar por
   `@capacitor/push-notifications` (FCM no Android, APNs no iOS).

Sem isso, o app já é publicável (é justamente ter esses dois pontos nativos
que evita a Apple rejeitar por "app é só um site" — guideline 4.2), mas o
rastreamento em segundo plano ainda ficaria limitado até o item 1 ser feito.

### Publicando na Google Play Store (Android)

Ícones já gerados (`android/app/src/main/res/mipmap-*`, a partir de
`public/icons/icon-512*.png`) e a assinatura de release já configurada
(`android/app/build.gradle` lê `android/keystore.properties`, que não vai
pro Git — ver `android/keystore.properties.example`). Passos que dependem
de conta/pagamento/design, então ficam com você:

1. **Conta de desenvolvedor Google Play** — crie em
   [play.google.com/console](https://play.google.com/console), taxa única
   de US$ 25.
2. **Backup da keystore** — `android/app/upload-keystore.jks` e
   `android/keystore.properties` foram gerados localmente e só existem na
   sua máquina (nunca vão pro Git). Copie os dois pra um cofre de senhas ou
   backup seguro AGORA, antes de continuar. Com o **Play App Signing**
   (obrigatório pra apps novos), perder isso não é mais permanente — dá
   pra pedir reset pelo suporte do Google — mas ainda assim evite depender
   disso.
3. **Gerar o `.aab` assinado**:
   ```bash
   cd android
   ./gradlew bundleRelease
   ```
   Gera `android/app/build/outputs/bundle/release/app-release.aab`. (Ou,
   pelo Android Studio: Build → Generate Signed Bundle/APK.)
4. **Criar o app no Play Console** e preencher a ficha da loja:
   - Nome, descrição curta/completa, categoria (Mapas e navegação, ou
     Produtividade).
   - Ícone 512×512 — já existe em `public/icons/icon-512.png`.
   - **Gráfico de destaque (1024×500)** e **screenshots** (mín. 2, celular)
     — ainda faltam gerar; precisam do app rodando de verdade num
     emulador/aparelho, não dá pra fazer sem isso.
   - **Política de privacidade** — já existe, use
     `https://app.mooveraster.com.br/privacidade`.
   - **Formulário de segurança de dados** — declare o que o app
     coleta: nome/e-mail/telefone/CPF (cadastro), localização em tempo real
     (motorista), e dados de alunos cadastrados pelo responsável (nome,
     data de nascimento, endereço). Preencha com atenção — é obrigatório e
     checado pela revisão.
   - Classificação indicativa (questionário padrão do Google).
   - País/preço: Brasil, gratuito.
5. **Enviar pra revisão** — a primeira análise costuma levar de algumas
   horas a poucos dias.

## O que fica para depois

- Cobrança recorrente automática (hoje a renovação do plano é feita
  manualmente pelo motorista a cada fim de ciclo — ver Assinaturas e pagamento).
- Plugin de background geolocation e push nativo no app mobile (ver seção
  acima) — necessários antes da primeira publicação nas lojas.
- Gráfico de destaque e screenshots da Play Store (ver checklist acima).
- Splash screen nativa personalizada (usa o padrão do Capacitor por
  enquanto — os ícones do launcher já foram customizados).
