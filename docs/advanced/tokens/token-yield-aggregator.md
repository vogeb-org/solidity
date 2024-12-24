# Token Yield Aggregator System

The token yield aggregator system is an automated yield optimization strategy system used to find and optimize yields across multiple DeFi protocols. This tutorial will explain how to implement a secure and reliable yield aggregator system.

## Features

- Yield strategy management
- Fund pool management
- Yield optimization
- Automatic reinvestment
- Risk control

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title YieldAggregator
 * @dev Yield aggregator contract implementation
 */
contract YieldAggregator is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    // Strategy information
    struct Strategy {
        address protocol;           // Protocol address
        address stakingToken;       // Staking token
        address rewardToken;        // Reward token
        uint256 totalDeposited;    // Total deposits
        uint256 totalRewards;      // Total rewards
        uint256 lastUpdate;        // Last update time
        uint256 apy;               // Annual percentage yield
        bool isActive;             // Whether active
        bool isEmergency;          // Whether in emergency state
    }

    // User information
    struct UserInfo {
        uint256 depositAmount;     // Deposit amount
        uint256 rewardDebt;        // Reward debt
        uint256 pendingRewards;    // Pending rewards
        uint256 lastDeposit;       // Last deposit time
        uint256 lastWithdraw;      // Last withdrawal time
    }

    // Configuration information
    struct Config {
        uint256 minDeposit;        // Minimum deposit
        uint256 maxDeposit;        // Maximum deposit
        uint256 withdrawalFee;     // Withdrawal fee
        uint256 performanceFee;    // Performance fee
        uint256 harvestInterval;   // Harvest interval
        uint256 reinvestThreshold; // Reinvestment threshold
    }

    // State variables
    mapping(uint256 => Strategy) public strategies;          // Strategy mapping
    mapping(uint256 => mapping(address => UserInfo)) public userInfo;  // User information
    uint256 public strategyCount;                           // Strategy count
    Config public config;                                   // Configuration
    address public treasury;                                // Treasury address
    uint256 public totalValueLocked;                        // Total value locked

    // Events
    event Deposit(address indexed user, uint256 indexed strategyId, uint256 amount);
    event Withdraw(address indexed user, uint256 indexed strategyId, uint256 amount);
    event Harvest(uint256 indexed strategyId, uint256 amount);
    event StrategyAdded(uint256 indexed strategyId, address protocol);
    event StrategyUpdated(uint256 indexed strategyId, uint256 apy);
    event EmergencyWithdraw(address indexed user, uint256 indexed strategyId, uint256 amount);

    /**
     * @dev Constructor
     */
    constructor(
        address _treasury,
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _withdrawalFee,
        uint256 _performanceFee,
        uint256 _harvestInterval,
        uint256 _reinvestThreshold
    ) {
        treasury = _treasury;
        config = Config({
            minDeposit: _minDeposit,
            maxDeposit: _maxDeposit,
            withdrawalFee: _withdrawalFee,
            performanceFee: _performanceFee,
            harvestInterval: _harvestInterval,
            reinvestThreshold: _reinvestThreshold
        });
    }

    /**
     * @dev Add strategy
     */
    function addStrategy(
        address _protocol,
        address _stakingToken,
        address _rewardToken,
        uint256 _apy
    ) external onlyOwner {
        require(_protocol != address(0), "Invalid protocol");
        require(_stakingToken != address(0), "Invalid staking token");
        require(_rewardToken != address(0), "Invalid reward token");

        uint256 strategyId = strategyCount;
        strategies[strategyId] = Strategy({
            protocol: _protocol,
            stakingToken: _stakingToken,
            rewardToken: _rewardToken,
            totalDeposited: 0,
            totalRewards: 0,
            lastUpdate: block.timestamp,
            apy: _apy,
            isActive: true,
            isEmergency: false
        });

        strategyCount = strategyCount.add(1);
        emit StrategyAdded(strategyId, _protocol);
    }

    /**
     * @dev Deposit
     */
    function deposit(uint256 _strategyId, uint256 _amount) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        require(strategy.isActive, "Strategy not active");
        require(!strategy.isEmergency, "Strategy in emergency");
        require(_amount >= config.minDeposit, "Amount too low");
        require(_amount <= config.maxDeposit, "Amount too high");

        UserInfo storage user = userInfo[_strategyId][msg.sender];
        
        // Update user rewards
        if (user.depositAmount > 0) {
            uint256 pending = calculatePendingRewards(_strategyId, msg.sender);
            user.pendingRewards = user.pendingRewards.add(pending);
        }

        // Transfer tokens
        IERC20(strategy.stakingToken).safeTransferFrom(msg.sender, address(this), _amount);
        
        // Update user information
        user.depositAmount = user.depositAmount.add(_amount);
        user.lastDeposit = block.timestamp;
        user.rewardDebt = user.depositAmount.mul(strategy.totalRewards).div(strategy.totalDeposited);

        // Update strategy information
        strategy.totalDeposited = strategy.totalDeposited.add(_amount);
        totalValueLocked = totalValueLocked.add(_amount);

        // Call target protocol deposit
        _depositToProtocol(_strategyId, _amount);

        emit Deposit(msg.sender, _strategyId, _amount);
    }

    /**
     * @dev Withdraw
     */
    function withdraw(uint256 _strategyId, uint256 _amount) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        UserInfo storage user = userInfo[_strategyId][msg.sender];
        require(_amount > 0, "Amount must be positive");
        require(user.depositAmount >= _amount, "Insufficient balance");

        // Update user rewards
        uint256 pending = calculatePendingRewards(_strategyId, msg.sender);
        user.pendingRewards = user.pendingRewards.add(pending);

        // Calculate withdrawal fee
        uint256 withdrawalFee = _amount.mul(config.withdrawalFee).div(10000);
        uint256 withdrawAmount = _amount.sub(withdrawalFee);

        // Update user information
        user.depositAmount = user.depositAmount.sub(_amount);
        user.lastWithdraw = block.timestamp;
        user.rewardDebt = user.depositAmount.mul(strategy.totalRewards).div(strategy.totalDeposited);

        // Update strategy information
        strategy.totalDeposited = strategy.totalDeposited.sub(_amount);
        totalValueLocked = totalValueLocked.sub(_amount);

        // Withdraw from target protocol
        _withdrawFromProtocol(_strategyId, withdrawAmount);

        // Transfer tokens
        IERC20(strategy.stakingToken).safeTransfer(msg.sender, withdrawAmount);
        if (withdrawalFee > 0) {
            IERC20(strategy.stakingToken).safeTransfer(treasury, withdrawalFee);
        }

        emit Withdraw(msg.sender, _strategyId, _amount);
    }

    /**
     * @dev Harvest rewards
     */
    function harvest(uint256 _strategyId) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        require(strategy.isActive, "Strategy not active");
        require(
            block.timestamp >= strategy.lastUpdate.add(config.harvestInterval),
            "Too soon to harvest"
        );

        uint256 pendingRewards = _harvestFromProtocol(_strategyId);
        require(pendingRewards > 0, "No rewards to harvest");

        // Calculate performance fee
        uint256 performanceFee = pendingRewards.mul(config.performanceFee).div(10000);
        uint256 harvestAmount = pendingRewards.sub(performanceFee);

        // Update strategy information
        strategy.totalRewards = strategy.totalRewards.add(harvestAmount);
        strategy.lastUpdate = block.timestamp;

        // Transfer rewards
        if (performanceFee > 0) {
            IERC20(strategy.rewardToken).safeTransfer(treasury, performanceFee);
        }

        // Check if reinvestment is needed
        if (harvestAmount >= config.reinvestThreshold) {
            _reinvest(_strategyId, harvestAmount);
        }

        emit Harvest(_strategyId, pendingRewards);
    }

    /**
     * @dev Claim rewards
     */
    function claimRewards(uint256 _strategyId) external nonReentrant {
        UserInfo storage user = userInfo[_strategyId][msg.sender];
        Strategy storage strategy = strategies[_strategyId];

        uint256 pending = calculatePendingRewards(_strategyId, msg.sender);
        uint256 totalRewards = pending.add(user.pendingRewards);
        require(totalRewards > 0, "No rewards to claim");

        user.pendingRewards = 0;
        user.rewardDebt = user.depositAmount.mul(strategy.totalRewards).div(strategy.totalDeposited);

        IERC20(strategy.rewardToken).safeTransfer(msg.sender, totalRewards);
    }

    /**
     * @dev Emergency withdraw
     */
    function emergencyWithdraw(uint256 _strategyId) external nonReentrant {
        Strategy storage strategy = strategies[_strategyId];
        UserInfo storage user = userInfo[_strategyId][msg.sender];
        require(user.depositAmount > 0, "Nothing to withdraw");

        uint256 amount = user.depositAmount;
        user.depositAmount = 0;
        user.rewardDebt = 0;
        user.pendingRewards = 0;

        strategy.totalDeposited = strategy.totalDeposited.sub(amount);
        totalValueLocked = totalValueLocked.sub(amount);

        _emergencyWithdrawFromProtocol(_strategyId, amount);
        IERC20(strategy.stakingToken).safeTransfer(msg.sender, amount);

        emit EmergencyWithdraw(msg.sender, _strategyId, amount);
    }

    /**
     * @dev Update strategy
     */
    function updateStrategy(
        uint256 _strategyId,
        uint256 _apy,
        bool _isActive,
        bool _isEmergency
    ) external onlyOwner {
        Strategy storage strategy = strategies[_strategyId];
        require(strategy.protocol != address(0), "Strategy not found");

        strategy.apy = _apy;
        strategy.isActive = _isActive;
        strategy.isEmergency = _isEmergency;

        emit StrategyUpdated(_strategyId, _apy);
    }

    /**
     * @dev Update configuration
     */
    function updateConfig(
        uint256 _minDeposit,
        uint256 _maxDeposit,
        uint256 _withdrawalFee,
        uint256 _performanceFee,
        uint256 _harvestInterval,
        uint256 _reinvestThreshold
    ) external onlyOwner {
        require(_maxDeposit > _minDeposit, "Invalid deposit limits");
        require(_withdrawalFee <= 1000, "Fee too high"); // max 10%
        require(_performanceFee <= 3000, "Fee too high"); // max 30%

        config.minDeposit = _minDeposit;
        config.maxDeposit = _maxDeposit;
        config.withdrawalFee = _withdrawalFee;
        config.performanceFee = _performanceFee;
        config.harvestInterval = _harvestInterval;
        config.reinvestThreshold = _reinvestThreshold;
    }

    /**
     * @dev Update treasury address
     */
    function updateTreasury(address _treasury) external onlyOwner {
        require(_treasury != address(0), "Invalid treasury");
        treasury = _treasury;
    }

    /**
     * @dev Get strategy information
     */
    function getStrategyInfo(uint256 _strategyId) external view returns (
        address protocol,
        address stakingToken,
        address rewardToken,
        uint256 totalDeposited,
        uint256 totalRewards,
        uint256 lastUpdate,
        uint256 apy,
        bool isActive,
        bool isEmergency
    ) {
        Strategy storage strategy = strategies[_strategyId];
        return (
            strategy.protocol,
            strategy.stakingToken,
            strategy.rewardToken,
            strategy.totalDeposited,
            strategy.totalRewards,
            strategy.lastUpdate,
            strategy.apy,
            strategy.isActive,
            strategy.isEmergency
        );
    }

    /**
     * @dev Get user information
     */
    function getUserInfo(uint256 _strategyId, address _user) external view returns (
        uint256 depositAmount,
        uint256 rewardDebt,
        uint256 pendingRewards,
        uint256 lastDeposit,
        uint256 lastWithdraw
    ) {
        UserInfo storage user = userInfo[_strategyId][_user];
        return (
            user.depositAmount,
            user.rewardDebt,
            user.pendingRewards.add(calculatePendingRewards(_strategyId, _user)),
            user.lastDeposit,
            user.lastWithdraw
        );
    }

    /**
     * @dev Deposit to target protocol
     */
    function _depositToProtocol(uint256 _strategyId, uint256 _amount) internal {
        // Implement deposit logic for specific protocols
    }

    /**
     * @dev Withdraw from target protocol
     */
    function _withdrawFromProtocol(uint256 _strategyId, uint256 _amount) internal {
        // Implement withdrawal logic for specific protocols
    }

    /**
     * @dev Harvest rewards from target protocol
     */
    function _harvestFromProtocol(uint256 _strategyId) internal returns (uint256) {
        // Implement harvest logic for specific protocols
        return 0;
    }

    /**
     * @dev Emergency withdraw from target protocol
     */
    function _emergencyWithdrawFromProtocol(uint256 _strategyId, uint256 _amount) internal {
        // Implement emergency withdrawal logic for specific protocols
    }

    /**
     * @dev Reinvest
     */
    function _reinvest(uint256 _strategyId, uint256 _amount) internal {
        // Implement reinvestment logic
    }

    /**
     * @dev Calculate pending rewards
     */
    function calculatePendingRewards(uint256 _strategyId, address _user) public view returns (uint256) {
        Strategy storage strategy = strategies[_strategyId];
        UserInfo storage user = userInfo[_strategyId][_user];

        if (user.depositAmount == 0) {
            return 0;
        }

        uint256 accRewardPerShare = strategy.totalRewards.mul(1e12).div(strategy.totalDeposited);
        return user.depositAmount.mul(accRewardPerShare).div(1e12).sub(user.rewardDebt);
    }
}
```

## Key Concepts

### Strategy Management

Strategy system supports:
- Strategy addition
- Strategy update
- Yield calculation
- Risk control

### Fund Management

Fund management includes:
- Deposit management
- Withdrawal management
- Fee management
- Reinvestment management

### Yield Management

Yield management includes:
- Yield calculation
- Yield distribution
- Yield reinvestment
- Yield claim

## Security Considerations

1. Fund Security
   - Deposit limits
   - Withdrawal verification
   - Emergency withdrawal
   - Permission control

2. Yield Security
   - Calculation precision
   - Fair distribution
   - Reinvestment control
   - Reasonable fees

3. System Security
   - Reentrancy protection
   - State checks
   - Emergency pause
   - Error handling

4. Strategy Security
   - Risk assessment
   - Yield verification
   - Protocol monitoring
   - Threshold control

## Best Practices

1. Strategy Management
   - Risk diversification
   - Yield optimization
   - Regular assessment
   - Timely adjustment

2. Fund Management
   - Reasonable limits
   - Fee transparency
   - Easy withdrawal
   - Safe control

3. Yield Management
   - Accurate calculation
   - Timely distribution
   - Efficient reinvestment
   - Fair distribution

4. System Maintenance
   - Regular checks
   - Performance optimization
   - Risk monitoring
   - Emergency预案

## Extended Features

1. Multiple strategy combinations
2. Dynamic weighting
3. Yield prediction
4. Risk assessment
5. Automatic rebalancing

## Application Scenarios

1. Yield optimization
   - Yield maximization
   - Risk minimization
   - Capital utilization
   - Cost control

2. Fund management
   - Liquidity management
   - Risk management
   - Yield management
   - Cost management

3. Investment strategies
   - Portfolio management
   - Strategy optimization
   - Risk control
   - Yield enhancement

## Summary

Yield aggregator system is an important part of the DeFi ecosystem. Through this tutorial, you can:
- Implement a complete yield system
- Ensure fund security
- Optimize yield strategies
- Improve fund efficiency 

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is a yield aggregator?
A: A yield aggregator is a smart contract system that is characterized by:
- Automatic search for the best yield
- Automatic allocation of funds
- Automatic reinvestment of yields
- Dynamic risk management
- Integration of multiple protocols

Q: What are the advantages of a yield aggregator?
A: The main advantages include:
- Yield maximization
- Automated management
- Risk diversification
- Cost optimization
- Convenient operation

### 2. Functionality Related

Q: How to calculate the optimal yield strategy?
A: Calculation method:
```solidity
function calculateOptimalStrategy(
    uint256 amount,
    uint256[] memory apys
) public pure returns (uint256) {
    // 1. Calculate basic yield
    uint256 maxApy = 0;
    uint256 bestStrategy = 0;
    
    // 2. Consider various factors
    for (uint256 i = 0; i < apys.length; i++) {
        if (apys[i] > maxApy) {
            maxApy = apys[i];
            bestStrategy = i;
        }
    }
    
    return bestStrategy;
}
```

Q: How to perform fund rebalancing?
A: Rebalancing mechanism:
- Regularly check yield
- Automatically adjust positions
- Minimize transaction costs
- Consider lock-up periods
- Optimize Gas fees

### 3. Security Related

Q: What risks are there with a yield aggregator?
A: The main risks include:
- Smart contract risks
- Protocol integration risks
- Market volatility risks
- Liquidity risks
- Oracles risks

Q: How to protect user assets?
A: Security measures include:
- Multisignature
- Limit control
- Emergency pause
- Auditing verification
- Risk warning

### 4. Optimization Related

Q: How to optimize yield strategies?
A: Optimization strategies:
- Dynamic adjustment of weights
- Yield threshold management
- Gas cost optimization
- Slippage control
- Timing selection

Q: How to reduce operational costs?
A: Cost control:
- Batch operations
- Routing optimization
- Timing selection
- Automation management
- Capital utilization optimization

### 5. Implementation Details

Q: How to implement automatic reinvestment?
A: Implementation mechanism:
```solidity
function autoCompound(
    uint256 strategyId,
    uint256 minReturn
) internal {
    // 1. Collect yields
    uint256 rewards = harvestRewards(strategyId);
    
    // 2. Calculate the optimal path
    (uint256 amount, uint256 path) = findBestPath(rewards);
    
    // 3. Execute reinvestment
    if (amount >= minReturn) {
        reinvest(strategyId, amount, path);
    }
}
```

Q: How to handle emergencies?
A: Handling mechanism:
- System pause
- Fund protection
- Quick withdrawal
- Risk isolation
- Emergency预案

### 6. Best Practices

Q: Yield aggregator development suggestions?
A: Development suggestions:
- Modular design
- Complete testing
- Risk control
- Performance optimization
- User experience

Q: How to improve system reliability?
A: Improvement solutions:
- Fault detection
- Automatic recovery
- State monitoring
- Backup mechanism
- Degraded service

### 7. Error Handling

Q: Common errors and solutions?
A: Error types:
- `"Insufficient balance"`: Check balance
- `"Slippage too high"`: Adjust slippage
- `"Strategy inactive"`: Check status
- `"Not profitable"`: Optimize strategy
- `"Gas too high"`: Wait for a good time

Q: How to handle exceptions?
A: Handling mechanism:
- Automatic retry
- Degraded service
- Error reporting
- Fund protection
- User notification

### 8. Upgrade and Maintenance

Q: How to upgrade the aggregator?
A: Upgrade strategies:
- Proxy contract
- Gradual update
- Data migration
- Compatibility testing
- Rollback mechanism

Q: How to monitor system status?
A: Monitoring solutions:
- APY monitoring
- TVL tracking
- Yield analysis
- Risk indicators
- Performance indicators

### 9. Integration with Other Systems

Q: How to integrate with DeFi protocols?
A: Integration solutions:
- Standard interfaces
- Adapter pattern
- Risk isolation
- Yield optimization
- Fund management

Q: How to implement cross-chain aggregation?
A: Implementation strategies:
- Cross-chain bridges
- Unified interfaces
- Risk control
- Yield comparison
- Fund dispatch