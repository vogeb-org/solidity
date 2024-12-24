# Token Snapshot System

The token snapshot system is used to record the state of token holders at specific points in time. This tutorial will explain how to implement a secure and reliable snapshot system.

## Features

- Snapshot management
- State recording
- Permission control
- Data query
- Emergency handling

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenSnapshot
 * @dev Token snapshot contract implementation
 */
contract TokenSnapshot is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // Snapshot information
    struct SnapshotInfo {
        uint256 id;             // Snapshot ID
        uint256 timestamp;      // Timestamp
        string description;     // Description
        bool isProcessed;       // Whether processed
        address operator;       // Operator
    }

    // Balance snapshot
    struct BalanceSnapshot {
        uint256 snapshotId;    // Snapshot ID
        uint256 balance;       // Balance
        uint256 timestamp;     // Timestamp
        bool isValid;          // Whether valid
    }

    // Configuration information
    struct SnapshotConfig {
        uint256 minInterval;   // Minimum interval
        uint256 maxSnapshots;  // Maximum snapshots
        bool requiresReason;   // Whether reason required
        bool isActive;         // Whether active
    }

    // State variables
    mapping(uint256 => SnapshotInfo) public snapshots;                    // Snapshots
    mapping(uint256 => mapping(address => BalanceSnapshot)) public balanceSnapshots;  // Balance snapshots
    mapping(address => bool) public operators;                            // Operators
    SnapshotConfig public config;                                        // Configuration
    uint256 public snapshotCount;                                        // Snapshot count
    IERC20 public token;                                                // Token contract

    // Events
    event SnapshotCreated(uint256 indexed snapshotId, uint256 timestamp, string description);
    event SnapshotProcessed(uint256 indexed snapshotId, uint256 timestamp);
    event BalanceSnapshotted(uint256 indexed snapshotId, address indexed account, uint256 balance);
    event OperatorUpdated(address indexed operator, bool status);
    event ConfigUpdated(uint256 minInterval, uint256 maxSnapshots);

    /**
     * @dev Constructor
     */
    constructor(
        address _token,
        uint256 _minInterval,
        uint256 _maxSnapshots
    ) {
        require(_token != address(0), "Invalid token");
        token = IERC20(_token);
        config = SnapshotConfig({
            minInterval: _minInterval,
            maxSnapshots: _maxSnapshots,
            requiresReason: true,
            isActive: true
        });
    }

    /**
     * @dev Create snapshot
     */
    function createSnapshot(
        string calldata _description
    ) external onlyOperator whenNotPaused returns (uint256) {
        require(config.isActive, "Snapshot not active");
        require(snapshotCount < config.maxSnapshots, "Too many snapshots");
        
        if (snapshotCount > 0) {
            require(
                block.timestamp >= snapshots[snapshotCount].timestamp.add(config.minInterval),
                "Too frequent"
            );
        }

        if (config.requiresReason) {
            require(bytes(_description).length > 0, "Description required");
        }

        uint256 snapshotId = snapshotCount + 1;
        snapshots[snapshotId] = SnapshotInfo({
            id: snapshotId,
            timestamp: block.timestamp,
            description: _description,
            isProcessed: false,
            operator: msg.sender
        });

        snapshotCount = snapshotId;
        emit SnapshotCreated(snapshotId, block.timestamp, _description);
        return snapshotId;
    }

    /**
     * @dev Process snapshot
     */
    function processSnapshot(
        uint256 _snapshotId,
        address[] calldata _accounts
    ) external onlyOperator whenNotPaused {
        SnapshotInfo storage snapshot = snapshots[_snapshotId];
        require(snapshot.id > 0, "Snapshot not found");
        require(!snapshot.isProcessed, "Already processed");

        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            require(account != address(0), "Invalid account");

            uint256 balance = token.balanceOf(account);
            balanceSnapshots[_snapshotId][account] = BalanceSnapshot({
                snapshotId: _snapshotId,
                balance: balance,
                timestamp: block.timestamp,
                isValid: true
            });

            emit BalanceSnapshotted(_snapshotId, account, balance);
        }

        snapshot.isProcessed = true;
        emit SnapshotProcessed(_snapshotId, block.timestamp);
    }

    /**
     * @dev Batch process snapshot
     */
    function batchProcessSnapshot(
        uint256 _snapshotId,
        address[] calldata _accounts,
        uint256[] calldata _balances
    ) external onlyOperator whenNotPaused {
        require(_accounts.length == _balances.length, "Length mismatch");
        
        SnapshotInfo storage snapshot = snapshots[_snapshotId];
        require(snapshot.id > 0, "Snapshot not found");
        require(!snapshot.isProcessed, "Already processed");

        for (uint256 i = 0; i < _accounts.length; i++) {
            address account = _accounts[i];
            uint256 balance = _balances[i];
            require(account != address(0), "Invalid account");

            balanceSnapshots[_snapshotId][account] = BalanceSnapshot({
                snapshotId: _snapshotId,
                balance: balance,
                timestamp: block.timestamp,
                isValid: true
            });

            emit BalanceSnapshotted(_snapshotId, account, balance);
        }

        snapshot.isProcessed = true;
        emit SnapshotProcessed(_snapshotId, block.timestamp);
    }

    /**
     * @dev Get snapshot information
     */
    function getSnapshotInfo(
        uint256 _snapshotId
    ) external view returns (
        uint256 id,
        uint256 timestamp,
        string memory description,
        bool isProcessed,
        address operator
    ) {
        SnapshotInfo storage snapshot = snapshots[_snapshotId];
        return (
            snapshot.id,
            snapshot.timestamp,
            snapshot.description,
            snapshot.isProcessed,
            snapshot.operator
        );
    }

    /**
     * @dev Get balance snapshot
     */
    function getBalanceSnapshot(
        uint256 _snapshotId,
        address _account
    ) external view returns (
        uint256 snapshotId,
        uint256 balance,
        uint256 timestamp,
        bool isValid
    ) {
        BalanceSnapshot storage snapshot = balanceSnapshots[_snapshotId][_account];
        return (
            snapshot.snapshotId,
            snapshot.balance,
            snapshot.timestamp,
            snapshot.isValid
        );
    }

    /**
     * @dev Update operator
     */
    function updateOperator(
        address _operator,
        bool _status
    ) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /**
     * @dev Update configuration
     */
    function updateConfig(
        uint256 _minInterval,
        uint256 _maxSnapshots,
        bool _requiresReason
    ) external onlyOwner {
        config.minInterval = _minInterval;
        config.maxSnapshots = _maxSnapshots;
        config.requiresReason = _requiresReason;

        emit ConfigUpdated(_minInterval, _maxSnapshots);
    }

    /**
     * @dev Set snapshot system status
     */
    function setActive(bool _isActive) external onlyOwner {
        config.isActive = _isActive;
    }

    /**
     * @dev Pause/resume contract
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
     * @dev Batch get snapshot information
     */
    function batchGetSnapshotInfo(
        uint256[] calldata _snapshotIds
    ) external view returns (
        uint256[] memory ids,
        uint256[] memory timestamps,
        string[] memory descriptions,
        bool[] memory processedFlags,
        address[] memory operators
    ) {
        ids = new uint256[](_snapshotIds.length);
        timestamps = new uint256[](_snapshotIds.length);
        descriptions = new string[](_snapshotIds.length);
        processedFlags = new bool[](_snapshotIds.length);
        operators = new address[](_snapshotIds.length);

        for (uint256 i = 0; i < _snapshotIds.length; i++) {
            SnapshotInfo storage snapshot = snapshots[_snapshotIds[i]];
            ids[i] = snapshot.id;
            timestamps[i] = snapshot.timestamp;
            descriptions[i] = snapshot.description;
            processedFlags[i] = snapshot.isProcessed;
            operators[i] = snapshot.operator;
        }

        return (ids, timestamps, descriptions, processedFlags, operators);
    }

    /**
     * @dev Batch get balance snapshot
     */
    function batchGetBalanceSnapshot(
        uint256 _snapshotId,
        address[] calldata _accounts
    ) external view returns (
        uint256[] memory balances,
        uint256[] memory timestamps,
        bool[] memory validFlags
    ) {
        balances = new uint256[](_accounts.length);
        timestamps = new uint256[](_accounts.length);
        validFlags = new bool[](_accounts.length);

        for (uint256 i = 0; i < _accounts.length; i++) {
            BalanceSnapshot storage snapshot = balanceSnapshots[_snapshotId][_accounts[i]];
            balances[i] = snapshot.balance;
            timestamps[i] = snapshot.timestamp;
            validFlags[i] = snapshot.isValid;
        }

        return (balances, timestamps, validFlags);
    }

    /**
     * @dev Get snapshot statistics
     */
    function getSnapshotStats() external view returns (
        uint256 totalSnapshots,
        uint256 processedSnapshots,
        uint256 lastSnapshotTime,
        bool isActive,
        bool isPaused
    ) {
        uint256 processed = 0;
        for (uint256 i = 1; i <= snapshotCount; i++) {
            if (snapshots[i].isProcessed) {
                processed++;
            }
        }

        return (
            snapshotCount,
            processed,
            snapshotCount > 0 ? snapshots[snapshotCount].timestamp : 0,
            config.isActive,
            paused()
        );
    }

    /**
     * @dev Validate snapshot
     */
    function validateSnapshot(
        uint256 _snapshotId,
        address _account,
        uint256 _expectedBalance
    ) external view returns (bool) {
        BalanceSnapshot storage snapshot = balanceSnapshots[_snapshotId][_account];
        return snapshot.isValid && snapshot.balance == _expectedBalance;
    }

    /**
     * @dev Clean up expired snapshots
     */
    function cleanupSnapshots(uint256[] calldata _snapshotIds) external onlyOwner {
        for (uint256 i = 0; i < _snapshotIds.length; i++) {
            uint256 snapshotId = _snapshotIds[i];
            require(snapshots[snapshotId].id > 0, "Snapshot not found");
            require(snapshots[snapshotId].isProcessed, "Snapshot not processed");

            delete snapshots[snapshotId];
            emit SnapshotProcessed(snapshotId, block.timestamp);
        }
    }

    /**
     * @dev Emergency withdrawal
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(token), "Cannot withdraw snapshot token");
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev Check if it's an operator
     */
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }
}
```

## Key Concepts

### Snapshot Management

Snapshot features include:
- Snapshot creation
- Snapshot processing
- Snapshot validation
- State recording

### Permission Management

Permission features include:
- Operator management
- Permission verification
- Configuration control
- State management

### Data Management

Data features include:
- Balance recording
- Data verification
- Batch processing
- Query statistics

## Security Considerations

1. Snapshot security
   - Time validation
   - State check
   - Data verification
   - Exception handling

2. Permission security
   - Operator verification
   - Permission check
   - Configuration control
   - State protection

3. System security
   - Permission control
   - Pause mechanism
   - Reentrancy protection
   - State synchronization

4. Upgrade security
   - Configuration update
   - Operator adjustment
   - State migration
   - Emergency handling

## Best Practices

1. Snapshot management
   - Time control
   - State verification
   - Data recording
   - Exception handling

2. Permission management
   - Operator allocation
   - Permission verification
   - Configuration control
   - State management

3. Data management
   - Data verification
   - Batch processing
   - Query optimization
   - Storage optimization

4. System maintenance
   - Parameter optimization
   - Performance monitoring
   - Security audit
   - Upgrade plan

## Extended Features

1. Multi-token snapshots
2. Incremental snapshots
3. Data compression
4. Historical queries
5. Data analysis

## Application Scenarios

1. Governance voting
   - Weight calculation
   - Voting verification
   - Result statistics
   - Equity distribution

2. Airdrop distribution
   - Eligibility verification
   - Quantity calculation
   - Batch distribution
   - Record tracking

3. Data analysis
   - Position analysis
   - Liquidity analysis
   - Transaction analysis
   - Risk assessment

## Summary

The token snapshot system is an important tool in the DeFi ecosystem. Through this tutorial, you can:
- Implement snapshot features
- Manage data recording
- Optimize query efficiency
- Provide data analysis 

## Frequently Asked Questions (FAQ)

### Basic Concepts

**Q: What is a token snapshot?**

A: A token snapshot is a mechanism for recording the balance status of all token holders at specific points in time, mainly used for:
- Airdrop distribution
- Governance voting
- Reward distribution
- Audit tracking
- State rollback

**Q: What are the trigger conditions for snapshots?**

A: Snapshots can be triggered by the following conditions:
- Time interval
- Specific events
- Manager operations
- Governance proposals
- System status changes

### Operation-related

**Q: How to create a snapshot?**

A: The steps to create a snapshot include:
- Confirm operation permissions
- Check time intervals
- Provide necessary descriptions
- Call the creation function
- Wait for processing to complete

**Q: How to query snapshot data?**

A: Query methods include:
- Query by snapshot ID
- Query by account address
- Query by time range
- Batch query interfaces
- Export data functions

### Security-related

**Q: What are the risks of the snapshot system?**

A: The main risks include:
- Permission abuse
- Data incompleteness
- Replay attacks
- Storage overflow
- System failures

**Q: How to ensure system security?**

A: Security measures include:
- Multi-level authorization
- Data verification
- State check
- Complete logging
- Emergency mechanisms

### Performance-related

**Q: How to optimize snapshot performance?**

A: Optimization methods include:
- Batch processing
- Data compression
- Storage optimization
- Query caching
- Index optimization

**Q: How to handle large-scale snapshots?**

A: Handling strategies:
- Incremental snapshots
- Data sharding
- Parallel processing
- Memory optimization
- Load balancing

### Implementation Details

**Q: How to implement snapshot validation?**

A: Implementation approach:
```solidity
function validateSnapshot(uint256 snapshotId) internal view returns (bool) {
    // 1. Check snapshot existence
    SnapshotInfo storage snapshot = snapshots[snapshotId];
    if (snapshot.id == 0) return false;
    
    // 2. Check time interval
    if (snapshot.timestamp < lastSnapshotTime + minInterval) return false;
    
    // 3. Validate data
    if (!validateSnapshotData(snapshotId)) return false;
    
    return true;
}
```

**Q: How to handle batch operations?**

A: Processing mechanism:
```solidity
function batchProcess(uint256[] calldata snapshotIds) external {
    // 1. Verify permissions
    require(hasRole(OPERATOR_ROLE, msg.sender), "Not authorized");
    
    // 2. Batch processing
    for (uint256 i = 0; i < snapshotIds.length; i++) {
        if (validateSnapshot(snapshotIds[i])) {
            processSnapshot(snapshotIds[i]);
            emit SnapshotProcessed(snapshotIds[i]);
        }
    }
}
```

### Error Handling

**Q: Common errors and solutions?**

A: Error types:
- `"Invalid snapshot ID"`: Verify snapshot existence
- `"Not authorized"`: Check permissions
- `"Already processed"`: Check snapshot status
- `"Invalid interval"`: Check time parameters
- `"System paused"`: Wait for system recovery

**Q: How to handle exceptions?**

A: Handling mechanisms:
- Error retry
- Status rollback
- Emergency pause
- Manual intervention
- Event logging

### Integration Guide

**Q: How to integrate with other systems?**

A: Integration methods:
- Standard interfaces
- Event monitoring
- State synchronization
- Data validation
- Error handling

**Q: How to implement cross-chain snapshots?**

A: Implementation approaches:
- Bridge protocols
- Message passing
- State verification
- Asset mapping
- Security measures

### System Architecture

1. Core Components
   - Snapshot module
   - Permission module
   - Data module
   - Query module
   - Security module

2. Process Flow
   - Snapshot creation
   - Data recording
   - Status verification
   - Result query
   - Event emission

3. Data Structure
   - Snapshot information
   - Balance records
   - Permission settings
   - System parameters
   - Event logs

4. Security Design
   - Permission control
   - State verification
   - Transaction validation
   - Emergency handling
   - Event monitoring

### Development Guidelines

1. Contract Setup
   - Initialize parameters
   - Set up roles
   - Configure snapshots
   - Implement security
   - Enable monitoring

2. Operation Flow
   - Request validation
   - State updates
   - Data recording
   - Event emission
   - Error handling

3. Security Measures
   - Input validation
   - State checks
   - Access control
   - Emergency pause
   - Event logging

4. Optimization Strategies
   - Gas optimization
   - Batch processing
   - State caching
   - Code efficiency
   - Performance monitoring

### Usage Examples

1. Create Snapshot
```javascript
const description = "Governance snapshot";
await snapshotSystem.createSnapshot(description);
```

2. Process Snapshot
```javascript
const accounts = ["0x...", "0x..."];
await snapshotSystem.processSnapshot(snapshotId, accounts);
```

3. Query Snapshot
```javascript
const snapshotInfo = await snapshotSystem.getSnapshotInfo(snapshotId);
```

4. Batch Operations
```javascript
const snapshotIds = [1, 2, 3];
await snapshotSystem.batchProcessSnapshot(snapshotIds);
```

### Development Tips

1. Security First
   - Complete testing
   - Security audit
   - Error handling
   - Access control
   - Event logging

2. Performance Optimization
   - Gas efficiency
   - Batch processing
   - State management
   - Code optimization
   - Cache usage

3. User Experience
   - Clear interface
   - Status feedback
   - Error messages
   - Operation guidance
   - Documentation

4. Maintenance
   - Regular monitoring
   - Parameter tuning
   - Version control
   - Upgrade planning
   - Emergency response

### Future Extensions

1. Advanced Features
   - Multi-token snapshots
   - Incremental snapshots
   - Compressed storage
   - Historical queries
   - Analytics tools

2. System Upgrades
   - Protocol improvements
   - Security enhancements
   - Performance optimization
   - Feature additions
   - User experience improvements

3. Integration Options
   - DeFi protocols
   - Governance systems
   - Cross-chain bridges
   - Analytics platforms
   - User interfaces
```
