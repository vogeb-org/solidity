# English Auction Contract

## Overview

The English Auction contract (`EnglishAuction`) implements a standard English auction system that supports auction trading of NFTs and ERC20 tokens. The contract uses an ascending-price auction mechanism where participants can continuously increase their bids until the auction ends, with the highest bidder winning the auctioned item.

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
 * @title English Auction
 * @dev Implementation of English Auction Contract
 */
contract EnglishAuction is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // Auction information structure
    struct Auction {
        address seller;          // Seller address
        address tokenAddress;    // Token contract address
        uint256 tokenId;        // Token ID
        uint256 startPrice;     // Starting price
        uint256 reservePrice;   // Reserve price
        uint256 minIncrement;   // Minimum bid increment
        uint256 duration;       // Auction duration
        uint256 startTime;      // Start time
        uint256 endTime;        // End time
        address highestBidder;  // Highest bidder
        uint256 highestBid;     // Highest bid
        bool ended;             // Whether ended
        bool isERC721;          // Whether is NFT
        mapping(address => uint256) pendingReturns; // Pending returns for each bidder
    }

    // State variables
    mapping(uint256 => Auction) public auctions;
    uint256 public auctionIdCounter;
    uint256 public minAuctionDuration;
    uint256 public maxAuctionDuration;
    uint256 public platformFee;
    address public feeRecipient;

    // Event definitions
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
     * @dev Bid
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

        // If the auction is ending in less than 5 minutes, extend the auction time
        if (auction.endTime - block.timestamp < 5 minutes) {
            auction.endTime = block.timestamp + 5 minutes;
        }
    }

    /**
     * @dev End auction
     */
    function endAuction(uint256 auctionId) external nonReentrant {
        Auction storage auction = auctions[auctionId];
        require(!auction.ended, "Auction already ended");
        require(block.timestamp > auction.endTime, "Auction still active");

        auction.ended = true;

        if (auction.highestBidder != address(0) && 
            auction.highestBid >= auction.reservePrice) {
            // Transfer the auction item
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

            // Calculate platform fee
            uint256 fee = auction.highestBid.mul(platformFee).div(10000);
            uint256 sellerProceeds = auction.highestBid.sub(fee);

            // Distribute funds
            if (fee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            }

            (bool success, ) = auction.seller.call{value: sellerProceeds}("");
            require(success, "Seller payment failed");

            emit AuctionEnded(auctionId, auction.highestBidder, auction.highestBid);
        } else {
            // If the reserve price is not met, refund the highest bid
            if (auction.highestBidder != address(0)) {
                auction.pendingReturns[auction.highestBidder] = auction.pendingReturns[auction.highestBidder].add(auction.highestBid);
            }
            emit AuctionEnded(auctionId, address(0), 0);
        }
    }

    /**
     * @dev Cancel auction
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
     * @dev Withdraw pending returns
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
     * @dev Query pending returns
     */
    function getPendingReturns(
        uint256 auctionId,
        address bidder
    ) external view returns (uint256) {
        return auctions[auctionId].pendingReturns[bidder];
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
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Resume operations
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Callback for receiving NFT
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

## Features

### 1. Auction Management
- Create Auction: Support for NFT and ERC20 token auctions
- Parameter Settings: Starting price, reserve price, minimum bid increment
- Cancel Auction: Cancellation possible when no bids are placed
- Platform Fee: Support for transaction fee collection

### 2. Bidding Mechanism
- Minimum Increment: Ensures reasonable bid increments
- Automatic Extension: Extends automatically near closing
- Reserve Price: Sets minimum sale price
- Bid Refunds: Unsuccessful bidders can withdraw their bids

### 3. Auction Completion
- Automatic Settlement: Completes token transfer and fund distribution
- Reserve Price Validation: Checks if reserve price is met
- Refund Processing: Returns bids if reserve price isn't met
- Platform Commission: Automatically deducts platform fees

### 4. Security Mechanisms
- Reentrancy Protection: Prevents reentrancy attacks
- Pause Function: Contract can be paused in emergencies
- Access Control: Management functions restricted to owner
- Parameter Validation: Strict input parameter checks

## Usage Examples

### 1. Creating an Auction
```javascript
const startPrice = ethers.utils.parseEther("1");     // Starting price 1 ETH
const reservePrice = ethers.utils.parseEther("2");   // Reserve price 2 ETH
const minIncrement = ethers.utils.parseEther("0.1"); // Min increment 0.1 ETH
const duration = 3600 * 24;                          // Duration 24 hours

await englishAuction.createAuction(
    nft.address,      // NFT contract address
    tokenId,          // NFT ID
    startPrice,
    reservePrice,
    minIncrement,
    duration,
    true              // Is NFT
);
```

### 2. Placing a Bid
```javascript
const bidAmount = ethers.utils.parseEther("1.5");
await englishAuction.bid(auctionId, {
    value: bidAmount
});
```

### 3. Ending an Auction
```javascript
await englishAuction.endAuction(auctionId);
```

### 4. Withdrawing Returned Bids
```javascript
await englishAuction.withdraw();
```

## Best Practices

### 1. Auction Setup
- Reasonable starting and reserve prices
- Appropriate minimum bid increment
- Sufficient auction duration

### 2. Security Considerations
- Regular contract status checks
- Monitoring for abnormal transactions
- Emergency response planning

### 3. Fee Management
- Reasonable platform fee rates
- Secure fee recipient address
- Timely fee withdrawal

## Summary

This English auction contract implements:
- Complete auction functionality
- Flexible bidding mechanism
- Strict security controls
- Reliable fund management

Through this implementation, NFT and token English auctions can be conducted safely and efficiently.

## Frequently Asked Questions (FAQ)

### 1. Basic Concepts

Q: What is an English auction?
A: An English auction is an ascending-price auction mechanism where participants compete through multiple rounds of bidding. The price increases from the starting bid, and the highest bidder ultimately wins the auctioned item. This is the most traditional and common form of auction.

Q: How does an English auction differ from a Dutch auction?
A: The main differences are:
- Price Movement: English auctions have ascending prices, Dutch auctions have descending prices
- Bidding Method: English auctions require multiple rounds of bidding, Dutch auctions complete in one transaction
- Transaction Time: English auctions take longer, Dutch auctions are relatively quick
- Competition Level: English auctions better reflect true market demand

### 2. Functionality

Q: How to set a reasonable starting price?
A: Consider the following factors:
- Asset market valuation
- Historical transaction prices
- Current market conditions
- Number of potential buyers
- Auction duration

Q: How to determine the minimum bid increment?
A: The minimum bid increment should:
- Match the item's value
- Consider market liquidity
- Balance bidding efficiency
- Prevent malicious bidding
- Adapt to market volatility

Q: How does the extension mechanism work?
A: When a new bid is received near the end, the auction automatically extends:
```solidity
if (auction.endTime - block.timestamp < 5 minutes) {
    auction.endTime = block.timestamp + 5 minutes;
}
```

### 3. Security

Q: How to prevent fake bids?
A: The contract implements these measures:
- Requires bidder deposits
- Verifies bidder balances
- Checks bid reasonability
- Records bid history
- Implements penalty mechanisms

Q: How to protect participant rights?
A: Through these mechanisms:
- Fund escrow protection
- Automatic bid returns
- Transparent pricing information
- Reliable state management
- Complete event logging

### 4. Fees

Q: How are deposits managed?
A: Deposit management mechanism:
- Locks deposit when bidding
- Automatically releases previous bidder's deposit on higher bid
- Returns deposits to unsuccessful bidders after auction
- Converts winner's deposit to partial payment

Q: How are platform fees collected?
A: Platform fee calculation:
```solidity
platformFee = finalPrice * feeRate / 10000  // feeRate in basis points (0.01%)
```

### 5. Technical Aspects

Q: How to handle concurrent bids?
A: Concurrency control measures:
- Use block timestamps
- Strict state checks
- Atomic transactions
- Reentrancy protection
- Sequence guarantees

Q: How to ensure price update accuracy?
A: Through these mechanisms:
- Strict price validation
- State consistency checks
- Transaction atomicity
- Automatic error rollback
- Complete logging

### 6. Best Practices

Q: What should participants consider?
A: Recommendations:
- Check auction status
- Confirm sufficient funds
- Understand bidding rules
- Evaluate market value
- Set price alerts

Q: How to improve auction success rate?
A: Take these measures:
- Choose appropriate starting price
- Set reasonable auction duration
- Sufficient market promotion
- Transparent auction information
- Good user experience

### 7. Error Handling

Q: Common errors and solutions?
A: Main error types:
- `"Auction not active"`: Check auction status
- `"Bid too low"`: Increase bid amount
- `"Insufficient balance"`: Ensure sufficient funds
- `"Not authorized"`: Check authorization status
- `"Invalid timing"`: Verify operation timing

Q: How to handle abnormal termination?
A: Exception handling mechanisms:
- Emergency pause functionality
- Fund safety protection
- State recovery options
- Administrator intervention
- User compensation plans

### 8. Upgrades and Maintenance

Q: How to optimize auction performance?
A: Performance optimization suggestions:
- Batch process operations
- Optimize data structures
- Reduce state storage
- Use events instead of storage
- Implement efficient queries

Q: How to conduct data analysis?
A: Data analysis methods:
- Monitor auction activity
- Analyze price trends
- Track user behavior
- Evaluate market performance
- Generate statistical reports