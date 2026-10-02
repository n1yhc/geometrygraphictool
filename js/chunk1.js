const NS='http://www.w3.org/2000/svg';
const $=id=>document.getElementById(id);
const stage=$('stage'), defs=$('defs'), art=$('artLayer'), guides=$('guideLayer'),
      hitLayer=$('bridgeHitLayer'), previewLayer=$('bridgePreviewLayer');

const S={
  mode:'grid', type:'hybrid', cols:12, rows:12, gap:0, ratio:0, meta:45, round:0,
  outline:false, gridVisible:true, active:new Set(), blockedBridges:new Set(),
  bridgeEdit:false, dragAction:null, dragSeen:new Set(),
  bridgeEditingDrag:false, bridgeTouched:new Set(), history:[], future:[]
};
const B={x:0,y:0,w:1000,h:1000};
let CURRENT_BRIDGES=[];

const booleanArt=$('booleanArtLayer');
const booleanGuides=$('booleanGuideLayer');
const booleanPreview=$('booleanPreviewLayer');

const BS={
  showGuides:true,
  outline:false,
  editMode:false,
  defaultRadius:80,
  selected:null,
  interaction:null,
  dragId:null,
  dragDX:0,
  dragDY:0,
  hover:null,
  nextId:7,
  controllers:[],
  pathNode:null,
  lastValidPath:null,
  invalidMove:false
};

function boolDefaultControllers(){
  return [
    {id:'bool-1',x:300,y:300,r:122,sign: 1,engaged:true,seed:true},
    {id:'bool-2',x:700,y:290,r: 96,sign: 1,engaged:true,seed:true},
    {id:'bool-3',x:710,y:710,r:126,sign: 1,engaged:true,seed:true},
    {id:'bool-4',x:310,y:720,r: 88,sign: 1,engaged:true,seed:true},
    {id:'bool-5',x:205,y:505,r: 72,sign:-1,engaged:true,seed:false},
    {id:'bool-6',x:805,y:495,r: 88,sign:-1,engaged:true,seed:false}
  ];
}

function boolResetControllers(){
  BS.controllers=boolDefaultControllers();
  BS.selected=null;
  BS.interaction=null;
  BS.dragId=null;
  BS.hover=null;
  BS.defaultRadius=80;
  BS.editMode=false;
  BS.lastValidPath=null;
  BS.invalidMove=false;
}

function boolShapeCenter(circles){
  const positives=circles.filter(c=>c.sign>0);
  const src=positives.length?positives:circles;
  if(!src.length)return {x:500,y:500};
  return {
    x:src.reduce((s,c)=>s+c.x,0)/src.length,
    y:src.reduce((s,c)=>s+c.y,0)/src.length
  };
}

function boolTangentCandidates(c1,c2,center){
  const dx=c2.x-c1.x,dy=c2.y-c1.y;
  const d=Math.hypot(dx,dy);
  if(d<.001)return [];

  const R1=c1.sign*c1.r;
  const R2=c2.sign*c2.r;
  const delta=(R1-R2)/d;
  if(Math.abs(delta)>=.999999)return [];

  const h=Math.sqrt(Math.max(0,1-delta*delta));
  const ux=dx/d,uy=dy/d;
  const px=-uy,py=ux;
  const out=[];

  for(const side of [1,-1]){
    const nx=delta*ux+side*h*px;
    const ny=delta*uy+side*h*py;

    const p1={x:c1.x+R1*nx,y:c1.y+R1*ny};
    const p2={x:c2.x+R2*nx,y:c2.y+R2*ny};
    const mx=(p1.x+p2.x)/2,my=(p1.y+p2.y)/2;

    out.push({
      p1,p2,
      score:Math.hypot(mx-center.x,my-center.y)
    });
  }

  return out;
}

function boolArcCommand(circle,from,to,center){
  const a1=Math.atan2(from.y-circle.y,from.x-circle.x);
  const a2=Math.atan2(to.y-circle.y,to.x-circle.x);
  const two=Math.PI*2;

  const dCW=(a2-a1+two)%two;
  const dCCW=two-dCW;

  const midCW=a1+dCW/2;
  const midCCW=a1-dCCW/2;

  const mCW={
    x:circle.x+circle.r*Math.cos(midCW),
    y:circle.y+circle.r*Math.sin(midCW)
  };
  const mCCW={
    x:circle.x+circle.r*Math.cos(midCCW),
    y:circle.y+circle.r*Math.sin(midCCW)
  };

  const sCW=Math.hypot(mCW.x-center.x,mCW.y-center.y);
  const sCCW=Math.hypot(mCCW.x-center.x,mCCW.y-center.y);

  const useCW=circle.sign>0 ? sCW>=sCCW : sCW<=sCCW;
  const delta=useCW?dCW:dCCW;
  return `A ${circle.r} ${circle.r} 0 ${delta>Math.PI?1:0} ${useCW?1:0} ${to.x} ${to.y}`;
}

function boolOrient(a,b,c){
  return (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
}
function boolSegmentsIntersect(a,b,c,d){
  const eps=1e-6;
  const o1=boolOrient(a,b,c),o2=boolOrient(a,b,d);
  const o3=boolOrient(c,d,a),o4=boolOrient(c,d,b);
  return (o1*o2<-eps)&&(o3*o4<-eps);
}

function boolBuildTwoPath(c1,c2){
  const center=boolShapeCenter([c1,c2]);
  const candidates=boolTangentCandidates(c1,c2,center);
  if(candidates.length<2)return null;

  candidates.sort((a,b)=>b.score-a.score);
  const e1=candidates[0],e2=candidates[1];

  let d=`M ${e1.p1.x} ${e1.p1.y}`;
  d+=` L ${e1.p2.x} ${e1.p2.y} `;
  d+=boolArcCommand(c2,e1.p2,e2.p2,center)+' ';
  d+=` L ${e2.p1.x} ${e2.p1.y} `;
  d+=boolArcCommand(c1,e2.p1,e1.p1,center)+' Z';

  return /NaN|Infinity/.test(d)?null:d;
}

function boolBuildPath(circles){
  if(circles.length<2)return null;
  if(circles.length===2)return boolBuildTwoPath(circles[0],circles[1]);

  const center=boolShapeCenter(circles);
  const ordered=[...circles].sort((a,b)=>{
    const aa=Math.atan2(a.y-center.y,a.x-center.x);
    const bb=Math.atan2(b.y-center.y,b.x-center.x);
    return aa-bb;
  });

  const edges=[];

  for(let i=0;i<ordered.length;i++){
    const c1=ordered[i];
    const c2=ordered[(i+1)%ordered.length];
    const candidates=boolTangentCandidates(c1,c2,center);
    if(!candidates.length)return null;

    candidates.sort((a,b)=>b.score-a.score);
    edges.push(candidates[0]);
  }

  for(let i=0;i<edges.length;i++){
    for(let j=i+1;j<edges.length;j++){
      const adjacent=
        j===i+1 ||
        (i===0&&j===edges.length-1);
      if(adjacent)continue;
      if(boolSegmentsIntersect(edges[i].p1,edges[i].p2,edges[j].p1,edges[j].p2))return null;
    }
  }

  let d=`M ${edges[0].p1.x} ${edges[0].p1.y}`;

  for(let i=0;i<edges.length;i++){
    const edge=edges[i];
    const nextIndex=(i+1)%ordered.length;
    const circle=ordered[nextIndex];

    d+=` L ${edge.p2.x} ${edge.p2.y} `;
    d+=boolArcCommand(circle,edge.p2,edges[nextIndex].p1,center)+' ';
  }

  d+='Z';
  return /NaN|Infinity/.test(d)?null:d;
}

function boolPositiveCircles(excludeId=null){
  let circles=BS.controllers.filter(c=>c.sign>0&&c.engaged&&c.id!==excludeId);

  if(circles.length<2){
    circles=BS.controllers.filter(c=>c.sign>0&&c.id!==excludeId).slice(0,2);
  }

  return circles;
}

function boolPositiveHullPath(excludeId=null){
  return boolBuildPath(boolPositiveCircles(excludeId));
}

function boolPointSegInfo(p,a,b){
  const vx=b.x-a.x,vy=b.y-a.y;
  const len2=vx*vx+vy*vy||1;
  const t=Math.max(0,Math.min(1,((p.x-a.x)*vx+(p.y-a.y)*vy)/len2));
  const q={x:a.x+vx*t,y:a.y+vy*t};
  return {t,d:Math.hypot(p.x-q.x,p.y-q.y)};
}
