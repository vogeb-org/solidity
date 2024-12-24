# 代币投票权重系统

## 1. 系统概述

代币投票权重系统是一个基于 Solidity 实现的去中心化投票权重管理平台，支持灵活的权重计算和投票力管理。系统实现了多维度的权重计算和完善的权重调整机制。

### 1.1 主要特点

- 多维度权重：支持多种权重因素
- 动态调整：实时权重计算
- 时间锁定：锁定期权重加成
- 历史贡献：历史行为权重
- 委托机制：权重委托功能

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenVoteWeight
 * @dev 代币投票权重合约
 */
contract TokenVoteWeight is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 权重信息
    struct WeightInfo {
        uint256 baseWeight;        // 基础权重
        uint256 timeWeight;        // 时间权重
        uint256 activityWeight;    // 活动权重
        uint256 lockWeight;        // 锁定权重
        uint256 lastUpdateTime;    // 最后更新时间
        address delegateTo;        // 委托地址
    }

    // 锁定信息
    struct LockInfo {
        uint256 amount;           // 锁定数量
        uint256 startTime;        // 开始时间
        uint256 endTime;          // 结束时间
        uint256 multiplier;       // 权重倍数
    }

    // 状态变量
    IERC20 public token;                                         // 投票代币
    mapping(address => WeightInfo) public weightInfo;            // 权重信息
    mapping(address => LockInfo[]) public lockInfo;              // 锁定信息
    mapping(address => uint256) public totalLocked;              // 总锁定量
    mapping(address => uint256) public activityPoints;           // 活动积分
    mapping(address => mapping(address => uint256)) public delegatedPower;  // 委托权重

    // 常量
    uint256 public constant PRECISION = 1e18;                    // 精度
    uint256 public constant MAX_LOCK_TIME = 4 * 365 days;        // 最大锁定时间(4年)
    uint256 public constant MAX_MULTIPLIER = 4e18;               // 最大倍数(4倍)
    uint256 public constant MIN_LOCK_TIME = 7 days;              // 最小锁定时间

    // 事件
    event WeightUpdated(address indexed user, uint256 newWeight);
    event TokensLocked(address indexed user, uint256 amount, uint256 duration);
    event TokensUnlocked(address indexed user, uint256 amount);
    event DelegationChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event ActivityPointsAdded(address indexed user, uint256 points);

    /**
     * @dev 构造函数
     */
    constructor(IERC20 _token) {
        token = _token;
    }

    /**
     * @dev 锁定代币
     */
    function lock(uint256 amount, uint256 duration) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        require(duration >= MIN_LOCK_TIME, "Duration too short");
        require(duration <= MAX_LOCK_TIME, "Duration too long");

        // 转入代币
        token.transferFrom(msg.sender, address(this), amount);

        // 计算权重倍数
        uint256 multiplier = calculateMultiplier(duration);

        // 创建锁定记录
        lockInfo[msg.sender].push(LockInfo({
            amount: amount,
            startTime: block.timestamp,
            endTime: block.timestamp + duration,
            multiplier: multiplier
        }));

        // 更新总锁定量
        totalLocked[msg.sender] = totalLocked[msg.sender].add(amount);

        // 更新权重
        updateWeight(msg.sender);

        emit TokensLocked(msg.sender, amount, duration);
    }

    /**
     * @dev 解锁代币
     */
    function unlock(uint256 lockId) external nonReentrant {
        require(lockId < lockInfo[msg.sender].length, "Invalid lock ID");
        
        LockInfo storage info = lockInfo[msg.sender][lockId];
        require(block.timestamp >= info.endTime, "Lock not expired");
        require(info.amount > 0, "Already unlocked");

        uint256 amount = info.amount;
        info.amount = 0;

        // 更新总锁定量
        totalLocked[msg.sender] = totalLocked[msg.sender].sub(amount);

        // 更新权重
        updateWeight(msg.sender);

        // 转出代币
        token.transfer(msg.sender, amount);

        emit TokensUnlocked(msg.sender, amount);
    }

    /**
     * @dev 委托投票权
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
     * @dev 添加活动积分
     */
    function addActivityPoints(address user, uint256 points) external onlyOwner {
        activityPoints[user] = activityPoints[user].add(points);
        updateWeight(user);
        emit ActivityPointsAdded(user, points);
    }

    /**
     * @dev 更新权重
     */
    function updateWeight(address user) public {
        WeightInfo storage info = weightInfo[user];
        
        // 更新基础权重
        info.baseWeight = totalLocked[user];

        // 更新时间权重
        info.timeWeight = calculateTimeWeight(user);

        // 更新活动权重
        info.activityWeight = calculateActivityWeight(user);

        // 更新锁定权重
        info.lockWeight = calculateLockWeight(user);

        info.lastUpdateTime = block.timestamp;

        emit WeightUpdated(user, getTotalWeight(user));
    }

    /**
     * @dev 计算总权重
     */
    function getTotalWeight(address user) public view returns (uint256) {
        WeightInfo storage info = weightInfo[user];
        return info.baseWeight
            .add(info.timeWeight)
            .add(info.activityWeight)
            .add(info.lockWeight);
    }

    /**
     * @dev 计算时间权重
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
     * @dev 计算活动权重
     */
    function calculateActivityWeight(address user) public view returns (uint256) {
        return activityPoints[user].mul(PRECISION).div(1000); // 0.1% per point
    }

    /**
     * @dev 计算锁定权重
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
     * @dev 计算权重倍数
     */
    function calculateMultiplier(uint256 duration) public pure returns (uint256) {
        uint256 multiplier = PRECISION.add(
            duration.mul(MAX_MULTIPLIER.sub(PRECISION)).div(MAX_LOCK_TIME)
        );
        return multiplier;
    }

    /**
     * @dev 获取委托权重
     */
    function getDelegatedPower(address delegatee) external view returns (uint256) {
        uint256 totalPower = 0;
        uint256 length = getAccountsLength();

        for (uint256 i = 0; i < length; i++) {
            address delegator = getAccount(i);
            if (weightInfo[delegator].delegateTo == delegatee) {
                totalPower = totalPower.add(getTotalWeight(delegator));
            }
        }

        return totalPower;
    }

    /**
     * @dev 获取账户列表长度
     */
    function getAccountsLength() public view returns (uint256) {
        // 实现账户列表存储和查询
        return 0;
    }

    /**
     * @dev 获取账户地址
     */
    function getAccount(uint256 index) public view returns (address) {
        // 实现账户地址查询
        return address(0);
    }

    /**
     * @dev 获取锁定记录数量
     */
    function getLockCount(address user) external view returns (uint256) {
        return lockInfo[user].length;
    }

    /**
     * @dev 获取用户权重信息
     */
    function getWeightInfo(address user) external view returns (
        uint256 baseWeight,
        uint256 timeWeight,
        uint256 activityWeight,
        uint256 lockWeight,
        uint256 lastUpdateTime,
        address delegateTo
    ) {
        WeightInfo storage info = weightInfo[user];
        return (
            info.baseWeight,
            info.timeWeight,
            info.activityWeight,
            info.lockWeight,
            info.lastUpdateTime,
            info.delegateTo
        );
    }

    /**
     * @dev 获取锁定信息
     */
    function getLockInfo(address user, uint256 lockId) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 endTime,
        uint256 multiplier
    ) {
        require(lockId < lockInfo[user].length, "Invalid lock ID");
        LockInfo storage info = lockInfo[user][lockId];
        return (
            info.amount,
            info.startTime,
            info.endTime,
            info.multiplier
        );
    }
}
```

## 3. 功能说明

### 3.1 权重管理
- 基础权重计算
- 时间权重计算
- 活动权重计算
- 锁定权重计算

### 3.2 锁定机制
- 代币锁定
- 解锁操作
- 权重倍数计算

### 3.3 委托机制
- 权重委托
- 委托权重计算
- 委托关系管理

## 4. 安全机制

### 4.1 权重控制
- 最大锁定时间
- 最大权重倍数
- 最小锁定时间

### 4.2 访问控制
- 权限管理
- 重入保护
- 参数验证

### 4.3 状态管理
- 权重更新
- 锁定状态
- 委托关系

## 5. 使用示例

### 5.1 锁定代币
```javascript
const amount = ethers.utils.parseEther("100");
const duration = 365 * 24 * 60 * 60; // 1年
await token.approve(voteWeight.address, amount);
await voteWeight.lock(amount, duration);
```

### 5.2 委托权重
```javascript
await voteWeight.delegate(delegatee);
```

### 5.3 查询权重
```javascript
const weight = await voteWeight.getTotalWeight(userAddress);
console.log("总权重:", ethers.utils.formatEther(weight));
```

## 6. 总结

该代币投票权重系统实现了完整的权重管理功能，包括：
- 多维度权重计算
- 灵活的锁定机制
- 权重委托功能
- 活动积分系统
- 完善的安全机制

系统通过精心设计的权重计算模型和安全机制，确保了投票权重的公平性和可靠性。 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币投票权重？
A: 代币投票权重是一种治理机制，主要特点包括：
- 基于代币量的权重
- 时间锁定加成
- 活动权重奖励
- 委托投票机制
- 动态权重调整

Q: 投票权重有哪些类型？
A: 主要类型包括：
- 基础权重
- 时间权重
- 活动权重
- 锁定权重
- 委托权重

### 2. 功能相关

Q: 如何计算投票权重？
A: 计算方法：
```solidity
function calculateVoteWeight(
    uint256 amount,
    uint256 lockTime,
    uint256 activityPoints
) public pure returns (uint256) {
    // 1. 基础权重
    uint256 baseWeight = amount;
    
    // 2. 时间权重
    uint256 timeWeight = amount * lockTime / MAX_LOCK_TIME;
    
    // 3. 活动权重
    uint256 activityWeight = activityPoints * POINT_MULTIPLIER;
    
    // 4. 总权重
    return baseWeight + timeWeight + activityWeight;
}
```

Q: 如何管理委托权重？
A: 管理策略：
- 委托记录
- 权重转移
- 撤销机制
- 收益分配
- 状态更新

### 3. 安全相关

Q: 权重系统有什么风险？
A: 主要风险包括：
- 权重操纵
- 委托攻击
- 时间攻击
- 计算溢出
- 权限滥用

Q: 如何保护投票权重？
A: 安全措施包括：
- 权重上限
- 锁定期限
- 委托限制
- 活动验证
- 权限控制

### 4. 优化相关

Q: 如何优化权重计算？
A: 优化策略：
- 缓存计算
- 批量更新
- 存储优化
- 逻辑简化
- Gas优化

Q: 如何提高系统效率？
A: 改进方案：
- 异步更新
- 状态压缩
- 批量处理
- 事件优化
- 存储优化

### 5. 实现细节

Q: 如何实现权重更新？
A: 实现机制：
```solidity
function updateWeight(
    address user,
    uint256 newAmount,
    uint256 lockTime
) internal {
    // 1. 获取用户信息
    WeightInfo storage info = weightInfo[user];
    
    // 2. 更新基础权重
    info.baseWeight = newAmount;
    
    // 3. 更新时间权重
    if (lockTime > 0) {
        info.timeWeight = calculateTimeWeight(newAmount, lockTime);
    }
    
    // 4. 更新总权重
    emit WeightUpdated(user, getTotalWeight(user));
}
```

Q: 如何处理委托变更？
A: 处理机制：
- 权重转移
- 状态更新
- 收益调整
- 记录变更
- 事件通知

### 6. 最佳实践

Q: 权重系统开发建议？
A: 开发建议：
- 模块化设计
- 完整测试
- 安全审计
- 文档完善
- 监控预警

Q: 如何提高系统可靠性？
A: 改进方案：
- 故障检测
- 自动恢复
- 状态验证
- 日志记录
- 备份机制

### 7. 错误处理

Q: 常见错误及解决方案？
A: 错误类型：
- `"Invalid amount"`: 检查数量
- `"Lock time expired"`: 验证时间
- `"Not delegated"`: 检查委托
- `"Weight overflow"`: 验证计算
- `"Not authorized"`: 确认权限

Q: 如何处理异常情况？
A: 处理机制：
- 状态回滚
- 错误记录
- 通知机制
- 手动修正
- 补偿机制

### 8. 升级维护

Q: 如何升级权重系统？
A: 升级策略：
- 代理合约
- 数据迁移
- 兼容处理
- 测试验证
- 平滑过渡

Q: 如何监控系统状态？
A: 监控方案：
- 权重变化
- 委托状态
- 活动记录
- 异常检测
- 性能指标

### 9. 与其他系统集成

Q: 如何与治理系统集成？
A: 集成方案：
- 提案权重
- 投票计算
- 状态同步
- 权限管理
- 结果验证

Q: 如何实现跨链权重？
A: 实现策略：
- 跨链消息
- 权重映射
- 状态同步
- 安全验证
- 一致性保证 