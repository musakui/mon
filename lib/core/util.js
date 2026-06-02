import { create as _, isFragment as isFrag } from './frag.js'

/** @import { SqlFragment } from './frag' */

/** @typedef {Iterable<[key: string, val: unknown]>} KeyValEntries */
/** @typedef {(frags: SqlFragment[]) => string} JoinFn */

/**
 * combine items; raw values will be interpolated as fragments
 *
 * @param {string | JoinFn} glue string to use for joining (e.g. ','), or joining function
 * @param {...unknown} items things to join
 */
export function concat(glue, ...items) {
	if (!items.length) return _('')

	const frags = items.map((v) => (isFrag(v) ? v : _('?', v)))

	if (frags.length === 1) return frags[0]

	// note: `.join` works via `.toString()`
	const all = typeof glue === 'function' ? glue(frags) : frags.join(glue)

	const str = all.replace(/\s+/g, ' ').trim()
	return _(str, ...frags.flatMap((f) => f.values))
}

/**
 * template literal tag to create an SQL fragment
 *
 * @param {TemplateStringsArray} strs
 * @param {...unknown} params
 */
export function tag(strs, ...params) {
	// interlace raw strings with interpolated values
	const rest = params.flatMap((v, i) => [v, _(strs[i + 1])])
	return concat('', _(strs[0]), ...rest)
}

/**
 * `INSERT` statement cols and vals from key-value entries
 *
 * **WARNING**: keys are inlined as raw SQL
 *
 * @param {KeyValEntries} entries
 */
export function toColsVals(entries) {
	const cols = []
	const vals = []

	for (const [k, v] of entries) {
		if (!k || v === undefined) continue
		cols.push(_(k))
		vals.push(v)
	}

	return /** @type {readonly [cols: SqlFragment, vals: SqlFragment]} */ ([
		concat(',', ...cols),
		concat(',', ...vals),
	])
}

/**
 * transform key-value entries into fragments
 *
 * **WARNING**: keys are inlined as raw SQL
 *
 * non-fragment values are interpolated safely as parameters
 *
 * @param {KeyValEntries} entries
 * @param {string} [eq] equals (default: `=`)
 */
export function* toFragments(entries, eq = '=') {
	for (const [k, v] of entries) {
		if (!k) continue

		if (!isFrag(v)) {
			yield _(`${k}${eq}?`, v)
			continue
		}

		// skip empty fragments
		if (!v.sql) continue

		yield _(`${k}${eq}${v}`, ...v.values)
	}
}

/**
 * combine key-value entries e.g.: `foo=?,bar=?`
 *
 * @param {KeyValEntries} entries
 * @param {string} [glue] string to join the pairs (default: `,`)
 */
export function fromEntries(entries, glue = ',') {
	return concat(glue, ...toFragments(entries))
}

/**
 * combine an object as `key=value` fragments e.g.: `foo=?,bar=?`
 *
 * **DO NOT** use user provided objects as-is;
 * instead, explicitly read from each allowed key e.g.:
 *
 * ```js
 * fromObject({ foo: values.foo, bar: values.bar })
 * ```
 *
 * @param {Record<string, unknown>} obj object with literal or fragment values
 * @param {string} [glue] string to join the pairs (default: `,`)
 */
export function fromObject(obj, glue = ',') {
	return fromEntries(Object.entries(obj), glue)
}

/**
 * @param {unknown} val
 * @returns {val is SqlFragment}
 */
export function isNonEmptyFragment(val) {
	return isFrag(val) && !!val.sql
}

/**
 * @param {unknown[]} items
 * @param {string} [sep] default: single whitespace
 */
export function joinFragments(items, sep = ' ') {
	return concat(sep, ...items.filter(isNonEmptyFragment))
}

/**
 * combine multiple conditions into one
 *
 * @param {unknown[]} [conditions]
 * @param {boolean} [disjunct] combine with `OR` (default is `AND`)
 */
export function mergeConditions(conditions, disjunct) {
	const cs = conditions?.filter(isNonEmptyFragment)

	// empty sum / product
	if (!cs?.length) return _(disjunct ? '0' : '1')

	// always wrap in parens
	return tag`(${concat(disjunct ? ' OR ' : ' AND ', ...cs)})`
}
