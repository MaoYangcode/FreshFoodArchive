export function resolveRequestUserId(req: any) {
  const fromHeader =
    req?.headers?.['x-user-id'] ??
    req?.headers?.['x-userid'] ??
    req?.headers?.['x_user_id']
  const n = Number(fromHeader)
  if (!Number.isFinite(n) || n <= 0) return 1
  return Math.floor(n)
}
