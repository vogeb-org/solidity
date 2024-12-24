# 代币分红系统

## 1. 系统概述

代币分红系统是一个基于 Solidity 实现的多代币分红平台，支持用户通过质押单一代币来获得多种代币的分红收益。系统实现了灵活的多代币分红机制和动态的收益分配功能。

### 1.1 主要特点

- 多代币分红：支持多种代币作为分红奖励
- 单一质押：使用单一代币进行质押
- 动态分配：实时计算和更新收益
- 批量领取：支持一键领取所有代币奖励
- 灵活管理：支持添加新的分红代币
- 精确计算：高精度的收益计算机制

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenDividend
 * @dev 代币分红合约
 */
contract TokenDividend is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 分红代币信息
    struct RewardToken {
        IERC20 token;             // 代币合约
        uint256 totalRewards;     // 总奖励
        uint256 rewardsPerShare;  // 每股奖励
        uint256 lastUpdateTime;   // 最后更新时间
        bool isActive;            // 是否激活
    }

    // 用户分红信息
    struct UserInfo {
        uint256 amount;           // 质押数量
        mapping(uint256 => uint256) rewardDebt;  // 每个代币的奖励债务
        uint256 lastClaimTime;    // 上次领取时间
    }

    // 状态变量
    IERC20 public stakeToken;                    // 质押代币
    uint256 public totalStaked;                  // 总质押量
    uint256 public rewardTokenCount;             // 奖励代币数量
    uint256 public minStakeAmount;               // 最小质押数量
    uint256 public minClaimInterval;             // 最小领取间隔
    bool public paused;                          // 暂停状态

    mapping(uint256 => RewardToken) public rewardTokens;      // 奖励代币列表
    mapping(address => UserInfo) public userInfo;             // 用户信息

    // 事件
    event RewardTokenAdded(uint256 indexed tokenId, address token);
    event RewardTokenUpdated(uint256 indexed tokenId, bool isActive);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardDistributed(uint256 indexed tokenId, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);

    /**
     * @dev 构造函数
     */
    constructor(
        IERC20 _stakeToken,
        uint256 _minStakeAmount,
        uint256 _minClaimInterval
    ) {
        require(address(_stakeToken) != address(0), "Invalid stake token");
        stakeToken = _stakeToken;
        minStakeAmount = _minStakeAmount;
        minClaimInterval = _minClaimInterval;
    }

    /**
     * @dev 添加奖励代币
     */
    function addRewardToken(IERC20 _token) external onlyOwner {
        require(address(_token) != address(0), "Invalid token");
        
        rewardTokens[rewardTokenCount] = RewardToken({
            token: _token,
            totalRewards: 0,
            rewardsPerShare: 0,
            lastUpdateTime: block.timestamp,
            isActive: true
        });

        emit RewardTokenAdded(rewardTokenCount, address(_token));
        rewardTokenCount = rewardTokenCount.add(1);
    }

    /**
     * @dev 质押代币
     */
    function stake(uint256 _amount) external nonReentrant {
        require(!paused, "System paused");
        require(_amount >= minStakeAmount, "Amount too small");

        UserInfo storage user = userInfo[msg.sender];

        // 如果已有质押，先领取现有奖励
        if (user.amount > 0) {
            claimAllRewards();
        }

        // 转入质押代币
        stakeToken.transferFrom(msg.sender, address(this), _amount);
        
        // 更新用户信息
        user.amount = user.amount.add(_amount);
        totalStaked = totalStaked.add(_amount);

        // 更新奖励债务
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            if (rewardTokens[i].isActive) {
                user.rewardDebt[i] = user.amount.mul(rewardTokens[i].rewardsPerShare).div(1e12);
            }
        }

        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev 解除质押
     */
    function unstake(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient stake");

        // 先领取所有奖励
        claimAllRewards();

        // 更新用户信息
        user.amount = user.amount.sub(_amount);
        totalStaked = totalStaked.sub(_amount);

        // 更新奖励债务
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            if (rewardTokens[i].isActive) {
                user.rewardDebt[i] = user.amount.mul(rewardTokens[i].rewardsPerShare).div(1e12);
            }
        }

        // 转出质押代币
        stakeToken.transfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @dev 分发奖励
     */
    function distributeReward(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        require(_amount > 0, "Amount must be greater than 0");

        RewardToken storage rToken = rewardTokens[_tokenId];
        require(rToken.isActive, "Token not active");

        // 转入奖励代币
        rToken.token.transferFrom(msg.sender, address(this), _amount);

        // 更新奖励信息
        rToken.totalRewards = rToken.totalRewards.add(_amount);
        if (totalStaked > 0) {
            rToken.rewardsPerShare = rToken.rewardsPerShare.add(_amount.mul(1e12).div(totalStaked));
        }
        rToken.lastUpdateTime = block.timestamp;

        emit RewardDistributed(_tokenId, _amount);
    }

    /**
     * @dev 领取所有奖励
     */
    function claimAllRewards() public nonReentrant {
        require(!paused, "System paused");
        UserInfo storage user = userInfo[msg.sender];
        require(
            block.timestamp >= user.lastClaimTime.add(minClaimInterval),
            "Too frequent"
        );

        for (uint256 i = 0; i < rewardTokenCount; i++) {
            if (rewardTokens[i].isActive) {
                uint256 pending = pendingReward(i, msg.sender);
                if (pending > 0) {
                    user.rewardDebt[i] = user.amount.mul(rewardTokens[i].rewardsPerShare).div(1e12);
                    rewardTokens[i].token.transfer(msg.sender, pending);
                    emit RewardClaimed(msg.sender, i, pending);
                }
            }
        }

        user.lastClaimTime = block.timestamp;
    }

    /**
     * @dev 计算待领取奖励
     */
    function pendingReward(uint256 _tokenId, address _user) public view returns (uint256) {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        
        UserInfo storage user = userInfo[_user];
        RewardToken storage rToken = rewardTokens[_tokenId];

        if (user.amount == 0 || !rToken.isActive) {
            return 0;
        }

        uint256 accReward = user.amount.mul(rToken.rewardsPerShare).div(1e12);
        return accReward.sub(user.rewardDebt[_tokenId]);
    }

    /**
     * @dev 批量查询待领取奖励
     */
    function pendingRewards(address _user) external view returns (uint256[] memory) {
        uint256[] memory rewards = new uint256[](rewardTokenCount);
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            rewards[i] = pendingReward(i, _user);
        }
        return rewards;
    }

    /**
     * @dev 设置奖励代币状态
     */
    function setRewardTokenStatus(uint256 _tokenId, bool _isActive) external onlyOwner {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        rewardTokens[_tokenId].isActive = _isActive;
        emit RewardTokenUpdated(_tokenId, _isActive);
    }

    /**
     * @dev 设置最小质押数量
     */
    function setMinStakeAmount(uint256 _amount) external onlyOwner {
        minStakeAmount = _amount;
    }

    /**
     * @dev 设置最小领取间隔
     */
    function setMinClaimInterval(uint256 _interval) external onlyOwner {
        minClaimInterval = _interval;
    }

    /**
     * @dev 暂停/恢复系统
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev 获取用户信息
     */
    function getUserInfo(address _user) external view returns (
        uint256 amount,
        uint256 lastClaimTime,
        uint256[] memory pendingRewards
    ) {
        UserInfo storage user = userInfo[_user];
        uint256[] memory rewards = new uint256[](rewardTokenCount);
        
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            rewards[i] = pendingReward(i, _user);
        }

        return (user.amount, user.lastClaimTime, rewards);
    }

    /**
     * @dev 获取奖励代币信息
     */
    function getRewardTokenInfo(uint256 _tokenId) external view returns (
        address token,
        uint256 totalRewards,
        uint256 rewardsPerShare,
        uint256 lastUpdateTime,
        bool isActive
    ) {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        RewardToken storage rToken = rewardTokens[_tokenId];
        
        return (
            address(rToken.token),
            rToken.totalRewards,
            rToken.rewardsPerShare,
            rToken.lastUpdateTime,
            rToken.isActive
        );
    }
}
```

## 3. 功能说明

### 3.1 质押管理
- 质押代币
- 解除质押
- 质押状态查询

### 3.2 分红管理
- 添加分红代币
- 分发分红
- 领取分红

### 3.3 状态查询
- 用户信息查询
- 分红代币信息查询
- 待领取分红查询

## 4. 安全机制

### 4.1 分红控制
- 最小质押限制
- 领取间隔控制
- 暂停机制

### 4.2 访问控制
- 权限管理
- 重入保护
- 参数验证

### 4.3 状态管理
- 代币状态
- 用户信息
- 分红记录

## 5. 使用示例

### 5.1 添加分红代币
```javascript
await tokenDividend.addRewardToken(rewardToken.address);
```

### 5.2 质押代币
```javascript
const amount = ethers.utils.parseEther("100");
await tokenDividend.stake(amount);
```

### 5.3 领取分红
```javascript
await tokenDividend.claimAllRewards();
```

## 6. 总结

该代币分红系统实现了完整的多代币分红功能，包括：
- 多代币分红支持
- 灵活的质押管理
- 实时的收益计算
- 批量领取功能
- 完善的安全机制

系统通过精心设计的多代币分红机制和状态管理，为用户提供了灵活且高效的分红服务，支持多种代币的同时分红，极大地提升了用户的收益管理效率。 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币分红？
A: 代币分红是一种代币经济模型，允许代币持有者按照其持有比例获得项目收益的分配。这种机制可以激励长期持有，并让用户分享项目成功带来的收益。

Q: 分红和质押奖励有什么区别？
A: 主要区别在于：
- 分红来源于项目实际收益
- 质押奖励通常是通过通胀产生
- 分红金额不固定，取决于项目表现
- 分红可以是多种代币
- 分红权重通常基于持有量

### 2. 功能相关

Q: 如何计算用户应得的分红？
A: 计算公式如下：
```solidity
userDividend = totalDividend * userBalance / totalSupply
```

Q: 支持哪些类型的分红？
A: 支持以下分红类型：
- ETH/原生代币分红
- ERC20代币分红
- 多代币组合分红
- 定期分红
- 即时分红

### 3. 安全相关

Q: 如何防止分红攻击？
A: 采取以下措施：
- 快照机制记录持仓
- 锁定期设置
- 最小持仓要求
- 防重入保护
- 金额验证

Q: 如何处理未领取的分红？
A: 通过以下机制：
- 设置领取期限
- 超时后归入公池
- 自动累积到下次
- 记录历史分红
- 提供批量领取

### 4. 优化相关

Q: 如何优化Gas消耗？
A: 优化策略包括：
- 批量处理分红
- 使用累积点数机制
- 优化存储结构
- 合并同类操作
- 使用事件代替存储

Q: 如何提高分红效率？
A: 可以通过：
- 自动分配机制
- 智能合约钱包集成
- 优化计算方法
- 缓存中间结果
- 并行处理分配

### 5. 实现细节

Q: 如何处理精度问题？
A: 精度处理方案：
```solidity
// 使用高精度计算
uint256 constant PRECISION = 1e18;
uint256 share = amount * PRECISION / total;
uint256 reward = share * balance / PRECISION;
```

Q: 如何实现多代币分红？
A: 实现方案：
- 维护支持的代币列表
- 独立记录每种代币分红
- 统一的分配机制
- 灵活的领取接口
- 完整的记录追踪

### 6. 最佳实践

Q: 设置分红周期需要考虑什么？
A: 建议考虑：
- 项目收益周期
- Gas成本平衡
- 用户体验需求
- 市场波动影响
- 运营策略调整

Q: 如何提高用户参与度？
A: 可以通过：
- 透明的分红机制
- 实时的数据展示
- 友好的用户界面
- 定期的数据报告
- 社区投票参与

### 7. 错误处理

Q: 常见错误及解决方案？
A: 主要错误类型：
- `"No dividend available"`: 检查分红周期
- `"Already claimed"`: 验证领取状态
- `"Invalid amount"`: 确认数额计算
- `"Not eligible"`: 检查资格要求
- `"System paused"`: 等待系统恢复

Q: 如何处理分红失败？
A: 处理机制：
- 自动重试机制
- 错误日志记录
- 手动干预接口
- 补偿机制
- 用户通知系统

### 8. 升级维护

Q: 如何升级分红机制？
A: 升级策略：
- 使用代理合约
- 渐进式更新
- 数据迁移方案
- 向后兼容
- 充分的测试

Q: 如何监控分红系统？
A: 监控方案：
- 事件日志分析
- 性能指标追踪
- 用户行为分析
- 异常监测
- 定期审计

### 9. 与其他模块集成

Q: 如何与质押系统集成？
A: 集成方案：
- 统一的权重计算
- 共享的用户数据
- 协调的时间锁定
- 综合的收益计算
- 一致的接口设计

Q: 如何实现跨链分红？
A: 实现方案：
- 桥接协议集成
- 跨链消息传递
- 统一的分红标准
- 安全的验证机制
- 完整的状态同步