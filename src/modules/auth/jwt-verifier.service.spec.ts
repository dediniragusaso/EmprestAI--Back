import { generateKeyPairSync, sign } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtVerifierService } from './jwt-verifier.service';

const { publicKey, privateKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });

function b64(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj)).toString('base64url');
}

function token(payload: Record<string, unknown>, tamper = false): string {
  const h = b64({ alg: 'ES256', kid: 'k1', typ: 'JWT' });
  const p = b64(payload);
  const sig = sign('sha256', Buffer.from(`${h}.${p}`), { key: privateKey, dsaEncoding: 'ieee-p1363' });
  const jwt = `${h}.${p}.${sig.toString('base64url')}`;
  return tamper ? `${h}.${b64({ ...payload, sub: 'outro' })}.${sig.toString('base64url')}` : jwt;
}

const future = () => Math.floor(Date.now() / 1000) + 3600;

describe('JwtVerifierService', () => {
  beforeEach(() => {
    process.env.SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_JWKS_URL = 'http://localhost:54321/auth/v1/.well-known/jwks.json';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'k1' };
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify({ keys: [jwk] })));
  });
  afterEach(() => jest.restoreAllMocks());

  it('aceita token valido e devolve id e email', async () => {
    const user = await new JwtVerifierService().verify(
      token({ sub: 'u1', email: 'a@b.com', aud: 'authenticated', exp: future() }),
    );
    expect(user).toEqual({ id: 'u1', email: 'a@b.com' });
  });

  it('rejeita token expirado', async () => {
    await expect(
      new JwtVerifierService().verify(token({ sub: 'u1', aud: 'authenticated', exp: 1 })),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita token adulterado', async () => {
    await expect(
      new JwtVerifierService().verify(token({ sub: 'u1', aud: 'authenticated', exp: future() }, true)),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('rejeita algoritmo none', async () => {
    const t = `${b64({ alg: 'none' })}.${b64({ sub: 'u1', exp: future() })}.`;
    await expect(new JwtVerifierService().verify(t)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
