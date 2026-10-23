(function(root){
  'use strict';
  const MAX_ENCODED=18000,MAX_RAW=320000;
  const assert=(v,m)=>{if(!v)throw new Error(m||'链接内容无效，请让对方重新生成。')};
  const str=(v,max,empty=true)=>typeof v==='string'&&v.length<=max&&(empty||v.trim().length>0);
  const id=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(v);
  const date=v=>str(v,35,false)&&Number.isFinite(Date.parse(v));
  function valid(p){
    assert(p&&p.v===1&&id(p.id)&&date(p.created));
    if(p.kind==='menu'){
      assert(str(p.name,60,false)&&Array.isArray(p.dishes)&&p.dishes.length>0&&p.dishes.length<=100);
      const ids=new Set();
      for(const d of p.dishes){
        assert(d&&id(d.id)&&!ids.has(d.id)&&str(d.name,40,false)&&str(d.category,20,false)&&Number.isInteger(d.cents)&&d.cents>=0&&d.cents<=9999900&&Number.isInteger(d.time)&&d.time>=1&&d.time<=1440&&str(d.description,200)&&str(d.tag,12));ids.add(d.id);
        assert(Array.isArray(d.ingredients)&&d.ingredients.length<=80&&d.ingredients.every(a=>Array.isArray(a)&&a.length===2&&a.every(t=>str(t,50,false))));
        assert(Array.isArray(d.steps)&&d.steps.length<=80&&d.steps.every(s=>str(s,2000,false)));
        assert(!d.image||/^assets\/[a-zA-Z0-9/_-]+\.(svg|jpg|png|webp)$/.test(d.image));
      }
    }else if(p.kind==='order'){
      assert((!p.menuId||id(p.menuId))&&str(p.customer,30,false)&&str(p.remark,300)&&Array.isArray(p.items)&&p.items.length>0&&p.items.length<=100);
      let total=0;
      for(const i of p.items){assert(Array.isArray(i)&&i.length===3&&str(i[0],40,false)&&Number.isInteger(i[1])&&i[1]>=0&&i[1]<=9999900&&Number.isInteger(i[2])&&i[2]>=1&&i[2]<=99);total+=i[1]*i[2]}
      assert(Number.isSafeInteger(total)&&total<=999999900);
    }else throw new Error('这不是本厨房的菜单或订单链接。');
    return p;
  }
  function base64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'')}
  function unbase64(s){assert(/^[A-Za-z0-9_-]+$/.test(s)&&s.length<=MAX_ENCODED);const t=atob(s.replace(/-/g,'+').replace(/_/g,'/'));return Uint8Array.from(t,c=>c.charCodeAt(0))}
  async function readLimited(stream){const reader=stream.getReader(),chunks=[];let length=0;try{while(true){const {done,value}=await reader.read();if(done)break;length+=value.byteLength;assert(length<=MAX_RAW,'菜单内容过大，请分成几份菜单分享。');chunks.push(value)}}catch(e){await reader.cancel().catch(()=>{});throw e}const out=new Uint8Array(length);let offset=0;for(const c of chunks){out.set(c,offset);offset+=c.byteLength}return out}
  async function encode(p){valid(p);const bytes=new TextEncoder().encode(JSON.stringify(p));assert(bytes.length<=MAX_RAW,'菜单内容过大，请分批分享。');let data=bytes,prefix='j1.';if(typeof CompressionStream!=='undefined'){const compressed=await readLimited(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')));if(compressed.length<bytes.length){data=compressed;prefix='g1.'}}const out=prefix+base64(data);assert(out.length<=MAX_ENCODED,'这份菜单太长，建议减少菜品或精简做法，再生成链接。');return out}
  async function decode(s){assert(typeof s==='string'&&s.length<=MAX_ENCODED+3&&/^[gj]1\./.test(s),'链接不完整或版本不支持，请复制整条链接。');let bytes=unbase64(s.slice(3));if(s.startsWith('g1.')){assert(typeof DecompressionStream!=='undefined','当前浏览器版本较旧，请用新版浏览器打开。');bytes=await readLimited(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')))}assert(bytes.length<=MAX_RAW);let p;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes))}catch{throw new Error('链接不完整或已损坏，请对方重新复制整条链接。')}return valid(p)}
  function menu(dishes,name='向豪和赵雅珊的厨房'){
    return valid({v:1,kind:'menu',id:crypto.randomUUID(),created:new Date().toISOString(),name,dishes:dishes.map(d=>({id:d.id,name:d.name,category:d.category,cents:Math.round(d.price*100),time:Number(d.time),description:d.description||'',tag:d.tag||'',ingredients:d.ingredients,steps:d.steps,image:/^assets\/[a-zA-Z0-9/_-]+\.(svg|jpg|png|webp)$/.test(d.image||'')?d.image:''}))});
  }
  function order(items,customer,remark,menuId){return valid({v:1,kind:'order',id:crypto.randomUUID(),created:new Date().toISOString(),customer:customer.trim(),remark:remark||'',menuId:menuId||'',items:items.map(i=>[i.name,Math.round(i.price*100),i.qty])})}
  function record(p){valid(p);assert(p.kind==='order');return {id:p.id,number:'HD'+p.id.replace(/-/g,'').slice(0,8).toUpperCase(),date:p.created,customer:p.customer,items:p.items.map(([name,cents,qty])=>({name,price:cents/100,qty})),total:p.items.reduce((n,i)=>n+i[1]*i[2],0)/100,remark:p.remark,status:'待制作',sharePayload:p}}
  const api={encode,decode,valid,menu,order,record,MAX_ENCODED};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.KitchenLinks=api;
})(typeof window!=='undefined'?window:globalThis);
