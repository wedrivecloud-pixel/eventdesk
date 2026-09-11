'use client';
import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
const auth=createAuthClient();
export default function SignIn() {
 const [mode,setMode]=useState<'signin'|'signup'|'forgot'|'reset'>('signin');
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 async function submit(event:React.FormEvent<HTMLFormElement>){
  event.preventDefault();setBusy(true);setMessage('');
  const data=new FormData(event.currentTarget),email=String(data.get('email')||''),password=String(data.get('password')||'');
  const q=new URLSearchParams(location.search),token=q.get('token');
  let next=q.get('return_to')||'/';
  if(!next.startsWith('/')||next.startsWith('//')||next.includes('\\'))next='/';
  try {
   const result=token?await auth.resetPassword({token,newPassword:password})
    :mode==='signup'?await auth.signUp.email({email,password,name:String(data.get('name')||''),callbackURL:next})
    :mode==='forgot'?await auth.requestPasswordReset({email,redirectTo:location.origin+'/sign-in'})
    :await auth.signIn.email({email,password,callbackURL:next});
   if(result.error)setMessage(result.error.message||'Unable to continue. Please try again.');
   else if(token){setMessage('Password updated. You can sign in.');history.replaceState(null,'','/sign-in');setMode('signin');}
   else if(mode==='signin')location.assign(next);
   else setMessage(mode==='signup'?'Check your email to verify your account.':'If an account exists, a password reset email is on its way.');
  }catch{setMessage('Sign-in is temporarily unavailable. Please try again.');}
  finally{setBusy(false);}
 }
 const token=typeof window!=='undefined'&&new URLSearchParams(location.search).has('token');
 return <main style={{maxWidth:460,margin:'8vh auto',padding:24}}>
  <a href="/" style={{fontWeight:700,fontSize:24}}>EventDesk</a>
  <h1>{token?'Reset password':mode==='signup'?'Create your account':mode==='forgot'?'Reset your password':'Welcome back'}</h1>
  <form onSubmit={submit} style={{display:'grid',gap:16}}>
   {mode==='signup'&&!token&&<label>Your name<input name="name" autoComplete="name" required maxLength={100}/></label>}
   {!token&&<label>Email<input name="email" type="email" autoComplete="email" required maxLength={254}/></label>}
   {(mode!=='forgot'||token)&&<label>Password<input name="password" type="password" autoComplete={mode==='signin'&&!token?'current-password':'new-password'} minLength={12} maxLength={128} required/></label>}
   <button type="submit" disabled={busy}>{busy?'Please wait…':token?'Save password':mode==='signup'?'Create account':mode==='forgot'?'Send reset email':'Sign in'}</button>
   {message&&<p role="status">{message}</p>}
  </form>
  {!token&&<div style={{display:'flex',gap:12,marginTop:20,flexWrap:'wrap'}}>
   <button onClick={()=>{setMode(mode==='signup'?'signin':'signup');setMessage('');}}>{mode==='signup'?'Already have an account? Sign in':'Create an account'}</button>
   <button onClick={()=>{setMode(mode==='forgot'?'signin':'forgot');setMessage('');}}>{mode==='forgot'?'Back to sign in':'Forgot password?'}</button>
  </div>}
 </main>;
}
