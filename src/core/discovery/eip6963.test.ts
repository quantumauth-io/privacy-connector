import { describe, expect, it } from "vitest";
import { discoverEip6963Wallets } from "./eip6963";

type AnnounceDetail = {
    info: { uuid: string; name?: string; rdns?: string; icon?: string };
    provider: { request: (args: any) => Promise<any> };
};

function announceProvider(detail: AnnounceDetail) {
    window.dispatchEvent(new CustomEvent("eip6963:announceProvider", { detail }));
}

describe("discoverEip6963Wallets", () => {
    it("returns [] when no wallets announce", async () => {
        const wallets = await discoverEip6963Wallets(20);
        expect(wallets).toEqual([]);
    });

    it("collects announced providers", async () => {
        const p = { request: () => Promise.resolve(null) };

        const promise = discoverEip6963Wallets(50);

        announceProvider({
            info: { uuid: "a", name: "Wallet A", rdns: "com.wallet.a" },
            provider: p,
        });

        const wallets = await promise;
        expect(wallets).toHaveLength(1);

        const wallet = wallets[0]!;
        expect(wallet.id).toBe("a");
        expect(wallet.name).toBe("Wallet A");
        expect(wallet.rdns).toBe("com.wallet.a");
    });

    it("dedupes by uuid", async () => {
        const p = { request: () => Promise.resolve(null) };

        const promise = discoverEip6963Wallets(50);

        announceProvider({ info: { uuid: "dup", name: "One" }, provider: p });
        announceProvider({ info: { uuid: "dup", name: "Two" }, provider: p });

        const wallets = await promise;
        expect(wallets).toHaveLength(1);

        const wallet = wallets[0]!;
        expect(wallet.id).toBe("dup");
        // Optional: confirm it kept the last or first (depends on your implementation)
        // expect(wallet.name).toBe("Two");
    });
});
