import { createFragment, toColsVals, fromEntries } from '#/core/index.js'
import { upsertAction } from '#/sqlite/util.js'

/** @import { RelationFrags } from '#/sqlite/types.d.ts' */
/** @import { ItemBase, RepoOpts } from './types' */

/**
 * @template {ItemBase} Item
 * @typedef {import('./types').SqlRepo<Item>} SqlRepo
 */

/**
 * @template {ItemBase} Item
 * @param {RepoOpts<Item>} opts
 */
export function createRepo(opts) {
	const { sql, table, fromRaw, toRaw, onUpdate } = opts
	const toUpdate = opts.toUpdate ?? toRaw
	const batchSize = opts.batchSize ?? 20
	const defaultUpsert = upsertAction(opts.upsert)

	const tb = createFragment(table.name)
	const pk = createFragment(table.pk)

	const getOneStmt = sql.prepare(table.getOne(0).sql)
	const getManyStmt = sql.prepare(table.getMany([]).sql)

	/** @param {unknown[]} b */
	const iter = (b) => getManyStmt.iterate(JSON.stringify(b)).map(fromRaw)

	/** @param {Record<string, unknown>} raw */
	const partition = (raw) => {
		/** @type {{ cols: [string, unknown][], rels: [RelationFrags, unknown[]][] }} */
		const out = { cols: [], rels: [] }
		for (const [k, v] of Object.entries(raw)) {
			if (!k || v === undefined) continue
			const s = table.rel[k]
			if (!s) {
				out.cols.push([k, v])
				continue
			}
			if (!Array.isArray(v)) continue
			out.rels.push([s, v])
		}
		return out
	}

	return /** @type {SqlRepo<Item>} */ ({
		get(id) {
			if (!id) return null
			const raw = getOneStmt.get(id)
			return raw ? fromRaw(raw) : null
		},

		*getMany(ids) {
			/** @type {Item['id'][]} */
			let batch = []

			/** @type {Set<Item['id']>} */
			const iset = new Set()

			for (const id of ids) {
				if (iset.has(id)) continue
				iset.add(id)
				batch.push(id)
				if (batch.length > batchSize) {
					yield* iter(batch)
					batch = []
				}
			}

			if (batch.length) {
				yield* iter(batch)
			}
		},

		count(where) {
			if (!where) return sql.get`SELECT COUNT(*) AS c FROM ${tb}`?.c ?? 0
			if (!where.sql || where.sql === '1') return NaN
			return sql.get`SELECT COUNT(*) AS c FROM ${tb} WHERE ${where}`?.c ?? 0
		},

		delete(id) {
			if (!id) return false
			if (!sql.run`${table.delete(id)}`.changes) return false
			for (const s of Object.values(table.rel)) sql.run`${s.clear(id)}`
			return true
		},

		insert(item, upsert) {
			const pt = partition(toRaw(item))
			const [c, v] = toColsVals(pt.cols)
			if (!c.sql) return null
			const up = upsert === true ? defaultUpsert : upsertAction(upsert)
			const r = sql.get`INSERT INTO ${tb}(${c}) VALUES (${v}) ON CONFLICT(${pk}) ${up} RETURNING *`
			if (!r) return null
			const out = fromRaw(r)
			for (const [s, ids] of pt.rels) {
				if (upsert) sql.run`${s.clear(out.id)}`
				if (!ids.length) continue
				for (const b of batchArr(ids, batchSize)) {
					sql.run`${s.add(out.id, JSON.stringify(b))}`
				}
			}
			return opts.fresh?.(out) ?? false
		},

		update(item) {
			const id = item.id
			if (!id) return null
			const pt = partition(toUpdate(item))
			if (!pt.cols.length && !pt.rels.length) return false

			const updates = fromEntries([
				//
				...pt.cols,
				...Object.entries(onUpdate?.() ?? {}),
			])

			const r = updates.sql
				? sql.run`UPDATE ${tb} SET ${updates} WHERE ${pk} = ${id}`.changes
				: sql.get`SELECT 1 FROM ${tb} WHERE ${pk} = ${id}`
			if (!r) return null

			for (const [s, ids] of pt.rels) {
				if (!ids.length) {
					sql.run`${s.clear(id)}`
					continue
				}

				if (ids.length <= batchSize) {
					const z = JSON.stringify(ids)
					sql.run`${s.del(id, z)}`
					sql.run`${s.add(id, z)}`
					continue
				}

				sql.run`${s.clear(id)}`
				for (const b of batchArr(ids, batchSize)) {
					sql.run`${s.add(id, JSON.stringify(b))}`
				}
			}

			return true
		},
	})
}

/**
 * @template T
 * @param {T[]} arr
 * @param {number} size
 */
function* batchArr(arr, size) {
	for (let i = 0; i < arr.length; i += size) {
		yield arr.slice(i, i + size)
	}
}
