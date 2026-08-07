/**
 * Job de fechamento mensal de cobrança. Pensado para rodar via cron externo
 * (ex: `0 3 1 * *` — todo dia 1 às 03:00) fora do runtime do Next.js:
 *
 *   npm run job:fechamento-mensal
 *   npm run job:fechamento-mensal -- 2026-07   (referência de mês específica)
 *
 * A mesma lógica também é exposta como rota HTTP em
 * `/api/cron/fechamento-mensal` para uso com Vercel Cron ou outro agendador
 * baseado em HTTP — ver src/app/api/cron/fechamento-mensal/route.ts.
 */
import { executarFechamentoMensal } from "@/lib/billing/service";
import { prisma } from "@/lib/prisma";

async function main() {
  const referenciaMes = process.argv[2];
  const resumo = await executarFechamentoMensal(referenciaMes);

  console.log(`Fechamento mensal — referência ${resumo.referenciaMes}`);
  console.log(`  motoristas processados: ${resumo.motoristasProcessados}`);
  console.log(`  cobranças geradas:      ${resumo.cobrancasGeradas}`);
  console.log(`  já existentes (pulado): ${resumo.cobrancasJaExistentes}`);
  if (resumo.falhas.length > 0) {
    console.error(`  falhas: ${resumo.falhas.length}`);
    for (const falha of resumo.falhas) {
      console.error(`    - motorista ${falha.motoristaId}: ${falha.erro}`);
    }
    process.exitCode = 1;
  }
}

main()
  .catch((err) => {
    console.error("Falha ao executar o fechamento mensal:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
