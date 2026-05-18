const BASE_URL = process.env.VISOMA_BASE_URL?.replace(/\/$/, "");
const USERNAME = process.env.VISOMA_USERNAME;
const PASSWORD = process.env.VISOMA_PASSWORD;

export class SessionExpiredError extends Error {
  constructor() {
    super("Visoma session expired — re-login required");
    this.name = "SessionExpiredError";
  }
}

export class VisomaSession {
  private cookies: Record<string, string> = {};
  private loggedIn = false;

  async ensureLoggedIn(): Promise<void> {
    if (!this.loggedIn) {
      await this.login();
    }
  }

  async login(): Promise<void> {
    if (!BASE_URL || !USERNAME || !PASSWORD) {
      throw new Error(
        "VISOMA_BASE_URL, VISOMA_USERNAME, and VISOMA_PASSWORD are required for Ghostwriter tools. " +
        "VISOMA_USERNAME/PASSWORD must be a service account with 2FA disabled."
      );
    }

    // Step 1: GET login page — collect initial cookies and CSRF token
    const loginPageRes = await fetch(`${BASE_URL}/site/login`, {
      method: "GET",
      redirect: "manual",
      headers: { Cookie: this.cookieHeader() },
    });
    this.mergeCookies(
      (loginPageRes.headers as Headers & { getSetCookie(): string[] }).getSetCookie?.() ?? []
    );
    const html = await loginPageRes.text();

    // Extract CSRF token from hidden input or meta tag
    const csrfMatch =
      html.match(/<input[^>]+name="YII_CSRF_TOKEN"[^>]+value="([^"]+)"/) ||
      html.match(/name="csrf-token"[^>]+content="([^"]+)"/) ||
      html.match(/content="([^"]+)"[^>]+name="csrf-token"/);
    if (!csrfMatch) {
      throw new Error("Could not extract CSRF token from Visoma login page");
    }
    const csrfToken = csrfMatch[1];

    // Step 2: POST credentials
    const body = new URLSearchParams({
      "LoginForm[username]": USERNAME,
      "LoginForm[password]": PASSWORD,
      "LoginForm[rememberMe]": "1",
      YII_CSRF_TOKEN: csrfToken,
    });

    const loginRes = await fetch(`${BASE_URL}/site/login`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Cookie: this.cookieHeader(),
      },
      body: body.toString(),
    });
    this.mergeCookies(
      (loginRes.headers as Headers & { getSetCookie(): string[] }).getSetCookie?.() ?? []
    );

    if (loginRes.status !== 302) {
      throw new Error(
        `Visoma login failed: expected HTTP 302 redirect, got ${loginRes.status}. ` +
        "Check VISOMA_USERNAME/PASSWORD and ensure 2FA is disabled for this account."
      );
    }

    this.loggedIn = true;
  }

  async postForm(
    path: string,
    params: URLSearchParams
  ): Promise<{ status: number; body: string }> {
    if (!BASE_URL) throw new Error("VISOMA_BASE_URL is required");

    // Auto-append _csrf from cookie jar if available — work on a copy, don't mutate caller's params
    const formBody = new URLSearchParams(params);
    const csrfCookie = this.cookies["YII_CSRF_TOKEN"];
    if (csrfCookie && !formBody.has("_csrf")) {
      formBody.append("_csrf", csrfCookie);
    }

    const res = await fetch(`${BASE_URL}${path}`, {
      method: "POST",
      redirect: "manual",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
        "X-Requested-With": "XMLHttpRequest",
        Cookie: this.cookieHeader(),
      },
      body: formBody.toString(),
    });
    this.mergeCookies(
      (res.headers as Headers & { getSetCookie(): string[] }).getSetCookie?.() ?? []
    );

    if (res.status === 302) {
      const location = res.headers.get("location") ?? "";
      if (location.includes("/site/login")) {
        this.loggedIn = false;
        throw new SessionExpiredError();
      }
      // Other 302s are unexpected but non-fatal — treat as success
    }

    if (res.status !== 200 && res.status !== 302) {
      throw new Error(`HTTP ${res.status} for POST ${path}`);
    }

    const body = await res.text();
    return { status: res.status, body };
  }

  private mergeCookies(setCookieHeaders: string[]): void {
    for (const header of setCookieHeaders) {
      const [pair] = header.split(";");
      const eqIdx = pair.indexOf("=");
      if (eqIdx === -1) continue;
      const name = pair.slice(0, eqIdx).trim();
      const value = pair.slice(eqIdx + 1).trim();
      this.cookies[name] = value;
    }
  }

  private cookieHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}
