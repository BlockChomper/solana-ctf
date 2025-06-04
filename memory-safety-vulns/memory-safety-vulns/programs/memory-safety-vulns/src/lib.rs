use anchor_lang::prelude::*;
use std::ptr;

declare_id!("HdQsMWTESthxYtyZJVuwXAG4KuJH2LakDersvBYRooc8");

#[program]
pub mod memory_safety_vulns {
    use super::*;

    /// Demonstrates buffer overflow vulnerability
    /// Rust normally prevents this, but we can create scenarios that panic or misbehave
    pub fn buffer_overflow_demo(ctx: Context<BufferOverflowDemo>, data: Vec<u8>) -> Result<()> {
        let mut buffer = ctx.accounts.buffer_account.load_mut()?;
        
        // This demonstrates a logical buffer overflow - trying to write more data
        // than allocated space allows. In Rust, this would panic rather than
        // corrupt memory, but it's still a vulnerability.
        if data.len() > 64 {
            return Err(ErrorCode::BufferOverflow.into());
        }
        
        // Unsafe block to demonstrate potential memory corruption
        unsafe {
            let dest_ptr = buffer.data.as_mut_ptr();
            let src_ptr = data.as_ptr();
            
            // This could write beyond allocated memory if not properly bounded
            // In a real vulnerability, this could corrupt adjacent memory
            ptr::copy_nonoverlapping(src_ptr, dest_ptr, data.len());
        }
        
        buffer.size = data.len() as u64;
        msg!("Wrote {} bytes to buffer", data.len());
        Ok(())
    }

    /// Demonstrates use-after-free conceptual vulnerability
    /// While Rust's ownership prevents classic use-after-free, we can show
    /// similar issues with account lifecycle management
    pub fn use_after_free_demo(ctx: Context<UseAfterFreeDemo>) -> Result<()> {
        let mut account = ctx.accounts.target_account.load_mut()?;
        
        // Mark account as "freed" or closed
        account.is_active = 0; // Use 0/1 instead of bool for Pod compatibility
        account.data = 0;
        
        // Later in the same function, we "use" the freed account
        // This simulates accessing data after it's been logically freed
        if account.is_active == 0 {
            msg!("ERROR: Accessing freed account! Data: {}", account.data);
            return Err(ErrorCode::UseAfterFree.into());
        }
        
        Ok(())
    }

    /// Demonstrates uninitialized memory access
    /// Shows reading from potentially uninitialized account data
    pub fn uninitialized_memory_demo(ctx: Context<UninitializedDemo>) -> Result<()> {
        let account = ctx.accounts.target_account.load()?;
        
        // If account was never properly initialized, this could read garbage data
        if account.is_initialized == 0 {
            msg!("Reading uninitialized data: {}", account.sensitive_data);
            return Err(ErrorCode::UninitializedMemory.into());
        }
        
        msg!("Safe access to initialized data: {}", account.sensitive_data);
        Ok(())
    }

    /// Demonstrates double-free conceptual vulnerability
    /// While Rust prevents literal double-free, we can show double-close scenarios
    pub fn double_free_demo(ctx: Context<DoubleFreeDemo>) -> Result<()> {
        let mut account = ctx.accounts.target_account.load_mut()?;
        
        // First "free" - close the account
        if account.is_active == 1 {
            account.is_active = 0;
            account.data = 0;
            msg!("Account closed successfully");
        } else {
            // Second "free" - attempting to close already closed account
            msg!("ERROR: Attempting to close already closed account!");
            return Err(ErrorCode::DoubleFree.into());
        }
        
        Ok(())
    }

    /// Demonstrates null pointer dereference vulnerability
    /// Uses unsafe code to show potential null pointer issues
    pub fn null_pointer_demo(ctx: Context<NullPointerDemo>, use_null: bool) -> Result<()> {
        let account = ctx.accounts.target_account.load()?;
        
        if use_null {
            unsafe {
                // Create a null pointer
                let null_ptr: *const u64 = ptr::null();
                
                // This would cause a segmentation fault in C/C++
                // In Rust, this will panic, but demonstrates the concept
                if !null_ptr.is_null() {
                    let _value = *null_ptr; // This line would crash
                    msg!("Dereferenced null pointer: {}", _value);
                } else {
                    msg!("Detected null pointer, avoiding dereference");
                    return Err(ErrorCode::NullPointerDereference.into());
                }
            }
        }
        
        msg!("Safe operation with valid data: {}", account.data);
        Ok(())
    }

    /// Initialize account for demonstrations
    pub fn initialize_buffer(ctx: Context<InitializeBuffer>) -> Result<()> {
        let mut account = ctx.accounts.buffer_account.load_init()?;
        account.size = 0;
        account.data = [0; 64]; // Initialize with zeros
        msg!("Buffer account initialized");
        Ok(())
    }

    pub fn initialize_target(ctx: Context<InitializeTarget>) -> Result<()> {
        let mut account = ctx.accounts.target_account.load_init()?;
        account.is_active = 1; // Use 1 for true
        account.is_initialized = 1; // Use 1 for true  
        account.data = 42;
        account.sensitive_data = 12345;
        msg!("Target account initialized");
        Ok(())
    }

    pub fn initialize_complex(ctx: Context<InitializeComplex>) -> Result<()> {
        let mut account = ctx.accounts.target_account.load_init()?;
        account.is_active = 1; // Use 1 for true
        account.is_initialized = 1; // Use 1 for true  
        account.data = 42;
        account.sensitive_data = 12345;
        account.buffer = [0; 32]; // Initialize buffer with zeros
        msg!("Complex account initialized");
        Ok(())
    }

    /// Demonstrates a complex vulnerability combining multiple issues
    pub fn complex_vulnerability_demo(
        ctx: Context<ComplexDemo>,
        operation: u8,
        data: Vec<u8>
    ) -> Result<()> {
        let mut account = ctx.accounts.target_account.load_mut()?;
        
        match operation {
            1 => {
                // Buffer overflow + uninitialized read
                if account.is_initialized == 0 {
                    // Reading uninitialized sensitive_data
                    msg!("Using uninitialized data: {}", account.sensitive_data);
                }
                
                // Potential buffer overflow
                if data.len() > 32 {
                    return Err(ErrorCode::BufferOverflow.into());
                }
                
                unsafe {
                    // Copy data without proper bounds checking in unsafe context
                    let dest = account.buffer.as_mut_ptr();
                    ptr::copy_nonoverlapping(data.as_ptr(), dest, data.len());
                }
            },
            2 => {
                // Use after free scenario
                account.is_active = 0; // "Free" the account
                
                // Then try to use it
                if account.is_active == 0 {
                    msg!("Accessing freed account data: {}", account.data);
                    return Err(ErrorCode::UseAfterFree.into());
                }
            },
            3 => {
                // Double free scenario
                if account.is_active == 0 {
                    msg!("Attempting to free already freed account");
                    return Err(ErrorCode::DoubleFree.into());
                }
                account.is_active = 0;
            },
            _ => {
                return Err(ErrorCode::InvalidOperation.into());
            }
        }
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct BufferOverflowDemo<'info> {
    #[account(mut)]
    pub buffer_account: AccountLoader<'info, BufferAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UseAfterFreeDemo<'info> {
    #[account(mut)]
    pub target_account: AccountLoader<'info, TargetAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct UninitializedDemo<'info> {
    pub target_account: AccountLoader<'info, TargetAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct DoubleFreeDemo<'info> {
    #[account(mut)]
    pub target_account: AccountLoader<'info, TargetAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct NullPointerDemo<'info> {
    pub target_account: AccountLoader<'info, TargetAccount>,
    pub user: Signer<'info>,
}

#[derive(Accounts)]
pub struct InitializeBuffer<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<BufferAccount>(),
    )]
    pub buffer_account: AccountLoader<'info, BufferAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeTarget<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<TargetAccount>(),
    )]
    pub target_account: AccountLoader<'info, TargetAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitializeComplex<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + std::mem::size_of::<ComplexAccount>(),
    )]
    pub target_account: AccountLoader<'info, ComplexAccount>,
    #[account(mut)]
    pub user: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ComplexDemo<'info> {
    #[account(mut)]
    pub target_account: AccountLoader<'info, ComplexAccount>,
    pub user: Signer<'info>,
}

#[account(zero_copy)]
#[repr(C)]
pub struct BufferAccount {
    pub size: u64,
    pub data: [u8; 64],
}

#[account(zero_copy)]
#[repr(C)]
pub struct TargetAccount {
    pub is_active: u8,      // Use u8 instead of bool for Pod compatibility
    pub is_initialized: u8, // Use u8 instead of bool for Pod compatibility
    pub _padding1: [u8; 6], // Explicit padding for alignment
    pub data: u64,
    pub sensitive_data: u64,
}

#[account(zero_copy)]
#[repr(C)]
pub struct ComplexAccount {
    pub is_active: u8,      // Use u8 instead of bool for Pod compatibility
    pub is_initialized: u8, // Use u8 instead of bool for Pod compatibility
    pub _padding1: [u8; 6], // Explicit padding for alignment
    pub data: u64,
    pub sensitive_data: u64,
    pub buffer: [u8; 32],
}

#[error_code]
pub enum ErrorCode {
    #[msg("Buffer overflow detected")]
    BufferOverflow,
    #[msg("Use after free detected")]
    UseAfterFree,
    #[msg("Uninitialized memory access detected")]
    UninitializedMemory,
    #[msg("Double free detected")]
    DoubleFree,
    #[msg("Null pointer dereference detected")]
    NullPointerDereference,
    #[msg("Invalid operation")]
    InvalidOperation,
}
