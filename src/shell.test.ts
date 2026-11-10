import { describe, expect, test } from 'vitest'
import html from '../index.html?raw'
import pkg from '../package.json?raw'
import manifestRaw from '../public/manifest.webmanifest?raw'
import vercelRaw from '../vercel.json?raw'
import viteConfig from '../vite.config.ts?raw'
import home from './pages/Home.tsx?raw'

const manifest = JSON.parse(manifestRaw)
const vercel = JSON.parse(vercelRaw)

describe('online-only shell', () => {
  test('no service worker plugin, registration or headers', () => {
    expect(viteConfig).not.toMatch(/pwa/i)
    expect(pkg).not.toMatch(/vite-plugin-pwa|workbox/)
    const sources = vercel.headers.map((h: { source: string }) => h.source)
    expect(sources).not.toContain('/sw.js')
    expect(sources.some((s: string) => s.includes('workbox'))).toBe(false)
    expect(sources).toContain('/manifest.webmanifest')
    expect(sources).toContain('/assets/(.*)')
    expect(vercel.rewrites).toEqual([{ source: '/(.*)', destination: '/index.html' }])
  })

  test('the manifest is installable as Онова за кафето', () => {
    expect(manifest).toMatchObject({
      id: '/',
      name: 'Онова за кафето',
      short_name: 'Кафето',
      lang: 'bg',
      start_url: '/',
      scope: '/',
      display: 'standalone',
    })
    const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes)
    expect(sizes).toContain('192x192')
    expect(sizes).toContain('512x512')
  })

  test('index.html links the manifest and carries the new name', () => {
    expect(html).toMatch(/<html lang="bg">/)
    expect(html).toContain('<link rel="manifest" href="/manifest.webmanifest" />')
    expect(html).toContain('<title>Онова за кафето</title>')
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="Кафето" />')
    expect(html).toContain("localStorage.getItem('kafeto-theme')")
  })

  test('no "Dial In" left in the shell, the manifest, package.json or the Home header', () => {
    for (const s of [html, manifestRaw, pkg, home]) expect(s).not.toMatch(/Dial In/)
    expect(JSON.parse(pkg).name).toBe('onova-za-kafeto')
  })

  test('no em or en dashes in the shell copy', () => {
    for (const s of [html, manifestRaw]) expect(s).not.toMatch(/[\u2013\u2014]/)
  })
})
