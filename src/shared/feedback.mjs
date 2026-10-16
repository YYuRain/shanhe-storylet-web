export const feedbackCategories=[
  {id:'repetitive',label:'重复或太啰嗦'},
  {id:'unclear',label:'表达不清'},
  {id:'immersion',label:'出戏'},
  {id:'intent',label:'理解错玩家意图'},
  {id:'filler',label:'无意义描述'},
  {id:'template',label:'模版化描述'},
  {id:'hallucination',label:'模型幻觉'},
  {id:'perspective',label:'人称错误'},
  {id:'ai-tone',label:'AI味儿冲'},
  {id:'other',label:'其他问题或建议'}
];
const ids=new Set(feedbackCategories.map(c=>c.id));
export function validFeedback(body){
  return typeof body?.messageId==='string'&&body.messageId.length>0&&body.messageId.length<=200&&
    /^[a-f0-9]{64}$/.test(body.messageHash||'')&&/^[a-f0-9]{64}$/.test(body.saveKey||'')&&/^[-a-f0-9]{36}$/.test(body.feedbackId||'')&&
    Array.isArray(body.categories)&&body.categories.length>=1&&body.categories.length<=10&&new Set(body.categories).size===body.categories.length&&body.categories.every(id=>ids.has(id))&&
    (body.note===undefined||(typeof body.note==='string'&&body.note.length<=1000));
}
