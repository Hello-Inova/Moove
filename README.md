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
`Localizacao`, `Plano`, `Cobranca`. Uma tabela auxiliar `CobrancaVinculo`
registra quais vínculos compuseram o excedente cobrado em cada fechamento
mensal (auditoria — não fazia parte do modelo mínimo pedido, mas evita ter
que recalcular/adivinhar isso depois do fato).

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
retorna um aviso.

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

## Cobrança mensal

- `src/lib/billing/service.ts` — lógica pura: grátis até
  `Plano.alunosIncluidosGratis` (padrão 5) vínculos ativos; a partir do
  próximo, cobra `Plano.valorPorAlunoExcedente` (padrão R$ 6,00, configurável
  via `BILLING_VALOR_POR_ALUNO_EXCEDENTE`) por aluno/mês. Idempotente: rodar
  o fechamento duas vezes para o mesmo mês não duplica a cobrança
  (`@@unique([motoristaId, referenciaMes])`).
- **Sem gateway de pagamento integrado ainda.** `src/lib/billing/payment-gateway.ts`
  define a interface `PaymentGateway` e uma implementação stub
  (`NullPaymentGateway`) que não faz nenhuma chamada externa — a cobrança é
  gerada e persistida como `PENDENTE` independente disso, para o fechamento
  financeiro não ficar bloqueado por essa integração. Trocar por um gateway
  real é implementar `PaymentGateway` e trocar o retorno de
  `getPaymentGateway()`.
- Dois jeitos de disparar o fechamento, ambos chamando o mesmo serviço:
  - **Job standalone**: `npm run job:fechamento-mensal` (roda fora do
    Next.js via `tsx`; aceita uma referência de mês opcional como argumento,
    ex: `npm run job:fechamento-mensal -- 2026-07`). Pensado para um cron
    externo tipo `0 3 1 * *`.
  - **HTTP** (para agendadores baseados em requisição, ex: Vercel Cron):
    `POST /api/cron/fechamento-mensal`, protegido por
    `Authorization: Bearer <CRON_SECRET>`.

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
scripts/fechamento-mensal.ts  job standalone de cobrança

src/lib/
  auth/                       sessão (JWT/cookie), hash de senha, guards de autenticação
  storage/                    upload e resolução de URL de documentos (S3-compatível)
  billing/                    cálculo de cobrança, job e stub de gateway de pagamento
  validation/schemas.ts       schemas Zod de entrada
  convite.ts                  geração/expiração de código de convite
  location.ts                 regra de "localização desatualizada"

src/app/
  api/auth/{motorista,responsavel}/{register,login,logout}
  api/motorista/{veiculos,convites,vinculos,localizacao,cobrancas,me}
  api/responsavel/{convites/usar,vinculos,buscar-placa,me}
  api/cron/fechamento-mensal
  motorista/{login,cadastro,dashboard,veiculos,convites,vinculos,cobrancas}
  responsavel/{login,cadastro,dashboard,vincular,buscar}
  privacidade

src/components/
  auth/                       formulários e shell de login/cadastro, reusados pelas duas roles
  motorista/ , responsavel/   componentes específicos de cada painel
  map/                        mapa Leaflet (client-only)

src/hooks/useLocationSharing.ts   watchPosition + envio throttled de localização
```

## O que fica para depois

- Integração real de gateway de pagamento (interface já pronta).
- App nativo (fase futura, fora do escopo atual).
- PWA/Service Worker para estender a janela de compartilhamento em segundo
  plano no mobile.
- Testes automatizados (o fluxo crítico foi validado manualmente ponta a
  ponta durante o desenvolvimento, mas não há suíte de testes no repositório
  ainda).
