import type { Database } from 'better-sqlite3'
import type { DatabaseSchema } from '../lib/types'

export interface Connection {
	db: Database

	name: string

	schema: DatabaseSchema
}

export * from '../lib/types'
