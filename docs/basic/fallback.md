# Fallback and Receive Functions

## Introduction

Fallback and receive functions are special functions in Solidity that handle unexpected or direct Ether transfers. This guide covers their usage, differences, and best practices.

## Basic Usage

### Fallback Function
```solidity
contract FallbackExample {
    event FallbackCalled(address sender, uint256 value, bytes data);
    
    // Called when no other function matches or
    // when Ether is sent with data
    fallback() external payable {
        emit FallbackCalled(msg.sender, msg.value, msg.data);
    }
    
    // Basic function to compare
    function normalFunction() public pure returns (string memory) {
        return "Normal function called";
    }
}
```

### Receive Function
```solidity
contract ReceiveExample {
    event Received(address sender, uint256 value);
    
    // Called when Ether is sent with empty calldata
    receive() external payable {
        emit Received(msg.sender, msg.value);
    }
    
    // Check contract balance
    function getBalance() public view returns (uint256) {
        return address(this).balance;
    }
}
```

## Advanced Usage

### Function Selection
```solidity
contract FunctionSelector {
    event FallbackCalled(bytes data);
    event ReceiveCalled(uint256 value);
    
    // Called for empty calldata with Ether
    receive() external payable {
        emit ReceiveCalled(msg.value);
    }
    
    // Called for non-empty calldata or
    // when receive doesn't exist
    fallback() external payable {
        emit FallbackCalled(msg.data);
    }
    
    // Function selection flow:
    // 1. If msg.data is empty and receive exists -> receive()
    // 2. If msg.data is not empty or receive doesn't exist -> fallback()
    // 3. If neither exists -> transaction reverts
}
```

### Proxy Pattern
```solidity
contract ProxyContract {
    address public implementation;
    
    constructor(address _implementation) {
        implementation = _implementation;
    }
    
    // Forwards all calls to implementation
    fallback() external payable {
        address impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
    
    receive() external payable {
        // Handle direct Ether transfers
    }
}
```

## Best Practices

1. Function Usage
   - Use receive for plain Ether transfers
   - Use fallback for unknown functions
   - Keep functions simple
   - Handle errors gracefully

2. Security
   - Validate inputs
   - Check msg.value
   - Limit functionality
   - Prevent reentrancy

3. Gas Efficiency
   - Minimize operations
   - Avoid complex logic
   - Consider gas limits
   - Optimize storage

## Common Patterns

### Payment Handler
```solidity
contract PaymentHandler {
    event PaymentReceived(address from, uint256 amount);
    event PaymentForwarded(address to, uint256 amount);
    
    address payable public owner;
    
    constructor() {
        owner = payable(msg.sender);
    }
    
    receive() external payable {
        emit PaymentReceived(msg.sender, msg.value);
        
        // Forward payment to owner
        (bool success,) = owner.call{value: msg.value}("");
        require(success, "Forward failed");
        emit PaymentForwarded(owner, msg.value);
    }
    
    fallback() external payable {
        revert("Use receive function");
    }
}
```

### Smart Wallet
```solidity
contract SmartWallet {
    mapping(address => bool) public authorized;
    
    constructor() {
        authorized[msg.sender] = true;
    }
    
    receive() external payable {
        // Accept Ether
    }
    
    fallback() external payable {
        // Handle unknown calls
        require(authorized[msg.sender], "Not authorized");
        
        address target = address(bytes20(msg.data[0:20]));
        bytes memory data = msg.data[20:];
        
        (bool success,) = target.call{value: msg.value}(data);
        require(success, "Call failed");
    }
    
    function authorize(address user) external {
        require(authorized[msg.sender], "Not authorized");
        authorized[user] = true;
    }
}
```

## Practice Exercise

Create contracts that:
1. Handle Ether transfers
2. Implement proxy pattern
3. Forward payments
4. Validate calls
5. Manage permissions

## Key Takeaways

- Understand function selection
- Implement security checks
- Handle Ether properly
- Follow best practices
- Consider gas costs

Remember: Fallback and receive functions are powerful but require careful implementation. 