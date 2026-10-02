$('boolEditModeBtn').onclick=()=>{
  BS.editMode=!BS.editMode;
  BS.selected=null;
  BS.dragId=null;
  BS.interaction=null;
  BS.hover=null;

  $('tip').textContent=BS.editMode
    ? '빈 곳 → 원 추가 · 기존 원 → 삭제'
    : '원 드래그 → 이동 · 테두리 드래그 → 크기 조절';

  renderBoolean();
};

$('boolRadius').oninput=e=>{
  const value=+e.target.value;
  const c=BS.controllers.find(x=>x.id===BS.selected);

  if(c){
    boolTryControllerChange(c,{r:value});
  }else{
    BS.defaultRadius=value;
  }

  $('boolRadiusVal').textContent=value;
  renderBoolean();
};

function bindBoolRadiusEditor(){
  const span=$('boolRadiusVal');
  if(!span)return;

  span.onclick=()=>{
    const current=$('boolRadiusVal');
    if(!current||current.dataset.editing==='1')return;

    const selectedId=BS.selected;
    const selected=BS.controllers.find(x=>x.id===selectedId);
    const originalValue=selected?selected.r:BS.defaultRadius;

    const input=document.createElement('input');
    input.className='inline-value-input';
    input.value=String(Math.round(originalValue));

    current.dataset.editing='1';
    current.replaceWith(input);
    input.focus();
    input.select();

    const finish=(commit)=>{
      if(!input.isConnected)return;

      const raw=input.value.trim();
      const replacement=document.createElement('span');
      replacement.id='boolRadiusVal';
      replacement.className='ctrl-value';
      input.replaceWith(replacement);

      let applied=false;

      if(commit&&raw!==''){
        const value=Number(raw);

        if(Number.isFinite(value)&&value>=30&&value<=180){
          const c=BS.controllers.find(x=>x.id===selectedId);

          if(c)applied=boolTryControllerChange(c,{r:value});
          else{
            BS.defaultRadius=value;
            applied=true;
          }
        }
      }

      if(!applied){
        const c=BS.controllers.find(x=>x.id===selectedId);
        if(c)c.r=originalValue;
        else BS.defaultRadius=originalValue;
      }

      bindBoolRadiusEditor();
      renderBoolean();
    };

    input.addEventListener('keydown',e=>{
      if(e.key==='Enter'){
        e.preventDefault();
        finish(true);
      }else if(e.key==='Escape'){
        e.preventDefault();
        finish(false);
      }
    });

    input.addEventListener('blur',()=>finish(true),{once:true});
  };
}
bindBoolRadiusEditor();

$('boolOutlineBtn').onclick=()=>{
  BS.outline=!BS.outline;
  renderBoolean();
};

$('boolGuideBtn').onclick=()=>{
  BS.showGuides=!BS.showGuides;
  renderBoolean();
};

$('boolResetBtn').onclick=boolReset;
$('boolExportBtn').onclick=boolExportSvg;

document.addEventListener('keydown',ev=>{
  if(S.mode!=='boolean')return;

  if((ev.key==='Backspace'||ev.key==='Delete')&&BS.selected&&!BS.editMode){
    ev.preventDefault();
    boolDeleteSelected();
  }
  if(ev.key==='Escape'){
    BS.selected=null;
    BS.dragId=null;
    BS.interaction=null;
    BS.hover=null;
    renderBoolean();
  }
});

$('coffeeBtn').onclick=()=>{};

document.querySelectorAll('.navbtn').forEach(b=>b.onclick=()=>{
  S.mode=b.dataset.mode;
  document.querySelectorAll('.navbtn').forEach(x=>x.classList.toggle('active',x===b));
  $('gridPanel').classList.toggle('active',S.mode==='grid');
  $('booleanPanel').classList.toggle('active',S.mode==='boolean');

  const gridMode=S.mode==='grid';

  art.style.display=gridMode?'':'none';
  guides.style.display=gridMode?(S.gridVisible?'':'none'):'none';
  previewLayer.style.display=gridMode?'':'none';
  hitLayer.style.display=gridMode?'':'none';

  booleanArt.style.display=gridMode?'none':'';
  booleanGuides.style.display=gridMode?'none':(BS.showGuides?'':'none');
  booleanPreview.style.display=gridMode?'none':'';

  if(gridMode){
    $('tip').style.display='block';
    $('tip').textContent=S.bridgeEdit
      ? '연결부 클릭·드래그 → 잇기 / 끊기'
      : '빈 면 → 채우기 / 검은 면 → 지우기';
    $('caption').textContent=`${S.cols}×${S.rows}`;
    render();
  }else{
    $('tip').style.display='block';
    $('tip').textContent='원 드래그 → 이동 · 테두리 드래그 → 크기 조절 · 원 추가/삭제는 왼쪽 모드에서';
    $('caption').textContent='Boolean';
    renderBoolean();
  }
});
document.querySelectorAll('.gridtype').forEach(b=>b.onclick=()=>{
  checkpoint();
  S.type=b.dataset.type;
  S.active.clear();
  S.blockedBridges.clear();
  document.querySelectorAll('.gridtype').forEach(x=>x.classList.toggle('checked',x===b));
  syncVisibility();
  render();
});

$('size').oninput=e=>{
  const v=+e.target.value;
  S.cols=v;
  S.rows=v;
  $('sizeVal').textContent=`${S.cols}×${S.rows}`;
  S.active.clear();
  S.blockedBridges.clear();
  render();
};
$('size').onchange=checkpoint;

$('gap').oninput=e=>{
  S.gap=+e.target.value;
  $('gapVal').textContent=S.gap;
  if(S.gap<1){
    S.bridgeEdit=false;
    $('bridgeEditBtn').classList.remove('on');
    $('bridgeEditBtn').textContent='OFF';
    $('tip').textContent='빈 면 → 채우기 / 검은 면 → 지우기';
  }
  syncVisibility();
  render();
};
$('gap').onchange=checkpoint;

$('meta').oninput=e=>{
  if(S.gap<1)return;
  S.meta=+e.target.value;
  $('metaVal').textContent=S.meta;
  renderArt();
};
$('meta').onchange=checkpoint;

$('bridgeEditBtn').onclick=()=>{
  if(S.gap<1)return;
  S.bridgeEdit=!S.bridgeEdit;
  $('bridgeEditBtn').classList.toggle('on',S.bridgeEdit);
  $('bridgeEditBtn').textContent=S.bridgeEdit?'ON':'OFF';
  $('tip').textContent=S.bridgeEdit
    ? '연결부 클릭·드래그 → 잇기 / 끊기'
    : '빈 면 → 채우기 / 검은 면 → 지우기';
  renderArt();
};

$('ratio').oninput=e=>{
  S.ratio=+e.target.value;
  const {rw,rh}=ratioXY(),a=rw/rh;
  $('ratioVal').textContent=a>=1?`${a.toFixed(2)}:1`:`1:${(1/a).toFixed(2)}`;
  render();
};
$('ratio').onchange=checkpoint;

$('round').oninput=e=>{
  S.round=+e.target.value;
  $('roundVal').textContent=S.round;
  render();
};
$('round').onchange=checkpoint;

$('outlineBtn').onclick=()=>{
  S.outline=!S.outline;
  $('outlineBtn').classList.toggle('checked',S.outline);
  renderArt();
};
$('gridToggle').onclick=()=>{
  S.gridVisible=!S.gridVisible;
  $('gridToggle').classList.toggle('checked',!S.gridVisible);
  const gridToggleLabel=$('gridToggle').querySelector('span:last-child');
  if(gridToggleLabel)gridToggleLabel.textContent='그리드 끄기';
  renderGuides();
};
$('clearBtn').onclick=()=>{
  if(S.active.size||S.blockedBridges.size){
    checkpoint();
    S.active.clear();
    S.blockedBridges.clear();
    renderArt();
  }
};

document.addEventListener('keydown',ev=>{
  if((ev.metaKey||ev.ctrlKey)&&ev.key.toLowerCase()==='z'){
    ev.preventDefault();
    if(ev.shiftKey){
      if(S.future.length){S.history.push(snapshot());restore(S.future.pop())}
    }else if(S.history.length){
      S.future.push(snapshot());restore(S.history.pop())
    }
  }
});
