import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@services/users";
import type { UserCreateRequest, UserUpdateRequest } from "@services/users";
import { queryKeys } from "./queryKeys";

export function useUsersList(params: {
  skip: number;
  limit: number;
  search?: string;
  role_code?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: queryKeys.users.list(params),
    queryFn: () => userApi.getUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useUsersStats() {
  return useQuery({
    queryKey: [...queryKeys.users.all, "stats"] as const,
    queryFn: () => userApi.getUsersStats(),
    staleTime: 60_000,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateRequest) => userApi.createUser(data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdateRequest }) =>
      userApi.updateUser(id, data),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => userApi.deleteUser(id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useBatchDeleteUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => userApi.batchDeleteUsers(ids),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}

export function useImportUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => userApi.importUsers(file),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
    },
  });
}
