import test from 'node:test';
import assert from 'node:assert/strict';
import { computeExpiresAt, isExpired } from '../src/utils/retention.js';
import { purgeExpiredGames } from '../scripts/purge-expired-games.mjs';

test('two calendar months clamp month ends and preserve UTC time',()=>{
  assert.equal(computeExpiresAt('2026-12-31T09:15:00Z'),'2027-02-28T09:15:00.000Z');
  assert.equal(computeExpiresAt('2023-12-31T09:15:00Z'),'2024-02-29T09:15:00.000Z');
  assert.equal(computeExpiresAt('2026-10-03T10:00:00Z'),'2026-12-03T10:00:00.000Z');
  assert.equal(isExpired('2000-01-01T00:00:00Z'),true);
});
function fake({storageError=false,dbError=false,count=1001,path='workshop/test-id'}={}){
  const operations=[];
  const game={id:'test-id',storage_path:path,expires_at:'2000-01-01T00:00:00Z'};
  const bucket={
    async list(prefix,{offset=0,limit}){operations.push(['list',offset]);return {data:Array.from({length:Math.min(limit,Math.max(count-offset,0))},(_,i)=>({id:`f${offset+i}`,name:`f${offset+i}.txt`}))};},
    async remove(files){operations.push(['remove',files.length]);return {error:storageError?new Error('Storage unavailable'):null};},
  };
  return {operations,client:{storage:{from:()=>bucket},from:()=>({
    select(){return {like(column,value){assert.equal(value,'workshop/%');return this;},lte(){return this;},order(){return this;},async range(){return {data:[game]};}};},
    delete(){operations.push(['delete']);return {eq(){return this;},async lte(){return {error:dbError?new Error('Database unavailable'):null};}};},
  })}};
}
test('cleanup paginates files, batches deletes, then deletes record',async()=>{
 const {client,operations}=fake();await purgeExpiredGames(client,{log:()=>{}});
 assert.deepEqual(operations.filter(x=>x[0]==='list'),[['list',0],['list',1000]]);
 assert.equal(operations.filter(x=>x[0]==='remove').reduce((n,x)=>n+x[1],0),1001);
 assert.equal(operations.at(-1)[0],'delete');
});
test('storage failure retains record for retry and fails job',async()=>{
 const {client,operations}=fake({storageError:true});await assert.rejects(purgeExpiredGames(client,{log:()=>{}}));
 assert.equal(operations.some(x=>x[0]==='delete'),false);
});
test('database failure is reported to scheduler',async()=>{
 const {client}=fake({dbError:true,count:0});await assert.rejects(purgeExpiredGames(client,{log:()=>{}}));
});
test('dry run never deletes',async()=>{
 const {client,operations}=fake();await purgeExpiredGames(client,{dryRun:true,log:()=>{}});
 assert.equal(operations.some(x=>['delete','remove'].includes(x[0])),false);
});
test('unexpected folder path is refused',async()=>{
 const {client,operations}=fake({path:'workshop/../shared'});await assert.rejects(purgeExpiredGames(client,{log:()=>{}}));assert.equal(operations.length,0);
});
