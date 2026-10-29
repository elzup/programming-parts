import {
  appendFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs'
import { basename, join } from 'node:path'
import { pathToFileURL } from 'node:url'
import type { StageResult } from './write-stage-result.ts'

const languageOrder = ['C', 'Go', 'Rust', 'Ruby', 'Node.js', 'Python', 'Java']

const listFiles = (directory: string): string[] =>
  readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = join(directory, entry.name)
    return entry.isDirectory() ? listFiles(entryPath) : [entryPath]
  })

const isStageResult = (value: unknown): value is StageResult => {
  if (typeof value !== 'object' || value === null) return false

  const candidate = value as Partial<StageResult>
  return (
    typeof candidate.language === 'string' &&
    typeof candidate.stage === 'string' &&
    typeof candidate.order === 'number' &&
    typeof candidate.command === 'string' &&
    typeof candidate.tool === 'string' &&
    Array.isArray(candidate.inputs) &&
    Array.isArray(candidate.outputs)
  )
}

const readStageResults = (directory: string): StageResult[] => {
  const reportDirectory = join(directory, 'reports')
  if (!existsSync(reportDirectory)) return []

  return listFiles(reportDirectory)
    .filter((filePath) => filePath.endsWith('.json'))
    .map((filePath) => JSON.parse(readFileSync(filePath, 'utf8')) as unknown)
    .filter(isStageResult)
    .sort((left, right) => {
      const languageDifference =
        languageOrder.indexOf(left.language) -
        languageOrder.indexOf(right.language)
      return languageDifference || left.order - right.order
    })
}

const formatOutputs = (result: StageResult): string =>
  result.outputs
    .map(
      (output) =>
        `\`${output.path}\` (${output.bytes.toLocaleString('en-US')} bytes)`,
    )
    .join('<br>') || '—'

const readExecutionOutputs = (directory: string): string => {
  const reportDirectory = join(directory, 'reports')
  if (!existsSync(reportDirectory)) return ''

  const sections = listFiles(reportDirectory)
    .filter((filePath) => filePath.endsWith('-output.txt'))
    .sort()
    .map((filePath) => {
      const label = basename(filePath, '-output.txt')
      const content = readFileSync(filePath, 'utf8').trimEnd()
      return `### ${label}\n\n\`\`\`text\n${content}\n\`\`\``
    })

  return sections.length > 0
    ? `\n## 実行結果\n\n${sections.join('\n\n')}\n`
    : ''
}

export const buildSummary = (collectedDirectory: string): string => {
  const results = readStageResults(collectedDirectory)
  const rows = results.map(
    (result) =>
      `| ${result.language} | ${result.stage} | ${result.tool} | \`${result.command}\` | ${formatOutputs(result)} |`,
  )

  const table = [
    '| 系統 | 段階 | ツール | コマンド | 出力 |',
    '| --- | --- | --- | --- | --- |',
    ...rows,
  ].join('\n')

  return `# Language execution pipelines

\`source\`から各言語の実行結果までに生成された表現を、実際のWorkflow成果物から集約しています。

\`\`\`mermaid
flowchart LR
  source[Source code]
  source --> cp[C preprocess] --> ci[LLVM IR] --> co[Object] --> cl[Link] --> ce[C execute]
  source --> rb[Ruby ISeq + execute]
  source --> nd[Node.js V8 bytecode + execute]
  source --> py[Python bytecode + execute]
  source --> gb[Go native build] --> ge[Go execute]
  source --> rsb[Rust LLVM IR + native build] --> rse[Rust execute]
  source --> jc[Java javac] --> je[JVM execute]
  ce --> compare[Compare]
  rb --> compare
  nd --> compare
  py --> compare
  ge --> compare
  rse --> compare
  je --> compare
\`\`\`

${table}

> SHA-256を含む詳細は、Workflowの \`pipeline-report\` artifactに保存されています。
${readExecutionOutputs(collectedDirectory)}`
}

const main = () => {
  const [collectedDirectory, stepSummaryPath, reportPath] =
    process.argv.slice(2)
  if (!collectedDirectory || !stepSummaryPath || !reportPath) {
    throw new Error(
      'usage: node scripts/build-summary.ts <collected-dir> <step-summary> <report>',
    )
  }

  const summary = buildSummary(collectedDirectory)
  appendFileSync(stepSummaryPath, summary)
  writeFileSync(reportPath, summary)
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main()
}
