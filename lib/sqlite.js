export const GET_TABLES = `SELECT name FROM sqlite_master WHERE type='table'`

/** @param {string} name */
export const TABLE_INFO = (name) => `PRAGMA table_info(${name})`

/** @param {string} name */
export const FOREIGN_KEYS = (name) => `PRAGMA foreign_key_list(${name})`

/**
 * @param {import('./types').SQLiteColInfo} col
 * @return {import('./types').ColInfo}
 */
export const processColInfo = (col) => {
	const { notnull, dflt_value, pk, ...c } = col
	return {
		...c,
		pk: !!pk,
		nullable: !notnull,
		defaultValue: dflt_value,
	}
}

/**
 * @param {import('./types').SQLiteFkInfo} fk
 * @return {import('./types').ForeignKeyInfo}
 */
export const processFkInfo = (fk) => {
	return {
		id: fk.id,
		seq: fk.seq,
		name: fk.from,
		table: fk.table,
		col: fk.to,
	}
}
