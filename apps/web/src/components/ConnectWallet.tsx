"use client";

import { useAccount, useConnect, useDisconnect } from "wagmi";

export function ConnectWallet() {
  const { address, isConnected, chainId } = useAccount();
  const { connect, connectors, isPending, error } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    return (
      <div className="wallet">
        <span>
          Connected: {address.slice(0, 6)}...{address.slice(-4)} (chain {chainId})
        </span>
        <button type="button" onClick={() => disconnect()}>
          Disconnect
        </button>
      </div>
    );
  }

  const injectedConnector = connectors.find((connector) => connector.id === "injected") ?? connectors[0];

  return (
    <div className="wallet">
      <button
        type="button"
        onClick={() => injectedConnector && connect({ connector: injectedConnector })}
        disabled={!injectedConnector || isPending}
      >
        {isPending ? "Connecting..." : "Connect Wallet"}
      </button>
      {error && <span className="error-text">{error.message}</span>}
    </div>
  );
}
