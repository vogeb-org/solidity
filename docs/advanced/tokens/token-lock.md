# Token Lock System

The token lock system is used to implement time-based token locking and conditional unlocking, commonly used for managing team tokens and investor token locks. This tutorial will explain how to implement a secure token lock system.

## Features

- Time locking mechanism
- Batch release support
- Multi-beneficiary management
- Lock condition settings
- Emergency operation mechanism

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TokenLock
 * @dev Token lock contract implementation
 */
contract TokenLock is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // Lock information structure
    struct LockInfo {
        address token;           // Token address
        address beneficiary;     // Beneficiary address
        uint256 totalAmount;     // Total locked amount
        uint256 releasedAmount; // Released amount
        uint256 startTime;       // Start time
        uint256 endTime;         // End time
        uint256[] releasePoints; // Release time points
        uint256[] releaseRatios; // Release ratios
        bool revocable;          // Whether revocable
        bool revoked;            // Whether revoked
    }

    // Lock ID counter
    Counters.Counter private lockIdCounter;
    
    // Lock information mapping
    mapping(uint256 => LockInfo) public locks;
    // User lock ID mapping user => lockIds
    mapping(address => uint256[]) public userLocks;
    
    // Events
    event LockCreated(uint256 indexed lockId, address indexed token, address indexed beneficiary);
    event TokensReleased(uint256 indexed lockId, uint256 amount);
    event LockRevoked(uint256 indexed lockId);
    event BeneficiaryUpdated(uint256 indexed lockId, address indexed oldBeneficiary, address indexed newBeneficiary);

    /**
     * @dev Create new lock
     */
    function createLock(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] calldata _releasePoints,
        uint256[] calldata _releaseRatios,
        bool _revocable
    ) external returns (uint256) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_totalAmount > 0, "Invalid amount");
        require(_startTime < _endTime, "Invalid time range");
        require(
            _releasePoints.length == _releaseRatios.length,
            "Points and ratios length mismatch"
        );
        require(
            _releasePoints.length > 0,
            "No release points specified"
        );
        
        // Validate release points and ratios
        uint256 totalRatio = 0;
        for (uint256 i = 0; i < _releasePoints.length; i++) {
            require(
                _releasePoints[i] >= _startTime && _releasePoints[i] <= _endTime,
                "Invalid release point"
            );
            if (i > 0) {
                require(
                    _releasePoints[i] > _releasePoints[i-1],
                    "Release points must be in order"
                );
            }
            totalRatio += _releaseRatios[i];
        }
        require(totalRatio == 100, "Total ratio must be 100");

        // Transfer tokens
        IERC20(_token).transferFrom(msg.sender, address(this), _totalAmount);

        // Create lock information
        uint256 lockId = lockIdCounter.current();
        lockIdCounter.increment();

        locks[lockId] = LockInfo({
            token: _token,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            releasedAmount: 0,
            startTime: _startTime,
            endTime: _endTime,
            releasePoints: _releasePoints,
            releaseRatios: _releaseRatios,
            revocable: _revocable,
            revoked: false
        });

        userLocks[_beneficiary].push(lockId);
        
        emit LockCreated(lockId, _token, _beneficiary);
        
        return lockId;
    }

    /**
     * @dev Release tokens
     */
    function release(uint256 _lockId) external nonReentrant {
        LockInfo storage lock = locks[_lockId];
        require(!lock.revoked, "Lock revoked");
        require(
            msg.sender == lock.beneficiary,
            "Only beneficiary can release"
        );
        
        uint256 releasableAmount = getReleasableAmount(_lockId);
        require(releasableAmount > 0, "No tokens to release");

        lock.releasedAmount += releasableAmount;
        
        IERC20(lock.token).transfer(lock.beneficiary, releasableAmount);
        
        emit TokensReleased(_lockId, releasableAmount);
    }

    /**
     * @dev Calculate releasable amount
     */
    function getReleasableAmount(uint256 _lockId) public view returns (uint256) {
        LockInfo storage lock = locks[_lockId];
        if (lock.revoked || block.timestamp < lock.startTime) {
            return 0;
        }

        uint256 currentReleaseRatio = 0;
        for (uint256 i = 0; i < lock.releasePoints.length; i++) {
            if (block.timestamp >= lock.releasePoints[i]) {
                currentReleaseRatio = 0;
                for (uint256 j = 0; j <= i; j++) {
                    currentReleaseRatio += lock.releaseRatios[j];
                }
            }
        }

        uint256 releasableAmount = (lock.totalAmount * currentReleaseRatio) / 100;
        return releasableAmount - lock.releasedAmount;
    }

    /**
     * @dev Revoke lock (admin only)
     */
    function revoke(uint256 _lockId) external onlyOwner {
        LockInfo storage lock = locks[_lockId];
        require(lock.revocable, "Lock not revocable");
        require(!lock.revoked, "Lock already revoked");

        lock.revoked = true;
        
        uint256 remainingAmount = lock.totalAmount - lock.releasedAmount;
        if (remainingAmount > 0) {
            IERC20(lock.token).transfer(owner(), remainingAmount);
        }
        
        emit LockRevoked(_lockId);
    }

    /**
     * @dev Update beneficiary
     */
    function updateBeneficiary(uint256 _lockId, address _newBeneficiary) external {
        require(_newBeneficiary != address(0), "Invalid beneficiary address");
        LockInfo storage lock = locks[_lockId];
        require(
            msg.sender == lock.beneficiary,
            "Only current beneficiary can update"
        );

        address oldBeneficiary = lock.beneficiary;
        lock.beneficiary = _newBeneficiary;

        // Update user lock mapping
        uint256[] storage oldUserLockIds = userLocks[oldBeneficiary];
        for (uint256 i = 0; i < oldUserLockIds.length; i++) {
            if (oldUserLockIds[i] == _lockId) {
                oldUserLockIds[i] = oldUserLockIds[oldUserLockIds.length - 1];
                oldUserLockIds.pop();
                break;
            }
        }
        userLocks[_newBeneficiary].push(_lockId);

        emit BeneficiaryUpdated(_lockId, oldBeneficiary, _newBeneficiary);
    }

    /**
     * @dev Get all lock IDs for a user
     */
    function getUserLocks(address _user) external view returns (uint256[] memory) {
        return userLocks[_user];
    }

    /**
     * @dev Get lock details
     */
    function getLockInfo(uint256 _lockId)
        external
        view
        returns (
            address token,
            address beneficiary,
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startTime,
            uint256 endTime,
            uint256[] memory releasePoints,
            uint256[] memory releaseRatios,
            bool revocable,
            bool revoked
        )
    {
        LockInfo storage lock = locks[_lockId];
        return (
            lock.token,
            lock.beneficiary,
            lock.totalAmount,
            lock.releasedAmount,
            lock.startTime,
            lock.endTime,
            lock.releasePoints,
            lock.releaseRatios,
            lock.revocable,
            lock.revoked
        );
    }
}
```

## Key Concepts

### Lock Mechanism

The lock system includes:
- Time-based locking
- Batch release
- Release conditions
- Emergency operations

### Release Management

Release features include:
- Release schedule
- Release ratios
- Release verification
- Release tracking

### Permission Control

Permission management:
- Admin permissions
- Beneficiary rights
- Revocation control
- Parameter management

## Security Considerations

1. Lock security
   - Time validation
   - Amount verification
   - Release conditions
   - Emergency handling

2. Release security
   - Amount calculation
   - Release timing
   - Permission checks
   - State updates

3. System security
   - Access control
   - Parameter validation
   - State management
   - Event logging

4. Data security
   - State synchronization
   - Data verification
   - Error handling
   - Record keeping

## Best Practices

1. Lock configuration
   - Reasonable schedules
   - Appropriate ratios
   - Clear conditions
   - Emergency plans

2. Release management
   - Schedule monitoring
   - Amount verification
   - Status tracking
   - Exception handling

3. Operation management
   - Parameter optimization
   - Beneficiary management
   - Emergency response
   - Regular audits

4. User experience
   - Clear instructions
   - Status visibility
   - Easy operations
   - Error messages

## Extended Features

1. Dynamic schedules
2. Multi-token support
3. Advanced conditions
4. Automated releases
5. Recovery mechanisms

## Application Scenarios

1. Token management
   - Team tokens
   - Investor tokens
   - Community rewards
   - Mining rewards

2. Release control
   - Linear release
   - Staged release
   - Conditional release
   - Emergency handling

3. Access management
   - Role-based access
   - Permission levels
   - Operation limits
   - Audit trails

## Summary

The token lock system is crucial for token distribution management. Through this tutorial, you can:
- Implement secure token locks
- Manage release schedules
- Control access rights
- Handle emergencies

## Frequently Asked Questions (FAQ)

### Basic Concepts

**Q: What is token locking?**

A: Token locking is a mechanism to restrict token transfers for a specified period, commonly used for:
- Team token management
- Investor vesting
- Project governance
- Risk control
- Market stability

**Q: Why is token locking needed?**

A: Token locking is essential for:
- Preventing token dumps
- Ensuring long-term commitment
- Managing distribution
- Protecting investors
- Maintaining stability

### Function-related

**Q: How to set lock parameters?**

A: Lock parameters should consider:
- Lock duration
- Release schedule
- Release ratios
- Revocation rights
- Emergency measures

**Q: How to manage releases?**

A: Release management involves:
- Schedule tracking
- Amount calculation
- Permission checks
- Status updates
- Record keeping

### Security-related

**Q: What are the risks of token locking?**

A: Main risks include:
- Contract vulnerabilities
- Parameter errors
- Permission issues
- Release failures
- Emergency situations

**Q: How to handle emergencies?**

A: Emergency handling includes:
- Quick response
- Access control
- State preservation
- User notification
- Recovery procedures

### Optimization-related

**Q: How to optimize lock mechanisms?**

A: Lock mechanisms can be optimized through:
- Flexible schedules
- Smart conditions
- Efficient releases
- Better monitoring
- Automated processes

**Q: How to improve user experience?**

A: User experience can be improved by:
- Clear interfaces
- Status tracking
- Easy operations
- Helpful feedback
- Support documentation