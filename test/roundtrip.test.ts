import { describe, it, expect } from 'vitest'
import { stringifySelectOptions } from '../lib/stringify.js'
import { parseSelectOptions } from '../lib/parse.js'

describe('round trip conversions', () => {
	it.each([
		{ name: 'empty' },
		{ name: 'select', select: [{ col: 'foo' }, { col: 'bar' }] },
		{ name: 'select with alias', select: [{ col: 'foo', name: 'bar' }] },
		{
			name: 'select with cast',
			select: [{ col: 'foo', cast: 'INTEGER' as const }],
		},
		{ name: 'additionalSelect', addSelect: [{ col: 'foo' }] },
		{ name: 'where', where: [{ sql: 'foo', op: '=', params: 'bar' }] },
		{
			name: 'where complex',
			where: [
				{ sql: 'id', op: '>', params: '2' },
				[
					[{ sql: 'a0', op: 'ISNULL', params: '_' }],
					[
						{ sql: 'b1', op: '<', params: '123' },
						{ sql: 'b2', op: '>=', params: '456' },
					],
				],
			],
		},
		{ name: 'sorting', sort: [{ col: 'foo' }, { col: 'bar', desc: true }] },
		{ name: 'pagination take', take: 420 },
		{ name: 'pagination skip', skip: 69 },
		{ name: 'pagination page', skip: 10, take: 5 },
		{ name: 'pagination skip & take', skip: 420, take: 69 },
	])(`handles $name`, ({ name, ...opts }) => {
		const qs = `${new URLSearchParams(stringifySelectOptions(opts))}`
		const parsed = parseSelectOptions(new URLSearchParams(qs))
		expect(parsed).toEqual(opts)
	})
})
