// @ts-check

import * as _p from './param.js'
import { getOp } from './operator.js'

const keyConditionRegex = /^(.+?)(?:__([A-Za-z]{2,3}))$/
const innerConditionRegex = /^(.+?)(?:__([A-Za-z]{2,3}))?:(.+)$/

/**
 * parse an integer from an unknown value
 *
 * @param {unknown} val
 * @param {number} fallback
 */
export const getInt = (val, fallback = 0) => {
	const v = parseInt(`${val}`)
	return Number.isNaN(v) ? fallback : v
}

/**
 * process search params with the given key
 *
 * @template ResultType
 * @param {URLSearchParams} params
 * @param {string} key search param key
 * @param {(s: string) => ResultType} fn process function
 */
export const getAll = (params, key, fn) => {
	return params.getAll(key).flatMap((qs) => {
		const s = fn(qs)
		return s ? [s] : []
	})
}

/**
 * parse result-column with optional alias
 *
 * @param {string} qs search param value
 */
export const parseColOption = (qs) => {
	const [col, name, cast] = qs.split(':')
	if (!col) return null

	return /** @type {import('./types').QueryColOption} */ ({
		col,
		...(name ? { name } : null),
		...(cast ? { cast } : null),
	})
}

/**
 * parse an embedded conditional list
 *
 * @param {string} qs search param value
 */
export const parseConditionOption = (qs) => {
	const whc = qs.split(_p.conditionDelimiter).filter((c) => c)
	if (!whc.length) return null
	return whc.map((c) => {
		const m = innerConditionRegex.exec(c)
		if (!m) throw new Error(`invalid condition "${c}"`)
		const op = getOp(m[2]?.toLowerCase() || 'eq')
		if (!op) throw new Error(`unknown operator "${m[2]}"`)
		return /** @type {import('./types').RawCondition} */ ({
			sql: m[1],
			op,
			params: m[3],
		})
	})
}

/**
 * parse a conditional from a key value pair
 *
 * @param {string} key search param key
 * @param {string} value search param value
 * @param {Set<string>} [cols] optional set of column names to match
 */
export const parseConditionKeyVal = (key, value, cols) => {
	const m = keyConditionRegex.exec(key)
	if (!m) return null
	if (cols && !cols.has(m[1])) return null
	const op = getOp(m[2])
	if (!op) return null
	return /** @type {import('./types').RawCondition} */ ({
		sql: m[1],
		op,
		params: value,
	})
}

/**
 * parse a table join
 *
 * @param {string} qs search param value
 */
export const parseJoinOption = (qs) => {
	const [join, name, col, table] = qs.split(':')

	if (!join) return null

	return /** @type {import('./types').QueryJoinOption} */ ({
		join,
		...(name ? { name } : null),
		...(col ? { col } : null),
		...(table ? { table } : null),
	})
}

/**
 * set the join type of a join options list
 *
 * @param {import('./types').QueryJoinOption[]} joins
 * @param {import('./types').JoinType} type
 * @return {import('./types').QueryJoinOption[]}
 */
export const joinType = (joins, type) => joins.map((j) => ({ ...j, type }))

/**
 * parse ordering option
 *
 * @param {string} qs search param value
 */
export const parseSortOption = (qs) => {
	if (!qs) return null
	const dsc = qs[0] === _p.descPrefix
	const anf = qs[0] === _p.ascNullsPrefix
	const dnf = qs[0] === _p.descNullsPrefix
	const col = dsc || anf || dnf ? qs.slice(1) : qs
	if (!col) return null
	const desc = dsc || dnf
	const nullsFirst = anf || dnf
	return /** @type {import('./types').QuerySortOption} */ ({
		col,
		...(desc ? { desc } : null),
		...(nullsFirst ? { nullsFirst } : null),
	})
}

/**
 * parse pagination options
 *
 * page param will be ignored if offset param is specified
 *
 * @param {URLSearchParams} params
 */
export const parsePagination = (params) => {
	const off = getInt(params.get(_p.offsetKey))
	const take = getInt(params.get(_p.limitKey))
	const skip = off || (getInt(params.get(_p.pageKey), 1) - 1) * take

	return {
		...(take ? { take } : null),
		...(skip ? { skip } : null),
	}
}

/**
 * look through search params for key value conditions
 *
 * @param {URLSearchParams} params
 * @param {Set<string>} [cols] optional set of column names to match
 */
export function* findConditions(params, cols) {
	for (const [k, v] of params) {
		const cond = parseConditionKeyVal(k, v)
		if (cond) {
			yield cond
			continue
		}
		if (cols?.has(k) || (!cols && k[0] !== '_')) {
			yield { sql: k, op: '=', params: v }
			continue
		}
	}
}

/**
 * @param {URLSearchParams} params
 */
export const getRawWhere = (params) => params.get(_p.whereRawKey)

/**
 * @param {URLSearchParams} params
 */
export const getRawHaving = (params) => params.get(_p.havingRawKey)

/**
 * parse SELECT options from URLSearchParams
 *
 * @param {URLSearchParams} params
 */
export function parseSelectOptions(params) {
	const select = getAll(params, _p.colsKey, parseColOption)
	const addSelect = getAll(params, _p.additionalKey, parseColOption)

	const wWhere = getAll(params, _p.whereKey, parseConditionOption)
	const where = [
		...findConditions(params),
		...(wWhere.length ? [wWhere] : []),
	]

	const join = [
		...getAll(params, _p.joinKey, parseJoinOption),
		...joinType(getAll(params, _p.fullJoinKey, parseJoinOption), 'FULL'),
		...joinType(getAll(params, _p.leftJoinKey, parseJoinOption), 'LEFT'),
		...joinType(getAll(params, _p.rightJoinKey, parseJoinOption), 'RIGHT'),
	]

	const group = getAll(params, _p.groupKey, (s) => s.trim())
	const having = getAll(params, _p.havingKey, parseConditionOption)

	const sort = getAll(params, _p.sortKey, parseSortOption)

	return /** @type {import('./types').SelectStatementOptions} */ ({
		...(select.length ? { select } : {}),
		...(addSelect.length ? { addSelect } : {}),
		...(where.length ? { where } : {}),
		...(join.length ? { join } : {}),
		...(group.length ? { group } : {}),
		...(having.length ? { having } : {}),
		...(sort.length ? { sort } : {}),
		...parsePagination(params),
	})
}
