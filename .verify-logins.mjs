import { chromium } from '@playwright/test';
const base='http://127.0.0.1:5000', secret=process.env.CLERK_SECRET_KEY;
async function clerk(path,init={}){const r=await fetch('https://api.clerk.com/v1'+path,{...init,headers:{Authorization:`Bearer ${secret}`,'Content-Type':'application/json'}});if(!r.ok)throw new Error(`${path}: ${r.status} ${(await r.text()).slice(0,180)}`);return r.json()}
try {
  console.error('launch'); const browser=await chromium.launch({
    headless:true,
    executablePath:process.env.PLAYWRIGHT_EXECUTABLE_PATH||'/repl/tools/bin/chromium',
  }); const results=[];
 for(const spec of [{email:'captureaperfectmemory@gmail.com',routes:['/dashboard','/admin']},{email:'planner@test.melabridge.com',routes:['/dashboard']}]){
  console.error('lookup',spec.email); const users=await clerk(`/users?email_address=${encodeURIComponent(spec.email)}&limit=10`); const user=users.find(u=>u.email_addresses?.some(x=>x.email_address.toLowerCase()===spec.email.toLowerCase()));
  if(!user){results.push({email:spec.email,clerkUser:false});continue}
  console.error('ticket',spec.email); const t=await clerk('/sign_in_tokens',{method:'POST',body:JSON.stringify({user_id:user.id,expires_in_seconds:120})}); const ctx=await browser.newContext(); const p=await ctx.newPage(); const errors=[]; p.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,160))}); p.on('pageerror',e=>errors.push(e.message.slice(0,160)));
  console.error('exchange',spec.email); await p.goto(`${base}/auth?token=${encodeURIComponent(t.token)}`,{waitUntil:'domcontentloaded',timeout:30000}); await p.waitForTimeout(7000); const checks=[];
  for(const route of spec.routes){console.error('route',spec.email,route);await p.goto(base+route,{waitUntil:'domcontentloaded',timeout:30000});await p.waitForTimeout(5000);const text=(await p.locator('body').innerText()).replace(/\s+/g,' ').trim();checks.push({route,finalPath:new URL(p.url()).pathname,restricted:/AdminOS is restricted/i.test(text),authScreen:/Authentication needs attention|Sign in Create account/i.test(text),expectedContent:route==='/admin'?/AdminOS™|Platform overview|Command center/i.test(text):/Dashboard|planning command center|Welcome/i.test(text),bodySample:text.slice(0,220)})}
  results.push({email:spec.email,clerkUser:true,routes:checks,errors:[...new Set(errors)].slice(0,5)});await ctx.close();
 }
 await browser.close(); console.log(JSON.stringify(results,null,2));
}catch(e){console.error(e?.stack||e);process.exitCode=1}
