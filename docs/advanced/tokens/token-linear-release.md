# Token Linear Release System

The token linear release system is used to implement smooth and continuous token release, typically used in scenarios such as team incentives and investor allocations. This tutorial will explain how to implement a secure linear release system.

## Features

- Linear release mechanism
- Flexible release parameters
- Multi-beneficiary support
- Release pause functionality
- Emergency withdrawal mechanism

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title LinearTokenRelease
 * @dev Token linear release contract implementation
 */
contract LinearTokenRelease is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Release plan structure
    struct ReleasePlan {
        address token;           // Token address
        address beneficiary;     // Beneficiary address
        uint256 totalAmount;     // Total release amount
        uint256 releasedAmount; // Released amount
        uint256 startTime;       // Start time
        uint256 duration;        // Release period
        uint256 cliffDuration;   // Lock period
        bool revocable;          // Whether revocable
        bool revoked;            // Whether revoked
        bool paused;             // Whether paused
    }

    // Release plan mapping
    mapping(bytes32 => ReleasePlan) public plans;
    // User plan mapping
    mapping(address => bytes32[]) public userPlans;

    // Events
    event PlanCreated(bytes32 indexed planId, address indexed token, address indexed beneficiary);
    event TokensReleased(bytes32 indexed planId, uint256 amount);
    event PlanRevoked(bytes32 indexed planId);
    event PlanPaused(bytes32 indexed planId);
    event PlanUnpaused(bytes32 indexed planId);
    event BeneficiaryUpdated(bytes32 indexed planId, address indexed oldBeneficiary, address indexed newBeneficiary);

    /**
     * @dev Create release plan
     */
    function createPlan(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _duration,
        uint256 _cliffDuration,
        bool _revocable
    ) external returns (bytes32) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_totalAmount > 0, "Invalid amount");
        require(_duration > 0, "Invalid duration");
        require(_startTime >= block.timestamp, "Start time must be future");
        require(_cliffDuration <= _duration, "Cliff longer than duration");

        // Generate plan ID
        bytes32 planId = keccak256(
            abi.encodePacked(
                _token,
                _beneficiary,
                _totalAmount,
                _startTime,
                block.timestamp
            )
        );

        // Transfer tokens
        IERC20(_token).transferFrom(msg.sender, address(this), _totalAmount);

        // Create release plan
        plans[planId] = ReleasePlan({
            token: _token,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            releasedAmount: 0,
            startTime: _startTime,
            duration: _duration,
            cliffDuration: _cliffDuration,
            revocable: _revocable,
            revoked: false,
            paused: false
        });

        userPlans[_beneficiary].push(planId);
        
        emit PlanCreated(planId, _token, _beneficiary);
        
        return planId;
    }

    /**
     * @dev Release tokens
     */
    function release(bytes32 _planId) external nonReentrant {
        ReleasePlan storage plan = plans[_planId];
        require(!plan.revoked, "Plan revoked");
        require(!plan.paused, "Plan paused");
        require(
            msg.sender == plan.beneficiary,
            "Only beneficiary can release"
        );
        
        uint256 releasableAmount = getReleasableAmount(_planId);
        require(releasableAmount > 0, "No tokens to release");

        plan.releasedAmount = plan.releasedAmount.add(releasableAmount);
        
        IERC20(plan.token).transfer(plan.beneficiary, releasableAmount);
        
        emit TokensReleased(_planId, releasableAmount);
    }

    /**
     * @dev Calculate releasable amount
     */
    function getReleasableAmount(bytes32 _planId) public view returns (uint256) {
        ReleasePlan storage plan = plans[_planId];
        
        if (plan.revoked || plan.paused || 
            block.timestamp < plan.startTime.add(plan.cliffDuration)) {
            return 0;
        }

        if (block.timestamp >= plan.startTime.add(plan.duration)) {
            return plan.totalAmount.sub(plan.releasedAmount);
        }

        uint256 timeFromStart = block.timestamp.sub(plan.startTime);
        uint256 vestedAmount = plan.totalAmount.mul(timeFromStart).div(plan.duration);
        
        return vestedAmount.sub(plan.releasedAmount);
    }

    /**
     * @dev Revoke plan (admin only)
     */
    function revoke(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(plan.revocable, "Plan not revocable");
        require(!plan.revoked, "Plan already revoked");

        plan.revoked = true;
        
        uint256 remainingAmount = plan.totalAmount.sub(plan.releasedAmount);
        if (remainingAmount > 0) {
            IERC20(plan.token).transfer(owner(), remainingAmount);
        }
        
        emit PlanRevoked(_planId);
    }

    /**
     * @dev Pause plan (admin only)
     */
    function pausePlan(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(!plan.paused, "Plan already paused");
        
        plan.paused = true;
        emit PlanPaused(_planId);
    }

    /**
     * @dev Unpause plan (admin only)
     */
    function unpausePlan(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(plan.paused, "Plan not paused");
        
        plan.paused = false;
        emit PlanUnpaused(_planId);
    }

    /**
     * @dev Update beneficiary
     */
    function updateBeneficiary(bytes32 _planId, address _newBeneficiary) external {
        require(_newBeneficiary != address(0), "Invalid beneficiary address");
        ReleasePlan storage plan = plans[_planId];
        require(
            msg.sender == plan.beneficiary,
            "Only current beneficiary can update"
        );

        address oldBeneficiary = plan.beneficiary;
        plan.beneficiary = _newBeneficiary;

        // Update user plan mapping
        bytes32[] storage oldUserPlanIds = userPlans[oldBeneficiary];
        for (uint256 i = 0; i < oldUserPlanIds.length; i++) {
            if (oldUserPlanIds[i] == _planId) {
                oldUserPlanIds[i] = oldUserPlanIds[oldUserPlanIds.length - 1];
                oldUserPlanIds.pop();
                break;
            }
        }
        userPlans[_newBeneficiary].push(_planId);

        emit BeneficiaryUpdated(_planId, oldBeneficiary, _newBeneficiary);
    }

    /**
     * @dev Get all plans for a user
     */
    function getUserPlans(address _user) external view returns (bytes32[] memory) {
        return userPlans[_user];
    }

    /**
     * @dev Get plan details
     */
    function getPlanInfo(bytes32 _planId)
        external
        view
        returns (
            address token,
            address beneficiary,
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startTime,
            uint256 duration,
            uint256 cliffDuration,
            bool revocable,
            bool revoked,
            bool paused
        )
    {
        ReleasePlan storage plan = plans[_planId];
        return (
            plan.token,
            plan.beneficiary,
            plan.totalAmount,
            plan.releasedAmount,
            plan.startTime,
            plan.duration,
            plan.cliffDuration,
            plan.revocable,
            plan.revoked,
            plan.paused
        );
    }
}
```

## Key Concepts

### Release Mechanism

Linear release supports:
- Continuous release
- Lock period setting
- Release rate
- Pause functionality

### Calculation Methods

Release calculation includes:
- Time calculation
- Proportion calculation
- Lock verification
- Balance check

### Permission Control

Permission management:
- Beneficiary permission
- Admin permission
- Pause permission
- Revoke permission

## Security Considerations

1. Time control
   - Start time verification
   - Lock period check
   - Duration verification
   - Pause mechanism

2. Amount verification
   - Balance check
   - Release calculation
   - Minimum amount
   - Precision handling

3. Permission management
   - Role verification
   - Operation restriction
   - State protection
   - Event recording

4. Emergency handling
   - Pause mechanism
   - Revoke function
   - Balance return
   - State recovery

## Best Practices

1. Release design
   - Reasonable release cycle
   - Appropriate lock period
   - Flexible parameter setting
   - Comprehensive pause mechanism

2. Data management
   - State tracking
   - Plan management
   - User mapping
   - Event recording

3. User experience
   - Simple operation process
   - Clear state display
   - Timely feedback mechanism
   - Complete query function

4. Exception handling
   - Input verification
   - State check
   - Error prompt
   - Rollback mechanism

## Extended Features

1. Multi-token support
2. Dynamic release rate
3. Segmented release
4. Conditional trigger
5. Voting right management

## Application Scenarios

1. Team incentives
   - Employee options
   - Consultant rewards
   - Contribution incentives
   - Long-term binding

2. Investment unlocking
   - Private placement allocation
   - Institutional investment
   - Strategic cooperation
   - Risk control

3. Project development
   - Ecological construction
   - Community incentives
   - Market marketing
   - Liquidity management

## Summary

The token linear release system is an important tool for token distribution. Through this tutorial, you can:
- Implement smooth token release
- Protect the rights of all parties
- Flexibly control release
- Ensure system security 

## Frequently Asked Questions (FAQ)

### Basic Concepts

**Q: What is linear release?**

A: Linear release is a token distribution mechanism, with the main features including:
- Uniform release
- Time control
- Release rate
- Lock period
- Release plan

**Q: What types of linear release are there?**

A: The main types include:
- Fixed rate release
- Adjustable rate release
- Segmented linear release
- Mixed release
- Conditional release

### Operation Related

**Q: How to design release strategies?**

A: Design points include:
- Determine the total amount
- Set the cycle
- Configure the rate
- Add conditions
- Set checkpoints

**Q: How to manage release processes?**

A: Management methods include:
- Monitor progress
- Adjust parameters
- Handle exceptions
- Verify conditions
- Execute release

### Security Related

**Q: What are the risks of linear release?**

A: The main risks include:
- Incorrect parameter setting
- Calculation precision issues
- Time control failure
- Contract vulnerabilities
- Operational errors

**Q: How to ensure release security?**

A: Security measures include:
- Multiple verification
- Parameter check
- State monitoring
- Emergency pause
- Complete logging
```

## Implementation Details

### Release Mechanism

The linear release mechanism includes:
1. Time-based release
   - Start time
   - Lock period
   - Release period
   - Release rate

2. Amount calculation
   - Total amount
   - Released amount
   - Releasable amount
   - Remaining amount

3. State management
   - Plan creation
   - Release execution
   - Plan revocation
   - Plan pause/unpause

### Security Features

1. Access control
   - Owner permissions
   - Beneficiary permissions
   - Function restrictions
   - State validations

2. Fund security
   - Safe transfer
   - Balance verification
   - Reentrancy protection
   - Emergency handling

3. Parameter validation
   - Address validation
   - Amount validation
   - Time validation
   - State validation

## Usage Guide

### Creating a Release Plan

To create a linear release plan:

1. Prepare parameters:
   - Token address
   - Beneficiary address
   - Total amount
   - Start time
   - Duration
   - Cliff duration
   - Revocable flag

2. Approve token transfer:
```solidity
IERC20(tokenAddress).approve(releaseContractAddress, amount);
```

3. Create plan:
```solidity
bytes32 planId = linearRelease.createPlan(
    tokenAddress,
    beneficiary,
    amount,
    startTime,
    duration,
    cliffDuration,
    revocable
);
```

### Managing Release Plans

1. Release tokens:
```solidity
linearRelease.release(planId);
```

2. Pause plan (admin only):
```solidity
linearRelease.pausePlan(planId);
```

3. Unpause plan (admin only):
```solidity
linearRelease.unpausePlan(planId);
```

4. Revoke plan (admin only):
```solidity
linearRelease.revoke(planId);
```

### Querying Plan Information

1. Get plan details:
```solidity
linearRelease.getPlanInfo(planId);
```

2. Get user plans:
```solidity
linearRelease.getUserPlans(userAddress);
```

3. Get releasable amount:
```solidity
uint256 amount = linearRelease.getReleasableAmount(planId);
```

## Integration Examples

### Basic Integration

```solidity
// Deploy contract
LinearTokenRelease release = new LinearTokenRelease();

// Create plan
bytes32 planId = release.createPlan(
    tokenAddress,
    beneficiary,
    1000000 * 10**18, // 1 million tokens
    block.timestamp + 1 days, // starts tomorrow
    365 days, // 1 year duration
    30 days, // 1 month cliff
    true // revocable
);

// Release tokens
release.release(planId);
```

### Advanced Integration

```solidity
// Custom release contract
contract CustomRelease is LinearTokenRelease {
    // Add custom logic
    function customRelease(bytes32 planId) external {
        // Custom validation
        require(condition, "Custom condition failed");
        
        // Release tokens
        release(planId);
        
        // Post-release actions
        emit CustomEvent(planId);
    }
}
```

## Testing Guide

### Test Cases

1. Basic functionality:
```solidity
function testCreatePlan() public {
    // Test plan creation
}

function testRelease() public {
    // Test token release
}
```

2. Security features:
```solidity
function testAccessControl() public {
    // Test permissions
}

function testEmergencyHandling() public {
    // Test emergency functions
}
```

### Test Environment

1. Setup:
```solidity
// Deploy test token
TestToken token = new TestToken();

// Deploy release contract
LinearTokenRelease release = new LinearTokenRelease();

// Setup test data
token.mint(address(this), 1000000);
token.approve(address(release), 1000000);
```

2. Execution:
```solidity
// Create test plan
bytes32 planId = release.createPlan(...);

// Advance time
vm.warp(block.timestamp + 30 days);

// Test release
release.release(planId);
```

## Troubleshooting

### Common Issues

1. Transaction failures
   - Insufficient balance
   - Insufficient allowance
   - Invalid state
   - Permission denied

2. Calculation issues
   - Rounding errors
   - Time calculation
   - Amount precision
   - State inconsistency

### Solutions

1. Balance issues:
   - Check token balance
   - Verify allowance
   - Confirm decimals
   - Review calculations

2. Permission issues:
   - Verify caller
   - Check role
   - Review permissions
   - Check state

3. Time issues:
   - Verify timestamps
   - Check durations
   - Review periods
   - Validate states