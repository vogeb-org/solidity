# Contract Structure

## Introduction

Smart contracts in Solidity follow a structure similar to classes in object-oriented programming. Understanding this structure is fundamental to Solidity development.

## Basic Structure

A typical Solidity contract includes:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {
    // State Variables
    uint public myNumber;
    address public owner;
    
    // Events
    event NumberChanged(uint newNumber);
    
    // Constructor
    constructor() {
        owner = msg.sender;
        myNumber = 0;
    }
    
    // Functions
    function setNumber(uint _newNumber) public {
        myNumber = _newNumber;
        emit NumberChanged(_newNumber);
    }
}
```

Let's break down each component:

### 1. License Identifier
```solidity
// SPDX-License-Identifier: MIT
```
- Required by the Solidity compiler
- Specifies the contract's license
- Helps with code sharing and reuse

### 2. Pragma Directive
```solidity
pragma solidity ^0.8.0;
```
- Specifies the compiler version
- The `^` symbol means "any version starting with 0.8.0"
- Important for compatibility and security

### 3. Contract Declaration
```solidity
contract MyContract {
    // Contract contents
}
```
- Similar to class declaration in OOP
- Contains all contract elements
- Can inherit from other contracts

### 4. State Variables
```solidity
uint public myNumber;
address public owner;
```
- Stored permanently in contract storage
- Represents the contract's state
- Can be public, private, or internal
- Costs gas to modify

### 5. Events
```solidity
event NumberChanged(uint newNumber);
```
- Used for logging and monitoring
- Can be listened to by external applications
- Helps with contract interaction tracking
- More gas efficient than storage

### 6. Constructor
```solidity
constructor() {
    owner = msg.sender;
    myNumber = 0;
}
```
- Called once during contract deployment
- Used for initialization
- Cannot be called after deployment
- Can accept parameters

### 7. Functions
```solidity
function setNumber(uint _newNumber) public {
    myNumber = _newNumber;
    emit NumberChanged(_newNumber);
}
```
- Contains contract logic
- Can modify state
- Can emit events
- Various visibility modifiers available

## Best Practices

1. Code Organization
   - Group similar variables together
   - Order functions by visibility
   - Keep related functionality close
   - Use clear naming conventions

2. Documentation
   - Comment complex logic
   - Use NatSpec format
   - Explain parameter usage
   - Document assumptions

3. Security
   - Declare visibility explicitly
   - Initialize state variables
   - Check function parameters
   - Consider access control

## Common Patterns

### Ownable Pattern
```solidity
contract Ownable {
    address public owner;
    
    constructor() {
        owner = msg.sender;
    }
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
}
```

### State Machine Pattern
```solidity
contract StateMachine {
    enum State { Created, Locked, Inactive }
    State public state = State.Created;
    
    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }
}
```

## Practice Exercise

Try creating a contract that:
1. Has state variables for name and balance
2. Includes events for balance changes
3. Has functions to modify the balance
4. Implements basic access control

## Key Takeaways

- Contract structure is fundamental to Solidity
- Each component serves a specific purpose
- Proper organization improves readability
- Follow best practices for security
- Consider gas costs in design

Remember: A well-structured contract is easier to understand, maintain, and audit. 