import React, { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** One mounted scope per authenticated identity; never share its client after a switch. */
export function AuthQueryScope({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      // StrictMode replays effects on the same scope. Only retire a genuinely
      // unmounted client; new identities already render with a different client.
      queueMicrotask(() => {
        if (!mounted.current) {
          void client.cancelQueries();
          client.clear();
        }
      });
    };
  }, [client]);

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
