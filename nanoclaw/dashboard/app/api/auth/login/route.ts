import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

const THIRTY_DAYS = 30 * 24 * 60 * 60;

export async function POST(req: NextRequest) {
  // Always delay 1 second to mitigate brute force
  await new Promise((r) => setTimeout(r, 1000));

  const password = process.env.DASHBOARD_PASSWORD;

  if (!password) {
    return NextResponse.json(
      { error: "Server misconfigured" },
      { status: 500 }
    );
  }

  let body: { password?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (!body.password || typeof body.password !== "string") {
    return NextResponse.json({ error: "Password required" }, { status: 400 });
  }

  // Hash both to fixed length, then constant-time compare
  const inputHash = crypto
    .createHash("sha256")
    .update(body.password)
    .digest();
  const expectedHash = crypto
    .createHash("sha256")
    .update(password)
    .digest();

  if (!crypto.timingSafeEqual(inputHash, expectedHash)) {
    return NextResponse.json({ error: "Invalid password" }, { status: 401 });
  }

  // Build signed token: base64url(payload).base64url(hmac)
  const payload = {
    iat: Date.now(),
    exp: Date.now() + THIRTY_DAYS * 1000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(payload))
    .toString("base64url");
  const signature = crypto
    .createHmac("sha256", "nanoclaw:" + password)
    .update(payloadB64)
    .digest("base64url");
  const token = `${payloadB64}.${signature}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("auth_token", token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: THIRTY_DAYS,
    path: "/",
  });
  return res;
}
