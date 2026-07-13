import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "@services/api";
import { gamesAdminApi, gamesApi } from "@services/it/games";
import { queryKeys } from "./queryKeys";

export type ITGamesListParams = {
  category?: string;
  search?: string;
  page?: number;
  size?: number;
};

export const useITGamesQuery = (params: ITGamesListParams) =>
  useQuery({
    queryKey: queryKeys.itGames.list(params),
    queryFn: () => gamesApi.list(params),
  });

export const useITGameCategoriesQuery = () =>
  useQuery({
    queryKey: queryKeys.itGames.categories(),
    queryFn: gamesApi.categories,
    staleTime: 5 * 60 * 1000,
  });

export const useAdminITGamesQuery = (params: ITGamesListParams) =>
  useQuery({
    queryKey: queryKeys.itGames.adminList(params),
    queryFn: () => gamesAdminApi.list(params),
  });

export const useITGameLogsQuery = (
  gameId: number | null,
  page = 1,
  size = 50,
) =>
  useQuery({
    queryKey: queryKeys.itGames.logs(gameId ?? 0, page, size),
    queryFn: () => gamesAdminApi.logs(gameId!, page, size),
    enabled: gameId !== null,
  });

export const useITGameDownload = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (gameId: number) => {
      const response = await api.client.get<Blob>(
        gamesApi.getDownloadUrl(gameId),
        { responseType: "blob" },
      );
      return response.data;
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({
        queryKey: queryKeys.itGames.all,
      });
    },
  });
};

export const useITGameMutations = () => {
  const queryClient = useQueryClient();
  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: queryKeys.itGames.all });

  return {
    createGame: useMutation({
      mutationFn: gamesAdminApi.create,
      onSuccess: invalidate,
    }),
    updateGame: useMutation({
      mutationFn: ({ id, data }: {
        id: number;
        data: Parameters<typeof gamesAdminApi.update>[1];
      }) => gamesAdminApi.update(id, data),
      onSuccess: invalidate,
    }),
    deleteGame: useMutation({
      mutationFn: gamesAdminApi.delete,
      onSuccess: invalidate,
    }),
  };
};
