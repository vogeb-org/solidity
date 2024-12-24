# Token Fee System

The token fee system is a system for managing token transaction fees. This tutorial will explain how to implement a secure and reliable fee system.

## Features

- Fee rate management
- Fee calculation
- Fee distribution
- Revenue management
- Emergency handling

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenFee
 * @dev Token fee contract implementation
 */
contract TokenFee is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // Fee information
    struct FeeInfo {
        uint256 rate;           // Fee rate
        uint256 minFee;        // Minimum fee
        uint256 maxFee;        // Maximum fee
        bool isActive;         // Is active
        address collector;     // Collector
    }

    // Revenue information
    struct RevenueInfo {
        uint256 totalFees;     // Total fees
        uint256 pendingFees;   // Pending fees
        uint256 lastUpdate;    // Last update
        bool isProcessing;     // Is processing
    }

    // Configuration information
    struct FeeConfig {
        uint256 defaultRate;   // Default rate
        uint256 maxRate;       // Maximum rate
        uint256 minAmount;     // Minimum amount
        bool requiresApproval; // Requires approval
        bool isActive;         // Is active
    }

    // State variables
    mapping(address => FeeInfo) public fees;                    // Fees
    mapping(address => RevenueInfo) public revenues;            // Revenues
    mapping(address => bool) public operators;                  // Operators
    mapping(address => bool) public exemptAddresses;            // Exempt addresses
    FeeConfig public config;                                    // Configuration
    uint256 public totalRevenue;                               // Total revenue

    // Events
    event FeeUpdated(address indexed token, uint256 rate, uint256 minFee, uint256 maxFee);
    event FeeCollected(address indexed token, address indexed from, address indexed to, uint256 amount, uint256 fee);
    event RevenueProcessed(address indexed token, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);
    event ExemptAddressUpdated(address indexed account, bool status);
    event ConfigUpdated(uint256 defaultRate, uint256 maxRate, uint256 minAmount);

    /**
     * @dev Constructor
     */
    constructor(
        uint256 _defaultRate,
        uint256 _maxRate,
        uint256 _minAmount
    ) {
        require(_defaultRate <= _maxRate, "Invalid rates");
        config = FeeConfig({
            defaultRate: _defaultRate,
            maxRate: _maxRate,
            minAmount: _minAmount,
            requiresApproval: true,
            isActive: true
        });
    }

    /**
     * @dev Set fee rate
     */
    function setFee(
        address _token,
        uint256 _rate,
        uint256 _minFee,
        uint256 _maxFee,
        address _collector
    ) external onlyOperator whenNotPaused {
        require(_token != address(0), "Invalid token");
        require(_rate <= config.maxRate, "Rate too high");
        require(_minFee <= _maxFee, "Invalid fee range");
        require(_collector != address(0), "Invalid collector");

        fees[_token] = FeeInfo({
            rate: _rate,
            minFee: _minFee,
            maxFee: _maxFee,
            isActive: true,
            collector: _collector
        });

        emit FeeUpdated(_token, _rate, _minFee, _maxFee);
    }

    /**
     * @dev Calculate fee
     */
    function calculateFee(
        address _token,
        uint256 _amount
    ) public view returns (uint256) {
        if (config.minAmount > 0 && _amount < config.minAmount) {
            return 0;
        }

        FeeInfo storage feeInfo = fees[_token];
        if (!feeInfo.isActive) {
            return 0;
        }

        uint256 fee = _amount.mul(feeInfo.rate).div(10000);
        if (fee < feeInfo.minFee) {
            return feeInfo.minFee;
        }
        if (fee > feeInfo.maxFee) {
            return feeInfo.maxFee;
        }
        return fee;
    }

    /**
     * @dev Collect fee
     */
    function collectFee(
        address _token,
        address _from,
        address _to,
        uint256 _amount
    ) external onlyOperator whenNotPaused returns (uint256) {
        require(_token != address(0), "Invalid token");
        require(_from != address(0), "Invalid from");
        require(_to != address(0), "Invalid to");
        require(_amount > 0, "Invalid amount");

        if (exemptAddresses[_from] || exemptAddresses[_to]) {
            return 0;
        }

        uint256 fee = calculateFee(_token, _amount);
        if (fee == 0) {
            return 0;
        }

        FeeInfo storage feeInfo = fees[_token];
        RevenueInfo storage revenue = revenues[_token];

        require(
            IERC20(_token).transferFrom(_from, address(this), fee),
            "Fee transfer failed"
        );

        revenue.totalFees = revenue.totalFees.add(fee);
        revenue.pendingFees = revenue.pendingFees.add(fee);
        revenue.lastUpdate = block.timestamp;
        totalRevenue = totalRevenue.add(fee);

        emit FeeCollected(_token, _from, _to, _amount, fee);
        return fee;
    }

    /**
     * @dev Process revenue
     */
    function processRevenue(
        address _token
    ) external onlyOperator whenNotPaused {
        FeeInfo storage feeInfo = fees[_token];
        RevenueInfo storage revenue = revenues[_token];
        require(feeInfo.isActive, "Fee not active");
        require(revenue.pendingFees > 0, "No pending fees");
        require(!revenue.isProcessing, "Already processing");

        revenue.isProcessing = true;
        uint256 amount = revenue.pendingFees;
        revenue.pendingFees = 0;

        require(
            IERC20(_token).transfer(feeInfo.collector, amount),
            "Transfer failed"
        );

        revenue.isProcessing = false;
        revenue.lastUpdate = block.timestamp;

        emit RevenueProcessed(_token, amount);
    }

    /**
     * @dev Batch process revenue
     */
    function batchProcessRevenue(
        address[] calldata _tokens
    ) external onlyOperator whenNotPaused {
        for (uint256 i = 0; i < _tokens.length; i++) {
            address token = _tokens[i];
            FeeInfo storage feeInfo = fees[token];
            RevenueInfo storage revenue = revenues[token];

            if (!feeInfo.isActive || revenue.pendingFees == 0 || revenue.isProcessing) {
                continue;
            }

            revenue.isProcessing = true;
            uint256 amount = revenue.pendingFees;
            revenue.pendingFees = 0;

            require(
                IERC20(token).transfer(feeInfo.collector, amount),
                "Transfer failed"
            );

            revenue.isProcessing = false;
            revenue.lastUpdate = block.timestamp;

            emit RevenueProcessed(token, amount);
        }
    }

    /**
     * @dev Get fee information
     */
    function getFeeInfo(
        address _token
    ) external view returns (
        uint256 rate,
        uint256 minFee,
        uint256 maxFee,
        bool isActive,
        address collector
    ) {
        FeeInfo storage feeInfo = fees[_token];
        return (
            feeInfo.rate,
            feeInfo.minFee,
            feeInfo.maxFee,
            feeInfo.isActive,
            feeInfo.collector
        );
    }

    /**
     * @dev Get revenue information
     */
    function getRevenueInfo(
        address _token
    ) external view returns (
        uint256 totalFees,
        uint256 pendingFees,
        uint256 lastUpdate,
        bool isProcessing
    ) {
        RevenueInfo storage revenue = revenues[_token];
        return (
            revenue.totalFees,
            revenue.pendingFees,
            revenue.lastUpdate,
            revenue.isProcessing
        );
    }

    /**
     * @dev Set operator
     */
    function setOperator(
        address _operator,
        bool _status
    ) external onlyOwner {
        require(_operator != address(0), "Invalid operator");
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /**
     * @dev Set exempt address
     */
    function setExemptAddress(
        address _account,
        bool _status
    ) external onlyOwner {
        require(_account != address(0), "Invalid account");
        exemptAddresses[_account] = _status;
        emit ExemptAddressUpdated(_account, _status);
    }

    /**
     * @dev Update configuration
     */
    function updateConfig(
        uint256 _defaultRate,
        uint256 _maxRate,
        uint256 _minAmount,
        bool _requiresApproval
    ) external onlyOwner {
        require(_defaultRate <= _maxRate, "Invalid rates");
        config.defaultRate = _defaultRate;
        config.maxRate = _maxRate;
        config.minAmount = _minAmount;
        config.requiresApproval = _requiresApproval;
        emit ConfigUpdated(_defaultRate, _maxRate, _minAmount);
    }

    /**
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Emergency withdraw token
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(0), "Invalid token");
        require(_to != address(0), "Invalid recipient");
        require(_amount > 0, "Invalid amount");
        require(IERC20(_token).transfer(_to, _amount), "Transfer failed");
    }

    /**
     * @dev Operator modifier
     */
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }
}
```

## Key Concepts

### Fee Rate Management

Fee rate features include:
- Fee rate setting
- Fee rate calculation
- Fee rate verification
- Fee rate adjustment

### Revenue Management

Revenue features include:
- Revenue calculation
- Revenue distribution
- Revenue processing
- Revenue statistics

### Exempt Management

Exempt features include:
- Exempt setting
- Exempt verification
- Exempt adjustment
- Exempt recording

## Security Considerations

1. Fee rate security
   - Fee rate verification
   - Amount verification
   - Address verification
   - Status check

2. Revenue security
   - Revenue verification
   - Distribution verification
   - Processing verification
   - Status protection

3. System security
   - Permission control
   - Pause mechanism
   - Reentrancy protection
   - Status synchronization

4. Upgrade security
   - Configuration update
   - Fee rate adjustment
   - Status migration
   - Emergency handling

## Best Practices

1. Fee rate management
   - Fee rate verification
   - Amount control
   - Status tracking
   - Exception handling

2. Revenue management
   - Revenue verification
   - Distribution control
   - Processing optimization
   - Status management

3. Risk management
   - Fee rate monitoring
   - Exception detection
   - Risk warning
   - Emergency handling

4. System maintenance
   - Parameter optimization
   - Performance monitoring
   - Security audit
   - Upgrade plan

## Extended Features

1. Multi-currency fee rate
2. Dynamic fee rate
3. Tiered fee rate
4. Revenue distribution
5. Fee rate incentive

## Application Scenarios

1. Transaction fee
   - Transaction fee
   - Transfer fee
   - Exchange fee
   - Operation fee

2. Revenue distribution
   - Revenue calculation
   - Revenue distribution
   - Revenue extraction
   - Revenue statistics

3. Ecosystem incentive
   - Fee discount
   - Transaction rebate
   - Hold token incentive
   - Ecosystem construction

## Summary

The token fee system is an important component of the DeFi ecosystem. Through this tutorial, you can:
- Implement fee rate management
- Optimize revenue distribution
- Control transaction costs
- Provide incentive mechanisms 

## Frequently Asked Questions (FAQ)

### Basic Concepts

**Q: What is token fee?**

A: Token fee is a revenue management mechanism, with the main features including:
- Automatic collection of transaction fees
- Support for various fee rate settings
- Flexible allocation mechanisms
- Maintain system operation
- Encourage ecosystem development

**Q: What are the types of fees?**

A: The main types include:
- Fixed fee rate type
- Dynamic fee rate type
- Tiered fee rate type
- Mixed fee rate type
- Discount fee rate type

### Operational Related

**Q: How to set fees?**

A: The steps to set fees include:
- Determine the fee rate type
- Set fee rate parameters
- Configure allocation rules
- Implement fee collection mechanisms
- Monitor fee flow

**Q: How to optimize fee collection effects?**

A: Optimization methods include:
- Adjusting fee rate structure
- Optimizing allocation proportions
- Setting preferential mechanisms
- Implementing incentive plans
- Maintaining market competitiveness

### Security Related

**Q: What are the risks of fee collection mechanisms?**

A: The main risks include:
- Improper fee rate setting
- Inefficient distribution
- Contract vulnerabilities
- Avoiding fees
- Market impact

**Q: How to ensure fee collection security?**

A: Security measures include:
- Multi-signature control
- Fee rate limit control
- Distribution permission management
- Fee collection audit
- Emergency pause mechanism

### Technical Related

**Q: How to implement fee collection?**

A: Implementation methods include:
- Hook function integration
- Event monitoring
- State tracking
- Balance verification
- Transaction validation

**Q: How to optimize gas consumption?**

A: Optimization strategies:
- Batch processing
- State compression
- Event optimization
- Storage management
- Function optimization

### Development Related

**Q: How to implement upgrades?**

A: Upgrade process includes:
- Contract preparation
- Testing verification
- Community review
- Gradual rollout
- Monitoring

**Q: How to handle emergencies?**

A: Emergency procedures:
- Quick response
- System pause
- Community alert
- Solution deployment
- System recovery

## References

1. Technical Standards
   - ERC20 standard
   - Fee standards
   - Security standards
   - Implementation guides
   - Best practices

2. Development Resources
   - Smart contract libraries
   - Testing frameworks
   - Development tools
   - Security tools
   - Documentation

3. Community Resources
   - Development forums
   - Technical blogs
   - Research papers
   - Case studies
   - Best practices