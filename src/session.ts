import {BrowserProvider} from "ethers";
import type {ConnectedSession, ConnectorInfo, Eip1193Provider, PrivacyFirstConnector, WalletCandidate,} from "./types";
import {discoverEip6963Wallets} from "./discovery/eip6963";

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
            // 1) request accounts
            const accounts = (await candidate.provider.request({
                method: "eth_requestAccounts",
            })) as string[];

            // 2) chainId
            const chainIdHex = (await candidate.provider.request({ method: "eth_chainId" })) as string;
            const chainId = parseInt(chainIdHex, 16);

            // 3) optional chain switch
            if (opts?.chainId && opts.chainId !== chainId) {
                await candidate.provider.request({
                    method: "wallet_switchEthereumChain",
                    params: [{ chainId: `0x${opts.chainId.toString(16)}` }],
                });
            }

            // 4) ethers wrapper
            const ethersProvider = new BrowserProvider(candidate.provider as any);

            // 5) connector transparency (wallet method if available, else inferred)
            const connectorInfo = await getConnectorInfo(candidate.provider, {
                connectorType: candidate.hints?.isInjected ? "injected" : "custom",
                connectorName: candidate.name,
                mediation: "direct",
                thirdPartyInfrastructure: false,
                rpcVisibility: "direct",
            });

            let disconnected = false;

            const session: ConnectedSession = {
                candidate,
                provider: candidate.provider,
                ethersProvider,
                accounts,
                chainId,
                connectorInfo,

                async disconnect() {
                    disconnected = true;
                    // Most wallets don’t support a real disconnect; we just detach listeners in v1.
                },

                async refresh() {
                    if (disconnected) return;
                    const a = (await candidate.provider.request({ method: "eth_accounts" })) as string[];
                    const cHex = (await candidate.provider.request({ method: "eth_chainId" })) as string;
                    session.accounts = a;
                    session.chainId = parseInt(cHex, 16);
                },
            };

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
        ...(fallback?.relayProvider ? {relayProvider: fallback.relayProvider} : {}),
    };
}
