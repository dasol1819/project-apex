// Curated fixed-wing roster. BR is this game's design rating, not an official
// performance ranking. An explicit simId is the ONLY route to a flight model.
export const TREE_NATIONS=Object.freeze([
 {id:'us',name:'미국',english:'UNITED STATES'},
 {id:'ru',name:'러시아',english:'RUSSIA / USSR'}
]);
export const TREE_BRANCHES=Object.freeze([
 {id:'light',name:'경전투기',english:'LIGHT FIGHTER',description:'경량 기체 · 근접 공중전'},
 {id:'heavy',name:'중전투기',english:'HEAVY FIGHTER',description:'제공 · 장거리 요격'},
 {id:'multirole',name:'다목적 전투기',english:'MULTIROLE',description:'공중전 · 지상 타격'},
 {id:'tactical',name:'전술폭격기',english:'TACTICAL BOMBER',description:'전폭기 · 전선 / 전구 타격'},
 {id:'strategic',name:'전략폭격기',english:'STRATEGIC BOMBER',description:'장거리 · 대규모 폭장'},
 {id:'attack',name:'공격기',english:'ATTACK AIRCRAFT',description:'근접 지원 · 저고도 타격'},
 {id:'naval',name:'함재기',english:'CARRIER AIRCRAFT',description:'함상 전투 · 함상 공격'}
]);
export const TREE_ERAS=Object.freeze([{id:'prop',name:'프로펠러 시대'},{id:'jet',name:'초기 제트'},{id:'supersonic',name:'초음속 / 미사일 시대'},{id:'fourth',name:'4세대 중심'},{id:'modern',name:'현대화 / 스텔스'}]);
export const TREE_SOURCES=Object.freeze({
 museum:{name:'미 공군 박물관 · 기체 컬렉션',url:'https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/'},
 ww2:{name:'미 공군 역사실 · 제2차 세계대전 항공기',url:'https://www.afhistory.af.mil/FAQs/Fact-Sheets/Article/459025/army-air-forces-aircraft-a-definitive-moment/'},
 navy:{name:'미 해군 역사사령부 · 항공기 컬렉션',url:'https://www.history.navy.mil/content/history/museums/nnam/explore/collections/aircraft.html'},
 f16:{name:'미 공군 · F-16 계열',url:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104505/f-16-fighting-falcon/'},
 f35:{name:'미 공군 · F-35A',url:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/478441/f-35a-lightning-ii/'},
 f15:{name:'미 공군 · F-15 Eagle',url:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104501/f-15-eagle/'},
 f15e:{name:'미 공군 · F-15E Strike Eagle',url:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104499/f-15e-strike-eagle/'},
 f22:{name:'미 공군 · F-22 Raptor',url:'https://www.af.mil/About-Us/Fact-Sheets/Display/Article/104506/f-22-raptor/'},
 hornet:{name:'NAVAIR · Super Hornet',url:'https://www.navair.navy.mil/product/FA-18EF-Super-Hornet'},
 b52:{name:'Boeing · B-52',url:'https://www.boeing.com/defense/fighters-and-bombers/b-52'},
 b2:{name:'Northrop Grumman · B-2',url:'https://www.northropgrumman.com/what-we-do/air/b-2-stealth-bomber'},
 soviet:{name:'러시아 중앙 공군박물관 · 역사 기체',url:'https://aviamuseum.ru/pamyatniki-nauki-i-tehniki-v-czentralnom-muzee-vvs/'},
 il2:{name:'Smithsonian · Il-2',url:'https://airandspace.si.edu/collection-objects/ilyushin-il-2-shturmovik/nasm_A19950142000'},
 mig29:{name:'미 공군 박물관 · MiG-29A',url:'https://www.nationalmuseum.af.mil/Visit/Museum-Exhibits/Fact-Sheets/Display/Article/197174/AFmuseum/mikoyan-gurevich-mig-29a/'},
 uac:{name:'UAC · 군용 항공기',url:'https://uacrussia.ru/en/aircraft/lineup/military/'},
 uacmap:{name:'UAC · 기체 형식별 자료',url:'https://uacrussia.ru/en/map/'},
 su30:{name:'UAC · Su-30SME 계열 참고',url:'https://uacrussia.ru/en/aircraft/lineup/military/su-30sme/'},
 mig29k:{name:'미 육군 ODIN · MiG-29K',url:'https://odin.t2com.army.mil/WEG/Asset/MiG-29K_%28Fulcrum-D%29_Russian_Multirole_Fighter_Aircraft'},
 su33:{name:'미 육군 ODIN · Su-33',url:'https://odin.t2com.army.mil/WEG/Asset/Su-33_%28Flanker-D%29_Russian_Carrier-Based_Air_Superiority_Fighter'}
});
const rows=[];
// [suffix, designation, variant, BR, era, distinguishing note, native ID?]
function add(nation,branch,family,nickname,source,variants){for(const [suffix,name,variant,br,era,note,simId=null]of variants)rows.push(Object.freeze({id:`${nation}-${family}-${suffix}`,nation,branch,family,nickname,source,name,variant,br,era,note,simId,implemented:Number.isInteger(simId),previewUrl:family==='su35'?'su35.html?v=4':null}));}
add('us','light','p40','Warhawk','ww2',[
 ['e','P-40E','기총 강화형',3,'prop','초기 Warhawk에서 기총 화력을 강화한 대표 E형.']]);
add('us','light','p51','Mustang','ww2',[
 ['d30','P-51D','D-30 · 후기 블록',5,'prop','Merlin 계열 엔진과 버블 캐노피를 갖춘 후기 Mustang.']]);
add('us','light','f80','Shooting Star','museum',[
 ['c','F-80C','엔진 개량형',7,'jet','초기 미군 실용 제트 전투기의 후기 C형.']]);
add('us','light','f86','Sabre','museum',[
 ['f40','F-86F','F-40 · 확장 슬랫 날개',9,'jet','확장된 날개와 슬랫을 사용하는 후기 F형.']]);
add('us','light','f5','Freedom Fighter / Tiger II','museum',[
 ['a','F-5A','Freedom Fighter',10,'supersonic','경량 쌍발의 초기 계열. E형과 기체·레이더 구성이 다름.'],
 ['e','F-5E','APQ-159 · AIM-9P',11,'supersonic','현재 구현된 APQ-159·쌍열 M39A3·AIM-9P 대표 구성.',2]]);
add('us','heavy','p38','Lightning','ww2',[
 ['l','P-38L','후기 쌍동체 전투형',5,'prop','쌍발·쌍동체의 장거리 호위 전투기.']]);
add('us','heavy','p47','Thunderbolt','ww2',[
 ['d28','P-47D','D-28 · 버블 캐노피',4.5,'prop','큰 성형 엔진과 터보 과급기의 중량급 전투기. 지상 타격도 수행.']]);
add('us','heavy','f106','Delta Dart','museum',[
 ['a','F-106A','전천후 요격형',11,'supersonic','델타익과 내부 무장창을 갖춘 고속 방공 요격기.']]);
add('us','heavy','f15','Eagle','f15',[
 ['a','F-15A','초기 제공형',15,'fourth','공중 우세 임무에 집중한 초기 Eagle.'],
 ['c','F-15C','APG-63 · AIM-120',17,'fourth','현재 구현된 F100-PW-220·APG-63·AIM-120C 대표 구성.',5]]);
add('us','heavy','f22','Raptor','f22',[
 ['game','F-22A','APG-77 · AIM-9X / 120',20,'modern','현재 게임의 대표 전투 구성. 특정 Block·Increment의 전체 성능을 구현했다는 뜻은 아님.',0]]);
add('us','multirole','f4','Phantom II','museum',[
 ['c','F-4C','미 공군 초기형',11.5,'supersonic','미 공군 초기 Phantom. E형의 기수 기관포 구성과 구분.'],
 ['e','F-4E','APQ-120 · AIM-7E-2',12.5,'supersonic','현재 구현된 기수 M61A1·APQ-120·Sparrow 대표 구성.',1]]);
add('us','multirole','f16','Fighting Falcon','f16',[
 ['a15','F-16A','Block 15',14.5,'fourth','초기 A형의 주요 블록. 후기 C형과 센서·무장 구성을 구분.'],
 ['c25','F-16C','Block 25',15.5,'fourth','C형 초기 블록. 조종석과 레이더 계열이 발전.'],
 ['c50','F-16C','Block 50',17,'fourth','현재 구현된 F110-GE-129·APG-68·AIM-120C 구성.',3],
 ['c52','F-16C','Block 52 · PW 엔진',17,'fourth','F100-PW-229 계열 엔진의 동급 블록. GE 엔진의 Block 50과 다른 항목.']]);
add('us','multirole','f35','Lightning II','f35',[
 ['a','F-35A','공군용 통상 이착륙형',19,'modern','통상 이착륙 스텔스 다목적형. 큰 함재 날개의 C형과 구분.']]);
add('us','tactical','b25','Mitchell','ww2',[
 ['j','B-25J','후기 중형 폭격형',4,'prop','기수·화력 구성을 발전시킨 쌍발 전술 폭격기.']]);
add('us','tactical','b57','Canberra','museum',[
 ['b','B-57B','전술 타격형',8.5,'jet','미국에서 생산한 Canberra의 전술 타격형.']]);
add('us','tactical','f105','Thunderchief','museum',[
 ['d','F-105D','전천후 전폭형',12,'supersonic','고속 전술 타격을 중시한 대형 전폭기.']]);
add('us','tactical','f111','Aardvark','museum',[
 ['f','F-111F','정밀 타격형',15,'fourth','가변익·복좌의 장거리 정밀 타격 계열.']]);
add('us','tactical','f15','Strike Eagle','f15e',[
 ['e','F-15E','APG-70 · PW-229',17.5,'fourth','현재 구현된 CFT·복좌·APG-70 전폭기. 제공형 F-15C와 별도 기체.',6]]);
add('us','strategic','b17','Flying Fortress','ww2',[
 ['g','B-17G','기수 하부 포탑',5,'prop','기수 하부 방어 포탑이 특징인 4발 중폭격기.']]);
add('us','strategic','b29','Superfortress','museum',[
 ['a','B-29A','고고도 중폭격형',6.5,'prop','여압 승무원실을 갖춘 4발 장거리 폭격기.']]);
add('us','strategic','b52','Stratofortress','b52',[
 ['d','B-52D','대량 재래식 폭격형',11.5,'jet','대량 재래식 폭격 운용의 대표 D형. 후기 H형과 다른 엔진·기체 계열.'],
 ['h','B-52H','TF33 · APQ-166',14.5,'modern','현재 구현된 8발 TF33·내부 폭탄창·외부 폭장 구성. 후방 기관포 없음.',8]]);
add('us','strategic','b1','Lancer','museum',[
 ['b','B-1B','가변익 전략폭격형',16,'fourth','가변익·4발 엔진의 장거리 대형 폭격기.']]);
add('us','strategic','b2','Spirit','b2',[
 ['a','B-2A','전익 스텔스 · 현행 게임형',19.5,'modern','현재 구현된 F118 4발·APQ-181·내부 폭탄창의 대표 구성.',7]]);
add('us','attack','a26','Invader','ww2',[
 ['b','A-26B','기총 기수형',4.5,'prop','전방 고정 무장 기수의 고속 쌍발 공격기.']]);
add('us','attack','a1','Skyraider','navy',[
 ['h','A-1H','근접 지원 구성',6,'prop','긴 체공과 폭장을 중시한 피스톤 공격기. 원 설계는 함재형.']]);
add('us','attack','a10','Thunderbolt II','museum',[
 ['c','A-10C','Precision Engagement',14,'modern','디지털 조종석과 정밀 타격 운용을 개량한 근접 지원형.']]);
add('us','naval','f6f','Hellcat','navy',[
 ['5','F6F-5','후기 함상 전투형',4,'prop','전쟁 후반의 주력 함상 전투기. 초기형에서 엔진 주변·방호를 개선.']]);
add('us','naval','f4u','Corsair','navy',[
 ['4b','F4U-4B','20 mm 기관포형',5.5,'prop','역갈매기 날개와 20 mm 기관포의 후기 함상 전투형.']]);
add('us','naval','f4','Naval Phantom II','navy',[
 ['j','F-4J','펄스 도플러형',12.5,'supersonic','하방 탐지를 발전시킨 해군형. 공군 E형과 레이더·무장 구성이 다름.']]);
add('us','naval','f14','Tomcat','navy',[
 ['a','F-14A','TF30 · AWG-9',15.5,'fourth','초기 TF30 엔진과 AWG-9 레이더의 함대 방공형.'],
 ['d','F-14D','F110 · APG-71',17.5,'fourth','현재 구현된 F110·APG-71·AIM-54C Phoenix 구성.',4]]);
add('us','naval','fa18','Super Hornet','hornet',[
 ['eii','F/A-18E','Block II · AESA',18,'modern','APG-79 AESA · F414 쌍발 · 단좌 함재 다목적기 · 영화풍 외형.',11],
 ['fii','F/A-18F','Block II · 복좌 AESA',18,'modern','후방 WSO석과 긴 캐노피를 갖춘 복좌 Super Hornet. 단좌 E형과 별도 기체.',12]]);
add('us','naval','f35','Lightning II','navy',[
 ['c','F-35C','항공모함용 · 큰 날개',19.5,'modern','강화 착륙장치와 큰 접이식 날개의 항공모함용 기체.']]);

add('ru','light','i16','Ishak','soviet',[
 ['10','I-16','Type 10',1,'prop','기총 무장을 늘린 초기 단엽 전투기. 소련 경전투기 경로의 출발점.']]);
add('ru','light','yak','Yakovlev Fighter','soviet',[
 ['1b','Yak-1B','시야·무장 개량',3,'prop','Yak-1의 시야와 무장 구성을 바꾼 후기형.'],
 ['3p','Yak-3P','기관포 3문',5,'prop','경량 Yak-3 계열에서 기수 기관포 구성을 강화한 후기형.']]);
add('ru','light','la','Lavochkin Fighter','soviet',[
 ['5fn','La-5FN','연료 분사형',4,'prop','성형 엔진·연료 분사를 사용하는 La-5 발전형.'],
 ['7','La-7','후기 공력 개량',4.5,'prop','La-5FN에서 공력과 중량을 개선한 후속 계열.']]);
add('ru','light','mig15','Fagot','museum',[
 ['bis','MiG-15bis','엔진 개량형',8.5,'jet','후퇴익 초기 제트 전투기의 엔진 개량형.']]);
add('ru','light','mig17','Fresco','museum',[
 ['f','MiG-17F','후연 엔진형',9,'jet','MiG-15 이후 날개와 고속 특성을 발전시키고 후연 엔진을 적용한 형식.']]);
add('ru','light','mig21','Fishbed','soviet',[
 ['bis','MiG-21bis','후기 엔진형',12.5,'supersonic','경량 델타익 MiG-21의 엔진·무장 운용 발전형.']]);
add('ru','light','mig29','Fulcrum','mig29',[
 ['912','MiG-29','9.12 · 초기형',14.5,'fourth','경량 쌍발 전선 전투기의 초기 실전형. 현대화 SMT와 별도.']]);
add('ru','heavy','pe3','Petlyakov Fighter','soviet',[
 ['bis','Pe-3bis','쌍발 중전투형',3.5,'prop','Pe-2 계열에서 발전한 쌍발 전투기의 무장·방호 개량형.']]);
add('ru','heavy','su15','Flagon','soviet',[
 ['tm','Su-15TM','후기 레이더형',12.5,'supersonic','쌍발 방공 요격기의 레이더·무장 발전형.']]);
add('ru','heavy','mig25','Foxbat','soviet',[
 ['pd','MiG-25PD','센서 개량 요격형',14,'supersonic','고속·고고도 요격용 P형에서 레이더·적외선 센서를 개량.']]);
add('ru','heavy','mig31','Foxhound','uacmap',[
 ['bm','MiG-31BM','현대화 요격형',18,'modern','위상배열 레이더·장거리 방공 계열의 센서·무장 현대화형.']]);
add('ru','heavy','su27','Flanker','uacmap',[
 ['s','Su-27S','초기 제공형',15.5,'fourth','장거리 제공 임무의 초기 Flanker. 후속 Su-30·Su-35와 다른 구성.']]);
add('ru','heavy','su35','Flanker-E','uac',[
 ['s','Su-35S','Irbis · 추력 편향',19,'modern','3D 외형 공개 · 열린 흡입구와 덕트, 캐노피·착륙장치·추력편향 노즐을 확인할 수 있습니다. 전용 비행 시험을 제공하며 전투 모드 연결은 준비 중입니다.']]);
add('ru','heavy','su57','Felon','uac',[
 ['base','Su-57','초기 실전 구성',19.5,'modern','초기 양산형 AL-41F1 · 쌍발 경사축 TVC · 내부 무장창 · 공개되지 않은 성능은 게임 추정.',10]]);
add('ru','multirole','mig23','Flogger','soviet',[
 ['mld','MiG-23MLD','후기 기동·센서 개량',13.5,'supersonic','가변익 MiG-23의 공력·전자장비 개량형.']]);
add('ru','multirole','mig29','Modern Fulcrum','uacmap',[
 ['smt','MiG-29SMT','9.19 · 현대화',17,'modern','연료·조종석·공대지 운용을 발전시킨 MiG-29 현대화형.']]);
add('ru','multirole','mig35','Fulcrum-F','uac',[
 ['s','MiG-35S','단좌 다목적형',18,'modern','MiG-29 계열의 심화 개량형. AESA를 모든 실전형의 확정 장비로 가정하지 않음.']]);
add('ru','multirole','su30','Flanker','su30',[
 ['sm','Su-30SM','카나드 · 추력 편향',18,'modern','복좌·카나드·추력 편향을 사용하는 다목적 계열.'],
 ['sm2','Su-30SM2','현대화 패키지',18.5,'modern','SM 계열의 현대화 항목. 개별 개조 차이는 향후 비행 모델에서 구분.']]);
add('ru','tactical','pe2','Peshka','soviet',[
 ['110','Pe-2','Series 110',3.5,'prop','전시 중기 시리즈의 쌍발 급강하·전술 폭격기.']]);
add('ru','tactical','il28','Beagle','soviet',[
 ['base','Il-28','제트 전술폭격형',8,'jet','초기 전후 쌍발 제트 전술 폭격기의 대표 형식.']]);
add('ru','tactical','su24','Fencer','uacmap',[
 ['m','Su-24M','정밀 타격 개량',15,'fourth','병렬 복좌·가변익 Su-24의 항법·표적 장비 개량형.']]);
add('ru','tactical','su34','Fullback','uac',[
 ['base','Su-34','병렬 복좌 전폭형',17.5,'modern','Su-27 계열에서 발전한 병렬 복좌 장거리 전술 타격기.']]);
add('ru','tactical','tu22m','Backfire','uacmap',[
 ['3','Tu-22M3','엔진·흡입구 개량',16,'fourth','장거리 전구·대함 타격의 가변익 계열. 대륙간 Tu-160과 구분.']]);
add('ru','strategic','pe8','Petlyakov Heavy Bomber','soviet',[
 ['base','Pe-8','4발 중폭격형',5,'prop','소련의 전시 4발 장거리 중폭격기.']]);
add('ru','strategic','tu4','Bull','soviet',[
 ['base','Tu-4','전후 중폭격형',6.5,'prop','전후 소련의 4발 장거리 여압 폭격기.']]);
add('ru','strategic','tu95','Bear','uacmap',[
 ['ms','Tu-95MS','순항미사일 운반형',14.5,'fourth','4발 터보프롭의 장거리 전략 미사일 운반형.']]);
add('ru','strategic','tu160','Blackjack / White Swan','uacmap',[
 ['base','Tu-160','가변익 전략폭격형',17,'fourth','4발 엔진·가변익·내부 무장창의 대형 전략 폭격기.'],
 ['m','Tu-160M','심화 현대화형',18.5,'modern','추진·전자장비 현대화 계열. 비공개 실제 성능 수치를 확정하지 않음.']]);
add('ru','attack','il2','Shturmovik','il2',[
 ['1942','Il-2','1942 · 복좌형',3.5,'prop','장갑 구조와 후방 방어 사수의 복좌 지상 공격 구성.']]);
add('ru','attack','il10','Shturmovik Successor','soviet',[
 ['base','Il-10','후속 장갑 공격형',4.5,'prop','Il-2 이후의 장갑 지상 공격기.']]);
add('ru','attack','su17','Fitter','soviet',[
 ['m4','Su-17M4','후기 전자장비형',13.5,'fourth','가변 외익의 전폭 계열에서 전자장비를 발전시킨 후기형.']]);
add('ru','attack','mig27','Flogger-J','soviet',[
 ['k','MiG-27K','Kaira 표적 장비',14,'fourth','MiG-23 계열의 지상 공격용 기수·무장과 표적 장비를 사용하는 형식.']]);
add('ru','attack','su25','Frogfoot','uacmap',[
 ['sm3','Su-25SM3','추가 현대화',15,'modern','저고도 장갑 공격기의 센서·방어 체계 현대화 구성.']]);
add('ru','naval','yak38','Forger','uacmap',[
 ['m','Yak-38M','추진 계통 개량',11,'supersonic','함상 운용 고정익 수직 이착륙 공격기. 헬리콥터가 아님.']]);
add('ru','naval','su33','Flanker-D','su33',[
 ['base','Su-33','함상 제공형',16,'fourth','카나드·접이식 날개와 강화 착륙장치의 함상 Flanker.']]);
add('ru','naval','mig29','Naval Fulcrum','mig29k',[
 ['k','MiG-29K','9.41 · 단좌 함재형',17.5,'modern','원형 시제 9.31과 다른 현대 단좌 함상 다목적형.'],
 ['kub','MiG-29KUB','9.47 · 복좌 함재형',17.5,'modern','복좌 전투·훈련 겸용 함재형. 비전투 훈련 전용 기체가 아님.']]);

// A small expansion keeps the roster readable while filling useful generation
// and variant gaps. All added entries remain catalogue-only.
add('us','light','p26','Peashooter','museum',[
 ['a','P-26A','초기 단엽 전투형',1,'prop','고정식 착륙장치와 성형 엔진을 갖춘 BR 1.0 경전투기. 비행 튜토리얼 지정 기체.',9]]);
add('us','multirole','f84','Thunderjet','museum',[
 ['g','F-84G','후기 직선익형',8,'jet','직선익 제트 전투·공격기의 후기형. 전술 지상 타격을 중시.']]);
add('us','naval','f14','Tomcat','navy',[
 ['b','F-14B','F110 · AWG-9',16.5,'fourth','F110 엔진을 적용한 B형. APG-71을 사용하는 현재 구현 D형과 구분.']]);
add('us','naval','fa18','Hornet','hornet',[
 ['c','F/A-18C','단좌 Night Attack',16.5,'fourth','기존 Hornet의 야간 타격 개량형. 더 큰 Super Hornet E형과는 다른 기체.']]);
add('us','tactical','f15','Strike Eagle','f15e',[
 ['eaesa','F-15E','APG-82(V)1 · AESA',19,'modern','AESA 레이더 현대화 구성. 현재 구현된 APG-70·PW-229 구성과 별도 항목.']]);
add('ru','light','mig19','Farmer','soviet',[
 ['s','MiG-19S','주간 초음속 전투형',10,'supersonic','쌍발 후연 엔진의 초기 초음속 전투기. MiG-17과 MiG-21 사이 경로.']]);
add('ru','light','mig21','Fishbed','soviet',[
 ['f13','MiG-21F-13','초기 미사일형',10.5,'supersonic','경량 델타익 초기형. 후기 엔진과 전자장비의 bis형과 구분.']]);
add('ru','light','mig29','Fulcrum','uacmap',[
 ['s','MiG-29S','9.13S · 전자장비 개량',16,'fourth','초기 9.12에서 전자장비·공대공 무장 운용을 발전시킨 S형.']]);
add('ru','tactical','su24','Fencer','uacmap',[
 ['m2','Su-24M2','현대화형',16,'modern','기존 Su-24M의 항법·전자장비 현대화 구성.']]);
add('ru','attack','su25','Frogfoot','uacmap',[
 ['base','Su-25','초기 장갑 공격형',12,'fourth','저고도 근접 지원과 생존성을 중시한 초기 쌍발 공격형. SM3와 구분.']]);

export const AIRCRAFT_TREE=Object.freeze(rows);
export const treeAircraft=id=>AIRCRAFT_TREE.find(a=>a.id===id)||null;
export const treeAircraftForSim=id=>AIRCRAFT_TREE.find(a=>a.implemented&&a.simId===Number(id))||null;
export const treeFamily=a=>AIRCRAFT_TREE.filter(b=>b.nation===a.nation&&b.family===a.family).sort((a,b)=>a.br-b.br);
const latin=s=>String(s).toLowerCase().replace(/미그|миг/g,'mig').replace(/수호이|сухой|су/g,'su').replace(/투폴레프|туполев|ту/g,'tu').replace(/야코블레프|야크|яковлев|як/g,'yak').replace(/일류신|ильюшин|ил/g,'il').replace(/라보치킨|лавочкин|ла/g,'la').replace(/пе/g,'pe');
export const normalizeTreeText=s=>latin(s).replace(/[^\p{L}\p{N}]+/gu,'');
export function searchTreeAircraft(a,query=''){
 const words=latin(query).replace(/block\s*(\d+)/g,' block $1').split(/\s+/).map(normalizeTreeText).filter(Boolean),aliases={f22:'랩터',f4:'팬텀',f16:'파이팅 팰컨',f14:'톰캣',f15:'이글',b52:'스트래토포트리스',b2:'스피릿',f35:'라이트닝'};
 const text=normalizeTreeText([a.name,a.variant,a.nickname,a.family,aliases[a.family]||''].join(' '));return words.every(w=>text.includes(w));
}
export function filterAircraftTree({nation='us',branch='all',era='all',status='all',query='',minBR=1,maxBR=20}={}){return AIRCRAFT_TREE.filter(a=>a.nation===nation&&(branch==='all'||a.branch===branch)&&(era==='all'||a.era===era)&&(status==='all'||(status==='implemented'?a.implemented:!a.implemented))&&a.br>=minBR&&a.br<=maxBR&&searchTreeAircraft(a,query)).sort((a,b)=>a.br-b.br||a.id.localeCompare(b.id));}
export function treeSummary(nation){const entries=AIRCRAFT_TREE.filter(a=>a.nation===nation);return{total:entries.length,implemented:entries.filter(a=>a.implemented).length,families:new Set(entries.map(a=>a.family)).size};}
export function treeKeyboardTarget(rows,id,key){
 const a=rows.find(a=>a.id===id);if(!a)return rows[0]?.id||null;const branches=TREE_BRANCHES.filter(b=>rows.some(a=>a.branch===b.id)).map(b=>b.id),same=rows.filter(b=>b.branch===a.branch),i=same.indexOf(a);
 if(key==='Home')return same[0]?.id;if(key==='End')return same.at(-1)?.id;if(key==='ArrowUp'||key==='ArrowDown')return same[Math.max(0,Math.min(same.length-1,i+(key==='ArrowDown'?1:-1)))]?.id;
 if(key==='ArrowLeft'||key==='ArrowRight'){const next=branches[branches.indexOf(a.branch)+(key==='ArrowRight'?1:-1)];return rows.filter(b=>b.branch===next).sort((b,c)=>Math.abs(b.br-a.br)-Math.abs(c.br-a.br))[0]?.id||id;}return null;
}
export function treeRoleTags(a){
 const tags={light:['공중전'],heavy:['제공 / 요격'],multirole:['공중전','지상 타격'],tactical:['전술 타격'],strategic:['장거리 폭격'],attack:['근접 지원','지상 타격'],naval:['함상 운용','공중전']}[a.branch].slice();
 if(a.name==='F-15E')tags.push('공중전');if(a.family==='f22'||a.family==='b2'||a.family==='f35'||a.family==='su57')tags.push('저피탐');if(a.family==='a1')tags.push('함상 설계');if(a.family==='yak38')return['함상 운용','고정익 수직 이착륙','공격'];return tags;
}
