/**
 * @param {unknown} val
 * @return {val is string}
 */
export const isStr = (val) => typeof val === 'string'

/**
 * convert item objects into column and array values
 *
 * @template {Record<string, unknown>} const ItemType
 * @param {ItemType[]} items
 */
export function getInsertValues(items) {
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
