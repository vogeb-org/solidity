# Token Systems

## Introduction

Token systems are fundamental to blockchain applications. This guide covers token implementation, management, and advanced features in the Ethereum ecosystem.

## Token Standards

### ERC20 - Fungible Tokens
The most widely used token standard for fungible tokens:

```solidity
contract BasicERC20 is ERC20 {
    constructor(string memory name, string memory symbol, uint256 initialSupply) 
        ERC20(name, symbol) {
        _mint(msg.sender, initialSupply * 10**decimals());
    }
}
```

Key features:
- Standard interface compliance
- Transfer and allowance mechanisms
- Minting and burning capabilities
- Event emission

### ERC721 - Non-Fungible Tokens (NFTs)
The standard for unique digital assets:

```solidity
contract BasicERC721 is ERC721, Ownable {
    uint256 private _tokenIds;
    string private _baseTokenURI;
    
    constructor(string memory name, string memory symbol) 
        ERC721(name, symbol) {}
    
    function mint(address to) public onlyOwner returns (uint256) {
        _tokenIds++;
        _safeMint(to, _tokenIds);
        return _tokenIds;
    }
    
    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }
    
    function setBaseURI(string memory baseURI) external onlyOwner {
        _baseTokenURI = baseURI;
    }
}
```

Features:
- Unique token identification
- Metadata handling
- Safe transfer mechanisms
- Ownership tracking

### ERC1155 - Multi-Token Standard
A hybrid standard for both fungible and non-fungible tokens:

```solidity
contract BasicERC1155 is ERC1155, Ownable {
    constructor(string memory uri) ERC1155(uri) {}
    
    function mint(
        address to,
        uint256 id,
        uint256 amount,
        bytes memory data
    ) public onlyOwner {
        _mint(to, id, amount, data);
    }
    
    function mintBatch(
        address to,
        uint256[] memory ids,
        uint256[] memory amounts,
        bytes memory data
    ) public onlyOwner {
        _mintBatch(to, ids, amounts, data);
    }
}
```

Benefits:
- Gas efficiency
- Batch operations
- Mixed token types
- Flexible management

## Token Operations

### Token Creation and Management
```solidity
contract ManagedToken is ERC20, Ownable {
    mapping(address => bool) public minters;
    
    modifier onlyMinter() {
        require(minters[msg.sender], "Not a minter");
        _;
    }
    
    function addMinter(address minter) external onlyOwner {
        minters[minter] = true;
    }
    
    function removeMinter(address minter) external onlyOwner {
        minters[minter] = false;
    }
    
    function mint(address to, uint256 amount) external onlyMinter {
        _mint(to, amount);
    }
    
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
```

### Token Economics
```solidity
contract TokenVesting {
    struct VestingSchedule {
        uint256 total;
        uint256 released;
        uint256 start;
        uint256 duration;
    }
    
    mapping(address => VestingSchedule) public vestingSchedules;
    IERC20 public token;
    
    function createVestingSchedule(
        address beneficiary,
        uint256 amount,
        uint256 duration
    ) external {
        vestingSchedules[beneficiary] = VestingSchedule({
            total: amount,
            released: 0,
            start: block.timestamp,
            duration: duration
        });
    }
    
    function release() external {
        VestingSchedule storage schedule = vestingSchedules[msg.sender];
        uint256 releasable = _computeReleasableAmount(schedule);
        require(releasable > 0, "Nothing to release");
        
        schedule.released += releasable;
        token.transfer(msg.sender, releasable);
    }
    
    function _computeReleasableAmount(VestingSchedule memory schedule)
        private view returns (uint256) {
        if (block.timestamp < schedule.start) {
            return 0;
        }
        
        uint256 elapsed = block.timestamp - schedule.start;
        if (elapsed >= schedule.duration) {
            return schedule.total - schedule.released;
        }
        
        return (schedule.total * elapsed / schedule.duration) - schedule.released;
    }
}
```

## Advanced Features

### Governance Token
```solidity
contract GovernanceToken is ERC20 {
    mapping(address => uint256) public lastVoted;
    uint256 public constant VOTING_DELAY = 1 days;
    
    function vote(uint256 proposalId) external {
        require(balanceOf(msg.sender) > 0, "No voting power");
        require(block.timestamp > lastVoted[msg.sender] + VOTING_DELAY, 
            "Already voted recently");
            
        lastVoted[msg.sender] = block.timestamp;
        // Voting logic
    }
    
    function _beforeTokenTransfer(
        address from,
        address to,
        uint256 amount
    ) internal override {
        super._beforeTokenTransfer(from, to, amount);
        require(lastVoted[from] + VOTING_DELAY < block.timestamp, 
            "Cannot transfer while vote is active");
    }
}
```

## Best Practices

### 1. Security
- Implement access control
- Use safe math operations
- Handle edge cases
- Emit events for tracking

### 2. Gas Optimization
- Batch operations
- Efficient storage
- Minimal state changes
- Cache variables

### 3. Usability
- Clear documentation
- Meaningful errors
- Standard interfaces
- Event logging

## Development Tools

### 1. Essential Libraries
- OpenZeppelin Contracts
- Solmate
- DappSys
- HardHat

### 2. Testing Framework
- Unit tests
- Integration tests
- Gas reporting
- Coverage analysis

### 3. Deployment Tools
- Network management
- Contract verification
- Parameter configuration
- Monitoring systems

## Implementation Guide

1. Planning
   - Define token economics
   - Choose standards
   - Plan features
   - Consider security

2. Development
   - Set up environment
   - Write smart contracts
   - Implement features
   - Add security measures

3. Testing
   - Unit testing
   - Integration testing
   - Security audits
   - Performance testing

4. Deployment
   - Network selection
   - Parameter setting
   - Contract verification
   - Documentation

## Summary

Token systems form the foundation of many blockchain applications. By understanding and implementing these systems properly, you can:
- Create secure and efficient tokens
- Implement advanced features
- Follow best practices
- Build robust applications

## FAQ

### General Questions

**Q: What is a token system?**

A: A token system is a smart contract-based implementation that manages digital assets on the blockchain, featuring:
- Token creation and management
- Transfer mechanisms
- Economic models
- Advanced features

**Q: Which token standard should I use?**

A: The choice depends on your needs:
- ERC20 for fungible tokens
- ERC721 for unique NFTs
- ERC1155 for mixed token types
- Custom standards for special cases

### Technical Questions

**Q: How to ensure token security?**

A: Key security measures include:
- Access control implementation
- Safe mathematical operations
- Comprehensive testing
- Professional audits

**Q: What about gas optimization?**

A: Gas optimization strategies:
- Batch operations
- Storage optimization
- State minimization
- Efficient algorithms