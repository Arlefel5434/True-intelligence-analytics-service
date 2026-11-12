import {
  api,
  ApiError,
  type AuthProfile,
  type LoginCredentials,
} from '@tia/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, useContext, type PropsWithChildren } from 'react';

type AuthContextValue = {
  user: AuthProfile | undefined;
  loading: boolean;
  error: Error | null;
  login(credentials: LoginCredentials): Promise<AuthProfile>;
  logout(): Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const sessionKey = ['session'] as const;

export function AuthProvider({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const session = useQuery({
    queryKey: sessionKey,
    queryFn: api.me,
    retry: false,
  });
  const loginMutation = useMutation({ mutationFn: api.login });
  const logoutMutation = useMutation({ mutationFn: api.logout });

  return (
    <AuthContext.Provider
      value={{
        user: session.data,
        loading: session.isLoading,
        error:
          session.error instanceof ApiError && session.error.status === 401
            ? null
            : session.error,
        login: async (credentials) => {
          const user = await loginMutation.mutateAsync(credentials);
          queryClient.setQueryData(sessionKey, user);
          return user;
        },
        logout: async () => {
          try {
            await logoutMutation.mutateAsync();
          } finally {
            queryClient.clear();
            queryClient.setQueryData(sessionKey, undefined);
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// Fast refresh keeps the provider state; this hook intentionally shares its context.
// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
