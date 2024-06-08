import { describe, it, expect } from 'vitest'
import * as generate from '../lib/generate.js'

describe('joinParts', () => {
	it.each([
		{
			name: 'empty',
			parts: [],
			result: '',
		},
		{
			name: 'single',
			parts: ['foo'],
			result: 'foo',
		},
		{
			name: 'normal',
			parts: ['foo', 'bar', 'baz'],
			result: 'foo bar baz',
		},
		{
			name: 'whitespace',
			parts: [' foo ', ' bar ', ' baz '],
			result: 'foo bar baz',
		},
		{
			name: 'empty components',
			parts: ['foo', '', 'bar', ' ', 'baz'],
			result: 'foo bar baz',
		},
	])(`handles $name`, ({ parts, result }) => {
		expect(generate.joinParts(parts)).toEqual(result)
	})
})

describe('combineConditions', () => {
	it('handles empty', ({ expect }) => {
		expect(generate.combineConditions([])).toEqual({ sql: '', params: [] })
		expect(generate.combineConditions([{ sql: '', params: [] }])).toEqual({
			sql: '',
			params: [],
		})
	})

	it('handles single condition', ({ expect }) => {
		expect(generate.combineConditions([{ sql: 'foo', params: [1] }])).toEqual({
			sql: 'foo',
			params: [1],
		})
	})

	it('joins with correct operator', ({ expect }) => {
		expect(
			generate.combineConditions([
				{ sql: 'foo', params: [1] },
				{ sql: 'bar', params: ['hi'] },
			])
		).toEqual({ sql: '(foo AND bar)', params: [1, 'hi'] })
		expect(
			generate.combineConditions(
				[
					{ sql: 'foo', params: [3, 'ok'] },
					{ sql: 'bar', params: [4, 'bye'] },
				],
				true
			)
		).toEqual({ sql: '(foo OR bar)', params: [3, 'ok', 4, 'bye'] })
	})
})

describe('normalizeCondition', () => {
	it('handles empty', ({ expect }) => {
		expect(generate.normalizeCondition()).toEqual([])
		expect(generate.normalizeCondition('')).toEqual([])
	})

	it('handles string', ({ expect }) => {
		expect(generate.normalizeCondition('baz = 2')).toEqual([
			{ sql: 'baz = 2', params: [] },
		])
	})

	it('handles condition', ({ expect }) => {
		expect(generate.normalizeCondition({ sql: '' })).toEqual([])
		expect(generate.normalizeCondition({ sql: 'bar = 3' })).toEqual([
			{ sql: 'bar = 3', params: [] },
		])
		expect(
			generate.normalizeCondition({ sql: 'bar = ?', params: '2' })
		).toEqual([{ sql: 'bar = ?', params: ['2'] }])
		expect(
			generate.normalizeCondition({ sql: 'bar = ?', params: [2] })
		).toEqual([{ sql: 'bar = ?', params: [2] }])
		expect(
			generate.normalizeCondition({ sql: 'bar', op: '>', params: '2' })
		).toEqual([{ sql: 'bar > ?', params: ['2'] }])
	})

	it('handles array', ({ expect }) => {
		expect(generate.normalizeCondition(['bar = 2'])).toEqual([
			{ sql: 'bar = 2', params: [] },
		])
		expect(generate.normalizeCondition(['bar = 2', 'baz > 3'])).toEqual([
			{ sql: 'bar = 2', params: [] },
			{ sql: 'baz > 3', params: [] },
		])
		expect(
			generate.normalizeCondition([
				{ sql: 'bar', op: '=', params: '2' },
				'baz > 3',
			])
		).toEqual([
			{ sql: 'bar = ?', params: ['2'] },
			{ sql: 'baz > 3', params: [] },
		])
	})
})

describe('generateSelect', () => {
	it.each([
		{ name: 'empty', query: `SELECT foo.* FROM foo`, values: [] },
		{
			name: 'select',
			select: ['bar', 'baz'],
			query: `SELECT bar,baz FROM foo`,
		},
		{
			name: 'select with alias',
			select: [{ col: 'baz', name: 'bar' }],
			query: `SELECT baz AS bar FROM foo`,
		},
		{
			name: 'select with alias and cast',
			select: [{ col: 'COUNT(baz)', name: 'count', cast: 'INTEGER' as const }],
			query: `SELECT CAST(COUNT(baz) AS INTEGER) AS count FROM foo`,
		},
		{
			name: 'additional select',
			addSelect: [{ col: 'MAX(bar)', name: 'max' }],
			query: `SELECT foo.*,MAX(bar) AS max FROM foo`,
		},
		{
			name: 'raw condition',
			where: 'bar IS NULL',
			query: `SELECT foo.* FROM foo WHERE bar IS NULL`,
		},
		{
			name: 'multi conditions',
			where: ['bar = 2', 'baz = 3'],
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND baz = 3)`,
		},
		{
			name: 'nested conditions',
			where: ['bar = 2', ['baz = 3', 'baz > 69']],
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND (baz = 3 OR baz > 69))`,
		},
		{
			name: 'natural join',
			join: [{ join: 'baz' }],
			query: `SELECT foo.* FROM foo NATURAL JOIN baz`,
		},
		{
			name: 'join with name',
			join: [{ join: 'table2', name: 'bar' }],
			query: `SELECT foo.* FROM foo JOIN table2 ON table2.bar = foo.bar`,
		},
		{
			name: 'join with type',
			join: [{ join: 'table2', type: 'LEFT' as const, name: 'bar' }],
			query: `SELECT foo.* FROM foo LEFT JOIN table2 ON table2.bar = foo.bar`,
		},
		{
			name: 'join with other table',
			join: [
				{
					type: 'RIGHT' as const,
					join: 'table2',
					name: 'bar',
					table: 'table3',
					col: 'baz',
				},
			],
			query: `SELECT foo.* FROM foo RIGHT JOIN table2 ON table2.bar = table3.baz`,
		},
		{
			name: 'sort',
			sort: [{ col: 'baz' }],
			query: `SELECT foo.* FROM foo ORDER BY baz ASC NULLS LAST`,
		},
		{
			name: 'multi sort',
			sort: [
				{ col: 'bar', desc: true },
				{ col: 'baz', nullsFirst: true },
			],
			query: `SELECT foo.* FROM foo ORDER BY bar DESC NULLS LAST,baz ASC NULLS FIRST`,
		},
		{
			name: 'limit',
			take: 2,
			query: `SELECT foo.* FROM foo LIMIT 2`,
		},
		{
			name: 'offset',
			skip: 9,
			query: `SELECT foo.* FROM foo OFFSET 9`,
		},
		{
			name: 'limit & offset',
			take: 69,
			skip: 420,
			query: `SELECT foo.* FROM foo LIMIT 69 OFFSET 420`,
		},
	])(`handles $name`, ({ name, query, values, ...opts }) => {
		expect(generate.generateSelect('foo', opts)).toEqual({
			query,
			values: values ?? [],
		})
	})
})

describe('generateInsert', () => {
	it('handles empty', ({ expect }) => {
		expect(generate.generateInsert('foo', [])).toEqual({
			query: '',
			values: [],
		})
		expect(generate.generateInsert('foo', [[]])).toEqual({
			query: '',
			values: [],
		})
	})

	it('handles without cols', ({ expect }) => {
		expect(generate.generateInsert('foo', [[1, 'bar']])).toEqual({
			query: 'INSERT INTO foo VALUES (?,?)',
			values: [1, 'bar'],
		})
		expect(
			generate.generateInsert('foo', [
				[3, 'bar'],
				[4, 'baz'],
			])
		).toEqual({
			query: 'INSERT INTO foo VALUES (?,?),(?,?)',
			values: [3, 'bar', 4, 'baz'],
		})
	})

	it('handles with cols', ({ expect }) => {
		expect(
			generate.generateInsert('foo', [[1, 'bar']], { cols: ['c', 'name'] })
		).toEqual({
			query: 'INSERT INTO foo (c,name) VALUES (?,?)',
			values: [1, 'bar'],
		})
	})
})

describe('generateUpdate', () => {
	it('handles empty', ({ expect }) => {
		expect(generate.generateUpdate('foo', {})).toEqual({
			query: '',
			values: [],
		})
		expect(generate.generateUpdate('foo', { updates: {} })).toEqual({
			query: '',
			values: [],
		})
	})

	it('handles without conditions', ({ expect }) => {
		expect(
			generate.generateUpdate('foo', { updates: { bar: 1, baz: 'hi' } })
		).toEqual({
			query: 'UPDATE foo SET bar = ?, baz = ?',
			values: [1, 'hi'],
		})
	})

	it('handles with conditions', ({ expect }) => {
		expect(
			generate.generateUpdate('foo', {
				updates: { bar: 1, baz: 'hi' },
				where: { sql: 'id', op: '=', params: [2] },
			})
		).toEqual({
			query: 'UPDATE foo SET bar = ?, baz = ? WHERE id = ?',
			values: [1, 'hi', 2],
		})
	})
})

describe('generateDelete', () => {
	it('handles empty', ({ expect }) => {
		expect(generate.generateDelete('foo', {})).toEqual({
			query: 'DELETE FROM foo',
			values: [],
		})
	})

	it('handles with conditions', ({ expect }) => {
		expect(
			generate.generateDelete('foo', {
				where: { sql: 'id', op: '=', params: [2] },
			})
		).toEqual({
			query: 'DELETE FROM foo WHERE id = ?',
			values: [2],
		})
	})
})
