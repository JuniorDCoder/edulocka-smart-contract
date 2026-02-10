/**
 * ============================================================================
 * HARDHAT CONFIGURATION FILE
 * ============================================================================
 *
 * WHAT IS HARDHAT?
 * Hardhat is a development framework for Ethereum smart contracts. Think of it
 * as the "toolbox" that helps you:
 *   - Write smart contracts (Solidity code)
 *   - Compile them (turn code into something the blockchain understands)
 *   - Test them (make sure they work correctly)
 *   - Deploy them (put them on the actual blockchain)
 *
 * WHAT DOES THIS FILE DO?
 * This configuration file tells Hardhat:
 *   1. Which Solidity compiler version to use
 *   2. Which blockchain networks to connect to
 *   3. What API keys to use for external services
 *   4. How to optimize your contracts
 *
 * ANALOGY: This file is like the "settings" page in an app — it controls
 * how everything behind the scenes works.
 * ============================================================================
 */

// ─── IMPORTS ────────────────────────────────────────────────────────────────
// Load the Hardhat toolbox plugin — gives us testing, deployment, and
// verification tools all in one package.
require("@nomicfoundation/hardhat-toolbox");

// Load environment variables from the .env file.
// This keeps secrets (like private keys) out of your code.
// NEVER put secrets directly in this file!
require("dotenv").config();

// ─── READ ENVIRONMENT VARIABLES ─────────────────────────────────────────────
// We read these from .env so they stay private.
// The "|| """ part means "if the variable doesn't exist, use an empty string"
// which prevents the app from crashing.
const PRIVATE_KEY = process.env.PRIVATE_KEY || "";
const SEPOLIA_RPC_URL = process.env.SEPOLIA_RPC_URL || "";
const ETHERSCAN_API_KEY = process.env.ETHERSCAN_API_KEY || "";

// Check if Sepolia credentials are real (not placeholder text)
const hasValidSepoliaConfig =
  PRIVATE_KEY.length === 64 &&
  SEPOLIA_RPC_URL.startsWith("https://") &&
  !SEPOLIA_RPC_URL.includes("YOUR-API-KEY");

// ─── EXPORT CONFIGURATION ──────────────────────────────────────────────────
/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  // ──────────────────────────────────────────────────────────────────────────
  // SOLIDITY COMPILER SETTINGS
  // ──────────────────────────────────────────────────────────────────────────
  // This tells Hardhat which version of the Solidity compiler to use.
  // Your contract's `pragma solidity ^0.8.20` must match this version.
  //
  // WHAT IS A COMPILER?
  // A compiler turns human-readable Solidity code into "bytecode" — a format
  // the Ethereum Virtual Machine (EVM) can understand and execute.
  // Think of it like translating English into machine language.
  solidity: {
    version: "0.8.20",
    settings: {
      // OPTIMIZER: Makes your contract use less gas (cheaper to deploy and use).
      // "runs: 200" means the optimizer assumes each function will be called
      // about 200 times — it balances deployment cost vs. usage cost.
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  // ──────────────────────────────────────────────────────────────────────────
  // BLOCKCHAIN NETWORKS
  // ──────────────────────────────────────────────────────────────────────────
  // Each network is a different blockchain you can deploy to.
  //
  // WHAT IS A NETWORK?
  // Ethereum has multiple "networks" (copies of the blockchain):
  //   - Mainnet: The real blockchain where real money is used
  //   - Testnets (Sepolia, Goerli): Practice blockchains with free fake ETH
  //   - Local (Hardhat): A blockchain on your own computer for testing
  networks: {
    // ── LOCAL HARDHAT NETWORK ──────────────────────────────────────────────
    // This runs entirely on your computer. No internet needed!
    // Perfect for development and testing.
    //
    // HOW TO USE:
    //   1. Run `npm run node` in one terminal (starts local blockchain)
    //   2. Run `npm run deploy:local` in another terminal (deploys contract)
    //
    // Chain ID 31337 is the standard ID for the Hardhat local network.
    hardhat: {
      chainId: 31337,
    },

    // ── SEPOLIA TEST NETWORK ───────────────────────────────────────────────
    // Sepolia is Ethereum's main test network.
    // It uses fake ETH so you can test without spending real money.
    //
    // BEFORE USING SEPOLIA, YOU NEED:
    //   1. A MetaMask wallet (browser extension)
    //   2. Free Sepolia ETH from a "faucet" (google "Sepolia faucet")
    //   3. An Alchemy or Infura account for the RPC URL
    //
    // WHAT IS AN RPC URL?
    // RPC = "Remote Procedure Call". It's the URL your code uses to talk to
    // the Ethereum network. Services like Alchemy and Infura provide these
    // for free. Think of it as the "phone number" to reach the blockchain.
    // Only include Sepolia network config when credentials are available.
    // This prevents Hardhat from complaining about missing/invalid keys
    // when you're just doing local development.
    ...(hasValidSepoliaConfig
      ? {
          sepolia: {
            url: SEPOLIA_RPC_URL,
            // Your wallet's private key, used to sign (authorize) transactions.
            // ⚠️  WARNING: Only use a TEST wallet. Never use a wallet with real funds!
            accounts: [PRIVATE_KEY],
            chainId: 11155111, // Sepolia's unique chain ID
          },
        }
      : {}),
  },

  // ──────────────────────────────────────────────────────────────────────────
  // ETHERSCAN VERIFICATION
  // ──────────────────────────────────────────────────────────────────────────
  // Etherscan is a website where people can view blockchain transactions.
  // "Verifying" your contract on Etherscan means uploading your source code
  // so anyone can read it and confirm the contract does what it claims.
  //
  // WHY VERIFY?
  // Without verification, people only see unreadable bytecode.
  // With verification, they can read your actual Solidity code.
  // This builds TRUST — essential for a certificate system!
  etherscan: {
    apiKey: ETHERSCAN_API_KEY,
  },

  // ──────────────────────────────────────────────────────────────────────────
  // GAS REPORTER (optional — shows gas costs in tests)
  // ──────────────────────────────────────────────────────────────────────────
  // When you run tests, this will show you how much gas each function uses.
  // Useful for optimizing your contract to be cheaper to use.
  gasReporter: {
    enabled: false, // Set to true to see gas reports during testing
    currency: "USD",
  },
};
