"use client";

import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface BillingStatus {
  isPremium: boolean;
  status: string;
  currentPeriodEnd: string | null;
}

export function usePremiumStatus() {
  const { address } = useAccount();

  const query = useQuery({
    queryKey: ["billing-status", address],
    queryFn: async (): Promise<BillingStatus> => {
      const res = await fetch(`${API_URL}/billing/status/${address}`);
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
      return res.json();
    },
    enabled: Boolean(address),
  });

  return {
    isPremium: query.data?.isPremium ?? false,
    status: query.data?.status ?? "inactive",
    isLoading: query.isLoading,
  };
}
