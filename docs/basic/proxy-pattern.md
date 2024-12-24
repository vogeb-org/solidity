# Proxy Pattern in Solidity

## Introduction

The proxy pattern enables upgradeable smart contracts by separating logic and storage. This guide covers proxy patterns, implementation strategies, and best practices.

## Basic Proxy

### Simple Proxy
```solidity
contract Proxy {
    address public implementation;
    
    constructor(address _implementation) {
        implementation = _implementation;
    }
    
    fallback() external payable {
        address _impl = implementation;
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), _impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
    
    receive() external payable {}
}
```

### Implementation Contract
```solidity
contract Implementation {
    uint256 public value;
    address public owner;
    
    function initialize() public {
        require(owner == address(0), "Already initialized");
        owner = msg.sender;
    }
    
    function setValue(uint256 _value) public {
        require(msg.sender == owner, "Not authorized");
        value = _value;
    }
}
```

## Advanced Proxy Patterns

### Transparent Proxy
```solidity
contract TransparentProxy {
    address public implementation;
    address public admin;
    
    constructor(address _implementation) {
        implementation = _implementation;
        admin = msg.sender;
    }
    
    modifier ifAdmin() {
        if (msg.sender == admin) {
            _;
        } else {
            _fallback();
        }
    }
    
    function upgradeTo(address newImplementation) external ifAdmin {
        implementation = newImplementation;
    }
    
    function _fallback() internal {
        _delegate(implementation);
    }
    
    function _delegate(address _implementation) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), _implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
```

### UUPS Proxy
```solidity
contract UUPSProxy {
    bytes32 private constant IMPLEMENTATION_SLOT = 
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
        
    constructor(address _implementation) {
        _setImplementation(_implementation);
    }
    
    function _setImplementation(address newImplementation) private {
        require(newImplementation.code.length > 0, "Invalid implementation");
        assembly {
            sstore(IMPLEMENTATION_SLOT, newImplementation)
        }
    }
    
    fallback() external payable {
        _delegate(_getImplementation());
    }
    
    function _getImplementation() private view returns (address implementation) {
        assembly {
            implementation := sload(IMPLEMENTATION_SLOT)
        }
    }
    
    function _delegate(address implementation) private {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), implementation, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
```

## Best Practices

1. Storage
   - Use unstructured storage
   - Avoid storage collisions
   - Plan storage layout
   - Document storage usage

2. Security
   - Validate implementations
   - Control admin access
   - Handle initialization
   - Prevent selfdestruct

3. Upgrades
   - Test thoroughly
   - Plan migrations
   - Version control
   - Document changes

## Common Patterns

### Storage Slots
```solidity
contract StorageSlots {
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

### Safe Upgrades
```solidity
contract SafeProxy {
    event Upgraded(address indexed implementation);
    event AdminChanged(address indexed newAdmin);
    
    function _authorizeUpgrade(address newImplementation) internal virtual {
        require(msg.sender == _getAdmin(), "Not authorized");
        require(newImplementation != address(0), "Invalid implementation");
        require(newImplementation.code.length > 0, "Not a contract");
        
        address currentImpl = _getImplementation();
        _setImplementation(newImplementation);
        
        emit Upgraded(newImplementation);
        
        // Initialize new implementation if needed
        (bool success,) = newImplementation.delegatecall(
            abi.encodeWithSignature("initialize()")
        );
        require(success, "Initialization failed");
    }
}
```

## Practice Exercise

Create a proxy system that:
1. Implements UUPS pattern
2. Handles storage properly
3. Manages upgrades safely
4. Includes initialization
5. Tests thoroughly

## Key Takeaways

- Understand proxy patterns
- Manage storage carefully
- Implement security checks
- Plan upgrades carefully
- Test thoroughly

Remember: Proxy patterns require careful consideration of storage and security. 