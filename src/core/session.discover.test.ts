import { describe, expect, it, vi } from "vitest";
import { createPrivacyFirstConnector } from "./session";
import type { WalletCandidate } from "./types";

vi.mock("./discovery/eip6963", () => ({
    discoverEip6963Wallets: vi.fn(async () => [
        { id: "dup", name: "Dup", provider: { request: async () => null } },
        { id: "uniq", name: "Uniq", provider: { request: async () => null } },
        { id: "dup", name: "DupAgain", provider: { request: async () => null } },
    ]),
}));

describe("discoverWallets + dedupe", () => {
    it("includes quantumAuthCandidate and dedupes by id/rdns/name", async () => {
        const qaCandidate: WalletCandidate = {
            id: "qa",
            name: "QuantumAuth",
            provider: { request: async () => null },
        };

        const connector = createPrivacyFirstConnector({
            enableEip6963: true,
            quantumAuthCandidate: async () => qaCandidate,
        });

        const wallets = await connector.discoverWallets();

        // qa + dup + uniq = 3 after dedupe
        expect(wallets.map((w) => w.id)).toEqual(["qa", "dup", "uniq"]);
    });

    it("handles quantumAuthCandidate throwing (still returns eip6963 list)", async () => {
        const connector = createPrivacyFirstConnector({
            enableEip6963: true,
            quantumAuthCandidate: async () => {
                throw new Error("boom");
            },
        });

        const wallets = await connector.discoverWallets();
        expect(wallets.map((w) => w.id)).toEqual(["dup", "uniq"]);
    });

    it("can disable eip6963 discovery", async () => {
        const connector = createPrivacyFirstConnector({ enableEip6963: false });

        const wallets = await connector.discoverWallets();
        expect(wallets).toEqual([]);
    });
});
