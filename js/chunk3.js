function boolDeleteSelected(){
  if(!BS.selected)return false;

  const target=BS.controllers.find(c=>c.id===BS.selected);
  if(!target)return false;

  const internalCount=BS.controllers.filter(c=>c.sign>0).length;
  if(target.sign>0&&internalCount<=2){
    $('boolStatus').textContent='면을 유지하려면 내부원이 최소 2개 필요합니다.';
    return false;
  }

  const old=BS.controllers;
  BS.controllers=BS.controllers.filter(c=>c.id!==BS.selected);

  const d=boolRawCurrentPath();
  if(!d){
    BS.controllers=old;
    $('boolStatus').textContent='이 원을 지우면 형태를 계산할 수 없어 삭제하지 않았습니다.';
    return false;
  }

  BS.lastValidPath=d;
  BS.selected=null;
  BS.dragId=null;
  BS.interaction=null;
  renderBoolean();
  return true;
}

function boolRenderGuides(){
  booleanGuides.replaceChildren();
  booleanGuides.style.display=(S.mode==='boolean'&&BS.showGuides)?'':'none';
  if(!BS.showGuides)return;

  for(const c of BS.controllers){
    const selected=c.id===BS.selected;

    booleanGuides.appendChild(el('circle',{
      cx:c.x,cy:c.y,r:c.r,
      fill:'none',
      stroke:selected?(c.sign>0?'#fff':'#111'):(c.engaged?'#777':'#bbb'),
      'stroke-opacity':'1',
      'stroke-width':selected?(c.sign>0?'3.4':'2.4'):'1.15',
      'stroke-dasharray':c.sign<0?'6 5':'none'
    }));

    booleanGuides.appendChild(el('circle',{
      cx:c.x,cy:c.y,r:selected?3.5:2.5,
      fill:selected?'#111':'#999'
    }));

    if(selected){
      booleanGuides.appendChild(el('circle',{
        cx:c.x+c.r,
        cy:c.y,
        r:5,
        fill:'#fff',
        stroke:'#111',
        'stroke-width':'1.2'
      }));
    }
  }
}

function boolRenderPreview(){
  booleanPreview.replaceChildren();
  booleanPreview.style.display=S.mode==='boolean'?'':'none';

  if(S.mode!=='boolean'||!BS.editMode||!BS.hover||BS.dragId)return;

  if(BS.hover.action==='delete'){
    const c=BS.controllers.find(x=>x.id===BS.hover.id);
    if(!c)return;

    const bx=c.x+c.r*.72;
    const by=c.y-c.r*.72;

    booleanPreview.appendChild(el('rect',{
      x:bx-18,y:by-11,width:36,height:22,
      class:'boolean-hover-action-bg'
    }));

    const t=el('text',{
      x:bx,y:by+4,
      class:'boolean-hover-action',
      'text-anchor':'middle'
    });
    t.textContent='삭제';
    booleanPreview.appendChild(t);
    return;
  }

  const {x,y,sign}=BS.hover;
  const r=BS.defaultRadius;

  booleanPreview.appendChild(el('circle',{
    cx:x,cy:y,r,
    fill:'none',
    stroke:'#999',
    'stroke-width':'1.15',
    'stroke-dasharray':'5 5',
    'pointer-events':'none'
  }));

  const t=el('text',{
    x,
    y:y-r-10,
    class:'boolean-preview-label',
    'text-anchor':'middle'
  });
  t.textContent=sign>0?'내부원 추가':'외부원 추가';
  booleanPreview.appendChild(t);
}

function renderBoolean(){
  booleanArt.replaceChildren();

  const d=boolCurrentPath();
  if(d){
    const p=el('path',{
      d,
      fill:BS.outline?'none':'#000',
      stroke:BS.outline?'#000':'none',
      'stroke-width':BS.outline?'2':'0',
      'stroke-linejoin':'round',
      'stroke-linecap':'round',
      'fill-rule':'nonzero'
    });
    booleanArt.appendChild(p);
    BS.pathNode=p;
  }else{
    BS.pathNode=null;
  }

  booleanArt.style.display=S.mode==='boolean'?'':'none';
  boolRenderGuides();
  boolRenderPreview();

  const selected=BS.controllers.find(c=>c.id===BS.selected);

  if(selected){
    $('boolRadiusVal').textContent=Math.round(selected.r);
    $('boolRadius').value=Math.round(selected.r);

    if(BS.invalidMove){
      $('boolStatus').textContent='이 위치에서는 형태가 깨져 마지막 유효 위치를 유지합니다.';
    }else{
      $('boolStatus').textContent=selected.sign>0
        ? '내부원 · 바깥으로 밀면 면이 돌출됩니다.'
        : '외부원 · 안쪽으로 밀면 면이 파입니다.';
    }
  }else{
    $('boolRadiusVal').textContent=Math.round(BS.defaultRadius);
    $('boolRadius').value=Math.round(BS.defaultRadius);
    $('boolStatus').textContent='';
  }

  bindBoolRadiusEditor();
  $('boolEditModeBtn').classList.toggle('checked',BS.editMode);
  $('boolOutlineBtn').classList.toggle('checked',BS.outline);
  $('boolGuideBtn').classList.toggle('checked',!BS.showGuides);
}

function boolReset(){
  boolResetControllers();
  BS.lastValidPath=boolRawCurrentPath();
  renderBoolean();
}

function boolExportSvg(){
  const d=boolCurrentPath();
  if(!d)return;

  const out=el('svg',{
    xmlns:NS,
    viewBox:'0 0 1000 1000',
    width:'1000',
    height:'1000'
  });

  out.appendChild(el('path',{
    d,
    fill:BS.outline?'none':'#000',
    stroke:BS.outline?'#000':'none',
    'stroke-width':BS.outline?'2':'0',
    'fill-rule':'nonzero'
  }));

  const data='<?xml version="1.0" encoding="UTF-8"?>\n'+out.outerHTML;
  const blob=new Blob([data],{type:'image/svg+xml'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download='geometry-boolean.svg';
  a.click();
  setTimeout(()=>URL.revokeObjectURL(url),700);
}

boolResetControllers();
BS.lastValidPath=boolRawCurrentPath();

function el(tag,attrs={}){
  const e=document.createElementNS(NS,tag);
  for(const [k,v] of Object.entries(attrs)) e.setAttribute(k,v);
  return e;
}
function pointer(ev){
  const screenPoint=stage.createSVGPoint();
  screenPoint.x=ev.clientX;
  screenPoint.y=ev.clientY;

  const ctm=stage.getScreenCTM();
  if(ctm){
    const local=screenPoint.matrixTransform(ctm.inverse());
    return {x:local.x,y:local.y};
  }

  const r=stage.getBoundingClientRect();
  const vb=stage.viewBox.baseVal;
  const scale=Math.min(r.width/vb.width,r.height/vb.height);
  const drawnW=vb.width*scale;
  const drawnH=vb.height*scale;
  const offsetX=r.left+(r.width-drawnW)/2;
  const offsetY=r.top+(r.height-drawnH)/2;

  return {
    x:(ev.clientX-offsetX)/scale+vb.x,
    y:(ev.clientY-offsetY)/scale+vb.y
  };
}
function ratioXY(){
  const k=S.ratio/50;
  return k<0 ? {rw:1-k,rh:1} : {rw:1,rh:1+k};
}
function cellGeom(){
  const {rw,rh}=ratioXY(),cols=S.cols,rows=S.rows,g=S.gap;
  const base=Math.min(
    (B.w-g*(cols-1))/(cols*rw),
    (B.h-g*(rows-1))/(rows*rh)
  );
  const cw=base*rw,ch=base*rh;
  const totalW=cols*cw+(cols-1)*g,totalH=rows*ch+(rows-1)*g;
  return {cw,ch,ox:(B.w-totalW)/2,oy:(B.h-totalH)/2,totalW,totalH};
}
function hexGeom(){
  const cols=S.cols,rows=S.rows,g=S.gap;
  let r=Math.min(
    B.w/(1.5*(cols-1)+2),
    B.h/(Math.sqrt(3)*(rows+.5))
  );
  r=Math.max(4,r-g*.18);
  const dx=1.5*r+g,dy=Math.sqrt(3)*r+g;
  const totalW=2*r+(cols-1)*dx,totalH=Math.sqrt(3)*r+(rows-1)*dy+dy/2;
  return {r,dx,dy,ox:(B.w-totalW)/2+r,oy:(B.h-totalH)/2+Math.sqrt(3)*r/2};
}
function snapshot(){
  return JSON.stringify({
    type:S.type,cols:S.cols,rows:S.rows,gap:S.gap,ratio:S.ratio,meta:S.meta,round:S.round,
    outline:S.outline,gridVisible:S.gridVisible,bridgeEdit:S.bridgeEdit,
    active:[...S.active],blockedBridges:[...S.blockedBridges]
  });
}
