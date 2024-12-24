# Token Vote Weight System

## 1. System Overview

The token vote weight system is a decentralized voting weight management platform implemented in Solidity, supporting flexible weight calculation and voting power management. The system implements multi-dimensional weight calculation and a comprehensive weight adjustment mechanism.

### 1.1 Main Features

- Multi-dimensional weights: Support multiple weight factors
- Dynamic adjustment: Real-time weight calculation
- Time locking: Lock period weight bonus
- Historical contribution: Historical behavior weight
- Delegation mechanism: Weight delegation functionality

## 2. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenVoteWeight
 * @dev Token vote weight contract
 */
contract TokenVoteWeight is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Weight information
    struct WeightInfo {
        uint256 baseWeight;        // Base weight
        uint256 timeWeight;        // Time weight
        uint256 activityWeight;    // Activity weight
        uint256 lockWeight;        // Lock weight
        uint256 lastUpdateTime;    // Last update time
        address delegateTo;        // Delegate address
    }

    // Lock information
    struct LockInfo {
        uint256 amount;           // Lock amount
        uint256 startTime;        // Start time
        uint256 endTime;          // End time
        uint256 multiplier;       // Weight multiplier
    }

    // State variables
    IERC20 public token;                                         // Voting token
    mapping(address => WeightInfo) public weightInfo;            // Weight information
    mapping(address => LockInfo[]) public lockInfo;              // Lock information
    mapping(address => uint256) public totalLocked;              // Total locked amount
    mapping(address => uint256) public activityPoints;           // Activity points
    mapping(address => mapping(address => uint256)) public delegatedPower;  // Delegated weight

    // Constants
    uint256 public constant PRECISION = 1e18;                    // Precision
    uint256 public constant MAX_LOCK_TIME = 4 * 365 days;        // Maximum lock time (4 years)
    uint256 public constant MAX_MULTIPLIER = 4e18;               // Maximum multiplier (4x)
    uint256 public constant MIN_LOCK_TIME = 7 days;              // Minimum lock time

    // Events
    event WeightUpdated(address indexed user, uint256 newWeight);
    event TokensLocked(address indexed user, uint256 amount, uint256 duration);
    event TokensUnlocked(address indexed user, uint256 amount);
    event DelegationChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event ActivityPointsAdded(address indexed user, uint256 points);

    /**
     * @dev Constructor
     */
    constructor(IERC20 _token) {
        token = _token;
    }

    /**
     * @dev Lock tokens
     */
    function lock(uint256 amount, uint256 duration) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(duration >= MIN_LOCK_TIME, "Duration too short");
        require(duration <= MAX_LOCK_TIME, "Duration too long");

        // Transfer tokens
        token.transferFrom(msg.sender, address(this), amount);

        // Calculate weight multiplier
        uint256 multiplier = calculateMultiplier(duration);

        // Create lock record
        lockInfo[msg.sender].push(LockInfo({
            amount: amount,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            multiplier: multiplier
        }));

        // Update total locked amount
        totalLocked[msg.sender] = totalLocked[msg.sender].add(amount);

        // Update weight
        updateWeight(msg.sender);

        emit TokensLocked(msg.sender, amount, duration);
    }

    /**
     * @dev Unlock tokens
     */
    function unlock(uint256 lockId) external nonReentrant {
        require(lockId < lockInfo[msg.sender].length, "Invalid lock ID");
        
        LockInfo storage info = lockInfo[msg.sender][lockId];
        require(block.timestamp >= info.endTime, "Lock not expired");
        require(info.amount > 0, "Already unlocked");

        uint256 amount = info.amount;
        info.amount = 0;

        // Update total locked amount
        totalLocked[msg.sender] = totalLocked[msg.sender].sub(amount);

        // Update weight
        updateWeight(msg.sender);

        // Transfer tokens
        token.transfer(msg.sender, amount);

        emit TokensUnlocked(msg.sender, amount);
    }

    /**
     * @dev Delegate voting power
     */
    function delegate(address delegatee) external {
        address currentDelegate = weightInfo[msg.sender].delegateTo;
        WeightInfo storage delegatorWeight = weightInfo[msg.sender];

        if (currentDelegate != address(0)) {
            delegatedPower[currentDelegate][msg.sender] = 0;
        }

        if (delegatee != address(0)) {
            delegatedPower[delegatee][msg.sender] = getTotalWeight(msg.sender);
        }

        delegatorWeight.delegateTo = delegatee;

        emit DelegationChanged(msg.sender, currentDelegate, delegatee);
    }

    /**
     * @dev Add activity points
     */
    function addActivityPoints(address user, uint256 points) external onlyOwner {
        activityPoints[user] = activityPoints[user].add(points);
        updateWeight(user);
        emit ActivityPointsAdded(user, points);
    }

    /**
     * @dev Update weight
     */
    function updateWeight(address user) public {
        WeightInfo storage info = weightInfo[user];
        
        // Update base weight
        info.baseWeight = totalLocked[user];

        // Update time weight
        info.timeWeight = calculateTimeWeight(user);

        // Update activity weight
        info.activityWeight = calculateActivityWeight(user);

        // Update lock weight
        info.lockWeight = calculateLockWeight(user);

        info.lastUpdateTime = block.timestamp;

        emit WeightUpdated(user, getTotalWeight(user));
    }

    /**
     * @dev Calculate total weight
     */
    function getTotalWeight(address user) public view returns (uint256) {
        WeightInfo storage info = weightInfo[user];
        return info.baseWeight
            .add(info.timeWeight)
            .add(info.activityWeight)
            .add(info.lockWeight);
    }

    /**
     * @dev Calculate time weight
     */
    function calculateTimeWeight(address user) public view returns (uint256) {
        uint256 totalWeight = 0;
        LockInfo[] storage locks = lockInfo[user];

        for (uint256 i = 0; i < locks.length; i++) {
            if (locks[i].amount == 0) continue;
            
            uint256 timeElapsed = block.timestamp.sub(locks[i].startTime);
            uint256 weight = locks[i].amount.mul(timeElapsed).div(MAX_LOCK_TIME);
            totalWeight = totalWeight.add(weight);
        }

        return totalWeight;
    }

    /**
     * @dev Calculate activity weight
     */
    function calculateActivityWeight(address user) public view returns (uint256) {
        return activityPoints[user].mul(PRECISION).div(1000); // 0.1% per point
    }

    /**
     * @dev Calculate lock weight
     */
    function calculateLockWeight(address user) public view returns (uint256) {
        uint256 totalWeight = 0;
        LockInfo[] storage locks = lockInfo[user];

        for (uint256 i = 0; i < locks.length; i++) {
            if (locks[i].amount == 0) continue;
            
            uint256 weight = locks[i].amount.mul(locks[i].multiplier).div(PRECISION);
            totalWeight = totalWeight.add(weight);
        }

        return totalWeight;
    }

    /**
     * @dev Calculate weight multiplier
     */
    function calculateMultiplier(uint256 duration) public pure returns (uint256) {
        uint256 multiplier = PRECISION.add(
            duration.mul(MAX_MULTIPLIER.sub(PRECISION)).div(MAX_LOCK_TIME)
        );
        return multiplier;
    }
}
```

## 3. Function Description

### 3.1 Weight Management
- Base weight calculation
- Time weight calculation
- Activity weight calculation
- Lock weight calculation

### 3.2 Locking Mechanism
- Token locking
- Unlock operation
- Weight multiplier calculation

### 3.3 Delegation Mechanism
- Weight delegation
- Delegated weight calculation
- Delegation relationship management

## 4. Security Mechanism

### 4.1 Weight Control
- Maximum lock time
- Maximum weight multiplier
- Minimum lock time

### 4.2 Access Control
- Permission management
- Reentrancy protection
- Parameter verification

### 4.3 State Management
- Weight update
- Locking status
- Delegation relationship

## 5. Usage Example

### 5.1 Locking Tokens
```javascript
const amount = ethers.utils.parseEther("100");
const duration = 365 * 24 * 60 * 60; // 1 year
await token.approve(voteWeight.address, amount);
await voteWeight.lock(amount, duration);
```

### 5.2 Delegating Weight
```javascript
await voteWeight.delegate(delegatee);
```

### 5.3 Querying Weight
```javascript
const weight = await voteWeight.getTotalWeight(userAddress);
console.log("Total weight:", ethers.utils.formatEther(weight));
```

## 6. Summary

The token vote weight system implements a complete weight management function, including:
- Multi-dimensional weight calculation
- Flexible locking mechanism
- Weight delegation functionality
- Activity point system
- Comprehensive security mechanism

The system ensures the fairness and reliability of voting weights through carefully designed weight calculation models and security mechanisms. 

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is token vote weight?
A: Token vote weight is a governance mechanism, with the main features including:
- Weight based on token amount
- Time locking bonus
- Activity weight reward
- Delegation voting mechanism
- Dynamic weight adjustment

Q: What types of voting weights are there?
A: The main types include:
- Base weight
- Time weight
- Activity weight
- Lock weight
- Delegated weight

### 2. Function-related

Q: How is voting weight calculated?
A: Calculation method:
```solidity
function calculateVoteWeight(
    uint256 amount,
    uint256 lockTime,
    uint256 activityPoints
) public pure returns (uint256) {
    // 1. Base weight
    uint256 baseWeight = amount;
    
    // 2. Time weight
    uint256 timeWeight = amount * lockTime / MAX_LOCK_TIME;
    
    // 3. Activity weight
    uint256 activityWeight = activityPoints * POINT_MULTIPLIER;
    
    // 4. Total weight
    return baseWeight + timeWeight + activityWeight;
}
```

Q: How is delegated weight managed?
A: Management strategy:
- Delegation record
- Weight transfer
- Revocation mechanism
- Revenue distribution
- State update

### 3. Security-related

Q: What risks are there in the weight system?
A: The main risks include:
- Weight manipulation
- Delegation attack
- Time attack
- Calculation overflow
- Permission abuse

Q: How is voting weight protected?
A: Security measures include:
- Weight cap
- Lock period
- Delegation limit
- Activity verification
- Permission control

### 4. Optimization-related

Q: How is weight calculation optimized?
A: Optimization strategy:
- Cache calculation
- Batch update
- Storage optimization
- Logic simplification
- Gas optimization

Q: How is system efficiency improved?
A: Improvement plan:
- Asynchronous update
- State compression
- Batch processing
- Event optimization
- Storage optimization

### 5. Implementation details

Q: How is weight updated?
A: Implementation mechanism:
```solidity
function updateWeight(
    address user,
    uint256 newAmount,
    uint256 lockTime
) internal {
    // 1. Get user information
    WeightInfo storage info = weightInfo[user];
    
    // 2. Update base weight
    info.baseWeight = newAmount;
    
    // 3. Update time weight
    if (lockTime > 0) {
        info.timeWeight = calculateTimeWeight(newAmount, lockTime);
    }
    
    // 4. Update total weight
    emit WeightUpdated(user, getTotalWeight(user));
}
```

Q: How is delegation changed handled?
A: Handling mechanism:
- Weight transfer
- State update
- Revenue adjustment
- Record changes
- Event notification

### 6. Best Practices

Q: Weight system development suggestions?
A: Development suggestions:
- Modular design
- Complete testing
- Security audit
- Document improvement
- Monitoring and warning

Q: How is system reliability improved?
A: Improvement plan:
- Fault detection
- Automatic recovery
- State verification
- Logging
- Backup mechanism

### 7. Error Handling

Q: Common errors and solutions?
A: Error types:
- `"Invalid amount"`: Check quantity
- `"Lock time expired"`: Verify time
- `"Not delegated"`: Check delegation
- `"Weight overflow"`: Verify calculation
- `"Not authorized"`: Confirm permission

Q: How are exceptions handled?
A: Handling mechanism:
- State rollback
- Error logging
- Notification mechanism
- Manual correction
- Compensation mechanism

### 8. Upgrade and Maintenance

Q: How is the weight system upgraded?
A: Upgrade strategy:
- Proxy contract
- Data migration
- Compatibility processing
- Test verification
- Smooth transition

Q: How is system status monitored?
A: Monitoring plan:
- Weight change
- Delegation status
- Activity record
- Exception detection
- Performance indicators

### 9. Integration with Other Systems

Q: How is it integrated with the governance system?
A: Integration plan:
- Proposal weight
- Voting calculation
- State synchronization
- Permission management
- Result verification

Q: How is cross-chain weight implemented?
A: Implementation strategy:
- Cross-chain messages
- Weight mapping
- State synchronization
- Security verification
- Consistency guarantee 