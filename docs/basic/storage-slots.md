# Storage Slots in Solidity

## Introduction

Storage slots are fundamental to Ethereum's state storage mechanism. This guide covers storage layout, slot manipulation, and best practices for efficient storage management.

## Basic Storage

### Storage Layout
```solidity
contract StorageBasics {
    // Slot 0
    uint256 public value1;
    
    // Slot 1
    uint256 public value2;
    
    // Slot 2 (packed)
    uint128 public value3;  // First half
    uint128 public value4;  // Second half
    
    // Dynamic slot (keccak256(0))
    mapping(address => uint256) public balances;
    
    // Dynamic array slot (keccak256(1))
    uint256[] public values;
}
```

### Slot Calculation
```solidity
contract SlotCalculation {
    function getStorageSlot(
        uint256 slot,
        uint256 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(slot, index));
    }
    
    function getMappingSlot(
        uint256 slot,
        address key
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(key, slot));
    }
    
    function getArraySlot(
        uint256 slot,
        uint256 index
    ) public pure returns (bytes32) {
        return bytes32(uint256(keccak256(abi.encodePacked(slot))) + index);
    }
}
```

## Advanced Storage

### Unstructured Storage
```solidity
contract UnstructuredStorage {
    bytes32 private constant ADMIN_SLOT = 
        bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);
    bytes32 private constant IMPLEMENTATION_SLOT = 
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    
    function _setSlotValue(bytes32 slot, address value) internal {
        assembly {
            sstore(slot, value)
        }
    }
    
    function _getSlotValue(bytes32 slot) internal view returns (address value) {
        assembly {
            value := sload(slot)
        }
    }
}
```

### Storage Pointers
```solidity
contract StoragePointers {
    struct Data {
        uint256 value;
        address owner;
    }
    
    mapping(bytes32 => Data) private dataStore;
    
    function storeData(
        bytes32 key,
        uint256 value,
        address owner
    ) public {
        Data storage data = dataStore[key];
        data.value = value;
        data.owner = owner;
    }
    
    function getData(
        bytes32 key
    ) public view returns (Data memory) {
        return dataStore[key];
    }
}
```

## Best Practices

1. Layout
   - Pack variables
   - Order by size
   - Document slots
   - Avoid gaps

2. Access
   - Use assembly carefully
   - Validate slots
   - Cache reads
   - Batch writes

3. Security
   - Protect critical slots
   - Validate values
   - Handle collisions
   - Monitor usage

## Common Patterns

### Slot Libraries
```solidity
library StorageSlot {
    struct AddressSlot {
        address value;
    }
    
    struct BooleanSlot {
        bool value;
    }
    
    struct Bytes32Slot {
        bytes32 value;
    }
    
    function getAddressSlot(
        bytes32 slot
    ) internal pure returns (AddressSlot storage r) {
        assembly {
            r.slot := slot
        }
    }
    
    function getBooleanSlot(
        bytes32 slot
    ) internal pure returns (BooleanSlot storage r) {
        assembly {
            r.slot := slot
        }
    }
    
    function getBytes32Slot(
        bytes32 slot
    ) internal pure returns (Bytes32Slot storage r) {
        assembly {
            r.slot := slot
        }
    }
}
```

### Safe Storage
```solidity
contract SafeStorage {
    using StorageSlot for bytes32;
    
    event StorageSet(bytes32 indexed slot, address value);
    
    function setAddress(bytes32 slot, address value) internal {
        require(value != address(0), "Invalid address");
        StorageSlot.AddressSlot storage s = slot.getAddressSlot();
        s.value = value;
        emit StorageSet(slot, value);
    }
    
    function getAddress(bytes32 slot) internal view returns (address) {
        return slot.getAddressSlot().value;
    }
}
```

## Practice Exercise

Create storage patterns that:
1. Use unstructured storage
2. Handle complex data
3. Optimize access
4. Ensure safety
5. Monitor changes

## Key Takeaways

- Understand slot layout
- Use proper patterns
- Optimize access
- Ensure security
- Document usage

Remember: Proper storage management is crucial for contract efficiency and security. 