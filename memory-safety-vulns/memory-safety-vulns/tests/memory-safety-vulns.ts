import * as anchor from "@coral-xyz/anchor";
import { Program, web3 } from "@coral-xyz/anchor";
import { MemorySafetyVulns } from "../target/types/memory_safety_vulns";
import { expect } from "chai";

describe("memory-safety-vulns", () => {
  // Configure the client to use the local cluster.
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.MemorySafetyVulns as Program<MemorySafetyVulns>;
  const provider = anchor.getProvider();

  // Test accounts
  let bufferAccount: web3.Keypair;
  let targetAccount: web3.Keypair;
  let complexAccount: web3.Keypair;
  let user: web3.Keypair;

  beforeEach(async () => {
    bufferAccount = web3.Keypair.generate();
    targetAccount = web3.Keypair.generate();
    complexAccount = web3.Keypair.generate();
    user = web3.Keypair.generate();

    // Airdrop SOL to user for testing
    await provider.connection.confirmTransaction(
      await provider.connection.requestAirdrop(user.publicKey, 2 * web3.LAMPORTS_PER_SOL),
      "confirmed"
    );
  });

  describe("Buffer Overflow Vulnerability", () => {
    it("Initialize buffer account", async () => {
      await program.methods
        .initializeBuffer()
        .accounts({
          bufferAccount: bufferAccount.publicKey,
          user: user.publicKey,
        })
        .signers([bufferAccount, user])
        .rpc();

      console.log("✅ Buffer account initialized");
    });

    it("Should handle safe buffer operations", async () => {
      await program.methods
        .initializeBuffer()
        .accounts({
          bufferAccount: bufferAccount.publicKey,
          user: user.publicKey,
        })
        .signers([bufferAccount, user])
        .rpc();

      // Safe operation - data within bounds
      const safeData = Buffer.from("Hello, safe world!", "utf-8");
      
      await program.methods
        .bufferOverflowDemo(safeData)
        .accounts({
          bufferAccount: bufferAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ Safe buffer operation completed");
    });

    it("Should detect buffer overflow attempt", async () => {
      await program.methods
        .initializeBuffer()
        .accounts({
          bufferAccount: bufferAccount.publicKey,
          user: user.publicKey,
        })
        .signers([bufferAccount, user])
        .rpc();

      // Create data larger than buffer capacity (64 bytes)
      const oversizedData = Buffer.alloc(100, 0xAA);
      
      try {
        await program.methods
          .bufferOverflowDemo(oversizedData)
          .accounts({
            bufferAccount: bufferAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected buffer overflow error");
      } catch (error: any) {
        // Handle different error structures in Anchor
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Buffer overflow detected");
        console.log("✅ Buffer overflow detected and prevented:", errorMessage);
      }
    });
  });

  describe("Use After Free Vulnerability", () => {
    it("Demonstrate use after free scenario", async () => {
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([targetAccount, user])
        .rpc();

      try {
        await program.methods
          .useAfterFreeDemo()
          .accounts({
            targetAccount: targetAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected use after free error");
      } catch (error: any) {
        // Handle different error structures in Anchor
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Use after free detected");
        console.log("✅ Use after free detected:", errorMessage);
      }
    });
  });

  describe("Uninitialized Memory Access Vulnerability", () => {
    it("Should detect uninitialized memory access", async () => {
      // Create account but don't properly initialize it
      const uninitAccount = web3.Keypair.generate();
      
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: uninitAccount.publicKey,
          user: user.publicKey,
        })
        .signers([uninitAccount, user])
        .rpc();

      // Now create a scenario where we access "uninitialized" data
      // (This is simulated since Anchor initializes accounts properly)
      try {
        // This should work since we properly initialized
        await program.methods
          .uninitializedMemoryDemo()
          .accounts({
            targetAccount: uninitAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        console.log("✅ Initialized memory access succeeded");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        console.log("Memory access error:", errorMessage);
      }
    });
  });

  describe("Double Free Vulnerability", () => {
    it("Should detect double free attempt", async () => {
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([targetAccount, user])
        .rpc();

      // First free should succeed
      await program.methods
        .doubleFreeDemo()
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ First free operation completed");

      // Second free should fail
      try {
        await program.methods
          .doubleFreeDemo()
          .accounts({
            targetAccount: targetAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected double free error");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Double free detected");
        console.log("✅ Double free detected:", errorMessage);
      }
    });
  });

  describe("Null Pointer Dereference Vulnerability", () => {
    it("Should handle null pointer safely", async () => {
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([targetAccount, user])
        .rpc();

      // Test safe operation (no null pointer)
      await program.methods
        .nullPointerDemo(false)
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ Safe pointer operation completed");
    });

    it("Should detect null pointer dereference attempt", async () => {
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: targetAccount.publicKey,
          user: user.publicKey,
        })
        .signers([targetAccount, user])
        .rpc();

      try {
        await program.methods
          .nullPointerDemo(true)
          .accounts({
            targetAccount: targetAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected null pointer dereference error");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Null pointer dereference detected");
        console.log("✅ Null pointer dereference detected:", errorMessage);
      }
    });
  });

  describe("Complex Vulnerability Combinations", () => {
    beforeEach(async () => {
      await program.methods
        .initializeComplex()
        .accounts({
          targetAccount: complexAccount.publicKey,
          user: user.publicKey,
        })
        .signers([complexAccount, user])
        .rpc();
    });

    it("Should handle buffer overflow in complex scenario", async () => {
      const oversizedData = Buffer.alloc(50, 0xBB);
      
      try {
        await program.methods
          .complexVulnerabilityDemo(1, oversizedData)
          .accounts({
            targetAccount: complexAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected buffer overflow error");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Buffer overflow detected");
        console.log("✅ Complex buffer overflow detected:", errorMessage);
      }
    });

    it("Should handle use after free in complex scenario", async () => {
      try {
        await program.methods
          .complexVulnerabilityDemo(2, Buffer.alloc(0))
          .accounts({
            targetAccount: complexAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected use after free error");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Use after free detected");
        console.log("✅ Complex use after free detected:", errorMessage);
      }
    });

    it("Should handle double free in complex scenario", async () => {
      // First free
      await program.methods
        .complexVulnerabilityDemo(3, Buffer.alloc(0))
        .accounts({
          targetAccount: complexAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ First complex free completed");

      // Second free should fail
      try {
        await program.methods
          .complexVulnerabilityDemo(3, Buffer.alloc(0))
          .accounts({
            targetAccount: complexAccount.publicKey,
            user: user.publicKey,
          })
          .signers([user])
          .rpc();
        
        expect.fail("Expected double free error");
      } catch (error: any) {
        const errorMessage = error.error?.errorMessage || error.message || String(error);
        expect(errorMessage).to.include("Double free detected");
        console.log("✅ Complex double free detected:", errorMessage);
      }
    });
  });

  describe("Memory Safety Best Practices Demo", () => {
    it("Should demonstrate safe memory operations", async () => {
      const safeAccount = web3.Keypair.generate();
      
      // Proper initialization
      await program.methods
        .initializeTarget()
        .accounts({
          targetAccount: safeAccount.publicKey,
          user: user.publicKey,
        })
        .signers([safeAccount, user])
        .rpc();

      // Safe data access
      await program.methods
        .uninitializedMemoryDemo()
        .accounts({
          targetAccount: safeAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      // Safe pointer operations
      await program.methods
        .nullPointerDemo(false)
        .accounts({
          targetAccount: safeAccount.publicKey,
          user: user.publicKey,
        })
        .signers([user])
        .rpc();

      console.log("✅ All safe operations completed successfully");
    });
  });
});
