# Solana CTF Challenges

This repository contains a collection of Capture The Flag (CTF) challenges focused on Solana smart contract security. These challenges are designed to help developers learn about common vulnerabilities in Solana programs and how to avoid them.

## Challenges

### [Missing Signer Check](./missing-signer-check/)

A critical vulnerability where a program validates an account's public key but fails to verify that the account actually signed the transaction.

```rust
// VULNERABLE: owner is not checked as a signer!
#[derive(Accounts)]
pub struct WithdrawCtx<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = vault_token_account,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
    
    // Other accounts...
    
    /// CHECK: This account should be a signer but isn't checked!
    pub owner: UncheckedAccount<'info>,  // <-- VULNERABILITY HERE
}
```

This vulnerability has led to millions of dollars in losses across various DeFi protocols. Learn how to exploit and patch this vulnerability by completing the challenge.

### [Accidental Program Closure](./solana-program-close/)

A devastating operational vulnerability where developers accidentally close their program during deployment, permanently locking user funds with no recovery mechanism.

```rust
// VULNERABLE: Any program holding user funds
#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_deposited: u64,  // These tokens become inaccessible if program closes
    pub is_active: bool,
}

// CRITICAL: If this function becomes unreachable, funds are lost forever
pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
    // Withdrawal logic that becomes unreachable after program closure
}
```

**Real-world example**: OptiFi lost $661,000 when developers accidentally ran `solana program close` on mainnet instead of devnet. Learn proper deployment safeguards and emergency procedures.

### [Memory Safety Vulnerabilities](./memory-safety-vulns/memory-safety-vulns/)

Educational demonstrations of memory safety vulnerabilities that can occur in Solana smart contracts, even with Rust's safety features. While Rust prevents most memory safety issues, vulnerabilities can still occur in unsafe code blocks and logical errors.

```rust
// VULNERABLE: Buffer overflow in unsafe code
pub fn buffer_overflow_demo(ctx: Context<BufferOverflowDemo>, data: Vec<u8>) -> Result<()> {
    let mut buffer = ctx.accounts.buffer_account.load_mut()?;
    
    if data.len() > 64 {
        return Err(ErrorCode::BufferOverflow.into());
    }
    
    unsafe {
        let dest_ptr = buffer.data.as_mut_ptr();
        let src_ptr = data.as_ptr();
        // Potential memory corruption if bounds not properly checked
        ptr::copy_nonoverlapping(src_ptr, dest_ptr, data.len());
    }
    
    Ok(())
}
```

This challenge covers buffer overflows, use-after-free scenarios, uninitialized memory access, double-free conditions, and null pointer dereferences. Learn how these vulnerabilities manifest in blockchain contexts and how to prevent them.

## Getting Started

Each challenge directory contains its own README with specific instructions. Generally, you'll need:

- Solana Tool Suite
- Node.js and npm/yarn
- Anchor Framework

To install dependencies for a challenge:

```bash
cd challenge-directory
npm install  # or yarn
```

To run tests demonstrating the vulnerability:

```bash
anchor test
```

## Learning Resources

- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/overview)
- [Anchor Documentation](https://docs.rs/anchor-lang/latest/anchor_lang/)
- [Solana Program Security Blog](https://blog.neodyme.io/posts/solana_common_security_issues)

## Contributing

We welcome contributions of new CTF challenges! Please follow these guidelines:
1. Create a new directory for your challenge
2. Include clear documentation of the vulnerability
3. Add test cases demonstrating both the exploit and the fix
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details. 