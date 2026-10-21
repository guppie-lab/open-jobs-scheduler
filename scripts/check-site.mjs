import fs from 'node:fs';
import {pathToFileURL} from 'node:url';
export async function sampleSite(origin,{fetcher=fetch,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 const result={at:new Date().toISOString(),origin,revision:process.env.GITHUB_SHA||'local',checks:[],warnings:[],passed:true};
 async function check(path,verify,json=true){const start=Date.now();let last;for(let attempt=1;attempt<=3;attempt++)try{const r=await fetcher(origin+path,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw Error('HTTP '+r.status);const body=json?await r.json():await r.text();verify(body);result.checks.push({path,passed:true,attempts:attempt,ms:Date.now()-start});if(attempt>1)result.warnings.push(`${path} recovered after ${attempt} checks`);return body;}catch(error){last=error;if(attempt<3)await pause(1000*attempt);}result.passed=false;result.checks.push({path,passed:false,error:'CRITICAL: '+last.message,attempts:3,ms:Date.now()-start});}
 await check('/',html=>{if(!html.includes('open-jobs')||!html.includes('Search jobs'))throw Error('Homepage failed');},false);
 const board=await check('/api/jobs',data=>{if(!Number.isFinite(data.total)||data.total<1||data.jobs.length!==Math.min(data.total,80)||data.pageSize!==80)throw Error('Inventory/pagination response invalid');});
 if(board)result.jobs=board.total;
 await check('/api/jobs?q=engineer&workplace=Remote',data=>{if(!Array.isArray(data.jobs)||!data.jobs.length||data.jobs.some(job=>job.workplace!=='Remote'))throw Error('Search/filter response invalid');});
 const health=await check('/api/health',data=>{result.health=data;if(!['healthy','degraded','critical'].includes(data.status)||!data.monitoring)throw Error('Monitoring response invalid');if(data.status==='critical')throw Error((data.reasons||['Critical health']).join('; '));});
 if(health?.status==='degraded')result.warnings.push(...health.reasons);
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 const result=await sampleSite(process.env.TRUEJOBS_TEST_ORIGIN||'https://open-jobs.guppielabs.com');
 fs.mkdirSync('artifacts',{recursive:true});fs.writeFileSync('artifacts/production-sample.json',JSON.stringify(result,null,2)+'\n');
 for(const warning of result.warnings)console.warn('::warning::'+warning);
 console.log(JSON.stringify(result));if(!result.passed)process.exitCode=1;
}
