import type { ComponentProps } from "react";
import { useRouter } from "@tanstack/react-router";

// Keep native anchor semantics (external links, hash scrolling, downloads and new tabs),
// but use the existing router for same-document application navigation.
export function AppLink({ href, onClick, ...props }: ComponentProps<"a">) {
  const router = useRouter({ warn: false });
  return (
    <a
      {...props}
      href={href}
      onClick={(event) => {
        onClick?.(event);
        if (
          !router ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey ||
          props.download !== undefined ||
          (props.target && props.target !== "_self") ||
          !href?.startsWith("/") ||
          href.startsWith("//")
        )
          return;
        const destination = new URL(href, window.location.origin);
        if (
          destination.pathname === window.location.pathname &&
          destination.search === window.location.search &&
          destination.hash
        )
          return;
        event.preventDefault();
        void router.navigate({ href });
      }}
    />
  );
}
