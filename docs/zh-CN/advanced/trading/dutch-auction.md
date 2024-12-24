# 荷兰拍卖合约

## 概述

荷兰拍卖合约(`DutchAuction`)实现了一个标准的荷兰式拍卖系统，支持 NFT 和 ERC20 代币的拍卖交易。该合约采用价格递减的拍卖机制，起始价格较高，随时间逐步降低，直到买家接受当前价格。

## 合约实现

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";

/**
 * @title Dutch Auction
 * @dev 荷兰式拍卖合约实现
 */
contract DutchAuction is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // 拍卖信息结构
    struct Auction {
        address seller;          // 卖家地址
        address tokenAddress;    // 拍卖物品地址
        uint256 tokenId;        // 物品ID
        uint256 startPrice;     // 起始价格
        uint256 endPrice;       // 最低价格
        uint256 duration;       // 拍卖时长
        uint256 startTime;      // 开始时间
        uint256 priceStep;      // 降价步长
        bool ended;             // 是否结束
        bool isERC721;          // 是否为 NFT
    }

    // 状态变量
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionIdCounter;
    uint256 public minAuctionDuration;
    uint256 public maxAuctionDuration;
    uint256 public platformFee;
    address public feeRecipient;

    // 事件定义
    event AuctionCreated(
        uint256 indexed auctionId,
        address indexed seller,
        address tokenAddress,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice
    );

    event AuctionSuccessful(
        uint256 indexed auctionId,
        address indexed buyer,
        uint256 price
    );

    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed seller
    );

    event PriceUpdated(
        uint256 indexed auctionId,
        uint256 newPrice
    );

    /**
     * @dev 构造函数
     */
    constructor(
        uint256 _minDuration,
        uint256 _maxDuration,
        uint256 _platformFee,
        address _feeRecipient
    ) {
        require(_minDuration > 0, "Min duration must be > 0");
        require(_maxDuration > _minDuration, "Max duration must be > min duration");
        require(_platformFee <= 1000, "Platform fee must be <= 10%");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        minAuctionDuration = _minDuration;
        maxAuctionDuration = _maxDuration;
        platformFee = _platformFee;
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev 创建拍卖
     */
    function createAuction(
        address tokenAddress,
        uint256 tokenId,
        uint256 startPrice,
        uint256 endPrice,
        uint256 duration,
        bool isERC721
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(startPrice > endPrice, "Start price must be > end price");
        require(duration >= minAuctionDuration, "Duration too short");
        require(duration <= maxAuctionDuration, "Duration too long");

        if (isERC721) {
            IERC721 nft = IERC721(tokenAddress);
            require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
            require(nft.isApprovedForAll(msg.sender, address(this)) || 
                   nft.getApproved(tokenId) == address(this), "Not approved");
        } else {
            IERC20 token = IERC20(tokenAddress);
            require(token.balanceOf(msg.sender) >= 1, "Insufficient token balance");
            require(token.allowance(msg.sender, address(this)) >= 1, "Not approved");
        }

        uint256 auctionId = auctionIdCounter++;
        uint256 priceStep = (startPrice - endPrice) / duration;

        auctions[auctionId] = Auction({
            seller: msg.sender,
            tokenAddress: tokenAddress,
            tokenId: tokenId,
            startPrice: startPrice,
            endPrice: endPrice,
            duration: duration,
            startTime: block.timestamp,
            priceStep: priceStep,
            ended: false,
            isERC721: isERC721
        });

        emit AuctionCreated(
            auctionId,
            msg.sender,
            tokenAddress,
            tokenId,
            startPrice,
            endPrice
        );

        return auctionId;
    }

    /**
     * @dev 购买拍卖物品
     */
    function buy(uint256 auctionId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp <= auction.startTime + auction.duration, "Auction expired");

        uint256 currentPrice = getCurrentPrice(auctionId);
        require(msg.value >= currentPrice, "Insufficient payment");

        auction.ended = true;

        // 转移拍卖物品
        if (auction.isERC721) {
            IERC721(auction.tokenAddress).safeTransferFrom(
                auction.seller,
                msg.sender,
                auction.tokenId
            );
        } else {
            IERC20(auction.tokenAddress).transferFrom(
                auction.seller,
                msg.sender,
                1
            );
        }

        // 计算平台费用
        uint256 fee = currentPrice.mul(platformFee).div(10000);
        uint256 sellerProceeds = currentPrice.sub(fee);

        // 分配资金
        if (fee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        (bool success, ) = auction.seller.call{value: sellerProceeds}("");
        require(success, "Seller payment failed");

        // 退还多余的 ETH
        if (msg.value > currentPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - currentPrice}("");
            require(refundSuccess, "Refund failed");
        }

        emit AuctionSuccessful(auctionId, msg.sender, currentPrice);
    }

    /**
     * @dev 取消拍卖
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Not auction seller");
        require(!auction.ended, "Auction already ended");

        auction.ended = true;
        emit AuctionCancelled(auctionId, msg.sender);
    }

    /**
     * @dev 获取当前价格
     */
    function getCurrentPrice(uint256 auctionId) public view returns (uint256) {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction ended");

        uint256 elapsed = block.timestamp - auction.startTime;
        if (elapsed >= auction.duration) {
            return auction.endPrice;
        }

        uint256 priceDrop = auction.priceStep.mul(elapsed);
        uint256 currentPrice = auction.startPrice.sub(priceDrop);

        return currentPrice > auction.endPrice ? currentPrice : auction.endPrice;
    }

    /**
     * @dev 更新平台费用
     */
    function updatePlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Platform fee must be <= 10%");
        platformFee = _platformFee;
    }

    /**
     * @dev 更新费用接收地址
     */
    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev 更新拍卖时长限制
     */
    function updateDurationLimits(
        uint256 _minDuration,
        uint256 _maxDuration
    ) external onlyOwner {
        require(_minDuration > 0, "Min duration must be > 0");
        require(_maxDuration > _minDuration, "Max duration must be > min duration");
        minAuctionDuration = _minDuration;
        maxAuctionDuration = _maxDuration;
    }

    /**
     * @dev 紧急暂停
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev 恢复运行
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev 接收 NFT 回调
     */
    function onERC721Received(
        address,
        address,
        uint256,
        bytes memory
    ) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }
}
```

## 功能说明

### 1. 拍卖管理
- 创建拍卖：支持 NFT 和 ERC20 代币的拍卖
- 设置参数：起始价格、最低价格、拍卖时长
- 取消拍卖：卖家可以取消未结束的拍卖
- 平台费用：支持收取交易费用

### 2. 价格机制
- 线性降价：价格随时间线性递减
- 最低价保护：确保不低于设定的最低价格
- 价格计算：实时计算当前价格
- 自动更新：价格自动随时间更新

### 3. 交易执行
- 即时购买：买家可以按当前价格购买
- 自动结算：完成代币转移和资金分配
- 多余退款：自动退还多支付的金额
- 平台分成：自动扣除平台费用

### 4. 安全机制
- 重入保护：防止重入攻击
- 暂停功能：紧急情况可暂停合约
- 权限控制：管理功能仅限所有者
- 参数验证：严格的输入参数检查

## 使用示例

### 1. 创建拍卖
```javascript
const startPrice = ethers.utils.parseEther("2");    // 起始价格 2 ETH
const endPrice = ethers.utils.parseEther("0.5");    // 最低价格 0.5 ETH
const duration = 3600 * 24;                         // 持续时间 24 小时

await dutchAuction.createAuction(
    nft.address,      // NFT 合约地址
    tokenId,          // NFT ID
    startPrice,       
    endPrice,
    duration,
    true              // 是 NFT
);
```

### 2. 购买物品
```javascript
const currentPrice = await dutchAuction.getCurrentPrice(auctionId);
await dutchAuction.buy(auctionId, {
    value: currentPrice
});
```

### 3. 取消拍卖
```javascript
await dutchAuction.cancelAuction(auctionId);
```

## 最佳实践

### 1. 拍卖设置
- 合理的起始价格和最低价格
- 适当的拍卖持续时间
- 考虑市场流动性

### 2. 安全考虑
- 定期检查合约状态
- 监控异常交易
- 做好应急预案

### 3. 费用管理
- 合理的平台费用比例
- 安全的费用接收地址
- 及时的费用提取

## 总结

该荷兰拍卖合约实现了：
- 完整的拍卖功能
- 灵活的价格机制
- 严格的安全控制
- 可靠的资金管理

通过这个实现，可以安全、高效地进行 NFT 和代币的荷兰式拍卖交易。

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是荷兰式拍卖？
A: 荷兰式拍卖是一种价格递减的拍卖机制，拍卖从较高的起始价格开始，随时间逐渐降低，直到第一个买家愿意以当前价格购买。这种机制特别适合需要快速售出的场景。

Q: 荷兰式拍卖与英式拍卖有什么区别？
A: 主要区别在于价格变动方向和成交机制。荷兰式拍卖价格递减，第一个接受价格的买家直接成交；而英式拍卖价格递增，通过多轮竞价确定最终买家。

### 2. 功能相关

Q: 如何确定合适的起始价格和最低价格？
A: 建议参考以下因素：
- 市场当前价格水平
- 目标售出时间
- 历史交易数据
- 潜在买家的购买力
- 类似资产的价格趋势

Q: 价格如何随时间递减？
A: 价格递减采用线性递减方式，通过以下公式计算：
```solidity
currentPrice = startPrice - (startPrice - endPrice) * elapsedTime / duration
```

Q: 如何处理提前结束的拍卖？
A: 卖家可以通过调用 `cancelAuction` 函数取消未成交的拍卖。但一旦有人购买，拍卖就会立即结束并完成交易。

### 3. 安全相关

Q: 如何防止价格操纵？
A: 合约采取以下措施：
- 严格的价格递减算法
- 交易前的余额和授权检查
- 防重入保护
- 交易原子性保证

Q: 如果交易失败了怎么办？
A: 合约包含以下保护机制：
- 所有状态更改都在最后执行
- 交易失败会自动回滚
- 买家的资金会立即退回
- 提供紧急暂停功能

### 4. 费用相关

Q: 平台费用如何计算？
A: 平台费用通过以下方式计算：
```solidity
fee = price * platformFee / 10000  // platformFee 以基点(0.01%)为单位
```

Q: 卖家最终能收到多少钱？
A: 卖家收到的金额计算公式：
```solidity
sellerProceeds = finalPrice - platformFee
```

### 5. 技术相关

Q: 为什么要使用 SafeMath？
A: SafeMath 库用于防止数值计算溢出，虽然 Solidity 0.8.0 以上版本内置了溢出检查，但使用 SafeMath 可以提供更好的兼容性和可读性。

Q: 如何处理不同代币类型？
A: 合约通过 `isERC721` 标志区分 NFT 和 ERC20 代币，并相应地调用不同的转账接口。对于 NFT，使用 `safeTransferFrom`；对于 ERC20，使用 `transferFrom`。

### 6. 最佳实践

Q: 创建拍卖时需要注意什么？
A: 建议注意以下几点：
- 确保资产已授权给合约
- 设置合理的价格区间
- 选择适当的拍卖时长
- 考虑市场活跃度
- 预估潜在买家数量

Q: 如何监控拍卖进展？
A: 可以通过以下方式：
- 监听合约事件
- 定期查询当前价格
- 跟踪参与者活动
- 使用前端工具实时展示
- 设置价格提醒

### 7. 错误处理

Q: 常见的错误码和解决方案？
A: 主要错误码说明：
- `"Not token owner"`: 确认是否拥有代币
- `"Not approved"`: 检查授权状态
- `"Duration too short/long"`: 调整拍卖时长
- `"Price must be > end price"`: 修改价格设置
- `"Auction already ended"`: 检查拍卖状态

Q: 如何处理异常情况？
A: 合约提供以下机制：
- 紧急暂停功能
- 取消拍卖选项
- 管理员干预接口
- 资金安全保护
- 状态回滚机制

### 8. 升级和维护

Q: 合约是否支持升级？
A: 当前版本不支持直接升级，但可以：
- 部署新版本合约
- 迁移未完成的拍卖
- 保留历史数据访问
- 实现平滑过渡方案

Q: 如何进行合约维护？
A: 建议采取以下措施：
- 定期检查合约状态
- 监控异常交易
- 更新安全参数
- 维护白名单
- 优化费用配置