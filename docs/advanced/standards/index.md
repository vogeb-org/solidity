# Smart Contract Standards

## Introduction

Smart contract standards ensure interoperability and compatibility across the Ethereum ecosystem. This guide covers essential standards, their implementations, and best practices.

## Token Standards

### ERC20 Standard
The fundamental standard for fungible tokens:

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

Key features:
- Fungible token operations
- Allowance mechanism
- Standard events
- Wide compatibility

### ERC721 Standard
The standard for non-fungible tokens (NFTs):

```solidity
interface IERC721 {
    function balanceOf(address owner) external view returns (uint256);
    function ownerOf(uint256 tokenId) external view returns (address);
    function safeTransferFrom(address from, address to, uint256 tokenId) external;
    function transferFrom(address from, address to, uint256 tokenId) external;
    function approve(address to, uint256 tokenId) external;
    function getApproved(uint256 tokenId) external view returns (address);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address owner, address operator) external view returns (bool);
}
```

Extensions:
- Metadata (ERC721Metadata)
- Enumerable (ERC721Enumerable)
- URIStorage
- Royalty support (ERC2981)

### ERC1155 Standard
Multi-token standard for both fungible and non-fungible tokens:

```solidity
interface IERC1155 {
    function balanceOf(address account, uint256 id) external view returns (uint256);
    function balanceOfBatch(address[] calldata accounts, uint256[] calldata ids) 
        external view returns (uint256[] memory);
    function setApprovalForAll(address operator, bool approved) external;
    function isApprovedForAll(address account, address operator) external view returns (bool);
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) 
        external;
    function safeBatchTransferFrom(address from, address to, uint256[] calldata ids, 
        uint256[] calldata amounts, bytes calldata data) external;
}
```

Features:
- Batch operations
- Mixed token types
- Gas efficiency
- URI management

## Security Standards

### Access Control
- Role-based access control (RBAC)
- Owner privileges
- Multi-signature systems
- Time locks

Implementation example:
```solidity
contract AccessControl {
    mapping(bytes32 => mapping(address => bool)) private _roles;
    
    event RoleGranted(bytes32 indexed role, address indexed account);
    event RoleRevoked(bytes32 indexed role, address indexed account);
    
    modifier onlyRole(bytes32 role) {
        require(hasRole(role, msg.sender), "AccessControl: unauthorized");
        _;
    }
    
    function hasRole(bytes32 role, address account) public view returns (bool) {
        return _roles[role][account];
    }
}
```

### Safety Checks
- Reentrancy protection
- Integer overflow/underflow
- Front-running prevention
- Oracle manipulation

Example pattern:
```solidity
contract ReentrancyGuard {
    bool private locked;
    
    modifier nonReentrant() {
        require(!locked, "ReentrancyGuard: reentrant call");
        locked = true;
        _;
        locked = false;
    }
}
```

## Development Standards

### Code Quality
- Follow style guide
- Document thoroughly
- Test comprehensively
- Use verified libraries

### Gas Optimization
- Pack storage variables
- Batch operations
- Cache storage reads
- Minimize state changes

### Contract Interaction
- Safe external calls
- Event logging
- Error handling
- Proxy patterns

## Best Practices

1. Security First
   - Use latest compiler
   - Follow audited patterns
   - Implement safeguards
   - Handle edge cases

2. Gas Efficiency
   - Optimize storage
   - Minimize operations
   - Use events wisely
   - Batch when possible

3. Maintainability
   - Clear documentation
   - Modular design
   - Upgrade strategy
   - Version control

## Implementation Guide

Each standard requires:
1. Interface compliance
2. Security measures
3. Gas optimization
4. Thorough testing

Remember: Always prioritize security and follow established patterns when implementing these standards! 