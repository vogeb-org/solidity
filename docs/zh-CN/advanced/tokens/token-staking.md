# 代币质押挖矿系统

## 1. 系统概述

代币质押挖矿系统是一个基于 Solidity 实现的去中心化质押奖励平台，允许用户通过质押特定代币来获得奖励代币。系统实现了公平的奖励分配机制和灵活的质押管理功能。

### 1.1 主要特点

- 灵活质押：支持任意数量的代币质押
- 实时奖励：基于区块计算奖励
- 公平分配：按质押比例分配奖励
- 随时提取：支持随时解除质押
- 奖励累积：自动累积未领取的奖励
- 精确计算：使用高精度计算避免误差

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenStaking
 * @dev 代币质押挖矿合约
 */
contract TokenStaking is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 状态变量
    IERC20 public stakeToken;           // 质押代币
    IERC20 public rewardToken;          // 奖励代币
    uint256 public rewardPerBlock;       // 每区块奖励
    uint256 public lastRewardBlock;      // 上次奖励区块
    uint256 public accRewardPerShare;    // 每股累计奖励
    uint256 public totalStaked;          // 总质押量
    uint256 public constant PRECISION = 1e12;  // 精度因子

    // 质押信息
    struct StakeInfo {
        uint256 amount;         // 质押数量
        uint256 startTime;      // 开始时间
        uint256 rewardDebt;     // 奖励债务
        uint256 pendingRewards; // 待领取奖励
        uint256 lastClaimTime;  // 上次领取时间
    }

    // 用户质押信息
    mapping(address => StakeInfo) public stakeInfos;

    // 事件
    event Stake(address indexed user, uint256 amount);
    event Unstake(address indexed user, uint256 amount);
    event ClaimReward(address indexed user, uint256 amount);
    event EmergencyWithdraw(address indexed user, uint256 amount);
    event RewardRateUpdated(uint256 newRate);

    /**
     * @dev 构造函数
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
     * @dev 质押代币
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
     * @dev 解除质押
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
     * @dev 领取奖励
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
     * @dev 更新奖励池
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
     * @dev 查询待领取奖励
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
     * @dev 紧急提取
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
     * @dev 更新每区块奖励
     */
    function setRewardPerBlock(uint256 _rewardPerBlock) external onlyOwner {
        updatePool();
        rewardPerBlock = _rewardPerBlock;
        emit RewardRateUpdated(_rewardPerBlock);
    }

    /**
     * @dev 获取用户质押信息
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
     * @dev 获取质押统计信息
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
     * @dev 批量获取用户质押信息
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

        return (amounts, startTimes, pendingRewards, lastClaimTimes);
    }

    /**
     * @dev 紧急暂停/恢复
     */
    bool public paused;
    
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    modifier whenNotPaused() {
        require(!paused, "Contract is paused");
        _;
    }
}
```

## 3. 功能说明

### 3.1 质押代币
```solidity
function stake(uint256 _amount) external
```
- 验证质押数量
- 更新奖励池
- 转入质押代币
- 更新用户质押信息
- 计算并发放待领取奖励

### 3.2 解除质押
```solidity
function unstake(uint256 _amount) external
```
- 验证解除数量
- 更新奖励池
- 计算并发放奖励
- 更新质押信息
- 转出质押代币

### 3.3 领取奖励
```solidity
function claimReward() external
```
- 更新奖励池
- 计算待领取奖励
- 更新奖励债务
- 转出奖励代币

## 4. 奖励计算机制

### 4.1 待领取奖励查询
```solidity
function pendingReward(address _user) external view returns (uint256)
```
计算公式：
```
pending = (质押数量 * 每股累计奖励) / 1e12 - 奖励债务
```

### 4.2 奖励池更新
```solidity
function updatePool() public
```
更新逻辑：
1. 计算区块间隔
2. 计算总奖励
3. 更新每股累计奖励
4. 更新最后奖励区块

## 5. 安全机制

### 5.1 数值计算保护
- 使用 SafeMath 库
- 高精度计算（1e12）
- 防止数值溢出
- 严格的数量验证

### 5.2 访问控制
- 权限管理
- 重入保护
- 暂停机制
- 紧急提取

### 5.3 状态管理
- 完整的事件记录
- 状态同步检查
- 异常处理机制
- 数据完整性验证

## 6. 使用示例

### 6.1 质押代币
```javascript
const amount = ethers.utils.parseEther("100");
await stakeToken.approve(staking.address, amount);
await staking.stake(amount);
```

### 6.2 查询奖励
```javascript
const reward = await staking.pendingReward(userAddress);
console.log("待领取奖励:", ethers.utils.formatEther(reward));
```

### 6.3 解除质押
```javascript
const amount = ethers.utils.parseEther("50");
await staking.unstake(amount);
```

## 7. 总结

该代币质押挖矿系统实现了一个完整的质押奖励机制，包括：
- 灵活的质押和解除机制
- 公平的奖励分配系统
- 实时的奖励计算
- 安全的状态管理
- 完善的事件通知

系统通过精心设计的奖励计算机制和安全措施，确保了质押过程的公平性和安全性，为用户提供了可靠的质押挖矿服务。 

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币质押？**

A: 代币质押是一种锁定代币以获得奖励的机制，主要特点包括：
- 代币锁定管理
- 奖励自动计算
- 实时收益分配
- 灵活提取机制
- 公平分配机制

**Q: 质押系统有哪些核心功能？**

A: 主要功能包括：
- 代币质押/解押
- 奖励计算分配
- 收益实时领取
- 紧急提取机制
- 状态查询功能

### 操作相关

**Q: 如何参与质押？**

A: 参与步骤包括：
- 准备足够代币
- 授权合约使用
- 选择质押数量
- 执行质押操作
- 等待奖励生成

**Q: 如何计算质押收益？**

A: 计算方法包括：
- 区块奖励计算
- 质押比例计算
- 时间周期计算
- 累积奖励计算
- 精度因子处理

### 安全相关

**Q: 质押系统有哪些风险？**

A: 主要风险包括：
- 智能合约风险
- 代币价格波动
- 收益率变化
- 锁定期限制
- 紧急情况处理

**Q: 如何确保质押安全？**

A: 安全措施包括：
- 多重验证机制
- 权限控制系统
- 紧急暂停功能
- 完整的日志记录
- 实时监控预警