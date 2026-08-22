"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Copy, MessageCircle, Mail } from "lucide-react";

import { apiGet, apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/form-elements";
import { formatarCpf } from "@/lib/validation/cpf";

type Escola = { id: string; nome: string };

type ConviteNominalCriado = {
  id: string;
  codigo: string;
  link: string;
  waLink: string | null;
  expiraEm: string;
};

/**
 * Substitui o antigo "Gerar novo convite" (código de compartilhamento
 * genérico) — o motorista já pré-cadastra o responsável, o aluno e os
 * termos do contrato; o link nominal é enviado por e-mail automaticamente,
 * e um link pronto pro WhatsApp fica disponível pra envio manual (o Moove
 * ainda não tem integração com WhatsApp Business pra enviar sozinho).
 */
export function CadastrarResponsavelForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [cpf, setCpf] = useState("");
  const [escolas, setEscolas] = useState<Escola[] | null>(null);
  const [prazoMeses, setPrazoMeses] = useState<"" | "10" | "24">("");
  const [criado, setCriado] = useState<ConviteNominalCriado | null>(null);

  useEffect(() => {
    let ativo = true;
    apiGet<Escola[]>("/api/motorista/escolas").then((result) => {
      if (ativo && result.ok) setEscolas(result.data);
    });
    return () => {
      ativo = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const payload = {
      responsavel: {
        nome: form.get("nomeResponsavel"),
        email: form.get("emailResponsavel"),
        telefone: form.get("telefoneResponsavel"),
        cpf,
      },
      aluno: { nome: form.get("nomeAluno") },
      escolaId: form.get("escolaId"),
      periodo: form.get("periodo") || null,
      valorMensalidade: form.get("valorMensalidade") ? Number(form.get("valorMensalidade")) : null,
      diaPagamentoMensalidade: form.get("diaPagamentoMensalidade") ? Number(form.get("diaPagamentoMensalidade")) : null,
      prazoMeses: prazoMeses ? Number(prazoMeses) : null,
    };

    const result = await apiPostJson<ConviteNominalCriado>("/api/motorista/convites/nominal", payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    toast.success("Responsável cadastrado — convite enviado por e-mail.");
    setCriado(result.data);
    event.currentTarget.reset();
    setCpf("");
    setPrazoMeses("");
    router.refresh();
  }

  if (criado) {
    return (
      <div className="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900">
        <div>
          <p className="font-medium text-brand-navy dark:text-white">Convite enviado!</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Enviamos o link por e-mail. Se quiser, mande também por WhatsApp:
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(criado.link).catch(() => {});
              toast.success("Link copiado.");
            }}
            className={secondaryButtonClass + " w-auto items-center gap-1.5 px-3.5 py-1.5 text-sm"}
          >
            <Copy className="h-4 w-4" aria-hidden="true" /> Copiar link
          </button>
          {criado.waLink && (
            <a
              href={criado.waLink}
              target="_blank"
              rel="noreferrer"
              className={secondaryButtonClass + " inline-flex w-auto items-center gap-1.5 px-3.5 py-1.5 text-sm"}
            >
              <MessageCircle className="h-4 w-4" aria-hidden="true" /> Enviar por WhatsApp
            </a>
          )}
          <span className="inline-flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 text-sm text-neutral-500 dark:text-neutral-400">
            <Mail className="h-4 w-4" aria-hidden="true" /> E-mail já enviado
          </span>
        </div>

        <button type="button" onClick={() => setCriado(null)} className={primaryButtonClass + " w-auto px-4"}>
          Cadastrar outro responsável
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-700 dark:bg-neutral-900" noValidate>
      <div>
        <p className="mb-3 text-sm font-medium">Dados do responsável</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="nomeResponsavel">Nome completo</label>
            <input id="nomeResponsavel" name="nomeResponsavel" required className={inputClass} />
            <FieldError message={issues["responsavel.nome"]?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="emailResponsavel">E-mail</label>
            <input id="emailResponsavel" name="emailResponsavel" type="email" required className={inputClass} />
            <FieldError message={issues["responsavel.email"]?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="telefoneResponsavel">Telefone (com DDD)</label>
            <input id="telefoneResponsavel" name="telefoneResponsavel" required className={inputClass} />
            <FieldError message={issues["responsavel.telefone"]?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="cpfResponsavel">CPF</label>
            <input
              id="cpfResponsavel"
              required
              inputMode="numeric"
              placeholder="000.000.000-00"
              maxLength={14}
              value={cpf}
              onChange={(e) => setCpf(formatarCpf(e.target.value))}
              className={inputClass}
            />
            <FieldError message={issues["responsavel.cpf"]?.[0]} />
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <p className="mb-3 text-sm font-medium">Aluno e escola</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="nomeAluno">Nome do aluno</label>
            <input id="nomeAluno" name="nomeAluno" required className={inputClass} />
            <FieldError message={issues["aluno.nome"]?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="escolaId">Escola</label>
            <select id="escolaId" name="escolaId" required className={inputClass} disabled={!escolas}>
              <option value="">{escolas ? "Selecione a escola" : "Carregando…"}</option>
              {escolas?.map((e) => (
                <option key={e.id} value={e.id}>{e.nome}</option>
              ))}
            </select>
            <FieldError message={issues.escolaId?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="periodo">Período (opcional)</label>
            <select id="periodo" name="periodo" defaultValue="" className={inputClass}>
              <option value="">Selecione o período</option>
              <option value="MANHA">Manhã</option>
              <option value="TARDE">Tarde</option>
              <option value="INTEGRAL">Integral</option>
              <option value="NOITE">Noite</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
        <p className="mb-3 text-sm font-medium">Mensalidade e contrato</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="valorMensalidade">Valor da mensalidade (R$)</label>
            <input id="valorMensalidade" name="valorMensalidade" type="number" step="0.01" min="0" className={inputClass} placeholder="Ex.: 250,00" />
            <FieldError message={issues.valorMensalidade?.[0]} />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="diaPagamentoMensalidade">Dia de pagamento</label>
            <select id="diaPagamentoMensalidade" name="diaPagamentoMensalidade" defaultValue="5" className={inputClass}>
              {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="prazoMeses">Prazo do contrato</label>
            <select
              id="prazoMeses"
              value={prazoMeses}
              onChange={(e) => setPrazoMeses(e.target.value as typeof prazoMeses)}
              className={inputClass}
            >
              <option value="">Sem prazo definido</option>
              <option value="10">10 meses</option>
              <option value="24">24 meses</option>
            </select>
          </div>
        </div>
        <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">
          Combinado direto com a família — não passa pela plataforma. O responsável revisa esses termos no contrato
          antes de assinar.
        </p>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Enviando…" : "Cadastrar responsável e enviar contrato"}
      </button>
    </form>
  );
}
