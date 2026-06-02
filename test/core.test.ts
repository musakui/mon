import { describe, it, expect } from 'vitest'

import {
	createFragment,
	isFragment,
	tag,
	concat,
	toColsVals,
	toFragments,
	fromEntries,
	fromObject,
	joinFragments,
	mergeConditions,
	isNonEmptyFragment,
} from '#/core/index.js'

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

	it('joins fragments with the glue', () => {
		const frag = concat(
			',',
			createFragment('a=?', 1),
			createFragment('b'),
			createFragment('c=?', 2),
			createFragment('d=?', -5)
		)
		expect(frag.sql).toBe('a=?,b,c=?,d=?')
		expect(frag.values).toEqual([1, 2, -5])
	})

	it('mixes fragments and literals', () => {
		const frag = concat(',', createFragment('a=?', 'x'), 99)
		expect(frag.sql).toBe('a=?,?')
		expect(frag.values).toEqual(['x', 99])
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
		const received: unknown[] = []
		const a = createFragment('a')
		const b = createFragment('b')
		concat((s) => (received.push(...s), 'x'), a, b)
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
		expect(frag.sql).toBe('WHERE id=?')
		expect(frag.values).toEqual([42])
	})

	it('multiple literal interpolations are collected in order', () => {
		const frag = tag`a=${1} AND b=${2}`
		expect(frag.sql).toBe('a=? AND b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('interpolated fragment is inlined and its values are merged', () => {
		const cond = tag`x=${'hello'}`
		const frag = tag`WHERE ${cond}`
		expect(frag.sql).toBe('WHERE x=?')
		expect(frag.values).toEqual(['hello'])
	})

	it('multiple interpolated fragments merge all values in order', () => {
		const a = tag`${1}`
		const b = tag`${2}`
		const frag = tag`${a} AND ${b}`
		expect(frag.sql).toBe('? AND ?')
		expect(frag.values).toEqual([1, 2])
	})

	it('nested fragments merge all values in order', () => {
		const frag = tag`${tag`foo = ${1}`} AND ${tag`bar = ${2}`}`
		expect(frag.sql).toBe('foo = ? AND bar = ?')
		expect(frag.values).toEqual([1, 2])
	})

	it('null is a valid bound parameter', () => {
		const frag = tag`WHERE x=${null}`
		expect(frag.values).toEqual([null])
	})
})

describe('toColsVals', () => {
	it('returns cols and vals for a single entry', () => {
		const [cols, vals] = toColsVals([['name', 'alice']])
		expect(cols.sql).toBe('name')
		expect(vals.sql).toBe('?')
		expect(vals.values).toEqual(['alice'])
	})

	it('returns comma-joined cols and vals for multiple entries', () => {
		const [cols, vals] = toColsVals([
			['a', 1],
			['b', 2],
		])
		expect(cols.sql).toBe('a,b')
		expect(vals.sql).toBe('?,?')
		expect(vals.values).toEqual([1, 2])
	})

	it('skips entries with falsy keys', () => {
		const [cols, vals] = toColsVals([
			['', 1],
			['a', 2],
		])
		expect(cols.sql).toBe('a')
		expect(vals.values).toEqual([2])
	})

	it('skips entries where value is undefined', () => {
		const [cols, vals] = toColsVals([
			['a', undefined],
			['b', 1],
		])
		expect(cols.sql).toBe('b')
		expect(vals.values).toEqual([1])
	})

	it('keeps null values', () => {
		const [cols, vals] = toColsVals([['a', null]])
		expect(cols.sql).toBe('a')
		expect(vals.values).toEqual([null])
	})

	it('returns empty fragments for empty entries', () => {
		const [cols, vals] = toColsVals([])
		expect(cols.sql).toBe('')
		expect(vals.sql).toBe('')
	})
})

describe('toFragments', () => {
	it('joins entries', () => {
		const frags = [
			...toFragments([
				['a', tag`1`],
				['b', 2],
			]),
		]
		expect(frags[0].sql).toBe('a=1')
		expect(frags[0].values).toEqual([])
		expect(frags[1].sql).toBe('b=?')
		expect(frags[1].values).toEqual([2])
	})

	it('uses a custom eq separator', () => {
		const [frag] = [...toFragments([['x', 1]], '>=')]
		expect(frag.sql).toBe('x>=?')
		expect(frag.values).toEqual([1])
	})

	it('skips entries with empty keys', () => {
		const frags = [...toFragments([['', tag`foo`]])]
		expect(frags).toHaveLength(0)
	})

	it('skips entries with empty fragments', () => {
		const frags = [...toFragments([['a', tag``]])]
		expect(frags).toHaveLength(0)
	})
})

describe('fromEntries', () => {
	it('works with a Map', () => {
		const frag = fromEntries(
			new Map([
				['a', 1],
				['b', 2],
			])
		)
		expect(frag.sql).toBe('a=?,b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('returns empty fragment for empty entries', () => {
		const frag = fromEntries([])
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
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
		const frag = fromObject({ updated_at: tag`NOW()` })
		expect(frag.sql).toBe('updated_at=NOW()')
		expect(frag.values).toEqual([])
	})

	it('inlines fragment values and collects its bound values', () => {
		const frag = fromObject({ counter: tag`${5}+1` })
		expect(frag.sql).toBe('counter=?+1')
		expect(frag.values).toEqual([5])
	})

	it('skips keys whose fragment value has an empty SQL string', () => {
		const frag = fromObject({ a: 1, b: tag``, c: 2 })
		expect(frag.sql).toBe('a=?,c=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('returns empty fragment when all values are empty fragments', () => {
		const frag = fromObject({ a: tag``, b: tag`` })
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
	})

	it('handles null literal as a bound parameter', () => {
		const frag = fromObject({ x: null })
		expect(frag.sql).toBe('x=?')
		expect(frag.values).toEqual([null])
	})

	it('handles a mix of literals and fragment values', () => {
		const frag = fromObject({ a: 1, b: tag`NOW()`, c: tag`(1 + ${3})` })
		expect(frag.sql).toBe('a=?,b=NOW(),c=(1 + ?)')
		expect(frag.values).toEqual([1, 3])
	})
})

describe('isNonEmptyFragment', () => {
	it('returns false for non fragments', () => {
		expect(isNonEmptyFragment(undefined)).toBe(false)
		expect(isNonEmptyFragment(null)).toBe(false)
		expect(isNonEmptyFragment(true)).toBe(false)
		expect(isNonEmptyFragment(1)).toBe(false)
		expect(isNonEmptyFragment('hi')).toBe(false)
	})

	it('returns false for empty fragments', () => {
		expect(isNonEmptyFragment(tag``)).toBe(false)
	})

	it('returns true for non-empty fragments', () => {
		expect(isNonEmptyFragment(tag`hi`)).toBe(true)
		expect(isNonEmptyFragment(tag`${1}`)).toBe(true)
	})
})

describe('joinFragments', () => {
	it('returns empty fragment for empty array', () => {
		const frag = joinFragments([])
		expect(frag.sql).toBe('')
		expect(frag.values).toEqual([])
	})

	it('returns empty fragment when all items are empty fragments', () => {
		const frag = joinFragments([tag``, tag``])
		expect(frag.sql).toBe('')
	})

	it('filters out non-fragment items', () => {
		const frag = joinFragments([null, 'raw string', tag`a=${1}`])
		expect(frag.sql).toBe('a=?')
		expect(frag.values).toEqual([1])
	})

	it('filters out empty fragments', () => {
		const frag = joinFragments([tag``, tag`ORDER BY id`])
		expect(frag.sql).toBe('ORDER BY id')
	})

	it('returns a single non-empty fragment unchanged', () => {
		const frag = joinFragments([tag`SELECT *`])
		expect(frag.sql).toBe('SELECT *')
	})

	it('joins multiple fragments with a space by default', () => {
		const frag = joinFragments([tag`SELECT *`, tag`FROM t`, tag`WHERE id=${1}`])
		expect(frag.sql).toBe('SELECT * FROM t WHERE id=?')
		expect(frag.values).toEqual([1])
	})

	it('joins with a custom separator', () => {
		const frag = joinFragments([tag`a=${1}`, tag`b=${2}`], ', ')
		expect(frag.sql).toBe('a=?, b=?')
		expect(frag.values).toEqual([1, 2])
	})

	it('skips empty fragments between non-empty ones', () => {
		const frag = joinFragments([tag`SELECT *`, tag``, tag`FROM t`])
		expect(frag.sql).toBe('SELECT * FROM t')
	})

	it('merges bound values from all fragments', () => {
		const frag = joinFragments([tag`a=${1}`, tag`b=${2}`, tag`c=${3}`])
		expect(frag.values).toEqual([1, 2, 3])
	})
})

describe('mergeConditions', () => {
	it('returns 1 when called with no arguments', () => {
		expect(mergeConditions().sql).toBe('1')
	})

	it('returns 1 for empty product', () => {
		expect(mergeConditions([]).sql).toBe('1')
	})

	it('returns 0 for empty sum (disjunct)', () => {
		expect(mergeConditions([], true).sql).toBe('0')
	})

	it('filters out non-fragment items', () => {
		const frag = mergeConditions([null, 'raw string', tag`a=${1}`])
		expect(frag.sql).toBe('(a=?)')
		expect(frag.values).toEqual([1])
	})

	it('filters out empty-SQL fragments', () => {
		const frag = mergeConditions([tag``, tag`a=${1}`])
		expect(frag.sql).toBe('(a=?)')
	})

	it('wraps a single condition in parens', () => {
		const frag = mergeConditions([tag`x=${5}`])
		expect(frag.sql).toBe('(x=?)')
		expect(frag.values).toEqual([5])
	})

	it('joins two conditions with AND', () => {
		const frag = mergeConditions([tag`a=${1}`, tag`b=${2}`])
		expect(frag.sql).toBe('(a=? AND b=?)')
		expect(frag.values).toEqual([1, 2])
	})

	it('joins two conditions with OR when disjunct', () => {
		const frag = mergeConditions([tag`a=${1}`, tag`b=${2}`], true)
		expect(frag.sql).toBe('(a=? OR b=?)')
		expect(frag.values).toEqual([1, 2])
	})

	it('merges bound values from all conditions', () => {
		const frag = mergeConditions([tag`x=${1}`, tag`y=${2}`, tag`z=${3}`])
		expect(frag.sql).toBe('(x=? AND y=? AND z=?)')
		expect(frag.values).toEqual([1, 2, 3])
	})
})
