import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, securityHeaders } from "./security-headers";

const directive = (policy: string, name: string) =>
  policy
    .split("; ")
    .find((part) => part.startsWith(`${name} `))
    ?.split(" ")
    .slice(1);

describe("contentSecurityPolicy", () => {
  it("allows the Supabase API and its realtime websocket, nothing else", () => {
    const policy = contentSecurityPolicy({ supabaseUrl: "https://abcd.supabase.co" });
    expect(directive(policy, "connect-src")).toEqual(["'self'", "https://abcd.supabase.co", "wss://abcd.supabase.co"]);
  });

  it("works with a local http Supabase and doesn't upgrade it to https", () => {
    const policy = contentSecurityPolicy({ supabaseUrl: "http://127.0.0.1:54321" });
    expect(directive(policy, "connect-src")).toEqual(["'self'", "http://127.0.0.1:54321", "ws://127.0.0.1:54321"]);
    expect(policy).not.toContain("upgrade-insecure-requests");
  });

  it("upgrades insecure requests in production on https", () => {
    expect(contentSecurityPolicy({ supabaseUrl: "https://abcd.supabase.co" })).toContain("upgrade-insecure-requests");
  });

  it("lets Turnstile load and render its challenge frame", () => {
    const policy = contentSecurityPolicy({});
    expect(directive(policy, "script-src")).toContain("https://challenges.cloudflare.com");
    expect(directive(policy, "frame-src")).toEqual(["https://challenges.cloudflare.com"]);
  });

  it("forbids framing, plugins and eval outside development", () => {
    const policy = contentSecurityPolicy({ supabaseUrl: "https://abcd.supabase.co" });
    expect(directive(policy, "frame-ancestors")).toEqual(["'none'"]);
    expect(directive(policy, "object-src")).toEqual(["'none'"]);
    expect(directive(policy, "script-src")).not.toContain("'unsafe-eval'");
    expect(directive(contentSecurityPolicy({ dev: true }), "script-src")).toContain("'unsafe-eval'");
  });
});

describe("securityHeaders", () => {
  it("sets the usual hardening headers", () => {
    const keys = securityHeaders({}).map((header) => header.key);
    expect(keys).toEqual([
      "Content-Security-Policy",
      "Referrer-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Permissions-Policy",
      "Strict-Transport-Security",
    ]);
  });
});
