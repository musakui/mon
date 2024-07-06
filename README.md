# mon

> a lightweight and typesafe utility to represent and manipulate SQL

[![npm](https://img.shields.io/npm/v/@musakui/mon.svg)](https://www.npmjs.com/package/@musakui/mon)

**Warning** this is still experimental and APIs are expected to change a lot

## Usage

```js
import { generateSelect } from '@musakui/mon'

const sel = generateSelect('employees', {
  select: ['EmployeeId', 'FirstName'],
  where: { sql: 'LastName', op: '=', params: ['Jones'] },
  sort: [{ col: 'FirstName' }],
})

// values: ['Jones']
const results = db.prepare(sel.sql).all(...sel.values)
```

Generated query in above example

```sql
SELECT EmployeeId,FirstName FROM employees WHERE LastName = ? ORDER BY FirstName ASC NULLS LAST
```

### using `URLSearchParams`

If simple enough, a `SELECT` query may be losslessly converted into a `URLSearchParams` object (a.k.a querystring) and back. This allows query options to be sent via HTTP.

```js
// client side
import { stringifySelectOptions } from '@musakui/mon'

fetch(`/data?${new URLSearchParams(stringifySelectOptions(opts))}`)

// server side
import { parseSelectOptions } from '@musakui/mon'

app.use('/data', (req, res) => {
  const opts = parseSelectOptions(req.url.searchParams)
  const sel = generateSelect('data', opts)
  res.send(db.prepare(sel.sql).all(...sel.values))
})
```

## Motivation

SQL is an extremely expressive language but hard to manipulate, which is why most people use a query builder or ORM.

However, with tools like [SQLite WASM](https://sqlite.org/wasm/) allowing the use of SQL directly in the browser, ORMs/query builders might not be written in a web-first way.

This library aims to be

- buildless (ESM)
- typed (with [JSDoc](https://jsdoc.app) annotations)
- isomorphic (runs in any JS environment)

Potential uses are for data tables/visualisations in browsers, where the options can be bound to the UI.

## Caveats

Some trade-offs have to be made to keep the scope of this library manageable.

### Security model

DO NOT USE THIS LIBRARY TO HANDLE UNTRUSTED INPUTS

While query parameters are natively supported, preventing SQL injection is not a priority. The rationale is that most interactions will be with trusted inputs, and the worst case for SQLite is that the local database file is tampered with.

That said, a validator module could be added in the future to sanitize query options, but security and expressiveness can only be maintained by increasing complexity, and you will end up with a query builder or ORM.

Similar libraries like [sql-template-tag](https://github.com/blakeembrey/sql-template-tag) or [squid](https://github.com/andywer/squid) are safer as you have to bake the query upfront.

DO NOT USE THIS LIBRARY TO HANDLE UNTRUSTED INPUTS

### SQL dialect support

This library does not aim to handle all that SQL can do (SQL is just too powerful). However, most normal tasks will be supported.

The primary SQL dialect will be SQLite, although targeting others is theoretically possible. To keep the library footprint small, dialect-specific query generators should be exposed as seperate functions that can be tree-shaken when not used.

### Database connections

No database drivers will be included. This is to avoid depending on native bindings, since this library might be used in a browser.

Database setup and configuration (e.g. `CREATE TABLE`) will not be handled, as those are assumed to be done seperately.
