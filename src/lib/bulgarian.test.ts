import { afterEach, describe, expect, test, vi } from 'vitest'
import { brewsCount, coffeesCount, count } from './count'
import { roastLabel, ROAST_LEVELS } from './db'
import { ago, capitalise, formatTime, logLabel, relativeDay, shortDate } from './methods'

afterEach(() => {
  vi.useRealTimers()
})

describe('count forms', () => {
  test.each([
    [0, '0 кафета', '0 варения'],
    [1, '1 кафе', '1 варене'],
    [2, '2 кафета', '2 варения'],
    [5, '5 кафета', '5 варения'],
    [11, '11 кафета', '11 варения'],
    [21, '21 кафета', '21 варения'],
  ])('%i', (n, coffees, brews) => {
    expect(coffeesCount(n)).toBe(coffees)
    expect(brewsCount(n)).toBe(brews)
  })

  test('masculine nouns take their count form', () => {
    expect(count(1, 'пакет', 'пакета')).toBe('1 пакет')
    expect(count(3, 'пакет', 'пакета')).toBe('3 пакета')
    expect(count(21, 'опит', 'опита')).toBe('21 опита')
  })
})

describe('dates', () => {
  const now = new Date(2026, 10, 10, 15, 0)
  const daysAgo = (n: number) => new Date(2026, 10, 10 - n, 9, 0).getTime()

  test('shortDate is Bulgarian', () => {
    expect(shortDate(new Date(2026, 7, 21).getTime())).toBe('21 август')
    expect(shortDate(new Date(2026, 0, 5).getTime())).toBe('5 януари')
  })

  test('relativeDay', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    expect(relativeDay(daysAgo(0))).toBe('днес')
    expect(relativeDay(daysAgo(1))).toBe('вчера')
    expect(relativeDay(daysAgo(2))).toBe('преди 2 дни')
    expect(relativeDay(daysAgo(6))).toBe('преди 6 дни')
    expect(relativeDay(daysAgo(7))).toBe('3 ноември')
    expect(capitalise(relativeDay(daysAgo(1)))).toBe('Вчера')
  })

  test('ago', () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(now)
    expect(ago(daysAgo(0))).toBe('днес')
    expect(ago(daysAgo(1))).toBe('вчера')
    expect(ago(daysAgo(5))).toBe('преди 5 дни')
    expect(ago(daysAgo(21))).toBe('преди 3 седмици')
    expect(ago(daysAgo(122))).toBe('преди 4 месеца')
    expect(ago(daysAgo(800))).toBe('преди 2 години')
  })
})

describe('labels', () => {
  test('stored roast levels show in Bulgarian; anything else as typed', () => {
    expect(ROAST_LEVELS.map(roastLabel)).toEqual(['Светло', 'Средно светло', 'Средно', 'Средно тъмно', 'Тъмно'])
    expect(roastLabel('Omni')).toBe('Omni')
  })

  test('times, and the log button per method', () => {
    expect(formatTime(28)).toBe('28\u00a0с')
    expect(formatTime(185)).toBe('3:05')
    expect(logLabel('espresso')).toBe('Запиши еспресо')
    expect(logLabel('aeropress')).toBe('Запиши AeroPress')
    expect(logLabel('other')).toBe('Запиши варене')
  })
})
