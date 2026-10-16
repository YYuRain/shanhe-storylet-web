'use client';
import {gameFetch} from '../game-api.mjs';
import {useCallback,useEffect,useRef,useState,Fragment} from 'react';
import {TracePanel} from '../components/trace-panel';
import {EvidenceDialog,EvidenceUpdateNotice,type EvidenceItem,type EvidenceUpdate} from '../components/evidence-dialog';
import {ReplyFeedback} from '../components/reply-feedback';
type Message={id:string;kind:'story'|'you';text:string;ranges:[number,number][];fingerprint?:string;evidenceUpdates?:EvidenceUpdate[]};
type Save={evidence?:EvidenceItem[];saveKey?:string;version:number;turn:number;chapter:string;chapters:{number:number;status:string}[];present:string[];complete:boolean;messages:Message[];canUndo:boolean};
type Result={game?:Save;ready?:boolean;needsInvitation?:boolean;error?:string};
function Arrow(){return <svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="1.5"/></svg>;}
function Mountains(){return <svg className="mountains" viewBox="0 0 1000 700" fill="none" aria-hidden="true"><defs><linearGradient id="ink" x1="500" y1="100" x2="500" y2="700" gradientUnits="userSpaceOnUse"><stop stopColor="#7f8e83" stopOpacity=".4"/><stop offset="1" stopColor="#283d35" stopOpacity=".02"/></linearGradient></defs><circle cx="790" cy="172" r="65" fill="#ae7463" opacity=".16"/><path d="M0 555L72 489L141 512L270 325L343 374L474 177L502 224L531 194L620 346L665 320L786 510L875 440L1000 570V700H0Z" fill="url(#ink)"/><path d="M210 698L382 460L419 496L541 350L589 431L614 395L756 646L850 548L1000 689" fill="#3e574b" opacity=".09"/><path d="M467 195l-8 116-49 88 76-51 47 100M276 339l-22 99 62-60M542 364l-43 130 66-45 34 60" stroke="#344f40" strokeOpacity=".15"/><path d="M30 631C234 602 380 647 552 630S811 592 1020 626M-60 652C144 623 360 668 532 651S791 613 1000 647" stroke="#607769" strokeOpacity=".15"/></svg>;}
function Highlight({text,ranges,offset=0}:{text:string;ranges:[number,number][];offset?:number}){
  const nodes=[];let cursor=0;
  for(const [a,b] of ranges){const start=Math.max(a-offset,0),end=Math.min(b-offset,text.length);if(end<=start||start<cursor)continue;
    nodes.push(<Fragment key={'t'+start}>{text.slice(cursor,start)}</Fragment>);nodes.push(<mark key={'h'+start}>{text.slice(start,end)}</mark>);cursor=end;
  }
  nodes.push(<Fragment key="last">{text.slice(cursor)}</Fragment>);return <>{nodes}</>;
}
function Story({message}:{message:Message}){
  let offset=0;return <>{message.text.split(/\n\n+/).map((part,index)=>{
    const start=message.text.indexOf(part,offset);offset=start+part.length;
    return <p key={index} className={/^[^\n：“”]{1,12}：“/.test(part)?'dialogue':''}><Highlight text={part} ranges={message.ranges} offset={start}/></p>;
  })}</>;
}
export default function Game(){
  const [save,setSave]=useState<Save|null>(null),[playing,setPlaying]=useState(false),[ready,setReady]=useState(true),[loading,setLoading]=useState(true);
  const [input,setInput]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[phase,setPhase]=useState(''),[pending,setPending]=useState('');
  const [invite,setInvite]=useState(''),[needCode,setNeedCode]=useState(true),[confirm,setConfirm]=useState<'undo'|'reset'|null>(null);
  const controller=useRef<AbortController|null>(null),end=useRef<HTMLDivElement|null>(null),textarea=useRef<HTMLTextAreaElement|null>(null);
  const [evidenceOpen,setEvidenceOpen]=useState(false),[evidenceTarget,setEvidenceTarget]=useState('');
  const openEvidence=useCallback((id?:string)=>{setEvidenceTarget(id||'');setEvidenceOpen(true);},[]);
  const closeEvidence=useCallback(()=>setEvidenceOpen(false),[]);
  const [debug,setDebug]=useState(false),[split,setSplit]=useState(58);
  const splitRoot=useRef<HTMLDivElement|null>(null),resize=useRef(false);
  const loadTrace=useCallback(async(args:{traceId?:string;callId?:string})=>{const result=await gameFetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'trace',...args})}).then(r=>r.json() as Promise<{error?:string;trace?:any}>);if(result.error)throw Error(result.error);return result.trace;},[]);
  const retry=useRef<{input:string;id:string;version:number}|null>(null);
  function apply(result:Result){if(result.game){setSave(result.game);setNeedCode(false);}if(typeof result.ready==='boolean')setReady(result.ready);if(result.error)throw new Error(result.error);}
  async function reload(){const result=await gameFetch('/api/game',{cache:'no-store'}).then(r=>r.json() as Promise<Result>);apply(result);}
  useEffect(()=>{
    const params=new URLSearchParams(location.hash.slice(1)),code=params.get('invite');
    if(code){setInvite(code);sessionStorage.setItem('shanhe-invite',code);history.replaceState(null,'',location.pathname+location.search);}
    else setInvite(sessionStorage.getItem('shanhe-invite')||'');
    reload().catch(e=>setError(e.message||'连接暂时中断，请稍后重试。')).finally(()=>setLoading(false));
    return ()=>controller.current?.abort();
  },[]);
  useEffect(()=>{if(ready||busy)return;const timer=setInterval(()=>reload().then(()=>setError('')).catch(e=>setError(e.message)),15000);return()=>clearInterval(timer);},[ready,busy]);
  useEffect(()=>{if(playing&&save&&save.turn>0)end.current?.scrollIntoView({behavior:'smooth',block:'end'});},[save?.version,pending]);
  async function start(){
    setError('');setBusy(true);
    try{const result=await gameFetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'start',invite})}).then(r=>r.json() as Promise<Result>);apply(result);setPlaying(true);}
    catch(e){setError((e as Error).message);setNeedCode(true);}finally{setBusy(false);}
  }
  async function mutation(action:'undo'|'reset'){
    if(!save||busy)return;setBusy(true);setError('');setConfirm(null);
    try{const result=await gameFetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action,version:save.version,requestId:crypto.randomUUID()})}).then(r=>r.json() as Promise<Result>);apply(result);retry.current=null;setInput('');}
    catch(e){setError((e as Error).message);await reload().catch(()=>{});}finally{setBusy(false);}
  }
  async function send(){
    if(!save||busy||!input.trim()||save.complete)return;
    const text=input.trim(),attempt=retry.current?.input===text&&retry.current.version===save.version?retry.current:{input:text,id:crypto.randomUUID(),version:save.version};
    retry.current=attempt;setBusy(true);setError('');setPending(text);setPhase('正在承接你的行动');
    const abort=new AbortController();controller.current=abort;let complete=false;
    try{
      const response=await gameFetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},signal:abort.signal,body:JSON.stringify({action:'turn',input:text,requestId:attempt.id,version:attempt.version})});
      if(!response.headers.get('content-type')?.includes('text/event-stream')){apply(await response.json());if(!response.ok)throw new Error('本轮未保存。');complete=true;}
      else{
        const reader=response.body!.getReader(),decoder=new TextDecoder();let buffer='';
        while(true){const {value,done}=await reader.read();buffer+=done?decoder.decode():decoder.decode(value,{stream:true});
          let boundary;while((boundary=buffer.indexOf('\n\n'))>=0){const block=buffer.slice(0,boundary);buffer=buffer.slice(boundary+2);
            const event=block.split('\n').find(s=>s.startsWith('event:'))?.slice(6).trim();const line=block.split('\n').find(s=>s.startsWith('data:'));
            if(!line)continue;const result=JSON.parse(line.slice(5));
            if(event==='progress')setPhase(result.text);
            if(event==='done'){apply(result);complete=true;}
            if(event==='error')throw new Error(result.error);
          }if(done)break;
        }
        if(!complete)throw new Error('连接中断，请重试。');
      }
      if(complete){retry.current=null;setInput('');}
    }catch(e){
      setError(abort.signal.aborted?'已停止演出。正在确认保存的进度。':(e as Error).message);
      await reload().catch(()=>{});
    }finally{controller.current=null;setBusy(false);setPending('');textarea.current?.focus();}
  }
  if(!playing)return <main className="landing"><div className="landing-top"><span className="brand"><span className="seal">旅探</span>山河旅探</span><span className="edition">六章主线 · 叙事试玩</span></div><Mountains/>
    <section className="landing-copy"><p className="eyebrow">一桩旧案，一段未尽的旅程</p><h1>山河之间，<br/>寻一个<span>真相。</span></h1><p className="intro">你是旅行侦探沈仲平。<br/>从一封来信走入迷局，循着证据追问，<br/>用自己的话，让故事继续。</p>
      {needCode&&<label className="invite-field">试玩密码<input type="password" value={invite} onChange={e=>setInvite(e.target.value)} autoComplete="current-password"/></label>}
      <button className="start-button" onClick={start} disabled={busy||loading||!ready}>{loading?'正在读取存档':busy?'正在翻开故事':!ready?'试玩暂时离线':save&&save.turn>0?'继续旅程':'开始旅程'}<Arrow/></button>
      {save&&save.turn>0&&<p className="resume">已保存至 {save.chapter}</p>}
      <p className="entry-note">无需下载 · 自由对话 · 进度自动保存</p>
      {error&&<div className="error" role="alert">{error}<button className="text-button" disabled={busy||loading} onClick={()=>reload().then(()=>setError('')).catch(e=>setError(e.message))}>重新连接</button></div>}
    </section><div className="opening-quote"><span>卷首</span><p>我曾与死亡签契，<br/>静候他的到来。<br/>今夜，他终于叩响了门扉。</p></div>
    <footer className="landing-footer"><span>《山河旅探》非官方 AI 叙事改编 · 仅供试玩</span><span>自由探索，慢慢推敲。</span></footer></main>;
  return <main className={"play-shell"+(debug?" debug-open":"")} style={{'--play-width':split+'%'} as React.CSSProperties}><header className="play-header"><button className="brand home-button" onClick={()=>setPlaying(false)} aria-label="返回封面"><span className="seal">旅探</span><span>山河旅探<small>六章主线</small></span></button><div className="chapter-label"><span>当前行程</span><strong>{save?.chapter}</strong></div><button className="quiet-button evidence-toggle" onClick={()=>openEvidence()}>线索与证据{save?.evidence?.length?' · '+save.evidence.length:''}</button><button className="quiet-button debug-toggle" aria-pressed={debug} onClick={()=>setDebug(v=>!v)}>{debug?'关闭运行溯源':'运行溯源'}</button><button className="quiet-button restart" onClick={()=>setConfirm('reset')} disabled={busy}>重新开始</button></header>
    <div className="debug-layout" ref={splitRoot}><div className="play-pane"><div className="play-layout"><aside className="journey"><span className="eyebrow">行旅札记</span><div className="chapter-track" aria-label="章节进度">{save?.chapters.map(c=><div key={c.number} className={'chapter-step '+c.status}><span>{['一','二','三','四','五','六'][c.number-1]}</span><small>{c.status==='active'?'正在此处':c.status==='visited'?'已经走过':'尚未抵达'}</small></div>)}</div><div className="present"><span className="eyebrow">此刻在场</span>{save?.present.map(name=><span className="person" key={name}>{name}</span>)}</div><p className="margin-note">字下的浅色标记，<br/>是眼前可留意的细节。</p><div className="save-note"><span className="save-dot"/>进度自动保存</div></aside>
      <section className="reading"><div className="mobile-chapter">{save?.chapter}<span>第 {save?.turn||0} 轮</span></div><div className="transcript" aria-live="polite" aria-busy={busy}>
        {save?.messages.map(m=><article className={'passage '+m.kind} key={(save?.saveKey||'')+m.id+(m.fingerprint||'')}>{m.id==='opening'&&<div className="section-title"><span>序</span><h2>门扉之后</h2></div>}{m.kind==='you'&&<span className="speaker-label">沈仲平</span>}<Story message={m}/>{m.kind==='story'&&<EvidenceUpdateNotice items={m.evidenceUpdates||[]} onOpen={openEvidence}/>}
        {m.kind==='story'&&<ReplyFeedback message={m} saveKey={save?.saveKey}/>}</article>)}
        {pending&&<article className="passage you pending"><span className="speaker-label">沈仲平</span><p>{pending}</p></article>}
        {busy&&pending&&<div className="writing" role="status"><span className="ink-dot"/>{phase}<span className="ellipsis">…</span></div>}
        {save?.complete&&<div className="end-note"><span>行旅至此，暂告一段落。</span><p>六章主线已完成</p></div>}<div ref={end}/>
      </div></section>
    </div><div className="composer-wrap"><div className="composer"><div className="composer-top"><span>{busy&&pending?'片刻，故事正在回应。':save?.complete?'这段旅程已经结束。':'说出你的判断，或描述你想做的事。'}</span><button className="quiet-button" onClick={()=>setConfirm('undo')} disabled={busy||!save?.canUndo}>↶ 回退一轮</button></div>
      {error&&<div className="error" role="alert">{error}<button className="text-button" onClick={()=>reload().then(()=>setError('')).catch(()=>{})}>刷新进度</button></div>}
      <form onSubmit={e=>{e.preventDefault();send();}}><textarea ref={textarea} value={input} maxLength={1500} onChange={e=>setInput(e.target.value)} placeholder="你想说些什么，或做些什么？" aria-label="你的话或行动" rows={2} disabled={busy||save?.complete} onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey&&!e.nativeEvent.isComposing){e.preventDefault();send();}}}/>{busy&&pending?<button type="button" className="send-button stop" onClick={()=>controller.current?.abort()}>停止</button>:<button type="submit" className="send-button" disabled={busy||!input.trim()||save?.complete} aria-label="发送"><Arrow/></button>}</form><div className="composer-bottom"><span>回车发送 · Shift + 回车换行</span><span>故事会依照你的行动展开</span></div></div></div>
    </div>{debug&&<><div className="debug-divider" role="separator" aria-label="调整游玩与调试面板宽度" aria-orientation="vertical" aria-valuemin={30} aria-valuemax={75} aria-valuenow={Math.round(split)} tabIndex={0} onKeyDown={e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();setSplit(v=>Math.max(30,Math.min(75,v+(e.key==='ArrowLeft'?-3:3))));}if(e.key==='Home')setSplit(30);if(e.key==='End')setSplit(75);}} onPointerDown={e=>{resize.current=true;e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!resize.current||!splitRoot.current)return;const r=splitRoot.current.getBoundingClientRect();setSplit(Math.max(30,Math.min(75,(e.clientX-r.left)/r.width*100)));}} onPointerUp={()=>{resize.current=false;}} onPointerCancel={()=>{resize.current=false;}}><span/></div><aside className="debug-pane" aria-label="运行溯源"><TracePanel load={loadTrace}/></aside></>}</div>
    {evidenceOpen&&<EvidenceDialog items={save?.evidence||[]} onClose={closeEvidence} initialId={evidenceTarget}/>}
    {confirm&&<div className="modal-overlay" onClick={()=>setConfirm(null)}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="dialog-title" onClick={e=>e.stopPropagation()}><span className="eyebrow">行旅札记</span><h2 id="dialog-title">{confirm==='reset'?'重新翻开这段旅程？':'回到上一轮？'}</h2><p>{confirm==='reset'?'当前存档会清空，故事将从开场重新开始。':'最近一轮的对话、调查进度和人物记忆会一同回退。'}</p><div><button className="quiet-button" onClick={()=>setConfirm(null)}>继续留在这里</button><button className="solid-button" onClick={()=>mutation(confirm)}>{confirm==='reset'?'重新开始':'回退一轮'}</button></div></section></div>}
  </main>;
}
