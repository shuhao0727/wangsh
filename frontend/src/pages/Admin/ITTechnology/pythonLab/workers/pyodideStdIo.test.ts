import { installPyodideStdIo } from "./pyodideStdIo";

test("installPyodideStdIo 使用 write 逐段转发，保留无换行与空行", async () => {
    const out: string[] = [];
    const err: string[] = [];

    const pyodide = {
        setStdout: jest.fn(),
        setStderr: jest.fn(),
        runPythonAsync: jest.fn(async () => { }),
    };

    const stdio = installPyodideStdIo({
        pyodide,
        onStdout: (s) => out.push(s),
        onStderr: (s) => err.push(s),
    });

    expect(pyodide.setStdout).toHaveBeenCalledWith(expect.objectContaining({ write: expect.any(Function) }));
    expect(pyodide.setStderr).toHaveBeenCalledWith(expect.objectContaining({ write: expect.any(Function) }));

    const stdoutHandler = (pyodide.setStdout as any).mock.calls[0]?.[0] as any;
    const stderrHandler = (pyodide.setStderr as any).mock.calls[0]?.[0] as any;
    expect(typeof stdoutHandler?.write).toBe("function");
    expect(typeof stderrHandler?.write).toBe("function");

    stdoutHandler.write("a");
    stdoutHandler.write("");
    stdoutHandler.write("\n\n");
    stdoutHandler.write("b");
    stderrHandler.write("E1");
    stderrHandler.write("\n");

    expect(out.join("")).toBe("a\n\nb");
    expect(err.join("")).toBe("E1\n");

    await stdio.flush();
    expect(pyodide.runPythonAsync).toHaveBeenCalled();
});

test("嵌套循环输出样例：stdout 分段到达时仍保持顺序与内容一致", () => {
    const out: string[] = [];

    const pyodide = {
        setStdout: jest.fn(),
        setStderr: jest.fn(),
        runPythonAsync: jest.fn(async () => { }),
    };

    installPyodideStdIo({
        pyodide,
        onStdout: (s) => out.push(s),
        onStderr: () => { },
    });

    const stdoutHandler = (pyodide.setStdout as any).mock.calls[0]?.[0] as any;

    const expected = ["0 0", "0 1", "0 2", "1 0", "1 1", "1 2"].join("\n") + "\n";
    stdoutHandler.write("0 0\n0 ");
    stdoutHandler.write("1\n0 2\n1 0\n");
    stdoutHandler.write("1 1\n1 2");
    stdoutHandler.write("\n");

    expect(out.join("")).toBe(expected);
});
