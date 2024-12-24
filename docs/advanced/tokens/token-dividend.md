# Token Dividend System

## 1. System Overview

The token dividend system is a multi-token dividend platform implemented in Solidity, allowing users to earn dividend rewards in multiple tokens by staking a single token. The system implements flexible multi-token dividend mechanisms and dynamic reward distribution functionality.

### 1.1 Main Features

- Multi-token Dividends: Support multiple tokens as dividend rewards
- Single Token Staking: Use a single token for staking
- Dynamic Distribution: Real-time calculation and update of rewards
- Batch Claiming: Support one-click claiming of all token rewards
- Flexible Management: Support adding new dividend tokens
- Precise Calculation: High-precision reward calculation mechanism

## 2. Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title TokenDividend
 * @dev Token dividend contract
 */
contract TokenDividend is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // Reward token information
    struct RewardToken {
        IERC20 token;             // Token contract
        uint256 totalRewards;     // Total rewards
        uint256 rewardsPerShare;  // Rewards per share
        uint256 lastUpdateTime;   // Last update time
        bool isActive;            // Is active
    }

    // User dividend information
    struct UserInfo {
        uint256 amount;           // Staked amount
        mapping(uint256 => uint256) rewardDebt;  // Reward debt for each token
        uint256 lastClaimTime;    // Last claim time
    }

    // State variables
    IERC20 public stakeToken;                    // Stake token
    uint256 public totalStaked;                  // Total staked amount
    uint256 public rewardTokenCount;             // Number of reward tokens
    uint256 public minStakeAmount;               // Minimum stake amount
    uint256 public minClaimInterval;             // Minimum claim interval
    bool public paused;                          // Pause status

    mapping(uint256 => RewardToken) public rewardTokens;      // Reward tokens list
    mapping(address => UserInfo) public userInfo;             // User information

    // Events
    event RewardTokenAdded(uint256 indexed tokenId, address token);
    event RewardTokenUpdated(uint256 indexed tokenId, bool isActive);
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount);
    event RewardDistributed(uint256 indexed tokenId, uint256 amount);
    event RewardClaimed(address indexed user, uint256 indexed tokenId, uint256 amount);

    /**
     * @dev Constructor
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
     * @dev Add reward token
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
     * @dev Stake tokens
     */
    function stake(uint256 _amount) external nonReentrant {
        require(!paused, "System paused");
        require(_amount >= minStakeAmount, "Amount too small");

        UserInfo storage user = userInfo[msg.sender];

        // Claim existing rewards if already staked
        if (user.amount > 0) {
            claimAllRewards();
        }

        // Transfer stake tokens
        stakeToken.transferFrom(msg.sender, address(this), _amount);
        
        // Update user information
        user.amount = user.amount.add(_amount);
        totalStaked = totalStaked.add(_amount);

        // Update reward debt
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            if (rewardTokens[i].isActive) {
                user.rewardDebt[i] = user.amount.mul(rewardTokens[i].rewardsPerShare).div(1e12);
            }
        }

        emit Staked(msg.sender, _amount);
    }

    /**
     * @dev Unstake tokens
     */
    function unstake(uint256 _amount) external nonReentrant {
        UserInfo storage user = userInfo[msg.sender];
        require(user.amount >= _amount, "Insufficient stake");

        // Claim all rewards first
        claimAllRewards();

        // Update user information
        user.amount = user.amount.sub(_amount);
        totalStaked = totalStaked.sub(_amount);

        // Update reward debt
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            if (rewardTokens[i].isActive) {
                user.rewardDebt[i] = user.amount.mul(rewardTokens[i].rewardsPerShare).div(1e12);
            }
        }

        // Transfer stake tokens
        stakeToken.transfer(msg.sender, _amount);

        emit Unstaked(msg.sender, _amount);
    }

    /**
     * @dev Distribute rewards
     */
    function distributeReward(uint256 _tokenId, uint256 _amount) external nonReentrant {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        require(_amount > 0, "Amount must be greater than 0");

        RewardToken storage rToken = rewardTokens[_tokenId];
        require(rToken.isActive, "Token not active");

        // Transfer reward tokens
        rToken.token.transferFrom(msg.sender, address(this), _amount);

        // Update reward information
        rToken.totalRewards = rToken.totalRewards.add(_amount);
        if (totalStaked > 0) {
            rToken.rewardsPerShare = rToken.rewardsPerShare.add(_amount.mul(1e12).div(totalStaked));
        }
        rToken.lastUpdateTime = block.timestamp;

        emit RewardDistributed(_tokenId, _amount);
    }

    /**
     * @dev Claim all rewards
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
     * @dev Calculate pending rewards
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
     * @dev Batch query pending rewards
     */
    function pendingRewards(address _user) external view returns (uint256[] memory) {
        uint256[] memory rewards = new uint256[](rewardTokenCount);
        for (uint256 i = 0; i < rewardTokenCount; i++) {
            rewards[i] = pendingReward(i, _user);
        }
        return rewards;
    }

    /**
     * @dev Set reward token status
     */
    function setRewardTokenStatus(uint256 _tokenId, bool _isActive) external onlyOwner {
        require(_tokenId < rewardTokenCount, "Invalid token ID");
        rewardTokens[_tokenId].isActive = _isActive;
        emit RewardTokenUpdated(_tokenId, _isActive);
    }

    /**
     * @dev Set minimum stake amount
     */
    function setMinStakeAmount(uint256 _amount) external onlyOwner {
        minStakeAmount = _amount;
    }

    /**
     * @dev Set minimum claim interval
     */
    function setMinClaimInterval(uint256 _interval) external onlyOwner {
        minClaimInterval = _interval;
    }

    /**
     * @dev Pause/resume system
     */
    function setPaused(bool _paused) external onlyOwner {
        paused = _paused;
    }

    /**
     * @dev Get user information
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
     * @dev Get reward token information
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

## 3. Function Description

### 3.1 Staking Management
- Stake tokens
- Unstake tokens
- Stake status query

### 3.2 Dividend Management
- Add dividend tokens
- Distribute dividends
- Claim dividends

### 3.3 Status Query
- User information query
- Dividend token information query
- Pending dividend query

## 4. Security Mechanism

### 4.1 Dividend Control
- Minimum stake limit
- Claim interval control
- Pause mechanism

### 4.2 Access Control
- Permission management
- Reentrancy protection
- Parameter verification

### 4.3 State Management
- Token status
- User information
- Dividend record

## 5. Usage Example

### 5.1 Add dividend token
```javascript
await tokenDividend.addRewardToken(rewardToken.address);
```

### 5.2 Stake tokens
```javascript
const amount = ethers.utils.parseEther("100");
await tokenDividend.stake(amount);
```

### 5.3 Claim dividends
```javascript
await tokenDividend.claimAllRewards();
```

## 6. Summary

The token dividend system implements a complete multi-token dividend function, including:
- Multi-token dividend support
- Flexible staking management
- Real-time reward calculation
- Batch claiming function
- Complete security mechanism

The system provides a flexible and efficient dividend service through carefully designed multi-token dividend mechanisms and state management, supporting multiple tokens for dividend distribution, greatly improving the efficiency of users' dividend management. 

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is token dividend?
A: Token dividend is a token economy model that allows token holders to receive project revenue allocations based on their holdings. This mechanism can incentivize long-term holding and allow users to share in the benefits of project success.

Q: What is the difference between dividend and staking reward?
A: The main difference is:
- Dividends come from project actual revenue
- Staking rewards are usually generated through inflation
- Dividend amounts are not fixed and depend on project performance
- Dividends can be multiple tokens
- Dividend weights are usually based on holdings

### 2. Function Related

Q: How is the dividend a user should receive calculated?
A: The calculation formula is as follows:
```solidity
userDividend = totalDividend * userBalance / totalSupply
```

Q: Which types of dividends are supported?
A: The following dividend types are supported:
- ETH/native token dividends
- ERC20 token dividends
- Multi-token combination dividends
- Regular dividends
- Immediate dividends

### 3. Security Related

Q: How to prevent dividend attacks?
A: The following measures are taken:
- Snapshot mechanism to record holdings
- Locking periods
- Minimum holding requirements
- Reentrancy protection
- Amount verification

Q: How to handle unclaimed dividends?
A: Through the following mechanisms:
- Setting claim periods
- Dividends revert to the public pool after expiration
- Automatically accumulate to the next time
- Record historical dividends
- Provide batch claiming

### 4. Optimization Related

Q: How to optimize Gas consumption?
A: Optimization strategies include:
- Batch processing dividends
- Using cumulative point mechanisms
- Optimizing storage structures
- Merging similar operations
- Using events instead of storage

Q: How to improve dividend efficiency?
A: This can be achieved by:
- Automatic allocation mechanisms
- Smart contract wallet integration
- Optimizing calculation methods
- Caching intermediate results
- Parallelizing distribution

### 5. Implementation Details

Q: How to handle precision issues?
A: Precision handling solutions:
```solidity
// Use high-precision calculations
uint256 constant PRECISION = 1e18;
uint256 share = amount * PRECISION / total;
uint256 reward = share * balance / PRECISION;
```

Q: How to implement multi-token dividends?
A: Implementation schemes:
- Maintain a list of supported tokens
- Independently record dividends for each token
- Uniform distribution mechanisms
- Flexible claiming interfaces
- Complete record tracking

### 6. Best Practices

Q: What should be considered when setting dividend cycles?
A: It is recommended to consider:
- Project revenue cycles
- Gas cost balance
- User experience needs
- Market volatility impacts
- Operational strategy adjustments

Q: How to increase user participation?
A: This can be achieved by:
- Transparent dividend mechanisms
- Real-time data display
- User-friendly interfaces
- Periodic data reports
- Community voting participation

### 7. Error Handling

Q: Common errors and solutions?
A: The main error types are:
- `"No dividend available"`: Check dividend cycles
- `"Already claimed"`: Verify claim status
- `"Invalid amount"`: Confirm amount calculation
- `"Not eligible"`: Check eligibility requirements
- `"System paused"`: Wait for system recovery

Q: How to handle dividend failures?
A: Failure handling mechanisms:
- Automatic retry mechanisms
- Error log recording
- Manual intervention interfaces
- Compensation mechanisms
- User notification systems

### 8. Upgrade Maintenance

Q: How to upgrade dividend mechanisms?
A: Upgrade strategies:
- Using proxy contracts
- Gradual updates
- Data migration plans
- Backward compatibility
- Thorough testing

Q: How to monitor dividend systems?
A: Monitoring strategies:
- Event log analysis
- Performance indicator tracking
- User behavior analysis
- Exception monitoring
- Regular audits

### 9. Integration with Other Modules

Q: How to integrate with the staking system?
A: Integration schemes:
- Uniform weight calculation
- Shared user data
- Coordinated time locking
- Comprehensive revenue calculation
- Consistent interface design

Q: How to implement cross-chain dividends?
A: Implementation schemes:
- Bridge protocol integration
- Cross-chain message passing
- Uniform dividend standards
- Secure verification mechanisms
- Complete state synchronization