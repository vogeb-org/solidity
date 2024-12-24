# Dutch Auction Contract

## Overview

The Dutch Auction Contract (`DutchAuction`) implements a standard Dutch auction system that supports auction trading for both NFTs and ERC20 tokens. This contract uses a price-decreasing auction mechanism where the price starts high and gradually decreases over time until a buyer accepts the current price.

## Contract Implementation

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
 * @dev Dutch auction contract implementation
 */
contract DutchAuction is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // Auction information structure
    struct Auction {
        address seller;          // Seller address
        address tokenAddress;    // Auction item address
        uint256 tokenId;        // Item ID
        uint256 startPrice;     // Starting price
        uint256 endPrice;       // Minimum price
        uint256 duration;       // Auction duration
        uint256 startTime;      // Start time
        uint256 priceStep;      // Price decrement step
        bool ended;             // Whether ended
        bool isERC721;          // Whether NFT
    }

    // State variables
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionIdCounter;
    uint256 public minAuctionDuration;
    uint256 public maxAuctionDuration;
    uint256 public platformFee;
    address public feeRecipient;

    // Events
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
     * @dev Constructor
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
     * @dev Create auction
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
     * @dev Buy auction item
     */
    function buy(uint256 auctionId) external payable whenNotPaused nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp <= auction.startTime + auction.duration, "Auction expired");

        uint256 currentPrice = getCurrentPrice(auctionId);
        require(msg.value >= currentPrice, "Insufficient payment");

        auction.ended = true;

        // Transfer auction item
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

        // Calculate platform fee
        uint256 fee = currentPrice.mul(platformFee).div(10000);
        uint256 sellerProceeds = currentPrice.sub(fee);

        // Distribute funds
        if (fee > 0) {
            (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
            require(feeSuccess, "Fee transfer failed");
        }

        (bool success, ) = auction.seller.call{value: sellerProceeds}("");
        require(success, "Seller payment failed");

        // Refund excess ETH
        if (msg.value > currentPrice) {
            (bool refundSuccess, ) = msg.sender.call{value: msg.value - currentPrice}("");
            require(refundSuccess, "Refund failed");
        }

        emit AuctionSuccessful(auctionId, msg.sender, currentPrice);
    }

    /**
     * @dev Cancel auction
     */
    function cancelAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(msg.sender == auction.seller, "Not auction seller");
        require(!auction.ended, "Auction already ended");

        auction.ended = true;
        emit AuctionCancelled(auctionId, msg.sender);
    }

    /**
     * @dev Get current price
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
     * @dev Update platform fee
     */
    function updatePlatformFee(uint256 _platformFee) external onlyOwner {
        require(_platformFee <= 1000, "Platform fee must be <= 10%");
        platformFee = _platformFee;
    }

    /**
     * @dev Update fee recipient
     */
    function updateFeeRecipient(address _feeRecipient) external onlyOwner {
        require(_feeRecipient != address(0), "Invalid fee recipient");
        feeRecipient = _feeRecipient;
    }

    /**
     * @dev Update auction duration limits
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
     * @dev Pause contract
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Unpause contract
     */
    function unpause() external onlyOwner {
        _unpause();
    }
}
```

## Function Description

### 3.1 Core Functions
- Create auction: Set up new auction with initial parameters
- Buy: Purchase auction item at current price
- Cancel auction: Cancel an ongoing auction
- Get current price: Calculate current auction price

### 3.2 Administrative Functions
- Update platform fee: Modify platform fee percentage
- Update fee recipient: Change fee recipient address
- Update duration limits: Modify minimum and maximum auction durations
- Pause/Unpause: Emergency controls

### 3.3 View Functions
- Get auction details: View auction information
- Get current price: Check current auction price
- Get platform settings: View fee and duration parameters

## Security Mechanisms

### 4.1 Access Control
- Owner-only administrative functions
- Seller-only auction cancellation
- Contract pause mechanism

### 4.2 Transaction Safety
- Reentrancy protection
- Safe math operations
- Token approval checks
- Payment validation

### 4.3 Price Management
- Automatic price calculation
- Price bounds enforcement
- Duration limits
- Fee restrictions

## Usage Examples

### 5.1 Create Auction
```javascript
const tokenAddress = "0x..."; // NFT or token address
const tokenId = 1;            // Token ID
const startPrice = ethers.utils.parseEther("1.0");
const endPrice = ethers.utils.parseEther("0.1");
const duration = 86400;       // 24 hours
const isERC721 = true;       // Is NFT

await dutchAuction.createAuction(
    tokenAddress,
    tokenId,
    startPrice,
    endPrice,
    duration,
    isERC721
);
```

### 5.2 Buy Item
```javascript
const auctionId = 0;
const currentPrice = await dutchAuction.getCurrentPrice(auctionId);
await dutchAuction.buy(auctionId, { value: currentPrice });
```

### 5.3 Cancel Auction
```javascript
const auctionId = 0;
await dutchAuction.cancelAuction(auctionId);
```

## Best Practices

### 6.1 For Sellers
- Set appropriate start and end prices
- Choose reasonable auction duration
- Ensure proper token approvals
- Monitor price changes
- Consider market conditions

### 6.2 For Buyers
- Check current price before buying
- Verify auction status
- Ensure sufficient funds
- Consider gas costs
- Monitor price trends

### 6.3 For Administrators
- Set reasonable platform fees
- Monitor contract activity
- Maintain secure fee recipient
- Regular parameter reviews
- Emergency response readiness

## Frequently Asked Questions (FAQ)

### 1. General Questions

Q: What is a Dutch Auction?
A: A Dutch auction is a price-discovery mechanism where:
- Price starts high and decreases over time
- First buyer to accept the current price wins
- Encourages quick decision-making
- Efficient price discovery
- Automatic price reduction

Q: Why use Dutch Auctions?
A: Benefits include:
- Quick sales completion
- Price discovery efficiency
- Reduced market manipulation
- Transparent mechanism
- Fair opportunity for buyers

### 2. Technical Questions

Q: How is price calculated?
A: Price calculation:
```javascript
currentPrice = startPrice - (priceStep * elapsedTime)
if (currentPrice < endPrice) currentPrice = endPrice
```

Q: How to handle fees?
A: Fee management:
- Platform fee calculated from final price
- Automatic fee distribution
- Configurable fee percentage
- Secure fee recipient
- Transparent fee structure

### 3. Security Questions

Q: What are the main risks?
A: Key considerations:
- Front-running attacks
- Price manipulation
- Contract vulnerabilities
- Gas optimization
- Token approval risks

Q: How to ensure safe usage?
A: Safety measures:
- Verify auction parameters
- Check token approvals
- Monitor price changes
- Use safe transfer methods
- Handle errors properly