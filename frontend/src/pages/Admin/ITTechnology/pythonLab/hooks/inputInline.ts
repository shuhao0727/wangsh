export function extractInputPrompts(src: string): string[] {
    const pattern = /input\s*\(([^)]*)\)/g;
    const prompts: string[] = [];
    const resolvePrompt = (promptExpr: string): string => {
        const raw = String(promptExpr || "").trim();
        if (!raw) return "input: ";
        const m = raw.match(/^(['"`])([\s\S]*)\1$/);
        if (m) return m[2];
        return "input: ";
    };
    src.replace(pattern, (_m, promptExpr) => {
        prompts.push(resolvePrompt(promptExpr));
        return _m;
    });
    return prompts;
}

export function promptAndInlineInputs(
    src: string,
    inputQueue: string[]
): { ok: true; code: string; count: number } | { ok: false; error: string; nextPrompt: string; required: number; provided: number } {
    const pattern = /input\s*\(([^)]*)\)/g;
    const prompts = extractInputPrompts(src);
    let count = 0;
    let insufficient = false;
    let nextPrompt = "input: ";
    const replaced = src.replace(pattern, (_m, promptExpr) => {
        count += 1;
        const value = inputQueue[count - 1];
        if (value === undefined) {
            insufficient = true;
            nextPrompt = prompts[count - 1] ?? "input: ";
            return _m;
        }
        return JSON.stringify(value);
    });
    if (insufficient) {
        return {
            ok: false,
            error: `input 数量不足：代码需要 ${count} 个输入，请在终端继续输入`,
            nextPrompt,
            required: count,
            provided: inputQueue.length,
        };
    }
    return { ok: true, code: replaced, count };
}
