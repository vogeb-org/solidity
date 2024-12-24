# Token Voting System

The token voting system is a governance mechanism that allocates voting weight based on token holdings, used to implement decentralized community decision-making. This tutorial will explain how to implement a secure and reliable voting system.

## Features

- Proposal management
- Voting weight
- Vote delegation
- Proposal execution
- Time locking

## Contract Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Timers.sol";

/**
 * @title TokenVoting
 * @dev Token voting contract implementation
 */
contract TokenVoting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Timers for Timers.BlockNumber;

    // Proposal state
    enum ProposalState {
        Pending,    // Pending
        Active,     // Active
        Canceled,   // Canceled
        Defeated,   // Defeated
        Succeeded,  // Succeeded
        Queued,     // Queued
        Expired,    // Expired
        Executed    // Executed
    }

    // Proposal information
    struct Proposal {
        uint256 id;                     // Proposal ID
        address proposer;               // Proposer
        uint256 startBlock;            // Start block
        uint256 endBlock;              // End block
        uint256 forVotes;              // For votes
        uint256 againstVotes;          // Against votes
        uint256 abstainVotes;          // Abstain votes
        bool canceled;                 // Whether canceled
        bool executed;                 // Whether executed
        mapping(address => Receipt) receipts;  // Vote receipts
        bytes32 descriptionHash;       // Description hash
        bytes[] calldatas;            // Call data
        address[] targets;            // Target contracts
        uint256[] values;             // Call amounts
    }

    // Vote receipt
    struct Receipt {
        bool hasVoted;                // Whether voted
        uint8 support;                // Vote support type
        uint256 votes;                // Vote amount
    }

    // Voting configuration
    struct VotingConfig {
        uint256 votingDelay;          // Voting delay
        uint256 votingPeriod;         // Voting period
        uint256 proposalThreshold;     // Proposal threshold
        uint256 quorumNumerator;      // Quorum numerator
        uint256 executionDelay;       // Execution delay
    }

    // State variables
    IERC20 public token;                           // Voting token
    mapping(uint256 => Proposal) public proposals;  // Proposal mapping
    mapping(address => uint256) public delegateVotes;  // Delegated voting power
    mapping(address => address) public delegates;      // Delegate mapping
    VotingConfig public config;                     // Voting configuration
    uint256 public proposalCount;                   // Proposal count
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");
    string public constant name = "Token Voting";
    uint256 public constant QUORUM_DENOMINATOR = 100;

    // Events
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer);
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    /**
     * @dev Constructor
     */
    constructor(
        address _token,
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator,
        uint256 _executionDelay
    ) {
        require(_quorumNumerator <= QUORUM_DENOMINATOR, "Invalid quorum");
        
        token = IERC20(_token);
        config = VotingConfig({
            votingDelay: _votingDelay,
            votingPeriod: _votingPeriod,
            proposalThreshold: _proposalThreshold,
            quorumNumerator: _quorumNumerator,
            executionDelay: _executionDelay
        });
    }

    /**
     * @dev Create proposal
     */
    function propose(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        string memory description
    ) external returns (uint256) {
        require(
            getVotes(msg.sender) >= config.proposalThreshold,
            "Insufficient votes"
        );
        require(
            targets.length == values.length && targets.length == calldatas.length,
            "Invalid proposal"
        );

        uint256 proposalId = hashProposal(targets, values, calldatas, keccak256(bytes(description)));
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer == address(0), "Proposal exists");

        uint256 startBlock = block.number.add(config.votingDelay);
        uint256 endBlock = startBlock.add(config.votingPeriod);

        proposal.id = proposalId;
        proposal.proposer = msg.sender;
        proposal.startBlock = startBlock;
        proposal.endBlock = endBlock;
        proposal.targets = targets;
        proposal.values = values;
        proposal.calldatas = calldatas;
        proposal.descriptionHash = keccak256(bytes(description));

        proposalCount++;

        emit ProposalCreated(proposalId, msg.sender);
        return proposalId;
    }

    /**
     * @dev Cast vote
     */
    function castVote(uint256 proposalId, uint8 support) external {
        require(support <= 2, "Invalid vote type");
        return _castVote(msg.sender, proposalId, support);
    }

    /**
     * @dev Cast vote by signature
     */
    function castVoteBySig(
        uint256 proposalId,
        uint8 support,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode(BALLOT_TYPEHASH, proposalId, support));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid signature");
        return _castVote(signer, proposalId, support);
    }

    /**
     * @dev Execute vote
     */
    function _castVote(
        address voter,
        uint256 proposalId,
        uint8 support
    ) internal {
        require(state(proposalId) == ProposalState.Active, "Voting is closed");
        Proposal storage proposal = proposals[proposalId];
        Receipt storage receipt = proposal.receipts[voter];
        require(!receipt.hasVoted, "Already voted");

        uint256 votes = getVotes(voter);
        
        if (support == 0) {
            proposal.againstVotes = proposal.againstVotes.add(votes);
        } else if (support == 1) {
            proposal.forVotes = proposal.forVotes.add(votes);
        } else if (support == 2) {
            proposal.abstainVotes = proposal.abstainVotes.add(votes);
        }

        receipt.hasVoted = true;
        receipt.support = support;
        receipt.votes = votes;

        emit VoteCast(voter, proposalId, support, votes);
    }

    /**
     * @dev Execute proposal
     */
    function execute(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) external payable {
        uint256 proposalId = hashProposal(targets, values, calldatas, descriptionHash);
        require(state(proposalId) == ProposalState.Succeeded, "Proposal not succeeded");
        Proposal storage proposal = proposals[proposalId];
        proposal.executed = true;

        for (uint256 i = 0; i < targets.length; i++) {
            (bool success, ) = targets[i].call{value: values[i]}(calldatas[i]);
            require(success, "Transaction failed");
        }

        emit ProposalExecuted(proposalId);
    }

    /**
     * @dev Cancel proposal
     */
    function cancel(uint256 proposalId) external {
        require(state(proposalId) != ProposalState.Executed, "Cannot cancel executed proposal");
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer || getVotes(proposal.proposer) < config.proposalThreshold, "Cannot cancel");

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev Delegate voting power
     */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @dev Delegate by signature
     */
    function delegateBySig(
        address delegatee,
        uint256 nonce,
        uint256 expiry,
        uint8 v,
        bytes32 r,
        bytes32 s
    ) external {
        bytes32 domainSeparator = keccak256(abi.encode(DOMAIN_TYPEHASH, keccak256(bytes(name)), getChainId(), address(this)));
        bytes32 structHash = keccak256(abi.encode("Delegation(address delegatee,uint256 nonce,uint256 expiry)"));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
        address signer = ecrecover(digest, v, r, s);
        require(signer != address(0), "Invalid signature");
        require(nonce == nonces[signer]++, "Invalid nonce");
        require(block.timestamp <= expiry, "Signature expired");
        return _delegate(signer, delegatee);
    }

    /**
     * @dev Internal delegate function
     */
    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = token.balanceOf(delegator);
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    /**
     * @dev Move delegated voting power
     */
    function _moveDelegates(
        address srcRep,
        address dstRep,
        uint256 amount
    ) internal {
        if (srcRep != dstRep && amount > 0) {
            if (srcRep != address(0)) {
                uint256 srcRepOld = delegateVotes[srcRep];
                uint256 srcRepNew = srcRepOld.sub(amount);
                delegateVotes[srcRep] = srcRepNew;
                emit DelegateVotesChanged(srcRep, srcRepOld, srcRepNew);
            }

            if (dstRep != address(0)) {
                uint256 dstRepOld = delegateVotes[dstRep];
                uint256 dstRepNew = dstRepOld.add(amount);
                delegateVotes[dstRep] = dstRepNew;
                emit DelegateVotesChanged(dstRep, dstRepOld, dstRepNew);
            }
        }
    }

    /**
     * @dev Get proposal state
     */
    function state(uint256 proposalId) public view returns (ProposalState) {
        Proposal storage proposal = proposals[proposalId];
        require(proposal.proposer != address(0), "Unknown proposal");

        if (proposal.canceled) {
            return ProposalState.Canceled;
        }

        if (proposal.executed) {
            return ProposalState.Executed;
        }

        uint256 currentBlock = block.number;

        if (currentBlock < proposal.startBlock) {
            return ProposalState.Pending;
        }

        if (currentBlock <= proposal.endBlock) {
            return ProposalState.Active;
        }

        if (_quorumReached(proposalId) && _voteSucceeded(proposalId)) {
            if (currentBlock <= proposal.endBlock.add(config.executionDelay)) {
                return ProposalState.Queued;
            } else {
                return ProposalState.Expired;
            }
        }

        return ProposalState.Defeated;
    }

    /**
     * @dev Check if quorum is reached
     */
    function _quorumReached(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalSupply = token.totalSupply();
        uint256 quorum = totalSupply.mul(config.quorumNumerator).div(QUORUM_DENOMINATOR);
        return proposal.forVotes.add(proposal.againstVotes) >= quorum;
    }

    /**
     * @dev Check if vote succeeded
     */
    function _voteSucceeded(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        return proposal.forVotes > proposal.againstVotes;
    }

    /**
     * @dev Get voting weight
     */
    function getVotes(address account) public view returns (uint256) {
        return delegateVotes[account];
    }

    /**
     * @dev Get proposal hash
     */
    function hashProposal(
        address[] memory targets,
        uint256[] memory values,
        bytes[] memory calldatas,
        bytes32 descriptionHash
    ) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(targets, values, calldatas, descriptionHash)));
    }

    /**
     * @dev Get chain ID
     */
    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    /**
     * @dev Update configuration
     */
    function updateConfig(
        uint256 _votingDelay,
        uint256 _votingPeriod,
        uint256 _proposalThreshold,
        uint256 _quorumNumerator,
        uint256 _executionDelay
    ) external onlyOwner {
        require(_quorumNumerator <= QUORUM_DENOMINATOR, "Invalid quorum");
        
        config.votingDelay = _votingDelay;
        config.votingPeriod = _votingPeriod;
        config.proposalThreshold = _proposalThreshold;
        config.quorumNumerator = _quorumNumerator;
        config.executionDelay = _executionDelay;
    }

    /**
     * @dev Get proposal details
     */
    function getProposal(uint256 proposalId)
        external
        view
        returns (
            address proposer,
            uint256 startBlock,
            uint256 endBlock,
            uint256 forVotes,
            uint256 againstVotes,
            uint256 abstainVotes,
            bool canceled,
            bool executed,
            bytes32 descriptionHash
        )
    {
        Proposal storage proposal = proposals[proposalId];
        return (
            proposal.proposer,
            proposal.startBlock,
            proposal.endBlock,
            proposal.forVotes,
            proposal.againstVotes,
            proposal.abstainVotes,
            proposal.canceled,
            proposal.executed,
            proposal.descriptionHash
        );
    }

    /**
     * @dev Get vote receipt
     */
    function getReceipt(uint256 proposalId, address voter)
        external
        view
        returns (
            bool hasVoted,
            uint8 support,
            uint256 votes
        )
    {
        Receipt storage receipt = proposals[proposalId].receipts[voter];
        return (receipt.hasVoted, receipt.support, receipt.votes);
    }

    // Nonce for signature voting
    mapping(address => uint256) public nonces;
}
```

## Key Concepts

### Proposal Management

Proposal system supports:
- Proposal creation
- Proposal cancellation
- Proposal execution
- Status management

### Voting Mechanism

Voting features include:
- Voting weight
- Vote delegation
- Vote receipt
- Result statistics

### Governance Process

Governance process includes:
- Proposal period
- Voting period
- Execution period
- Cooling period

## Security Considerations

1. Voting security
   - Weight verification
   - Duplicate voting check
   - Time control
   - Signature verification

2. Proposal security
   - Threshold restriction
   - Execution delay
   - Cancellation mechanism
   - Status check

3. System security
   - Permission management
   - Reentrancy protection
   - Parameter validation
   - Emergency control

4. Data security
   - Status synchronization
   - Data verification
   - Event recording
   - Error handling

## Best Practices

1. Proposal management
   - Reasonable threshold
   - Sufficient discussion period
   - Appropriate voting period
   - Safe execution period

2. Voting management
   - Transparent rules
   - Fair weight allocation
   - Convenient operation
   - Complete record

3. Delegate management
   - Flexible mechanism
   - Clear relationship
   - Real-time update
   - Safe transfer

4. System maintenance
   - Regular check
   - Parameter optimization
   - Upgrade plan
   - Emergency handling

## Extended Features

1. Multisignature proposals
2. Hierarchical voting
3. Proposal incentives
4. Automatic execution
5. Cross-chain voting

## Application Scenarios

1. Protocol governance
   - Parameter adjustment
   - Upgrade decision
   - Fund usage
   - Emergency handling

2. Community management
   - Proposal voting
   - Resource allocation
   - Rule making
   - Equity distribution

3. Project decision
   - Development direction
   - Partner selection
   - Reward schemes
   - Ecosystem construction

## Summary

Token voting system is the core mechanism of decentralized governance. Through this tutorial, you can:
- Implement a complete voting system
- Ensure governance security
- Optimize user experience
- Promote community development 

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is token voting?
A: Token voting is a decentralized governance mechanism, characterized by:
- Voting power based on tokens
- Proposal creation and voting
- Automatic execution mechanism
- Vote delegation function
- Time locking protection

Q: What are the components of a voting system?
A: The main components include:
- Proposal management
- Voting mechanism
- Weight calculation
- Execution system
- Delegate system

### 2. Function-related

Q: How to create a proposal?
A: Proposal creation process:
```solidity
function createProposal(
    string memory title,
    string memory description,
    address target,
    bytes memory data
) public returns (uint256) {
    // 1. Check proposal eligibility
    require(getVotingPower(msg.sender) >= proposalThreshold);
    
    // 2. Create proposal
    uint256 proposalId = proposalCount++;
    Proposal storage proposal = proposals[proposalId];
    
    // 3. Set proposal information
    proposal.title = title;
    proposal.description = description;
    proposal.target = target;
    proposal.data = data;
    proposal.startTime = block.timestamp + votingDelay;
    proposal.endTime = proposal.startTime + votingPeriod;
    
    return proposalId;
}
```

Q: How to vote?
A: Voting mechanism:
- Check voting power
- Verify proposal status
- Record voting choice
- Update voting statistics
- Trigger related events

### 3. Security-related

Q: What are the risks of a voting system?
A: The main risks include:
- Vote manipulation
- Proposal attack
- Execution risk
- Time attack
- Delegate risk

Q: How to protect voting security?
A: Security measures include:
- Voting threshold
- Time locking
- Weight verification
- Multisignature
- Emergency pause

### 4. Optimization-related

Q: How to optimize voting efficiency?
A: Optimization strategies:
- Batch voting
- Snapshot mechanism
- Storage optimization
- Gas optimization
- Parallel processing

Q: How to increase participation?
A: Improvement strategies:
- Voting incentives
- Interface optimization
- Education guidance
- Community participation
- Transparency enhancement

### 5. Implementation details

Q: How to implement vote delegation?
A: Implementation mechanism:
```solidity
function delegate(
    address delegatee,
    uint256 amount
) internal {
    // 1. Update delegation record
    delegations[msg.sender] = Delegation({
        delegatee: delegatee,
        amount: amount,
        timestamp: block.timestamp
    });
    
    // 2. Update voting power
    votingPower[delegatee] += amount;
    votingPower[msg.sender] -= amount;
    
    // 3. Trigger event
    emit DelegationUpdated(msg.sender, delegatee, amount);
}
```

Q: How to handle proposal execution?
A: Execution handling:
- Result verification
- Time locking
- Execution preparation
- Status update
- Failure handling

### 6. Best Practices

Q: Voting system development suggestions?
A: Development suggestions:
- Complete testing
- Security audit
- Community feedback
- Gradual upgrade
- Emergency预案

Q: How to improve system reliability?
A: Improvement strategies:
- Fault detection
- Automatic recovery
- Status verification
- Logging
- Monitoring and alerting

### 7. Error Handling

Q: Common errors and solutions?
A: Error types:
- `"Invalid proposal"`: Check proposal
- `"Already voted"`: Verify status
- `"Not enough votes"`: Check voting power
- `"Proposal expired"`: Check time
- `"Execution failed"`: Verify execution

Q: How to handle exceptional situations?
A: Handling mechanisms:
- Status rollback
- Error logging
- Notification mechanism
- Manual intervention
- Compensation mechanism

### 8. Upgrade and Maintenance

Q: How to upgrade the voting system?
A: Upgrade strategies:
- Proxy contract
- Data migration
- Compatibility handling
- Testing and verification
- Smooth transition

Q: How to monitor system status?
A: Monitoring strategies:
- Proposal tracking
- Voting statistics
- Participation analysis
- Exception detection
- Performance monitoring

### 9. Integration with Other Systems

Q: How to integrate with DeFi protocols?
A: Integration strategies:
- Weight calculation
- Revenue distribution
- Risk control
- Status synchronization
- Interface adaptation

Q: How to implement cross-chain voting?
A: Implementation strategies:
- Cross-chain messages
- Status synchronization
- Result verification
- Security protection
- Consistency maintenance