import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

export const DATABASE_URL
  = process.env.DATABASE_URL ?? 'postgres://threepl:threepl@localhost:5432/threepl'

const sql = postgres(DATABASE_URL, {
  max: 10,
  onnotice: () => {},
})

export const db = drizzle(sql, { schema })

export type Db = typeof db
export type Tx = Parameters<Parameters<Db['transaction']>[0]>[0]
export { schema }
