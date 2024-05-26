// @ts-check

import * as _p from './param.js'
import { isStr } from './util.js'

/**
 * @param {import('./types').QueryColOption} s
 */
export const stringifyColOption = (s) => {
	if (!s.fn && !s.name) return s.sel
	return [s.sel, s.fn || '', ...(s.name ? [s.name] : [])].join(':')
}

/**
 * @param {import('./types').QuerySortOption} s
 */
export const getSortPrefix = (s) => {
	return s.desc
		? s.nullsFirst
			? _p.descNullsPrefix
			: _p.descPrefix
		: s.nullsFirst
		? _p.ascNullsPrefix
		: ''
}

/**
 * @param {import('./types').SelectStatementOptions} stmt
 */
export const stringifySelectStatement = (stmt) => {
	return new URLSearchParams([
		...(stmt.select ?? []).map((c) => [
			_p.colsKey,
			isStr(c) ? c : stringifyColOption(c),
		]),
		...(stmt.sort ?? []).map((s) => [
			_p.sortKey,
			`${getSortPrefix(s)}${s.col}`,
		]),
		...(stmt.take ? [[_p.limitKey, `${stmt.take}`]] : []),
		...(stmt.skip ? [[_p.offsetKey, `${stmt.skip}`]] : []),
	])
}
