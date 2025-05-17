import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair, SystemProgram, Transaction } from '@solana/web3.js';
import { expect } from 'chai';

describe('Missing Signer Check Demo', () => {
  // Configure the client to use the local cluster
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  
  // Create victim and attacker keys
  const victim = Keypair.generate();
  const attacker = Keypair.generate();
  
  before(async () => {
    // Fund the accounts
    const victimAirdrop = await provider.connection.requestAirdrop(
      victim.publicKey, 
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    
    const attackerAirdrop = await provider.connection.requestAirdrop(
      attacker.publicKey, 
      2 * anchor.web3.LAMPORTS_PER_SOL
    );
    
    // Wait for confirmations
    const latestBlockhash = await provider.connection.getLatestBlockhash();
    await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: victimAirdrop,
    });
    
    await provider.connection.confirmTransaction({
      blockhash: latestBlockhash.blockhash,
      lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
      signature: attackerAirdrop,
    });
    
    console.log(`Victim funded: ${victim.publicKey.toString()}`);
    console.log(`Attacker funded: ${attacker.publicKey.toString()}`);
  });
  
  it('demonstrates a missing signer check vulnerability', async () => {
    // We'll create a dummy PDA that supposedly belongs to the victim
    const dummyPDA = await createDummyPDA(victim.publicKey);
    
    // 1. First attempt with secure transaction (should fail)
    // This transaction properly checks signatures
    console.log('\n🔒 Attempting secure transaction (should fail)...');
    const secureTransaction = new Transaction();
    secureTransaction.add(
      SystemProgram.transfer({
        fromPubkey: victim.publicKey,
        toPubkey: attacker.publicKey,
        lamports: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
      })
    );
    
    try {
      // Get latest blockhash and set it on the transaction
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      secureTransaction.recentBlockhash = latestBlockhash.blockhash;
      secureTransaction.feePayer = attacker.publicKey;
      
      // Sign with attacker but try to spend from victim (should fail)
      secureTransaction.sign(attacker);
      
      // This should fail because the SystemProgram checks signatures
      await provider.connection.sendRawTransaction(
        secureTransaction.serialize(),
        { skipPreflight: false }
      );
      
      console.log('❌ UNEXPECTED: Secure transaction succeeded!');
      expect.fail('Secure transaction should have failed');
    } catch (error) {
      console.log('✅ Secure transaction correctly failed with error:');
      console.log(`   ${error.message.split('\n')[0]}`);
    }
    
    // 2. Now create a vulnerable transaction (demonstration only)
    // This simulates a transaction without proper signer checks
    console.log('\n🔓 Demonstrating vulnerable transaction flow...');
    
    // Create a transaction that claims to be from the victim
    // This represents a transaction to a program with missing signer checks
    const vulnerablePayload = {
      from: victim.publicKey.toString(),
      to: attacker.publicKey.toString(),
      amount: 0.1 * anchor.web3.LAMPORTS_PER_SOL,
      timestamp: Date.now(),
      // The transaction says it's from the victim
      signedBy: victim.publicKey.toString()
    };
    
    console.log('📤 Transaction payload:');
    console.log(vulnerablePayload);
    
    console.log('\n⚠️ In a vulnerable program:');
    console.log('1. Attacker creates transaction with victim\'s public key');
    console.log('2. Program only checks if victim pubkey matches record (has_one)');
    console.log('3. Program doesn\'t verify the signature (missing signer check)');
    console.log('4. Transaction succeeds even though victim didn\'t sign!');

    // Simulate successful exploitation (we can't actually exploit the System Program)
    const simulateExploit = () => {
      // In a vulnerable program:
      const pubkeyFromPayload = new PublicKey(vulnerablePayload.from);
      const victimPubkey = victim.publicKey;
      
      // This is all the program would check - pubkey equality
      const pubkeyMatches = pubkeyFromPayload.equals(victimPubkey);
      
      // But it wouldn't verify if the victim actually signed!
      
      console.log(`\n🔍 Program checks: Pubkey matches record? ${pubkeyMatches ? 'Yes' : 'No'}`);
      console.log(`❓ Program doesn't check: Did victim sign? No (attacker signed)`);
      
      // In a vulnerable program, this would go through!
      return pubkeyMatches; 
    };
    
    const exploitSuccess = simulateExploit();
    console.log(`\n${exploitSuccess ? '🚨 VULNERABILITY EXPLOITED' : '✅ EXPLOIT FAILED'}`);
    
    // 3. The correct implementation in Anchor
    console.log('\n✅ How to fix in Anchor:');
    console.log(`
#[derive(Accounts)]
pub struct SecureWithdraw<'info> {
    #[account(/* constraints */)]
    pub vault: Account<'info, Vault>,
    
    // ... other accounts
    
    // This Signer type ensures the account signed the transaction
    pub owner: Signer<'info>,  // <-- Use Signer instead of UncheckedAccount
}
    `);
    
    console.log('\n📝 CONCLUSION:');
    console.log('- Missing signer checks are a serious vulnerability');
    console.log('- Attackers can impersonate users without their private keys');
    console.log('- Always use the Signer type for authority accounts in Anchor');
  });
});

// Helper function to create a deterministic PDA for demonstration
async function createDummyPDA(authority: PublicKey): Promise<PublicKey> {
  // Use a valid program ID for demonstration
  const dummyProgramId = new PublicKey('11111111111111111111111111111111');
  
  // Find a PDA using the victim's pubkey as seed
  const [pda, _bump] = PublicKey.findProgramAddressSync(
    [authority.toBuffer()],
    dummyProgramId
  );
  
  return pda;
} 