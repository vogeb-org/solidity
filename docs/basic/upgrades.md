# Upgrades in Solidity

## Introduction

Smart contract upgrades allow for contract functionality to be modified after deployment. This guide covers upgrade patterns, strategies, and best practices.

## Basic Upgrades

### Proxy Pattern
```solidity
contract Proxy {
    address public implementation;
    address public admin;
    
    constructor(address _implementation) {
        implementation = _implementation;
        admin = msg.sender;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Not authorized");
        _;
    }
    
    function upgrade(address newImplementation) public onlyAdmin {
        implementation = newImplementation;
    }
    
    fallback() external payable {
        address impl = implementation;
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

### Implementation Contract
```solidity
contract TokenV1 {
    mapping(address => uint256) public balances;
    uint256 public totalSupply;
    
    function initialize() public virtual {
        require(totalSupply == 0, "Already initialized");
        totalSupply = 1000000;
        balances[msg.sender] = totalSupply;
    }
    
    function transfer(address to, uint256 amount) public virtual returns (bool) {
        require(balances[msg.sender] >= amount, "Insufficient balance");
        balances[msg.sender] -= amount;
        balances[to] += amount;
        return true;
    }
}

contract TokenV2 is TokenV1 {
    mapping(address => mapping(address => uint256)) public allowances;
    
    function approve(address spender, uint256 amount) public virtual returns (bool) {
        allowances[msg.sender][spender] = amount;
        return true;
    }
    
    function transferFrom(
        address from,
        address to,
        uint256 amount
    ) public virtual returns (bool) {
        require(allowances[from][msg.sender] >= amount, "Not authorized");
        require(balances[from] >= amount, "Insufficient balance");
        
        allowances[from][msg.sender] -= amount;
        balances[from] -= amount;
        balances[to] += amount;
        return true;
    }
}
```

## Advanced Upgrades

### Transparent Proxy
```solidity
contract TransparentUpgradeableProxy {
    address private _implementation;
    address private _admin;
    
    bytes32 private constant IMPLEMENTATION_SLOT = 
        bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1);
    bytes32 private constant ADMIN_SLOT = 
        bytes32(uint256(keccak256("eip1967.proxy.admin")) - 1);
    
    constructor(address implementation_, address admin_, bytes memory data_) {
        _setImplementation(implementation_);
        _setAdmin(admin_);
        if (data_.length > 0) {
            (bool success,) = implementation_.delegatecall(data_);
            require(success, "Initialization failed");
        }
    }
    
    modifier ifAdmin() {
        if (msg.sender == _getAdmin()) {
            _;
        } else {
            _fallback();
        }
    }
    
    function upgradeTo(address newImplementation) external ifAdmin {
        _setImplementation(newImplementation);
    }
    
    function _setImplementation(address implementation_) private {
        require(implementation_.code.length > 0, "Invalid implementation");
        StorageSlot.getAddressSlot(IMPLEMENTATION_SLOT).value = implementation_;
    }
    
    function _setAdmin(address admin_) private {
        StorageSlot.getAddressSlot(ADMIN_SLOT).value = admin_;
    }
    
    function _getAdmin() private view returns (address) {
        return StorageSlot.getAddressSlot(ADMIN_SLOT).value;
    }
    
    function _fallback() private {
        _delegate(_getImplementation());
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

### UUPS Pattern
```solidity
abstract contract UUPSUpgradeable {
    address private immutable __self = address(this);
    
    modifier onlyProxy() {
        require(address(this) != __self, "Not a proxy call");
        _;
    }
    
    modifier notDelegated() {
        require(address(this) == __self, "Delegated call");
        _;
    }
    
    function upgradeTo(address newImplementation) external virtual;
    
    function _authorizeUpgrade(address newImplementation) internal virtual;
}

contract TokenUUPS is UUPSUpgradeable {
    address public owner;
    
    function initialize() public virtual {
        require(owner == address(0), "Already initialized");
        owner = msg.sender;
    }
    
    function upgradeTo(address newImplementation) external virtual override {
        require(msg.sender == owner, "Not authorized");
        _authorizeUpgrade(newImplementation);
        _upgradeToAndCall(newImplementation, "");
    }
    
    function _authorizeUpgrade(address) internal virtual override {
        require(msg.sender == owner, "Not authorized");
    }
}
```

## Best Practices

1. Storage Management
   - Use storage slots
   - Avoid reordering variables
   - Plan for future upgrades
   - Document storage layout

2. Security
   - Validate implementations
   - Control admin access
   - Test upgrades thoroughly
   - Monitor upgrade events

3. Initialization
   - Use initializer pattern
   - Check initialization state
   - Handle multiple versions
   - Secure initialization

## Common Patterns

### Storage Slots
```solidity
library StorageSlot {
    struct AddressSlot {
        address value;
    }
    
    function getAddressSlot(bytes32 slot) internal pure returns (AddressSlot storage r) {
        assembly {
            r.slot := slot
        }
    }
}

contract UpgradeableStorage {
    bytes32 private constant VERSION_SLOT = keccak256("contract.version");
    
    function _setVersion(uint256 version) internal {
        assembly {
            sstore(VERSION_SLOT, version)
        }
    }
    
    function _getVersion() internal view returns (uint256 version) {
        assembly {
            version := sload(VERSION_SLOT)
        }
    }
}
```

### Safe Upgrades
```solidity
contract SafeUpgrade {
    event UpgradeProposed(address indexed implementation, uint256 deadline);
    event UpgradeExecuted(address indexed implementation);
    
    uint256 public constant UPGRADE_TIMELOCK = 2 days;
    address public pendingImplementation;
    uint256 public upgradeDeadline;
    
    function proposeUpgrade(address implementation) external onlyOwner {
        pendingImplementation = implementation;
        upgradeDeadline = block.timestamp + UPGRADE_TIMELOCK;
        emit UpgradeProposed(implementation, upgradeDeadline);
    }
    
    function executeUpgrade() external onlyOwner {
        require(block.timestamp >= upgradeDeadline, "Timelock not expired");
        require(pendingImplementation != address(0), "No upgrade pending");
        
        address implementation = pendingImplementation;
        pendingImplementation = address(0);
        _upgradeTo(implementation);
        
        emit UpgradeExecuted(implementation);
    }
}
```

## Practice Exercise

Create a system that:
1. Implements proxy pattern
2. Handles storage properly
3. Uses safe upgrades
4. Includes initialization
5. Tests upgrade scenarios

## Key Takeaways

- Plan for upgrades
- Manage storage carefully
- Implement security checks
- Test thoroughly
- Document changes

Remember: Contract upgrades require careful consideration of security and storage management. 