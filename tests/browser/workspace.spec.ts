import { test, expect } from '@playwright/test';
import { workspaceViews,workspaceHref,viewTitle } from '../../lib/workspace-navigation';
import fs from 'node:fs/promises';
test('all workspace sections render on desktop and mobile without page overflow',async({browser})=>{
 if(process.env.SEED_SYNTHETIC_DATA!=='true')throw Error('Browser QA requires synthetic data.');
 const base=process.env.QA_BASE_URL||'http://localhost:3100';
 const context=await browser.newContext();
 const login=await context.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:'qa-other@example.test',password:process.env.SEED_PASSWORD}});
 expect(login.status()).toBe(200);
 const page=await context.newPage(),errors:string[]=[],report:unknown[]=[];
 page.on('pageerror',error=>errors.push(error.message));
 page.on('response',response=>{if(response.url().includes('/_next/static/')&&response.status()>=400)errors.push(`Asset HTTP ${response.status()}: ${new URL(response.url()).pathname}`);});
 await page.addInitScript(()=>{
  (window as any).__lcp=0;
  new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
 });
 for(const viewport of [{width:1440,height:1000},{width:390,height:844}]){
  await page.setViewportSize(viewport);
  for(const view of workspaceViews){
   const start=Date.now(),snapshot=page.waitForResponse(r=>r.url()===base+'/api/crm'&&r.request().method()==='GET');
   await page.goto(base+workspaceHref(view));
   const response=await snapshot;expect(response.status()).toBe(200);expect((await response.json()).business.id).toBe('qa-other-business');
   await expect(page.getByRole('heading',{name:viewTitle(view),exact:true,level:1}).first()).toBeVisible({timeout:20000});
   await expect(page.getByText('Your workspace is temporarily unavailable. Please try again.',{exact:true})).toHaveCount(0);
   const layout=await page.evaluate(()=>({width:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth,lcp:(window as any).__lcp}));
   report.push({view,viewport,elapsedMs:Date.now()-start,...layout});
   await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/browser-layout.json',JSON.stringify(report,null,2));
   expect.soft(layout.scroll,`${view} at ${viewport.width}px`).toBeLessThanOrEqual(viewport.width+2);
   if(['Overview','Packages','Questionnaire templates','Bookings'].includes(view))await page.screenshot({path:`artifacts/${view.replaceAll(' ','-')}-${viewport.width}.png`,fullPage:true});
  }
 }
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/browser-layout.json',JSON.stringify(report,null,2));
 expect(errors).toEqual([]);await context.close();
});
