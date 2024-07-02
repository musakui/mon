import { describe, it, expect } from 'vitest'
import * as str from '../lib/stringify.js'

describe('stringifySelectOptions', () => {
	it.each([
		{ name: 'empty', result: '' },
		{ name: 'select', select: ['foo', 'bar'], result: '_c=foo&_c=bar' },
		{
			name: 'select with alias',
			select: [{ col: 'foo', name: 'bar' }],
			result: '_c=foo%3Abar',
		},
		{
			name: 'select with alias & cast',
			select: [{ col: 'COUNT(foo)', name: 'count', cast: 'INTEGER' as const }],
			result: '_c=COUNT%28foo%29%3Acount%3AINTEGER',
		},
		{
			name: 'additional select',
			addSelect: [{ col: 'MAX(foo)', name: 'max' }],
			result: '_a=MAX%28foo%29%3Amax',
		},
		{
			name: 'top level condition',
			where: { sql: 'foo', op: '=', params: 'bar' },
			result: '_w=foo%3Abar',
		},
		{
			name: 'top level comdition (ii)',
			where: { sql: 'foo', op: '<=', params: '2' },
			result: '_w=foo__le%3A2',
		},
		{
			name: 'keyval condition',
			where: [{ sql: 'foo', op: '=', params: 'bar' }],
			result: 'foo=bar',
		},
		{
			name: 'nested condition',
			where: [[[{ sql: 'foo', op: '=', params: 'bar' }]]],
			result: '_w=foo%3Abar',
		},

		{
			name: 'keval conditions',
			where: [
				{ sql: 'foo', op: '<=', params: '2' },
				{ sql: 'bar', op: '=', params: 'baz' },
			],
			result: 'foo__le=2&bar=baz',
		},
		{
			name: 'complex conditions',
			where: [
				{ sql: 'id', op: '>', params: '1' },
				[
					[
						{ sql: 'foo', op: '<=', params: '2' },
						{ sql: 'bar', op: '=', params: 'hi' },
					],
					[{ sql: 'baz', op: 'ISNULL', params: '' }],
				],
			],
			result: 'id__gt=1&_w=foo__le%3A2%2Cbar%3Ahi&_w=baz__nu%3A_',
		},
		{ name: 'group', group: ['foo'], result: '_g=foo' },
		{ name: 'simple sort', sort: [{ col: 'foo' }], result: '_s=foo' },
		{
			name: 'multi sort',
			sort: [
				{ col: 'a' },
				{ col: 'b', desc: true },
				{ col: 'c', desc: true, nullsFirst: true },
				{ col: 'd', nullsFirst: true },
			],
			result: '_s=a&_s=-b&_s=_c&_s=%5Ed',
		},
		{ name: 'limit', take: 69, result: '_l=69' },
		{ name: 'offset', skip: 420, result: '_o=420' },
		{ name: 'limit and offset', skip: 69, take: 420, result: '_l=420&_o=69' },
		{ name: 'page', skip: 20, take: 10, result: '_l=10&_p=3' },
	])(`handles $name`, ({ name, result, ...opts }) => {
		const qs = new URLSearchParams(str.stringifySelectOptions(opts))
		expect(`${qs}`).toBe(result)
	})
})
