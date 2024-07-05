// @ts-check

import { isStr } from './util.js'
import { processOpParams } from './operator.js'

/**
 * makes a statement from parts
 * @param {unknown[]} parts
 * @param {unknown[]} [vals]
 * @return {import('./types').Statement}
 */
export const makeStatement = (parts, vals) => {
	const sql = parts
		.flatMap((s) => {
			const z = isStr(s) ? s.trim() : ''
			return z ? [z] : []
		})
		.join(' ')
		.trim()

	const values = Array.isArray(vals) ? vals : []

	return { sql, values }
}

/**
 * combine multiple conditions into 1
 *
 * @param {import('./types').StatementFragment[]} conditions
 * @param {boolean} [disjunct] combine with `OR` (otherwise `AND`)
 */
export const combineConditions = (conditions, disjunct) => {
	const fc = conditions.flatMap((c) => (c.sql ? [c] : []))
	if (fc.length === 1) return fc[0]
	if (!fc.length) return { sql: '', values: [] }
	return {
		sql: `(${fc.map((c) => c.sql).join(disjunct ? ' OR ' : ' AND ')})`,
		values: fc.flatMap((c) => c.values),
	}
}

/**
 * recursively convert a QueryCondition into Conditions
 *
 * @param {import('./types').QueryCondition} [cond]
 * @param {boolean} [disjunct]
 */
export const normalizeCondition = (cond, disjunct) => {
	if (Array.isArray(cond)) {
		const d = !disjunct
		return cond.flatMap((cond) => {
			const conds = combineConditions(normalizeCondition(cond, d), d)
			return conds.sql ? [conds] : []
		})
	}
	if (!cond?.sql) return []
	if (!cond.op) {
		const p = cond.params
		return [{ sql: cond.sql, values: isStr(p) ? [p] : p ?? [] }]
	}
	const [op, ...values] = processOpParams(cond.op, cond.params)
	return [{ sql: `${cond.sql} ${op}`, values }]
}

/**
 * @param {string | import('./types').QueryCondition} [condition]
 * @param {boolean} [initialOr]
 */
export const handleCondition = (condition, initialOr) => {
	return !condition || isStr(condition)
		? { sql: condition || '', values: [] }
		: combineConditions(normalizeCondition(condition), initialOr)
}

/**
 * @param {string | import('./types').QueryColOption} c
 */
export const generateCol = (c) => {
	if (isStr(c)) return c
	const s = c.cast ? `CAST(${c.col} AS ${c.cast})` : c.col
	return `${s}${c.name ? ` AS ${c.name}` : ''}`
}

/**
 * @param {import('./types').QueryJoinOption} jn
 * @param {string} table
 */
export const generateJoin = (jn, table) => {
	const join = `${jn.type ? `${jn.type.toUpperCase()} ` : ''}JOIN ${jn.table}`
	if (jn.on) return `${join} ON ${jn.on}`
	if (!jn.col) return `NATURAL ${join}`
	const other = `${jn.other || table}.${jn.to || jn.col}`
	return `${join} ON ${jn.table}.${jn.col} = ${other}`
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

	const select = [
		...(opts?.select?.map(generateCol) ?? [`${table}.*`]),
		...(opts?.addSelect?.map(generateCol) ?? []),
	].join(',')

	const joins = opts?.join?.map((jn) => generateJoin(jn, table))

	const where = handleCondition(opts?.where)

	const groupBy = opts?.group?.join(',')

	// HAVING will start with OR at first layer
	const having = handleCondition(opts?.having, true)

	const orderBy = opts?.sort?.map(generateSort)?.join(',')

	return makeStatement(
		[
			'SELECT',
			opts?.distinct && 'DISTINCT',
			select,
			'FROM',
			table,
			joins?.join(' '),
			where.sql && `WHERE ${where.sql}`,
			groupBy && `GROUP BY ${groupBy}`,
			having.sql && `HAVING ${having.sql}`,
			orderBy && `ORDER BY ${orderBy}`,
			opts?.take && `LIMIT ${opts.take}`,
			opts?.skip && `OFFSET ${opts.skip}`,
		],
		[...where.values, ...having.values]
	)
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

	if (!values[0]?.length) return makeStatement([])

	const cols = opts?.cols ?? values[0]
	const clen = cols.length
	const valq = `(${cols.map(() => '?').join(',')})`
	const vals = values.map((vs) => {
		if (vs.length !== clen) throw new Error('value length mismatch')
		return valq
	})

	return makeStatement(
		[
			'INSERT',
			opts?.action && `OR ${opts.action}`,
			'INTO',
			table,
			opts?.cols && `(${cols.join(',')})`,
			'VALUES',
			vals.join(','),
			opts?.upsert === true && 'ON CONFLICT DO NOTHING',
		],
		values.flatMap((vs) => vs)
	)
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
	if (!updates.length) return makeStatement([])

	const where = handleCondition(opts?.where)

	const returning = opts?.returning?.map(generateCol)?.join(',')

	return makeStatement(
		[
			'UPDATE',
			opts?.action && `OR ${opts.action}`,
			table,
			'SET',
			updates.map((u) => `${u[0]} = ?`).join(', '),
			where.sql && `WHERE ${where.sql}`,
			returning && `RETURNING ${returning}`,
		],
		[...updates.map((u) => u[1]), ...where.values]
	)
}

/**
 * generate SQL for DELETE query
 *
 * @param {string} table table name
 * @param {import('./types').DeleteStatementOptions} [opts]
 */
export function generateDelete(table, opts) {
	if (!table) throw new Error('table name required')

	const where = handleCondition(opts?.where)

	return makeStatement(
		[`DELETE FROM`, table, where.sql && `WHERE ${where.sql}`],
		where.values
	)
}
