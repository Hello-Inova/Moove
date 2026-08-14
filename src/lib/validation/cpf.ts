import { z } from "zod";

/**
 * Validação do dígito verificador do CPF (algoritmo oficial da Receita
 * Federal) — pega erro de digitação além de só checar o formato (11 dígitos
 * quaisquer passaria despercebido sem isso).
 */
export function cpfValido(valor: string): boolean {
  const cpf = valor.replace(/\D/g, "");
  if (cpf.length !== 11) return false;
  // CPFs com todos os dígitos iguais (111.111.111-11 etc.) passam na conta
  // do dígito verificador mas nunca são válidos de verdade.
  if (/^(\d)\1{10}$/.test(cpf)) return false;

  const digitos = cpf.split("").map(Number);

  let soma = 0;
  for (let i = 0; i < 9; i++) soma += digitos[i] * (10 - i);
  let resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== digitos[9]) return false;

  soma = 0;
  for (let i = 0; i < 10; i++) soma += digitos[i] * (11 - i);
  resto = (soma * 10) % 11;
  if (resto === 10 || resto === 11) resto = 0;
  if (resto !== digitos[10]) return false;

  return true;
}

/** Normaliza pra só dígitos e valida — usado no cadastro de motorista e
 * responsável, pra impedir a mesma pessoa se cadastrar mais de uma vez. */
export const cpfSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/\D/g, ""))
  .refine((v) => v.length === 11, "CPF inválido — use 11 dígitos.")
  .refine((v) => cpfValido(v), "CPF inválido — confira os números digitados.");

/** Formata dígitos de CPF como `000.000.000-00` enquanto a pessoa digita —
 * usado nos formulários de cadastro e de edição de perfil. */
export function formatarCpf(v: string): string {
  const d = v.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6)}`;
  return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
}
