# Interfaces in Solidity

## Introduction

Interfaces define a contract's external behavior by specifying its callable functions. They are crucial for contract interactions and standardization in Ethereum development.

## Basic Interfaces

### Interface Declaration
```solidity
interface IERC20 {
    function totalSupply() external view returns (uint256);
    function balanceOf(address account) external view returns (uint256);
    function transfer(address to, uint256 amount) external returns (bool);
    function allowance(address owner, address spender) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    
    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);
}
```

### Interface Rules
- Cannot have implementations
- Cannot have state variables
- Cannot have constructors
- All functions must be external
- Can inherit from other interfaces
- Can declare events

## Using Interfaces

### Contract Implementation
```solidity
contract Token is IERC20 {
    mapping(address => uint256) private _balances;
    
    function balanceOf(address account) external view override returns (uint256) {
        return _balances[account];
    }
    
    // Implement other interface functions...
}
```

### Contract Interaction
```solidity
contract TokenUser {
    IERC20 public token;
    
    constructor(address tokenAddress) {
        token = IERC20(tokenAddress);
    }
    
    function transferTokens(address to, uint256 amount) public {
        require(token.transfer(to, amount), "Transfer failed");
    }
}
```

## Advanced Interfaces

### Multiple Inheritance
```solidity
interface IOwnable {
    function owner() external view returns (address);
    function transferOwnership(address newOwner) external;
}

interface IPausable {
    function paused() external view returns (bool);
    function pause() external;
    function unpause() external;
}

contract Token is IERC20, IOwnable, IPausable {
    // Implementation
}
```

### Interface Detection
```solidity
contract InterfaceChecker {
    function supportsInterface(address contractAddress, bytes4 interfaceId) 
        public 
        view 
        returns (bool)
    {
        try IERC165(contractAddress).supportsInterface(interfaceId) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }
}
```

## Common Patterns

### Factory Pattern
```solidity
interface ITokenFactory {
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external returns (address);
    
    event TokenCreated(address indexed token, string name, string symbol);
}

contract TokenFactory is ITokenFactory {
    function createToken(
        string memory name,
        string memory symbol,
        uint256 initialSupply
    ) external override returns (address) {
        // Token creation logic
        emit TokenCreated(address(newToken), name, symbol);
        return address(newToken);
    }
}
```

### Proxy Pattern
```solidity
interface IImplementation {
    function initialize(address owner) external;
    function implementation() external view returns (address);
}

contract Proxy {
    address public implementation;
    
    function upgradeTo(address newImplementation) public {
        implementation = newImplementation;
    }
    
    fallback() external payable {
        address impl = implementation;
        require(impl != address(0), "Implementation not set");
        
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }
}
```

## Best Practices

1. Design Principles
   - Keep interfaces minimal
   - Single responsibility
   - Clear documentation
   - Version control

2. Implementation
   - Complete all functions
   - Proper error handling
   - Event emissions
   - Gas optimization

3. Security
   - Input validation
   - Access control
   - Interface detection
   - Upgrade safety

## Common Interfaces

### ERC Standards
```solidity
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function transferFrom(address from, address to, uint256 tokenId) external;
    // Additional ERC721 functions...
}

interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) 
        external 
        view 
        returns (uint256[] memory);
    // Additional ERC1155 functions...
}
```

## Practice Exercise

Create a system that:
1. Defines multiple interfaces
2. Implements interface inheritance
3. Uses interface detection
4. Creates a factory pattern
5. Handles upgrades

## Key Takeaways

- Interfaces define contract APIs
- Enable contract interactions
- Support standardization
- Facilitate upgrades
- Improve modularity

Remember: Well-designed interfaces are key to contract interoperability and maintainability. 