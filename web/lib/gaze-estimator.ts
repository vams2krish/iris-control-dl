export type Point = { x: number; y: number };
export type Sample = { features: number[]; target: Point };
export type Profile = { version: 2; x: number[]; y: number[]; mean: number[]; scale: number[] };
export type ValidationReport = { kind: "gaze"; points: number; samples: number; meanError: number; maxError: number; jitter: number; passed: boolean };
export const targets: Point[] = [.15, .5, .85].flatMap(y => [.15, .5, .85].map(x => ({ x, y })));
export const validationTargets: Point[] = [{x:.3,y:.3},{x:.7,y:.3},{x:.5,y:.5},{x:.3,y:.7},{x:.7,y:.7}];
export function median(a: number[]): number { const s=[...a].sort((x,y)=>x-y),m=Math.floor(s.length/2);return s.length%2?s[m]:(s[m-1]+s[m])/2; }
function groups(samples:Sample[]) {
  const result=new Map<string,Sample[]>();
  for(const sample of samples){const key=`${sample.target.x}:${sample.target.y}`,list=result.get(key)??[];list.push(sample);result.set(key,list);}
  return [...result.values()];
}
export function fit(samples:Sample[]):Profile {
  if(samples.length<9||samples.some(s=>s.features.length!==4||s.features.some(v=>!Number.isFinite(v))))throw new Error("Not enough reliable samples");
  const rows=groups(samples).map(g=>({target:g[0].target,features:[0,1,2,3].map(i=>median(g.map(s=>s.features[i])))}));
  if(rows.length<9)throw new Error("All nine different targets are required");
  if([0,1].some(i=>Math.max(...rows.map(s=>s.features[i]))-Math.min(...rows.map(s=>s.features[i]))<.005))throw new Error("Eye movement signal is too small. Try the head pointer instead.");
  // Whiten all features so ridge regularization does not erase small iris signals.
  const mean=[0,1,2,3].map(i=>rows.reduce((s,row)=>s+row.features[i],0)/rows.length);
  const scale=mean.map((m,i)=>Math.max(.001,Math.sqrt(rows.reduce((s,row)=>s+(row.features[i]-m)**2,0)/rows.length)));
  function solve(axis:"x"|"y") {
    const n=5,a=Array.from({length:n},()=>Array(n+1).fill(0) as number[]);
    for(const row of rows){const f=[1,...row.features.map((v,i)=>(v-mean[i])/scale[i])];for(let i=0;i<n;i++){for(let j=0;j<n;j++)a[i][j]+=f[i]*f[j];a[i][n]+=f[i]*row.target[axis];}}
    for(let i=1;i<n;i++)a[i][i]+=.01;
    for(let i=0;i<n;i++){
      let pivot=i;for(let k=i+1;k<n;k++)if(Math.abs(a[k][i])>Math.abs(a[pivot][i]))pivot=k;
      [a[i],a[pivot]]=[a[pivot],a[i]];if(Math.abs(a[i][i])<1e-10)throw new Error("Calibration is degenerate");
      const d=a[i][i];for(let j=i;j<=n;j++)a[i][j]/=d;
      for(let k=0;k<n;k++)if(k!==i){const s=a[k][i];for(let j=i;j<=n;j++)a[k][j]-=s*a[i][j];}
    }
    return a.map(row=>row[n]);
  }
  return {version:2,x:solve("x"),y:solve("y"),mean,scale};
}
export function project(profile:Profile,features:number[]):Point {
  const f=[1,...features.map((v,i)=>(v-profile.mean[i])/profile.scale[i])];
  return {x:profile.x.reduce((s,v,i)=>s+v*f[i],0),y:profile.y.reduce((s,v,i)=>s+v*f[i],0)};
}
export function map(profile:Profile,features:number[]):Point {const p=project(profile,features);return{x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y))};}
export function validate(profile:Profile,samples:Sample[]):ValidationReport {
  const sets=groups(samples),errors:number[]=[],jitters:number[]=[];
  for(const set of sets){const ps=set.map(s=>project(profile,s.features)),c={x:median(ps.map(p=>p.x)),y:median(ps.map(p=>p.y))};errors.push(Math.hypot(c.x-set[0].target.x,c.y-set[0].target.y));jitters.push(...ps.map(p=>Math.hypot(p.x-c.x,p.y-c.y)));}
  const meanError=errors.length?errors.reduce((a,b)=>a+b,0)/errors.length:Infinity,maxError=errors.length?Math.max(...errors):Infinity;
  jitters.sort((a,b)=>a-b);const jitter=jitters[Math.min(jitters.length-1,Math.floor(jitters.length*.9))]??Infinity;
  return {kind:"gaze",points:sets.length,samples:samples.length,meanError,maxError,jitter,passed:sets.length>=5&&samples.length>=100&&meanError<=.05&&maxError<=.1&&jitter<=.035};
}
/** Rotation-invariant iris displacement; both axes use eye WIDTH, never eyelid aperture. */
export function eyeCoordinates(left:Point,right:Point,iris:Point):Point {
  const vx=right.x-left.x,vy=right.y-left.y,d=vx*vx+vy*vy;
  if(d<1e-7)throw new Error("Eye corners are too close");
  const dx=iris.x-(left.x+right.x)/2,dy=iris.y-(left.y+right.y)/2;
  return{x:(dx*vx+dy*vy)/d,y:(-dx*vy+dy*vx)/d};
}
export function readFace(p:{x:number;y:number}[],heightOverWidth=1) {
  if(p.length<478||p.some(v=>!Number.isFinite(v.x)||!Number.isFinite(v.y)))return null;
  const original=p;
  // MediaPipe normalizes x by width and y by height. Convert both to width units
  // before measuring rotated eyes; otherwise the feature depends on video aspect.
  if(!Number.isFinite(heightOverWidth)||heightOverWidth<=0)return null;
  p=p.map(v=>({x:v.x,y:v.y*heightOverWidth}));
  const dist=(a:number,b:number)=>Math.hypot(p[a].x-p[b].x,p[a].y-p[b].y);
  if(dist(33,133)<.015||dist(362,263)<.015)return null;
  const l=eyeCoordinates(p[33],p[133],p[468]),r=eyeCoordinates(p[362],p[263],p[473]);
  const w=Math.max(.001,dist(234,454)),hx=(p[1].x-(p[234].x+p[454].x)/2)/w,hy=(p[1].y-(p[10].y+p[152].y)/2)/Math.max(.001,dist(10,152));
  const inside=[33,263,10,152].every(i=>original[i].x>.02&&original[i].x<.98&&original[i].y>.02&&original[i].y<.98);
  return{features:[(l.x+r.x)/2,(l.y+r.y)/2,hx,hy],head:{x:original[1].x,y:original[1].y},closed:(dist(159,145)/dist(33,133)+dist(386,374)/dist(362,263))/2<.17,confidence:inside&&w>.16&&Math.abs(hx)<.25?.9:.35};
}
export function validProfile(value:unknown):value is Profile {
  if(!value||typeof value!=="object")return false;const p=value as Record<string,unknown>;
  return p.version===2&&["x","y","mean","scale"].every(k=>Array.isArray(p[k])&&(p[k] as number[]).length===(k==="x"||k==="y"?5:4)&&(p[k] as number[]).every(v=>typeof v==="number"&&Number.isFinite(v)))&&(p.scale as number[]).every(v=>v>0);
}
