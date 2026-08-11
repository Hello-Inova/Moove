"use client";

import { useState } from "react";

import { FieldError, inputClass } from "@/components/ui/form-elements";

export type EnderecoValores = {
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

const VAZIO: EnderecoValores = {
  cep: "",
  logradouro: "",
  numero: "",
  complemento: "",
  bairro: "",
  cidade: "",
  estado: "",
};

function formatarCep(v: string): string {
  const digitos = v.replace(/\D/g, "").slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

/**
 * Campos de endereço com autocomplete OPCIONAL por CEP (ViaCEP — gratuito,
 * sem chave). Ao completar os 8 dígitos, busca rua/bairro/cidade/UF e
 * preenche os campos (o usuário ainda pode editar, caso o CEP retorne algo
 * impreciso). Quem não souber o CEP (ou preferir não usá-lo) pode deixá-lo
 * em branco e preencher rua/número/bairro/cidade/UF direto — a
 * geocodificação (`src/lib/geocoding.ts`) busca a coordenada a partir
 * desses campos estruturados mesmo sem CEP nenhum. Número e complemento são
 * sempre digitados manualmente.
 *
 * Usado no cadastro de motorista e responsável (`RegisterForm`), na tela
 * "Meu endereço" do responsável (edição posterior) e no cadastro de escola
 * do motorista (`EscolaForm`) — os `name` dos inputs batem com
 * `enderecoSchema`/`enderecoCampos` em `src/lib/validation/schemas.ts`,
 * então funciona só com `FormData` do formulário pai, sem precisar levantar
 * estado.
 */
export function EnderecoFields({
  defaultValues,
  issues,
}: {
  defaultValues?: Partial<EnderecoValores>;
  issues?: Record<string, string[] | undefined>;
}) {
  const [valores, setValores] = useState<EnderecoValores>({ ...VAZIO, ...defaultValues });
  const [buscandoCep, setBuscandoCep] = useState(false);
  const [cepErro, setCepErro] = useState<string | null>(null);

  function set<K extends keyof EnderecoValores>(campo: K, valor: string) {
    setValores((v) => ({ ...v, [campo]: valor }));
  }

  async function buscarCep(cepDigitado: string) {
    const digitos = cepDigitado.replace(/\D/g, "");
    if (digitos.length !== 8) return;

    setBuscandoCep(true);
    setCepErro(null);

    try {
      const response = await fetch(`https://viacep.com.br/ws/${digitos}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setValores((v) => ({
          ...v,
          logradouro: data.logradouro || v.logradouro,
          bairro: data.bairro || v.bairro,
          cidade: data.localidade || v.cidade,
          estado: data.uf || v.estado,
        }));
        return;
      }

      // ViaCEP não achou — acontece com alguma frequência em CEPs novos de
      // loteamentos/condomínios fechados que ainda não caíram na base dele.
      // A BrasilAPI agrega Correios + outras fontes e costuma ter cobertura
      // melhor nesses casos, então tentamos ela antes de desistir.
      const brasilApi = await fetch(`https://brasilapi.com.br/api/cep/v2/${digitos}`);
      if (brasilApi.ok) {
        const dataBrasilApi = await brasilApi.json();
        setValores((v) => ({
          ...v,
          logradouro: dataBrasilApi.street || v.logradouro,
          bairro: dataBrasilApi.neighborhood || v.bairro,
          cidade: dataBrasilApi.city || v.cidade,
          estado: dataBrasilApi.state || v.estado,
        }));
        return;
      }

      setCepErro(
        "CEP não encontrado nas bases consultadas. Isso é comum em condomínios/loteamentos fechados recém-criados — preencha rua, número, bairro, cidade e UF manualmente."
      );
    } catch {
      setCepErro("Não foi possível consultar o CEP agora. Preencha o endereço manualmente.");
    } finally {
      setBuscandoCep(false);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1 block text-sm font-medium" htmlFor="cep">
          CEP <span className="font-normal text-neutral-400">(opcional — preenche o resto sozinho)</span>
        </label>
        <input
          id="cep"
          name="cep"
          inputMode="numeric"
          placeholder="00000-000 — ou deixe em branco"
          value={valores.cep}
          onChange={(e) => set("cep", formatarCep(e.target.value))}
          onBlur={(e) => buscarCep(e.target.value)}
          className={inputClass}
        />
        <FieldError message={cepErro ?? issues?.cep?.[0]} />
        {buscandoCep && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Buscando endereço…</p>}
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Não sabe o CEP? Sem problema — preencha rua, número, bairro, cidade e UF abaixo direto.
      </p>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_100px] sm:gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="logradouro">
            Rua / Avenida
          </label>
          <input
            id="logradouro"
            name="logradouro"
            required
            value={valores.logradouro}
            onChange={(e) => set("logradouro", e.target.value)}
            className={inputClass}
          />
          <FieldError message={issues?.logradouro?.[0]} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="estado">
            UF
          </label>
          <input
            id="estado"
            name="estado"
            required
            maxLength={2}
            placeholder="SP"
            value={valores.estado}
            onChange={(e) => set("estado", e.target.value.toUpperCase())}
            className={inputClass + " uppercase"}
          />
          <FieldError message={issues?.estado?.[0]} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="numero">
            Número
          </label>
          <input
            id="numero"
            name="numero"
            required
            value={valores.numero}
            onChange={(e) => set("numero", e.target.value)}
            className={inputClass}
          />
          <FieldError message={issues?.numero?.[0]} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="complemento">
            Complemento (opcional)
          </label>
          <input
            id="complemento"
            name="complemento"
            placeholder="Apto, bloco…"
            value={valores.complemento}
            onChange={(e) => set("complemento", e.target.value)}
            className={inputClass}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="bairro">
            Bairro
          </label>
          <input
            id="bairro"
            name="bairro"
            required
            value={valores.bairro}
            onChange={(e) => set("bairro", e.target.value)}
            className={inputClass}
          />
          <FieldError message={issues?.bairro?.[0]} />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="cidade">
            Cidade
          </label>
          <input
            id="cidade"
            name="cidade"
            required
            value={valores.cidade}
            onChange={(e) => set("cidade", e.target.value)}
            className={inputClass}
          />
          <FieldError message={issues?.cidade?.[0]} />
        </div>
      </div>

      <p className="text-xs text-neutral-500 dark:text-neutral-400">
        Esse é o endereço onde o motorista vai buscar/deixar o(s) aluno(s) — usado para traçar a rota.
      </p>
    </div>
  );
}
