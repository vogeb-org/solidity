# Gas Optimization Techniques

## Introduction

Gas optimization is crucial for cost-effective smart contract deployment and execution. This guide covers advanced techniques for reducing gas consumption.

## Storage Optimization

### Variable Packing
```solidity
contract StoragePacking {
    // Unoptimized: Uses 3 storage slots
    uint256 a;  // 32 bytes
    uint128 b;  // 16 bytes
    uint96 c;   // 12 bytes
    
    // Optimized: Uses 2 storage slots
    uint128 d;  // Slot 1 (16 bytes)
    uint96 e;   // Slot 1 (12 bytes)
    uint256 f;  // Slot 2 (32 bytes)
    
    // Optimized struct
    struct PackedData {
        uint128 value;    // 16 bytes
        uint64 timestamp; // 8 bytes
        uint64 id;       // 8 bytes
    }
}
```

### Storage vs Memory
```solidity
contract StorageVsMemory {
    struct Data {
        uint256[] values;
        string name;
    }
    
    mapping(uint256 => Data) private items;
    
    // Expensive: Multiple storage reads
    function unoptimizedSum(uint256 id) public view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < items[id].values.length; i++) {
            total += items[id].values[i];
        }
        return total;
    }
    
    // Cheaper: Single storage read
    function optimizedSum(uint256 id) public view returns (uint256) {
        Data storage data = items[id];
        uint256 total = 0;
        for (uint256 i = 0; i < data.values.length; i++) {
            total += data.values[i];
        }
        return total;
    }
}
```

## Computation Optimization

### Loop Optimization
```solidity
contract LoopOptimization {
    // Expensive: Multiple storage reads and writes
    function unoptimizedLoop(uint256[] storage data) internal {
        uint256 length = data.length;
        for (uint256 i = 0; i < length; i++) {
            data[i] = data[i] * 2;
        }
    }
    
    // Cheaper: Cached storage reads
    function optimizedLoop(uint256[] storage data) internal {
        uint256 length = data.length;
        uint256 temp;
        for (uint256 i = 0; i < length; i++) {
            temp = data[i];
            data[i] = temp * 2;
        }
    }
}
```

### Batch Operations
```solidity
contract BatchOperations {
    mapping(address => uint256) public balances;
    
    // Expensive: Multiple transactions
    function unoptimizedTransfers(
        address[] memory to,
        uint256[] memory amounts
    ) public {
        for (uint256 i = 0; i < to.length; i++) {
            balances[msg.sender] -= amounts[i];
            balances[to[i]] += amounts[i];
        }
    }
    
    // Cheaper: Single transaction
    function optimizedTransfers(
        address[] memory to,
        uint256[] memory amounts
    ) public {
        uint256 totalAmount;
        for (uint256 i = 0; i < to.length; i++) {
            totalAmount += amounts[i];
        }
        
        require(balances[msg.sender] >= totalAmount, "Insufficient balance");
        balances[msg.sender] -= totalAmount;
        
        for (uint256 i = 0; i < to.length; i++) {
            balances[to[i]] += amounts[i];
        }
    }
}
```

## Best Practices

1. Storage
   - Pack variables
   - Use appropriate types
   - Cache storage values
   - Minimize storage writes

2. Computation
   - Optimize loops
   - Use batch operations
   - Avoid redundant calculations
   - Consider memory usage

3. Gas Usage
   - Monitor gas costs
   - Use gas-efficient patterns
   - Benchmark operations
   - Document optimizations

## Common Patterns

### Efficient Events
```solidity
contract EventOptimization {
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
contract StorageOptimization {
    // Single-slot packed struct
    struct UserData {
        uint64 balance;    // 8 bytes
        uint64 lastUpdate; // 8 bytes
        uint32 flags;      // 4 bytes
        address user;      // 20 bytes
    }
    
    // Efficient mapping
    mapping(bytes32 => UserData) private userData;
    
    function updateData(bytes32 key, uint64 balance) public {
        UserData storage data = userData[key];
        data.balance = balance;
        data.lastUpdate = uint64(block.timestamp);
    }
}
```

## Practice Exercise

Create optimizations that:
1. Reduce storage costs
2. Optimize computations
3. Implement batching
4. Use efficient patterns
5. Monitor gas usage

## Key Takeaways

- Pack storage variables
- Cache storage reads
- Optimize computations
- Use batch operations
- Monitor gas costs

Remember: Gas optimization is a balance between code readability and efficiency. 