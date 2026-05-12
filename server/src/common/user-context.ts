import { verifyAuthToken } from './auth-token'

function getBearerToken(req: any) {
  const raw = `${req?.headers?.authorization || ''}`.trim()
  if (!raw) return ''
  const matched = raw.match(/^Bearer\s+(.+)$/i)
  if (!matched) return ''
  return `${matched[1] || ''}`.trim()
}

export function resolveRequestUserId(req: any) {
  const token = getBearerToken(req)
  if (!token) return null
  const verified = verifyAuthToken(token)
  if (!verified?.userId) return null
  return verified.userId
}
