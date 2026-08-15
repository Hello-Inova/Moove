// Script de teste (uso manual, não roda em produção sozinho) — "envelhece"
// um vínculo de aluno pra mais de 30 dias e cria uma CobrancaAluno PENDENTE
// pra ele, pra dar pra testar a tela "Alunos" do motorista sem precisar
// esperar o cron diário (/api/cron/cobrancas-aluno) rodar de verdade.
//
// Uso:
//   npx tsx scripts/gerar-cobranca-teste.ts --email=motorista@exemplo.com
//
// Se o motorista já tiver algum vínculo ATIVO, reaproveita o mais antigo
// deles (atualiza `criadoEm`/`proximaCobrancaEm`). Se não tiver nenhum,
// cria um responsável + aluno + convite + vínculo de teste do zero, já
// vinculados a esse motorista.
//
// Roda contra o banco apontado pela DATABASE_URL do seu .env local — tome
// cuidado se isso apontar pra produção.

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function diasAtras(dias: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return d;
}

async function main() {
  const emailArg = process.argv.find((a) => a.startsWith("--email="))?.split("=")[1];

  if (!emailArg) {
    console.error("Uso: npx tsx scripts/gerar-cobranca-teste.ts --email=motorista@exemplo.com\n");
    const motoristas = await prisma.motorista.findMany({ select: { email: true, nome: true } });
    console.log("Motoristas cadastrados:");
    motoristas.forEach((m) => console.log(` - ${m.nome} <${m.email}>`));
    process.exit(1);
  }

  const motorista = await prisma.motorista.findUnique({ where: { email: emailArg } });
  if (!motorista) {
    console.error(`Nenhum motorista encontrado com o e-mail ${emailArg}`);
    process.exit(1);
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

  if (!vinculo) {
    console.log("Esse motorista ainda não tem nenhum vínculo — criando um responsável/aluno de teste...");

    const sufixo = Date.now();
    const responsavel = await prisma.responsavel.create({
      data: {
        nome: "Responsável Teste",
        email: `responsavel.teste.${sufixo}@example.com`,
        telefone: "11999999999",
        senhaHash: "!", // conta de teste, sem senha válida — não serve pra login
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

  console.log("\nPronto!");
  console.log(
    `Vínculo: ${vinculo.aluno.nome} (id ${vinculo.id}) — criado em ${vinculo.criadoEm.toLocaleDateString("pt-BR")}`
  );
  console.log(`Cobrança pendente criada: R$ ${valor.toFixed(2)} (id ${cobranca.id})`);
  console.log(`\nAbra /motorista/vinculos logado como ${motorista.email} pra ver.`);

  if (!assinatura) {
    console.log(
      "\nObs: esse motorista não tem assinatura ATIVA agora, então usei um valor de exemplo (R$ 5,00) — o valor real depende do plano contratado."
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
