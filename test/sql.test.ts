import { describe, it, expect } from 'vitest'
import { frag } from '../lib/sql.js'
import * as SQL from '../lib/sql.js'

describe('makeFragment', () => {
	it.each([
		{
			name: 'empty',
			input: SQL.makeFragment(''),
			output: [''],
		},
		{
			name: 'plain',
			input: SQL.makeFragment('test FOO 123'),
			output: ['test FOO 123'],
		},
		{
			name: 'with params',
			input: SQL.makeFragment(`test ? hi ?`, 'FOO', 123),
			output: ['test ? hi ?', 'FOO', 123],
		},
	])(`handles $name`, ({ input, output }) => {
		expect(SQL.readFragment(input)).toEqual(output)
	})
})

describe('frag template tag', () => {
	it.each([
		{
			name: 'empty',
			input: frag``,
			output: [''],
		},
		{
			name: 'plain',
			input: frag`test BAR 456`,
			output: ['test BAR 456'],
		},
		{
			name: 'with params',
			input: frag`test ${''} hi ${0}`,
			output: ['test ? hi ?', '', 0],
		},
		{
			name: 'nested',
			input: frag`test ${frag`another`} hi ${frag`hello ${123} ${frag`deep`} ${'abc'}`}`,
			output: ['test another hi hello ? deep ?', 123, 'abc'],
		},
	])(`handles $name`, ({ input, output }) => {
		expect(SQL.readFragment(input)).toEqual(output)
	})
})

describe('fromArray', () => {
	it.each([
		{
			name: 'empty',
			input: SQL.fromArray([]),
			output: [''],
		},
		{
			name: 'single literal',
			input: SQL.fromArray([1]),
			output: ['?', 1],
		},
		{
			name: 'single frag',
			input: SQL.fromArray([frag`foo`]),
			output: ['foo'],
		},
		{
			name: 'mixed',
			input: SQL.fromArray([frag`foo`, 0, frag`BAR`, '', frag`Baz`]),
			output: ['foo,?,BAR,?,Baz', 0, ''],
		},
		{
			name: 'custom glue',
			input: SQL.fromArray([frag`Foo`, 'BAZ', frag`bar`], ' '),
			output: ['Foo ? bar', 'BAZ'],
		},
		{
			name: 'nested',
			input: SQL.fromArray([frag`a ${1}`, frag`12 ${'a'}`]),
			output: ['a ?,12 ?', 1, 'a'],
		},
	])(`handles $name`, ({ input, output }) => {
		expect(SQL.readFragment(input)).toEqual(output)
	})
})

describe('fromObject', () => {
	it.each([
		{
			name: 'empty',
			input: SQL.fromObject({}),
			output: [''],
		},
		{
			name: 'literals',
			input: SQL.fromObject({ foo: '', baz: 0, zzz: undefined }),
			output: ['foo=?,baz=?', '', 0],
		},
		{
			name: 'fragments',
			input: SQL.fromObject({ foo: frag`bar ${2}`, zzz: frag`${'abc'} test` }),
			output: ['foo=bar ?,zzz=? test', 2, 'abc'],
		},
		{
			name: 'filtering keys',
			input: SQL.fromObject({ foo: 1, danger: 2, ok: '3' }, ['foo', 'ok']),
			output: ['foo=?,ok=?', 1, '3'],
		},
		{
			name: 'custom glue',
			input: SQL.fromObject({ foo: 'hey', bar: 123 }, undefined, ' AND '),
			output: ['foo=? AND bar=?', 'hey', 123],
		},
	])(`handles $name`, ({ input, output }) => {
		expect(SQL.readFragment(input)).toEqual(output)
	})
})
