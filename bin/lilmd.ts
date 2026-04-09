#!/usr/bin/env node
import { run } from "../src/cli";

const result = await run(process.argv.slice(2));
if (result.stdout) {
  process.stdout.write(
    result.stdout.endsWith("\n") ? result.stdout : result.stdout + "\n",
  );
}
if (result.stderr) process.stderr.write(result.stderr);
process.exit(result.code);
