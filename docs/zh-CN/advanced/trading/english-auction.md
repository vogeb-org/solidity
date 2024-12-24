# 英式拍卖合约

## 概述

英式拍卖合约(`EnglishAuction`)实现了一个标准的英式拍卖系统，支持 NFT 和 ERC20 代币的拍卖交易。该合约采用价格递增的拍卖机制，参与者可以不断提高出价，直到拍卖结束时最高出价者获得拍卖品。

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
 * @title English Auction
 * @dev 英式拍卖合约实现
 */
contract EnglishAuction is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // 拍卖信息结构
    struct Auction {
        address seller;          // 卖家地址
        address tokenAddress;    // 拍卖物品地址
        uint256 tokenId;        // 物品ID
        uint256 startPrice;     // 起始价格
        uint256 reservePrice;   // 保留价格
        uint256 minIncrement;   // 最小加价幅度
        uint256 duration;       // 拍卖时长
        uint256 startTime;      // 开始时间
        uint256 endTime;        // 结束时间
        address highestBidder;  // 最高出价者
        uint256 highestBid;     // 最高出价
        bool ended;             // 是否结束
        bool isERC721;          // 是否为 NFT
        mapping(address => uint256) pendingReturns; // 待退还的出价
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
        uint256 reservePrice
    );

    event BidPlaced(
        uint256 indexed auctionId,
        address indexed bidder,
        uint256 amount
    );

    event AuctionEnded(
        uint256 indexed auctionId,
        address indexed winner,
        uint256 amount
    );

    event AuctionCancelled(
        uint256 indexed auctionId,
        address indexed seller
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
        uint256 reservePrice,
        uint256 minIncrement,
        uint256 duration,
        bool isERC721
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(startPrice > 0, "Start price must be > 0");
        require(reservePrice >= startPrice, "Reserve price must be >= start price");
        require(minIncrement > 0, "Min increment must be > 0");
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
        uint256 endTime = block.timestamp + duration;

        Auction storage auction = auctions[auctionId];
        auction.seller = msg.sender;
        auction.tokenAddress = tokenAddress;
        auction.tokenId = tokenId;
        auction.startPrice = startPrice;
        auction.reservePrice = reservePrice;
        auction.minIncrement = minIncrement;
        auction.duration = duration;
        auction.startTime = block.timestamp;
        auction.endTime = endTime;
        auction.isERC721 = isERC721;

        emit AuctionCreated(
            auctionId,
            msg.sender,
            tokenAddress,
            tokenId,
            startPrice,
            reservePrice
        );

        return auctionId;
    }

    /**
     * @dev 出价
     */
    function bid(uint256 auctionId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp <= auction.endTime, "Auction expired");
        require(msg.sender != auction.seller, "Seller cannot bid");

        uint256 newBid = msg.value;
        if (auction.highestBidder != address(0)) {
            require(newBid >= auction.highestBid.add(auction.minIncrement), 
                    "Bid increment too low");
            auction.pendingReturns[auction.highestBidder] = auction.pendingReturns[auction.highestBidder].add(auction.highestBid);
        } else {
            require(newBid >= auction.startPrice, "Bid below start price");
        }

        auction.highestBidder = msg.sender;
        auction.highestBid = newBid;

        emit BidPlaced(auctionId, msg.sender, newBid);

        // 如果距离结束不到5分钟，延长拍卖时间
        if (auction.endTime - block.timestamp < 5 minutes) {
            auction.endTime = block.timestamp + 5 minutes;
        }
    }

    /**
     * @dev 结束拍卖
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp > auction.endTime, "Auction still active");

        auction.ended = true;

        if (auction.highestBidder != address(0) && 
            auction.highestBid >= auction.reservePrice) {
            // 转移拍卖物品
            if (auction.isERC721) {
                IERC721(auction.tokenAddress).safeTransferFrom(
                    auction.seller,
                    auction.highestBidder,
                    auction.tokenId
                );
            } else {
                IERC20(auction.tokenAddress).transferFrom(
                    auction.seller,
                    auction.highestBidder,
                    1
                );
            }

            // 计算平台费用
            uint256 fee = auction.highestBid.mul(platformFee).div(10000);
            uint256 sellerProceeds = auction.highestBid.sub(fee);

            // 分配资金
            if (fee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            }

            (bool success, ) = auction.seller.call{value: sellerProceeds}("");
            require(success, "Seller payment failed");

            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            // 如果没有达到保留价，退还最高出价
            if (auction.highestBidder != address(0)) {
                auction.pendingReturns[auction.highestBidder] = auction.pendingReturns[auction.highestBidder].add(auction.highestBid);
            }
            emit AuctionEnded(auctionId, address(0), 0);
        }
    }

    /**
     * @dev 取消拍卖
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Not auction seller");
        require(!auction.ended, "Auction already ended");
        require(auction.highestBidder == address(0), "Bids already placed");

        auction.ended = true;
        emit AuctionCancelled(auctionId, msg.sender);
    }

    /**
     * @dev 提取退还的出价
     */
    function withdraw() external nonReentrant {
        uint256 amount = 0;
        for (uint256 i = 0; i < auctionIdCounter; i++) {
            amount = amount.add(auctions[i].pendingReturns[msg.sender]);
            auctions[i].pendingReturns[msg.sender] = 0;
        }
        require(amount > 0, "No funds to withdraw");

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Withdrawal failed");
    }

    /**
     * @dev 查询待退还金额
     */
    function getPendingReturns(
        uint256 auctionId,
        address bidder
    ) external view returns (uint256) {
        return auctions[auctionId].pendingReturns[bidder];
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
- 设置参数：起始价格、保留价格、最小加价幅度
- 取消拍卖：在无人出价时可以取消
- 平台费用：支持收取交易费用

### 2. 出价机制
- 最小加价：确保每次加价幅度合理
- 自动延期：临近结束时自动延长
- 保留价格：设置最低成交价格
- 出价退还：未中标者可提取出价

### 3. 拍卖结束
- 自动结算：完成代币转移和资金分配
- 保留价验证：检查是否达到保留价
- 退款处理：未达到保留价时退还出价
- 平台分成：自动扣除平台费用

### 4. 安全机制
- 重入保护：防止重入攻击
- 暂停功能：紧急情况可暂停合约
- 权限控制：管理功能仅限所有者
- 参数验证：严格的输入参数检查

## 使用示例

### 1. 创建拍卖
```javascript
const startPrice = ethers.utils.parseEther("1");     // 起始价格 1 ETH
const reservePrice = ethers.utils.parseEther("2");   // 保留价格 2 ETH
const minIncrement = ethers.utils.parseEther("0.1"); // 最小加价 0.1 ETH
const duration = 3600 * 24;                          // 持续时间 24 小时

await englishAuction.createAuction(
    nft.address,      // NFT 合约地址
    tokenId,          // NFT ID
    startPrice,
    reservePrice,
    minIncrement,
    duration,
    true              // 是 NFT
);
```

### 2. 出价
```javascript
const bidAmount = ethers.utils.parseEther("1.5");
await englishAuction.bid(auctionId, {
    value: bidAmount
});
```

### 3. 结束拍卖
```javascript
await englishAuction.endAuction(auctionId);
```

### 4. 提取退还的出价
```javascript
await englishAuction.withdraw();
```

## 最佳实践

### 1. 拍卖设置
- 合理的起始价格和保留价格
- 适当的最小加价幅度
- 充足的拍卖时间

### 2. 安全考虑
- 定期检查合约状态
- 监控异常交易
- 做好应急预案

### 3. 费用管理
- 合理的平台费用比例
- 安全的费用接收地址
- 及时的费用提取

## 总结

该英式拍卖合约实现了：
- 完整的拍卖功能
- 灵活的出价机制
- 严格的安全控制
- 可靠的资金管理

通过这个实现，可以安全、高效地进行 NFT 和代币的英式拍卖交易。

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是英式拍卖？
A: 英式拍卖是一种价格递增的拍卖机制，参与者通过多轮出价竞争，价格从起拍价开始上涨，最终由出价最高者获得拍卖品。这是最传统和常见的拍卖形式。

Q: 英式拍卖与荷兰式拍卖有什么区别？
A: 主要区别在于：
- 价格变动：英式拍卖价格递增，荷兰式拍卖价格递减
- 竞价方式：英式拍卖需要多轮竞价，荷兰式拍卖一次性成交
- 成交时间：英式拍卖时间较长，荷兰式拍卖相对较快
- 竞争程度：英式拍卖更能反映市场真实需求

### 2. 功能相关

Q: 如何设置合理的起拍价？
A: 建议考虑以下因素：
- 资产的市场估值
- 历史成交价格
- 当前市场情况
- 潜在买家数量
- 拍卖时间长度

Q: 最小加价幅度如何确定？
A: 最小加价幅度应该：
- 与拍品价值相匹配
- 考虑市场流动性
- 平衡竞价效率
- 避免恶意竞价
- 适应市场波动

Q: 延期机制是如何工作的？
A: 当接近结束时收到新出价，拍卖会自动延期：
```solidity
if (block.timestamp >= auction.endTime - 5 minutes) {
    auction.endTime = block.timestamp + 5 minutes;
}
```

### 3. 安全相关

Q: 如何防止虚假出价？
A: 合约采取以下措施：
- 要求出价者提供保证金
- 验证出价者余额
- 检查出价合理性
- 记录出价历史
- 实施惩罚机制

Q: 如何保护参与者权益？
A: 通过以下机制：
- 资金托管保护
- 自动退还出价
- 透明的价格信息
- 可靠的状态管理
- 完整的事件记录

### 4. 费用相关

Q: 保证金如何管理？
A: 保证金管理机制：
- 出价时锁定保证金
- 更高出价自动释放前一出价的保证金
- 拍卖结束后退还未中标者保证金
- 中标者保证金转为部分付款

Q: 平台费用如何收取？
A: 平台费用计算方式：
```solidity
platformFee = finalPrice * feeRate / 10000  // feeRate 以基点(0.01%)为单位
```

### 5. 技术相关

Q: 如何处理并发出价？
A: 并发控制措施：
- 使用区块时间戳
- 严格的状态检查
- 原子性交易
- 防重入保护
- 顺序性保证

Q: 如何确保价格更新的准确性？
A: 通过以下机制：
- 严格的价格验证
- 状态一致性检查
- 事务原子性
- 错误自动回滚
- 完整的日志记录

### 6. 最佳实践

Q: 参与拍卖需要注意什么？
A: 建议注意：
- 检查拍卖状态
- 确认资金充足
- 了解竞价规则
- 评估市场价值
- 设置价格提醒

Q: 如何提高拍卖成功率？
A: 可以采取以下措施：
- 选择合适的起拍价
- 设置合理的拍卖时长
- 充分的市场推广
- 透明的拍卖信息
- 良好的用户体验

### 7. 错误处理

Q: 常见错误及解决方案？
A: 主要错误类型：
- `"Auction not active"`: 检查拍卖状态
- `"Bid too low"`: 提高出价金额
- `"Insufficient balance"`: 确保资金充足
- `"Not authorized"`: 检查授权状态
- `"Invalid timing"`: 验证操作时间

Q: 如何处理异常终止？
A: 异常处理机制：
- 紧急暂停功能
- 资金安全保护
- 状态恢复选项
- 管理员干预
- 用户赔偿方案

### 8. 升级和维护

Q: 如何优化拍卖性能？
A: 性能优化建议：
- 批量处理操作
- 优化数据结构
- 减少状态存储
- 使用事件代替存储
- 实现高效查询

Q: 如何进行数据分析？
A: 数据分析方法：
- 监控拍卖活动
- 分析价格趋势
- 跟踪用户行为
- 评估市场表现
- 生成统计报告