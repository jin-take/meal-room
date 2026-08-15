import type { APIGatewayProxyHandlerV2 } from 'aws-lambda';
import { GetObjectCommand, ListObjectsV2Command, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';

const s3 = new S3Client({});
const bucket = process.env.ROOM_BUCKET!;
const headers = { 'content-type': 'application/json', 'access-control-allow-origin': '*' };
const response = (statusCode:number, body:unknown) => ({ statusCode, headers, body: JSON.stringify(body) });
const now = () => new Date().toISOString();
const code = () => Math.random().toString(36).slice(2,8).toUpperCase();
const key = (roomId:string) => `rooms/${roomId}.json`;
const readBody = async (body: any) => body?.transformToString ? body.transformToString() : '';

async function getRoom(roomId:string) {
  try { const obj=await s3.send(new GetObjectCommand({Bucket:bucket,Key:key(roomId)})); return JSON.parse(await readBody(obj.Body)); }
  catch (e:any) { if(e?.name==='NoSuchKey') return null; throw e; }
}
async function saveRoom(data:any) { await s3.send(new PutObjectCommand({Bucket:bucket,Key:key(data.room.id),Body:JSON.stringify(data),ContentType:'application/json'})); }

export const handler: APIGatewayProxyHandlerV2 = async (event) => {
  try {
    const method=event.requestContext.http.method; const path=event.rawPath; const deviceId=event.headers['x-device-id']||`device_${randomUUID()}`; const body=event.body?JSON.parse(event.body):{};
    if(method==='POST'&&path==='/rooms') {
      if(!body.roomName||!body.memberName) return response(400,{message:'roomName と memberName は必須です'});
      const roomId=`room_${randomUUID()}`, memberId=`member_${randomUUID()}`, createdAt=now();
      const data={schemaVersion:1,version:1,room:{id:roomId,name:body.roomName,inviteCode:code(),hostMemberId:memberId,createdAt},members:[{id:memberId,name:body.memberName,role:'host',deviceId,joinedAt:createdAt}],recipes:[],mealPlans:[],shoppingItems:[]};
      await saveRoom(data); return response(201,{data,memberId});
    }
    if(method==='POST'&&path==='/rooms/join') {
      const target=String(body.inviteCode||'').toUpperCase(); if(!target||!body.memberName)return response(400,{message:'inviteCode と memberName は必須です'});
      const listed=await s3.send(new ListObjectsV2Command({Bucket:bucket,Prefix:'rooms/'}));
      for(const item of listed.Contents||[]) { if(!item.Key)continue; const roomId=item.Key.replace(/^rooms\//,'').replace(/\.json$/,''); const data=await getRoom(roomId); if(data?.room.inviteCode===target){const memberId=`member_${randomUUID()}`;data.members.push({id:memberId,name:body.memberName,role:'member',deviceId,joinedAt:now()});data.version+=1;await saveRoom(data);return response(200,{data,memberId});} }
      return response(404,{message:'招待コードに一致するRoomがありません'});
    }
    const match=path.match(/^\/rooms\/([^/]+)$/);
    if(match&&method==='GET') { const data=await getRoom(match[1]); return data?response(200,{data}):response(404,{message:'Roomが見つかりません'}); }
    if(match&&method==='PUT') { const current=await getRoom(match[1]); if(!current)return response(404,{message:'Roomが見つかりません'}); if(body.version!==current.version)return response(409,{message:'ほかのメンバーが先に更新しました。再読み込みしてください',currentVersion:current.version}); const next={...body,version:current.version+1};await saveRoom(next);return response(200,{data:next}); }
    return response(404,{message:'Not found'});
  } catch (e) { console.error(e); return response(500,{message:'Internal server error'}); }
};
