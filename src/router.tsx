import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";
import { createIsomorphicFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

const readCspNonce = createIsomorphicFn()
  .server(() => getRequestHeader("x-mugui-csp-nonce"))
  .client(() => document.querySelector<HTMLMetaElement>('meta[name="csp-nonce"]')?.content);

export const getRouter = () => {
  const queryClient = new QueryClient();
  const nonce = readCspNonce();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    ssr: nonce ? { nonce } : {},
  });

  return router;
};
