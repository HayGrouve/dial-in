// Fails the build on an em or en dash (U+2014, U+2013) anywhere in src/ or
// index.html: Кафето's copy never uses them. `src/dashes.test.ts` checks the
// same in the tests.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const DASH = /[\u2013\u2014]/
const files = ['index.html', ...readdirSync('src', { recursive: true }).map((f) => join('src', String(f)))].filter((f) =>
  /\.(ts|tsx|css|json|html)$/.test(f),
)
const hits = files.flatMap((file) =>
  readFileSync(file, 'utf8')
    .split('\n')
    .flatMap((line, i) => (DASH.test(line) ? [`${file}:${i + 1}: ${line.trim()}`] : [])),
)
if (hits.length > 0) {
  console.error(`Em or en dash in the source (write "25 до 30 с", or use a colon):\n${hits.join('\n')}`)
  process.exit(1)
}
