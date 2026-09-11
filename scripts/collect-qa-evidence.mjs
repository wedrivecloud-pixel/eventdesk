import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
const names=['pricing-scheduling','questionnaires-api','checklists','staff-scheduling','messages-api','public-booking','sales','design-collections','website-integration','package-manager-actions','package-catalog','management','venue-autocomplete','manage-menu','manage-booking','packages','package-manager','package-links','overview','overview-redesign','global-search','sales-reports','workspace-navigation'];
const history=(await fs.readFile('artifacts/workflow-history.ndjson','utf8')).trim().split('\n').map(JSON.parse);
const latest=Object.fromEntries(history.map(row=>[row.name,row]));
const workflows=[];
for(const name of names){
 const log=await fs.readFile(`artifacts/qa-${name}.log`,'utf8');
 const passed=latest[name]?latest[name].code===0:/^PASS:/m.test(log)&&!/AssertionError|ERR_ASSERTION|^not ok /m.test(log);
 const file=await fs.stat(`artifacts/qa-${name}.log`);
 workflows.push({name,passed,evidence:latest[name]?'recorded process exit':'retained PASS log',testedAt:latest[name]?.testedAt||file.mtime.toISOString(),logSha256:createHash('sha256').update(log).digest('hex')});
}
const browser=JSON.parse(await fs.readFile('artifacts/browser-results.json','utf8'));
const pages=JSON.parse(await fs.readFile('artifacts/browser-layout.json','utf8'));
const performance=JSON.parse(await fs.readFile('artifacts/mobile-performance.json','utf8'));
const platform=await fs.readFile('artifacts/platform-tests.log','utf8');
const count=label=>Number(platform.match(new RegExp(`^# ${label} (\\d+)$`,'m'))?.[1]||0);
const report={
 generatedAt:new Date().toISOString(),scope:'Local standalone build, synthetic Neon staging data, loopback S3 fixtures',
 sourceBaseline:'7ac422fc23b6527bb34950e73373b07e2f7e29b8',
 manifestSha256:createHash('sha256').update(await fs.readFile('dist/standalone/dist/server/__vite_rsc_assets_manifest.js')).digest('hex'),
 workflows,
 platform:{tests:count('tests'),passed:count('pass'),failed:count('fail'),skipped:count('skipped'),logSha256:createHash('sha256').update(platform).digest('hex')},
 browser:{...browser.stats,views:pages.length,widths:[...new Set(pages.map(p=>p.viewport.width))],horizontalOverflow:pages.filter(p=>p.scroll>p.viewport.width+2).length},
 performance:{profile:performance.profile,lcpMs:performance.lcp,cls:performance.cls,longTaskMs:performance.longTaskMs},
 notVerified:['GitHub hosted workflow execution','Railway deployment and container startup','Cloudflare DNS/TLS and public origin gate','Actual Wasabi bucket policies and copied customer objects','Real SMTP verification and password recovery','Legacy customer import and owner mapping','Timed backup/restore drill','Large tenant load and cross-browser acceptance','Remaining SQLite-only legacy harness assertions'],
};
if(workflows.some(w=>!w.passed)||!report.platform.tests||report.platform.failed||report.platform.skipped||report.browser.unexpected||report.browser.horizontalOverflow)throw Error('QA evidence contains failures, skipped platform cases or missing results.');
await fs.writeFile('docs/qa-evidence.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({workflowSuites:workflows.length,platformTests:report.platform.tests,browserViews:pages.length,failed:0}));
