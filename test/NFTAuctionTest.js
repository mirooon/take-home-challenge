const { ethers } = require("hardhat");
const { expect } = require("chai");
const ethUtil = require("ethereumjs-util");

describe("NFTAuction", function () {
  let nftAuction, nft, owner, addr1, expectedTokenID;

  beforeEach(async function () {
    [owner, addr1, addr2, _] = await ethers.getSigners();

    nft = await ethers.deployContract("MockNFT");
    await nft.safeMint(owner.address);
    expectedTokenID = 0;

    let predictedAddress = await predictContractAddress(owner.address, 1);
    // you will probably ask why I need to predict NFTAuction contract address

    // Predicting the contract address is essential in the setup process of the auction. Before the NFTAuction contract is deployed, it requires permission to handle a specific NFT on behalf of its owner. By forecasting the address of the soon-to-be-deployed NFTAuction contract, the owner can give advance approval for the contract to manage the NFT. Once the NFTAuction contract is deployed, it immediately tries to take control of the specified NFT. Thanks to the prior prediction and approval, this transition is seamless. This approach also eliminates the need for a separate startAuction function, making the deployment more gas efficient. In essence, predicting the contract address streamlines the sequence of operations, ensuring the auction contract can access the NFT right upon its initiation and saving on gas costs. I am aware of frontrunning attack

    await nft.approve(predictedAddress, expectedTokenID);

    nftAuction = await ethers.deployContract("NFTAuction", [
      nft.target,
      expectedTokenID,
      60,
      ethers.parseEther("0.1"),
    ]);
  });

  it("Should transfer NFT to auction contract upon initialization", async function () {
    expect(await nft.ownerOf(expectedTokenID)).to.equal(nftAuction.target);
  });

  it("Should set initial values correctly", async function () {
    const currentTime = (await ethers.provider.getBlock("latest")).timestamp;
    const expectedEndTime = currentTime + 60 * 60;

    expect(await nftAuction.auctionEndTime()).to.be.closeTo(expectedEndTime, 2); // Assuming a buffer of 2 seconds
    expect(await nftAuction.minimumBid()).to.equal(ethers.parseEther("0.1"));
  });

  it("Allows bidding and ends auction correctly", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    expect(await nftAuction.highestBidder()).to.equal(addr1.address);
    expect(await nftAuction.highestBid()).to.equal(ethers.parseEther("0.2"));

    await ethers.provider.send("evm_increaseTime", [3600]);
    await ethers.provider.send("evm_mine");

    await nftAuction.endAuction();

    expect(await nft.ownerOf(expectedTokenID)).to.equal(addr1.address);
  });

  it("Reverts if bidding after auction end time", async function () {
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");

    await expect(
      nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") })
    ).to.be.revertedWith("Auction has ended");
  });

  it("Reverts if ending the auction before it should", async function () {
    await expect(nftAuction.endAuction()).to.be.revertedWith(
      "Auction has not ended yet"
    );
  });

  it("Reverts if bidding below the minimum bid", async function () {
    await expect(
      nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.05") })
    ).to.be.revertedWith("Bid is below the minimum");
  });

  it("Reverts if bidding below the highest bid", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await expect(
      nftAuction.connect(addr2).bid({ value: ethers.parseEther("0.1") })
    ).to.be.revertedWith("There already is a higher bid");
  });

  it("Reverts if trying to withdraw without any pending returns", async function () {
    await expect(nftAuction.connect(addr1).withdraw()).to.be.revertedWith(
      "Nothing to withdraw"
    );
  });

  it("Should return funds to previous highest bidder after being outbid", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await nftAuction.connect(addr2).bid({ value: ethers.parseEther("0.3") });
    expect(await nftAuction.pendingReturns(addr1.address)).to.equal(
      ethers.parseEther("0.2")
    );
  });

  it("Should allow a user to withdraw their returns", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await nftAuction.connect(addr2).bid({ value: ethers.parseEther("0.3") });
    await nftAuction.connect(addr1).withdraw();
    expect(await nftAuction.pendingReturns(addr1.address)).to.equal(0);
  });

  it("Should transfer the NFT to the winning bidder after the auction ends", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");
    await nftAuction.endAuction();
    expect(await nft.ownerOf(expectedTokenID)).to.equal(addr1.address);
  });

  it("Should transfer the highest bid to the contract owner after the auction ends", async function () {
    const initialBalance = await ethers.provider.getBalance(owner.address);
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");
    await nftAuction.endAuction();
    expect(await ethers.provider.getBalance(owner.address)).to.be.gt(
      initialBalance
    );
  });

  it("Should not allow ending the auction multiple times", async function () {
    await nftAuction.connect(addr1).bid({ value: ethers.parseEther("0.2") });
    await ethers.provider.send("evm_increaseTime", [3601]);
    await ethers.provider.send("evm_mine");
    await nftAuction.endAuction();
    await expect(nftAuction.endAuction()).to.be.revertedWith(
      "Auction has not ended yet"
    );
  });

  it("Should revert if bidding with zero value", async function () {
    await expect(
      nftAuction.connect(addr1).bid({ value: ethers.parseEther("0") })
    ).to.be.revertedWith("Bid is below the minimum");
  });

  const predictContractAddress = async (
    deployerAddress,
    transactionsAfterPrediction = 0
  ) => {
    const nonce =
      (await ethers.provider.getTransactionCount(deployerAddress)) +
      transactionsAfterPrediction;

    // Convert nonce to a buffer, ensuring it is of length 2 bytes.
    const nonceBuffer = Buffer.alloc(2);
    nonceBuffer.writeUInt16BE(nonce);

    const contractAddressBuffer = ethUtil.generateAddress(
      Buffer.from(deployerAddress.slice(2), "hex"),
      nonceBuffer
    );

    const contractAddress = ethUtil.bufferToHex(contractAddressBuffer);
    return contractAddress;
  };
});
