import { parseSelectOptions as parse } from './parse.js'
import { stringifySelectOptions as stringify } from './stringify.js'

import { generateSelect as generate } from './generate.js'

export { useOp, useInOp, useLikeOp, useBetweenOp } from './operator.js'

/** @param {import('./types').SelectStatementOptions} opts */
export const defineOpts = (opts) => opts

export { parse, generate, stringify }
