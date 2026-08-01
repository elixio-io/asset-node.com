import pino from 'pino'



const REDACTED_FIELDS = new Set([
  'password',
  'currentpassword',
  'current_password',
  'token',
  'ceremonytoken',
  'ceremony_token',
  'challengetoken',
  'challenge_token',
  'recoverycode',
  'recovery_code',
  'secret',
  'apikey',
  'api_key',
  'authorization',
  'cookie',
  'refreshtoken',
  'refresh_token',
  'accesstoken',
  'access_token',
  'bearertoken',
  'bearer_token',
  'signingsecret',
  'signing_secret',
  'encryptionkey',
  'encryption_key',
  'smtp_pass',
  'smtppass',
  'jwt_secret',
  'jwt_refresh_secret',
  'serviceaccountkey',
  'clientsecret',
  'client_secret',
  'privatekey',
  'private_key',




  'email',
  'emailaddress',
  'useremail',
  'partneremail',
  'adminemail',
  'contactemail',
  'maintaineremail',
  'to',
  'from',
  'replyto',
  'reply_to',
  'phone',
  'phonenumber',
  'phone_number',
  'mobile',
  'street',
  'zipcode',
  'zip_code',
  'zip',
  'postcode',
  'vatnumber',
  'vat_number',
  'iban',
  'bic',



  'gitlabapiurl',
  'gitlab_api_url',
  'gitlabprojectid',
  'gitlab_project_id',
  'gitlabaccesstoken',
  'gitlab_access_token',
  'gitlabtoken',
  'gitlab_token',
  'gitlabissueiid',
  'gitlab_issue_iid',
  'issueiid',
  'issue_iid',
  'projectid',
  'project_id',
])


const JWT_PATTERN = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g


export function redactSensitive(obj: unknown, depth = 0): unknown {
  if (depth > 8) return '[DEPTH_LIMIT]'

  if (obj === null || obj === undefined) return obj

  if (typeof obj === 'string') {
    if (JWT_PATTERN.test(obj)) {
      return obj.replace(JWT_PATTERN, '[JWT_REDACTED]')
    }
    return obj
  }

  if (typeof obj !== 'object') return obj

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitive(item, depth + 1))
  }

  const redacted: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const keyLower = key.toLowerCase().replace(/[-_]/g, '')

    if (REDACTED_FIELDS.has(keyLower) || REDACTED_FIELDS.has(key.toLowerCase())) {
      redacted[key] = '[REDACTED]'
      continue
    }

    if ((keyLower === 'html' || keyLower === 'text') && typeof value === 'string' && value.length > 200) {
      redacted[key] = `[EMAIL_BODY_REDACTED length=${value.length}]`
      continue
    }

    redacted[key] = redactSensitive(value, depth + 1)
  }

  return redacted
}


const isProd = process.env.NODE_ENV === 'production'

export const logger = pino({
  level: isProd ? 'info' : 'debug',
  ...(isProd
    ? {
        formatters: {
          level: (label: string) => ({ level: label }),
        },



        redact: {
          paths: [
            'password',
            'token',
            'secret',
            'apiKey',
            'apiToken',
            'accessToken',
            'refreshToken',
            'clientSecret',
            'privateKey',
            'serviceAccountKey',
            'authorization',
            'cookie',
            'email',
            'userEmail',
            'contactEmail',
            'phone',
            'req.headers.authorization',
            'req.headers.cookie',
            'req.headers["x-api-key"]',
            'headers.authorization',
            'headers.cookie',
            '*.password',
            '*.currentPassword',
            '*.ceremonyToken',
            '*.challengeToken',
            '*.recoveryCode',
            'body.code',
            '*.token',
            '*.apiKey',
            '*.accessToken',
            '*.refreshToken',
            '*.clientSecret',
          ],
          censor: '[REDACTED]',
        },
      }
    : {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
          },
        },
      }),
})


export function createServiceLogger(service: string) {
  return logger.child({ service })
}


export function safePayload(obj: Record<string, unknown>): Record<string, unknown> {
  return redactSensitive(obj) as Record<string, unknown>
}
