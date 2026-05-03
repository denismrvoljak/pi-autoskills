#!/usr/bin/env -S node --experimental-strip-types
import { runCli } from "../src/cli.ts";

runCli().then((code) => {
  process.exitCode = code;
});
