import {appendFile} from 'node:fs/promises';
const endpoint='https://truejobs.guppie995858.chatgpt.site/api/maintenance/refresh';
const minutes=Number(process.env.REFRESH_RUN_MINUTES||45);
if(!Number.isInteger(minutes)||minutes<1||minutes>45)throw Error('Refresh duration must be 1–45 minutes');
const maxBatches=1200, stopAt=Date.now()+minutes*60*1000;
let batches=0,failed=new Set(),last,paused='';
while(batches<maxBatches&&Date.now()<stopAt){
  const tokenUrl=new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
  tokenUrl.searchParams.set('audience',endpoint);
  // BEGIN identity retry
  let tokenResponse;
  for(let attempt=0;attempt<3;attempt++){
    tokenResponse=await fetch(tokenUrl,{headers:{Authorization:'Bearer '+process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN},signal:AbortSignal.timeout(15000)});
    if(tokenResponse.ok||![502,503,504].includes(tokenResponse.status)||attempt===2)break;
    await tokenResponse.body?.cancel();
    await new Promise(resolve=>setTimeout(resolve,1000*2**attempt));
  }
  if(!tokenResponse.ok)throw Error('GitHub identity unavailable ('+tokenResponse.status+')');
  // END identity retry
  const {value:token}=await tokenResponse.json();
  if(!token)throw Error('GitHub identity missing');
  let response;
  try{response=await fetch(endpoint,{method:'POST',headers:{Authorization:'Bearer '+token},signal:AbortSignal.timeout(90000)});}
  catch{paused='Maintenance request timed out. Saved cursors and leases will resume next hour.';break;}
  if(!response.ok){paused='Maintenance endpoint returned '+response.status+'. Saved work will resume next hour.';break;}
  last=await response.json();batches++;
  if(batches===1||batches%10===0)console.log(JSON.stringify({batches,due:last.remaining,syncing:last.syncing,updatedAt:last.updatedAt}));
  for(const result of last.results||[])if(result.status==='unavailable'){failed.add(result.source);console.error('Source unavailable: '+result.source+' ('+result.reason+')');}
  if(!last.remaining){if(last.resumeAfterSeconds>0&&last.resumeAfterSeconds<=30&&batches<maxBatches){await new Promise(resolve=>setTimeout(resolve,last.resumeAfterSeconds*1000));continue;}break;}
  await new Promise(resolve=>setTimeout(resolve,1000));
}
await appendFile(process.env.GITHUB_STEP_SUMMARY,`Checked ${batches} of ${maxBatches} bounded batches. Due: ${last?.remaining??'unknown'}. Resumable scans: ${last?.syncing??'unknown'}. Last completed source check: ${last?.updatedAt||'unknown'}.${paused?' '+paused:''}\n`);
if(paused)console.warn('::warning::'+paused);
if(last?.remaining||last?.syncing)console.warn('::warning::Feed backlog remains; saved cursors resume on the next scheduled run.');
if(failed.size)console.warn('::warning::'+failed.size+' source(s) unavailable; cached listings and provider retry limits are preserved.');
console.log('Hourly check finished. Pending scans, if any, resume when provider limits or active leases allow.');
