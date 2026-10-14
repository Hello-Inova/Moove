import Link from "next/link";

export const metadata = { title: "Política de Cookies — Moove" };

export default function CookiesPage() {
  return <main className="mx-auto w-full max-w-2xl flex-1 px-4 py-12 text-neutral-800 dark:text-neutral-200 [&_h2]:mt-7 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mt-2 [&_p]:leading-relaxed">
    <Link href="/" className="text-sm underline">Voltar à Moove</Link>
    <h1 className="mt-4 text-3xl font-bold text-brand-navy dark:text-white">Política de Cookies</h1>
    <p>Última atualização: 13 de outubro de 2026.</p>
    <h2>Cookies e armazenamento essenciais</h2><p>São usados para autenticação, proteção contra abuso, preferência de tema e registro da sua escolha de cookies. Sem eles, partes essenciais do sistema não funcionam.</p>
    <h2>Cookies opcionais</h2><p>A Moove não ativa cookies opcionais sem sua escolha. Caso sejam adicionados recursos de análise ou medição no futuro, eles dependerão de autorização prévia e poderão ser recusados sem impedir o uso do serviço.</p>
    <h2>Como alterar sua escolha</h2><p>Você pode limpar os dados do site no navegador para exibir novamente o aviso de preferências. Consulte também a <Link href="/privacidade" className="underline">Política de Privacidade</Link>.</p>
  </main>;
}
