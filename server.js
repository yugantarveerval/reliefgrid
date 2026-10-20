// ReliefGrid server (zero dependencies): shared live DB, role-based login, SMS/WhatsApp webhook, realtime via SSE.
const http=require("http"),fs=require("fs"),path=require("path"),crypto=require("crypto"),qs=require("querystring");
const PORT=process.env.PORT||3000,DB=process.env.DB_FILE||path.join(__dirname,"data.json"),PUB=path.join(__dirname,"public");
const PINS={coord:process.env.COORD_PIN||"coord123",vol:process.env.VOL_PIN||"vol123"};
const SECRET=process.env.SECRET||crypto.randomBytes(16).toString("hex");
const DLAT=+process.env.DEFAULT_LAT||28.61,DLNG=+process.env.DEFAULT_LNG||77.21;
if(!process.env.COORD_PIN)console.log("WARNING: using default PINs. Set COORD_PIN, VOL_PIN and SECRET before going live.");
const sign=r=>r+"."+crypto.createHmac("sha256",SECRET).update(r).digest("hex").slice(0,24);
const roleOf=q=>{const t=(q.headers.authorization||"").replace("Bearer ","");const [r]=t.split(".");return(r==="coord"||r==="vol")&&t===sign(r)?r:"public"};
const rank={public:0,vol:1,coord:2};
const now=Date.now(),H=36e5,M=JSON.parse(fs.readFileSync(path.join(PUB,"model.json")));
// same Naive Bayes + features as the browser
const feats=t=>{const w=(t.toLowerCase().match(/[a-z0-9]+/g)||[]);return new Set([...w,...w.slice(1).map((x,i)=>w[i]+"_"+x),...w.filter(x=>x.length>=5).map(x=>"p:"+x.slice(0,5))])};
const nb=(m,f)=>{let b=null;for(const l of m.labels){let s=m.prior[l]+m.ln[l];const W=m.w[l];f.forEach(x=>{if(x in W)s+=W[x]});if(!b||s>b[0])b=[s,l]}return b[1]};
const VUL=/child|baby|elder|old man|senior|pregnan|disabled|wheelchair|bachch|bujurg/i;
const classify=t=>{const f=feats(t),n=t.match(/\b(\d{1,3})\b/);return{cat:nb(M.category,f),sev:+nb(M.severity,f),vuln:VUL.test(t),people:n?+n[1]:1}};
let S={needs:[
{id:"n1",text:"Family trapped on first floor, flood water rising, two children",cat:"rescue",people:5,sev:5,vuln:true,lat:28.62,lng:77.21,t:now-3*H,st:"open"},
{id:"n2",text:"Elderly man out of insulin and feverish",cat:"medical",people:1,sev:4,vuln:true,lat:28.58,lng:77.25,t:now-6*H,st:"open"},
{id:"n3",text:"Camp of 40 people has no drinking water since yesterday",cat:"water",people:40,sev:4,vuln:false,lat:28.66,lng:77.18,t:now-10*H,st:"open"}],
vols:[{id:"v1",name:"Asha (nurse)",skill:"medical",lat:28.6,lng:77.22,free:true},{id:"v2",name:"Ravi (boat team)",skill:"rescue",lat:28.64,lng:77.2,free:true},{id:"v3",name:"Meera",skill:"water",lat:28.65,lng:77.17,free:true}],
res:[{id:"r1",name:"Drinking water (litres)",cat:"water",qty:60},{id:"r2",name:"First-aid kits",cat:"medical",qty:6}]};
try{S=JSON.parse(fs.readFileSync(DB))}catch(e){}
const CATS=["medical","food","water","shelter","rescue"],clamp=(v,a,b,d)=>Math.min(b,Math.max(a,+v||d));
const str=(v,n)=>String(v??"").slice(0,n);
const clean={ // whitelist and validate every field a client can write
 needs:o=>({id:o.id,text:str(o.text,400),cat:CATS.includes(o.cat)?o.cat:"rescue",people:clamp(o.people,1,9999,1),sev:clamp(o.sev,1,5,3),vuln:!!o.vuln,lat:clamp(o.lat,-90,90,DLAT),lng:clamp(o.lng,-180,180,DLNG),t:+o.t||Date.now(),st:["open","assigned","done"].includes(o.st)?o.st:"open",vol:o.vol?str(o.vol,30):undefined,src:o.src?str(o.src,10):undefined,contact:o.contact?str(o.contact,40):undefined,noloc:o.noloc?true:undefined,review:o.review?true:undefined}),
 vols:o=>({id:o.id,name:str(o.name,60),skill:CATS.includes(o.skill)?o.skill:"rescue",lat:clamp(o.lat,-90,90,DLAT),lng:clamp(o.lng,-180,180,DLNG),free:!!o.free,task:o.task?str(o.task,30):null}),
 res:o=>({id:o.id,name:str(o.name,80),cat:CATS.includes(o.cat)?o.cat:"food",qty:clamp(o.qty,0,1e7,0)})};
const view=role=>rank[role]>=1?S:{...S,needs:S.needs.map(({contact,...n})=>n)};
let clients=new Map(),timer;
const persist=()=>{clearTimeout(timer);timer=setTimeout(()=>fs.writeFile(DB,JSON.stringify(S),()=>{}),300)};
const push=()=>{const c={};clients.forEach((role,r)=>{c[role]=c[role]||"data: "+JSON.stringify(view(role))+"\n\n";r.write(c[role])});persist()};
const hits=new Map(),limited=ip=>{const a=(hits.get(ip)||[]).filter(t=>Date.now()-t<36e5);a.push(Date.now());hits.set(ip,a);return a.length>30};
const T={".html":"text/html",".js":"text/javascript",".json":"application/json",".svg":"image/svg+xml",".css":"text/css"};
const body=q=>new Promise(r=>{let b="";q.on("data",c=>{b+=c;if(b.length>1e5)q.destroy()});q.on("end",()=>r(b))});
const J=(r,c,o)=>{r.writeHead(c,{"Content-Type":"application/json"});r.end(JSON.stringify(o))};
http.createServer(async(q,r)=>{
 const p=new URL(q.url,"http://x").pathname,role=roleOf(q),ip=q.headers["x-forwarded-for"]||q.socket.remoteAddress;
 if(p==="/api/stream"){const t=new URL(q.url,"http://x").searchParams.get("token")||"";const rl=(t.split(".")[0]&&(t===sign("coord")?"coord":t===sign("vol")?"vol":"public"))||"public";
  r.writeHead(200,{"Content-Type":"text/event-stream","Cache-Control":"no-cache",Connection:"keep-alive"});r.write("data: "+JSON.stringify(view(rl))+"\n\n");clients.set(r,rl);q.on("close",()=>clients.delete(r));return}
 if(p==="/api/login"&&q.method==="POST"){try{const{pin}=JSON.parse(await body(q));const role=pin===PINS.coord?"coord":pin===PINS.vol?"vol":null;if(!role||limited("login"+ip+"x".repeat(0)))return J(r,401,{error:"Wrong PIN"});return J(r,200,{role,token:sign(role)})}catch(e){return J(r,400,{error:"bad request"})}}
 if(p==="/api/sms"&&q.method==="POST"){ // Twilio SMS / WhatsApp webhook (application/x-www-form-urlencoded)
  const f=qs.parse(await body(q)),text=str(f.Body,400).trim(),from=str(f.From,40);
  if(limited("sms"+from)){r.writeHead(429);return r.end()}
  const m=text.match(/(-?\d{1,2}\.\d+)\s*[, ]\s*(-?\d{1,3}\.\d+)/),c=classify(text),has=!!m;
  const n=clean.needs({text,...c,lat:has?+m[1]:DLAT,lng:has?+m[2]:DLNG,t:Date.now(),st:"open",src:from.startsWith("whatsapp")?"whatsapp":"sms",contact:from,noloc:!has});
  n.review=nb(M.action,feats(text))==="no"; // never dropped, only flagged for a human to check
  n.id="n"+Date.now().toString(36)+Math.random().toString(36).slice(2,5);S.needs.push(n);push();
  r.writeHead(200,{"Content-Type":"text/xml"});return r.end(`<?xml version="1.0"?><Response><Message>ReliefGrid: request received (${c.cat}, priority ${c.sev}/5). Help is being coordinated.${has?"":" Reply with your location as lat,lng (e.g. 28.61,77.21) or a landmark so volunteers can find you."}</Message></Response>`)}
 if(p==="/api/state"){return J(r,200,view(role))}
 const m=p.match(/^\/api\/(needs|vols|res)(?:\/(.+))?$/);
 if(m){const coll=m[1];
  if(q.method==="DELETE"){if(role!=="coord")return J(r,403,{error:"Coordinator only"});S[coll]=S[coll].filter(x=>x.id!==m[2]);push();r.writeHead(204);return r.end()}
  if(q.method==="POST"){let o;try{o=JSON.parse(await body(q))}catch(e){return J(r,400,{error:"bad json"})}
   const creating=!o.id||!S[coll].some(x=>x.id===o.id);
   if(coll==="needs"&&creating){if(limited("need"+ip))return J(r,429,{error:"Too many reports, try again later"});o.src=o.src||"app";o.st="open";delete o.vol}  // anyone may report a new need
   else if(coll==="res"){if(role!=="coord")return J(r,403,{error:"Coordinator only"})}
   else if(rank[role]<1)return J(r,403,{error:"Login required"});
   if(!o.id)o.id=coll[0]+Date.now().toString(36)+Math.random().toString(36).slice(2,5);
   const old=S[coll].find(x=>x.id===o.id),v=clean[coll](o);if(old&&coll==="needs"){v.contact=old.contact;v.src=old.src;v.review=old.review}
   const i=S[coll].findIndex(x=>x.id===v.id);i<0?S[coll].push(v):S[coll][i]=v;push();return J(r,200,rank[role]>=1?v:{id:v.id})}
 }
 let f=path.join(PUB,p==="/"?"index.html":p);if(!f.startsWith(PUB))return r.writeHead(403),r.end();
 fs.readFile(f,(e,d)=>{if(e){r.writeHead(404);return r.end("not found")}r.writeHead(200,{"Content-Type":T[path.extname(f)]||"application/octet-stream","Cache-Control":p==="/sw.js"?"no-cache":"public,max-age=300"});r.end(d)});
}).listen(PORT,()=>console.log("ReliefGrid running on http://localhost:"+PORT));
