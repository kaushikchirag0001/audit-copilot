"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function AuthPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/");
    });
  }, [router, supabase.auth]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    if (mode === "signup") {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
      } else if (data.session) {
        router.replace("/");
        router.refresh();
      } else {
        setMessage("Account created. Check your email to confirm your account.");
      }
    } else {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (loginError) {
        setError(loginError.message);
      } else {
        router.replace("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f7f8f5] px-5 py-10 text-[#173b35]">
      <section className="w-full max-w-md rounded-3xl border border-[#dfe7df] bg-white p-6 shadow-[0_12px_35px_rgba(34,72,59,0.08)] sm:p-8">
        <div className="mb-8 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1f6255] text-xl font-bold text-white">
            A
          </div>
          <h1 className="mt-4 text-2xl font-bold">Audit Copilot</h1>
          <p className="mt-2 text-sm leading-6 text-[#71877c]">
            {mode === "login"
              ? "Sign in to create and save your audit documents."
              : "Create your free account to get started."}
          </p>
        </div>

        <div className="mb-6 grid grid-cols-2 rounded-xl bg-[#f1f6f1] p-1">
          <button
            type="button"
            onClick={() => {
              setMode("login");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              mode === "login" ? "bg-white text-[#1f6255] shadow-sm" : "text-[#789087]"
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={() => {
              setMode("signup");
              setError("");
              setMessage("");
            }}
            className={`rounded-lg px-3 py-2 text-sm font-bold transition ${
              mode === "signup" ? "bg-white text-[#1f6255] shadow-sm" : "text-[#789087]"
            }`}
          >
            Sign up
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === "signup" && (
            <div>
              <label className="mb-2 block text-sm font-bold" htmlFor="fullName">
                Full name
              </label>
              <input
                id="fullName"
                required
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73] focus:ring-4 focus:ring-[#dff0e5]"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="email">
              Email address
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73] focus:ring-4 focus:ring-[#dff0e5]"
              placeholder="you@company.com"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold" htmlFor="password">
              Password
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-[#d6e2d8] px-3 py-3 text-sm outline-none focus:border-[#3b8a73] focus:ring-4 focus:ring-[#dff0e5]"
              placeholder="At least 6 characters"
            />
          </div>

          {error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm leading-5 text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-xl bg-[#e8f5eb] px-4 py-3 text-sm leading-5 text-[#287052]">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#1f6255] px-5 py-3.5 text-sm font-bold text-white transition hover:bg-[#174d43] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Please wait..." : mode === "login" ? "Sign in" : "Create free account"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-5 text-[#8b9c94]">
          Your documents will be stored securely in your account.
        </p>
      </section>
    </main>
  );
}
