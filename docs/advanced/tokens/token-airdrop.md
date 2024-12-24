# Token Airdrop System

Token airdrop is an important way for projects to distribute tokens to the community, enabling quick and fair token distribution. This tutorial will explain how to implement an efficient token airdrop system.

## Features

- Merkle tree whitelist verification
- Batch airdrop support
- Multiple airdrop rounds
- Amount control mechanism
- Sybil attack prevention

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TokenAirdrop
 * @dev Token airdrop contract implementation
 */
contract TokenAirdrop is Ownable, ReentrancyGuard {
    // Airdrop round information
    struct AirdropRound {
        bytes32 merkleRoot;        // Merkle tree root
        uint256 startTime;         // Start time
        uint256 endTime;           // End time
        uint256 totalAmount;       // Total airdrop amount
        uint256 claimedAmount;     // Claimed amount
        uint256 amountPerUser;     // Amount per user
        bool isActive;             // Whether active
    }

    // Airdrop token
    IERC20 public token;
    
    // Round mapping
    mapping(uint256 => AirdropRound) public airdropRounds;
    // User claim records roundId => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;
    // Current round ID
    uint256 public currentRoundId;
    
    // Events
    event RoundCreated(uint256 indexed roundId, uint256 startTime, uint256 endTime, uint256 totalAmount);
    event TokensClaimed(uint256 indexed roundId, address indexed user, uint256 amount);
    event RoundStatusUpdated(uint256 indexed roundId, bool isActive);
    event BatchAirdropExecuted(uint256 indexed roundId, uint256 usersCount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    /**
     * @dev Create new airdrop round
     */
    function createRound(
        bytes32 _merkleRoot,
        uint256 _startTime,
        uint256 _endTime,
        uint256 _totalAmount,
        uint256 _amountPerUser
    ) external onlyOwner {
        require(_startTime < _endTime, "Invalid time range");
        require(_totalAmount > 0, "Invalid total amount");
        require(_amountPerUser > 0, "Invalid amount per user");
        require(_totalAmount >= _amountPerUser, "Total amount too small");
        
        currentRoundId++;
        
        airdropRounds[currentRoundId] = AirdropRound({
            merkleRoot: _merkleRoot,
            startTime: _startTime,
            endTime: _endTime,
            totalAmount: _totalAmount,
            claimedAmount: 0,
            amountPerUser: _amountPerUser,
            isActive: true
        });
        
        emit RoundCreated(currentRoundId, _startTime, _endTime, _totalAmount);
    }

    /**
     * @dev User claims airdrop
     */
    function claim(
        uint256 _roundId,
        bytes32[] calldata _merkleProof
    ) external nonReentrant {
        AirdropRound storage round = airdropRounds[_roundId];
        require(round.isActive, "Round not active");
        require(block.timestamp >= round.startTime, "Not started");
        require(block.timestamp <= round.endTime, "Ended");
        require(!claimed[_roundId][msg.sender], "Already claimed");
        
        // Verify Merkle proof
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(_merkleProof, round.merkleRoot, leaf),
            "Invalid proof"
        );
        
        // Check remaining airdrop amount
        require(
            round.claimedAmount + round.amountPerUser <= round.totalAmount,
            "Insufficient remaining tokens"
        );
        
        // Update state
        claimed[_roundId][msg.sender] = true;
        round.claimedAmount += round.amountPerUser;
        
        // Transfer tokens
        require(
            token.transfer(msg.sender, round.amountPerUser),
            "Transfer failed"
        );
        
        emit TokensClaimed(_roundId, msg.sender, round.amountPerUser);
    }

    /**
     * @dev Batch execute airdrop (admin function)
     */
    function batchAirdrop(
        uint256 _roundId,
        address[] calldata _recipients
    ) external onlyOwner nonReentrant {
        AirdropRound storage round = airdropRounds[_roundId];
        require(round.isActive, "Round not active");
        
        uint256 totalAmount = _recipients.length * round.amountPerUser;
        require(
            round.claimedAmount + totalAmount <= round.totalAmount,
            "Insufficient remaining tokens"
        );
        
        for (uint256 i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            if (!claimed[_roundId][recipient]) {
                claimed[_roundId][recipient] = true;
                require(
                    token.transfer(recipient, round.amountPerUser),
                    "Transfer failed"
                );
                emit TokensClaimed(_roundId, recipient, round.amountPerUser);
            }
        }
        
        round.claimedAmount += totalAmount;
        emit BatchAirdropExecuted(_roundId, _recipients.length);
    }

    /**
     * @dev Update round status
     */
    function updateRoundStatus(
        uint256 _roundId,
        bool _isActive
    ) external onlyOwner {
        airdropRounds[_roundId].isActive = _isActive;
        emit RoundStatusUpdated(_roundId, _isActive);
    }

    /**
     * @dev Check if user can claim airdrop
     */
    function canClaim(
        uint256 _roundId,
        address _user,
        bytes32[] calldata _merkleProof
    ) external view returns (bool) {
        AirdropRound storage round = airdropRounds[_roundId];
        
        if (!round.isActive ||
            block.timestamp < round.startTime ||
            block.timestamp > round.endTime ||
            claimed[_roundId][_user]) {
            return false;
        }
        
        bytes32 leaf = keccak256(abi.encodePacked(_user));
        return MerkleProof.verify(_merkleProof, round.merkleRoot, leaf);
    }

    /**
     * @dev Emergency withdrawal (admin function)
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(
            token.transfer(owner(), _amount),
            "Transfer failed"
        );
    }

    /**
     * @dev Get round information
     */
    function getRoundInfo(uint256 _roundId)
        external
        view
        returns (
            bytes32 merkleRoot,
            uint256 startTime,
            uint256 endTime,
            uint256 totalAmount,
            uint256 claimedAmount,
            uint256 amountPerUser,
            bool isActive
        )
    {
        AirdropRound storage round = airdropRounds[_roundId];
        return (
            round.merkleRoot,
            round.startTime,
            round.endTime,
            round.totalAmount,
            round.claimedAmount,
            round.amountPerUser,
            round.isActive
        );
    }

    /**
     * @dev Get round status
     */
    function getRoundStatus(uint256 _roundId)
        external
        view
        returns (
            bool isActive,
            bool isStarted,
            bool isEnded,
            uint256 remainingAmount,
            uint256 progress
        )
    {
        AirdropRound storage round = airdropRounds[_roundId];
        isActive = round.isActive;
        isStarted = block.timestamp >= round.startTime;
        isEnded = block.timestamp > round.endTime;
        remainingAmount = round.totalAmount - round.claimedAmount;
        progress = round.totalAmount > 0 ? 
            (round.claimedAmount * 100) / round.totalAmount : 0;
        return (isActive, isStarted, isEnded, remainingAmount, progress);
    }
}
```

## System Architecture

### 1. Core Components

- Airdrop Contract: Manages token distribution
- Merkle Tree: Verifies whitelist eligibility
- Round Management: Controls airdrop phases
- Claim System: Handles user claims

### 2. Process Flow

1. Admin creates airdrop round
2. Users verify eligibility
3. Users claim tokens
4. System tracks distribution
5. Admin manages rounds

## Security Measures

### 1. Access Control

- Owner permissions
- Merkle proof verification
- Claim validation
- Amount limits

### 2. Distribution Security

- Batch processing
- Reentrancy protection
- Status tracking
- Emergency handling

## Best Practices

### 1. Implementation Guidelines

- Verify all inputs
- Implement proper access control
- Handle edge cases
- Maintain comprehensive logs

### 2. Operation Guidelines

- Regular security audits
- Round management
- Emergency response plan
- Regular status reviews

## FAQ

### 1. Basic Concepts

Q: What is a token airdrop?
A: A token airdrop is a distribution mechanism where tokens are sent to multiple wallet addresses, often used for community building and marketing.

Q: How does Merkle tree verification work?
A: Merkle tree verification involves:
- Creating a whitelist hash
- Generating proofs
- Verifying eligibility
- Preventing duplicates

### 2. Security

Q: How to ensure airdrop security?
A: Security measures include:
- Merkle verification
- Amount limits
- Time controls
- Access restrictions
- Regular audits

Q: How to prevent airdrop attacks?
A: Protection measures include:
- Whitelist verification
- Proof validation
- Rate limiting
- Amount caps
- Monitoring systems

### 3. Operations

Q: How to manage airdrops effectively?
A: Management strategies include:
- Round planning
- Clear documentation
- User communication
- Status monitoring
- Process automation

Q: How to handle distribution issues?
A: Issue resolution includes:
- Clear documentation
- Support system
- Backup plans
- Quick response
- Fair resolution

### 4. Maintenance

Q: How to maintain the airdrop system?
A: Maintenance includes:
- Regular updates
- Performance monitoring
- Security checks
- Configuration reviews
- User support

Q: How to monitor distribution progress?
A: Monitoring includes:
- Claim tracking
- Round status
- Distribution metrics
- Error logging
- Success rates