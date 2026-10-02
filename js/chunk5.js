function shapeNode(r,fill='#000'){
  if(r.kind==='ellipse')return el('ellipse',{cx:r.cx,cy:r.cy,rx:r.rx,ry:r.ry,fill});
  return el('path',{d:r.d,fill});
}

function renderGuides(){
  guides.replaceChildren();
  guides.style.display=S.gridVisible?'':'none';
  if(!S.gridVisible)return;

  if(S.type==='hex'){
    for(const r of regions()){
      guides.appendChild(el('path',{d:r.d,fill:'none',stroke:'#777','stroke-width':1.15}));
    }
    return;
  }

  const g=cellGeom();
  const rr=Math.min(g.cw,g.ch)*.46*(S.round/100);
  for(let row=0;row<S.rows;row++)for(let col=0;col<S.cols;col++){
    const x=g.ox+col*(g.cw+S.gap),y=g.oy+row*(g.ch+S.gap);
    if(S.type==='square'){
      guides.appendChild(el('path',{d:roundedRectPath(x,y,g.cw,g.ch,rr),fill:'none',stroke:'#777','stroke-width':1.15}));
    }else if(S.type==='circle'){
      guides.appendChild(el('ellipse',{cx:x+g.cw/2,cy:y+g.ch/2,rx:g.cw/2,ry:g.ch/2,fill:'none',stroke:'#777','stroke-width':1.15}));
    }else if(S.type==='hybrid'){
      guides.appendChild(el('path',{d:roundedRectPath(x,y,g.cw,g.ch,rr),fill:'none',stroke:'#777','stroke-width':1.15}));
      guides.appendChild(el('ellipse',{cx:x+g.cw/2,cy:y+g.ch/2,rx:g.cw/2,ry:g.ch/2,fill:'none',stroke:'#777','stroke-width':1.15}));
    }
  }
}

function center(r){return {x:r.cx,y:r.cy}}
function actualBoundaryRadius(r,ux,uy){
  if(r.shape==='ellipse'){
    return 1/Math.sqrt((ux*ux)/(r.rx*r.rx)+(uy*uy)/(r.ry*r.ry));
  }
  const b=r.bounds,hw=b.w/2,hh=b.h/2;
  const ax=Math.abs(ux)<1e-6?1e9:hw/Math.abs(ux);
  const ay=Math.abs(uy)<1e-6?1e9:hh/Math.abs(uy);
  let t=Math.min(ax,ay);
  if(r.shape==='corner')t*=.42;
  if(r.shape==='hex')t*=.84;
  return t;
}
function proxyRadius(r){
  if(r.shape==='ellipse') return Math.min(r.rx,r.ry);
  if(r.shape==='rect') return Math.min(r.bounds.w,r.bounds.h)*.40;
  if(r.shape==='hex') return Math.min(r.bounds.w,r.bounds.h)*.36;
  if(r.shape==='corner') return Math.min(r.bounds.w,r.bounds.h)*.13;
  return 20;
}
function vec(center,angle,length){
  return {x:center.x+Math.cos(angle)*length,y:center.y+Math.sin(angle)*length};
}
function dist(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function angleBetween(a,b){return Math.atan2(a.y-b.y,a.x-b.x)}

function metaballPath(a,b,strength){
  const c1=center(a),c2=center(b);
  const r1=proxyRadius(a),r2=proxyRadius(b);
  const d=dist(c1,c2);
  if(!r1||!r2||d<=Math.abs(r1-r2)||d<1)return null;

  const ux=(c2.x-c1.x)/d,uy=(c2.y-c1.y)/d;
  const edgeGap=Math.max(0,d-actualBoundaryRadius(a,ux,uy)-actualBoundaryRadius(b,-ux,-uy));
  const localSize=Math.min(a.bounds?.w||80,a.bounds?.h||80,b.bounds?.w||80,b.bounds?.h||80);
  const maxReach=localSize*(0.12+2.55*strength)+S.gap*.95;
  if(edgeGap<1||edgeGap>maxReach)return null;

  let u1=0,u2=0;
  if(d<r1+r2){
    const cU1=(r1*r1+d*d-r2*r2)/(2*r1*d);
    const cU2=(r2*r2+d*d-r1*r1)/(2*r2*d);
    u1=Math.acos(Math.max(-1,Math.min(1,cU1)));
    u2=Math.acos(Math.max(-1,Math.min(1,cU2)));
  }

  const spreadArg=Math.max(-1,Math.min(1,(r1-r2)/d));
  const maxSpread=Math.acos(spreadArg);
  const baseAngle=angleBetween(c2,c1);

  const v=0.46+0.22*strength;
  const handleSize=2.35+0.55*strength;

  const angle1=baseAngle+u1+(maxSpread-u1)*v;
  const angle2=baseAngle-u1-(maxSpread-u1)*v;
  const angle3=baseAngle+Math.PI-u2-(Math.PI-u2-maxSpread)*v;
  const angle4=baseAngle-Math.PI+u2+(Math.PI-u2-maxSpread)*v;

  const p1=vec(c1,angle1,r1);
  const p2=vec(c1,angle2,r1);
  const p3=vec(c2,angle3,r2);
  const p4=vec(c2,angle4,r2);

  const totalRadius=r1+r2;
  const d2Base=Math.min(v*handleSize,dist(p1,p3)/Math.max(1,totalRadius));
  const d2=d2Base*Math.min(1,(d*2)/Math.max(1,totalRadius));
  const h1=vec(p1,angle1-Math.PI/2,r1*d2);
  const h2=vec(p2,angle2+Math.PI/2,r1*d2);
  const h3=vec(p3,angle3+Math.PI/2,r2*d2);
  const h4=vec(p4,angle4-Math.PI/2,r2*d2);

  return `M ${p1.x} ${p1.y}
          C ${h1.x} ${h1.y} ${h3.x} ${h3.y} ${p3.x} ${p3.y}
          A ${r2} ${r2} 0 ${d>r1?1:0} 0 ${p4.x} ${p4.y}
          C ${h4.x} ${h4.y} ${h2.x} ${h2.y} ${p2.x} ${p2.y}
          Z`;
}
function selectedRegions(){
  const map=new Map(regions().map(r=>[r.id,r]));
  return [...S.active].map(id=>map.get(id)).filter(Boolean);
}
function metaballBridges(sel){
  CURRENT_BRIDGES=[];
  if(S.gap<=0||S.meta<=0||sel.length<2)return [];

  const strength=S.meta/100;
  const candidates=[];

  for(let i=0;i<sel.length;i++)for(let j=i+1;j<sel.length;j++){
    const A=center(sel[i]),B=center(sel[j]);
    const dx=B.x-A.x,dy=B.y-A.y,d=Math.hypot(dx,dy);
    if(d<1)continue;

    const ux=dx/d,uy=dy/d;
    const edgeGap=Math.max(
      0,
      d-actualBoundaryRadius(sel[i],ux,uy)-actualBoundaryRadius(sel[j],-ux,-uy)
    );
    const localSize=Math.min(
      sel[i].bounds?.w||80,sel[i].bounds?.h||80,
      sel[j].bounds?.w||80,sel[j].bounds?.h||80
    );
    const maxReach=localSize*(0.12+2.55*strength)+S.gap*.95;

    if(edgeGap>1&&edgeGap<=maxReach){
      const key=[sel[i].id,sel[j].id].sort().join('|');
      candidates.push({i,j,edgeGap,key});
    }
  }

  candidates.sort((a,b)=>a.edgeGap-b.edgeGap);

  const degree=new Array(sel.length).fill(0);
  const chosen=[];
  const maxDegree=S.meta>72?4:S.meta>38?3:2;

  for(const c of candidates){
    if(degree[c.i]>=maxDegree&&degree[c.j]>=maxDegree)continue;
    const d=metaballPath(sel[c.i],sel[c.j],strength);
    if(!d)continue;
    chosen.push({key:c.key,d,blocked:S.blockedBridges.has(c.key)});
    degree[c.i]++;
    degree[c.j]++;
  }

  CURRENT_BRIDGES=chosen;
  return chosen.filter(b=>!b.blocked);
}
function buildUnionGroup(){
  const g=el('g');
  const sel=selectedRegions();
  for(const r of sel)g.appendChild(shapeNode(r,'#000'));
  for(const br of metaballBridges(sel))g.appendChild(el('path',{d:br.d,fill:'#000'}));
  return g;
}
function ensureOutlineFilter(){
  defs.replaceChildren();
  const f=el('filter',{id:'outlineUnion',x:'-3%',y:'-3%',width:'106%',height:'106%','color-interpolation-filters':'sRGB'});
  f.appendChild(el('feMorphology',{in:'SourceAlpha',operator:'dilate',radius:'2.2',result:'dilated'}));
  f.appendChild(el('feFlood',{'flood-color':'#000',result:'black'}));
  f.appendChild(el('feComposite',{in:'black',in2:'dilated',operator:'in',result:'outer'}));
  f.appendChild(el('feComposite',{in:'outer',in2:'SourceAlpha',operator:'out',result:'ring'}));
  const merge=el('feMerge');
  merge.appendChild(el('feMergeNode',{in:'ring'}));
  f.appendChild(merge);
  defs.appendChild(f);
}
