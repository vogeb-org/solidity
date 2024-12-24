# Timelock and Multisig Patterns

## Introduction

Timelock and multisig patterns are essential security mechanisms in smart contracts. This guide covers their implementation, use cases, and best practices.

## Timelock Pattern

### Basic Timelock
```solidity
contract Timelock {
    uint256 public constant DELAY = 2 days;
    
    mapping(bytes32 => bool) public queuedTransactions;
    
    event QueueTransaction(bytes32 indexed txHash, address target, uint256 value, bytes data, uint256 eta);
    event ExecuteTransaction(bytes32 indexed txHash, address target, uint256 value, bytes data);
    event CancelTransaction(bytes32 indexed txHash, address target, uint256 value, bytes data);
    
    function queueTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) public returns (bytes32) {
        bytes32 txHash = keccak256(abi.encode(target, value, data));
        uint256 eta = block.timestamp + DELAY;
        
        queuedTransactions[txHash] = true;
        emit QueueTransaction(txHash, target, value, data, eta);
        
        return txHash;
    }
    
    function executeTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) public payable returns (bytes memory) {
        bytes32 txHash = keccak256(abi.encode(target, value, data));
        require(queuedTransactions[txHash], "Transaction not queued");
        require(block.timestamp >= eta, "Timelock not expired");
        
        queuedTransactions[txHash] = false;
        
        (bool success, bytes memory returnData) = target.call{value: value}(data);
        require(success, "Transaction failed");
        
        emit ExecuteTransaction(txHash, target, value, data);
        
        return returnData;
    }
    
    function cancelTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) public {
        bytes32 txHash = keccak256(abi.encode(target, value, data));
        queuedTransactions[txHash] = false;
        
        emit CancelTransaction(txHash, target, value, data);
    }
}
```

## Multisig Pattern

### Basic Multisig
```solidity
contract Multisig {
    address[] public owners;
    uint256 public required;
    
    mapping(bytes32 => mapping(address => bool)) public confirmations;
    mapping(bytes32 => bool) public executed;
    
    event Submission(bytes32 indexed transactionId);
    event Confirmation(address indexed sender, bytes32 indexed transactionId);
    event Execution(bytes32 indexed transactionId);
    
    constructor(address[] memory _owners, uint256 _required) {
        require(_owners.length > 0, "Owners required");
        require(_required > 0 && _required <= _owners.length, "Invalid required number");
        
        owners = _owners;
        required = _required;
    }
    
    function submitTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) public returns (bytes32) {
        bytes32 txId = keccak256(abi.encode(target, value, data, block.number));
        confirmations[txId][msg.sender] = true;
        
        emit Submission(txId);
        emit Confirmation(msg.sender, txId);
        
        return txId;
    }
    
    function confirmTransaction(bytes32 txId) public {
        require(!executed[txId], "Already executed");
        confirmations[txId][msg.sender] = true;
        
        emit Confirmation(msg.sender, txId);
    }
    
    function executeTransaction(
        address target,
        uint256 value,
        bytes memory data,
        bytes32 txId
    ) public {
        require(!executed[txId], "Already executed");
        require(getConfirmationCount(txId) >= required, "Not enough confirmations");
        
        executed[txId] = true;
        
        (bool success,) = target.call{value: value}(data);
        require(success, "Transaction failed");
        
        emit Execution(txId);
    }
    
    function getConfirmationCount(bytes32 txId) public view returns (uint256 count) {
        for (uint256 i = 0; i < owners.length; i++) {
            if (confirmations[txId][owners[i]]) {
                count++;
            }
        }
    }
}
```

## Combined Pattern

### Timelock Multisig
```solidity
contract TimelockMultisig {
    uint256 public constant DELAY = 2 days;
    uint256 public required;
    address[] public owners;
    
    struct Transaction {
        address target;
        uint256 value;
        bytes data;
        uint256 eta;
        bool executed;
        mapping(address => bool) confirmations;
    }
    
    mapping(bytes32 => Transaction) public transactions;
    
    event TransactionSubmitted(bytes32 indexed txId, address target, uint256 value, bytes data, uint256 eta);
    event TransactionConfirmed(bytes32 indexed txId, address indexed owner);
    event TransactionExecuted(bytes32 indexed txId);
    
    function submitTransaction(
        address target,
        uint256 value,
        bytes memory data
    ) public returns (bytes32) {
        bytes32 txId = keccak256(abi.encode(target, value, data, block.number));
        uint256 eta = block.timestamp + DELAY;
        
        Transaction storage transaction = transactions[txId];
        transaction.target = target;
        transaction.value = value;
        transaction.data = data;
        transaction.eta = eta;
        transaction.confirmations[msg.sender] = true;
        
        emit TransactionSubmitted(txId, target, value, data, eta);
        emit TransactionConfirmed(txId, msg.sender);
        
        return txId;
    }
    
    function confirmTransaction(bytes32 txId) public {
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "Already executed");
        require(!transaction.confirmations[msg.sender], "Already confirmed");
        
        transaction.confirmations[msg.sender] = true;
        emit TransactionConfirmed(txId, msg.sender);
    }
    
    function executeTransaction(bytes32 txId) public {
        Transaction storage transaction = transactions[txId];
        require(!transaction.executed, "Already executed");
        require(block.timestamp >= transaction.eta, "Timelock not expired");
        require(getConfirmationCount(txId) >= required, "Not enough confirmations");
        
        transaction.executed = true;
        
        (bool success,) = transaction.target.call{value: transaction.value}(transaction.data);
        require(success, "Transaction failed");
        
        emit TransactionExecuted(txId);
    }
    
    function getConfirmationCount(bytes32 txId) public view returns (uint256 count) {
        Transaction storage transaction = transactions[txId];
        for (uint256 i = 0; i < owners.length; i++) {
            if (transaction.confirmations[owners[i]]) {
                count++;
            }
        }
    }
}
```

## Best Practices

1. Security
   - Validate owners
   - Check delays
   - Verify signatures
   - Handle errors

2. Implementation
   - Use modifiers
   - Emit events
   - Document states
   - Test thoroughly

3. Upgrades
   - Plan migrations
   - Version control
   - Backup data
   - Test upgrades

## Common Patterns

### Access Control
```solidity
contract AccessControl {
    mapping(address => bool) public owners;
    uint256 public required;
    
    modifier onlyOwner() {
        require(owners[msg.sender], "Not owner");
        _;
    }
    
    modifier onlyTimelocked() {
        require(block.timestamp >= eta, "Timelock not expired");
        _;
    }
    
    modifier onlyConfirmed(bytes32 txId) {
        require(getConfirmationCount(txId) >= required, "Not enough confirmations");
        _;
    }
}
```

## Practice Exercise

Create a system that:
1. Implements timelock
2. Handles multisig
3. Combines patterns
4. Manages access
5. Monitors states

## Key Takeaways

- Use timelock for delay
- Implement multisig for consensus
- Combine patterns for security
- Follow best practices
- Test thoroughly

Remember: Security patterns require careful implementation and testing. 