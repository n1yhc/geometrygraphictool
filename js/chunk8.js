function exportSvg(){
  const out=el('svg',{xmlns:NS,viewBox:'0 0 1000 1000',width:'1000',height:'1000'});
  const d=defs.cloneNode(true);
  if(d.childNodes.length)out.appendChild(d);
  out.appendChild(art.cloneNode(true));
  const data='<?xml version="1.0" encoding="UTF-8"?>\n'+out.outerHTML;
  const blob=new Blob([data],{type:'image/svg+xml'}),url=URL.createObjectURL(blob),link=document.createElement('a');
  link.href=url;link.download='geometry-grid-v20.svg';link.click();
  setTimeout(()=>URL.revokeObjectURL(url),700);
}
$('exportBtn').onclick=exportSvg;

function syncVisibility(){
  const enabled=S.gap>=1;
  $('metaballWrap').classList.toggle('disabled',!enabled);
  $('meta').disabled=!enabled;
  $('bridgeEditBtn').disabled=!enabled;
  $('metaDisabledHelp').style.display=enabled?'none':'block';

  if(!enabled){
    S.bridgeEdit=false;
    $('bridgeEditBtn').classList.remove('on');
    $('bridgeEditBtn').textContent='OFF';
  }

  $('roundWrap').classList.toggle('hidden',S.type==='circle');
}
function syncUI(){
  $('size').value=Math.round((S.cols+S.rows)/2);
  $('sizeVal').textContent=`${S.cols}×${S.rows}`;
  $('gap').value=clamp(S.gap,0,44);$('gapVal').textContent=S.gap;
  $('meta').value=clamp(S.meta,0,100);$('metaVal').textContent=S.meta;
  $('round').value=clamp(S.round,0,100);$('roundVal').textContent=S.round;
  $('ratio').value=clamp(S.ratio,-50,50);
  const {rw,rh}=ratioXY(),a=rw/rh;
  $('ratioVal').textContent=a>=1?`${a.toFixed(2)}:1`:`1:${(1/a).toFixed(2)}`;
  $('outlineBtn').classList.toggle('checked',S.outline);
  $('bridgeEditBtn').classList.toggle('on',!!S.bridgeEdit);
  $('bridgeEditBtn').textContent=S.bridgeEdit?'ON':'OFF';
  $('tip').textContent=S.bridgeEdit
    ? '연결부 클릭·드래그 → 잇기 / 끊기'
    : '빈 면 → 채우기 / 검은 면 → 지우기';
  $('gridToggle').classList.toggle('checked',!S.gridVisible);
  const gridToggleLabel=$('gridToggle').querySelector('span:last-child');
  if(gridToggleLabel)gridToggleLabel.textContent='그리드 끄기';
  document.querySelectorAll('.gridtype').forEach(b=>b.classList.toggle('checked',b.dataset.type===S.type));
  syncVisibility();
  bindEditableValues();
}
syncUI();
render();
