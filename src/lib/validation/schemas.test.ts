import { describe, expect, it } from "vitest";

import {
  enderecoSchema,
  loginSchema,
  verificarCodigoSchema,
  redefinirSenhaSchema,
  veiculoSchema,
  responsavelRegisterSchema,
} from "@/lib/validation/schemas";

const enderecoValido = {
  cep: "01310-100",
  logradouro: "Av. Paulista",
  numero: "1000",
  bairro: "Bela Vista",
  cidade: "São Paulo",
  estado: "sp",
};

const senhaValida = "senhaForte123";

function responsavelPayload(overrides: Record<string, unknown> = {}) {
  return {
    nome: "Maria Silva",
    email: "MARIA@Exemplo.com",
    telefone: "11999998888",
    cpf: "123.456.789-09",
    senha: senhaValida,
    confirmarSenha: senhaValida,
    ...enderecoValido,
    aceitaLgpd: true,
    ...overrides,
  };
}

describe("enderecoSchema / CEP", () => {
  it("normaliza CEP removendo pontuação", () => {
    const resultado = enderecoSchema.safeParse(enderecoValido);
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cep).toBe("01310100");
  });

  it("rejeita CEP com menos de 8 dígitos", () => {
    const resultado = enderecoSchema.safeParse({ ...enderecoValido, cep: "1234" });
    expect(resultado.success).toBe(false);
  });

  it("converte UF para maiúsculas", () => {
    const resultado = enderecoSchema.safeParse(enderecoValido);
    if (resultado.success) expect(resultado.data.estado).toBe("SP");
  });
});

describe("loginSchema", () => {
  it("normaliza e-mail (trim + lowercase)", () => {
    const resultado = loginSchema.safeParse({ email: "  Fulano@Exemplo.COM  ", senha: "qualquer" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.email).toBe("fulano@exemplo.com");
  });

  it("rejeita e-mail inválido", () => {
    expect(loginSchema.safeParse({ email: "não-é-email", senha: "x" }).success).toBe(false);
  });

  it("rejeita senha vazia", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", senha: "" }).success).toBe(false);
  });
});

describe("verificarCodigoSchema", () => {
  it("aceita código de 6 dígitos", () => {
    expect(verificarCodigoSchema.safeParse({ email: "a@b.com", codigo: "123456" }).success).toBe(true);
  });

  it("rejeita código com letras ou tamanho errado", () => {
    expect(verificarCodigoSchema.safeParse({ email: "a@b.com", codigo: "12a456" }).success).toBe(false);
    expect(verificarCodigoSchema.safeParse({ email: "a@b.com", codigo: "12345" }).success).toBe(false);
  });
});

describe("redefinirSenhaSchema (recuperação de senha)", () => {
  it("aceita quando a nova senha e a confirmação coincidem", () => {
    const resultado = redefinirSenhaSchema.safeParse({
      email: "a@b.com",
      codigo: "123456",
      novaSenha: "novaSenhaForte1",
      confirmarNovaSenha: "novaSenhaForte1",
    });
    expect(resultado.success).toBe(true);
  });

  it("rejeita quando a confirmação não bate com a nova senha", () => {
    const resultado = redefinirSenhaSchema.safeParse({
      email: "a@b.com",
      codigo: "123456",
      novaSenha: "novaSenhaForte1",
      confirmarNovaSenha: "outraSenha",
    });
    expect(resultado.success).toBe(false);
    if (!resultado.success) {
      expect(resultado.error.flatten().fieldErrors.confirmarNovaSenha).toBeTruthy();
    }
  });

  it("rejeita nova senha menor que 8 caracteres", () => {
    const resultado = redefinirSenhaSchema.safeParse({
      email: "a@b.com",
      codigo: "123456",
      novaSenha: "curta",
      confirmarNovaSenha: "curta",
    });
    expect(resultado.success).toBe(false);
  });
});

describe("veiculoSchema (placa)", () => {
  it("aceita placa no padrão antigo (LLLNNNN)", () => {
    expect(veiculoSchema.safeParse({ placa: "abc1234", modelo: "Sprinter" }).success).toBe(true);
  });

  it("aceita placa no padrão Mercosul (LLLNLNN)", () => {
    expect(veiculoSchema.safeParse({ placa: "abc1d23", modelo: "Sprinter" }).success).toBe(true);
  });

  it("rejeita placa em formato inválido", () => {
    expect(veiculoSchema.safeParse({ placa: "123ABCD", modelo: "Sprinter" }).success).toBe(false);
  });
});

describe("responsavelRegisterSchema (fluxo crítico de cadastro)", () => {
  it("aceita um cadastro completo e válido", () => {
    const resultado = responsavelRegisterSchema.safeParse(responsavelPayload());
    expect(resultado.success).toBe(true);
  });

  it("rejeita quando senha e confirmarSenha não coincidem", () => {
    const resultado = responsavelRegisterSchema.safeParse(
      responsavelPayload({ confirmarSenha: "outraSenha123" })
    );
    expect(resultado.success).toBe(false);
  });

  it("rejeita CPF inválido", () => {
    const resultado = responsavelRegisterSchema.safeParse(responsavelPayload({ cpf: "111.111.111-11" }));
    expect(resultado.success).toBe(false);
  });

  it("rejeita quando LGPD não foi aceito", () => {
    const resultado = responsavelRegisterSchema.safeParse(responsavelPayload({ aceitaLgpd: false }));
    expect(resultado.success).toBe(false);
  });
});
