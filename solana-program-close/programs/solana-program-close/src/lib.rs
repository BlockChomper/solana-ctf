use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, Transfer};
use std::mem::size_of;

declare_id!("4ki5ZHnGRbx3UU5QYf8VdfRcLVMDw46Jm6aXkLvSx5Vj");

#[program]
pub mod solana_program_close {
    use super::*;

    /// Initialize a user vault that holds tokens
    /// RISK: If this program is accidentally closed, all vaults become inaccessible
    pub fn initialize_vault(ctx: Context<InitializeVault>, initial_deposit: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.owner = ctx.accounts.owner.key();
        vault.vault_token_account = ctx.accounts.vault_token_account.key();
        vault.total_deposited = initial_deposit;
        vault.is_active = true;
        
        // Transfer initial deposit to vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, initial_deposit)?;
        
        msg!("Vault initialized with {} tokens. WARNING: Funds are now dependent on program availability!", initial_deposit);
        Ok(())
    }

    /// Add more funds to the vault
    /// RISK: More funds become vulnerable to program closure
    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        vault.total_deposited = vault.total_deposited.checked_add(amount).unwrap();
        
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
            },
        );
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Deposited {} tokens. Total in vault: {}", amount, vault.total_deposited);
        Ok(())
    }

    /// Withdraw funds from vault
    /// CRITICAL: If program is closed, this function becomes unreachable!
    pub fn withdraw(ctx: Context<Withdraw>, amount: u64) -> Result<()> {
        let vault_account_info = ctx.accounts.vault.to_account_info();
        let vault = &mut ctx.accounts.vault;
        
        require!(vault.is_active, ErrorCode::VaultInactive);
        require!(vault.total_deposited >= amount, ErrorCode::InsufficientFunds);
        
        vault.total_deposited = vault.total_deposited.checked_sub(amount).unwrap();
        
        let owner_key = vault.owner;
        let seeds = &[
            b"vault",
            owner_key.as_ref(),
            &[ctx.bumps.vault],
        ];
        let signer = [&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: vault_account_info,
            },
            &signer,
        );
        token::transfer(cpi_ctx, amount)?;
        
        msg!("Withdrew {} tokens. Remaining: {}", amount, vault.total_deposited);
        Ok(())
    }

    /// DANGEROUS: Emergency function that could be misused
    /// This simulates functions that might exist during development/testing
    /// that could accidentally remain in production code
    pub fn emergency_close_vault(ctx: Context<EmergencyClose>) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        // This is where a developer might accidentally implement logic
        // that could lead to program closure scenarios
        require!(ctx.accounts.authority.key() == ADMIN_PUBKEY, ErrorCode::Unauthorized);
        
        vault.is_active = false;
        msg!("EMERGENCY: Vault marked as inactive. This could simulate program closure effects!");
        
        // In a real scenario, a developer might accidentally include:
        // - Program upgrade logic that fails
        // - Admin functions that close the program
        // - Deployment scripts that run in wrong environment
        
        Ok(())
    }

    /// MITIGATION: Recovery function that demonstrates proper safeguards
    pub fn emergency_recover(ctx: Context<EmergencyRecover>) -> Result<()> {
        require!(ctx.accounts.authority.key() == ADMIN_PUBKEY, ErrorCode::Unauthorized);
        
        let vault = &mut ctx.accounts.vault;
        vault.is_active = true;
        
        msg!("RECOVERY: Vault reactivated. This demonstrates proper emergency procedures.");
        Ok(())
    }
}

// Hardcoded admin key for demonstration (in production, use a multisig!)
const ADMIN_PUBKEY: Pubkey = pubkey!("11111111111111111111111111111111");

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + size_of::<Vault>(),
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        init,
        payer = owner,
        associated_token::mint = mint,
        associated_token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, anchor_spl::associated_token::AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = vault_token_account
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = owner,
        has_one = vault_token_account
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    pub owner: Signer<'info>,
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct EmergencyClose<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct EmergencyRecover<'info> {
    #[account(mut)]
    pub vault: Account<'info, Vault>,
    
    pub authority: Signer<'info>,
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub vault_token_account: Pubkey,
    pub total_deposited: u64,
    pub is_active: bool,
}

#[error_code]
pub enum ErrorCode {
    #[msg("Vault is inactive")]
    VaultInactive,
    #[msg("Insufficient funds")]
    InsufficientFunds,
    #[msg("Unauthorized")]
    Unauthorized,
}

/* 
VULNERABILITY DEMONSTRATION: Accidental Program Closure

SCENARIO:
1. Users deposit tokens into vaults managed by this program
2. Developer accidentally runs `solana program close <program-id>` in production
3. All vault funds become permanently inaccessible
4. No recovery mechanism exists at the program level

REAL-WORLD EXAMPLE (OptiFi):
- OptiFi mainnet program was accidentally closed during a routine update
- $661,000 worth of user funds became permanently locked
- The close command was meant for devnet but was run on mainnet

MITIGATION STRATEGIES:

1. DEPLOYMENT SAFEGUARDS:
   - Never use raw `solana program close` commands
   - Implement multi-signature wallets for program authority
   - Use deployment scripts with environment checks
   - Require explicit confirmation for destructive operations

2. CODE-LEVEL PROTECTIONS:
   - Implement program upgrade patterns instead of closure
   - Add emergency pause/unpause functionality
   - Use timelock contracts for critical operations
   - Implement user-controlled fund recovery mechanisms

3. OPERATIONAL PROCEDURES:
   - Separate development, staging, and production environments
   - Implement peer review for all deployment operations
   - Use CI/CD pipelines with proper environment detection
   - Test deployment procedures thoroughly on devnet
   - Implement rollback procedures

4. TECHNICAL SOLUTIONS:
   - Use program-derived addresses (PDAs) for fund storage
   - Implement emergency withdrawal functions
   - Create migration contracts before major updates
   - Use proxy patterns for upgradeable contracts

5. MONITORING & ALERTS:
   - Monitor program health and accessibility
   - Set up alerts for unusual program behavior
   - Implement circuit breakers for large operations
   - Regular backup and recovery testing

COMMAND TO AVOID IN PRODUCTION:
❌ solana program close <program-id> --authority <keypair>

SAFER ALTERNATIVES:
✅ Use program upgrades: solana program deploy --program-id <program-id> <program.so>
✅ Implement graceful shutdown functions within the program
✅ Use multisig authorities with timelock periods
✅ Test extensively on devnet before mainnet deployment

This vulnerability has caused millions in losses across DeFi protocols.
Always implement proper deployment safeguards and emergency procedures!
*/
