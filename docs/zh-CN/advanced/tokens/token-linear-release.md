# 代币线性释放系统

代币线性释放系统用于实现代币的平滑、持续释放，通常用于团队激励、投资者分配等场景。本教程将介绍如何实现一个安全的线性释放系统。

## 功能特性

- 线性释放机制
- 灵活的释放参数
- 多受益人支持
- 释放暂停功能
- 紧急提取机制

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title LinearTokenRelease
 * @dev 代币线性释放合约实现
 */
contract LinearTokenRelease is Ownable, ReentrancyGuard {
    using SafeMath for uint256;

    // 释放计划结构
    struct ReleasePlan {
        address token;           // 代币地址
        address beneficiary;     // 受益人地址
        uint256 totalAmount;     // 总释放量
        uint256 releasedAmount; // 已释放量
        uint256 startTime;       // 开始时间
        uint256 duration;        // 释放周期
        uint256 cliffDuration;   // 锁定期
        bool revocable;          // 是否可撤销
        bool revoked;            // 是否已撤销
        bool paused;             // 是否暂停
    }

    // 释放计划映射
    mapping(bytes32 => ReleasePlan) public plans;
    // 用户计划映射
    mapping(address => bytes32[]) public userPlans;

    // 事件
    event PlanCreated(bytes32 indexed planId, address indexed token, address indexed beneficiary);
    event TokensReleased(bytes32 indexed planId, uint256 amount);
    event PlanRevoked(bytes32 indexed planId);
    event PlanPaused(bytes32 indexed planId);
    event PlanUnpaused(bytes32 indexed planId);
    event BeneficiaryUpdated(bytes32 indexed planId, address indexed oldBeneficiary, address indexed newBeneficiary);

    /**
     * @dev 创建释放计划
     */
    function createPlan(
        address _token,
        address _beneficiary,
        uint256 _totalAmount,
        uint256 _startTime,
        uint256 _duration,
        uint256 _cliffDuration,
        bool _revocable
    ) external returns (bytes32) {
        require(_token != address(0), "Invalid token address");
        require(_beneficiary != address(0), "Invalid beneficiary address");
        require(_totalAmount > 0, "Invalid amount");
        require(_duration > 0, "Invalid duration");
        require(_startTime >= block.timestamp, "Start time must be future");
        require(_cliffDuration <= _duration, "Cliff longer than duration");

        // 生成计划ID
        bytes32 planId = keccak256(
            abi.encodePacked(
                _token,
                _beneficiary,
                _totalAmount,
                _startTime,
                block.timestamp
            )
        );

        // 转入代币
        IERC20(_token).transferFrom(msg.sender, address(this), _totalAmount);

        // 创建释放计划
        plans[planId] = ReleasePlan({
            token: _token,
            beneficiary: _beneficiary,
            totalAmount: _totalAmount,
            releasedAmount: 0,
            startTime: _startTime,
            duration: _duration,
            cliffDuration: _cliffDuration,
            revocable: _revocable,
            revoked: false,
            paused: false
        });

        userPlans[_beneficiary].push(planId);
        
        emit PlanCreated(planId, _token, _beneficiary);
        
        return planId;
    }

    /**
     * @dev 释放代币
     */
    function release(bytes32 _planId) external nonReentrant {
        ReleasePlan storage plan = plans[_planId];
        require(!plan.revoked, "Plan revoked");
        require(!plan.paused, "Plan paused");
        require(
            msg.sender == plan.beneficiary,
            "Only beneficiary can release"
        );
        
        uint256 releasableAmount = getReleasableAmount(_planId);
        require(releasableAmount > 0, "No tokens to release");

        plan.releasedAmount = plan.releasedAmount.add(releasableAmount);
        
        IERC20(plan.token).transfer(plan.beneficiary, releasableAmount);
        
        emit TokensReleased(_planId, releasableAmount);
    }

    /**
     * @dev 计算可释放金额
     */
    function getReleasableAmount(bytes32 _planId) public view returns (uint256) {
        ReleasePlan storage plan = plans[_planId];
        
        if (plan.revoked || plan.paused || 
            block.timestamp < plan.startTime.add(plan.cliffDuration)) {
            return 0;
        }

        if (block.timestamp >= plan.startTime.add(plan.duration)) {
            return plan.totalAmount.sub(plan.releasedAmount);
        }

        uint256 timeFromStart = block.timestamp.sub(plan.startTime);
        uint256 vestedAmount = plan.totalAmount.mul(timeFromStart).div(plan.duration);
        
        return vestedAmount.sub(plan.releasedAmount);
    }

    /**
     * @dev 撤销计划（仅管理员）
     */
    function revoke(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(plan.revocable, "Plan not revocable");
        require(!plan.revoked, "Plan already revoked");

        plan.revoked = true;
        
        uint256 remainingAmount = plan.totalAmount.sub(plan.releasedAmount);
        if (remainingAmount > 0) {
            IERC20(plan.token).transfer(owner(), remainingAmount);
        }
        
        emit PlanRevoked(_planId);
    }

    /**
     * @dev 暂停计划（仅管理员）
     */
    function pausePlan(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(!plan.paused, "Plan already paused");
        
        plan.paused = true;
        emit PlanPaused(_planId);
    }

    /**
     * @dev 恢复计划（仅管理员）
     */
    function unpausePlan(bytes32 _planId) external onlyOwner {
        ReleasePlan storage plan = plans[_planId];
        require(plan.paused, "Plan not paused");
        
        plan.paused = false;
        emit PlanUnpaused(_planId);
    }

    /**
     * @dev 更新受益人
     */
    function updateBeneficiary(bytes32 _planId, address _newBeneficiary) external {
        require(_newBeneficiary != address(0), "Invalid beneficiary address");
        ReleasePlan storage plan = plans[_planId];
        require(
            msg.sender == plan.beneficiary,
            "Only current beneficiary can update"
        );

        address oldBeneficiary = plan.beneficiary;
        plan.beneficiary = _newBeneficiary;

        // 更新用户计划映射
        bytes32[] storage oldUserPlanIds = userPlans[oldBeneficiary];
        for (uint256 i = 0; i < oldUserPlanIds.length; i++) {
            if (oldUserPlanIds[i] == _planId) {
                oldUserPlanIds[i] = oldUserPlanIds[oldUserPlanIds.length - 1];
                oldUserPlanIds.pop();
                break;
            }
        }
        userPlans[_newBeneficiary].push(_planId);

        emit BeneficiaryUpdated(_planId, oldBeneficiary, _newBeneficiary);
    }

    /**
     * @dev 获取用户的所有计划
     */
    function getUserPlans(address _user) external view returns (bytes32[] memory) {
        return userPlans[_user];
    }

    /**
     * @dev 获取计划详情
     */
    function getPlanInfo(bytes32 _planId)
        external
        view
        returns (
            address token,
            address beneficiary,
            uint256 totalAmount,
            uint256 releasedAmount,
            uint256 startTime,
            uint256 duration,
            uint256 cliffDuration,
            bool revocable,
            bool revoked,
            bool paused
        )
    {
        ReleasePlan storage plan = plans[_planId];
        return (
            plan.token,
            plan.beneficiary,
            plan.totalAmount,
            plan.releasedAmount,
            plan.startTime,
            plan.duration,
            plan.cliffDuration,
            plan.revocable,
            plan.revoked,
            plan.paused
        );
    }
}
```

## 关键概念

### 释放机制

线性释放支持：
- 持续释放
- 锁定期设置
- 释放速率
- 暂停功能

### 计算方法

释放计算包括：
- 时间计算
- 比例计算
- 锁定验证
- 余额检查

### 权限控制

权限管理：
- 受益人权限
- 管理员权限
- 暂停权限
- 撤销权限

## 安全考虑

1. 时间控制
   - 开始时间验证
   - 锁定期检查
   - 持续时间验证
   - 暂停机制

2. 金额验证
   - 余额检查
   - 释放计算
   - 最小额度
   - 精度处理

3. 权限管理
   - 角色验证
   - 操作限制
   - 状态保护
   - 事件记录

4. 紧急处理
   - 暂停机制
   - 撤销功能
   - 余额返还
   - 状态恢复

## 最佳实践

1. 释放设计
   - 合理的释放周期
   - 适当的锁定期
   - 灵活的参数设置
   - 完善的暂停机制

2. 数据管理
   - 状态追踪
   - 计划管理
   - 用户映射
   - 事件记录

3. 用户体验
   - 简单的操作流程
   - 清晰的状态展示
   - 及时的反馈机制
   - 完整的查询功能

4. 异常处理
   - 输入验证
   - 状态检查
   - 错误提示
   - 回滚机制

## 扩展功能

1. 多代币支持
2. 动态释放率
3. 分段释放
4. 条件触发
5. 投票权管理

## 应用场景

1. 团队激励
   - 员工期权
   - 顾问奖励
   - 贡献激励
   - 长期绑定

2. 投资解锁
   - 私募分配
   - 机构投资
   - 战略合作
   - 风险控制

3. 项目发展
   - 生态建设
   - 社区激励
   - 市场营销
   - 流动性管理

## 总结

代币线性释放系统是代币分配的重要工具。通过本教程，你可以：
- 实现平滑的代币释放
- 保护各方权益
- 灵活控制释放
- 确保系统安全 

## 常见问题解答（FAQ）

### 基础概念

**Q: 什么是线性释放？**

A: 线性释放是一种代币分发机制，主要特点包括：
- 均匀释放
- 时间控制
- 释放速率
- 锁定期
- 释放计划

**Q: 线性释放有哪些类型？**

A: 主要类型包括：
- 固定速率释放
- 可调速率释放
- 分段线性释放
- 混合释放
- 条件释放

### 操作相关

**Q: 如何设计释放策略？**

A: 设计要点包括：
- 确定总量
- 设置周期
- 配置速率
- 添加条件
- 设置检查点

**Q: 如何管理释放过程？**

A: 管理方法包括：
- 监控进度
- 调整参数
- 处理异常
- 验证条件
- 执行释放

### 安全相关

**Q: 线性释放有哪些风险？**

A: 主要风险包括：
- 参数设置错误
- 计算精度问题
- 时间控制失效
- 合约漏洞
- 操作失误

**Q: 如何确保释放安全？**

A: 安全措施包括：
- 多重验证
- 参数检查
- 状态监控
- 紧急暂停
- 完整日志