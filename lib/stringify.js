// @ts-check

import * as _p from './param.js'
import { isStr } from './util.js'
import { stringifyOpParams } from './operator.js'

/** @typedef {[string, string]} ParamPair */

/**
 * for casting key value pairs
 *
 * @param {string} k
 * @param {string} v
 * @return {ParamPair}
 */
const pp = (k, v) => [k, v]

/**
 * @param {(string | undefined)[]} arr
 */
export const joinArray = (arr) => {
	const last = arr.findLastIndex((s) => s)
	if (last === -1) return ''
	return arr
		.slice(0, last + 1)
		.map((s) => s || '')
		.join(_p.arrayDelimiter)
}

/**
 * stringify column option
 *
 * @param {import('./types').QueryColOption} s
 */
export const stringifyColOption = (s) => joinArray([s.col, s.name, s.cast])

/**
 * get prefix for sort parameter
 *
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
 * stringify single condition
 *
 * @param {import('./types').QueryCondition} cond
 */
export const stringifySingleCondition = (cond) => {
	if (!cond) return null
	if (Array.isArray(cond)) return null // too nested

	const [code, param] = stringifyOpParams(cond.op, cond.params)
	if (!code) return null

	return cond.op === '='
		? `${cond.sql}:${param}`
		: `${cond.sql}__${code}:${param}`
}

/**
 * stringify inner condition
 *
 * @param {import('./types').QueryCondition[]} conds
 */
export const stringifyInnerConditions = (conds) => {
	return conds
		.flatMap((cond) => {
			const cd = stringifySingleCondition(cond)
			return cd ? [cd] : []
		})
		.join(_p.conditionDelimiter)
}

/**
 * @param {string | import('./types').QueryCondition} [s]
 */
export function* stringifyCondition(s) {
	if (!s) {
		//
	} else if (isStr(s)) {
		yield pp(_p.whereRawKey, s)
	} else if (Array.isArray(s)) {
		for (const cond of s) {
			if (!cond) continue
			if (Array.isArray(cond)) {
				for (const cd of cond) {
					if (!cd || isStr(cd)) continue
					if (Array.isArray(cd)) {
						yield pp(_p.whereKey, stringifyInnerConditions(cd))
					} else {
						const ccd = stringifySingleCondition(cd)
						if (ccd) yield pp(_p.whereKey, ccd)
					}
				}
				continue
			}
			// top level raw condition
			const [code, param] = stringifyOpParams(cond.op, cond.params)
			if (!code) continue
			yield pp(cond.op === '=' ? cond.sql : `${cond.sql}__${code}`, param)
		}
	} else {
		const cond = stringifySingleCondition(s)
		if (cond) yield pp(_p.whereKey, cond)
	}
}

/**
 * @param {string | import('./types').QueryCondition} [s]
 */
export function* stringifyHavingCondition(s) {
	if (!s) {
		//
	} else if (isStr(s)) {
		yield pp(_p.havingRawKey, s)
	} else if (Array.isArray(s)) {
		for (const cond of s) {
			if (!cond) continue
			if (Array.isArray(cond)) {
				yield pp(_p.havingKey, stringifyInnerConditions(cond))
			} else {
				const cd = stringifySingleCondition(cond)
				if (cd) yield pp(_p.havingKey, cd)
			}
		}
	} else {
		const [code, p] = stringifyOpParams(s.op, s.params)
		if (code) {
			const val = s.op === '=' ? `${s.sql}:${p}` : `${s.sql}__${code}:${p}`
			yield pp(_p.havingKey, val)
		}
	}
}

/**
 * get join key for join type
 *
 * @param {import('./types').JoinType} [jt]
 */
export const getJoinKey = (jt) => {
	if (jt === 'FULL') return _p.fullJoinKey
	if (jt === 'LEFT') return _p.leftJoinKey
	if (jt === 'RIGHT') return _p.rightJoinKey
	return _p.joinKey
}

/**
 * stringify join options
 *
 * @param {import('./types').QueryJoinOption[]} [joins]
 */
export function* stringifyJoins(joins) {
	for (const jn of joins ?? []) {
		const val = joinArray([jn.join, jn.name, jn.col, jn.table])
		if (val) yield pp(getJoinKey(jn.type), val)
	}
}

/**
 * stringify pagination options
 *
 * @param {number} [take]
 * @param {number} [skip]
 * @param {boolean} [nopage] force offset option even if skip is a multiple of take
 */
export const stringifyPagination = (take, skip, nopage) => {
	if (take) {
		const limit = pp(_p.limitKey, `${take}`)
		if (!skip) return [limit]
		return [
			limit,
			nopage || skip % take
				? pp(_p.offsetKey, `${skip}`)
				: pp(_p.pageKey, `${skip / take + 1}`),
		]
	}
	return skip ? [pp(_p.offsetKey, `${skip}`)] : []
}

/**
 * stringify SELECT options
 *
 * @param {import('./types').SelectStatementOptions} [opts]
 */
export function stringifySelectOptions(opts) {
	if (!opts) return []
	return [
		...(opts.select ?? []).map((s) => {
			return pp(_p.colsKey, isStr(s) ? s : stringifyColOption(s))
		}),
		...(opts.addSelect ?? []).map((s) => {
			return pp(_p.additionalKey, stringifyColOption(s))
		}),
		...stringifyCondition(opts.where),
		...stringifyJoins(opts.join),
		...(opts.group ?? []).map((s) => pp(_p.groupKey, s)),
		...stringifyHavingCondition(opts.having),
		...(opts.sort ?? []).map((s) => {
			return pp(_p.sortKey, `${getSortPrefix(s)}${s.col}`)
		}),
		...stringifyPagination(opts.take, opts.skip),
	]
}
