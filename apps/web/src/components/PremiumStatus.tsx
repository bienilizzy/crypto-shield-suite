"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { usePremiumStatus } from "@/lib/usePremiumStatus";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface CheckoutResponse {
  url?: string;
  error?: string;
}

export function PremiumStatus() {
  const { address } = useAccount();
  const { isPremium, isLoading } = usePremiumStatus();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!address || isLoading) return null;

  async function redirectTo(path: "checkout" | "portal") {
    if (!address) return;
    setPending(true);
    setError(null);

    try {
      const body =
        path === "checkout"
          ? {
              walletAddress: address,
              successUrl: `${window.location.origin}${window.location.pathname}?checkout=success`,
              cancelUrl: `${window.location.origin}${window.location.pathname}?checkout=cancelled`,
            }
          : { walletAddress: address, returnUrl: window.location.href };

      const res = await fetch(`${API_URL}/billing/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as CheckoutResponse;
      if (!res.ok || !data.url) throw new Error(data.error ?? `Request failed: ${res.status}`);

      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setPending(false);
    }
  }

  return (
    <div className="premium-status">
      {isPremium ? (
        <>
          <span className="premium-badge">Premium</span>
          <button type="button" onClick={() => redirectTo("portal")} disabled={pending}>
            {pending ? "Loading..." : "Manage subscription"}
          </button>
        </>
      ) : (
        <button type="button" onClick={() => redirectTo("checkout")} disabled={pending}>
          {pending ? "Loading..." : "Upgrade to Premium"}
        </button>
      )}
      {error && <span className="error-text">{error}</span>}
    </div>
  );
}
