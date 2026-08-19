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

## 9. Lote de ajustes — login, cadastro, painel e vigência

Cobre os 13 itens do pedido mais recente (login do motorista, mensagens de
cadastro, verificação por código, recuperação de senha, assinatura,
cadastro de aluno, período do vínculo, previsão anual do Painel e
sincronização de vigência). Vários cenários aqui são regressão direta de
bugs relatados — marcados como tal.

### 9.1 — Login do motorista abre no Painel, não na Rota (P1)
- **Dado** um motorista com conta ativa e senha correta
- **Quando** ele faz login em `/motorista/login` e confirma o código de
  verificação
- **Então** é redirecionado para `/motorista/painel` (não mais para
  `/motorista/dashboard`, que é a tela de Rota)
- **E** o mesmo vale pros redirecionamentos de "já autenticado" ao abrir
  `/motorista/login`, `/motorista/cadastro` e `/motorista/recuperar-senha`
  diretamente, e ao clicar no logo do app (`homeHref`)

### 9.2 — Mensagem de CPF duplicado no cadastro do motorista (P2)
- **Dado** um CPF já cadastrado por outro motorista
- **Quando** um novo cadastro é enviado em `/motorista/cadastro` com esse
  mesmo CPF
- **Então** a API retorna 409 com a mensagem exata "Digite outro CPF." e o
  formulário exibe esse erro pro usuário

### 9.3 — Contagem regressiva do código de verificação (P2)
- **Dado** um cadastro ou login que acabou de disparar o código por e-mail
- **Quando** a tela de verificação (`VerifyCodeForm`) é exibida
- **Então** um cronômetro regressivo de 10:00 é exibido e decresce a cada
  segundo
- **E** ao chegar em 0:00, a mensagem muda para "Código expirado — peça um
  novo." e o botão "Confirmar código" fica desabilitado
- **E** ao clicar em "Reenviar código" com sucesso, o cronômetro volta pra
  10:00

### 9.4 — Data de expiração do plano em Planos e no Painel (P1)
- **Dado** um motorista em período de teste grátis
- **Quando** ele abre `/motorista/planos` ou `/motorista/painel`
- **Então** vê um aviso "Você está no período de teste grátis — expira em
  DD/MM/AAAA" (Planos) / "Período de teste grátis até DD/MM/AAAA" (Painel)
- **Dado** (variação) um motorista com assinatura `ATIVA`
- **Então** o aviso mostra "Plano atual: <nome> — expira em DD/MM/AAAA" e,
  no Painel, o mesmo card é clicável e leva pra `/motorista/planos`
- **Dado** (variação) um motorista com assinatura `EXPIRADA` e teste já
  vencido
- **Então** o aviso é de alerta (vermelho) convidando a escolher um plano

### 9.5 — Recuperação de senha em 3 etapas, sem login automático (P0)
- **Dado** um usuário (motorista ou responsável) que esqueceu a senha
- **Quando** ele informa o e-mail em `/<role>/recuperar-senha`
- **Então** recebe o código por e-mail e vê **só** o campo de código (sem
  campos de senha ainda)
- **Quando** digita o código correto e confirma
- **Então** só então os campos de "Nova senha" e "Confirmar nova senha"
  aparecem
- **Quando** confirma a nova senha
- **Então** vê um alerta de sucesso ("Senha redefinida com sucesso!...") e é
  redirecionado para `/<role>/login` — **não** fica logado automaticamente
- **E** com a senha antiga, o login deve falhar; com a nova, deve funcionar
- **Edge case**: código incorreto na etapa 2 não avança pra etapa de senha;
  código expirado (10 min) exibe erro e permite reenvio

### 9.6 — Regressão: campo de código não vem preenchido com o e-mail (P1)
- **Dado** o usuário acabou de submeter o e-mail na tela de recuperação de
  senha
- **Quando** a etapa de código é exibida
- **Então** o campo "Código de verificação" começa **vazio** (nunca com o
  valor do e-mail digitado na etapa anterior)
- **E** ao clicar em "Usar outro e-mail" e voltar pra etapa de código depois,
  o campo continua vazio (sem resíduo de preenchimento anterior)

### 9.7 — Alertas de sucesso após cadastros (P2)
- **Dado** um motorista cadastrando veículo, escola ou gerando convite
- **Quando** cada uma dessas ações é concluída com sucesso
- **Então** aparece um toast de sucesso ("Veículo cadastrado.", "Escola
  cadastrada."/"Escola atualizada.", "Convite gerado.") e a lista
  correspondente recarrega sozinha, sem precisar dar F5
- **Dado** um responsável usando um código de convite pra vincular um aluno
- **Quando** confirma o vínculo
- **Então** aparece o toast "Aluno vinculado com sucesso." além da mensagem
  inline já existente

### 9.8 — "Usar outro e-mail" preserva os campos preenchidos (P1)
- **Dado** um cadastro (motorista ou responsável) já preenchido, que caiu
  num erro de e-mail duplicado (ou o usuário quer trocar o e-mail)
- **Quando** clica em "Usar outro e-mail" na tela de verificação de código
- **Então** o formulário de cadastro reabre com nome, e-mail, telefone, CPF
  e (motorista) nome da escola/endereço **preenchidos como antes**
- **E** os campos de senha e confirmar senha voltam **vazios** (nunca
  preenchidos de novo, por segurança)

### 9.9 — Alerta de confirmação de endereço após cadastro de aluno (P1)
- **Dado** um responsável cadastrando um novo aluno em "Meus alunos"
- **Quando** o cadastro é concluído com sucesso
- **Então** aparece o toast "Aluno adicionado." seguido de um aviso pra
  confirmar o endereço, e o modal de confirmação do pino no mapa abre
  automaticamente pro aluno recém-criado

### 9.10 — Sinalizador de período (turno) na lista de alunos do motorista (P2)
- **Dado** um vínculo ativo sem `periodo` definido ainda
- **Quando** o motorista abre `/motorista/vinculos`
- **Então** o card desse aluno mostra o selo "Período pendente" (âmbar)
- **Quando** o motorista define o período (Manhã/Tarde/Integral/Noite) no
  perfil do aluno
- **Então** o selo passa a mostrar o período escolhido

### 9.11 — Painel: previsão anual "Todos os meses" (P1)
- **Dado** um motorista com alunos vinculados com `vigenciaInicio`/
  `vigenciaFim` cadastrados
- **Quando** ele clica em "Ano todo" no Painel
- **Então** vê a soma prevista/recebida/pendente/atrasada dos 12 meses do
  ano, mês a mês, com os meses ainda não gerados marcados como "previsto"
- **E** um aluno cujo `vigenciaFim` já passou não entra na projeção dos
  meses seguintes ao fim da vigência
- **E** é possível navegar entre anos e voltar pra visão mensal

### 9.12 — Regressão: data de nascimento do aluno não sumia mais (P0)
- **Dado** um responsável cadastrando um aluno com data de nascimento
  preenchida
- **Quando** o cadastro é concluído
- **Então** a data de nascimento aparece na lista "Meus alunos" logo em
  seguida (não fica em branco)
- **E** ao abrir o perfil do aluno pelo lado do motorista
  (`/motorista/vinculos/[id]`), a mesma data aparece corretamente, sem
  deslocar um dia (ex.: nascido em 01/01 não pode aparecer como 31/12)

### 9.13 — Edição de vigência atualiza o Painel retroativamente (P1)
- **Dado** um vínculo ativo com mensalidade configurada
  (`valorMensalidade`/`diaPagamentoMensalidade`) mas sem nenhuma
  `MensalidadeTransporte` gerada ainda pra alguns meses passados
- **Quando** o motorista edita o perfil do aluno e define `vigenciaInicio`
  para um mês já passado
- **Então**, ao abrir o Painel nesse mês passado, os valores de entrada
  prevista/atrasada já aparecem — sem esperar o próximo corte do cron
- **Dado** (variação) um vínculo com mensalidades `PENDENTE` geradas pra
  meses futuros
- **Quando** o motorista edita `vigenciaFim` pra um mês anterior a esses
  meses futuros
- **Então** as mensalidades `PENDENTE` fora da nova janela de vigência são
  canceladas e somem da previsão do Painel (mensalidades já `PAGO` não são
  mexidas)

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
