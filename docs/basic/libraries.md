# Libraries in Solidity

## Introduction

Libraries in Solidity are reusable code that can be deployed once and used by multiple contracts. They help reduce deployment costs and promote code reuse.

## Basic Libraries

### Math Operations
```solidity
library SafeMath {
    function add(uint256 a, uint256 b) internal pure returns (uint256) {
        uint256 c = a + b;
        require(c >= a, "SafeMath: addition overflow");
        return c;
    }
    
    function sub(uint256 a, uint256 b) internal pure returns (uint256) {
        require(b <= a, "SafeMath: subtraction overflow");
        return a - b;
    }
    
    function mul(uint256 a, uint256 b) internal pure returns (uint256) {
        if (a == 0) return 0;
        uint256 c = a * b;
        require(c / a == b, "SafeMath: multiplication overflow");
        return c;
    }
}
```

### String Operations
```solidity
library StringUtils {
    function concat(string memory a, string memory b) 
        internal 
        pure 
        returns (string memory) 
    {
        return string(abi.encodePacked(a, b));
    }
    
    function toUpper(string memory str) 
        internal 
        pure 
        returns (string memory) 
    {
        bytes memory bStr = bytes(str);
        bytes memory bUpper = new bytes(bStr.length);
        
        for (uint i = 0; i < bStr.length; i++) {
            if (uint8(bStr[i]) >= 97 && uint8(bStr[i]) <= 122) {
                bUpper[i] = bytes1(uint8(bStr[i]) - 32);
            } else {
                bUpper[i] = bStr[i];
            }
        }
        
        return string(bUpper);
    }
}
```

## Using Libraries

### Direct Usage
```solidity
contract Token {
    using SafeMath for uint256;
    
    mapping(address => uint256) private balances;
    
    function transfer(address to, uint256 amount) public {
        balances[msg.sender] = balances[msg.sender].sub(amount);
        balances[to] = balances[to].add(amount);
    }
}
```

### Library Deployment
```solidity
library ArrayUtils {
    function indexOf(uint[] storage array, uint value) 
        public 
        view 
        returns (uint) 
    {
        for (uint i = 0; i < array.length; i++) {
            if (array[i] == value) return i;
        }
        revert("Value not found");
    }
}

contract ArrayUser {
    using ArrayUtils for uint[];
    uint[] private values;
    
    function findValue(uint value) public view returns (uint) {
        return values.indexOf(value);
    }
}
```

## Advanced Libraries

### Storage Patterns
```solidity
library AddressSet {
    struct Set {
        address[] values;
        mapping(address => uint) indexes;
    }
    
    function add(Set storage set, address value) internal {
        if (contains(set, value)) return;
        
        set.values.push(value);
        set.indexes[value] = set.values.length;
    }
    
    function remove(Set storage set, address value) internal {
        uint index = set.indexes[value];
        if (index == 0) return;
        
        uint lastIndex = set.values.length - 1;
        if (index != lastIndex) {
            address lastValue = set.values[lastIndex];
            set.values[index - 1] = lastValue;
            set.indexes[lastValue] = index;
        }
        
        set.values.pop();
        delete set.indexes[value];
    }
    
    function contains(Set storage set, address value) 
        internal 
        view 
        returns (bool) 
    {
        return set.indexes[value] != 0;
    }
}
```

### Bit Operations
```solidity
library BitUtils {
    function setBit(uint256 self, uint8 bit) 
        internal 
        pure 
        returns (uint256) 
    {
        return self | (1 << bit);
    }
    
    function clearBit(uint256 self, uint8 bit) 
        internal 
        pure 
        returns (uint256) 
    {
        return self & ~(1 << bit);
    }
    
    function hasBit(uint256 self, uint8 bit) 
        internal 
        pure 
        returns (bool) 
    {
        return (self & (1 << bit)) != 0;
    }
}
```

## Best Practices

1. Design Principles
   - Keep functions pure when possible
   - Minimize storage operations
   - Use internal visibility
   - Consider gas costs

2. Implementation
   - Validate inputs
   - Handle edge cases
   - Document behavior
   - Test thoroughly

3. Deployment
   - Deploy once, use many times
   - Consider linking vs embedding
   - Version control
   - Gas optimization

## Common Patterns

### Type Conversion
```solidity
library Converter {
    function toBytes32(address addr) 
        internal 
        pure 
        returns (bytes32) 
    {
        return bytes32(uint256(uint160(addr)));
    }
    
    function toAddress(bytes32 data) 
        internal 
        pure 
        returns (address) 
    {
        return address(uint160(uint256(data)));
    }
}
```

### Data Validation
```solidity
library Validator {
    function requireNotZero(uint value, string memory message) 
        internal 
        pure 
    {
        require(value != 0, message);
    }
    
    function requireValidAddress(address addr, string memory message) 
        internal 
        pure 
    {
        require(addr != address(0), message);
    }
}
```

## Practice Exercise

Create libraries that:
1. Implement safe math operations
2. Handle string manipulations
3. Manage data structures
4. Perform bit operations
5. Validate inputs

## Key Takeaways

- Libraries promote code reuse
- Reduce deployment costs
- Improve code organization
- Enable safe operations
- Support maintainability

Remember: Well-designed libraries can significantly improve contract efficiency and security. 