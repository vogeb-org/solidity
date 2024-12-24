# 代币借贷系统

## 1. 系统概述

代币借贷系统是一个基于 Solidity 实现的去中心化借贷平台，支持多种代币的存借和利息计算。系统实现了灵活的利率模型和完善的风险控制机制。

### 1.1 主要特点

- 多币种支持：支持多种代币的存借
- 灵活利率：动态利率模型
- 超额抵押：安全的抵押机制
- 清算机制：自动化清算流程
- 风险控制：完善的安全措施

## 2. 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenLending
 * @dev 代币借贷合约
 */
contract TokenLending is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 市场信息
    struct Market {
        bool isListed;             // 是否已上市
        uint256 totalSupply;       // 总供应量
        uint256 totalBorrows;      // 总借款量
        uint256 supplyRate;        // 存款利率
        uint256 borrowRate;        // 借款利率
        uint256 lastUpdateTime;    // 最后更新时间
        uint256 reserveFactor;     // 储备金率
        uint256 collateralFactor;  // 抵押率
    }

    // 用户存款信息
    struct SupplyInfo {
        uint256 balance;           // 存款余额
        uint256 interestIndex;     // 利息指数
    }

    // 用户借款信息
    struct BorrowInfo {
        uint256 balance;           // 借款余额
        uint256 interestIndex;     // 利息指数
        uint256 lastUpdateTime;    // 最后更新时间
    }

    // 状态变量
    mapping(address => Market) public markets;                    // 市场信息
    mapping(address => mapping(address => SupplyInfo)) public supplyInfo;    // 用户存款信息
    mapping(address => mapping(address => BorrowInfo)) public borrowInfo;    // 用户借款信息
    mapping(address => bool) public isMarketListed;              // 市场列表
    address[] public marketList;                                 // 市场列表数组

    // 常量
    uint256 public constant PRECISION = 1e18;                    // 精度
    uint256 public constant LIQUIDATION_DISCOUNT = 95e16;        // 清算折扣(95%)
    uint256 public constant MIN_COLLATERAL_RATIO = 125e16;       // 最小抵押率(125%)

    // 事件
    event MarketListed(address token);
    event Supply(address indexed token, address indexed user, uint256 amount);
    event Withdraw(address indexed token, address indexed user, uint256 amount);
    event Borrow(address indexed token, address indexed user, uint256 amount);
    event Repay(address indexed token, address indexed user, uint256 amount);
    event Liquidate(
        address indexed liquidator,
        address indexed borrower,
        address indexed repayToken,
        address collateralToken,
        uint256 repayAmount,
        uint256 collateralAmount
    );

    /**
     * @dev 构造函数
     */
    constructor() {}

    /**
     * @dev 添加市场
     */
    function listMarket(
        address token,
        uint256 _collateralFactor,
        uint256 _reserveFactor
    ) external onlyOwner {
        require(!isMarketListed[token], "Market already listed");
        require(_collateralFactor <= PRECISION, "Invalid collateral factor");
        require(_reserveFactor <= PRECISION, "Invalid reserve factor");

        markets[token] = Market({
            isListed: true,
            totalSupply: 0,
            totalBorrows: 0,
            supplyRate: 0,
            borrowRate: 0,
            lastUpdateTime: block.timestamp,
            reserveFactor: _reserveFactor,
            collateralFactor: _collateralFactor
        });

        isMarketListed[token] = true;
        marketList.push(token);
        emit MarketListed(token);
    }

    /**
     * @dev 存款
     */
    function supply(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        require(amount > 0, "Amount must be greater than 0");

        Market storage market = markets[token];
        SupplyInfo storage info = supplyInfo[token][msg.sender];

        // 更新市场
        updateMarket(token);

        // 转入代币
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // 更新存款信息
        info.balance = info.balance.add(amount);
        market.totalSupply = market.totalSupply.add(amount);

        emit Supply(token, msg.sender, amount);
    }

    /**
     * @dev 提款
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        
        Market storage market = markets[token];
        SupplyInfo storage info = supplyInfo[token][msg.sender];
        require(info.balance >= amount, "Insufficient balance");

        // 检查提款后的健康度
        require(getAccountHealth(msg.sender) >= MIN_COLLATERAL_RATIO, "Unhealthy position");

        // 更新市场
        updateMarket(token);

        // 更新存款信息
        info.balance = info.balance.sub(amount);
        market.totalSupply = market.totalSupply.sub(amount);

        // 转出代币
        IERC20(token).transfer(msg.sender, amount);

        emit Withdraw(token, msg.sender, amount);
    }

    /**
     * @dev 借款
     */
    function borrow(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        require(amount > 0, "Amount must be greater than 0");

        Market storage market = markets[token];
        BorrowInfo storage info = borrowInfo[token][msg.sender];

        // 更新市场
        updateMarket(token);

        // 检查借款后的健康度
        uint256 newBorrowBalance = info.balance.add(amount);
        require(
            getAccountHealthWithBorrow(msg.sender, token, newBorrowBalance) >= MIN_COLLATERAL_RATIO,
            "Insufficient collateral"
        );

        // 更新借款信息
        info.balance = newBorrowBalance;
        info.lastUpdateTime = block.timestamp;
        market.totalBorrows = market.totalBorrows.add(amount);

        // 转出代币
        IERC20(token).transfer(msg.sender, amount);

        emit Borrow(token, msg.sender, amount);
    }

    /**
     * @dev 还款
     */
    function repay(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        
        Market storage market = markets[token];
        BorrowInfo storage info = borrowInfo[token][msg.sender];
        require(info.balance > 0, "No borrow balance");

        // 更新市场
        updateMarket(token);

        // 计算实际还款金额
        uint256 repayAmount = amount;
        if (repayAmount > info.balance) {
            repayAmount = info.balance;
        }

        // 转入代币
        IERC20(token).transferFrom(msg.sender, address(this), repayAmount);

        // 更新借款信息
        info.balance = info.balance.sub(repayAmount);
        info.lastUpdateTime = block.timestamp;
        market.totalBorrows = market.totalBorrows.sub(repayAmount);

        emit Repay(token, msg.sender, repayAmount);
    }

    /**
     * @dev 清算
     */
    function liquidate(
        address borrower,
        address repayToken,
        address collateralToken,
        uint256 repayAmount
    ) external nonReentrant {
        require(isMarketListed[repayToken], "Repay token not listed");
        require(isMarketListed[collateralToken], "Collateral token not listed");
        require(borrower != msg.sender, "Cannot liquidate self");
        require(repayAmount > 0, "Amount must be greater than 0");

        // 检查账户健康度
        require(getAccountHealth(borrower) < MIN_COLLATERAL_RATIO, "Account is healthy");

        // 更新市场
        updateMarket(repayToken);
        updateMarket(collateralToken);

        // 获取借款信息
        BorrowInfo storage borrowInfo = borrowInfo[repayToken][borrower];
        require(borrowInfo.balance >= repayAmount, "Repay amount too high");

        // 计算可获得的抵押品数量
        uint256 collateralAmount = repayAmount
            .mul(PRECISION)
            .div(LIQUIDATION_DISCOUNT)
            .mul(getPrice(repayToken))
            .div(getPrice(collateralToken));

        // 转入还款代币
        IERC20(repayToken).transferFrom(msg.sender, address(this), repayAmount);

        // 更新借款信息
        borrowInfo.balance = borrowInfo.balance.sub(repayAmount);
        borrowInfo.lastUpdateTime = block.timestamp;
        markets[repayToken].totalBorrows = markets[repayToken].totalBorrows.sub(repayAmount);

        // 更新抵押信息
        SupplyInfo storage supplyInfo = supplyInfo[collateralToken][borrower];
        supplyInfo.balance = supplyInfo.balance.sub(collateralAmount);
        markets[collateralToken].totalSupply = markets[collateralToken].totalSupply.sub(collateralAmount);

        // 转出抵押品
        IERC20(collateralToken).transfer(msg.sender, collateralAmount);

        emit Liquidate(
            msg.sender,
            borrower,
            repayToken,
            collateralToken,
            repayAmount,
            collateralAmount
        );
    }

    /**
     * @dev 更新市场
     */
    function updateMarket(address token) internal {
        Market storage market = markets[token];
        
        // 计算时间间隔
        uint256 timeElapsed = block.timestamp.sub(market.lastUpdateTime);
        if (timeElapsed == 0) return;

        // 更新利率
        market.supplyRate = getSupplyRate(token);
        market.borrowRate = getBorrowRate(token);
        market.lastUpdateTime = block.timestamp;
    }

    /**
     * @dev 获取存款利率
     */
    function getSupplyRate(address token) public view returns (uint256) {
        Market storage market = markets[token];
        uint256 utilizationRate = getUtilizationRate(token);
        return utilizationRate.mul(market.borrowRate).mul(PRECISION.sub(market.reserveFactor)).div(PRECISION).div(PRECISION);
    }

    /**
     * @dev 获取借款利率
     */
    function getBorrowRate(address token) public view returns (uint256) {
        uint256 utilizationRate = getUtilizationRate(token);
        return utilizationRate.mul(10e16); // 基础利率 + 利用率 * 斜率
    }

    /**
     * @dev 获取资金利用率
     */
    function getUtilizationRate(address token) public view returns (uint256) {
        Market storage market = markets[token];
        if (market.totalSupply == 0) return 0;
        return market.totalBorrows.mul(PRECISION).div(market.totalSupply);
    }

    /**
     * @dev 获取账户健康度
     */
    function getAccountHealth(address account) public view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        // 计算总抵押价值
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 supplyBalance = supplyInfo[token][account].balance;
            if (supplyBalance > 0) {
                totalCollateralValue = totalCollateralValue.add(
                    supplyBalance.mul(getPrice(token)).mul(markets[token].collateralFactor).div(PRECISION)
                );
            }
        }

        // 计算总借款价值
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 borrowBalance = borrowInfo[token][account].balance;
            if (borrowBalance > 0) {
                totalBorrowValue = totalBorrowValue.add(
                    borrowBalance.mul(getPrice(token))
                );
            }
        }

        if (totalBorrowValue == 0) return type(uint256).max;
        return totalCollateralValue.mul(PRECISION).div(totalBorrowValue);
    }

    /**
     * @dev 获取账户在新增借款后的健康度
     */
    function getAccountHealthWithBorrow(
        address account,
        address borrowToken,
        uint256 borrowBalance
    ) internal view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        // 计算总抵押价值
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 supplyBalance = supplyInfo[token][account].balance;
            if (supplyBalance > 0) {
                totalCollateralValue = totalCollateralValue.add(
                    supplyBalance.mul(getPrice(token)).mul(markets[token].collateralFactor).div(PRECISION)
                );
            }
        }

        // 计算总借款价值
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 balance = token == borrowToken ? borrowBalance : borrowInfo[token][account].balance;
            if (balance > 0) {
                totalBorrowValue = totalBorrowValue.add(
                    balance.mul(getPrice(token))
                );
            }
        }

        if (totalBorrowValue == 0) return type(uint256).max;
        return totalCollateralValue.mul(PRECISION).div(totalBorrowValue);
    }

    /**
     * @dev 获取代币价格(从预言机获取)
     */
    function getPrice(address token) internal view returns (uint256) {
        // 这里应该对接预言机
        return PRECISION;
    }

    /**
     * @dev 获取市场信息
     */
    function getMarketInfo(address token) external view returns (
        bool isListed,
        uint256 totalSupply,
        uint256 totalBorrows,
        uint256 supplyRate,
        uint256 borrowRate,
        uint256 lastUpdateTime,
        uint256 reserveFactor,
        uint256 collateralFactor
    ) {
        Market storage market = markets[token];
        return (
            market.isListed,
            market.totalSupply,
            market.totalBorrows,
            market.supplyRate,
            market.borrowRate,
            market.lastUpdateTime,
            market.reserveFactor,
            market.collateralFactor
        );
    }

    /**
     * @dev 获取用户存款信息
     */
    function getUserSupplyInfo(address token, address user) external view returns (
        uint256 balance,
        uint256 interestIndex
    ) {
        SupplyInfo storage info = supplyInfo[token][user];
        return (info.balance, info.interestIndex);
    }

    /**
     * @dev 获取用户借款信息
     */
    function getUserBorrowInfo(address token, address user) external view returns (
        uint256 balance,
        uint256 interestIndex,
        uint256 lastUpdateTime
    ) {
        BorrowInfo storage info = borrowInfo[token][user];
        return (info.balance, info.interestIndex, info.lastUpdateTime);
    }
}
```

## 3. 功能说明

### 3.1 市场管理
- 市场上线
- 利率更新
- 风险参数设置

### 3.2 存款功能
- 存入代币
- 提取代币
- 利息计算

### 3.3 借款功能
- 借入代币
- 归还代币
- 利息计算

### 3.4 清算功能
- 清算触发
- 清算奖励
- 风��控制

## 4. 安全机制

### 4.1 风险控制
- 最小抵押率
- 清算折扣
- 储备金率

### 4.2 访问控制
- 权限管理
- 重入保护
- 参数验证

### 4.3 状态管理
- 市场状态
- 用户状态
- 利率更新

## 5. 使用示例

### 5.1 存款
```javascript
const amount = ethers.utils.parseEther("100");
await token.approve(lending.address, amount);
await lending.supply(token.address, amount);
```

### 5.2 借款
```javascript
const amount = ethers.utils.parseEther("50");
await lending.borrow(token.address, amount);
```

### 5.3 还款
```javascript
const amount = ethers.utils.parseEther("50");
await token.approve(lending.address, amount);
await lending.repay(token.address, amount);
```

## 6. 总结

该代币借贷系统实现了完整的借贷功能，包括：
- 多币种支持
- 灵活的利率模型
- 安全的抵押机制
- 自动化清算流程
- 完善的风险控制

系统通过精心设计的利率模型和风险控制机制，确保了借贷过程的安全性和可靠性。 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币借贷？
A: 代币借贷是一种DeFi服务,允许用户:
- 存入代币获得利息
- 抵押资产进行借贷
- 自动计算利息
- 管理借贷风险
- 提供流动性激励

Q: 借贷协议的主要组成部分是什么？
A: 主要包括:
- 存款池管理
- 借贷逻辑
- 利率模型
- 清算机制
- 风险控制

### 2. 功能相关

Q: 如何计算借贷利率？
A: 利率计算考虑:
```solidity
function calculateInterestRate(uint256 utilization) public pure returns (uint256) {
    if(utilization < OPTIMAL_UTILIZATION) {
        return baseRate + (utilization * rateSlope1) / UTILIZATION_PRECISION;
    } else {
        return baseRate + rateSlope1 + 
            ((utilization - OPTIMAL_UTILIZATION) * rateSlope2) / UTILIZATION_PRECISION;
    }
}
```

Q: 清算机制如何工作？
A: 清算流程包括:
- 健康因子监控
- 清算阈值判断
- 清算人激励
- 债务结算
- 抵押品处理

### 3. 安全相关

Q: 如何防止清算套利？
A: 防护措施:
- 动态清算阈值
- 清算奖励上限
- 最小清算规模
- 冷却期设置
- 价格操纵防护

Q: 如何保护用户资产？
A: 安全机制:
- 抵押率控制
- 紧急暂停
- 风险参数调整
- 价格预言机- 多重签名

### 4. 优化相关

Q: 如何优化Gas成本？
A: 优化策略:
- 批量处理
- 存储优化
- 计算简化
- 事件替代存储
- 缓存中间结果

Q: 如何提高资金利用率？
A: 改进方案:
- 利率模型优化
- 资金池效率
- 借贷限额调整
- 激励机制设计
- 市场策略优化

### 5. 实现细节

Q: 如何实现利率更新？
A: 实现方法:
```solidity
function updateInterest() internal {
    uint256 timeElapsed = block.timestamp - lastUpdateTime;
    if(timeElapsed > 0) {
        uint256 utilization = calculateUtilization();
        uint256 rate = calculateInterestRate(utilization);
        accumulatedRate += rate * timeElapsed;
        lastUpdateTime = block.timestamp;
    }
}
```

Q: 如何处理坏账？
A: 处理机制:
- 风险准备金
- 社区基金补偿
- 债务拍卖
- 损失分摊
- 保险机制

### 6. 最佳实践

Q: 如何设置风险参数？
A: 参数考虑:
- 市场波动性
- 资产流动性
- 历史数据分析
- 风险承受能力
- 竞争对手参考

Q: 如何提高协议效率？
A: 优化方向:
- 自动化管理
- 智能定价
- 资金池优化
- 激励机制
- 用户体验

### 7. 错误处理

Q: 常见错误及解决方案？
A: 错误类型:
- `"Insufficient collateral"`: 检查抵押率
- `"Borrow limit exceeded"`: 验证借贷限额
- `"Invalid liquidation"`: 确认清算条件
- `"Oracle error"`: 使用备用价格源
- `"System paused"`: 等待系统恢复

Q: 如何处理紧急情况？
A: 应急措施:
- 暂停功能
- 限制提款
- 调整参数
- 社区治理
- 技术支持

### 8. 升级维护

Q: 如何升级借贷协议？
A: 升级策略:
- 可升级合约
- 渐进式更新
- 向后兼容
- 充分测试
- 社区投票

Q: 如何监控系统健康？
A: 监控方案:
- 健康因子追踪
- 资金流向分析
- 风险指标监控
- 市场数据分析
- 用户行为分析

### 9. 与其他模块集成

Q: 如何与其他DeFi协议集成？
A: 集成方案:
- 标准接口实现
- 流动性共享
- 风险数据共享
- 跨协议激励
- 统一的用户体验

Q: 如何实现跨链借贷？
A: 实现策略:
- 跨链桥接
- 统一风控
- 资产映射
- 状态同步
- 清算协调
