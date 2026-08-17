import type { CapacitorConfig } from "@capacitor/cli";

// App nativo (Android/iOS) que carrega o site em produção de verdade
// dentro de um WebView — não é um bundle estático separado. Isso significa
// que TUDO que já existe (páginas, API routes, autenticação por cookie,
// cron jobs) continua funcionando exatamente igual, sem duplicar nada:
// o app é essencialmente uma "casca" nativa em volta do mesmo site que já
// roda na Vercel. Deploys no site refletem no app imediatamente, sem
// precisar publicar uma nova versão nas lojas (só muda quando for preciso
// alterar algo nativo — plugin, permissão, ícone etc.).
//
// appId: identificador reverso-de-domínio — fica praticamente permanente
// depois da primeira publicação numa loja (Google/Apple não deixam trocar
// depois). Confirme antes de publicar a primeira versão.
const config: CapacitorConfig = {
  appId: "br.com.helloinova.moove",
  appName: "Moove",
  webDir: "www",
  server: {
    // Aponta pro site real em produção — troque aqui se o domínio mudar.
    url: "https://app.mooveraster.com.br",
    androidScheme: "https",
    cleartext: false,
  },
  android: {
    allowMixedContent: false,
  },
  ios: {
    // Evita que o WebView tente usar o cache antigo depois de um deploy
    // novo no site — sempre busca a versão mais recente.
    limitsNavigationsToAppBoundDomains: false,
  },
};

export default config;
