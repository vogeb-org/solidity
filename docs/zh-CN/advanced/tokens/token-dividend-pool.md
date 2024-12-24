# 代币分红池系统

## 1. 系统概述

代币分红池系统是一个基于 Solidity 实现的去中心化分红管理平台，支持多种代币的分红发放和收益分配。系统实现了灵活的分红策略和完善的收益计算机制。

### 1.1 主要特点

- 多币种分红：支持多种代币分红
- 实时计算：动态收益计算
- 按比例分配：基于份额分配
- 自动分发：自动化分红发放
- 历史记录：完整的分红记录

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenDividendPool
 * @dev 代币分红池合约
 */
contract TokenDividendPool is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 分红池信息
    struct Pool {
        IERC20 token;              // 分红代币
        uint256 totalShares;       // 总份额
        uint256 totalReleased;     // 总发放量
        uint256 lastUpdateTime;    // 最后更新时间
        bool isActive;             // 是否激活
    }

    // 用户份额信息
    struct ShareInfo {
        uint256 shares;            // 持有份额
        uint256 released;          // 已领取量
        uint256 lastClaimTime;     // 上次领取时间
    }

    // 分红记录
    struct DividendRecord {
        uint256 amount;            // 分红数量
        uint256 timestamp;         // 分红时间
        uint256 totalShares;       // 当时总份额
    }

    // 状态变量
    mapping(uint256 => Pool) public pools;                      // 分红池信息
    mapping(uint256 => mapping(address => ShareInfo)) public shareInfo;  // 用户份额信息
    mapping(uint256 => DividendRecord[]) public dividendRecords;  // 分红记录
    uint256 public poolCount;                                   // 分红池数量
    uint256 public minClaimInterval;                           // 最小领取间隔
    bool public paused;                                        // 暂停状态

    // 常量
    uint256 public constant PRECISION = 1e18;                  // 精度
    uint256 public constant MIN_SHARES = 1e6;                  // 最小份额

    // 事件
    event PoolCreated(uint256 indexed poolId, address token);
    event SharesUpdated(uint256 indexed poolId, address indexed user, uint256 shares);
    event DividendReleased(uint256 indexed poolId, address indexed user, uint256 amount);
    event DividendAdded(uint256 indexed poolId, uint256 amount);
    event PoolStatusChanged(uint256 indexed poolId, bool isActive);

    /**
     * @dev 构造函数
     */
    constructor(uint256 _minClaimInterval) {
        minClaimInterval = _minClaimInterval;
    }

    /**
     * @dev 创建分红池
     */
    function createPool(IERC20 _token) external onlyOwner {
        pools[poolCount] = Pool({
            token: _token,
            totalShares: 0,
            totalReleased: 0,
            lastUpdateTime: block.timestamp,
            isActive: true
        });

        emit PoolCreated(poolCount, address(_token));
        poolCount = poolCount.add(1);
    }

    /**
     * @dev 更新份额
     */
    function updateShares(uint256 poolId, address user, uint256 shares) external onlyOwner {
        require(poolId < poolCount, "Invalid pool ID");
        require(shares >= MIN_SHARES || shares == 0, "Invalid shares");

        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");

        ShareInfo storage info = shareInfo[poolId][user];
        
        // 更新总份额
        pool.totalShares = pool.totalShares.sub(info.shares).add(shares);
        info.shares = shares;

        emit SharesUpdated(poolId, user, shares);
    }

    /**
     * @dev 添加分红
     */
    function addDividend(uint256 poolId, uint256 amount) external nonReentrant {
        require(poolId < poolCount, "Invalid pool ID");
        require(amount > 0, "Amount must be greater than 0");

        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");
        require(pool.totalShares > 0, "No shares");

        // 转入分红代币
        pool.token.transferFrom(msg.sender, address(this), amount);

        // 记录分红
        dividendRecords[poolId].push(DividendRecord({
            amount: amount,
            timestamp: block.timestamp,
            totalShares: pool.totalShares
        }));

        emit DividendAdded(poolId, amount);
    }

    /**
     * @dev 领取分红
     */
    function claimDividend(uint256 poolId) external nonReentrant {
        require(poolId < poolCount, "Invalid pool ID");
        require(!paused, "System paused");

        Pool storage pool = pools[poolId];
        ShareInfo storage info = shareInfo[poolId][msg.sender];
        require(info.shares > 0, "No shares");
        require(
            block.timestamp >= info.lastClaimTime.add(minClaimInterval),
            "Too frequent"
        );

        // 计算可领取数量
        uint256 claimable = getClaimableDividend(poolId, msg.sender);
        require(claimable > 0, "Nothing to claim");

        // 更新状态
        info.released = info.released.add(claimable);
        info.lastClaimTime = block.timestamp;
        pool.totalReleased = pool.totalReleased.add(claimable);

        // 转出分红
        pool.token.transfer(msg.sender, claimable);

        emit DividendReleased(poolId, msg.sender, claimable);
    }

    /**
     * @dev 计算可领取分红
     */
    function getClaimableDividend(uint256 poolId, address user) public view returns (uint256) {
        Pool storage pool = pools[poolId];
        ShareInfo storage info = shareInfo[poolId][user];
        
        if (info.shares == 0) return 0;

        uint256 totalDividend = 0;
        DividendRecord[] storage records = dividendRecords[poolId];

        for (uint256 i = 0; i < records.length; i++) {
            DividendRecord storage record = records[i];
            if (record.timestamp <= info.lastClaimTime) continue;

            uint256 share = info.shares.mul(record.amount).div(record.totalShares);
            totalDividend = totalDividend.add(share);
        }

        return totalDividend;
    }

    /**
     * @dev 设置分红池状态
     */
    function setPoolStatus(uint256 poolId, bool isActive) external onlyOwner {
        require(poolId < poolCount, "Invalid pool ID");
        pools[poolId].isActive = isActive;
        emit PoolStatusChanged(poolId, isActive);
    }

    /**
     * @dev 设置最小领取间隔
     */
    function setMinClaimInterval(uint256 interval) external onlyOwner {
        minClaimInterval = interval;
    }

    /**
     * @dev 暂停/恢复系统
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev 获取分红池信息
     */
    function getPoolInfo(uint256 poolId) external view returns (
        address token,
        uint256 totalShares,
        uint256 totalReleased,
        uint256 lastUpdateTime,
        bool isActive
    ) {
        require(poolId < poolCount, "Invalid pool ID");
        Pool storage pool = pools[poolId];
        return (
            address(pool.token),
            pool.totalShares,
            pool.totalReleased,
            pool.lastUpdateTime,
            pool.isActive
        );
    }

    /**
     * @dev 获取用户份额信息
     */
    function getUserInfo(uint256 poolId, address user) external view returns (
        uint256 shares,
        uint256 released,
        uint256 lastClaimTime,
        uint256 claimable
    ) {
        ShareInfo storage info = shareInfo[poolId][user];
        return (
            info.shares,
            info.released,
            info.lastClaimTime,
            getClaimableDividend(poolId, user)
        );
    }

    /**
     * @dev 获取分红记录数量
     */
    function getDividendRecordCount(uint256 poolId) external view returns (uint256) {
        return dividendRecords[poolId].length;
    }

    /**
     * @dev 获取分红记录
     */
    function getDividendRecord(uint256 poolId, uint256 index) external view returns (
        uint256 amount,
        uint256 timestamp,
        uint256 totalShares
    ) {
        require(poolId < poolCount, "Invalid pool ID");
        require(index < dividendRecords[poolId].length, "Invalid index");

        DividendRecord storage record = dividendRecords[poolId][index];
        return (
            record.amount,
            record.timestamp,
            record.totalShares
        );
    }

    /**
     * @dev 批量获取分红记录
     */
    function getDividendRecords(
        uint256 poolId,
        uint256 offset,
        uint256 limit
    ) external view returns (
        uint256[] memory amounts,
        uint256[] memory timestamps,
        uint256[] memory totalShares
    ) {
        require(poolId < poolCount, "Invalid pool ID");
        require(offset < dividendRecords[poolId].length, "Invalid offset");

        uint256 end = offset.add(limit);
        if (end > dividendRecords[poolId].length) {
            end = dividendRecords[poolId].length;
        }
        uint256 size = end.sub(offset);

        amounts = new uint256[](size);
        timestamps = new uint256[](size);
        totalShares = new uint256[](size);

        for (uint256 i = 0; i < size; i++) {
            DividendRecord storage record = dividendRecords[poolId][offset.add(i)];
            amounts[i] = record.amount;
            timestamps[i] = record.timestamp;
            totalShares[i] = record.totalShares;
        }

        return (amounts, timestamps, totalShares);
    }
}
```

## 3. 功能说明

### 3.1 分红池管理
- 创建分红池
- 更新份额
- 添加分红

### 3.2 分红发放
- 分红计算
- 分红领取
- 记录管理

### 3.3 状态查询
- 池信息查询
- 用户信息查询
- 分红记录查询

## 4. 安全机制

### 4.1 分红控制
- 最小份额限制
- 领取间隔控制
- 暂停机制

### 4.2 访问控制
- 权限管理
- 重入保护
- 参数验证

### 4.3 状态管理
- 池状态管理
- 份额更新
- 记录维护

## 5. 使用示例

### 5.1 创建分红池
```javascript
await dividendPool.createPool(token.address);
```

### 5.2 更新份额
```javascript
const shares = ethers.utils.parseEther("100");
await dividendPool.updateShares(0, userAddress, shares);
```

### 5.3 领取分红
```javascript
await dividendPool.claimDividend(0);
```

## 6. 总结

该代币分红池系统实现了完整的分红管理功能，包括：
- 多币种分红支持
- 灵活的份额管理
- 自动化分红发放
- 完整的记录系统
- 完善的安全机制

系统通过精心设计的分红计算模型和安全机制，确保了分红过程的公平性和可靠性。 

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币分红池？**

A: 代币分红池是一种收益分配机制，主要特点包括：
- 自动分配项目收益
- 按持币比例分红
- 支持多币种分红
- 定期结算收益
- 透明公平分配

**Q: 分红机制有哪些类型？**

A: 主要类型包括：
- 定期分红型
- 实时分红型
- 阈值触发型
- 混合分红型
- 动态调节型

### 操作相关

**Q: 如何参与代币分红？**

A: 参与步骤包括：
- 持有平台代币
- 质押到分红池
- 等待分红周期
- 领取分红收益
- 复投或提现

**Q: 如何优化分红效果？**

A: 优化方法包括：
- 调整分红周期
- 优化分配算法
- 设置最低门槛
- 实施复投激励
- 保持收益稳定

### 安全相关

**Q: 分红机制有哪些风险？**

A: 主要风险包括：
- 合约漏洞
- 分配不公平
- 收益波动
- 质押风险
- 市场操纵

**Q: 如何确保分红安全？**

A: 安全措施包括：
- 多重签名控制
- 分红池隔离
- 收益来源验证
- 分配算法审计
- 应急暂停机制 