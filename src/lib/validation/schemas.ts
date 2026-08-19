import { z } from "zod";

import { cpfSchema } from "@/lib/validation/cpf";

const senha = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.");

const telefone = z
  .string()
  .trim()
  .min(8, "Telefone inválido.")
  .max(20, "Telefone inválido.");

// CEP é opcional — serve só de atalho pra autopreencher rua/bairro/cidade/UF
// (ver EnderecoFields.tsx, autocomplete via ViaCEP). Quem preferir (ou não
// souber o CEP) pode preencher rua/número/bairro/cidade/UF direto; a
// geocodificação (src/lib/geocoding.ts) já busca por esses campos
// estruturados mesmo sem CEP, então não há motivo pra exigi-lo.
const cep = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 0 || v.length === 8, "CEP inválido — use 8 dígitos, ou deixe em branco.");

const enderecoCampos = {
  cep,
  logradouro: z.string().trim().min(2, "Informe a rua/avenida."),
  numero: z.string().trim().min(1, "Informe o número."),
  complemento: z.string().trim().max(80).optional(),
  bairro: z.string().trim().min(1, "Informe o bairro."),
  cidade: z.string().trim().min(1, "Informe a cidade."),
  estado: z.string().trim().length(2, "UF inválida.").toUpperCase(),
};

/** Endereço usado tanto no cadastro do responsável quanto na tela de
 * "Meu endereço" (edição posterior) — é a partir dele que a rota do
 * motorista geocodifica a parada. */
export const enderecoSchema = z.object(enderecoCampos);

export const motoristaRegisterSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome completo."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    telefone,
    cpf: cpfSchema,
    senha,
    confirmarSenha: z.string().min(1, "Repita a senha."),
    // Escola inicial que o motorista atende — obrigatória no cadastro; ele
    // pode cadastrar outras depois em "Minhas escolas" (motorista pode
    // atender mais de uma).
    nomeEscola: z.string().trim().min(2, "Informe o nome da escola."),
    ...enderecoCampos,
    // `z.literal(true, { message })` não aplica a mensagem customizada
    // pro código `invalid_literal` nesta versão do zod (fica com o texto
    // padrão em inglês, "Invalid literal value, expected true") — por
    // isso usa `.boolean().refine(...)`, que sempre respeita `message`.
    aceitaLgpd: z.boolean().refine((v) => v === true, {
      message: "Você deve ler e concordar com o tratamento de dados no Moove.",
    }),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

// O responsável NÃO cadastra endereço aqui — cada filho pode ter um
// endereço de embarque/desembarque diferente (ver Aluno no schema), então o
// endereço é cadastrado depois, por aluno, no fluxo "Meus alunos" (ver
// alunoSchema mais abaixo).
export const responsavelRegisterSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome completo."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    telefone,
    cpf: cpfSchema,
    senha,
    confirmarSenha: z.string().min(1, "Repita a senha."),
    // Ver comentário equivalente em motoristaRegisterSchema — z.literal com
    // `message` não pega pro código invalid_literal nesta versão do zod.
    aceitaLgpd: z.boolean().refine((v) => v === true, {
      message: "É necessário aceitar o tratamento de dados (LGPD) para criar a conta.",
    }),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
});

export const verificarCodigoSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  codigo: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "Código inválido. Digite os 6 números recebidos por e-mail."),
});

export const reenviarCodigoSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  proposito: z.enum(["CADASTRO", "LOGIN"]),
});

export const recuperarSenhaSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
});

export const redefinirSenhaSchema = z
  .object({
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    codigo: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Código inválido. Digite os 6 números recebidos por e-mail."),
    novaSenha: senha,
    confirmarNovaSenha: z.string().min(1, "Repita a nova senha."),
  })
  .refine((data) => data.novaSenha === data.confirmarNovaSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarNovaSenha"],
  });

const placaRegex = /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/; // Mercosul ou padrão antigo (LLLNLNN / LLLNNNN)

export const veiculoSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => placaRegex.test(v), "Placa inválida. Use o formato ABC1D23 ou ABC1234."),
  modelo: z.string().trim().min(2, "Informe o modelo do veículo."),
});

export const gerarConviteSchema = z.object({
  // Convite é vinculado a um veículo específico do motorista? O modelo de
  // dados especificado liga o Convite apenas ao motorista, então o convite
  // vale para qualquer um dos veículos dele no momento em que o vínculo é
  // consultado. Nenhum campo de entrada é necessário para gerar.
  observacao: z.string().trim().max(200).optional(),
});

export const validarConviteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Código de convite inválido."),
});

export const usarConviteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Código de convite inválido."),
  alunoId: z.string().trim().min(1, "Selecione o aluno."),
  escolaId: z.string().trim().min(1, "Selecione a escola."),
});

// Data no formato "YYYY-MM-DD" (vem de <input type="date">) — vazio/ausente
// vira null (limpa o campo), string transforma em Date. `refine` evita
// datas absurdas tipo "2026-13-99" passarem como Date inválida silenciosa.
const dataOpcional = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((v) => (v ? new Date(`${v}T00:00:00`) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Data inválida.");

const generoAlunoOpcional = z.enum(["MASCULINO", "FEMININO", "OUTRO"]).optional().nullable();

// Endereço obrigatório no cadastro do aluno — é dele que a rota do
// motorista parte (ver GET /api/motorista/rota). Cada aluno de um mesmo
// responsável pode ter um endereço diferente (irmãos em escolas/casas
// diferentes), por isso o endereço vive aqui e não mais em Responsavel.
// Nascimento/gênero são opcionais aqui — o responsável pode preenchê-los já
// no cadastro ou deixar pro motorista completar depois na tela de perfil do
// aluno (ver editarPerfilAlunoSchema logo abaixo, mesmos dois campos).
export const alunoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do aluno.").max(120),
  dataNascimento: dataOpcional,
  genero: generoAlunoOpcional,
  ...enderecoCampos,
});

// Usado só pra editar o endereço de um aluno já existente (reaproveita os
// mesmos campos/validações do cadastro).
export const editarEnderecoAlunoSchema = z.object(enderecoCampos);

// Usada pela tela de perfil do aluno (motorista) — completa dados que o
// responsável pode não ter preenchido no cadastro (nascimento/gênero) e
// configura o que é exclusivo do motorista: período/escola dessa rota e os
// termos da mensalidade do transporte (ver Vinculo no schema). Todos os
// campos são opcionais individualmente — a mesma rota aceita atualização
// parcial de qualquer seção do perfil.
export const editarPerfilAlunoSchema = z.object({
  dataNascimento: dataOpcional,
  genero: generoAlunoOpcional,
  periodo: z.enum(["MANHA", "TARDE", "INTEGRAL", "NOITE"]).optional().nullable(),
  escolaId: z.string().trim().optional().nullable(),
  valorMensalidade: z.number().min(0, "Valor inválido.").max(1_000_000).optional().nullable(),
  diaPagamentoMensalidade: z.number().int().min(1, "Dia inválido.").max(31, "Dia inválido.").optional().nullable(),
  vigenciaInicio: dataOpcional,
  vigenciaFim: dataOpcional,
});

export const criarContratoTransporteSchema = z.object({
  titulo: z.string().trim().min(2, "Informe um título.").max(120),
  observacoes: z.string().trim().max(2000).optional().nullable(),
  arquivoUrl: z
    .union([z.string().trim().url("Link inválido — cole a URL completa (https://...)."), z.literal("")])
    .optional()
    .nullable(),
  vigenciaInicio: dataOpcional,
  vigenciaFim: dataOpcional,
});

export const escolaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da escola.").max(120),
  ...enderecoCampos,
});

export const atualizarLocalizacaoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().trim().url("Inscrição de push inválida."),
  keys: z.object({
    p256dh: z.string().trim().min(1),
    auth: z.string().trim().min(1),
  }),
});

export const pushUnsubscribeSchema = z.object({
  endpoint: z.string().trim().url("Inscrição de push inválida."),
});

export const alertaChegadaSchema = z.object({
  alertaChegadaMinutos: z.number().int().min(1, "Mínimo de 1 minuto.").max(30, "Máximo de 30 minutos."),
});

export const criarCheckoutAssinaturaSchema = z.object({
  tipoPlano: z.string().trim().min(1, "Selecione um plano."),
  anosAdicionais: z.number().int().min(0).max(20).optional(),
});

// Usado pela tela "Editar perfil" (motorista e responsável) — todos os
// campos são opcionais individualmente porque a mesma rota também recebe
// atualizações parciais (ex: PixKeyForm.tsx manda só `chavePix`). E-mail
// fica de fora de propósito: mudar o e-mail exigiria reverificação (é ele
// que autentica o login), fora do escopo desta tela.
export const atualizarPerfilSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome completo.").optional(),
    telefone: telefone.optional(),
    cpf: cpfSchema.optional(),
    // Texto livre de propósito — chave PIX pode ser CPF/CNPJ, e-mail,
    // telefone ou chave aleatória (UUID); não vale a pena validar formato
    // específico aqui. É a chave que o motorista usa pra receber o
    // pagamento do transporte direto das famílias (a cobrança por aluno
    // excedente da plataforma é separada e paga via Asaas — ver
    // src/lib/subscription/cobranca-aluno-pagamento.ts). Só existe pro
    // motorista, mas não custa aceitar no schema compartilhado.
    chavePix: z.string().trim().max(140, "Chave PIX muito longa.").optional().nullable(),
    senhaAtual: z.string().optional(),
    novaSenha: senha.optional(),
    confirmarNovaSenha: z.string().optional(),
  })
  .refine((data) => !data.novaSenha || data.novaSenha === data.confirmarNovaSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarNovaSenha"],
  })
  .refine((data) => !data.novaSenha || !!data.senhaAtual, {
    message: "Informe a senha atual para definir uma nova.",
    path: ["senhaAtual"],
  });

export const buscarPlacaSchema = z.object({
  placa: z
    .string()
    .trim()
    .toUpperCase()
    .transform((v) => v.replace(/[\s-]/g, ""))
    .refine((v) => v.length >= 6, "Placa inválida."),
});

export const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  senha: z.string().min(1, "Informe a senha."),
});

export const atualizarStatusContaSchema = z.object({
  statusConta: z.enum(["ATIVA", "SUSPENSA"]),
});

// Isenção de cobrança (ver comentário em Motorista.isentoCobranca no
// schema) — só motorista tem esse campo hoje.
export const atualizarIsencaoSchema = z.object({
  isento: z.boolean(),
});

export const forcarAssinaturaSchema = z.object({
  tipoPlano: z.string().trim().min(1, "Selecione um plano."),
});

const codigoPlanoRegex = /^[A-Z0-9_-]{2,40}$/;

export const planoAdminSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(codigoPlanoRegex, "Use só letras maiúsculas, números, hífen ou underscore (2 a 40 caracteres)."),
  label: z.string().trim().min(1, "Informe o nome do plano.").max(60),
  publico: z.enum(["MOTORISTA", "RESPONSAVEL"]).default("MOTORISTA"),
  ciclo: z.enum(["MENSAL", "SEMESTRAL", "ANUAL"]),
  cicloLabel: z.string().trim().min(1, "Informe o rótulo do ciclo de cobrança.").max(60),
  valorBase: z.number().min(0, "Valor inválido.").max(1_000_000),
  alunosGratis: z.number().int().min(0).max(100_000),
  valorPorAlunoExcedente: z.number().min(0).max(100_000),
  recursos: z.array(z.string().trim().min(1)).max(20).default([]),
  permiteAnosAdicionais: z.boolean().default(false),
  destaque: z.string().trim().max(40).optional().nullable(),
  ativo: z.boolean().default(true),
  ordem: z.number().int().min(0).max(1000).optional(),
});

export const planoAtivoSchema = z.object({
  ativo: z.boolean(),
});
