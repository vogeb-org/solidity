# Token Vesting System

## Introduction

Token vesting is a mechanism to gradually release tokens over time, commonly used for team allocations, investor distributions, and incentive programs. This tutorial explains how to implement a secure and flexible token vesting system.

## Features

- Linear and cliff vesting schedules
- Multiple beneficiary support
- Revocable vesting options
- Emergency pause mechanism
- Vesting status tracking

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

contract TokenVesting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    struct VestingSchedule {
        bool initialized;
        address beneficiary;
        uint256 cliff;
        uint256 start;
        uint256 duration;
        uint256 slicePeriodSeconds;
        bool revocable;
        uint256 amountTotal;
        uint256 released;
        bool revoked;
    }

    // Token to be vested
    IERC20 public immutable token;

    // Vesting schedules
    bytes32[] private vestingSchedulesIds;
    mapping(bytes32 => VestingSchedule) private vestingSchedules;
    mapping(address => uint256) private holdersVestingCount;

    // Events
    event VestingScheduleCreated(bytes32 indexed id, address beneficiary);
    event Released(bytes32 indexed vestingScheduleId, uint256 amount);
    event Revoked(bytes32 indexed vestingScheduleId);

    /**
     * @dev Constructor
     */
    constructor(address _token) {
        require(_token != address(0), "Invalid token address");
        token = IERC20(_token);
    }

    /**
     * @dev Create a vesting schedule
     */
    function createVestingSchedule(
        address _beneficiary,
        uint256 _start,
        uint256 _cliff,
        uint256 _duration,
        uint256 _slicePeriodSeconds,
        bool _revocable,
        uint256 _amount
    ) external onlyOwner {
        require(
            _beneficiary != address(0),
            "Invalid beneficiary address"
        );
        require(
            _duration > 0,
            "Duration must be > 0"
        );
        require(
            _amount > 0,
            "Amount must be > 0"
        );
        require(
            _slicePeriodSeconds >= 1,
            "slicePeriodSeconds must be >= 1"
        );
        require(
            _duration >= _cliff,
            "Duration must be >= cliff"
        );

        bytes32 vestingScheduleId = computeVestingScheduleId(
            _beneficiary,
            vestingSchedulesIds.length
        );
        
        uint256 cliff = _start.add(_cliff);
        
        vestingSchedules[vestingScheduleId] = VestingSchedule(
            true,
            _beneficiary,
            cliff,
            _start,
            _duration,
            _slicePeriodSeconds,
            _revocable,
            _amount,
            0,
            false
        );
        
        vestingSchedulesIds.push(vestingScheduleId);
        holdersVestingCount[_beneficiary] = holdersVestingCount[_beneficiary].add(1);

        // Transfer tokens to contract
        require(
            token.transferFrom(msg.sender, address(this), _amount),
            "Transfer failed"
        );
        
        emit VestingScheduleCreated(vestingScheduleId, _beneficiary);
    }

    /**
     * @dev Release vested tokens
     */
    function release(bytes32 vestingScheduleId) external nonReentrant {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(
            vestingSchedule.initialized,
            "Invalid vesting schedule"
        );
        require(
            msg.sender == vestingSchedule.beneficiary,
            "Only beneficiary can release vested tokens"
        );
        require(
            !vestingSchedule.revoked,
            "Vesting schedule revoked"
        );

        uint256 vestedAmount = computeVestedAmount(vestingScheduleId);
        uint256 releasableAmount = vestedAmount.sub(vestingSchedule.released);
        require(releasableAmount > 0, "No tokens to release");

        vestingSchedule.released = vestingSchedule.released.add(releasableAmount);
        require(
            token.transfer(vestingSchedule.beneficiary, releasableAmount),
            "Transfer failed"
        );
        
        emit Released(vestingScheduleId, releasableAmount);
    }

    /**
     * @dev Revoke vesting schedule
     */
    function revoke(bytes32 vestingScheduleId) external onlyOwner {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(
            vestingSchedule.initialized,
            "Invalid vesting schedule"
        );
        require(
            vestingSchedule.revocable,
            "Vesting schedule not revocable"
        );
        require(
            !vestingSchedule.revoked,
            "Vesting schedule already revoked"
        );

        uint256 vestedAmount = computeVestedAmount(vestingScheduleId);
        uint256 refundAmount = vestingSchedule.amountTotal.sub(vestedAmount);
        
        vestingSchedule.revoked = true;
        
        if (refundAmount > 0) {
            require(
                token.transfer(owner(), refundAmount),
                "Transfer failed"
            );
        }
        
        emit Revoked(vestingScheduleId);
    }

    /**
     * @dev Compute vested amount
     */
    function computeVestedAmount(bytes32 vestingScheduleId)
        public
        view
        returns (uint256)
    {
        VestingSchedule storage vestingSchedule = vestingSchedules[vestingScheduleId];
        require(
            vestingSchedule.initialized,
            "Invalid vesting schedule"
        );
        
        if (block.timestamp < vestingSchedule.cliff) {
            return 0;
        }
        
        if (vestingSchedule.revoked) {
            return vestingSchedule.released;
        }
        
        if (block.timestamp >= vestingSchedule.start.add(vestingSchedule.duration)) {
            return vestingSchedule.amountTotal;
        }
        
        uint256 timeFromStart = block.timestamp.sub(vestingSchedule.start);
        uint256 vestedAmount = vestingSchedule.amountTotal
            .mul(timeFromStart)
            .div(vestingSchedule.duration);
            
        return vestedAmount;
    }

    /**
     * @dev Compute vesting schedule ID
     */
    function computeVestingScheduleId(
        address holder,
        uint256 index
    ) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(holder, index));
    }

    /**
     * @dev Get vesting schedule
     */
    function getVestingSchedule(bytes32 vestingScheduleId)
        public
        view
        returns (VestingSchedule memory)
    {
        return vestingSchedules[vestingScheduleId];
    }

    /**
     * @dev Get vesting schedules count
     */
    function getVestingSchedulesCount() public view returns (uint256) {
        return vestingSchedulesIds.length;
    }

    /**
     * @dev Get vesting schedules by holder
     */
    function getVestingSchedulesCountByHolder(address holder)
        public
        view
        returns (uint256)
    {
        return holdersVestingCount[holder];
    }
}
```

## Core Concepts

### 1. Vesting Schedule

A vesting schedule defines how tokens are released over time:
- Start time
- Cliff period
- Vesting duration
- Release frequency
- Total amount

### 2. Cliff Period

The cliff is an initial period during which no tokens are vested:
- Prevents early withdrawals
- Ensures long-term commitment
- Common in team allocations
- Configurable duration

### 3. Linear Vesting

After the cliff period, tokens are released linearly:
- Continuous release
- Proportional distribution
- Fair allocation
- Predictable schedule

### 4. Revocable Vesting

Some schedules can be revoked by the owner:
- Emergency control
- Compliance requirements
- Team departures
- Risk management

## Security Considerations

1. Access Control
   - Owner permissions
   - Beneficiary rights
   - Transfer restrictions
   - Revocation rules

2. Time Management
   - Block timestamp usage
   - Schedule validation
   - Duration checks
   - Release timing

3. Token Security
   - Safe transfers
   - Balance tracking
   - Overflow protection
   - Reentrancy guards

4. Schedule Integrity
   - Initialization checks
   - Parameter validation
   - State consistency
   - Event logging

## Best Practices

1. Implementation
   - Use SafeMath
   - Implement nonReentrant
   - Follow checks-effects-interactions
   - Validate inputs

2. Testing
   - Time-based scenarios
   - Edge cases
   - Revocation cases
   - Multiple schedules

3. Deployment
   - Parameter verification
   - Token approval
   - Schedule creation
   - Initial testing

4. Monitoring
   - Schedule tracking
   - Release monitoring
   - Balance verification
   - Event logging

## Extended Features

1. Advanced Schedules
   - Step-based vesting
   - Performance-based
   - Multi-token support
   - Dynamic adjustments

2. Management Features
   - Schedule modification
   - Beneficiary transfer
   - Batch operations
   - Emergency pause

3. Integration
   - DAO governance
   - Staking systems
   - Reward programs
   - Token locks

4. Analytics
   - Vesting metrics
   - Release tracking
   - Holder statistics
   - Schedule analysis

## FAQ

### General Questions

**Q: What is token vesting?**

A: Token vesting is a mechanism that:
- Controls token distribution
- Ensures long-term alignment
- Prevents market flooding
- Manages token economics

**Q: Why use vesting?**

A: Benefits include:
- Team retention
- Market stability
- Investor confidence
- Controlled distribution

### Technical Questions

**Q: How to handle revocations?**

A: Revocation process:
- Check permissions
- Calculate vested amount
- Return unvested tokens
- Update state
- Emit events

**Q: What about schedule modifications?**

A: Consider:
- Immutability vs flexibility
- Beneficiary consent
- Legal requirements
- Technical limitations

### Implementation Questions

**Q: How to set parameters?**

A: Consider:
- Business requirements
- Market conditions
- Legal compliance
- Technical constraints

**Q: What about upgrades?**

A: Plan for:
- Contract migration
- State preservation
- Schedule continuity
- User communication