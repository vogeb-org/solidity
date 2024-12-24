# 代币投票系统

代币投票系统是一种基于代币持有量进行投票权重分配的治理机制，用于实现去中心化的社区决策。本教程将介绍如何实现一个安全可靠的投票系统。

## 功能特性

- 提案管理
- 投票权重
- 投票委托
- 提案执行
- 时间锁定

## 合约实现

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
 * @dev 代币投票合约实现
 */
contract TokenVoting is Ownable, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;
    using Timers for Timers.BlockNumber;

    // 提案状态
    enum ProposalState {
        Pending,    // 等待中
        Active,     // 活跃
        Canceled,   // 已取消
        Defeated,   // 已失败
        Succeeded,  // 已成功
        Queued,     // 已排队
        Expired,    // 已过期
        Executed    // 已执行
    }

    // 提案信息
    struct Proposal {
        uint256 id;                     // 提案ID
        address proposer;               // 提案人
        uint256 startBlock;            // 开始区块
        uint256 endBlock;              // 结束区块
        uint256 forVotes;              // 赞成票
        uint256 againstVotes;          // 反对票
        uint256 abstainVotes;          // 弃权票
        bool canceled;                 // 是否取消
        bool executed;                 // 是否执行
        mapping(address => Receipt) receipts;  // 投票记录
        bytes32 descriptionHash;       // 描述哈希
        bytes[] calldatas;            // 调用数据
        address[] targets;            // 目标合约
        uint256[] values;             // 调用金额
    }

    // 投票记录
    struct Receipt {
        bool hasVoted;                // 是否已投票
        uint8 support;                // 投票支持类型
        uint256 votes;                // 投票数量
    }

    // 投票配置
    struct VotingConfig {
        uint256 votingDelay;          // 投票延迟
        uint256 votingPeriod;         // 投票期限
        uint256 proposalThreshold;     // 提案门槛
        uint256 quorumNumerator;      // 法定人数分子
        uint256 executionDelay;       // 执行延迟
    }

    // 状态变量
    IERC20 public token;                           // 投票代币
    mapping(uint256 => Proposal) public proposals;  // 提案映射
    mapping(address => uint256) public delegateVotes;  // 委托投票权
    mapping(address => address) public delegates;      // 委托人映射
    VotingConfig public config;                     // 投票配置
    uint256 public proposalCount;                   // 提案计数
    bytes32 public constant DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,uint256 chainId,address verifyingContract)");
    bytes32 public constant BALLOT_TYPEHASH = keccak256("Ballot(uint256 proposalId,uint8 support)");
    string public constant name = "Token Voting";
    uint256 public constant QUORUM_DENOMINATOR = 100;

    // 事件
    event ProposalCreated(uint256 indexed proposalId, address indexed proposer);
    event ProposalCanceled(uint256 indexed proposalId);
    event ProposalExecuted(uint256 indexed proposalId);
    event VoteCast(address indexed voter, uint256 indexed proposalId, uint8 support, uint256 weight);
    event DelegateChanged(address indexed delegator, address indexed fromDelegate, address indexed toDelegate);
    event DelegateVotesChanged(address indexed delegate, uint256 previousBalance, uint256 newBalance);

    /**
     * @dev 构造函数
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
     * @dev 创建提案
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
     * @dev 投票
     */
    function castVote(uint256 proposalId, uint8 support) external {
        require(support <= 2, "Invalid vote type");
        return _castVote(msg.sender, proposalId, support);
    }

    /**
     * @dev 带签名的投票
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
     * @dev 执行投票
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
     * @dev 执行提案
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
     * @dev 取消提案
     */
    function cancel(uint256 proposalId) external {
        require(state(proposalId) != ProposalState.Executed, "Cannot cancel executed proposal");
        Proposal storage proposal = proposals[proposalId];
        require(msg.sender == proposal.proposer || getVotes(proposal.proposer) < config.proposalThreshold, "Cannot cancel");

        proposal.canceled = true;
        emit ProposalCanceled(proposalId);
    }

    /**
     * @dev 委托投票权
     */
    function delegate(address delegatee) external {
        return _delegate(msg.sender, delegatee);
    }

    /**
     * @dev 带签名的委托
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
     * @dev 内部委托函数
     */
    function _delegate(address delegator, address delegatee) internal {
        address currentDelegate = delegates[delegator];
        uint256 delegatorBalance = token.balanceOf(delegator);
        delegates[delegator] = delegatee;

        emit DelegateChanged(delegator, currentDelegate, delegatee);

        _moveDelegates(currentDelegate, delegatee, delegatorBalance);
    }

    /**
     * @dev 移动委托票数
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
     * @dev 获取提案状态
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
     * @dev 检查是否达到法定人数
     */
    function _quorumReached(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        uint256 totalSupply = token.totalSupply();
        uint256 quorum = totalSupply.mul(config.quorumNumerator).div(QUORUM_DENOMINATOR);
        return proposal.forVotes.add(proposal.againstVotes) >= quorum;
    }

    /**
     * @dev 检查投票是否成功
     */
    function _voteSucceeded(uint256 proposalId) internal view returns (bool) {
        Proposal storage proposal = proposals[proposalId];
        return proposal.forVotes > proposal.againstVotes;
    }

    /**
     * @dev 获取投票权重
     */
    function getVotes(address account) public view returns (uint256) {
        return delegateVotes[account];
    }

    /**
     * @dev 获取提案哈希
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
     * @dev 获取链ID
     */
    function getChainId() internal view returns (uint256) {
        uint256 chainId;
        assembly {
            chainId := chainid()
        }
        return chainId;
    }

    /**
     * @dev 更新配置
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
     * @dev 获取提案详情
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
     * @dev 获取投票记录
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

    // 用于签名投票的nonce
    mapping(address => uint256) public nonces;
}
```

## 关键概念

### 提案管理

提案系统支持：
- 提案创建
- 提案取消
- 提案执行
- 状态管理

### 投票机制

投票功能包括��
- 投票权重
- 投票委托
- 投票记录
- 结果统计

### 治理流程

治理过程包括：
- 提案期
- 投票期
- 执行期
- 冷却期

## 安全考虑

1. 投票安全
   - 权重验证
   - 重复投票检查
   - 时间控制
   - 签名验证

2. 提案安全
   - 门槛限制
   - 执行延迟
   - 取消机制
   - 状态检查

3. 系统安全
   - 权限管理
   - 重入防护
   - 参数验证
   - 紧急控制

4. 数据安全
   - 状态同步
   - 数据验证
   - 事件记录
   - 错误处理

## 最佳实践

1. 提案管理
   - 合理的门槛
   - 充分的讨论期
   - 适当的投票期
   - 安全的执行期

2. 投票管理
   - 透明的规则
   - 公平的权重
   - 便捷的操作
   - 完整的记录

3. 委托管理
   - 灵活的机制
   - 清晰的关系
   - 实时的更新
   - 安全的转移

4. 系统维护
   - 定期检查
   - 参数优化
   - 升级预案
   - 应急处理

## 扩展功能

1. 多签提案
2. 分级投票
3. 提案激励
4. 自动执行
5. 跨链投票

## 应用场景

1. 协议治理
   - 参数调整
   - 升级决策
   - 资金使用
   - 紧急处理

2. 社区管理
   - 提案投票
   - 资源分配
   - 规则制定
   - 权益分配

3. 项目决策
   - 发展方向
   - 合作伙伴
   - 激励方案
   - 生态建设

## 总结

代币投票系统是去中心化治理的核心机制。通过本教程，你可以：
- 实现完整的投票系统
- 确保治理安全性
- 优化用户体验
- 促进社区发展 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币投票？
A: 代币投票是一种去中心化治理机制，主要特点包括：
- 基于代币的投票权
- 提案创建和投票
- 自动执行机制
- 委托投票功能
- 时间锁定保护

Q: 投票系统有哪些组成部分？
A: 主要组成包括：
- 提案管理
- 投票机制
- 权重计算
- 执行系统
- 委托系统

### 2. 功能相关

Q: 如何创建提案？
A: 创建流程：
```solidity
function createProposal(
    string memory title,
    string memory description,
    address target,
    bytes memory data
) public returns (uint256) {
    // 1. 检查提案资格
    require(getVotingPower(msg.sender) >= proposalThreshold);
    
    // 2. 创建提案
    uint256 proposalId = proposalCount++;
    Proposal storage proposal = proposals[proposalId];
    
    // 3. 设置提案信息
    proposal.title = title;
    proposal.description = description;
    proposal.target = target;
    proposal.data = data;
    proposal.startTime = block.timestamp + votingDelay;
    proposal.endTime = proposal.startTime + votingPeriod;
    
    return proposalId;
}
```

Q: 如何进行投票？
A: 投票机制：
- 检查投票权
- 验证提案状态
- 记录投票选择
- 更新投票统计
- 触发相关事件

### 3. 安全相关

Q: 投票系统有什么风险？
A: 主要风险包括：
- 投票操纵
- 提案攻击
- 执行风险
- 时间攻击
- 委托风险

Q: 如何保护投票安全？
A: 安全措施包括：
- 投票门槛
- 时间锁定
- 权重验证
- 多重签名
- 紧急暂停

### 4. 优化相关

Q: 如何优化投票效率？
A: 优化策略：
- 批量投票
- 快照机制
- 存储优化
- Gas优化
- 并行处理

Q: 如何提高参与度？
A: 改进方案：
- 投票激励
- 界面优化
- 教育引导
- 社区参与
- 透明度提升

### 5. 实现细节

Q: 如何实现投票委托？
A: 实现机制：
```solidity
function delegate(
    address delegatee,
    uint256 amount
) internal {
    // 1. 更新委托记录
    delegations[msg.sender] = Delegation({
        delegatee: delegatee,
        amount: amount,
        timestamp: block.timestamp
    });
    
    // 2. 更新投票权
    votingPower[delegatee] += amount;
    votingPower[msg.sender] -= amount;
    
    // 3. 触发事件
    emit DelegationUpdated(msg.sender, delegatee, amount);
}
```

Q: 如何处理提案执行？
A: 处理机制：
- 结果验证
- 时间锁定
- 执行准备
- 状态更新
- 失败处理

### 6. 最佳实践

Q: 投票系统开发建议？
A: 开发建议：
- 完整测试
- 安全审计
- 社区反馈
- 渐进升级
- 应急预案

Q: 如何提高系统可靠性？
A: 改进方案：
- 故障检测
- 自动恢复
- 状态验证
- 日志记录
- 监控预警

### 7. 错误处理

Q: 常见错误及解决方案？
A: 错误类型：
- `"Invalid proposal"`: 检查提案
- `"Already voted"`: 验证状态
- `"Not enough votes"`: 检查权重
- `"Proposal expired"`: 检查时间
- `"Execution failed"`: 验证执行

Q: 如何处理异常情况？
A: 处理机制：
- 状态回滚
- 错误记录
- 通知机制
- 手动干预
- 补偿机制

### 8. 升级维护

Q: 如何升级投票系统？
A: 升级策略：
- 代理合约
- 数据迁移
- 兼容处理
- 测试验证
- 平滑过渡

Q: 如何监控系统状态？
A: 监控方案：
- 提案追踪
- 投票统计
- 参与度分析
- 异常检测
- 性能监控

### 9. 与其他系统集成

Q: 如何与DeFi协议集成？
A: 集成方案：
- 权重计算
- 收益分配
- 风险控制
- 状态同步
- 接口适配

Q: 如何实现跨链投票？
A: 实现策略：
- 跨链消息
- 状态同步
- 结果验证
- 安全保护
- 一致性维护