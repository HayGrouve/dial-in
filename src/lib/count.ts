/**
 * A number with its noun in Bulgarian: the singular for exactly 1, otherwise
 * the plural ("1 кафе", "0 кафета", "21 кафета"). Masculine nouns pass their
 * count form as `many` ("2 месеца").
 */
export function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`
}

export const coffeesCount = (n: number) => count(n, 'кафе', 'кафета')
export const brewsCount = (n: number) => count(n, 'варене', 'варения')
