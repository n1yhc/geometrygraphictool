function restore(raw){
  const x=JSON.parse(raw);
  Object.assign(S,x);
  S.active=new Set(x.active||[]);
  S.blockedBridges=new Set(x.blockedBridges||[]);
  syncUI();render();
}
function checkpoint(){
  S.history.push(snapshot());
  if(S.history.length>60)S.history.shift();
  S.future=[];
}

function clamp(v,min,max){
  return Math.max(min,Math.min(max,v));
}
function startInlineEdit(spanId, initialValue, onCommit){
  const span=$(spanId);
  if(!span || span.dataset.editing==='1')return;
  span.dataset.editing='1';

  const input=document.createElement('input');
  input.className='inline-value-input';
  input.value=initialValue;
  span.replaceWith(input);
  input.focus();
  input.select();

  const finish=(commit=true)=>{
    if(!input.isConnected)return;
    const raw=input.value.trim();
    const replacement=document.createElement('span');
    replacement.id=spanId;
    replacement.className='ctrl-value';
    input.replaceWith(replacement);
    if(commit)onCommit(raw);
    bindEditableValues();
    syncUI();
  };

  input.addEventListener('keydown',e=>{
    if(e.key==='Enter'){e.preventDefault();finish(true)}
    if(e.key==='Escape'){e.preventDefault();finish(false)}
  });
  input.addEventListener('blur',()=>finish(true),{once:true});
}
function parseRatioText(raw){
  const s=raw.replace(/\s/g,'');
  if(s.includes(':')){
    const [a,b]=s.split(':').map(Number);
    if(a>0&&b>0){
      const q=a/b;
      if(q>=1)return clamp(-(q-1)*50,-50,50);
      return clamp((1/q-1)*50,-50,50);
    }
  }
  const num=Number(s);
  if(Number.isFinite(num))return clamp(num,-50,50);
  return S.ratio;
}
function bindEditableValues(){
  const size=$('sizeVal');
  if(size)size.onclick=()=>startInlineEdit('sizeVal',`${S.cols}×${S.rows}`,raw=>{
    const m=raw.match(/^\s*(\d+)\s*[xX×,*]\s*(\d+)\s*$/);
    if(m){
      checkpoint();
      S.cols=clamp(parseInt(m[1],10),1,40);
      S.rows=clamp(parseInt(m[2],10),1,40);
      S.active.clear();
      S.blockedBridges.clear();
      render();
    }else{
      const v=parseInt(raw,10);
      if(Number.isFinite(v)){
        checkpoint();
        S.cols=S.rows=clamp(v,1,40);
        S.active.clear();
        S.blockedBridges.clear();
        render();
      }
    }
  });

  const gap=$('gapVal');
  if(gap)gap.onclick=()=>startInlineEdit('gapVal',String(S.gap),raw=>{
    const v=Number(raw);
    if(Number.isFinite(v)){
      checkpoint();
      S.gap=clamp(v,0,120);
      if(S.gap<1){
        S.bridgeEdit=false;
      }
      syncVisibility();
      render();
    }
  });

  const meta=$('metaVal');
  if(meta)meta.onclick=()=>{
    if(S.gap<1)return;
    startInlineEdit('metaVal',String(S.meta),raw=>{
    const v=Number(raw);
    if(Number.isFinite(v)){
      checkpoint();
      S.meta=clamp(v,0,100);
      renderArt();
    }
    });
  };

  const ratio=$('ratioVal');
  if(ratio)ratio.onclick=()=>startInlineEdit('ratioVal',$('ratioVal').textContent,raw=>{
    checkpoint();
    S.ratio=parseRatioText(raw);
    render();
  });

  const round=$('roundVal');
  if(round)round.onclick=()=>startInlineEdit('roundVal',String(S.round),raw=>{
    const v=Number(raw);
    if(Number.isFinite(v)){
      checkpoint();
      S.round=clamp(v,0,100);
      render();
    }
  });
}

function roundedRectPath(x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  if(r===0)return `M ${x} ${y} H ${x+w} V ${y+h} H ${x} Z`;
  return `M ${x+r} ${y}
          H ${x+w-r}
          Q ${x+w} ${y} ${x+w} ${y+r}
          V ${y+h-r}
          Q ${x+w} ${y+h} ${x+w-r} ${y+h}
          H ${x+r}
          Q ${x} ${y+h} ${x} ${y+h-r}
          V ${y+r}
          Q ${x} ${y} ${x+r} ${y} Z`;
}
function hybridCornerPath(x,y,w,h,q,r){
  const cx=x+w/2,cy=y+h/2,rx=w/2,ry=h/2;
  const k=0.5522847498307936;
  r=Math.max(0,Math.min(r,w/2,h/2));

  if(q==='tl'){
    return `M ${cx} ${y}
            H ${x+r}
            Q ${x} ${y} ${x} ${y+r}
            V ${cy}
            C ${x} ${cy-k*ry} ${cx-k*rx} ${y} ${cx} ${y} Z`;
  }
  if(q==='tr'){
    return `M ${cx} ${y}
            H ${x+w-r}
            Q ${x+w} ${y} ${x+w} ${y+r}
            V ${cy}
            C ${x+w} ${cy-k*ry} ${cx+k*rx} ${y} ${cx} ${y} Z`;
  }
  if(q==='br'){
    return `M ${x+w} ${cy}
            V ${y+h-r}
            Q ${x+w} ${y+h} ${x+w-r} ${y+h}
            H ${cx}
            C ${cx+k*rx} ${y+h} ${x+w} ${cy+k*ry} ${x+w} ${cy} Z`;
  }
  return `M ${x} ${cy}
          V ${y+h-r}
          Q ${x} ${y+h} ${x+r} ${y+h}
          H ${cx}
          C ${cx-k*rx} ${y+h} ${x} ${cy+k*ry} ${x} ${cy} Z`;
}
function regularHex(cx,cy,r){
  const pts=[];
  for(let i=0;i<6;i++){
    const a=Math.PI/3*i;
    pts.push([cx+r*Math.cos(a),cy+r*Math.sin(a)]);
  }
  return pts;
}
function roundedPolygonPath(pts,rad){
  const n=pts.length;
  if(rad<=0){
    let d=`M ${pts[0][0]} ${pts[0][1]}`;
    for(let i=1;i<n;i++)d+=` L ${pts[i][0]} ${pts[i][1]}`;
    return d+' Z';
  }
  const out=[];
  for(let i=0;i<n;i++){
    const prev=pts[(i-1+n)%n],cur=pts[i],next=pts[(i+1)%n];
    const v1=[prev[0]-cur[0],prev[1]-cur[1]];
    const v2=[next[0]-cur[0],next[1]-cur[1]];
    const l1=Math.hypot(v1[0],v1[1]),l2=Math.hypot(v2[0],v2[1]);
    const d=Math.min(rad,l1*.42,l2*.42);
    out.push({
      cur,
      p1:[cur[0]+v1[0]/l1*d,cur[1]+v1[1]/l1*d],
      p2:[cur[0]+v2[0]/l2*d,cur[1]+v2[1]/l2*d]
    });
  }
  let d=`M ${out[0].p2[0]} ${out[0].p2[1]}`;
  for(let k=1;k<=n;k++){
    const v=out[k%n];
    d+=` L ${v.p1[0]} ${v.p1[1]} Q ${v.cur[0]} ${v.cur[1]} ${v.p2[0]} ${v.p2[1]}`;
  }
  return d+' Z';
}

function regions(){
  const out=[];
  if(S.type==='hex'){
    const h=hexGeom();
    const rr=h.r*(S.round/100)*0.58;
    for(let c=0;c<S.cols;c++)for(let r=0;r<S.rows;r++){
      const cx=h.ox+c*h.dx,cy=h.oy+r*h.dy+(c%2)*h.dy/2;
      const pts=regularHex(cx,cy,h.r);
      out.push({
        id:`h:${c}:${r}`,kind:'path',d:roundedPolygonPath(pts,rr),
        cx,cy,bounds:{x:cx-h.r,y:cy-Math.sqrt(3)*h.r/2,w:2*h.r,h:Math.sqrt(3)*h.r},
        shape:'hex'
      });
    }
    return out;
  }

  const g=cellGeom();
  const rr=Math.min(g.cw,g.ch)*.46*(S.round/100);
  for(let r=0;r<S.rows;r++)for(let c=0;c<S.cols;c++){
    const x=g.ox+c*(g.cw+S.gap),y=g.oy+r*(g.ch+S.gap),w=g.cw,h=g.ch,cx=x+w/2,cy=y+h/2;
    if(S.type==='square'){
      out.push({id:`s:${c}:${r}`,kind:'path',d:roundedRectPath(x,y,w,h,rr),cx,cy,bounds:{x,y,w,h},shape:'rect'});
    }else if(S.type==='circle'){
      out.push({id:`c:${c}:${r}`,kind:'ellipse',cx,cy,rx:w/2,ry:h/2,bounds:{x,y,w,h},shape:'ellipse'});
    }else{
      out.push({id:`o:${c}:${r}`,kind:'ellipse',cx,cy,rx:w/2,ry:h/2,bounds:{x,y,w,h},shape:'ellipse'});
      const cornerCenters={tl:[x+w*.16,y+h*.16],tr:[x+w*.84,y+h*.16],br:[x+w*.84,y+h*.84],bl:[x+w*.16,y+h*.84]};
      for(const q of ['tl','tr','br','bl']){
        const cc=cornerCenters[q];
        out.push({
          id:`${q}:${c}:${r}`,kind:'path',d:hybridCornerPath(x,y,w,h,q,rr),
          cx:cc[0],cy:cc[1],bounds:{x,y,w,h},shape:'corner',corner:q,cell:{x,y,w,h}
        });
      }
    }
  }
  return out;
}
