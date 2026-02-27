import { NextRequest, NextResponse } from "next/server";

const PUBLIC_PATHS = ["/login", "/api/auth/", "/_next/", "/favicon.ico"];

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  const token = req.cookies.get("auth_token")?.value;
  if (!token) return redirectToLogin(req);

  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return redirectToLogin(req);

  const payloadB64 = token.slice(0, dotIdx);
  const signatureB64 = token.slice(dotIdx + 1);

  const password = process.env.DASHBOARD_PASSWORD;
  if (!password) {
    return new NextResponse("DASHBOARD_PASSWORD not configured", {
      status: 500,
    });
  }

  // Derive signing key from password so we only need one env var
  const secret = new TextEncoder().encode("shabti:" + password);

  // Verify HMAC using Web Crypto API (Edge Runtime)
  const key = await crypto.subtle.importKey(
    "raw",
    secret,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const expectedSig = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payloadB64)
  );
  const expectedB64 = base64url(new Uint8Array(expectedSig));

  // Constant-time comparison via XOR (Edge Runtime lacks timingSafeEqual)
  if (!constantTimeEqual(signatureB64, expectedB64)) {
    return redirectToLogin(req);
  }

  // Check expiration
  try {
    const payload = JSON.parse(atob(fromBase64url(payloadB64)));
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) {
      return redirectToLogin(req);
    }
  } catch {
    return redirectToLogin(req);
  }

  return NextResponse.next();
}

function redirectToLogin(req: NextRequest): NextResponse {
  const url = req.nextUrl.clone();
  const next = url.pathname + url.search;
  url.pathname = "/login";
  url.search = next && next !== "/" ? `?next=${encodeURIComponent(next)}` : "";
  return NextResponse.redirect(url);
}

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64url(s: string): string {
  return s.replace(/-/g, "+").replace(/_/g, "/");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}
