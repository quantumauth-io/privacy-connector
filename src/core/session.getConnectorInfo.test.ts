import { describe, expect, it } from "vitest";
import { createPrivacyFirstConnector } from "./session";
import type { Eip1193Provider } from "./types";

describe("getConnectorInfo", () => {
    it("uses wallet-provided connector info when available (and injects id)", async () => {
        const connector = createPrivacyFirstConnector();

        const provider: Eip1193Provider = {
            request: ({ method, params }) => {
                void params;

                if (method === "eth_getConnectorInfo") {
                    return Promise.resolve({
                        connectorType: "injected",
                        connectorName: "TestWallet",
                        mediation: "direct",
                        thirdPartyInfrastructure: false,
                        rpcVisibility: "direct",
                        // NOTE: do NOT include id/source here — connector injects them
                    });
                }

                return Promise.resolve(null);
            },
        };

        const info = await connector.getConnectorInfo(provider, "test-wallet-id");

        expect(info.source).toBe("wallet");
        expect(info.id).toBe("test-wallet-id");
        expect(info.connectorName).toBe("TestWallet");
        expect(info.connectorType).toBe("injected");
        expect(info.mediation).toBe("direct");
        expect(info.rpcVisibility).toBe("direct");
        expect(info.thirdPartyInfrastructure).toBe(false);
    });

    it("falls back to inferred info when method is missing (and injects id)", async () => {
        const connector = createPrivacyFirstConnector();

        const provider: Eip1193Provider = {
            request: ({ method }) => {
                if (method === "eth_getConnectorInfo") {
                    return Promise.reject(new Error("method not supported"));
                }
                return Promise.resolve(null);
            },
        };

        const info = await connector.getConnectorInfo(provider, "fallback-wallet-id", {
            connectorType: "custom",
            connectorName: "Fallback",
            mediation: "direct",
            thirdPartyInfrastructure: false,
            rpcVisibility: "direct",
        });

        expect(info.source).toBe("inferred");
        expect(info.id).toBe("fallback-wallet-id");
        expect(info.connectorName).toBe("Fallback");
        expect(info.connectorType).toBe("custom");
    });
});
