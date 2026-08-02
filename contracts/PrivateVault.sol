// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC7984} from "@iexec-nox/nox-confidential-contracts/contracts/token/ERC7984.sol";
import {Nox, euint256, externalEuint256} from "@iexec-nox/nox-protocol-contracts/contracts/sdk/Nox.sol";
import {HandleUtils} from "@iexec-nox/nox-protocol-contracts/contracts/utils/HandleUtils.sol";
import {TEEType} from "@iexec-nox/nox-protocol-contracts/contracts/utils/TypeUtils.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {IERC20Metadata} from "@openzeppelin/contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract PrivateVault is ERC7984 {
    struct WithdrawalRequest {
        euint256 amount;
        address owner;
        uint256 deadline;
        bool finalized;
    }

    uint256 internal constant WITHDRAWAL_DEADLINE = 3 days;
    uint256 internal constant YIELD_INJECTION_TIMELOCK = 24 hours;
    uint256 private constant _REENTRANCY_NOT_ENTERED = 1;
    uint256 private constant _REENTRANCY_ENTERED = 2;

    address public immutable owner;
    IERC20Metadata public immutable asset;
    uint8 public immutable assetDecimals;
    uint256 public immutable MIN_DEPOSIT;
    uint256 public immutable MAX_YIELD_INJECTION;

    euint256 private _confidentialTotalDeposited = euint256.wrap(HandleUtils.zeroHandle(TEEType.Uint256));

    uint256 private _reentrancyStatus = _REENTRANCY_NOT_ENTERED;
    uint256 public withdrawalCount;
    bool public yieldInjectionActive;
    uint256 public lastYieldInjection;

    mapping(uint256 => WithdrawalRequest) public withdrawalRequests;

    event Deposit(address indexed account, uint256 amount);
    event WithdrawalRequested(uint256 indexed requestId, address indexed account);
    event WithdrawalFinalized(uint256 indexed requestId, address indexed account, uint256 amount);
    event WithdrawalExpired(uint256 indexed requestId, address indexed account);
    event YieldInjected(uint256 amount);

    error OnlyOwner();
    error ETHNotAccepted();
    error DepositTooSmall();
    error InvalidAmount();
    error AlreadyFinalized();
    error NotWithdrawalOwner();
    error WithdrawalDeadlinePassed();
    error WithdrawalNotExpired();
    error DecryptedAmountMismatch();
    error YieldInjectionTooLarge();
    error YieldInjectionTimelocked();
    error TransferFailed();
    error ReentrantCall();

    modifier onlyOwner() {
        if (msg.sender != owner) revert OnlyOwner();
        _;
    }

    modifier nonReentrant() {
        if (_reentrancyStatus != _REENTRANCY_NOT_ENTERED) revert ReentrantCall();
        _reentrancyStatus = _REENTRANCY_ENTERED;
        _;
        _reentrancyStatus = _REENTRANCY_NOT_ENTERED;
    }

    constructor(
        string memory name_,
        string memory symbol_,
        string memory contractURI_,
        IERC20Metadata asset_
    ) ERC7984(name_, symbol_, contractURI_) {
        owner = msg.sender;
        asset = asset_;
        assetDecimals = asset_.decimals();
        MIN_DEPOSIT = 1;
        MAX_YIELD_INJECTION = 1000 * 10 ** assetDecimals;
    }

    receive() external payable {
        revert ETHNotAccepted();
    }

    function confidentialTotalDeposited() external view returns (euint256) {
        return _confidentialTotalDeposited;
    }

    function deposit(
        uint256 amount,
        externalEuint256 encryptedAmount,
        bytes calldata handleProof
    ) external nonReentrant {
        if (amount < MIN_DEPOSIT) revert DepositTooSmall();
        Nox.fromExternal(encryptedAmount, handleProof);

        euint256 amountEnc = Nox.toEuint256(amount);
        Nox.allowThis(amountEnc);

        bool ok = IERC20(asset).transferFrom(msg.sender, address(this), amount);
        if (!ok) revert TransferFailed();

        _mint(msg.sender, amountEnc);

        _confidentialTotalDeposited = Nox.add(_confidentialTotalDeposited, amountEnc);
        _ensurePubliclyDecryptable(_confidentialTotalDeposited);

        emit Deposit(msg.sender, amount);
    }

    function requestWithdraw(
        externalEuint256 encryptedAmount,
        bytes calldata handleProof
    ) external nonReentrant returns (uint256 requestId) {
        euint256 amount = Nox.fromExternal(encryptedAmount, handleProof);
        if (!Nox.isInitialized(amount)) revert InvalidAmount();
        Nox.allowThis(amount);

        _burn(msg.sender, amount);

        Nox.allowPublicDecryption(amount);

        withdrawalCount += 1;
        requestId = withdrawalCount;
        withdrawalRequests[requestId] = WithdrawalRequest({
            amount: amount,
            owner: msg.sender,
            deadline: block.timestamp + WITHDRAWAL_DEADLINE,
            finalized: false
        });

        emit WithdrawalRequested(requestId, msg.sender);
    }

    function finalizeWithdraw(
        uint256 requestId,
        uint256 decryptedAmount,
        bytes calldata decryptionProof
    ) external nonReentrant {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        if (req.finalized) revert AlreadyFinalized();
        if (msg.sender != req.owner) revert NotWithdrawalOwner();
        if (block.timestamp > req.deadline) revert WithdrawalDeadlinePassed();

        uint256 decrypted = Nox.publicDecrypt(req.amount, decryptionProof);
        if (decrypted != decryptedAmount) revert DecryptedAmountMismatch();

        req.finalized = true;

        bool ok = IERC20(asset).transfer(req.owner, decryptedAmount);
        if (!ok) revert TransferFailed();

        _confidentialTotalDeposited = Nox.sub(_confidentialTotalDeposited, Nox.toEuint256(decryptedAmount));
        _ensurePubliclyDecryptable(_confidentialTotalDeposited);

        emit WithdrawalFinalized(requestId, req.owner, decryptedAmount);
    }

    function expireWithdrawal(uint256 requestId) external nonReentrant onlyOwner {
        WithdrawalRequest storage req = withdrawalRequests[requestId];
        if (req.finalized) revert AlreadyFinalized();
        if (block.timestamp < req.deadline) revert WithdrawalNotExpired();

        req.finalized = true;
        Nox.allowThis(req.amount);
        _mint(req.owner, req.amount);

        emit WithdrawalExpired(requestId, req.owner);
    }

    function injectYield(
        uint256 amount,
        externalEuint256 encryptedAmount,
        bytes calldata handleProof
    ) external nonReentrant onlyOwner {
        if (amount > MAX_YIELD_INJECTION) revert YieldInjectionTooLarge();
        Nox.fromExternal(encryptedAmount, handleProof);
        if (yieldInjectionActive) {
            if (block.timestamp < lastYieldInjection + YIELD_INJECTION_TIMELOCK) revert YieldInjectionTimelocked();
        }

        euint256 amountEnc = Nox.toEuint256(amount);
        Nox.allowThis(amountEnc);

        _mint(address(this), amountEnc);

        yieldInjectionActive = true;
        lastYieldInjection = block.timestamp;

        euint256 vaultBalance = confidentialBalanceOf(address(this));
        _ensurePubliclyDecryptable(vaultBalance);

        emit YieldInjected(amount);
    }

    function _ensurePubliclyDecryptable(euint256 value) internal {
        Nox.allowThis(value);
        if (!Nox.isPubliclyDecryptable(value)) {
            Nox.allowPublicDecryption(value);
        }
    }
}
