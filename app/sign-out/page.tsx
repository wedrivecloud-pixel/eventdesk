'use client';
import { useState } from 'react';
import { createAuthClient } from 'better-auth/react';
export default function SignOut(){
 const [error,setError]=useState('');
 return <main style={{maxWidth:460,margin:'10vh auto',padding:24}}><h1>Sign out of EventDesk</h1><button onClick={async()=>{try{const result=await createAuthClient().signOut();if(result.error)setError('Unable to sign out. Try again.');else location.assign('/sign-in');}catch{setError('Unable to sign out. Try again.');}}}>Sign out</button><p role="status">{error}</p><a href="/">Return to workspace</a></main>;
}
