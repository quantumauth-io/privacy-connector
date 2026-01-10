import React, { createContext, useCallback, useMemo, useRef, useState } from "react";
import type { BrowserProvider } from "ethers";

import {
    createPrivacyFirstConnector,
    type ConnectedSession,
    type ConnectorInfo,
    type Eip1193Provider,
    type WalletCandidate,
    type ConnectorDisclosure
} from "../core";

type QAState = {
    // Status
    isConnecting: boolean;
    isConnected: boolean;
    error: string | null;

    // Discovered wallets (EIP-6963 only)
    wallets: WalletCandidate[];

    // Connection/session
    session: ConnectedSession | null;
    accounts: string[];
    address: string | null;
    chainId: number | null;

    provider: Eip1193Provider | null;
    ethersProvider: BrowserProvider | null;
    connectorInfo: ConnectorInfo | null;
    connectorDisclosure: ConnectorDisclosure;

    // Actions
    discover: () => Promise<WalletCandidate[]>;
    connect: (wallet: WalletCandidate) => Promise<void>;
    disconnect: () => Promise<void>;
    clearError: () => void;
};

export const QAContext = createContext<QAState | null>(null);

export function QAProvider(props: {
    children: React.ReactNode;
    chainId?: number;
    enableEip6963?: boolean;
    quantumAuthCandidate?: () => Promise<WalletCandidate | null>;
}) {
    const { children, chainId, enableEip6963, quantumAuthCandidate } = props;

    // Create connector once (intentionally stable for the lifetime of this Provider instance)
    const connectorParams = {
        enableEip6963: enableEip6963 ?? true,
        ...(quantumAuthCandidate ? { quantumAuthCandidate } : {}),
    } as const;

    const connectorRef = useRef(createPrivacyFirstConnector(connectorParams));


    const [wallets, setWallets] = useState<WalletCandidate[]>([]);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [session, setSession] = useState<ConnectedSession | null>(null);
    const [accounts, setAccounts] = useState<string[]>([]);
    const [address, setAddress] = useState<string | null>(null);
    const [chainIdState, setChainIdState] = useState<number | null>(null);
    const [provider, setProvider] = useState<Eip1193Provider | null>(null);
    const [ethersProvider, setEthersProvider] = useState<BrowserProvider | null>(null);
    const [connectorInfo, setConnectorInfo] = useState<ConnectorInfo | null>(null);
    const [connectorDisclosure] = useState(() => connectorRef.current.getConnectorDisclosure());

    const clearError = useCallback(() => setError(null), []);

    const discover = useCallback(async () => {
        clearError();
        // IMPORTANT: should be triggered from a user gesture (button click)
        const list = await connectorRef.current.discoverWallets();
        setWallets(list);
        return list;
    }, [clearError]);

    const connect = useCallback(
        async (wallet: WalletCandidate) => {
            clearError();
            setIsConnecting(true);
            try {
                const s = await connectorRef.current.connect(wallet, chainId ? { chainId } : undefined);

                setSession(s);
                setAccounts(s.accounts);
                setAddress(s.accounts[0] ?? null);
                setChainIdState(s.chainId);
                setProvider(s.provider);
                setEthersProvider(s.ethersProvider);
                setConnectorInfo(s.connectorInfo);
            } catch (e: unknown) {
                const msg = e instanceof Error ? e.message : "Failed to connect.";
                setError(msg);
                throw e;
            } finally {
                setIsConnecting(false);
            }
        },
        [chainId, clearError],
    );

    const disconnect = useCallback(async () => {
        clearError();
        try {
            if (session) await session.disconnect();
        } finally {
            setSession(null);
            setAccounts([]);
            setAddress(null);
            setChainIdState(null);
            setProvider(null);
            setEthersProvider(null);
            setConnectorInfo(null);
        }
    }, [session, clearError]);

    const value = useMemo<QAState>(
        () => ({
            isConnecting,
            isConnected: session !== null,
            error,

            wallets,

            session,
            accounts,
            address,
            chainId: chainIdState,

            provider,
            ethersProvider,
            connectorInfo,
            connectorDisclosure,

            discover,
            connect,
            disconnect,
            clearError,

        }),
        [
            isConnecting,
            session,
            error,
            wallets,
            accounts,
            address,
            chainIdState,
            provider,
            ethersProvider,
            connectorInfo,
            connectorDisclosure,
            discover,
            connect,
            disconnect,
            clearError,
        ],
    );

    return <QAContext.Provider value={value}>{children}</QAContext.Provider>;
}
