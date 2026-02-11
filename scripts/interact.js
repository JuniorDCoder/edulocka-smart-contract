// ============================================================================
// EDULOCKA — Contract Interaction Script
// ============================================================================
//
// WHAT IS THIS SCRIPT?
// After deploying your contract, you need a way to interact with it —
// call functions, read data, etc. This script shows you how to do that
// from JavaScript code (which is exactly what your frontend will do too!).
//
// Think of this as a "test drive" for your deployed contract.
//
// HOW TO RUN:
//   Local:   npm run interact:local   (after deploying locally)
//   Sepolia: npm run interact:sepolia (after deploying to Sepolia)
//
// BEFORE RUNNING:
//   1. Deploy the contract first (npm run deploy:local)
//   2. Copy the contract address from the deployment output
//   3. Paste it into CONTRACT_ADDRESS below
//
// ============================================================================

const hre = require("hardhat");

// ⚠️  REPLACE THIS with your actual deployed contract address!
// You get this address from the deploy script output.
const CONTRACT_ADDRESS = "0xfdc705f32A85AA367c73e4F3EB602Bf9018CeF3f";

async function main() {
  console.log("=".repeat(60));
  console.log("🎓 EDULOCKA — Contract Interaction Demo");
  console.log("=".repeat(60));
  console.log("");

  // ── Validate contract address ────────────────────────────────────────────
  if (CONTRACT_ADDRESS === "PASTE_YOUR_CONTRACT_ADDRESS_HERE") {
    console.error("❌ ERROR: You need to set CONTRACT_ADDRESS first!");
    console.error("   1. Deploy the contract: npm run deploy:local");
    console.error("   2. Copy the address from the output");
    console.error("   3. Paste it into CONTRACT_ADDRESS in this file");
    process.exit(1);
  }

  // ── Get test accounts ────────────────────────────────────────────────────
  // On local network, Hardhat gives us 20 pre-funded accounts.
  // We'll use them to simulate different roles:
  //   - owner:       The contract deployer (admin)
  //   - institution: A university that issues certificates
  //   - verifier:    Someone verifying a certificate (e.g., an employer)
  const [owner, institution, verifier] = await hre.ethers.getSigners();

  console.log("📋 Accounts:");
  console.log("   Owner (admin):  ", owner.address);
  console.log("   Institution:    ", institution.address);
  console.log("   Verifier:       ", verifier.address);
  console.log("");

  // ── Connect to the deployed contract ─────────────────────────────────────
  // `getContractAt` connects to an already-deployed contract.
  // We need the contract name (for the ABI) and the address.
  //
  // WHAT IS HAPPENING HERE?
  // We're creating a JavaScript object that represents our smart contract.
  // When we call methods on this object, it sends real transactions to
  // the blockchain (or reads data from it).
  const contract = await hre.ethers.getContractAt(
    "CertificateRegistry",
    CONTRACT_ADDRESS
  );

  console.log("✅ Connected to CertificateRegistry at:", CONTRACT_ADDRESS);
  console.log("");

  // ========================================================================
  // DEMO 1: Add an Authorized Institution
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 1: Authorize an Institution");
  console.log("─".repeat(60));
  console.log("");

  // Only the owner can add institutions.
  // `contract.addInstitution(address)` calls the smart contract function.
  //
  // WHAT HAPPENS BEHIND THE SCENES:
  //   1. Ethers.js creates a transaction calling addInstitution()
  //   2. The transaction is signed with the owner's private key
  //   3. It's sent to the blockchain network
  //   4. Miners/validators include it in a block
  //   5. The contract code runs and updates the state
  //   6. We get a transaction receipt with the results
  console.log("   Adding institution:", institution.address);
  const addTx = await contract.addInstitution(
    institution.address,
    "Test University",
    "REG-2024-001",
    "United States"
  );

  // `.wait()` waits for the transaction to be confirmed (included in a block)
  // It returns a "receipt" with details about the transaction.
  const addReceipt = await addTx.wait();

  console.log("   ✅ Institution authorized!");
  console.log("   Transaction hash:", addReceipt.hash);
  console.log("   Block number:   ", addReceipt.blockNumber);
  console.log("   Gas used:       ", addReceipt.gasUsed.toString());
  console.log("");

  // Verify the institution is authorized (this is a free read call)
  const isAuthorized = await contract.isAuthorizedInstitution(
    institution.address
  );
  console.log("   Is authorized?  ", isAuthorized); // Should print: true
  console.log("");

  // ========================================================================
  // DEMO 2: Issue a Certificate
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 2: Issue a Certificate");
  console.log("─".repeat(60));
  console.log("");

  // We need to call issueCertificate FROM the institution's address.
  // `contract.connect(institution)` creates a new contract instance that
  // signs transactions with the institution's key instead of the owner's.
  //
  // ANALOGY: It's like logging into a website with a different user account.
  const institutionContract = contract.connect(institution);

  // Prepare certificate data
  const certData = {
    id: "CERT-2026-001",
    studentName: "Alice Johnson",
    studentId: "STU-12345",
    degree: "Bachelor of Science in Computer Science",
    institution: "MIT — Massachusetts Institute of Technology",
    issueDate: Math.floor(Date.now() / 1000), // Current time as Unix timestamp
    ipfsHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  };

  console.log("   Issuing certificate:", certData.id);
  console.log("   Student:", certData.studentName);
  console.log("   Degree: ", certData.degree);
  console.log("");

  // Call the issueCertificate function
  const issueTx = await institutionContract.issueCertificate(
    certData.id,
    certData.studentName,
    certData.studentId,
    certData.degree,
    certData.institution,
    certData.issueDate,
    certData.ipfsHash
  );

  const issueReceipt = await issueTx.wait();

  console.log("   ✅ Certificate issued on-chain!");
  console.log("   Transaction hash:", issueReceipt.hash);
  console.log("   Block number:   ", issueReceipt.blockNumber);
  console.log("   Gas used:       ", issueReceipt.gasUsed.toString());
  console.log("");

  // ── Check events from the transaction ────────────────────────────────────
  // Events are stored in the transaction receipt's logs.
  // We can parse them to get structured data.
  console.log("   📡 Events emitted:");
  for (const log of issueReceipt.logs) {
    try {
      const parsed = contract.interface.parseLog(log);
      if (parsed && parsed.name === "CertificateIssued") {
        console.log("      Event: CertificateIssued");
        console.log("      - Certificate ID:", parsed.args[0]);
        console.log("      - Student:       ", parsed.args[1]);
        console.log("      - Institution:   ", parsed.args[2]);
        console.log("      - Issuer:        ", parsed.args[3]);
      }
    } catch {
      // Skip logs we can't parse (from other contracts)
    }
  }
  console.log("");

  // ── Issue a second certificate for more demo data ────────────────────────
  console.log("   Issuing second certificate...");
  const issueTx2 = await institutionContract.issueCertificate(
    "CERT-2026-002",
    "Bob Williams",
    "STU-12346",
    "Master of Data Science",
    "MIT — Massachusetts Institute of Technology",
    Math.floor(Date.now() / 1000),
    "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG"
  );
  await issueTx2.wait();
  console.log("   ✅ Second certificate issued!");
  console.log("");

  // ========================================================================
  // DEMO 3: Verify a Certificate
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 3: Verify a Certificate");
  console.log("─".repeat(60));
  console.log("");

  // Anyone can verify — we'll use the "verifier" account to prove this.
  // Note: Read-only (view) functions are FREE — no gas needed!
  const verifierContract = contract.connect(verifier);

  console.log("   Verifying certificate:", certData.id);
  console.log("   (Called by verifier:", verifier.address, ")");
  console.log("");

  // Call verifyCertificate — returns multiple values
  const [isValid, studentName, degree, inst, issueDate, issuer] =
    await verifierContract.verifyCertificate(certData.id);

  console.log("   📜 Verification Result:");
  console.log("   ─────────────────────────────────────────");
  console.log("   Valid:       ", isValid ? "✅ YES" : "❌ NO");
  console.log("   Student:     ", studentName);
  console.log("   Degree:      ", degree);
  console.log("   Institution: ", inst);
  console.log(
    "   Issue Date:  ",
    new Date(Number(issueDate) * 1000).toISOString()
  );
  console.log("   Issuer Addr: ", issuer);
  console.log("");

  // Also try getCertificate for the full struct
  const fullCert = await contract.getCertificate(certData.id);
  console.log("   Full certificate data:");
  console.log("   IPFS Hash:   ", fullCert.ipfsHash);
  console.log("   Student ID:  ", fullCert.studentId);
  console.log("   Exists:      ", fullCert.exists);
  console.log("");

  // ========================================================================
  // DEMO 4: Check Contract Statistics
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 4: Contract Statistics");
  console.log("─".repeat(60));
  console.log("");

  const totalCerts = await contract.getTotalCertificates();
  const totalInst = await contract.totalInstitutions();
  const totalRevoked = await contract.totalRevocations();

  console.log("   📊 Contract Stats:");
  console.log("   Total Certificates: ", totalCerts.toString());
  console.log("   Total Institutions: ", totalInst.toString());
  console.log("   Total Revocations:  ", totalRevoked.toString());
  console.log("");

  // ========================================================================
  // DEMO 5: Revoke a Certificate
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 5: Revoke a Certificate");
  console.log("─".repeat(60));
  console.log("");

  console.log("   Revoking certificate: CERT-2026-002");
  console.log("   (Only the original issuer can do this)");
  console.log("");

  // Revoke using the institution account (the original issuer)
  const revokeTx = await institutionContract.revokeCertificate("CERT-2026-002");
  const revokeReceipt = await revokeTx.wait();

  console.log("   ✅ Certificate CERT-2026-002 revoked!");
  console.log("   Transaction hash:", revokeReceipt.hash);
  console.log("");

  // Verify the revoked certificate
  const [isStillValid] = await contract.verifyCertificate("CERT-2026-002");
  console.log(
    "   CERT-2026-002 still valid?",
    isStillValid ? "✅ YES" : "❌ NO (revoked)"
  );
  console.log("");

  // Check updated stats
  const updatedRevoked = await contract.totalRevocations();
  console.log("   Updated revocation count:", updatedRevoked.toString());
  console.log("");

  // ========================================================================
  // DEMO 6: Error Handling — Unauthorized Issuance
  // ========================================================================
  console.log("─".repeat(60));
  console.log("📌 STEP 6: Error Handling Demo");
  console.log("─".repeat(60));
  console.log("");

  // Try to issue a certificate from an unauthorized address (the verifier)
  console.log("   Trying to issue from unauthorized address...");
  try {
    await verifierContract.issueCertificate(
      "CERT-FAKE-001",
      "Fake Student",
      "FAKE-123",
      "Fake Degree",
      "Fake University",
      Math.floor(Date.now() / 1000),
      "QmFakeHash123"
    );
    console.log("   ❌ This should not succeed!");
  } catch (error) {
    console.log("   ✅ Correctly rejected! Unauthorized address cannot issue.");
    console.log("   Error:", error.message.slice(0, 100) + "...");
  }
  console.log("");

  // Try to issue a duplicate certificate
  console.log("   Trying to issue duplicate certificate ID...");
  try {
    await institutionContract.issueCertificate(
      "CERT-2026-001", // Already exists!
      "Another Student",
      "STU-99999",
      "Another Degree",
      "MIT",
      Math.floor(Date.now() / 1000),
      "QmDuplicateHash"
    );
    console.log("   ❌ This should not succeed!");
  } catch (error) {
    console.log("   ✅ Correctly rejected! Duplicate IDs are not allowed.");
    console.log("   Error:", error.message.slice(0, 100) + "...");
  }
  console.log("");

  // ========================================================================
  // SUMMARY
  // ========================================================================
  console.log("=".repeat(60));
  console.log("🎉 All interaction demos completed successfully!");
  console.log("=".repeat(60));
  console.log("");
  console.log("What we demonstrated:");
  console.log("  ✅ Added an authorized institution");
  console.log("  ✅ Issued 2 certificates on-chain");
  console.log("  ✅ Verified a certificate (free read call)");
  console.log("  ✅ Checked contract statistics");
  console.log("  ✅ Revoked a certificate");
  console.log("  ✅ Showed error handling for unauthorized actions");
  console.log("");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Script failed!");
    console.error(error);
    process.exit(1);
  });
