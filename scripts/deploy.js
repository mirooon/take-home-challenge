const hre = require("hardhat");
const ethUtil = require("ethereumjs-util");

async function main() {
  const [deployer] = await hre.ethers.getSigners();

  const mockNft = await hre.ethers.deployContract("MockNFT");
  console.log("MockNFT deployed to:", mockNft.target);

  const mintTx = await mockNft.safeMint(deployer.address);
  await mintTx.wait();
  console.log(`Minted a new NFT to ${deployer.address} with ID: 0`);

  // Predict the next contract address and approve it
  const predictedAuctionAddress = await predictContractAddress(
    deployer.address,
    1
  );
  // you will probably ask why I need to predict NFTAuction contract address

  // Predicting the contract address is essential in the setup process of the auction. Before the NFTAuction contract is deployed, it requires permission to handle a specific NFT on behalf of its owner. By forecasting the address of the soon-to-be-deployed NFTAuction contract, the owner can give advance approval for the contract to manage the NFT. Once the NFTAuction contract is deployed, it immediately tries to take control of the specified NFT. Thanks to the prior prediction and approval, this transition is seamless. This approach also eliminates the need for a separate startAuction function, making the deployment more gas efficient. In essence, predicting the contract address streamlines the sequence of operations, ensuring the auction contract can access the NFT right upon its initiation and saving on gas costs. I am aware of frontrunning attack
  const approveTx = await mockNft.approve(predictedAuctionAddress, 0);
  await approveTx.wait();
  const tokenId = 0;
  const durationInMinutes = 60;
  const minimumBid = hre.ethers.parseEther("0.1");
  const nftAuction = await hre.ethers.deployContract("NFTAuction", [
    mockNft.target,
    tokenId,
    durationInMinutes,
    minimumBid,
  ]);
  console.log("NFTAuction deployed to:", nftAuction.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
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
