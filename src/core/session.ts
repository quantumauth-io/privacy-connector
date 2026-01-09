import { BrowserProvider } from "ethers";
import type {
    ConnectedSession,
    ConnectorInfo,
    Eip1193Provider,
    PrivacyFirstConnector,
    WalletCandidate,
} from "./types";
import { discoverEip6963Wallets } from "./discovery/eip6963";

export function parseChainId(
    chainIdHex: unknown,
    _isFinite: (n: number) => boolean = Number.isFinite,
): number {
    if (typeof chainIdHex !== "string") throw new Error("Invalid chainId response");
    if (!/^0x[0-9a-fA-F]+$/.test(chainIdHex)) throw new Error("Invalid chainId format");

    const n = Number.parseInt(chainIdHex, 16);
    if (!_isFinite(n)) throw new Error("Invalid chainId value");
    return n;
}

function isStringArray(x: unknown): x is string[] {
    return Array.isArray(x) && x.every((v) => typeof v === "string");
}

export function createPrivacyFirstConnector(params?: {
    quantumAuthCandidate?: () => Promise<WalletCandidate | null>;
    enableEip6963?: boolean;
}): PrivacyFirstConnector {
    const enableEip6963 = params?.enableEip6963 ?? true;

    return {
        async discoverWallets() {
            const wallets: WalletCandidate[] = [];

            if (params?.quantumAuthCandidate) {
                const qa = await params.quantumAuthCandidate().catch(() => null);
                if (qa) wallets.push(qa);
            }

            if (enableEip6963) {
                wallets.push(...(await discoverEip6963Wallets()));
            }

            return dedupe(wallets);
        },

        async connect(candidate, opts) {
            const provider = candidate.provider;

            // 1) request accounts
            const accountsRes = await provider.request({ method: "eth_requestAccounts" });
            const accounts = isStringArray(accountsRes) ? accountsRes : [];

            // 2) chainId
            const chainIdHex = await provider.request({ method: "eth_chainId" });
            const chainId = parseChainId(chainIdHex);

            // 3) optional chain switch
            if (opts?.chainId && opts.chainId !== chainId) {
                await provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: `0x${opts.chainId.toString(16)}` }],
                });
            }

            // 4) ethers wrapper
            const ethersProvider = new BrowserProvider(provider);

            // 5) connector transparency (wallet method if available, else inferred)
            const connectorInfo = await getConnectorInfo(provider, {
                connectorType: candidate.hints?.isInjected ? "injected" : "custom",
                connectorName: candidate.name,
                mediation: "direct",
                thirdPartyInfrastructure: false,
                rpcVisibility: "direct",
            });

            let disconnected = false;

            // Create session object first so listeners can mutate it
            const session: ConnectedSession = {
                candidate,
                provider,
                ethersProvider,
                accounts,
                chainId,
                connectorInfo,

                disconnect() {
                    disconnected = true;

                    // Detach listeners if supported
                    if (provider.removeListener) {
                        provider.removeListener("accountsChanged", onAccountsChanged);
                        provider.removeListener("chainChanged", onChainChanged);
                    }

                    // Most wallets don’t support a real disconnect; we just detach listeners in v1.
                    return Promise.resolve();
                },

                async refresh() {
                    if (disconnected) return;

                    const aRes = await provider.request({ method: "eth_accounts" });
                    const cRes = await provider.request({ method: "eth_chainId" });

                    session.accounts = isStringArray(aRes) ? aRes : [];
                    session.chainId = parseChainId(cRes);
                },
            };

            // --- EIP-1193 event listeners (optional) ---
            // Must be declared AFTER session is created (closure uses session)
            function onAccountsChanged(accs: unknown) {
                if (disconnected) return;
                session.accounts = isStringArray(accs) ? accs : [];
            }

            function onChainChanged(cid: unknown) {
                if (disconnected) return;
                try {
                    session.chainId = parseChainId(cid);
                } catch {
                    // If a wallet emits a non-hex chainChanged payload, ignore it.
                }
            }

            // Attach listeners if supported
            if (provider.on) {
                provider.on("accountsChanged", onAccountsChanged);
                provider.on("chainChanged", onChainChanged);
            }

            return session;
        },

        async getConnectorInfo(provider, fallback) {
            return getConnectorInfo(provider, fallback);
        },
    };
}

function dedupe(wallets: WalletCandidate[]): WalletCandidate[] {
    const seen = new Set<string>();
    const out: WalletCandidate[] = [];
    for (const w of wallets) {
        const key = w.id || w.rdns || w.name;
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(w);
    }
    return out;
}

async function getConnectorInfo(
    provider: Eip1193Provider,
    fallback?: Partial<ConnectorInfo>,
): Promise<ConnectorInfo> {
    try {
        const res = await provider.request({ method: "eth_getConnectorInfo" });
        if (res && typeof res === "object") {
            return { ...(res as ConnectorInfo), source: "wallet" };
        }
    } catch {
        // ignore; infer below
    }

    return {
        connectorType: fallback?.connectorType ?? "custom",
        connectorName: fallback?.connectorName ?? "Unknown",
        mediation: fallback?.mediation ?? "direct",
        thirdPartyInfrastructure: fallback?.thirdPartyInfrastructure ?? false,
        rpcVisibility: fallback?.rpcVisibility ?? "direct",
        source: "inferred",
        ...(fallback?.relayProvider ? { relayProvider: fallback.relayProvider } : {}),
    };
}
