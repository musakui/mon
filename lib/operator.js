// @ts-check

import * as _p from './param.js'
import { isStr } from './util.js'

const opcode = new Map([
	['eq', '='],
	['lt', '<'],
	['gt', '>'],
	['le', '<='],
	['ge', '>='],
	['ne', '!='],
	['nu', 'ISNULL'],
	['nn', 'NOTNULL'],
])

const unary = new Set([
	//
	'ISNULL',
	'NOTNULL',
])

const reverseOpcode = new Map([...opcode.entries()].map(([k, v]) => [v, k]))

/** @type {Map<string, import('./types').ProcessOperation>} */
const opProcess = new Map([])

/** @param {string} op */
export const getOp = (op) => opcode.get(op)

/** @param {string} op */
export const getCode = (op) => reverseOpcode.get(op)

/**
 * @type {import('./types').ProcessOperation}
 */
export const defaultProcess = (op, params) => {
	return [`${op} ?`, isStr(params) ? params : params[0]]
}

/**
 * @type {import('./types').ProcessOperation}
 */
export const processBetween = (op, params) => {
	const vs = isStr(params)
		? params.split(_p.betweenOperatorDelimiter, 2)
		: params
	return /** @type {[op: string, lower: unknown, higher: unknown]} */ ([
		`${op} ? AND ?`,
		vs[0] ?? null,
		vs[1] ?? null,
	])
}

/**
 * @type {import('./types').ProcessOperation}
 */
export const processIn = (op, params) => {
	const vs = isStr(params) ? params.split(_p.inOperatorDelimiter) : params ?? []
	return /** @type {import('./types').Operation} */ ([
		`${op} (${vs.map(() => '?').join(',')})`,
		...vs,
	])
}

/**
/**
 * @param {string} op
 * @param {string | unknown[]} [params]
 * @return {import('./types').Operation}
 */
export const processOpParams = (op, params) => {
	if (unary.has(op)) return [op]

	const process = opProcess.get(op) ?? defaultProcess
	return process(op, params ?? [])
}

/**
 * @param {string} op
 * @param {import('./types').ProcessOperation} process
 * @param {string} code
 * @param {string} [notCode]
 */
export const useOp = (op, process, code, notCode) => {
	const NOT = `NOT ${op}`
	const no = notCode || `n${code[0]}`
	opcode.set(code, op)
	opcode.set(no, NOT)
	reverseOpcode.set(op, code)
	reverseOpcode.set(NOT, no)
	opProcess.set(op, process)
	opProcess.set(NOT, process)
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useLikeOp = (code, notCode) => {
	useOp('LIKE', defaultProcess, code || 'lk', notCode)
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useInOp = (code, notCode) => {
	useOp('IN', processIn, code || 'in', notCode)
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useBetweenOp = (code, notCode) => {
	useOp('BETWEEN', processBetween, code || 'bt', notCode)
}
