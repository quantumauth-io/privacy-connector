import { useContext } from "react";
import { QAContext } from "./QAProvider";

export function useQA() {
    const ctx = useContext(QAContext);
    if (!ctx) {
        throw new Error("useQA must be used within <QAProvider>.");
    }
    return ctx;
}
