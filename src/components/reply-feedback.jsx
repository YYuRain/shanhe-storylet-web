import {gameFetch} from '../game-api.mjs';
import {useEffect,useRef,useState} from 'react';
import {feedbackCategories} from '../shared/feedback.mjs';
export function ReplyFeedback({message,saveKey}){
  const [open,setOpen]=useState(false),[categories,setCategories]=useState([]),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[done,setDone]=useState(false),[error,setError]=useState('');
  const id=useRef(null),button=useRef(null),dialog=useRef(null);
  useEffect(()=>{if(!open)return;const close=e=>{if(e.key==='Escape'&&!busy){setOpen(false);button.current?.focus();}};document.addEventListener('keydown',close);dialog.current?.querySelector('input')?.focus();return()=>document.removeEventListener('keydown',close);},[open,busy]);
  function cancel(){if(!busy){setOpen(false);button.current?.focus();}}
  async function submit(e){
    e.preventDefault();if(busy||!categories.length)return;setBusy(true);setError('');id.current||=crypto.randomUUID();
    try{const response=await gameFetch('/api/game',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'feedback',feedbackId:id.current,saveKey,messageId:message.id,messageHash:message.fingerprint,categories,note})});const result=await response.json();if(!response.ok||!result.feedback?.saved)throw Error(result.error||'反馈暂未提交，请重试。');setDone(true);setOpen(false);button.current?.focus();}
    catch(e){setError(e.message||'连接中断，请重试。');}finally{setBusy(false);}
  }
  return <div className="reply-feedback"><button ref={button} className="feedback-trigger" type="button" disabled={done||!message.fingerprint||!saveKey} aria-label={done?'这条回复已反馈':'反馈这条回复'} onClick={()=>setOpen(true)}>{done?'已反馈，感谢你的建议':'反馈'}</button>
    {open&&<div className="modal-overlay feedback-overlay" onClick={cancel}><section ref={dialog} className="modal feedback-modal" role="dialog" aria-modal="true" aria-label="反馈这条回复" onClick={e=>e.stopPropagation()}><span className="eyebrow">试玩反馈</span><h2>这条回复有什么问题？</h2><p>类别可多选，补充说明可留空。</p><form onSubmit={submit}><fieldset disabled={busy}><legend className="sr-only">选择反馈类别</legend><div className="feedback-categories">{feedbackCategories.map(c=><label key={c.id}><input type="checkbox" checked={categories.includes(c.id)} onChange={e=>setCategories(old=>e.target.checked?[...old,c.id]:old.filter(x=>x!==c.id))}/><span>{c.label}</span></label>)}</div><label className="feedback-note">补充说明（选填）<textarea value={note} onChange={e=>setNote(e.target.value)} maxLength={1000} rows={3} placeholder="例如哪句话不对，或你原本想做什么…"/></label></fieldset><p className="feedback-privacy">提交会附上这条回复、你的上一条输入及可定位的剧情节点，供作者查看。</p>{error&&<div className="error" role="alert">{error}</div>}<div className="feedback-actions"><button className="quiet-button" type="button" onClick={cancel} disabled={busy}>取消</button><button className="solid-button" type="submit" disabled={busy||!categories.length}>{busy?'正在提交…':'提交反馈'}</button></div></form></section></div>}
  </div>;
}
