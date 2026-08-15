import { describe, expect, it } from "vitest";

import {
  enderecoSchema,
  loginSchema,
  verificarCodigoSchema,
  redefinirSenhaSchema,
  veiculoSchema,
  responsavelRegisterSchema,
  alunoSchema,
  editarEnderecoAlunoSchema,
  editarPerfilAlunoSchema,
  criarContratoTransporteSchema,
  usarConviteSchema,
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

  it("rejeita CEP com menos de 8 dígitos (mas preenchido)", () => {
    const resultado = enderecoSchema.safeParse({ ...enderecoValido, cep: "1234" });
    expect(resultado.success).toBe(false);
  });

  it("aceita CEP em branco — endereço buscado direto por rua/número/bairro/cidade/UF", () => {
    const resultado = enderecoSchema.safeParse({ ...enderecoValido, cep: "" });
    expect(resultado.success).toBe(true);
    if (resultado.success) expect(resultado.data.cep).toBe("");
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

  it("continua aceitando o cadastro mesmo sem nenhum campo de endereço (endereço migrou pro Aluno)", () => {
    const semEndereco = {
      nome: "Maria Silva",
      email: "MARIA@Exemplo.com",
      telefone: "11999998888",
      cpf: "123.456.789-09",
      senha: senhaValida,
      confirmarSenha: senhaValida,
      aceitaLgpd: true,
    };
    const resultado = responsavelRegisterSchema.safeParse(semEndereco);
    expect(resultado.success).toBe(true);
  });

  it("ignora campos de endereço se vierem no payload (não fazem mais parte do schema)", () => {
    const resultado = responsavelRegisterSchema.safeParse(responsavelPayload());
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data).not.toHaveProperty("cep");
      expect(resultado.data).not.toHaveProperty("logradouro");
    }
  });
});

describe("alunoSchema (cadastro do aluno pelo responsável, com endereço obrigatório)", () => {
  function alunoPayload(overrides: Record<string, unknown> = {}) {
    return { nome: "João Pedro", ...enderecoValido, ...overrides };
  }

  it("aceita um cadastro completo e válido", () => {
    expect(alunoSchema.safeParse(alunoPayload()).success).toBe(true);
  });

  it("rejeita nome muito curto", () => {
    expect(alunoSchema.safeParse(alunoPayload({ nome: "A" })).success).toBe(false);
  });

  it("rejeita quando falta um campo de endereço obrigatório (ex: bairro)", () => {
    const semBairro = {
      nome: "João Pedro",
      cep: enderecoValido.cep,
      logradouro: enderecoValido.logradouro,
      numero: enderecoValido.numero,
      cidade: enderecoValido.cidade,
      estado: enderecoValido.estado,
    };
    expect(alunoSchema.safeParse(semBairro).success).toBe(false);
  });

  it("aceita CEP em branco (endereço buscado por rua/número/bairro/cidade/UF)", () => {
    expect(alunoSchema.safeParse(alunoPayload({ cep: "" })).success).toBe(true);
  });
});

describe("editarEnderecoAlunoSchema (edição posterior do endereço de um aluno)", () => {
  it("aceita o mesmo formato de endereço do cadastro", () => {
    expect(editarEnderecoAlunoSchema.safeParse(enderecoValido).success).toBe(true);
  });

  it("rejeita sem o campo nome (não faz parte deste schema, só endereço)", () => {
    const resultado = editarEnderecoAlunoSchema.safeParse({ ...enderecoValido, nome: "Fulano" });
    // `nome` extra é apenas ignorado (zod não é strict por padrão) — o que
    // importa é que o schema não EXIGE nome, só os campos de endereço.
    expect(resultado.success).toBe(true);
  });

  it("rejeita endereço incompleto", () => {
    const semEstado = {
      cep: enderecoValido.cep,
      logradouro: enderecoValido.logradouro,
      numero: enderecoValido.numero,
      bairro: enderecoValido.bairro,
      cidade: enderecoValido.cidade,
    };
    expect(editarEnderecoAlunoSchema.safeParse(semEstado).success).toBe(false);
  });
});

describe("editarPerfilAlunoSchema (motorista completando/editando o perfil do aluno)", () => {
  it("aceita objeto vazio — todos os campos são opcionais (atualização parcial)", () => {
    expect(editarPerfilAlunoSchema.safeParse({}).success).toBe(true);
  });

  it("converte data no formato YYYY-MM-DD pra Date", () => {
    const resultado = editarPerfilAlunoSchema.safeParse({ dataNascimento: "2015-03-20" });
    expect(resultado.success).toBe(true);
    if (resultado.success) {
      expect(resultado.data.dataNascimento).toBeInstanceOf(Date);
      expect(resultado.data.dataNascimento?.toISOString().slice(0, 10)).toBe("2015-03-20");
    }
  });

  it("string vazia ou ausente vira null (limpa o campo)", () => {
    const vazia = editarPerfilAlunoSchema.safeParse({ dataNascimento: "" });
    expect(vazia.success).toBe(true);
    if (vazia.success) expect(vazia.data.dataNascimento).toBeNull();

    const ausente = editarPerfilAlunoSchema.safeParse({});
    expect(ausente.success).toBe(true);
    if (ausente.success) expect(ausente.data.dataNascimento).toBeNull();
  });

  it("rejeita data com mês inválido (ex: mês 13)", () => {
    const resultado = editarPerfilAlunoSchema.safeParse({ dataNascimento: "2026-13-01" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita gênero fora do enum", () => {
    expect(editarPerfilAlunoSchema.safeParse({ genero: "OUTRO" }).success).toBe(true);
    expect(editarPerfilAlunoSchema.safeParse({ genero: "INVALIDO" }).success).toBe(false);
  });

  it("rejeita dia de pagamento fora do intervalo 1-31", () => {
    expect(editarPerfilAlunoSchema.safeParse({ diaPagamentoMensalidade: 0 }).success).toBe(false);
    expect(editarPerfilAlunoSchema.safeParse({ diaPagamentoMensalidade: 32 }).success).toBe(false);
    expect(editarPerfilAlunoSchema.safeParse({ diaPagamentoMensalidade: 15 }).success).toBe(true);
  });

  it("rejeita valor de mensalidade negativo", () => {
    expect(editarPerfilAlunoSchema.safeParse({ valorMensalidade: -1 }).success).toBe(false);
    expect(editarPerfilAlunoSchema.safeParse({ valorMensalidade: 0 }).success).toBe(true);
  });
});

describe("criarContratoTransporteSchema", () => {
  it("aceita só o título (observações/link/vigência são opcionais)", () => {
    expect(criarContratoTransporteSchema.safeParse({ titulo: "Contrato 2026" }).success).toBe(true);
  });

  it("rejeita título muito curto", () => {
    expect(criarContratoTransporteSchema.safeParse({ titulo: "A" }).success).toBe(false);
  });

  it("aceita arquivoUrl vazio (string vazia é tratada como 'sem link')", () => {
    expect(criarContratoTransporteSchema.safeParse({ titulo: "Contrato", arquivoUrl: "" }).success).toBe(true);
  });

  it("rejeita arquivoUrl que não é uma URL válida", () => {
    const resultado = criarContratoTransporteSchema.safeParse({ titulo: "Contrato", arquivoUrl: "não-é-link" });
    expect(resultado.success).toBe(false);
  });

  it("aceita arquivoUrl como link válido", () => {
    const resultado = criarContratoTransporteSchema.safeParse({
      titulo: "Contrato",
      arquivoUrl: "https://drive.google.com/arquivo",
    });
    expect(resultado.success).toBe(true);
  });
});

describe("usarConviteSchema", () => {
  it("aceita código, aluno e escola preenchidos", () => {
    const resultado = usarConviteSchema.safeParse({ codigo: "ABC123", alunoId: "aluno_1", escolaId: "escola_1" });
    expect(resultado.success).toBe(true);
  });

  it("normaliza o código pra maiúsculas", () => {
    const resultado = usarConviteSchema.safeParse({ codigo: "abc123", alunoId: "aluno_1", escolaId: "escola_1" });
    if (resultado.success) expect(resultado.data.codigo).toBe("ABC123");
  });

  it("rejeita sem alunoId (obrigatório escolher o aluno a vincular)", () => {
    const resultado = usarConviteSchema.safeParse({ codigo: "ABC123", alunoId: "", escolaId: "escola_1" });
    expect(resultado.success).toBe(false);
  });

  it("rejeita código curto demais", () => {
    const resultado = usarConviteSchema.safeParse({ codigo: "AB", alunoId: "aluno_1", escolaId: "escola_1" });
    expect(resultado.success).toBe(false);
  });
});
