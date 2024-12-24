# Mappings in Solidity

## Introduction

Mappings are hash table-like data structures in Solidity that provide key-value pair storage. They are commonly used for token balances, user data, and relationship tracking.

## Basic Mappings

### Simple Mapping
```solidity
contract SimpleMapping {
    mapping(address => uint256) public balances;
    
    function deposit() public payable {
        balances[msg.sender] += msg.value;
    }
    
    function getBalance(address account) public view returns (uint256) {
        return balances[account];
    }
}
```
- Key-value pairs
- Automatic initialization
- No length or iteration
- Gas efficient lookups

### Default Values
```solidity
contract DefaultValues {
    mapping(address => bool) public isRegistered;
    mapping(uint256 => string) public names;
    mapping(address => uint256) public scores;
    
    function checkDefaults(address user) public view returns (bool, string memory, uint256) {
        // All return default values if not set:
        // bool: false
        // string: ""
        // uint: 0
        return (isRegistered[user], names[1], scores[user]);
    }
}
```

## Advanced Mappings

### Nested Mappings
```solidity
contract NestedMapping {
    // Approval mapping for ERC20-like tokens
    mapping(address => mapping(address => uint256)) public allowances;
    
    function approve(address spender, uint256 amount) public {
        allowances[msg.sender][spender] = amount;
    }
    
    function getAllowance(address owner, address spender) public view returns (uint256) {
        return allowances[owner][spender];
    }
}
```

### Struct Mappings
```solidity
contract StructMapping {
    struct User {
        string name;
        uint256 balance;
        bool active;
    }
    
    mapping(address => User) public users;
    
    function createUser(string memory name) public {
        User storage user = users[msg.sender];
        user.name = name;
        user.active = true;
    }
}
```

## Common Patterns

### Enumerable Mapping
```solidity
contract EnumerableMap {
    mapping(address => uint256) public balances;
    address[] public accounts;
    
    function addAccount() public {
        if (balances[msg.sender] == 0) {
            accounts.push(msg.sender);
        }
        balances[msg.sender] = msg.value;
    }
    
    function getAllAccounts() public view returns (address[] memory) {
        return accounts;
    }
}
```

### Delete Operations
```solidity
contract DeletableMap {
    mapping(uint256 => bool) public exists;
    mapping(uint256 => uint256) public values;
    
    function set(uint256 key, uint256 value) public {
        exists[key] = true;
        values[key] = value;
    }
    
    function remove(uint256 key) public {
        delete exists[key];
        delete values[key];
    }
}
```

## Best Practices

1. Data Organization
   - Choose appropriate key types
   - Consider value types carefully
   - Plan for data access patterns
   - Use nested mappings wisely

2. Security
   - Validate inputs
   - Check permissions
   - Handle default values
   - Consider access patterns

3. Gas Optimization
   - Minimize storage operations
   - Use appropriate data types
   - Consider batch operations
   - Plan for scalability

## Advanced Techniques

### Iterable Mapping
```solidity
contract IterableMapping {
    struct IndexValue {
        uint256 value;
        uint256 index;
    }
    
    mapping(uint256 => IndexValue) public values;
    uint256[] public indexes;
    
    function set(uint256 key, uint256 value) public {
        if (values[key].index == 0) {
            indexes.push(key);
            values[key].index = indexes.length;
        }
        values[key].value = value;
    }
    
    function getAll() public view returns (uint256[] memory, uint256[] memory) {
        uint256[] memory vals = new uint256[](indexes.length);
        for (uint i = 0; i < indexes.length; i++) {
            vals[i] = values[indexes[i]].value;
        }
        return (indexes, vals);
    }
}
```

### Access Control
```solidity
contract AccessControlMap {
    mapping(address => mapping(bytes4 => bool)) public permissions;
    
    function grantAccess(address user, bytes4 functionSig) public {
        permissions[user][functionSig] = true;
    }
    
    modifier hasPermission(bytes4 functionSig) {
        require(permissions[msg.sender][functionSig], "No permission");
        _;
    }
}
```

## Practice Exercise

Create a contract that:
1. Uses simple and nested mappings
2. Implements enumerable mapping
3. Handles struct mappings
4. Manages permissions
5. Provides iteration capability

## Key Takeaways

- Understand mapping limitations
- Choose appropriate data structures
- Consider access patterns
- Implement proper validation
- Optimize for gas usage

Remember: Mappings are powerful but require careful design for efficient usage. 