import { describe, it } from 'vitest'
import * as generate from '../lib/generate.js'

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
		expect(generate.generateSelect({ table: 'foo' })).toEqual({
			query: `SELECT foo.* FROM foo`,
			values: [],
		})
	})

	it('handles selects', ({ expect }) => {
		expect(
			generate.generateSelect({ table: 'foo', select: ['bar', 'baz'] })
		).toEqual({
			query: `SELECT foo.bar,foo.baz FROM foo`,
			values: [],
		})
		expect(
			generate.generateSelect({
				table: 'foo',
				select: [{ sel: 'baz', fn: 'MAX', name: 'max' }],
			})
		).toEqual({
			query: `SELECT MAX(foo.baz) AS max FROM foo`,
			values: [],
		})
		expect(
			generate.generateSelect({
				table: 'foo',
				addSelect: [{ sel: 'bar', fn: 'COUNT' }],
			})
		).toEqual({
			query: `SELECT foo.*,COUNT(foo.bar) FROM foo`,
			values: [],
		})
	})

	it('handles conditions', ({ expect }) => {
		expect(
			generate.generateSelect({ table: 'foo', where: 'bar IS NULL' })
		).toEqual({
			query: `SELECT foo.* FROM foo WHERE bar IS NULL`,
			values: [],
		})

		expect(
			generate.generateSelect({ table: 'foo', where: ['bar = 2', 'baz = 3'] })
		).toEqual({
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND baz = 3)`,
			values: [],
		})

		expect(
			generate.generateSelect({
				table: 'foo',
				where: ['bar = 2', ['baz = 3', 'baz > 69']],
			})
		).toEqual({
			query: `SELECT foo.* FROM foo WHERE (bar = 2 AND (baz = 3 OR baz > 69))`,
			values: [],
		})
	})

	it('handles sorting', ({ expect }) => {
		expect(
			generate.generateSelect({ table: 'foo', sort: [{ col: 'baz' }] })
		).toEqual({
			query: `SELECT foo.* FROM foo ORDER BY baz ASC NULLS LAST`,
			values: [],
		})
		expect(
			generate.generateSelect({
				table: 'foo',
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
		expect(generate.generateSelect({ table: 'foo', take: 2 })).toEqual({
			query: `SELECT foo.* FROM foo LIMIT 2`,
			values: [],
		})
		expect(generate.generateSelect({ table: 'foo', skip: 9 })).toEqual({
			query: `SELECT foo.* FROM foo OFFSET 9`,
			values: [],
		})
		expect(
			generate.generateSelect({ table: 'foo', take: 69, skip: 420 })
		).toEqual({
			query: `SELECT foo.* FROM foo LIMIT 69 OFFSET 420`,
			values: [],
		})
	})
})
