# Project 3 – HashBandits DAO Governance System

## Overview

HashBandits' DAO Governance is a complete on-chain DAO governance system built on the Ethereum Virtual Machine (EVM). The project demonstrates decentralized governance using ERC-20 governance tokens, snapshot-based voting, timelock-controlled proposal execution, and role-based access control.

The system enables token holders to:

- Create governance proposals targeting arbitrary external contract calls
- Vote using balances frozen at proposal snapshot time
- Execute successful proposals after a mandatory timelock delay
- Cancel proposals before voting begins

The project also includes a minimal frontend integrated with MetaMask for wallet interaction and governance access.

---

# Team Members

- **Rudra** — 240041031
- **Tanish Yadav** — 240041036
- **Khush Kumar Singh** — 240041023
- **Aditya Rai** — 240041002
- **Sarath Chandra KVL** — 240001039
- **Rohan Chauhan** — 240001061

---

# Tech Stack

- Solidity `^0.8.19`
- Hardhat
- OpenZeppelin Contracts
- Next.js
- MetaMask

---

# Project Architecture

The system consists of:

## Smart Contracts

### `GovernanceToken.sol`

ERC-20 governance token with snapshot capability using `ERC20Snapshot`.

Features:
- Historical balance tracking
- Snapshot-based voting
- Role-controlled snapshot creation

---

### `DAO.sol`

Core governance contract responsible for:

- Proposal creation
- Snapshot handling
- Weighted voting
- Proposal execution
- Quorum validation
- Timelock enforcement
- Proposal cancellation

Security modules:
- `AccessControl`
- `ReentrancyGuard`

---

### `MockTarget.sol`

Auxiliary contract used for testing governance execution through contract-to-contract calls.

---

# Key Features

## Snapshot-Based Governance

Voting power is determined using balances at proposal creation time through token snapshots. This prevents vote manipulation through token transfers or flash-loan attacks.

---

## Timelock-Based Execution

Approved proposals can only execute after a mandatory delay period, providing stakeholders time to react before governance changes take effect.

---

## Role-Based Access Control

Administrative functions are protected using OpenZeppelin’s `AccessControl`.

Roles include:
- `ADMIN_ROLE`
- `SNAPSHOT_ROLE`

---

## Immutable Proposal Source Verification using IPFS

Each proposal optionally stores an IPFS CID referencing the source code associated with the proposal.

This provides:
- Decentralized source hosting
- Immutable source verification
- Transparency for voters
- Independent audit capability

---

# Setup Instructions

## Prerequisites

- Node.js (v16 or higher)
- npm (v8 or higher)
- MetaMask browser extension

---

# Installation

```bash
npm install
```

---

# Compilation

```bash
npx hardhat compile
```

---

# Testing

```bash
npx hardhat test
```

---

# Generate Gas Report

```bash
REPORT_GAS=true npx hardhat test
```

On Windows PowerShell:

```powershell
$env:REPORT_GAS="true"; npx hardhat test
```

---

# Generate Coverage Report

```bash
npx hardhat coverage
```

---

# Deploy Contracts

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

Optional: set initial governance token supply at deploy time (default: `1000`):

```bash
INITIAL_SUPPLY=5000 npx hardhat run scripts/deploy.js --network sepolia
```

or

```bash
npx hardhat run scripts/deploy.js --network sepolia --initial-supply 5000
```

Replace `sepolia` with your target network (e.g., `localhost`, `goerli`, `mainnet`).

---

# Governance Workflow

## 1. Proposal Creation

Token holders with sufficient voting power can create proposals specifying:
- Target contract address
- Encoded calldata
- Voting deadline
- Optional IPFS CID

A token snapshot is automatically created during proposal creation.

---

## 2. Voting

Users vote with weight proportional to their balance at the snapshot block.

Features:
- Prevents double voting
- Snapshot-based balance lookup
- Supports both `for` and `against` voting

---

## 3. Timelock Phase

Successful proposals enter a mandatory timelock period before execution.

---

## 4. Proposal Execution

After quorum and majority conditions are satisfied, proposals execute through low-level `.call()`.

Execution is protected using `nonReentrant`.

---

# Security Features

## Snapshot-Based Voting

Balances are frozen at proposal creation time to eliminate governance manipulation through temporary token transfers.

---

## Reentrancy Protection

`executeProposal()` uses OpenZeppelin’s `ReentrancyGuard`.

---

## Timelock Protection

Execution delay provides reaction time before governance changes take effect.

---

## Proposal Creation Threshold

A minimum token balance is required to reduce governance spam.

---

## Access Control

Administrative functions and snapshot creation are role-restricted using OpenZeppelin `AccessControl`.

---

## Input Validation

All major state-changing operations validate:
- Deadlines
- Proposal state
- Voting eligibility
- Quorum percentages
- Execution conditions

---
# Known Issues & Limitations

- **Voting Privacy:** Voter choices and weights are completely public on the blockchain. There is no privacy-preserving mechanism (like Zero-Knowledge Proofs) implemented, which is standard for basic DAOs but worth noting.
- **Cancellation Front-Running:** A malicious user could theoretically front-run a proposal cancellation by immediately casting a tiny vote, preventing the creator from calling `cancelProposal()` since it requires both vote tallies to be zero.
- **No Emergency Pause:** If a critical vulnerability is found, there is no emergency pause (circuit breaker) functionality to halt the DAO.

---
# Gas Optimization

The contracts underwent multiple optimization iterations and achieved approximately **48.1% total deployment gas reduction**.

## Optimization Techniques

### Custom Errors

Replaced string-based `require()` statements with custom Solidity errors.

Benefits:
- Reduced bytecode size
- Lower revert costs

---

### Struct Packing

Reorganized struct variables to improve storage slot utilization.

Benefits:
- Fewer `SLOAD`
- Fewer `SSTORE`
- Lower runtime gas

---

### Reduced Storage Access

Frequently accessed storage variables were cached in memory to reduce repeated reads.

---

### Solidity Optimizer

Enabled Solidity optimizer with:

```js
optimizer: {
  enabled: true,
  runs: 200
}
```

Benefits:
- Reduced redundant opcodes
- Improved control flow
- Smaller deployment size

---

# Deployment Gas Comparison

| Contract | Baseline Gas | Final Optimized Gas | Reduction |
|---|---|---|---|
| DAO | 2,948,544 | 1,459,393 | 50.5% |
| GovernanceToken | 2,401,122 | 1,287,192 | 46.4% |
| MockTarget | 119,705 | 91,649 | 23.4% |
| **Total** | **5,469,371** | **2,838,234** | **48.1%** |

---

# Runtime Gas Costs

| Method | Baseline Gas | Optimized Gas | Savings |
|---|---|---|---|
| `createProposal()` | 252,431 | 241,186 | -11,245 gas |
| `vote()` | 86,210 | 81,940 | -4,270 gas |
| `executeProposal()` | 88,938 | 87,366 | -1,572 gas |
| `setQuorumPercent()` | 28,963 | 28,963 | - |

---

# Files of Interest

## Smart Contracts

### `contracts/DAO.sol`

Core governance contract implementing the complete DAO workflow including proposal creation, voting, execution, cancellation, quorum validation, and timelock enforcement.  
The contract uses snapshot-based voting to preserve historical voting power and integrates OpenZeppelin’s `AccessControl` and `ReentrancyGuard` for administrative security and protection against reentrancy attacks.  
It stores proposals on-chain and executes approved governance actions through low-level external contract calls.

---

### `contracts/GovernanceToken.sol`

ERC-20 governance token contract built using OpenZeppelin’s `ERC20Snapshot` extension.  
The contract supports historical balance tracking through snapshots, allowing voting power to remain fixed throughout the proposal lifecycle even if token transfers occur later.  
Snapshot creation is restricted through a dedicated `SNAPSHOT_ROLE`, ensuring only the DAO contract can create governance snapshots.

---

### `contracts/MockTarget.sol`

Auxiliary testing contract used to validate DAO-controlled contract-to-contract interactions.  
It contains a minimal writable state variable and a `setValue()` function that can be triggered through successful governance proposals.  
The contract serves as a deterministic target during testing to verify that proposal execution correctly modifies external contract state.

---

## Testing & Infrastructure

### `test/dao.test.js`

Comprehensive Hardhat-based test suite covering all major governance workflows and security validations.  
The tests verify proposal creation, weighted voting, quorum enforcement, timelock restrictions, execution success, proposal cancellation, access control protections, and failure conditions such as double voting or unauthorized actions.  
The suite achieves 100% statement and function coverage across all smart contracts.

---

### `scripts/deploy.js`

Deployment script responsible for automated deployment and initialization of all governance contracts.  
The script deploys the governance token, DAO contract, and mock target contract, grants required snapshot permissions, stores deployed addresses, and optionally performs Etherscan verification on live networks.  
It also supports configurable governance token supply during deployment to adapt to different organization sizes and tokenomics requirements.

---

### `frontend/index.html`

Minimal frontend interface demonstrating browser-based interaction with the DAO system through MetaMask integration.  
The frontend supports wallet connection and governance token balance display while serving as a foundation for future proposal creation and voting interfaces.  
It provides a lightweight entry point for interacting with deployed smart contracts directly from the browser.

---

## Additional Project Components

### `hardhat.config.js`

Configuration file for the Hardhat development environment containing Solidity compiler settings, optimizer configuration, network definitions, gas reporting setup, and plugin integration.  
The optimizer is configured with `runs: 200` to improve deployment and runtime gas efficiency in the production-ready optimized version.  
The file also manages Sepolia deployment settings and testing infrastructure.

---

### `deployed-addresses.json`

Automatically generated file storing deployed contract addresses after successful deployment execution.  
It helps frontend applications and scripts dynamically reference deployed smart contracts without manually updating addresses after every redeployment.  
This simplifies testing and integration across local and testnet environments.


---

# Test Coverage

The test suite covers:

- Proposal creation
- Weighted voting
- Double-vote prevention
- Proposal execution
- Proposal cancellation
- Quorum validation
- Timelock enforcement
- Access control restrictions
- Contract-to-contract execution

Coverage results:

| File | Statements | Branches | Functions | Lines |
|---|---|---|---|---|
| DAO.sol | 100% | 71.74% | 100% | 100% |
| GovernanceToken.sol | 100% | 50.00% | 100% | 100% |
| MockTarget.sol | 100% | 100% | 100% | 100% |
| All Files | 100% | 70.83% | 100% | 100% |

---

# Frontend

The frontend demonstrates:
- MetaMask wallet connection
- Token balance display
- Browser-based DAO interaction

Frontend entry point:

```text
frontend/index.html
```

---

# Deployment Process

The deployment script performs:

1. Deploy `GovernanceToken`
2. Deploy `DAO`
3. Grant `SNAPSHOT_ROLE`
4. Deploy `MockTarget`
5. Store deployed addresses
6. Attempt Etherscan verification on live networks

Target testnet deployment:

```bash
npx hardhat run scripts/deploy.js --network sepolia
```

---

# Project Structure

```text
contracts/
├── DAO.sol
├── GovernanceToken.sol
└── MockTarget.sol

scripts/
└── deploy.js

test/
└── dao.test.js

frontend/
├── app/
├── public/
│   └── contracts/
├── README.md
├── jsconfig.json
├── next.config.mjs
├── package.json
└── package-lock.json
README.md
hardhat.config.js
package-lock.json
package.json
```



---

# References

- OpenZeppelin Contracts — https://docs.openzeppelin.com/contracts/
- Hardhat Documentation — https://hardhat.org/docs
- Solidity Language Reference — https://docs.soliditylang.org/
- ERC-20 Standard — https://eips.ethereum.org/EIPS/eip-20
- ERC20Snapshot Documentation — https://docs.openzeppelin.com/contracts/
