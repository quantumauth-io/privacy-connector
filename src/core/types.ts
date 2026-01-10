import type { BrowserProvider } from "ethers";

export type ConnectorType = "injected" | "walletconnect" | "custom";
export type Mediation = "direct" | "relay";
export type RpcVisibility = "direct" | "proxied";

export type NetworkRequests = "none" | "rpc_only" | "third_party";
export type Telemetry = "none" | "anonymous" | "pseudonymous";
export type PersistentStorage = "none" | "local";
export type DiscoveryPolicy = "user_gesture_only" | "automatic";

export interface ConnectorDisclosure {
    source: "connector";

    networkRequests: NetworkRequests;
    telemetry: Telemetry;
    persistentStorage: PersistentStorage;

    discovery: {
        eip6963: DiscoveryPolicy;
        remoteCalls: boolean;
    };

    iconPolicy: "data_uri_only" | "remote_allowed";
    logs: "none" | "local_only" | "remote";

    notes?: string[]; // short human-friendly promises
}

export interface ConnectorInfo {
    id: string;
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

    on?(event: string, listener: (...args: unknown[]) => void): void;
    removeListener?(event: string, listener: (...args: unknown[]) => void): void;
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
    getConnectorInfo(provider: Eip1193Provider, walletId: string, fallback?: Partial<ConnectorInfo>): Promise<ConnectorInfo>;
    getConnectorDisclosure(): ConnectorDisclosure;
}
