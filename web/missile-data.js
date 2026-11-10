// Public specifications and game calibration. See docs/missile-simulation.md.
const missile = (name, model, guidance, spec, motor, flight, fuze) => {
 const [mass, warhead, maxRange, tailRatio, minRange] = spec;
 const [boostKn, boostTime, sustainKn = 0, sustainTime = 0] = motor;
 const [life, speed, turnG, navigation, drag] = flight;
 const [armTime, radius, fragmentBias] = fuze;
 return Object.freeze({
  name, model, guidance, mass, warhead, maxRange, tailRatio, minRange,
  boostKn, boostTime, sustainKn, sustainTime, life, speed, turnG, navigation, drag,
  armTime, radius, fragmentBias
 });
};

const aim9x = missile('AIM-9X', 'x', 'ir', [84.4, 9.4, 32000, .54, 300],
 [18, 4.0], [40, 1030, 52, 2.6, .000038], [.30, 2.8, .74]);
const aim9j = missile('AIM-9J', 'j', 'ir', [77, 4.5, 18000, .45, 300],
 [17, 2.6], [26, 870, 21, 1.8, .000056], [.33, 2.0, .85]);
const aim9p = missile('AIM-9P', 'p', 'ir', [77, 4.5, 18000, .51, 300],
 [17, 2.9], [29, 900, 22, 1.9, .000052], [.32, 2.0, .85]);
const aim9m = missile('AIM-9M', 'm', 'ir', [85.5, 9.4, 29000, .52, 300],
 [18, 4.0], [38, 970, 32, 2.2, .000047], [.33, 2.7, .74]);
const r74m2 = missile('R-74M2', 'r74', 'ir', [106, 7.4, 35000, .54, 300],
 [23, 4.5], [43, 1050, 52, 2.7, .000041], [.30, 2.6, .83]);
const r73 = missile('R-73', 'r73', 'ir', [105, 7.4, 30000, .47, 300],
 [22, 4.4], [39, 1020, 40, 2.45, .000043], [.31, 2.5, .83]);
// The early MiG-29 loadout uses the RMD-1 range envelope.
const r73Early = Object.freeze({...r73, maxRange:20000, life:31});
const r60m = missile('R-60M', 'r60m', 'ir', [43.5, 3.5, 8000, .67, 250],
 [8.1, 3.7], [21, 800, 29, 2.1, .000069], [.28, 1.8, .87]);
const aim120c = missile('AIM-120C', 'amraam', 'active', [161.5, 18, 105000, .45, 500],
 [33, 3.3, 12, 7.4], [108, 1260, 39, 2.3, .000020], [.42, 3.5, .70]);
const aim7e2 = missile('AIM-7E-2', 'sparrow', 'semi-active', [197, 30.3, 30000, .35, 450],
 [42, 3.2], [39, 1090, 25, 1.85, .000036], [.40, 4.0, .87]);
const aim54c = missile('AIM-54C', 'phoenix', 'active', [463, 60, 150000, .48, 1200],
 [79, 7.0, 25, 10], [150, 1450, 20, 1.65, .000017], [.63, 5.3, .81]);
const r77m = missile('R-77M', 'r77', 'active', [190, 22.5, 135000, .47, 500],
 [40, 4.3, 14, 7.7], [120, 1340, 45, 2.45, .000019], [.42, 3.8, .82]);
const r771 = missile('R-77-1', 'r771', 'active', [190, 22.5, 110000, .42, 300],
 [41, 6.0], [104, 1270, 38, 2.3, .000022], [.39, 3.8, .83]);
const r27r = missile('R-27R', 'r27r', 'semi-active', [253, 39, 60000, .30, 500],
 [52, 5.0], [66, 1320, 27, 2.0, .000026], [.44, 4.5, .88]);
const r24r = missile('R-24R', 'r24r', 'semi-active', [250, 25, 50000, .35, 600],
 [54, 5.0], [45, 1190, 24, 1.9, .000025], [.45, 3.8, .77]);

// Native aircraft ID, then IR and radar stations. F-22's generic AIM-120
// designation in older loadouts uses the same C-family profile as the fleet.
const aircraftMissiles = [
 [aim9x, aim120c], [aim9j, aim7e2], [aim9p], [aim9m, aim120c],
 [aim9m, aim54c], [aim9m, aim120c], [aim9m, aim120c], [], [], [],
 [r74m2, r77m], [aim9x, aim120c], [aim9x, aim120c], [r73, r771],
 [r73Early, r27r], [], [r60m, r24r]
];
export const missileFor = (aircraft, radar = false) => aircraftMissiles[aircraft]?.[Number(radar)];
