import { describe, expect, it } from "vitest";
import { createPrivacyFirstConnector } from "./session";
import type { Eip1193Provider } from "./types";

describe("getConnectorInfo", () => {
    it("uses wallet-provided connector info when available", async () => {
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
                    });
                }

                return Promise.resolve(null);
            },
        };

        const info = await connector.getConnectorInfo(provider);
        expect(info.source).toBe("wallet");
        expect(info.connectorName).toBe("TestWallet");
    });

    it("falls back to inferred info when method is missing", async () => {
        const connector = createPrivacyFirstConnector();

        const provider: Eip1193Provider = {
            request: ({ method }) => {
                if (method === "eth_getConnectorInfo") {
                    return Promise.reject(new Error("method not supported"));
                }
                return Promise.resolve(null);
            },
        };

        const info = await connector.getConnectorInfo(provider, {
            connectorType: "custom",
            connectorName: "Fallback",
            mediation: "direct",
            thirdPartyInfrastructure: false,
            rpcVisibility: "direct",
        });

        expect(info.source).toBe("inferred");
        expect(info.connectorName).toBe("Fallback");
    });
});
