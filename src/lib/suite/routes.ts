import type { NextRequest } from "next/server";
import type { Login } from "./oidc";

/** HttpOnly cookie holding state, PKCE verifier, nonce and the path to return to, for ten minutes. */
export const LOGIN_COOKIE = "sd_suite_login";

/**
 * This app's public address: SPRINTDECK_PUBLIC_URL, else the Host the browser used (`next dev` reports its own
 * origin as localhost even when the page is on 127.0.0.1). The suite accepts only the registered redirect address.
 */
export function publicOrigin(request: NextRequest): string {
  const configured = process.env.SPRINTDECK_PUBLIC_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  const host = request.headers.get("host");
  return host && /^[A-Za-z0-9.-]+(:\d+)?$|^\[[0-9a-f:]+\](:\d+)?$/i.test(host) ? `${request.nextUrl.protocol}//${host}` : request.nextUrl.origin;
}

export const callbackUrl = (request: NextRequest) => `${publicOrigin(request)}/auth/suite/callback`;

export function readLogin(request: NextRequest): Login | null {
  const raw = request.cookies.get(LOGIN_COOKIE)?.value;
  if (!raw) return null;
  try {
    const login = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as Login;
    return typeof login.state === "string" && typeof login.verifier === "string" && typeof login.nonce === "string" ? login : null;
  } catch {
    return null;
  }
}
