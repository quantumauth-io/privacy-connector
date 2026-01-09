import type { Eip1193Provider, WalletCandidate } from "../types";

// EIP-6963 uses window events to announce multiple injected providers.
// We keep the shapes loose (no extra deps) but type-safe enough.
type AnnounceEvent = CustomEvent<{
    info: { uuid: string; name: string; icon?: string; rdns?: string };
    provider: Eip1193Provider;
}>;

const REQUEST_EVENT = "eip6963:requestProvider";
const ANNOUNCE_EVENT = "eip6963:announceProvider";

/**
 * Discover injected wallets via EIP-6963.
 * Must be user-triggered by the app (call on button click).
 */
export async function discoverEip6963Wallets(timeoutMs = 150): Promise<WalletCandidate[]> {
    if (typeof window === "undefined") return [];

    const found = new Map<string, WalletCandidate>();

    const handler = (event: Event) => {
        const e = event as AnnounceEvent;
        const info = e.detail?.info;
        const provider = e.detail?.provider;
        if (!info?.uuid || !provider) return;

        // icon is typically a data URI; we accept only inline strings
        const candidate: WalletCandidate = {
            id: info.uuid,
            name: info.name ?? "Unknown Wallet",
            provider,
            hints: { isInjected: true },

            ...(info.rdns ? { rdns: info.rdns } : {}),
            ...(info.icon ? { icon: info.icon } : {}),
        };
        found.set(candidate.id, candidate);
    };

    window.addEventListener(ANNOUNCE_EVENT, handler as EventListener);

    try {
        // request providers to announce themselves
        window.dispatchEvent(new Event(REQUEST_EVENT));

        // small wait window for announcements
        await new Promise((r) => setTimeout(r, timeoutMs));
    } finally {
        window.removeEventListener(ANNOUNCE_EVENT, handler as EventListener);
    }

    return [...found.values()];
}
