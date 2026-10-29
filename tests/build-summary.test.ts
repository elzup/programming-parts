import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import test from 'node:test'
import { buildSummary } from '../scripts/build-summary.ts'
import type { StageResult } from '../scripts/write-stage-result.ts'

test('実測した段階と実行結果をMarkdownへまとめる', (context) => {
  const temporaryDirectory = mkdtempSync(join(tmpdir(), 'programming-parts-'))
  context.after(() =>
    rmSync(temporaryDirectory, { recursive: true, force: true }),
  )

  const reportDirectory = join(temporaryDirectory, 'reports')
  mkdirSync(reportDirectory, { recursive: true })

  const result: StageResult = {
    language: 'C',
    stage: 'preprocess',
    order: 10,
    command: 'clang -E hello.c -o hello.i',
    tool: 'clang test',
    inputs: [],
    outputs: [{ path: 'out/c/hello.i', bytes: 42, sha256: 'abc' }],
  }

  writeFileSync(
    join(reportDirectory, 'c-preprocess.json'),
    JSON.stringify(result),
  )
  writeFileSync(join(reportDirectory, 'c-output.txt'), 'hello from C\n')

  const summary = buildSummary(temporaryDirectory)

  assert.match(summary, /flowchart LR/)
  assert.match(summary, /Python bytecode \+ execute/)
  assert.match(summary, /Go native build/)
  assert.match(summary, /Rust LLVM IR \+ native build/)
  assert.match(summary, /clang -E hello\.c/)
  assert.match(summary, /42 bytes/)
  assert.match(summary, /hello from C/)
})
