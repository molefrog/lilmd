/**
 * Embedding model loader — lazy-loads @huggingface/transformers and downloads
 * all-MiniLM-L6-v2 (quantized, ~23MB) on first use.
 *
 * The model is cached by the transformers library in ~/.cache/huggingface/.
 * Subsequent loads are near-instant.
 */

export const DIMENSIONS = 384;
const MODEL_ID = "Xenova/all-MiniLM-L6-v2";

export type Embedder = {
  embed(texts: string[]): Promise<Float32Array[]>;
  dimensions: number;
};

export async function loadEmbedder(opts?: {
  log?: (msg: string) => void;
}): Promise<Embedder> {
  const log = opts?.log ?? (() => {});

  let pipeline: (typeof import("@huggingface/transformers"))["pipeline"];
  try {
    ({ pipeline } = await import("@huggingface/transformers"));
  } catch {
    throw new Error(
      "lilmd: @huggingface/transformers is not installed.\n" +
        "Run: npm install @huggingface/transformers",
    );
  }

  log(`Loading model ${MODEL_ID}...`);
  const extractor = await pipeline("feature-extraction", MODEL_ID, {
    dtype: "q8",
  });
  log("Model ready.");

  return {
    dimensions: DIMENSIONS,
    async embed(texts: string[]): Promise<Float32Array[]> {
      const results: Float32Array[] = [];
      for (const text of texts) {
        const output = await extractor(text, {
          pooling: "mean",
          normalize: true,
        });
        results.push(new Float32Array(output.data as Float32Array));
      }
      return results;
    },
  };
}
