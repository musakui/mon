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
