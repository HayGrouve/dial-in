import { describe, expect, test } from 'vitest'

// Copy is Bulgarian with no em or en dashes (U+2014, U+2013). This covers
// the Данни files; #34 widens it to every file in src/ once the English UI,
// which still has dashes, is translated.
const files = import.meta.glob(['./components/DataSection.tsx', './lib/backup.ts', './lib/count.ts', './lib/fixtures/*.json'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('no em or en dashes', () => {
  test.each(Object.entries(files))('%s', (_, source) => {
    const lines = source.split('\n').flatMap((line, i) => (/[–—]/.test(line) ? [`${i + 1}: ${line.trim()}`] : []))
    expect(lines).toEqual([])
  })
})
