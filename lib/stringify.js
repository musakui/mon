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
 * stringify column option
 *
 * @param {import('./types').QueryColOption} s
 */
export const stringifyColOption = (s) => {
	if (!s.name && !s.cast) return s.col
	return [s.col, s.name || '', ...(s.cast ? [s.cast] : [])].join(':')
}

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
 * stringify inner condition
 *
 * @param {import('./types').QueryCondition[]} conds
 */
export const stringifyInnerCondition = (conds) => {
	return conds
		.flatMap((cd) => {
			if (!cd || isStr(cd)) return []
			if (Array.isArray(cd)) return [] // too nested

			const [code, param] = stringifyOpParams(cd.op, cd.params)
			if (!code) return []

			return cd.op === '='
				? [`${cd.sql}:${param}`]
				: [`${cd.sql}__${code}:${param}`]
		})
		.join(_p.conditionDelimiter)
}

/**
 * @param {import('./types').QueryCondition} [s]
 */
export function* stringifyCondition(s) {
	if (!s) {
		//
	} else if (isStr(s)) {
		yield pp(_p.whereRawKey, s)
	} else if (Array.isArray(s)) {
		for (const cond of s) {
			if (!cond || isStr(cond)) continue
			if (Array.isArray(cond)) {
				for (const cd of cond) {
					if (!cd || isStr(cd)) continue
					if (Array.isArray(cd)) {
						yield pp(_p.whereKey, stringifyInnerCondition(cd))
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
		const [code, p] = stringifyOpParams(s.op, s.params)
		if (code) {
			const val = s.op === '=' ? `${s.sql}:${p}` : `${s.sql}__${code}:${p}`
			yield pp(_p.whereKey, val)
		}
	}
}

/**
 * @param {import('./types').QueryCondition} [s]
 */
export function* stringifyHavingCondition(s) {
	if (!s) {
		//
	} else if (isStr(s)) {
		yield pp(_p.havingRawKey, s)
	} else if (Array.isArray(s)) {
		for (const cond of s) {
			if (!cond || isStr(cond)) continue
			if (Array.isArray(cond)) {
				yield pp(_p.havingKey, stringifyInnerCondition(cond))
			}
			// cannot handle raw at this layer
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
export const stringifyJoins = (joins) => {
	if (!joins?.length) return []
	return joins.map((jn) => {
		const parts = [
			jn.join,
			jn.name || '',
			...(jn.col ? [jn.col] : []),
			...(jn.table ? [jn.table] : []),
		]
		return pp(getJoinKey(jn.type), parts.join(':'))
	})
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
 * @param {import('./types').SelectStatementOptions} [opts]
 */
export const stringifySelectOptions = (opts) => {
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
		...(opts.group ?? []).map((s) => pp(_p.groupKey, stringifyColOption(s))),
		...stringifyHavingCondition(opts.having),
		...(opts.sort ?? []).map((s) => {
			return pp(_p.sortKey, `${getSortPrefix(s)}${s.col}`)
		}),
		...stringifyPagination(opts.take, opts.skip),
	]
}
