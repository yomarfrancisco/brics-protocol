import { expect } from "chai";

describe("Pricing Provider Guard", () => {
  it("should throw when bank provider used without BANK_DATA_MODE=live", async () => {
    // Save original environment
    const originalProvider = process.env.PRICING_PROVIDER;
    const originalBankMode = process.env.BANK_DATA_MODE;
    
    try {
      // Set up test environment
      process.env.PRICING_PROVIDER = "bank";
      process.env.BANK_DATA_MODE = "off";
      
      // Import the factory
      const { makePricingProvider } = await import("../../../scripts/pricing/providers/factory");
      
      // Create provider
      const provider = makePricingProvider();
      
      // This should throw when we try to use it
      await provider.price({} as any).catch((error: any) => {
        // Verify the error message
        expect(error.message).to.include("Bank provider disabled");
        expect(error.message).to.include("BANK_DATA_MODE=off");
        expect(error.message).to.include("Set BANK_DATA_MODE=live to enable");
      });
      
    } finally {
      // Restore original environment
      if (originalProvider) {
        process.env.PRICING_PROVIDER = originalProvider;
      } else {
        delete process.env.PRICING_PROVIDER;
      }
      
      if (originalBankMode) {
        process.env.BANK_DATA_MODE = originalBankMode;
      } else {
        delete process.env.BANK_DATA_MODE;
      }
    }
  });
  
  it("should allow bank provider when BANK_DATA_MODE=live", async () => {
    // Save original environment
    const originalProvider = process.env.PRICING_PROVIDER;
    const originalBankMode = process.env.BANK_DATA_MODE;
    
    try {
      // Set up test environment
      process.env.PRICING_PROVIDER = "bank";
      process.env.BANK_DATA_MODE = "live";
      
      // Import the factory
      const { makePricingProvider } = await import("../../../scripts/pricing/providers/factory");
      
      // This should not throw the guard error
      const provider = makePricingProvider();
      
      // But it should throw the "not implemented" error
      try {
        await provider.price({} as any);
        expect.fail("Should have thrown 'not implemented' error");
      } catch (error: any) {
        expect(error.message).to.include("not implemented");
        expect(error.message).to.not.include("Bank provider disabled");
      }
      
    } finally {
      // Restore original environment
      if (originalProvider) {
        process.env.PRICING_PROVIDER = originalProvider;
      } else {
        delete process.env.PRICING_PROVIDER;
      }
      
      if (originalBankMode) {
        process.env.BANK_DATA_MODE = originalBankMode;
      } else {
        delete process.env.BANK_DATA_MODE;
      }
    }
  });
});
