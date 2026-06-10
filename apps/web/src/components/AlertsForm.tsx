"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { usePremiumStatus } from "@/lib/usePremiumStatus";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export function AlertsForm({ chainId }: { chainId: number }) {
  const { address } = useAccount();
  const { isPremium } = usePremiumStatus();
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  if (!address || !isPremium) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setStatus(null);

    try {
      const res = await fetch(`${API_URL}/alerts/watch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ walletAddress: address, chainId, email }),
      });

      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.error ?? `Request failed: ${res.status}`);

      setStatus("Alerts enabled — we'll email you when a new approval appears on this wallet.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="alerts-form">
      <label htmlFor="alert-email">Email me about new approvals on your connected wallet:</label>
      <div className="alerts-form-row">
        <input
          id="alert-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          required
        />
        <button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Enable alerts"}
        </button>
      </div>
      {status && <p className="recommendation">{status}</p>}
    </form>
  );
}
