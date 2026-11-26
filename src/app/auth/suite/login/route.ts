import { connection, type NextRequest } from "next/server";
import { loginUrl, startLogin, suiteConfig } from "@/lib/suite/oidc";
import { LOGIN_COOKIE, callbackUrl } from "@/lib/suite/routes";

/** Starts the suite sign-in (dbqm45/pdi docs/plan-pokoj-sprintdeck.md); 404 when it is off. */
export async function GET(request: NextRequest) {
  // Every response is per request (state, PKCE, cookie): never prerendered, even when the sign-in is off at build.
  await connection();
  const cfg = suiteConfig(process.env);
  if (!cfg) return new Response("Not found", { status: 404 });
  const login = startLogin(request.nextUrl.searchParams.get("next"));
  const res = Response.redirect(loginUrl(cfg, login, callbackUrl(request)), 302);
  const headers = new Headers(res.headers);
  headers.append("set-cookie", `${LOGIN_COOKIE}=${Buffer.from(JSON.stringify(login)).toString("base64url")}; Path=/auth/suite; Max-Age=600; HttpOnly; SameSite=Lax`);
  return new Response(null, { status: 302, headers });
}
