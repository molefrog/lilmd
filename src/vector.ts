/**
 * Vector index backed by libSQL. Stores section embeddings and supports
 * approximate nearest-neighbor search via libSQL's built-in vector extensions
 * (DiskANN). The index is a single local .db file — no server needed.
 */

import { createHash } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type IndexedSection = {
  file: string;
  title: string;
  level: number;
  line_start: number;
  line_end: number;
  /** JSON-encoded ancestor path. */
  path: string;
  content_hash: string;
};

export type SearchResult = {
  file: string;
  title: string;
  level: number;
  line_start: number;
  line_end: number;
  path: string[];
  distance: number;
};

export type VectorIndex = {
  init(dimensions: number): Promise<void>;
  removeByFile(file: string): Promise<void>;
  insert(entry: IndexedSection, embedding: Float32Array): Promise<void>;
  search(query: Float32Array, topK: number): Promise<SearchResult[]>;
  hasData(): Promise<boolean>;
  close(): void;
};

export async function openIndex(dbPath: string): Promise<VectorIndex> {
  let createClient: (typeof import("@libsql/client"))["createClient"];
  try {
    ({ createClient } = await import("@libsql/client"));
  } catch {
    throw new Error(
      "lilmd: @libsql/client is not installed.\n" +
        "Run: npm install @libsql/client",
    );
  }

  mkdirSync(dirname(dbPath), { recursive: true });
  const db = createClient({ url: `file:${dbPath}` });

  return {
    async init(dimensions: number) {
      await db.execute(`
        CREATE TABLE IF NOT EXISTS sections (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          file TEXT NOT NULL,
          title TEXT NOT NULL,
          level INTEGER NOT NULL,
          line_start INTEGER NOT NULL,
          line_end INTEGER NOT NULL,
          path TEXT NOT NULL DEFAULT '[]',
          content_hash TEXT NOT NULL,
          embedding F32_BLOB(${dimensions})
        )
      `);
      await db.execute(`
        CREATE INDEX IF NOT EXISTS sections_vec_idx
        ON sections(libsql_vector_idx(embedding, 'metric=cosine'))
      `);
      await db.execute(`
        CREATE INDEX IF NOT EXISTS sections_file_idx
        ON sections(file)
      `);
    },

    async removeByFile(file: string) {
      await db.execute({ sql: "DELETE FROM sections WHERE file = ?", args: [file] });
    },

    async insert(entry: IndexedSection, embedding: Float32Array) {
      const vecStr = "[" + Array.from(embedding).join(",") + "]";
      await db.execute({
        sql: `INSERT INTO sections
                (file, title, level, line_start, line_end, path, content_hash, embedding)
              VALUES (?, ?, ?, ?, ?, ?, ?, vector(?))`,
        args: [
          entry.file, entry.title, entry.level,
          entry.line_start, entry.line_end, entry.path,
          entry.content_hash, vecStr,
        ],
      });
    },

    async search(query: Float32Array, topK: number): Promise<SearchResult[]> {
      const vecStr = "[" + Array.from(query).join(",") + "]";
      const result = await db.execute({
        sql: `SELECT
                s.file, s.title, s.level, s.line_start, s.line_end, s.path,
                vector_distance_cos(s.embedding, vector(?)) AS distance
              FROM vector_top_k('sections_vec_idx', vector(?), ?) AS vt
              JOIN sections AS s ON s.rowid = vt.id
              ORDER BY distance`,
        args: [vecStr, vecStr, topK],
      });
      return result.rows.map((row) => ({
        file: row.file as string,
        title: row.title as string,
        level: row.level as number,
        line_start: row.line_start as number,
        line_end: row.line_end as number,
        path: JSON.parse(row.path as string) as string[],
        distance: row.distance as number,
      }));
    },

    async hasData(): Promise<boolean> {
      try {
        const r = await db.execute("SELECT COUNT(*) AS cnt FROM sections");
        return ((r.rows[0]?.cnt as number) ?? 0) > 0;
      } catch {
        return false;
      }
    },

    close() { db.close(); },
  };
}

export function hashContent(content: string): string {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}
