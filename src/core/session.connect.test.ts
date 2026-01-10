import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPrivacyFirstConnector } from "./session";
import type { Eip1193Provider, WalletCandidate } from "./types";

function makeProvider() {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    const provider: Eip1193Provider = {
        request: vi.fn(async ({ method }) => {
            // defaults (override in tests by mockImplementationOnce)
            if (method === "eth_requestAccounts") return ["0xabc"];
            if (method === "eth_chainId") return "0x1";
            if (method === "eth_accounts") return ["0xdef"];
            if (method === "wallet_revokePermissions") return null;
            if (method === "eth_getConnectorInfo")
                return {
                    connectorType: "injected",
                    connectorName: "Wallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                };
            return null;
        }),

        on: vi.fn((event, listener) => {
            const set = listeners.get(event) ?? new Set();
            set.add(listener);
            listeners.set(event, set);
        }),

        removeListener: vi.fn((event, listener) => {
            listeners.get(event)?.delete(listener);
        }),
    };

    function emit(event: string, payload: unknown) {
        for (const fn of listeners.get(event) ?? []) fn(payload);
    }

    return { provider, emit };
}

describe("session.connect", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("switches chain when opts.chainId differs", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider } = makeProvider();
        const candidate: WalletCandidate = {
            id: "wallet-1",
            name: "Wallet",
            provider,
            hints: { isInjected: true },
        };

        // Current chainId is 0x1, request switch to 0xA
        await connector.connect(candidate, { chainId: 10 });

        expect(provider.request).toHaveBeenCalledWith({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xa" }],
        });
    });

    it("attaches EIP-1193 listeners and updates session on events", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, emit } = makeProvider();
        const candidate: WalletCandidate = {
            id: "wallet-1",
            name: "Wallet",
            provider,
            hints: { isInjected: true },
        };

        const session = await connector.connect(candidate);

        // accountsChanged updates accounts
        emit("accountsChanged", ["0x111", "0x222"]);
        expect(session.accounts).toEqual(["0x111", "0x222"]);

        // chainChanged updates chainId
        emit("chainChanged", "0x2");
        expect(session.chainId).toBe(2);
    });

    it("ignores non-hex chainChanged payloads", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, emit } = makeProvider();
        const candidate: WalletCandidate = {
            id: "wallet-1",
            name: "Wallet",
            provider,
        };

        const session = await connector.connect(candidate);

        const before = session.chainId;
        emit("chainChanged", "not-hex");
        expect(session.chainId).toBe(before);
    });

    it("disconnect detaches listeners and best-effort revokes permissions", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider } = makeProvider();
        const candidate: WalletCandidate = {
            id: "wallet-1",
            name: "Wallet",
            provider,
        };

        const session = await connector.connect(candidate);

        await session.disconnect();

        // removed listeners
        expect(provider.removeListener).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
        expect(provider.removeListener).toHaveBeenCalledWith("chainChanged", expect.any(Function));

        // attempted revoke
        expect(provider.request).toHaveBeenCalledWith({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }],
        });
    });

    it("refresh updates accounts/chainId unless disconnected; no-op after disconnect", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider } = makeProvider();

        // Make refresh return different values
        (provider.request as any).mockImplementation(async ({ method }: { method: string }) => {
            if (method === "eth_requestAccounts") return ["0xabc"];
            if (method === "eth_chainId") return "0x1";
            if (method === "eth_accounts") return ["0xbeef"];
            if (method === "eth_getConnectorInfo")
                return {
                    connectorType: "custom",
                    connectorName: "Wallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                };
            return null;
        });

        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };
        const session = await connector.connect(candidate);

        await session.refresh();
        expect(session.accounts).toEqual(["0xbeef"]);
        expect(session.chainId).toBe(1);

        await session.disconnect();

        // after disconnect, refresh should not call eth_accounts/eth_chainId again
        const callsBefore = (provider.request as any).mock.calls.length;
        await session.refresh();
        const callsAfter = (provider.request as any).mock.calls.length;
        expect(callsAfter).toBe(callsBefore);
    });

    it("disconnect does not throw if wallet_revokePermissions is unsupported", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider } = makeProvider();
        (provider.request as any).mockImplementation(async ({ method }: { method: string }) => {
            if (method === "eth_requestAccounts") return ["0xabc"];
            if (method === "eth_chainId") return "0x1";
            if (method === "eth_getConnectorInfo")
                return {
                    connectorType: "injected",
                    connectorName: "Wallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                };
            if (method === "wallet_revokePermissions") throw new Error("nope");
            return null;
        });

        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };
        const session = await connector.connect(candidate);

        await expect(session.disconnect()).resolves.toBeUndefined();
    });
});
