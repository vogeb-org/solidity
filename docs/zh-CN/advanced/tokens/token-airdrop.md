# 代币空投系统

代币空投是项目方向社区分发代币的重要方式，可以实现快速且公平的代币分配。本教程将介绍如何实现一个高效的代币空投系统。

## 功能特性

- Merkle树白名单验证
- 批量空投支持
- 多轮次空投
- 额度控制机制
- 防女巫攻击

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/**
 * @title TokenAirdrop
 * @dev 代币空投合约实现
 */
contract TokenAirdrop is Ownable, ReentrancyGuard {
    // 空投轮次信息
    struct AirdropRound {
        bytes32 merkleRoot;        // Merkle树根
        uint256 startTime;         // 开始时间
        uint256 endTime;           // 结束时间
        uint256 totalAmount;       // 总空投量
        uint256 claimedAmount;     // 已领取量
        uint256 amountPerUser;     // 每用户空投量
        bool isActive;             // 是否激活
    }

    // 空投代币
    IERC20 public token;
    
    // 轮次映射
    mapping(uint256 => AirdropRound) public airdropRounds;
    // 用户领取记录 roundId => user => claimed
    mapping(uint256 => mapping(address => bool)) public claimed;
    // 当前轮次ID
    uint256 public currentRoundId;
    
    // 事件
    event RoundCreated(uint256 indexed roundId, uint256 startTime, uint256 endTime, uint256 totalAmount);
    event TokensClaimed(uint256 indexed roundId, address indexed user, uint256 amount);
    event RoundStatusUpdated(uint256 indexed roundId, bool isActive);
    event BatchAirdropExecuted(uint256 indexed roundId, uint256 usersCount);

    constructor(address _token) {
        token = IERC20(_token);
    }

    /**
     * @dev 创建新的空投轮次
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
     * @dev 用户领取空投
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
        
        // 验证Merkle证明
        bytes32 leaf = keccak256(abi.encodePacked(msg.sender));
        require(
            MerkleProof.verify(_merkleProof, round.merkleRoot, leaf),
            "Invalid proof"
        );
        
        // 检查剩余空投量
        require(
            round.claimedAmount + round.amountPerUser <= round.totalAmount,
            "Insufficient remaining tokens"
        );
        
        // 更新状态
        claimed[_roundId][msg.sender] = true;
        round.claimedAmount += round.amountPerUser;
        
        // 转账代币
        require(
            token.transfer(msg.sender, round.amountPerUser),
            "Transfer failed"
        );
        
        emit TokensClaimed(_roundId, msg.sender, round.amountPerUser);
    }

    /**
     * @dev 批量执行空投（管理员功能）
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
     * @dev 更新轮次状态
     */
    function updateRoundStatus(
        uint256 _roundId,
        bool _isActive
    ) external onlyOwner {
        airdropRounds[_roundId].isActive = _isActive;
        emit RoundStatusUpdated(_roundId, _isActive);
    }

    /**
     * @dev 检查用户是否可以领取空投
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
     * @dev 紧急提取（管理员功能）
     */
    function emergencyWithdraw(uint256 _amount) external onlyOwner {
        require(
            token.transfer(owner(), _amount),
            "Transfer failed"
        );
    }

    /**
     * @dev 获取轮次信息
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
     * @dev 获取轮次状态
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
    }

    /**
     * @dev 批量检查用户领取状态
     */
    function batchCheckClaimed(
        uint256 _roundId,
        address[] calldata _users
    ) external view returns (bool[] memory) {
        bool[] memory results = new bool[](_users.length);
        for (uint256 i = 0; i < _users.length; i++) {
            results[i] = claimed[_roundId][_users[i]];
        }
        return results;
    }

    /**
     * @dev 更新每用户空投量
     */
    function updateAmountPerUser(
        uint256 _roundId,
        uint256 _newAmount
    ) external onlyOwner {
        require(_newAmount > 0, "Invalid amount");
        AirdropRound storage round = airdropRounds[_roundId];
        require(round.isActive, "Round not active");
        require(round.claimedAmount == 0, "Round already started");
        
        round.amountPerUser = _newAmount;
    }

    /**
     * @dev 更新轮次时间
     */
    function updateRoundTime(
        uint256 _roundId,
        uint256 _newStartTime,
        uint256 _newEndTime
    ) external onlyOwner {
        require(_newStartTime < _newEndTime, "Invalid time range");
        AirdropRound storage round = airdropRounds[_roundId];
        require(round.isActive, "Round not active");
        require(round.claimedAmount == 0, "Round already started");
        
        round.startTime = _newStartTime;
        round.endTime = _newEndTime;
    }

    /**
     * @dev 更新Merkle根
     */
    function updateMerkleRoot(
        uint256 _roundId,
        bytes32 _newMerkleRoot
    ) external onlyOwner {
        AirdropRound storage round = airdropRounds[_roundId];
        require(round.isActive, "Round not active");
        require(round.claimedAmount == 0, "Round already started");
        
        round.merkleRoot = _newMerkleRoot;
    }
}

/**
 * @title AirdropHelper
 * @dev 空投辅助合约，用于生成Merkle树
 */
contract AirdropHelper {
    /**
     * @dev 生成单个地址的叶子节点
     */
    function getLeaf(address _account) public pure returns (bytes32) {
        return keccak256(abi.encodePacked(_account));
    }

    /**
     * @dev 生成多个地址的叶子节点数组
     */
    function getLeaves(address[] calldata _accounts) external pure returns (bytes32[] memory) {
        bytes32[] memory leaves = new bytes32[](_accounts.length);
        for (uint256 i = 0; i < _accounts.length; i++) {
            leaves[i] = getLeaf(_accounts[i]);
        }
        return leaves;
    }

    /**
     * @dev 验证Merkle证明
     */
    function verifyProof(
        bytes32[] calldata _proof,
        bytes32 _root,
        address _account
    ) external pure returns (bool) {
        bytes32 leaf = getLeaf(_account);
        return MerkleProof.verify(_proof, _root, leaf);
    }

    /**
     * @dev 生成多个地址的Merkle树根
     */
    function getMerkleRoot(address[] calldata _accounts) external pure returns (bytes32) {
        require(_accounts.length > 0, "Empty accounts");
        
        bytes32[] memory leaves = new bytes32[](_accounts.length);
        for (uint256 i = 0; i < _accounts.length; i++) {
            leaves[i] = getLeaf(_accounts[i]);
        }
        
        while (leaves.length > 1) {
            if (leaves.length % 2 == 1) {
                bytes32[] memory newLeaves = new bytes32[](leaves.length + 1);
                for (uint256 i = 0; i < leaves.length; i++) {
                    newLeaves[i] = leaves[i];
                }
                newLeaves[leaves.length] = leaves[leaves.length - 1];
                leaves = newLeaves;
            }
            
            bytes32[] memory parents = new bytes32[](leaves.length / 2);
            for (uint256 i = 0; i < parents.length; i++) {
                parents[i] = keccak256(abi.encodePacked(
                    leaves[i * 2],
                    leaves[i * 2 + 1]
                ));
            }
            leaves = parents;
        }
        
        return leaves[0];
    }
}
```

## 关键概念

### Merkle树验证

白名单验证机制：
- 链下生成Merkle树
- 链上存储根哈希
- 用户提供证明
- 高效的验证过程

### 轮次管理

空投轮次特性：
- 时间窗口控制
- 总量和单用户限额
- 活动状态管理
- 进度追踪

### 批量操作

批量空投功能：
- 节省Gas费用
- 提高效率
- 自动跳过重复地址

## 安全考虑

1. 白名单验证
   - Merkle树验证
   - 防重复领取
   - 地址验证

2. 额度控制
   - 总量限制
   - 单用户限额
   - 余额检查

3. 时间控制
   - 开始和结束时间
   - 状态检查
   - 轮次管理

4. 权限管理
   - 管理员功能
   - 紧急操作
   - 状态更新

## 最佳实践

1. 空投策略
   - 合理的分配方案
   - 公平的规则设计
   - 防女巫攻击

2. Gas优化
   - 批量处理
   - 数据压缩
   - 存储优化

3. 用户体验
   - 简单的验证流程
   - 清晰的状态展示
   - 友好的错误提示

4. 运营管理
   - 活动监控
   - 数据分析
   - 异常处理

## 扩展功能

1. 多代币空投
2. 动态额度
3. 社交验证
4. 任务系统
5. 推荐奖励

## 应用场景

1. 社区激励
   - 早期用户奖励
   - 忠实用户回馈
   - 生态建设激励

2. 营销活动
   - 新项目启动
   - 用户引流
   - 品牌推广

3. 治理参与
   - 投票权分发
   - 社区决策
   - 权益分配

## 总结

代币空投系统是项目运营的重要工具。通过本教程，你可以：
- 实现高效的代币分发
- 确保公平和安全
- 优化Gas使用
- 提升用户体验 

## 常见问题解答（FAQ）

**Q: 什么是代币空投？**

A: 代币空投是一种代币分发机制，主要特点包括：
- 免费代币分发
- 社区激励机制
- 用户增长策略
- 生态建设工具
- 市场营销手段

**Q: 空投有哪些类型？**

A: 主要类型包括：
- 普通空投
- 条件空投
- 任务空投
- 社交空投
- 合作空投

**Q: 如何设计空投方案？**

A: 设计要点包括：
- 目标用户群体
- 分发数量设置
- 领取条件制定
- 时间安排规划
- 防作弊机制

**Q: 如何防止女巫攻击？**

A: 防护措施包括：
- 身份验证要求
- 活动历史检查
- 地址行为分析
- 条件门槛设置
- 多重验证机制

**Q: 如何优化Gas成本？**

A: 优化方法包括：
- 批量处理交易
- Merkle树验证
- 数据压缩存储
- 链下计算验证
- 智能合约优化

**Q: 如何提高用户参与度？**

A: 提升策略包括：
- 简化领取流程
- 提供清晰指引
- 设置合理奖励
- 加强社区互动
- 优化用户体验

**Q: 如何处理异常情况？**

A: 处理方法包括：
- 设置应急机制
- 准备备用方案
- 建立反馈渠道
- 提供技术支持
- 记录完整日志

**Q: 如何评估空投效果？**

A: 评估指标包括：
- 参与率统计
- 用户留存分析
- 社区增长数据
- 代币流通情况
- 生态发展影响