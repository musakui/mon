import { createFragment as frag, joinFragments, mergeConditions } from '#/core/index.js'
import { jsonEach } from './util.js'

/** @import { RelationFrags, ComparisonOp, SqlCondition } from './types' */

/** @param {import('./types').TableDefOpts} opts */
export function createTableDef(opts) {
	const tb = opts.name
	const pk = opts.pk || 'id'
	const tbpk = `${tb}.${pk}`
	const selCols = [`${tb}.*`]
	const joinTbs = opts.joins ? [opts.joins] : []

	/** @type {Record<string, RelationFrags>} */
	const rel = {}
	for (const [name, relDef] of Object.entries(opts.relations ?? {})) {
		const { select, join, ...rest } = relationFrags(relDef, tbpk)
		rel[name] = rest
		if (!opts.joins) joinTbs.push(join)
		if (!opts.cols) selCols.push(`${select} AS ${name}`)
	}

	const _s = /* sql */ `SELECT ${opts.cols || selCols.join(', ')} FROM ${tb} ${joinTbs.join(' ')} WHERE ${tbpk}`
	const _e = joinTbs.length ? /* sql */ `GROUP BY ${tbpk}` : ''

	const oneStmt = `${_s} = ? ${_e}`
	const manyStmt = `${_s} IN (${jsonEach()}) ${_e}`

	const delStmt = /* sql */ `DELETE FROM ${tb} WHERE ${pk} = ?`

	/** @param {SqlCondition} [c] */
	function condition(c) {
		if (!c?.op || !c.s) return null

		const n = c.not ? 'NOT ' : ''

		if (c.op === 'null') return frag(`${c.s} IS ${n}NULL`)
		if (c.v == null) return null

		if (c.op === 'raw') return frag(wrapn(c.s, n), ...c.v)
		if (c.op === 'like') return frag(`${c.s} ${n}LIKE ?`, c.v)
		if (c.op === 'in') return frag(`${c.s} ${n}IN (${jsonEach()})`, jstr(c.v))
		if (isComparison(c.op)) return frag(wrapn(`${c.s} ${c.op} ?`, n), c.v)

		const rf = rel[c.s]
		if (!rf) return null

		if (c.op === 'has') return frag(`${n}${rf.has}`, c.v)
		if (c.op === 'hasAny') return frag(`${n}${rf.hasSome}`, jstr(c.v))
		if (c.op === 'hasAll') {
			const s = new Set(c.v)
			return frag(`(${rf.hasCount}) ${n ? '<' : '='} ?`, jstr(c.v), s.size)
		}

		return null
	}

	/** @param {import('./types').Condition} [cond] */
	function resolve(cond) {
		if (!cond) return null
		if (cond.op === 'grp') {
			const m = mergeConditions(cond.v.map(resolve), cond.s === 'any')
			return cond.not ? frag(`NOT ${m.sql}`, ...m.values) : m
		}
		return condition(/** @type {SqlCondition} */ (cond))
	}

	return /** @type {import('./types').TableDef} */ ({
		name: tb,
		pk,
		rel,
		condition,
		delete: (id) => frag(delStmt, id),
		getOne: (id) => frag(oneStmt, id),
		getMany: (ids) => frag(manyStmt, jstr(ids)),
		find(f) {
			const sel = f.select?.join(', ') || pk
			const ord = f.order?.join(', ') || opts.order
			return joinFragments([
				frag(/* sql */ `SELECT ${sel} FROM ${tb} WHERE`),
				resolve(f.filter) ?? frag('1'),
				ord ? frag(`ORDER BY ${ord}`) : null,
				f.limit ? frag(`LIMIT ?`, f.limit) : null,
				f.offset ? frag(`OFFSET ?`, f.offset) : null,
			])
		},
	})
}

/**
 * @param {import('./types').RelationDef} rel
 * @param {string} pk
 */
function relationFrags(rel, pk) {
	const [t, src, dst] = rel

	const relId = /* sql */ `FROM ${t} WHERE ${t}.${src} = ${pk} AND ${t}.${dst}`
	const clear = /* sql */ `DELETE FROM ${t} WHERE ${src} = ?`
	const delStmt = /* sql */ `${clear} AND ${dst} NOT IN (${jsonEach()})`
	const addStmt = /* sql */ `INSERT OR IGNORE INTO ${t}(${src}, ${dst}) ${jsonEach('?', 'value')}`

	const frags = /** @type {RelationFrags} */ ({
		has: /* sql */ `EXISTS (SELECT 1 ${relId} = ?)`,
		hasSome: /* sql */ `EXISTS (SELECT 1 ${relId} IN (${jsonEach()}))`,
		hasCount: /* sql */ `SELECT COUNT(DISTINCT ${t}.${dst}) ${relId} IN (${jsonEach()})`,
		add: (id, addIds) => frag(addStmt, id, addIds),
		del: (id, excludeIds) => frag(delStmt, id, excludeIds),
		clear: (id) => frag(clear, id),
	})

	return {
		...frags,
		join: /* sql */ `LEFT JOIN ${t} ON ${t}.${src} = ${pk}`,
		select: /* sql */ `json_group_array(${t}.${dst}) FILTER (WHERE ${t}.${dst} IS NOT NULL)`,
	}
}

const CMP_OP = new Set(['=', '!=', '<', '>', '<=', '>='])

/**
 * @param {string} op
 * @returns {op is ComparisonOp}
 */
function isComparison(op) {
	return CMP_OP.has(op)
}

/** @param {unknown} val */
function jstr(val) {
	return JSON.stringify(val)
}

/**
 * @param {string} s
 * @param {string} n
 */
function wrapn(s, n) {
	return n ? `${n}(${s})` : s
}
