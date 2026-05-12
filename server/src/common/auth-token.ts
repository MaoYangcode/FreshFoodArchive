import { createHmac, timingSafeEqual } from 'crypto'

type AuthPayload = {
  uid: number
  exp: number
}

function getAuthSecret() {
  const secret = `${process.env.AUTH_TOKEN_SECRET || ''}`.trim()
  if (!secret) return ''
  return secret
}

function toBase64UrlJson(data: AuthPayload) {
  return Buffer.from(JSON.stringify(data), 'utf8').toString('base64url')
}

function fromBase64UrlJson(input: string) {
  try {
    const text = Buffer.from(input, 'base64url').toString('utf8')
    return JSON.parse(text) as AuthPayload
  } catch (_) {
    return null
  }
}

function signPayload(payloadPart: string, secret: string) {
  return createHmac('sha256', secret).update(payloadPart).digest('base64url')
}

export function createAuthToken(userId: number, expiresInSeconds = 30 * 24 * 3600) {
  const secret = getAuthSecret()
  if (!secret) {
    throw new Error('AUTH_TOKEN_SECRET 未配置')
  }
  const nowSec = Math.floor(Date.now() / 1000)
  const payload: AuthPayload = {
    uid: Math.floor(userId),
    exp: nowSec + Math.max(300, Math.floor(expiresInSeconds)),
  }
  const payloadPart = toBase64UrlJson(payload)
  const sigPart = signPayload(payloadPart, secret)
  return `${payloadPart}.${sigPart}`
}

export function verifyAuthToken(token: string) {
  const secret = getAuthSecret()
  if (!secret) return null
  const text = `${token || ''}`.trim()
  const [payloadPart, sigPart] = text.split('.')
  if (!payloadPart || !sigPart) return null
  const expectedSig = signPayload(payloadPart, secret)
  const sigBuf = Buffer.from(sigPart)
  const expectedBuf = Buffer.from(expectedSig)
  if (sigBuf.length !== expectedBuf.length) return null
  if (!timingSafeEqual(sigBuf, expectedBuf)) return null
  const payload = fromBase64UrlJson(payloadPart)
  const uid = Number(payload?.uid)
  const exp = Number(payload?.exp)
  const nowSec = Math.floor(Date.now() / 1000)
  if (!Number.isFinite(uid) || uid <= 0) return null
  if (!Number.isFinite(exp) || exp <= nowSec) return null
  return {
    userId: Math.floor(uid),
    expiresAt: exp * 1000,
  }
}
