# Assembly in Solidity

## Introduction

Inline assembly in Solidity provides low-level access to the EVM. While powerful, it should be used carefully as it bypasses many of Solidity's safety features.

## Basic Assembly

### Memory Operations
```solidity
contract MemoryAssembly {
    function copyMemory(uint256[] memory source) public pure returns (uint256[] memory) {
        uint256[] memory result;
        
        assembly {
            // Get array length
            let length := mload(source)
            
            // Allocate new array
            result := mload(0x40)
            mstore(0x40, add(result, add(0x20, mul(length, 0x20))))
            
            // Store length
            mstore(result, length)
            
            // Copy elements
            for { let i := 0 } lt(i, length) { i := add(i, 1) } {
                let sourceElement := mload(add(add(source, 0x20), mul(i, 0x20)))
                mstore(add(add(result, 0x20), mul(i, 0x20)), sourceElement)
            }
        }
        
        return result;
    }
}
```

### Storage Operations
```solidity
contract StorageAssembly {
    uint256 private value;
    
    function setValue(uint256 newValue) public {
        assembly {
            // Store value at slot 0
            sstore(0, newValue)
        }
    }
    
    function getValue() public view returns (uint256) {
        assembly {
            // Load value from slot 0
            let result := sload(0)
            
            // Return value
            mstore(0x40, result)
            return(0x40, 32)
        }
    }
}
```

## Advanced Assembly

### Function Calls
```solidity
contract CallAssembly {
    function callContract(address target, bytes memory data) public returns (bool success) {
        assembly {
            // Get data location and length
            let dataLength := mload(data)
            let dataStart := add(data, 0x20)
            
            // Perform call
            success := call(
                gas(),      // Forward all gas
                target,     // Target address
                0,         // No value sent
                dataStart, // Input data start
                dataLength, // Input data length
                0,         // Output data start
                0          // Output data length
            )
        }
    }
}
```

### Error Handling
```solidity
contract ErrorAssembly {
    function requireCustom(bool condition, string memory message) public pure {
        assembly {
            // Check condition
            if iszero(condition) {
                // Get error message
                let length := mload(message)
                let data := add(message, 0x20)
                
                // Revert with message
                revert(data, length)
            }
        }
    }
}
```

## Assembly Patterns

### Efficient Storage
```solidity
contract PackedStorageAssembly {
    // Pack multiple values into single storage slot
    function packValues(uint128 a, uint128 b) public {
        assembly {
            // Combine values into single slot
            let packed := or(a, shl(128, b))
            sstore(0, packed)
        }
    }
    
    function unpackValues() public view returns (uint128, uint128) {
        assembly {
            let packed := sload(0)
            
            // Extract values
            let a := and(packed, 0xffffffffffffffffffffffffffffffff)
            let b := shr(128, packed)
            
            // Store results in memory
            mstore(0x40, a)
            mstore(0x60, b)
            return(0x40, 64)
        }
    }
}
```

### Memory Management
```solidity
contract MemoryManagementAssembly {
    function efficientCopy(bytes memory data) public pure returns (bytes memory) {
        bytes memory result;
        
        assembly {
            // Get length and data pointer
            let length := mload(data)
            let dataPtr := add(data, 0x20)
            
            // Allocate new memory
            result := mload(0x40)
            mstore(0x40, add(result, add(0x20, length)))
            
            // Store length
            mstore(result, length)
            
            // Copy data using single operation
            pop(staticcall(gas(), 4, dataPtr, length, add(result, 0x20), length))
        }
        
        return result;
    }
}
```

## Best Practices

1. Safety Considerations
   - Document assembly code
   - Validate inputs
   - Check bounds
   - Handle errors

2. Optimization
   - Minimize memory allocation
   - Use efficient operations
   - Avoid redundant computations
   - Consider gas costs

3. Maintainability
   - Keep assembly minimal
   - Use clear naming
   - Add comments
   - Test thoroughly

## Common Patterns

### Bit Operations
```solidity
contract BitAssembly {
    function setBit(uint256 value, uint8 bit) public pure returns (uint256) {
        assembly {
            // Set bit using OR operation
            value := or(value, shl(bit, 1))
            
            // Return result
            mstore(0x40, value)
            return(0x40, 32)
        }
    }
    
    function clearBit(uint256 value, uint8 bit) public pure returns (uint256) {
        assembly {
            // Clear bit using AND operation
            value := and(value, not(shl(bit, 1)))
            
            // Return result
            mstore(0x40, value)
            return(0x40, 32)
        }
    }
}
```

### Hash Functions
```solidity
contract HashAssembly {
    function efficientKeccak(bytes memory data) public pure returns (bytes32) {
        bytes32 result;
        
        assembly {
            // Hash data directly from memory
            result := keccak256(add(data, 0x20), mload(data))
        }
        
        return result;
    }
}
```

## Practice Exercise

Create functions that:
1. Use memory operations
2. Manipulate storage
3. Perform efficient calls
4. Handle errors
5. Optimize gas usage

## Key Takeaways

- Use assembly sparingly
- Understand EVM operations
- Follow best practices
- Document thoroughly
- Test extensively

Remember: Assembly provides powerful capabilities but requires careful handling to maintain security and correctness. 