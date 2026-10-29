import { createHash } from 'node:crypto'
import {
  existsSync,
  mkdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'

export type FileResult = {
  path: string
  bytes: number
  sha256: string
}

export type StageResult = {
  language: string
  stage: string
  order: number
  command: string
  tool: string
  inputs: FileResult[]
  outputs: FileResult[]
}

const describeFile = (filePath: string): FileResult => {
  if (!existsSync(filePath)) {
    throw new Error(`対象ファイルが存在しません: ${filePath}`)
  }

  const content = readFileSync(filePath)

  return {
    path: filePath.replace(/^workspace\//, ''),
    bytes: statSync(filePath).size,
    sha256: createHash('sha256').update(content).digest('hex'),
  }
}

const main = () => {
  const { values } = parseArgs({
    options: {
      language: { type: 'string' },
      stage: { type: 'string' },
      order: { type: 'string' },
      command: { type: 'string' },
      tool: { type: 'string' },
      input: { type: 'string', multiple: true, default: [] },
      output: { type: 'string', multiple: true, default: [] },
      result: { type: 'string' },
    },
    strict: true,
  })

  const requiredValues = [
    values.language,
    values.stage,
    values.order,
    values.command,
    values.tool,
    values.result,
  ]

  if (requiredValues.some((value) => value === undefined)) {
    throw new Error('language, stage, order, command, tool, result は必須です')
  }

  const result: StageResult = {
    language: values.language as string,
    stage: values.stage as string,
    order: Number(values.order),
    command: values.command as string,
    tool: values.tool as string,
    inputs: (values.input ?? []).map(describeFile),
    outputs: (values.output ?? []).map(describeFile),
  }

  const resultPath = values.result as string
  mkdirSync(dirname(resultPath), { recursive: true })
  writeFileSync(resultPath, `${JSON.stringify(result, null, 2)}\n`)
}

main()
