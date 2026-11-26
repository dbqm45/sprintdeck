import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { checkClaims, decodeClaims, loginUrl, safeNext, startLogin, suiteConfig, type SuiteConfig } from "./oidc";

const CFG: SuiteConfig = {
  issuer: "http://host.docker.internal:8180/realms/suite",
  clientId: "sprintdeck",
  clientSecret: "secret",
  organization: "acme",
  supabaseUrl: "http://127.0.0.1:54321",
  supabaseKey: "sb_publishable_x",
};

const jwt = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`;

describe("suite sign-in (dbqm45/pdi docs/plan-pokoj-sprintdeck.md)", () => {
  it("is on only with the issuer, the client secret, the organization and Supabase", () => {
    expect(suiteConfig({})).toBeNull();
    const env = {
      SUITE_ISSUER: "http://host.docker.internal:8180/realms/suite/",
      SUITE_CLIENT_SECRET: "secret",
      SUITE_ORGANIZATION: "acme",
      NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_x",
    };
    expect(suiteConfig(env)).toEqual(CFG);
    expect(() => suiteConfig({ ...env, SUITE_ISSUER: "http://id.example.com/realms/suite" })).toThrow(/https/);
    expect(() => suiteConfig({ ...env, SUITE_ORGANIZATION: "" })).toThrow(/SUITE_ORGANIZATION/);
  });

  it("asks Keycloak for the code with PKCE, scope openid only and the hash of the nonce", () => {
    const login = startLogin("/from-pdi");
    expect(login.state).toMatch(/^[\w-]{32,}$/);
    const url = new URL(loginUrl(CFG, login, "http://127.0.0.1:3000/auth/suite/callback"));
    expect(url.origin + url.pathname).toBe(`${CFG.issuer}/protocol/openid-connect/auth`);
    const q = Object.fromEntries(url.searchParams);
    expect(q).toMatchObject({ client_id: "sprintdeck", response_type: "code", scope: "openid", state: login.state, code_challenge_method: "S256" });
    expect(q.code_challenge).toBe(createHash("sha256").update(login.verifier).digest("base64url"));
    expect(q.nonce).toBe(createHash("sha256").update(login.nonce).digest("hex"));
    expect(login.next).toBe("/from-pdi");
  });

  it("goes back only to a path of this app", () => {
    expect(safeNext("/from-pdi")).toBe("/from-pdi");
    expect(safeNext("//evil.example")).toBe("/");
    expect(safeNext("https://evil.example")).toBe("/");
    expect(safeNext(null)).toBe("/");
  });

  it("lets in a member of the organization with the role member, and says why not otherwise", () => {
    const ok = { organization: ["acme"], resource_access: { sprintdeck: { roles: ["member"] } }, name: "Ola Test" };
    expect(checkClaims(decodeClaims(jwt(ok)), CFG)).toEqual({ ok: true, name: "Ola Test" });
    expect(checkClaims({ ...ok, organization: ["other"] }, CFG)).toEqual({ ok: false, reason: "not-member" });
    expect(checkClaims({ ...ok, resource_access: {} }, CFG)).toEqual({ ok: false, reason: "no-role" });
    expect(checkClaims({ ...ok, name: undefined, preferred_username: "ola" }, CFG)).toEqual({ ok: true, name: "ola" });
  });
});
