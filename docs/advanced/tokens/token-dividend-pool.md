# Token Dividend Pool System

## 1. System Overview

The token dividend pool system is a decentralized dividend management platform implemented in Solidity, supporting dividend distribution and revenue allocation for multiple tokens. The system implements flexible dividend strategies and comprehensive revenue calculation mechanisms.

### 1.1 Main Features

- Multi-token Dividends: Support multiple token dividends
- Real-time Calculation: Dynamic revenue calculation
- Proportional Distribution: Share-based allocation
- Automatic Distribution: Automated dividend payments
- Historical Records: Complete dividend records

## 2. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenDividendPool
 * @dev Token dividend pool contract
 */
contract TokenDividendPool is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Pool information
    struct Pool {
        IERC20 token;              // Dividend token
        uint256 totalShares;       // Total shares
        uint256 totalReleased;     // Total released amount
        uint256 lastUpdateTime;    // Last update time
        bool isActive;             // Whether active
    }

    // User share information
    struct ShareInfo {
        uint256 shares;            // Held shares
        uint256 released;          // Released amount
        uint256 lastClaimTime;     // Last claim time
    }

    // Dividend record
    struct DividendRecord {
        uint256 amount;            // Dividend amount
        uint256 timestamp;         // Dividend time
        uint256 totalShares;       // Total shares at the time
    }

    // State variables
    mapping(uint256 => Pool) public pools;                      // Pool information
    mapping(uint256 => mapping(address => ShareInfo)) public shareInfo;  // User share information
    mapping(uint256 => DividendRecord[]) public dividendRecords;  // Dividend records
    uint256 public poolCount;                                   // Pool count
    uint256 public minClaimInterval;                           // Minimum claim interval
    bool public paused;                                        // Pause status

    // Constants
    uint256 public constant PRECISION = 1e18;                  // Precision
    uint256 public constant MIN_SHARES = 1e6;                  // Minimum shares

    // Events
    event PoolCreated(uint256 indexed poolId, address token);
    event SharesUpdated(uint256 indexed poolId, address indexed user, uint256 shares);
    event DividendReleased(uint256 indexed poolId, address indexed user, uint256 amount);
    event DividendAdded(uint256 indexed poolId, uint256 amount);
    event PoolStatusChanged(uint256 indexed poolId, bool isActive);

    /**
     * @dev Constructor
     */
    constructor(uint256 _minClaimInterval) {
        minClaimInterval = _minClaimInterval;
    }

    /**
     * @dev Create dividend pool
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
     * @dev Update shares
     */
    function updateShares(uint256 poolId, address user, uint256 shares) external onlyOwner {
        require(poolId < poolCount, "Invalid pool ID");
        require(shares >= MIN_SHARES || shares == 0, "Invalid shares");

        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");

        ShareInfo storage info = shareInfo[poolId][user];
        
        // Update total shares
        pool.totalShares = pool.totalShares.sub(info.shares).add(shares);
        info.shares = shares;

        emit SharesUpdated(poolId, user, shares);
    }

    /**
     * @dev Add dividend
     */
    function addDividend(uint256 poolId, uint256 amount) external nonReentrant {
        require(poolId < poolCount, "Invalid pool ID");
        require(amount > 0, "Amount must be greater than 0");

        Pool storage pool = pools[poolId];
        require(pool.isActive, "Pool not active");
        require(pool.totalShares > 0, "No shares");

        // Transfer dividend tokens
        pool.token.transferFrom(msg.sender, address(this), amount);

        // Record dividend
        dividendRecords[poolId].push(DividendRecord({
            amount: amount,
            timestamp: block.timestamp,
            totalShares: pool.totalShares
        }));

        emit DividendAdded(poolId, amount);
    }

    /**
     * @dev Claim dividend
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

        // Calculate claimable amount
        uint256 claimable = getClaimableDividend(poolId, msg.sender);
        require(claimable > 0, "Nothing to claim");

        // Update state
        info.released = info.released.add(claimable);
        info.lastClaimTime = block.timestamp;
        pool.totalReleased = pool.totalReleased.add(claimable);

        // Transfer dividend
        pool.token.transfer(msg.sender, claimable);

        emit DividendReleased(poolId, msg.sender, claimable);
    }

    /**
     * @dev Calculate claimable dividend
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
     * @dev Set pool status
     */
    function setPoolStatus(uint256 poolId, bool isActive) external onlyOwner {
        require(poolId < poolCount, "Invalid pool ID");
        pools[poolId].isActive = isActive;
        emit PoolStatusChanged(poolId, isActive);
    }

    /**
     * @dev Set minimum claim interval
     */
    function setMinClaimInterval(uint256 interval) external onlyOwner {
        minClaimInterval = interval;
    }

    /**
     * @dev Pause/resume system
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev Get pool information
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
     * @dev Get user information
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
}
```

## 3. Core Functions

### 3.1 Pool Management
- Create dividend pool
- Update pool status
- Set parameters
- Monitor status

### 3.2 Share Management
- Update shares
- Calculate shares
- Track records
- Status monitoring

### 3.3 Dividend Distribution
- Add dividends
- Calculate dividends
- Process claims
- Record distribution

### 3.4 Status Query
- Pool information
- User information
- Dividend records
- System status

## 4. Security Mechanism

### 4.1 Access Control
- Owner permissions
- Status management
- Parameter verification
- Emergency pause

### 4.2 Distribution Security
- Share verification
- Amount validation
- Interval control
- Record tracking

### 4.3 State Management
- Pool status
- User information
- Dividend records
- System parameters

## 5. Usage Example

### 5.1 Create Pool
```javascript
const token = await Token.deploy();
await dividendPool.createPool(token.address);
```

### 5.2 Update Shares
```javascript
const poolId = 0;
const shares = ethers.utils.parseEther("100");
await dividendPool.updateShares(poolId, user.address, shares);
```

### 5.3 Add Dividend
```javascript
const amount = ethers.utils.parseEther("1000");
await token.approve(dividendPool.address, amount);
await dividendPool.addDividend(poolId, amount);
```

### 5.4 Claim Dividend
```javascript
await dividendPool.claimDividend(poolId);
```

## 6. Summary

The token dividend pool system implements a complete dividend distribution function, including:
- Multi-token dividend support
- Flexible share management
- Real-time dividend calculation
- Automated distribution
- Complete security mechanism

The system provides efficient and secure dividend services through carefully designed share calculation mechanisms and state management.

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is a dividend pool?
A: A dividend pool is a system that:
- Manages token dividends
- Tracks user shares
- Calculates distributions
- Processes claims
- Maintains records

Q: How are dividends calculated?
A: Dividend calculation involves:
- Share proportion
- Total pool amount
- Claim history
- Time factors
- Distribution rules

### 2. Security

Q: How to ensure distribution security?
A: Security measures include:
- Access control
- Amount validation
- Interval checks
- Record tracking
- Emergency handling

Q: How to prevent dividend attacks?
A: Protection measures include:
- Share verification
- Rate limiting
- Amount validation
- Status monitoring
- Quick response

### 3. Operations

Q: How to manage pools effectively?
A: Management strategies include:
- Regular monitoring
- Parameter adjustment
- Status tracking
- Record analysis
- User support

Q: How to handle distribution issues?
A: Issue handling includes:
- Error checking
- Status verification
- Record analysis
- User communication
- Problem resolution

### 4. Optimization

Q: How to optimize gas costs?
A: Optimization strategies:
- Batch processing
- Storage optimization
- Calculation efficiency
- Event usage
- State management

Q: How to improve distribution efficiency?
A: Improvement measures:
- Process optimization
- Parameter tuning
- Cache usage
- Code optimization
- Performance monitoring