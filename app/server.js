import { App } from '@tinyhttp/app'
import { json } from 'milliparsec'
import {
	//
	getConn,
	updateSchema,
	NotFoundError,
	exe,
} from './db.js'
import { SELECT } from '../lib/index.js'

/** @param {string} url */
const getQuery = (url) => {
	const idx = url.indexOf('?')
	return new URLSearchParams(idx > -1 ? url.slice(idx) : '')
}

const app = new App({
	onError: (error, req, res) => {
		res
			.status(error.code ?? 500)
			.send({ status: 'error', message: `${error.message}` })
	},
})

app.use(json())

app.get('/c/:cid/t/:tname', async (req, res) => {
	const conn = await getConn(req.params.cid)
	const table = conn.schema.get(req.params.tname)
	if (!table) throw new NotFoundError(`no table '${req.params.tname}'`)
	const parsed = SELECT.parse(getQuery(req.url))
	const sql = SELECT.generate({ table: table.name, ...parsed })
	const results = await exe(conn.db, sql.query, { params: sql.values })
	res.send({ status: 'ok', parsed, sql, results })
})

app.post('/c/:cid/t/:tname', async (req, res) => {
	const conn = await getConn(req.params.cid)
	const table = conn.schema.get(req.params.tname)
	if (!table) throw new NotFoundError(`no table '${req.params.tname}'`)
	// req.body.items
	res.send({ status: 'ok' })
})

app.get('/c/:cid', async (req, res) => {
	const conn = await getConn(req.params.cid)
	const schema = [...conn.schema.values()]
	res.send({ status: 'ok', name: conn.name, schema })
})

app.post('/c', async (req, res) => {
	const { name } = await getConn(req.body.name, req.body.opts)
	await updateSchema(name)
	res.send({ status: 'ok', name })
})

app.get('/', (_, res) => res.send({ status: 'ok' }))

const port = parseInt(process.env.PORT || '9942')
app.listen(port, () => console.log(`listening on ${port}`), '0.0.0.0')

getConn('app/chinook.db', { name: 'sample' }).then(async ({ name }) => {
	await updateSchema(name)
	console.log('sample db loaded')
})
