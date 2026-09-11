import { vi } from "vitest";
import React, { useEffect } from "react";
import { render, screen } from "@testing-library/react";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { TerminalTabContent } from "./TerminalTabContent";
import { canFocusTerminal } from "../terminalVisibility";

test("backend terminal survives tab switches without exposing or focusing its background input", () => {
  const mount = vi.fn();
  const unmount = vi.fn();
  function Terminal() {
    useEffect(() => { mount(); return unmount; }, []);
    return <textarea data-testid="terminal-input" defaultValue="Name? " />;
  }
  const view = (tab: string) => <Tabs value={tab}>
    <TerminalTabContent active={tab === "terminal"} keepConnected><Terminal /></TerminalTabContent>
    <TabsContent value="debug">Debugger</TabsContent>
  </Tabs>;
  const { rerender, unmount: dispose } = render(view("debug"));
  const input = screen.getByTestId("terminal-input");
  expect(mount).toHaveBeenCalledTimes(1);
  expect(canFocusTerminal(input)).toBe(false);
  expect(input.closest('[data-state="inactive"]')).toHaveClass("invisible");
  rerender(view("terminal"));
  expect(screen.getByTestId("terminal-input")).toBe(input);
  expect(canFocusTerminal(input)).toBe(true);
  expect(input).toHaveValue("Name? ");
  rerender(view("debug"));
  expect(canFocusTerminal(input)).toBe(false);
  expect(unmount).not.toHaveBeenCalled();
  dispose();
  expect(unmount).toHaveBeenCalledTimes(1);
  expect(canFocusTerminal(input)).toBe(false);
});

test("local terminal keeps the existing lazy tab lifecycle", () => {
  render(<Tabs value="debug"><TerminalTabContent active={false} keepConnected={false}>
    <textarea data-testid="local-input" />
  </TerminalTabContent></Tabs>);
  expect(screen.queryByTestId("local-input")).not.toBeInTheDocument();
});
