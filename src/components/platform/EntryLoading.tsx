import { useEffect, useRef, useState } from "react";
import { useLocation } from "@tanstack/react-router";
import { InitialLoading } from "@/components/ui/MuguiLoading";

const authentication = (path: string) => path === "/login" || path === "/acesso";
export function EntryLoading() {
  const pathname = useLocation({ select: (location) => location.pathname });
  const previous = useRef(pathname);
  const [entry, setEntry] = useState(0);
  useEffect(() => {
    if (
      authentication(pathname) &&
      !authentication(previous.current) &&
      !previous.current.startsWith("/interno")
    )
      setEntry((value) => value + 1);
    previous.current = pathname;
  }, [pathname]);
  // The root stays mounted on SPA navigation. Only a real document load or entry
  // into authentication creates a new instance. Requests and clicks never drive it.
  return <InitialLoading key={entry} />;
}
