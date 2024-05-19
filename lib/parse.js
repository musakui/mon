import * as _p from './param.js'

/**
 * @param {unknown} val
 * @param {number} fallback
 */
export const getInt = (val, fallback = 0) => {
	const v = parseInt(val)
	return Number.isNaN(v) ? fallback : v
}

/**
 * parse pagination options from search params
 *
 * page param will be ignored if offset param is specified
 *
 * @param {URLSearchParams} params
 */
export const parsePagination = (params) => {
	const take = getInt(params.get(_p.limitKey))
	const skip =
		getInt(params.get(_p.offsetKey)) ||
		(getInt(params.get(_p.pageKey), 1) - 1) * take

	return {
		...(take ? { take } : null),
		...(skip ? { skip } : null),
	}
}
