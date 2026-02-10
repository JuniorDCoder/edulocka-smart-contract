// ============================================================================
// EDULOCKA — Smart Contract Test Suite (v2 with Institution Authorization)
// ============================================================================

const { expect } = require("chai");
const hre = require("hardhat");

describe("CertificateRegistry", function () {
  let certificateRegistry;
  let owner;
  let institution1;
  let institution2;
  let unauthorized;
  let verifier;

  const sampleCert = {
    id: "CERT-2026-001",
    studentName: "Alice Johnson",
    studentId: "STU-12345",
    degree: "Bachelor of Science in Computer Science",
    institution: "MIT — Massachusetts Institute of Technology",
    issueDate: Math.floor(Date.now() / 1000),
    ipfsHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
  };

  const sampleInst = {
    name: "MIT — Massachusetts Institute of Technology",
    regNumber: "MIT-REG-001",
    country: "United States",
  };

  const sampleInst2 = {
    name: "Stanford University",
    regNumber: "STANFORD-REG-002",
    country: "United States",
  };

  beforeEach(async function () {
    [owner, institution1, institution2, unauthorized, verifier] =
      await hre.ethers.getSigners();

    const Factory = await hre.ethers.getContractFactory("CertificateRegistry");
    certificateRegistry = await Factory.deploy();
    await certificateRegistry.waitForDeployment();
  });

  // ── Deployment ──────────────────────────────────────────────────────────
  describe("Deployment", function () {
    it("should set deployer as owner", async function () {
      expect(await certificateRegistry.owner()).to.equal(owner.address);
    });
    it("should start with zero certificates", async function () {
      expect(await certificateRegistry.getTotalCertificates()).to.equal(0n);
    });
    it("should start with zero institutions", async function () {
      expect(await certificateRegistry.totalInstitutions()).to.equal(0n);
    });
    it("should start with unlimited daily limit", async function () {
      expect(await certificateRegistry.maxDailyCertificates()).to.equal(0n);
    });
  });

  // ── Institution Management ──────────────────────────────────────────────
  describe("Institution Management", function () {
    describe("Adding with metadata", function () {
      it("should add institution with metadata", async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
        expect(await certificateRegistry.isAuthorizedInstitution(institution1.address)).to.be.true;
        const inst = await certificateRegistry.getInstitution(institution1.address);
        expect(inst.name).to.equal(sampleInst.name);
        expect(inst.registrationNumber).to.equal(sampleInst.regNumber);
        expect(inst.country).to.equal(sampleInst.country);
        expect(inst.isActive).to.be.true;
        expect(inst.totalIssued).to.equal(0n);
      });

      it("should emit InstitutionAdded event with metadata", async function () {
        await expect(certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country))
          .to.emit(certificateRegistry, "InstitutionAdded")
          .withArgs(institution1.address, owner.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
      });

      it("should increment counter", async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
        await certificateRegistry.addInstitution(institution2.address, sampleInst2.name, sampleInst2.regNumber, sampleInst2.country);
        expect(await certificateRegistry.totalInstitutions()).to.equal(2n);
      });

      it("should track in enumerable list", async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
        expect(await certificateRegistry.getAllInstitutionCount()).to.equal(1n);
        expect(await certificateRegistry.getInstitutionAddressByIndex(0)).to.equal(institution1.address);
      });

      it("should reject zero address", async function () {
        await expect(certificateRegistry.addInstitution("0x0000000000000000000000000000000000000000", sampleInst.name, sampleInst.regNumber, sampleInst.country))
          .to.be.revertedWithCustomError(certificateRegistry, "ZeroAddressNotAllowed");
      });

      it("should reject duplicate", async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
        await expect(certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country))
          .to.be.revertedWithCustomError(certificateRegistry, "InstitutionAlreadyAuthorized");
      });

      it("should reject non-owner", async function () {
        await expect(certificateRegistry.connect(institution1).addInstitution(institution2.address, sampleInst.name, sampleInst.regNumber, sampleInst.country))
          .to.be.revertedWithCustomError(certificateRegistry, "OwnableUnauthorizedAccount");
      });

      it("should reject empty name", async function () {
        await expect(certificateRegistry.addInstitution(institution1.address, "", sampleInst.regNumber, sampleInst.country))
          .to.be.revertedWithCustomError(certificateRegistry, "EmptyStringNotAllowed");
      });
    });

    describe("Removing", function () {
      beforeEach(async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
      });
      it("should remove institution", async function () {
        await certificateRegistry.removeInstitution(institution1.address);
        expect(await certificateRegistry.isAuthorizedInstitution(institution1.address)).to.be.false;
      });
      it("should emit InstitutionRemoved", async function () {
        await expect(certificateRegistry.removeInstitution(institution1.address))
          .to.emit(certificateRegistry, "InstitutionRemoved").withArgs(institution1.address, owner.address);
      });
      it("should decrement counter", async function () {
        await certificateRegistry.removeInstitution(institution1.address);
        expect(await certificateRegistry.totalInstitutions()).to.equal(0n);
      });
    });

    describe("Suspend & Reactivate", function () {
      beforeEach(async function () {
        await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
      });
      it("should suspend institution", async function () {
        await certificateRegistry.suspendInstitution(institution1.address);
        expect(await certificateRegistry.isAuthorizedInstitution(institution1.address)).to.be.false;
        expect(await certificateRegistry.isAuthorized(institution1.address)).to.be.true; // still in mapping
      });
      it("should prevent suspended institution from issuing", async function () {
        await certificateRegistry.suspendInstitution(institution1.address);
        await expect(certificateRegistry.connect(institution1).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash))
          .to.be.revertedWithCustomError(certificateRegistry, "InstitutionNotActive");
      });
      it("should reactivate institution", async function () {
        await certificateRegistry.suspendInstitution(institution1.address);
        await certificateRegistry.reactivateInstitution(institution1.address);
        expect(await certificateRegistry.isAuthorizedInstitution(institution1.address)).to.be.true;
      });
    });
  });

  // ── Certificate Issuance ────────────────────────────────────────────────
  describe("Certificate Issuance", function () {
    beforeEach(async function () {
      await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
    });

    it("should allow authorized institution to issue", async function () {
      await certificateRegistry.connect(institution1).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash);
      const cert = await certificateRegistry.getCertificate(sampleCert.id);
      expect(cert.studentName).to.equal(sampleCert.studentName);
      expect(cert.issuer).to.equal(institution1.address);
    });

    it("should increment totalIssued for institution", async function () {
      await certificateRegistry.connect(institution1).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash);
      const inst = await certificateRegistry.getInstitution(institution1.address);
      expect(inst.totalIssued).to.equal(1n);
    });

    it("should REJECT unauthorized wallet", async function () {
      await expect(certificateRegistry.connect(unauthorized).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash))
        .to.be.revertedWithCustomError(certificateRegistry, "NotAuthorizedInstitution");
    });

    it("should reject removed institution", async function () {
      await certificateRegistry.removeInstitution(institution1.address);
      await expect(certificateRegistry.connect(institution1).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash))
        .to.be.revertedWithCustomError(certificateRegistry, "NotAuthorizedInstitution");
    });
  });

  // ── Rate Limiting ───────────────────────────────────────────────────────
  describe("Daily Rate Limiting", function () {
    beforeEach(async function () {
      await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
    });

    it("should enforce daily limit", async function () {
      await certificateRegistry.setMaxDailyCertificates(2);
      await certificateRegistry.connect(institution1).issueCertificate("CERT-L1", "A", "S1", "D1", "I1", sampleCert.issueDate, "Qm1");
      await certificateRegistry.connect(institution1).issueCertificate("CERT-L2", "B", "S2", "D2", "I2", sampleCert.issueDate, "Qm2");
      await expect(certificateRegistry.connect(institution1).issueCertificate("CERT-L3", "C", "S3", "D3", "I3", sampleCert.issueDate, "Qm3"))
        .to.be.revertedWithCustomError(certificateRegistry, "DailyCertificateLimitReached");
    });

    it("should allow unlimited when limit is 0", async function () {
      for (let i = 0; i < 5; i++) {
        await certificateRegistry.connect(institution1).issueCertificate(`CERT-U${i}`, `S${i}`, `ID${i}`, `D${i}`, `I${i}`, sampleCert.issueDate, `Qm${i}`);
      }
      expect(await certificateRegistry.getTotalCertificates()).to.equal(5n);
    });
  });

  // ── Verification & Revocation ───────────────────────────────────────────
  describe("Verification & Revocation", function () {
    beforeEach(async function () {
      await certificateRegistry.addInstitution(institution1.address, sampleInst.name, sampleInst.regNumber, sampleInst.country);
      await certificateRegistry.connect(institution1).issueCertificate(sampleCert.id, sampleCert.studentName, sampleCert.studentId, sampleCert.degree, sampleCert.institution, sampleCert.issueDate, sampleCert.ipfsHash);
    });

    it("should verify valid certificate", async function () {
      const r = await certificateRegistry.verifyCertificate(sampleCert.id);
      expect(r.isValid).to.be.true;
      expect(r.studentName).to.equal(sampleCert.studentName);
    });

    it("should allow issuer to revoke", async function () {
      await certificateRegistry.connect(institution1).revokeCertificate(sampleCert.id);
      const cert = await certificateRegistry.getCertificate(sampleCert.id);
      expect(cert.isValid).to.be.false;
    });

    it("should reject non-issuer revocation", async function () {
      await expect(certificateRegistry.connect(unauthorized).revokeCertificate(sampleCert.id))
        .to.be.revertedWithCustomError(certificateRegistry, "OnlyIssuerCanRevoke");
    });
  });
});
