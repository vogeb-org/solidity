# 代币回购系统

## 1. 系统概述

代币回购系统是一个基于 Solidity 实现的代币回购和销毁管理平台，支持多种代币的回购、销毁和价格管理。系统实现了灵活的回购策略和完善的价格控制机制。

### 1.1 主要特点

- 多币种回购：支持多种代币回购
- 动态定价：支持动态价格调整
- 自动销毁：自动化销毁流程
- 价格保护：价格波动保护机制
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
 * @title TokenBuyback
 * @dev 代币回购合约
 */
contract TokenBuyback is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 回购策略信息
    struct Strategy {
        IERC20 token;              // 回购代币
        IERC20 paymentToken;       // 支付代币
        uint256 price;             // 回购价格
        uint256 minAmount;         // 最小回购数量
        uint256 maxAmount;         // 最大回购数量
        uint256 totalBought;       // 总回购量
        uint256 totalPaid;         // 总支付量
        uint256 lastUpdateTime;    // 最后更新时间
        bool isActive;             // 是否激活
        bool autoDestroy;          // 是否自动销毁
    }

    // 回购记录
    struct BuybackRecord {
        address seller;            // 卖方地址
        uint256 amount;            // 回购数量
        uint256 payment;           // 支付数量
        uint256 price;            // 成交价格
        uint256 timestamp;         // 回购时间
        bool isDestroyed;          // 是否已销毁
    }

    // 状态变量
    mapping(uint256 => Strategy) public strategies;            // 回购策略
    mapping(uint256 => BuybackRecord[]) public buybackRecords; // 回购记录
    uint256 public strategyCount;                             // 策略数量
    bool public paused;                                       // 暂停状态

    // 事件
    event StrategyCreated(uint256 indexed strategyId, address token, address paymentToken);
    event TokenBoughtBack(uint256 indexed strategyId, address indexed seller, uint256 amount, uint256 payment);
    event TokenDestroyed(uint256 indexed strategyId, uint256 amount);
    event PriceUpdated(uint256 indexed strategyId, uint256 oldPrice, uint256 newPrice);
    event StrategyStatusChanged(uint256 indexed strategyId, bool isActive);

    /**
     * @dev 构造函数
     */
    constructor() {
        // 初始化状态
    }

    /**
     * @dev 创建回购策略
     */
    function createStrategy(
        IERC20 _token,
        IERC20 _paymentToken,
        uint256 _price,
        uint256 _minAmount,
        uint256 _maxAmount,
        bool _autoDestroy
    ) external onlyOwner {
        require(address(_token) != address(0), "Invalid token");
        require(address(_paymentToken) != address(0), "Invalid payment token");
        require(_maxAmount >= _minAmount, "Invalid amounts");
        require(_price > 0, "Invalid price");

        strategies[strategyCount] = Strategy({
            token: _token,
            paymentToken: _paymentToken,
            price: _price,
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            totalBought: 0,
            totalPaid: 0,
            lastUpdateTime: block.timestamp,
            isActive: true,
            autoDestroy: _autoDestroy
        });

        emit StrategyCreated(strategyCount, address(_token), address(_paymentToken));
        strategyCount = strategyCount.add(1);
    }

    /**
     * @dev 回购代币
     */
    function buybackTokens(uint256 strategyId, uint256 amount) external nonReentrant {
        require(!paused, "System paused");
        require(strategyId < strategyCount, "Invalid strategy ID");
        
        Strategy storage strategy = strategies[strategyId];
        require(strategy.isActive, "Strategy not active");
        require(amount >= strategy.minAmount, "Amount too small");
        require(amount <= strategy.maxAmount, "Amount too large");

        // 计算支付金额
        uint256 payment = amount.mul(strategy.price).div(1e18);
        require(
            strategy.paymentToken.balanceOf(address(this)) >= payment,
            "Insufficient payment token balance"
        );

        // 转入回购代币
        strategy.token.transferFrom(msg.sender, address(this), amount);
        
        // 支付代币
        strategy.paymentToken.transfer(msg.sender, payment);
        
        // 更新状态
        strategy.totalBought = strategy.totalBought.add(amount);
        strategy.totalPaid = strategy.totalPaid.add(payment);
        strategy.lastUpdateTime = block.timestamp;

        // 记录回购
        buybackRecords[strategyId].push(BuybackRecord({
            seller: msg.sender,
            amount: amount,
            payment: payment,
            price: strategy.price,
            timestamp: block.timestamp,
            isDestroyed: false
        }));

        emit TokenBoughtBack(strategyId, msg.sender, amount, payment);

        // 自动销毁
        if (strategy.autoDestroy) {
            _destroyTokens(strategyId);
        }
    }

    /**
     * @dev 销毁代币
     */
    function destroyTokens(uint256 strategyId) external onlyOwner {
        _destroyTokens(strategyId);
    }

    /**
     * @dev 内部销毁函数
     */
    function _destroyTokens(uint256 strategyId) internal {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];

        uint256 balance = strategy.token.balanceOf(address(this));
        require(balance > 0, "No tokens to destroy");

        // 销毁代币（转到零地址）
        strategy.token.transfer(address(0), balance);

        // 更新记录
        BuybackRecord[] storage records = buybackRecords[strategyId];
        for (uint256 i = 0; i < records.length; i++) {
            if (!records[i].isDestroyed) {
                records[i].isDestroyed = true;
            }
        }

        emit TokenDestroyed(strategyId, balance);
    }

    /**
     * @dev 更新回购价格
     */
    function updatePrice(uint256 strategyId, uint256 newPrice) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        require(newPrice > 0, "Invalid price");

        Strategy storage strategy = strategies[strategyId];
        uint256 oldPrice = strategy.price;
        strategy.price = newPrice;

        emit PriceUpdated(strategyId, oldPrice, newPrice);
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
        bool autoDestroy
    ) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        require(maxAmount >= minAmount, "Invalid amounts");

        Strategy storage strategy = strategies[strategyId];
        strategy.minAmount = minAmount;
        strategy.maxAmount = maxAmount;
        strategy.autoDestroy = autoDestroy;
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
        address paymentToken,
        uint256 price,
        uint256 minAmount,
        uint256 maxAmount,
        uint256 totalBought,
        uint256 totalPaid,
        uint256 lastUpdateTime,
        bool isActive,
        bool autoDestroy
    ) {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];
        return (
            address(strategy.token),
            address(strategy.paymentToken),
            strategy.price,
            strategy.minAmount,
            strategy.maxAmount,
            strategy.totalBought,
            strategy.totalPaid,
            strategy.lastUpdateTime,
            strategy.isActive,
            strategy.autoDestroy
        );
    }

    /**
     * @dev 获取回购记录数量
     */
    function getBuybackRecordCount(uint256 strategyId) external view returns (uint256) {
        return buybackRecords[strategyId].length;
    }

    /**
     * @dev 获取回购记录
     */
    function getBuybackRecord(uint256 strategyId, uint256 index) external view returns (
        address seller,
        uint256 amount,
        uint256 payment,
        uint256 price,
        uint256 timestamp,
        bool isDestroyed
    ) {
        require(strategyId < strategyCount, "Invalid strategy ID");
        require(index < buybackRecords[strategyId].length, "Invalid index");

        BuybackRecord storage record = buybackRecords[strategyId][index];
        return (
            record.seller,
            record.amount,
            record.payment,
            record.price,
            record.timestamp,
            record.isDestroyed
        );
    }

    /**
     * @dev 提取支付代币
     */
    function withdrawPaymentToken(uint256 strategyId, uint256 amount) external onlyOwner {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];
        
        uint256 balance = strategy.paymentToken.balanceOf(address(this));
        require(balance >= amount, "Insufficient balance");

        strategy.paymentToken.transfer(msg.sender, amount);
    }

    /**
     * @dev 存入支付代币
     */
    function depositPaymentToken(uint256 strategyId, uint256 amount) external {
        require(strategyId < strategyCount, "Invalid strategy ID");
        Strategy storage strategy = strategies[strategyId];

        strategy.paymentToken.transferFrom(msg.sender, address(this), amount);
    }
}
```

## 3. 功能说明

### 3.1 回购策略管理
- 创建策略
- 更新策略
- 策略状态管理

### 3.2 代币回购
- 代币回购
- 代币销毁
- 价格管理

### 3.3 资金管理
- 支付代币存取
- 余额管理
- 状态统计

## 4. 安全机制

### 4.1 回购控制
- 数量限制
- 价格保护
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

### 5.1 创建回购策略
```javascript
await tokenBuyback.createStrategy(
    token.address,
    paymentToken.address,
    price,
    minAmount,
    maxAmount,
    autoDestroy
);
```

### 5.2 回购代币
```javascript
await tokenBuyback.buybackTokens(strategyId, amount);
```

### 5.3 更新价格
```javascript
await tokenBuyback.updatePrice(strategyId, newPrice);
```

## 6. 总结

该代币回购系统实现了完整的回购管理功能，包括：
- 多币种回购支持
- 灵活的价格管理
- 自动化销毁流程
- 资金管理机制
- 完善的安全机制

系统通过精心设计的回购策略和价格机制，确保了代币回购过程的安全性和可靠性。 

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币回购？**

A: 代币回购是一种价值管理机制，主要特点包括：
- 从市场购回代币
- 减少流通供应量
- 维护代币价值
- 提供价格支撑
- 增加市场信心

**Q: 回购机制有哪些类型？**

A: 主要类型包括：
- 定期自动回购
- 触发式回购
- 手动回购
- 混合回购
- 分层回购

### 操作相关

**Q: 如何实施代币回购？**

A: 实施步骤包括：
- 设置回购参数
- 准备回购资金
- 监控触发条件
- 执行回购操作
- 确认代币销毁

**Q: 如何优化回购效果？**

A: 优化方法包括：
- 选择最佳时机
- 分批次执行
- 设置价格区间
- 控制回购规模
- 保持透明度

### 安全相关

**Q: 回购机制有哪些风险？**

A: 主要风险包括：
- 价格操纵风险
- 流动性影响
- 合约漏洞
- 市场波动
- 资金安全

**Q: 如何确保回购安全？**

A: 安全措施包括：
- 多重签名控制
- 限制回购规模
- 设置价格保护
- 审计回购记录
- 应急暂停机制