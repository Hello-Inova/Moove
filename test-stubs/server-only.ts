// Stub pra rodar testes fora do Next.js — o pacote real usa uma condição
// de resolução do bundler do Next (webpack "react-server"/browser) que o
// Vite/Vitest não reproduz, fazendo o import real sempre lançar "This
// module cannot be imported from a Client Component module" mesmo em teste
// puro de Node. Como os testes nunca rodam no browser, o stub não faz nada.
// Ver alias em vitest.config.ts.
export {};
