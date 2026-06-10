import { SimulationRequest, SimulationResult } from "@crypto-shield/types";

// TODO (Week 4): replace with the Tenderly Simulation API
// (https://docs.tenderly.co/simulations/single-simulations), decoding the
// returned trace/state-diff into `newApprovals` and `tokenTransfers`.
export async function simulateTransaction(request: SimulationRequest): Promise<SimulationResult> {
  return {
    chainId: request.chainId,
    success: true,
    newApprovals: [],
    tokenTransfers: [],
    touchedTokenAddresses: [],
  };
}
