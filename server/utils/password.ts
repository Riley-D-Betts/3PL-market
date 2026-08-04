import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto'

const SCRYPT_N = 16384
const SCRYPT_R = 8
const SCRYPT_P = 1
const KEY_LEN = 32

function scryptAsync(password: string, salt: Buffer, N: number, r: number, p: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEY_LEN, { N, r, p, maxmem: 128 * N * r * 2 }, (err, key) => {
      if (err) reject(err)
      else resolve(key)
    })
  })
}

export async function hashUserPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await scryptAsync(password, salt, SCRYPT_N, SCRYPT_R, SCRYPT_P)
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString('base64')}$${key.toString('base64')}`
}

export async function verifyUserPassword(hash: string, password: string): Promise<boolean> {
  const parts = hash.split('$')
  if (parts.length !== 6 || parts[0] !== 'scrypt') return false
  const [, nStr, rStr, pStr, saltB64, keyB64] = parts
  const N = Number(nStr)
  const r = Number(rStr)
  const p = Number(pStr)
  if (!Number.isInteger(N) || !Number.isInteger(r) || !Number.isInteger(p)) return false
  const salt = Buffer.from(saltB64!, 'base64')
  const expected = Buffer.from(keyB64!, 'base64')
  if (expected.length !== KEY_LEN) return false
  const actual = await scryptAsync(password, salt, N, r, p)
  return timingSafeEqual(actual, expected)
}
