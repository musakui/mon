import type { SqlFragment } from '#/core/frag.js'

export type IdType = string | number

export type RelationDef = [joinTableName: string, srcCol: string, dstCol: string]

export type RelationFrags = {
	has: string
	hasSome: string
	hasCount: string
	add(id: IdType, addIds: string): SqlFragment
	del(id: IdType, excludeIds: string): SqlFragment
	clear(id: IdType): SqlFragment
}

export type TableDefOpts = {
	/** table name */
	name: string

	/** primary key column (default: `id`) */
	pk?: string

	/** custom columns for `SELECT` */
	cols?: string

	/** custom join tables */
	joins?: string

	/** default order (default: `id ASC`) */
	order?: string

	/** relations to other tables */
	relations?: Record<string, RelationDef>
}

export type ComparisonOp = '=' | '<' | '>' | '<=' | '>=' | '!='

export type SqlCondition =
	| {
			op: ComparisonOp
			s: string
			v: string | number
			not?: boolean
	  }
	| {
			op: 'null'
			s: string
			v?: never
			not?: boolean
	  }
	| {
			op: 'like'
			s: string
			v: string
			not?: boolean
	  }
	| {
			op: 'in'
			s: string
			v: (string | number)[]
			not?: boolean
	  }
	| {
			op: 'has'
			s: string
			v: IdType
			not?: boolean
	  }
	| {
			op: 'hasAny' | 'hasAll'
			s: string
			v: IdType[]
			not?: boolean
	  }
	| {
			op: 'raw'
			s: string
			v: unknown[]
			not?: boolean
	  }

export type FindOpts = {
	/** `SELECT` cols/expr */
	select?: string

	/** `WHERE` conditions */
	filter?: SqlCondition[]

	/** `ORDER BY` terms */
	order?: string[]

	/** `LIMIT` (no limit if not set) */
	limit?: number

	/** `OFFSET` */
	offset?: number
}

export type TableDef = {
	/** table name */
	name: string

	/** primary key column */
	pk: string

	/** relations */
	rel: Record<string, RelationFrags>

	/** get condition */
	condition(c: SqlCondition): SqlFragment | null

	find(f: FindOpts): SqlFragment
	delete(id: IdType): SqlFragment
	getOne(id: IdType): SqlFragment
	getMany(ids: IdType[]): SqlFragment
}
