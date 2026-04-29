import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { userApi } from "@services/users";
import type { UserCreateRequest, UserUpdateRequest } from "@services/users";

const QUERY_KEY = "users";

export function useUsersList(params: {
  skip: number;
  limit: number;
  search?: string;
  role_code?: string;
  is_active?: boolean;
}) {
  return useQuery({
    queryKey: [QUERY_KEY, params],
    queryFn: () => userApi.getUsers(params),
    placeholderData: (prev) => prev,
  });
}

export function useCreateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: UserCreateRequest) => userApi.createUser(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useUpdateUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: UserUpdateRequest }) =>
      userApi.updateUser(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteUser() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => userApi.deleteUser(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useBatchDeleteUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (ids: number[]) => userApi.batchDeleteUsers(ids),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useImportUsers() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (file: File) => userApi.importUsers(file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
