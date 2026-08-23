import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDiffPreview } from "../common/file-utils";

test("buildDiffPreview splits two distant edits into separate hunks", () => {
  const original = Array.from({ length: 2500 }, (_, index) => `line${index + 1}`).join("\n");
  const updatedLines = original.split("\n");
  updatedLines[19] = "changed-20";
  updatedLines[1999] = "changed-2000";

  const preview = buildDiffPreview("/workspace/large.txt", original, updatedLines.join("\n"));
  assert.ok(preview);

  assert.match(preview, /@@ -20,1 \+20,1 @@/);
  assert.match(preview, /@@ -2000,1 \+2000,1 @@/);

  const changedLines = preview.split("\n").filter((line) => line.startsWith("-") || line.startsWith("+"));
  assert.deepEqual(changedLines, ["-line20", "+changed-20", "-line2000", "+changed-2000"]);

  assert.doesNotMatch(preview, /^-line21$/m);
  assert.doesNotMatch(preview, /^-line1999$/m);
});

test("buildDiffPreview keeps a single hunk for one contiguous edit", () => {
  const original = ["alpha", "beta", "gamma"].join("\n");
  const updated = ["alpha", "BETA", "gamma"].join("\n");

  const preview = buildDiffPreview("/workspace/small.txt", original, updated);
  assert.ok(preview);

  assert.equal((preview.match(/^@@ /gm) ?? []).length, 1);
  assert.match(preview, /@@ -2,1 \+2,1 @@/);
  assert.match(preview, /-beta/);
  assert.match(preview, /\+BETA/);
});

test("buildDiffPreview returns null when the file did not change", () => {
  const content = "one\ntwo\n";
  assert.equal(buildDiffPreview("/workspace/same.txt", content, content), null);
});
