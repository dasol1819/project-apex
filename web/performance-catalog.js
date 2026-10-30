import {simAircraft} from './aircraft-catalog.js';

export const AIRCRAFT_ROLES=Object.freeze([
 ['스텔스 제공 전투기','STEALTH AIR SUPERIORITY'],['전투기 · 전폭기','FIGHTER / STRIKE'],['경량 전투기','LIGHT FIGHTER'],['다목적 전투기','MULTIROLE FIGHTER'],['함상 요격 전투기','FLEET DEFENCE FIGHTER'],['제공 전투기','AIR SUPERIORITY FIGHTER'],['장거리 전폭기','DUAL-ROLE STRIKE FIGHTER'],['스텔스 전략폭격기','STEALTH STRATEGIC BOMBER'],['장거리 전략폭격기','LONG-RANGE HEAVY BOMBER'],['초기 경전투기','LIGHT PROPELLER FIGHTER'],['스텔스 다목적 중전투기','STEALTH MULTIROLE HEAVY FIGHTER'],['함재 다목적 전투기 · 단좌','CARRIER MULTIROLE · SINGLE SEAT'],['함재 다목적 전투기 · 복좌','CARRIER MULTIROLE · TWO SEATS'],['다목적 제공 전투기','MULTIROLE AIR SUPERIORITY']
]);
// Published references describe particular configurations, not guaranteed game
// performance. Keep qualifiers and units rather than inventing exact figures.
export const PUBLIC_CATALOG=Object.freeze([
 {speed:'Mach 2급',ceiling:'50,000 ft 초과',range:'1,850 mi 초과 · 증조탱크 페리',source:'https://www.af.mil/about-us/fact-sheets/display/article/104506/f-22-raptor/'},
 {speed:'1,245 kt · 출처의 증조탱크 페리 구성 작전속도',ceiling:'58,750 ft · 최대 출력 / 상승률 100 ft/min',range:'탑재·비행 프로파일에 따라 상이',source:'https://www.163atkw.ang.af.mil/About-Us/Fact-Sheets/Display/Article/452913/mcdonnell-douglas-f-4e-phantom-ii/'},
 {speed:'1,050 mph · 최대',ceiling:'50,700 ft',range:'2,300 mi · 외부 연료탱크',source:'https://www.aerospaceutah.org/museum/our-collections/aircraft-collection/f-5e-tiger-ii/'},
 {speed:'Mach 2 · 고고도',ceiling:'50,000 ft 초과',range:'2,002 mi 초과 · 페리',source:'https://www.af.mil/about-us/fact-sheets/display/article/104505/f-16-fighting-falcon/'},
 {speed:'1,544 mph · 40,000 ft',ceiling:'55,000 ft',range:'확인한 D형 자료에 별도 수치 없음',source:'https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft/f/f-14d-tomcat.html'},
 {speed:'1,875 mph · 고고도',ceiling:'65,000 ft',range:'3,000 nmi · CFT + 외부탱크 3개 페리',source:'https://www.af.mil/about-us/fact-sheets/display/article/104501/f-15-eagle/'},
 {speed:'Mach 2.5 초과',ceiling:'60,000 ft',range:'2,400 mi · CFT + 외부탱크 3개 페리',source:'https://www.af.mil/about-us/fact-sheets/display/article/104499/f-15e-strike-eagle/'},
 {speed:'고아음속 · 제조사 공개 표현',ceiling:'50,000 ft',range:'6,000 nmi · 무급유',source:'https://www.northropgrumman.com/what-we-do/aircraft/b-2-stealth-bomber/technical-details'},
 {speed:'650 mph · USAF 공개값',ceiling:'50,000 ft',range:'7,647 nmi · 무급유',source:'https://www.boeing.com/defense/fighters-and-bombers/b-52'},
 {speed:'234 mph · 최대',ceiling:'27,400 ft',range:'360 mi · 공개 제원',source:'https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/198089/boeing-p-26a/'},
 {speed:'Mach 2.0 · Su-57E 공개 참고',ceiling:'18,800 m · Su-57E 공개 참고',range:'전투행동반경 1,250 km · Su-57E 공개 참고',source:'https://roe.ru/en/production/multipurpose-fighters-and-fighter-bombers/su-57e/'},
 {speed:'Mach 1.8+ · 해군 공개값',ceiling:'50,000 ft 초과',range:'1,660 nmi · AIM-9 2발 + 480 gal 외부탱크 3개 페리 참고',source:'https://www.navair.navy.mil/product/FA-18EF-Super-Hornet'},
 {speed:'Mach 1.8+ · 해군 공개값',ceiling:'50,000 ft 초과',range:'1,660 nmi · AIM-9 2발 + 480 gal 외부탱크 3개 페리 참고',source:'https://www.navair.navy.mil/product/FA-18EF-Super-Hornet'},
 {speed:'Mach 2.25 · 고고도 공개 참고',ceiling:'18,000 m · 공개 참고',range:'3,600 km · 고고도 내부 연료 참고',source:'https://roe.ru/en/production/multipurpose-fighters-and-fighter-bombers/su-35/'}
]);
const number=(v,d=1)=>v.toLocaleString('en-US',{maximumFractionDigits:d});
export function readPerformance(sim,{altitude=3000,speed=200,fuel=.5}={}){
 return Array.from(new Float64Array(sim.memory.buffer,sim.get_aircraft_performance(altitude,speed,fuel),32));
}
export function createPerformanceCatalog({document:d,getSim}){
 const $=id=>d.getElementById(id);
 const conditions={altitude:3000,speed:200,fuel:.5};
 function rows(id,entries){const dl=$(id);dl.replaceChildren();for(const [label,value]of entries){const row=d.createElement('div'),dt=d.createElement('dt'),dd=d.createElement('dd');dt.textContent=label;dd.textContent=value;row.append(dt,dd);dl.append(row);}}
 const rate=(p,index)=>p[index]>0?number(p[index],2)+' °/s':'수평 선회 불가';
 function refresh(){
  const sim=getSim();if(!sim?.get_aircraft_performance)return;
  const af=simAircraft(sim),p=readPerformance(sim,af.propeller?{...conditions,speed:Math.min(conditions.speed,100)}:conditions),radar=Array.from(new Float64Array(sim.memory.buffer,sim.get_radar_profile(),12)),role=AIRCRAFT_ROLES[af.id];
  $('hangar-aircraft-role').textContent=role[0];d.querySelector('.hangar-spec-identity .section-kicker').textContent=role[1];
  $('performance-condition-note').textContent=`고도 ${number(p[1],0)} m · TAS ${number(p[2],0)} m/s (${number(p[2]*3.6,0)} km/h) · 연료 ${number(p[6],0)} kg · 현재 무장 포함 ${number(p[4],0)} kg`+(p[27]?' · 최대 이륙중량에 맞춰 연료 제한':'');
  rows('performance-loading',[
   ['기체 유형',role[0]],['계산 중량',number(p[4],0)+' kg'],['현재 무장·포드 질량',number(p[5],0)+' kg'],['익면하중',number(p[7],1)+' kg/m²'],['가로세로비',number(p[8],2)],['추중비 · 선택 고도',number(p[9],2)],['추중비 · 해면 정지',number(p[23],2)],['고도 보정 최대 추력',number(p[22],1)+' kN'],['설정 최대 롤률',number(p[20],0)+' °/s'],['설정 받음각 한계',number(p[21],1)+'°']
  ]);
  rows('performance-turn',[
   ['순간 선회율',rate(p,12)],['지속 선회율',rate(p,13)],['순간 선회 반경',p[14]?number(p[14],0)+' m':'—'],['지속 선회 반경',p[15]?number(p[15],0)+' m':'—'],['가용 순간 하중',number(p[10],2)+' G'],['가용 지속 하중',number(p[11],2)+' G'],['1 G 최소 양력 속도',number(p[16],1)+' m/s TAS'],['계산 Mach',number(p[17],2)],['가변익 계산 후퇴각',af.id===4?number(p[26],0)+'°':'고정익']
  ]);
  const body=$('performance-envelope');body.replaceChildren();for(const speed of af.bomber?[90,120,150,180,220]:[120,160,200,250,300]){const q=readPerformance(sim,{...conditions,speed}),row=d.createElement('tr');for(const value of [number(speed*3.6,0),q[12]?number(q[12],1):'—',q[13]?number(q[13],1):'—']){const cell=d.createElement('td');cell.textContent=value;row.append(cell);}body.append(row);}
  rows('performance-radar',[
   ['레이더',af.radar],['방식',af.radarMode],['공대공 탐색',radar[8]?'지원':'미지원 · 지상/해상 전용'],['공대공 기준 탐지거리',radar[8]?number(radar[1]/1000,0)+' km':'—'],['지상·해상 기준 거리',radar[2]>0?number(radar[2]/1000,0)+' km':'미지원'],['기준 표적 RCS',number(radar[9],0)+' m²'],['탐색 주기',number(radar[3],2)+' s'],['모델 빔 폭',number(radar[4],0)+'°'],['탐색 방위각 선택','30° / 60° / 130°'],['TWS',radar[8]&&af.id!==1&&af.id!==2?'지원':'미지원'],['속도 노치 기준',radar[5]>0?number(radar[5],0)+' m/s':'속도 노치 모델 미적용'],['미사일 유도',!af.rfCount?'레이더 미사일 미탑재':af.id===1?'Sparrow · STT 유지 필수':'능동 미사일 · 데이터링크 사용']
  ]);
  const reference=PUBLIC_CATALOG[af.id];rows('performance-public', [['공개 속도 참고',reference.speed],['공개 상승한도',reference.ceiling],['공개 항속거리',reference.range]]);$('performance-source').href=reference.source;
 }
 for(const [name,id,scale]of [['altitude','performance-altitude',1],['speed','performance-speed',1],['fuel','performance-fuel',.01]])$(id).addEventListener('change',()=>{const input=$(id);if(input.value===''||!input.checkValidity())return;conditions[name]=Number(input.value)*scale;refresh();});
 return{refresh,conditions};
}
