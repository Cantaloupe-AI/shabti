"use client";

import { useState, FormEvent } from "react";
import { useSearchParams, useRouter } from "next/navigation";

export function LoginForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const searchParams = useSearchParams();
  const router = useRouter();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        const next = searchParams.get("next") || "/";
        router.push(next);
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Invalid password");
      }
    } catch {
      setError("Connection error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        padding: "1rem",
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          width: "100%",
          maxWidth: "360px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
        }}
      >
        <h1
          style={{
            fontSize: "1.25rem",
            color: "var(--text)",
            textAlign: "center",
            marginBottom: "0.5rem",
          }}
        >
          𓂀 NanoClaw
        </h1>

        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoFocus
          required
          style={{
            padding: "0.75rem 1rem",
            background: "var(--surface)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
            color: "var(--text)",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            outline: "none",
          }}
        />

        <button
          type="submit"
          disabled={loading}
          style={{
            padding: "0.75rem 1rem",
            background: "var(--accent)",
            border: "none",
            borderRadius: "6px",
            color: "#fff",
            fontSize: "0.875rem",
            fontFamily: "inherit",
            cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.7 : 1,
          }}
        >
          {loading ? "Signing in…" : "Sign in"}
        </button>

        {error && (
          <p
            style={{
              color: "var(--error)",
              fontSize: "0.8rem",
              textAlign: "center",
              margin: 0,
            }}
          >
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
