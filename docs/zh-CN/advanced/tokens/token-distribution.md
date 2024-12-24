# 代币分发系统

代币分发系统是一种用于管理代币分配和发放的机制。本教程将介绍如何实现一个安全可靠的代币分发系统。

## 功能特性

- 分发管理
- 批量发放
- 锁定机制
- 权限控制
- 紧急处理

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TokenDistribution
 * @dev 代币分发合约实现
 */
contract TokenDistribution is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // 分发计划
    struct Distribution {
        uint256 amount;          // 分发数量
        uint256 startTime;       // 开始时间
        uint256 duration;        // 持续时间
        uint256 interval;        // 释放间隔
        uint256 released;        // 已释放数量
        bool isActive;           // 是否激活
    }

    // 接收者信息
    struct Recipient {
        uint256 totalAmount;     // 总分配数量
        uint256 releasedAmount;  // 已释放数量
        uint256 lastRelease;     // 上次释放时间
        bool isActive;           // 是否激活
    }

    // 配置信息
    struct DistributionConfig {
        uint256 minAmount;       // 最小分配
        uint256 maxAmount;       // 最大分配
        uint256 minDuration;     // 最小周期
        uint256 maxDuration;     // 最大周期
        bool requiresApproval;   // 是否需要审批
        bool isActive;          // 是否激活
    }

    // 状态变量
    IERC20 public token;                                     // 代币合约
    mapping(bytes32 => Distribution) public distributions;    // 分发计划
    mapping(bytes32 => mapping(address => Recipient)) public recipients;  // 接收者信息
    mapping(address => bool) public operators;               // 操作员
    DistributionConfig public config;                       // 配置信息

    // 事件
    event DistributionCreated(bytes32 indexed id, uint256 amount, uint256 startTime, uint256 duration);
    event DistributionUpdated(bytes32 indexed id, bool isActive);
    event TokensDistributed(bytes32 indexed id, address indexed recipient, uint256 amount);
    event RecipientUpdated(bytes32 indexed id, address indexed recipient, uint256 amount, bool isActive);
    event OperatorUpdated(address indexed operator, bool status);
    event ConfigUpdated(uint256 minAmount, uint256 maxAmount, uint256 minDuration, uint256 maxDuration);

    /**
     * @dev 构造函数
     */
    constructor(
        address _token,
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minDuration,
        uint256 _maxDuration
    ) {
        require(_token != address(0), "Invalid token");
        token = IERC20(_token);
        config = DistributionConfig({
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            minDuration: _minDuration,
            maxDuration: _maxDuration,
            requiresApproval: true,
            isActive: true
        });
    }

    /**
     * @dev 创建分发计划
     */
    function createDistribution(
        uint256 _amount,
        uint256 _startTime,
        uint256 _duration,
        uint256 _interval
    ) external onlyOperator whenNotPaused returns (bytes32) {
        require(config.isActive, "Distribution not active");
        require(_amount >= config.minAmount && _amount <= config.maxAmount, "Invalid amount");
        require(_duration >= config.minDuration && _duration <= config.maxDuration, "Invalid duration");
        require(_interval > 0 && _interval <= _duration, "Invalid interval");
        require(_startTime >= block.timestamp, "Invalid start time");

        bytes32 id = keccak256(abi.encodePacked(
            block.timestamp,
            _amount,
            _startTime,
            _duration,
            _interval
        ));

        distributions[id] = Distribution({
            amount: _amount,
            startTime: _startTime,
            duration: _duration,
            interval: _interval,
            released: 0,
            isActive: true
        });

        emit DistributionCreated(id, _amount, _startTime, _duration);
        return id;
    }

    /**
     * @dev 添加接收者
     */
    function addRecipient(
        bytes32 _id,
        address _recipient,
        uint256 _amount
    ) external onlyOperator {
        require(_recipient != address(0), "Invalid recipient");
        Distribution storage dist = distributions[_id];
        require(dist.isActive, "Distribution not active");
        require(dist.released.add(_amount) <= dist.amount, "Exceeds distribution amount");

        recipients[_id][_recipient] = Recipient({
            totalAmount: _amount,
            releasedAmount: 0,
            lastRelease: 0,
            isActive: true
        });

        emit RecipientUpdated(_id, _recipient, _amount, true);
    }

    /**
     * @dev 批量添加接收者
     */
    function addRecipients(
        bytes32 _id,
        address[] calldata _recipients,
        uint256[] calldata _amounts
    ) external onlyOperator {
        require(_recipients.length == _amounts.length, "Length mismatch");
        Distribution storage dist = distributions[_id];
        require(dist.isActive, "Distribution not active");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount = totalAmount.add(_amounts[i]);
        }
        require(dist.released.add(totalAmount) <= dist.amount, "Exceeds distribution amount");

        for (uint256 i = 0; i < _recipients.length; i++) {
            address recipient = _recipients[i];
            uint256 amount = _amounts[i];
            require(recipient != address(0), "Invalid recipient");

            recipients[_id][recipient] = Recipient({
                totalAmount: amount,
                releasedAmount: 0,
                lastRelease: 0,
                isActive: true
            });

            emit RecipientUpdated(_id, recipient, amount, true);
        }
    }

    /**
     * @dev 释放代币
     */
    function release(
        bytes32 _id,
        address _recipient
    ) external nonReentrant whenNotPaused returns (uint256) {
        Distribution storage dist = distributions[_id];
        require(dist.isActive, "Distribution not active");
        require(block.timestamp >= dist.startTime, "Not started");

        Recipient storage recipient = recipients[_id][_recipient];
        require(recipient.isActive, "Recipient not active");

        uint256 releasable = getReleasableAmount(_id, _recipient);
        require(releasable > 0, "No tokens to release");

        recipient.releasedAmount = recipient.releasedAmount.add(releasable);
        recipient.lastRelease = block.timestamp;
        dist.released = dist.released.add(releasable);

        require(
            token.transfer(_recipient, releasable),
            "Transfer failed"
        );

        emit TokensDistributed(_id, _recipient, releasable);
        return releasable;
    }

    /**
     * @dev 批量释放代币
     */
    function batchRelease(
        bytes32 _id,
        address[] calldata _recipients
    ) external nonReentrant whenNotPaused returns (uint256) {
        uint256 totalReleased = 0;
        for (uint256 i = 0; i < _recipients.length; i++) {
            uint256 released = release(_id, _recipients[i]);
            totalReleased = totalReleased.add(released);
        }
        return totalReleased;
    }

    /**
     * @dev 计算可释放数量
     */
    function getReleasableAmount(
        bytes32 _id,
        address _recipient
    ) public view returns (uint256) {
        Distribution storage dist = distributions[_id];
        Recipient storage recipient = recipients[_id][_recipient];

        if (!dist.isActive || !recipient.isActive || block.timestamp < dist.startTime) {
            return 0;
        }

        uint256 elapsedTime = block.timestamp.sub(dist.startTime);
        if (elapsedTime > dist.duration) {
            elapsedTime = dist.duration;
        }

        uint256 periods = elapsedTime.div(dist.interval);
        uint256 totalVested = recipient.totalAmount.mul(periods).mul(dist.interval).div(dist.duration);
        return totalVested.sub(recipient.releasedAmount);
    }

    /**
     * @dev 更新分发状态
     */
    function updateDistributionStatus(bytes32 _id, bool _isActive) external onlyOwner {
        distributions[_id].isActive = _isActive;
        emit DistributionUpdated(_id, _isActive);
    }

    /**
     * @dev 更新接收者状态
     */
    function updateRecipientStatus(
        bytes32 _id,
        address _recipient,
        bool _isActive
    ) external onlyOperator {
        recipients[_id][_recipient].isActive = _isActive;
        emit RecipientUpdated(_id, _recipient, recipients[_id][_recipient].totalAmount, _isActive);
    }

    /**
     * @dev 更新操作员
     */
    function updateOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /**
     * @dev 更新配置
     */
    function updateConfig(
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minDuration,
        uint256 _maxDuration
    ) external onlyOwner {
        require(_minAmount <= _maxAmount, "Invalid amounts");
        require(_minDuration <= _maxDuration, "Invalid durations");
        config.minAmount = _minAmount;
        config.maxAmount = _maxAmount;
        config.minDuration = _minDuration;
        config.maxDuration = _maxDuration;
        emit ConfigUpdated(_minAmount, _maxAmount, _minDuration, _maxDuration);
    }

    /**
     * @dev 暂停分发
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复分发
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 紧急提取
     */
    function emergencyWithdraw() external onlyOwner {
        uint256 balance = token.balanceOf(address(this));
        require(balance > 0, "No balance");
        require(token.transfer(owner(), balance), "Transfer failed");
    }

    /**
     * @dev 检查操作员权限
     */
    modifier onlyOperator() {
        require(operators[msg.sender] || owner() == msg.sender, "Not operator");
        _;
    }

    /**
     * @dev 更新分发计划
     */
    function updateDistribution(
        bytes32 _id,
        bool _isActive
    ) external onlyOperator whenNotPaused {
        Distribution storage dist = distributions[_id];
        require(dist.amount > 0, "Distribution not found");
        dist.isActive = _isActive;
        emit DistributionUpdated(_id, _isActive);
    }

    /**
     * @dev 更新接收者状态
     */
    function updateRecipient(
        bytes32 _id,
        address _recipient,
        bool _isActive
    ) external onlyOperator whenNotPaused {
        Recipient storage recipient = recipients[_id][_recipient];
        require(recipient.totalAmount > 0, "Recipient not found");
        recipient.isActive = _isActive;
        emit RecipientUpdated(_id, _recipient, recipient.totalAmount, _isActive);
    }

    /**
     * @dev 获取分发计划信息
     */
    function getDistributionInfo(
        bytes32 _id
    ) external view returns (
        uint256 amount,
        uint256 startTime,
        uint256 duration,
        uint256 interval,
        uint256 released,
        bool isActive
    ) {
        Distribution storage dist = distributions[_id];
        return (
            dist.amount,
            dist.startTime,
            dist.duration,
            dist.interval,
            dist.released,
            dist.isActive
        );
    }

    /**
     * @dev 获取接收者信息
     */
    function getRecipientInfo(
        bytes32 _id,
        address _recipient
    ) external view returns (
        uint256 totalAmount,
        uint256 releasedAmount,
        uint256 lastRelease,
        bool isActive
    ) {
        Recipient storage recipient = recipients[_id][_recipient];
        return (
            recipient.totalAmount,
            recipient.releasedAmount,
            recipient.lastRelease,
            recipient.isActive
        );
    }

    /**
     * @dev 设置操作员
     */
    function setOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /**
     * @dev 更新配置
     */
    function updateConfig(
        uint256 _minAmount,
        uint256 _maxAmount,
        uint256 _minDuration,
        uint256 _maxDuration,
        bool _requiresApproval
    ) external onlyOwner {
        require(_maxAmount > _minAmount, "Invalid amounts");
        require(_maxDuration > _minDuration, "Invalid durations");

        config.minAmount = _minAmount;
        config.maxAmount = _maxAmount;
        config.minDuration = _minDuration;
        config.maxDuration = _maxDuration;
        config.requiresApproval = _requiresApproval;

        emit ConfigUpdated(_minAmount, _maxAmount, _minDuration, _maxDuration);
    }

    /**
     * @dev 设置分发系统状态
     */
    function setActive(bool _isActive) external onlyOwner {
        config.isActive = _isActive;
    }

    /**
     * @dev 暂停/恢复合约
     */
    function setPaused(bool _paused) external onlyOwner {
        if (_paused) {
            _pause();
        } else {
            _unpause();
        }
    }

    /**
     * @dev 紧急提取
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(token), "Cannot withdraw distribution token");
        require(_to != address(0), "Invalid recipient");
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev 检查是否是操作员
     */
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }
}
```

## 关键概念

### 分发管理

分发功能包括：
- 计划创建
- 批量分发
- 释放控制
- 状态管理

### 接收者管理

接收者功能包括：
- 信息记录
- 余额追踪
- 释放计算
- 状态控制

### 安全控制

安全功能包括：
- 权限管理
- 暂停机制
- 紧急提取
- 状态验证

## 安全考虑

1. 分发安全
   - 数量验证
   - 时间控制
   - 状态检查
   - 异常处理

2. 接收者安全
   - 地址验证
   - 余额检查
   - 释放控制
   - 状态保护

3. 系统安全
   - 权限控制
   - 暂停机制
   - 重入防护
   - 状态同步

4. 升级安全
   - 配置更新
   - 计划调整
   - 状态迁移
   - 紧急处理

## 最佳实践

1. 分发管理
   - 合理计划
   - 动态调整
   - 批量处理
   - 异常处理

2. 接收者管理
   - 信息验证
   - 状态追踪
   - 余额核对
   - 释放控制

3. 风险管理
   - 计划监控
   - 异常检测
   - 风险预警
   - 应急处理

4. 系统维护
   - 参数优化
   - 性能监控
   - 安全审计
   - 升级预案

## 扩展功能

1. 动态分发
2. 多币种支持
3. 条件释放
4. 投票权重
5. 分发策略

## 应用场景

1. 代币分发
   - 团队激励
   - 社区奖励
   - 生态建设
   - 市场营销

2. 资金管理
   - 预算控制
   - 资金分配
   - 支出管理
   - 财务审计

3. 治理机制
   - 权益分配
   - 投票权重
   - 激励机制
   - 社区建设

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币分发？**

A: 代币分发是一种代币分配机制，主要特点包括：
- 多方分配
- 公平分配
- 透明记录
- 自动执行
- 灵活配置

**Q: 分发系统有哪些类型？**

A: 主要类型包括：
- 空投分发
- 线性分发
- 批量分发
- 条件分发
- 混合分发

### 操作相关

**Q: 如何设计分发方案？**

A: 设计要点包括：
- 确定分发总量
- 设置分发规则
- 配置时间表
- 选择分发方式
- 设置验证条件

**Q: 如何执行分发操作？**

A: 执行步骤包括：
- 准备代币
- 验证地址
- 确认数量
- 执行分发
- 记录结果

### 安全相关

**Q: 分发系统有哪些风险？**

A: 主要风险包括：
- 地址错误
- 数量计算错误
- 重复分发
- 合约漏洞
- 操作失误

**Q: 如何确保分发安全？**

A: 安全措施包括：
- 多重验证
- 批次控制
- 地址检查
- 金额限制
- 完整日志