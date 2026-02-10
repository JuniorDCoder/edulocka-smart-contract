// ============================================================================
// EDULOCKA — Deployment Script
// ============================================================================
//
// WHAT IS A DEPLOYMENT SCRIPT?
// A deployment script is a JavaScript file that tells Hardhat how to put your
// smart contract onto the blockchain. Think of it like an "installer" — it
// compiles your code, sends it to the network, and waits for confirmation.
//
// HOW TO RUN THIS SCRIPT:
//
//   LOCAL DEPLOYMENT (on your computer):
//     1. Open terminal #1: npm run node       (starts a local blockchain)
//     2. Open terminal #2: npm run deploy:local (runs this script)
//
//   TESTNET DEPLOYMENT (on Sepolia):
//     1. Fill in your .env file with real keys (see .env.example)
//     2. Get free Sepolia ETH from a faucet
//     3. Run: npm run deploy:sepolia
//
// WHAT HAPPENS WHEN YOU DEPLOY:
//   1. Hardhat compiles your Solidity code into bytecode
//   2. Creates a "deployment transaction" with that bytecode
//   3. Signs it with your wallet's private key
//   4. Sends it to the blockchain network
//   5. Waits for miners/validators to include it in a block
//   6. The contract now lives at a unique address on the blockchain!
//
// ============================================================================

const hre = require("hardhat");

async function main() {
  console.log("=".repeat(60));
  console.log("🎓 EDULOCKA — CertificateRegistry Deployment");
  console.log("=".repeat(60));
  console.log("");

  // ── STEP 1: Get the deployer's account info ─────────────────────────────
  // `getSigners()` returns an array of wallet accounts available.
  // The first one ([0]) is the default deployer account.
  //
  // On local network: Hardhat gives you 20 pre-funded test accounts
  // On Sepolia: This is the account from your PRIVATE_KEY in .env
  const [deployer] = await hre.ethers.getSigners();

  console.log("📋 Deployment Details:");
  console.log("   Deployer address:", deployer.address);

  // Show the deployer's ETH balance
  // `provider.getBalance()` returns the balance in Wei (smallest ETH unit)
  // `formatEther()` converts Wei to ETH (1 ETH = 10^18 Wei)
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log("   Deployer balance:", hre.ethers.formatEther(balance), "ETH");

  // Show which network we're deploying to
  const network = await hre.ethers.provider.getNetwork();
  console.log("   Network:", network.name, `(Chain ID: ${network.chainId})`);
  console.log("");

  // ── STEP 2: Get the contract factory ────────────────────────────────────
  // A "factory" is an object that knows how to deploy your contract.
  // It contains the compiled bytecode and ABI (Application Binary Interface).
  //
  // WHAT IS AN ABI?
  // The ABI is like a menu at a restaurant — it lists all the functions
  // your contract has, what inputs they take, and what they return.
  // Frontend apps use the ABI to know how to talk to your contract.
  console.log("📝 Compiling and preparing contract...");
  const CertificateRegistry = await hre.ethers.getContractFactory(
    "CertificateRegistry"
  );

  // ── STEP 3: Deploy the contract ─────────────────────────────────────────
  // `.deploy()` sends the deployment transaction to the network.
  // This costs gas! On local network it's free, on Sepolia it uses test ETH.
  console.log("🚀 Deploying CertificateRegistry...");
  const certificateRegistry = await CertificateRegistry.deploy();

  // ── STEP 4: Wait for deployment to complete ─────────────────────────────
  // `waitForDeployment()` waits until the transaction is included in a block.
  // On local: nearly instant
  // On Sepolia: usually 15-30 seconds
  await certificateRegistry.waitForDeployment();

  // ── STEP 5: Get the deployed contract's address ─────────────────────────
  // Every deployed contract gets a unique address on the blockchain.
  // This is like the contract's "URL" — you need it to interact with it.
  const contractAddress = await certificateRegistry.getAddress();

  console.log("");
  console.log("✅ CertificateRegistry deployed successfully!");
  console.log("=".repeat(60));
  console.log("📍 Contract Address:", contractAddress);
  console.log("=".repeat(60));
  console.log("");
  console.log(
    "📋 SAVE THIS ADDRESS! You'll need it to interact with your contract."
  );
  console.log(
    "   Update CONTRACT_ADDRESS in scripts/interact.js with this value."
  );
  console.log("");

  // ── STEP 6: Verify on Etherscan (only on public networks) ──────────────
  // We only verify on real networks (not local Hardhat network).
  // Chain ID 31337 = Hardhat's local network.
  if (network.chainId !== 31337n) {
    console.log("⏳ Waiting for block confirmations before verification...");
    console.log("   (This ensures Etherscan has indexed the contract)");

    // Wait for 6 blocks to be mined after deployment.
    // Etherscan needs time to index the transaction.
    // 6 confirmations is considered "safe" on most networks.
    const deployTx = certificateRegistry.deploymentTransaction();
    if (deployTx) {
      await deployTx.wait(6);
    }

    console.log("🔍 Verifying contract on Etherscan...");
    try {
      await hre.run("verify:verify", {
        address: contractAddress,
        constructorArguments: [], // Our constructor takes no arguments
      });
      console.log("✅ Contract verified on Etherscan!");
      console.log(
        `   View at: https://sepolia.etherscan.io/address/${contractAddress}`
      );
    } catch (error) {
      // Verification can fail for various reasons (already verified,
      // Etherscan API issues, etc.) — it's not critical.
      if (error.message.includes("Already Verified")) {
        console.log("ℹ️  Contract is already verified on Etherscan.");
      } else {
        console.log("⚠️  Verification failed (non-critical):", error.message);
        console.log("   You can verify manually on Etherscan later.");
      }
    }
  } else {
    console.log(
      "ℹ️  Skipping Etherscan verification (local network detected)."
    );
  }

  // ── STEP 7: Post-deployment summary ─────────────────────────────────────
  console.log("");
  console.log("─".repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE! Next steps:");
  console.log("─".repeat(60));
  console.log("");
  console.log("1. Save the contract address above");
  console.log("2. Update CONTRACT_ADDRESS in scripts/interact.js");
  console.log(
    "3. Update your frontend config with the contract address"
  );
  console.log("4. Run `npm run interact:local` to test the contract");
  console.log("");

  // Return the contract instance and address (useful if this script is imported)
  return { certificateRegistry, contractAddress };
}

// ── EXECUTE ──────────────────────────────────────────────────────────────────
// This pattern (main().then().catch()) is the standard way to run async
// scripts in Node.js. It ensures errors are caught and printed properly.
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed!");
    console.error(error);
    process.exit(1);
  });
