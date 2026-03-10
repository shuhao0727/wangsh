export type PyodideStdIoInstaller = {
    flush: () => Promise<void>;
};

export function installPyodideStdIo(params: {
    pyodide: any;
    onStdout: (s: string) => void;
    onStderr: (s: string) => void;
}): PyodideStdIoInstaller {
    const { pyodide, onStdout, onStderr } = params;
    const decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;

    const normalize = (v: any): { text: string; len: number } => {
        if (typeof v === "string") return { text: v, len: v.length };
        try {
            if (v instanceof Uint8Array) {
                const text = decoder ? decoder.decode(v) : Array.from(v).map((b) => String.fromCharCode(b)).join("");
                return { text, len: v.byteLength };
            }
        } catch { }
        try {
            if (v instanceof ArrayBuffer) {
                const u8 = new Uint8Array(v);
                const text = decoder ? decoder.decode(u8) : Array.from(u8).map((b) => String.fromCharCode(b)).join("");
                return { text, len: u8.byteLength };
            }
        } catch { }
        try {
            if (v && typeof v === "object" && v.buffer instanceof ArrayBuffer && Number.isFinite(v.byteLength)) {
                const u8 = new Uint8Array(v.buffer, v.byteOffset || 0, v.byteLength);
                const text = decoder ? decoder.decode(u8) : Array.from(u8).map((b) => String.fromCharCode(b)).join("");
                return { text, len: u8.byteLength };
            }
        } catch { }
        const text = String(v ?? "");
        return { text, len: text.length };
    };

    try {
        if (pyodide?.setStdout) {
            pyodide.setStdout({
                write: (s: any) => {
                    const out = normalize(s);
                    onStdout(out.text);
                    return out.len;
                },
            });
        }
    } catch { }

    try {
        if (pyodide?.setStderr) {
            pyodide.setStderr({
                write: (s: any) => {
                    const out = normalize(s);
                    onStderr(out.text);
                    return out.len;
                },
            });
        }
    } catch { }

    return {
        flush: async () => {
            try {
                await pyodide?.runPythonAsync?.("import sys\nsys.stdout.flush()\nsys.stderr.flush()\n");
            } catch { }
        },
    };
}
