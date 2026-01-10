import React, { useEffect } from "react";
import type { ConnectorInfo, ConnectorDisclosure, WalletCandidate } from "../../core";

function SummaryPill(props: { text: string }) {
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                border: "1px solid rgba(0,0,0,0.12)",
                background: "rgba(0,0,0,0.03)",
                fontSize: 12,
                color: "rgba(0,0,0,0.75)",
                whiteSpace: "nowrap",
            }}
        >
      {props.text}
    </span>
    );
}

function Row(props: { label: string; value: string; description: string }) {
    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span>{props.label}</span>
                <strong style={{ whiteSpace: "nowrap" }}>{props.value}</strong>
            </div>
            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.6)" }}>{props.description}</div>
        </div>
    );
}

function formatMediation(m?: ConnectorInfo["mediation"]) {
    if (m === "relay") {
        return {
            value: "Relayed",
            description: "A relay may observe connection metadata (such as IP address).",
        };
    }
    return {
        value: "Direct",
        description: "Your browser communicates directly with your wallet.",
    };
}

function formatRpcVisibility(v?: ConnectorInfo["rpcVisibility"]) {
    if (v === "proxied") {
        return {
            value: "Proxied",
            description: "RPC requests may pass through infrastructure you don’t control.",
        };
    }
    return {
        value: "Direct",
        description: "RPC requests go directly to the configured RPC endpoint.",
    };
}

function formatSource(s?: ConnectorInfo["source"]) {
    if (s === "wallet") {
        return {
            value: "Reported by wallet",
            description: "This information was provided directly by the wallet.",
        };
    }
    return {
        value: "Inferred locally",
        description: "The wallet did not disclose this information. Values shown are best-effort inference.",
    };
}

function formatThirdPartyInfra(x?: boolean) {
    if (x) {
        return {
            value: "Present",
            description: "Some infrastructure outside your wallet is involved and may observe metadata.",
        };
    }
    return {
        value: "None detected",
        description: "No third-party infrastructure is required for this connection.",
    };
}

export function WalletSelectModal(props: {
    open: boolean;
    title?: string;
    wallets: WalletCandidate[];
    isConnecting?: boolean;
    error: string | null;

    connectedWalletId?: string | null;
    connectedAddress?: string | null;
    onDisconnect?: () => void;

    // ✅ add this so the transparency UI has data
    connectorInfo?: ConnectorInfo | null;
    connectorDisclosure?: ConnectorDisclosure;

    onClose: () => void;
    onSelect: (wallet: WalletCandidate) => void;
}) {
    const {
        open,
        title,
        wallets,
        isConnecting,
        error,
        connectedWalletId,
        connectedAddress,
        onDisconnect,
        connectorInfo,
        connectorDisclosure,
        onClose,
        onSelect,
    } = props;

    const isConnected = !!connectedWalletId;

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    const mediation = formatMediation(connectorInfo?.mediation);
    const rpc = formatRpcVisibility(connectorInfo?.rpcVisibility);
    const src = formatSource(connectorInfo?.source);
    const infra = formatThirdPartyInfra(connectorInfo?.thirdPartyInfrastructure);

    // ✅ aligned with your types: relay / proxied
    const showPrivacyNote =
        connectorInfo?.mediation === "relay" ||
        connectorInfo?.thirdPartyInfrastructure === true ||
        connectorInfo?.rpcVisibility === "proxied";

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Select a wallet"}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    width: "min(520px, 100%)",
                    borderRadius: 16,
                    background: "white",
                    color: "black",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
                    overflow: "hidden",
                }}
            >
                <div style={{ padding: 16, borderBottom: "1px solid rgba(0,0,0,0.08)" }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <h3 style={{ margin: 0, fontSize: 16 }}>{title ?? "Select a wallet"}</h3>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {isConnected && onDisconnect ? (
                                <button
                                    onClick={onDisconnect}
                                    disabled={!!isConnecting}
                                    style={{
                                        border: "1px solid rgba(176,0,32,0.35)",
                                        background: "rgba(176,0,32,0.06)",
                                        color: "#b00020",
                                        borderRadius: 10,
                                        padding: "6px 10px",
                                        cursor: isConnecting ? "not-allowed" : "pointer",
                                    }}
                                >
                                    Disconnect
                                </button>
                            ) : null}

                            <button
                                onClick={onClose}
                                style={{
                                    border: "1px solid rgba(0,0,0,0.12)",
                                    background: "transparent",
                                    borderRadius: 10,
                                    padding: "6px 10px",
                                    cursor: "pointer",
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {error ? <div style={{ marginTop: 10, fontSize: 13, color: "#b00020" }}>{error}</div> : null}

                    <div style={{ marginTop: 10, fontSize: 13, color: "rgba(0,0,0,0.65)" }}>
                        Only locally detected EIP-6963 wallets are shown.
                    </div>

                    {isConnected ? (
                        <div style={{ marginTop: 10, fontSize: 13, color: "rgba(0,0,0,0.75)" }}>
                            Connected{connectedAddress ? `: ${connectedAddress}` : "."}
                        </div>
                    ) : null}

                    {/* ✅ Transparency report */}
                    {isConnected ? (
                        <details
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                background: "rgba(0,0,0,0.02)",
                                fontSize: 13,
                            }}
                        >
                            <summary
                                style={{
                                    cursor: "pointer",
                                    listStyle: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    userSelect: "none",
                                }}
                            >
                                <span style={{ fontWeight: 600 }}>Connection transparency</span>

                                {/* compact “at a glance” pills */}
                                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
        <SummaryPill text={connectorInfo?.mediation === "relay" ? "Relayed" : "Direct"} />
        <SummaryPill text={connectorInfo?.rpcVisibility === "proxied" ? "RPC proxied" : "RPC direct"} />
        <SummaryPill text={connectorInfo?.source === "wallet" ? "Wallet-reported" : "Inferred"} />
      </span>
                            </summary>

                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                <Row label="Connection path" value={mediation.value} description={mediation.description} />
                                <Row label="Third-party infrastructure" value={infra.value} description={infra.description} />
                                <Row label="RPC visibility" value={rpc.value} description={rpc.description} />
                                <Row label="Disclosure source" value={src.value} description={src.description} />
                            </div>

                            {showPrivacyNote ? (
                                <div
                                    style={{
                                        marginTop: 10,
                                        paddingTop: 10,
                                        borderTop: "1px solid rgba(0,0,0,0.08)",
                                        color: "#b45309",
                                        fontSize: 12,
                                    }}
                                >
                                    ⚠️ Privacy note: some parts of this connection may expose metadata outside your local device.
                                </div>
                            ) : null}
                        </details>
                    ) : null}

                    {/* ✅ Connector privacy disclosure */}
                    {isConnected && connectorDisclosure ? (
                        <details
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                border: "1px solid rgba(0,0,0,0.08)",
                                background: "rgba(0,0,0,0.02)",
                                fontSize: 13,
                            }}
                        >
                            <summary
                                style={{
                                    cursor: "pointer",
                                    listStyle: "none",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    gap: 12,
                                    userSelect: "none",
                                }}
                            >
                                <span style={{ fontWeight: 600 }}>Connector privacy disclosure</span>

                                {/* at-a-glance promises */}
                                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                <SummaryPill text={connectorDisclosure.telemetry === "none" ? "No telemetry" : "Telemetry"} />
                <SummaryPill text={connectorDisclosure.networkRequests === "none" ? "No network calls" : "Network calls"} />
                <SummaryPill text={connectorDisclosure.persistentStorage === "none" ? "No storage" : "Uses storage"} />
            </span>
                            </summary>

                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                <Row
                                    label="Network requests"
                                    value={
                                        connectorDisclosure.networkRequests === "none"
                                            ? "None"
                                            : connectorDisclosure.networkRequests === "rpc_only"
                                                ? "RPC only"
                                                : "Third-party"
                                    }
                                    description={
                                        connectorDisclosure.networkRequests === "none"
                                            ? "The connector does not make any network requests."
                                            : connectorDisclosure.networkRequests === "rpc_only"
                                                ? "The connector only performs RPC requests to the selected network."
                                                : "The connector may call third-party endpoints."
                                    }
                                />

                                <Row
                                    label="Telemetry"
                                    value={connectorDisclosure.telemetry === "none" ? "None" : connectorDisclosure.telemetry}
                                    description={
                                        connectorDisclosure.telemetry === "none"
                                            ? "The connector does not collect analytics or usage telemetry."
                                            : "The connector collects limited telemetry."
                                    }
                                />

                                <Row
                                    label="Persistent storage"
                                    value={connectorDisclosure.persistentStorage === "none" ? "None" : "Local"}
                                    description={
                                        connectorDisclosure.persistentStorage === "none"
                                            ? "The connector does not persist identifiers or session data."
                                            : "The connector stores limited data locally."
                                    }
                                />

                                <Row
                                    label="Wallet discovery"
                                    value={
                                        connectorDisclosure.discovery.eip6963 === "user_gesture_only"
                                            ? "User-initiated"
                                            : "Automatic"
                                    }
                                    description={
                                        connectorDisclosure.discovery.eip6963 === "user_gesture_only"
                                            ? "Wallet discovery only occurs after a user action."
                                            : "Wallet discovery may occur automatically."
                                    }
                                />

                                <Row
                                    label="Icon policy"
                                    value={
                                        connectorDisclosure.iconPolicy === "data_uri_only"
                                            ? "Data URI only"
                                            : "Remote allowed"
                                    }
                                    description={
                                        connectorDisclosure.iconPolicy === "data_uri_only"
                                            ? "The connector never fetches remote icons."
                                            : "The connector may fetch remote icons."
                                    }
                                />

                                <Row
                                    label="Logging"
                                    value={
                                        connectorDisclosure.logs === "none"
                                            ? "None"
                                            : connectorDisclosure.logs === "local_only"
                                                ? "Local only"
                                                : "Remote"
                                    }
                                    description={
                                        connectorDisclosure.logs === "none"
                                            ? "The connector does not log events."
                                            : connectorDisclosure.logs === "local_only"
                                                ? "Logs are kept locally only."
                                                : "Logs may be transmitted remotely."
                                    }
                                />
                            </div>

                            {connectorDisclosure.notes?.length ? (
                                <div
                                    style={{
                                        marginTop: 10,
                                        paddingTop: 10,
                                        borderTop: "1px solid rgba(0,0,0,0.08)",
                                        fontSize: 12,
                                        color: "rgba(0,0,0,0.7)",
                                    }}
                                >
                                    <strong>Notes:</strong>
                                    <ul style={{ margin: "6px 0 0 16px", padding: 0 }}>
                                        {connectorDisclosure.notes.map((n, i) => (
                                            <li key={i}>{n}</li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </details>
                    ) : null}
                </div>

                <div style={{ padding: 8 }}>
                    {wallets.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 14, color: "rgba(0,0,0,0.65)" }}>
                            No EIP-6963 wallets detected. Install a compatible wallet and try again.
                        </div>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {wallets.map((w) => {
                                const isThisConnected = connectedWalletId === w.id;

                                return (
                                    <li key={w.id}>
                                        <button
                                            disabled={!!isConnecting}
                                            onClick={() => onSelect(w)}
                                            style={{
                                                width: "100%",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: 12,
                                                padding: 12,
                                                margin: 4,
                                                borderRadius: 12,
                                                border: isThisConnected ? "1px solid rgba(0,0,0,0.25)" : "1px solid rgba(0,0,0,0.08)",
                                                background: isThisConnected ? "rgba(0,0,0,0.02)" : "white",
                                                cursor: isConnecting ? "not-allowed" : "pointer",
                                                textAlign: "left",
                                            }}
                                        >
                                            {w.icon ? (
                                                <img src={w.icon} alt="" width={28} height={28} style={{ borderRadius: 8 }} />
                                            ) : (
                                                <div
                                                    style={{
                                                        width: 28,
                                                        height: 28,
                                                        borderRadius: 8,
                                                        background: "rgba(0,0,0,0.06)",
                                                    }}
                                                />
                                            )}

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 600,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        display: "flex",
                                                        gap: 8,
                                                        alignItems: "center",
                                                    }}
                                                >
                                                    <span>{w.name}</span>
                                                    {isThisConnected ? (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding: "2px 8px",
                                                                borderRadius: 999,
                                                                border: "1px solid rgba(0,0,0,0.18)",
                                                                color: "rgba(0,0,0,0.7)",
                                                                background: "rgba(0,0,0,0.04)",
                                                            }}
                                                        >
                              Connected
                            </span>
                                                    ) : null}
                                                </div>

                                                {w.rdns ? (
                                                    <div
                                                        style={{
                                                            fontSize: 12,
                                                            color: "rgba(0,0,0,0.55)",
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                        }}
                                                    >
                                                        {w.rdns}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                                                {isConnecting ? "Connecting…" : isThisConnected ? "Reconnect" : "Connect"}
                                            </div>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>

                <div
                    style={{
                        padding: 16,
                        borderTop: "1px solid rgba(0,0,0,0.08)",
                        fontSize: 12,
                        color: "rgba(0,0,0,0.6)",
                    }}
                >
                    Tip: call discovery only on user interaction to reduce fingerprinting.
                </div>
            </div>
        </div>
    );
}
