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
