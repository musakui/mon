import type { SqlFragment } from '#/core/frag.js'
import type { IdType, TableDef } from '#/sqlite/types.d.ts'
import type { SqlInVal, TagStore, SqlRecord } from '#/node/types.d.ts'

type SqlInRec = Record<string, SqlInVal | IdType[] | undefined>

export type ItemBase = { id: IdType }

export type RepoOpts<Item extends ItemBase> = {
	/** tag store */
	sql: TagStore

	/** pre-built table definition */
	table: TableDef

	/** transform an SQL output record to an item */
	fromRaw(row: SqlRecord): Item

	/** transform an item to SQL values for insert */
	toRaw(item: Partial<Item>): SqlInRec

	/**
	 * transform the value to SQL values for update (defaults to use `toRaw`)
	 */
	toUpdate?(item: Partial<Item>): SqlInRec

	/**
	 * additional values for `UPDATE`
	 */
	onUpdate?(): Record<string, SqlInVal> | null

	/**
	 * determine if item was newly inserted (e.g. no update column)
	 */
	fresh?(item: Partial<Item>): boolean

	/**
	 * default upsert options
	 */
	upsert?: Record<string, unknown> | null

	/**
	 * batch size for getMany (default: 20)
	 */
	batchSize?: number
}

export interface SqlRepo<Item extends ItemBase> {
	/**
	 * get an item by id
	 */
	get(id: Item['id']): Item | null

	/**
	 * get items by ids
	 */
	getMany(ids: Iterable<Item['id']>): Generator<Item, void, unknown>

	/**
	 * get the number of items (all items if no condition)
	 */
	count(where?: SqlFragment): number

	/**
	 * delete an item
	 * @returns deleted?
	 */
	delete(id: Item['id']): boolean

	/**
	 * insert an item
	 * @returns `null` if nothing was inserted
	 */
	insert(item: Item, upsert?: boolean | Record<string, unknown>): null | boolean

	/**
	 * update an item
	 * @returns `null` if item does not exist
	 */
	update(item: Partial<Item>): null | boolean
}
