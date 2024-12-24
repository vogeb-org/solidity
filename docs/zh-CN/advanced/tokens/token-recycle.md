# 代币回收系统

## 1. 系统概述

代币回收系统是一个基于 Solidity 实现的代币回收和销毁管理平台，支持多种代币的回收、销毁和再利用。系统实现了灵活的回收策略和完善的销毁机制。

### 1.1 主要特点

- 多币种回收：支持多种代币回收
- 灵活策略：支持多种回收策略
- 自动销毁：自动化销毁流程
- 再利用机制：支持代币再利用
- 完整记录：全面的操作记录

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenRecycle
 * @dev 代币回收合约
 */
contract TokenRecycle is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 回收策略信息
    struct Strategy {
        IERC20 token;              // 回收代币
        uint256 minAmount;         // 最小回收数量
        uint256 maxAmount;         // 最大回收数量
        uint256 totalRecycled;     // 总回收量
        uint256 lastUpdateTime;    // 最后更新时间
        bool isActive;             // 是否激活
        bool isReusable;           // 是否可再利用
    }

    // 回收记录
    struct RecycleRecord {
        address user;              // 用户地址
        uint256 amount;            // 回收数量
        uint256 timestamp;         // 回收时间
        bool isDestroyed;          // 是否已销毁
    }

    // 状态变量
    mapping(uint256 => Strategy) public strategies;            // 回收策略
    mapping(uint256 => RecycleRecord[]) public recycleRecords; // 回收记录
    uint256 public strategyCount;                             // 策略数量
    bool public paused;                                       // 暂停状态

    // 事件
    event StrategyCreated(uint256 indexed strategyId, address token);
    event TokenRecycled(uint256 indexed strategyId, address indexed user, uint256 amount);
    event TokenDestroyed(uint256 indexed strategyId, uint256 amount);
    event TokenReused(uint256 indexed strategyId, address indexed to, uint256 amount);
    event StrategyStatusChanged(uint256 indexed strategyId, bool isActive);

    /**
     * @dev 构造函数
     */
    constructor() {
        // 初始化状态
    }

    /**
     * @dev 创建回收策略
     */
    function createStrategy(
        IERC20 _token,
        uint256 _minAmount,
        uint256 _maxAmount,
        bool _isReusable
    ) external onlyOwner {
        require(address(_token) != address(0), "Invalid token");
        require(_maxAmount >= _minAmount, "Invalid amounts");

        strategies[strategyCount] = Strategy({
            token: _token,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            totalRecycled: 0,
            lastUpdateTime: block.timestamp,
            isActive: true,
            isReusable: _isReusable
        });

        emit StrategyCreated(strategyCount, address(_token));
        strategyCount = strategyCount.add(1);
    }

    /**
     * @dev 回收代币
     */
    function recycleTokens(uint256 strategyId, uint256 amount) external nonReentrant {
        require(!paused, "System paused");
        require(strategyId < strategyCount, "Invalid strategy ID");
        
        Strategy storage strategy = strategies[strategyId];
        require(strategy.isActive, "Strategy not active");
        require(amount >= strategy.minAmount, "Amount too small");
        require(amount <= strategy.maxAmount, "Amount too large");

        // 转入代币
        strategy.token.transferFrom(msg.sender, address(this), amount);
        
        // 更新状态
        strategy.totalRecycled = strategy.totalRecycled.add(amount);
        strategy.lastUpdateTime = block.timestamp;

        // 记录回收
        recycleRecords[strategyId].push(RecycleRecord({
            user: msg.sender,
            amount: amount,
            timestamp: block.timestamp,
            isDestroyed: false
        }));

        emit TokenRecycled(strategyId, msg.sender, amount);
    }

    /**
     * @dev 销毁代币
     */
    function destroyTokens(uint256 strategyId) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];
        require(!strategy.isReusable, "Tokens are reusable");

        uint256 balance = strategy.token.balanceOf(address(this));
        require(balance > 0, "No tokens to destroy");

        // 销毁代币（转到零地址）
        strategy.token.transfer(address(0), balance);

        // 更新记录
        RecycleRecord[] storage records = recycleRecords[strategyId];
        for (uint256 i = 0; i < records.length; i++) {
            if (!records[i].isDestroyed) {
                records[i].isDestroyed = true;
            }
        }

        emit TokenDestroyed(strategyId, balance);
    }

    /**
     * @dev 再利用代币
     */
    function reuseTokens(
        uint256 strategyId,
        address to,
        uint256 amount
    ) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];
        require(strategy.isReusable, "Tokens not reusable");
        require(to != address(0), "Invalid address");

        uint256 balance = strategy.token.balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");

        // 转出代币
        strategy.token.transfer(to, amount);

        emit TokenReused(strategyId, to, amount);
    }

    /**
     * @dev 设置策略状态
     */
    function setStrategyStatus(uint256 strategyId, bool isActive) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        strategies[strategyId].isActive = isActive;
        emit StrategyStatusChanged(strategyId, isActive);
    }

    /**
     * @dev 更新策略参数
     */
    function updateStrategy(
        uint256 strategyId,
        uint256 minAmount,
        uint256 maxAmount,
        bool isReusable
    ) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        require(maxAmount >= minAmount, "Invalid amounts");

        Strategy storage strategy = strategies[strategyId];
        strategy.minAmount = minAmount;
        strategy.maxAmount = maxAmount;
        strategy.isReusable = isReusable;
    }

    /**
     * @dev 暂停/恢复系统
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev 获取策略信息
     */
    function getStrategyInfo(uint256 strategyId) external view returns (
        address token,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 totalRecycled,
        uint256 lastUpdateTime,
        bool isActive,
        bool isReusable
    ) {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];
        return (
            address(strategy.token),
            strategy.minAmount,
            strategy.maxAmount,
            strategy.totalRecycled,
            strategy.lastUpdateTime,
            strategy.isActive,
            strategy.isReusable
        );
    }

    /**
     * @dev 获取回收记录数量
     */
    function getRecycleRecordCount(uint256 strategyId) external view returns (uint256) {
        return recycleRecords[strategyId].length;
    }

    /**
     * @dev 获取回收记录
     */
    function getRecycleRecord(uint256 strategyId, uint256 index) external view returns (
        address user,
        uint256 amount,
        uint256 timestamp,
        bool isDestroyed
    ) {
        require(strategyId < strategyCount, "Invalid strategy ID");
        require(index < recycleRecords[strategyId].length, "Invalid index");

        RecycleRecord storage record = recycleRecords[strategyId][index];
        return (
            record.user,
            record.amount,
            record.timestamp,
            record.isDestroyed
        );
    }
}
```

## 3. 功能说明

### 3.1 回收策略管理
- 创建策略
- 更新策略
- 策略状态管理

### 3.2 代币回收
- 代币回收
- 代币销毁
- 代币再利用

### 3.3 状态查询
- 策略信息查询
- 回收记录查询
- 状态统计

## 4. 安全机制

### 4.1 回收控制
- 数量限制
- 策略控制
- 暂停机制

### 4.2 访问控制
- 权限管理
- 重入保护
- 参数验证

### 4.3 状态管理
- 策略状态
- 记录维护
- 销毁确认

## 5. 使用示例

### 5.1 创建回收策略
```javascript
await tokenRecycle.createStrategy(
    token.address,
    minAmount,
    maxAmount,
    isReusable
);
```

### 5.2 回收代币
```javascript
await tokenRecycle.recycleTokens(strategyId, amount);
```

### 5.3 销毁代币
```javascript
await tokenRecycle.destroyTokens(strategyId);
```

## 6. 总结

该代币回收系统实现了完整的回收管理功能，包括：
- 多币种回收支持
- 灵活的策略管理
- 自动化销毁流程
- 再利用机制
- 完善的安全机制

系统通过精心设计的回收策略和安全机制，确保了代币回收过程的安全性和可靠性。 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币回收？
A: 代币回收是一种通过智能合约从指定地址或无效地址回收代币的机制。这种机制可以：
- 回收错误转账的代币
- 清理无效地址的代币
- 优化代币分配
- 维护代币生态
- 提高代币利用率

Q: 回收和销毁有什么区别？
A: 主要区别包括：
- 回收是重新利用代币
- 销毁是永久减少供应
- 回收可以再分配
- 回收不影响总量
- 回收更具灵活性

### 2. 功能相关

Q: 哪些代币可以被回收？
A: 可回收的代币包括：
- 错误转账的代币
- 长期未使用的代币
- 过期的锁定代币
- 无效地址的代币
- 合约剩余代币

Q: 如何处理回收的代币？
A: 处理方式包括：
- 重新分配
- 进入储备池
- 用于社区激励
- 销毁处理
- 流动性补充

### 3. 安全相关

Q: 如何确保回收安全？
A: 安全措施包括：
```solidity
// 权限控制
modifier onlyAuthorized() {
    require(hasRole(RECYCLER_ROLE, msg.sender), "Not authorized");
    _;
}

// 多重验证
function recycle(address target) external onlyAuthorized {
    require(isValidTarget(target), "Invalid target");
    require(getBalance(target) > 0, "No balance");
    require(lastRecycleTime[target] + cooldown < block.timestamp, "Cooldown");
    _executeRecycle(target);
}
```

Q: 如何防止误回收？
A: 防护措施包括：
- 白名单保护
- 多重签名
- 冷却期设置
- 金额阈值
- 操作确认

### 4. 优化相关

Q: 如何提高回收效率？
A: 优化策略：
- 批量处理
- 智能路由
- 自动检测
- 优先级排序
- Gas优化

Q: 如何降低回收成本？
A: 成本控制：
- 合并交易
- 选择低Gas时段
- 优化合约代码
- 减少存储操作
- 使用事件代替存储

### 5. 实现细节

Q: 如何识别可回收地址？
A: 识别方法：
```solidity
function isRecyclable(address target) internal view returns (bool) {
    return
        !isExcluded(target) &&
        getBalance(target) > minRecycleAmount &&
        lastActivity[target] + inactiveThreshold < block.timestamp;
}
```

Q: 如何处理回收失败？
A: 错误处理：
- 自动重试
- 失败记录
- 手动干预
- 状态恢复
- 通知机制

### 6. 最佳实践

Q: 回收策略如何制定？
A: 策略考虑：
- 回收条件设置
- 处理优先级
- 时间安排
- 资源分配
- 效果评估

Q: 如何提高回收透明度？
A: 透明机制：
- 公开回收规则
- 实时状态更新
- 操作记录公示
- 结果及时披露
- 社区监督

### 7. 错误处理

Q: 常见错误及解决方案？
A: 错误类型：
- `"Invalid address"`: 验证地址有效性
- `"Insufficient balance"`: 检查余额
- `"Not recyclable"`: 确认回收条件
- `"Already recycled"`: 检查状态
- `"System paused"`: 等待系统恢复

Q: 如何处理异常情况？
A: 处理机制：
- 应急暂停
- 资金保护
- 状态回滚
- 日志记录
- 管理员通知

### 8. 升级维护

Q: 如何升级回收机制？
A: 升级方案：
- 可升级合约
- 参数可调整
- 逻辑可更新
- 数据可迁移
- 兼容性保证

Q: 如何监控回收系统？
A: 监控方案：
- 实时数据分析
- 异常检测
- 性能监控
- 效果评估
- 定期审计

### 9. 与其他模块集成

Q: 如何与其他功能协同？
A: 协同策略：
- 统一的权限管理
- 共享的数据存储
- 协调的执行时序
- 一致的接口设计
- 完整的事件通知

Q: 如何处理跨链回收？
A: 跨链方案：
- 桥接协议对接
- 统一的回收标准
- 跨链消息传递
- 状态同步机制
- 安全性保证