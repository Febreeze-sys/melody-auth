import { Context } from 'hono'
import { env } from 'hono/adapter'
import { genRandomString } from 'shared'
import {
  localeConfig, typeConfig,
} from 'configs'
import { userModel } from 'models'
import {
  EmailVerificationTemplate, PasswordResetTemplate, EmailMfaTemplate,
} from 'templates'

export const sendSendgridEmail = async (
  c: Context<typeConfig.Context>,
  receiverEmail: string,
  subject: string,
  emailBody: string,
) => {
  const {
    SENDGRID_API_KEY: sendgridApiKey,
    SENDGRID_SENDER_ADDRESS: sendgridSender,
    ENVIRONMENT: environment,
    DEV_EMAIL_RECEIVER: devEmailReceiver,
  } = env(c)

  return fetch(
    'https://api.sendgrid.com/v3/mail/send',
    {
      method: 'POST',
      headers: {
        Authorization: `bearer ${sendgridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        subject,
        content: [{
          type: 'text/html',
          value: emailBody,
        }],
        personalizations: [
          {
            to: [
              { email: environment === 'prod' ? receiverEmail : devEmailReceiver },
            ],
          },
        ],
        from: { email: sendgridSender },
      }),
    },
  )
}

export const sendEmailVerification = async (
  c: Context<typeConfig.Context>,
  user: userModel.Record | userModel.ApiRecord,
  locale: typeConfig.Locale,
) => {
  const {
    ENABLE_EMAIL_VERIFICATION: enableEmailVerification,
    SENDGRID_API_KEY: sendgridApiKey,
    SENDGRID_SENDER_ADDRESS: sendgridSender,
    COMPANY_LOGO_URL: logoUrl,
    AUTH_SERVER_URL: serverUrl,
  } = env(c)
  if (!enableEmailVerification || !sendgridApiKey || !sendgridSender || !user.email) return null
  const verificationCode = genRandomString(8)
  const content = (<EmailVerificationTemplate
    serverUrl={serverUrl}
    authId={user.authId}
    verificationCode={verificationCode}
    logoUrl={logoUrl}
    locale={locale} />).toString()

  const res = await sendSendgridEmail(
    c,
    user.email,
    localeConfig.emailVerificationEmail.subject[locale],
    content,
  )

  return res.ok ? verificationCode : null
}

export const sendPasswordReset = async (
  c: Context<typeConfig.Context>,
  user: userModel.Record,
  locale: typeConfig.Locale,
) => {
  const {
    ENABLE_PASSWORD_RESET: enablePasswordReset,
    SENDGRID_API_KEY: sendgridApiKey,
    SENDGRID_SENDER_ADDRESS: sendgridSender,
    COMPANY_LOGO_URL: logoUrl,
  } = env(c)
  if (!enablePasswordReset || !sendgridApiKey || !sendgridSender || !user.email) return null
  const resetCode = genRandomString(8)
  const content = (<PasswordResetTemplate
    resetCode={resetCode}
    logoUrl={logoUrl}
    locale={locale}
  />).toString()

  const res = await sendSendgridEmail(
    c,
    user.email,
    localeConfig.passwordResetEmail.subject[locale],
    content,
  )

  return res.ok ? resetCode : null
}

export const sendEmailMfa = async (
  c: Context<typeConfig.Context>,
  user: userModel.Record,
  locale: typeConfig.Locale,
) => {
  const {
    EMAIL_MFA_IS_REQUIRED: enableEmailMfa,
    SENDGRID_API_KEY: sendgridApiKey,
    SENDGRID_SENDER_ADDRESS: sendgridSender,
    COMPANY_LOGO_URL: logoUrl,
  } = env(c)
  if (!enableEmailMfa || !sendgridApiKey || !sendgridSender || !user.email) return null
  const mfaCode = genRandomString(8)
  const content = (<EmailMfaTemplate
    mfaCode={mfaCode}
    logoUrl={logoUrl}
    locale={locale} />).toString()

  const res = await sendSendgridEmail(
    c,
    user.email,
    localeConfig.emailMfaEmail.subject[locale],
    content,
  )

  return res.ok ? mfaCode : null
}
