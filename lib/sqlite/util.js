import { createFragment, fromEntries, tag as sql } from '#/core/index.js'

/** @import { SqlFragment } from '#/core/frag.js'  */

/**
 * use the `json_each` table-valued function
 *
 * @see {@link https://sqlite.org/json1.html#jeach}
 *
 * @param {string[]} cols default: `value`
 */
export function jsonEach(...cols) {
	return /* sql */ `SELECT ${cols.length ? cols.join(', ') : 'value'} FROM json_each(?)`
}

/**
 * upsert actions from an object
 *
 * - falsy => `DO NOTHING`
 * - `{ foo: null }` => `DO UPDATE SET foo = excluded.foo`
 *
 * fragment values will be left as-is
 *
 * @see {@link https://sqlite.org/lang_upsert.html}
 *
 * @param {Record<string, unknown> | null | false} [cols]
 * @returns {SqlFragment}
 */
export function upsertAction(cols) {
	if (!cols) return sql`DO NOTHING`

	const ents = Object.entries(cols).map((c) => (c[1] == null ? excl(c[0]) : c))

	return sql`DO UPDATE SET ${fromEntries(ents)}`
}

/** @param {string} k */
function excl(k) {
	return /** @type {[string, unknown]} */ ([k, createFragment(`excluded.${k}`)])
}
