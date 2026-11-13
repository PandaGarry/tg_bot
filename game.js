(() => {
const canvas=document.getElementById('world'),ctx=canvas.getContext('2d');
const W=1440,H=900,cols=27,rows=22,tw=56,th=28,ox=720,oy=65;
let mode='move',player={x:13.2,y:15.3},target=null,toastTimer,selected=null,progress=0;
const objects=[
 {id:'inn',x:11,y:8,type:'inn',name:'Постоялый двор «У трёх сосен»',desc:'Небольшой двор для путников. Хозяйка обещает горячую еду и сухую постель.'},
 {id:'hall',x:17,y:7,type:'hall',name:'Дом старосты',desc:'Здесь решают споры, распределяют работу и хранят вести о дальних землях.'},
 {id:'smith',x:19,y:12,type:'smith',name:'Кузница',desc:'Из трубы тянется дым. Кузнец чинит инструменты и подковывает коней.'},
 {id:'well',x:14,y:12,type:'well',name:'Старый колодец',desc:'Каменный колодец на маленькой площади. Вода холодная и чистая.'},
 {id:'farm',x:7,y:12,type:'farm',name:'Огород',desc:'Грядки с капустой и луком. Урожай пока скромный.'},
 {id:'guard',x:21,y:9,type:'npc',name:'Стражник',desc:'«Дорога на север пока спокойна. Но ночью в лесу кто-то ходит».',npc:true},
 {id:'mira',x:12,y:11,type:'npc',name:'Мира, хозяйка двора',desc:'«Ты не первый, кого принесло сюда издалека. Но каждый приходит со своей историей».',npc:true},
 {id:'wood',x:5,y:17,type:'tree',name:'Старая сосна',desc:'Сухие ветви можно собрать на растопку.',resource:'wood'},
 {id:'stone',x:23,y:16,type:'rock',name:'Выступ скалы',desc:'Крепкий камень. Пригодится для строительства.',resource:'stone'}
];
let seed=4817;const rnd=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296};
const terrain=[];
for(let y=0;y<rows;y++){terrain[y]=[];for(let x=0;x<cols;x++){let edge=Math.min(x,y,cols-1-x,rows-1-y);let v=rnd();terrain[y][x]=edge<1?'water':(v>.89?'stone':v>.76?'flowers':'grass');}}
function iso(x,y){return {x:ox+(x-y)*tw/2,y:oy+(x+y)*th/2};}
function poly(points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
function tile(x,y,type){const p=iso(x,y),v=type==='grass'?'#71875a':type==='flowers'?'#7f8d59':type==='stone'?'#777d69':'#527e7b';poly([{x:p.x,y:p.y},{x:p.x+tw/2,y:p.y+th/2},{x:p.x,y:p.y+th},{x:p.x-tw/2,y:p.y+th/2}],v,'#344b3b55');if(type==='flowers'){for(let i=0;i<3;i++){ctx.fillStyle=i%2?'#e3c17b':'#e8d9a1';ctx.fillRect(p.x-12+i*9,p.y+18+(i%2)*4,3,3)}}if(type==='stone'){ctx.fillStyle='#a6a58a';ctx.fillRect(p.x-8,p.y+17,5,3)}if(type==='water'){ctx.strokeStyle='#9dc4b288';ctx.beginPath();ctx.moveTo(p.x-15,p.y+18);ctx.lineTo(p.x+6,p.y+29);ctx.stroke()}}
function shadow(x,y,rx,ry=rx*.38){ctx.fillStyle='#17251f66';ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fill()}
function tree(x,y,big=false){const p=iso(x,y);shadow(p.x,p.y+4,24);ctx.fillStyle='#654e37';ctx.fillRect(p.x-4,p.y-35,8,38);for(let i=0;i<3;i++){ctx.fillStyle=['#36563b','#416943','#52794b'][i];ctx.beginPath();ctx.moveTo(p.x,p.y-94+i*22);ctx.lineTo(p.x-27+i*4,p.y-48+i*20);ctx.lineTo(p.x+28-i*4,p.y-48+i*20);ctx.closePath();ctx.fill()}ctx.fillStyle='#82915a';ctx.fillRect(p.x-10,p.y-69,5,5)}
function rock(x,y){const p=iso(x,y);shadow(p.x,p.y+2,22);poly([{x:p.x-20,y:p.y-2},{x:p.x-13,y:p.y-23},{x:p.x+3,y:p.y-31},{x:p.x+20,y:p.y-13},{x:p.x+18,y:p.y+1}], '#777d70','#4d5a4e');poly([{x:p.x-13,y:p.y-23},{x:p.x+3,y:p.y-31},{x:p.x+5,y:p.y-13},{x:p.x-7,y:p.y-10}], '#a2a28c')}
function building(o){const p=iso(o.x,o.y);shadow(p.x,p.y+10,48);let w=o.type==='hall'?58:48,h=o.type==='hall'?40:34;poly([{x:p.x-w/2,y:p.y-h},{x:p.x,y:p.y-h-26},{x:p.x+w/2,y:p.y-h},{x:p.x+w/2,y:p.y+8},{x:p.x-w/2,y:p.y+8}],o.type==='smith'?'#87745c':'#a38b68','#4b4637');poly([{x:p.x-w/2-7,y:p.y-h},{x:p.x,y:p.y-h-36},{x:p.x+w/2+7,y:p.y-h}],o.type==='smith'?'#4d5148':'#704b3b','#453b30');poly([{x:p.x-w/2,y:p.y-h},{x:p.x,y:p.y-h-26},{x:p.x,y:p.y+8},{x:p.x-w/2,y:p.y+8}], '#b39a72');ctx.fillStyle='#493d30';ctx.fillRect(p.x-7,p.y-22,14,30);ctx.fillStyle='#d5bd86';ctx.fillRect(p.x-24,p.y-22,9,10);ctx.fillRect(p.x+15,p.y-22,9,10);ctx.fillStyle='#e6c68a';ctx.fillRect(p.x-23,p.y-21,7,2);ctx.fillRect(p.x+16,p.y-21,7,2);if(o.type==='smith'){ctx.fillStyle='#55534a';ctx.fillRect(p.x+28,p.y-57,10,25);ctx.fillStyle='#a3a08a';ctx.fillRect(p.x+27,p.y-59,12,4)}}
function fence(x1,y1,x2,y2){const a=iso(x1,y1),b=iso(x2,y2);ctx.strokeStyle='#604c35';ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();ctx.lineWidth=2;for(let t=0;t<=1;t+=.13){let x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t;ctx.beginPath();ctx.moveTo(x,y-17);ctx.lineTo(x,y+2);ctx.stroke()}}
function npc(o){const p=iso(o.x,o.y);shadow(p.x,p.y+3,13);ctx.fillStyle=o.id==='guard'?'#6d786d':'#b28c62';ctx.beginPath();ctx.arc(p.x,p.y-23,8,0,Math.PI*2);ctx.fill();ctx.fillStyle=o.id==='guard'?'#4a5c58':'#7d5141';ctx.fillRect(p.x-8,p.y-16,16,21);ctx.fillStyle='#d7c39a';ctx.fillRect(p.x-4,p.y-7,8,12)}
function drawPlayer(){const p=iso(player.x,player.y);shadow(p.x,p.y+3,15);ctx.fillStyle='#d2b88b';ctx.beginPath();ctx.arc(p.x,p.y-27,9,0,Math.PI*2);ctx.fill();ctx.fillStyle='#3d5260';ctx.fillRect(p.x-9,p.y-19,18,24);ctx.fillStyle='#8b6749';ctx.fillRect(p.x-8,p.y+3,6,8);ctx.fillRect(p.x+2,p.y+3,6,8);ctx.fillStyle='#e3d3ae';ctx.fillRect(p.x-3,p.y-17,6,12);if(target){ctx.strokeStyle='#f0d28c';ctx.beginPath();ctx.arc(p.x,p.y+1,16,0,Math.PI*2);ctx.stroke()}}
function draw(){ctx.clearRect(0,0,W,H);let g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,'#9eaa83');g.addColorStop(1,'#647c58');ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
for(let y=0;y<rows;y++)for(let x=0;x<cols;x++)tile(x,y,terrain[y][x]);
// Clearing and winding dirt paths
ctx.strokeStyle='#a38a62';ctx.lineWidth=28;ctx.lineCap='round';ctx.beginPath();let path=[[2,16],[6,15],[9,13],[12,12],[15,11],[18,10],[22,9],[25,8]];path.forEach(([x,y],i)=>{let p=iso(x,y);i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y)});ctx.stroke();ctx.strokeStyle='#c0a47a';ctx.lineWidth=2;ctx.stroke();
fence(8,6,21,6);fence(8,6,8,14);fence(21,6,21,14);fence(8,14,10,14);fence(18,14,21,14);
for(let i=0;i<26;i++){let x=(i*7+3)%cols,y=(i*11+17)%rows;if(terrain[y][x]==='grass'&&!(x>7&&x<22&&y>5&&y<15)&&rnd()>.35)tree(x,y)}
for(const o of objects.filter(o=>['tree','rock'].includes(o.type)))o.type==='tree'?tree(o.x,o.y,true):rock(o.x,o.y);
for(const o of objects.filter(o=>!['tree','rock','npc'].includes(o.type)))building(o);
for(const o of objects.filter(o=>o.npc))npc(o);
drawPlayer();
if(selected){let p=iso(selected.x,selected.y);ctx.strokeStyle='#f4d99c';ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(p.x,p.y+1,32,13,0,0,Math.PI*2);ctx.stroke()}
}
function showToast(s){let el=document.getElementById('toast');el.textContent=s;el.classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>el.classList.remove('show'),2400)}
function nearestObject(x,y){return objects.find(o=>Math.abs(o.x-x)<.7&&Math.abs(o.y-y)<.7)}
function selectObject(o){selected=o;draw();if(o.npc){showToast(o.name+': '+o.desc);progress=Math.min(2,progress+1)}else if(o.resource&&mode==='gather'){showToast('Собрано: '+(o.resource==='wood'?'древесина':'камень'));o.gathered=true;progress=Math.min(2,progress+1)}else showToast(o.name+' — '+o.desc);document.querySelector('.progress i').style.width=(progress*50)+'%';document.querySelector('.quest small:last-child').textContent=progress+' / 2 ДЕЙСТВИЯ'}
function pointFromEvent(e){const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width*W,y:(e.clientY-r.top)/r.height*H}}
canvas.addEventListener('click',e=>{let q=pointFromEvent(e),best=null,dist=1e9;for(const o of objects){let p=iso(o.x,o.y),d=Math.hypot(p.x-q.x,p.y-q.y);if(d<42&&d<dist){best=o;dist=d}}if(best){selectObject(best);return}let dx=q.x-ox,dy=q.y-oy;let gx=(dx/tw+dy/th)/2,gy=(dy/th-dx/tw)/2;target={x:Math.max(1,Math.min(cols-2,gx)),y:Math.max(1,Math.min(rows-2,gy))};showToast('Идём к отмеченному месту')});
function move(dx,dy){player.x=Math.max(1,Math.min(cols-2,player.x+dx));player.y=Math.max(1,Math.min(rows-2,player.y+dy));target=null;draw()}
window.addEventListener('keydown',e=>{let k=e.key.toLowerCase();if(['w','arrowup'].includes(k))move(0,-.5);else if(['s','arrowdown'].includes(k))move(0,.5);else if(['a','arrowleft'].includes(k))move(-.5,0);else if(['d','arrowright'].includes(k))move(.5,0)});
document.querySelectorAll('.action').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('.action').forEach(x=>x.classList.remove('active'));b.classList.add('active');mode=b.dataset.action;if(mode==='journal')showToast('Журнал путника: «Следы новой жизни»');else showToast(({move:'Режим движения',inspect:'Режим осмотра: выберите объект',gather:'Режим сбора: найдите полезные ресурсы'})[mode])}));
document.getElementById('helpBtn').onclick=()=>document.getElementById('modal').classList.remove('hidden');document.getElementById('closeModal').onclick=()=>document.getElementById('modal').classList.add('hidden');document.getElementById('startBtn').onclick=()=>document.getElementById('modal').classList.add('hidden');
let last=0;function loop(t){if(target&&t-last>55){let dx=target.x-player.x,dy=target.y-player.y,d=Math.hypot(dx,dy);if(d<.16)target=null;else{player.x+=dx/d*.09;player.y+=dy/d*.09;draw()}last=t}requestAnimationFrame(loop)}
draw();requestAnimationFrame(loop);if(matchMedia('(max-width:700px)').matches)document.getElementById('modal').classList.add('hidden');else document.getElementById('modal').classList.remove('hidden');
})();