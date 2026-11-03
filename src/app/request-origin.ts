import { headers } from "next/headers";
import { isLoopbackRequest, type RequestOrigin } from "@/modules/identity";

const FORWARDED_FOR = "x-forwarded-for";
const HOST = "host";

export const requestOrigin: RequestOrigin = {
  isLoopback: async () => {
    const incoming = await headers();
    return isLoopbackRequest({ forwardedFor: incoming.get(FORWARDED_FOR), host: incoming.get(HOST) });
  },
};
