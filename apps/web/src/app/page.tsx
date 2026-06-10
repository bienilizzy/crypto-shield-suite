"use client";

import { useState } from "react";
import { CHAINS, PREMIUM_CHAIN_IDS, type ApprovalRecord, type RiskReport } from "@crypto-shield/types";
import { useAccount } from "wagmi";
import { AlertsForm } from "@/components/AlertsForm";
import { ConnectWallet } from "@/components/ConnectWallet";
import { PremiumStatus } from "@/components/PremiumStatus";
import { RevokeButton } from "@/components/RevokeButton";
import { usePremiumStatus } from "@/lib/usePremiumStatus";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

interface ReportResponse {
  approvals: ApprovalRecord[];
  report: RiskReport;
}

export default function Home() {
  const [chainId, setChainId] = useState("1");
  const [address, setAddress] = useState("");
  const [data, setData] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { address: connectedAddress } = useAccount();
  const { isPremium } = usePremiumStatus();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setData(null);

    try {
      const res = await fetch(`${API_URL}/report/${chainId}/${address}`, {
        headers: connectedAddress ? { "X-Wallet-Address": connectedAddress } : undefined,
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) throw new Error(body?.message ?? body?.error ?? `Request failed: ${res.status}`);
      setData(body as ReportResponse);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="container">
      <h1>Crypto Shield Suite</h1>
      <p>Enter a wallet address to scan its token approvals and the tokens it has approved.</p>

      <ConnectWallet />
      <PremiumStatus />
      <AlertsForm chainId={Number(chainId)} />

      <form onSubmit={handleSubmit} className="search-form">
        <select value={chainId} onChange={(e) => setChainId(e.target.value)}>
          {CHAINS.map((chain) => {
            const locked = PREMIUM_CHAIN_IDS.includes(chain.id) && !isPremium;
            return (
              <option key={chain.id} value={String(chain.id)} disabled={locked}>
                {chain.name}
                {locked ? " (Premium)" : ""}
              </option>
            );
          })}
        </select>
        <input
          type="text"
          placeholder="0x..."
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? "Scanning..." : "Scan"}
        </button>
      </form>

      {error && <p className="error">{error}</p>}

      {data && (
        <section className="report">
          <h2>
            Overall score: {data.report.overallScore}/100 ({data.report.severity})
          </h2>

          <h3>Findings</h3>
          {data.report.findings.length === 0 ? (
            <p>No findings.</p>
          ) : (
            <ul>
              {data.report.findings.map((finding) => (
                <li key={finding.id} className={`severity-${finding.severity}`}>
                  <strong>{finding.title}</strong> &mdash; {finding.description}
                  {finding.recommendation && <div className="recommendation">{finding.recommendation}</div>}
                </li>
              ))}
            </ul>
          )}

          <h3>Approvals</h3>
          {data.approvals.length === 0 ? (
            <p>No active approvals found.</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>Token</th>
                  <th>Spender</th>
                  <th>Allowance</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {data.approvals.map((approval) => (
                  <tr key={`${approval.tokenAddress}-${approval.spenderAddress}`}>
                    <td>{approval.tokenSymbol ?? approval.tokenAddress}</td>
                    <td>{approval.spenderLabel ?? approval.spenderAddress}</td>
                    <td>{approval.isUnlimited ? "Unlimited" : approval.allowance}</td>
                    <td>
                      <RevokeButton approval={approval} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      )}
    </main>
  );
}
