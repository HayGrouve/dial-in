import { describe, expect, test } from 'vitest'

// Copy is Bulgarian with no em or en dashes (U+2014, U+2013), and so is
// everything else in src/: code, comments, fixtures and styles. A range is
// written "25 до 30 с", an aside gets a colon or a full stop.
const DASH = /[\u2013\u2014]/

const files = import.meta.glob(['./**/*.{ts,tsx,css,json,html}', '../index.html'], {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

describe('no em or en dashes', () => {
  test('the check reads every source file', () => {
    expect(Object.keys(files)).toEqual(expect.arrayContaining(['./pages/Home.tsx', './lib/methods.ts', './index.css', '../index.html']))
    expect(Object.keys(files).length).toBeGreaterThan(40)
  })

  test.each(Object.entries(files))('%s', (_, source) => {
    const lines = source.split('\n').flatMap((line, i) => (DASH.test(line) ? [`${i + 1}: ${line.trim()}`] : []))
    expect(lines).toEqual([])
  })
})
