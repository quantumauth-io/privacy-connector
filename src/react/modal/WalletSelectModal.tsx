import React, { useEffect, useMemo } from "react";
import type { ConnectorInfo, ConnectorDisclosure, WalletCandidate } from "../../core";
import { QuantumAuthLogo } from "../components/QuantumAuthLogo";
import { createPortal } from "react-dom";

function Portal(props: { children: React.ReactNode }) {
    const [mounted, setMounted] = React.useState(false);

    React.useEffect(() => {
        setMounted(true);
    }, []);

    if (!mounted) return null;
    return createPortal(props.children, document.body);
}


type Brand = {
    name?: string;            // e.g. "QuantumAuth"
    logoSrc?: string;         // e.g. "/quantumauth.svg" (or data-uri)
    logoAlt?: string;         // default: "QuantumAuth"
};

function usePrefersDark(): boolean {
    const [dark, setDark] = React.useState(false);

    React.useEffect(() => {
        if (typeof window === "undefined" || !window.matchMedia) return;

        const mql = window.matchMedia("(prefers-color-scheme: dark)");
        const update = () => setDark(mql.matches);

        update();

        // Modern browsers
        if (typeof mql.addEventListener === "function") {
            mql.addEventListener("change", update);
            return () => mql.removeEventListener("change", update);
        }

        // Legacy fallback (typed out of DOM lib in newer TS)
        const legacy = mql as unknown as {
            addListener?: (cb: () => void) => void;
            removeListener?: (cb: () => void) => void;
        };

        if (typeof legacy.addListener === "function") {
            legacy.addListener(update);
            return () => legacy.removeListener?.(update);
        }

        return;
    }, []);

    return dark;
}

function SummaryPill(props: { text: string; theme: ReturnType<typeof makeTheme> }) {
    const { t } = props.theme;
    return (
        <span
            style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "2px 8px",
                borderRadius: 999,
                border: `1px solid ${t.border}`,
                background: t.pillBg,
                fontSize: 12,
                color: t.mutedText,
                whiteSpace: "nowrap",
            }}
        >
      {props.text}
    </span>
    );
}

function Row(props: { label: string; value: string; description: string; theme: ReturnType<typeof makeTheme> }) {
    const { t } = props.theme;
    return (
        <div>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                <span style={{ color: t.text }}>{props.label}</span>
                <strong style={{ whiteSpace: "nowrap", color: t.text }}>{props.value}</strong>
            </div>
            <div style={{ fontSize: 12, color: t.mutedText }}>{props.description}</div>
        </div>
    );
}

function formatMediation(m?: ConnectorInfo["mediation"]) {
    if (m === "relay") {
        return { value: "Relayed", description: "A relay may observe connection metadata (such as IP address)." };
    }
    return { value: "Direct", description: "Your browser communicates directly with your wallet." };
}

function formatRpcVisibility(v?: ConnectorInfo["rpcVisibility"]) {
    if (v === "proxied") {
        return { value: "Proxied", description: "RPC requests may pass through infrastructure you don’t control." };
    }
    return { value: "Direct", description: "RPC requests go directly to the configured RPC endpoint." };
}

function formatSource(s?: ConnectorInfo["source"]) {
    if (s === "wallet") {
        return { value: "Reported by wallet", description: "This information was provided directly by the wallet." };
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
    return { value: "None detected", description: "No third-party infrastructure is required for this connection." };
}

function makeTheme(isDark: boolean) {
    // keep it simple: one palette, no fancy tokens yet
    const t = isDark
        ? {
            // surfaces
            backdrop: "rgba(0,0,0,0.72)",
            cardBg: "rgba(17, 17, 19, 0.98)",
            cardBg2: "rgba(255,255,255,0.04)",
            // text
            text: "rgba(255,255,255,0.92)",
            mutedText: "rgba(255,255,255,0.70)",
            faintText: "rgba(255,255,255,0.55)",
            // borders + shadows
            border: "rgba(255,255,255,0.12)",
            borderStrong: "rgba(255,255,255,0.22)",
            shadow: "0 18px 50px rgba(0,0,0,0.6)",
            // pills/buttons
            pillBg: "rgba(255,255,255,0.06)",
            btnBg: "rgba(255,255,255,0.06)",
            btnBgHover: "rgba(255,255,255,0.10)",
            dangerBorder: "rgba(255, 99, 99, 0.35)",
            dangerBg: "rgba(255, 99, 99, 0.10)",
            dangerText: "rgba(255, 120, 120, 0.95)",
            warnText: "rgba(255, 200, 120, 0.95)",
        }
        : {
            backdrop: "rgba(0,0,0,0.50)",
            cardBg: "white",
            cardBg2: "rgba(0,0,0,0.02)",
            text: "rgba(0,0,0,0.92)",
            mutedText: "rgba(0,0,0,0.65)",
            faintText: "rgba(0,0,0,0.55)",
            border: "rgba(0,0,0,0.12)",
            borderStrong: "rgba(0,0,0,0.22)",
            shadow: "0 10px 30px rgba(0,0,0,0.25)",
            pillBg: "rgba(0,0,0,0.03)",
            btnBg: "transparent",
            btnBgHover: "rgba(0,0,0,0.04)",
            dangerBorder: "rgba(176,0,32,0.35)",
            dangerBg: "rgba(176,0,32,0.06)",
            dangerText: "#b00020",
            warnText: "#b45309",
        };

    return { isDark, t };
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

    connectorInfo?: ConnectorInfo | null;
    connectorDisclosure?: ConnectorDisclosure;

    brand?: Brand;

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
        brand,
        onClose,
        onSelect,
    } = props;

    const isConnected = !!connectedWalletId;

    const prefersDark = usePrefersDark();
    const theme = useMemo(() => makeTheme(prefersDark), [prefersDark]);
    const { t } = theme;

    const logoColor = theme.isDark ? "#fff" : "#104962";

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    useEffect(() => {
        if (!open) return;

        const prev = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        return () => {
            document.body.style.overflow = prev;
        };
    }, [open]);

    if (!open) return null;

    const mediation = formatMediation(connectorInfo?.mediation);
    const rpc = formatRpcVisibility(connectorInfo?.rpcVisibility);
    const src = formatSource(connectorInfo?.source);
    const infra = formatThirdPartyInfra(connectorInfo?.thirdPartyInfrastructure);

    const showPrivacyNote =
        connectorInfo?.mediation === "relay" ||
        connectorInfo?.thirdPartyInfrastructure === true ||
        connectorInfo?.rpcVisibility === "proxied";

    const brandName = brand?.name ?? "QuantumAuth";


    return (
        <Portal>
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
                background: t.backdrop,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                padding: 16,
                zIndex: 9999,
            }}
        >
            <div
                style={{
                    width: "min(560px, 100%)",
                    maxHeight: "min(80vh, 720px)",
                    overflow: "auto",
                    borderRadius: 16,
                    background: t.cardBg,
                    color: t.text,
                    boxShadow: t.shadow,
                    border: `1px solid ${t.border}`,
                }}
            >
                <div style={{ padding: 16, borderBottom: `1px solid ${t.border}` }}>
                    {/* Header row: brand + title + actions */}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                            {/* Brand block */}
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                                <QuantumAuthLogo
                                    width={26}
                                    height={26}
                                    aria-label="QuantumAuth"
                                    role="img"
                                    style={{
                                        color: logoColor,
                                        display: "block",
                                        flexShrink: 0,
                                    }}
                                />
                                <div style={{ display: "flex", flexDirection: "column", lineHeight: 1.1 }}>
                                    <span style={{ fontSize: 12, color: t.faintText }}>{brandName}</span>
                                    <h3 style={{ margin: 0, fontSize: 16, color: t.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                        {title ?? "Select a wallet"}
                                    </h3>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            {isConnected && onDisconnect ? (
                                <button
                                    onClick={onDisconnect}
                                    disabled={!!isConnecting}
                                    style={{
                                        border: `1px solid ${t.dangerBorder}`,
                                        background: t.dangerBg,
                                        color: t.dangerText,
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
                                    border: `1px solid ${t.border}`,
                                    background: t.btnBg,
                                    borderRadius: 10,
                                    padding: "6px 10px",
                                    color: t.text,
                                    cursor: "pointer",
                                }}
                                onMouseEnter={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover;
                                }}
                                onMouseLeave={(e) => {
                                    (e.currentTarget as HTMLButtonElement).style.background = t.btnBg;
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>

                    {error ? <div style={{ marginTop: 10, fontSize: 13, color: t.dangerText }}>{error}</div> : null}

                    <div style={{ marginTop: 10, fontSize: 13, color: t.mutedText }}>
                        Only locally detected EIP-6963 wallets are shown.
                    </div>

                    {isConnected ? (
                        <div style={{ marginTop: 10, fontSize: 13, color: t.text }}>
                            Connected{connectedAddress ? `: ${connectedAddress}` : "."}
                        </div>
                    ) : null}

                    {/* Transparency report */}
                    {isConnected ? (
                        <details
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg2,
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
                                <span style={{ fontWeight: 700, color: t.text }}>Connection transparency</span>

                                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <SummaryPill theme={theme} text={connectorInfo?.mediation === "relay" ? "Relayed" : "Direct"} />
                  <SummaryPill theme={theme} text={connectorInfo?.rpcVisibility === "proxied" ? "RPC proxied" : "RPC direct"} />
                  <SummaryPill theme={theme} text={connectorInfo?.source === "wallet" ? "Wallet-reported" : "Inferred"} />
                </span>
                            </summary>

                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                <Row theme={theme} label="Connection path" value={mediation.value} description={mediation.description} />
                                <Row theme={theme} label="Third-party infrastructure" value={infra.value} description={infra.description} />
                                <Row theme={theme} label="RPC visibility" value={rpc.value} description={rpc.description} />
                                <Row theme={theme} label="Disclosure source" value={src.value} description={src.description} />
                            </div>

                            {showPrivacyNote ? (
                                <div
                                    style={{
                                        marginTop: 10,
                                        paddingTop: 10,
                                        borderTop: `1px solid ${t.border}`,
                                        color: t.warnText,
                                        fontSize: 12,
                                    }}
                                >
                                    ⚠️ Privacy note: some parts of this connection may expose metadata outside your local device.
                                </div>
                            ) : null}
                        </details>
                    ) : null}

                    {/* Connector privacy disclosure */}
                    {isConnected && connectorDisclosure ? (
                        <details
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderRadius: 12,
                                border: `1px solid ${t.border}`,
                                background: t.cardBg2,
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
                                <span style={{ fontWeight: 700, color: t.text }}>Connector privacy disclosure</span>

                                <span style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  <SummaryPill theme={theme} text={connectorDisclosure.telemetry === "none" ? "No telemetry" : "Telemetry"} />
                  <SummaryPill theme={theme} text={connectorDisclosure.networkRequests === "none" ? "No network calls" : "Network calls"} />
                  <SummaryPill theme={theme} text={connectorDisclosure.persistentStorage === "none" ? "No storage" : "Uses storage"} />
                </span>
                            </summary>

                            <div style={{ marginTop: 10, display: "grid", gap: 8 }}>
                                <Row
                                    theme={theme}
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
                                    theme={theme}
                                    label="Telemetry"
                                    value={connectorDisclosure.telemetry === "none" ? "None" : connectorDisclosure.telemetry}
                                    description={
                                        connectorDisclosure.telemetry === "none"
                                            ? "The connector does not collect analytics or usage telemetry."
                                            : "The connector collects limited telemetry."
                                    }
                                />

                                <Row
                                    theme={theme}
                                    label="Persistent storage"
                                    value={connectorDisclosure.persistentStorage === "none" ? "None" : "Local"}
                                    description={
                                        connectorDisclosure.persistentStorage === "none"
                                            ? "The connector does not persist identifiers or session data."
                                            : "The connector stores limited data locally."
                                    }
                                />

                                <Row
                                    theme={theme}
                                    label="Wallet discovery"
                                    value={connectorDisclosure.discovery.eip6963 === "user_gesture_only" ? "User-initiated" : "Automatic"}
                                    description={
                                        connectorDisclosure.discovery.eip6963 === "user_gesture_only"
                                            ? "Wallet discovery only occurs after a user action."
                                            : "Wallet discovery may occur automatically."
                                    }
                                />

                                <Row
                                    theme={theme}
                                    label="Icon policy"
                                    value={connectorDisclosure.iconPolicy === "data_uri_only" ? "Data URI only" : "Remote allowed"}
                                    description={
                                        connectorDisclosure.iconPolicy === "data_uri_only"
                                            ? "The connector never fetches remote icons."
                                            : "The connector may fetch remote icons."
                                    }
                                />

                                <Row
                                    theme={theme}
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
                                        borderTop: `1px solid ${t.border}`,
                                        fontSize: 12,
                                        color: t.mutedText,
                                    }}
                                >
                                    <strong style={{ color: t.text }}>Notes:</strong>
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
                        <div style={{ padding: 16, fontSize: 14, color: t.mutedText }}>
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
                                                border: `1px solid ${isThisConnected ? t.borderStrong : t.border}`,
                                                background: isThisConnected ? t.cardBg2 : "transparent",
                                                cursor: isConnecting ? "not-allowed" : "pointer",
                                                textAlign: "left",
                                                color: t.text,
                                            }}
                                            onMouseEnter={(e) => {
                                                if (isConnecting) return;
                                                (e.currentTarget as HTMLButtonElement).style.background = t.btnBgHover;
                                            }}
                                            onMouseLeave={(e) => {
                                                if (isConnecting) return;
                                                (e.currentTarget as HTMLButtonElement).style.background = isThisConnected ? t.cardBg2 : "transparent";
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
                                                        background: t.cardBg2,
                                                        border: `1px solid ${t.border}`,
                                                    }}
                                                />
                                            )}

                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div
                                                    style={{
                                                        fontSize: 14,
                                                        fontWeight: 700,
                                                        overflow: "hidden",
                                                        textOverflow: "ellipsis",
                                                        display: "flex",
                                                        gap: 8,
                                                        alignItems: "center",
                                                    }}
                                                >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {w.name}
                          </span>

                                                    {isThisConnected ? (
                                                        <span
                                                            style={{
                                                                fontSize: 11,
                                                                padding: "2px 8px",
                                                                borderRadius: 999,
                                                                border: `1px solid ${t.borderStrong}`,
                                                                color: t.mutedText,
                                                                background: t.pillBg,
                                                                whiteSpace: "nowrap",
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
                                                            color: t.faintText,
                                                            overflow: "hidden",
                                                            textOverflow: "ellipsis",
                                                            whiteSpace: "nowrap",
                                                        }}
                                                    >
                                                        {w.rdns}
                                                    </div>
                                                ) : null}
                                            </div>

                                            <div style={{ fontSize: 12, color: t.faintText }}>
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
                        borderTop: `1px solid ${t.border}`,
                        fontSize: 12,
                        color: t.mutedText,
                    }}
                >
                    Tip: call discovery only on user interaction to reduce fingerprinting.
                </div>
            </div>
        </div>
        </Portal>
    );
}
