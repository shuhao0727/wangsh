import { extractInputPrompts, promptAndInlineInputs } from "./inputInline";

test("extractInputPrompts returns prompts in order", () => {
    const prompts = extractInputPrompts("a=input('shuru:')\nb=input()\n");
    expect(prompts).toEqual(["shuru:", "input: "]);
});

test("promptAndInlineInputs replaces input calls with queue values", () => {
    const result = promptAndInlineInputs("n = input('请输入')\nprint(n)\n", ["7"]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.count).toBe(1);
    expect(result.code).toContain('n = "7"');
});

test("promptAndInlineInputs fails when queue is insufficient", () => {
    const result = promptAndInlineInputs("x = input('shuru:')\nprint(x)\n", []);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.nextPrompt).toBe("shuru:");
    expect(result.required).toBe(1);
    expect(result.provided).toBe(0);
});
