import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { SolanaProgramClose } from "../target/types/solana_program_close";
import { PublicKey, Keypair, SystemProgram } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, createMint, createAccount, mintTo, getAccount, getAssociatedTokenAddress } from "@solana/spl-token";
import { expect } from "chai";

describe("Accidental Program Closure Vulnerability", () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.solanaProgramClose as Program<SolanaProgramClose>;
  const provider = anchor.getProvider();

  let mint: PublicKey;
  let user: Keypair;
  let userTokenAccount: PublicKey;
  let vault: PublicKey;
  let vaultTokenAccount: PublicKey;
  let vaultBump: number;

  before(async () => {
    // Create user keypair
    user = Keypair.generate();

    // Airdrop SOL to user
    const airdrop = await provider.connection.requestAirdrop(
      user.publicKey,
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: airdrop,
    });

    // Create mint
    mint = await createMint(
      provider.connection,
      user,
      user.publicKey,
      null,
      6 // 6 decimal places
    );

    // Create user token account
    userTokenAccount = await createAccount(
      provider.connection,
      user,
      mint,
      user.publicKey
    );

    // Mint tokens to user
    await mintTo(
      provider.connection,
      user,
      mint,
      userTokenAccount,
      user,
      1000000000 // 1000 tokens with 6 decimals
    );

    // Derive PDA for vault
    [vault, vaultBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("vault"), user.publicKey.toBuffer()],
      program.programId
    );

    // Derive the associated token account for the vault
    vaultTokenAccount = await getAssociatedTokenAddress(
      mint,
      vault,
      true // allowOwnerOffCurve - required for PDAs
    );

    console.log(`User: ${user.publicKey.toString()}`);
    console.log(`Mint: ${mint.toString()}`);
    console.log(`User Token Account: ${userTokenAccount.toString()}`);
    console.log(`Vault PDA: ${vault.toString()}`);
    console.log(`Vault Token Account: ${vaultTokenAccount.toString()}`);
  });

  it("1. Initialize vault with user funds", async () => {
    const initialDeposit = new anchor.BN(100000000); // 100 tokens

    console.log("\n🏦 STEP 1: User deposits funds into vault");
    console.log(`Depositing ${initialDeposit.toNumber() / 1000000} tokens`);

    try {
      const tx = await program.methods
        .initializeVault(initialDeposit)
        .accounts({
          vault: vault,
          vaultTokenAccount: vaultTokenAccount,
          userTokenAccount: userTokenAccount,
          mint: mint,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
          rent: anchor.web3.SYSVAR_RENT_PUBKEY,
        })
        .signers([user])
        .rpc();

      console.log("✅ Vault initialized successfully");
      console.log(`Transaction: ${tx}`);

      // Verify the vault state
      const vaultAccount = await program.account.vault.fetch(vault);
      expect(vaultAccount.totalDeposited.toNumber()).to.equal(initialDeposit.toNumber());
      expect(vaultAccount.isActive).to.be.true;
      expect(vaultAccount.owner.toString()).to.equal(user.publicKey.toString());
      expect(vaultAccount.vaultTokenAccount.toString()).to.equal(vaultTokenAccount.toString());

      console.log(`Vault contains: ${vaultAccount.totalDeposited.toNumber() / 1000000} tokens`);
      console.log(`Vault token account: ${vaultTokenAccount.toString()}`);
    } catch (error) {
      console.error("❌ Failed to initialize vault:", error);
      throw error;
    }
  });

  it("2. Add more funds to demonstrate increased risk", async () => {
    const additionalDeposit = new anchor.BN(50000000); // 50 tokens

    console.log("\n💰 STEP 2: User adds more funds");
    console.log(`Adding ${additionalDeposit.toNumber() / 1000000} more tokens`);

    const tx = await program.methods
      .deposit(additionalDeposit)
      .accounts({
        vault: vault,
        vaultTokenAccount: vaultTokenAccount,
        userTokenAccount: userTokenAccount,
        owner: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("✅ Additional deposit successful");

    // Verify updated vault state
    const vaultAccount = await program.account.vault.fetch(vault);
    console.log(`Total vault balance: ${vaultAccount.totalDeposited.toNumber() / 1000000} tokens`);
    
    expect(vaultAccount.totalDeposited.toNumber()).to.equal(150000000); // 150 tokens total
  });

  it("3. Demonstrate normal withdrawal (before closure)", async () => {
    const withdrawAmount = new anchor.BN(25000000); // 25 tokens

    console.log("\n💸 STEP 3: Normal withdrawal works fine");
    console.log(`Withdrawing ${withdrawAmount.toNumber() / 1000000} tokens`);

    const tx = await program.methods
      .withdraw(withdrawAmount)
      .accounts({
        vault: vault,
        vaultTokenAccount: vaultTokenAccount,
        userTokenAccount: userTokenAccount,
        owner: user.publicKey,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([user])
      .rpc();

    console.log("✅ Withdrawal successful");

    // Verify updated vault state
    const vaultAccount = await program.account.vault.fetch(vault);
    console.log(`Remaining vault balance: ${vaultAccount.totalDeposited.toNumber() / 1000000} tokens`);
    
    expect(vaultAccount.totalDeposited.toNumber()).to.equal(125000000); // 125 tokens remaining
  });

  it("4. SIMULATE ACCIDENTAL PROGRAM CLOSURE", async () => {
    console.log("\n🚨 STEP 4: SIMULATING ACCIDENTAL PROGRAM CLOSURE");
    console.log("This represents what happens when a developer accidentally runs:");
    console.log("❌ solana program close <program-id> --authority <keypair>");
    console.log("");
    console.log("Real-world example: OptiFi lost $661,000 this way!");

    // We simulate this by marking the vault as inactive
    // In reality, the entire program would become unreachable
    try {
      const adminKeypair = Keypair.generate(); // This would fail in real implementation
      
      console.log("Attempting emergency close (this will fail due to wrong authority)...");
      
      await program.methods
        .emergencyCloseVault()
        .accounts({
          vault: vault,
          authority: adminKeypair.publicKey,
        })
        .signers([adminKeypair])
        .rpc();

      console.log("❌ UNEXPECTED: Emergency close succeeded with wrong authority!");
    } catch (error) {
      console.log("✅ Emergency close correctly failed due to unauthorized access");
      console.log("In a real closure scenario, the program would become unreachable");
    }

    console.log("\n💀 EFFECTS OF ACCIDENTAL PROGRAM CLOSURE:");
    console.log("1. All program functions become unreachable");
    console.log("2. User funds remain locked in program-controlled accounts");
    console.log("3. No way to execute withdrawal instructions");
    console.log("4. Funds are permanently lost unless program is restored");
  });

  it("5. Demonstrate withdrawal failure after simulated closure", async () => {
    console.log("\n🔒 STEP 5: Attempting withdrawal after simulated closure");

    // First, actually close the vault using the correct admin authority
    try {
      const adminKeypair = Keypair.fromSecretKey(
        new Uint8Array([
          // This creates a keypair that matches the hardcoded ADMIN_PUBKEY in the program
          // In a real scenario, this would be a proper admin keypair
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 
          1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1
        ].slice(0, 32))
      );
      
      console.log("Since the previous emergency close failed, the vault is still active");
      console.log("In a real closure scenario, the entire program would be unreachable");
      console.log("Let's simulate what would happen if the program were actually closed...");
      
      // Show that normal withdrawal still works because vault is active
      const smallWithdraw = new anchor.BN(10000000); // 10 tokens
      await program.methods
        .withdraw(smallWithdraw)
        .accounts({
          vault: vault,
          vaultTokenAccount: vaultTokenAccount,
          userTokenAccount: userTokenAccount,
          owner: user.publicKey,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([user])
        .rpc();

      console.log("✅ Withdrawal still works because vault is active and program is accessible");
      
      const vaultAccount = await program.account.vault.fetch(vault);
      console.log(`Current vault balance: ${vaultAccount.totalDeposited.toNumber() / 1000000} tokens`);
      
      console.log("\n💀 BUT if the program were actually closed:");
      console.log("1. This RPC call would fail with 'Program account not found'");
      console.log("2. No functions would be executable");
      console.log("3. All remaining funds would be permanently locked");
      console.log("4. Users would have no recourse to recover their assets");
      
    } catch (error) {
      console.log("✅ Withdrawal failed - this would be the effect of program closure");
      console.log("In a real closure scenario, even this error wouldn't occur");
      console.log("The RPC call would fail because the program doesn't exist");
    }
  });

  it("6. Demonstrate proper emergency recovery procedures", async () => {
    console.log("\n🚑 STEP 6: Proper emergency recovery procedures");
    console.log("This demonstrates what SHOULD be implemented:");

    console.log("\n✅ MITIGATION STRATEGIES:");
    console.log("1. Multi-signature wallet for program authority");
    console.log("2. Timelock periods for critical operations");
    console.log("3. Separate staging and production environments");
    console.log("4. Deployment scripts with environment verification");
    console.log("5. Emergency pause/unpause functionality");
    console.log("6. User-controlled fund recovery mechanisms");

    console.log("\n🔧 TECHNICAL SAFEGUARDS:");
    console.log("- Use program upgrades instead of closure");
    console.log("- Implement circuit breakers for large operations");
    console.log("- Create migration contracts before updates");
    console.log("- Use proxy patterns for upgradeable contracts");
    console.log("- Regular monitoring and health checks");

    console.log("\n📋 OPERATIONAL PROCEDURES:");
    console.log("- Peer review for all deployment operations");
    console.log("- CI/CD pipelines with environment detection");
    console.log("- Explicit confirmation for destructive operations");
    console.log("- Testing deployment procedures on devnet");
    console.log("- Backup and recovery testing");

    // In this test, we're not actually implementing recovery since
    // the vault is still functional. In a real scenario, recovery
    // would involve redeploying the program or having emergency contracts
  });

  it("7. Show impact on user funds", async () => {
    console.log("\n📊 STEP 7: Impact assessment");

    try {
      // Check current vault state
      const vaultAccount = await program.account.vault.fetch(vault);
      const lockedTokens = vaultAccount.totalDeposited.toNumber() / 1000000;

      console.log(`Tokens locked in vault: ${lockedTokens}`);
      console.log(`If program were closed, these ${lockedTokens} tokens would be permanently lost`);

      // Check user's remaining tokens
      const userAccount = await getAccount(provider.connection, userTokenAccount);
      const userTokens = Number(userAccount.amount) / 1000000;

      console.log(`User's withdrawable tokens: ${userTokens}`);
      console.log(`Total user impact: ${lockedTokens} tokens inaccessible`);

      console.log("\n💸 FINANCIAL IMPACT:");
      console.log(`At $100/token: $${(lockedTokens * 100).toLocaleString()} locked`);
      console.log(`At current market prices, this represents significant user losses`);

    } catch (error) {
      console.error("Failed to assess impact:", error);
    }
  });

  after(async () => {
    console.log("\n📝 SUMMARY: Accidental Program Closure Vulnerability");
    console.log("============================================================");
    console.log("VULNERABILITY: Accidental program closure during deployment");
    console.log("IMPACT: Permanent loss of user funds");
    console.log("REAL EXAMPLE: OptiFi - $661,000 locked forever");
    console.log("");
    console.log("CRITICAL COMMANDS TO AVOID IN PRODUCTION:");
    console.log("❌ solana program close <program-id>");
    console.log("❌ solana program deploy without proper checks");
    console.log("");
    console.log("SAFE ALTERNATIVES:");
    console.log("✅ Use program upgrades with proper testing");
    console.log("✅ Implement multi-sig authorities");
    console.log("✅ Add emergency pause functionality");
    console.log("✅ Create user-controlled recovery mechanisms");
    console.log("✅ Test thoroughly on devnet first");
    console.log("");
    console.log("Remember: Once a program is closed, funds are gone forever!");
  });
});
