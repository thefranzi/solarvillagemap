// netlify/functions/_store.js
import { join } from 'path';
import { mkdir, writeFile, readFile, readdir } from 'fs/promises';

const root = join(process.cwd(), 'assets');

export function store(name) {
  const dir = join(root, name); // assets/photos or assets/pins

  return {
    async put(key, value) {
      await mkdir(dir, { recursive: true });
      const filePath = join(dir, key);
      // value can be Buffer or string
      await writeFile(filePath, value);
    },
    async get(key) {
      try {
        const buf = await readFile(join(dir, key));
        return buf;
      } catch {
        return null;
      }
    },
    async list() {
      try {
        const files = await readdir(dir);
        const entries = await Promise.all(
          files
            .filter(f => f.toLowerCase().endsWith('.json'))
            .map(async (f) => {
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
