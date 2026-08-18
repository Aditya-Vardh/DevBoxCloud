import type { Request } from "express";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function isLoopbackAddress(address: string | undefined) {
  return Boolean(
    address &&
      (address === "127.0.0.1" ||
        address === "::1" ||
        address === "::ffff:127.0.0.1")
  );
}

export function isLocalAuthRequest(req: Request) {
  const host = req.hostname.toLowerCase();
  return (
    process.env.NODE_ENV !== "production" &&
    LOCAL_HOSTS.has(host) &&
    isLoopbackAddress(req.socket.remoteAddress)
  );
}
