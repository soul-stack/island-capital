// The same rules run on the room server and in a browser practice game.
const classicDistricts = Object.freeze([
  { name: '灯塔湾', color: '#f5c269' }, { name: '珊瑚街', color: '#f48479' },
  { name: '风车原', color: '#a2ce83' }, { name: '蓝礁港', color: '#72bade' },
  { name: '月牙岛', color: '#be9bd9' }, { name: '铜帆埠', color: '#eba16b' },
  { name: '青苔屿', color: '#67c8b8' }, { name: '星潮岸', color: '#d69bb1' }
].map(Object.freeze));

// Each coastal district has four estates and two public stops.
const coast = [
  ['启航码头|启航|start', '灯芯作坊|灯芯|1800', '晨雾渔市|渔市|2200', '漂流信筒|信筒|chance', '咸风客栈|客栈|2400', '灯塔船坞|船坞|2800'],
  ['珊瑚商铺|商铺|shop', '红瓦画坊|画坊|2000', '贝壳剧院|剧院|2800', '码头维护费|港务|tax', '珊瑚旅社|旅社|2400', '玫瑰栈桥|栈桥|3000'],
  ['丰收集会|丰收|bonus', '风谷磨坊|磨坊|2200', '苇田农庄|农庄|2500', '候风锚地|候风|delay', '麦仓广场|麦仓|2800', '风轮工坊|风轮|3200'],
  ['海图驿站|海图|chance', '蓝礁船厂|船厂|3200', '潮汐水站|水站|2300', '航海商栈|商栈|shop', '澄湾会馆|会馆|2800', '蓝湾旅馆|旅馆|3400'],
  ['赏月庆典|庆典|bonus', '珍珠商行|珍珠|2900', '月影书屋|书屋|2400', '潮声来信|来信|chance', '银沙浴场|银沙|3100', '望月饭店|饭店|3500'],
  ['航道通行费|航费|tax', '铸铜工场|铸铜|2600', '铜帆码头|铜帆|3600', '雾中泊地|泊地|delay', '铁锚仓库|铁锚|2900', '旧钟集市|钟市|3200'],
  ['补给货栈|补给|shop', '青苔花房|花房|2700', '绒杉木场|木场|3000', '浮标电台|电台|chance', '绿釉窑场|窑场|3400', '松岛庄园|庄园|3800'],
  ['星潮集会|集会|bonus', '星光影馆|影馆|3100', '萤海茶舍|茶舍|2800', '灯航养护费|养护|tax', '极光客舍|客舍|3600', '观星楼阁|星楼|4000']
];

const classicTiles = Object.freeze(coast.flatMap((districtTiles, district) =>
  districtTiles.map((row, index) => {
    const [name, short, value] = row.split('|');
    const price = Number(value) || 0;
    return Object.freeze({ id: district * 6 + index, name, short, district, price, type: price ? 'property' : value });
  })
));

const colors = ['#efbc69','#e78c7d','#85c3ad','#8cb9d2','#bd9ed0','#cbd18b','#e7aa72','#74bcbc','#b2a6d6','#d7a3a0','#c8a477','#9ab6a0'];
const classics = classicTiles.map(({id})=>{
  if (id<16) return {x:id-7.5,y:.18,z:-4.5};
  if (id<24) return {x:7.5,y:.18,z:id-19.5};
  if (id<40) return {x:31.5-id,y:.18,z:4.5};
  return {x:-7.5,y:.18,z:43.5-id};
});
const classic = {id:'mistport',name:'雾港群岛',english:'MIST HARBOR',description:'环绕四座海岛经营港口，适合熟悉购地与收租。',color:'#77bcae',width:16,depth:10,
  points:classics,next:classicTiles.map((_,id)=>[(id+1)%48]),mainCount:48,tiles:classicTiles,districts:classicDistricts,routeLabels:{}};

const sky = {
  id:'skyrail',name:'云轨山城',english:'CLOUDRAIL CITY',color:'#90bfab',width:18,depth:12,
  description:'在台地、铁桥和江港之间穿行，选择山腰捷径或商业街绕行。',
  main:[[1,8],[1,3],[4,3],[4,1],[10,1],[10,3],[15,3],[15,5],[12,5],[12,7],[16,7],[16,10],[10,10],[10,8],[7,8],[7,10],[3,10],[3,8],[1,8]],
  branches:[
    {via:[[1,6],[5,6],[5,3],[4,3]],names:['石梯街','山腰支线'],area:10},
    {via:[[10,3],[10,5],[12,5]],names:['东城商圈','云桥快线']},
    {via:[[10,10],[9,10],[9,9],[8,9],[8,8]],names:['滨江大道','里巷环线']}
  ],
  areas:[
    ['青石埠','石阶客栈 清波码头 碎云茶档 石笋书房 翠门布庄 青砖作坊'],
    ['杉岚巷','杉影花房 雾凇茶铺 森音剧场 山笛旅社 绒杉木厂 林下茶园'],
    ['观云台','星象塔楼 云颠旅馆 山脊茶园 晴窗画廊 月坪酒庄 观云茶室'],
    ['天车坊','铆钉工场 飞缆机厂 铁轮铺子 云梭仓库 黄铜会馆 工匠旅社'],
    ['钟塔街','青铜钟楼 百叶画室 钢琴商行 穿廊剧场 老城客舍 鸽巷报馆'],
    ['蓝桥湾','蓝桥船台 潮纹茶馆 江帆市场 链桥客栈 水门会馆 南堤商行'],
    ['映江港','白帆码头 河砂仓库 流水戏台 鱼帘小馆 江岸客舍 金桅商场'],
    ['橘灯里','橘灯饭店 木窗茶馆 花墙书店 金铃客舍 纸影工坊 红砖旅社 棋盘会馆'],
    ['南麓园','山茶花圃 玻璃温室 白鹭水榭 石泉茶楼 园艺工坊 四季果园'],
    ['石门坡','石门货栈 羊肠茶道 鼓楼客店 青苔石坊 岩下酒馆 南坡集市'],
    ['临崖里','栈桥客栈 悬钟茶亭 崖松艺社 梯田市口 苍藤书苑 红栏食堂']
  ],
  publicNames:{start:'山城总站',shop:'旅行补给',chance:'云轨快讯',bonus:'山城集会',tax:'路桥维护',delay:'错车候站'},
  height:(x,z)=>.25+.65*Math.max(0,1-Math.hypot((x+4.2)/10,(z+2.5)/6))
};
const desert = {
  id:'saffron',name:'赤沙商路',english:'SAFFRON CARAVAN',color:'#d4a16b',width:20,depth:12,
  description:'沿运河与古驿站经商，穿过香料集市，或改道绿洲与峡谷。',
  main:[[1,9],[5,9],[5,6],[9,6],[9,10],[13,10],[13,8],[18,8],[18,4],[15,4],[15,1],[11,1],[11,3],[8,3],[8,1],[3,1],[3,4],[1,4],[1,9]],
  branches:[
    {via:[[5,8],[7,8],[7,6]],names:['驼铃大街','铜匠巷']},
    {via:[[14,8],[14,6],[17,6],[17,4]],names:['东城驿道','绿洲水道']},
    {via:[[11,2],[13,2],[13,4],[9,4],[9,3]],names:['风塔旧路','香料市集'],area:10},
    {via:[[3,2],[6,2],[6,4],[3,4]],names:['西城门道','金砂峡谷'],area:11}
  ],
  areas:[
    ['落日驿','驼铃旅社 红泥客栈 骆驼货站 西门商舍 黄昏茶馆 旧驿车行'],
    ['铜器街','铜壶作坊 雕花灯行 金纹商铺 铜镜小院 铜匠货栈 沙窑工坊'],
    ['月井湾','月井浴场 水车小院 岸边客舍 棕榈果园 白拱客栈 绿瓶茶店'],
    ['长渠港','长渠船坞 金帆仓库 河岸织厂 青瓦水阁 渡口商铺 棕绳货栈'],
    ['孔雀市','翎羽茶楼 彩毯商铺 缀珠画坊 孔雀剧场 宝石金行 织锦货仓 琥纹书屋 羽冠钟楼'],
    ['红岩门','红岩石坊 峡谷旅舍 驼队营地 赤陶作坊 岩壁画室 沙岭货行'],
    ['风塔坊','风塔旅馆 白石灯楼 沙丘书院 星盘工坊 风旗茶室 雕窗庭院'],
    ['香料庭','藏红花行 肉桂商铺 豆蔻仓库 香茶会馆 胡椒小院 丁香客舍'],
    ['金砂城','金砂客馆 琥珀商行 琉璃画廊 金砖工坊 彩釉商舍 石砌驿馆'],
    ['千泉屿','千泉苗圃 椰枣果园 青池浴场 翠渠客栈 绿帆商铺 石泉货仓'],
    ['绯帐巷','莳萝药铺 肉桂小院 绯帐金店 青柠商亭 八角客舍 绿松货栈'],
    ['黄晶峡','峡口驿楼 云母矿场 晶砂画廊 峡壁酒庄 岩纹手作 金脉商社']
  ],
  publicNames:{start:'驼队营门',shop:'沙洲补给',chance:'驼队来信',bonus:'商旅庆典',tax:'商路关税',delay:'避沙驿站'},
  height:(x,z)=>.23+.31*Math.max(0,1-Math.hypot((x-3.5)/10,(z+2.8)/6))
};

// The ordered control points are carved into contiguous grid steps, including each junction.
function gridLine(controls) {
  const result=[controls[0]];
  for(let i=1;i<controls.length;i++) {
    const [endX,endZ]=controls[i];
    let [x,z]=controls[i-1];
    if (x!==endX && z!==endZ) throw new Error('路线控制点必须共线');
    const dx=Math.sign(endX-x),dz=Math.sign(endZ-z);
    while (x!==endX || z!==endZ) {x+=dx;z+=dz;result.push([x,z]);}
  }
  return result;
}

function buildCity(spec) {
  const coords=gridLine(spec.main).slice(0,-1), mainCount=coords.length;
  const next=coords.map((_,i)=>[(i+1)%mainCount]);
  const coordIds=new Map(coords.map((p,i)=>[p.join(','),i]));
  if (coordIds.size!==mainCount) throw Error('主路线重复 '+spec.id);
  const districtAt=coords.map((_,i)=>Math.floor(i*10/mainCount));
  const routeLabels={};
  spec.branches.forEach(branch=>{
    const line=gridLine(branch.via);
    const origin=coordIds.get(line[0].join(',')),exit=coordIds.get(line.at(-1).join(','));
    if (!(origin>=0 && exit>origin && exit<mainCount)) throw Error('无效分岔 '+spec.id);
    const start=coords.length,inner=line.slice(1,-1);
    next[origin].push(start);
    routeLabels[origin]={[next[origin][0]]:branch.names[0],[start]:branch.names[1]};
    inner.forEach((p,i)=>{
      const key=p.join(',');
      if (coordIds.has(key)) throw Error('支路重合 '+key+' '+spec.id);
      coordIds.set(key,coords.length);coords.push(p);
      districtAt.push(branch.area ?? districtAt[Math.round(origin+(exit-origin)*(i+1)/(inner.length+1))]);
      next.push([i===inner.length-1 ? exit : coords.length]);
    });
  });
  const points=coords.map(([column,row])=>{
    const x=column-(spec.width-1)/2,z=row-(spec.depth-1)/2;
    return {x,y:Math.round(spec.height(x,z)*1000)/1000,z};
  });
  const districts=spec.areas.map(([name],i)=>({name,color:colors[i]}));
  const names=spec.areas.map(([,words])=>words.split(' ')),used=names.map(()=>0);
  const events=['chance','shop','bonus','tax','chance','delay','shop','bonus','chance','tax','delay','bonus'];
  const publicStops=new Set();
  let event=0;
  const tiles=coords.map((_,id)=>{
    const district=districtAt[id],type=id===0 ? 'start' : (id%7===2 || id%7===5) ? events[event++%events.length] : 'property';
    let venue=spec.publicNames[type] || '',name=venue;
    if (type==='property') {
      const i=used[district]++,area=names[district];
      name=area[i];
      if (!name) throw Error('地区缺少地产名称 '+districts[district].name);
    } else if (type!=='start') {
      const key=district+'-'+type;
      if (publicStops.has(key)) venue=type==='bonus' ? '彩毯庆市' : spec.id==='skyrail' ? '登山商铺' : '商队货栈';
      publicStops.add(key);name=districts[district].name+venue;
    }
    const price=type==='property' ? 1750+district*175+(id*3%8)*125 : 0;
    return {id,name,short:type==='property' ? name.slice(0,2) : venue.slice(-2),district,type,price};
  });
  const {id,name,english,description,color,width,depth}=spec;
  return {id,name,english,description,color,width,depth,points,mainCount,next,tiles,districts,routeLabels};
}
const bankOffices = {
  mistport: { 24: '月湾商港银行', 42: '星潮储蓄所' },
  skyrail: { 26: '钟塔城市银行', 51: '南麓储蓄所' },
  saffron: { 26: '孔雀市商旅银行', 68: '绿洲汇兑所' },
};
const curbDirections = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
];
const landUse = (name) =>
  /工|厂|仓|码头|船坞|货栈|窑|矿|木场|船台|水站|货站/.test(name)
    ? 'industry'
    : /商|市|铺|行|茶|店|集|书|画|坊|院|剧|金|酒|纺|货|戏|作/.test(name)
      ? 'shop'
      : 'home';
const intersects = (a, b, gap = 0) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 + gap && Math.abs(a.z - b.z) < (a.d + b.d) / 2 + gap;

// A lot faces its own stop. Its front gate and road share one permanent title-deed ID.
// The four possible kerbs are filtered against the actual directed road geometry.
function layOutParcels(map) {
  const roads = [];
  map.next.forEach((exits, i) =>
    exits.forEach((j) => {
      const a = map.points[i],
        b = map.points[j];
      roads.push({
        x: (a.x + b.x) / 2,
        z: (a.z + b.z) / 2,
        w: Math.abs(a.x - b.x) + 0.31,
        d: Math.abs(a.z - b.z) + 0.31,
      });
    }),
  );
  const lots = map.tiles.map(() => null);
  const landmark =
    map.id === 'skyrail' ? [1.52, 1.08, 3.46, 2.52] : map.id === 'saffron' ? [1.03, 1.57, 2.55, 2.02] : null;
  const preserve = landmark && {
    x: landmark[0] - (map.width - 1) / 2,
    z: landmark[1] - (map.depth - 1) / 2,
    w: landmark[2],
    d: landmark[3],
  };
  const candidates = map.tiles
    .filter((t) => t.type === 'property' || t.type === 'bank')
    .map((tile) => {
      const node = map.points[tile.id],
        choices = [];
      const shifts = tile.type === 'bank' ? [0, -0.2, 0.2, -0.6, 0.6] : [0, -0.2, 0.2];
      for (const [nx, nz] of curbDirections)
        for (const compact of [false, true])
          for (const shift of shifts) {
            const width = compact ? 0.41 : 0.68,
              depth = compact ? 0.34 : 0.46;
            const distance = compact ? 0.44 : 0.53;
            const x = node.x + nx * distance + nz * shift,
              z = node.z + nz * distance - nx * shift;
            const bounds = { x, z, w: nx === 0 ? width : depth, d: nx === 0 ? depth : width };
            if (
              Math.abs(x) + bounds.w / 2 > map.width / 2 - 0.035 ||
              Math.abs(z) + bounds.d / 2 > map.depth / 2 - 0.035
            )
              continue;
            if (roads.some((road) => intersects(bounds, road, 0.015))) continue;
            if (preserve && intersects(bounds, preserve, 0.06)) continue;
            const y = node.y + (map.id === 'skyrail' ? 0.073 : 0.033);
            const center = { x, y, z },
              front = { x: -nx, z: -nz };
            const entrance = { x: x - (nx * depth) / 2, z: z - (nz * depth) / 2, y };
            const tangent = { x: -front.z, z: front.x };
            const corners = [
              [-1, -1],
              [1, -1],
              [1, 1],
              [-1, 1],
            ].map(([t, f]) => ({
              x: x + (t * tangent.x * width) / 2 + (f * front.x * depth) / 2,
              y,
              z: z + (t * tangent.z * width) / 2 + (f * front.z * depth) / 2,
            }));
            const ordinal = curbDirections.findIndex(([a, b]) => a === nx && b === nz);
            const score = (compact ? 5 : 0) + Math.abs(shift) * 3 + ((ordinal + tile.id) % 4) * 0.04;
            choices.push({
              score,
              bounds,
              lot: {
                id: tile.id,
                nodeId: tile.id,
                kind: tile.type === 'bank' ? 'bank' : landUse(tile.name),
                center,
                front,
                entrance,
                width,
                depth,
                corners,
              },
            });
          }
      choices.sort((a, b) => a.score - b.score);
      return { id: tile.id, choices };
    });
  candidates.sort((a, b) => a.choices.length - b.choices.length || a.id - b.id);
  const chosen = [];
  function assign(i) {
    if (i === candidates.length) return true;
    for (const candidate of candidates[i].choices) {
      if (chosen.some((other) => intersects(candidate.bounds, other, 0.014))) continue;
      chosen.push(candidate.bounds);
      lots[candidates[i].id] = candidate.lot;
      if (assign(i + 1)) return true;
      lots[candidates[i].id] = null;
      chosen.pop();
    }
    return false;
  }
  if (!assign(0)) throw Error('无法布置临街地块 ' + map.name);
  return lots;
}
function streetMap(map) {
  const banks = bankOffices[map.id];
  const tiles = map.tiles.map((tile) =>
    banks[tile.id] ? { ...tile, type: 'bank', short: '银行', name: banks[tile.id] } : tile,
  );
  const frontages = layOutParcels({ ...map, tiles });
  return { ...map, tiles, frontages, lots: frontages.map((site) => (site?.kind === 'bank' ? null : site)) };
}
export const MAPS = [buildCity(sky), classic, buildCity(desert)].map(streetMap);
export function getMap(id) {
  return MAPS.find((map) => map.id === id) || MAPS[1];
}
