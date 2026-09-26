/* ===== CORREIO, MOEDAS E LOJA — mensagens do jogo, economia de moedas, cosméticos ===== */
// ---- Correio (mensagens de atualização do jogo) ----
// Edite este array para publicar novas mensagens. "id" precisa ser único.
const MAIL_MESSAGES=[
  {id:'m1',title:'Bem-vindo!',date:'22/09/2026',body:'Obrigado por jogar. Fique de olho aqui para novidades e atualizações do jogo.'}
];
function readMailIds(){try{return JSON.parse(localStorage.getItem('chroma-mail-read')||'[]');}catch(e){return [];}}
function writeMailIds(ids){try{localStorage.setItem('chroma-mail-read',JSON.stringify(ids));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}

// ---- moedas & recompensa de login diário ----
const DAILY_REWARD_AMOUNTS=[10,10,15,15,20,20,50];
function todayKey(){const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');}
function readCoins(){try{return parseInt(localStorage.getItem('chroma-coins')||'0',10)||0;}catch(e){return 0;}}
function writeCoins(n){try{localStorage.setItem('chroma-coins',String(n));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function readStreak(){try{return JSON.parse(localStorage.getItem('chroma-daily-streak')||'{"day":0,"lastClaim":null}');}catch(e){return {day:0,lastClaim:null};}}
function writeStreak(s){try{localStorage.setItem('chroma-daily-streak',JSON.stringify(s));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function daysBetween(a,b){return Math.round((new Date(b)-new Date(a))/86400000);}
function updateCoinHud(bump){const el=$('#coinAmt');if(el)el.textContent=readCoins();if(bump){const hud=$('#coinHud');if(hud){hud.classList.remove('bump');void hud.offsetWidth;hud.classList.add('bump');}}}


// ---- loja: cosméticos locais e baús de roleta ----
const SHOP_ITEMS=[
 {id:'frame-gold',rarity:'Épico',type:'profile',name:'Moldura Dourada',desc:'Um aro dourado envolve sua foto de perfil.',image:'Link da imagem aqui',price:180,css:'profile-frame-gold'},
 {id:'frame-neon',rarity:'Comum',type:'profile',name:'Moldura Neon',desc:'Brilho ciano elétrico para seu avatar.',image:'Link da imagem aqui',price:160,css:'profile-frame-neon'},
 {id:'frame-void',rarity:'Raro',type:'profile',name:'Moldura Vazio',desc:'Um halo roxo inspirado no caos.',image:'Link da imagem aqui',price:220,css:'profile-frame-void'},
 {id:'card-neon',rarity:'Comum',type:'cards',name:'Cartas Neon',desc:'Contornos luminosos para suas cartas cosméticas.',image:'Link da imagem aqui',price:140,css:'card-skin-neon'},
 {id:'card-gold',rarity:'Épico',type:'cards',name:'Cartas Douradas',desc:'Borda dourada e brilho de raridade.',image:'Link da imagem aqui',price:200,css:'card-skin-gold'},
 {id:'card-diamond',rarity:'Mítico',type:'cards',name:'Cartas Diamante',desc:'Contorno cristalino sem cobrir a cor original da carta.',image:'Link da imagem aqui',price:240,css:'card-skin-diamond'},
 {id:'frame-fire',rarity:'Raro',type:'profile',name:'Moldura Fogo',desc:'Aro em chamas laranja e vermelho.',image:'Link da imagem aqui',price:190,css:'profile-frame-fire'},
 {id:'frame-ice',rarity:'Incomum',type:'profile',name:'Moldura Gelo',desc:'Brilho azul-claro congelante.',image:'Link da imagem aqui',price:170,css:'profile-frame-ice'},
 {id:'frame-forest',rarity:'Comum',type:'profile',name:'Moldura Floresta',desc:'Verde profundo com brilho natural.',image:'Link da imagem aqui',price:170,css:'profile-frame-forest'},
 {id:'frame-royal',rarity:'Lendário',type:'profile',name:'Moldura Real',desc:'As quatro cores clássicas em um único aro lendário.',image:'Link da imagem aqui',price:280,css:'profile-frame-royal'},
 {id:'frame-mitico',rarity:'Mítico',type:'profile',name:'Moldura Presa Ígnea',desc:'Um anel de garras flamejantes com um rastro de luz que percorre a moldura.',image:'FRAME-MITICO-GARRAS.png',price:340,css:'profile-frame-mitico'},
 {id:'frame-mitico-ouroboros',rarity:'Mítico',type:'profile',name:'Moldura Ouroboros Flamejante',desc:'Um dragão ancestral devora a própria cauda em um anel de lava, com um rastro de luz percorrendo o metal.',image:'FRAME-MITICO-OUROBOROS.png',price:340,css:'profile-frame-mitico-ouroboros'},
 {id:'frame-mitico-chamas',rarity:'Mítico',type:'profile',name:'Moldura Círculo de Chamas',desc:'Um anel de fogo vivo envolve seu avatar, com o mesmo rastro de luz da Presa Ígnea percorrendo as chamas.',image:'FRAME-MITICO-CHAMAS.png',price:340,css:'profile-frame-mitico-chamas'},
 {id:'theme-aurora',rarity:'Raro',type:'profile-theme',name:'Banner Aurora',desc:'Um banner colorido com brilho de aurora para o seu perfil.',image:'Link da imagem aqui',price:220,css:'profile-theme-aurora'},
 {id:'theme-nebula',rarity:'Épico',type:'profile-theme',name:'Banner Nebulosa',desc:'Um céu profundo com estrelas e energia cósmica.',image:'Link da imagem aqui',price:260,css:'profile-theme-nebula'},
 {id:'theme-flame',rarity:'Mítico',type:'profile-theme',name:'Banner Ígneo',desc:'Fogo suave e luminoso inspirado na Presa Ígnea.',image:'Link da imagem aqui',price:320,css:'profile-theme-flame'},
 {id:'badge-crown',rarity:'Lendário',type:'profile-badge',name:'Distintivo Coroa',desc:'Uma coroa dourada aparece no seu cartão de perfil.',image:'Link da imagem aqui',price:300,css:'profile-badge-crown',symbol:'♛'},
 {id:'badge-star',rarity:'Épico',type:'profile-badge',name:'Distintivo Estrela',desc:'Uma estrela brilhante identifica seu perfil.',image:'Link da imagem aqui',price:200,css:'profile-badge-star',symbol:'☆'},
 {id:'badge-bolt',rarity:'Raro',type:'profile-badge',name:'Distintivo Raio',desc:'Um raio elétrico para destacar seu perfil.',image:'Link da imagem aqui',price:160,css:'profile-badge-bolt',symbol:'ϟ'},
 {id:'name-gold',rarity:'Épico',type:'name-effect',name:'Nome Dourado',desc:'Seu nome ganha um contorno dourado elegante.',image:'Link da imagem aqui',price:180,css:'name-effect-gold'},
 {id:'name-diamond',rarity:'Mítico',type:'name-effect',name:'Nome Diamante',desc:'Um contorno cristalino destaca seu nome na partida.',image:'Link da imagem aqui',price:240,css:'name-effect-diamond'},
 {id:'name-flame',rarity:'Mítico',type:'name-effect',name:'Nome Flamejante',desc:'Contorno de fogo com um suave rastro de luz, inspirado na Presa Ígnea.',image:'Link da imagem aqui',price:280,css:'name-effect-flame'},
 {id:'name-ice',rarity:'Raro',type:'name-effect',name:'Nome Gelo',desc:'Contorno azul-gelo com um brilho cristalino que percorre seu nome.',image:'Link da imagem aqui',price:200,css:'name-effect-ice'},
 {id:'card-fire',rarity:'Incomum',type:'cards',name:'Cartas Fogo',desc:'Contraste intenso e brilho vermelho-alaranjado.',image:'Link da imagem aqui',price:150,css:'card-skin-fire'},
 {id:'card-ice',rarity:'Incomum',type:'cards',name:'Cartas Gelo',desc:'Borda cristalina preservando o preenchimento original.',image:'Link da imagem aqui',price:150,css:'card-skin-ice'},
 {id:'card-shadow',rarity:'Épico',type:'cards',name:'Cartas Sombra',desc:'Contorno roxo místico preservando a carta.',image:'Link da imagem aqui',price:180,css:'card-skin-shadow'},
 {id:'card-royal',rarity:'Lendário',type:'cards',name:'Cartas Reais',desc:'Contorno dourado com cantos retos, sem alterar o card.',image:'Link da imagem aqui',price:260,css:'card-skin-royal'},
 {id:'card-aurora',rarity:'Raro',type:'cards',name:'Cartas Aurora',desc:'Skin rara exclusiva da recompensa do nível 10.',image:'Link da imagem aqui',price:0,css:'card-skin-aurora',levelOnly:10},
 {id:'card-constelacao',rarity:'Mítico',type:'cards',name:'Cartas Constelação',desc:'Skin mítica premium: brilho pulsante, estrelas cintilantes nos cantos e números em fonte élfica exclusiva.',image:'Link da imagem aqui',price:320,css:'card-skin-constelacao'},
 {id:'chest-simple',type:'chests',name:'Baú Simples',desc:'Recompensas básicas para começar sua coleção.',image:'BAU-SIMPLES.png',price:60,chest:'simple'},
 {id:'chest-common',type:'chests',name:'Baú Brilhante',desc:'Roleta com cosméticos e poções.',image:'BAU-BRILHANTE.png',price:120,chest:'common'},
 {id:'chest-royal',type:'chests',name:'Baú Real',desc:'Mais chances de recompensas raras.',image:'BAU-REAL.png',price:300,chest:'royal'}
];
const CHEST_PRIZES={simple:[
 {id:'coins-20',name:'20 moedas',image:'BAU-SIMPLES.png',kind:'coins',amount:20,weight:30},{id:'coins-40',name:'40 moedas',image:'BAU-SIMPLES.png',kind:'coins',amount:40,weight:25},{id:'xp-potion',name:'Poção 2× XP · 15 min',image:'BAU-SIMPLES.png',kind:'potion',amount:15,weight:15},{id:'frame-neon',name:'Moldura Neon',image:'Link da imagem aqui',kind:'item',weight:8},{id:'card-neon',name:'Cartas Neon',image:'Link da imagem aqui',kind:'item',weight:7},{id:'coins-80',name:'80 moedas',image:'BAU-SIMPLES.png',kind:'coins',amount:80,weight:15}],common:[
 {id:'coins-60',name:'60 moedas',image:'Link da imagem aqui',kind:'coins',amount:60,weight:30},{id:'xp-potion',name:'Poção 2× XP · 30 min',image:'Link da imagem aqui',kind:'potion',amount:30,weight:22},{id:'frame-neon',name:'Moldura Neon',image:'Link da imagem aqui',kind:'item',weight:9},{id:'card-neon',name:'Cartas Neon',image:'Link da imagem aqui',kind:'item',weight:9},{id:'frame-ice',name:'Moldura Gelo',image:'Link da imagem aqui',kind:'item',weight:8},{id:'frame-forest',name:'Moldura Floresta',image:'Link da imagem aqui',kind:'item',weight:8},{id:'card-fire',name:'Cartas Fogo',image:'Link da imagem aqui',kind:'item',weight:6},{id:'coins-150',name:'150 moedas',image:'Link da imagem aqui',kind:'coins',amount:150,weight:8}],royal:[
 {id:'coins-250',name:'250 moedas',image:'Link da imagem aqui',kind:'coins',amount:250,weight:20},{id:'xp-potion',name:'Poção 2× XP · 30 min',image:'Link da imagem aqui',kind:'potion',amount:30,weight:16},{id:'frame-gold',name:'Moldura Dourada',image:'Link da imagem aqui',kind:'item',weight:14},{id:'card-gold',name:'Cartas Douradas',image:'Link da imagem aqui',kind:'item',weight:12},{id:'card-diamond',name:'Cartas Diamante',image:'Link da imagem aqui',kind:'item',weight:8},{id:'frame-fire',name:'Moldura Fogo',image:'Link da imagem aqui',kind:'item',weight:10},{id:'card-shadow',name:'Cartas Sombra',image:'Link da imagem aqui',kind:'item',weight:10},{id:'frame-royal',name:'Moldura Real',image:'Link da imagem aqui',kind:'item',weight:6},{id:'card-royal',name:'Cartas Reais',image:'Link da imagem aqui',kind:'item',weight:4}]};
function readShop(){try{const x=JSON.parse(localStorage.getItem('chroma-shop')||'{"owned":[],"equipped":{"profile":"","cards":"","name-effect":""},"potions":[]}');x.equipped=x.equipped||{};if(x.equipped['name-effect']==null)x.equipped['name-effect']='';return x;}catch(e){return{owned:[],equipped:{profile:'',cards:'','name-effect':''},potions:[]}}}
function writeShop(x){try{localStorage.setItem('chroma-shop',JSON.stringify(x));}catch(e){}window.dispatchEvent(new Event('chroma-state-changed'));}
function ownedShop(id){return readShop().owned.includes(id)}
function grantPrize(prize){const st=readShop();if(prize.kind==='coins'){writeCoins(readCoins()+prize.amount);updateCoinHud(true);return '+'+prize.amount+' moedas';}if(prize.kind==='potion'){st.potions=st.potions||[];st.potions.push({id:'xp2',minutes:prize.amount||30,receivedAt:Date.now()});writeShop(st);return 'Poção 2× XP por '+(prize.amount||30)+' minutos guardada no Inventário';}if(!st.owned.includes(prize.id))st.owned.push(prize.id);writeShop(st);return prize.name+' desbloqueado';}
function buyShop(id){const item=SHOP_ITEMS.find(x=>x.id===id);if(!item)return;const st=readShop();if(item.levelOnly&&levelFromXP(readXP())<item.levelOnly&&!st.owned.includes(id)){toast('Alcance o nível '+item.levelOnly+' para desbloquear este item');return;}if(item.chest){if(readCoins()<item.price){toast('Moedas insuficientes');return;}writeCoins(readCoins()-item.price);updateCoinHud(true);openRoulette(item);return;}if(st.owned.includes(id)){equipShop(id);return;}if(readCoins()<item.price){toast('Moedas insuficientes');return;}writeCoins(readCoins()-item.price);st.owned.push(id);writeShop(st);updateCoinHud(true);toast(item.name+' comprado!');renderShop();applyCosmetics();}
function equipShop(id){const item=SHOP_ITEMS.find(x=>x.id===id),st=readShop();if(!item)return;st.equipped[item.type]=st.equipped[item.type]===id?'':id;writeShop(st);toast(st.equipped[item.type]?'Equipado: '+item.name:'Desequipado');renderShop();applyCosmetics();}
function shopPreviewMarkup(x){
  if(x.image&&x.image!=='Link da imagem aqui')return '<img src="'+esc(x.image)+'" alt="Preview de '+esc(x.name)+'">';
  if(x.type==='name-effect')return '<span class="preview-name '+esc(x.css)+'">Jogador</span>';
  if(x.type==='profile-theme')return '<span class="preview-banner '+esc(x.css)+'"><b>Meu perfil</b></span>';
  if(x.type==='profile-badge')return '<span class="preview-badge '+esc(x.css)+'">'+esc(x.symbol||'')+'</span>';
  if(x.type==='cards')return '<div class="card preview-card c-b '+esc(x.css)+'"><span class="cn tl">7</span><div class="mid">7</div><span class="cn br">7</span></div>';
  if(x.type==='profile'){
    const wrap=IMAGE_FRAME_WRAPS[x.css]||'';
    return '<span class="preview-frame-wrap '+wrap+'"><span class="preview-avatar '+esc(x.css)+'">A</span></span>';
  }
  return '<span class="preview-fallback">'+esc(x.name)+'</span>';
}
 function renderShop(filter='all'){const grid=$('#shopGrid');if(!grid)return;const st=readShop(),level=levelFromXP(readXP());$('#shopCoins').textContent=readCoins();const items=SHOP_ITEMS.filter(x=>x.type!=='profile-badge'&&(filter==='all'||(filter==='profile'?['profile','profile-theme'].includes(x.type):x.type===filter)));grid.innerHTML=items.map(x=>{const own=st.owned.includes(x.id),locked=x.levelOnly&&level<x.levelOnly&&!own;const rarSlug=x.rarity?x.rarity.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace('é','e'):'';const glowCls=['mitico','lendario','epico'].includes(rarSlug)?' rc-'+rarSlug:'';return '<article class="shop-item '+(own?'owned ':'')+(locked?'item-locked':'')+glowCls+'"><div class="item-art '+(x.css||'')+'">'+shopPreviewMarkup(x)+'</div>'+(own?'<span class="item-owned">DESBLOQUEADO</span>':'')+(x.rarity?'<span class="rarity-tag rarity-'+rarSlug+'">'+x.rarity+'</span>':'')+'<b>'+x.name+'</b><small>'+x.desc+'</small><span class="item-price">'+(locked?'Nível '+x.levelOnly:own?'':x.price)+'</span>'+(own?'<span class="shop-inventory-hint">Equipe pelo Inventário</span>':'<button data-shop-buy="'+x.id+'" '+(locked?'disabled':'')+'>'+(locked?'Bloqueado':'Comprar')+'</button>')+'</article>';}).join('');}
function openRoulette(item){const ov=$('#rouletteOv'),track=$('#rouletteTrack'),result=$('#rouletteResult');const prizes=CHEST_PRIZES[item.chest];const weighted=[];prizes.forEach(x=>{for(let i=0;i<x.weight;i++)weighted.push(x)});const win=weighted[Math.floor(Math.random()*weighted.length)];const sequence=[];for(let i=0;i<26;i++)sequence.push(prizes[Math.floor(Math.random()*prizes.length)]);sequence[21]=win;track.innerHTML=sequence.map(x=>'<div class="roulette-prize"><strong><img src="'+x.image+'" alt="Imagem da recompensa" onerror="this.remove()"></strong><span>'+x.name+'</span></div>').join('');track.style.transition='none';track.style.transform='translateX(0)';result.textContent='';ov.classList.add('on');void track.offsetWidth;const target=-(21*91-((ov.querySelector('.roulette-window').clientWidth/2)-41));track.style.transition='transform 3.3s cubic-bezier(.08,.72,.14,1)';track.style.transform='translateX('+target+'px)';setTimeout(()=>{const msg=grantPrize(win);result.textContent='Você ganhou: '+msg;renderShop();},3500);}
function applyCosmetics(){const st=readShop(),frame=SHOP_ITEMS.find(x=>x.id===st.equipped.profile),photo=$('#profilePreview'),wrap=$('#profilePreviewWrap');const wrapCls=frame&&IMAGE_FRAME_WRAPS[frame.css];if(photo)photo.className='profile-photo '+(wrapCls?'':(frame?frame.css:''));if(wrap)wrap.className='frame-wrap'+(wrapCls?' '+wrapCls:'');}
// molduras baseadas em imagem (não CSS puro) precisam do <span class="frame-wrap"> extra ao redor do
// avatar (ver README, seção "Moldura mítica Presa Ígnea") — mapeia css da moldura -> classe do wrapper
const IMAGE_FRAME_WRAPS={'profile-frame-mitico':'frame-wrap-mitico','profile-frame-mitico-ouroboros':'frame-wrap-mitico-ouroboros','profile-frame-mitico-chamas':'frame-wrap-mitico-chamas'};
