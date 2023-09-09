## Solidity Developer Take-Home Challenge

### 1. Install:

Clone this repository.\
Navigate to the main folder of the cloned repo.\
Install npm dependencies:

```bash
npm install
```

### 2. Test:

Run tests with hardhat:

```bash
npx hardhat test
```

### 3. Local deployment:

I have prepared two ways for localdeployment

If you have a local node (like Ganache) running, you can deploy the contracts with:

```bash
npx hardhat run scripts/deploy.js --network localhost
```

This is a preferred method as it doesn't require running a separate local node instance like Ganache. Deploy the contracts using:

```bash
npx hardhat run scripts/deploy.js --network hardhat
```

### 4. Deployment to Goerli Testnet:

You need to create a `.env` file in the root directory of your project (look .env.example).
Inside the `.env` file, specify your Ethereum wallet's private key and Infura project ID:

```markdown
PRIVATE_KEY=your_private_key_here
INFURA_PROJECT_ID=your_infura_project_id_here
```

Now you can deploy the contracts to the Goerli testnet using:

```bash
npx hardhat run scripts/deploy.js --network goerli
```

Ropsten and Rinkeby testnets are deprecated for this project's purposes, so I recommended to use Goerli for testnet deployments.
