# Privacy Connector

[![CI](https://github.com/quantumauth-io/privacy-connector/actions/workflows/ci.yml/badge.svg)](
https://github.com/quantumauth-io/privacy-connector/actions/workflows/ci.yml
)
[![codecov](https://codecov.io/gh/quantumauth-io/privacy-connector/branch/main/graph/badge.svg)](
https://codecov.io/gh/quantumauth-io/privacy-connector
)
[![npm version](https://img.shields.io/npm/v/@quantumauth/privacy-connector.svg)](https://www.npmjs.com/package/@quantumauth/privacy-connector)
[![license](https://img.shields.io/npm/l/@quantumauth/privacy-connector.svg)](LICENSE)

A privacy-first Web3 wallet connector that avoids third-party tracking and exposes connection transparency.

This library is intentionally minimal:
- ✅ **ethers.js only** (no wagmi / viem)
- ✅ **local-only wallet discovery** (EIP-6963)
- ✅ **no wallet registries, no analytics, no “recommended wallets” APIs**
- ✅ exposes / consumes a **Connector Transparency** method (`eth_getConnectorInfo`)

## Why

Most modern wallet “connectors” are bundled with extra infrastructure (registries, relays, telemetry, metadata services).
That makes it hard for users to understand **who mediates the connection** and where **metadata may flow**.

`privacy-connector` focuses on:
- transparency (what connector is used)
- minimal moving parts (easy to audit)
- no hidden network dependencies

## Network policy (privacy guarantee)

This package **MUST NOT** make outbound network requests to any third-party services.

The only network traffic produced by apps using this library should be:
- JSON-RPC calls made by the selected wallet/provider itself, and/or
- calls to the RPC endpoints you explicitly configure in your app

This library does **not**:
- fetch wallet lists
- fetch icons from remote URLs
- call WalletConnect relays
- embed analytics SDKs

## Installation

```bash
pnpm add @quantumauth-io/privacy-connector ethers
```

## Usage

### Discover wallets (local-only)

> Recommended: call discovery from a user gesture (e.g. “Connect” button) to reduce fingerprinting risk.

```ts
import { createPrivacyFirstConnector } from "@quantumauth-io/privacy-connector";

const connector = createPrivacyFirstConnector();

const wallets = await connector.discoverWallets();
// wallets: WalletCandidate[] with local EIP-6963 providers
```

### Connect

```ts
const session = await connector.connect(wallets[0], { chainId: 1 });

console.log(session.accounts);
console.log(session.chainId);

// ethers v6
const signer = await session.ethersProvider.getSigner();
const address = await signer.getAddress();
```

## Connector Transparency (draft EIP)

Wallets/providers MAY implement:

- `eth_getConnectorInfo`

If implemented, this library returns `connectorInfo.source === "wallet"`.
If not, this library returns a best-effort inferred object with `source === "inferred"`.

Example:

```ts
const info = await connector.getConnectorInfo(session.provider);

console.log(info);
/*
{
  connectorType: "injected",
  connectorName: "MetaMask",
  mediation: "direct",
  thirdPartyInfrastructure: false,
  rpcVisibility: "direct",
  source: "wallet" | "inferred"
}
*/
```

### What apps should do with this

- Display connection details in the UI
- Prefer “direct / no third-party infra” connectors if the user wants privacy
- Avoid auto-connecting or auto-discovering wallets on page load

## Supported connectors (v1)

- Injected wallets discovered via **EIP-6963**
- (Optional) QuantumAuth provider via a custom candidate factory

Not included in v1:
- WalletConnect relay-based connectors (to keep the network surface minimal)

## Development

```bash
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

## License

Apache-2.0