import {roundExhaustPlume} from './round-exhaust-plume.js';
import {enableWorldDepthIn} from './world-depth.js';

// Each circular AL-41F1S envelope inherits its own physical TVC nozzle frame.
export function createSu35Plumes(frames){
  return frames.map(frame=>{
    const {root,material}=roundExhaustPlume(.515,4.2);
    root.name='AL-41F1S afterburner plume';frame.add(root);
    enableWorldDepthIn(root);root.visible=false;return {root,material};
  });
}
