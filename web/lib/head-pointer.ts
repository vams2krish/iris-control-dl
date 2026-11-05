import {median,type Point} from "./gaze";
export type HeadReport={kind:"head";samples:number;jitter:number;passed:boolean};
/** Relative velocity control. Small head movement steers; return to neutral to stop. */
export class HeadPointer {
  private neutral:Point|null=null;private position:Point={x:.5,y:.5};private previous=0;private filtered:Point|null=null;
  private deadzone=.006;
  reset(){this.neutral=null;this.position={x:.5,y:.5};this.previous=0;this.filtered=null;}
  center(points:Point[]):HeadReport {
    const c={x:median(points.map(p=>p.x)),y:median(points.map(p=>p.y))};
    const jitter=Math.sqrt(points.reduce((s,p)=>s+(p.x-c.x)**2+(p.y-c.y)**2,0)/Math.max(1,points.length));
    const passed=points.length>=30&&jitter<=.012;
    if(passed){this.neutral=c;this.position={x:.5,y:.5};this.filtered=c;this.previous=0;this.deadzone=Math.max(.006,Math.min(.025,jitter*3));}
    return{kind:"head",samples:points.length,jitter,passed};
  }
  lost(){this.previous=0;this.filtered=null;}
  update(point:Point,now:number):Point|null {
    if(!this.neutral)return null;
    const dt=this.previous?Math.min(.1,Math.max(0,(now-this.previous)/1000)):0;this.previous=now;
    const old=this.filtered??point;this.filtered={x:old.x+.3*(point.x-old.x),y:old.y+.3*(point.y-old.y)};
    const speed=(d:number)=>Math.abs(d)<this.deadzone?0:Math.sign(d)*Math.min(.8,(Math.abs(d)-this.deadzone)*7);
    this.position={x:Math.max(0,Math.min(1,this.position.x+speed(this.neutral.x-this.filtered.x)*dt)),y:Math.max(0,Math.min(1,this.position.y+speed(this.filtered.y-this.neutral.y)*dt))};
    return{...this.position};
  }
}
