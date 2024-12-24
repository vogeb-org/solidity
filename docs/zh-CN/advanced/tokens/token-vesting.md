# 代币归属系统

代币归属系统是一种用于管理代币逐步释放的机制。本教程将介绍如何实现一个安全可靠的代币归属系统。

## 功能特性

- 归属计划
- 线性释放
- 分期释放
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
 * @title TokenVesting
 * @dev 代币归属合约实现
 */
contract TokenVesting is Ownable, ReentrancyGuard, Pausable {
    using SafeMath for uint256;

    // 归属计划
    struct VestingSchedule {
        uint256 totalAmount;      // 总数量
        uint256 startTime;        // 开始时间
        uint256 cliffDuration;    // 锁定期
        uint256 duration;         // 归属期
        uint256 interval;         // 释放间隔
        uint256 released;         // 已释放
        bool isRevocable;         // 是否可撤销
        bool isRevoked;           // 是否已撤销
        bool isActive;            // 是否激活
    }

    // 受益人信息
    struct Beneficiary {
        uint256 totalAmount;      // 总数量
        uint256 releasedAmount;   // 已释放
        uint256 lastRelease;      // 上次释放
        bool isActive;            // 是否激活
    }

    // 配置信息
    struct VestingConfig {
        uint256 minAmount;        // 最小数量
        uint256 maxAmount;        // 最大数量
        uint256 minDuration;      // 最小周期
        uint256 maxDuration;      // 最大周期
        bool requiresApproval;    // 是否需要审批
        bool isActive;            // 是否激活
    }

    // 状态变量
    IERC20 public token;                                     // 代币合约
    mapping(bytes32 => VestingSchedule) public schedules;    // 归属计划
    mapping(bytes32 => mapping(address => Beneficiary)) public beneficiaries;  // 受益人信息
    mapping(address => bool) public operators;               // 操作员
    VestingConfig public config;                            // 配置信息

    // 事件
    event ScheduleCreated(bytes32 indexed id, uint256 totalAmount, uint256 startTime, uint256 duration);
    event ScheduleRevoked(bytes32 indexed id);
    event TokensReleased(bytes32 indexed id, address indexed beneficiary, uint256 amount);
    event BeneficiaryUpdated(bytes32 indexed id, address indexed beneficiary, uint256 amount, bool isActive);
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
        config = VestingConfig({
            minAmount: _minAmount,
            maxAmount: _maxAmount,
            minDuration: _minDuration,
            maxDuration: _maxDuration,
            requiresApproval: true,
            isActive: true
        });
    }

    /**
     * @dev 创建归属计划
     */
    function createSchedule(
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _cliffDuration,
        uint256 _duration,
        uint256 _interval,
        bool _isRevocable
    ) external onlyOperator whenNotPaused returns (bytes32) {
        require(config.isActive, "Vesting not active");
        require(_totalAmount >= config.minAmount && _totalAmount <= config.maxAmount, "Invalid amount");
        require(_duration >= config.minDuration && _duration <= config.maxDuration, "Invalid duration");
        require(_interval > 0 && _interval <= _duration, "Invalid interval");
        require(_startTime >= block.timestamp, "Invalid start time");
        require(_cliffDuration <= _duration, "Invalid cliff duration");

        bytes32 id = keccak256(abi.encodePacked(
            block.timestamp,
            _totalAmount,
            _startTime,
            _duration,
            _interval
        ));

        schedules[id] = VestingSchedule({
            totalAmount: _totalAmount,
            startTime: _startTime,
            cliffDuration: _cliffDuration,
            duration: _duration,
            interval: _interval,
            released: 0,
            isRevocable: _isRevocable,
            isRevoked: false,
            isActive: true
        });

        emit ScheduleCreated(id, _totalAmount, _startTime, _duration);
        return id;
    }

    /**
     * @dev 添加受益人
     */
    function addBeneficiary(
        bytes32 _id,
        address _beneficiary,
        uint256 _amount
    ) external onlyOperator {
        require(_beneficiary != address(0), "Invalid beneficiary");
        VestingSchedule storage schedule = schedules[_id];
        require(schedule.isActive && !schedule.isRevoked, "Schedule not active");
        require(schedule.released.add(_amount) <= schedule.totalAmount, "Exceeds total amount");

        beneficiaries[_id][_beneficiary] = Beneficiary({
            totalAmount: _amount,
            releasedAmount: 0,
            lastRelease: 0,
            isActive: true
        });

        emit BeneficiaryUpdated(_id, _beneficiary, _amount, true);
    }

    /**
     * @dev 批量添加受益人
     */
    function addBeneficiaries(
        bytes32 _id,
        address[] calldata _beneficiaries,
        uint256[] calldata _amounts
    ) external onlyOperator {
        require(_beneficiaries.length == _amounts.length, "Length mismatch");
        VestingSchedule storage schedule = schedules[_id];
        require(schedule.isActive && !schedule.isRevoked, "Schedule not active");

        uint256 totalAmount = 0;
        for (uint256 i = 0; i < _amounts.length; i++) {
            totalAmount = totalAmount.add(_amounts[i]);
        }
        require(schedule.released.add(totalAmount) <= schedule.totalAmount, "Exceeds total amount");

        for (uint256 i = 0; i < _beneficiaries.length; i++) {
            address beneficiary = _beneficiaries[i];
            uint256 amount = _amounts[i];
            require(beneficiary != address(0), "Invalid beneficiary");

            beneficiaries[_id][beneficiary] = Beneficiary({
                totalAmount: amount,
                releasedAmount: 0,
                lastRelease: 0,
                isActive: true
            });

            emit BeneficiaryUpdated(_id, beneficiary, amount, true);
        }
    }

    /**
     * @dev 释放代币
     */
    function release(
        bytes32 _id,
        address _beneficiary
    ) external nonReentrant whenNotPaused returns (uint256) {
        VestingSchedule storage schedule = schedules[_id];
        require(schedule.isActive && !schedule.isRevoked, "Schedule not active");
        require(block.timestamp >= schedule.startTime.add(schedule.cliffDuration), "Still in cliff period");

        Beneficiary storage beneficiary = beneficiaries[_id][_beneficiary];
        require(beneficiary.isActive, "Beneficiary not active");

        uint256 releasable = getReleasableAmount(_id, _beneficiary);
        require(releasable > 0, "No tokens to release");

        beneficiary.releasedAmount = beneficiary.releasedAmount.add(releasable);
        beneficiary.lastRelease = block.timestamp;
        schedule.released = schedule.released.add(releasable);

        require(
            token.transfer(_beneficiary, releasable),
            "Transfer failed"
        );

        emit TokensReleased(_id, _beneficiary, releasable);
        return releasable;
    }

    /**
     * @dev 撤销归属计划
     */
    function revokeSchedule(bytes32 _id) external onlyOwner {
        VestingSchedule storage schedule = schedules[_id];
        require(schedule.isActive && !schedule.isRevoked, "Schedule not active or already revoked");
        require(schedule.isRevocable, "Schedule not revocable");

        schedule.isRevoked = true;
        uint256 balance = schedule.totalAmount.sub(schedule.released);
        if (balance > 0) {
            require(
                token.transfer(owner(), balance),
                "Transfer failed"
            );
        }

        emit ScheduleRevoked(_id);
    }

    /**
     * @dev 计算可释放数量
     */
    function getReleasableAmount(
        bytes32 _id,
        address _beneficiary
    ) public view returns (uint256) {
        VestingSchedule storage schedule = schedules[_id];
        Beneficiary storage beneficiary = beneficiaries[_id][_beneficiary];

        if (!schedule.isActive || schedule.isRevoked || !beneficiary.isActive) {
            return 0;
        }

        if (block.timestamp < schedule.startTime.add(schedule.cliffDuration)) {
            return 0;
        }

        uint256 elapsedTime = block.timestamp.sub(schedule.startTime);
        if (elapsedTime > schedule.duration) {
            elapsedTime = schedule.duration;
        }

        uint256 intervals = elapsedTime.div(schedule.interval);
        uint256 totalVested = beneficiary.totalAmount.mul(intervals).mul(schedule.interval).div(schedule.duration);
        return totalVested.sub(beneficiary.releasedAmount);
    }

    /**
     * @dev 更新受益人状态
     */
    function updateBeneficiaryStatus(
        bytes32 _id,
        address _beneficiary,
        bool _isActive
    ) external onlyOperator {
        beneficiaries[_id][_beneficiary].isActive = _isActive;
        emit BeneficiaryUpdated(_id, _beneficiary, beneficiaries[_id][_beneficiary].totalAmount, _isActive);
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
     * @dev 暂停归属
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复归属
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
}
```

## 关键概念

### 归属管理

归属功能包括：
- 计划创建
- 线性释放
- 分期释放
- 锁定期控制

### 受益人管理

受益人功能包括：
- 信息记录
- 余额追踪
- 释放计算
- 状态控制

### 安全控制

安全功能包括：
- 权限管理
- 暂停机制
- 撤销机制
- 紧急提取

## 安全考虑

1. 归属安全
   - 数量验证
   - 时间控制
   - 状态检查
   - 异常处理

2. 受益人安全
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

1. 归属管理
   - 合理计划
   - 动态调整
   - 批量处理
   - 异常处理

2. 受益人管理
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

1. 动态归属
2. 多币种支持
3. 条件释放
4. 投票权重
5. 归属策略

## 应用场景

1. 团队激励
   - 员工激励
   - 顾问奖励
   - 贡献奖励
   - 长期激励

2. 投资管理
   - 投资锁定
   - 分期释放
   - 风险控制
   - 退出机制

3. 治理机制
   - 权益分配
   - 投票权重
   - 激励机制
   - 社区建设

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币归属？**

A: 代币归属是一种代币分配机制，主要特点包括：
- 时间锁定
- 分批释放
- 权益管理
- 条件触发
- 灵活配置

**Q: 归属系统有哪些类型？**

A: 主要类型包括：
- 线性归属
- 阶梯归属
- 混合归属
- 条件归属
- 动态归属

### 操作相关

**Q: 如何设置归属计划？**

A: 设置步骤包括：
- 确定总量
- 设置时间表
- 配置条件
- 选择类型
- 添加受益人

**Q: 如何管理归属过程？**

A: 管理方法包括：
- 监控进度
- 调整参数
- 处理异常
- 验证条件
- 执行释放

### 安全相关

**Q: 归属系统有哪些风险？**

A: 主要风险包括：
- 时间设置错误
- 条件验证失败
- 权限管理问题
- 合约漏洞
- 操作失误

**Q: 如何确保归属安全？**

A: 安全措施包括：
- 多重权限控制
- 参数合理性检查
- 状态完整性验证
- 紧急暂停机制
- 完整事件日志

## 总结

代币归属系统是DeFi生态的重要组件。通过本教程，你可以：
- 实现归属管理
- 确保系统安全
- 优化释放策略
- 提供灵活控制 