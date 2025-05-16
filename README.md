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
Learn how to exploit and patch this vulnerability by completing the challenge.

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