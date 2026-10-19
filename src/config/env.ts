import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  SUPABASE_URL: z.string().url(),
  SUPABASE_JWKS_URL: z.string().url(),
  CORS_ORIGIN: z.string().min(1),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  if (cached && source === process.env) return cached;
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    const campos = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Variaveis de ambiente invalidas ou ausentes: ${campos}`);
  }
  if (source === process.env) cached = parsed.data;
  return parsed.data;
}
