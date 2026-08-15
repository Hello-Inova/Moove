import { NextRequest, NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

// ---------------------------------------------------------------------------
// Endpoint de uso manual (não é chamado por nenhuma tela do sistema) — roda
// em produção a mesma lógica do script `scripts/gerar-cobranca-teste.ts`,
// pra quando não dá pra rodar o script localmente contra o banco de
// produção (ex.: DATABASE_URL marcada como "Sensitive" na Vercel, que fica
// impossível de reler depois de criada).
//
// Protegido por DEBUG_TEST_SECRET (variável de ambiente separada, escolhida
// por quem for usar — não reaproveita CRON_SECRET pra não precisar saber um
// segredo que também pode estar marcado como sensitive).
//
// Uso (definir DEBUG_TEST_SECRET na Vercel antes, ambiente Production, e
// fazer um novo deploy pra ela valer):
//   curl -H "Authorization: Bearer SEU_SEGREDO" \
//     "https://moove-eosin.vercel.app/api/debug/gerar-cobranca-teste?email=motorista@exemplo.com"
//
// Recomendado remover esta rota depois de terminar os testes.
// ---------------------------------------------------------------------------

function autenticado(request: NextRequest): boolean {
  const secret = process.env.DEBUG_TEST_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

function diasAtras(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}

export async function GET(request: NextRequest) {
  if (!autenticado(request)) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const email = request.nextUrl.searchParams.get("email");
  if (!email) {
    return NextResponse.json({ error: "Informe ?email=motorista@exemplo.com" }, { status: 400 });
  }

  const motorista = await prisma.motorista.findUnique({ where: { email } });
  if (!motorista) {
    return NextResponse.json({ error: `Nenhum motorista encontrado com o e-mail ${email}` }, { status: 404 });
  }

  const assinatura = await prisma.assinatura.findFirst({
    where: { motoristaId: motorista.id, status: "ATIVA" },
    orderBy: { criadoEm: "desc" },
  });

  let vinculo = await prisma.vinculo.findFirst({
    where: { motoristaId: motorista.id, status: "ATIVO" },
    orderBy: { criadoEm: "asc" },
    include: { aluno: true },
  });

  let criado = false;

  if (!vinculo) {
    criado = true;
    const sufixo = Date.now();

    const responsavel = await prisma.responsavel.create({
      data: {
        nome: "Responsável Teste",
        email: `responsavel.teste.${sufixo}@example.com`,
        telefone: "11999999999",
        senhaHash: "!",
        consentimentoLgpdAceitoEm: new Date(),
        testeExpiraEm: diasAtras(-7),
      },
    });

    const aluno = await prisma.aluno.create({
      data: { responsavelId: responsavel.id, nome: "Aluno Teste" },
    });

    const convite = await prisma.convite.create({
      data: {
        codigo: `TESTE${sufixo}`,
        motoristaId: motorista.id,
        status: "USADO",
        expiraEm: diasAtras(-7),
        usadoPorResponsavelId: responsavel.id,
        usadoEm: diasAtras(35),
      },
    });

    const escola = await prisma.escola.findFirst({ where: { motoristaId: motorista.id } });

    vinculo = await prisma.vinculo.create({
      data: {
        motoristaId: motorista.id,
        responsavelId: responsavel.id,
        alunoId: aluno.id,
        escolaId: escola?.id ?? null,
        conviteId: convite.id,
        status: "ATIVO",
        criadoEm: diasAtras(35),
        proximaCobrancaEm: diasAtras(5),
      },
      include: { aluno: true },
    });
  } else {
    vinculo = await prisma.vinculo.update({
      where: { id: vinculo.id },
      data: { criadoEm: diasAtras(35), proximaCobrancaEm: diasAtras(5) },
      include: { aluno: true },
    });
  }

  const valor = assinatura ? Number(assinatura.valorPorAlunoExcedente) : 5;

  const cobranca = await prisma.cobrancaAluno.create({
    data: {
      vinculoId: vinculo.id,
      motoristaId: motorista.id,
      cicloInicio: diasAtras(35),
      cicloFim: diasAtras(5),
      valor,
      status: "PENDENTE",
    },
  });

  return NextResponse.json({
    ok: true,
    vinculoCriadoAgora: criado,
    aluno: vinculo.aluno.nome,
    vinculoId: vinculo.id,
    cobrancaId: cobranca.id,
    valor,
    assinaturaAtivaEncontrada: Boolean(assinatura),
  });
}
