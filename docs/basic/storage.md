# Storage in Solidity

## Introduction

Understanding storage in Solidity is crucial for efficient smart contract development. This guide covers storage types, patterns, and optimization techniques.

## Storage Types

### State Variables
```solidity
contract StorageExample {
    // Storage variables - persistent across function calls
    uint256 public storedValue;          // Stored in slot 0
    address public owner;                // Stored in slot 1
    mapping(address => uint256) public balances;  // Stored in slot 2
    
    constructor() {
        owner = msg.sender;
        storedValue = 100;
    }
}
```

### Memory vs Storage
```solidity
contract MemoryVsStorage {
    struct Data {
        uint256 value;
        string name;
    }
    
    Data[] public items;
    
    // Storage reference - modifies original data
    function updateStorage(uint256 index) public {
        Data storage item = items[index];
        item.value = 100;  // Changes persistent storage
    }
    
    // Memory copy - works with local copy
    function updateMemory(uint256 index) public view returns (uint256) {
        Data memory item = items[index];
        item.value = 100;  // Changes only local copy
        return item.value; // Returns 100, but storage remains unchanged
    }
}
```

## Storage Patterns

### Packed Storage
```solidity
contract PackedStorage {
    // Unpacked - uses multiple slots
    uint256 public a;  // 32 bytes - Slot 0
    uint256 public b;  // 32 bytes - Slot 1
    
    // Packed - uses single slot
    uint128 public c;  // 16 bytes - Slot 2
    uint128 public d;  // 16 bytes - Same slot as c
    
    // Packed struct
    struct PackedData {
        uint128 value1;  // 16 bytes
        uint128 value2;  // 16 bytes
    }
    
    function compareGas() public {
        // More expensive - two SSTORE operations
        a = 1;
        b = 2;
        
        // Cheaper - single SSTORE operation
        c = 1;
        d = 2;
    }
}
```

### Storage Pointers
```solidity
contract StoragePointers {
    struct ComplexData {
        uint256[] values;
        mapping(uint256 => bool) flags;
    }
    
    ComplexData private data;
    
    function manipulateStorage() public {
        // Storage pointer - efficient for multiple operations
        ComplexData storage ptr = data;
        
        // All operations use the same storage reference
        ptr.values.push(100);
        ptr.flags[100] = true;
    }
}
```

## Advanced Storage

### Delegated Storage
```solidity
contract StorageContract {
    mapping(bytes32 => uint256) private _storage;
    
    function setValue(bytes32 key, uint256 value) internal {
        _storage[key] = value;
    }
    
    function getValue(bytes32 key) internal view returns (uint256) {
        return _storage[key];
    }
}

contract DataContract is StorageContract {
    bytes32 private constant TOTAL_KEY = keccak256("TOTAL");
    
    function setTotal(uint256 value) public {
        setValue(TOTAL_KEY, value);
    }
    
    function getTotal() public view returns (uint256) {
        return getValue(TOTAL_KEY);
    }
}
```

### Eternal Storage
```solidity
contract EternalStorage {
    mapping(bytes32 => uint256) private uintStorage;
    mapping(bytes32 => string) private stringStorage;
    mapping(bytes32 => address) private addressStorage;
    mapping(bytes32 => bytes) private bytesStorage;
    mapping(bytes32 => bool) private boolStorage;
    mapping(bytes32 => int256) private intStorage;
    
    function setUint(bytes32 key, uint256 value) internal {
        uintStorage[key] = value;
    }
    
    function getUint(bytes32 key) internal view returns (uint256) {
        return uintStorage[key];
    }
    
    // Similar functions for other types...
}
```

## Best Practices

1. Storage Optimization
   - Pack similar variables
   - Use appropriate types
   - Minimize storage operations
   - Consider gas costs

2. Memory Management
   - Use memory for read-only operations
   - Avoid unnecessary copies
   - Clean up temporary data
   - Manage array sizes

3. Security
   - Protect storage access
   - Validate storage updates
   - Handle storage collisions
   - Implement access control

## Common Patterns

### Storage Layout
```solidity
contract LayoutExample {
    // Fixed layout - never modify order
    uint256 private constant VERSION = 1;
    address public immutable ADMIN;
    
    // Upgradeable layout
    uint256 private _value1;  // Slot 0
    uint256 private _value2;  // Slot 1
    mapping(address => uint256) private _balances;  // Slot 2
    
    // Gap for future upgrades
    uint256[47] private __gap;
    
    constructor() {
        ADMIN = msg.sender;
    }
}
```

### Storage Libraries
```solidity
library StorageLib {
    struct Position {
        uint256 slot;
    }
    
    function getUint(Position storage position) internal view returns (uint256 value) {
        assembly {
            value := sload(position.slot)
        }
    }
    
    function setUint(Position storage position, uint256 value) internal {
        assembly {
            sstore(position.slot, value)
        }
    }
}
```

## Practice Exercise

Create a system that:
1. Uses packed storage
2. Implements storage pointers
3. Manages complex data structures
4. Optimizes gas usage
5. Handles upgrades

## Key Takeaways

- Understand storage mechanics
- Optimize storage layout
- Use appropriate patterns
- Consider gas costs
- Implement security measures

Remember: Efficient storage management is crucial for gas optimization and contract sustainability. 