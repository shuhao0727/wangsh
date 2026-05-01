import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { DataTablePagination } from "./data-table";

describe("DataTablePagination", () => {
  it("normalizes page size changes and emits exactly one page change", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <DataTablePagination
        currentPage={3}
        totalPages={5}
        total={45}
        pageSize={20}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByLabelText("每页条数"));
    await user.click(await screen.findByRole("option", { name: "10 / 页" }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(1, 10);
  });

  it("does not emit when selecting the current page size", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <DataTablePagination
        currentPage={1}
        totalPages={3}
        total={45}
        pageSize={20}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByLabelText("每页条数"));
    await user.click(await screen.findByRole("option", { name: "20 / 页" }));

    expect(onPageChange).not.toHaveBeenCalled();
  });

  it("clamps next page navigation to the available page range", async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();

    render(
      <DataTablePagination
        currentPage={2}
        totalPages={3}
        total={45}
        pageSize={20}
        pageSizeOptions={[10, 20, 50]}
        onPageChange={onPageChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: "下一页" }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(3, undefined);
  });
});
