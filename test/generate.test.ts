import { describe, it } from 'vitest'
import * as generate from '../lib/generate.js'

describe('joinParts', () => {
	it('joins parts correctly', ({ expect }) => {
		expect(generate.joinParts(['foo', 'bar', 'baz'])).toEqual('foo bar baz')
	})

	it('trims whitespace', ({ expect }) => {
		expect(generate.joinParts([' foo ', ' bar ', ' baz '])).toEqual('foo bar baz')
	})

	it('ignores empty components', ({ expect }) => {
		expect(generate.joinParts(['foo', '', 'bar', ' ', 'baz'])).toEqual('foo bar baz')
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
	it('gives empty default', ({ expect }) => {
		expect(generate.generateSelect('foo')).toEqual({
			query: `SELECT foo.* FROM foo`,
			values: [],
		})
	})

	it('handles selects', ({ expect }) => {
		expect(generate.generateSelect('foo', { select: ['bar', 'baz'] })).toEqual({
			query: `SELECT bar,baz FROM foo`,
			values: [],
		})
		expect(
			generate.generateSelect('foo', {
				select: [{ col: 'baz', name: 'bar' }],
			})
		).toEqual({
			query: `SELECT baz AS bar FROM foo`,
			values: [],
		})
		expect(
			generate.generateSelect('foo', {
				select: [{ col: 'COUNT(baz)', name: 'count', cast: 'INTEGER' }],
			})
		).toEqual({
			query: `SELECT CAST(COUNT(baz) AS INTEGER) AS count FROM foo`,
			values: [],
		})
		expect(
			generate.generateSelect('foo', {
				addSelect: [{ col: 'MAX(bar)', name: 'max' }],
			})
		).toEqual({
			query: `SELECT foo.*,MAX(bar) AS max FROM foo`,
			values: [],
		})
	})

	it('handles conditions', ({ expect }) => {
		expect(generate.generateSelect('foo', { where: 'bar IS NULL' })).toEqual({
			query: `SELECT foo.* FROM foo WHERE bar IS NULL`,
			values: [],
		})

		expect(
			generate.generateSelect('foo', { where: ['bar = 2', 'baz = 3'] })
		).toEqual({
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND baz = 3)`,
			values: [],
		})

		expect(
			generate.generateSelect('foo', {
				where: ['bar = 2', ['baz = 3', 'baz > 69']],
			})
		).toEqual({
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND (baz = 3 OR baz > 69))`,
			values: [],
		})
	})

	it('handles sorting', ({ expect }) => {
		expect(generate.generateSelect('foo', { sort: [{ col: 'baz' }] })).toEqual({
			query: `SELECT foo.* FROM foo ORDER BY baz ASC NULLS LAST`,
			values: [],
		})
		expect(
			generate.generateSelect('foo', {
				sort: [
					{ col: 'bar', desc: true },
					{ col: 'baz', nullsFirst: true },
				],
			})
		).toEqual({
			query: `SELECT foo.* FROM foo ORDER BY bar DESC NULLS LAST,baz ASC NULLS FIRST`,
			values: [],
		})
	})

	it('handles pagination', ({ expect }) => {
		expect(generate.generateSelect('foo', { take: 2 })).toEqual({
			query: `SELECT foo.* FROM foo LIMIT 2`,
			values: [],
		})
		expect(generate.generateSelect('foo', { skip: 9 })).toEqual({
			query: `SELECT foo.* FROM foo OFFSET 9`,
			values: [],
		})
		expect(generate.generateSelect('foo', { take: 69, skip: 420 })).toEqual({
			query: `SELECT foo.* FROM foo LIMIT 69 OFFSET 420`,
			values: [],
		})
	})
})

describe('getInsertValues', () => {
	it('generates correctly', ({ expect }) => {
		expect(generate.getInsertValues([])).toEqual([])
		expect(generate.getInsertValues([{ foo: 'bar', baz: 'boom' }])).toEqual([
			{
				cols: ['baz', 'foo'],
				values: [['boom', 'bar']],
			},
		])
		expect(
			generate.getInsertValues([
				{ a: 1, b: 2 },
				{ a: 3, b: 4 },
			])
		).toEqual([
			{
				cols: ['a', 'b'],
				values: [
					[1, 2],
					[3, 4],
				],
			},
		])
	})

	it('generates for different keys', ({ expect }) => {
		expect(
			generate.getInsertValues([
				{ a: 1, b: 2 },
				{ a: 3, b: 4, c: 5 },
				{ a: 6, b: 7 },
				{ a: 8, b: 9, c: 10 },
				{ a: 11, c: 12 },
			])
		).toEqual([
			{
				cols: ['a', 'b'],
				values: [
					[1, 2],
					[6, 7],
				],
			},
			{
				cols: ['a', 'b', 'c'],
				values: [
					[3, 4, 5],
					[8, 9, 10],
				],
			},
			{
				cols: ['a', 'c'],
				values: [[11, 12]],
			},
		])
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
