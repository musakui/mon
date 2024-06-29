// @ts-check

import { isStr } from './util.js'
import { processOpParams } from './operator.js'

/** @param {string[]} parts */
export const joinParts = (parts) => {
	return parts
		.flatMap((s) => {
			const z = s.trim()
			return z ? [z] : []
		})
		.join(' ')
		.trim()
}

/**
 * combine multiple conditions into 1
 *
 * @param {import('./types').BaseCondition[]} conditions
 * @param {boolean} [disjunct] combine with `OR` (otherwise `AND`)
 */
export const combineConditions = (conditions, disjunct) => {
	const fc = conditions.flatMap((c) => (c.sql ? [c] : []))
	const z = fc.map((c) => c.sql)
	return /** @type {import('./types').BaseCondition} */ ({
		sql: z.length > 1 ? `(${z.join(disjunct ? ' OR ' : ' AND ')})` : z[0],
		params: fc.flatMap((c) => c.params),
	})
}

/**
 * @param {import('./types').QueryCondition} [cond]
 * @param {boolean} [disjunct]
 * @return {import('./types').BaseCondition[]}
 */
export const normalizeCondition = (cond, disjunct) => {
	if (!cond) return []
	if (isStr(cond)) return [{ sql: cond, params: [] }]
	if (!Array.isArray(cond)) {
		if (!cond.sql) return []
		if (!cond.op) {
			const p = cond.params
			return [{ sql: cond.sql, params: isStr(p) ? [p] : p ?? [] }]
		}
		const [op, ...params] = processOpParams(cond.op, cond.params)
		return [{ sql: `${cond.sql} ${op}`, params }]
	}
	const d = !disjunct
	return cond.flatMap((cond) => {
		const conds = combineConditions(normalizeCondition(cond, d), d)
		return conds.sql ? [conds] : []
	})
}

/**
 * @param {import('./types').QueryColOption} col
 * @param {string} table
 */
export const generateCol = (col, table) => {
	const s = `${col.table || table}.${col.sel}`
	return `${col.fn ? `${col.fn}(${s})` : s}${col.name ? ` AS ${col.name}` : ''}`
}

/**
 * generate SELECT query
 *
 * @param {import('./types').SelectStatementOptions} opts
 */
export const generateSelect = (opts) => {
	const table = opts?.table
	if (!table) throw new Error('table name required')

	const select = opts.select?.map((c) => {
		return isStr(c) ? `${table}.${c}` : generateCol(c, table)
	})

	const addSelect = opts.addSelect?.map((c) => generateCol(c, table))

	const conditions = combineConditions(normalizeCondition(opts.where))

	const joins = opts.join?.map((jn) => {
		const head = `${jn.type ? `${jn.type} ` : ''}JOIN ${jn.join}`
		if (jn.cond) return `${head} ON ${jn.cond}`
		if (!jn.name) return `NATURAL ${head}`
		const other = `${jn.table || table}.${jn.col || jn.name}`
		return `${head} ON ${jn.join}.${jn.name} = ${other}`
	})

	const group = opts.group?.map((c) => generateCol(c, table))

	// HAVING will start with OR
	const having = combineConditions(normalizeCondition(opts.having), true)

	const order = opts.sort?.map((s) => {
		const nu = s.nullsFirst ? 'FIRST' : 'LAST'
		return `${s.col} ${s.desc ? 'DESC' : 'ASC'} NULLS ${nu}`
	})

	const query = joinParts([
		`SELECT${opts.distinct ? ' DISTINCT' : ''}`,
		`${select?.length ? select.join(',') : `${table}.*`}${
			addSelect?.length ? `,${addSelect.join(',')}` : ''
		}`,
		'FROM',
		table,
		joins?.join(' ') ?? '',
		conditions.sql ? `WHERE ${conditions.sql}` : '',
		group?.length ? `GROUP BY ${group.join(',')}` : '',
		having.sql ? `HAVING ${having.sql}` : '',
		order?.length ? `ORDER BY ${order.join(',')}` : '',
		opts.take ? `LIMIT ${opts.take}` : '',
		opts.skip ? `OFFSET ${opts.skip}` : '',
	])

	return { query, values: [...conditions.params, ...having.params] }
}

/**
 * generate INSERT INTO query
 *
 * @param {import('./types').InsertStatementOptions} opts
 */
export const generateInsert = (opts) => {
	if (!opts?.table) throw new Error('table name required')

	const cols = opts.cols ?? opts.values[0]
	const clen = cols.length
	const valq = `(${cols.map(() => '?').join(',')})`
	const vals = opts.values.map((vs) => {
		if (vs.length !== clen) throw new Error('value length mismatch')
		return valq
	})

	const query = joinParts([
		`INSERT${opts.action ? ` OR ${opts.action}` : ''}`,
		'INTO',
		opts.table,
		`(${cols.join(',')})`,
		'VALUES',
		vals.join(','),
		opts.upsert === true ? 'ON CONFLICT DO NOTHING' : '',
	])

	return { query, values: opts.values.flatMap((vs) => vs) }
}

/**
 * generate DELETE query
 *
 * @param {import('./types').DeleteStatementOptions} opts
 */
export const generateDelete = (opts) => {
	if (!opts?.table) throw new Error('table name required')

	const conditions = combineConditions(normalizeCondition(opts.where))

	const query = joinParts([
		`DELETE FROM`,
		opts.table,
		conditions.sql ? `WHERE ${conditions.sql}` : '',
	])

	return { query, values: conditions.params }
}
