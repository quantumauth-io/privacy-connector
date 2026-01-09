import type { BrowserProvider } from "ethers";

export type ConnectorType = "injected" | "walletconnect" | "custom";
export type Mediation = "direct" | "relay";
export type RpcVisibility = "direct" | "proxied";

export interface ConnectorInfo {
    connectorType: ConnectorType;
    connectorName: string;
    mediation: Mediation;
    relayProvider?: string;
    thirdPartyInfrastructure: boolean;
    rpcVisibility: RpcVisibility;

    // Not part of the EIP draft, but critical for honesty.
    source: "wallet" | "inferred";
}

export interface Eip1193Provider {
    request(args: { method: string; params?: unknown[] | object }): Promise<unknown>;
    on?(event: string, listener: (...args: any[]) => void): void;
    removeListener?(event: string, listener: (...args: any[]) => void): void;
}

export interface WalletCandidate {
    id: string;
    name: string;
    rdns?: string;
    icon?: string; // data URI only; never fetch remote icons
    provider: Eip1193Provider;
    hints?: { isInjected?: boolean };
}

export interface ConnectOptions {
    chainId?: number;
}

export interface ConnectedSession {
    candidate: WalletCandidate;
    provider: Eip1193Provider;
    ethersProvider: BrowserProvider;
    accounts: string[];
    chainId: number;
    connectorInfo: ConnectorInfo;

    disconnect(): Promise<void>;
    refresh(): Promise<void>;
}

export interface PrivacyFirstConnector {
    discoverWallets(): Promise<WalletCandidate[]>;
    connect(candidate: WalletCandidate, opts?: ConnectOptions): Promise<ConnectedSession>;
    getConnectorInfo(provider: Eip1193Provider, fallback?: Partial<ConnectorInfo>): Promise<ConnectorInfo>;
}
