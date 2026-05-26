export class SqlFragment {
	/** @type {string} */
	#s

	/** @type {unknown[]} */
	#v

	/**
	 * @param {string} sql SQL string
	 * @param {...unknown} values SQL values
	 */
	constructor(sql, ...values) {
		this.#s = sql
		this.#v = values
	}

	toString() {
		return this.#s
	}

	/** source string */
	get sql() {
		return this.#s
	}

	/** parameters to be bound */
	get values() {
		return this.#v
	}
}

/**
 * create an SQL fragment
 *
 * @param {string} sql part of an SQL statement
 * @param {...unknown} params parameters to be bound
 */
export function create(sql, ...params) {
	return new SqlFragment(sql, ...params)
}

/**
 * @param {unknown} val
 */
export function isFragment(val) {
	return val instanceof SqlFragment
}
