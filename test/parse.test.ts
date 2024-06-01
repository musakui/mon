import { describe, it } from 'vitest'
import * as parse from '../lib/parse.js'

const usp = (qs: string) => new URLSearchParams(qs)

describe('getInt', () => {
	it('parses correctly', ({ expect }) => {
		expect(parse.getInt('')).eq(0)
		expect(parse.getInt('1')).eq(1)
		expect(parse.getInt('69')).eq(69)
	})

	it('uses fallback', ({ expect }) => {
		expect(parse.getInt('', 9)).eq(9)
		expect(parse.getInt('o', 3)).eq(3)
	})
})

describe('getAll', () => {
	it('processes correctly', ({ expect }) => {
		const process = (a: string) => (a ? `a${a}` : null)
		expect(parse.getAll(usp('?'), 'a', process)).toEqual([])
		expect(parse.getAll(usp('?a=1&a='), 'a', process)).toEqual(['a1'])
		expect(parse.getAll(usp('?a=1&a=2'), 'a', process)).toEqual(['a1', 'a2'])
	})
})

describe('parseSelectOption', () => {
	it('parses empty', ({ expect }) => {
		expect(parse.parseColOption('')).toEqual(null)
		expect(parse.parseColOption(':')).toEqual(null)
	})

	it('parses simple', ({ expect }) => {
		expect(parse.parseColOption('foo')).toEqual({ col: 'foo' })
	})

	it('parses with alias', ({ expect }) => {
		expect(parse.parseColOption('MAX(foo):max')).toEqual({
			col: 'MAX(foo)',
			name: 'max',
		})
	})
})

describe('parseConditionOption', () => {
	it('parses empty', ({ expect }) => {
		expect(parse.parseConditionOption('')).toEqual(null)
		expect(parse.parseConditionOption(',')).toEqual(null)
	})
	it('parses single condition', ({ expect }) => {
		expect(parse.parseConditionOption('foo:2')).toEqual([
			{ sql: 'foo', op: '=', params: '2' },
		])
		expect(parse.parseConditionOption('bar__le:420')).toEqual([
			{ sql: 'bar', op: '<=', params: '420' },
		])
		expect(parse.parseConditionOption('baz__nu:_')).toEqual([
			{ sql: 'baz', op: 'ISNULL', params: '_' },
		])
	})
	it('parses multiple conditions', ({ expect }) => {
		expect(parse.parseConditionOption('foo:1,bar__gt:69,baz:29')).toEqual([
			{ sql: 'foo', op: '=', params: '1' },
			{ sql: 'bar', op: '>', params: '69' },
			{ sql: 'baz', op: '=', params: '29' },
		])
	})
})

describe('parseConditionKeyVal', () => {
	it('parses empty', ({ expect }) => {
		expect(parse.parseConditionKeyVal('', '')).toEqual(null)
		expect(parse.parseConditionKeyVal('a', '')).toEqual(null)
	})
	it('parses condition', ({ expect }) => {
		expect(parse.parseConditionKeyVal('foo__gt', '69')).toEqual({
			sql: 'foo',
			op: '>',
			params: '69',
		})
	})
})

describe('parseJoinOption', () => {
	it('parses empty', ({ expect }) => {
		expect(parse.parseJoinOption('')).toEqual(null)
		expect(parse.parseJoinOption(':')).toEqual(null)
	})

	it('parses join', ({ expect }) => {
		expect(parse.parseJoinOption('foo')).toEqual({ join: 'foo' })
	})

	it('parses with names', ({ expect }) => {
		expect(parse.parseJoinOption('foo:bar')).toEqual({
			join: 'foo',
			name: 'bar',
		})
		expect(parse.parseJoinOption('foo:bar:baz')).toEqual({
			join: 'foo',
			name: 'bar',
			col: 'baz',
		})
		expect(parse.parseJoinOption('foo:bar:baz:boom')).toEqual({
			join: 'foo',
			name: 'bar',
			col: 'baz',
			table: 'boom',
		})
	})
})

describe('parseSortOption', () => {
	it('parses empty', ({ expect }) => {
		expect(parse.parseSortOption('')).toEqual(null)
		expect(parse.parseSortOption('-')).toEqual(null)
		expect(parse.parseSortOption('^')).toEqual(null)
	})

	it('parses asc', ({ expect }) => {
		expect(parse.parseSortOption('foo')).toEqual({ col: 'foo' })
	})

	it('parses desc', ({ expect }) => {
		expect(parse.parseSortOption('-foo')).toEqual({ col: 'foo', desc: true })
	})

	it('parses asc nulls first', ({ expect }) => {
		expect(parse.parseSortOption('^foo')).toEqual({
			col: 'foo',
			nullsFirst: true,
		})
	})

	it('parses desc nulls first', ({ expect }) => {
		expect(parse.parseSortOption('_foo')).toEqual({
			col: 'foo',
			desc: true,
			nullsFirst: true,
		})
	})
})

describe('parsePagination', () => {
	it('parses limit', ({ expect }) => {
		expect(parse.parsePagination(usp('?_l='))).toEqual({})
		expect(parse.parsePagination(usp('?_l=10'))).toEqual({ take: 10 })
	})

	it('parses offset', ({ expect }) => {
		expect(parse.parsePagination(usp('?_o='))).toEqual({})
		expect(parse.parsePagination(usp('?_o=5'))).toEqual({ skip: 5 })
	})

	it('parses page', ({ expect }) => {
		expect(parse.parsePagination(usp('?_p=1&_l=4'))).toEqual({ take: 4 })
		expect(parse.parsePagination(usp('?_p=2&_l=9'))).toEqual({
			skip: 9,
			take: 9,
		})
		expect(parse.parsePagination(usp('?_p=3&_l=25'))).toEqual({
			skip: 50,
			take: 25,
		})
	})
})
