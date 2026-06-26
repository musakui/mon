import type {
	SQLTagStore,
	SQLInputValue,
	SQLOutputValue,
	StatementResultingChanges,
	StatementSync,
} from 'node:sqlite'

import type { SqlFragment } from '#/core/frag.js'

export { SqlFragment }

export type SqlRecord = Record<string, SQLOutputValue>

export type SqlInVal = SQLInputValue | SqlFragment

export type StatementWithParams = readonly [
	statement: StatementSync,
	...parameters: SQLInputValue[],
]

export interface TagStore extends SQLTagStore {
	all(s: TemplateStringsArray, ...params: SqlInVal[]): SqlRecord[]
	get(s: TemplateStringsArray, ...params: SqlInVal[]): SqlRecord | undefined
	run(s: TemplateStringsArray, ...params: SqlInVal[]): StatementResultingChanges
	iterate(s: TemplateStringsArray, ...params: SqlInVal[]): NodeJS.Iterator<SqlRecord>

	/**
	 * Create an SQL fragment that can be embedded in other template tags
	 */
	raw(s: TemplateStringsArray, ...params: SqlInVal[]): SqlFragment

	/**
	 * Get the prepared statement for the given raw SQL string
	 */
	prepare(str: string): StatementSync

	/**
	 * Get the prepared statement for the given SQL query along with parameters to be bound
	 */
	statement(s: TemplateStringsArray, ...params: SqlInVal[]): StatementWithParams
}
