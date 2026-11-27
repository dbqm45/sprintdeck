import { connection, type NextRequest } from "next/server";
import { checkClaims, decodeClaims, exchangeCode, safeNext, suiteConfig, supabaseSession } from "@/lib/suite/oidc";
import { LOGIN_COOKIE, callbackUrl, publicOrigin, readLogin } from "@/lib/suite/routes";

const CLEAR = `${LOGIN_COOKIE}=; Path=/auth/suite; Max-Age=0; HttpOnly; SameSite=Lax`;

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { location, "set-cookie": CLEAR, "cache-control": "no-store" } });
}

/**
 * The suite answers here: the code becomes an ID token (client secret, PKCE), Supabase Auth turns it into a session,
 * and only a member of the organization with the role `member` gets that session. The tokens go to the browser in the
 * fragment of `/auth/suite/done`, so no server log sees them; nothing here logs a token.
 */
export async function GET(request: NextRequest) {
  // Every response is per request (state, PKCE, cookie): never prerendered, even when the sign-in is off at build.
  await connection();
  const cfg = suiteConfig(process.env);
  if (!cfg) return new Response("Not found", { status: 404 });
  const origin = publicOrigin(request);
  const params = request.nextUrl.searchParams;
  const login = readLogin(request);
  if (!login || params.get("state") !== login.state || !params.get("code")) return redirect(`${origin}/auth/suite/done#error=failed`);
  try {
    // The ID token comes straight from the suite's token endpoint, exchanged with the client secret (OIDC Core
    // 3.1.3.7), so its organization and role are checked before any account exists in Supabase; Supabase Auth then
    // verifies the same token (keys, issuer, audience, nonce) before it opens a session.
    const idToken = await exchangeCode(cfg, params.get("code")!, login, callbackUrl(request));
    const check = checkClaims(decodeClaims(idToken), cfg);
    if (!check.ok) return redirect(`${origin}/auth/suite/done#error=${check.reason}`);
    const session = await supabaseSession(cfg, idToken, login.nonce);
    const fragment = new URLSearchParams({ access_token: session.access_token, refresh_token: session.refresh_token, name: check.name, next: safeNext(login.next) });
    return redirect(`${origin}/auth/suite/done#${fragment}`);
  } catch (error) {
    console.error(`suite sign-in failed: ${error instanceof Error ? error.message : "unknown error"}`);
    return redirect(`${origin}/auth/suite/done#error=failed`);
  }
}
