"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

import { apiGet, apiPostJson } from "@/lib/api-client";
import { FieldError, inputClass, primaryButtonClass } from "@/components/ui/form-elements";
import { PasswordInput } from "@/components/ui/PasswordInput";
import { formatarCpf } from "@/lib/validation/cpf";
import { formatarBRL } from "@/lib/subscription/plans";
import { VerifyCodeForm } from "@/components/auth/VerifyCodeForm";
import { EnderecoAlunoForm } from "@/components/responsavel/EnderecoAlunoForm";

const PERIODO_LABEL: Record<string, string> = { MANHA: "Manhã", TARDE: "Tarde", INTEGRAL: "Integral", NOITE: "Noite" };

type DadosConvite = {
  motoristaNome: string;
  contaJaCriada: boolean;
  alunoId: string | null;
  responsavel: { nome: string | null; email: string | null; telefone: string | null; cpf: string | null };
  aluno: { nome: string };
  escolaNome: string | null;
  periodo: string | null;
  valorMensalidade: number | null;
  diaPagamentoMensalidade: number | null;
  prazoMeses: 10 | 24 | null;
};

type Fase = "carregando" | "erro" | "cadastro" | "verificar" | "endereco" | "assinar" | "concluido";

export function ConviteNominalWizard({ codigo }: { codigo: string }) {
  const router = useRouter();
  const [fase, setFase] = useState<Fase>("carregando");
  const [erro, setErro] = useState<string | null>(null);
  const [dados, setDados] = useState<DadosConvite | null>(null);

  const [cpf, setCpf] = useState("");
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Record<string, string[] | undefined>>({});
  const [aceitaLgpd, setAceitaLgpd] = useState(false);
  const [emailPendente, setEmailPendente] = useState<string | null>(null);

  const [alunoId, setAlunoId] = useState<string | null>(null);
  const [enderecoSalvo, setEnderecoSalvo] = useState(false);
  const [aceitaContrato, setAceitaContrato] = useState(false);

  useEffect(() => {
    let ativo = true;
    apiGet<DadosConvite>(`/api/responsavel/convites/nominal/${codigo}`).then((result) => {
      if (!ativo) return;
      if (!result.ok) {
        setErro(result.error);
        setFase("erro");
        return;
      }
      setDados(result.data);
      setCpf(result.data.responsavel.cpf ? formatarCpf(result.data.responsavel.cpf) : "");
      if (result.data.contaJaCriada && result.data.alunoId) {
        setAlunoId(result.data.alunoId);
        setFase("endereco");
      } else {
        setFase("cadastro");
      }
    });
    return () => {
      ativo = false;
    };
  }, [codigo]);

  async function handleSubmitCadastro(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIssues({});

    const form = new FormData(event.currentTarget);
    const senha = String(form.get("senha") ?? "");
    const confirmarSenha = String(form.get("confirmarSenha") ?? "");
    if (senha !== confirmarSenha) {
      setIssues({ confirmarSenha: ["As senhas não coincidem."] });
      return;
    }

    setLoading(true);
    const payload = {
      nome: form.get("nome"),
      email: form.get("email"),
      telefone: form.get("telefone"),
      cpf,
      senha,
      confirmarSenha,
      aceitaLgpd,
    };
    const result = await apiPostJson<{ email: string }>(`/api/responsavel/convites/nominal/${codigo}/cadastrar`, payload);
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      setIssues(result.issues ?? {});
      return;
    }

    setEmailPendente(result.data.email);
    setFase("verificar");
  }

  async function handleAssinar() {
    setLoading(true);
    setFormError(null);
    const result = await apiPostJson(`/api/responsavel/convites/nominal/${codigo}/assinar`, { aceite: aceitaContrato });
    setLoading(false);

    if (!result.ok) {
      setFormError(result.error);
      return;
    }

    toast.success("Contrato assinado! Vínculo criado com sucesso.");
    setFase("concluido");
  }

  if (fase === "carregando") {
    return <p className="text-sm text-neutral-500 dark:text-neutral-400">Carregando convite…</p>;
  }

  if (fase === "erro") {
    return <p className="text-sm text-red-600">{erro}</p>;
  }

  if (!dados) return null;

  if (fase === "verificar" && emailPendente) {
    return (
      <VerifyCodeForm<{ alunoId: string }>
        role="responsavel"
        email={emailPendente}
        proposito="CADASTRO"
        verifyUrl={`/api/responsavel/convites/nominal/${codigo}/verificar`}
        onVerified={(data) => {
          setAlunoId(data.alunoId);
          setFase("endereco");
        }}
      />
    );
  }

  if (fase === "endereco" && alunoId) {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium">Endereço de {dados.aluno.nome}</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            É o endereço de embarque/desembarque que {dados.motoristaNome} vai usar na rota.
          </p>
        </div>
        <EnderecoAlunoForm
          alunoId={alunoId}
          defaultValues={{}}
          geocodificado={false}
          onSaved={() => setEnderecoSalvo(true)}
        />
        {enderecoSalvo && (
          <button type="button" onClick={() => setFase("assinar")} className={primaryButtonClass}>
            Continuar para o contrato
          </button>
        )}
      </div>
    );
  }

  if (fase === "assinar") {
    return (
      <div className="space-y-4">
        <div>
          <p className="font-medium">Revisar e assinar o contrato</p>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            Confira os termos combinados com {dados.motoristaNome} antes de assinar.
          </p>
        </div>

        <div className="space-y-1.5 rounded-xl bg-neutral-50 p-4 text-sm dark:bg-neutral-800">
          <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Aluno</span><span>{dados.aluno.nome}</span></div>
          <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Escola</span><span>{dados.escolaNome ?? "Não definida"}</span></div>
          {dados.periodo && (
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Período</span><span>{PERIODO_LABEL[dados.periodo] ?? dados.periodo}</span></div>
          )}
          <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Mensalidade</span><span>{dados.valorMensalidade !== null ? formatarBRL(dados.valorMensalidade) : "A combinar"}</span></div>
          {dados.diaPagamentoMensalidade && (
            <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Vencimento</span><span>Dia {dados.diaPagamentoMensalidade}</span></div>
          )}
          <div className="flex justify-between"><span className="text-neutral-500 dark:text-neutral-400">Prazo</span><span>{dados.prazoMeses ? `${dados.prazoMeses} meses` : "Sem prazo definido"}</span></div>
        </div>

        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          A mensalidade é combinada direto com {dados.motoristaNome} — o Moove não processa nem retém esse valor,
          só facilita a cobrança mensal.
        </p>

        <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
          <input type="checkbox" className="mt-1" checked={aceitaContrato} onChange={(e) => setAceitaContrato(e.target.checked)} />
          <span>Li e concordo com os termos do contrato de transporte escolar acima.</span>
        </label>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button type="button" onClick={handleAssinar} disabled={loading || !aceitaContrato} className={primaryButtonClass}>
          {loading ? "Assinando…" : "Assinar contrato"}
        </button>
      </div>
    );
  }

  if (fase === "concluido") {
    return (
      <div className="space-y-4 text-center">
        <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" aria-hidden="true" />
        <p className="font-medium">Tudo pronto!</p>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          O contrato foi assinado e {dados.aluno.nome} já está vinculado(a) a {dados.motoristaNome}.
        </p>
        <button
          type="button"
          onClick={() => {
            router.push("/responsavel/dashboard");
            router.refresh();
          }}
          className={primaryButtonClass}
        >
          Ir para o painel
        </button>
      </div>
    );
  }

  // fase === "cadastro"
  return (
    <form onSubmit={handleSubmitCadastro} className="space-y-4" noValidate>
      <p className="text-sm text-neutral-600 dark:text-neutral-300">
        {dados.motoristaNome} preparou o contrato de transporte de {dados.aluno.nome}. Complete seus dados pra
        continuar.
      </p>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="nome">Nome completo</label>
        <input id="nome" name="nome" required defaultValue={dados.responsavel.nome ?? ""} className={inputClass} autoComplete="name" />
        <FieldError message={issues.nome?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="email">E-mail</label>
        <input id="email" name="email" type="email" required defaultValue={dados.responsavel.email ?? ""} className={inputClass} autoComplete="email" />
        <FieldError message={issues.email?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="telefone">Telefone (com DDD)</label>
        <input id="telefone" name="telefone" required defaultValue={dados.responsavel.telefone ?? ""} className={inputClass} autoComplete="tel" />
        <FieldError message={issues.telefone?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cpf">CPF</label>
        <input
          id="cpf"
          required
          inputMode="numeric"
          placeholder="000.000.000-00"
          maxLength={14}
          value={cpf}
          onChange={(e) => setCpf(formatarCpf(e.target.value))}
          className={inputClass}
          autoComplete="off"
        />
        <FieldError message={issues.cpf?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="senha">Senha</label>
        <PasswordInput id="senha" name="senha" required minLength={8} className={inputClass} autoComplete="new-password" />
        <FieldError message={issues.senha?.[0]} />
      </div>

      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="confirmarSenha">Repetir senha</label>
        <PasswordInput id="confirmarSenha" name="confirmarSenha" required minLength={8} className={inputClass} autoComplete="new-password" />
        <FieldError message={issues.confirmarSenha?.[0]} />
      </div>

      <label className="flex items-start gap-2 text-sm text-neutral-700 dark:text-neutral-300">
        <input type="checkbox" className="mt-1" checked={aceitaLgpd} onChange={(e) => setAceitaLgpd(e.target.checked)} />
        <span>Li e concordo com o tratamento dos meus dados pessoais e de localização (LGPD).</span>
      </label>
      <FieldError message={issues.aceitaLgpd?.[0]} />

      {formError && <p className="text-sm text-red-600">{formError}</p>}

      <button type="submit" disabled={loading} className={primaryButtonClass}>
        {loading ? "Enviando código…" : "Continuar"}
      </button>
    </form>
  );
}
