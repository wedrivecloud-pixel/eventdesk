import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { getAuth } from '@/server/auth';
// Compatibility names retained while callers are ported; no Sites headers are trusted.
export type ChatGPTUser={userId:string;displayName:string;email:string;fullName:string|null};
export async function getChatGPTUser():Promise<ChatGPTUser|null>{
 const session=await getAuth().api.getSession({headers:await headers()});
 if(!session || !session.user.emailVerified)return null;
 return {userId:session.user.id,email:session.user.email,displayName:session.user.name,fullName:session.user.name};
}
export async function requireChatGPTUser(returnTo:string):Promise<ChatGPTUser>{
 const user=await getChatGPTUser();if(user)return user;redirect(chatGPTSignInPath(returnTo));
}
export function safeReturnTo(value:string){
 if(!value.startsWith('/')||value.startsWith('//')||value.includes('\\'))return '/';
 try{const u=new URL(value,'https://app.local');return u.origin==='https://app.local'&&!/^\/(sign-in|sign-out|api\/auth)/.test(u.pathname)?u.pathname+u.search+u.hash:'/';}catch{return '/';}
}
export function chatGPTSignInPath(returnTo:string){return '/sign-in?return_to='+encodeURIComponent(safeReturnTo(returnTo));}
export function chatGPTSignOutPath(){return '/sign-out';}
