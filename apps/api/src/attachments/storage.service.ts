import { Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import * as path from 'node:path';

/**
 * Local-filesystem object storage. Works in the all-in-one desktop build (no
 * MinIO/S3 needed); files live under STORAGE_DIR. The interface mirrors what an
 * S3 adapter would expose, so the server deployment can swap in S3 later.
 */
@Injectable()
export class StorageService {
  private readonly dir = process.env.STORAGE_DIR || path.join(process.cwd(), 'storage');

  private full(key: string) {
    return path.join(this.dir, key);
  }

  async save(key: string, data: Buffer): Promise<void> {
    const dest = this.full(key);
    await mkdir(path.dirname(dest), { recursive: true });
    await writeFile(dest, data);
  }

  read(key: string): Promise<Buffer> {
    return readFile(this.full(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.full(key)).catch(() => undefined);
  }
}
