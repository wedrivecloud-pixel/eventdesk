import nodemailer from 'nodemailer';
import { required } from './config';
/** Account verification/recovery only. CRM automated delivery remains a separate feature. */
export async function sendAccountEmail(to:string,subject:string,url:string) {
  const transport = nodemailer.createTransport({
    host:required('SMTP_HOST'), port:Number(required('SMTP_PORT')),
    secure:process.env.SMTP_SECURE==='true', requireTLS:process.env.SMTP_SECURE!=='true',
    auth:{user:required('SMTP_USER'),pass:required('SMTP_PASSWORD')},
    connectionTimeout:10000,socketTimeout:15000,
  });
  await transport.sendMail({from:required('MAIL_FROM'),to,subject,text:`${subject}\n\n${url}\n\nIf you did not request this, you can ignore this email.`});
}
