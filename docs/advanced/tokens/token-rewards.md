# Token Rewards System

The token rewards system is a smart contract system for managing and distributing token rewards, supporting multiple reward strategies and distribution mechanisms. This tutorial will explain how to implement a flexible and secure token rewards system.

## Features

- Multi-token reward support
- Flexible reward strategies
- Time lock mechanism
- Batch distribution functionality
- Emergency withdrawal mechanism

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenRewards
 * @dev Token rewards contract implementation
 */
contract TokenRewards is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Reward information structure
    struct RewardInfo {
        IERC20 rewardToken;     // Reward token
        uint256 rewardPerBlock; // Reward per block
        uint256 startBlock;     // Start block
        uint256 endBlock;       // End block
        uint256 lastRewardBlock;// Last reward block
        uint256 accRewardPerShare; // Accumulated reward per share
        uint256 totalStaked;    // Total staked amount
    }

    // User information structure
    struct UserInfo {
        uint256 amount;         // User staked amount
        uint256 rewardDebt;     // Reward debt
        uint256 pendingRewards; // Pending rewards
        uint256 lastClaimBlock; // Last claim block
    }

    // Staking token
    IERC20 public stakingToken;
    
    // Reward tokens list
    RewardInfo[] public rewardTokens;
    
    // User information mapping user => rewardIndex => UserInfo
    mapping(address => mapping(uint256 => UserInfo)) public userInfo;
    
    // Whether paused
    bool public paused;
    
    // Minimum staking time
    uint256 public minStakingTime;
    
    // Events
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address indexed rewardToken, uint256 reward);
    event RewardAdded(address indexed rewardToken, uint256 rewardPerBlock, uint256 startBlock, uint256 endBlock);
    event RewardUpdated(uint256 indexed index, uint256 rewardPerBlock);
    event EmergencyWithdrawn(address indexed user, uint256 amount);

    /**
     * @dev Constructor
     */
    constructor(
        address _stakingToken,
        uint256 _minStakingTime
    ) {
        require(_stakingToken != address(0), "Invalid staking token");
        stakingToken = IERC20(_stakingToken);
        minStakingTime = _minStakingTime;
    }

    /**
     * @dev Add reward token
     */
    function addReward(
        address _rewardToken,
        uint256 _rewardPerBlock,
        uint256 _startBlock,
        uint256 _duration
    ) external onlyOwner {
        require(_rewardToken != address(0), "Invalid reward token");
        require(_duration > 0, "Invalid duration");
        require(_startBlock >= block.number, "Invalid start block");

        uint256 endBlock = _startBlock.add(_duration);
        
        rewardTokens.push(RewardInfo({
            rewardToken: IERC20(_rewardToken),
            rewardPerBlock: _rewardPerBlock,
            startBlock: _startBlock,
            endBlock: endBlock,
            lastRewardBlock: _startBlock,
            accRewardPerShare: 0,
            totalStaked: 0
        }));

        emit RewardAdded(_rewardToken, _rewardPerBlock, _startBlock, endBlock);
    }

    /**
     * @dev Update reward rate
     */
    function updateRewardPerBlock(
        uint256 _index,
        uint256 _rewardPerBlock
    ) external onlyOwner {
        require(_index < rewardTokens.length, "Invalid index");
        
        updateReward(_index);
        rewardTokens[_index].rewardPerBlock = _rewardPerBlock;
        
        emit RewardUpdated(_index, _rewardPerBlock);
    }

    /**
     * @dev Stake tokens
     */
    function stake(uint256 _amount) external nonReentrant {
        require(!paused, "Contract paused");
        require(_amount > 0, "Cannot stake 0");

        // Update all rewards
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            updateReward(i);
            UserInfo storage user = userInfo[msg.sender][i];
            if (user.amount > 0) {
                uint256 pending = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12).sub(user.rewardDebt);
                if (pending > 0) {
                    user.pendingRewards = user.pendingRewards.add(pending);
                }
            }
            user.amount = user.amount.add(_amount);
            user.rewardDebt = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12);
            rewardTokens[i].totalStaked = rewardTokens[i].totalStaked.add(_amount);
        }

        stakingToken.safeTransferFrom(msg.sender, address(this), _amount);
        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev Withdraw stake
     */
    function withdraw(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot withdraw 0");
        
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            UserInfo storage user = userInfo[msg.sender][i];
            require(user.amount >= _amount, "Withdraw amount exceeds balance");
            
            updateReward(i);
            
            uint256 pending = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0) {
                user.pendingRewards = user.pendingRewards.add(pending);
            }
            
            user.amount = user.amount.sub(_amount);
            user.rewardDebt = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12);
            rewardTokens[i].totalStaked = rewardTokens[i].totalStaked.sub(_amount);
        }

        stakingToken.safeTransfer(msg.sender, _amount);
        emit Withdrawn(msg.sender, _amount);
    }

    /**
     * @dev Claim reward
     */
    function claimReward(uint256 _index) external nonReentrant {
        require(_index < rewardTokens.length, "Invalid index");
        
        updateReward(_index);
        
        UserInfo storage user = userInfo[msg.sender][_index];
        uint256 pending = user.amount.mul(rewardTokens[_index].accRewardPerShare).div(1e12).sub(user.rewardDebt);
        if (pending > 0 || user.pendingRewards > 0) {
            uint256 totalReward = pending.add(user.pendingRewards);
            user.pendingRewards = 0;
            user.rewardDebt = user.amount.mul(rewardTokens[_index].accRewardPerShare).div(1e12);
            user.lastClaimBlock = block.number;
            
            rewardTokens[_index].rewardToken.safeTransfer(msg.sender, totalReward);
            emit RewardPaid(msg.sender, address(rewardTokens[_index].rewardToken), totalReward);
        }
    }

    /**
     * @dev Batch claim rewards
     */
    function claimAllRewards() external nonReentrant {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            updateReward(i);
            
            UserInfo storage user = userInfo[msg.sender][i];
            uint256 pending = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12).sub(user.rewardDebt);
            if (pending > 0 || user.pendingRewards > 0) {
                uint256 totalReward = pending.add(user.pendingRewards);
                user.pendingRewards = 0;
                user.rewardDebt = user.amount.mul(rewardTokens[i].accRewardPerShare).div(1e12);
                user.lastClaimBlock = block.number;
                
                rewardTokens[i].rewardToken.safeTransfer(msg.sender, totalReward);
                emit RewardPaid(msg.sender, address(rewardTokens[i].rewardToken), totalReward);
            }
        }
    }

    /**
     * @dev Emergency withdrawal
     */
    function emergencyWithdraw() external nonReentrant {
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            UserInfo storage user = userInfo[msg.sender][i];
            uint256 amount = user.amount;
            if (amount > 0) {
                user.amount = 0;
                user.rewardDebt = 0;
                user.pendingRewards = 0;
                rewardTokens[i].totalStaked = rewardTokens[i].totalStaked.sub(amount);
            }
        }
        
        if (stakingToken.balanceOf(address(this)) > 0) {
            stakingToken.safeTransfer(msg.sender, stakingToken.balanceOf(address(this)));
        }
        
        emit EmergencyWithdrawn(msg.sender, stakingToken.balanceOf(address(this)));
    }

    /**
     * @dev Update reward
     */
    function updateReward(uint256 _index) internal {
        RewardInfo storage reward = rewardTokens[_index];
        if (block.number <= reward.lastRewardBlock) {
            return;
        }

        if (reward.totalStaked == 0) {
            reward.lastRewardBlock = block.number;
            return;
        }

        uint256 endBlock = block.number > reward.endBlock ? reward.endBlock : block.number;
        uint256 blocks = endBlock.sub(reward.lastRewardBlock);
        if (blocks <= 0) {
            return;
        }

        uint256 rewards = blocks.mul(reward.rewardPerBlock);
        reward.accRewardPerShare = reward.accRewardPerShare.add(rewards.mul(1e12).div(reward.totalStaked));
        reward.lastRewardBlock = block.number;
    }

    /**
     * @dev View pending rewards
     */
    function pendingReward(
        address _user,
        uint256 _index
    ) external view returns (uint256) {
        require(_index < rewardTokens.length, "Invalid index");
        
        RewardInfo storage reward = rewardTokens[_index];
        UserInfo storage user = userInfo[_user][_index];
        
        uint256 accRewardPerShare = reward.accRewardPerShare;
        if (block.number > reward.lastRewardBlock && reward.totalStaked != 0) {
            uint256 endBlock = block.number > reward.endBlock ? reward.endBlock : block.number;
            uint256 blocks = endBlock.sub(reward.lastRewardBlock);
            uint256 rewards = blocks.mul(reward.rewardPerBlock);
            accRewardPerShare = accRewardPerShare.add(rewards.mul(1e12).div(reward.totalStaked));
        }
        
        return user.amount.mul(accRewardPerShare).div(1e12).sub(user.rewardDebt).add(user.pendingRewards);
    }

    /**
     * @dev Pause/unpause contract
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev Set minimum staking time
     */
    function setMinStakingTime(uint256 _minStakingTime) external onlyOwner {
        minStakingTime = _minStakingTime;
    }

    /**
     * @dev Recover accidentally transferred tokens
     */
    function recoverToken(
        address _token,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(stakingToken), "Cannot recover staking token");
        bool isRewardToken = false;
        for (uint256 i = 0; i < rewardTokens.length; i++) {
            if (_token == address(rewardTokens[i].rewardToken)) {
                isRewardToken = true;
                break;
            }
        }
        require(!isRewardToken, "Cannot recover reward token");
        
        IERC20(_token).safeTransfer(owner(), _amount);
    }
}
```

## Key Concepts

### Reward Mechanism

The reward system supports:
- Multi-token rewards
- Block rewards
- Accumulated rewards
- Pending rewards

### Staking Mechanism

The staking system includes:
- Token staking
- Unstaking
- Emergency withdrawal
- Minimum staking time

### Calculation Methods

Reward calculation:
- Block calculation
- Share calculation
- Accumulated calculation
- Precision handling

## Security Considerations

1. Token security
   - Transfer security
   - Balance check
   - Overflow protection
   - Reentrancy protection

2. Permission control
   - Management permissions
   - Operation restrictions
   - Pause mechanism
   - Emergency handling

3. Data validation
   - Parameter check
   - State verification
   - Address verification
   - Amount verification

4. Exception handling
   - Error recovery
   - State rollback
   - Fund recovery
   - Emergency withdrawal

## Best Practices

1. Contract design
   - Modular structure
   - Clear interfaces
   - Complete events
   - State management

2. Reward management
   - Reasonable rate
   - Regular updates
   - Precise calculation
   - Fair distribution

3. User experience
   - Convenient operation
   - State query
   - Batch processing
   - Timely feedback

4. Operation and maintenance
   - Parameter adjustment
   - State monitoring
   - Exception handling
   - Upgrade planning

## Extended Features

1. Dynamic reward rate
2. Reward multiplier
3. Locked reward period
4. Referral reward
5. Team reward

## Application Scenarios

1. Liquidity mining
   - LP token rewards
   - Transaction mining
   - Liquidity incentive
   - Market depth

2. Ecosystem incentive
   - Community construction
   - Project contribution
   - Long-term holding
   - Ecosystem development

3. Project operation
   - User growth
   - Market promotion
   - Community incentive
   - Loyalty program

## Frequently Asked Questions (FAQ)

### Basic Concepts

**Q: What is a token rewards system?**

A: A token rewards system is an incentive mechanism, characterized by:
- Multi-token reward support
- Flexible reward strategies
- Real-time reward calculation
- Automatic allocation mechanism
- Fair distribution principle

**Q: What types of reward systems are there?**

A: The main types include:
- Staking mining rewards
- Liquidity mining rewards
- Transaction mining rewards
- Ecosystem construction rewards
- Governance participation rewards

### Operation-related

**Q: How to design a reward strategy?**

A: Design considerations include:
- Determining reward tokens
- Setting reward rules
- Configuring allocation mechanisms
- Establishing time plans
- Establishing exit mechanisms

**Q: How to calculate rewards?**

A: Calculation methods include:
- Block reward calculation
- Weight ratio calculation
- Time cycle calculation
- Accumulated reward calculation
- Precision factor handling

### Security-related

**Q: What are the risks of a reward system?**

A: The main risks include:
- Inflation risk
- Token price volatility
- Unequal reward distribution
- System vulnerability risk
- Arbitrage attacks

**Q: How to ensure fair rewards?**

A: Measures include:
- Transparent rule design
- Fair allocation mechanisms
- Thorough monitoring systems
- Effective anti-cheating mechanisms
- Prompt issue response

### Performance-related

**Q: How to optimize reward distribution?**

A: Optimization methods include:
- Batch processing
- Gas optimization
- State caching
- Event optimization
- Load balancing

**Q: How to improve system efficiency?**

A: Improvement measures include:
- Code optimization
- Data structure optimization
- Storage optimization
- Calculation optimization
- Process optimization

### Implementation Details

**Q: How to implement reward calculation?**

A: Implementation approach:
```solidity
function calculateReward(address user) public view returns (uint256) {
    // 1. Get user information
    UserInfo storage userInfo = userInfos[user];
    
    // 2. Calculate time period
    uint256 timeElapsed = block.timestamp.sub(userInfo.lastUpdateTime);
    
    // 3. Calculate reward
    uint256 reward = userInfo.amount.mul(rewardRate).mul(timeElapsed).div(PRECISION);
    
    return reward;
}
```

**Q: How to handle reward distribution?**

A: Distribution mechanism:
```solidity
function distributeRewards(address[] calldata users) external {
    // 1. Verify permissions
    require(hasRole(DISTRIBUTOR_ROLE, msg.sender), "Not authorized");
    
    // 2. Batch distribution
    for (uint256 i = 0; i < users.length; i++) {
        uint256 reward = calculateReward(users[i]);
        if (reward > 0) {
            safeTransfer(users[i], reward);
            emit RewardPaid(users[i], reward);
        }
    }
}
```

### Error Handling

**Q: Common errors and solutions?**

A: Error types:
- `"Insufficient balance"`: Check token balance
- `"Invalid amount"`: Verify input parameters
- `"Not authorized"`: Check permissions
- `"System paused"`: Wait for system recovery
- `"Invalid period"`: Check time parameters

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

**Q: How to implement cross-chain rewards?**

A: Implementation approaches:
- Bridge protocols
- Message passing
- State verification
- Asset mapping
- Security measures

### System Architecture

1. Core Components
   - Reward module
   - Staking module
   - Distribution module
   - Security module
   - Management module

2. Process Flow
   - User staking
   - Reward calculation
   - Distribution processing
   - Status update
   - Event emission

3. Data Structure
   - User information
   - Reward records
   - Staking status
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
   - Configure rewards
   - Implement security
   - Enable monitoring

2. Operation Flow
   - Request validation
   - State updates
   - Reward calculation
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

1. Initialize System
```javascript
const rewardToken = "0x...";
const rewardRate = 100;
const minStakeTime = 86400; // 1 day
await rewardSystem.initialize(rewardToken, rewardRate, minStakeTime);
```

2. Stake Tokens
```javascript
const amount = ethers.utils.parseEther("100");
await stakingToken.approve(rewardSystem.address, amount);
await rewardSystem.stake(amount);
```

3. Claim Rewards
```javascript
await rewardSystem.claimRewards();
```

4. Emergency Withdrawal
```javascript
await rewardSystem.emergencyWithdraw();
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
   - Dynamic rewards
   - Multi-level rewards
   - Reward boosting
   - Team rewards
   - Referral rewards

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
 