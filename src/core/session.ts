import { BrowserProvider } from "ethers";
import type {
    ConnectedSession,
    ConnectorInfo,
    Eip1193Provider,
    PrivacyFirstConnector,
    WalletCandidate,
} from "./types";
import { discoverEip6963Wallets } from "./discovery/eip6963";
import type { ConnectorDisclosure } from "./types";


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
            // ✅ IMPORTANT: inject candidate.id as the stable id
            const connectorInfo = await getConnectorInfo(provider, candidate.id, {
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

                async disconnect() {
                    disconnected = true;

                    // Detach listeners if supported
                    if (provider.removeListener) {
                        provider.removeListener("accountsChanged", onAccountsChanged);
                        provider.removeListener("chainChanged", onChainChanged);
                    }

                    // Best-effort revoke permissions (optional; most wallets ignore it)
                    try {
                        await provider.request?.({
                            method: "wallet_revokePermissions",
                            params: [{ eth_accounts: {} }],
                        });
                    } catch {
                        // ignore
                    }
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
            function onAccountsChanged(accs: unknown) {
                if (disconnected) return;
                session.accounts = isStringArray(accs) ? accs : [];
            }

            function onChainChanged(cid: unknown) {
                if (disconnected) return;
                try {
                    session.chainId = parseChainId(cid);
                } catch {
                    // ignore non-hex payloads
                }
            }

            // Attach listeners if supported
            if (provider.on) {
                provider.on("accountsChanged", onAccountsChanged);
                provider.on("chainChanged", onChainChanged);
            }

            return session;
        },

        // ✅ Make this identity-safe: require walletId from caller
        async getConnectorInfo(provider, walletId, fallback) {
            return getConnectorInfo(provider, walletId, fallback);
        },

        getConnectorDisclosure() {
            // Disclosure authored by the connector itself (not the wallet)
            const disclosure: ConnectorDisclosure = {
                source: "connector",
                networkRequests: "none",
                telemetry: "none",
                persistentStorage: "none",
                discovery: {
                    eip6963: "user_gesture_only",
                    remoteCalls: false,
                },
                iconPolicy: "data_uri_only",
                logs: "local_only",
                notes: [
                    "No third-party scripts",
                    "No analytics or telemetry",
                    "No remote icon fetching",
                    "Discovery only on user interaction",
                ],
            };

            return disclosure;
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
    walletId: string,
    fallback?: Partial<ConnectorInfo>,
): Promise<ConnectorInfo> {
    try {
        const res = await provider.request({ method: "eth_getConnectorInfo" });

        if (res && typeof res === "object") {
            // ✅ never trust id/source from wallet
            const walletRes = res as Partial<Omit<ConnectorInfo, "id" | "source">>;

            return {
                ...walletRes,
                id: walletId,
                source: "wallet",
            } as ConnectorInfo;
        }
    } catch {
        // ignore; infer below
    }

    return {
        id: walletId,
        connectorType: fallback?.connectorType ?? "custom",
        connectorName: fallback?.connectorName ?? "Unknown",
        mediation: fallback?.mediation ?? "direct",
        thirdPartyInfrastructure: fallback?.thirdPartyInfrastructure ?? false,
        rpcVisibility: fallback?.rpcVisibility ?? "direct",
        source: "inferred",
        ...(fallback?.relayProvider ? { relayProvider: fallback.relayProvider } : {}),
    };
}


