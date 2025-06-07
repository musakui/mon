const SQL_SYMBOL = Symbol('sql')

/** @typedef {{ [SQL_SYMBOL]: string, params?: unknown[] }} SqlFragment */

/**
 * @param {unknown} val
 * @returns {val is SqlFragment}
 */
export function isFragment(val) {
	return (
		val !== null &&
		typeof val === 'object' &&
		typeof val[SQL_SYMBOL] === 'string'
	)
}

/**
 * extract the statement and params from a fragment
 *
 * @param {SqlFragment} frag
 * @return {[sql: string, ...params: unknown[]]}
 */
export function readFragment(frag) {
	return [frag[SQL_SYMBOL], ...(frag.params ?? [])]
}

/**
 * create an SQL fragment
 *
 * @param {string} s part of an SQL statement
 * @param {unknown[]} params parameters to be bound
 * @return {SqlFragment}
 */
export function makeFragment(s, ...params) {
	return { [SQL_SYMBOL]: s, params }
}

/**
 * combine multiple fragments into one
 *
 * @param {SqlFragment[]} frags fragments to be combined
 * @param {string} glue string to use for joining (e.g. ',')
 */
export function joinFragments(frags, glue) {
	const params = frags.flatMap((f) => (Array.isArray(f.params) ? f.params : []))
	return makeFragment(frags.map((f) => f[SQL_SYMBOL]).join(glue), ...params)
}

/**
 * template literal tag to create a fragment
 *
 * @param {TemplateStringsArray} strs
 * @param {unknown[]} args
 */
export function frag(strs, ...args) {
	const frags = args.flatMap((val, i) => [
		isFragment(val) ? val : makeFragment('?', val),
		makeFragment(strs[i + 1]),
	])
	return joinFragments([makeFragment(strs[0]), ...frags], '')
}

/**
 * combine an array of fragments or literals (which will become params)
 *
 * @param {Iterable<unknown>} arr array of fragments or literals
 * @param {string} [glue] string to join the fragments (default: `,`)
 */
export function fromArray(arr, glue = ',') {
	const frags = [...arr].map((val) => {
		return isFragment(val) ? val : makeFragment('?', val)
	})
	return joinFragments(frags, glue)
}

/**
 * combine an object of fragments or literals (which will become params),
 * where each key value pair will become `KEY=VALUE`
 *
 * @param {Record<string, unknown>} obj object with fragment or literal values
 * @param {Iterable<string>} [allowed] allowed keys for the object (default: all keys are allowed)
 * @param {string} [glue] string to join the fragments (default: `,`)
 */
export function fromObject(obj, allowed, glue = ',') {
	const aSet = allowed ? new Set(allowed) : null
	const frags = Object.entries(obj).flatMap(([key, val]) => {
		if (val === undefined || (aSet && !aSet.has(key))) return []
		return isFragment(val)
			? makeFragment(`${key}=${val[SQL_SYMBOL]}`, ...(val.params ?? []))
			: makeFragment(`${key}=?`, val)
	})
	return joinFragments(frags, glue)
}
