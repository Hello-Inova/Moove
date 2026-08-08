import { z } from "zod";

const senha = z
  .string()
  .min(8, "A senha deve ter no mínimo 8 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.");

const telefone = z
  .string()
  .trim()
  .min(8, "Telefone inválido.")
  .max(20, "Telefone inválido.");

export const motoristaRegisterSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome completo."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    telefone,
    senha,
    confirmarSenha: z.string().min(1, "Repita a senha."),
    aceitaLgpd: z.literal(true, {
      message: "É necessário aceitar o tratamento de dados (LGPD) para criar a conta.",
    }),
  })
  .refine((data) => data.senha === data.confirmarSenha, {
    message: "As senhas não coincidem.",
    path: ["confirmarSenha"],
  });

export const responsavelRegisterSchema = z
  .object({
    nome: z.string().trim().min(2, "Informe o nome completo."),
    email: z.string().trim().toLowerCase().email("E-mail inválido."),
    telefone,
    senha,
    confirmarSenha: z.string().min(1, "Repita a senha."),
    aceitaLgpd: z.literal(true, {
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

export const usarConviteSchema = z.object({
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .min(6, "Código de convite inválido."),
});

export const atualizarLocalizacaoSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const criarCheckoutAssinaturaSchema = z.object({
  tipoPlano: z.string().trim().min(1, "Selecione um plano."),
  qtdAlunos: z.number().int().min(1, "Informe pelo menos 1 aluno.").max(2000, "Quantidade de alunos inválida."),
  anosAdicionais: z.number().int().min(0).max(20).optional(),
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
