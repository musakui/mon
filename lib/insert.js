import {
	getInsertValues as getValues,
	generateInsert as generate,
} from './generate.js'

/** @param {import('./types').InsertStatementOptions} opts */
export const defineOpts = (opts) => opts

export { generate, getValues }
