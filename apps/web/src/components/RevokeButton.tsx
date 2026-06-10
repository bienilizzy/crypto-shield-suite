"use client";

import { erc20Abi, erc721Abi, type Address } from "viem";
import { useAccount, usePublicClient, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import type { ApprovalRecord } from "@crypto-shield/types";
import { usePremiumStatus } from "@/lib/usePremiumStatus";
import type { wagmiConfig } from "@/lib/wagmi";

type SupportedChainId = (typeof wagmiConfig)["chains"][number]["id"];

// Premium revokes get a boosted EIP-1559 priority fee so they're more likely
// to land in the next block ahead of other pending transactions. This is the
// only "priority" lever a dApp can pull - actually routing through a private
// mempool (e.g. Flashbots Protect) requires the *user* to configure that RPC
// in their wallet, since wagmi/viem send transactions via the wallet's own
// provider.
const PRIORITY_FEE_MULTIPLIER = 150n; // 150% = +50%

export function RevokeButton({ approval }: { approval: ApprovalRecord }) {
  const { address, chainId } = useAccount();
  const { writeContract, data: hash, isPending, error } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });
  const { isPremium } = usePremiumStatus();
  const publicClient = usePublicClient({ chainId: approval.chainId as SupportedChainId });

  const isOwner = address?.toLowerCase() === approval.ownerAddress.toLowerCase();
  const isCorrectChain = chainId === approval.chainId;

  async function getPriorityFeeOverrides() {
    if (!isPremium || !publicClient) return {};

    try {
      const fees = await publicClient.estimateFeesPerGas();
      if (fees.maxFeePerGas === undefined || fees.maxPriorityFeePerGas === undefined) return {};

      return {
        maxFeePerGas: (fees.maxFeePerGas * PRIORITY_FEE_MULTIPLIER) / 100n,
        maxPriorityFeePerGas: (fees.maxPriorityFeePerGas * PRIORITY_FEE_MULTIPLIER) / 100n,
      };
    } catch {
      return {};
    }
  }

  async function handleRevoke() {
    const tokenAddress = approval.tokenAddress as Address;
    const spenderAddress = approval.spenderAddress as Address;
    const feeOverrides = await getPriorityFeeOverrides();

    if (approval.tokenType === "ERC20") {
      writeContract({
        address: tokenAddress,
        abi: erc20Abi,
        functionName: "approve",
        args: [spenderAddress, 0n],
        ...feeOverrides,
      });
    } else {
      writeContract({
        address: tokenAddress,
        abi: erc721Abi,
        functionName: "setApprovalForAll",
        args: [spenderAddress, false],
        ...feeOverrides,
      });
    }
  }

  if (isConfirmed) {
    return <span className="revoked">Revoked</span>;
  }

  if (!address) {
    return <span className="error-text">Connect wallet</span>;
  }

  if (!isOwner || !isCorrectChain) {
    return (
      <span className="error-text">
        Switch to {approval.ownerAddress.slice(0, 6)}...{approval.ownerAddress.slice(-4)} on chain{" "}
        {approval.chainId}
      </span>
    );
  }

  return (
    <div>
      <button type="button" onClick={handleRevoke} disabled={isPending || isConfirming}>
        {isPending ? "Confirm in wallet..." : isConfirming ? "Revoking..." : isPremium ? "Revoke (priority)" : "Revoke"}
      </button>
      {error && <div className="error-text">{error.message}</div>}
    </div>
  );
}
