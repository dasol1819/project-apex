// Read-only queue reconciliation for humans and scheduled aircraft work.
import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../web/aircraft-tree-data.js',import.meta.url),'utf8').replace(/export /g,'');
const roster=JSON.parse(vm.runInNewContext(source+'\nJSON.stringify(AIRCRAFT_TREE)',{}, {timeout:1000}));
const queue=JSON.parse(fs.readFileSync(new URL('../docs/aircraft-progress.json',import.meta.url),'utf8'));
assert.equal(new Set(queue.aircraft.map(a=>a.id)).size,queue.aircraft.length,'unique queue IDs');
assert.deepEqual(queue.aircraft.map(a=>a.id).sort(),roster.map(a=>a.id).sort(),'complete roster');
for(const a of queue.aircraft){
  assert.ok(['planned','implemented','in_progress','reviewed','blocked'].includes(a.status),a.id+' status');
  const actual=roster.find(b=>b.id===a.id);
  if(a.status==='reviewed'){
    assert.ok(actual.implemented&&Number.isInteger(actual.simId),a.id+' must actually fly');
    for(const k of ['references','assets','screenshots','checks'])assert.ok(a.evidence[k]?.length,a.id+' missing '+k);
    assert.ok(a.evidence.commit,a.id+' missing commit');
  }
}
const counts=Object.fromEntries(['planned','implemented','in_progress','reviewed','blocked'].map(s=>[s,queue.aircraft.filter(a=>a.status===s).length]));
const current=queue.aircraft.find(a=>a.status==='in_progress')||queue.aircraft.find(a=>a.status==='blocked')||queue.aircraft.find(a=>a.status==='planned');
console.log(JSON.stringify({target:queue.targetDate,total:roster.length,actuallyImplemented:roster.filter(a=>a.implemented).length,counts,next:current?{id:current.id,name:current.name,step:current.nextStep}:null,lease:queue.lease},null,2));
