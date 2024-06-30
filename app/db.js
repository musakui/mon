import sqlite from 'sqlite3'
import { SQLITE } from '../lib/index.js'

/** @type {Map<string, import('./types').Connection>} */
const dbs = new Map()

/**
 * @template T
 * @param {import('sqlite3').Database} db
 * @param {string} source
 * @param {object} [opts]
 * @param {unknown[]} [opts.params]
 * @param {T} [opts.t]
 */
export const exe = async (db, source, opts) => {
	/** @type {T[]} */
	const result = await new Promise((resolve, reject) => {
		db.prepare(source).all(...(opts?.params ?? []), (err, rows) => {
			err ? reject(err) : resolve(rows)
		})
	})
	return result
}

/**
 * @param {string} name
 * @param {{ mode?: number, name?: string }} [opts]
 */
export const getConn = async (name, opts) => {
	if (!name) throw new NotFoundError(`name not provided`)
	const exist = dbs.get(name)
	if (exist) return exist
	if (!opts) throw new NotFoundError(`conn '${name}' does not exist`)
	const { name: n, mode } = opts
	/** @type {import('sqlite3').Database>} */
	const db = await new Promise((resolve, reject) => {
		const d = new sqlite.Database(name, mode, (err) => {
			err ? reject(err) : resolve(d)
		})
	})
	/** @type {import('./types').Connection>} */
	const conn = { db, name: n ?? name, schema: new Map() }
	dbs.set(conn.name, conn)
	return conn
}

/**
 * @param {string} name
 */
export const getDB = (name) => getConn(name).then((c) => c.db)

/**
 * @param {string} name
 */
export const updateSchema = async (name) => {
	const conn = await getConn(name)

	/** @type {{ name: string }[]} */
	const tables = await exe(conn.db, SQLITE.GET_TABLES)

	for (const tbl of tables) {
		/** @type {import('./types').SQLiteColInfo[]} */
		const rawCol = await exe(conn.db, SQLITE.TABLE_INFO(tbl.name))
		const cols = rawCol.map((col) => SQLITE.processColInfo(col))

		/** @type {import('./types').SQLiteFkInfo[]} */
		const rawFk = await exe(conn.db, SQLITE.FOREIGN_KEYS(tbl.name))
		const fk = rawFk.map((fk) => SQLITE.processFkInfo(fk))

		conn.schema.set(tbl.name, { name: tbl.name, cols, fk })
	}

	return conn
}

export class BadRequestError extends Error {
	code = 400
}

export class NotFoundError extends BadRequestError {
	code = 404
}
