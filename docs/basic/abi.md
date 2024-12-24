# ABI (Application Binary Interface)

## Introduction

The ABI (Application Binary Interface) defines how to interact with Ethereum smart contracts. This guide covers ABI encoding, decoding, and best practices for contract interactions.

## Basic ABI

### Function Signatures
```solidity
contract ABIExample {
    // Function signature: transfer(address,uint256)
    // Function selector: 0xa9059cbb
    function transfer(address to, uint256 amount) public returns (bool) {
        // Transfer logic
        return true;
    }
    
    // Function signature: balanceOf(address)
    // Function selector: 0x70a08231
    function balanceOf(address account) public view returns (uint256) {
        // Balance logic
        return 0;
    }
}
```

### Parameter Encoding
```solidity
contract ABIEncoding {
    function encodeExample() public pure returns (bytes memory) {
        // Encode function call with parameters
        bytes memory encoded = abi.encodeWithSignature(
            "transfer(address,uint256)",
            0x1234567890123456789012345678901234567890,
            1000000000000000000  // 1 ETH in wei
        );
        
        return encoded;
    }
    
    function encodePackedExample() public pure returns (bytes memory) {
        // Tightly packed encoding
        return abi.encodePacked(
            uint256(123),
            address(0x1234567890123456789012345678901234567890),
            string("Hello")
        );
    }
}
```

## Advanced ABI

### Dynamic Types
```solidity
contract DynamicABI {
    struct Data {
        uint256 id;
        string name;
        uint256[] values;
    }
    
    function encodeDynamic(
        Data memory data
    ) public pure returns (bytes memory) {
        return abi.encode(data);
    }
    
    function decodeDynamic(
        bytes memory encoded
    ) public pure returns (Data memory) {
        return abi.decode(encoded, (Data));
    }
    
    function encodeArray(
        uint256[] memory values
    ) public pure returns (bytes memory) {
        return abi.encode(values);
    }
}
```

### Low-Level Calls
```solidity
contract LowLevelCalls {
    function callContract(
        address target,
        bytes memory data
    ) public returns (bool, bytes memory) {
        // Low-level call with encoded function data
        (bool success, bytes memory result) = target.call(data);
        require(success, "Call failed");
        return (success, result);
    }
    
    function delegateCallContract(
        address target,
        bytes memory data
    ) public returns (bool, bytes memory) {
        // Delegate call preserves msg.sender context
        (bool success, bytes memory result) = target.delegatecall(data);
        require(success, "Delegate call failed");
        return (success, result);
    }
}
```

## Best Practices

1. Function Signatures
   - Use standard formats
   - Document selectors
   - Verify signatures
   - Handle collisions

2. Parameter Handling
   - Validate inputs
   - Check lengths
   - Handle dynamic types
   - Use proper encoding

3. Error Handling
   - Check return values
   - Handle reverts
   - Decode errors
   - Log failures

## Common Patterns

### Interface Detection
```solidity
contract InterfaceABI {
    bytes4 private constant TRANSFER_SELECTOR = bytes4(
        keccak256("transfer(address,uint256)")
    );
    
    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == TRANSFER_SELECTOR;
    }
    
    function getSelector(
        string memory signature
    ) public pure returns (bytes4) {
        return bytes4(keccak256(bytes(signature)));
    }
}
```

### Safe Calls
```solidity
contract SafeABICalls {
    function safeCall(
        address target,
        bytes memory data,
        uint256 value
    ) internal returns (bytes memory) {
        (bool success, bytes memory result) = target.call{value: value}(data);
        require(success, "Call failed");
        
        if (result.length > 0) {
            require(abi.decode(result, (bool)), "Operation failed");
        }
        
        return result;
    }
    
    function safeDelegateCall(
        address target,
        bytes memory data
    ) internal returns (bytes memory) {
        (bool success, bytes memory result) = target.delegatecall(data);
        require(success, "Delegate call failed");
        return result;
    }
}
```

## Practice Exercise

Create functions that:
1. Encode complex data
2. Decode responses
3. Handle dynamic types
4. Make safe calls
5. Verify interfaces

## Key Takeaways

- Understand ABI encoding
- Use proper signatures
- Handle dynamic types
- Implement safe calls
- Verify interfaces

Remember: Proper ABI handling is crucial for secure contract interactions. 