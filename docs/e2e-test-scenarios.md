# Cenários de teste ponta a ponta — Moove

Cobrem os fluxos completos do sistema (motorista, responsável, admin,
cobranças, cron jobs), do clique do usuário até o efeito no banco. Hoje o
projeto só tem testes unitários e de integração (lógica + banco) — nenhum
E2E automatizado (Playwright/Cypress) ainda. Este documento serve como:

1. Roteiro de QA manual antes de releases grandes.
2. Base pronta pra virar suíte automatizada (Playwright, por exemplo) — cada
   cenário já está no formato Dado/Quando/Então.

Convenção: **P0** = fluxo crítico de receita/segurança (testar sempre antes
de deploy), **P1** = importante, **P2** = edge case / nice-to-have.

---

## 1. Cadastro e autenticação

### 1.1 — Motorista se cadastra e faz login (P0)
- **Dado** um motorista novo na tela `/motorista/cadastro`
- **Quando** ele preenche nome, e-mail, CPF, senha e envia
- **Então** a conta é criada, o e-mail de verificação é disparado, e o
  motorista consegue logar em `/motorista/login` com as credenciais
- **Edge cases**: CPF/e-mail duplicado deve ser rejeitado; senha fraca deve
  ser rejeitada pela validação do schema.

### 1.2 — Responsável se cadastra sem endereço (P0)
- **Dado** um responsável novo em `/responsavel/cadastro`
- **Quando** preenche nome, e-mail, telefone, senha (sem nenhum campo de
  endereço — isso foi removido do cadastro)
- **Então** a conta é criada e o endereço fica pendente de preenchimento por
  aluno, depois, em "Meus alunos"
- **Regressão importante**: confirmar que nenhum campo de endereço aparece
  nessa tela e que o backend ignora/rejeita endereço enviado no payload de
  cadastro.

### 1.3 — Recuperação de senha (motorista e responsável) (P1)
- **Dado** um usuário com conta existente que esqueceu a senha
- **Quando** solicita recuperação em `/motorista/recuperar-senha` ou
  `/responsavel/recuperar-senha`
- **Então** recebe o e-mail com link/token, define nova senha, e consegue
  logar só com a nova senha (a antiga deixa de funcionar)

### 1.4 — Bloqueio por tentativas de acesso (P1)
- **Dado** um usuário errando a senha repetidamente
- **Quando** excede o limite de tentativas
- **Então** a conta é temporariamente bloqueada (`TentativaAcesso`) e o
  login é rejeitado mesmo com a senha correta até o bloqueio expirar

---

## 2. Convite e vínculo motorista ↔ responsável ↔ aluno

### 2.1 — Motorista convida responsável, responsável aceita (P0)
- **Dado** um motorista logado em `/motorista/(app)/convites`
- **Quando** ele gera um convite (código/link) e o responsável usa esse
  código em `/responsavel/vincular`
- **Então** é criado um `Vinculo` ATIVO entre motorista e responsável,
  visível nos dois dashboards

### 2.2 — Responsável cadastra aluno vinculado ao motorista (P0)
- **Dado** um responsável com vínculo ativo a um motorista
- **Quando** cadastra um aluno em "Meus alunos" (nome, nascimento, escola,
  período, endereço)
- **Então** o aluno aparece na lista de alunos do motorista, com o endereço
  correto usado depois pra rota

### 2.3 — Dois filhos do mesmo responsável com endereços diferentes (P1)
- **Dado** um responsável com dois alunos cadastrados
- **Quando** define endereços diferentes pra cada um (ex.: mora com pai e
  mãe em endereços distintos)
- **Então** a rota do motorista considera o endereço de cada aluno
  individualmente, não um endereço único do responsável

### 2.4 — Motorista revoga vínculo (P1)
- **Dado** um vínculo ATIVO motorista-responsável
- **Quando** o motorista revoga o vínculo em `/motorista/(app)/vinculos`
- **Então** o status muda pra REVOGADO, o responsável perde acesso ao
  rastreamento daquele motorista, e o vínculo para de ser cobrado/gerar
  mensalidade nos crons seguintes

---

## 3. Perfil do aluno — endereço, mensalidade, contrato

### 3.1 — Responsável edita endereço de um aluno (P0)
- **Dado** um aluno já cadastrado
- **Quando** o responsável edita o endereço na página de perfil do aluno
- **Então** o novo endereço é geocodificado, salvo, e a rota do motorista
  passa a usar o endereço atualizado no próximo cálculo

### 3.2 — Motorista configura mensalidade e dia de pagamento do aluno (P0)
- **Dado** um vínculo ativo sem `valorMensalidade`/`diaPagamentoMensalidade`
  configurados
- **Quando** o motorista preenche esses campos no perfil do aluno
- **Então** o vínculo passa a ser elegível pra geração automática de
  mensalidade no próximo ciclo do cron (ver 6.x)

### 3.3 — Motorista registra contrato de transporte do aluno (P1)
- **Dado** um aluno com vínculo ativo
- **Quando** o motorista cria/anexa um contrato de transporte (dados de
  vigência, valor)
- **Então** o contrato fica disponível no painel do motorista e do
  responsável, com vigência respeitada pela geração de mensalidade (ver 6.5)

---

## 4. Rastreamento em tempo real

### 4.1 — Responsável acompanha localização do motorista ao vivo (P0)
- **Dado** um motorista com vínculo ativo enviando localização
  (`/api/motorista/localizacao`)
- **Quando** o responsável abre `/responsavel/buscar` (ou busca por placa)
- **Então** vê a posição do veículo atualizando, calculada a partir do
  endereço do(s) aluno(s) vinculado(s) àquele responsável

### 4.2 — Localização "stale" não é exibida como atual (P1)
- **Dado** um motorista que parou de enviar localização há muito tempo
- **Quando** o responsável abre o rastreamento
- **Então** o sistema indica que a localização está desatualizada em vez de
  mostrar uma posição antiga como se fosse ao vivo (`isLocationStale`)

### 4.3 — Alerta de proximidade dispara push ao responsável (P1)
- **Dado** um responsável com push habilitado e endereço de aluno definido
- **Quando** o motorista se aproxima do endereço do aluno dentro do raio
  configurado
- **Então** o responsável recebe notificação push de alerta de proximidade,
  sem duplicar alertas pro mesmo trajeto/dia

### 4.4 — Motorista registra embarque do aluno no dia (P2)
- **Dado** uma rota do dia em andamento
- **Quando** o motorista marca o embarque de um aluno específico
- **Então** o embarque fica registrado (`EmbarqueDia`) e visível no
  histórico/relatório do dia

---

## 5. Assinatura do motorista (planos)

### 5.1 — Motorista assina um plano (P0)
- **Dado** um motorista sem assinatura ativa (ou em teste grátis)
- **Quando** escolhe um plano em `/motorista/(app)/planos` e completa o
  checkout
- **Então** uma `Assinatura` ATIVA é criada com o `alunosGratis` e
  `valorPorAlunoExcedente` corretos do plano escolhido

### 5.2 — Teste grátis expira sem assinatura (P1)
- **Dado** um motorista em teste grátis com `testeExpiraEm` no passado e
  sem assinatura ativa
- **Quando** ele tenta usar uma funcionalidade restrita (ex.: adicionar
  vínculo novo)
- **Então** o acesso é bloqueado/redirecionado pra tela de planos

---

## 6. Cobrança por aluno (motorista → Asaas) e mensalidade (responsável → motorista)

### 6.1 — Cron gera cobrança só pros alunos além da faixa grátis (P0)
- **Dado** um motorista com assinatura ativa (`alunosGratis = 1`) e dois
  vínculos, um mais antigo que o outro
- **Quando** o cron `/api/cron/cobrancas-aluno` roda
- **Então** o vínculo mais antigo fica na faixa grátis (sem cobrança) e o
  mais novo é cobrado — já coberto pelo teste de integração existente

### 6.2 — Motorista paga cobranças pendentes de alunos via Asaas (P0)
- **Dado** cobranças `PENDENTE` acumuladas pro motorista
- **Quando** ele abre `/motorista/(app)/cobrancas` e inicia o checkout
- **Então** um checkout Asaas é criado só se o total pendente atingir o
  mínimo (`VALOR_MINIMO_ASAAS`), e o webhook `/api/webhooks/asaas` marca as
  cobranças como pagas quando o pagamento é confirmado

### 6.3 — Webhook Asaas confirma pagamento (P0)
- **Dado** um checkout Asaas criado pra um grupo de cobranças
- **Quando** o Asaas envia o webhook de pagamento confirmado
- **Então** as `CobrancaAluno` correspondentes mudam pra `PAGO`, sem
  duplicar nem afetar cobranças de outro motorista

### 6.4 — Cron gera mensalidade automática do transporte (P0)
- **Dado** um vínculo com `valorMensalidade`/`diaPagamentoMensalidade`
  configurados e o dia de pagamento já alcançado no mês
- **Quando** o cron `/api/cron/mensalidades` roda
- **Então** uma `MensalidadeTransporte` `PENDENTE` é criada pro mês, visível
  pro responsável, sem duplicar se o cron rodar de novo no mesmo mês —
  coberto pelo teste de integração existente

### 6.5 — Mensalidade respeita vigência do contrato (P1)
- **Dado** um vínculo com `vigenciaInicio`/`vigenciaFim` definidos (ex.:
  contrato de transporte por período letivo)
- **Quando** o cron roda fora dessa janela
- **Então** nenhuma mensalidade é gerada

### 6.6 — Responsável confirma pagamento da mensalidade (P1)
- **Dado** uma mensalidade `PENDENTE` visível pro responsável
- **Quando** o motorista confirma o recebimento (fora do Asaas, é
  informativo)
- **Então** o status muda e reflete no painel de ambos

---

## 7. Admin

### 7.1 — Admin gerencia motoristas e planos (P1)
- **Dado** um admin logado em `/admin`
- **Quando** cria/edita um plano de assinatura em `/admin/planos`
- **Então** o plano fica disponível pros motoristas escolherem, com preço e
  `alunosGratis` corretos

### 7.2 — Admin consulta auditoria (P2)
- **Dado** ações relevantes registradas (`LogAuditoria`)
- **Quando** o admin abre `/admin/auditoria`
- **Então** consegue ver quem fez o quê e quando, filtrando por
  ator/ação/data

### 7.3 — Admin acompanha uso de API externa (Google) (P2)
- **Dado** chamadas de geocoding/autocomplete feitas pelo sistema
- **Quando** o admin abre `/admin/uso-google`
- **Então** vê o volume de uso, útil pra controlar custo da API

---

## 8. Jobs de limpeza

### 8.1 — Cron de limpeza remove dados temporários vencidos (P2)
- **Dado** registros temporários vencidos (ex.: localizações antigas, cache
  de geocode expirado)
- **Quando** `/api/cron/limpeza` roda
- **Então** só o que está de fato vencido é removido — dados válidos não são
  afetados

---

## Como usar isso

- **Curto prazo**: usar como checklist manual antes de cada deploy grande,
  focando nos P0.
- **Automatizar**: se quiser, monto uma suíte E2E de verdade com Playwright
  rodando contra o app + o mesmo Postgres de teste que já existe
  (`docker-compose.test.yml`), cobrindo pelo menos os P0 acima (cadastro,
  convite/vínculo, cobrança, mensalidade, rastreamento). É trabalho novo de
  infra (Playwright não está instalado ainda) — só entra em ação se você
  pedir.
