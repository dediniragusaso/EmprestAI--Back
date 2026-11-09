// Spec 002-dados-iniciais, R4 e R10: cliente da API admin do Auth, injetado no script.
// Nos testes entra um cliente simulado; o Auth real e provado em producao (login do professor).
// A service_role so existe aqui, no backend e no terminal do operador (rules/secrets.md).
// Mensagens de erro nunca levam chave, senha nem corpo de resposta.

export interface ClienteAuthAdmin {
  buscarPorEmail(email: string): Promise<{ id: string } | null>;
  criar(dados: { email: string; senha: string }): Promise<{ id: string }>;
}

export class ErroAuth extends Error {}

interface OpcoesClienteAuth {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetchFn?: typeof fetch;
}

const POR_PAGINA = 100;
const MAX_PAGINAS = 50;

export function criarClienteAuthAdmin(opcoes: OpcoesClienteAuth): ClienteAuthAdmin {
  const fetchFn = opcoes.fetchFn ?? fetch;
  const base = `${opcoes.supabaseUrl.replace(/\/+$/, '')}/auth/v1/admin/users`;
  const cabecalhos = {
    apikey: opcoes.serviceRoleKey,
    Authorization: `Bearer ${opcoes.serviceRoleKey}`,
    'Content-Type': 'application/json',
  };

  async function buscarPorEmail(email: string): Promise<{ id: string } | null> {
    const alvo = email.toLowerCase();
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina += 1) {
      const resposta = await fetchFn(`${base}?page=${pagina}&per_page=${POR_PAGINA}`, { headers: cabecalhos });
      if (!resposta.ok) throw new ErroAuth(`Auth admin (listar usuarios) respondeu HTTP ${resposta.status}`);
      const corpo = (await resposta.json()) as { users?: Array<{ id: string; email?: string | null }> };
      const usuarios = corpo.users ?? [];
      const achado = usuarios.find((u) => u.email?.toLowerCase() === alvo);
      if (achado) return { id: achado.id };
      if (usuarios.length < POR_PAGINA) return null;
    }
    return null;
  }

  async function criar(dados: { email: string; senha: string }): Promise<{ id: string }> {
    const resposta = await fetchFn(base, {
      method: 'POST',
      headers: cabecalhos,
      // Q3: nenhum `name` nos metadados; o espelho public.users usa o e-mail.
      body: JSON.stringify({ email: dados.email, password: dados.senha, email_confirm: true }),
    });
    if (resposta.status === 422) {
      // E-mail ja existe (corrida com outra execucao): conta como "existe".
      const existente = await buscarPorEmail(dados.email);
      if (existente) return existente;
    }
    if (!resposta.ok) throw new ErroAuth(`Auth admin (criar usuario) respondeu HTTP ${resposta.status}`);
    const corpo = (await resposta.json()) as { id?: string };
    if (!corpo.id) throw new ErroAuth('Auth admin (criar usuario) nao devolveu o id');
    return { id: corpo.id };
  }

  return { buscarPorEmail, criar };
}
