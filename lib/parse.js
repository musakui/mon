// @ts-check

import * as _p from './param.js'
import { getOp } from './operator.js'

/**
 * @param {unknown} val
 * @param {number} fallback
 */
export const getInt = (val, fallback = 0) => {
	const v = parseInt(`${val}`)
	return Number.isNaN(v) ? fallback : v
}

/**
 * process param array
 *
 * @template ResultType
 * @param {URLSearchParams} params query params
 * @param {string} key query param key
 * @param {(s: string) => ResultType} fn process function
 */
export const getAll = (params, key, fn) => {
	return params.getAll(key).flatMap((qs) => {
		const s = fn(qs)
		return s ? [s] : []
	})
}

/**
 * @param {string} qs
 */
export const parseSelectOption = (qs) => {
	const [sel, fn, name] = qs.split(':')
	if (!sel) return null

	return /** @type {import('./types').QueryColOption} */ ({
		sel,
		...(fn ? { fn } : null),
		...(name ? { name } : null),
	})
}

/**
 * @param {string} qs
 */
export const parseConditionOption = (qs) => {
	const whc = qs.split(_p.conditionDelimiter).filter((c) => c)
	if (!whc.length) return null
	const condReg = /^(.+?)(?:__([A-Za-z]{2}))?:(.+)$/
	return whc.map((c) => {
		const m = c.match(condReg)
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
 * @param {string} key
 * @param {string} value
 */
export const parseConditionKeyVal = (key, value) => {
	const m = key.match(/^(.+?)(?:__([A-Za-z]{2}))$/)
	if (!m) return null
	const op = getOp(m[2])
	if (!op) return null
	return /** @type {import('./types').RawCondition} */ ({
		sql: m[1],
		op,
		params: value,
	})
}

/**
 * @param {string} qs
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
 * set join type
 * @param {import('./types').QueryJoinOption[]} joins
 * @param {import('./types').JoinType} type
 * @return {import('./types').QueryJoinOption[]}
 */
export const joinType = (joins, type) => joins.map((j) => ({ ...j, type }))

/**
 * @param {string} qs
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
 * @param {URLSearchParams} params
 * @param {Set<string>} [cols]
 */
export function* parseColCondition(params, cols) {
	for (const [k, v] of params) {
		if (cols?.has(k) || (!cols && k[0] !== '_')) {
			yield { sql: k, op: '=', params: [v] }
			continue
		}
		const cond = parseConditionKeyVal(k, v)
		if (cond) yield cond
	}
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
 * @param {URLSearchParams} params
 */
export const parseSelectQuery = (params) => {
	const select = getAll(params, _p.colsKey, parseSelectOption)
	const addSelect = getAll(params, _p.additionalKey, parseSelectOption)

	const wWhere = getAll(params, _p.whereKey, parseConditionOption)
	const where = [
		...parseColCondition(params),
		...(wWhere.length ? [wWhere] : []),
	]

	const join = [
		...getAll(params, _p.joinKey, parseJoinOption),
		...joinType(getAll(params, _p.fullJoinKey, parseJoinOption), 'FULL'),
		...joinType(getAll(params, _p.leftJoinKey, parseJoinOption), 'LEFT'),
		...joinType(getAll(params, _p.rightJoinKey, parseJoinOption), 'RIGHT'),
	]

	const group = getAll(params, _p.groupKey, parseSelectOption)
	const having = getAll(params, _p.havingKey, parseConditionOption)

	const sort = getAll(params, _p.sortKey, parseSortOption)

	return /** @type {Omit<import('./types').SelectStatementOptions, 'table'>} */ ({
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

/**
 * @template {Record<string, unknown>} const ItemType
 *
 * @param {ItemType[]} items
 */
export const parseInsertItems = (items) => {
	if (!Array.isArray(items)) throw new Error('items required')

	/** @type {Map<string, { cols: Array<keyof ItemType>, items: ItemType[] }>} */
	const itemMap = new Map()

	for (const item of items) {
		const cols = Object.keys(item).sort()
		const kk = cols.join(',')
		const list = itemMap.get(kk)
		if (list) {
			list.items.push(item)
		} else {
			itemMap.set(kk, { cols, items: [item] })
		}
	}

	return [...itemMap.values()].map(({ cols, items }) => ({
		cols,
		values: items.map((item) => cols.map((k) => item[k])),
	}))
}
