use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use std::mem::size_of;

declare_id!("GWrYoNZrnR7hst1dKXYAV1YSxjLZx8ij5cdYtodJePAS");

#[program]
pub mod vault_manager {
    use super::*;

    pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
        ctx.accounts.vault.owner = ctx.accounts.owner.key();
        ctx.accounts.vault.vault_token_account = ctx.accounts.vault_token_account.key();
        ctx.accounts.vault.token_mint = ctx.accounts.token_mint.key();
        Ok(())
    }

    pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
        // Transfer tokens from user to vault
        let cpi_ctx = CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.owner.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
            },
        );
        
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    // VULNERABLE: This function is missing a signer check!
    pub fn withdraw(ctx: Context<WithdrawCtx>, amount: u64) -> Result<()> {
        // Create a binding for the owner key to extend its lifetime
        let owner_key = ctx.accounts.owner.key();
        
        // Transfer tokens from vault to destination
        let seeds = &[
            b"vault", 
            owner_key.as_ref(),
            &[ctx.bumps.vault]
        ];
        let signer = [&seeds[..]];
        
        let cpi_ctx = CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.vault.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
            },
            &signer,
        );
        
        token::transfer(cpi_ctx, amount)?;
        Ok(())
    }

    // CHALLENGE: Implement this function securely
    pub fn secure_withdraw(_ctx: Context<SecureWithdrawCtx>, _amount: u64) -> Result<()> {
        // TODO: Implement secure withdrawal with proper signer checks
        // Hint: You'll need to modify the SecureWithdrawCtx struct as well
        Err(error!(ErrorCode::NotImplemented))
    }
}

#[error_code]
pub enum ErrorCode {
    #[msg("This function has not been implemented yet")]
    NotImplemented,
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = owner,
        space = size_of::<Vault>() + 8,
        seeds = [b"vault", owner.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(
        init,
        payer = owner,
        token::mint = token_mint,
        token::authority = vault,
    )]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = vault_token_account,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub source: Account<'info, TokenAccount>,
    
    pub owner: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

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
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    
    /// CHECK: This account should be a signer but isn't checked!
    pub owner: UncheckedAccount<'info>,
}

// TODO: Add proper constraints to this struct
#[derive(Accounts)]
pub struct SecureWithdrawCtx<'info> {
    #[account(
        seeds = [b"vault", owner.key().as_ref()],
        bump,
        has_one = vault_token_account,
        has_one = owner,
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    
    /// VULNERABLE: This should be a Signer but isn't
    /// CHECK: Fix this security issue!
    pub owner: UncheckedAccount<'info>,
}

#[account]
pub struct Vault {
    pub owner: Pubkey,
    pub vault_token_account: Pubkey,
    pub token_mint: Pubkey,
}
