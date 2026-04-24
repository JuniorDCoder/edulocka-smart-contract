// SPDX-License-Identifier: MIT
// ============================================================================
// EDULOCKA — CertificateRegistry Smart Contract (v2 with Institution Authorization)
// ============================================================================
//
// SECURITY MODEL:
//   ✅ Only contract owner (Edulocka admin) can authorize/deauthorize institutions
//   ✅ Only authorized & active institutions can issue certificates
//   ✅ Institution metadata (name, reg number, country) stored on-chain
//   ✅ Per-institution certificate count tracking
//   ✅ Daily rate limiting per institution (configurable by owner)
//   ✅ Full audit trail via events for every admin action
//   ✅ Reentrancy protection on all state-changing functions
//   ✅ Operator delegation: institutions can authorize a backend signer to issue
//      certificates on their behalf without exposing the institution private key
//
// ============================================================================

pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract CertificateRegistry is Ownable, ReentrancyGuard {
    // ========================================================================
    // DATA STRUCTURES
    // ========================================================================

    /// @notice Holds all on-chain data for an academic certificate
    struct Certificate {
        string studentName;
        string studentId;
        string degree;
        string institution;
        uint256 issueDate;
        string ipfsHash;
        address issuer;
        bool isValid;
        bool exists;
    }

    /// @notice Holds verified institution metadata stored on-chain
    /// @dev Only the contract owner (Edulocka admin) can create/modify institution records
    struct Institution {
        string name; // Official institution name
        string registrationNumber; // Government registration / accreditation number
        string country; // Country of registration (ISO code or full name)
        bool isActive; // Whether the institution can currently issue certs
        uint256 authorizedDate; // Timestamp when institution was authorized
        uint256 totalIssued; // How many certificates this institution has issued
        uint256 dailyIssued; // Certificates issued today (for rate limiting)
        uint256 lastIssuedDate; // Day timestamp of last issuance (for daily reset)
    }

    enum CertificateStatus {
        Valid,
        Revoked,
        Expired
    }

    // ========================================================================
    // STATE VARIABLES
    // ========================================================================

    // ── Certificate storage ─────────────────────────────────────────────────
    mapping(string => Certificate) private certificates;
    string[] public allCertificateIds;
    uint256 public totalCertificates;
    uint256 public totalRevocations;

    // ── Institution authorization (enhanced) ────────────────────────────────
    /// @notice Quick boolean check for authorization status
    mapping(address => bool) public isAuthorized;

    /// @notice Full institution details by wallet address
    mapping(address => Institution) public authorizedInstitutions;

    /// @notice List of all institution addresses ever authorized (for enumeration)
    address[] public allInstitutionAddresses;

    /// @notice Track whether an address has ever been in allInstitutionAddresses
    mapping(address => bool) private institutionIndexed;

    /// @notice Total currently-active authorized institutions
    uint256 public totalInstitutions;

    /// @notice Maximum certificates an institution can issue per day (0 = unlimited)
    uint256 public maxDailyCertificates;

    // ── Operator delegation ─────────────────────────────────────────────────
    /// @notice Maps an operator address to the institution address it acts on behalf of.
    ///         operator => institution
    ///         This lets a backend signer key issue certificates without holding the
    ///         institution's private key.
    mapping(address => address) public operatorOf;

    /// @notice Maps an institution address to its currently registered operator.
    ///         institution => operator
    ///         Stored so institutions can look up / clear their own operator.
    mapping(address => address) public institutionOperator;

    // ========================================================================
    // EVENTS
    // ========================================================================

    event CertificateIssued(
        string indexed certificateId,
        string studentName,
        string institution,
        address indexed issuer,
        uint256 timestamp
    );

    event CertificateRevoked(
        string indexed certificateId,
        address indexed revokedBy,
        uint256 timestamp
    );

    event CertificateVerified(
        string indexed certificateId,
        address verifier,
        bool isValid
    );

    /// @notice Emitted when an institution is authorized with full metadata
    event InstitutionAdded(
        address indexed institution,
        address indexed authorizedBy,
        string name,
        string registrationNumber,
        string country
    );

    /// @notice Emitted when an institution's authorization is removed
    event InstitutionRemoved(
        address indexed institution,
        address indexed removedBy
    );

    /// @notice Emitted when an institution is suspended (isActive = false)
    event InstitutionSuspended(
        address indexed institution,
        address indexed suspendedBy
    );

    /// @notice Emitted when a suspended institution is reactivated
    event InstitutionReactivated(
        address indexed institution,
        address indexed reactivatedBy
    );

    /// @notice Emitted when the daily certificate limit is changed
    event DailyLimitUpdated(
        uint256 oldLimit,
        uint256 newLimit,
        address indexed updatedBy
    );

    /// @notice Emitted when an institution registers an operator
    event OperatorSet(address indexed institution, address indexed operator);

    /// @notice Emitted when an institution removes its operator
    event OperatorRemoved(
        address indexed institution,
        address indexed operator
    );

    // ========================================================================
    // CUSTOM ERRORS
    // ========================================================================

    error NotAuthorizedInstitution(address caller);
    error InstitutionNotActive(address caller);
    error DailyCertificateLimitReached(address institution, uint256 limit);
    error CertificateAlreadyExists(string certificateId);
    error CertificateNotFound(string certificateId);
    error CertificateAlreadyRevoked(string certificateId);
    error EmptyStringNotAllowed(string parameterName);
    error ZeroAddressNotAllowed();
    error InstitutionAlreadyAuthorized(address institution);
    error InstitutionNotAuthorized(address institution);
    error OnlyIssuerCanRevoke(address caller, address issuer);
    error OperatorAlreadySet(address institution, address operator);
    error NotAnOperator(address caller);

    // ========================================================================
    // MODIFIERS
    // ========================================================================

    /// @notice Resolves the effective institution for msg.sender.
    ///         - If msg.sender is itself an authorized institution → use it directly.
    ///         - If msg.sender is a registered operator → use the institution it represents.
    ///         Reverts if neither condition is true.
    modifier onlyAuthorizedInstitution() {
        address resolved = _resolveInstitution(msg.sender);
        if (!isAuthorized[resolved]) {
            revert NotAuthorizedInstitution(msg.sender);
        }
        if (!authorizedInstitutions[resolved].isActive) {
            revert InstitutionNotActive(msg.sender);
        }
        _;
    }

    modifier certificateExists(string memory _certificateId) {
        if (!certificates[_certificateId].exists) {
            revert CertificateNotFound(_certificateId);
        }
        _;
    }

    modifier notEmpty(string memory _value, string memory _paramName) {
        if (bytes(_value).length == 0) {
            revert EmptyStringNotAllowed(_paramName);
        }
        _;
    }

    // ========================================================================
    // CONSTRUCTOR
    // ========================================================================

    constructor() Ownable(msg.sender) {
        // Default: no daily limit (0 = unlimited)
        maxDailyCertificates = 0;
    }

    // ========================================================================
    // OPERATOR DELEGATION
    // ========================================================================

    /// @notice Register a backend operator address that can issue certificates
    ///         on behalf of the calling institution.
    ///         Each institution can have at most ONE operator at a time.
    ///         Call setOperator(address(0)) or clearOperator() to remove it.
    /// @dev Can also be called by the contract owner on behalf of any institution
    ///      (useful for initial setup without requiring the institution to call).
    /// @param _institution The authorized institution address
    /// @param _operator    The backend signer address to delegate to
    function setOperator(address _institution, address _operator) external {
        // Only the institution itself OR the contract owner can set the operator
        require(
            msg.sender == _institution || msg.sender == owner(),
            "Only institution or owner can set operator"
        );
        if (!isAuthorized[_institution]) {
            revert InstitutionNotAuthorized(_institution);
        }
        if (_operator == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (_operator == _institution) {
            revert EmptyStringNotAllowed("operator cannot equal institution");
        }

        // Clear any previous operator for this institution
        address oldOperator = institutionOperator[_institution];
        if (oldOperator != address(0)) {
            delete operatorOf[oldOperator];
            emit OperatorRemoved(_institution, oldOperator);
        }

        institutionOperator[_institution] = _operator;
        operatorOf[_operator] = _institution;

        emit OperatorSet(_institution, _operator);
    }

    /// @notice Remove the operator for the calling institution (or any institution
    ///         if called by the contract owner).
    function clearOperator(address _institution) external {
        require(
            msg.sender == _institution || msg.sender == owner(),
            "Only institution or owner can clear operator"
        );

        address oldOperator = institutionOperator[_institution];
        if (oldOperator == address(0)) return; // Nothing to clear

        delete operatorOf[oldOperator];
        delete institutionOperator[_institution];

        emit OperatorRemoved(_institution, oldOperator);
    }

    /// @notice Returns the effective institution address for a given caller.
    ///         Returns the caller itself if it is an institution,
    ///         or the institution it is an operator for.
    function _resolveInstitution(
        address caller
    ) internal view returns (address) {
        if (isAuthorized[caller]) {
            return caller; // Caller IS the institution
        }
        address institution = operatorOf[caller];
        if (institution != address(0)) {
            return institution; // Caller is an operator for this institution
        }
        return caller; // Neither — will fail authorization check
    }

    /// @notice Public view of _resolveInstitution for off-chain use
    function resolveInstitution(
        address caller
    ) external view returns (address) {
        return _resolveInstitution(caller);
    }

    // ========================================================================
    // INSTITUTION MANAGEMENT (Enhanced with metadata)
    // ========================================================================

    /// @notice Authorize an institution with full metadata stored on-chain
    /// @dev Only the contract owner (Edulocka admin) can call this
    /// @param _institution Wallet address to authorize
    /// @param _name Official institution name
    /// @param _registrationNumber Government registration / accreditation number
    /// @param _country Country of registration
    function addInstitution(
        address _institution,
        string calldata _name,
        string calldata _registrationNumber,
        string calldata _country
    ) external onlyOwner {
        if (_institution == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (isAuthorized[_institution]) {
            revert InstitutionAlreadyAuthorized(_institution);
        }
        if (bytes(_name).length == 0) {
            revert EmptyStringNotAllowed("name");
        }
        if (bytes(_registrationNumber).length == 0) {
            revert EmptyStringNotAllowed("registrationNumber");
        }
        if (bytes(_country).length == 0) {
            revert EmptyStringNotAllowed("country");
        }

        // Store institution metadata
        authorizedInstitutions[_institution] = Institution({
            name: _name,
            registrationNumber: _registrationNumber,
            country: _country,
            isActive: true,
            authorizedDate: block.timestamp,
            totalIssued: 0,
            dailyIssued: 0,
            lastIssuedDate: 0
        });

        isAuthorized[_institution] = true;
        totalInstitutions++;

        // Track in enumerable list (only add once)
        if (!institutionIndexed[_institution]) {
            allInstitutionAddresses.push(_institution);
            institutionIndexed[_institution] = true;
        }

        emit InstitutionAdded(
            _institution,
            msg.sender,
            _name,
            _registrationNumber,
            _country
        );
    }

    /// @notice Remove an institution's authorization permanently
    /// @dev Existing certificates remain valid; institution can't issue new ones
    function removeInstitution(address _institution) external onlyOwner {
        if (_institution == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (!isAuthorized[_institution]) {
            revert InstitutionNotAuthorized(_institution);
        }

        isAuthorized[_institution] = false;
        authorizedInstitutions[_institution].isActive = false;
        totalInstitutions--;

        // Also clear any registered operator for this institution
        address operator = institutionOperator[_institution];
        if (operator != address(0)) {
            delete operatorOf[operator];
            delete institutionOperator[_institution];
            emit OperatorRemoved(_institution, operator);
        }

        emit InstitutionRemoved(_institution, msg.sender);
    }

    /// @notice Temporarily suspend an institution (can be reactivated)
    function suspendInstitution(address _institution) external onlyOwner {
        if (!isAuthorized[_institution]) {
            revert InstitutionNotAuthorized(_institution);
        }
        authorizedInstitutions[_institution].isActive = false;

        emit InstitutionSuspended(_institution, msg.sender);
    }

    /// @notice Reactivate a suspended institution
    function reactivateInstitution(address _institution) external onlyOwner {
        if (!isAuthorized[_institution]) {
            revert InstitutionNotAuthorized(_institution);
        }
        authorizedInstitutions[_institution].isActive = true;

        emit InstitutionReactivated(_institution, msg.sender);
    }

    /// @notice Check if an address is an authorized institution
    function isAuthorizedInstitution(
        address _institution
    ) external view returns (bool) {
        return
            isAuthorized[_institution] &&
            authorizedInstitutions[_institution].isActive;
    }

    /// @notice Get full institution details for a given address
    function getInstitution(
        address _institution
    ) external view returns (Institution memory) {
        return authorizedInstitutions[_institution];
    }

    /// @notice Get total number of institution addresses ever registered
    function getAllInstitutionCount() external view returns (uint256) {
        return allInstitutionAddresses.length;
    }

    /// @notice Get institution address by index (for enumeration)
    function getInstitutionAddressByIndex(
        uint256 _index
    ) external view returns (address) {
        require(_index < allInstitutionAddresses.length, "Index out of bounds");
        return allInstitutionAddresses[_index];
    }

    /// @notice Update the daily certificate limit (0 = unlimited)
    function setMaxDailyCertificates(uint256 _limit) external onlyOwner {
        uint256 oldLimit = maxDailyCertificates;
        maxDailyCertificates = _limit;
        emit DailyLimitUpdated(oldLimit, _limit, msg.sender);
    }

    // ========================================================================
    // CERTIFICATE ISSUANCE
    // ========================================================================

    /// @notice Issue a new academic certificate on the blockchain.
    ///         Can be called by an authorized institution OR its registered operator.
    /// @dev The certificate's `issuer` field always records the INSTITUTION address,
    ///      not the operator, so on-chain provenance is always tied to the institution.
    function issueCertificate(
        string memory _certificateId,
        string memory _studentName,
        string memory _studentId,
        string memory _degree,
        string memory _institution,
        uint256 _issueDate,
        string memory _ipfsHash
    ) external notEmpty(_certificateId, "certificateId") nonReentrant {
        // Resolve the institution (caller may be the institution itself or an operator)
        address institutionAddr = _resolveInstitution(msg.sender);

        if (!isAuthorized[institutionAddr]) {
            revert NotAuthorizedInstitution(msg.sender);
        }
        if (!authorizedInstitutions[institutionAddr].isActive) {
            revert InstitutionNotActive(msg.sender);
        }

        if (certificates[_certificateId].exists) {
            revert CertificateAlreadyExists(_certificateId);
        }

        if (bytes(_studentName).length == 0)
            revert EmptyStringNotAllowed("studentName");
        if (bytes(_studentId).length == 0)
            revert EmptyStringNotAllowed("studentId");
        if (bytes(_degree).length == 0) revert EmptyStringNotAllowed("degree");
        if (bytes(_institution).length == 0)
            revert EmptyStringNotAllowed("institution");
        // Note: ipfsHash can be empty initially — it's populated after IPFS upload succeeds

        // ── RATE LIMITING: Check daily certificate limit ───────────────────
        Institution storage inst = authorizedInstitutions[institutionAddr];
        if (maxDailyCertificates > 0) {
            uint256 today = block.timestamp / 1 days;
            if (inst.lastIssuedDate < today) {
                // New day — reset counter
                inst.dailyIssued = 0;
                inst.lastIssuedDate = today;
            }
            if (inst.dailyIssued >= maxDailyCertificates) {
                revert DailyCertificateLimitReached(
                    institutionAddr,
                    maxDailyCertificates
                );
            }
            inst.dailyIssued++;
        }

        // ── CREATE: Build the Certificate struct ───────────────────────────
        // issuer is always the INSTITUTION address, even if an operator submitted the tx
        certificates[_certificateId] = Certificate({
            studentName: _studentName,
            studentId: _studentId,
            degree: _degree,
            institution: _institution,
            issueDate: _issueDate,
            ipfsHash: _ipfsHash,
            issuer: institutionAddr,
            isValid: true,
            exists: true
        });

        allCertificateIds.push(_certificateId);
        totalCertificates++;

        // Track per-institution issuance count
        inst.totalIssued++;

        emit CertificateIssued(
            _certificateId,
            _studentName,
            _institution,
            institutionAddr,
            block.timestamp
        );
    }

    // ========================================================================
    // CERTIFICATE VERIFICATION
    // ========================================================================

    function verifyCertificate(
        string memory _certificateId
    )
        external
        view
        certificateExists(_certificateId)
        returns (
            bool isValid,
            string memory studentName,
            string memory degree,
            string memory institution,
            uint256 issueDate,
            address issuer
        )
    {
        Certificate storage cert = certificates[_certificateId];
        return (
            cert.isValid,
            cert.studentName,
            cert.degree,
            cert.institution,
            cert.issueDate,
            cert.issuer
        );
    }

    function getCertificate(
        string memory _certificateId
    )
        external
        view
        certificateExists(_certificateId)
        returns (Certificate memory)
    {
        return certificates[_certificateId];
    }

    function certificateExistsCheck(
        string memory _certificateId
    ) external view returns (bool) {
        return certificates[_certificateId].exists;
    }

    // ========================================================================
    // CERTIFICATE REVOCATION
    // ========================================================================

    /// @notice Revoke a certificate. Only the issuing institution (or its operator) can revoke.
    function revokeCertificate(
        string memory _certificateId
    ) external certificateExists(_certificateId) nonReentrant {
        Certificate storage cert = certificates[_certificateId];
        address callerInstitution = _resolveInstitution(msg.sender);

        if (cert.issuer != callerInstitution) {
            revert OnlyIssuerCanRevoke(msg.sender, cert.issuer);
        }
        if (!cert.isValid) {
            revert CertificateAlreadyRevoked(_certificateId);
        }

        cert.isValid = false;
        totalRevocations++;

        emit CertificateRevoked(_certificateId, msg.sender, block.timestamp);
    }

    // ========================================================================
    // UTILITY / HELPER FUNCTIONS
    // ========================================================================

    function getTotalCertificates() external view returns (uint256) {
        return totalCertificates;
    }

    function getCertificateIdByIndex(
        uint256 _index
    ) external view returns (string memory) {
        require(_index < allCertificateIds.length, "Index out of bounds");
        return allCertificateIds[_index];
    }

    function getAllCertificateIdsCount() external view returns (uint256) {
        return allCertificateIds.length;
    }
}
