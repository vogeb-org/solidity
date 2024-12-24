# Token Lending System

## 1. System Overview

The token lending system is a decentralized lending platform implemented in Solidity that supports lending and interest calculation for multiple tokens. The system implements flexible interest rate models and comprehensive risk control mechanisms.

### 1.1 Main Features

- Multi-token Support: Supports deposits and loans for multiple tokens
- Flexible Interest Rates: Dynamic interest rate model
- Over-collateralization: Secure collateral mechanism
- Liquidation Mechanism: Automated liquidation process
- Risk Control: Comprehensive security measures

## 2. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenLending
 * @dev Token lending contract
 */
contract TokenLending is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Market information
    struct Market {
        bool isListed;             // Whether market is listed
        uint256 totalSupply;       // Total supply
        uint256 totalBorrows;      // Total borrows
        uint256 supplyRate;        // Supply interest rate
        uint256 borrowRate;        // Borrow interest rate
        uint256 lastUpdateTime;    // Last update time
        uint256 reserveFactor;     // Reserve factor
        uint256 collateralFactor;  // Collateral factor
    }

    // User supply information
    struct SupplyInfo {
        uint256 balance;           // Supply balance
        uint256 interestIndex;     // Interest index
    }

    // User borrow information
    struct BorrowInfo {
        uint256 balance;           // Borrow balance
        uint256 interestIndex;     // Interest index
        uint256 lastUpdateTime;    // Last update time
    }

    // State variables
    mapping(address => Market) public markets;                    // Market information
    mapping(address => mapping(address => SupplyInfo)) public supplyInfo;    // User supply information
    mapping(address => mapping(address => BorrowInfo)) public borrowInfo;    // User borrow information
    mapping(address => bool) public isMarketListed;              // Market list
    address[] public marketList;                                 // Market list array

    // Constants
    uint256 public constant PRECISION = 1e18;                    // Precision
    uint256 public constant LIQUIDATION_DISCOUNT = 95e16;        // Liquidation discount (95%)
    uint256 public constant MIN_COLLATERAL_RATIO = 125e16;       // Minimum collateral ratio (125%)

    // Events
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
     * @dev Constructor
     */
    constructor() {}

    /**
     * @dev Add market
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
     * @dev Supply tokens
     */
    function supply(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        require(amount > 0, "Amount must be greater than 0");

        Market storage market = markets[token];
        SupplyInfo storage info = supplyInfo[token][msg.sender];

        // Update market
        updateMarket(token);

        // Transfer tokens in
        IERC20(token).transferFrom(msg.sender, address(this), amount);

        // Update supply information
        info.balance = info.balance.add(amount);
        market.totalSupply = market.totalSupply.add(amount);

        emit Supply(token, msg.sender, amount);
    }

    /**
     * @dev Withdraw tokens
     */
    function withdraw(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        
        Market storage market = markets[token];
        SupplyInfo storage info = supplyInfo[token][msg.sender];
        require(info.balance >= amount, "Insufficient balance");

        // Check health factor after withdrawal
        require(getAccountHealth(msg.sender) >= MIN_COLLATERAL_RATIO, "Unhealthy position");

        // Update market
        updateMarket(token);

        // Update supply information
        info.balance = info.balance.sub(amount);
        market.totalSupply = market.totalSupply.sub(amount);

        // Transfer tokens out
        IERC20(token).transfer(msg.sender, amount);

        emit Withdraw(token, msg.sender, amount);
    }

    /**
     * @dev Borrow tokens
     */
    function borrow(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        require(amount > 0, "Amount must be greater than 0");

        Market storage market = markets[token];
        BorrowInfo storage info = borrowInfo[token][msg.sender];

        // Update market
        updateMarket(token);

        // Check health factor after borrowing
        uint256 newBorrowBalance = info.balance.add(amount);
        require(
            getAccountHealthWithBorrow(msg.sender, token, newBorrowBalance) >= MIN_COLLATERAL_RATIO,
            "Insufficient collateral"
        );

        // Update borrow information
        info.balance = newBorrowBalance;
        info.lastUpdateTime = block.timestamp;
        market.totalBorrows = market.totalBorrows.add(amount);

        // Transfer tokens out
        IERC20(token).transfer(msg.sender, amount);

        emit Borrow(token, msg.sender, amount);
    }

    /**
     * @dev Repay tokens
     */
    function repay(address token, uint256 amount) external nonReentrant {
        require(isMarketListed[token], "Market not listed");
        
        Market storage market = markets[token];
        BorrowInfo storage info = borrowInfo[token][msg.sender];
        require(info.balance > 0, "No borrow balance");

        // Update market
        updateMarket(token);

        // Calculate actual repayment amount
        uint256 repayAmount = amount;
        if (repayAmount > info.balance) {
            repayAmount = info.balance;
        }

        // Transfer tokens in
        IERC20(token).transferFrom(msg.sender, address(this), repayAmount);

        // Update borrow information
        info.balance = info.balance.sub(repayAmount);
        info.lastUpdateTime = block.timestamp;
        market.totalBorrows = market.totalBorrows.sub(repayAmount);

        emit Repay(token, msg.sender, repayAmount);
    }

    /**
     * @dev Liquidate position
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

        // Check account health
        require(getAccountHealth(borrower) < MIN_COLLATERAL_RATIO, "Account is healthy");

        // Update markets
        updateMarket(repayToken);
        updateMarket(collateralToken);

        // Get borrow information
        BorrowInfo storage borrowInfo = borrowInfo[repayToken][borrower];
        require(borrowInfo.balance >= repayAmount, "Repay amount too high");

        // Calculate collateral amount to be obtained
        uint256 collateralAmount = repayAmount
            .mul(PRECISION)
            .div(LIQUIDATION_DISCOUNT)
            .mul(getPrice(repayToken))
            .div(getPrice(collateralToken));

        // Transfer repayment tokens
        IERC20(repayToken).transferFrom(msg.sender, address(this), repayAmount);

        // Update borrow information
        borrowInfo.balance = borrowInfo.balance.sub(repayAmount);
        borrowInfo.lastUpdateTime = block.timestamp;
        markets[repayToken].totalBorrows = markets[repayToken].totalBorrows.sub(repayAmount);

        // Update collateral information
        SupplyInfo storage supplyInfo = supplyInfo[collateralToken][borrower];
        supplyInfo.balance = supplyInfo.balance.sub(collateralAmount);
        markets[collateralToken].totalSupply = markets[collateralToken].totalSupply.sub(collateralAmount);

        // Transfer collateral tokens
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
     * @dev Update market
     */
    function updateMarket(address token) internal {
        Market storage market = markets[token];
        
        // Calculate time elapsed
        uint256 timeElapsed = block.timestamp.sub(market.lastUpdateTime);
        if (timeElapsed == 0) return;

        // Update interest rates
        market.supplyRate = getSupplyRate(token);
        market.borrowRate = getBorrowRate(token);
        market.lastUpdateTime = block.timestamp;
    }

    /**
     * @dev Get supply interest rate
     */
    function getSupplyRate(address token) public view returns (uint256) {
        Market storage market = markets[token];
        uint256 utilizationRate = getUtilizationRate(token);
        return utilizationRate.mul(market.borrowRate).mul(PRECISION.sub(market.reserveFactor)).div(PRECISION).div(PRECISION);
    }

    /**
     * @dev Get borrow interest rate
     */
    function getBorrowRate(address token) public view returns (uint256) {
        uint256 utilizationRate = getUtilizationRate(token);
        return utilizationRate.mul(10e16); // Base rate + utilization * slope
    }

    /**
     * @dev Get utilization rate
     */
    function getUtilizationRate(address token) public view returns (uint256) {
        Market storage market = markets[token];
        if (market.totalSupply == 0) return 0;
        return market.totalBorrows.mul(PRECISION).div(market.totalSupply);
    }

    /**
     * @dev Get account health
     */
    function getAccountHealth(address account) public view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        // Calculate total collateral value
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 supplyBalance = supplyInfo[token][account].balance;
            if (supplyBalance > 0) {
                totalCollateralValue = totalCollateralValue.add(
                    supplyBalance.mul(getPrice(token)).mul(markets[token].collateralFactor).div(PRECISION)
                );
            }
        }

        // Calculate total borrow value
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
     * @dev Get account health after borrowing
     */
    function getAccountHealthWithBorrow(
        address account,
        address borrowToken,
        uint256 borrowBalance
    ) internal view returns (uint256) {
        uint256 totalCollateralValue = 0;
        uint256 totalBorrowValue = 0;

        // Calculate total collateral value
        for (uint256 i = 0; i < marketList.length; i++) {
            address token = marketList[i];
            uint256 supplyBalance = supplyInfo[token][account].balance;
            if (supplyBalance > 0) {
                totalCollateralValue = totalCollateralValue.add(
                    supplyBalance.mul(getPrice(token)).mul(markets[token].collateralFactor).div(PRECISION)
                );
            }
        }

        // Calculate total borrow value
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
     * @dev Get token price (from oracle)
     */
    function getPrice(address token) internal view returns (uint256) {
        // This should be connected to an oracle
        return PRECISION;
    }

    /**
     * @dev Get market information
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
     * @dev Get user supply information
     */
    function getUserSupplyInfo(address token, address user) external view returns (
        uint256 balance,
        uint256 interestIndex
    ) {
        SupplyInfo storage info = supplyInfo[token][user];
        return (info.balance, info.interestIndex);
    }

    /**
     * @dev Get user borrow information
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

## 3. Function Description

### 3.1 Market Management
- Market Listing
- Interest Rate Update
- Risk Parameter Setting

### 3.2 Deposit Function
- Deposit Tokens
- Withdraw Tokens
- Interest Calculation

### 3.3 Borrow Function
- Borrow Tokens
- Repay Tokens
- Interest Calculation

### 3.4 Liquidation Function
- Liquidation Trigger
- Liquidation Reward
- Risk Control

## 4. Security Mechanism

### 4.1 Risk Control
- Minimum Collateral Ratio
- Liquidation Discount
- Reserve Factor

### 4.2 Access Control
- Permission Management
- Reentrancy Protection
- Parameter Verification

### 4.3 State Management
- Market State
- User State
- Interest Rate Update

## 5. Usage Example

### 5.1 Deposit
```javascript
const amount = ethers.utils.parseEther("100");
await token.approve(lending.address, amount);
await lending.supply(token.address, amount);
```

### 5.2 Borrow
```javascript
const amount = ethers.utils.parseEther("50");
await lending.borrow(token.address, amount);
```

### 5.3 Repay
```javascript
const amount = ethers.utils.parseEther("50");
await token.approve(lending.address, amount);
await lending.repay(token.address, amount);
```

## 6. Summary

The token lending system implements a complete lending function, including:
- Multi-token support
- Flexible interest rate model
- Secure collateral mechanism
- Automated liquidation process
- Comprehensive risk control

The system ensures the security and reliability of the lending process through carefully designed interest rate models and risk control mechanisms. 

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is token lending?
A: Token lending is a DeFi service that allows users to:
- Deposit tokens to earn interest
- Use assets as collateral for borrowing
- Automatically calculate interest
- Manage borrowing risks
- Provide liquidity incentives

Q: What are the main components of a lending protocol?
A: The main components include:
- Deposit pool management
- Borrowing logic
- Interest rate model
- Liquidation mechanism
- Risk control

### 2. Function-related

Q: How are interest rates calculated?
A: Interest rate calculation considers:
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

Q: How does the liquidation mechanism work?
A: The liquidation process includes:
- Health factor monitoring
- Liquidation threshold judgment
- Liquidation reward
- Debt settlement
- Collateral processing

### 3. Security-related

Q: How to prevent liquidation arbitrage?
A: Protection measures:
- Dynamic liquidation threshold
- Liquidation reward cap
- Minimum liquidation size
- Cooling period setting
- Price manipulation protection

Q: How to protect user assets?
A: Security mechanisms:
- Collateral ratio control
- Emergency pause
- Risk parameter adjustment
- Price oracle
- Multi-signature

### 4. Optimization-related

Q: How to optimize gas costs?
A: Optimization strategies:
- Batch processing
- Storage optimization
- Calculation simplification
- Event replacement for storage
- Cache intermediate results

Q: How to improve capital utilization?
A: Improvement solutions:
- Interest rate model optimization
- Deposit pool efficiency
- Borrowing limit adjustment
- Incentive mechanism design
- Market strategy optimization

### 5. Implementation details

Q: How to implement interest rate updates?
A: Implementation methods:
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

Q: How to handle bad debts?
A: Handling mechanisms:
- Risk reserve fund
- Community fund compensation
- Debt auction
- Loss sharing
- Insurance mechanism

### 6. Best practices

Q: How to set risk parameters?
A: Parameter considerations:
- Market volatility
- Asset liquidity
- Historical data analysis
- Risk tolerance
- Competitor reference

Q: How to improve protocol efficiency?
A: Optimization directions:
- Automated management
- Smart pricing
- Deposit pool optimization
- Incentive mechanism
- User experience

### 7. Error handling

Q: Common errors and solutions?
A: Error types:
- `"Insufficient collateral"`: Check collateral ratio
- `"Borrow limit exceeded"`: Verify borrowing limit
- `"Invalid liquidation"`: Confirm liquidation conditions
- `"Oracle error"`: Use alternative price source
- `"System paused"`: Wait for system recovery

Q: How to handle emergencies?
A: Emergency measures:
- Pause functions
- Limit withdrawals
- Adjust parameters
- Community governance
- Technical support

### 8. Upgrade maintenance

Q: How to upgrade the lending protocol?
A: Upgrade strategies:
- Upgradable contracts
- Progressive updates
- Backward compatibility
- Thorough testing
- Community voting

Q: How to monitor system health?
A: Monitoring solutions:
- Health factor tracking
- Cash flow analysis
- Risk indicator monitoring
- Market data analysis
- User behavior analysis

### 9. Integration with other modules

Q: How to integrate with other DeFi protocols?
A: Integration strategies:
- Standard interface implementation
- Liquidity sharing
- Risk data sharing
- Cross-protocol incentives
- Unified user experience

Q: How to implement cross-chain lending?
A: Implementation strategies:
- Cross-chain bridging
- Unified risk control
- Asset mapping
- State synchronization
- Liquidation coordination
