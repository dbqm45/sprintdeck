/**
 * Sign-in through the suite's identity service (DI Identity, Keycloak realm `suite`; dbqm45/pdi
 * docs/plan-pokoj-sprintdeck.md). Server-side only: it holds the client secret.
 *
 * Supabase Auth's own Keycloak redirect always asks for `profile email openid`, and the realm gives `email` only to
 * applications that need it (DI3), so that flow fails with `invalid_scope`. Instead this app runs the code flow itself
 * (PKCE, scope `openid`), then hands the ID token to Supabase Auth (`grant_type=id_token`, provider `keycloak`,
 * `email_optional`), which checks the signature, issuer, audience and nonce and opens a non-anonymous session.
 * Only a member of the organization with the role `member` of the `sprintdeck` client gets that session; the check runs
 * before Supabase sees the token, so nobody else gets an account there.
 */

import { createHash, randomBytes } from "node:crypto";

export interface SuiteConfig {
  issuer: string;
  clientId: string;
  clientSecret: string;
  organization: string;
  supabaseUrl: string;
  supabaseKey: string;
}

export interface Login {
  state: string;
  verifier: string;
  /** Raw nonce for Supabase Auth; Keycloak gets its SHA-256 (hex), which Supabase compares. */
  nonce: string;
  next: string;
}

const LOCAL = new Set(["localhost", "127.0.0.1", "[::1]", "host.docker.internal"]);

/** The suite settings, or null when the suite sign-in is off (no issuer and no secret). */
export function suiteConfig(env: Record<string, string | undefined>): SuiteConfig | null {
  const issuer = env.SUITE_ISSUER?.trim().replace(/\/+$/, "");
  const clientSecret = env.SUITE_CLIENT_SECRET?.trim();
  if (!issuer && !clientSecret) return null;
  const need = (name: string, value: string | undefined) => {
    if (!value?.trim()) throw new Error(`${name} is not set (the suite sign-in needs it)`);
    return value.trim();
  };
  const url = new URL(need("SUITE_ISSUER", issuer));
  if (!(url.protocol === "https:" || (url.protocol === "http:" && LOCAL.has(url.hostname)))) {
    throw new Error("SUITE_ISSUER must be https:// (http only for a local Keycloak)");
  }
  return {
    issuer: issuer!,
    clientId: env.SUITE_CLIENT_ID?.trim() || "sprintdeck",
    clientSecret: need("SUITE_CLIENT_SECRET", clientSecret),
    organization: need("SUITE_ORGANIZATION", env.SUITE_ORGANIZATION),
    supabaseUrl: need("NEXT_PUBLIC_SUPABASE_URL", env.NEXT_PUBLIC_SUPABASE_URL).replace(/\/+$/, ""),
    supabaseKey: need("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  };
}

const random = () => randomBytes(32).toString("base64url");

/** Where to go after the sign-in: a path of this app only. */
export function safeNext(next: string | null | undefined): string {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.includes("\\") ? next.slice(0, 500) : "/";
}

export function startLogin(next: string | null | undefined): Login {
  return { state: random(), verifier: random(), nonce: random(), next: safeNext(next) };
}

export function loginUrl(cfg: SuiteConfig, login: Login, redirectUri: string): string {
  const q = new URLSearchParams({
    client_id: cfg.clientId,
    response_type: "code",
    scope: "openid",
    redirect_uri: redirectUri,
    state: login.state,
    code_challenge: createHash("sha256").update(login.verifier).digest("base64url"),
    code_challenge_method: "S256",
    nonce: createHash("sha256").update(login.nonce).digest("hex"),
  });
  return `${cfg.issuer}/protocol/openid-connect/auth?${q}`;
}

/** The ID token's claims, read without a signature check: only for a token straight from the suite's token endpoint. */
export function decodeClaims(idToken: string): Record<string, unknown> {
  const part = idToken.split(".")[1];
  if (!part) throw new Error("the ID token is not a JWT");
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

export type ClaimsCheck = { ok: true; name: string } | { ok: false; reason: "not-member" | "no-role" };

export function checkClaims(claims: Record<string, unknown>, cfg: SuiteConfig): ClaimsCheck {
  const orgs = Array.isArray(claims.organization) ? claims.organization : [];
  if (!orgs.includes(cfg.organization)) return { ok: false, reason: "not-member" };
  const access = claims.resource_access as Record<string, { roles?: unknown }> | undefined;
  const roles = access?.[cfg.clientId]?.roles;
  if (!Array.isArray(roles) || !roles.includes("member")) return { ok: false, reason: "no-role" };
  const name = [claims.name, claims.preferred_username].find((v): v is string => typeof v === "string" && v.trim() !== "");
  return { ok: true, name: (name ?? "Suite user").trim().slice(0, 32) };
}

/** Code → ID token at the suite's token endpoint (client secret, PKCE verifier). */
export async function exchangeCode(cfg: SuiteConfig, code: string, login: Login, redirectUri: string, http: typeof fetch = fetch): Promise<string> {
  const res = await http(`${cfg.issuer}/protocol/openid-connect/token`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: cfg.clientId,
      client_secret: cfg.clientSecret,
      code_verifier: login.verifier,
    }).toString(),
    redirect: "manual",
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`the suite token endpoint answered HTTP ${res.status}`);
  const body = (await res.json()) as { id_token?: unknown };
  if (typeof body.id_token !== "string") throw new Error("the suite gave no ID token");
  return body.id_token;
}

export interface SupabaseSession {
  access_token: string;
  refresh_token: string;
}

/** ID token → Supabase session (Supabase Auth verifies the token against the suite's keys). */
export async function supabaseSession(cfg: SuiteConfig, idToken: string, nonce: string, http: typeof fetch = fetch): Promise<SupabaseSession> {
  const res = await http(`${cfg.supabaseUrl}/auth/v1/token?grant_type=id_token`, {
    method: "POST",
    headers: { apikey: cfg.supabaseKey, "content-type": "application/json" },
    body: JSON.stringify({ provider: "keycloak", id_token: idToken, nonce }),
    signal: AbortSignal.timeout(10_000),
  });
  const body = (await res.json().catch(() => ({}))) as Partial<SupabaseSession> & { error_code?: string };
  if (!res.ok || typeof body.access_token !== "string" || typeof body.refresh_token !== "string") {
    throw new Error(`Supabase Auth refused the suite ID token (HTTP ${res.status}${body.error_code ? `, ${body.error_code}` : ""})`);
  }
  return { access_token: body.access_token, refresh_token: body.refresh_token };
}
