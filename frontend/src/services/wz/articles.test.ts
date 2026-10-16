import { afterEach, describe, expect, it, vi } from "vitest";

import api from "@/services/api";
import { articleApi } from "./articles";

describe("articleApi.listArticles", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes the admin search term with the same pagination request", async () => {
    const get = vi.spyOn(api.client, "get").mockResolvedValue({
      data: {
        total: 0,
        articles: [],
        page: 2,
        size: 10,
        total_pages: 1,
      },
    } as never);

    await articleApi.listArticles({
      page: 2,
      size: 10,
      published_only: false,
      include_relations: true,
      search: "python",
    });

    expect(get).toHaveBeenCalledWith("/articles", {
      params: expect.objectContaining({
        page: 2,
        size: 10,
        search: "python",
      }),
    });
  });
});
