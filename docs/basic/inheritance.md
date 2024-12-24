# Inheritance in Solidity

## Introduction

Inheritance in Solidity allows contracts to extend and reuse code from other contracts. It's a fundamental feature for building modular and maintainable smart contracts.

## Basic Inheritance

### Single Inheritance
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

contract Token is Ownable {
    mapping(address => uint256) private balances;
    
    function mint(address to, uint256 amount) public onlyOwner {
        balances[to] += amount;
    }
}
```

### Multiple Inheritance
```solidity
contract Pausable {
    bool public paused;
    
    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
    
    function pause() public virtual {
        paused = true;
    }
    
    function unpause() public virtual {
        paused = false;
    }
}

contract AccessControl {
    mapping(address => bool) public isAdmin;
    
    modifier onlyAdmin() {
        require(isAdmin[msg.sender], "Not admin");
        _;
    }
    
    function addAdmin(address account) public virtual {
        isAdmin[account] = true;
    }
}

contract SecureToken is Token, Pausable, AccessControl {
    function transfer(address to, uint256 amount) public whenNotPaused {
        // Transfer logic
    }
    
    function pause() public override onlyAdmin {
        super.pause();
    }
}
```

## Advanced Inheritance

### Abstract Contracts
```solidity
abstract contract BaseContract {
    uint256 public value;
    
    function setValue(uint256 _value) public virtual;
    
    function getValue() public view returns (uint256) {
        return value;
    }
}

contract Implementation is BaseContract {
    function setValue(uint256 _value) public override {
        value = _value;
    }
}
```

### Virtual and Override
```solidity
contract Base {
    function foo() public virtual returns (string memory) {
        return "Base";
    }
    
    function bar() public virtual returns (string memory) {
        return "Base";
    }
}

contract Middle is Base {
    function foo() public virtual override returns (string memory) {
        return "Middle";
    }
}

contract Child is Middle {
    function foo() public override returns (string memory) {
        return super.foo();
    }
    
    function bar() public override returns (string memory) {
        return "Child";
    }
}
```

## Inheritance Patterns

### Diamond Pattern
```solidity
contract Storage {
    mapping(bytes32 => uint256) private values;
    
    function getValue(bytes32 key) internal view returns (uint256) {
        return values[key];
    }
    
    function setValue(bytes32 key, uint256 value) internal {
        values[key] = value;
    }
}

contract Features is Storage {
    bytes32 private constant TOTAL_SUPPLY = keccak256("TOTAL_SUPPLY");
    
    function setTotalSupply(uint256 amount) public {
        setValue(TOTAL_SUPPLY, amount);
    }
    
    function getTotalSupply() public view returns (uint256) {
        return getValue(TOTAL_SUPPLY);
    }
}

contract Token is Features {
    // Additional token functionality
}
```

### Proxy Pattern
```solidity
contract Proxy {
    address public implementation;
    
    function upgradeTo(address newImplementation) public {
        implementation = newImplementation;
    }
    
    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, 0) }
            default { return(0, returndatasize()) }
        }
    }
}
```

## Best Practices

1. Design Principles
   - Keep inheritance depth shallow
   - Use composition when possible
   - Follow C3 linearization
   - Document inheritance chain

2. Implementation
   - Use abstract contracts
   - Implement all functions
   - Handle constructor parameters
   - Consider visibility

3. Security
   - Check inheritance order
   - Validate overrides
   - Handle state variables
   - Prevent function shadowing

## Common Patterns

### State Machine
```solidity
abstract contract StateMachine {
    enum State { Created, Active, Paused, Ended }
    State public state = State.Created;
    
    modifier inState(State _state) {
        require(state == _state, "Invalid state");
        _;
    }
    
    function changeState(State _state) internal {
        state = _state;
    }
}

contract Game is StateMachine {
    function start() public inState(State.Created) {
        // Start game logic
        changeState(State.Active);
    }
    
    function pause() public inState(State.Active) {
        // Pause game logic
        changeState(State.Paused);
    }
}
```

### Access Control
```solidity
abstract contract Auth {
    mapping(address => mapping(bytes4 => bool)) private permissions;
    
    function authorize(address user, bytes4 funcSig) internal {
        permissions[user][funcSig] = true;
    }
    
    modifier authorized() {
        require(
            permissions[msg.sender][msg.sig],
            "Not authorized"
        );
        _;
    }
}

contract Protected is Auth {
    function sensitiveOperation() public authorized {
        // Protected logic
    }
}
```

## Practice Exercise

Create a system that:
1. Uses multiple inheritance
2. Implements abstract contracts
3. Uses virtual and override
4. Manages state transitions
5. Handles access control

## Key Takeaways

- Understand inheritance rules
- Use appropriate patterns
- Follow best practices
- Consider security implications
- Document inheritance chains

Remember: Well-designed inheritance hierarchies improve code organization and maintainability. 