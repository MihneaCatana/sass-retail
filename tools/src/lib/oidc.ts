import crypto from "node:crypto";

/** Shared OIDC helpers for the verification scripts (same flow a browser does). */
export const BASE = "http://localhost:8082";
export const ISSUER = `${BASE}/realms/retail`;
export const REDIRECT_URI = BASE;

export function base64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

export function decodeJwtPayload(token: string): Record<string, unknown> {
  const part = token.split(".")[1];
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
}

class HttpSession {
  private cookies = new Map<string, string>();

  private applyCookies(response: Response): void {
    const setCookies = response.headers.getSetCookie?.() ?? [];
    for (const cookie of setCookies) {
      const [pair] = cookie.split(";");
      const eq = pair.indexOf("=");
      if (eq > 0) this.cookies.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
    }
  }

  private cookieHeader(): string {
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
  }

  async request(url: string, init: RequestInit = {}): Promise<Response> {
    const headers = new Headers(init.headers);
    const jar = this.cookieHeader();
    if (jar) headers.set("Cookie", jar);
    const response = await fetch(url, { ...init, headers, redirect: "manual" });
    this.applyCookies(response);
    return response;
  }
}

interface HiddenInput {
  name: string;
  value: string;
}

function parseLoginForm(html: string): { action: string; hidden: HiddenInput[] } {
  const formMatch = /<form[^>]*id="kc-form-login"[^>]*action="([^"]*)"/.exec(html);
  if (!formMatch) throw new Error("Keycloak login form not found");
  const action = formMatch[1].replace(/&amp;/g, "&");

  const hidden: HiddenInput[] = [];
  for (const tag of html.matchAll(/<input\b[^>]*>/g)) {
    const input = tag[0];
    if (!/type=("hidden"|hidden)/.test(input)) continue;
    const name = /name="([^"]*)"/.exec(input)?.[1];
    const value = /value="([^"]*)"/.exec(input)?.[1] ?? "";
    if (name) hidden.push({ name, value });
  }
  return { action, hidden };
}

export async function loginAndGetToken(username: string, password: string): Promise<{ accessToken: string }> {
  const discovery = (await (await fetch(`${ISSUER}/.well-known/openid-configuration`)).json()) as {
    issuer: string;
    authorization_endpoint: string;
    token_endpoint: string;
  };
  if (discovery.issuer !== ISSUER) {
    throw new Error(`Issuer mismatch: discovery says ${discovery.issuer}, expected ${ISSUER}`);
  }

  const verifier = base64url(crypto.randomBytes(32));
  const challenge = base64url(crypto.createHash("sha256").update(verifier).digest());
  const state = base64url(crypto.randomBytes(16));
  const nonce = base64url(crypto.randomBytes(16));

  const session = new HttpSession();
  const authUrl = new URL(discovery.authorization_endpoint);
  authUrl.searchParams.set("client_id", "retail-web");
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("scope", "openid profile email");
  authUrl.searchParams.set("redirect_uri", REDIRECT_URI);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("code_challenge", challenge);
  authUrl.searchParams.set("code_challenge_method", "S256");

  const loginPage = await session.request(authUrl.toString());
  const html = await loginPage.text();
  const { action, hidden } = parseLoginForm(html);

  const body = new URLSearchParams({ username, password, ...Object.fromEntries(hidden.map((h) => [h.name, h.value])) });
  const loginResponse = await session.request(action, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });

  const location = loginResponse.headers.get("location");
  if (!location) {
    const responseBody = await loginResponse.text();
    const message = /class="alert-error"[^>]*>[\s\S]*?<[^>]*>([^<]+)/.exec(responseBody)?.[1]?.trim();
    throw new Error(
      `Login did not redirect (status ${loginResponse.status}). Message: ${message ?? "(none)"}`
    );
  }
  const callback = new URL(location);
  const code = callback.searchParams.get("code");
  if (callback.searchParams.get("state") !== state) {
    throw new Error(`OIDC state mismatch. Redirect was: ${location}`);
  }
  if (!code) throw new Error("No authorization code in redirect");

  const tokenResponse = await fetch(discovery.token_endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: REDIRECT_URI,
      client_id: "retail-web",
      code_verifier: verifier
    })
  });
  if (!tokenResponse.ok) {
    throw new Error(`Token exchange failed: ${tokenResponse.status} ${await tokenResponse.text()}`);
  }
  const tokens = (await tokenResponse.json()) as { access_token: string };
  return { accessToken: tokens.access_token };
}

export function assert(condition: boolean, label: string): void {
  if (!condition) throw new Error(`ASSERTION FAILED: ${label}`);
  console.log(`ok: ${label}`);
}
