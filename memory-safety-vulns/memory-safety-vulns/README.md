# Memory Safety Vulnerabilities in Solana Smart Contracts

This educational repository demonstrates various memory safety vulnerabilities in Solana smart contracts, showing how Rust's safety features prevent most issues while highlighting areas where vulnerabilities can still occur.

## ⚠️ Educational Purpose Only

**WARNING**: This code contains intentional vulnerabilities for educational purposes. Never use this code in production environments.

## Memory Safety Vulnerabilities Demonstrated

### 1. **Buffer Overflow**
- **Description**: Attempting to write more data than allocated buffer space
- **Rust Protection**: Rust typically panics instead of corrupting memory
- **Vulnerability**: Logic errors in bounds checking, unsafe code blocks
- **Demo**: `buffer_overflow_demo()` function

```rust
// Vulnerable pattern - unsafe memory copy without proper bounds
unsafe {
    let dest_ptr = buffer.data.as_mut_ptr();
    let src_ptr = data.as_ptr();
    ptr::copy_nonoverlapping(src_ptr, dest_ptr, data.len()); // Could overflow
}
```

### 2. **Use After Free**
- **Description**: Accessing memory after it has been freed/deallocated
- **Rust Protection**: Ownership system prevents classic use-after-free
- **Vulnerability**: Logical "freeing" in smart contracts (account lifecycle issues)
- **Demo**: `use_after_free_demo()` function

```rust
// Mark account as "freed"
account.is_active = false;
account.data = 0;

// Later attempt to use "freed" account data
if !account.is_active {
    msg!("ERROR: Accessing freed account! Data: {}", account.data);
}
```

### 3. **Uninitialized Memory Access**
- **Description**: Reading from memory that hasn't been properly initialized
- **Rust Protection**: Variables must be initialized before use
- **Vulnerability**: Account data that's never properly set up
- **Demo**: `uninitialized_memory_demo()` function

```rust
if !account.is_initialized {
    msg!("Reading uninitialized data: {}", account.sensitive_data);
    return Err(ErrorCode::UninitializedMemory.into());
}
```

### 4. **Double Free**
- **Description**: Attempting to free the same memory twice
- **Rust Protection**: Ownership prevents literal double-free
- **Vulnerability**: Double-closing accounts or resources
- **Demo**: `double_free_demo()` function

```rust
// First "free"
if account.is_active {
    account.is_active = false;
} else {
    // Second "free" - error condition
    msg!("ERROR: Attempting to close already closed account!");
}
```

### 5. **Null Pointer Dereference**
- **Description**: Dereferencing a null pointer
- **Rust Protection**: No null pointers in safe Rust
- **Vulnerability**: Unsafe code with raw pointers
- **Demo**: `null_pointer_demo()` function

```rust
unsafe {
    let null_ptr: *const u64 = ptr::null();
    if !null_ptr.is_null() {
        let _value = *null_ptr; // Would panic in Rust
    }
}
```

## Project Structure

```
memory-safety-vulns/
├── programs/
│   └── memory-safety-vulns/
│       └── src/
│           └── lib.rs              # Main program with vulnerabilities
├── tests/
│   └── memory-safety-vulns.ts     # Comprehensive test suite
├── Anchor.toml                     # Anchor configuration
└── README.md                       # This file
```

## Account Structures

### BufferAccount
```rust
#[account(zero_copy)]
pub struct BufferAccount {
    pub size: u64,
    pub data: [u8; 64],  // 64-byte buffer for overflow tests
}
```

### TargetAccount
```rust
#[account(zero_copy)]
pub struct TargetAccount {
    pub is_active: bool,        // Tracks if account is "live"
    pub is_initialized: bool,   // Tracks initialization state
    pub data: u64,             // General data field
    pub sensitive_data: u64,   // Sensitive data for uninitialized access tests
}
```

## Getting Started

### Prerequisites
- Rust 1.60+
- Solana CLI 1.14+
- Anchor Framework 0.31+
- Node.js 16+

### Installation
```bash
# Clone and navigate to the project
cd memory-safety-vulns

# Install dependencies
yarn install

# Build the program
anchor build

# Start local validator (in separate terminal)
solana-test-validator

# Run tests
anchor test --skip-local-validator
```

## Test Scenarios

### Buffer Overflow Tests
```bash
# Run buffer overflow demonstrations
anchor test --grep "Buffer Overflow Vulnerability"
```

### Use After Free Tests
```bash
# Run use-after-free demonstrations
anchor test --grep "Use After Free Vulnerability"
```

### Uninitialized Memory Tests
```bash
# Run uninitialized memory access demonstrations
anchor test --grep "Uninitialized Memory Access"
```

### Double Free Tests
```bash
# Run double-free demonstrations
anchor test --grep "Double Free Vulnerability"
```

### Null Pointer Tests
```bash
# Run null pointer dereference demonstrations
anchor test --grep "Null Pointer Dereference"
```

### Complex Vulnerability Tests
```bash
# Run combined vulnerability scenarios
anchor test --grep "Complex Vulnerability Combinations"
```

## Error Codes

| Code | Error | Description |
|------|--------|-------------|
| 6000 | BufferOverflow | Data exceeds allocated buffer space |
| 6001 | UseAfterFree | Accessing logically freed account data |
| 6002 | UninitializedMemory | Reading uninitialized account data |
| 6003 | DoubleFree | Attempting to free already freed resource |
| 6004 | NullPointerDereference | Dereferencing null pointer in unsafe code |
| 6005 | InvalidOperation | Invalid operation parameter |

## Key Learning Points

### ✅ Rust's Memory Safety Features

1. **Ownership System**: Prevents use-after-free and double-free
2. **Borrow Checker**: Ensures references are valid
3. **No Null Pointers**: Safe references always point to valid data
4. **Bounds Checking**: Array accesses are checked at runtime
5. **Initialization Checks**: Variables must be initialized before use

### ⚠️ Remaining Vulnerability Areas

1. **Unsafe Code Blocks**: Bypass Rust's safety guarantees
2. **Logic Errors**: Incorrect business logic can cause issues
3. **Account Lifecycle**: Improper account state management
4. **Cross-Program Calls**: Trusting external program data
5. **Arithmetic Operations**: Integer overflow/underflow

### 🛡️ Best Practices for Solana

1. **Minimize Unsafe Code**: Use unsafe blocks sparingly and carefully
2. **Validate All Inputs**: Check bounds, initialization, and state
3. **Use Anchor Constraints**: Leverage built-in safety features
4. **Test Edge Cases**: Comprehensive testing of error conditions
5. **Account State Management**: Proper lifecycle handling
6. **Static Analysis**: Use tools like `cargo clippy` and `cargo audit`

## Prevention Strategies

### For Buffer Overflows
```rust
// Always check bounds before copying
if data.len() > buffer.data.len() {
    return Err(ErrorCode::BufferOverflow.into());
}
```

### For Use After Free
```rust
// Check account state before use
if !account.is_active {
    return Err(ErrorCode::UseAfterFree.into());
}
```

### For Uninitialized Access
```rust
// Verify initialization before access
if !account.is_initialized {
    return Err(ErrorCode::UninitializedMemory.into());
}
```

### For Double Free
```rust
// Track state to prevent double operations
if !account.is_active {
    return Err(ErrorCode::DoubleFree.into());
}
```

## Security Tools Integration

### Static Analysis
```bash
# Run Clippy for additional safety checks
cargo clippy -- -D warnings

# Audit dependencies for vulnerabilities
cargo audit

# Format code consistently
cargo fmt
```

### Anchor Security Features
```rust
// Use Anchor's built-in constraints
#[account(
    mut,
    constraint = account.is_active @ ErrorCode::UseAfterFree,
    constraint = account.is_initialized @ ErrorCode::UninitializedMemory
)]
pub account: Account<'info, TargetAccount>,
```

## Real-World Applications

Understanding these vulnerabilities helps in:

1. **Code Review**: Identifying potential memory safety issues
2. **Secure Development**: Writing safer Solana programs
3. **Penetration Testing**: Testing smart contract security
4. **Audit Preparation**: Understanding common vulnerability patterns
5. **Educational Purposes**: Teaching secure blockchain development

## Resources for Further Learning

- [Rust Memory Safety](https://doc.rust-lang.org/book/ch04-00-understanding-ownership.html)
- [Solana Security Best Practices](https://docs.solana.com/developing/programming-model/overview)
- [Anchor Security Constraints](https://book.anchor-lang.com/anchor_references/space.html)
- [Sealevel Attacks Repository](https://github.com/coral-xyz/sealevel-attacks)
- [Neodyme Security Blog](https://blog.neodyme.io/)

## Contributing

This is an educational project. If you find additional memory safety vulnerabilities or have suggestions for improvements, please open an issue or submit a pull request.

## Disclaimer

This code is for educational purposes only. The intentional vulnerabilities demonstrated here should never be used in production code. Always follow security best practices when developing real-world applications.

## License

This project is licensed under the MIT License - see the LICENSE file for details. 