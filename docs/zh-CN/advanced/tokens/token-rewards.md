# 代币奖励系统

代币奖励系统是一个用于管理和分发代币奖励的智能合约系统，支持多种奖励策略和分发机制。本教程将介绍如何实现一个灵活且安全的代币奖励系统。

## 功能特性

- 多代币奖励支持
- 灵活的奖励策略
- 时间锁定机制
- 批量分发功能
- 紧急提取机制

## 合约实现

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
 * @dev 代币奖励合约实现
 */
contract TokenRewards is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // 奖励信息结构
    struct RewardInfo {
        IERC20 rewardToken;     // 奖励代币
        uint256 rewardPerBlock; // 每区块奖励
        uint256 startBlock;     // 开始区块
        uint256 endBlock;       // 结束区块
        uint256 lastRewardBlock;// 最后奖励区块
        uint256 accRewardPerShare; // 累计每股奖励
        uint256 totalStaked;    // 总质押量
    }

    // 用户信息结构
    struct UserInfo {
        uint256 amount;         // 用户质押数量
        uint256 rewardDebt;     // 奖励债务
        uint256 pendingRewards; // 待领取奖励
        uint256 lastClaimBlock; // 最后领取区块
    }

    // 质押代币
    IERC20 public stakingToken;
    
    // 奖励代币列表
    RewardInfo[] public rewardTokens;
    
    // 用户信息映射 user => rewardIndex => UserInfo
    mapping(address => mapping(uint256 => UserInfo)) public userInfo;
    
    // 是否暂停
    bool public paused;
    
    // 最小质押时间
    uint256 public minStakingTime;
    
    // 事件
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, address indexed rewardToken, uint256 reward);
    event RewardAdded(address indexed rewardToken, uint256 rewardPerBlock, uint256 startBlock, uint256 endBlock);
    event RewardUpdated(uint256 indexed index, uint256 rewardPerBlock);
    event EmergencyWithdrawn(address indexed user, uint256 amount);

    /**
     * @dev 构造函数
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
     * @dev 添加奖励代币
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
     * @dev 更新奖励速率
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
     * @dev 质押代币
     */
    function stake(uint256 _amount) external nonReentrant {
        require(!paused, "Contract paused");
        require(_amount > 0, "Cannot stake 0");

        // 更新所有奖励
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
     * @dev 提取质押
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
     * @dev 领取奖励
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
     * @dev 批量领取奖励
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
     * @dev 紧急提取
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
     * @dev 更新奖励
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
     * @dev 查看待领取奖励
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
     * @dev 暂停/恢复合约
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev 设置最小质押时间
     */
    function setMinStakingTime(uint256 _minStakingTime) external onlyOwner {
        minStakingTime = _minStakingTime;
    }

    /**
     * @dev 恢复误转入的代币
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

## 关键概念

### 奖励机制

奖励系统支持：
- 多代币奖励
- 区块奖励
- 累计奖励
- 待领取奖励

### 质押机制

质押系统包括：
- 代币质押
- 解除质押
- 紧急提取
- 最小质押时间

### 计算方法

奖励计算：
- 区块计算
- 份额计算
- 累计计算
- 精度处理

## 安全考虑

1. 代币安全
   - 转账安全
   - 余额检查
   - 溢出保护
   - 重入防护

2. 权限控制
   - 管理权限
   - 操作限制
   - 暂停机制
   - 紧急处理

3. 数据验证
   - 参数检查
   - 状态验证
   - 地址验证
   - 金额验证

4. 异常处理
   - 错误恢复
   - 状态回滚
   - 资金找回
   - 紧急提取

## 最佳实践

1. 合约设计
   - 模块化结构
   - 清晰接口
   - 完整事件
   - 状态管理

2. 奖励管理
   - 合理速率
   - 定期更新
   - 精确计算
   - 公平分配

3. 用户体验
   - 便捷操作
   - 状态查询
   - 批量处理
   - 及时反馈

4. 运维管理
   - 参数调整
   - 状态监控
   - 异常处理
   - 升级规划

## 扩展功能

1. 动态奖励率
2. 奖励倍数
3. 锁定期奖励
4. 推荐奖励
5. 团队奖励

## 应用场景

1. 流动性挖矿
   - LP代币奖励
   - 交易挖矿
   - 流动性激励
   - 市场深度

2. 生态激励
   - 社区建设
   - 项目贡献
   - 长期持有
   - 生态发展

3. 项目运营
   - 用户增长
   - 市场推广
   - 社区激励
   - 忠诚度计划

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币奖励系统？**

A: 代币奖励系统是一种激励机制，主要特点包括：
- 多代币奖励支持
- 灵活的奖励策略
- 实时奖励计算
- 自动分配机制
- 公平分配原则

**Q: 奖励系统有哪些类型？**

A: 主要类型包括：
- 质押挖矿奖励
- 流动性挖矿奖励
- 交易挖矿奖励
- 生态建设奖励
- 治理参与奖励

### 操作相关

**Q: 如何设计奖励策略？**

A: 设计要点包括：
- 确定奖励代币
- 设置奖励规则
- 配置分配机制
- 制定时间计划
- 建立退出机制

**Q: 如何计算奖励？**

A: 计算方法包括：
- 区块奖励计算
- 权重比例计算
- 时间周期计算
- 累积奖励计算
- 精度因子处理

### 安全相关

**Q: 奖励系统有哪些风险？**

A: 主要风险包括：
- 通胀风险
- 代币价格波动
- 奖励分配不公
- 系统漏洞风险
- 攻击者套利

**Q: 如何确保奖励公平？**

A: 保障措施包括：
- 透明的规则设计
- 公平的分配机制
- 完善的监控系统
- 有效的防作弊机制
- 及时的问题响应
 