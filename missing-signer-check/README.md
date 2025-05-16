# Missing Signer Check CTF Challenge

## Overview

This Capture The Flag (CTF) challenge demonstrates a critical vulnerability in Solana smart contracts: **missing signer authorization checks**. This vulnerability has led to millions of dollars in losses across various DeFi protocols.

## The Vulnerability

Missing signer checks occur when a program validates that an account's public key matches a stored value, but **fails to verify that the account actually signed the transaction**. This allows attackers to impersonate users by:

1. Creating transactions that reference a victim's address
2. Signing those transactions with their own keypair
3. Exploiting vulnerable programs that don't properly validate signers

## Repository Structure

- `programs/pda/src/lib.rs` - The smart contract with intentionally vulnerable code
- `tests/signer-check-demo.ts` - Test script demonstrating the vulnerability

## Getting Started

### Prerequisites

- Solana Tool Suite
- Node.js and npm
- Anchor Framework

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd pda

# Install dependencies
npm install
```

### Running the Demonstration

The test script demonstrates both secure and vulnerable implementations:

```bash
# Run the demonstration
anchor test
```

## Vulnerability Details

In the smart contract, note the vulnerable code:

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

The contract uses `has_one = owner` to ensure the owner field matches, but it uses `UncheckedAccount` instead of `Signer`, allowing transactions to bypass authorization.

## The Fix

The secure implementation uses the `Signer` type:

```rust
// SECURE: owner must sign the transaction
#[derive(Accounts)]
pub struct SecureWithdrawCtx<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = vault_token_account,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
    
    // Other accounts...
    
    pub owner: Signer<'info>,  // <-- FIXED! Requires signature
}
```

## Security Best Practices

To avoid this vulnerability:

1. Always use `Signer<'info>` for accounts that must authorize actions
2. Never use `UncheckedAccount` for authority/owner fields
3. Remember that `has_one` only checks field equality, not signatures
4. Add explicit signature verification for critical operations

## Resources

- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/overview)
- [Anchor Documentation on Account Types](https://docs.rs/anchor-lang/latest/anchor_lang/accounts/index.html)
- [Analysis of Previous Exploits](https://blog.neodyme.io/posts/solana_common_security_issues)

## License

This project is licensed under the MIT License - see the LICENSE file for details. 