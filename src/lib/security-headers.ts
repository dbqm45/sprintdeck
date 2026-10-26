/**
 * Security headers for every response (wired in next.config.ts).
 *
 * The Content Security Policy is static — no nonces. Nonces need every page
 * rendered per request, which turns off Partial Prerendering and the static
 * shells this app relies on (cacheComponents). Without nonces Next.js needs
 * 'unsafe-inline' for its inline bootstrap scripts, and React's style
 * attributes need it for styles. What the policy still enforces: scripts only
 * from this origin and Cloudflare Turnstile, network requests only to this
 * origin and Supabase, no framing of the app, no plugins, no <base> hijacking.
 */

const TURNSTILE = "https://challenges.cloudflare.com";

export interface SecurityHeaderOptions {
  /** NEXT_PUBLIC_SUPABASE_URL — the API and its realtime websocket. */
  supabaseUrl?: string;
  /** `next dev` needs eval for React's debugging. */
  dev?: boolean;
}

export function contentSecurityPolicy({ supabaseUrl, dev = false }: SecurityHeaderOptions): string {
  const supabase = supabaseUrl ? new URL(supabaseUrl).origin : "";
  const realtime = supabase.replace(/^http/, "ws");
  const secure = supabase === "" || supabase.startsWith("https:");

  const directives: Record<string, string[]> = {
    "default-src": ["'self'"],
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : []), TURNSTILE],
    "style-src": ["'self'", "'unsafe-inline'"],
    "img-src": ["'self'", "data:", "blob:"],
    "font-src": ["'self'"],
    "connect-src": ["'self'", ...(supabase ? [supabase, realtime] : [])],
    "frame-src": [TURNSTILE],
    "object-src": ["'none'"],
    "base-uri": ["'self'"],
    "form-action": ["'self'"],
    "frame-ancestors": ["'none'"],
  };

  const policy = Object.entries(directives).map(([name, sources]) => `${name} ${sources.join(" ")}`);
  // Only where the backend itself is on https: upgrading a local http Supabase would break it.
  if (secure && !dev) policy.push("upgrade-insecure-requests");
  return policy.join("; ");
}

export function securityHeaders(options: SecurityHeaderOptions): { key: string; value: string }[] {
  return [
    { key: "Content-Security-Policy", value: contentSecurityPolicy(options) },
    // Room links carry the room code: other sites only ever see our origin.
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
    { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  ];
}
