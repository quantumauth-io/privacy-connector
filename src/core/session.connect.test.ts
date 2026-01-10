import { describe, expect, it, vi, beforeEach } from "vitest";
import { createPrivacyFirstConnector } from "./session";
import type { Eip1193Provider, WalletCandidate } from "./types";

type RequestArgs = Parameters<Eip1193Provider["request"]>[0];
type RequestFn = (args: RequestArgs) => Promise<unknown>;

function makeProvider() {
    const listeners = new Map<string, Set<(...args: unknown[]) => void>>();

    const requestMock = vi.fn<RequestFn>((args) => {
        const { method } = args;

        if (method === "eth_requestAccounts") return Promise.resolve(["0xabc"]);
        if (method === "eth_chainId") return Promise.resolve("0x1");
        if (method === "eth_accounts") return Promise.resolve(["0xdef"]);
        if (method === "wallet_revokePermissions") return Promise.resolve(null);
        if (method === "eth_getConnectorInfo") {
            return Promise.resolve({
                connectorType: "injected",
                connectorName: "Wallet",
                mediation: "direct",
                thirdPartyInfrastructure: false,
                rpcVisibility: "direct",
            });
        }

        return Promise.resolve(null);
    });

    const onMock = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        const set = listeners.get(event) ?? new Set<(...args: unknown[]) => void>();
        set.add(listener);
        listeners.set(event, set);
    });

    const removeListenerMock = vi.fn((event: string, listener: (...args: unknown[]) => void) => {
        listeners.get(event)?.delete(listener);
    });

    const provider: Eip1193Provider = {
        request: requestMock,
        on: onMock,
        removeListener: removeListenerMock,
    };

    const emit = (event: string, payload: unknown) => {
        for (const fn of listeners.get(event) ?? []) fn(payload);
    };

    return { provider, requestMock, onMock, removeListenerMock, emit };
}

describe("session.connect", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    it("switches chain when opts.chainId differs", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, requestMock } = makeProvider();
        const candidate: WalletCandidate = {
            id: "wallet-1",
            name: "Wallet",
            provider,
            hints: { isInjected: true },
        };

        // current chain is 0x1, request switch to 0xA
        await connector.connect(candidate, { chainId: 10 });

        expect(requestMock).toHaveBeenCalledWith({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0xa" }],
        });
    });

    it("attaches listeners and updates session on accountsChanged/chainChanged", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, onMock, emit } = makeProvider();
        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };

        const session = await connector.connect(candidate);

        expect(onMock).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
        expect(onMock).toHaveBeenCalledWith("chainChanged", expect.any(Function));

        emit("accountsChanged", ["0x111", "0x222"]);
        expect(session.accounts).toEqual(["0x111", "0x222"]);

        emit("chainChanged", "0x2");
        expect(session.chainId).toBe(2);
    });

    it("ignores non-hex chainChanged payloads", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, emit } = makeProvider();
        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };

        const session = await connector.connect(candidate);
        const before = session.chainId;

        emit("chainChanged", "not-hex");
        expect(session.chainId).toBe(before);
    });

    it("disconnect detaches listeners and best-effort revokes permissions", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, requestMock, removeListenerMock } = makeProvider();
        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };

        const session = await connector.connect(candidate);
        await session.disconnect();

        expect(removeListenerMock).toHaveBeenCalledWith("accountsChanged", expect.any(Function));
        expect(removeListenerMock).toHaveBeenCalledWith("chainChanged", expect.any(Function));

        expect(requestMock).toHaveBeenCalledWith({
            method: "wallet_revokePermissions",
            params: [{ eth_accounts: {} }],
        });
    });

    it("refresh updates accounts/chainId unless disconnected; no-op after disconnect", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, requestMock } = makeProvider();

        // Override only the refresh-related methods (no async-without-await here; we return Promise.resolve)
        requestMock.mockImplementation((args) => {
            const { method } = args;
            if (method === "eth_requestAccounts") return Promise.resolve(["0xabc"]);
            if (method === "eth_chainId") return Promise.resolve("0x1");
            if (method === "eth_accounts") return Promise.resolve(["0xbeef"]);
            if (method === "eth_getConnectorInfo") {
                return Promise.resolve({
                    connectorType: "custom",
                    connectorName: "Wallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                });
            }
            return Promise.resolve(null);
        });

        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };
        const session = await connector.connect(candidate);

        await session.refresh();
        expect(session.accounts).toEqual(["0xbeef"]);
        expect(session.chainId).toBe(1);

        await session.disconnect();

        const callsBefore = requestMock.mock.calls.length;
        await session.refresh();
        const callsAfter = requestMock.mock.calls.length;

        expect(callsAfter).toBe(callsBefore);
    });

    it("disconnect does not throw if wallet_revokePermissions is unsupported", async () => {
        const connector = createPrivacyFirstConnector();

        const { provider, requestMock } = makeProvider();

        requestMock.mockImplementation((args) => {
            const { method } = args;
            if (method === "eth_requestAccounts") return Promise.resolve(["0xabc"]);
            if (method === "eth_chainId") return Promise.resolve("0x1");
            if (method === "eth_getConnectorInfo") {
                return Promise.resolve({
                    connectorType: "injected",
                    connectorName: "Wallet",
                    mediation: "direct",
                    thirdPartyInfrastructure: false,
                    rpcVisibility: "direct",
                });
            }
            if (method === "wallet_revokePermissions") return Promise.reject(new Error("nope"));
            return Promise.resolve(null);
        });

        const candidate: WalletCandidate = { id: "wallet-1", name: "Wallet", provider };
        const session = await connector.connect(candidate);

        await expect(session.disconnect()).resolves.toBeUndefined();
    });
});
