/** Sites dispatch strips untrusted identity headers and supplies these visitor claims.
 * This module is deployed behind that boundary; never expose the Worker origin directly.
 */
export const rolePermissions = Object.freeze({free:['basic'],paid:['basic','scan','history'],admin:['basic','scan','history','admin']});
export const roleLabels = Object.freeze({admin:'管理員',paid:'付費會員',free:'免費會員'});
const memberPrefix='rbac/members/';
const rbacJson=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json; charset=utf-8','cache-control':'private, no-store','vary':'oai-authenticated-user-id'}});
const validId=value=>typeof value==='string'&&/^[A-Za-z0-9._~:@-]{1,200}$/.test(value);
const memberKey=id=>memberPrefix+encodeURIComponent(id)+'.json';
const normalizeEmail=value=>typeof value==='string'?value.trim().toLowerCase():'';
const isAdminIdentity=(identity,env)=>Boolean((env.TIDE_ADMIN_USER_ID&&identity.id===String(env.TIDE_ADMIN_USER_ID))||(env.TIDE_ADMIN_EMAIL&&identity.email&&normalizeEmail(identity.email)===normalizeEmail(env.TIDE_ADMIN_EMAIL)));
const safeRole=value=>value==='paid'?'paid':'free';
async function rbacRead(bucket,key){const object=await bucket.get(key);return object?object.json():null;}
async function rbacWrite(bucket,key,value,options={}){return bucket.put(key,JSON.stringify(value),{httpMetadata:{contentType:'application/json'},...options});}
function visitorIdentity(request){const id=request.headers.get('oai-authenticated-user-id');if(!id)return null;if(!validId(id))return null;const email=request.headers.get('oai-authenticated-user-email')||'';return {id,email:email.length<=320?email:''};}
function memberView(record,env){const role=isAdminIdentity(record,env)?'admin':safeRole(record.role);return {id:record.id,email:record.email||'',role,createdAt:record.createdAt,updatedAt:record.updatedAt};}
/** Does not create a member or accept identity/role supplied in JSON, cookies or custom headers. */
export async function getPrincipal(request,env){const identity=visitorIdentity(request);if(!identity)return null;if(!env.BUCKET)throw Error('RBAC_STORAGE_UNAVAILABLE');const record=await rbacRead(env.BUCKET,memberKey(identity.id));if(record&&record.id!==identity.id)throw Error('RBAC_INVALID_MEMBER');const role=isAdminIdentity(identity,env)?'admin':safeRole(record?.role);return {...identity,role,permissions:[...rolePermissions[role]]};}
export async function authorizeRequest(request,env,permission){try{const principal=await getPrincipal(request,env);if(!principal)return {allowed:false,principal:null,response:rbacJson({error:'請先登入會員帳戶。',code:'UNAUTHENTICATED'},401)};if(!principal.permissions.includes(permission))return {allowed:false,principal,response:rbacJson({error:permission==='admin'?'需要管理員權限。':'此功能需要付費會員或管理員權限。',code:'FORBIDDEN',requiredRole:permission==='admin'?'admin':'paid'},403)};return {allowed:true,principal};}catch{return {allowed:false,principal:null,response:rbacJson({error:'會員權限服務暫時無法使用。',code:'AUTHORIZATION_UNAVAILABLE'},503)};}}
export async function handleAccountApi(request,env){
 const path=new URL(request.url).pathname;if(path!=='/api/account'&&path!=='/api/admin/members')return null;
 const access=await authorizeRequest(request,env,path==='/api/account'?'basic':'admin');if(!access.allowed)return access.response;
 const principal=access.principal,bucket=env.BUCKET;
 try{
  if(path==='/api/account'){
   if(request.method!=='GET')return rbacJson({error:'方法不支援'},405);
   const key=memberKey(principal.id);let record=await rbacRead(bucket,key);
   if(!record){const now=new Date().toISOString();const initial={id:principal.id,email:principal.email,role:'free',createdAt:now,updatedAt:now};await rbacWrite(bucket,key,initial,{onlyIf:{etagDoesNotMatch:'*'}});record=await rbacRead(bucket,key);if(!record)throw Error('會員建立失敗');}
   return rbacJson({user:{id:principal.id,email:principal.email,role:principal.role},permissions:principal.permissions,roleLabels,adminConfigured:Boolean(env.TIDE_ADMIN_USER_ID||env.TIDE_ADMIN_EMAIL),paymentEnabled:false,storage:'server-r2',journalStorage:'browser-local',signInPath:'/signin-with-chatgpt?returnTo=%2F',signOutPath:'/signout-with-chatgpt?returnTo=%2F'});
  }
  if(request.method==='GET'){
   const url=new URL(request.url),limitValue=url.searchParams.get('limit')||'25',cursor=url.searchParams.get('cursor');if(!/^\d{1,3}$/.test(limitValue)||Number(limitValue)<1||Number(limitValue)>100||cursor?.length>2000)return rbacJson({error:'分頁參數無效'},400);
   const page=await bucket.list({prefix:memberPrefix,limit:Number(limitValue),...(cursor?{cursor}:{})});
   const records=await Promise.all(page.objects.map(object=>rbacRead(bucket,object.key)));const members=records.filter(record=>record&&validId(record.id)).map(record=>memberView(record,env));
   return rbacJson({members,cursor:page.truncated?page.cursor:null,hasMore:Boolean(page.truncated)});
  }
  if(request.method!=='POST')return rbacJson({error:'方法不支援'},405);
  if(request.headers.get('origin')!==new URL(request.url).origin)return rbacJson({error:'來源驗證失敗'},403);
  if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return rbacJson({error:'請使用 JSON'},415);
  const raw=await request.text();if(raw.length>4096)return rbacJson({error:'請求內容過大'},413);let body;try{body=JSON.parse(raw);}catch{return rbacJson({error:'JSON 格式無效'},400);}
  if(!body||typeof body!=='object'||Array.isArray(body)||Object.keys(body).some(key=>!['userId','role'].includes(key))||!validId(body.userId)||!['free','paid'].includes(body.role))return rbacJson({error:'僅能替已註冊會員設定免費或付費角色。'},400);
  const key=memberKey(body.userId),record=await rbacRead(bucket,key);if(!record||record.id!==body.userId)return rbacJson({error:'找不到已註冊會員'},404);
  if(isAdminIdentity(record,env)||body.userId===principal.id)return rbacJson({error:'管理員身分由伺服器設定，無法由此修改。'},403);
  const previousRole=safeRole(record.role);if(previousRole===body.role)return rbacJson({member:memberView(record,env),changed:false});
  const changeId=crypto.randomUUID(),now=new Date().toISOString();
  // Durable authorization intent precedes the role write. The member's lastChangeId
  // links the applied state to this immutable audit object; R2 is not transactional.
  const audit={id:changeId,actorId:principal.id,targetId:body.userId,previousRole,requestedRole:body.role,authorizedAt:now};
  await rbacWrite(bucket,'rbac/audit/'+changeId+'.json',audit,{onlyIf:{etagDoesNotMatch:'*'}});
  const updated={...record,role:body.role,updatedAt:now,lastChangeId:changeId};await rbacWrite(bucket,key,updated);
  return rbacJson({member:memberView(updated,env),changed:true,changeId});
 }catch{return rbacJson({error:'會員權限資料暫時無法讀寫。',code:'RBAC_STORAGE_ERROR'},503);}
}
