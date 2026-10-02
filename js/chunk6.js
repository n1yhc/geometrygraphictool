function renderArt(){
  art.replaceChildren();
  hitLayer.replaceChildren();
  previewLayer.replaceChildren();
  ensureOutlineFilter();
  if(!S.active.size)return;

  const union=buildUnionGroup();

  for(const br of CURRENT_BRIDGES){
    hitLayer.appendChild(el('path',{
      d:br.d,fill:'#000','data-key':br.key,'data-blocked':br.blocked?'1':'0'
    }));

    if(S.bridgeEdit && br.blocked){
      previewLayer.appendChild(el('path',{
        d:br.d,
        fill:'none',
        stroke:'#777',
        'stroke-width':'1.15',
        'stroke-dasharray':'6 5',
        'pointer-events':'none'
      }));
    }
  }

  if(!S.outline){
    art.appendChild(union);
  }else{
    const outlined=union.cloneNode(true);
    outlined.setAttribute('filter','url(#outlineUnion)');
    art.appendChild(outlined);
  }
}
function render(){renderArt();renderGuides();$('caption').textContent=`${S.cols}×${S.rows}`}

function pointInRoundedRect(p,b,rad){
  if(p.x<b.x||p.x>b.x+b.w||p.y<b.y||p.y>b.y+b.h)return false;
  if(rad<=0)return true;
  const cx=Math.max(b.x+rad,Math.min(p.x,b.x+b.w-rad));
  const cy=Math.max(b.y+rad,Math.min(p.y,b.y+b.h-rad));
  return (p.x-cx)**2+(p.y-cy)**2<=rad**2+1e-6;
}
function pointInRegion(r,p){
  if(r.shape==='ellipse'){
    const dx=(p.x-r.cx)/r.rx,dy=(p.y-r.cy)/r.ry;
    return dx*dx+dy*dy<=1;
  }
  if(r.shape==='rect'){
    const rad=Math.min(r.bounds.w,r.bounds.h)*.46*(S.round/100);
    return pointInRoundedRect(p,r.bounds,rad);
  }
  if(r.shape==='hex'){
    const pts=regularHex(r.cx,r.cy,hexGeom().r);
    let sign=0;
    for(let i=0;i<pts.length;i++){
      const a=pts[i],b=pts[(i+1)%pts.length];
      const cross=(b[0]-a[0])*(p.y-a[1])-(b[1]-a[1])*(p.x-a[0]);
      if(cross!==0){const s=Math.sign(cross);if(sign===0)sign=s;else if(sign!==s)return false}
    }
    return true;
  }
  if(r.shape==='corner'){
    const c=r.cell,cx=c.x+c.w/2,cy=c.y+c.h/2;
    const dx=(p.x-cx)/(c.w/2),dy=(p.y-cy)/(c.h/2);
    if(dx*dx+dy*dy<1)return false;
    const rad=Math.min(c.w,c.h)*.46*(S.round/100);
    if(!pointInRoundedRect(p,{x:c.x,y:c.y,w:c.w,h:c.h},rad))return false;
    if(r.corner==='tl')return p.x<=cx&&p.y<=cy;
    if(r.corner==='tr')return p.x>=cx&&p.y<=cy;
    if(r.corner==='br')return p.x>=cx&&p.y>=cy;
    return p.x<=cx&&p.y>=cy;
  }
  return false;
}
function hybridHit(p){
  const g=cellGeom();
  const pitchX=g.cw+S.gap;
  const pitchY=g.ch+S.gap;

  const col=Math.floor((p.x-g.ox)/pitchX);
  const row=Math.floor((p.y-g.oy)/pitchY);

  if(col<0||row<0||col>=S.cols||row>=S.rows)return null;

  const x=g.ox+col*pitchX;
  const y=g.oy+row*pitchY;

  if(p.x<x||p.x>x+g.cw||p.y<y||p.y>y+g.ch)return null;

  const cx=x+g.cw/2;
  const cy=y+g.ch/2;
  const nx=(p.x-cx)/(g.cw/2);
  const ny=(p.y-cy)/(g.ch/2);

  let id;
  if(nx*nx+ny*ny<=1){
    id=`o:${col}:${row}`;
  }else if(p.x<cx&&p.y<cy){
    id=`tl:${col}:${row}`;
  }else if(p.x>=cx&&p.y<cy){
    id=`tr:${col}:${row}`;
  }else if(p.x>=cx&&p.y>=cy){
    id=`br:${col}:${row}`;
  }else{
    id=`bl:${col}:${row}`;
  }

  return regions().find(r=>r.id===id)||null;
}
function hit(p){
  if(S.type==='hybrid')return hybridHit(p);

  const rs=regions();
  for(const r of rs)if(pointInRegion(r,p))return r;
  return null;
}
function hitBridge(p){
  const svgPoint=stage.createSVGPoint();
  svgPoint.x=p.x;svgPoint.y=p.y;
  const nodes=[...hitLayer.children];

  for(let i=nodes.length-1;i>=0;i--){
    const n=nodes[i];
    if(typeof n.isPointInFill==='function'&&n.isPointInFill(svgPoint)){
      return n.getAttribute('data-key');
    }
  }
  return null;
}
function toggleBridgeAtPoint(p){
  const key=hitBridge(p);
  if(!key || S.bridgeTouched.has(key))return false;

  S.bridgeTouched.add(key);
  if(S.blockedBridges.has(key))S.blockedBridges.delete(key);
  else S.blockedBridges.add(key);

  renderArt();
  return true;
}
function paint(p){
  const r=hit(p);
  if(!r||S.dragSeen.has(r.id))return;
  S.dragSeen.add(r.id);
  if(S.dragAction===null)S.dragAction=S.active.has(r.id)?'erase':'paint';
  S.dragAction==='paint'?S.active.add(r.id):S.active.delete(r.id);
  renderArt();
}

stage.addEventListener('pointerdown',ev=>{
  if(S.mode!=='grid')return;
  const p=pointer(ev);

  checkpoint();
  stage.setPointerCapture(ev.pointerId);

  if(S.bridgeEdit){
    S.bridgeEditingDrag=true;
    S.bridgeTouched=new Set();
    toggleBridgeAtPoint(p);
    return;
  }

  S.dragAction=null;
  S.dragSeen=new Set();
  paint(p);
});
stage.addEventListener('pointermove',ev=>{
  if(S.mode!=='grid'||!stage.hasPointerCapture(ev.pointerId))return;
  const p=pointer(ev);

  if(S.bridgeEdit){
    toggleBridgeAtPoint(p);
  }else{
    paint(p);
  }
});
stage.addEventListener('pointerup',ev=>{
  S.dragAction=null;
  S.dragSeen=new Set();
  S.bridgeEditingDrag=false;
  S.bridgeTouched=new Set();
  try{stage.releasePointerCapture(ev.pointerId)}catch{}
});

stage.addEventListener('pointerdown',ev=>{
  if(S.mode!=='boolean')return;

  const p=pointer(ev);
  const hit=boolFindController(p);

  if(BS.editMode){
    if(hit){
      BS.selected=hit.controller.id;
      boolDeleteSelected();
    }else{
      boolCreateController(p);
      renderBoolean();
    }
    return;
  }

  if(hit){
    const c=hit.controller;
    BS.selected=c.id;
    BS.dragId=c.id;
    BS.interaction=hit.zone==='edge'?'resize':'move';

    if(BS.interaction==='move'){
      BS.dragDX=p.x-c.x;
      BS.dragDY=p.y-c.y;
    }

    BS.hover=null;
    stage.setPointerCapture(ev.pointerId);
  }else{
    BS.selected=null;
  }

  renderBoolean();
});

stage.addEventListener('pointermove',ev=>{
  if(S.mode!=='boolean')return;

  const p=pointer(ev);

  if(BS.dragId&&stage.hasPointerCapture(ev.pointerId)){
    const c=BS.controllers.find(x=>x.id===BS.dragId);
    if(!c)return;

    if(BS.interaction==='resize'){
      const r=Math.hypot(p.x-c.x,p.y-c.y);
      boolTryControllerChange(c,{r});
    }else{
      boolTryControllerChange(c,{
        x:p.x-BS.dragDX,
        y:p.y-BS.dragDY
      });
    }

    renderBoolean();
    return;
  }

  if(BS.editMode){
    const hit=boolFindController(p);

    if(hit){
      BS.hover={action:'delete',id:hit.controller.id};
    }else{
      BS.hover={
        action:'add',
        x:p.x,
        y:p.y,
        sign:boolPointInsideCurrent(p)?1:-1
      };
    }

    boolRenderPreview();
    return;
  }

  BS.hover=null;
  boolRenderPreview();
});

stage.addEventListener('pointerleave',()=>{
  if(S.mode!=='boolean'||BS.dragId)return;
  BS.hover=null;
  boolRenderPreview();
});

stage.addEventListener('pointerup',ev=>{
  if(S.mode!=='boolean')return;
  BS.dragId=null;
  BS.interaction=null;
  try{stage.releasePointerCapture(ev.pointerId)}catch{}
  renderBoolean();
});
