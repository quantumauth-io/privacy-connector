import React, { useEffect } from "react";
import type { WalletCandidate } from "../../core"; // adjust import if needed

export function WalletSelectModal(props: {
    open: boolean;
    title?: string;
    wallets: WalletCandidate[];
    isConnecting?: boolean;
    error: string | null;

    onClose: () => void;
    onSelect: (wallet: WalletCandidate) => void;
}) {
    const { open, title, wallets, isConnecting, error, onClose, onSelect } = props;

    useEffect(() => {
        if (!open) return;
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose]);

    if (!open) return null;

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={title ?? "Select a wallet"}
            onMouseDown={(e) => {
                // click-outside closes
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

                    {error ? (
                        <div style={{ marginTop: 10, fontSize: 13, color: "#b00020" }}>{error}</div>
                    ) : null}

                    <div style={{ marginTop: 10, fontSize: 13, color: "rgba(0,0,0,0.65)" }}>
                        Only locally detected EIP-6963 wallets are shown.
                    </div>
                </div>

                <div style={{ padding: 8 }}>
                    {wallets.length === 0 ? (
                        <div style={{ padding: 16, fontSize: 14, color: "rgba(0,0,0,0.65)" }}>
                            No EIP-6963 wallets detected. Install a compatible wallet and try again.
                        </div>
                    ) : (
                        <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
                            {wallets.map((w) => (
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
                                            border: "1px solid rgba(0,0,0,0.08)",
                                            background: "white",
                                            cursor: isConnecting ? "not-allowed" : "pointer",
                                            textAlign: "left",
                                        }}
                                    >
                                        {w.icon ? (
                                            <img
                                                src={w.icon}
                                                alt=""
                                                width={28}
                                                height={28}
                                                style={{ borderRadius: 8 }}
                                            />
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
                                            <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis" }}>
                                                {w.name}
                                            </div>
                                            {w.rdns ? (
                                                <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                                    {w.rdns}
                                                </div>
                                            ) : null}
                                        </div>

                                        <div style={{ fontSize: 12, color: "rgba(0,0,0,0.55)" }}>
                                            {isConnecting ? "Connecting…" : "Connect"}
                                        </div>
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                <div style={{ padding: 16, borderTop: "1px solid rgba(0,0,0,0.08)", fontSize: 12, color: "rgba(0,0,0,0.6)" }}>
                    Tip: call discovery only on user interaction to reduce fingerprinting.
                </div>
            </div>
        </div>
    );
}
