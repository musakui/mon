import { tag } from '#/core/index.js'

/** @import { DatabaseSync, SQLInputValue, StatementSync } from 'node:sqlite' */
/** @import { TagStore, SqlFragment, StatementWithParams } from './types' */

/**
 * @param {DatabaseSync} db
 */
export function createTagStore(db, maxSize = 1000) {
	/** @type {Map<string, StatementSync>} */
	const cache = new Map()

	/** @param {string} str */
	const prepare = (str) => {
		const found = cache.get(str)
		if (found) {
			// re-insert value to bump last use
			cache.delete(str)
			cache.set(str, found)
			return found
		}
		const st = db.prepare(str)
		cache.set(str, st)
		if (cache.size > maxSize) {
			const del = cache.keys().next().value
			if (del) cache.delete(del)
		}
		return st
	}

	/**
	 * @param {TemplateStringsArray} strs
	 * @param {...unknown} args
	 */
	const statement = (strs, ...args) => {
		const s = tag(strs, ...args)
		return /** @type {StatementWithParams} */ ([prepare(s.sql), ...s.values])
	}

	return /** @type {TagStore} */ ({
		db,
		raw: tag,
		capacity: maxSize,
		prepare,
		statement,
		run(strs, ...p) {
			const [st, ...v] = statement(strs, ...p)
			return st.run(...v)
		},
		all(strs, ...p) {
			const [st, ...v] = statement(strs, ...p)
			return st.all(...v)
		},
		get(strs, ...p) {
			const [st, ...v] = statement(strs, ...p)
			return st.get(...v)
		},
		iterate(strs, ...p) {
			const [st, ...v] = statement(strs, ...p)
			return st.iterate(...v)
		},
		clear() {
			cache.clear()
		},
		get size() {
			return cache.size
		},
	})
}

/**
 * @param {SqlFragment} frag
 */
export function getValues(frag) {
	return /** @type {SQLInputValue[]} */ (frag.values)
}
