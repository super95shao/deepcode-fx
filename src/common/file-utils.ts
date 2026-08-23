import * as fs from "fs";
import * as path from "path";
import type { FileState, FileLineEnding } from "./state";

export type FileReadMetadata = {
  content: string;
  encoding: BufferEncoding;
  lineEndings: FileLineEnding;
  timestamp: number;
};

export function normalizeContent(value: string): string {
  return value.replace(/\r\n/g, "\n");
}

export function detectLineEndings(value: string): FileLineEnding {
  return value.includes("\r\n") ? "CRLF" : "LF";
}

export function detectEncoding(buffer: Buffer): BufferEncoding {
  if (buffer.length >= 2 && buffer[0] === 0xff && buffer[1] === 0xfe) {
    return "utf16le";
  }

  return "utf8";
}

export function readTextFileWithMetadata(filePath: string): FileReadMetadata {
  const buffer = fs.readFileSync(filePath);
  const stat = fs.statSync(filePath);
  const encoding = detectEncoding(buffer);
  const raw = buffer.toString(encoding);

  return {
    content: normalizeContent(raw),
    encoding,
    lineEndings: detectLineEndings(raw),
    timestamp: Math.floor(stat.mtimeMs),
  };
}

export function writeTextFile(
  filePath: string,
  content: string,
  encoding: BufferEncoding,
  lineEndings: FileLineEnding
): number {
  const normalized = normalizeContent(content);
  const toWrite = lineEndings === "CRLF" ? normalized.replace(/\n/g, "\r\n") : normalized;
  fs.writeFileSync(filePath, toWrite, { encoding });
  return Buffer.byteLength(toWrite, encoding === "utf16le" ? "utf16le" : "utf8");
}

export function ensureParentDirectory(filePath: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export function hasFileChangedSinceState(filePath: string, state: FileState): boolean {
  const current = readTextFileWithMetadata(filePath);
  if (current.timestamp <= state.timestamp) {
    return false;
  }

  const isFullRead = !state.isPartialView && typeof state.offset === "undefined" && typeof state.limit === "undefined";

  return !(isFullRead && current.content === state.content);
}

type DiffLineOp = {
  kind: "equal" | "delete" | "insert";
  oldIndex: number | null;
  newIndex: number | null;
  line: string;
};

const DIFF_CONTEXT_LINES = 1;
const MAX_DIFF_TRACE_CELLS = 8_000_000;

/**
 * Myers O((N+M)D) line diff. Returns null when the edit distance would make
 * the trace too large; the caller then falls back to the legacy single-hunk
 * preview instead of consuming unbounded memory.
 */
function diffLines(oldLines: string[], newLines: string[]): DiffLineOp[] | null {
  const n = oldLines.length;
  const m = newLines.length;
  const max = n + m;
  const offset = max;
  const v = new Int32Array(2 * max + 1);
  const trace: Int32Array[] = [];
  let reached = 0;
  let found = false;

  for (let d = 0; d <= max; d += 1) {
    if ((d + 1) * (2 * max + 1) > MAX_DIFF_TRACE_CELLS) {
      return null;
    }
    trace.push(v.slice());

    for (let k = -d; k <= d; k += 2) {
      let x: number;
      if (k === -d || (k !== d && v[offset + k - 1]! < v[offset + k + 1]!)) {
        x = v[offset + k + 1]!;
      } else {
        x = v[offset + k - 1]! + 1;
      }

      let y = x - k;
      while (x < n && y < m && oldLines[x] === newLines[y]) {
        x += 1;
        y += 1;
      }
      v[offset + k] = x;

      if (x >= n && y >= m) {
        found = true;
        reached = d;
        break;
      }
    }

    if (found) {
      break;
    }
  }

  if (!found) {
    return null;
  }

  const ops: DiffLineOp[] = [];
  let x = n;
  let y = m;
  for (let d = reached; d > 0; d -= 1) {
    const snapshot = trace[d]!;
    const k = x - y;
    let previousK: number;
    if (k === -d || (k !== d && snapshot[offset + k - 1]! < snapshot[offset + k + 1]!)) {
      previousK = k + 1;
    } else {
      previousK = k - 1;
    }

    const previousX = snapshot[offset + previousK]!;
    const previousY = previousX - previousK;

    while (x > previousX && y > previousY) {
      x -= 1;
      y -= 1;
      ops.push({ kind: "equal", oldIndex: x, newIndex: y, line: oldLines[x]! });
    }

    if (x === previousX) {
      y -= 1;
      ops.push({ kind: "insert", oldIndex: null, newIndex: y, line: newLines[y]! });
    } else {
      x -= 1;
      ops.push({ kind: "delete", oldIndex: x, newIndex: null, line: oldLines[x]! });
    }
  }

  while (x > 0 && y > 0 && oldLines[x - 1] === newLines[y - 1]) {
    x -= 1;
    y -= 1;
    ops.push({ kind: "equal", oldIndex: x, newIndex: y, line: oldLines[x]! });
  }

  ops.reverse();
  return ops;
}

type HunkRange = {
  start: number;
  end: number;
  oldStart: number;
  newStart: number;
  oldChanged: number;
  newChanged: number;
};

function buildHunkRanges(ops: DiffLineOp[]): HunkRange[] {
  const changedRuns: Array<{ start: number; end: number }> = [];
  let runStart = -1;

  ops.forEach((op, index) => {
    if (op.kind === "equal") {
      if (runStart >= 0) {
        changedRuns.push({ start: runStart, end: index - 1 });
        runStart = -1;
      }
    } else if (runStart < 0) {
      runStart = index;
    }
  });

  if (runStart >= 0) {
    changedRuns.push({ start: runStart, end: ops.length - 1 });
  }

  const mergedRuns: Array<{ start: number; end: number }> = [];
  for (const run of changedRuns) {
    const expanded = {
      start: Math.max(0, run.start - DIFF_CONTEXT_LINES),
      end: Math.min(ops.length - 1, run.end + DIFF_CONTEXT_LINES),
    };
    const previous = mergedRuns[mergedRuns.length - 1];
    if (previous && expanded.start <= previous.end + 1) {
      previous.end = Math.max(previous.end, expanded.end);
    } else {
      mergedRuns.push(expanded);
    }
  }

  return mergedRuns.map((run) => {
    let oldStart: number | null = null;
    let newStart: number | null = null;
    let oldChanged = 0;
    let newChanged = 0;

    for (let index = run.start; index <= run.end; index += 1) {
      const op = ops[index]!;
      if (op.kind === "delete" && oldStart === null) {
        oldStart = op.oldIndex! + 1;
      }
      if (op.kind === "insert" && newStart === null) {
        newStart = op.newIndex! + 1;
      }
      if (op.kind === "delete") {
        oldChanged += 1;
      }
      if (op.kind === "insert") {
        newChanged += 1;
      }
    }

    const fallbackStart = oldStart ?? newStart ?? 1;
    return {
      start: run.start,
      end: run.end,
      oldStart: oldStart ?? fallbackStart,
      newStart: newStart ?? fallbackStart,
      oldChanged,
      newChanged,
    };
  });
}

export function buildDiffPreview(
  filePath: string,
  originalContent: string | null,
  updatedContent: string,
  maxLines = 5000
): string | null {
  const original = originalContent === null ? null : normalizeContent(originalContent);
  const updated = normalizeContent(updatedContent);

  if (original !== null && original === updated) {
    return null;
  }

  const oldLines = toDiffLines(original);
  const newLines = toDiffLines(updated);
  const ops = diffLines(oldLines, newLines);

  if (ops === null) {
    return buildSingleHunkDiffPreview(filePath, original, oldLines, newLines, maxLines);
  }

  const ranges = buildHunkRanges(ops);
  if (ranges.length === 0) {
    return buildSingleHunkDiffPreview(filePath, original, oldLines, newLines, maxLines);
  }

  const previewLines = [
    `--- ${original === null ? "/dev/null" : `a/${filePath}`}`,
    `+++ b/${filePath}`,
  ];

  for (const range of ranges) {
    const oldStart = original === null ? 0 : range.oldStart;
    previewLines.push(`@@ -${oldStart},${range.oldChanged} +${range.newStart},${range.newChanged} @@`);

    for (let index = range.start; index <= range.end; index += 1) {
      const op = ops[index]!;
      if (op.kind === "equal") {
        previewLines.push(` ${op.line}`);
      } else if (op.kind === "delete") {
        previewLines.push(`-${op.line}`);
      } else {
        previewLines.push(`+${op.line}`);
      }
    }
  }

  if (previewLines.length > maxLines) {
    return `${previewLines.slice(0, maxLines).join("\n")}\n...`;
  }

  return previewLines.join("\n");
}

/** Legacy single-hunk preview used when Myers would consume too much memory. */
function buildSingleHunkDiffPreview(
  filePath: string,
  original: string | null,
  oldLines: string[],
  newLines: string[],
  maxLines: number
): string {
  let prefix = 0;
  while (prefix < oldLines.length && prefix < newLines.length && oldLines[prefix] === newLines[prefix]) {
    prefix += 1;
  }

  let suffix = 0;
  while (
    suffix < oldLines.length - prefix &&
    suffix < newLines.length - prefix &&
    oldLines[oldLines.length - 1 - suffix] === newLines[newLines.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const oldChanged = oldLines.slice(prefix, oldLines.length - suffix);
  const newChanged = newLines.slice(prefix, newLines.length - suffix);
  const oldStart = original === null ? 0 : prefix + 1;
  const newStart = prefix + 1;

  const previewLines = [
    `--- ${original === null ? "/dev/null" : `a/${filePath}`}`,
    `+++ b/${filePath}`,
    `@@ -${oldStart},${oldChanged.length} +${newStart},${newChanged.length} @@`,
  ];

  if (prefix > 0) {
    previewLines.push(` ${oldLines[prefix - 1]}`);
  }

  for (const line of oldChanged) {
    previewLines.push(`-${line}`);
  }

  for (const line of newChanged) {
    previewLines.push(`+${line}`);
  }

  if (suffix > 0) {
    previewLines.push(` ${oldLines[oldLines.length - suffix]}`);
  }

  if (previewLines.length > maxLines) {
    return `${previewLines.slice(0, maxLines).join("\n")}\n...`;
  }

  return previewLines.join("\n");
}

function toDiffLines(content: string | null): string[] {
  if (!content) {
    return [];
  }

  const lines = content.split("\n");
  if (lines[lines.length - 1] === "") {
    lines.pop();
  }
  return lines;
}
