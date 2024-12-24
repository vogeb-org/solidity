# Optimization in Solidity

## Introduction

Optimization in Solidity focuses on reducing gas costs and improving contract efficiency. This guide covers optimization techniques, patterns, and best practices.

## Gas Optimization

### Storage Optimization
```solidity
contract StorageOptimized {
    // Unoptimized: Uses multiple storage slots
    uint256 public value1;  // Slot 0
    uint256 public value2;  // Slot 1
    
    // Optimized: Packs variables into single slot
    uint128 public value3;  // Slot 2 (first half)
    uint128 public value4;  // Slot 2 (second half)
    
    // Optimized struct packing
    struct PackedData {
        uint128 amount;     // 16 bytes
        uint64 timestamp;   // 8 bytes
        uint64 identifier;  // 8 bytes
    }
    
    function compareGas() public {
        // More expensive - two SSTORE operations
        value1 = 100;
        value2 = 200;
        
        // Cheaper - single SSTORE operation
        value3 = 100;
        value4 = 200;
    }
}
```

### Memory Management
```solidity
contract MemoryOptimized {
    // Expensive: Creates new array in memory
    function unoptimizedSum(uint256[] memory data) public pure returns (uint256) {
        uint256[] memory temp = new uint256[](data.length);
        uint256 sum = 0;
        
        for (uint256 i = 0; i < data.length; i++) {
            temp[i] = data[i];
            sum += temp[i];
        }
        
        return sum;
    }
    
    // Cheaper: Direct calculation
    function optimizedSum(uint256[] calldata data) public pure returns (uint256) {
        uint256 sum = 0;
        
        for (uint256 i = 0; i < data.length; i++) {
            sum += data[i];
        }
        
        return sum;
    }
}
```

## Computational Optimization

### Loop Optimization
```solidity
contract LoopOptimized {
    // Expensive: Multiple storage reads
    function unoptimizedLoop(uint256[] storage data) internal {
        uint256 length = data.length;  // SLOAD operation
        for (uint256 i = 0; i < length; i++) {
            data[i] = data[i] * 2;     // SLOAD + SSTORE operations
        }
    }
    
    // Cheaper: Cached storage reads
    function optimizedLoop(uint256[] storage data) internal {
        uint256 length = data.length;
        uint256 temp;
        for (uint256 i = 0; i < length; i++) {
            temp = data[i];            // Single SLOAD
            data[i] = temp * 2;        // Single SSTORE
        }
    }
}
```

### Bit Operations
```solidity
contract BitOptimized {
    // Expensive: Uses multiple storage slots
    mapping(address => bool) public isOperator;
    mapping(address => bool) public isAdmin;
    mapping(address => bool) public isUser;
    
    // Cheaper: Uses bit flags in single uint256
    mapping(address => uint256) public permissions;
    uint256 constant OPERATOR_FLAG = 1;
    uint256 constant ADMIN_FLAG = 2;
    uint256 constant USER_FLAG = 4;
    
    function optimizedSetPermissions(address user, uint256 flags) public {
        permissions[user] = flags;  // Single SSTORE
    }
    
    function optimizedCheckPermission(address user, uint256 flag) public view returns (bool) {
        return permissions[user] & flag != 0;  // Single SLOAD
    }
}
```

## Advanced Optimization

### Assembly Optimization
```solidity
contract AssemblyOptimized {
    // Standard Solidity
    function standardBalance(address token, address account) public view returns (uint256) {
        IERC20 tokenContract = IERC20(token);
        return tokenContract.balanceOf(account);
    }
    
    // Assembly optimized
    function assemblyBalance(address token, address account) public view returns (uint256) {
        bytes4 selector = 0x70a08231;  // balanceOf(address)
        uint256 balance;
        
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, selector)
            mstore(add(ptr, 0x04), account)
            
            let success := staticcall(
                gas(),      // Forward all gas
                token,      // Token contract address
                ptr,        // Input data start
                0x24,       // Input data length (4 + 32)
                ptr,        // Output data start
                0x20        // Output data length
            )
            
            if success {
                balance := mload(ptr)
            }
        }
        
        return balance;
    }
}
```

### Batch Operations
```solidity
contract BatchOptimized {
    // Expensive: Multiple transactions
    function unoptimizedTransfers(address[] memory to, uint256[] memory amounts) public {
        for (uint256 i = 0; i < to.length; i++) {
            transfer(to[i], amounts[i]);  // Each transfer is a separate transaction
        }
    }
    
    // Cheaper: Single transaction
    function batchTransfer(address[] memory to, uint256[] memory amounts) public {
        require(to.length == amounts.length, "Length mismatch");
        uint256 totalAmount;
        
        for (uint256 i = 0; i < to.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(balanceOf(msg.sender) >= totalAmount, "Insufficient balance");
        
        for (uint256 i = 0; i < to.length; i++) {
            _transfer(msg.sender, to[i], amounts[i]);
        }
    }
}
```

## Best Practices

1. Storage
   - Pack variables
   - Use appropriate types
   - Minimize storage operations
   - Cache storage values

2. Computation
   - Optimize loops
   - Use bit operations
   - Implement batching
   - Consider assembly

3. Gas Usage
   - Monitor gas costs
   - Profile operations
   - Benchmark code
   - Document optimizations

## Common Patterns

### Efficient Events
```solidity
contract EventOptimized {
    // Expensive: All fields indexed
    event Transfer(
        address indexed from,
        address indexed to,
        uint256 indexed amount
    );
    
    // Cheaper: Only necessary fields indexed
    event OptimizedTransfer(
        address indexed from,
        address indexed to,
        uint256 amount  // Not indexed
    );
}
```

### Efficient Storage
```solidity
contract StoragePatterns {
    // Single-slot packed struct
    struct UserData {
        uint64 balance;    // 8 bytes
        uint64 lastUpdate; // 8 bytes
        uint32 flags;      // 4 bytes
        address user;      // 20 bytes
    }
    
    // Efficient mapping
    mapping(bytes32 => UserData) private userData;
    
    function optimizedUpdate(bytes32 key, uint64 balance) public {
        UserData storage data = userData[key];  // Single SLOAD
        data.balance = balance;
        data.lastUpdate = uint64(block.timestamp);
        // Single SSTORE due to struct packing
    }
}
```

## Practice Exercise

Create optimizations that:
1. Reduce storage costs
2. Optimize computations
3. Implement batching
4. Use assembly
5. Monitor gas usage

## Key Takeaways

- Optimize storage usage
- Minimize computations
- Use efficient patterns
- Monitor gas costs
- Document optimizations

Remember: Optimization is a balance between code readability, maintainability, and gas efficiency. 