import Ajv2020 from 'ajv/dist/2020.js'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'

const schemaPath = resolve('public/schema/build-guide.schema.json')
const args = process.argv.slice(2)

if (args.includes('--help') || args.includes('-h')) {
  console.log('Usage: pnpm verify:schema <build-guide.json> [...more.json]')
  console.log('       pnpm verify:schema - < build-guide.json')
  process.exit(0)
}

const targets = args.length > 0 ? args : ['src/sample-build.json']
const schema = JSON.parse(await readFile(schemaPath, 'utf8'))
const ajv = new Ajv2020({ allErrors: true, strict: false })
const validate = ajv.compile(schema)

async function readStdin() {
  const chunks = []

  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf8')
}

async function readTarget(target) {
  if (target === '-') {
    return {
      label: 'stdin',
      text: await readStdin(),
    }
  }

  const filePath = resolve(target)

  return {
    label: target,
    text: await readFile(filePath, 'utf8'),
  }
}

function formatError(error) {
  const path = error.instancePath || '/'
  const suffix =
    error.params && Object.keys(error.params).length > 0
      ? ` ${JSON.stringify(error.params)}`
      : ''

  return `${path} ${error.message ?? 'is invalid'}${suffix}`
}

let hasFailure = false

for (const target of targets) {
  try {
    const { label, text } = await readTarget(target)
    const data = JSON.parse(text)
    const isValid = validate(data)

    if (isValid) {
      console.log(`OK ${label}`)
      continue
    }

    hasFailure = true
    console.error(`INVALID ${label}`)

    for (const error of validate.errors ?? []) {
      console.error(`  - ${formatError(error)}`)
    }
  } catch (error) {
    hasFailure = true
    const message = error instanceof Error ? error.message : String(error)
    console.error(`ERROR ${target}: ${message}`)
  }
}

if (hasFailure) {
  process.exit(1)
}
