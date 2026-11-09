import { genHist, seedHistory } from './history';
import { rt, STALE_MS, FLAG_MS, canBuffer, newIngest } from './ingest';
import { KIND, DEFTH, DBK, BOARDS, STYPES, DEFB, M, USERS, ESC_MS } from './constants';

export const now=()=>Date.now();
export const rnd=(a,b)=>a+Math.random()*(b-a);
export const series=(v,s)=>Array.from({length:30},(_,i)=>({t:now()-(30-i)*60000,v:+(v+rnd(-s,s)).toFixed(1)}));
export function seed(){
 const mk=(id,farm,name,kind,crop,dev,r)=>({id,farm,name,kind,crop,dev,r,h:Object.fromEntries(Object.entries(r).map(([k,v])=>[k,series(v,k==='ph'?.15:k==='turb'?6:2)]))});
 return{
  farms:[{id:'f1',name:'Sunrise Farm',loc:'Quezon City'},{id:'f2',name:'Lakeside Farm',loc:'Rizal'}],
  areas:[mk('a1','f1','Tomato Garden A','garden','Tomato','d1',{moisture:58}),mk('a2','f2','Lettuce Bed B','garden','Lettuce','d3',{moisture:33}),mk('a3','f1','Tilapia Pond 1','pond','Nile tilapia','d2',{temp:33.1,ph:7.3,turb:118}),mk('a4','f2','Catfish Pond 2','pond','Hito catfish','d4',{temp:28.2,ph:7.1,turb:30})],
  devices:[
   {id:'d1',code:'ESP32-001',name:'Tomato garden controller',mac:'24:6F:28:A1:00:01',board:DEFB,status:'online',seen:now(),battery:82,rssi:-58,fw:'1.2.0',boot:now()-72*3600e3,maint:'ok',key:'a91f03c2d7be4410'},
   {id:'d2',code:'ESP32-002',name:'Tilapia pond controller',mac:'24:6F:28:A1:00:02',board:DEFB,status:'online',seen:now(),battery:41,rssi:-67,fw:'1.2.0',boot:now()-26*3600e3,maint:'due',key:'5be2907a11c8d3f6'},
   {id:'d3',code:'ESP32-003',name:'Lettuce bed controller',mac:'24:6F:28:A1:00:03',board:DEFB,status:'online',seen:now(),battery:null,rssi:-73,fw:'1.1.4',boot:now()-9*3600e3,maint:'ok',key:'c7740d9e3a52b18f'},
   {id:'d4',code:'ESP32-004',name:'Catfish pond controller',mac:'24:6F:28:A1:00:04',board:DEFB,status:'offline',seen:now()-5*3600e3,battery:6,rssi:null,fw:'1.1.4',boot:null,maint:'under',key:'0d3fa86c94e1275b'},
   {id:'d5',code:'ESP32-005',name:'Spare unit',mac:'24:6F:28:A1:00:05',board:'ESP32 DevKit V1 (30-pin)',status:'disconnected',seen:now()-3*86400e3,battery:100,rssi:null,fw:'1.0.0',boot:null,maint:'ok',key:'e18b5c0a7d9342f6'}],
  sensors:[
   {id:'S-001',type:'moisture',dev:'d1',pin:34,area:'a1',fault:false,last:now(),calib:{t:now()-20*86400e3,result:'Pass'}},
   {id:'S-002',type:'moisture',dev:'d3',pin:34,area:'a2',fault:false,last:now(),calib:{t:now()-120*86400e3,result:'Pass'}},
   {id:'S-003',type:'temp',dev:'d2',pin:4,area:'a3',fault:false,last:now(),calib:{t:now()-30*86400e3,result:'Pass'}},
   {id:'S-004',type:'ph',dev:'d2',pin:35,area:'a3',fault:false,last:now(),calib:{t:now()-45*86400e3,result:'Pass'}},
   {id:'S-005',type:'turb',dev:'d2',pin:32,area:'a3',fault:false,last:now(),calib:null},
   {id:'S-006',type:'temp',dev:'d4',pin:4,area:'a4',fault:false,last:now()-5*3600e3,calib:{t:now()-60*86400e3,result:'Pass'}},
   {id:'S-007',type:'ph',dev:'d4',pin:35,area:'a4',fault:false,last:now()-5*3600e3,calib:{t:now()-60*86400e3,result:'Pass'}},
   {id:'S-008',type:'turb',dev:'d4',pin:32,area:'a4',fault:false,last:now()-5*3600e3,calib:{t:now()-60*86400e3,result:'Fail'}}],
  th:DEFTH,
  notifs:[],alertRecs:[],prefs:{},snooze:{},pumps:[
   {...newPump('a1'),lastOn:now()-26*3600e3,lastOff:now()-26*3600e3+480e3,schedules:[{id:'sc1',time:'06:00',days:[0,1,2,3,4,5,6],mins:10,enabled:true,lastRun:null}],sessions:[{id:'s1',start:now()-26*3600e3,end:now()-26*3600e3+480e3,sec:480,trigger:'schedule',stoppedBy:'Timer'}]},
   {...newPump('a2'),lastOn:now()-30*3600e3,lastOff:now()-30*3600e3+300e3,sessions:[{id:'s2',start:now()-30*3600e3,end:now()-30*3600e3+300e3,sec:300,trigger:'manual',stoppedBy:'Manual · Juan Dela Cruz'}]}]};
}
export function load(){try{const d=JSON.parse(localStorage.getItem(DBK));if(d&&d.areas)return migrate(d)}catch(e){}return migrate(seed())}
export function save(d){try{localStorage.setItem(DBK,JSON.stringify(d))}catch(e){}}
export function level(m,v,th){if(v==null)return'normal';const t=th[m]||{};if((t.cl!=null&&v<t.cl)||(t.ch!=null&&v>t.ch))return'critical';if((t.wl!=null&&v<t.wl)||(t.wh!=null&&v>t.wh))return'warning';return'normal'}
export const RANK={normal:0,warning:1,critical:2};
export const devOf=(d,a)=>d.devices.find(x=>x.id===a.dev);
export function areaStatus(d,a){const dv=devOf(d,a);if(!dv)return'unassigned';if(dv.status!=='online')return dv.status==='disconnected'?'disconnected':'offline';
 const th=thOf(d,a);return metricsOf(a).reduce((w,m)=>RANK[level(m,a.r[m],th)]>RANK[w]?level(m,a.r[m],th):w,'normal')}
export function advice(m,v,th){const t=th[m]||{};const lo=(t.wl!=null&&v<t.wl),hi=(t.wh!=null&&v>t.wh);
 return({moisture:'Start irrigation or check the water supply.',temp:hi?'Add shade or fresh water and reduce feeding.':'Check for cold inflow.',ph:lo?'Test the water and add buffer such as agricultural lime.':'Partially change the water and test again.',turb:'Check filtration, reduce feeding and remove debris.'})[m]}
export const ago=t=>{if(!t)return'never';const s=Math.max(1,Math.round((now()-t)/1000));return s<60?s+'s ago':s<3600?Math.round(s/60)+' min ago':s<86400?Math.round(s/3600)+' h ago':Math.round(s/86400)+' d ago'};
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));


/** Sensors enabled for an area (falls back to the defaults for its type). */
export const metricsOf=(a)=>a.metrics&&a.metrics.length?a.metrics:KIND[a.kind];
/** Effective thresholds: global defaults overridden per area. */
export const thOf=(d,a)=>({...d.th,...(a.th||{})});

/* ---- Phase 3: devices, sensors, pins ---- */
export function migrate(d){const s=seed();d.logs=d.logs||[];d.alertRecs=d.alertRecs||[];d.prefs=d.prefs||{};d.snooze=d.snooze||{};d.users=d.users||seedUsers();d.settings={org:'AquaGrow Sentinel Farm',confirmHw:true,escMin:2,...(d.settings||{})};d.sync=d.sync||{intervalMin:5,last:now()-120000,lastTry:now()-120000,status:'successful',pendingAt:null,error:null,lastBackup:null};d.thHist=d.thHist||[];d.ingest=d.ingest||newIngest();d.qflags=d.qflags||{};d.pumps=d.pumps||s.pumps.filter(p=>d.areas.some(a=>a.id===p.area));d.notifs=(d.notifs||[]).filter(x=>x.to);
 d.devices=d.devices.map(v=>({...(s.devices.find(x=>x.id===v.id)||{}),...v}));
 if(!d.sensors){d.sensors=[];s.sensors.forEach(x=>{const a=d.areas.find(y=>y.id===x.area);if(!a||!a.dev||!d.devices.some(v=>v.id===a.dev))return;
  const pin=freePins(d,a.dev,x.type)[0];if(pin==null)return;d.sensors.push({...x,dev:a.dev,pin})})}
 d.maintLog=d.maintLog||seedMaint(d);
 if(!d.hist)d.hist=genHist(d);if(!d.histSeeded){d.histSeeded=true;seedHistory(d)}
 runEngine(d);return d}
export const boardOf=(dv)=>BOARDS[dv.board]||BOARDS[DEFB];
export function freePins(d,devId,type,exceptId){const dv=d.devices.find(x=>x.id===devId);if(!dv)return[];
 const used=new Set(d.sensors.filter(s=>s.dev===devId&&s.id!==exceptId).map(s=>s.pin));return boardOf(dv)[STYPES[type].pin].filter(p=>!used.has(p))}
export const sensorConn=(d,s)=>{const dv=d.devices.find(x=>x.id===s.dev);return!dv||dv.status!=='online'?'offline':s.fault?'disconnected':'connected'};
export function calibState(s){if(!s.calib)return'never';if(s.calib.result==='Fail')return'failed';return now()-s.calib.t>90*86400e3?'due':'ok'}
export const rssiLabel=r=>r==null?'—':r>-60?'Excellent':r>-70?'Good':r>-80?'Fair':'Weak';
export const battVolt=p=>(3.3+p*0.009).toFixed(2);
export function fmtDur(ms){const m=Math.floor(ms/60000);if(m<60)return m+' min';const h=Math.floor(m/60);return h<48?h+' h '+(m%60)+' min':Math.floor(h/24)+' d '+(h%24)+' h'}
export const nextId=(list,prefix,key)=>prefix+String(Math.max(0,...list.map(x=>parseInt(String(x[key]).replace(/\D/g,''))||0))+1).padStart(3,'0');

/* ---- Phase 4: alert incidents, escalation and notifications ---- */
export const PREFDEF={push:true,warning:true,critical:true,offline:true,recovery:true};
const uid=()=>Math.random().toString(36).slice(2,8);
export const rangeText=(m,t)=>{const lo=t.wl,hi=t.wh,u=M[m].u;return lo!=null&&hi!=null?lo+'–'+hi+u:lo!=null?'≥ '+lo+u:'≤ '+hi+u};
const owners=n=>n.users.filter(u=>u.role==='Owner'&&u.active!==false).map(u=>u.id);
/** Staff who work on the farm(s) of the given areas (no areas = all staff). */
const staffFor=(n,areaIds)=>{const f=new Set((areaIds||[]).map(i=>(n.areas.find(a=>a.id===i)||{}).farm).filter(Boolean));
 return n.users.filter(u=>u.role==='Staff'&&u.active!==false&&(!f.size||(u.farms||[]).some(x=>f.has(x)))).map(u=>u.id)};
const audience=(n,r)=>[...owners(n),...(r.assignee?[r.assignee]:staffFor(n,r.areaIds))];
/** Creates one notification per recipient list, honouring each user's preferences (pref=null bypasses them). */
export function notify(n,o){const to=[],delivery={};
 [...new Set(o.to)].forEach(id=>{const p={...PREFDEF,...(n.prefs[id]||{})};if(o.pref&&p[o.pref]===false)return;to.push(id);delivery[id]={inapp:'delivered',push:p.push?'delivered':'off'}});
 if(!to.length)return;
 n.notifs=[{id:'n'+now()+uid(),t:now(),type:o.type,sev:o.sev,title:o.title,msg:o.msg,alertId:o.alertId,areaIds:o.areaIds||[],to,readBy:[],delivery},...n.notifs].slice(0,150)}
/** Detects abnormal readings, offline devices and sensor faults; keeps ONE incident per ongoing problem. */
export function runEngine(n){
 syncPumps(n);n.qflags=n.qflags||{};if(n.hist)Object.keys(n.hist).forEach(k=>{if(!n.areas.some(a=>a.id===k.split(':')[0]))delete n.hist[k]});n.alertRecs=n.alertRecs||[];n.prefs=n.prefs||{};n.notifs=n.notifs||[];n.snooze=n.snooze||{};
 const T=now(),active=new Map();
 const names=ids=>ids.map(i=>(n.areas.find(a=>a.id===i)||{}).name).filter(Boolean).join(', ')||'System';
 n.areas.forEach(a=>{const dv=devOf(n,a);if(!dv||dv.status!=='online'||dv.maint==='under')return;const th=thOf(n,a);
  metricsOf(a).forEach(m=>{const v=a.r[m],l=level(m,v,th);if(l==='normal')return;const t=th[m],low=(t.wl!=null&&v<t.wl)||(t.cl!=null&&v<t.cl);
   active.set('r:'+a.id+':'+m,{kind:'reading',sev:l,areaIds:[a.id],title:M[m].n+(low?' low':' high'),value:v+M[m].u,range:rangeText(m,t),rec:advice(m,v,th)})})});
 n.devices.forEach(v=>{const ar=n.areas.filter(a=>a.dev===v.id);if(v.status!=='online'&&ar.length&&v.maint!=='under')
  active.set('d:'+v.id,{kind:'device',sev:'offline',areaIds:ar.map(a=>a.id),title:v.code+' '+v.status,value:v.drop?'Reconnecting (attempt '+v.drop.attempts+')':v.status==='offline'?'No data':'Not connected',range:'Device online',rec:v.drop?'The device is retrying its Wi-Fi connection automatically.'+(canBuffer(v)?' Readings are stored on the device and will be synchronized when it reconnects.':' This firmware cannot store readings, so data is lost while offline. Update the firmware.'):'Check power, Wi-Fi and the antenna. Inspect the device on site if it stays offline.'})});
 n.sensors.forEach(s=>{const v=n.devices.find(x=>x.id===s.dev);if(v&&v.status==='online'&&s.fault&&v.maint!=='under')
  active.set('s:'+s.id,{kind:'sensor',sev:'critical',areaIds:s.area?[s.area]:[],title:s.id+' sensor disconnected',value:'No signal',range:'Sensor responding',rec:'Check the wiring, power and GPIO pin connection of the sensor.'})});
 Object.keys(n.qflags).forEach(k=>{const q=n.qflags[k];if(T-q.t>FLAG_MS){delete n.qflags[k];return}active.set(k,{kind:'quality',sev:q.sev,areaIds:q.areaIds||[],title:q.title,value:q.value,range:q.range,rec:q.rec})});
 const agoS=ms=>ms<60000?Math.round(ms/1000)+' s':Math.round(ms/60000)+' min';
 if(rt.live)n.sensors.forEach(s=>{const v=n.devices.find(x=>x.id===s.dev);if(v&&v.status==='online'&&!s.fault&&v.maint!=='under'&&s.last&&T-s.last>STALE_MS&&T-(v.since||0)>15000&&T-(s.since||0)>15000)
  active.set('q:miss:'+s.id,{kind:'quality',sev:'warning',areaIds:s.area?[s.area]:[],title:s.id+' has not reported recently',value:'Last reading '+agoS(T-s.last)+' ago',range:'A new reading within '+STALE_MS/1000+' s',rec:'The device is online but this sensor is silent. Check the sensor cable, power and GPIO pin.'})});
 active.forEach((c,key)=>{let r=n.alertRecs.find(x=>x.key===key&&x.status!=='resolved');
  if(!r){if((n.snooze[key]||0)>T)return;
   r={id:'al'+T+uid(),key,...c,value0:c.value,t:T,status:'open',ackAt:null,ackBy:null,resolvedAt:null,resolvedBy:null,assignee:null,escalated:false,hold:false,tl:[{t:T,by:'System',type:'sys',text:'Detected: '+c.value+' (expected '+c.range+')'}]};
   n.alertRecs.unshift(r);
   notify(n,{type:'alert',sev:c.sev,title:names(c.areaIds)+': '+c.title,msg:c.value+' · Expected '+c.range+'. '+c.rec,alertId:r.id,areaIds:c.areaIds,to:audience(n,r),pref:c.sev});
  }else{r.value=c.value;r.range=c.range;r.rec=c.rec;
   if(r.sev!==c.sev){const up=RANK[c.sev]>RANK[r.sev];r.sev=c.sev;r.tl.push({t:T,by:'System',type:'sys',text:'Severity changed to '+c.sev});
    if(up)notify(n,{type:'alert',sev:c.sev,title:names(r.areaIds)+': '+r.title+' is now '+c.sev,msg:c.value+' · Expected '+c.range+'. '+c.rec,alertId:r.id,areaIds:r.areaIds,to:audience(n,r),pref:c.sev})}}});
 n.alertRecs.forEach(r=>{if(r.status==='resolved')return;
  if(!active.has(r.key)){if(r.hold)return;const mv=devKey(n,r.key),mc=!!mv&&mv.maint==='under';
   r.status='resolved';r.resolvedAt=T;r.resolvedBy='System';r.auto=true;r.tl.push({t:T,by:'System',type:'sys',text:mc?'Closed: device placed in maintenance mode.':'Back to normal. Resolved automatically.'});if(mc)return;
   notify(n,{type:'recovery',sev:'normal',title:names(r.areaIds)+': back to normal',msg:r.title+' has recovered.',alertId:r.id,areaIds:r.areaIds,to:audience(n,r),pref:'recovery'});return}
  if(r.sev==='critical'&&r.status==='open'&&!r.escalated&&T-(r.reopenedAt||r.t)>((n.settings&&n.settings.escMin)||2)*60000){r.escalated=true;r.tl.push({t:T,by:'System',type:'sys',text:'Escalated to the owner: still unacknowledged.'});
   notify(n,{type:'escalation',sev:'critical',title:'Unacknowledged: '+names(r.areaIds)+' · '+r.title,msg:'This critical alert has not been acknowledged yet.',alertId:r.id,areaIds:r.areaIds,to:owners(n),pref:'critical'})}});
 if(n.alertRecs.length>300)n.alertRecs=n.alertRecs.slice(0,300)}

/* ---- Phase 5: irrigation and pump control ----
   A command (ON/OFF) is only 'pending' until the ESP32 confirms it. The simulator confirms after 2 s when the
   device is online and fails after 8 s when it is not. The pump state never changes without that confirmation. */
export const newPump=(area)=>({id:'p-'+area,area,state:'off',cmds:[],lastOn:null,lastOff:null,startedAt:null,stopAt:null,trigger:null,locked:false,maxRun:15,cooldownUntil:0,auto:{enabled:false,stopAt:70},schedules:[],sessions:[]});
export function syncPumps(n){n.pumps=n.pumps||[];const g=n.areas.filter(a=>a.kind==='garden');
 g.forEach(a=>{if(!n.pumps.some(p=>p.area===a.id))n.pumps.push(newPump(a.id))});n.pumps=n.pumps.filter(p=>g.some(a=>a.id===p.area))}
export const pending=p=>p.cmds[0]&&p.cmds[0].status==='pending'?p.cmds[0]:null;
export function issueCmd(p,type,trigger,by,mins){p.cmds.unshift({id:'c'+now()+uid(),type,trigger,by,mins:mins||null,t:now(),status:'pending'});p.cmds=p.cmds.slice(0,30)}
export function emergencyStop(p,by){p.locked=true;p.auto.enabled=false;
 p.cmds.forEach(c=>{if(c.status==='pending'&&c.type==='on'){c.status='failed';c.note='Cancelled by emergency stop'}});
 if(!(pending(p)&&pending(p).type==='off'))issueCmd(p,'off','emergency',by)}
const TRIG={manual:'Manual',auto:'Automatic','auto-complete':'Automatic (target reached)',schedule:'Schedule',timer:'Timer',safety:'Safety: maximum runtime',emergency:'Emergency stop'};
export const trigLabel=t=>TRIG[t]||t;
export function addLog(n,msg,by){n.logs=[{id:'l'+now()+uid(),t:now(),by:by||'System',msg},...(n.logs||[])].slice(0,500)}
const sysLog=(n,msg)=>addLog(n,msg,'System');
export function pumpTick(n){const T=now();syncPumps(n);
 n.pumps.forEach(p=>{const a=n.areas.find(x=>x.id===p.area),dv=a&&devOf(n,a),online=!!dv&&dv.status==='online',name=a?a.name:p.area,ids=a?[a.id]:[];
  const c=pending(p);
  if(c){
   if(online&&T-c.t>=2000){c.status='confirmed';c.confirmedAt=T;c.device=dv.code;
    if(c.type==='on'){p.state='on';p.startedAt=T;p.lastOn=T;p.trigger=c.trigger;p.stopAt=c.mins?T+c.mins*60000:null;sysLog(n,name+': pump ON confirmed by '+dv.code+' ('+trigLabel(c.trigger)+')')}
    else{if(p.state==='on'&&p.startedAt){p.sessions.unshift({id:'s'+T+uid(),start:p.startedAt,end:T,sec:Math.round((T-p.startedAt)/1000),trigger:p.trigger,stoppedBy:trigLabel(c.trigger)+(c.by&&c.by!=='System'?' · '+c.by:'')});p.sessions=p.sessions.slice(0,100)}
     p.state='off';p.lastOff=T;p.startedAt=null;p.stopAt=null;p.cooldownUntil=T+(c.trigger==='safety'?300000:60000);sysLog(n,name+': pump OFF confirmed by '+dv.code+' ('+trigLabel(c.trigger)+')')}
   }else if(!online&&T-c.t>=8000){c.status='failed';c.note='No confirmation from the ESP32, so the pump state is unknown.';
    notify(n,{type:'alert',sev:'critical',title:name+': pump '+c.type.toUpperCase()+' command failed',msg:c.note+(c.type==='off'?' Switch the pump off manually.':''),areaIds:ids,to:[...owners(n),...staffFor(n,ids)]});
    sysLog(n,name+': pump '+c.type.toUpperCase()+' command failed (no ESP32 confirmation)')}
   return}
  if(p.state==='on'){const last=p.cmds[0];if(last&&last.type==='off'&&last.status==='failed'&&T-last.t<60000)return;
   if(T-p.startedAt>=p.maxRun*60000){issueCmd(p,'off','safety','System');sysLog(n,name+': maximum runtime reached, stopping pump');
    notify(n,{type:'alert',sev:'warning',title:name+': pump stopped at maximum runtime',msg:'The pump ran for '+p.maxRun+' minutes and was shut off for safety.',areaIds:ids,to:[...owners(n),...staffFor(n,ids)],pref:'warning'})}
   else if(p.stopAt&&T>=p.stopAt)issueCmd(p,'off','timer','System');
   else if(p.trigger==='auto'&&a&&a.r.moisture!=null&&a.r.moisture>=p.auto.stopAt)issueCmd(p,'off','auto-complete','System');
   return}
  if(p.locked||!online||!a||dv.maint==='under')return;
  const mo=a.r.moisture,t=thOf(n,a).moisture||{};
  if(p.auto.enabled&&mo!=null&&T>=p.cooldownUntil&&t.wl!=null&&mo<t.wl){issueCmd(p,'on','auto','System');sysLog(n,name+': moisture '+mo+'% is below '+t.wl+'%, starting pump automatically');return}
  const D=new Date(),day=D.toDateString(),mins=D.getHours()*60+D.getMinutes();
  p.schedules.forEach(s=>{if(!s.enabled||s.lastRun===day||!s.days.includes(D.getDay())||pending(p)||p.state!=='off')return;
   const diff=mins-(parseInt(s.time.slice(0,2))*60+parseInt(s.time.slice(3)));
   if(diff>=0&&diff<5){s.lastRun=day;issueCmd(p,'on','schedule','System',s.mins);sysLog(n,name+': scheduled irrigation ('+s.time+') started')}})})}

/* ---- Phase 7: users, permissions, settings ---- */
// SHA-256 (public-domain compact implementation). Prototype-grade hashing; a real backend should use bcrypt/argon2.
export function sha256(ascii){const rr=(v,a)=>(v>>>a)|(v<<(32-a)),maxW=Math.pow(2,32),words=[],bits=ascii.length*8;let result='',hash=sha256.h=sha256.h||[],k=sha256.k=sha256.k||[],pc=k.length;const comp={};
 for(let c=2;pc<64;c++){if(!comp[c]){for(let i=0;i<313;i+=c)comp[i]=c;hash[pc]=(Math.pow(c,.5)*maxW)|0;k[pc++]=(Math.pow(c,1/3)*maxW)|0}}
 ascii+='\x80';while(ascii.length%64-56)ascii+='\x00';
 for(let i=0;i<ascii.length;i++){const j=ascii.charCodeAt(i);if(j>>8)return;words[i>>2]|=j<<((3-i)%4)*8}
 words[words.length]=(bits/maxW)|0;words[words.length]=bits;
 for(let j=0;j<words.length;){const w=words.slice(j,j+=16),old=hash;hash=hash.slice(0,8);
  for(let i=0;i<64;i++){const w15=w[i-15],w2=w[i-2],a=hash[0],e=hash[4];
   const t1=hash[7]+(rr(e,6)^rr(e,11)^rr(e,25))+((e&hash[5])^((~e)&hash[6]))+k[i]+(w[i]=(i<16)?w[i]:(w[i-16]+(rr(w15,7)^rr(w15,18)^(w15>>>3))+w[i-7]+(rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
   const t2=(rr(a,2)^rr(a,13)^rr(a,22))+((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
   hash=[(t1+t2)|0].concat(hash);hash[4]=(hash[4]+t1)|0}
  for(let i=0;i<8;i++)hash[i]=(hash[i]+old[i])|0}
 for(let i=0;i<8;i++)for(let j=3;j+1;j--){const b=(hash[i]>>(j*8))&255;result+=((b<16)?0:'')+b.toString(16)}
 return result}
export const hashPw=(pw,salt)=>sha256(unescape(encodeURIComponent(salt+':'+pw)));
export const genPw=()=>{const c='ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';let o='';for(let i=0;i<9;i++)o+=c[Math.floor(Math.random()*c.length)];return o+'7'};
export function seedUsers(){return USERS.map(u=>({id:u.id,name:u.name,email:u.email,phone:u.phone,role:u.role,farms:u.farms,perms:{},active:true,photo:null,salt:u.id,pw:hashPw(u.pw,u.id),mustChange:false,created:now()-90*864e5,lastLogin:null}))}
export function seedMaint(d){const dv=c=>d.devices.find(v=>v.code===c),T=now(),D=864e5,out=[];
 const add=(dd,by,type,id,label,notes,result)=>{if(id)out.push({id:'mh'+out.length,t:T-dd*D,by,type,targetId:id,targetLabel:label,notes,result:result||null})};
 add(20,'Juan Dela Cruz','battery',dv('ESP32-001')?.id,'ESP32-001','Replaced the 18650 battery');
 add(11,'Juan Dela Cruz','cleaning',d.sensors.find(s=>s.id==='S-005')?.id,'S-005','Cleaned the turbidity sensor lens');
 add(7,'Pedro Lim','repair',dv('ESP32-004')?.id,'ESP32-004','Re-soldered the antenna connector');
 add(30,'Juan Dela Cruz','calibration',d.sensors.find(s=>s.id==='S-003')?.id,'S-003','Checked against a reference thermometer','Pass');
 return out}
export const DEFPERM=true;
/** Effective permission: Owner always, Viewer never, Staff unless switched off for that user. */
export const can=(u,p)=>!u?false:u.role==='Owner'?true:u.role==='Viewer'?false:!(u.perms&&u.perms[p]===false);
/** What a user may see: Owners see everything; others only their assigned farms (and unassigned spare devices). */
export function scope(d,u){if(!u||u.role==='Owner')return d;
 const F=new Set(u.farms||[]),areas=d.areas.filter(a=>F.has(a.farm)),A=new Set(areas.map(a=>a.id)),Dv=new Set(areas.map(a=>a.dev).filter(Boolean)),used=new Set(d.areas.map(a=>a.dev).filter(Boolean));
 return{...d,farms:d.farms.filter(f=>F.has(f.id)),areas,devices:d.devices.filter(v=>Dv.has(v.id)||!used.has(v.id)),sensors:d.sensors.filter(s=>Dv.has(s.dev)||!used.has(s.dev)),pumps:d.pumps.filter(p=>A.has(p.area)),
  alertRecs:d.alertRecs.filter(r=>r.areaIds.length?r.areaIds.some(i=>A.has(i)):true),logs:[]}}
const devKey=(n,k)=>{const[t,a]=k.split(':');if(t==='d')return n.devices.find(v=>v.id===a);if(t==='s'){const s=n.sensors.find(x=>x.id===a);return s&&n.devices.find(v=>v.id===s.dev)}
 if(t==='r'){const ar=n.areas.find(x=>x.id===a);return ar&&devOf(n,ar)}};
export const thDiff=(a,b)=>[...new Set([...Object.keys(a||{}),...Object.keys(b||{})])].some(k=>(a||{})[k]!==(b||{})[k]);
export function recordTh(n,by,scopeLabel,m,before,after){n.thHist=[{id:'th'+now()+uid(),t:now(),by,scope:scopeLabel,metric:m,before:before||{},after:after||{}},...(n.thHist||[])].slice(0,200)}
/** Simulated device synchronisation: Pending -> Successful / Failed. */
export function syncTick(n){const s=n.sync,T=now();if(!s)return;
 if(s.status==='pending'){if(T-s.pendingAt>=2000){const ok=n.devices.some(v=>v.status==='online');s.status=ok?'successful':'failed';s.error=ok?null:'No ESP32 device could be reached.';if(ok)s.last=T;s.pendingAt=null;if(s.by){addLog(n,ok?'Device synchronization completed':'Device synchronization failed',s.by);s.by=null}}}
 else if(T-(s.lastTry||0)>=s.intervalMin*60000){s.status='pending';s.pendingAt=T;s.lastTry=T}}
