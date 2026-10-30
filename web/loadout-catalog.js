import {ARMAMENT} from './armament-data.js';
export const WEAPONS=ARMAMENT.weapons,PRESETS=ARMAMENT.profiles,PODS=ARMAMENT.pods;
export const presetsFor=t=>PRESETS.filter(p=>p.aircraft===Number(t));
export const weaponFor=p=>WEAPONS[p?.bomb]||null;
export const rfCount=p=>p?[...Array(6)].filter((_,i)=>p.rfMask&(1<<i)).length:0;
export const presetMass=p=>p.ir*(p.aircraft===13?105:p.aircraft===10?106:85)+rfCount(p)*(p.aircraft===13?175:p.aircraft===10?190:p.aircraft===4?450:p.aircraft===1?230:152)+(weaponFor(p)?.mass||0)*p.bombs+(PODS[p.pod]?.mass||0);
export function selectedPreset(type,storage){let id;try{id=JSON.parse(storage?.getItem('raptor.loadouts.v1')||'{}')[type];}catch{}return presetsFor(type).find(p=>p.id===id)||presetsFor(type)[0]||PRESETS[0];}
export function savePreset(p,storage){try{const all=JSON.parse(storage?.getItem('raptor.loadouts.v1')||'{}');all[p.aircraft]=p.id;storage?.setItem('raptor.loadouts.v1',JSON.stringify(all));}catch{}}
export function nativePreset(sim){if(sim?.get_loadout_state)return PRESETS[new Float64Array(sim.memory.buffer,sim.get_loadout_state(),16)[1]];return presetsFor(sim?.get_aircraft_type?.()||0)[0];}
export function bombMount(p,i){const side=i%2?1:-1,t=p.aircraft;if(t===13)return[side*3.10,-.23,.92];if(t===11||t===12)return[side*2.85,-.74,.90];if(t===10)return[side*.32,-1.4,i<2?-1.3:3.25];if(t===8){if(i<8)return[0,-2.25,0];const n=Math.floor((i-8)/2);return[side*(5.5+(n%3)*.65),-2.45,-3.0+Math.floor(n/3)*4.2];}if(t===7){if(p.bombs<=16)return[side*1.56,-1.30,.60];const column=Math.floor(i/2)%8;return[side*(.72+(column%4)*.54),-1.30,column<4?-.88:1.55];}if(t===6){const n=Math.floor(i/2);return[side*2.18,-1.17,p.bomb===4?-1.5+2.5*n:n?3.0:-1.5];}if(t===0){if(p.bomb===5)return[(i<4?-1:1)*.58+side*.17,-1.50,(i%4<2?-1:1)*.94];return[i?.54:-.54,-1.55,.30];}return[side*(t===1?2.1:t===2?1.3:t===4?.75:t===5?3.2:1.7),t===4?-1.10:t===5?-1.08:-.72,1.2];}
export const bombAvailable=(s,i)=>!!(s?.[24+i]??(i<2?s?.[16+i]:0));
const paths={ir:'M29 4 34 16 34 62 41 76 34 73 34 87 24 87 24 73 17 76 24 62 24 16Z',rf:'M29 3 34 17 34 38 44 57 34 53 34 74 40 86 30 82 19 86 24 74 24 53 14 57 24 38 24 17Z',bomb:'M29 6C19 7 16 19 19 37L22 66 16 81 29 77 42 81 36 66 39 37C42 19 39 7 29 6Z',laser:'M29 5 34 15 33 28 40 40 34 39 36 65 43 82 29 77 15 82 22 65 24 39 18 40 25 28 24 15Z',gps:'M29 5C20 7 18 18 20 35L24 65 16 80 29 77 42 80 34 65 38 35C40 18 38 7 29 5Z',sdb:'M29 4 33 18 33 35 51 59 33 48 33 72 40 83 29 79 18 83 25 72 25 48 7 59 25 35 25 18Z',pod:'M29 8C21 8 19 16 20 22L21 71C21 83 37 83 37 71L38 22C39 16 37 8 29 8Z',gun:'M19 16H39V69H19Z M22 5H26V26H22Z M31 5H35V26H31Z'};
export function weaponIcon(kind='bomb'){return `<svg class="ordnance-icon" viewBox="0 0 58 92" aria-hidden="true"><path d="${paths[kind]||paths.bomb}" fill="currentColor"/><path d="M22 26H36M23 30H35" stroke="#d6b16c" stroke-width="2"/></svg>`;}
export const bombIcon=w=>w?.key==='gbu39'?'sdb':w?.guidance===1?'laser':w?.guidance===2?'gps':'bomb';

export const fullBombInventory=sim=>sim?.get_bomb_inventory?new Float64Array(sim.memory.buffer,sim.get_bomb_inventory(),168):undefined;
export function availableWeapons(sim){const p=nativePreset(sim),a=sim?.get_aircraft_type?.()??0;return [...([7,8].includes(a)?[]:['gun']),...(p?.ir?['missile']:[]),...(rfCount(p)?['amraam']:[]),...(p?.bombs?['bomb']:[])];}
