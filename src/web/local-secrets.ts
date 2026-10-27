import { bytesToBase64 } from "@/shared/base64";
import { OpfsFileStorage } from "./opfs-storage";

const SECRETS_FOLDER = "local";
const SESSION_FILE = "session.txt";
const MASTER_KEY_FILE = "master-key.txt";
const MASTER_KEY_BYTES = 32;

const store = new OpfsFileStorage(SECRETS_FOLDER);
const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function readText(name: string): Promise<string | null> {
  const bytes = await store.read(name);
  const text = bytes ? decoder.decode(bytes).trim() : "";
  return text.length > 0 ? text : null;
}

export async function loadMasterKey(): Promise<string> {
  const existing = await readText(MASTER_KEY_FILE);
  if (existing) return existing;
  const created = bytesToBase64(crypto.getRandomValues(new Uint8Array(MASTER_KEY_BYTES)));
  await store.write(MASTER_KEY_FILE, encoder.encode(created));
  return created;
}

export const localSession = {
  read: () => readText(SESSION_FILE),
  write: (token: string) => store.write(SESSION_FILE, encoder.encode(token)),
  clear: () => store.write(SESSION_FILE, new Uint8Array()),
};
