# NFT 市场合约

## 概述

NFT 市场合约(`NFTMarketplace`)实现了一个功能完整的 NFT 交易市场，支持 NFT 的上架、购买、取消上架等功能。该合约采用直接销售的模式，卖家可以设定固定价格，买家可以直接购买。

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
 * @title NFT Marketplace
 * @dev NFT 市场合约实现
 */
contract NFTMarketplace is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // 上架信息结构
    struct Listing {
        address seller;          // 卖家地址
        address nftContract;     // NFT 合约地址
        uint256 tokenId;        // NFT ID
        uint256 price;          // 价格
        address payToken;       // 支付代币地址(address(0) 表示 ETH)
        bool active;            // 是否有效
    }

    // 报价信息结构
    struct Offer {
        address buyer;          // 买家地址
        uint256 price;          // 报价
        uint256 expiresAt;     // 过期时间
        bool active;           // 是否有效
    }

    // 状态变量
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => mapping(address => Offer)) public offers;
    uint256 public listingIdCounter;
    uint256 public platformFee;
    address public feeRecipient;
    mapping(address => bool) public approvedPayTokens;

    // 事件定义
    event ListingCreated(
        uint256 indexed listingId,
        address indexed seller,
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address payToken
    );

    event ListingUpdated(
        uint256 indexed listingId,
        uint256 newPrice
    );

    event ListingCancelled(
        uint256 indexed listingId,
        address indexed seller
    );

    event ListingSold(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price
    );

    event OfferCreated(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price,
        uint256 expiresAt
    );

    event OfferCancelled(
        uint256 indexed listingId,
        address indexed buyer
    );

    event OfferAccepted(
        uint256 indexed listingId,
        address indexed buyer,
        uint256 price
    );

    /**
     * @dev 构造函数
     */
    constructor(
        uint256 _platformFee,
        address _feeRecipient
    ) {
        require(_platformFee <= 1000, "Platform fee must be <= 10%");
        require(_feeRecipient != address(0), "Invalid fee recipient");

        platformFee = _platformFee;
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev 创建上架
     */
    function createListing(
        address nftContract,
        uint256 tokenId,
        uint256 price,
        address payToken
    ) external whenNotPaused nonReentrant returns (uint256) {
        require(price > 0, "Price must be > 0");
        require(
            payToken == address(0) || approvedPayTokens[payToken],
            "Payment token not approved"
        );

        IERC721 nft = IERC721(nftContract);
        require(nft.ownerOf(tokenId) == msg.sender, "Not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(tokenId) == address(this),
            "Not approved"
        );

        uint256 listingId = listingIdCounter++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: nftContract,
            tokenId: tokenId,
            price: price,
            payToken: payToken,
            active: true
        });

        emit ListingCreated(
            listingId,
            msg.sender,
            nftContract,
            tokenId,
            price,
            payToken
        );

        return listingId;
    }

    /**
     * @dev 更新上架价格
     */
    function updateListing(
        uint256 listingId,
        uint256 newPrice
    ) external nonReentrant {
        require(newPrice > 0, "Price must be > 0");
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender == listing.seller, "Not seller");

        listing.price = newPrice;
        emit ListingUpdated(listingId, newPrice);
    }

    /**
     * @dev 取消上架
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender == listing.seller, "Not seller");

        listing.active = false;
        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @dev 购买 NFT
     */
    function buyNFT(uint256 listingId) external payable nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Seller cannot buy");

        if (listing.payToken == address(0)) {
            require(msg.value >= listing.price, "Insufficient payment");
        } else {
            require(msg.value == 0, "ETH not accepted");
            IERC20 payToken = IERC20(listing.payToken);
            require(
                payToken.allowance(msg.sender, address(this)) >= listing.price,
                "Not approved"
            );
            require(
                payToken.balanceOf(msg.sender) >= listing.price,
                "Insufficient balance"
            );
        }

        _executeSale(listingId, msg.sender, listing.price);
    }

    /**
     * @dev 创建报价
     */
    function createOffer(
        uint256 listingId,
        uint256 price,
        uint256 duration
    ) external payable nonReentrant {
        require(duration > 0 && duration <= 30 days, "Invalid duration");
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender != listing.seller, "Seller cannot offer");
        require(price > 0, "Price must be > 0");

        if (listing.payToken == address(0)) {
            require(msg.value >= price, "Insufficient payment");
        } else {
            require(msg.value == 0, "ETH not accepted");
            IERC20 payToken = IERC20(listing.payToken);
            require(
                payToken.allowance(msg.sender, address(this)) >= price,
                "Not approved"
            );
            require(
                payToken.balanceOf(msg.sender) >= price,
                "Insufficient balance"
            );
        }

        offers[listingId][msg.sender] = Offer({
            buyer: msg.sender,
            price: price,
            expiresAt: block.timestamp + duration,
            active: true
        });

        emit OfferCreated(listingId, msg.sender, price, block.timestamp + duration);
    }

    /**
     * @dev 取消报价
     */
    function cancelOffer(uint256 listingId) external nonReentrant {
        Offer storage offer = offers[listingId][msg.sender];
        require(offer.active, "Offer not active");
        require(offer.buyer == msg.sender, "Not offer creator");

        offer.active = false;
        
        // 退还 ETH
        if (listings[listingId].payToken == address(0)) {
            (bool success, ) = msg.sender.call{value: offer.price}("");
            require(success, "ETH transfer failed");
        }

        emit OfferCancelled(listingId, msg.sender);
    }

    /**
     * @dev 接受报价
     */
    function acceptOffer(
        uint256 listingId,
        address buyer
    ) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender == listing.seller, "Not seller");

        Offer storage offer = offers[listingId][buyer];
        require(offer.active, "Offer not active");
        require(block.timestamp <= offer.expiresAt, "Offer expired");

        _executeSale(listingId, buyer, offer.price);
        offer.active = false;

        emit OfferAccepted(listingId, buyer, offer.price);
    }

    /**
     * @dev 执行销售
     */
    function _executeSale(
        uint256 listingId,
        address buyer,
        uint256 price
    ) internal {
        Listing storage listing = listings[listingId];
        
        // 计算平台费用
        uint256 fee = price.mul(platformFee).div(10000);
        uint256 sellerProceeds = price.sub(fee);

        // 转移支付
        if (listing.payToken == address(0)) {
            // 支付平台费用
            if (fee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            }
            // 支付卖家
            (bool success, ) = listing.seller.call{value: sellerProceeds}("");
            require(success, "Seller payment failed");
        } else {
            IERC20 payToken = IERC20(listing.payToken);
            // 支付平台费用
            if (fee > 0) {
                require(
                    payToken.transferFrom(buyer, feeRecipient, fee),
                    "Fee transfer failed"
                );
            }
            // 支付卖家
            require(
                payToken.transferFrom(buyer, listing.seller, sellerProceeds),
                "Seller payment failed"
            );
        }

        // 转移 NFT
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            buyer,
            listing.tokenId
        );

        // 更新状态
        listing.active = false;

        emit ListingSold(listingId, buyer, price);
    }

    /**
     * @dev 添加支付代币
     */
    function addPayToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        approvedPayTokens[tokenAddress] = true;
    }

    /**
     * @dev 移除支付代币
     */
    function removePayToken(address tokenAddress) external onlyOwner {
        approvedPayTokens[tokenAddress] = false;
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

### 1. 市场管理
- 上架 NFT：支持固定价格上架
- 更新价格：允许卖家更新价格
- 取消上架：支持卖家取消上架
- 平台费用：支持收取交易费用

### 2. 交易机制
- 直接购买：按照固定价格购买
- 报价系统：支持买家出价
- 多币种支付：支持 ETH 和 ERC20 代币
- 自动结算：完成代币转移和资金分配

### 3. 报价管理
- 创建报价：买家可以提交报价
- 取消报价：买家可以取消报价
- 接受报价：卖家可以接受报价
- 过期机制：报价自动过期

### 4. 安全机制
- 重入保护：防止重入攻击
- 暂停功能：紧急情况可暂停合约
- 权限控制：管理功能仅限所有者
- 参数验证：严格的输入参数检查

## 使用示例

### 1. 上架 NFT
```javascript
const price = ethers.utils.parseEther("1");    // 价格 1 ETH
const payToken = ethers.constants.AddressZero; // 使用 ETH 支付

await nftMarketplace.createListing(
    nft.address,      // NFT 合约地址
    tokenId,          // NFT ID
    price,
    payToken
);
```

### 2. 购买 NFT
```javascript
await nftMarketplace.buyNFT(listingId, {
    value: ethers.utils.parseEther("1")
});
```

### 3. 创建报价
```javascript
const price = ethers.utils.parseEther("0.8");    // 报价 0.8 ETH
const duration = 86400;                          // 有效期 1 天

await nftMarketplace.createOffer(
    listingId,
    price,
    duration,
    {
        value: price
    }
);
```

### 4. 接受报价
```javascript
await nftMarketplace.acceptOffer(listingId, buyerAddress);
```

## 最佳实践

### 1. 市场设置
- 合理的平台费用比例
- 严格的代币白名单
- 完善的价格验证

### 2. 安全考虑
- 定期检查合约状态
- 监控异常交易
- 做好应急预案

### 3. 交易管理
- 及时处理过期报价
- 监控交易完成情况
- 保持价格合理性

## 总结

该 NFT 市场合约实现了：
- 完整的交易功能
- 灵活的支付方式
- 严格的安全控制
- 可靠的资金管理

通过这个实现，可以安全、高效地进行 NFT 的交易和管理。

## 常见问题解答（FAQ）

### 1. 基本概念

Q: 什么是 NFT 市场？
A: NFT 市场是一个去中心化的交易平台，允许用户上架、购买、出售和交易非同质化代币（NFT）。它为 NFT 创作者和收藏者提供了一个安全、透明的交易环境。

Q: NFT 市场与传统交易所有什么区别？
A: 主要区别包括：
- 交易对象：NFT 是独特的非同质化资产
- 定价机制：通常采用固定价格或拍卖方式
- 版税机制：支持创作者持续获得收益
- 交易方式：一物一价，不可分割
- 元数据存储：需要处理链下数据

### 2. 功能相关

Q: 如何上架 NFT？
A: 上架流程包括：
- 确保拥有 NFT 所有权
- 授权市场合约操作
- 设置售价和条件
- 提供必要的元数据
- 支付上架费用（如有）

Q: 如何设置合理的售价？
A: 建议考虑以下因素：
- 作品的稀有度
- 创作者知名度
- 市场同类作品价格
- 历史交易数据
- 当前市场趋势

### 3. 安全相关

Q: 如何保护 NFT 安全？
A: 采取以下措施：
- 严格的所有权验证
- 安全的授权机制
- 交易签名验证
- 防重入保护
- 紧急暂停功能

Q: 如何防止欺诈交易？
A: 通过以下机制：
- 身份验证系统
- 信用评级机制
- 交易历史追踪
- 争议解决流程
- 社区监督机制

### 4. 费用相关

Q: 平台费用如何收取？
A: 费用结构如下：
```solidity
// 上架费用
listingFee = price * listingFeeRate / 10000

// 交易费用
tradingFee = price * tradingFeeRate / 10000

// 创作者版税
royalty = price * royaltyRate / 10000
```

Q: 版税如何分配？
A: 版税分配机制：
- 自动计算应付版税
- 直接支付给创作者
- 支持多级分成
- 可配置分成比例
- 透明的分配记录

### 5. 技术相关

Q: 如何处理元数据？
A: 元数据管理方案：
- 链下存储（IPFS/Arweave）
- 链上索引
- 缓存机制
- 数据验证
- 更新机制

Q: 如何优化 Gas 费用？
A: 优化策略包括：
- 批量处理交易
- 优化数据结构
- 减少存储操作
- 使用事件代替存储
- 实现 EIP-2981

### 6. 最佳实践

Q: 如何提高交易成功率？
A: 建议采取：
- 合理定价策略
- 完整的作品信息
- 优质的展示材料
- 活跃的社区互动
- 良好的买家体验

Q: 如何管理 NFT 集合？
A: 集合管理建议：
- 创建系列标准
- 设置访问权限
- 管理元数据
- 跟踪交易数据
- 维护社区关系

### 7. 错误处理

Q: 常见错误及解决方案？
A: 主要错误类型：
- `"Not owner"`: 检查 NFT 所有权
- `"Not approved"`: 确认授权状态
- `"Invalid price"`: 修正定价设置
- `"Insufficient funds"`: 确保资金充足
- `"Already listed"`: 检查上架状态

Q: 如何处理交易失败？
A: 失败处理机制：
- 自动回滚交易
- 退还支付金额
- 恢复 NFT 状态
- 记录错误原因
- 通知相关方

### 8. 升级和维护

Q: 如何升级市场功能？
A: 升级策略：
- 使用代理合约
- 模块化设计
- 版本控制
- 平滑迁移
- 向后兼容

Q: 如何维护市场健康？
A: 维护措施：
- 监控交易活动
- 处理用户反馈
- 更新安全参数
- 优化用户体验
- 社区治理参与

### 9. 集成和互操作

Q: 如何与其他协议集成？
A: 集成方案：
- 标准接口兼容
- 跨协议互操作
- 聚合器支持
- 流动性共享
- 数据互通

Q: 如何实现跨链功能？
A: 跨链实现：
- 桥接协议集成
- 跨链消息传递
- 资产映射
- 状态同步
- 安全验证

### 10. 数据和分析

Q: 如何追踪市场数据？
A: 数据追踪方法：
- 事件监听
- 价格追踪
- 交易量分析
- 用户行为分析
- 市场趋势报告

Q: 如何使用市场数据？
A: 数据应用：
- 定价参考
- 市场预测
- 风险评估
- 用户画像
- 运营决策