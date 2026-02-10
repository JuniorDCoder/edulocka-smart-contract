# 🎓 Edulocka — Smart Contracts

> **Blockchain-powered academic certificate verification system**

This folder contains the Solidity smart contracts for Edulocka. If you're new to blockchain development, you're in the right place — everything is thoroughly explained for beginners.

---

## 📋 Table of Contents

1. [What Is This?](#-what-is-this)
2. [Prerequisites](#-prerequisites)
3. [Installation](#-installation)
4. [Smart Contract Explained](#-smart-contract-explained)
5. [How to Test](#-how-to-test)
6. [How to Deploy](#-how-to-deploy)
7. [Interacting with the Contract](#-interacting-with-the-contract)
8. [Project Structure](#-project-structure)
9. [Common Errors & Solutions](#-common-errors--solutions)
10. [Blockchain Concepts for Beginners](#-blockchain-concepts-for-beginners)

---

## 🤔 What Is This?

Edulocka is a system that stores academic certificates **on a blockchain**. Once a certificate is recorded, it:

- ✅ **Can't be faked** — only authorized institutions can issue certificates
- ✅ **Can't be altered** — blockchain data is immutable (unchangeable)
- ✅ **Can be verified by anyone** — employers, other universities, anyone
- ✅ **Lives forever** — no central server that can go offline

### How It Works (Simple Version)

```
University registers on Edulocka
         ↓
University issues a certificate for a student
         ↓
Certificate data is stored permanently on the blockchain
         ↓
Anyone can verify the certificate by its ID — for free!
```

---

## 📦 Prerequisites

Before you start, make sure you have:

| Tool | Version | How to Check | How to Install |
|------|---------|-------------|---------------|
| **Node.js** | ≥ 18.0 | `node --version` | [nodejs.org](https://nodejs.org) |
| **npm** | ≥ 9.0 | `npm --version` | Comes with Node.js |
| **Git** | Any | `git --version` | [git-scm.com](https://git-scm.com) |

### Optional (for deploying to real networks)

- **MetaMask wallet** — [metamask.io](https://metamask.io)
- **Sepolia test ETH** — Free from [sepoliafaucet.com](https://sepoliafaucet.com) or [Alchemy faucet](https://sepoliafaucet.com/)
- **Etherscan API key** — Free from [etherscan.io/apis](https://etherscan.io/apis)
- **Alchemy/Infura RPC URL** — Free from [alchemy.com](https://www.alchemy.com) or [infura.io](https://infura.io)

---

## 🚀 Installation

```bash
# 1. Navigate to the smart-contracts folder
cd smart-contracts

# 2. Install all dependencies
npm install

# 3. Compile the smart contracts
npx hardhat compile

# 4. Run the test suite
npm test
```

If everything works, you should see green checkmarks ✅ for all tests!

---

## 📜 Smart Contract Explained

Our main contract is **`CertificateRegistry.sol`** located in `contracts/`.

### What Can It Do?

| Function | Who Can Call It | Cost |
|----------|----------------|------|
| `addInstitution(address)` | Contract owner only | Gas fee |
| `removeInstitution(address)` | Contract owner only | Gas fee |
| `issueCertificate(...)` | Authorized institutions | Gas fee |
| `revokeCertificate(id)` | Original issuer or owner | Gas fee |
| `verifyCertificate(id)` | **Anyone** | **FREE** |
| `getCertificate(id)` | **Anyone** | **FREE** |
| `certificateExistsCheck(id)` | **Anyone** | **FREE** |
| `getTotalCertificates()` | **Anyone** | **FREE** |

> 💡 **Why are some functions free?** Functions that only _read_ data (marked `view` in Solidity) don't change the blockchain, so they don't need gas. Functions that _write_ data require a transaction and gas.

### Certificate Data Structure

Each certificate stores:

```solidity
struct Certificate {
    string studentName;    // "Alice Johnson"
    string studentId;      // "STU-12345"
    string degree;         // "BSc Computer Science"
    string institution;    // "MIT"
    uint256 issueDate;     // Unix timestamp
    string ipfsHash;       // Link to full document
    address issuer;        // Wallet address of issuer
    bool isValid;          // true until revoked
    bool exists;           // true if certificate exists
}
```

### Security Features

- **Ownable** — Only the owner (deployer) can manage institutions
- **ReentrancyGuard** — Prevents re-entrancy attacks
- **Custom Errors** — Gas-efficient error handling
- **Input Validation** — Rejects empty fields and zero addresses

---

## 🧪 How to Test

Tests verify that your contract works correctly before you deploy it with real money.

```bash
# Run all tests
npm test

# Run tests with gas usage report
npm run test:verbose

# Run a specific test file
npx hardhat test test/CertificateRegistry.test.js
```

### What Do the Tests Cover?

| Category | Tests | What's Checked |
|----------|-------|---------------|
| **Deployment** | 4 | Owner is set, counters start at zero |
| **Institution Management** | 10 | Add/remove institutions, permissions, events |
| **Certificate Issuance** | 8 | Issue, store, track, reject unauthorized |
| **Certificate Verification** | 5 | Read data, anyone can verify, events |
| **Certificate Revocation** | 8 | Revoke, permissions, double-revoke prevention |
| **Edge Cases** | 4 | Multiple certs, indexing, full lifecycle |

### Expected Output

```
CertificateRegistry
  Deployment
    ✓ should set the deployer as the owner
    ✓ should start with zero certificates
    ✓ should start with zero institutions
    ...
  Institution Management
    Adding Institutions
      ✓ should allow owner to add an institution
      ✓ should emit InstitutionAdded event
      ...

  39 passing (2s)
```

---

## 🌐 How to Deploy

### Option 1: Local Deployment (for development)

This creates a personal blockchain on your computer. It's fast, free, and resets every time you restart.

```bash
# Terminal 1: Start a local blockchain node
npm run node

# Terminal 2: Deploy the contract to local node
npm run deploy:local
```

You'll see output like:
```
📍 Contract Address: 0x5FbDB2315678afecb367f032d93F642f64180aa3
```

### Option 2: Sepolia Testnet (for real-world testing)

Sepolia is a test version of Ethereum. It works exactly like the real thing but uses fake ETH.

**Step 1:** Create a `.env` file from the template:
```bash
cp .env.example .env
```

**Step 2:** Fill in your `.env` file:
```env
PRIVATE_KEY=your_wallet_private_key_here
SEPOLIA_RPC_URL=https://eth-sepolia.g.alchemy.com/v2/your-api-key
ETHERSCAN_API_KEY=your_etherscan_api_key
```

> ⚠️ **NEVER share your private key!** The `.env` file is git-ignored for safety.

**Step 3:** Get free Sepolia ETH from a faucet (you need ~0.01 ETH for deployment).

**Step 4:** Deploy!
```bash
npm run deploy:sepolia
```

The script will:
1. Compile the contract
2. Deploy to Sepolia
3. Wait for 6 block confirmations
4. Verify the contract on Etherscan automatically

---

## 🔧 Interacting with the Contract

After deploying, you can interact with your contract:

### Using the Interaction Script

```bash
# 1. Open scripts/interact.js
# 2. Paste your contract address into CONTRACT_ADDRESS
# 3. Run:
npm run interact:local    # For local
npm run interact:sepolia  # For Sepolia
```

### Using Hardhat Console

```bash
npx hardhat console --network localhost
```

Then in the console:
```javascript
const contract = await ethers.getContractAt("CertificateRegistry", "YOUR_ADDRESS");
await contract.getTotalCertificates();
```

---

## 📁 Project Structure

```
smart-contracts/
├── contracts/
│   └── CertificateRegistry.sol   # Main smart contract
├── scripts/
│   ├── deploy.js                 # Deployment script
│   └── interact.js               # Post-deployment interaction demo
├── test/
│   └── CertificateRegistry.test.js  # Comprehensive test suite
├── .env.example                  # Environment variable template
├── .gitignore                    # Git ignore rules
├── hardhat.config.js             # Hardhat configuration
├── package.json                  # Dependencies & scripts
└── README.md                     # This file!
```

---

## ❌ Common Errors & Solutions

### `Error: Cannot find module 'hardhat'`
**Cause:** Dependencies not installed.  
**Fix:** Run `npm install` in the `smart-contracts/` folder.

### `Error: ProviderError: Nonce too high`
**Cause:** You reset your local node but your MetaMask still has old transaction data.  
**Fix:** In MetaMask → Settings → Advanced → Clear Activity Tab Data.

### `Error: insufficient funds for gas`
**Cause:** Your wallet doesn't have enough ETH.  
**Fix:**  
- Local: Hardhat accounts have 10,000 free ETH  
- Sepolia: Get free ETH from a [faucet](https://sepoliafaucet.com)

### `Error: PRIVATE_KEY is not defined`
**Cause:** Missing `.env` file or empty private key.  
**Fix:** Copy `.env.example` to `.env` and fill in your keys.

### `Error: NotAuthorizedInstitution()`
**Cause:** Trying to issue a certificate from a non-authorized address.  
**Fix:** The contract owner must first call `addInstitution(address)`.

### `Error: CertificateAlreadyExists()`
**Cause:** Trying to issue a certificate with an ID that already exists.  
**Fix:** Use a unique certificate ID for each certificate.

### Compilation warnings about SPDX license
**Fix:** Make sure your `.sol` file has `// SPDX-License-Identifier: MIT` at the top.

---

## 📚 Blockchain Concepts for Beginners

### What Is a Smart Contract?

A smart contract is a program that lives on the blockchain. Think of it like a **vending machine**:

- You put in money (send a transaction)
- The machine follows its rules automatically (contract code runs)
- You get your product (the blockchain state changes)
- Nobody can break the rules (code is law)

Unlike a regular program on a server, a smart contract:
- Can't be turned off by anyone
- Can't be changed after deployment
- Runs exactly as written, always

### What Is Gas?

Gas is the "electricity" that powers operations on the blockchain.

- Every operation (storing data, calculating results) costs a certain amount of gas
- You pay gas fees in ETH (Ethereum's currency)
- More complex operations = more gas = higher cost
- Gas prevents spam — you can't flood the network with free transactions

**In our contract:**
- Issuing a certificate: ~150,000 gas (~$0.50-$2 on Ethereum mainnet)
- Verifying a certificate: **0 gas (free!)** because it only reads data

### What Is a Transaction?

A transaction is a signed message that changes the blockchain state.

```
Transaction = {
  from:    Your wallet address
  to:      The contract address
  data:    The function to call + its arguments
  gas:     Maximum gas you're willing to pay
  signed:  Your private key's signature (proves it's really you)
}
```

### What Is an Address?

An address is a unique identifier on the blockchain, like an email address.

- **Wallet address:** `0x742d35Cc6634C0532925a3b844Bc9e7595dB3d` — belongs to a person
- **Contract address:** `0x5FbDB2315678afecb367f032d93F642f64180aa3` — belongs to a contract
- Both are 42 characters long (0x + 40 hex characters)
- Generated from a private key using cryptography

### What Is a Private Key?

Your private key is like a **master password** for your blockchain wallet.

- It proves you own an address
- It lets you sign transactions
- **NEVER share it with anyone!**
- If lost, your funds are gone forever (no "forgot password" button)

### What Is a Testnet?

A testnet is a practice version of a real blockchain.

| Feature | Mainnet (Real) | Testnet (Practice) |
|---------|----------------|-------------------|
| ETH value | Real money ($$$) | Fake/free ETH |
| Permanence | Forever | May be reset |
| Use case | Production | Development & testing |
| Speed | Same | Same |
| How it works | Same | Same |

**We use Sepolia testnet** — it works identically to Ethereum mainnet but with free test ETH.

---

## 🤝 Contributing

1. Fork the repo
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Write tests for your changes
4. Make sure all tests pass: `npm test`
5. Submit a pull request

---

## 📄 License

MIT License — see the contract source for details.

---

**Built with ❤️ for Edulocka** — Making academic credentials trustworthy, transparent, and tamper-proof.
# edulocka-smart-contract
