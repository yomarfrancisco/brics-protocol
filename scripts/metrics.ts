import { ethers } from "hardhat";

export interface MetricsAdapter {
  getAvailableInstantCapacity: (address: string) => Promise<bigint>;
  getSovereignUtilBps: (address: string, sovereignCode: string) => Promise<number>;
  getEmergencyLevel: (address: string) => Promise<number>;
  getDegradationLevel: (address: string) => Promise<number>;
  getIssuanceLocked: (address: string) => Promise<boolean>;
}

export class BRICSMetricsAdapter implements MetricsAdapter {
  async getAvailableInstantCapacity(address: string): Promise<bigint> {
    const preBuffer = await ethers.getContractAt("PreTrancheBuffer", address);
    const status = await preBuffer.getBufferStatus();
    return status.availableInstantCapacity;
  }

  async getSovereignUtilBps(address: string, sovereignCode: string): Promise<number> {
    const ic = await ethers.getContractAt("IssuanceControllerV3", address);
    const sovereignCodeBytes = ethers.encodeBytes32String(sovereignCode);
    const utilization = await ic.getSovereignUtilization(sovereignCodeBytes);
    
    // Convert to basis points (assuming utilization is in USDC 1e6)
    // This is a simplified calculation - adjust based on actual contract logic
    const softCap = await ic.sovereignSoftCap(sovereignCodeBytes);
    if (softCap === 0n) return 0;
    
    return Number((utilization * 10000n) / softCap);
  }

  async getEmergencyLevel(address: string): Promise<number> {
    const config = await ethers.getContractAt("ConfigRegistry", address);
    const params = await config.getEmergencyParams();
    return Number(params.level);
  }

  async getDegradationLevel(address: string): Promise<number> {
    const oracle = await ethers.getContractAt("NAVOracleV3", address);
    return Number(await oracle.getDegradationLevel());
  }

  async getIssuanceLocked(address: string): Promise<boolean> {
    const tm = await ethers.getContractAt("TrancheManagerV2", address);
    // This would need to be implemented based on actual contract interface
    // For now, return false as placeholder
    return false;
  }
}

// Export singleton instance
export const metricsAdapter = new BRICSMetricsAdapter();
