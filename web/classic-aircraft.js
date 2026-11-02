import {aircraftDefinition} from './aircraft-catalog.js';
import {createAirframeKit} from './classic-airframe-kit.js?v=fleet-surface-1';
import {buildF4Exterior} from './f4-exterior.js';
import {buildF5Exterior} from './f5-exterior.js';
import {buildF16Exterior} from './f16-exterior.js';
import {buildF14Exterior} from './f14-exterior.js';
import {buildF15Exterior,buildF15EExterior} from './f15-exterior.js';
import {buildB52Exterior} from './b52-exterior.js';
import {buildSu57Exterior} from './su57-exterior.js';
import {buildF18Exterior} from './f18-exterior.js';
import {buildP26Exterior} from './p26-exterior.js';
import {buildB2Exterior} from './b2-exterior.js';

// Original, type-specific exterior assets in metres. Physics, inventories and
// attachment frames match the native aircraft catalogue.
const builders={1:buildF4Exterior,2:buildF5Exterior,3:buildF16Exterior,4:buildF14Exterior,5:buildF15Exterior,6:buildF15EExterior,7:buildB2Exterior,8:buildB52Exterior,9:buildP26Exterior,10:buildSu57Exterior,11:buildF18Exterior,12:buildF18Exterior};
export function createClassicAircraft(type,options={}){
 const base=aircraftDefinition(type),definition=options.livery==='dagger-black'&&base.id===10?{...base,missionLivery:options.livery}:base,build=builders[definition.id];
 if(!build)throw new RangeError(`No classic exterior for aircraft ${type}`);
 const kit=createAirframeKit(definition);
 return kit.finish(build(kit)||{});
}
