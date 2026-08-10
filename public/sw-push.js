// Service worker só para o alerta sonoro de proximidade (Web Push). É
// intencionalmente mínimo — não faz cache de páginas nem funciona offline,
// só escuta eventos "push" e mostra a notificação. Precisa ficar na raiz
// pública (não em /alguma/pasta) pra ter escopo do site inteiro.

self.addEventListener("push", (event) => {
  let dados = { title: "Moove", body: "O transporte está chegando." };
  try {
    if (event.data) dados = event.data.json();
  } catch {
    // payload não era JSON — usa o texto cru como corpo, ou mantém o padrão.
    if (event.data) dados.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(dados.title || "Moove", {
      body: dados.body,
      // O ícone deve existir em /public — reaproveita o mesmo já usado nos
      // marcadores do mapa (evita depender de um asset novo aqui).
      icon: "/leaflet/marker-icon-2x.png",
      tag: dados.tag,
      // `vibrate` ajuda a notificação a se destacar em celulares Android
      // (o som em si é o som padrão de notificação do sistema — a Web
      // Notification API não permite mais tocar um áudio customizado).
      vibrate: [200, 100, 200],
      requireInteraction: true,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/responsavel/dashboard"));
});
