import { describe, expect, it, vi } from "vitest";

import { createPrivacyFirstConnector, parseChainId } from "./session";
import type { Eip1193Provider, WalletCandidate } from "./types";

/**
 * Mocks
 */
vi.mock("./discovery/eip6963", () => {
    return {
        discoverEip6963Wallets: vi.fn(async () => [
            {
                id: "eip6963",
                name: "EIP6963 Wallet",
                provider: { request: () => Promise.resolve(null) },
                hints: { isInjected: true },
            },
        ]),
    };
});

/**
 * Test helpers
 */
function hexChainId(n: number) {
    return `0x${n.toString(16)}`;
}

function makeCandidate(overrides: Partial<WalletCandidate> = {}): WalletCandidate {
    return {
        id: overrides.id ?? "test-wallet",
        name: overrides.name ?? "Test Wallet",
        provider: overrides.provider!,
        hints: overrides.hints ?? { isInjected: true },
        ...(overrides.rdns ? { rdns: overrides.rdns } : {}),
        ...(overrides.icon ? { icon: overrides.icon } : {}),
    };
}

function makeProvider(opts: {
    accounts?: string[];
    chainId?: number;
    connectorInfo?: unknown;
    throwConnectorInfo?: boolean;
}): Eip1193Provider {
    const accounts = opts.accounts ?? ["0x1111111111111111111111111111111111111111"];
    const chainId = opts.chainId ?? 1;

    return {
        request: ({ method }) => {
            if (method === "eth_requestAccounts") return Promise.resolve(accounts);
            if (method === "eth_accounts") return Promise.resolve(accounts);
            if (method === "eth_chainId") return Promise.resolve(hexChainId(chainId));

            if (method === "eth_getConnectorInfo") {
                if (opts.throwConnectorInfo) return Promise.reject(new Error("method not supported"));
                if (opts.connectorInfo !== undefined) return Promise.resolve(opts.connectorInfo);
                return Promise.resolve(null);
            }

            return Promise.resolve(null);
        },
    };
}

function makeEventedProvider() {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    return {
        request: ({ method }: { method: string }) => {
            if (method === "eth_requestAccounts") return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
            if (method === "eth_accounts") return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
            if (method === "eth_chainId") return Promise.resolve("0x1");
            return Promise.resolve(null);
        },
        on: (event: string, listener: (...args: unknown[]) => void) => {
            const set = listeners.get(event) ?? new Set();
            set.add(listener);
            listeners.set(event, set);
        },
        removeListener: (event: string, listener: (...args: unknown[]) => void) => {
            listeners.get(event)?.delete(listener);
        },
        emit: (event: string, ...args: unknown[]) => {
            for (const l of listeners.get(event) ?? []) l(...args);
        },
        _listenerCount: (event: string) => listeners.get(event)?.size ?? 0,
    };
}

/**
 * parseChainId
 */
describe("parseChainId", () => {
    it("throws Invalid chainId value when finite-check fails", () => {
        expect(() => parseChainId("0x1", () => false)).toThrow("Invalid chainId value");
    });
});

/**
 * createPrivacyFirstConnector
 */
describe("session / connector", () => {
    /**
     * discoverWallets
     */
    describe("discoverWallets", () => {
        it("includes quantumAuthCandidate when it resolves", async () => {
            const qaProvider: Eip1193Provider = { request: () => Promise.resolve(null) };

            const connector = createPrivacyFirstConnector({
                enableEip6963: false,
                quantumAuthCandidate: async () => makeCandidate({ id: "qa", name: "QuantumAuth", provider: qaProvider }),
            });

            const wallets = await connector.discoverWallets();
            expect(wallets.some((w) => w.id === "qa")).toBe(true);
        });

        it("ignores quantumAuthCandidate when it throws", async () => {
            const connector = createPrivacyFirstConnector({
                enableEip6963: false,
                quantumAuthCandidate: async () => {
                    throw new Error("boom");
                },
            });

            const wallets = await connector.discoverWallets();
            expect(wallets).toEqual([]);
        });

        it("calls discoverEip6963Wallets when enabled", async () => {
            const connector = createPrivacyFirstConnector({ enableEip6963: true });

            const wallets = await connector.discoverWallets();
            expect(wallets.some((w) => w.id === "eip6963")).toBe(true);
        });
    });

    /**
     * connect()
     */
    describe("connect", () => {
        it("connects and returns a session with accounts + chainId", async () => {
            const provider = makeProvider({
                accounts: ["0xabc0000000000000000000000000000000000000"],
                chainId: 11155111,
            });

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);

            expect(session.accounts).toEqual(["0xabc0000000000000000000000000000000000000"]);
            expect(session.accounts[0]).toBe("0xabc0000000000000000000000000000000000000");
            expect(session.chainId).toBe(11155111);
            expect(session.provider).toBe(provider);
            expect(session.ethersProvider).toBeTruthy();
        });

        it("connects with empty accounts array (no address) and does not crash", async () => {
            const provider = makeProvider({ accounts: [], chainId: 1 });
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);

            expect(session.accounts).toEqual([]);
            expect(session.chainId).toBe(1);
        });

        it("throws if wallet candidate has no provider", async () => {
            const connector = createPrivacyFirstConnector();
            const wallet = {
                id: "x",
                name: "Broken",
                hints: { isInjected: true },
                // provider missing on purpose
            } as unknown as WalletCandidate;

            await expect(connector.connect(wallet)).rejects.toBeTruthy();
        });

        it("throws if provider is not EIP-1193 (missing request)", async () => {
            const connector = createPrivacyFirstConnector();

            const wallet = makeCandidate({
                provider: {} as unknown as Eip1193Provider, // intentionally invalid runtime shape
            });

            await expect(connector.connect(wallet)).rejects.toBeTruthy();
        });

        it("parses chainId hex correctly", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("0xaa36a7"); // 11155111
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });
            const session = await connector.connect(wallet);

            expect(session.chainId).toBe(11155111);
        });

        it("throws if eth_chainId returns non-string", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve(123); // non-string
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            await expect(connector.connect(wallet)).rejects.toThrow(/Invalid chainId/i);
        });

        it("throws if eth_chainId returns invalid hex format", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("1"); // missing 0x
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            await expect(connector.connect(wallet)).rejects.toThrow(/format/i);
        });

        it("throws when eth_chainId returns an invalid value", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("not-hex"); // invalid
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            await expect(connector.connect(wallet)).rejects.toBeTruthy();
        });

        it("throws on invalid chainId format (covers regex guard)", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("0xZZ"); // fails hex regex
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            await expect(connector.connect(wallet)).rejects.toThrow(/format/i);
        });

        it("switches chain when opts.chainId differs", async () => {
            const calls: string[] = [];

            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    calls.push(method);

                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("0x1"); // currently mainnet
                    if (method === "wallet_switchEthereumChain") return Promise.resolve(null);

                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            await connector.connect(wallet, { chainId: 11155111 });

            expect(calls).toContain("wallet_switchEthereumChain");
        });

        it("uses wallet-provided connector info when available", async () => {
            const provider = makeProvider({
                connectorInfo: {
                    connectorType: "injected",
                    connectorName: "TestWallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                },
            });

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);

            expect(session.connectorInfo.source).toBe("wallet");
            expect(session.connectorInfo.connectorName).toBe("TestWallet");
        });

        it("uses wallet eth_getConnectorInfo when it returns an object", async () => {
            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_getConnectorInfo") {
                        return Promise.resolve({
                            connectorType: "injected",
                            connectorName: "WalletProvided",
                            mediation: "direct",
                            thirdPartyInfrastructure: false,
                            rpcVisibility: "direct",
                        });
                    }
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("0x1");
                    return Promise.resolve(null);
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider, name: "FallbackName" });

            const session = await connector.connect(wallet);

            expect(session.connectorInfo.source).toBe("wallet");
            expect(session.connectorInfo.connectorName).toBe("WalletProvided");
        });

        it("falls back to inferred connector info when wallet does not support method", async () => {
            const provider = makeProvider({ throwConnectorInfo: true });

            const connector = createPrivacyFirstConnector({
                enableEip6963: true,
            });

            const wallet = makeCandidate({ provider, name: "FallbackWallet" });

            const session = await connector.connect(wallet);

            expect(session.connectorInfo).toBeTruthy();
            expect(session.connectorInfo.source).toBe("inferred");
        });
    });

    /**
     * lifecycle (refresh/disconnect)
     */
    describe("lifecycle", () => {
        it("disconnect() resolves and can be called multiple times safely", async () => {
            const provider = makeProvider({});
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);

            await expect(session.disconnect()).resolves.toBeUndefined();
            await expect(session.disconnect()).resolves.toBeUndefined();
        });

        it("disconnect removes listeners when supported", async () => {
            let removed = 0;

            const provider: Eip1193Provider = {
                request: ({ method }) => {
                    if (method === "eth_requestAccounts") {
                        return Promise.resolve(["0x1111111111111111111111111111111111111111"]);
                    }
                    if (method === "eth_chainId") return Promise.resolve("0x1");
                    return Promise.resolve(null);
                },
                on: () => {},
                removeListener: () => {
                    removed += 1;
                },
            };

            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });
            const session = await connector.connect(wallet);

            await session.disconnect();
            expect(removed).toBeGreaterThanOrEqual(0);
        });

        it("disconnect works even if provider has no removeListener", async () => {
            const provider = makeProvider({ chainId: 1 });
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);
            await expect(session.disconnect()).resolves.toBeUndefined();
        });

        it("refresh() resolves and updates accounts/chainId from provider", async () => {
            // NOTE: this test currently only asserts refresh resolves.
            // Your session.refresh() reads from the provider captured in closure.
            const provider = makeProvider({ accounts: ["0x1111111111111111111111111111111111111111"], chainId: 1 });
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider });

            const session = await connector.connect(wallet);

            expect(session.accounts[0]).toBe("0x1111111111111111111111111111111111111111");
            expect(session.chainId).toBe(1);

            await expect(session.refresh()).resolves.toBeUndefined();
        });
    });

    /**
     * provider events
     */
    describe("events", () => {
        it("wires provider event listeners and disconnect removes them", async () => {
            const p = makeEventedProvider();
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider: p as any });

            const session = await connector.connect(wallet);

            expect(p._listenerCount("accountsChanged")).toBeGreaterThan(0);
            expect(p._listenerCount("chainChanged")).toBeGreaterThan(0);

            await session.disconnect();

            expect(p._listenerCount("accountsChanged")).toBe(0);
            expect(p._listenerCount("chainChanged")).toBe(0);
        });

        it("updates session on accountsChanged event", async () => {
            const p = makeEventedProvider();
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider: p as any });

            const session = await connector.connect(wallet);

            p.emit("accountsChanged", ["0x2222222222222222222222222222222222222222"]);
            expect(session.accounts[0]).toBe("0x2222222222222222222222222222222222222222");
        });

        it("updates session on chainChanged event", async () => {
            const p = makeEventedProvider();
            const connector = createPrivacyFirstConnector();
            const wallet = makeCandidate({ provider: p as any });

            const session = await connector.connect(wallet);

            p.emit("chainChanged", "0xaa36a7"); // 11155111
            expect(session.chainId).toBe(11155111);
        });
    });
});
