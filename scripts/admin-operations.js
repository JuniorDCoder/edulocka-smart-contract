// ============================================================================
// Admin Operations Script — Manage institutions from the command line
// ============================================================================
// Usage:
//   npx hardhat run scripts/admin-operations.js --network localhost
//
// Environment:
//   Set OPERATION and parameters before running:
//   OPERATION=add ADDRESS=0x... NAME="University" REG="REG-001" COUNTRY="US"
//   OPERATION=remove ADDRESS=0x...
//   OPERATION=suspend ADDRESS=0x...
//   OPERATION=reactivate ADDRESS=0x...
//   OPERATION=list
//   OPERATION=info ADDRESS=0x...
// ============================================================================

const hre = require("hardhat");

const OPERATIONS = {
  async add() {
    const address = process.env.ADDRESS;
    const name = process.env.NAME;
    const reg = process.env.REG;
    const country = process.env.COUNTRY;

    if (!address || !name || !reg || !country) {
      console.error("❌ Missing params. Required: ADDRESS, NAME, REG, COUNTRY");
      process.exit(1);
    }

    const contract = await getContract();
    console.log(`\n🏛️  Adding institution: ${name}`);
    console.log(`   Address: ${address}`);
    console.log(`   Registration: ${reg}`);
    console.log(`   Country: ${country}\n`);

    const tx = await contract.addInstitution(address, name, reg, country);
    const receipt = await tx.wait();
    console.log(`✅ Institution added!`);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
  },

  async remove() {
    const address = process.env.ADDRESS;
    if (!address) { console.error("❌ Missing ADDRESS"); process.exit(1); }

    const contract = await getContract();
    console.log(`\n🗑️  Removing institution: ${address}`);

    const tx = await contract.removeInstitution(address);
    const receipt = await tx.wait();
    console.log(`✅ Institution removed!`);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
  },

  async suspend() {
    const address = process.env.ADDRESS;
    if (!address) { console.error("❌ Missing ADDRESS"); process.exit(1); }

    const contract = await getContract();
    console.log(`\n⏸️  Suspending institution: ${address}`);

    const tx = await contract.suspendInstitution(address);
    const receipt = await tx.wait();
    console.log(`✅ Institution suspended!`);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
  },

  async reactivate() {
    const address = process.env.ADDRESS;
    if (!address) { console.error("❌ Missing ADDRESS"); process.exit(1); }

    const contract = await getContract();
    console.log(`\n▶️  Reactivating institution: ${address}`);

    const tx = await contract.reactivateInstitution(address);
    const receipt = await tx.wait();
    console.log(`✅ Institution reactivated!`);
    console.log(`   TX Hash: ${tx.hash}`);
    console.log(`   Gas Used: ${receipt.gasUsed.toString()}`);
  },

  async list() {
    const contract = await getContract();
    const count = Number(await contract.getAllInstitutionCount());
    console.log(`\n📋 Total institutions: ${count}\n`);

    for (let i = 0; i < count; i++) {
      const addr = await contract.getInstitutionAddressByIndex(i);
      const inst = await contract.getInstitution(addr);
      const isAuth = await contract.isAuthorizedInstitution(addr);
      const dateStr = inst.authorizedDate > 0
        ? new Date(Number(inst.authorizedDate) * 1000).toLocaleDateString()
        : "N/A";

      console.log(`  ${i + 1}. ${inst.name}`);
      console.log(`     Address: ${addr}`);
      console.log(`     Reg #: ${inst.registrationNumber} | Country: ${inst.country}`);
      console.log(`     Active: ${inst.isActive} | Authorized: ${isAuth}`);
      console.log(`     Certs Issued: ${Number(inst.totalIssued)} | Authorized: ${dateStr}`);
      console.log("");
    }
  },

  async info() {
    const address = process.env.ADDRESS;
    if (!address) { console.error("❌ Missing ADDRESS"); process.exit(1); }

    const contract = await getContract();
    const inst = await contract.getInstitution(address);
    const isAuth = await contract.isAuthorizedInstitution(address);

    console.log(`\n🏛️  Institution Info for ${address}\n`);
    console.log(`   Name: ${inst.name || "(not registered)"}`);
    console.log(`   Registration: ${inst.registrationNumber}`);
    console.log(`   Country: ${inst.country}`);
    console.log(`   Active: ${inst.isActive}`);
    console.log(`   Authorized: ${isAuth}`);
    console.log(`   Total Issued: ${Number(inst.totalIssued)}`);
    console.log(`   Authorized Date: ${inst.authorizedDate > 0 ? new Date(Number(inst.authorizedDate) * 1000).toLocaleString() : "N/A"}`);
  },
};

async function getContract() {
  const [deployer] = await hre.ethers.getSigners();
  console.log(`Using deployer: ${deployer.address}`);

  // Get the deployed contract address from artifacts or env
  const contractAddress = process.env.CONTRACT_ADDRESS || "0x5FbDB2315678afecb367f032d93F642f64180aa3";

  const CertificateRegistry = await hre.ethers.getContractFactory("CertificateRegistry");
  return CertificateRegistry.attach(contractAddress);
}

async function main() {
  const operation = (process.env.OPERATION || "list").toLowerCase();

  console.log("=".repeat(60));
  console.log("🎓 EDULOCKA — Admin Operations");
  console.log("=".repeat(60));

  if (!OPERATIONS[operation]) {
    console.error(`❌ Unknown operation: ${operation}`);
    console.log(`   Available: ${Object.keys(OPERATIONS).join(", ")}`);
    process.exit(1);
  }

  await OPERATIONS[operation]();
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Operation failed:", error.message);
    process.exit(1);
  });
