# Debugging in Solidity

## Introduction

Debugging smart contracts is crucial for development and maintenance. This guide covers debugging techniques, tools, and best practices for finding and fixing issues.

## Basic Debugging

### Console Logging
```solidity
import "hardhat/console.sol";

contract Debuggable {
    function debugTransfer(address to, uint256 amount) public {
        console.log("Transfer called by:", msg.sender);
        console.log("To address:", to);
        console.log("Amount:", amount);
        
        uint256 balance = getBalance(msg.sender);
        console.log("Sender balance:", balance);
        
        if (balance < amount) {
            console.log("Transfer failed: insufficient balance");
            revert("Insufficient balance");
        }
        
        // Transfer logic
        console.log("Transfer successful");
    }
}
```

### Event Logging
```solidity
contract EventDebug {
    event DebugValue(string message, uint256 value);
    event DebugAddress(string message, address account);
    event DebugOperation(string operation, bool success);
    
    function debuggedFunction(uint256 value) public {
        emit DebugValue("Input value", value);
        emit DebugAddress("Caller", msg.sender);
        
        // Function logic
        bool success = performOperation(value);
        emit DebugOperation("Operation result", success);
    }
}
```

## Advanced Debugging

### State Inspection
```solidity
contract StateDebugger {
    mapping(address => uint256) private balances;
    mapping(address => mapping(address => uint256)) private allowances;
    
    function debugState(address user) public view returns (
        uint256 balance,
        uint256 allowance,
        uint256 timestamp,
        uint256 blockNumber
    ) {
        balance = balances[user];
        allowance = allowances[user][msg.sender];
        timestamp = block.timestamp;
        blockNumber = block.number;
    }
    
    function debugAllowances(
        address owner,
        address[] memory spenders
    ) public view returns (uint256[] memory) {
        uint256[] memory values = new uint256[](spenders.length);
        for (uint256 i = 0; i < spenders.length; i++) {
            values[i] = allowances[owner][spenders[i]];
        }
        return values;
    }
}
```

### Transaction Tracing
```solidity
contract TransactionDebugger {
    event FunctionEntry(bytes4 selector, address sender);
    event FunctionExit(bytes4 selector, bool success);
    event ParameterValue(string name, uint256 value);
    
    modifier debugged() {
        emit FunctionEntry(msg.sig, msg.sender);
        
        bool success = true;
        try {
            _;
        } catch {
            success = false;
            emit FunctionExit(msg.sig, false);
            revert();
        }
        
        emit FunctionExit(msg.sig, success);
    }
    
    function debuggedTransfer(
        address to,
        uint256 amount
    ) public debugged {
        emit ParameterValue("amount", amount);
        // Transfer logic
    }
}
```

## Debugging Tools

### Hardhat Console
```javascript
const { ethers } = require("hardhat");

async function debugContract() {
    const Contract = await ethers.getContractFactory("Debuggable");
    const contract = await Contract.deploy();
    
    console.log("Contract deployed to:", contract.address);
    
    // Debug function call
    const tx = await contract.debugTransfer(
        "0x1234...",
        ethers.utils.parseEther("1.0")
    );
    
    const receipt = await tx.wait();
    console.log("Transaction receipt:", receipt);
}
```

### Test Debugging
```solidity
contract TestDebugger {
    function assertState(
        uint256 expected,
        uint256 actual,
        string memory message
    ) internal pure {
        if (expected != actual) {
            console.log("Assertion failed:", message);
            console.log("Expected:", expected);
            console.log("Actual:", actual);
            revert("State assertion failed");
        }
    }
    
    function debugTest() public {
        uint256 result = performCalculation();
        assertState(100, result, "Calculation result");
        
        // More test logic
    }
}
```

## Best Practices

1. Logging Strategy
   - Use descriptive messages
   - Log important state changes
   - Include timestamps
   - Track function flow

2. Error Handling
   - Catch specific errors
   - Log error details
   - Provide context
   - Handle gracefully

3. Testing
   - Write debug tests
   - Use assertions
   - Check edge cases
   - Monitor state changes

## Common Patterns

### Debug Mode
```solidity
contract DebuggableContract {
    bool public debugMode;
    
    modifier debugLog() {
        if (debugMode) {
            console.log("Function:", msg.sig);
            console.log("Sender:", msg.sender);
            console.log("Value:", msg.value);
        }
        _;
        if (debugMode) {
            console.log("Function completed");
        }
    }
    
    function toggleDebug() public {
        debugMode = !debugMode;
    }
    
    function debuggableFunction() public debugLog {
        // Function logic
    }
}
```

### State Snapshots
```solidity
contract StateSnapshot {
    struct Snapshot {
        uint256 timestamp;
        mapping(address => uint256) balances;
        bool exists;
    }
    
    mapping(bytes32 => Snapshot) private snapshots;
    
    function takeSnapshot(string memory label) internal returns (bytes32) {
        bytes32 id = keccak256(abi.encodePacked(label, block.timestamp));
        Snapshot storage snap = snapshots[id];
        snap.timestamp = block.timestamp;
        snap.exists = true;
        // Copy state
        return id;
    }
    
    function compareSnapshots(
        bytes32 id1,
        bytes32 id2
    ) internal view returns (bool) {
        require(snapshots[id1].exists && snapshots[id2].exists, "Invalid snapshots");
        // Compare state
        return true;
    }
}
```

## Practice Exercise

Create debugging tools that:
1. Implement logging
2. Track state changes
3. Handle errors
4. Support testing
5. Monitor transactions

## Key Takeaways

- Log extensively
- Track state changes
- Handle errors gracefully
- Test thoroughly
- Document findings

Remember: Good debugging practices are essential for maintaining reliable smart contracts. 