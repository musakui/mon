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
 * @param {import('./types').ParsedCondition[]} conditions
 * @param {boolean} [disjunct] combine with `OR` (otherwise `AND`)
 */
export const combineConditions = (conditions, disjunct) => {
	const fc = conditions.flatMap((c) => (c.sql ? [c] : []))
	const z = fc.map((c) => c.sql)
	return /** @type {import('./types').ParsedCondition} */ ({
		sql: z.length > 1 ? `(${z.join(disjunct ? ' OR ' : ' AND ')})` : z[0],
		params: fc.flatMap((c) => c.params),
	})
}

/**
 * @param {import('./types').QueryCondition} [cond]
 * @param {boolean} [disjunct]
 * @return {import('./types').ParsedCondition[]}
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
 */
export const generateCol = (col) => {
	return `${col.col}${col.name ? ` AS ${col.name}` : ''}`
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
export const generateSelect = (table, opts) => {
	if (!table) throw new Error('table name required')

	const select = opts?.select?.map((c) => {
		return isStr(c) ? `${table}.${c}` : generateCol(c)
	})

	const addSelect = opts?.addSelect?.map(generateCol)

	const conditions = combineConditions(normalizeCondition(opts?.where))

	const joins = opts?.join?.map((jn) => generateJoin(jn, table))

	const group = opts?.group?.map(generateCol)

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
		group?.length ? `GROUP BY ${group.join(',')}` : '',
		having.sql ? `HAVING ${having.sql}` : '',
		order?.length ? `ORDER BY ${order.join(',')}` : '',
		opts?.take ? `LIMIT ${opts.take}` : '',
		opts?.skip ? `OFFSET ${opts.skip}` : '',
	])

	return { query, values: [...conditions.params, ...having.params] }
}

/**
 * convert item objects into column and array values
 * @template {Record<string, unknown>} const ItemType
 * @param {ItemType[]} items
 */
export const getInsertValues = (items) => {
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

/**
 * generate SQL for INSERT INTO query
 *
 * @template {unknown[]} ItemValues
 * @param {string} table table name
 * @param {ItemValues[]} values array of values to insert
 * @param {import('./types').InsertStatementOptions} [opts]
 */
export const generateInsert = (table, values, opts) => {
	if (table) throw new Error('table name required')
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
export const generateUpdate = (table, opts) => {
	if (table) throw new Error('table name required')

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
export const generateDelete = (table, opts) => {
	if (table) throw new Error('table name required')

	const conditions = combineConditions(normalizeCondition(opts?.where))

	const query = joinParts([
		`DELETE FROM`,
		table,
		conditions.sql ? `WHERE ${conditions.sql}` : '',
	])

	return { query, values: conditions.params }
}
