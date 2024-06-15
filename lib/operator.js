// @ts-check

import * as OP from './op.js'
import * as _p from './param.js'
import { isStr } from './util.js'

const opcode = new Map([
	['eq', OP.Equals],
	['lt', OP.LessThan],
	['gt', OP.GreaterThan],
	['le', OP.LessThanOrEquals],
	['ge', OP.GreaterThanOrEquals],
	['ne', OP.NotEquals],
	['nu', OP.IsNull],
	['nn', OP.IsNotNull],
])

const noParams = new Set([
	//
	OP.IsNull,
	OP.IsNotNull,
])

const reverseOpcode = new Map([...opcode.entries()].map(([k, v]) => [v, k]))

/** @type {Map<string, import('./types').ProcessOperation>} */
const opProcess = new Map([])

/** @type {Map<string, (p: unknown[]) => string>} */
const stringifyParam = new Map([])

/** @param {string} op */
export const getOp = (op) => opcode.get(op)

/** @type {import('./types').ProcessOperation} */
export const defaultProcess = (op, params) => {
	return [`${op} ?`, isStr(params) ? params : params[0]]
}

/**
 * @param {string} op
 * @param {string | unknown[]} [params]
 */
export const processOpParams = (op, params) => {
	if (noParams.has(op)) return /** @type {import('./types').Operation} */ ([op])

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
 * @param {import('./types').OperationOptions} [opts]
 */
export const useOp = (opts) => {
	if (!opts?.op) return
	const { op, code, process, notCode, stringify } = opts
	if (!code || !process) return
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
 * @param {Partial<import('./types').OperationOptions>} [opts]
 */
export const useLikeOp = (opts) => {
	useOp({
		op: OP.Like,
		code: 'lk',
		process: defaultProcess,
		...opts,
	})
}

/**
 * @param {Partial<import('./types').OperationOptions>} [opts]
 */
export const useInOp = (opts) => {
	useOp({
		op: OP.IsIn,
		code: 'in',
		process: (op, params) => {
			const vs = isStr(params)
				? params.split(_p.inOperatorDelimiter)
				: params ?? []
			return [`${op} (${vs.map(() => '?').join(',')})`, ...vs]
		},
		stringify: (p) => p.join(_p.inOperatorDelimiter),
		...opts,
	})
}

/**
 * @param {Partial<import('./types').OperationOptions>} [opts]
 */
export const useBetweenOp = (opts) => {
	useOp({
		op: OP.Between,
		code: 'bt',
		process: (op, params) => {
			const vs = isStr(params)
				? params.split(_p.betweenOperatorDelimiter, 2)
				: params
			return [`${op} ? AND ?`, vs[0] ?? null, vs[1] ?? null]
		},
		stringify: (p) => p.join(_p.betweenOperatorDelimiter),
		...opts,
	})
}
