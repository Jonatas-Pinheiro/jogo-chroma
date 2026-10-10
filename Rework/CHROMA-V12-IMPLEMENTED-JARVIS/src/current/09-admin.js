/* ===== PAINEL ADM — ferramenta de desenvolvedor para desbloquear/remover cosméticos localmente ===== */
// Só afeta o chroma-shop salvo no localStorage deste navegador — não muda nada
// para outros jogadores nem é enviado pela rede P2P. Troque a senha abaixo
// para a que você quiser; ela só existe neste arquivo, então não protege de
// alguém que leia o código-fonte — serve só para não abrir sem querer.
const ADMIN_PASSWORD='chroma-adm';
const ADMIN_COSMETIC_TYPES=new Set(['profile','profile-theme','profile-badge','cards','name-effect']);
function openAdminPrompt(){
  const pass=prompt('Senha do painel ADM:');
  if(pass===null)return;
  if(pass!==ADMIN_PASSWORD){toast('Senha incorreta');return;}
  $('#adminOv').classList.add('on');
}
function adminUnlockAll(){
  const st=readShop();
  SHOP_ITEMS.forEach(x=>{if(ADMIN_COSMETIC_TYPES.has(x.type)&&!st.owned.includes(x.id))st.owned.push(x.id);});
  writeShop(st);renderShop();renderInventory();applyCosmetics();toast('Todos os cosméticos foram desbloqueados, incluindo efeitos de nome');
}
function adminLockAll(){
  const st=readShop();
  st.owned=st.owned.filter(id=>{const it=SHOP_ITEMS.find(x=>x.id===id);return !(it&&ADMIN_COSMETIC_TYPES.has(it.type));});
  for(const type of ADMIN_COSMETIC_TYPES)st.equipped[type]='';
  writeShop(st);renderShop();renderInventory();applyCosmetics();toast('Cosméticos removidos (moedas, poções e baús preservados)');
}
