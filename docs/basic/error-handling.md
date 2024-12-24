# Error Handling in Solidity

## Introduction

Error handling is crucial in smart contract development to ensure security and reliability. Solidity provides several mechanisms to handle errors and validate conditions.

## Error Types

### Require Statements
```solidity
function transfer(address to, uint256 amount) public {
    require(balance >= amount, "Insufficient balance");
    require(to != address(0), "Invalid recipient");
    
    balance -= amount;
    // Transfer logic
}
```
- Used for input validation
- Reverts transaction on failure
- Returns remaining gas
- Provides error message

### Revert Statements
```solidity
function processPayment(uint256 amount) public {
    if (amount > maxLimit) {
        revert("Amount exceeds limit");
    }
    if (blacklisted[msg.sender]) {
        revert("Sender is blacklisted");
    }
    // Payment logic
}
```
- Similar to require
- More flexible control flow
- Good for complex conditions
- Can use custom errors

### Assert Statements
```solidity
function safeOperation(uint256 a, uint256 b) public {
    uint256 result = a + b;
    assert(result >= a);  // Check for overflow
    // Continue operation
}
```
- Used for invariant checking
- Consumes all gas on failure
- Indicates programming error
- Should never fail in production

### Custom Errors
```solidity
error InsufficientBalance(address account, uint256 balance, uint256 required);

function withdraw(uint256 amount) public {
    if (balance < amount) {
        revert InsufficientBalance(msg.sender, balance, amount);
    }
    // Withdrawal logic
}
```
- Gas efficient
- Provides detailed information
- Type-safe parameters
- Better error handling

## Try-Catch

### Basic Usage
```solidity
interface Token {
    function transfer(address to, uint256 amount) external returns (bool);
}

function tryTransfer(address token, address to, uint256 amount) public {
    try Token(token).transfer(to, amount) returns (bool success) {
        require(success, "Transfer failed");
    } catch Error(string memory reason) {
        // Handle revert with reason
        emit TransferFailed(reason);
    } catch (bytes memory) {
        // Handle other errors
        emit TransferFailed("Unknown error");
    }
}
```

### Error Types
```solidity
try externalContract.riskyFunction() {
    // Success case
} catch Error(string memory reason) {
    // Handle revert/require
} catch Panic(uint errorCode) {
    // Handle assert/arithmetic errors
} catch (bytes memory lowLevelData) {
    // Handle other errors
}
```

## Best Practices

1. Input Validation
   - Validate early in functions
   - Use descriptive error messages
   - Check boundary conditions
   - Validate addresses

2. Error Design
   - Use custom errors for gas efficiency
   - Provide meaningful error data
   - Consider error handling in UI
   - Document error conditions

3. Security
   - Check state changes
   - Validate permissions
   - Handle reentrancy
   - Consider edge cases

## Common Patterns

### Guard Pattern
```solidity
modifier onlyAdmin() {
    require(msg.sender == admin, "Not admin");
    _;
}

modifier validAmount(uint256 amount) {
    require(amount > 0, "Invalid amount");
    require(amount <= maxLimit, "Exceeds limit");
    _;
}
```

### Safe Operations
```solidity
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
}
```

## Practice Exercise

Create a contract that:
1. Uses different error handling methods
2. Implements custom errors
3. Uses try-catch blocks
4. Validates inputs properly
5. Handles edge cases

## Key Takeaways

- Choose appropriate error handling
- Use descriptive error messages
- Implement proper validation
- Consider gas costs
- Handle all edge cases

Remember: Proper error handling is essential for contract reliability and user experience. 