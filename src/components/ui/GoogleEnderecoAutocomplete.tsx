"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { inputClass } from "@/components/ui/form-elements";

// Autocomplete de endereço via Google Places API (New) — client-side, chave
// separada e restrita por HTTP referrer (NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY,
// diferente da chave de servidor usada em src/lib/geocoding.ts e
// src/lib/routing/google-directions.ts). Sem essa env var, este componente
// simplesmente não renderiza nada — o formulário continua funcionando
// 100% manual/por CEP, como sempre funcionou.
//
// Custo: usamos um `AutocompleteSessionToken` (criado uma vez por "sessão de
// busca" e descartado após uma seleção) pra agrupar as sugestões + detalhes
// do lugar numa única cobrança de sessão, pedindo só campos da camada
// "Essentials" (addressComponents, location, formattedAddress) — na prática
// isso fica dentro dos 10.000 usos grátis por mês do Google. Ainda assim,
// vale acompanhar o faturamento no Google Cloud Console de vez em quando.

const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_BROWSER_KEY;

type AddressComponent = { longText: string; shortText: string; types: string[] };

type GooglePlace = {
  fetchFields: (opts: { fields: string[] }) => Promise<void>;
  addressComponents?: AddressComponent[];
};

type GoogleSuggestion = {
  placePrediction?: {
    placeId: string;
    text: { text: string };
    mainText?: { text: string };
    secondaryText?: { text: string };
    toPlace: () => GooglePlace;
  };
};

type PlacesLibrary = {
  AutocompleteSessionToken: new () => unknown;
  AutocompleteSuggestion: {
    fetchAutocompleteSuggestions: (request: {
      input: string;
      sessionToken: unknown;
      includedRegionCodes?: string[];
      language?: string;
    }) => Promise<{ suggestions: GoogleSuggestion[] }>;
  };
};

declare global {
  interface Window {
    google?: { maps: { importLibrary: (name: string) => Promise<unknown> } };
    __initGoogleMapsPlaces?: () => void;
  }
}

/** Avisa o servidor (telemetria, "fire and forget") que uma nova sessão de
 * busca começou — usado pelo painel admin pra acompanhar o uso mensal em
 * `/admin/uso-google` (ver src/lib/uso-api-externa.ts). Nunca bloqueia nem
 * derruba a busca em si se falhar. */
function avisarNovaSessao() {
  // `keepalive` garante que o navegador tenta completar a requisição mesmo
  // se a pessoa navegar pra outra página logo em seguida (ex: enviou o
  // formulário e saiu da tela antes da resposta voltar).
  fetch("/api/uso-google/autocomplete", { method: "POST", keepalive: true }).catch(() => {});
}

let carregamentoScript: Promise<void> | null = null;

/** Injeta o script de bootstrap oficial do Google Maps uma única vez por
 * página (compartilhado entre múltiplos formulários), que define
 * `google.maps.importLibrary` sem carregar a API inteira de cara. */
function carregarScriptGoogleMaps(): Promise<void> {
  if (carregamentoScript) return carregamentoScript;

  carregamentoScript = new Promise((resolve, reject) => {
    if (window.google?.maps?.importLibrary) {
      resolve();
      return;
    }
    window.__initGoogleMapsPlaces = () => resolve();
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${API_KEY}&loading=async&libraries=places&callback=__initGoogleMapsPlaces`;
    script.async = true;
    script.onerror = () => reject(new Error("Falha ao carregar Google Maps"));
    document.head.appendChild(script);
  });

  return carregamentoScript;
}

export type EnderecoGoogleSelecionado = {
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

function extrairComponente(componentes: AddressComponent[], tipos: string[], usarShort = false): string {
  for (const tipo of tipos) {
    const encontrado = componentes.find((c) => c.types.includes(tipo));
    if (encontrado) return usarShort ? encontrado.shortText : encontrado.longText;
  }
  return "";
}

/**
 * Campo de busca livre que usa o Google Places Autocomplete (New API) pra
 * sugerir endereços conforme o usuário digita e, ao selecionar um, preenche
 * de uma vez os campos estruturados (rua, número, bairro, cidade, UF, CEP)
 * via `onSelecionado` — quem chama decide o que fazer com isso (ver uso em
 * `EnderecoFields.tsx`). Não substitui a geocodificação do servidor: só
 * acelera/melhora o preenchimento do formulário, o pino no mapa continua
 * sendo resolvido como sempre (`src/lib/geocoding.ts`).
 */
export function GoogleEnderecoAutocomplete({
  onSelecionado,
}: {
  onSelecionado: (endereco: EnderecoGoogleSelecionado) => void;
}) {
  const [texto, setTexto] = useState("");
  const [sugestoes, setSugestoes] = useState<GoogleSuggestion[]>([]);
  const [aberto, setAberto] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const sessionTokenRef = useRef<unknown>(null);
  const placesRef = useRef<PlacesLibrary | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const garantirPlaces = useCallback(async (): Promise<PlacesLibrary | null> => {
    if (!API_KEY) return null;
    if (placesRef.current) return placesRef.current;
    await carregarScriptGoogleMaps();
    const lib = (await window.google!.maps.importLibrary("places")) as PlacesLibrary;
    placesRef.current = lib;
    return lib;
  }, []);

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  if (!API_KEY) return null;

  function buscar(valor: string) {
    setTexto(valor);
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (valor.trim().length < 4) {
      setSugestoes([]);
      setAberto(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setCarregando(true);
      try {
        const places = await garantirPlaces();
        if (!places) return;
        if (!sessionTokenRef.current) {
          sessionTokenRef.current = new places.AutocompleteSessionToken();
          avisarNovaSessao();
        }

        const { suggestions } = await places.AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: valor,
          sessionToken: sessionTokenRef.current,
          includedRegionCodes: ["br"],
          language: "pt-BR",
        });
        setSugestoes(suggestions.filter((s) => s.placePrediction));
        setAberto(true);
      } catch {
        // Falha silenciosa — o formulário continua utilizável manualmente.
        setSugestoes([]);
      } finally {
        setCarregando(false);
      }
    }, 300);
  }

  async function selecionar(sugestao: GoogleSuggestion) {
    const prediction = sugestao.placePrediction;
    if (!prediction) return;

    setAberto(false);
    setTexto(prediction.text.text);

    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ["addressComponents"] });
      const componentes = place.addressComponents ?? [];

      onSelecionado({
        logradouro: extrairComponente(componentes, ["route"]),
        numero: extrairComponente(componentes, ["street_number"]),
        bairro: extrairComponente(componentes, ["sublocality_level_1", "sublocality", "neighborhood"]),
        cidade: extrairComponente(componentes, ["locality", "administrative_area_level_2"]),
        estado: extrairComponente(componentes, ["administrative_area_level_1"], true),
        cep: extrairComponente(componentes, ["postal_code"]),
      });
    } catch {
      // Se os detalhes falharem, ao menos o texto digitado fica visível —
      // o usuário completa manualmente os campos abaixo.
    } finally {
      // Nova sessão a partir da próxima busca, pra não misturar buscas
      // diferentes na mesma "sessão" cobrada pelo Google.
      sessionTokenRef.current = null;
      setSugestoes([]);
    }
  }

  return (
    <div className="relative">
      <label className="mb-1 block text-sm font-medium" htmlFor="google-endereco-busca">
        Buscar endereço (Google) <span className="font-normal text-neutral-400">— opcional</span>
      </label>
      <input
        id="google-endereco-busca"
        type="text"
        autoComplete="off"
        placeholder="Digite a rua, número e bairro…"
        value={texto}
        onChange={(e) => buscar(e.target.value)}
        onFocus={() => sugestoes.length > 0 && setAberto(true)}
        onBlur={() => setTimeout(() => setAberto(false), 150)}
        className={inputClass}
      />
      {carregando && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">Buscando…</p>}

      {aberto && sugestoes.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
          {sugestoes.map((s) => (
            <li key={s.placePrediction!.placeId}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selecionar(s)}
                className="block w-full px-3.5 py-2.5 text-left text-sm hover:bg-neutral-100 dark:hover:bg-neutral-800"
              >
                <span className="block font-medium">
                  {s.placePrediction!.mainText?.text ?? s.placePrediction!.text.text}
                </span>
                {s.placePrediction!.secondaryText?.text && (
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400">
                    {s.placePrediction!.secondaryText.text}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
