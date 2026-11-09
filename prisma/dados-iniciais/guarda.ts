// Spec 002-dados-iniciais, R8 e Q13: o script nunca escreve no remoto por acidente.
// O back/.env aponta para o Supabase remoto e o cliente Prisma o carrega sozinho; por isso, host que
// nao seja local exige confirmacao explicita. Falha fechada: variavel ausente tambem e erro.
// Imprime so o host, nunca a URL (a URL do banco carrega a senha).

export const VARIAVEL_CONFIRMACAO = 'DADOS_INICIAIS_CONFIRMO_PRODUCAO';

const HOSTS_LOCAIS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export class ErroGuarda extends Error {}

export function hostDe(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return '(ilegivel)';
  }
}

export interface Destino {
  hosts: string[];
  local: boolean;
}

/** Confere os destinos de escrita. Lanca ErroGuarda se for remoto sem a confirmacao do operador. */
export function conferirDestino(env: Record<string, string | undefined>): Destino {
  const obrigatorias = ['DATABASE_URL', 'SUPABASE_URL'] as const;
  for (const nome of obrigatorias) {
    if (!env[nome]) throw new ErroGuarda(`${nome} ausente: nao ha como saber o destino da escrita.`);
  }

  const hosts = [env.DATABASE_URL, env.DIRECT_URL, env.SUPABASE_URL]
    .filter((v): v is string => Boolean(v))
    .map(hostDe);
  const local = hosts.every((h) => HOSTS_LOCAIS.has(h));

  if (!local && env[VARIAVEL_CONFIRMACAO] !== 'sim') {
    throw new ErroGuarda(
      `Destino REMOTO (hosts: ${[...new Set(hosts)].join(', ')}). Producao so pelo operador: ` +
        `defina ${VARIAVEL_CONFIRMACAO}=sim no terminal dele. Nada foi escrito.`,
    );
  }
  return { hosts, local };
}
