import { describe, it } from 'vitest'
import * as util from '../lib/util.js'

describe('getInsertValues', () => {
	it('gets correctly', ({ expect }) => {
		expect(util.getInsertValues([])).toEqual([])
		expect(util.getInsertValues([{ foo: 'bar', baz: 'boom' }])).toEqual([
			{
				cols: ['baz', 'foo'],
				values: [['boom', 'bar']],
			},
		])
		expect(
			util.getInsertValues([
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

	it('gets for different keys', ({ expect }) => {
		expect(
			util.getInsertValues([
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
