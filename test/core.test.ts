import { describe, it, expect } from 'vitest'

import { createFragment, isFragment, concat, tag, fromObject } from '#/core/index.js'
import type { SqlFragment } from '#/core/frag.js'

describe('createFragment', () => {
	it('stores the SQL string', () => {
		expect(createFragment('SELECT 1').sql).toBe('SELECT 1')
	})

	it('stores a single bound value', () => {
		expect(createFragment('?', 42).values).toEqual([42])
	})

	it('stores multiple bound values in order', () => {
		expect(createFragment('?,?', 1, 2).values).toEqual([1, 2])
	})

	it('stores no values when none given', () => {
		expect(createFragment('SELECT 1').values).toEqual([])
	})

	it('stores bound values in order', () => {
		expect(createFragment('? AND ?', 'a', 'b').values).toEqual(['a', 'b'])
	})

	it('toString returns the SQL string', () => {
		const frag = createFragment('hello')
		expect(String(frag)).toBe('hello')
		expect(`${frag}`).toBe('hello')
	})

	it('toString of empty fragment returns empty string', () => {
		expect(String(createFragment(''))).toBe('')
	})

	it('preserves array values without unwrapping', () => {
		expect(createFragment('?', [1, 2, 3]).values).toEqual([[1, 2, 3]])
	})

	it('preserves null values', () => {
		expect(createFragment('?', null).values).toEqual([null])
	})
})

describe('isFragment', () => {
	it('returns true for a SqlFragment', () => {
		expect(isFragment(createFragment(''))).toBe(true)
	})

	it('returns false for a plain object shaped like a fragment', () => {
		expect(isFragment({ sql: 'x', values: [] })).toBe(false)
	})

	it('returns false for primitives', () => {
		expect(isFragment('SELECT 1')).toBe(false)
		expect(isFragment(42)).toBe(false)
		expect(isFragment(null)).toBe(false)
		expect(isFragment(undefined)).toBe(false)
	})
})

describe('concat', () => {
	it('returns empty fragment when given no items', () => {
		const frag = concat(',')
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
	})

	it('wraps a single literal as a bound parameter', () => {
		const frag = concat(',', 42)
		expect(frag.sql).toBe('?')
		expect(frag.values).toEqual([42])
	})

	it('returns a single fragment unchanged (same reference)', () => {
		const f = createFragment('x')
		expect(concat(',', f)).toBe(f)
	})

	it('returns a single fragment with values unchanged', () => {
		const f = createFragment('?', 7)
		const result = concat(',', f)
		expect(result).toBe(f)
		expect(result.values).toEqual([7])
	})

	it('joins two literals with the glue', () => {
		const frag = concat(',', 1, 2)
		expect(frag.sql).toBe('?,?')
		expect(frag.values).toEqual([1, 2])
	})

	it('joins two fragments with the glue', () => {
		const frag = concat(',', createFragment('a=?', 1), createFragment('b=?', 2))
		expect(frag.sql).toBe('a=?,b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('joins three fragments with the glue', () => {
		const frag = concat(
			',',
			createFragment('a'),
			createFragment('b'),
			createFragment('c')
		)
		expect(frag.sql).toBe('a,b,c')
		expect(frag.values).toEqual([])
	})

	it('mixes fragments and literals', () => {
		const frag = concat(',', createFragment('a=?', 'x'), 99)
		expect(frag.sql).toBe('a=?,?')
		expect(frag.values).toEqual(['x', 99])
	})

	it('flattens values from multiple fragments in order', () => {
		const frag = concat(
			',',
			createFragment('?', 1),
			createFragment('?', 2),
			createFragment('?', 3)
		)
		expect(frag.values).toEqual([1, 2, 3])
	})

	it('uses a multi-character glue string', () => {
		const frag = concat(' AND ', createFragment('a=?', 1), createFragment('b=?', 2))
		expect(frag.sql).toBe('a=? AND b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('uses an empty string as glue', () => {
		const frag = concat('', createFragment('a'), createFragment('b'))
		expect(frag.sql).toBe('ab')
	})

	it('accepts a function as glue', () => {
		const frag = concat(
			(s) => s.map((f) => f.sql).join(' OR '),
			createFragment('a=?', 1),
			createFragment('b=?', 2)
		)
		expect(frag.sql).toBe('a=? OR b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('passes all fragment objects to the glue function', () => {
		const received: SqlFragment[] = []
		const a = createFragment('a')
		const b = createFragment('b')
		concat(
			(s) => {
				received.push(...s)
				return 'x'
			},
			a,
			b
		)
		expect(received).toHaveLength(2)
		expect(received[0]).toBe(a)
		expect(received[1]).toBe(b)
	})

	it('preserves null, zero, and false as distinct bound values', () => {
		const frag = concat(',', null, 0, false)
		expect(frag.values).toEqual([null, 0, false])
	})
})

describe('tag', () => {
	it('static template with no interpolations returns the string as-is', () => {
		const frag = tag`SELECT 1`
		expect(frag.sql).toBe('SELECT 1')
		expect(frag.values).toEqual([])
	})

	it('single literal interpolation becomes a bound parameter', () => {
		const frag = tag`WHERE id=${42}`
		expect(frag.sql).toBe('WHERE id= ?')
		expect(frag.values).toEqual([42])
	})

	it('multiple literal interpolations are collected in order', () => {
		const frag = tag`a=${1} AND b=${2}`
		expect(frag.sql).toBe('a= ? AND b= ?')
		expect(frag.values).toEqual([1, 2])
	})

	it('interpolated fragment is inlined and its values are merged', () => {
		const cond = createFragment('x=?', 'hello')
		const frag = tag`WHERE ${cond}`
		expect(frag.sql).toBe('WHERE x=?')
		expect(frag.values).toEqual(['hello'])
	})

	it('multiple interpolated fragments merge all values in order', () => {
		const a = createFragment('?', 1)
		const b = createFragment('?', 2)
		const frag = tag`${a} AND ${b}`
		expect(frag.sql).toBe('? AND ?')
		expect(frag.values).toEqual([1, 2])
	})

	it('multiple interpolated fragments merge all values in order', () => {
		const frag = tag`${tag`foo = ${1}`} AND ${tag`bar = ${2}`}`
		expect(frag.sql).toBe('foo = ? AND bar = ?')
		expect(frag.values).toEqual([1, 2])
	})

	it('null is a valid bound parameter', () => {
		const frag = tag`WHERE x=${null}`
		expect(frag.values).toEqual([null])
	})
})

describe('fromObject', () => {
	it('returns empty fragment for empty object', () => {
		const frag = fromObject({})
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
	})

	it('creates key=? for a single literal value', () => {
		const frag = fromObject({ foo: 42 })
		expect(frag.sql).toBe('foo=?')
		expect(frag.values).toEqual([42])
	})

	it('joins multiple pairs with comma by default', () => {
		const frag = fromObject({ a: 1, b: 2 })
		expect(frag.sql).toBe('a=?,b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('uses a custom glue string', () => {
		const frag = fromObject({ a: 1, b: 2 }, ' AND ')
		expect(frag.sql).toBe('a=? AND b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('inlines a non-empty fragment value as raw SQL', () => {
		const frag = fromObject({ updated_at: createFragment('NOW()') })
		expect(frag.sql).toBe('updated_at=NOW()')
		expect(frag.values).toEqual([])
	})

	it('inlines fragment values and collects its bound values', () => {
		const frag = fromObject({ counter: createFragment('?+1', 5) })
		expect(frag.sql).toBe('counter=?+1')
		expect(frag.values).toEqual([5])
	})

	it('skips keys whose fragment value has an empty SQL string', () => {
		const frag = fromObject({ a: 1, b: createFragment(''), c: 2 })
		expect(frag.sql).toBe('a=?,c=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('returns empty fragment when all values are empty fragments', () => {
		const frag = fromObject({ a: createFragment(''), b: createFragment('') })
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
	})

	it('handles null literal as a bound parameter', () => {
		const frag = fromObject({ x: null })
		expect(frag.sql).toBe('x=?')
		expect(frag.values).toEqual([null])
	})

	it('handles a mix of literals and fragment values', () => {
		const frag = fromObject({ a: 1, b: createFragment('NOW()'), c: 3 })
		expect(frag.sql).toBe('a=?,b=NOW(),c=?')
		expect(frag.values).toEqual([1, 3])
	})
})
