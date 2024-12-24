# NFT Marketplace Contract

## Overview

The NFT Marketplace contract (`NFTMarketplace`) implements a fully functional NFT trading marketplace that supports NFT listing, purchasing, and delisting functions. The contract uses a direct sale model where sellers can set fixed prices and buyers can purchase directly.

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
 * @title NFT Marketplace
 * @dev Implementation of NFT Marketplace Contract
 */
contract NFTMarketplace is ReentrancyGuard, Pausable, Ownable {
    using SafeMath for uint256;

    // Listing information structure
    struct Listing {
        address seller;          // Seller address
        address nftContract;     // NFT contract address
        uint256 tokenId;        // NFT ID
        uint256 price;          // Price
        address payToken;       // Payment token address (address(0) for ETH)
        bool active;            // Whether active
    }

    // Offer information structure
    struct Offer {
        address buyer;          // Buyer address
        uint256 price;          // Offer price
        uint256 expiresAt;     // Expiration time
        bool active;           // Whether active
    }

    // State variables
    mapping(uint256 => Listing) public listings;
    mapping(uint256 => mapping(address => Offer)) public offers;
    uint256 public listingIdCounter;
    uint256 public platformFee;
    address public feeRecipient;
    mapping(address => bool) public approvedPayTokens;

    // Event definitions
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
     * @dev Constructor
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
     * @dev Create listing
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
     * @dev Update listing price
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
     * @dev Cancel listing
     */
    function cancelListing(uint256 listingId) external nonReentrant {
        Listing storage listing = listings[listingId];
        require(listing.active, "Listing not active");
        require(msg.sender == listing.seller, "Not seller");

        listing.active = false;
        emit ListingCancelled(listingId, msg.sender);
    }

    /**
     * @dev Buy NFT
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
     * @dev Create offer
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
     * @dev Cancel offer
     */
    function cancelOffer(uint256 listingId) external nonReentrant {
        Offer storage offer = offers[listingId][msg.sender];
        require(offer.active, "Offer not active");
        require(offer.buyer == msg.sender, "Not offer creator");

        offer.active = false;
        
        // Return ETH
        if (listings[listingId].payToken == address(0)) {
            (bool success, ) = msg.sender.call{value: offer.price}("");
            require(success, "ETH transfer failed");
        }

        emit OfferCancelled(listingId, msg.sender);
    }

    /**
     * @dev Accept offer
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
     * @dev Execute sale
     */
    function _executeSale(
        uint256 listingId,
        address buyer,
        uint256 price
    ) internal {
        Listing storage listing = listings[listingId];
        
        // Calculate platform fee
        uint256 fee = price.mul(platformFee).div(10000);
        uint256 sellerProceeds = price.sub(fee);

        // Transfer payment
        if (listing.payToken == address(0)) {
            // Pay platform fee
            if (fee > 0) {
                (bool feeSuccess, ) = feeRecipient.call{value: fee}("");
                require(feeSuccess, "Fee transfer failed");
            }
            // Pay seller
            (bool success, ) = listing.seller.call{value: sellerProceeds}("");
            require(success, "Seller payment failed");
        } else {
            IERC20 payToken = IERC20(listing.payToken);
            // Pay platform fee
            if (fee > 0) {
                require(
                    payToken.transferFrom(buyer, feeRecipient, fee),
                    "Fee transfer failed"
                );
            }
            // Pay seller
            require(
                payToken.transferFrom(buyer, listing.seller, sellerProceeds),
                "Seller payment failed"
            );
        }

        // Transfer NFT
        IERC721(listing.nftContract).safeTransferFrom(
            listing.seller,
            buyer,
            listing.tokenId
        );

        // Update state
        listing.active = false;

        emit ListingSold(listingId, buyer, price);
    }

    /**
     * @dev Add payment token
     */
    function addPayToken(address tokenAddress) external onlyOwner {
        require(tokenAddress != address(0), "Invalid token address");
        approvedPayTokens[tokenAddress] = true;
    }

    /**
     * @dev Remove payment token
     */
    function removePayToken(address tokenAddress) external onlyOwner {
        approvedPayTokens[tokenAddress] = false;
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
     * @dev Emergency pause
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @dev Resume operation
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @dev Receive NFT callback
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

## Functionality Description

### 1. Market Management
- List NFT: Support fixed price listing
- Update Price: Allow sellers to update prices
- Cancel Listing: Support sellers to cancel listings
- Platform Fee: Support collecting transaction fees

### 2. Trading Mechanism
- Direct Purchase: Purchase NFTs at fixed prices
- Offer System: Support buyers to make offers
- Multi-Token Payment: Support ETH and ERC20 tokens
- Automatic Settlement: Complete token transfer and fund allocation

### 3. Offer Management
- Create Offer: Buyers can submit offers
- Cancel Offer: Buyers can cancel offers
- Accept Offer: Sellers can accept offers
- Expiration Mechanism: Offers automatically expire

### 4. Security Mechanism
- Reentrancy Protection: Prevent reentrancy attacks
- Pause Function: Contract can be paused in case of emergencies
- Permission Control: Only the owner can manage the contract
- Parameter Validation: Strict input parameter checks

## Usage Example

### 1. List NFT
```javascript
const price = ethers.utils.parseEther("1");    // Price 1 ETH
const payToken = ethers.constants.AddressZero; // Use ETH for payment

await nftMarketplace.createListing(
    nft.address,      // NFT contract address
    tokenId,          // NFT ID
    price,
    payToken
);
```

### 2. Buy NFT
```javascript
await nftMarketplace.buyNFT(listingId, {
    value: ethers.utils.parseEther("1")
});
```

### 3. Create Offer
```javascript
const price = ethers.utils.parseEther("0.8");    // Offer price 0.8 ETH
const duration = 86400;                          // Offer duration 1 day

await nftMarketplace.createOffer(
    listingId,
    price,
    duration,
    {
        value: price
    }
);
```

### 4. Accept Offer
```javascript
await nftMarketplace.acceptOffer(listingId, buyerAddress);
```

## Best Practices

### 1. Market Setup
- Reasonable platform fee ratio
- Strict token whitelist
- Comprehensive price validation

### 2. Security Considerations
- Regularly check contract status
- Monitor abnormal transactions
- Prepare emergency plans

### 3. Trading Management
- Handle expired offers promptly
- Monitor transaction completion
- Maintain price reasonability

### 4. Fee Calculation
- Platform fee calculation method:
```solidity
// Listing fee
listingFee = price * listingFeeRate / 10000

// Trading fee
tradingFee = price * tradingFeeRate / 10000

// Royalty
royalty = price * royaltyRate / 10000
```

### 5. Technology-Related
- Metadata handling method:
- Off-chain storage (IPFS/Arweave)
- Indexing on chain
- Caching mechanism
- Data validation
- Update mechanism

### 6. Best Practices
- Suggestions for improving transaction success rate:
- Reasonable pricing strategy
- Complete work information
- High-quality display materials
- Active community interaction
- Good buyer experience

### 7. Collection Management
- Suggestions for managing NFT collections:
- Create series standards
- Set access permissions
- Manage metadata
- Track transaction data
- Maintain community relationships

### 8. Error Handling
- Common errors and solutions:
- `"Not owner"`: Check NFT ownership
- `"Not approved"`: Confirm authorization status
- `"Invalid price"`: Correct pricing settings
- `"Insufficient funds"`: Ensure sufficient funds
- `"Already listed"`: Check listing status

### 9. Upgrade and Maintenance
- Upgrade strategies:
- Use proxy contracts
- Modular design
- Version control
- Smooth migration
- Backward compatibility

### 10. Integration and Interoperability
- Integration methods:
- Standard interface compatibility
- Cross-protocol interoperability
- Aggregator support
- Liquidity sharing
- Data sharing

### 11. Data and Analysis
- Data tracking methods:
- Event listening
- Price tracking
- Transaction volume analysis
- User behavior analysis
- Market trend reports

### 12. Data Application
- Data application:
- Pricing reference
- Market prediction
- Risk assessment
- User profiling
- Operational decision-making