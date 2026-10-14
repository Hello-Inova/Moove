import Link from "next/link";

export const metadata = { title: "Termos de Uso — Moove" };

export default function TermosPage() {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-neutral-800 dark:text-neutral-200 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed">
    <Link href="/" className="text-sm underline">Voltar à Moove</Link>
    <h1 className="mt-4 text-3xl font-bold text-brand-navy dark:text-white">Termos de Uso</h1>
    <p>Última atualização: 13 de outubro de 2026.</p>
    <h2>1. Serviço</h2><p>A Moove oferece recursos de organização e acompanhamento de transporte escolar. A localização exibida depende da autorização e da conexão do motorista; não substitui comunicação direta em situações urgentes.</p>
    <h2>2. Contas e uso responsável</h2><p>Você deve fornecer dados corretos, manter sua senha em sigilo e usar a plataforma somente para vínculos de transporte legítimos. É proibido tentar acessar contas, dados ou rotas sem autorização.</p>
    <h2>3. Localização e alertas</h2><p>O motorista decide quando compartilhar a localização. Alertas de chegada e de “a caminho” são estimativas e podem variar por trânsito, sinal de GPS e rede móvel.</p>
    <h2>4. Segurança</h2><p>Podemos limitar, suspender ou encerrar acessos diante de indício de fraude, abuso ou risco à segurança. Reporte qualquer uso indevido pelos canais oficiais de suporte.</p>
    <h2>5. Privacidade</h2><p>O tratamento de dados segue a <Link href="/privacidade" className="underline">Política de Privacidade</Link>. Ao criar uma conta, você confirma a leitura destes termos.</p>
  </main>;
}
