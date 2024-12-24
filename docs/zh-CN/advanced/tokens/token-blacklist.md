# 代币黑名单系统

代币黑名单是一个用于管理地址交易限制的系统。本教程将介绍如何实现一个安全可靠的黑名单系统。

## 功能特性

- 黑名单管理
- 交易限制
- 权限控制
- 安全保护
- 紧急处理

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";

/**
 * @title TokenBlacklist
 * @dev 代币黑名单合约实现
 */
contract TokenBlacklist is Ownable, ReentrancyGuard, Pausable {
    // 黑名单信息
    struct BlacklistInfo {
        bool isBlacklisted;      // 是否黑名单
        uint256 startTime;       // 开始时间
        uint256 endTime;         // 结束时间
        string reason;           // 原因
        address operator;        // 操作者
    }

    // 配置信息
    struct BlacklistConfig {
        bool requiresReason;     // 是否需要原因
        bool requiresEndTime;    // 是否需要结束时间
        bool requiresOperator;   // 是否需要操作者
        bool isActive;           // 是否激活
    }

    // 状态变量
    mapping(address => BlacklistInfo) public blacklist;           // 黑名单
    mapping(address => bool) public operators;                    // 操作员
    BlacklistConfig public config;                               // 配置信息
    uint256 public blacklistCount;                              // 黑名单数量

    // 事件
    event AddedToBlacklist(address indexed account, uint256 startTime, uint256 endTime, string reason);
    event RemovedFromBlacklist(address indexed account);
    event OperatorUpdated(address indexed operator, bool status);
    event ConfigUpdated(bool requiresReason, bool requiresEndTime, bool requiresOperator);

    /**
     * @dev 构造函数
     */
    constructor(
        bool _requiresReason,
        bool _requiresEndTime,
        bool _requiresOperator
    ) {
        config = BlacklistConfig({
            requiresReason: _requiresReason,
            requiresEndTime: _requiresEndTime,
            requiresOperator: _requiresOperator,
            isActive: true
        });
    }

    /**
     * @dev 添加到黑名单
     */
    function addToBlacklist(
        address _account,
        uint256 _endTime,
        string calldata _reason
    ) external onlyOperator whenNotPaused {
        require(_account != address(0), "Invalid address");
        require(!blacklist[_account].isBlacklisted, "Already blacklisted");
        
        if (config.requiresEndTime) {
            require(_endTime > block.timestamp, "Invalid end time");
        }
        
        if (config.requiresReason) {
            require(bytes(_reason).length > 0, "Reason required");
        }

        blacklist[_account] = BlacklistInfo({
            isBlacklisted: true,
            startTime: block.timestamp,
            endTime: _endTime,
            reason: _reason,
            operator: msg.sender
        });

        blacklistCount++;
        emit AddedToBlacklist(_account, block.timestamp, _endTime, _reason);
    }

    /**
     * @dev 批量添加到黑名单
     */
    function batchAddToBlacklist(
        address[] calldata _accounts,
        uint256[] calldata _endTimes,
        string[] calldata _reasons
    ) external onlyOperator whenNotPaused {
        require(
            _accounts.length == _endTimes.length && 
            _accounts.length == _reasons.length,
            "Length mismatch"
        );

        for (uint256 i = 0; i < _accounts.length; i++) {
            require(_accounts[i] != address(0), "Invalid address");
            require(!blacklist[_accounts[i]].isBlacklisted, "Already blacklisted");
            
            if (config.requiresEndTime) {
                require(_endTimes[i] > block.timestamp, "Invalid end time");
            }
            
            if (config.requiresReason) {
                require(bytes(_reasons[i]).length > 0, "Reason required");
            }

            blacklist[_accounts[i]] = BlacklistInfo({
                isBlacklisted: true,
                startTime: block.timestamp,
                endTime: _endTimes[i],
                reason: _reasons[i],
                operator: msg.sender
            });

            blacklistCount++;
            emit AddedToBlacklist(_accounts[i], block.timestamp, _endTimes[i], _reasons[i]);
        }
    }

    /**
     * @dev 从黑名单移除
     */
    function removeFromBlacklist(
        address _account
    ) external onlyOperator whenNotPaused {
        require(blacklist[_account].isBlacklisted, "Not blacklisted");

        delete blacklist[_account];
        blacklistCount--;
        emit RemovedFromBlacklist(_account);
    }

    /**
     * @dev 批量从黑名单移除
     */
    function batchRemoveFromBlacklist(
        address[] calldata _accounts
    ) external onlyOperator whenNotPaused {
        for (uint256 i = 0; i < _accounts.length; i++) {
            require(blacklist[_accounts[i]].isBlacklisted, "Not blacklisted");

            delete blacklist[_accounts[i]];
            blacklistCount--;
            emit RemovedFromBlacklist(_accounts[i]);
        }
    }

    /**
     * @dev 检查是否在黑名单中
     */
    function isBlacklisted(
        address _account
    ) public view returns (bool) {
        if (!blacklist[_account].isBlacklisted) {
            return false;
        }

        if (blacklist[_account].endTime > 0 && 
            block.timestamp > blacklist[_account].endTime) {
            return false;
        }

        return true;
    }

    /**
     * @dev 获取黑名单信息
     */
    function getBlacklistInfo(
        address _account
    ) external view returns (
        bool isBlacklisted,
        uint256 startTime,
        uint256 endTime,
        string memory reason,
        address operator
    ) {
        BlacklistInfo storage info = blacklist[_account];
        return (
            info.isBlacklisted,
            info.startTime,
            info.endTime,
            info.reason,
            info.operator
        );
    }

    /**
     * @dev 更新操作员
     */
    function updateOperator(
        address _operator,
        bool _status
    ) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    /**
     * @dev 更新配置
     */
    function updateConfig(
        bool _requiresReason,
        bool _requiresEndTime,
        bool _requiresOperator
    ) external onlyOwner {
        config.requiresReason = _requiresReason;
        config.requiresEndTime = _requiresEndTime;
        config.requiresOperator = _requiresOperator;
        emit ConfigUpdated(_requiresReason, _requiresEndTime, _requiresOperator);
    }

    /**
     * @dev 暂停黑名单
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复黑名单
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 设置黑名单系统状态
     */
    function setActive(bool _isActive) external onlyOwner {
        config.isActive = _isActive;
    }

    /**
     * @dev 批量获取黑名单信息
     */
    function batchGetBlacklistInfo(
        address[] calldata _accounts
    ) external view returns (
        bool[] memory blacklistedFlags,
        uint256[] memory startTimes,
        uint256[] memory endTimes,
        string[] memory reasons,
        address[] memory operators
    ) {
        blacklistedFlags = new bool[](_accounts.length);
        startTimes = new uint256[](_accounts.length);
        endTimes = new uint256[](_accounts.length);
        reasons = new string[](_accounts.length);
        operators = new address[](_accounts.length);

        for (uint256 i = 0; i < _accounts.length; i++) {
            BlacklistInfo storage info = blacklist[_accounts[i]];
            blacklistedFlags[i] = info.isBlacklisted;
            startTimes[i] = info.startTime;
            endTimes[i] = info.endTime;
            reasons[i] = info.reason;
            operators[i] = info.operator;
        }

        return (blacklistedFlags, startTimes, endTimes, reasons, operators);
    }

    /**
     * @dev 获取黑名单统计信息
     */
    function getBlacklistStats() external view returns (
        uint256 totalBlacklisted,
        uint256 activeBlacklisted,
        uint256 expiredBlacklisted,
        bool isActive,
        bool isPaused
    ) {
        uint256 active = 0;
        uint256 expired = 0;

        for (uint256 i = 0; i < blacklistCount; i++) {
            if (blacklist[msg.sender].isBlacklisted) {
                if (blacklist[msg.sender].endTime > 0 && 
                    block.timestamp > blacklist[msg.sender].endTime) {
                    expired++;
                } else {
                    active++;
                }
            }
        }

        return (
            blacklistCount,
            active,
            expired,
            config.isActive,
            paused()
        );
    }

    /**
     * @dev 更新黑名单信息
     */
    function updateBlacklistInfo(
        address _account,
        uint256 _endTime,
        string calldata _reason
    ) external onlyOperator whenNotPaused {
        require(blacklist[_account].isBlacklisted, "Not blacklisted");
        
        if (config.requiresEndTime) {
            require(_endTime > block.timestamp, "Invalid end time");
        }
        
        if (config.requiresReason) {
            require(bytes(_reason).length > 0, "Reason required");
        }

        blacklist[_account].endTime = _endTime;
        blacklist[_account].reason = _reason;
        blacklist[_account].operator = msg.sender;

        emit AddedToBlacklist(_account, blacklist[_account].startTime, _endTime, _reason);
    }

    /**
     * @dev 清理过期黑名单
     */
    function cleanupExpiredBlacklist() external onlyOperator {
        address[] memory accounts = new address[](blacklistCount);
        uint256 count = 0;

        for (uint256 i = 0; i < blacklistCount; i++) {
            if (blacklist[msg.sender].isBlacklisted &&
                blacklist[msg.sender].endTime > 0 && 
                block.timestamp > blacklist[msg.sender].endTime) {
                accounts[count] = msg.sender;
                count++;
            }
        }

        for (uint256 i = 0; i < count; i++) {
            delete blacklist[accounts[i]];
            blacklistCount--;
            emit RemovedFromBlacklist(accounts[i]);
        }
    }

    /**
     * @dev 紧急移除
     */
    function emergencyRemove(address _account) external onlyOwner {
        require(blacklist[_account].isBlacklisted, "Not blacklisted");
        delete blacklist[_account];
        blacklistCount--;
        emit RemovedFromBlacklist(_account);
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

### 黑名单管理

黑名单功能包括：
- 地址管理
- 时间控制
- 原因记录
- 操作追踪

### 权限管理

权限功能包括：
- 操作员管理
- 权限验证
- 配置控制
- 状态管理

### 安全控制

安全功能包括：
- 权限管理
- 暂停机制
- 批量操作
- 紧急处理

## 安全考虑

1. 黑名单安全
   - 地址验证
   - 时间控制
   - 状态检查
   - 异常处理

2. 权限安全
   - 操作验证
   - 权限检查
   - 配置控制
   - 状态保护

3. 系统安全
   - 权限控制
   - 暂停机制
   - 重入防护
   - 状态同步

4. 升级安全
   - 配置更新
   - 操作员调整
   - 状态迁移
   - 紧急处理

## 最佳实践

1. 黑名单管理
   - 地址验证
   - 时间控制
   - 原因记录
   - 状态追踪

2. 权限管理
   - 操作员分配
   - 权限验证
   - 配置控制
   - 状态管理

3. 风险管理
   - 地址监控
   - 异常检测
   - 风险预警
   - 应急处理

4. 系统维护
   - 参数优化
   - 性能监控
   - 安全审计
   - 升级预案

## 扩展功能

1. 多级黑名单
2. 自动解除
3. 申诉机制
4. 风险评分
5. 监控预警

## 应用场景

1. 风险控制
   - 地址限制
   - 交易控制
   - 风险防范
   - 安全保护

2. 合规管理
   - 地址审核
   - 交易监控
   - 合规验证
   - 风险管理

3. 生态治理
   - 地址管理
   - 行为控制
   - 风险防范
   - 生态保护

## 总结

代币黑名单系统是DeFi生态的重要安全组件。通过本教程，你可以：
- 实现黑名单管理
- 确保系统安全
- 优化风险控制
- 提供灵活管理 

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是代币黑名单？**

A: 代币黑名单是一种访问控制机制，主要特点包括：
- 地址限制
- 交易控制
- 动态管理
- 权限分级
- 紧急处理

**Q: 黑名单系统有哪些类型？**

A: 主要类型包括：
- 全局黑名单
- 功能黑名单
- 临时黑名单
- 分级黑名单
- 智能黑名单

### 操作相关

**Q: 如何管理黑名单？**

A: 管理方法包括：
- 添加地址
- 移除地址
- 更新状态
- 权限控制
- 日志记录

**Q: 如何处理被限制地址？**

A: 处理步骤包括：
- 交易拦截
- 资产冻结
- 通知用户
- 申诉处理
- 解除限制

### 安全相关

**Q: 黑名单系统有哪些风险？**

A: 主要风险包括：
- 权限滥用
- 误判处理
- 绕过限制
- 系统漏洞
- 数据错误

**Q: 如何确保系统安全？**

A: 安全措施包括：
- 多重授权
- 操作审计
- 定期检查
- 应急机制
- 数据备份
  </rewritten_file>