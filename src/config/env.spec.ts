import { loadEnv } from './env';

const base = {
  SUPABASE_URL: 'http://localhost:54321',
  SUPABASE_JWKS_URL: 'http://localhost:54321/auth/v1/.well-known/jwks.json',
  CORS_ORIGIN: 'http://localhost:5173',
  DATABASE_URL: 'postgresql://u:p@localhost:5432/x',
};

// Fatia 003 T2 (base de CA-05, CA-10, CA-11, CA-13): DATABASE_URL entra no env validado no boot.
describe('loadEnv', () => {
  it('aceita o ambiente completo', () => {
    expect(loadEnv({ ...base } as NodeJS.ProcessEnv).DATABASE_URL).toBe(base.DATABASE_URL);
  });

  it('falha no boot sem DATABASE_URL, citando só o nome da variável', () => {
    const { DATABASE_URL: _omitida, ...semUrl } = base;
    expect(() => loadEnv(semUrl as NodeJS.ProcessEnv)).toThrow(/DATABASE_URL/);
    expect(() => loadEnv(semUrl as NodeJS.ProcessEnv)).not.toThrow(/postgresql/);
  });
});
