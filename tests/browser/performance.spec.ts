import { test,expect } from '@playwright/test';
import fs from 'node:fs/promises';
test('measure cold mobile overview on constrained network and CPU',async({browser})=>{
 if(process.env.SEED_SYNTHETIC_DATA!=='true')throw Error('Synthetic QA required.');
 const base=process.env.QA_BASE_URL||'http://localhost:3100';
 const context=await browser.newContext({viewport:{width:390,height:844}});
 const login=await context.request.post(base+'/api/auth/sign-in/email',{headers:{Origin:base},data:{email:'qa-other@example.test',password:process.env.SEED_PASSWORD}});expect(login.status()).toBe(200);
 const page=await context.newPage(),cdp=await context.newCDPSession(page);
 await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});
 await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:150,downloadThroughput:200000,uploadThroughput:75000});
 await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
 await page.addInitScript(()=>{
  (window as any).__metrics={lcp:0,cls:0,longTaskMs:0};
  new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__metrics.lcp=e.startTime;}).observe({type:'largest-contentful-paint',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())if(!(e as any).hadRecentInput)(window as any).__metrics.cls+=(e as any).value;}).observe({type:'layout-shift',buffered:true});
  new PerformanceObserver(list=>{for(const e of list.getEntries())(window as any).__metrics.longTaskMs+=e.duration;}).observe({type:'longtask',buffered:true});
 });
 await page.goto(base+'/?section=overview');await expect(page.getByRole('heading',{name:'Overview',exact:true,level:1})).toBeVisible({timeout:60000});
 await expect(page.getByRole('heading',{name:'Revenue Snapshot',exact:true})).toBeVisible({timeout:60000});
 await page.waitForTimeout(1500);
 const metrics=await page.evaluate(()=>({...((window as any).__metrics),resources:performance.getEntriesByType('resource').map((e:any)=>({name:new URL(e.name).pathname,bytes:e.transferSize,duration:e.duration}))}));
 await fs.mkdir('artifacts',{recursive:true});await fs.writeFile('artifacts/mobile-performance.json',JSON.stringify({profile:'Cold cache; 1.6 Mbps down, 600 Kbps up, 150 ms latency, 4x CPU slowdown',...metrics},null,2));
 expect.soft(metrics.lcp,'Mobile LCP target 2.5 seconds').toBeLessThanOrEqual(2500);
 expect.soft(metrics.cls,'CLS target 0.1').toBeLessThanOrEqual(0.1);
 await context.close();
});
