import React, { useCallback, useMemo, useState } from "react";
import { useQA } from "./hooks";
import { WalletSelectModal } from "./modal/WalletSelectModal";
import type { WalletCandidate } from "../core"; // adjust if needed

function shortAddress(addr?: string | null) {
    if (!addr) return "";
    return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export function QAConnectButton(props: {
    className?: string;
    label?: string;
    modalTitle?: string;
    showDetailsWhenConnected?: boolean;
}) {
    const { className, label, modalTitle, showDetailsWhenConnected } = props;

    const qa = useQA();
    const [open, setOpen] = useState(false);

    const buttonText = useMemo(() => {
        if (qa.isConnecting) return "Connecting…";
        if (qa.isConnected) return shortAddress(qa.address) || "Connected";
        return label ?? "Connect wallet";
    }, [qa.isConnecting, qa.isConnected, qa.address, label]);

    const onClick = useCallback(async () => {
        qa.clearError();

        if (qa.isConnected) {
            // For v1: clicking while connected toggles "disconnect" simple behavior if desired.
            // Keep it simple: open a tiny details modal or just disconnect if user clicks again.
            setOpen(true);
            return;
        }

        // User gesture triggers local discovery
        await qa.discover();
        setOpen(true);
    }, [qa]);

    const onSelect = useCallback(
        async (wallet: WalletCandidate) => {
            await qa.connect(wallet);
            setOpen(false);
        },
        [qa],
    );

    const onDisconnect = useCallback(async () => {
        await qa.disconnect();
        setOpen(false);
    }, [qa]);

    const onClose = useCallback(() => setOpen(false), []);

    return (
        <>
            <button
                className={className}
                onClick={() => void onClick()}
                disabled={qa.isConnecting}
                style={{
                    borderRadius: 12,
                    padding: "10px 14px",
                    border: "1px solid rgba(0,0,0,0.12)",
                    background: "white",
                    cursor: qa.isConnecting ? "not-allowed" : "pointer",
                    fontWeight: 600,
                }}
            >
                {buttonText}
            </button>

            <WalletSelectModal
                open={open}
                title={modalTitle ?? (qa.isConnected ? "Connection" : "Select a wallet")}
                wallets={qa.wallets}
                isConnecting={qa.isConnecting}
                error={qa.error ?? null}
                onClose={onClose}
                onSelect={(wallet) => {
                    if (qa.isConnected) return;
                    void onSelect(wallet);
                }}
                // ✅ ADD THESE THREE:
                connectorInfo={qa.connectorInfo}
                connectorDisclosure={qa.connectorDisclosure}
                connectedWalletId={qa.connectorInfo?.id ?? null}
                connectedAddress={qa.address}
                onDisconnect={() => void onDisconnect()}
                brand={{
                    name: "QuantumAuth",
                    logoSrc: "/assets/logo.svg",
                }}
            />

            {showDetailsWhenConnected && qa.isConnected ? (
                <div style={{ marginTop: 10, fontSize: 12, color: "rgba(0,0,0,0.65)" }}>
                    <div>Chain: {qa.chainId}</div>
                    <div>Connector: {qa.connectorInfo?.connectorName} ({qa.connectorInfo?.source})</div>
                </div>
            ) : null}
        </>
    );
}
