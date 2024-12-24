# 代币锁定系统

代币锁定系统用于实现代币的时间锁定和条件解锁，常用于团队代币、投资者代币的锁定管理。本教程将介绍如何实现一个安全的代币锁定系统。

## 功能特性

- 时间锁定机制
- 分批解锁支持
- 多受益人管理
- 锁定条件设置
- 紧急操作机制

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

/**
 * @title TokenLock
 * @dev 代币锁定合约实现
 */
contract TokenLock is Ownable, ReentrancyGuard {
    using Counters for Counters.Counter;

    // 锁定信息结构
    struct LockInfo {
        address token;           // 代币地址
        address beneficiary;     // 受益人地址
        uint256 totalAmount;     // 总锁定量
        uint256 releasedAmount; // 已释放量
        uint256 startTime;       // 开始时间
        uint256 endTime;         // 结束时间
        uint256[] releasePoints; // 释放时间点
        uint256[] releaseRatios; // 释放比例
        bool revocable;          // 是否可撤销
        bool revoked;            // 是否已撤销
    }

    // 锁定ID计数器
    Counters.Counter private lockIdCounter;
    
    // 锁定信息映射
    mapping(uint256 => LockInfo) public locks;
    // 用户锁定ID映射 user => lockIds
    mapping(address => uint256[]) public userLocks;
    
    // 事件
    event LockCreated(uint256 indexed lockId, address indexed token, address indexed beneficiary);
    event TokensReleased(uint256 indexed lockId, uint256 amount);
    event LockRevoked(uint256 indexed lockId);
    event BeneficiaryUpdated(uint256 indexed lockId, address indexed oldBeneficiary, address indexed newBeneficiary);

    /**
     * @dev 创建新的锁定
     */
    function createLock(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _endTime,
        uint256[] calldata _releasePoints,
        uint256[] calldata _releaseRatios,
        bool _revocable
    ) external returns (uint256) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_totalAmount > 0, "Invalid amount");
        require(_startTime < _endTime, "Invalid time range");
        require(
            _releasePoints.length == _releaseRatios.length,
            "Points and ratios length mismatch"
        );
        require(
            _releasePoints.length > 0,
            "No release points specified"
        );
        
        // 验证释放时间点和比例
        uint256 totalRatio = 0;
        for (uint256 i = 0; i < _releasePoints.length; i++) {
            require(
                _releasePoints[i] >= _startTime && _releasePoints[i] <= _endTime,
                "Invalid release point"
            );
            if (i > 0) {
                require(
                    _releasePoints[i] > _releasePoints[i-1],
                    "Release points must be in order"
                );
            }
            totalRatio += _releaseRatios[i];
        }
        require(totalRatio == 100, "Total ratio must be 100");

        // 转入代币
        IERC20(_token).transferFrom(msg.sender, address(this), _totalAmount);

        // 创建锁定信息
        uint256 lockId = lockIdCounter.current();
        lockIdCounter.increment();

        locks[lockId] = LockInfo({
            token: _token,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            releasedAmount: 0,
            startTime: _startTime,
            endTime: _endTime,
            releasePoints: _releasePoints,
            releaseRatios: _releaseRatios,
            revocable: _revocable,
            revoked: false
        });

        userLocks[_beneficiary].push(lockId);
        
        emit LockCreated(lockId, _token, _beneficiary);
        
        return lockId;
    }

    /**
     * @dev 释放代币
     */
    function release(uint256 _lockId) external nonReentrant {
        LockInfo storage lock = locks[_lockId];
        require(!lock.revoked, "Lock revoked");
        require(
            msg.sender == lock.beneficiary,
            "Only beneficiary can release"
        );
        
        uint256 releasableAmount = getReleasableAmount(_lockId);
        require(releasableAmount > 0, "No tokens to release");

        lock.releasedAmount += releasableAmount;
        
        IERC20(lock.token).transfer(lock.beneficiary, releasableAmount);
        
        emit TokensReleased(_lockId, releasableAmount);
    }

    /**
     * @dev 计算可释放金额
     */
    function getReleasableAmount(uint256 _lockId) public view returns (uint256) {
        LockInfo storage lock = locks[_lockId];
        if (lock.revoked || block.timestamp < lock.startTime) {
            return 0;
        }

        uint256 currentReleaseRatio = 0;
        for (uint256 i = 0; i < lock.releasePoints.length; i++) {
            if (block.timestamp >= lock.releasePoints[i]) {
                currentReleaseRatio = 0;
                for (uint256 j = 0; j <= i; j++) {
                    currentReleaseRatio += lock.releaseRatios[j];
                }
            }
        }

        uint256 releasableAmount = (lock.totalAmount * currentReleaseRatio) / 100;
        return releasableAmount - lock.releasedAmount;
    }

    /**
     * @dev 撤销锁定（仅管理员）
     */
    function revoke(uint256 _lockId) external onlyOwner {
        LockInfo storage lock = locks[_lockId];
        require(lock.revocable, "Lock not revocable");
        require(!lock.revoked, "Lock already revoked");

        lock.revoked = true;
        
        uint256 remainingAmount = lock.totalAmount - lock.releasedAmount;
        if (remainingAmount > 0) {
            IERC20(lock.token).transfer(owner(), remainingAmount);
        }
        
        emit LockRevoked(_lockId);
    }

    /**
     * @dev 更新受益人
     */
    function updateBeneficiary(uint256 _lockId, address _newBeneficiary) external {
        require(_newBeneficiary != address(0), "Invalid beneficiary address");
        LockInfo storage lock = locks[_lockId];
        require(
            msg.sender == lock.beneficiary,
            "Only current beneficiary can update"
        );

        address oldBeneficiary = lock.beneficiary;
        lock.beneficiary = _newBeneficiary;

        // 更新用户锁定映射
        uint256[] storage oldUserLockIds = userLocks[oldBeneficiary];
        for (uint256 i = 0; i < oldUserLockIds.length; i++) {
            if (oldUserLockIds[i] == _lockId) {
                oldUserLockIds[i] = oldUserLockIds[oldUserLockIds.length - 1];
                oldUserLockIds.pop();
                break;
            }
        }
        userLocks[_newBeneficiary].push(_lockId);

        emit BeneficiaryUpdated(_lockId, oldBeneficiary, _newBeneficiary);
    }

    /**
     * @dev 获取用户的所有锁定ID
     */
    function getUserLocks(address _user) external view returns (uint256[] memory) {
        return userLocks[_user];
    }

    /**
     * @dev 获取锁定详情
     */
    function getLockInfo(uint256 _lockId)
        external
        view
        returns (
            address token,
            address beneficiary,
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startTime,
            uint256 endTime,
            uint256[] memory releasePoints,
            uint256[] memory releaseRatios,
            bool revocable,
            bool revoked
        )
    {
        LockInfo storage lock = locks[_lockId];
        return (
            lock.token,
            lock.beneficiary,
            lock.totalAmount,
            lock.releasedAmount,
            lock.startTime,
            lock.endTime,
            lock.releasePoints,
            lock.releaseRatios,
            lock.revocable,
            lock.revoked
        );
    }

    /**
     * @dev 获取总锁定数量
     */
    function getTotalLocks() external view returns (uint256) {
        return lockIdCounter.current();
    }

    /**
     * @dev 批量释放代币
     */
    function batchRelease(uint256[] calldata _lockIds) external nonReentrant {
        for (uint256 i = 0; i < _lockIds.length; i++) {
            uint256 lockId = _lockIds[i];
            LockInfo storage lock = locks[lockId];
            
            require(!lock.revoked, "Lock revoked");
            require(
                msg.sender == lock.beneficiary,
                "Only beneficiary can release"
            );
            
            uint256 releasableAmount = getReleasableAmount(lockId);
            if (releasableAmount > 0) {
                lock.releasedAmount += releasableAmount;
                IERC20(lock.token).transfer(lock.beneficiary, releasableAmount);
                emit TokensReleased(lockId, releasableAmount);
            }
        }
    }

    /**
     * @dev 紧急提取（仅管理员）
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner {
        require(_token != address(0), "Invalid token address");
        require(_to != address(0), "Invalid recipient address");
        require(_amount > 0, "Invalid amount");
        
        IERC20(_token).transfer(_to, _amount);
    }

    /**
     * @dev 检查锁定状态
     */
    function checkLockStatus(uint256 _lockId)
        external
        view
        returns (
            bool isActive,
            bool isRevoked,
            bool canRelease,
            uint256 releasableAmount,
            uint256 remainingAmount
        )
    {
        LockInfo storage lock = locks[_lockId];
        isActive = block.timestamp >= lock.startTime && block.timestamp <= lock.endTime;
        isRevoked = lock.revoked;
        releasableAmount = getReleasableAmount(_lockId);
        canRelease = releasableAmount > 0;
        remainingAmount = lock.totalAmount - lock.releasedAmount;
        
        return (isActive, isRevoked, canRelease, releasableAmount, remainingAmount);
    }
}
```

## 关键概念

### 锁定机制

锁定系统支持：
- 时间锁定
- 分批释放
- 条件解锁
- 可撤销设置

### 释放计算

释放机制包括：
- 时间点验证
- 比例计算
- 已释放追踪
- 余额检查

### 权限管理

权限控制：
- 受益人操作
- 管理员功能
- 撤销权限
- 受益人转移

## 安全考虑

1. 时间控制
   - 时间点验证
   - 顺序检查
   - 状态更新

2. 金额验证
   - 余额检查
   - 比例验证
   - 释放计算

3. 权限管理
   - 角色验证
   - 操作限制
   - 状态保护

4. 紧急处理
   - 撤销机制
   - 余额返还
   - 状态恢复

## 最佳实践

1. 锁定设计
   - 合理的时间安排
   - 适当的释放比例
   - 灵活的条件设置

2. 数据管理
   - 状态追踪
   - 记录完整
   - 查询便利

3. 用户体验
   - 操作简单
   - 状态透明
   - 提示清晰

4. 异常处理
   - 错误检查
   - 状态回滚
   - 日志记录

## 扩展功能

1. 多代币支持
2. 条件触发
3. 投票权委托
4. 分红权益
5. 转让限制

## 应用场景

1. 团队代币
   - 长期激励
   - 权益绑定
   - 退出机制

2. 投资锁定
   - 投资承诺
   - 风险控制
   - 利益对齐

3. 项目治理
   - 权益锁定
   - 投票权管理
   - 社区建设

## 总结

代币锁定系统是项目代币管理的重要工具。通过本教程，你可以：
- 实现灵活的锁定机制
- 确保资金安全
- 优化用户体验
- 支持项目治理 

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是代币锁定？
A: 代币锁定是一种智能合约机制，主要特点包括：
- 时间锁定控制
- 分批释放管理
- 条件触发解锁
- 多方权益保护
- 紧急操作支持

Q: 代币锁定有哪些应用场景？
A: 主要应用包括：
- 团队代币管理
- 投资者代币锁定
- 项目激励计划
- 生态基金管理
- 流动性管理

### 2. 功能相关

Q: 如何设计锁定计划？
A: 设计要点：
```solidity
function createLockPlan(
    uint256 amount,
    uint256 duration,
    uint256[] memory milestones
) public pure returns (uint256[] memory) {
    // 1. 计算释放点
    uint256[] memory releases = new uint256[](milestones.length);
    
    // 2. 设置里程碑
    for (uint256 i = 0; i < milestones.length; i++) {
        releases[i] = amount * milestones[i] / 100;
    }
    
    return releases;
}
```

Q: 如何管理多个锁定计划？
A: 管理策略：
- 批量创建
- 统一管理
- 状态追踪
- 自动执行
- 异常处理

### 3. 安全相关

Q: 锁定系统有什么风险？
A: 主要风险包括：
- 合约漏洞风险
- 权限管理风险
- 时间控制风险
- 紧急操作风险
- 代币安全风险

Q: 如何保护锁定资产？
A: 安全措施包括：
- 多重签名
- 时间锁定
- 权限分级
- 紧急暂停
- 审计验证

### 4. 优化相关

Q: 如何优化锁定机制？
A: 优化策略：
- 批量处理
- Gas优化
- 存储优化
- 逻辑简化
- 接口标准化

Q: 如何提高系统效率？
A: 改进方案：
- 事件监听
- 状态缓存
- 批量操作
- 智能调度
- 自动化处理

### 5. 实现细节

Q: 如何实现分批释放？
A: 实现机制：
```solidity
function calculateRelease(
    uint256 lockId,
    uint256 timestamp
) internal view returns (uint256) {
    // 1. 获取锁定信息
    LockInfo storage lock = locks[lockId];
    
    // 2. 计算可释放金额
    uint256 releasable = 0;
    for (uint256 i = 0; i < lock.releasePoints.length; i++) {
        if (timestamp >= lock.releasePoints[i]) {
            releasable += lock.amounts[i];
        }
    }
    
    return releasable;
}
```

Q: 如何处理紧急情况？
A: 处理机制：
- 紧急暂停
- 权限转移
- 强制解锁
- 状态回滚
- 资金保护

### 6. 最佳实践

Q: 锁定系统开发建议？
A: 开发建议：
- 完整测试
- 安全审计
- 权限管理
- 文档完善
- 监控预警

Q: 如何提高系统可靠性？
A: 改进方案：
- 故障检测
- 自动恢复
- 状态验证
- 日志记录
- 备份机制

### 7. 错误处理

Q: 常见错误及解决方案？
A: 错误类型：
- `"Lock not found"`: 检查ID
- `"Not released yet"`: 等待时间
- `"Already released"`: 验证状态
- `"Invalid amount"`: 检查数量
- `"Not authorized"`: 确认权限

Q: 如何处理异常情况？
A: 处理机制：
- 状态回滚
- 错误记录
- 通知机制
- 手动干预
- 补偿机制

### 8. 升级维护

Q: 如何升级锁定系统？
A: 升级策略：
- 代理合约
- 数据迁移
- 兼容处理
- 测试验证
- 平滑过渡

Q: 如何监控系统状态？
A: 监控方案：
- 锁定状态
- 释放进度
- 异常检测
- 资金流向
- 操作日志

### 9. 与其他系统集成

Q: 如何与治理系统集成？
A: 集成方案：
- 权重计算
- 投票限制
- 提案控制
- 执行延迟
- 状态同步

Q: 如何实现跨链锁定？
A: 实现策略：
- 跨链消息
- 状态同步
- 资产映射
- 安全验证
- 异常处理