// @ts-check

import { isStr } from './util.js'
import { processOpParams } from './operator.js'

/** @typedef {{ sql: string, params: unknown[] }} Condition */

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
 * @param {Condition[]} conditions
 * @param {boolean} [disjunct] combine with `OR` (otherwise `AND`)
 * @return {Condition}
 */
export const combineConditions = (conditions, disjunct) => {
	const fc = conditions.flatMap((c) => (c.sql ? [c] : []))
	if (!fc.length) return { sql: '', params: [] }
	const z = fc.map((c) => c.sql)
	return {
		sql: z.length > 1 ? `(${z.join(disjunct ? ' OR ' : ' AND ')})` : z[0],
		params: fc.flatMap((c) => c.params),
	}
}

/**
 * recursively convert a QueryCondition into Conditions
 *
 * @param {import('./types').QueryCondition} [cond]
 * @param {boolean} [disjunct]
 * @return {Condition[]}
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
 * @param {import('./types').QueryColOption} c
 */
export const generateCol = (c) => {
	const s = c.cast ? `CAST(${c.col} AS ${c.cast})` : c.col
	return `${s}${c.name ? ` AS ${c.name}` : ''}`
}

/**
 * @param {import('./types').QueryJoinOption} jn
 * @param {string} table
 */
export const generateJoin = (jn, table) => {
	const head = `${jn.type ? `${jn.type} ` : ''}JOIN ${jn.join}`
	if (jn.cond) return `${head} ON ${jn.cond}`
	if (!jn.name) return `NATURAL ${head}`
	const other = `${jn.table || table}.${jn.col || jn.name}`
	return `${head} ON ${jn.join}.${jn.name} = ${other}`
}

/**
 * @param {import('./types').QuerySortOption} st
 */
export const generateSort = (st) => {
	const nu = st.nullsFirst ? 'FIRST' : 'LAST'
	return `${st.col} ${st.desc ? 'DESC' : 'ASC'} NULLS ${nu}`
}

/**
 * generate SQL for SELECT query
 *
 * @param {string} table table name
 * @param {import('./types').SelectStatementOptions} [opts]
 */
export function generateSelect(table, opts) {
	if (!table) throw new Error('table name required')

	const select = opts?.select?.map((c) => (isStr(c) ? c : generateCol(c)))
	const addSelect = opts?.addSelect?.map(generateCol)

	const joins = opts?.join?.map((jn) => generateJoin(jn, table))

	const conditions = combineConditions(normalizeCondition(opts?.where))

	// HAVING will start with OR at first layer
	const having = combineConditions(normalizeCondition(opts?.having), true)

	const order = opts?.sort?.map(generateSort)

	const query = joinParts([
		'SELECT',
		opts?.distinct ? 'DISTINCT' : '',
		`${select?.length ? select.join(',') : `${table}.*`}${
			addSelect?.length ? `,${addSelect.join(',')}` : ''
		}`,
		'FROM',
		table,
		joins?.join(' ') ?? '',
		conditions.sql ? `WHERE ${conditions.sql}` : '',
		opts?.group?.length ? `GROUP BY ${opts.group.join(',')}` : '',
		having.sql ? `HAVING ${having.sql}` : '',
		order?.length ? `ORDER BY ${order.join(',')}` : '',
		opts?.take ? `LIMIT ${opts.take}` : '',
		opts?.skip ? `OFFSET ${opts.skip}` : '',
	])

	return { query, values: [...conditions.params, ...having.params] }
}

/**
 * generate SQL for INSERT INTO query
 *
 * @template {unknown[]} ItemValues
 * @param {string} table table name
 * @param {ItemValues[]} values array of values to insert
 * @param {import('./types').InsertStatementOptions} [opts]
 */
export function generateInsert(table, values, opts) {
	if (!table) throw new Error('table name required')
	if (!Array.isArray(values)) throw new Error('values array required')

	if (!values[0]?.length) return { query: '', values: [] }

	const cols = opts?.cols ?? values[0]
	const clen = cols.length
	const valq = `(${cols.map(() => '?').join(',')})`
	const vals = values.map((vs) => {
		if (vs.length !== clen) throw new Error('value length mismatch')
		return valq
	})

	const query = joinParts([
		'INSERT',
		opts?.action ? ` OR ${opts.action}` : '',
		'INTO',
		table,
		opts?.cols ? `(${cols.join(',')})` : '',
		'VALUES',
		vals.join(','),
		opts?.upsert === true ? 'ON CONFLICT DO NOTHING' : '',
	])

	return { query, values: values.flatMap((vs) => vs) }
}

/**
 * generate SQL for UPDATE query
 *
 * @param {string} table table name
 * @param {import('./types').UpdateStatementOptions} [opts]
 */
export function generateUpdate(table, opts) {
	if (!table) throw new Error('table name required')

	const updates = Object.entries({ ...opts?.updates })
	if (!updates.length) return { query: '', values: [] }

	const conditions = combineConditions(normalizeCondition(opts?.where))

	const returning = opts?.returning?.map(generateCol)

	const query = joinParts([
		'UPDATE',
		opts?.action ? ` OR ${opts.action}` : '',
		table,
		'SET',
		updates.map((u) => `${u[0]} = ?`).join(', '),
		conditions.sql ? `WHERE ${conditions.sql}` : '',
		returning?.length ? `RETURNING ${returning.join(',')}` : '',
	])

	return { query, values: [...updates.map((u) => u[1]), ...conditions.params] }
}

/**
 * generate SQL for DELETE query
 *
 * @param {string} table table name
 * @param {import('./types').DeleteStatementOptions} [opts]
 */
export function generateDelete(table, opts) {
	if (!table) throw new Error('table name required')

	const conditions = combineConditions(normalizeCondition(opts?.where))

	const query = joinParts([
		`DELETE FROM`,
		table,
		conditions.sql ? `WHERE ${conditions.sql}` : '',
	])

	return { query, values: conditions.params }
}
