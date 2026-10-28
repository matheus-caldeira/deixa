import type { PGlite } from "@electric-sql/pglite";
import { OpfsFileStorage } from "./opfs-storage";

const BACKUP_FOLDER = "backups";
const BACKUP_FILE = "before-migration.tar.gz";

const backups = new OpfsFileStorage(BACKUP_FOLDER);

export async function backupBeforeMigration(client: PGlite): Promise<void> {
  const dump = await client.dumpDataDir("gzip");
  await backups.write(BACKUP_FILE, new Uint8Array(await dump.arrayBuffer()));
}
