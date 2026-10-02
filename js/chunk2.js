function boolBoundaryOrder(excludeId=null){
  const positives=boolPositiveCircles(excludeId);
  if(positives.length<2)return [];

  const center=boolShapeCenter(positives);
  const orderedPos=[...positives].sort((a,b)=>
    Math.atan2(a.y-center.y,a.x-center.x)-
    Math.atan2(b.y-center.y,b.x-center.x)
  );

  const negatives=BS.controllers.filter(
    c=>c.sign<0&&c.engaged&&c.id!==excludeId
  );

  const buckets=orderedPos.map(()=>[]);

  if(orderedPos.length===2){
    const a=orderedPos[0],b=orderedPos[1];
    const vx=b.x-a.x,vy=b.y-a.y;

    for(const n of negatives){
      const side=vx*(n.y-a.y)-vy*(n.x-a.x);
      const edgeIndex=side>=0?0:1;
      const edgeA=edgeIndex===0?a:b;
      const edgeB=edgeIndex===0?b:a;
      const info=boolPointSegInfo(n,edgeA,edgeB);
      buckets[edgeIndex].push({c:n,t:info.t,d:info.d});
    }
  }else{
    for(const n of negatives){
      let best=null;

      for(let i=0;i<orderedPos.length;i++){
        const a=orderedPos[i];
        const b=orderedPos[(i+1)%orderedPos.length];
        const info=boolPointSegInfo(n,a,b);

        const reach=info.d-n.r;
        const score=reach<0 ? reach*3 : reach;

        if(!best||score<best.score){
          best={i,t:info.t,d:info.d,score};
        }
      }

      if(best)buckets[best.i].push({c:n,t:best.t,d:best.d});
    }
  }

  for(const bucket of buckets)bucket.sort((a,b)=>a.t-b.t);

  const order=[];
  for(let i=0;i<orderedPos.length;i++){
    order.push(orderedPos[i]);
    for(const item of buckets[i])order.push(item.c);
  }

  return order;
}

function boolBuildOrderedPath(ordered){
  if(ordered.length<2)return null;
  if(ordered.length===2)return boolBuildTwoPath(ordered[0],ordered[1]);

  const center=boolShapeCenter(ordered.filter(c=>c.sign>0));
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
      const adjacent=j===i+1||(i===0&&j===edges.length-1);
      if(adjacent)continue;
      if(boolSegmentsIntersect(edges[i].p1,edges[i].p2,edges[j].p1,edges[j].p2)){
        return null;
      }
    }
  }

  let d=`M ${edges[0].p1.x} ${edges[0].p1.y}`;

  for(let i=0;i<edges.length;i++){
    const edge=edges[i];
    const next=(i+1)%ordered.length;
    const circle=ordered[next];

    d+=` L ${edge.p2.x} ${edge.p2.y} `;
    d+=boolArcCommand(circle,edge.p2,edges[next].p1,center)+' ';
  }

  d+='Z';
  return /NaN|Infinity/.test(d)?null:d;
}

function boolRawCurrentPath(excludeId=null){
  const order=boolBoundaryOrder(excludeId);
  return boolBuildOrderedPath(order);
}

function boolPointInPathData(d,p){
  if(!d)return false;
  const temp=el('path',{d,fill:'#000',opacity:'0','pointer-events':'none'});
  booleanArt.appendChild(temp);

  const sp=stage.createSVGPoint();
  sp.x=p.x;sp.y=p.y;

  let inside=false;
  try{inside=temp.isPointInFill(sp)}catch{}
  temp.remove();
  return inside;
}

function boolUpdateEngagement(c){
  if(c.seed&&c.sign>0){
    c.engaged=true;
    return true;
  }

  const hull=boolPositiveHullPath(c.id);
  if(!hull){
    c.engaged=(c.sign>0);
    return true;
  }

  let insideCount=0;
  const samples=36;

  for(let i=0;i<samples;i++){
    const a=Math.PI*2*i/samples;
    const p={
      x:c.x+Math.cos(a)*c.r,
      y:c.y+Math.sin(a)*c.r
    };
    if(boolPointInPathData(hull,p))insideCount++;
  }

  if(c.sign>0){
    c.engaged=insideCount<samples;
    return true;
  }

  if(insideCount===samples)return false;

  c.engaged=insideCount>0;
  return true;
}

function boolConstrainController(c,x,y,r=c.r){
  x=Math.max(r+6,Math.min(1000-r-6,x));
  y=Math.max(r+6,Math.min(1000-r-6,y));

  if(c.sign>0){
    for(let pass=0;pass<4;pass++){
      for(const o of BS.controllers){
        if(o.id===c.id||o.sign<0||!o.engaged)continue;

        let dx=x-o.x,dy=y-o.y,d=Math.hypot(dx,dy);
        const minD=Math.abs(r-o.r)+4;

        if(d<minD){
          if(d<.001){dx=1;dy=0;d=1}
          const push=minD-d;
          x+=dx/d*push;
          y+=dy/d*push;
        }
      }
    }
  }

  return {
    x:Math.max(r+6,Math.min(1000-r-6,x)),
    y:Math.max(r+6,Math.min(1000-r-6,y))
  };
}

function boolTryControllerChange(c,props){
  const old={x:c.x,y:c.y,r:c.r,engaged:c.engaged};

  if(props.r!=null)c.r=Math.max(30,Math.min(180,props.r));

  let x=props.x!=null?props.x:c.x;
  let y=props.y!=null?props.y:c.y;
  const q=boolConstrainController(c,x,y,c.r);
  c.x=q.x;c.y=q.y;

  const engagementOK=boolUpdateEngagement(c);
  if(!engagementOK){
    c.x=old.x;c.y=old.y;c.r=old.r;c.engaged=old.engaged;
    BS.invalidMove=true;
    return false;
  }

  const d=boolRawCurrentPath();
  if(!d){
    c.x=old.x;c.y=old.y;c.r=old.r;c.engaged=old.engaged;
    BS.invalidMove=true;
    return false;
  }

  BS.invalidMove=false;
  BS.lastValidPath=d;
  return true;
}

function boolCurrentPath(){
  const d=boolRawCurrentPath();
  if(d){
    BS.lastValidPath=d;
    return d;
  }
  return BS.lastValidPath;
}

function boolPointInsideCurrent(p){
  const d=boolCurrentPath();
  if(!d)return false;
  return boolPointInPathData(d,p);
}

function boolFindController(p){
  let best=null;
  let bestDistance=Infinity;

  for(const c of BS.controllers){
    const d=Math.hypot(p.x-c.x,p.y-c.y);
    const edge=Math.abs(d-c.r);

    if(edge<=10&&edge<bestDistance){
      best={controller:c,zone:'edge'};
      bestDistance=edge;
    }else if(d<c.r-10&&d<bestDistance){
      best={controller:c,zone:'body'};
      bestDistance=d;
    }
  }

  return best;
}

function boolCreateController(p){
  const inside=boolPointInsideCurrent(p);
  const c={
    id:'bool-'+(BS.nextId++),
    x:p.x,
    y:p.y,
    r:BS.defaultRadius,
    sign:inside?1:-1,
    engaged:false,
    seed:false
  };

  const q=boolConstrainController(c,c.x,c.y,c.r);
  c.x=q.x;c.y=q.y;

  const ok=boolUpdateEngagement(c);
  if(!ok)c.engaged=false;

  BS.controllers.push(c);
  BS.selected=c.id;
  BS.lastValidPath=boolRawCurrentPath()||BS.lastValidPath;
  return c;
}
