import { readFile } from 'node:fs/promises';

// The Lakeside client contract from the brief, and the implementation that reads snapshot files.
// Today Lakeside sends files; later it will be an HTTP API, which is a second implementation of `LakesideClient`.

export type FetchError = 'not_found' | 'unreadable' | 'invalid_json';

export type FetchResult =
  | {
    ok: true;
    // Decoded from JSON but otherwise raw: `normalizeSnapshot` checks the shape.
    snapshot: unknown
  }
  | {
    ok: false;
    error: FetchError;
    message: string
  };

export type LakesideClient = {
  // For the file implementation, `source` is a path to a snapshot file.
  fetchSnapshot: (source: string) => Promise<FetchResult>;
};

export const fileClient: LakesideClient = {
  fetchSnapshot: async (source) => {
    let text: string;
    try {
      text = await readFile(source, 'utf8');
    }
    catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      return failure(code === 'ENOENT' ? 'not_found' : 'unreadable', `${source}: ${(error as Error).message}`);
    }

    try {
      return {
        ok: true,
        snapshot: JSON.parse(text),
      };
    }
    catch (error) {
      return failure('invalid_json', `${source}: ${(error as Error).message}`);
    }
  },
};

const failure = (error: FetchError, message: string): FetchResult => {
  return {
    ok: false,
    error,
    message,
  };
};
