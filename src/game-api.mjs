import {GAME_ENDPOINT} from './config.mjs';
const validToken=token=>/^[a-f0-9-]{72}$/.test(token||'');
export function createGameClient({endpoint=GAME_ENDPOINT,storage,fetcher=fetch}){
 const key='shanhe-visitor:'+endpoint;
 return async function gameFetch(path,options={}){
  if(path!=='/api/game')throw Error('不支持此接口。');
  let token;try{token=storage.getItem(key);}catch{throw Error('无法读取试玩身份，请允许此网站使用本地存储后重试。');}
  const headers=new Headers(options.headers);headers.delete('authorization');
  if(validToken(token))headers.set('Authorization','Bearer '+token);
  const result=await fetcher(endpoint,{...options,headers,credentials:'omit',mode:'cors',redirect:'error'});
  const issued=result.headers.get('X-Shanhe-Visitor');
  if(result.ok&&validToken(issued)){
   try{storage.setItem(key,issued);}catch{throw Error('无法保存试玩身份，请允许此网站使用本地存储后重试。');}
  }
  return result;
 };
}
let client;
export function gameFetch(path,options){
 client||=createGameClient({storage:localStorage});
 return client(path,options);
}
