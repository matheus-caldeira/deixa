import { headers } from "next/headers";
import { isLoopbackForwardedFor, type RequestOrigin } from "@/modules/identity";

const FORWARDED_FOR = "x-forwarded-for";

export const requestOrigin: RequestOrigin = {
  isLoopback: async () => isLoopbackForwardedFor((await headers()).get(FORWARDED_FOR)),
};
