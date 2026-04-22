# DAO Governance Project

This project implements a simple DAO governance system meeting the assessment rubric: ERC20 governance token with snapshots, a DAO contract with proposal creation / voting / execution / cancellation, AccessControl, ReentrancyGuard, tests, gas reporting, and a minimal frontend.

Quick commands

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npx hardhat test
```

Gas report (enable by setting env var `REPORT_GAS=true`):

```bash
REPORT_GAS=true npx hardhat test
```

Coverage:

```bash
npx hardhat coverage
```

Files of interest

- `contracts/GovernanceToken.sol` — ERC20 snapshot token with AccessControl.
- `contracts/DAO.sol` — DAO contract: createProposal, vote, executeProposal, cancelProposal.
- `test/dao.test.js` — Tests covering happy paths and failures.
- `frontend/index.html` — Minimal MetaMask frontend (fill addresses).

NatSpec

Public functions include NatSpec-style comments where relevant.

Next steps for you

- Run `npm install` and then `npx hardhat test` to verify everything on your machine.
- Make repository public and ensure tests/coverage/gas reports are produced before submission.
