import { describe, expect, it } from "vitest";
import { createPrivacyFirstConnector } from "./session";

describe("getConnectorDisclosure", () => {
    it("returns connector-authored disclosure", () => {
        const connector = createPrivacyFirstConnector();
        const d = connector.getConnectorDisclosure();

        expect(d.source).toBe("connector");
        expect(d.networkRequests).toBe("none");
        expect(d.telemetry).toBe("none");
        expect(d.persistentStorage).toBe("none");
        expect(d.discovery.eip6963).toBe("user_gesture_only");
        expect(d.discovery.remoteCalls).toBe(false);
        expect(d.iconPolicy).toBe("data_uri_only");
        expect(d.logs).toBe("local_only");
        expect(Array.isArray(d.notes)).toBe(true);
    });
});
