import { headers } from 'next/headers'
import { NextResponse } from 'next/server'
import { verify } from 'hono/jwt'
import { SignatureKey } from 'hono/utils/jwt/jws'
import { typeTool } from 'tools'

let accessToken: string | null = null
let accessTokenExpiresOn: number | null = null

const basicAuth = btoa(`${process.env.SERVER_CLIENT_ID}:${process.env.SERVER_CLIENT_SECRET}`)

export const throwForbiddenError = (message?: string) => {
  return new NextResponse(
    message,
    { status: 400 },
  )
}

const extractKid = (token: string) => {
  if (!token || typeof token !== 'string') {
    throw new Error('Invalid token provided')
  }

  const [header] = token.split('.')
  const decodedHeader = JSON.parse(Buffer.from(
    header,
    'base64',
  ).toString('utf8'))
  return decodedHeader.kid
}

const verifyJwtToken = async (token: string) => {
  const kid = extractKid(token)
  const response = await fetch(`${process.env.NEXT_PUBLIC_SERVER_URI}/.well-known/jwks.json`)
  const certs = await response.json() as { keys: { kid: string }[] }
  const publicKey = certs.keys.find((key) => key.kid === kid)
  if (!publicKey) return null

  const result = await verify(
    token,
    publicKey as unknown as SignatureKey,
    'RS256',
  )

  return result
}

export const verifyAccessToken = async () => {
  const headersList = headers()
  const authHeader = headersList.get('authorization')
  const accessToken = authHeader?.split(' ')[1]

  if (!accessToken) return false

  const tokenBody = await verifyJwtToken(accessToken) as {}

  if (!tokenBody) return false

  if (!('roles' in tokenBody) || !tokenBody.roles || !Array.isArray(tokenBody.roles) || !tokenBody.roles.includes(typeTool.Role.SuperAdmin)) return false

  return true
}

export const obtainS2SAccessToken = async () => {
  if (accessToken && accessTokenExpiresOn) {
    const currentTime = new Date().getTime() / 1000
    if (currentTime + 5 < accessTokenExpiresOn) return accessToken
  }

  const body = {
    grant_type: 'client_credentials',
    scope: typeTool.Scope.Root,
  }
  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URI}/oauth2/v1/token`,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams(body).toString(),
    },
  )
  if (res.ok) {
    const data = await res.json()

    accessToken = data.access_token
    accessTokenExpiresOn = data.expires_on

    return accessToken
  } else {
    return false
  }
}

export const sendS2SRequest = async ({
  method,
  uri,
  body,
}: {
  uri: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: string;
}) => {
  const isValid = await verifyAccessToken()
  if (!isValid) return throwForbiddenError()

  const token = await obtainS2SAccessToken()
  if (!token) return throwForbiddenError()

  const res = await fetch(
    `${process.env.NEXT_PUBLIC_SERVER_URI}${uri}`,
    {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: body ?? undefined,
    },
  )
  if (res.ok) {
    const contentType = res.headers.get('Content-Type')
    if (contentType && contentType.includes('application/json')) {
      const data = await res.json()
      return NextResponse.json(data)
    } else {
      return NextResponse.json({ success: true })
    }
  } else {
    const error = await res.text()
    return throwForbiddenError(error)
  }
}
