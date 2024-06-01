import { describe, it } from 'vitest'
import * as str from '../lib/stringify.js'
import type { SelectStatementOptions } from '../lib/types.js'

const sSel = (stmt: SelectStatementOptions) => {
	return `${new URLSearchParams(str.stringifySelectOptions(stmt))}`
}

describe('stringifySelectStatement', () => {
	it('stringifies empty', ({ expect }) => {
		expect(sSel({})).toBe('')
	})

	it('stringifies select', ({ expect }) => {
		expect(sSel({ select: ['foo', 'bar'] })).toBe('_c=foo&_c=bar')

		expect(sSel({ select: [{ col: 'foo', name: 'bar' }] })).toBe('_c=foo%3Abar')

		expect(sSel({ addSelect: [{ col: 'MAX(foo)', name: 'max' }] })).toBe(
			'_a=MAX%28foo%29%3Amax'
		)
	})

	it('stringifies sorting', ({ expect }) => {
		expect(sSel({ sort: [{ col: 'foo' }] })).toBe('_s=foo')
		expect(
			sSel({
				sort: [
					{ col: 'a' },
					{ col: 'b', desc: true },
					{ col: 'c', desc: true, nullsFirst: true },
					{ col: 'd', nullsFirst: true },
				],
			})
		).toBe('_s=a&_s=-b&_s=_c&_s=%5Ed')
	})

	it('stringifies pagination', ({ expect }) => {
		expect(sSel({ take: 69 })).toBe('_l=69')
		expect(sSel({ skip: 420 })).toBe('_o=420')
		expect(sSel({ skip: 69, take: 420 })).toBe('_l=420&_o=69')
		expect(sSel({ skip: 20, take: 10 })).toBe('_l=10&_p=3')
	})
})
