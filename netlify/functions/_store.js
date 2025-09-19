
import { join } from 'path';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';

const root = join(process.cwd(), 'assets');

export function store(name) {
  const dir = join(root, name);

  return {
    async put(key, value) {
      await mkdir(dir, { recursive: true });
      await writeFile(join(dir, key), value);
    },
    async get(key) {
      try {
        return await readFile(join(dir, key));
      } catch {
        return null;
      }
    },
    async list() {
      try {
        const files = await readdir(dir);
        const entries = await Promise.all(
          files.map(async (f) => {
            const v = await readFile(join(dir, f), 'utf8');
            return JSON.parse(v);
          })
        );
        return JSON.stringify(entries);
      } catch {
        return '[]';
      }
    }
  };
}
