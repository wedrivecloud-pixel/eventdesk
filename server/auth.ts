import { betterAuth } from 'better-auth/minimal';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { getDb } from '../db';
import * as schema from '../db/auth-schema';
import { appOrigin, required } from './config';
import { sendAccountEmail } from './email';
let instance: ReturnType<typeof createAuth> | undefined;
export function getAuth() { return instance ??= createAuth(); }
function createAuth() {
    const secret = required('BETTER_AUTH_SECRET');
    if (secret.length < 32) throw Error('BETTER_AUTH_SECRET must have at least 32 characters.');
    return betterAuth({
      appName:'Eventdeskly', baseURL:appOrigin(), secret,
      database:drizzleAdapter(getDb(),{provider:'pg',schema}),
      trustedOrigins:[appOrigin()],
      emailAndPassword:{
        enabled:true, minPasswordLength:12, maxPasswordLength:128,
        requireEmailVerification:true, revokeSessionsOnPasswordReset:true,
        sendResetPassword:async({user,url})=>sendAccountEmail(user.email,'Reset your Eventdeskly password',url),
      },
      emailVerification:{
        sendOnSignUp:true, autoSignInAfterVerification:true,
        sendVerificationEmail:async({user,url})=>sendAccountEmail(user.email,'Verify your Eventdeskly email',url),
      },
      session:{expiresIn:60*60*24*7,updateAge:60*60*24,cookieCache:{enabled:false}},
      rateLimit:{enabled:true,storage:'database',window:60,max:60,customRules:{'/sign-in/email':{window:60,max:8},'/sign-up/email':{window:60,max:5},'/request-password-reset':{window:60,max:3}}},
      advanced:{cookiePrefix:'eventdesk',useSecureCookies:appOrigin().startsWith('https:'),ipAddress:{ipAddressHeaders:['x-eventdesk-client-ip']}},
    });
}
