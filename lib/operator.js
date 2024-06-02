// @ts-check

import * as _p from './param.js'
import { isStr } from './util.js'

/**
 * @typedef {[op: string, ...unknown[]]} Operation
 *
 * @typedef {(op: string, params: string | unknown[]) => Operation} ProcessOperation
 */

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

const noParams = new Set([
	//
	'ISNULL',
	'NOTNULL',
])

const reverseOpcode = new Map([...opcode.entries()].map(([k, v]) => [v, k]))

/** @type {Map<string, ProcessOperation>} */
const opProcess = new Map([])

/** @type {Map<string, (p: unknown[]) => string>} */
const stringifyParam = new Map([])

/** @param {string} op */
export const getOp = (op) => opcode.get(op)

/** @type {ProcessOperation} */
export const defaultProcess = (op, params) => {
	return [`${op} ?`, isStr(params) ? params : params[0]]
}

/** @type {ProcessOperation} */
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

/** @type {ProcessOperation} */
export const processIn = (op, params) => {
	const vs = isStr(params) ? params.split(_p.inOperatorDelimiter) : params ?? []
	return [`${op} (${vs.map(() => '?').join(',')})`, ...vs]
}

/**
 * @param {string} op
 * @param {string | unknown[]} [params]
 */
export const processOpParams = (op, params) => {
	if (noParams.has(op)) return /** @type {Operation} */ ([op])

	const process = opProcess.get(op) ?? defaultProcess
	return process(op, params ?? [])
}

/**
 * @param {string} [op]
 * @param {string | unknown[]} [params]
 * @return {[string, string]}
 */
export const stringifyOpParams = (op, params) => {
	if (!op) return ['', '']
	const code = reverseOpcode.get(op)
	if (!code) return ['', '']
	if (noParams.has(op)) return [code, '_']
	if (!params || isStr(params)) return [code, params || '']

	const proc = stringifyParam.get(op)
	return [code, proc ? proc(params) : `${params[0] ?? ''}`]
}

/**
 * @param {string} op
 * @param {string} code
 * @param {ProcessOperation} process
 * @param {(p: unknown[]) => string} [stringify]
 * @param {string} [notCode]
 */
export const useOp = (op, code, process, notCode, stringify) => {
	const NOT = `NOT ${op}`
	const no = notCode || `n${code[0]}`
	opcode.set(code, op)
	opcode.set(no, NOT)
	reverseOpcode.set(op, code)
	reverseOpcode.set(NOT, no)
	opProcess.set(op, process)
	opProcess.set(NOT, process)
	if (stringify) {
		stringifyParam.set(op, stringify)
		stringifyParam.set(NOT, stringify)
	}
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useLikeOp = (code, notCode) => {
	useOp('LIKE', code || 'lk', defaultProcess, notCode)
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useInOp = (code, notCode) => {
	/** @param {unknown[]} p */
	const str = (p) => p.join(_p.inOperatorDelimiter)
	useOp('IN', code || 'in', processIn, notCode, str)
}

/**
 * @param {string} [code]
 * @param {string} [notCode]
 */
export const useBetweenOp = (code, notCode) => {
	/** @param {unknown[]} p */
	const str = (p) => p.join(_p.betweenOperatorDelimiter)
	useOp('BETWEEN', code || 'bt', processBetween, notCode, str)
}
