export type ColType =
	| 'NULL'
	| 'BLOB'
	| 'TEXT'
	| 'REAL'
	| 'INTEGER'
	| 'NUMERIC'
	| 'DATETIME'
	| 'json'

export interface ColInfo<ColName extends string = string> {
	cid: number

	/** column name */
	name: ColName

	/** column type */
	type: ColType

	/** is primary key */
	pk?: boolean

	/** column can be null */
	nullable?: boolean

	/** column default value */
	defaultValue?: unknown
}

export interface TableSchema<
	TableName extends string = string,
	ColName extends string = string
> {
	/** table name */
	name: TableName

	/** column info */
	cols: ColInfo<ColName>[]
}
