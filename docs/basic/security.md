# Security in Solidity

## Introduction

Security is paramount in smart contract development. This guide covers common vulnerabilities, best practices, and security patterns to protect your contracts.

## Common Vulnerabilities

### Reentrancy
```solidity
// Vulnerable contract
contract Vulnerable {
    mapping(address => uint256) public balances;
    
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
        balances[msg.sender] = 0;  // Too late!
    }
}

// Secure contract
contract Secure {
    mapping(address => uint256) public balances;
    
    function withdraw() public {
        uint256 amount = balances[msg.sender];
        balances[msg.sender] = 0;  // Update before transfer
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Transfer failed");
    }
}
```

### Integer Overflow/Underflow
```solidity
contract SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
    
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }
}

contract Token {
    using SafeMath for uint256;
    mapping(address => uint256) public balances;
    
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[to] = balances[to].add(amount);
    }
}
```

## Access Control

### Role-Based Access
```solidity
contract RoleControl {
    mapping(address => mapping(bytes32 => bool)) private roles;
    
    modifier onlyRole(bytes32 role) {
        require(roles[msg.sender][role], "Unauthorized");
        _;
    }
    
    function grantRole(address account, bytes32 role) public {
        roles[account][role] = true;
    }
    
    function revokeRole(address account, bytes32 role) public {
        roles[account][role] = false;
    }
}
```

### Time Locks
```solidity
contract TimeLock {
    uint256 public constant DELAY = 2 days;
    mapping(bytes32 => uint256) public queue;
    
    function queueTransaction(address target, bytes memory data) public {
        bytes32 txHash = keccak256(abi.encode(target, data));
        queue[txHash] = block.timestamp + DELAY;
    }
    
    function executeTransaction(address target, bytes memory data) public {
        bytes32 txHash = keccak256(abi.encode(target, data));
        require(queue[txHash] != 0, "Not queued");
        require(block.timestamp >= queue[txHash], "Time lock not expired");
        
        delete queue[txHash];
        (bool success, ) = target.call(data);
        require(success, "Execution failed");
    }
}
```

## Input Validation

### Parameter Validation
```solidity
contract InputValidation {
    function transfer(address to, uint256 amount) public {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Invalid amount");
        require(amount <= balanceOf(msg.sender), "Insufficient balance");
        
        // Transfer logic
    }
    
    function setConfig(uint256 value) public {
        require(value >= minValue && value <= maxValue, "Value out of range");
        require(value % step == 0, "Invalid step value");
        
        // Set configuration
    }
}
```

### Signature Verification
```solidity
contract SignatureVerification {
    function verifySignature(
        bytes32 messageHash,
        uint8 v,
        bytes32 r,
        bytes32 s,
        address signer
    ) public pure returns (bool) {
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", messageHash)
        );
        
        address recoveredSigner = ecrecover(ethSignedMessageHash, v, r, s);
        return recoveredSigner == signer;
    }
}
```

## Security Patterns

### Emergency Stop
```solidity
contract EmergencyStop {
    bool public stopped;
    address public owner;
    
    modifier whenNotStopped() {
        require(!stopped, "Contract is paused");
        _;
    }
    
    modifier whenStopped() {
        require(stopped, "Contract not paused");
        _;
    }
    
    function toggleStop() public {
        require(msg.sender == owner, "Not owner");
        stopped = !stopped;
    }
    
    function deposit() public payable whenNotStopped {
        // Deposit logic
    }
    
    function withdraw() public whenNotStopped {
        // Withdraw logic
    }
    
    function emergencyWithdraw() public whenStopped {
        // Emergency withdrawal logic
    }
}
```

### Rate Limiting
```solidity
contract RateLimiter {
    uint256 public constant RATE_LIMIT = 1 ether;
    uint256 public constant RATE_PERIOD = 1 days;
    
    mapping(address => uint256) public lastWithdrawTime;
    mapping(address => uint256) public withdrawnAmount;
    
    function withdraw(uint256 amount) public {
        require(amount <= RATE_LIMIT, "Exceeds rate limit");
        
        if (block.timestamp >= lastWithdrawTime[msg.sender] + RATE_PERIOD) {
            withdrawnAmount[msg.sender] = 0;
        }
        
        require(withdrawnAmount[msg.sender] + amount <= RATE_LIMIT, 
                "Rate limit exceeded");
        
        withdrawnAmount[msg.sender] += amount;
        lastWithdrawTime[msg.sender] = block.timestamp;
        
        // Withdrawal logic
    }
}
```

## Best Practices

1. Code Quality
   - Use latest compiler version
   - Enable all compiler warnings
   - Follow style guide
   - Document thoroughly

2. Testing
   - Write comprehensive tests
   - Use test coverage tools
   - Perform security audits
   - Test edge cases

3. Deployment
   - Verify source code
   - Monitor transactions
   - Plan for upgrades
   - Have emergency procedures

## Common Attacks

### Front-Running Protection
```solidity
contract FrontRunningProtection {
    mapping(bytes32 => bool) public usedCommitments;
    
    function commit(bytes32 commitment) public {
        require(!usedCommitments[commitment], "Commitment already used");
        usedCommitments[commitment] = true;
    }
    
    function execute(
        bytes32 secret,
        uint256 value
    ) public {
        bytes32 commitment = keccak256(abi.encodePacked(secret, value, msg.sender));
        require(usedCommitments[commitment], "Invalid commitment");
        delete usedCommitments[commitment];
        
        // Execute operation
    }
}
```

## Practice Exercise

Create a contract that:
1. Implements access control
2. Handles input validation
3. Protects against reentrancy
4. Uses rate limiting
5. Includes emergency stops

## Key Takeaways

- Security first mindset
- Validate all inputs
- Protect state changes
- Implement access controls
- Plan for emergencies

Remember: Security is an ongoing process, not a one-time task. 