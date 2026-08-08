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

export const motoristaRegisterSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone,
  senha,
  aceitaLgpd: z.literal(true, {
    message: "É necessário aceitar o tratamento de dados (LGPD) para criar a conta.",
  }),
});

export const responsavelRegisterSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome completo."),
  email: z.string().trim().toLowerCase().email("E-mail inválido."),
  telefone,
  senha,
  aceitaLgpd: z.literal(true, {
    message: "É necessário aceitar o tratamento de dados (LGPD) para criar a conta.",
  }),
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
  tipoPlano: z.enum(["BASIC", "PRO", "MAX"]),
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
