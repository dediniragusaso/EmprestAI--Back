import { Injectable, UnauthorizedException } from '@nestjs/common';
import { createPublicKey, verify, type KeyObject, type webcrypto } from 'node:crypto';
import { loadEnv } from '../../config/env';

export interface AuthUser {
  id: string;
  email: string | null;
}

interface Jwk extends webcrypto.JsonWebKey {
  kid?: string;
}

const JWKS_TTL_MS = 10 * 60 * 1000;

// Valida o JWT do Supabase contra o JWKS (ADR-001 §7) com node:crypto,
// porque o ADR-001 não lista biblioteca de JWT.
@Injectable()
export class JwtVerifierService {
  private keys = new Map<string, KeyObject>();
  private fetchedAt = 0;

  async verify(token: string): Promise<AuthUser> {
    const parts = token.split('.');
    if (parts.length !== 3) throw new UnauthorizedException('Token invalido.');
    const [h, p, s] = parts;

    let header: { alg?: string; kid?: string };
    let payload: { sub?: string; email?: string; exp?: number; nbf?: number; aud?: string | string[] };
    try {
      header = JSON.parse(Buffer.from(h, 'base64url').toString('utf8'));
      payload = JSON.parse(Buffer.from(p, 'base64url').toString('utf8'));
    } catch {
      throw new UnauthorizedException('Token invalido.');
    }

    if (header.alg !== 'ES256' && header.alg !== 'RS256') {
      throw new UnauthorizedException('Algoritmo nao aceito.');
    }
    const key = await this.getKey(header.kid);
    if (!key) throw new UnauthorizedException('Chave desconhecida.');

    const ok = verify(
      'sha256',
      Buffer.from(`${h}.${p}`),
      header.alg === 'ES256' ? { key, dsaEncoding: 'ieee-p1363' } : key,
      Buffer.from(s, 'base64url'),
    );
    if (!ok) throw new UnauthorizedException('Assinatura invalida.');

    const now = Math.floor(Date.now() / 1000);
    if (typeof payload.exp !== 'number' || payload.exp <= now) throw new UnauthorizedException('Token expirado.');
    if (typeof payload.nbf === 'number' && payload.nbf > now) throw new UnauthorizedException('Token ainda nao valido.');
    const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
    if (!aud.includes('authenticated')) throw new UnauthorizedException('Audiencia invalida.');
    if (!payload.sub) throw new UnauthorizedException('Token sem sujeito.');

    return { id: payload.sub, email: payload.email ?? null };
  }

  private async getKey(kid?: string): Promise<KeyObject | undefined> {
    const id = kid ?? '';
    const fresh = Date.now() - this.fetchedAt < JWKS_TTL_MS;
    if (fresh && this.keys.has(id)) return this.keys.get(id);
    // Recarrega o JWKS quando o cache expirou ou ainda está vazio.
    if (!fresh || this.keys.size === 0) await this.refresh();
    return this.keys.get(id);
  }

  private async refresh(): Promise<void> {
    const res = await fetch(loadEnv().SUPABASE_JWKS_URL);
    if (!res.ok) throw new UnauthorizedException('Nao foi possivel validar o token.');
    const body = (await res.json()) as { keys?: Jwk[] };
    const next = new Map<string, KeyObject>();
    for (const jwk of body.keys ?? []) {
      next.set(jwk.kid ?? '', createPublicKey({ key: jwk as never, format: 'jwk' }));
    }
    this.keys = next;
    this.fetchedAt = Date.now();
  }
}
