import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { queryKeys } from "@/hooks/queries/queryKeys";
import GamesManagerPage from "@/pages/Admin/ITTechnology/GamesManager";
import { GameDetailModal } from "@/pages/ITTechnology/components/GameDetailModal";
import GamesRepoPage from "@/pages/ITTechnology/GamesRepo";
import api from "@/services/api";
import { gamesApi, type GameResource } from "@/services/it/games";
import {
  useAdminITGamesQuery,
  useITGameCategoriesQuery,
  useITGameLogsQuery,
  useITGameMutations,
  useITGamesQuery,
} from "@/hooks/queries/useITGamesQuery";

vi.mock("@/hooks/queries/useITGamesQuery", async (importOriginal) => {
  const actual = await importOriginal<
    typeof import("@/hooks/queries/useITGamesQuery")
  >();
  return {
    ...actual,
    useITGamesQuery: vi.fn(),
    useITGameCategoriesQuery: vi.fn(),
    useAdminITGamesQuery: vi.fn(),
    useITGameLogsQuery: vi.fn(),
    useITGameMutations: vi.fn(),
  };
});

vi.mock("@/pages/ITTechnology/components/GameUploadModal", () => ({
  GameUploadModal: () => null,
}));

vi.mock("@hooks/useAuth", () => ({
  default: () => ({
    isLoggedIn: () => true,
  }),
}));

const failedQuery = {
  data: undefined,
  error: new Error("network unavailable"),
  isError: true,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
};

const categoriesQuery = {
  data: { categories: [] },
  error: null,
  isError: false,
  isFetching: false,
  isLoading: false,
  refetch: vi.fn(),
};

const game: GameResource = {
  id: 7,
  title: "测试游戏",
  description: "用于验证下载",
  category: "益智",
  filename: "test-game.zip",
  file_size: 1024,
  file_mime: "application/zip",
  file_sha256: "abc123",
  icon_url: null,
  download_count: 2,
  is_active: true,
  uploaded_by: 1,
  created_at: "2026-07-12T00:00:00Z",
  updated_at: "2026-07-12T00:00:00Z",
};

const createQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

const renderWithClient = (
  children: React.ReactNode,
  queryClient = createQueryClient(),
) => ({
  queryClient,
  ...render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{children}</MemoryRouter>
    </QueryClientProvider>,
  ),
});

describe("IT game pages", () => {
  beforeEach(() => {
    vi.mocked(useITGamesQuery).mockReturnValue(failedQuery as never);
    vi.mocked(useAdminITGamesQuery).mockReturnValue(failedQuery as never);
    vi.mocked(useITGameCategoriesQuery).mockReturnValue(categoriesQuery as never);
    vi.mocked(useITGameLogsQuery).mockReturnValue({
      data: undefined,
      isLoading: false,
    } as never);
    vi.mocked(useITGameMutations).mockReturnValue({
      deleteGame: { mutateAsync: vi.fn() },
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete (window.URL as unknown as {
      createObjectURL?: (value: Blob) => string;
    }).createObjectURL;
    delete (window.URL as unknown as {
      revokeObjectURL?: (value: string) => void;
    }).revokeObjectURL;
  });

  it("shows a retryable error when the public game list fails", () => {
    renderWithClient(<GamesRepoPage />);

    expect(screen.getByRole("alert")).toHaveTextContent("游戏资源加载失败");
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("shows a retryable error when the admin game list fails", () => {
    renderWithClient(<GamesManagerPage />);

    expect(screen.getByText("游戏资源加载失败")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "重试" })).toBeInTheDocument();
  });

  it("downloads the original blob and refreshes IT game caches and detail", async () => {
    const user = userEvent.setup();
    const downloadBlob = new Blob(["game-data"], {
      type: "application/zip",
    });
    const createObjectURL = vi.fn((_value: Blob) => "blob:test-game");
    const revokeObjectURL = vi.fn();
    Object.defineProperty(window.URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL,
    });
    Object.defineProperty(window.URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL,
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    vi.spyOn(api.client, "get").mockResolvedValueOnce({
      data: downloadBlob,
    } as never);
    vi.spyOn(gamesApi, "get").mockResolvedValueOnce({
      ...game,
      download_count: 3,
    });

    const queryClient = createQueryClient();
    const invalidateQueries = vi.spyOn(queryClient, "invalidateQueries");
    renderWithClient(
      <GameDetailModal open onClose={vi.fn()} game={game} />,
      queryClient,
    );

    await user.click(screen.getByRole("button", { name: "下载" }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledOnce();
    });
    expect(createObjectURL.mock.calls[0][0]).toBe(downloadBlob);
    expect(invalidateQueries).toHaveBeenCalledWith({
      queryKey: queryKeys.itGames.all,
    });
    expect(await screen.findByText("3 次下载")).toBeInTheDocument();
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:test-game");
  });
});
