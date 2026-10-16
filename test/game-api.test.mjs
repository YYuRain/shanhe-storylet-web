import test from 'node:test';
import assert from 'node:assert/strict';
import {createGameClient} from '../src/game-api.mjs';
const endpoint='https://entry.example/api/github/game';
const memory=()=>{const values=new Map();return {getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v)};};
test('login identity persists across page refresh and is sent only to the fixed API',async()=>{
 const storage=memory(),token='a'.repeat(72);let calls=0;
 const fetcher=async(url,options)=>{
  calls++;assert.equal(url,endpoint);assert.equal(options.credentials,'omit');assert.equal(options.mode,'cors');assert.equal(options.redirect,'error');
  assert.equal(options.headers.get('authorization'),calls===1?null:'Bearer '+token);
  return Response.json({game:{turn:0}},{headers:calls===1?{'X-Shanhe-Visitor':token}:{}});
 };
 await createGameClient({endpoint,storage,fetcher})('/api/game',{method:'POST',body:'{"action":"start"}'});
 await createGameClient({endpoint,storage,fetcher})('/api/game');
 assert.equal(calls,2);
});
test('different browser stores do not share identities, and malformed tokens are not sent',async()=>{
 const a=memory(),b=memory();a.setItem('shanhe-visitor:'+endpoint,'b'.repeat(72));b.setItem('shanhe-visitor:'+endpoint,'invalid');
 for(const [storage,expected] of [[a,'Bearer '+'b'.repeat(72)],[b,null]])await createGameClient({endpoint,storage,fetcher:async(_,o)=>{assert.equal(o.headers.get('authorization'),expected);return Response.json({});}})('/api/game');
});
test('streamed progress, abort signal and error responses pass through unchanged',async()=>{
 const storage=memory(),signal=new AbortController().signal;
 const stream=new Response('event: done\ndata: {"game":{}}\n\n',{headers:{'Content-Type':'text/event-stream'}});
 const request=createGameClient({endpoint,storage,fetcher:async(_,o)=>{assert.equal(o.signal,signal);return stream;}});
 assert.equal(await request('/api/game',{signal}),stream);
 assert.match(await stream.text(),/^event: done/);
 const denied=Response.json({error:'请先输入试玩密码。'},{status:401,headers:{'X-Shanhe-Visitor':'c'.repeat(72)}});
 assert.equal(await createGameClient({endpoint,storage,fetcher:async()=>denied})('/api/game'),denied);
 assert.equal(storage.getItem('shanhe-visitor:'+endpoint),null);
});
test('unrelated interfaces are refused and unavailable storage has a clear error',async()=>{
 let called=false;const request=createGameClient({endpoint,storage:memory(),fetcher:()=>{called=true;}});
 await assert.rejects(()=>request('/api/admin'),/不支持/);assert.equal(called,false);
 await assert.rejects(()=>createGameClient({endpoint,storage:{getItem(){throw Error();}}})('/api/game'),/本地存储/);
});
