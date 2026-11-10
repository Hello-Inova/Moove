"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Headphones, X } from "lucide-react";

type Chamado = { id: string; numero: number; status: "ABERTO" | "RECEBIDO" | "ENCERRADO"; criadoEm: string };

const STATUS = { ABERTO: "Aberto", RECEBIDO: "Recebido", ENCERRADO: "Encerrado" };

export function SuporteButton({ nome: nomeCadastrado, whatsapp: whatsappCadastrado }: { nome: string; whatsapp: string }) {
  const [aberto, setAberto] = useState(false);
  const [nome] = useState(nomeCadastrado);
  const [whatsapp] = useState(whatsappCadastrado);
  const [descricao, setDescricao] = useState("");
  const [chamados, setChamados] = useState<Chamado[]>([]);
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (!aberto) return;
    fetch("/api/suporte/chamados").then((r) => r.ok ? r.json() : null).then((data) => {
      if (!data) return;
      setChamados(data.chamados ?? []);
    });
  }, [aberto]);

  async function enviar() {
    setErro(""); setEnviando(true);
    const r = await fetch("/api/suporte/chamados", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ nome, whatsapp, descricao }) });
    const data = await r.json().catch(() => null);
    setEnviando(false);
    if (!r.ok) return setErro(data?.error ?? "Não foi possível enviar o chamado.");
    setChamados((atual) => [data.chamado, ...atual]);
    setDescricao("");
  }

  return <>
    <button type="button" onClick={() => setAberto(true)} className="flex h-10 w-10 items-center justify-center rounded-lg text-red-600 transition hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-950/30" aria-label="Abrir suporte" title="Suporte">
      <Headphones className="h-5 w-5" aria-hidden="true" />
    </button>
    {aberto && createPortal(<div className="fixed inset-0 z-[9999] flex items-center justify-center overflow-y-auto bg-black/50 p-3 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="suporte-titulo">
      <button className="absolute inset-0" aria-label="Cancelar" onClick={() => setAberto(false)} />
      <section className="relative my-auto max-h-[calc(100dvh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6 dark:bg-neutral-900">
        <button type="button" className="absolute right-4 top-4 text-neutral-500" aria-label="Fechar" onClick={() => setAberto(false)}><X className="h-5 w-5" /></button>
        <h2 id="suporte-titulo" className="text-lg font-semibold">Falar com o suporte</h2>
        <p className="mt-1 text-sm text-neutral-500">Descreva o que aconteceu. Acompanhe o status abaixo.</p>
        <div className="mt-4 space-y-3">
          <label className="block text-sm font-medium">Nome<input value={nome} readOnly className="mt-1 w-full rounded-lg border bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800" /></label>
          <label className="block text-sm font-medium">WhatsApp para contato<input value={whatsapp} readOnly className="mt-1 w-full rounded-lg border bg-neutral-100 p-2 text-neutral-600 dark:bg-neutral-800" /></label>
          <label className="block text-sm font-medium">Motivo do contato<textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border p-2" /></label>
          {erro && <p className="text-sm text-red-600">{erro}</p>}
          <div className="flex justify-end gap-2"><button type="button" onClick={() => setAberto(false)} className="rounded-lg border px-4 py-2">Cancelar</button><button type="button" disabled={enviando} onClick={enviar} className="rounded-lg bg-brand-orange px-4 py-2 text-white disabled:opacity-60">{enviando ? "Enviando…" : "Enviar chamado"}</button></div>
        </div>
        {chamados.length > 0 && <div className="mt-5 border-t pt-4"><h3 className="text-sm font-semibold">Meus chamados</h3><ul className="mt-2 space-y-2">{chamados.map((c) => <li key={c.id} className="flex justify-between text-sm"><span>#{c.numero} · {new Date(c.criadoEm).toLocaleDateString("pt-BR")}</span><span className="font-medium">{STATUS[c.status]}</span></li>)}</ul></div>}
      </section>
    </div>, document.body)}
  </>;
}
