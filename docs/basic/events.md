# Events in Solidity

## Introduction

Events in Solidity are a way to emit logs on the blockchain that can be efficiently accessed by external applications. They are essential for DApp development and contract monitoring.

## Event Declaration

### Basic Structure
```solidity
event EventName(
    type1 indexed param1,
    type2 param2,
    type3 indexed param3
);
```

### Example
```solidity
event Transfer(
    address indexed from,
    address indexed to,
    uint256 amount
);
```

## Event Properties

### Indexed Parameters
```solidity
event UserAction(
    address indexed user,
    uint256 indexed actionId,
    string description
);
```
- Maximum 3 indexed parameters
- Enables efficient filtering
- More gas expensive
- Commonly used for addresses

### Non-Indexed Parameters
```solidity
event LogData(
    uint256 value,
    string description,
    bytes data
);
```
- No limit on number
- Cannot be filtered
- Less gas expensive
- Good for large data

## Emitting Events

### Basic Usage
```solidity
contract Token {
    event Transfer(address indexed from, address indexed to, uint256 amount);
    
    function transfer(address to, uint256 amount) public {
        // Transfer logic
        emit Transfer(msg.sender, to, amount);
    }
}
```

### Multiple Events
```solidity
contract MultiEvent {
    event Started(uint256 indexed timestamp);
    event Completed(uint256 indexed timestamp, uint256 result);
    
    function process() public {
        emit Started(block.timestamp);
        // Processing logic
        emit Completed(block.timestamp, 123);
    }
}
```

## Event Applications

### Transaction Tracking
```solidity
contract Tracker {
    event Transaction(
        address indexed from,
        address indexed to,
        uint256 indexed id,
        uint256 value,
        string description
    );
    
    function recordTransaction(
        address to,
        uint256 id,
        uint256 value,
        string memory description
    ) public {
        emit Transaction(msg.sender, to, id, value, description);
    }
}
```

### State Changes
```solidity
contract StateTracker {
    enum State { Created, Active, Paused, Ended }
    event StateChanged(State indexed oldState, State indexed newState);
    
    State public currentState;
    
    function changeState(State newState) public {
        emit StateChanged(currentState, newState);
        currentState = newState;
    }
}
```

## Best Practices

1. Event Design
   - Clear naming conventions
   - Appropriate parameter selection
   - Consistent structure
   - Meaningful data inclusion

2. Indexing Strategy
   - Index important fields
   - Consider query patterns
   - Balance gas costs
   - Maximum three indexed fields

3. Gas Optimization
   - Minimize indexed parameters
   - Batch related events
   - Avoid redundant data
   - Consider data size

## Common Patterns

### Logging Pattern
```solidity
contract Logger {
    event Log(
        address indexed sender,
        uint256 indexed timestamp,
        string message
    );
    
    function logMessage(string memory message) public {
        emit Log(msg.sender, block.timestamp, message);
    }
}
```

### Audit Trail Pattern
```solidity
contract Auditable {
    event AuditEvent(
        address indexed actor,
        string action,
        bytes32 indexed hash,
        uint256 timestamp
    );
    
    function audit(string memory action, bytes32 hash) internal {
        emit AuditEvent(msg.sender, action, hash, block.timestamp);
    }
}
```

## Event Monitoring

### Web3.js Example
```javascript
contract.events.Transfer({
    filter: {from: userAddress},
    fromBlock: 0
})
.on('data', event => {
    console.log('Transfer:', event.returnValues);
})
.on('error', error => {
    console.error('Error:', error);
});
```

### Ethers.js Example
```javascript
contract.on("Transfer", (from, to, amount) => {
    console.log(`${from} sent ${amount} tokens to ${to}`);
});
```

## Practice Exercise

Create a contract that:
1. Defines multiple events
2. Uses indexed parameters
3. Implements event filtering
4. Creates an audit trail
5. Monitors state changes

## Key Takeaways

- Events are crucial for DApp development
- Use indexed parameters strategically
- Consider gas costs in design
- Follow consistent patterns
- Implement proper monitoring

Remember: Well-designed events make contract monitoring and integration much easier. 