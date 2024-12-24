# Function Modifiers in Solidity

## Introduction

Function modifiers are reusable pieces of code that can change the behavior of functions in a declarative way. They are commonly used for access control, input validation, and state verification.

## Basic Modifiers

### Access Control
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
    
    function transferOwnership(address newOwner) public onlyOwner {
        require(newOwner != address(0), "Invalid address");
        owner = newOwner;
    }
}
```

### State Validation
```solidity
contract Pausable {
    bool public paused;
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    modifier whenPaused() {
        require(paused, "Contract not paused");
        _;
    }
    
    function pause() public whenNotPaused {
        paused = true;
    }
    
    function unpause() public whenPaused {
        paused = false;
    }
}
```

## Advanced Modifiers

### With Parameters
```solidity
contract Marketplace {
    mapping(address => uint) public balances;
    
    modifier minimumAmount(uint amount) {
        require(amount >= 100, "Amount too low");
        _;
    }
    
    modifier sufficientBalance(uint amount) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        _;
    }
    
    function withdraw(uint amount) 
        public 
        minimumAmount(amount)
        sufficientBalance(amount)
    {
        balances[msg.sender] -= amount;
        payable(msg.sender).transfer(amount);
    }
}
```

### State Machine
```solidity
contract Auction {
    enum State { Created, Bidding, Ended }
    State public state = State.Created;
    
    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }
    
    function startBidding() public inState(State.Created) {
        state = State.Bidding;
    }
    
    function endAuction() public inState(State.Bidding) {
        state = State.Ended;
    }
}
```

## Modifier Combinations

### Multiple Modifiers
```solidity
contract MultiModifier {
    address public owner;
    bool public locked;
    
    modifier onlyOwner() {
        require(msg.sender == owner, "Not owner");
        _;
    }
    
    modifier noReentrant() {
        require(!locked, "Reentrant call");
        locked = true;
        _;
        locked = false;
    }
    
    function sensitiveOperation() 
        public 
        onlyOwner 
        noReentrant 
    {
        // Sensitive logic
    }
}
```

### Modifier Order
```solidity
contract ModifierOrder {
    modifier orderFirst() {
        // First modifier logic
        _;
    }
    
    modifier orderSecond() {
        // Second modifier logic
        _;
    }
    
    // Modifiers execute in order: orderFirst, then orderSecond
    function multipleModifiers() 
        public 
        orderFirst 
        orderSecond 
    {
        // Function logic
    }
}
```

## Best Practices

1. Design Principles
   - Keep modifiers simple
   - Single responsibility
   - Clear naming conventions
   - Document behavior

2. Security
   - Check state changes
   - Prevent reentrancy
   - Validate inputs
   - Consider side effects

3. Gas Optimization
   - Minimize storage reads
   - Avoid complex logic
   - Combine similar checks
   - Consider execution order

## Common Patterns

### Reentrancy Guard
```solidity
modifier nonReentrant() {
    require(!locked, "No reentrancy");
    locked = true;
    _;
    locked = false;
}
```

### Time Constraints
```solidity
modifier afterDeadline(uint deadline) {
    require(block.timestamp >= deadline, "Too early");
    _;
}

modifier beforeDeadline(uint deadline) {
    require(block.timestamp < deadline, "Too late");
    _;
}
```

## Practice Exercise

Create a contract that:
1. Implements access control
2. Uses state validation
3. Creates parameterized modifiers
4. Combines multiple modifiers
5. Implements security checks

## Key Takeaways

- Use modifiers for reusable checks
- Keep modifier logic simple
- Consider execution order
- Follow security best practices
- Optimize for gas efficiency

Remember: Well-designed modifiers improve code readability and reduce redundancy. 