// Posturální profil – end-to-end testy (iPhone-like prostředí v Chromiu)
const {chromium}=require('playwright');
const D=__dirname,OUT=require('path').join(D,'.out');require('fs').mkdirSync(OUT,{recursive:true});
const URL='http://localhost:'+(process.env.PORT||8780)+'/index.html';
const results=[];let browser;
const ok=(name,cond,info='')=>{results.push({name,pass:!!cond,info});console.log((cond?'PASS ':'FAIL ')+name+(info?'  — '+info:''))};

async function newPage(opts={}){
  const ctx=await browser.newContext({viewport:opts.vp||{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true,
    permissions:['camera','clipboard-read','clipboard-write'],acceptDownloads:true});
  const p=await ctx.newPage();p.errs=[];
  p.on('pageerror',e=>p.errs.push('pageerror: '+e.message));
  p.on('console',m=>{if(m.type()==='error'&&!/ERR_TUNNEL|fonts\.g|Failed to load resource/.test(m.text()))p.errs.push('console: '+m.text())});
  if(opts.noShare!==false)await p.addInitScript(()=>{Object.defineProperty(navigator,'canShare',{value:undefined,configurable:true})});
  await p.goto(URL);await p.waitForTimeout(600);
  p.T=(f,...a)=>p.evaluate(([f,a])=>window.__t[f](...a),[f,a]);
  p.vis=id=>p.evaluate(i=>{const e=document.getElementById(i);return !!e&&!e.hidden&&e.offsetParent!==null},id);
  p.hid=id=>p.evaluate(i=>document.getElementById(i).hidden,id);
  p.txt=id=>p.evaluate(i=>document.getElementById(i).textContent,id);
  p.ptr=(type,id,x,y,primary=true)=>p.evaluate(([type,id,x,y,primary])=>{document.getElementById('cv').dispatchEvent(new PointerEvent(type,{pointerId:id,clientX:x,clientY:y,pointerType:'touch',isPrimary:primary,bubbles:true,cancelable:true}))},[type,id,x,y,primary]);
  let pid=100;
  p.drag=async(x0,y0,dx,dy,steps=10)=>{const id=pid++;await p.ptr('pointerdown',id,x0,y0);for(let i=1;i<=steps;i++){await p.ptr('pointermove',id,x0+dx*i/steps,y0+dy*i/steps);await p.waitForTimeout(12)}await p.ptr('pointerup',id,x0+dx,y0+dy)};
  // posun zaměřovače na bod snímku (souřadnice obrazu)
  p.aimTo=async(ix,iy)=>{for(let k=0;k<14;k++){const a=await p.T('aim');const s=await p.T('toScreen',a),t=await p.T('toScreen',{x:ix,y:iy});
      const dx=(t.x-s.x)/3,dy=(t.y-s.y)/3;if(Math.hypot(dx,dy)<6)break;const m=Math.max(Math.abs(dx),Math.abs(dy)),k2=m>150?150/m:1;await p.drag(195,420,dx*k2,dy*k2,Math.hypot(dx,dy)>30?3:8)}};
  p.place=async(ix,iy)=>{await p.aimTo(ix,iy);await p.click('#ok');await p.waitForTimeout(60)};
  return p;
}
// body pro testovací fotku (1440×1920, po případném vyrovnání ~stejné)
const BACK=[[720,520],[560,700],[560,560],[540,950],[720,1290],[900,950],[880,700],[880,560]]; // c7, la, ls, lw, nc, rw, ra, rs
async function loadGallery(p,file='back.jpg'){await p.setInputFiles('#fileLib',D+'/'+file);await p.waitForTimeout(1800)}
async function passLeveling(p){ // projít krok vyrovnání (auto nebo olovnice)
  if(await p.T('levelReview')){await p.click('#ok');await p.waitForTimeout(150)}
  if(await p.T('plumb')){await p.click('#sec');await p.waitForTimeout(150)}
}
async function place8(p){const b=await p.T('base');for(const [x,y] of BACK)await p.place(x*b.w/1440,y*b.h/1920);await p.waitForTimeout(500)}
async function openRes(p){await p.waitForTimeout(150);if(await p.hid('sheet'))await p.click('#ok')}
async function kart(p){if(await p.hid('paneKart')){await p.click('#capKart');await p.waitForTimeout(150)}}
async function home(p){if(!(await p.hid('paneKart'))){await p.click('#kBack');await p.waitForTimeout(150)}}
async function pickNew(p,name,card,file='back.jpg'){await home(p);await p.click('#capNew');await p.waitForTimeout(150);
  if(name)await p.fill('#mfName',name);await p.click('#mfShot [data-m="single"]');
  const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#mfLib')]);await fc.setFiles(D+'/'+file);await p.waitForTimeout(1800)}
async function closeSheetIfOpen(p){if(!(await p.hid('sheet'))){await p.click('#closeSheet');await p.waitForTimeout(150)}}

(async()=>{
  browser=await chromium.launch({args:['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']});
  let p;

  // T1 start
  p=await newPage();
  ok('T1 úvodní obrazovka',!(await p.hid('nophoto'))&&(await p.txt('npVer')).includes('verze'));
  ok('T1 bez chyb při startu',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T2 galerie → 8 bodů → výsledek → export → kopie → úvod
  p=await newPage();
  await p.click('#capNew');await p.waitForTimeout(150);ok('T2 Nový pacient otevře formulář',!(await p.hid('mform')));
  await p.click('#mfLib');await p.waitForTimeout(150);
  ok('T2 bez jména se nepokračuje',!(await p.hid('mform'))&&(await p.txt('mfErr')).length>0);
  await p.click('#mfClose');await p.waitForTimeout(100);
  await pickNew(p,'Novák Jan','1042');await passLeveling(p);
  ok('T2 pacient založen a přiřazen',(await p.T('pats')).length===1&&!!(await p.T('pid')));
  ok('T2 fotka načtena, režim měření',await p.T('src')&&(await p.hid('nophoto')));
  await place8(p);
  ok('T2 všech 8 bodů',(await p.T('hist')).length===8,(await p.T('hist')).join(','));
  await openRes(p);await p.waitForTimeout(400);
  const val=await p.evaluate(()=>document.querySelector('#result .val')&&document.querySelector('#result .val').textContent);
  ok('T2 výsledek zobrazen',!!val,val);
  const warnInvalid=await p.evaluate(()=>!!document.querySelector('#result .warn'));
  ok('T2 body projdou kontrolou správnosti',!warnInvalid,warnInvalid?await p.evaluate(()=>document.querySelector('#result .warn').textContent)+' pts='+JSON.stringify(await p.T('pts')):'');
  await p.waitForTimeout(900);
  ok('T2 měření se samo uložilo do karty',(await p.T('rec'))==='ok'&&(await p.T('meas')).length===1&&(await p.txt('pchip')).includes('Uloženo'),await p.txt('pchip'));
  const [dl]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#expImg')]);
  ok('T2 export fotky (název se jménem)',/POTSI_Nov.k_Jan_\d{4}-\d\d-\d\d\.jpg/.test(dl.suggestedFilename()),dl.suggestedFilename());
  await p.click('#copy');await p.waitForTimeout(300);
  const clip=await p.evaluate(()=>navigator.clipboard.readText().catch(()=>''));
  ok('T2 kopírování textu',clip.startsWith('POTSI'),clip.slice(0,40));
  await p.click('#newM');await p.waitForTimeout(700);
  ok('T2 tlačítko Úvod ve výsledku → úvod',!(await p.hid('nophoto'))&&(await p.hid('sheet'))&&(await p.hid('ask')));
  ok('T2 uložené měření nezůstává ve Fotkách k měření',await p.hid('npQueue'));
  ok('T2 pacient na úvodu s výsledkem',(await p.evaluate(()=>document.querySelector('#npList .prow')?.textContent||'')).includes('Novák Jan'),await p.evaluate(()=>document.querySelector('#npList').textContent));
  await p.reload();await p.waitForTimeout(1200);
  ok('T2 pacient a měření přežijí restart',(await p.T('pats')).length===1&&(await p.T('meas')).length===1);
  // T19 nová fotka nepřebírá jméno
  await loadGallery(p);
  ok('T19 nové měření nepřebírá pacienta',(await p.evaluate(()=>document.getElementById('pname').value))===''&&!(await p.T('pid')));
  ok('T2 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  if(process.env.ONLY_T2){await browser.close();return}
  // T3 úprava bodu, smazání, zrušení; T4 zpět
  p=await newPage();await loadGallery(p);await passLeveling(p);await place8(p);ok('T3 po 8. bodu se výsledek otevře sám',!(await p.hid('sheet')));await closeSheetIfOpen(p);
  const before=(await p.T('pts')).ls;
  await p.click('#chips button:nth-child(3)');await p.waitForTimeout(150);
  ok('T3 výběr bodu dílkem → režim úpravy',(await p.txt('stepName')).startsWith('Úprava'));
  await p.drag(195,420,0,-30);await p.click('#rbtn');await p.waitForTimeout(120);
  const after=(await p.T('pts')).ls;
  ok('T3 zrušení úpravy vrátí bod',Math.abs(after.y-before.y)<0.01&&Math.abs(after.x-before.x)<0.01);
  await p.click('#chips button:nth-child(4)');await p.drag(195,420,0,-20);await p.click('#ok');await p.waitForTimeout(120);
  ok('T3 potvrzení úpravy posune bod',Math.abs((await p.T('pts')).lw.y-BACK[3][1]*(await p.T('base')).h/1920)>1);
  await p.click('#chips button:nth-child(6)');await p.click('#lbtn');await p.waitForTimeout(120);
  ok('T3 smazání bodu',!(await p.T('pts')).rw&&(await p.T('hist')).length===7);
  for(let i=0;i<7;i++){await p.click('#lbtn');await p.waitForTimeout(40)}
  ok('T4 Zpět vrátí všechny body',(await p.T('hist')).length===0);
  ok('T4 Zpět je na začátku neaktivní',await p.evaluate(()=>document.getElementById('lbtn').disabled));
  // T5 přepnutí typu
  await p.place(700,500);await p.click('#typeBtn');await p.click('.topt[data-type="ATSI"]');await p.waitForTimeout(150);
  ok('T5 přepnutí na ATSI smaže body',(await p.T('type'))==='ATSI'&&(await p.T('hist')).length===0);
  // T13 visící prst + pinch + pan
  await p.ptr('pointerdown',900,100,300);const a0=await p.T('aim');await p.drag(195,420,60,30);const a1=await p.T('aim');
  ok('T13 visící prst nezablokuje zaměřovač',Math.hypot(a1.x-a0.x,a1.y-a0.y)>20);
  const v0=await p.T('view');await p.ptr('pointerdown',901,150,400,true);await p.ptr('pointerdown',902,250,400,false);
  for(let i=1;i<=5;i++)await p.ptr('pointermove',902,250+i*15,400,false);
  await p.ptr('pointerup',902,325,400,false);
  const v1=await p.T('view');for(let i=1;i<=5;i++)await p.ptr('pointermove',901,150+i*10,400+i*10,true);await p.ptr('pointerup',901,200,450,true);
  const v2=await p.T('view');
  ok('T13 zoom dvěma prsty',v1.s>v0.s*1.2);ok('T13 posun fotky prstem po zoomu',Math.abs(v2.tx-v1.tx)>20);
  // T14 skrytí ovládání + oko
  await p.click('#rbtn');await p.click('[data-m="min"]');await p.waitForTimeout(150);
  ok('T14 skrytí ovládání',await p.evaluate(()=>document.getElementById('app').classList.contains('min')));
  await p.click('#expand');await p.waitForTimeout(150);
  ok('T14 zobrazení ovládání',!(await p.evaluate(()=>document.getElementById('app').classList.contains('min'))));
  ok('T3–T14 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T15 ruční olovnice
  p=await newPage();await loadGallery(p,'tilted.jpg');
  if(await p.T('levelReview')){await p.click('#sec');await p.waitForTimeout(150)} // Olovnicí ručně
  if(!(await p.T('plumb'))){await p.click('#rbtn');await p.click('[data-m="level"]');await p.waitForTimeout(200);if(await p.T('levelReview')){await p.click('#sec');await p.waitForTimeout(150)}}
  ok('T15 režim olovnice',await p.T('plumb'));
  const b15=await p.T('base');await p.aimTo(207,150);await p.click('#ok');await p.aimTo(207+60,1650);await p.click('#ok');await p.waitForTimeout(300);
  ok('T15 vyrovnání podle olovnice otočí snímek',Math.abs(await p.T('rot'))>0.5&&(await p.T('calib'))==='plumb',`rot=${await p.T('rot')}`);
  ok('T15 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T25 měření s podezřelými body se do karty uloží s příznakem
  p=await newPage();await pickNew(p,'Kontrola Bodů');await passLeveling(p);
  {const b=await p.T('base');for(let i=0;i<8;i++){await p.place(b.w*(0.3+0.05*i),b.h*(0.2+0.07*i))}}
  await p.waitForTimeout(900);await openRes(p);await p.waitForTimeout(300);
  {const m=await p.T('meas');ok('T25 uloženo i s podezřelými body (příznak ke kontrole)',m.length===1&&Array.isArray(m[0].warn)&&(await p.txt('pchip')).includes('ke kontrole'),JSON.stringify(m.map(x=>x.warn)))}
  await p.click('#newM');await p.waitForTimeout(600);
  ok('T25 po návratu nezůstává ve Fotkách k měření',await p.hid('npQueue'));
  ok('T25 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T26 série 3 snímků pro pacienta z formuláře
  p=await newPage();
  await p.click('#capNew');await p.fill('#mfName','Série Test');await p.fill('#mfDob','1984-05-12');await p.click('#mfShot [data-m="series"]');await p.click('#mfGo');await p.waitForTimeout(1500);
  ok('T26 série otevře fotoaparát v režimu série',!(await p.hid('cam'))&&(await p.T('quick')));
  for(let i=0;i<20;i++){await p.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:89,gamma:0})));}
  {const sb=await p.locator('#shutter').boundingBox();for(let i=0;i<3;i++){await p.mouse.click(sb.x+39,sb.y+39);await p.waitForTimeout(450)}}
  await p.waitForTimeout(1800);
  ok('T26 po 3. snímku se fotoaparát sám zavře bez dotazu',(await p.hid('cam'))&&(await p.hid('pick')));
  {const pats=await p.T('pats');ok('T26 pacient s datem narození',pats.length===1&&pats[0].dob==='1984-05-12')}
  ok('T26 lišta Kartotéka ukazuje 3 čekající fotky',(await p.txt('capKart')).includes('3 fotky čekají'),await p.txt('capKart'));
  await p.click('#capKart');await p.waitForTimeout(300);ok('T26 kartotéka má tlačítko Úvod',!(await p.hid('kBack')));
  {const rows=await p.evaluate(()=>[...document.querySelectorAll('#qList .qrow b')].map(e=>e.textContent));ok('T26 3 snímky přiřazené pacientovi',rows.length===3&&rows.every(r=>r.includes('Série Test')),rows.join('|'))}
  await p.click('#qList .qrow:nth-child(1) [data-go]');await p.waitForTimeout(2000);await passLeveling(p);await place8(p);await openRes(p);await p.waitForTimeout(600);
  ok('T26 další krok: změřit další snímek ze série',(await p.txt('nextBox')).includes('další snímek ze série'),await p.txt('nextBox'));
  await p.click('#nxPri');await p.waitForTimeout(2200);
  ok('T26 otevře se další snímek série',(await p.T('src'))&&(await p.T('meas')).length===1&&(await p.T('pid')));
  ok('T26 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T6 přerušení, obnovení po restartu, smazání
  p=await newPage();await loadGallery(p);await passLeveling(p);
  await p.place(720,520);await p.place(560,700);await p.place(560,560);
  await p.click('#rbtn');await p.click('[data-m="pause"]');await p.waitForTimeout(1200);
  ok('T6 přerušit → úvod se seznamem',!(await p.hid('nophoto'))&&(await p.evaluate(()=>document.querySelectorAll('#qList .qrow').length))===1);
  await p.reload();await p.waitForTimeout(1500);
  ok('T6 seznam přežije restart',(await p.evaluate(()=>document.querySelectorAll('#qList .qrow').length))===1);
  await kart(p);await p.click('#qList [data-go]');await p.waitForTimeout(1500);
  ok('T6 pokračování se 3 body',(await p.T('hist')).length===3,(await p.txt('stepName')));
  await p.click('#menuBtn');await p.click('#homeBtn');await p.waitForTimeout(1000);
  await p.click('#qList [data-del]');await p.click('#askYes');await p.waitForTimeout(600);
  ok('T6 smazání ze seznamu',(await p.hid('npQueue')));
  ok('T6 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T7 zásoba: 5 snímků, přepnutí typu, jméno, otevření, změření, export → ze seznamu zmizí
  p=await newPage();
  await p.click('#npQuick');await p.waitForTimeout(1500);
  for(let i=0;i<20;i++){await p.evaluate(()=>window.dispatchEvent(new DeviceOrientationEvent('deviceorientation',{alpha:0,beta:89,gamma:0})));}
  const sb=await p.locator('#shutter').boundingBox();
  for(let i=0;i<5;i++){if(i===3)await p.click('#camType');await p.mouse.click(sb.x+39,sb.y+39);await p.waitForTimeout(450)}
  ok('T7 počítadlo snímků',(await p.txt('camQn')).startsWith('5'),await p.txt('camQn'));
  await p.click('#camClose');await p.waitForTimeout(800);
  ok('T7 dotaz na pacienta',!(await p.hid('pick')));
  await p.click('#pkList [data-newp]');await p.fill('#pkName','Test Zásoba');await p.click('#pkGo');await p.waitForTimeout(700);
  const rows=await p.evaluate(()=>[...document.querySelectorAll('#qList .qrow b')].map(e=>e.textContent));
  ok('T7 5 fotek se jménem a typem',rows.length===5&&rows.every(r=>r.includes('Test Zásoba'))&&rows.filter(r=>r.includes('ATSI')).length===2,rows.join(' | '));
  await kart(p);await p.click('#qList .qrow:nth-child(5) [data-go]');await p.waitForTimeout(2000);
  ok('T7 otevření fotky ze zásoby (vyrovnání senzory)',(await p.T('src'))&&(await p.T('calib'))==='sensor',await p.txt('stepName'));
  await passLeveling(p);
  await place8(p);
  await openRes(p);await p.waitForTimeout(300);
  await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#expImg')]);await p.waitForTimeout(600);
  await p.click('#newM');await p.waitForTimeout(800);
  ok('T7 změřená fotka se uloží do karty a ze seznamu zmizí',(await p.evaluate(()=>document.querySelectorAll('#qList .qrow').length))===4&&(await p.T('meas')).length===1);
  // T9 zrušený výběr z galerie v zásobě → normální fotoaparát pak měří
  await home(p);await p.click('#npQuick');await p.waitForTimeout(1200);
  await p.evaluate(()=>{document.getElementById('camLib').click()});await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('fileQ').dispatchEvent(new Event('cancel')));await p.waitForTimeout(400);
  ok('T9 zrušený výběr ukončí režim zásoby',!(await p.T('quick')));
  if(!(await p.hid('pick')))await p.click('#pkLater');
  await home(p);await p.click('#capNew');await p.fill('#mfName','Kamera Test');await p.click('#mfShot [data-m="single"]');await p.click('#mfGo');await p.waitForTimeout(1500);
  const sb2=await p.locator('#shutter').boundingBox();await p.mouse.click(sb2.x+39,sb2.y+39);await p.waitForTimeout(2000);
  ok('T9 běžný fotoaparát po zásobě vede k měření',(await p.T('src'))&&(await p.hid('cam')));
  ok('T7/T9 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T8 import více fotek z galerie do zásoby
  p=await newPage();await p.click('#npQuick');await p.waitForTimeout(1200);
  await p.evaluate(()=>document.getElementById('cam').hidden=true);
  await p.setInputFiles('#fileQ',[D+'/back.jpg',D+'/tilted.jpg',D+'/back.jpg']);await p.waitForFunction(()=>!document.getElementById('pick').hidden,null,{timeout:8000}).catch(()=>{});
  ok('T8 dotaz na pacienta po importu',!(await p.hid('pick')));await p.click('#pkLater');await p.waitForTimeout(500);
  ok('T8 3 fotky v seznamu',(await p.evaluate(()=>document.querySelectorAll('#qList .qrow').length))===3);
  await kart(p);await p.click('#qList .qrow:nth-child(1) [data-go]');await p.waitForTimeout(2000);
  ok('T8 otevření importované fotky',await p.T('src'));
  ok('T8 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T10 panel: navigace, T11 série, T12 přehled trvale, T16 protokol trvale
  p=await newPage();await loadGallery(p);await passLeveling(p);await place8(p);
  await openRes(p);await p.waitForTimeout(300);
  for(const t of ['result','proto','info']){await p.evaluate(t=>document.querySelector(`.stab[data-t="${t}"]`).click(),t);await p.waitForTimeout(100);
    const homes=await p.evaluate(()=>[...document.querySelectorAll('#homeBtn,#tfHome,#newM')].filter(e=>e.offsetParent!==null).length);
    ok(`T10 karta ${t}: Úvod nahoře + jedno dole`,homes===2,`viditelných: ${homes}`)}
  await p.evaluate(()=>document.querySelector('.stab[data-t="proto"]').click());
  await p.click('label:has(#pr_mark)');await p.click('label:has(#pr_cam)');await p.waitForTimeout(100);
  await p.evaluate(()=>document.querySelector('.stab[data-t="result"]').click());
  await p.click('#addSeries');await p.waitForTimeout(200);await place8(p);await openRes(p);await p.waitForTimeout(300);
  ok('T11 série 2 měření',(await p.evaluate(()=>document.querySelector('#seriesBox .t').textContent)).includes('2 měření'));
  await p.click('#pcChange');await p.waitForTimeout(150);
  ok('T12 Přiřadit otevře výběr',!(await p.hid('pick')));
  await p.click('#pkList [data-newp]');await p.fill('#pkName','Trend Test');await p.click('#pkGo');await p.waitForTimeout(900);
  const m12=await p.T('meas');
  ok('T12 přiřazené měření (série 2) v kartě',m12.length===1&&m12[0].n===2,JSON.stringify(m12.map(m=>[m.n,m.total])));
  await p.click('#closeSheet');await p.click('#rbtn');await p.click('[data-m="new"]');await p.waitForTimeout(600);
  await p.reload();await p.waitForTimeout(1500);
  ok('T12 karta přežije restart',(await p.T('meas')).length===1);
  ok('T16 protokol přežije restart',(await p.txt('tabProto'))==='2/8',await p.txt('tabProto'));
  const pid12=(await p.T('pats'))[0].id;
  await kart(p);await p.click('#npList .prow');await p.waitForTimeout(300);await p.click('#pvFab');await p.waitForTimeout(150);ok('T12 Nové měření z karty má pacienta předvyplněného',(await p.evaluate(()=>document.getElementById('mfName').value))!=='');await p.click('#mfShot [data-m="single"]');
  {const [fc]=await Promise.all([p.waitForEvent('filechooser'),p.click('#mfLib')]);await fc.setFiles(D+'/back.jpg');await p.waitForTimeout(1800)}
  await passLeveling(p);await place8(p);
  await openRes(p);await p.waitForTimeout(900);
  ok('T12 dnešní průměr ze snímků u stejného pacienta',(await p.txt('result')).includes('Dnes 2 snímky'),(await p.txt('result')).slice(0,160));
  ok('T12 navazující měření v kartě',(await p.T('meas')).length===2);
  ok('T24 další krok nabízí 3. snímek',(await p.txt('nextBox')).includes('3. ze 3'),await p.txt('nextBox'));
  await p.click('#closeSheet');await p.waitForTimeout(150);
  ok('T10 ✕ zavře panel',await p.hid('sheet'));
  await p.click('#menuBtn');await p.waitForTimeout(200);await p.click('#nxSum');await p.waitForTimeout(800);
  ok('T24 souhrn vyšetření',!(await p.hid('pv'))&&(await p.evaluate(()=>document.querySelectorAll('#pvB .sumt').length))===1&&(await p.txt('pvB')).includes('průměr 2 snímků')&&!(await p.evaluate(()=>!!document.getElementById('sNext'))));
  ok('T24 po souhrnu nic nezůstává ve Fotkách k měření',await p.hid('npQueue'));
  await p.waitForFunction(()=>{const i=document.getElementById('siPOTSI');return i&&i.naturalWidth>0},null,{timeout:5000});
  await p.click('#pvR');{const [d]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#pvMenu >> text=Uložit souhrn do kartotéky')]);ok('T24 export souhrnu z menu',/^Souhrn_Trend_Test_/.test(d.suggestedFilename()),d.suggestedFilename())}
  // T21 karta pacienta, detail, porovnání
  await p.click('#pvL');await p.waitForTimeout(400);
  ok('T24 Zpět ze souhrnu vede do karty pacienta',!(await p.hid('pv'))&&!!(await p.evaluate(()=>document.getElementById('cdTrend'))));
  ok('T21 karta pacienta: vyšetření s fotkami, vývoj schovaný',(await p.evaluate(()=>document.querySelectorAll('#pvB .exam').length))===1&&(await p.evaluate(()=>document.querySelectorAll('#pvB .ph').length))===2&&(await p.evaluate(()=>document.querySelectorAll('#pvB .tpanel svg').length))===0);
  await p.click('#pvB .ph');await p.waitForTimeout(800);
  ok('T21 fotka přes celou obrazovku',!(await p.hid('vw'))&&await p.evaluate(()=>document.getElementById('vwImg').naturalWidth>100));
  await p.click('#vwTog');ok('T21 podrobnosti se rozbalí',await p.evaluate(()=>document.getElementById('vwInfo').classList.contains('open'))&&(await p.txt('vwInfo')).includes('FAI'));
  await p.click('#vwNext');await p.waitForTimeout(500);ok('T21 přepnutí na další snímek',(await p.txt('vwS')).includes('2/2'),await p.txt('vwS'));
  await p.click('#vwMore');{const [d]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#pvMenu >> text=Uložit fotku s výsledkem')]);ok('T21 export fotky z menu',/POTSI_Trend_Test_/.test(d.suggestedFilename()),d.suggestedFilename())}
  await p.click('#vwBack');await p.waitForTimeout(300);await p.click('#cdTrend');await p.waitForTimeout(300);
  ok('T21 vývoj v samostatném zobrazení',(await p.evaluate(()=>document.querySelectorAll('#pvB .tpanel svg').length))===1);
  await p.click('#pvL');await p.waitForTimeout(200);await p.click('#cdCmp');await p.waitForTimeout(600);
  ok('T21 porovnání',(await p.txt('pvB')).includes('Změna POTSI')&&await p.evaluate(()=>{const i=document.getElementById('ciB');return !!i}));
  {const [d]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#cExp')]);ok('T21 export porovnání',/porovnani/.test(d.suggestedFilename()),d.suggestedFilename())}
  await p.click('#pvL');await p.waitForTimeout(200);
  await p.click('#pvR');await p.click('#pvMenu >> text=Upravit údaje pacienta');await p.fill('#cdName','Trend Testová');await p.fill('#cdCard','77');await p.click('#cdSave');await p.waitForTimeout(200);
  ok('T21 úprava pacienta',(await p.T('pats'))[0].name==='Trend Testová'&&(await p.T('pats'))[0].card==='77');
  // T22 záloha a obnova do čistého telefonu
  await p.click('#pvL');await p.waitForTimeout(200);await p.click('#npBk');await p.click('#hmBk');
  await p.waitForFunction(()=>{const b=document.getElementById('bkGo');return b&&!b.disabled},null,{timeout:8000});
  const [dlb]=await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#bkGo')]);const bkPath=OUT+'/bk.json';await dlb.saveAs(bkPath);
  const bj=JSON.parse(require('fs').readFileSync(bkPath,'utf8'));
  ok('T22 záloha obsahuje pacienty, měření i fotky',bj.patients.length===1&&bj.meas.length===2&&Object.keys(bj.images).length===2);
  ok('T22 datum poslední zálohy',(await p.T('bk')).last>0);
  ok('T10–T22 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();
  p=await newPage();await p.click('#npBk');await p.click('#hmBk');await p.waitForTimeout(400);
  await p.setInputFiles('#fileBk',bkPath);await p.waitForTimeout(1500);
  ok('T22 obnova do prázdného telefonu',(await p.T('pats')).length===1&&(await p.T('meas')).length===2);
  await p.setInputFiles('#fileBk',bkPath);await p.waitForTimeout(1200);
  ok('T22 opakovaná obnova nic nezdvojí',(await p.T('pats')).length===1&&(await p.T('meas')).length===2);
  await p.click('#pvL');await kart(p);await p.click('#npList .prow');await p.click('#pvB .ph');await p.waitForTimeout(800);
  ok('T22 fotka po obnově',await p.evaluate(()=>document.getElementById('vwImg').naturalWidth>100));
  await p.click('#vwMore');await p.click('#pvMenu >> text=Smazat snímek');await p.click('#askYes');await p.waitForTimeout(400);
  ok('T23 smazání snímku',(await p.T('meas')).length===1&&!(await p.hid('vw')));
  await p.click('#vwBack');await p.waitForTimeout(300);
  await p.click('#pvR');await p.click('#pvMenu >> text=Smazat pacienta');await p.click('#askYes');await p.waitForTimeout(400);
  ok('T23 smazání pacienta',(await p.T('pats')).length===0&&(await p.T('meas')).length===0&&(await p.hid('pv')));
  ok('T22–T23 bez chyb',p.errs.length===0,p.errs.join(' | '));
  await p.context().close();

  // T17 aktualizace: během focení nenačítat, na úvodu ano
  p=await newPage();
  await p.route(/\?nc=/,async r=>{const resp=await r.fetch();let t=await resp.text();t=t.replace(/const APP_VER='[0-9.]+'/,"const APP_VER='9.99'");r.fulfill({response:resp,body:t})});
  await p.click('#npQuick');await p.waitForTimeout(1200);
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(2000);
  ok('T17 při otevřeném fotoaparátu se neaktualizuje',!p.url().includes('?v='));
  await p.click('#camClose');await p.waitForTimeout(400);
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await p.waitForTimeout(2000);
  ok('T17 v klidu na úvodu se aktualizuje',p.url().includes('?v=9.99'),p.url());
  await p.context().close();

  // T20 velikosti displeje
  for(const vp of [{width:375,height:667},{width:430,height:932}]){
    p=await newPage({vp});await loadGallery(p);await passLeveling(p);
    const inView=await p.evaluate(()=>['ok','lbtn','rbtn','menuBtn','typeBtn'].every(id=>{const r=document.getElementById(id).getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&r.left>=0&&r.right<=innerWidth}));
    ok(`T20 ovládání na displeji ${vp.width}×${vp.height}`,inView);
    await p.click('#menuBtn');await p.waitForTimeout(150);
    const hb=await p.evaluate(()=>{const r=document.getElementById('homeBtn').getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight});
    ok(`T20 tlačítko Úvod v panelu ${vp.width}×${vp.height}`,hb);
    await p.context().close();
  }

  // T18 zátěž: 12 cyklů měření + 3 dávky zásoby
  p=await newPage();const heap0=await p.evaluate(()=>performance.memory?performance.memory.usedJSHeapSize:0);
  for(let c=0;c<12;c++){await loadGallery(p,c%2?'tilted.jpg':'back.jpg');await passLeveling(p);
    const b=await p.T('base');for(let i=0;i<8;i++){await p.place(b.w*(0.3+0.05*i),b.h*(0.2+0.07*i))}
    await p.click('#ok');await p.waitForTimeout(150);await Promise.all([p.waitForEvent('download',{timeout:8000}),p.click('#expImg')]);
    await p.click('#newM');await p.waitForTimeout(300)}
  for(let q=0;q<3;q++){await p.click('#npQuick');await p.waitForTimeout(1200);const sb=await p.locator('#shutter').boundingBox();
    for(let i=0;i<6;i++){await p.mouse.click(sb.x+39,sb.y+39);await p.waitForTimeout(400)}
    await p.click('#camClose');await p.waitForTimeout(700);await p.click('#pkLater');await p.waitForTimeout(300)}
  await p.evaluate(()=>{if(window.gc)window.gc()});await p.waitForTimeout(500);
  const heap1=await p.evaluate(()=>performance.memory?performance.memory.usedJSHeapSize:0);
  await p.waitForFunction(()=>document.querySelectorAll('#qList .qrow').length>=30,null,{timeout:6000}).catch(()=>{});
  const qn=await p.evaluate(()=>document.querySelectorAll('#qList .qrow').length);
  ok('T18 zátěž: 12 měření (bez pacienta zůstávají ve Fotkách k měření) + 18 snímků bez chyb',p.errs.length===0&&qn===30,`fronta ${qn}, heap ${(heap0/1e6).toFixed(1)}→${(heap1/1e6).toFixed(1)} MB; ${p.errs.join(' | ')}`);
  await p.context().close();

  await browser.close();
  const f=results.filter(r=>!r.pass);
  console.log(`\n${results.length-f.length}/${results.length} prošlo`);if(f.length)console.log('NEPROŠLO:\n'+f.map(r=>' - '+r.name+' '+r.info).join('\n'));
})().catch(e=>{console.error('TEST CRASH',e);process.exit(1)});
