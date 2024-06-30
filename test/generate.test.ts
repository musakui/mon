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
		expect(generate.generateSelect('foo')).toEqual({
			query: `SELECT foo.* FROM foo`,
			values: [],
		})
	})

	it('handles selects', ({ expect }) => {
		expect(
			generate.generateSelect('foo', { select: ['bar', 'baz'] })
		).toEqual({
			query: `SELECT foo.bar,foo.baz FROM foo`,
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
				addSelect: [{ col: 'MAX(bar)', name: 'max' }],
			})
		).toEqual({
			query: `SELECT foo.*,MAX(bar) AS max FROM foo`,
			values: [],
		})
	})

	it('handles conditions', ({ expect }) => {
		expect(
			generate.generateSelect('foo', { where: 'bar IS NULL' })
		).toEqual({
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
		expect(
			generate.generateSelect('foo', { sort: [{ col: 'baz' }] })
		).toEqual({
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
		expect(
			generate.generateSelect('foo', { take: 69, skip: 420 })
		).toEqual({
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