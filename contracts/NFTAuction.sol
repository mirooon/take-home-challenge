// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract NFTAuction is Ownable {
    IERC721 public nftAddress;
    uint256 public nftId;
    uint256 public minimumBid;
    uint256 public auctionEndTime;
    address public highestBidder;
    uint256 public highestBid;

    mapping(address => uint256) public pendingReturns;

    bool public ended = false;

    event AuctionStarted(address indexed owner, uint256 nftId, uint256 endTime);
    event NewBid(address indexed bidder, uint256 amount);
    event AuctionEnded(address indexed winner, uint256 amount);

    modifier auctionOngoing() {
        require(block.timestamp < auctionEndTime, "Auction has ended");
        _;
    }

    modifier auctionEnded() {
        require(
            block.timestamp >= auctionEndTime && !ended,
            "Auction has not ended yet"
        );
        _;
    }

    constructor(
        address _nftAddress,
        uint256 _nftId,
        uint256 _durationInMinutes,
        uint256 _minimumBid
    ) {
        nftAddress = IERC721(_nftAddress);
        nftId = _nftId;
        auctionEndTime = block.timestamp + (_durationInMinutes * 1 minutes);
        minimumBid = _minimumBid;

        nftAddress.transferFrom(owner(), address(this), nftId);

        emit AuctionStarted(owner(), nftId, auctionEndTime);
    }

    function bid() external payable auctionOngoing {
        require(msg.value >= minimumBid, "Bid is below the minimum");
        require(msg.value > highestBid, "There already is a higher bid");

        if (highestBid != 0) {
            pendingReturns[highestBidder] += highestBid;
        }

        highestBidder = msg.sender;
        highestBid = msg.value;

        emit NewBid(msg.sender, msg.value);
    }

    function withdraw() external {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "Nothing to withdraw");

        pendingReturns[msg.sender] = 0;

        payable(msg.sender).transfer(amount);
    }

    function endAuction() external onlyOwner auctionEnded {
        ended = true;
        emit AuctionEnded(highestBidder, highestBid);
        payable(owner()).transfer(highestBid);
        nftAddress.transferFrom(address(this), highestBidder, nftId);
    }
}
