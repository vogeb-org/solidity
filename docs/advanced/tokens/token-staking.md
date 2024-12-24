# Token Staking System

## 1. System Overview

The token staking system is a decentralized staking reward platform implemented in Solidity that allows users to earn reward tokens by staking specific tokens. The system implements fair reward distribution mechanisms and flexible staking management features.

### 1.1 Key Features

- Flexible Staking: Support staking of any amount of tokens
- Real-time Rewards: Block-based reward calculation
- Fair Distribution: Rewards distributed proportionally to stakes
- Instant Withdrawal: Support unstaking at any time
- Reward Accumulation: Automatic accumulation of unclaimed rewards
- Precise Calculation: High-precision calculations to avoid errors

## 2. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenStaking
 * @dev Token staking mining contract
 */
contract TokenStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // State variables
    IERC20 public stakeToken;           // Staking token
    IERC20 public rewardToken;          // Reward token
    uint256 public rewardPerBlock;       // Reward per block
    uint256 public lastRewardBlock;      // Last reward block
    uint256 public accRewardPerShare;    // Accumulated reward per share
    uint256 public totalStaked;          // Total staked amount
    uint256 public constant PRECISION = 1e12;  // Precision factor

    // Staking information
    struct StakeInfo {
        uint256 amount;         // Staked amount
        uint256 startTime;      // Start time
        uint256 rewardDebt;     // Reward debt
        uint256 pendingRewards; // Pending rewards
        uint256 lastClaimTime;  // Last claim time
    }

    // User staking information
    mapping(address => StakeInfo) public stakeInfos;

    // Events
    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event ClaimReward(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);

    /**
     * @dev Constructor
     */
    constructor(
        IERC20 _stakeToken,
        IERC20 _rewardToken,
        uint256 _rewardPerBlock
    ) {
        stakeToken = _stakeToken;
        rewardToken = _rewardToken;
        rewardPerBlock = _rewardPerBlock;
        lastRewardBlock = block.number;
    }

    /**
     * @dev Stake tokens
     */
    function stake(uint256 _amount) external nonReentrant {
        require(_amount > 0, "Cannot stake 0");
        
        updatePool();
        StakeInfo storage info = stakeInfos[msg.sender];
        
        if (info.amount > 0) {
            uint256 pending = info.amount.mul(accRewardPerShare).div(PRECISION).sub(info.rewardDebt);
            info.pendingRewards = info.pendingRewards.add(pending);
        }
        
        stakeToken.transferFrom(msg.sender, address(this), _amount);
        info.amount = info.amount.add(_amount);
        info.startTime = block.timestamp;
        info.rewardDebt = info.amount.mul(accRewardPerShare).div(PRECISION);
        totalStaked = totalStaked.add(_amount);
        
        emit Stake(msg.sender, _amount);
    }

    /**
     * @dev Unstake tokens
     */
    function unstake(uint256 _amount) external nonReentrant {
        StakeInfo storage info = stakeInfos[msg.sender];
        require(info.amount >= _amount, "Insufficient stake");
        
        updatePool();
        uint256 pending = info.amount.mul(accRewardPerShare).div(PRECISION).sub(info.rewardDebt);
        info.pendingRewards = info.pendingRewards.add(pending);
        
        info.amount = info.amount.sub(_amount);
        info.rewardDebt = info.amount.mul(accRewardPerShare).div(PRECISION);
        totalStaked = totalStaked.sub(_amount);
        
        stakeToken.transfer(msg.sender, _amount);
        emit Unstake(msg.sender, _amount);
    }

    /**
     * @dev Claim rewards
     */
    function claimReward() external nonReentrant {
        updatePool();
        StakeInfo storage info = stakeInfos[msg.sender];
        
        uint256 pending = info.amount.mul(accRewardPerShare).div(PRECISION).sub(info.rewardDebt);
        uint256 totalReward = info.pendingRewards.add(pending);
        require(totalReward > 0, "No reward to claim");
        
        info.pendingRewards = 0;
        info.rewardDebt = info.amount.mul(accRewardPerShare).div(PRECISION);
        info.lastClaimTime = block.timestamp;
        
        rewardToken.transfer(msg.sender, totalReward);
        emit ClaimReward(msg.sender, totalReward);
    }

    /**
     * @dev Update reward pool
     */
    function updatePool() public {
        if (block.number <= lastRewardBlock) {
            return;
        }

        if (totalStaked == 0) {
            lastRewardBlock = block.number;
            return;
        }

        uint256 blocksSinceLastReward = block.number.sub(lastRewardBlock);
        uint256 rewards = blocksSinceLastReward.mul(rewardPerBlock);
        accRewardPerShare = accRewardPerShare.add(rewards.mul(PRECISION).div(totalStaked));
        lastRewardBlock = block.number;
    }

    /**
     * @dev Query pending rewards
     */
    function pendingReward(address _user) external view returns (uint256) {
        StakeInfo storage info = stakeInfos[_user];
        uint256 _accRewardPerShare = accRewardPerShare;
        
        if (block.number > lastRewardBlock && totalStaked > 0) {
            uint256 blocksSinceLastReward = block.number.sub(lastRewardBlock);
            uint256 rewards = blocksSinceLastReward.mul(rewardPerBlock);
            _accRewardPerShare = _accRewardPerShare.add(rewards.mul(PRECISION).div(totalStaked));
        }
        
        uint256 pending = info.amount.mul(_accRewardPerShare).div(PRECISION).sub(info.rewardDebt);
        return info.pendingRewards.add(pending);
    }

    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw() external nonReentrant {
        StakeInfo storage info = stakeInfos[msg.sender];
        require(info.amount > 0, "No stake to withdraw");
        
        uint256 amount = info.amount;
        info.amount = 0;
        info.rewardDebt = 0;
        info.pendingRewards = 0;
        totalStaked = totalStaked.sub(amount);
        
        stakeToken.transfer(msg.sender, amount);
        emit EmergencyWithdraw(msg.sender, amount);
    }

    /**
     * @dev Update reward per block
     */
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        updatePool();
        rewardPerBlock = _rewardPerBlock;
        emit RewardRateUpdated(_rewardPerBlock);
    }

    /**
     * @dev Get user staking information
     */
    function getStakeInfo(address _user) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 pendingRewards,
        uint256 lastClaimTime
    ) {
        StakeInfo storage info = stakeInfos[_user];
        return (
            info.amount,
            info.startTime,
            info.pendingRewards,
            info.lastClaimTime
        );
    }

    /**
     * @dev Get staking statistics
     */
    function getStakeStats() external view returns (
        uint256 totalStakedAmount,
        uint256 rewardRate,
        uint256 lastRewardTime,
        uint256 accumulatedRewards
    ) {
        return (
            totalStaked,
            rewardPerBlock,
            lastRewardBlock,
            accRewardPerShare
        );
    }

    /**
     * @dev Batch get user staking information
     */
    function batchGetStakeInfo(address[] calldata _users) external view returns (
        uint256[] memory amounts,
        uint256[] memory startTimes,
        uint256[] memory pendingRewards,
        uint256[] memory lastClaimTimes
    ) {
        amounts = new uint256[](_users.length);
        startTimes = new uint256[](_users.length);
        pendingRewards = new uint256[](_users.length);
        lastClaimTimes = new uint256[](_users.length);

        for (uint256 i = 0; i < _users.length; i++) {
            StakeInfo storage info = stakeInfos[_users[i]];
            amounts[i] = info.amount;
            startTimes[i] = info.startTime;
            pendingRewards[i] = info.pendingRewards;
            lastClaimTimes[i] = info.lastClaimTime;
        }
    }
}
```

## 3. Key Concepts

### 3.1 Reward Calculation

The reward calculation is based on:
- Block-based rewards
- User's stake proportion
- Accumulated rewards per share
- Precision factor to avoid rounding errors

### 3.2 Staking Mechanism

The staking process includes:
- Token deposit
- Reward debt calculation
- Total stake update
- Event emission

### 3.3 Reward Distribution

Rewards are distributed through:
- Automatic accumulation
- Per-block calculation
- Proportional allocation
- Claim mechanism

## 4. Security Features

1. Reentrancy Protection
   - ReentrancyGuard implementation
   - State updates before transfers
   - Secure withdrawal pattern

2. Access Control
   - Owner-only functions
   - Role-based permissions
   - Emergency functions

3. Mathematical Safety
   - SafeMath library usage
   - Precision handling
   - Overflow protection

## 5. Best Practices

1. Contract Management
   - Upgradeable design
   - Parameter configuration
   - Emergency procedures

2. Gas Optimization
   - Efficient storage
   - Batch operations
   - View function usage

3. User Experience
   - Clear error messages
   - Event logging
   - Information queries

## 6. Testing Guide

1. Unit Tests
   - Staking functionality
   - Reward calculation
   - Access control
   - Emergency scenarios

2. Integration Tests
   - Token interactions
   - State transitions
   - Edge cases
   - Gas optimization

## 7. Deployment Steps

1. Preparation
   - Token contracts
   - Initial parameters
   - Access controls

2. Deployment
   - Contract deployment
   - Parameter setting
   - Initial setup

3. Verification
   - Contract verification
   - Parameter validation
   - Security checks

## 8. FAQ

### General Questions

**Q: What is token staking?**

A: Token staking is a mechanism where users lock their tokens in a smart contract to earn rewards, typically used for:
- Earning passive income
- Participating in governance
- Supporting network security
- Accessing platform features

**Q: How are rewards calculated?**

A: Rewards are calculated based on:
- Staking duration
- Stake amount
- Reward rate
- Total staked amount

### Technical Questions

**Q: How to handle precision?**

A: Precision is handled through:
- Precision factor (1e12)
- SafeMath operations
- Proper rounding
- Accumulated calculations

**Q: What about emergency situations?**

A: Emergency handling includes:
- Emergency withdrawal
- Rate adjustment
- Contract pause
- Owner controls

### Security Questions

**Q: How to ensure fund safety?**

A: Fund safety is ensured through:
- Reentrancy guards
- Access controls
- Secure math
- Emergency functions

**Q: What are the main risks?**

A: Main risks include:
- Smart contract vulnerabilities
- Parameter manipulation
- Economic attacks
- System failures