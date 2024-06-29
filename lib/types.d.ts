export type ColType =
	| 'NULL'
	| 'BLOB'
	| 'TEXT'
	| 'REAL'
	| 'INTEGER'
	| 'NUMERIC'
	| 'DATETIME'
	| 'json'

export type ForeignKeyAction =
	| 'NO ACTION'
	| 'RESTRICT'
	| 'SET NULL'
	| 'SET DEFAULT'
	| 'CASCADE'

export interface ColTypeMap {
	NULL: null
	TEXT: string
	REAL: number
	INTEGER: number
	NUMERIC: number
	DATETIME: Date
	json: object
}

export type ColInfo = {
	cid: number

	/** column name */
	name: string

	/** column type */
	type: ColType

	/** is primary key */
	pk?: boolean

	/** can be null */
	nullable?: boolean

	/** default value */
	defaultValue?: unknown
}

export type ForeignKeyInfo = {
	id: number

	seq: number

	/** column name in table */
	name: string

	/** foreign table name */
	table: string

	/** column name in foreign table */
	col: string
}

export type SQLiteColInfo = {
	cid: number
	name: string
	type: ColType
	pk: number
	notnull: number
	dflt_value: unknown
}

export type SQLiteFkInfo = {
	id: number
	seq: number
	table: string
	from: string
	to: string
	on_update: ForeignKeyAction
	on_delete: ForeignKeyAction
}

export type TableSchema = {
	/** table name */
	name: string

	/** column info */
	cols: ColInfo[]

	/** foreign key info */
	fk: ForeignKeyInfo[]
}

export type DatabaseSchema = Map<string, TableSchema>

// CORE

export type Operation = [op: string, ...unknown[]]

export type ProcessOperation = (
	op: string,
	params: string | unknown[]
) => Operation

export type QueryColOption = {
	/** selection (e.g. col name) */
	sel: string

	/** function on value */
	fn?: string

	/** alias for selection */
	name?: string

	/** table of sel */
	table?: string
}

/** condition with parameters */
export type RawCondition = {
	/** raw SQL, or col name / alias if operator provided */
	sql: string

	/** operator */
	op?: string

	/** parameters */
	params?: string | unknown[]
}

export type BaseCondition = {
	/** raw SQL */
	sql: string

	/** parameters */
	params: unknown[]
}

/**
 * WHERE conditions
 *
 * each level of nesting will flip between AND and OR
 */
export type QueryCondition = string | RawCondition | QueryCondition[]

export type JoinType = 'INNER' | 'LEFT' | 'RIGHT' | 'FULL'

export type QueryJoinOption = {
	/** other table name */
	join: string

	/** column name in other table (NATURAL join will be used if unspecified) */
	name?: string

	/** column name to match (default to name) */
	col?: string

	/** table name to match (default to current table) */
	table?: string

	/** custom join condition */
	cond?: string

	/** join type */
	type?: JoinType
}

export type QuerySortOption<ColName extends string = string> = {
	/** column name */
	col: ColName

	/** ORDER BY DESC */
	desc?: boolean

	/** NULLS FIRST */
	nullsFirst?: boolean
}

export type SelectStatementOptions = {
	/** table name */
	table: string

	/** DISTINCT */
	distinct?: boolean

	/** columns to select */
	select?: (string | QueryColOption)[]

	/** additional things to select */
	addSelect?: QueryColOption[]

	/** WHERE */
	where?: QueryCondition

	/** JOIN */
	join?: QueryJoinOption[]

	/** GROUP BY */
	group?: QueryColOption[]

	/** HAVING */
	having?: QueryCondition

	/** ORDER BY */
	sort?: QuerySortOption[]

	/** LIMIT */
	take?: number

	/** OFFSET */
	skip?: number
}

export type InsertStatementOptions = {
	/** table name */
	table: string

	/** columns to insert */
	cols?: string[]

	/** list of rows to insert, one array per row */
	values: unknown[][]

	/**
	 * true: ON CONFLICT DO NOTHING
	 */
	upsert?: boolean

	/** alternate action upon failure */
	action?: 'ABORT' | 'FAIL' | 'IGNORE' | 'REPLACE' | 'ROLLBACK'
}

export type DeleteStatementOptions = {
	/** table name */
	table: string

	/** WHERE conditions */
	where?: QueryCondition
}
