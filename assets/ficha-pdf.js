(() => {
 const palette={ink:'#33241e',wine:'#542831',dark:'#331b24',gold:'#a47543',pale:'#f4e6cf',stripe:'#fbf6ed',line:'#decbb2',muted:'#6d5142'};
 const actionNames={one:'1 ação',two:'2 ações',three:'3 ações',reaction:'Reação',free:'Livre'};
 const rankLabel=rank=>rank==='U'?'D':rank||'D';
 const attrLabel=key=>ATTRS.find(([attribute])=>attribute===key)?.[2]||'-';
 const printable=value=>String(value??'').replace(/\s+/g,' ').trim()||'-';
 const number=new Intl.NumberFormat('pt-BR',{maximumFractionDigits:2});
 let library;

 function loadScript(src){
  return new Promise((resolve,reject)=>{
   const script=document.createElement('script');
   script.src=src;
   script.onload=resolve;
   script.onerror=()=>{script.remove();reject(new Error('Recurso de PDF indisponível'))};
   document.head.append(script);
  });
 }
 function loadPdfLibrary(){
  library??=Promise.all([
   window.jspdf?.jsPDF||loadScript('./assets/vendor/jspdf-4.2.1.umd.min.js'),
   window.cinzasPdfFonts||loadScript('./assets/vendor/ficha-pdf-fontes.js')
  ]).then(()=>[window.jspdf.jsPDF,window.cinzasPdfFonts]).catch(error=>{library=null;throw error});
  return library;
 }
 async function pdfImage(src,width,height,header=false,settings={}){
  if(!src)return null;
  const image=new Image();
  if(/^https?:\/\//i.test(src))image.crossOrigin='anonymous';
  image.src=src;
  let timer;
  try{
   await Promise.race([image.decode(),new Promise((_,reject)=>{timer=setTimeout(reject,1600)})]);
   const canvas=document.createElement('canvas');
   canvas.width=width;canvas.height=height;
   const context=canvas.getContext('2d');
   context.fillStyle=palette.dark;
   context.fillRect(0,0,width,height);
   const fit=header||settings.fit==='cover'?Math.max:Math.min;
   const scale=fit(width/image.naturalWidth,height/image.naturalHeight)*(header?1:num(settings.zoom,1));
   const w=image.naturalWidth*scale,h=image.naturalHeight*scale;
   const x=(width-w)/2+(header?0:width*(num(settings.x,50)-50)*.007);
   const y=(height-h)/2+(header?0:height*(num(settings.y,50)-50)*.007);
   context.drawImage(image,x,y,w,h);
   if(header){
    const shade=context.createLinearGradient(0,0,width,0);
    shade.addColorStop(0,'rgba(37,20,27,.93)');
    shade.addColorStop(1,'rgba(49,25,29,.48)');
    context.fillStyle=shade;
    context.fillRect(0,0,width,height);
   }
   return canvas.toDataURL('image/jpeg',.86);
  }catch{
   return null;
  }finally{clearTimeout(timer)}
 }
 function buildCharacterPdf(Pdf,c,headerArt,portrait,fonts){
  const doc=new Pdf({orientation:'portrait',unit:'mm',format:'a4',compress:true,putOnlyUsedFonts:true});
  fonts.forEach(([file,family,style,data])=>{doc.addFileToVFS(file,data);doc.addFont(file,family,style)});
  const margin=13,width=184,bottom=280;
  let y=13;
  doc.setProperties({title:`Cinzas da Guerra - ${c.name}`,subject:'Ficha de personagem',creator:'Cinzas da Guerra'});
  function font(size,style='normal',color=palette.ink,family='helvetica'){
   doc.setFont(family==='times'?'CinzasSerif':'CinzasSans',style).setFontSize(size).setTextColor(color);
  }
  function line(x1,y1,x2,y2,color=palette.line){
   doc.setDrawColor(color).setLineWidth(.23).line(x1,y1,x2,y2);
  }
  function fill(x,top,w,h,color){
   doc.setFillColor(color).rect(x,top,w,h,'F');
  }
  function wrap(value,maxWidth,maxLines=15){
   const rows=doc.splitTextToSize(printable(value),maxWidth);
   if(rows.length<=maxLines)return rows;
   return [...rows.slice(0,maxLines-1),doc.splitTextToSize(rows[maxLines-1]+'...',maxWidth)[0]];
  }
  function newPage(){
   doc.addPage();
   font(8,'bold',palette.muted);
   doc.text('CINZAS DA GUERRA',margin,14);
   font(9,'bold',palette.wine,'times');
   doc.text(wrap(c.name,114,1),margin+width,14,{align:'right'});
   line(margin,17,margin+width,17,palette.gold);
   y=23;
  }
  function need(height){if(y+height>bottom)newPage()}
  function heading(title){
   doc.setFillColor(palette.gold).triangle(margin,y+2,margin+1.45,y+.55,margin+2.9,y+2,'F');
   doc.triangle(margin,y+2,margin+1.45,y+3.45,margin+2.9,y+2,'F');
   font(15,'bold',palette.wine,'times');
   doc.text(title,margin+5,y+3.6);
   line(margin,y+5.2,margin+width,y+5.2,palette.gold);
   y+=7;
  }
  function textBand(values){
   font(8.1,'normal',palette.muted);
   const text=values.filter(([,value])=>value!==''&&value!=null).map(([label,value])=>`${label} ${value}`).join('   ·   ');
   return text?wrap(text,width-4):[];
  }
  function table(title,columns,rows,summary=[],empty=''){
   if(!rows.length&&!summary.length&&!empty)return;
   const cellW=columns.map(([,part])=>width*part/100);
   const notes=textBand(summary);
   const noteHeight=notes.length?notes.length*3.5+2.5:0;
   const measure=row=>{
    font(8.5);
    return row.map((value,i)=>wrap(value,cellW[i]-3));
   };
   const rowHeight=cells=>Math.max(5,Math.max(...cells.map(lines=>lines.length))*3.55+1.65);
   function header(){
    fill(margin,y,width,5.1,palette.pale);
    font(7.6,'bold',palette.muted);
    let x=margin;
    columns.forEach(([label,,right],i)=>{
     doc.text(label,right?x+cellW[i]-1.45:x+1.45,y+3.35,{align:right?'right':'left'});
     x+=cellW[i];
    });
    y+=5.1;
   }
   need(7+noteHeight+(rows.length?5.1+rowHeight(measure(rows[0])):5));
   heading(title);
   if(notes.length){
    font(8.1,'normal',palette.muted);
    doc.text(notes,margin+1.45,y+2.8,{lineHeightFactor:1.25});
    y+=noteHeight;
   }
   if(!rows.length){
    if(empty){font(8.1,'normal',palette.muted);doc.text(empty,margin+1.45,y+3);y+=5}
    y+=3.3;
    return;
   }
   header();
   rows.forEach((row,index)=>{
    const cells=measure(row),height=rowHeight(cells);
    if(y+height>bottom){newPage();heading(title+' (continuação)');header()}
    if(index%2===1)fill(margin,y,width,height,palette.stripe);
    let x=margin;
    cells.forEach((lines,i)=>{
     const right=columns[i][2],isTotal=right==='total';
     font(8.5,isTotal?'bold':'normal',isTotal?palette.wine:palette.ink);
     doc.text(lines,right?x+cellW[i]-1.45:x+1.45,y+3.55,{align:right?'right':'left',lineHeightFactor:1.18});
     x+=cellW[i];
    });
    y+=height;
    line(margin,y,margin+width,y);
   });
   y+=4;
  }
  function statRow(entries,{crests=false,limit=2}={}){
   const gap=1.6,cellW=(width-gap*(entries.length-1))/entries.length;
   const cells=entries.map(([label,value,note])=>{
    font(7.1,'bold',palette.muted);
    const labels=wrap(label.toUpperCase(),cellW-4,2);
    font(14,'bold',palette.wine,'times');
    const values=wrap(value,cellW-4,limit);
    font(7.3,'normal',palette.muted);
    const notes=note?wrap(note,cellW-4,2):[];
    return {labels,values,notes};
   });
   const height=Math.max(...cells.map(({labels,values,notes})=>4+labels.length*2.8+values.length*4.9+notes.length*2.8));
   need(height);
   cells.forEach(({labels,values,notes},i)=>{
    const x=margin+i*(cellW+gap),center=x+cellW/2;
    fill(x,y+(crests?2:0),cellW,height-(crests?2:0),crests?palette.pale:palette.stripe);
    if(crests)doc.setFillColor(palette.pale).triangle(x,y+2,center,y,x+cellW,y+2,'F');
    line(x,y+height,x+cellW,y+height,palette.gold);
    font(7.1,'bold',palette.muted);
    doc.text(labels,center,y+4.5,{align:'center',lineHeightFactor:1.12});
    font(14,'bold',palette.wine,'times');
    doc.text(values,center,y+5.4+labels.length*2.8,{align:'center',lineHeightFactor:1});
    if(notes.length){
     font(7.3,'normal',palette.muted);
     doc.text(notes,center,y+3.9+labels.length*2.8+values.length*4.9,{align:'center',lineHeightFactor:1.1});
    }
   });
   y+=height+3;
  }

  const id=c.identity,d=defenseTotals(c);
  const nameWidth=width-(portrait?32:12);
  font(27,'bold','#fff2db','times');
  const title=wrap(c.name,nameWidth,3);
  const role=[`Nível ${num(c.level,1)}`,id.className,id.archetype].filter(Boolean).join('   ·   ');
  font(9,'bold','#f1d6ad');
  const roleLines=wrap(role,nameWidth,3);
  const heroHeight=Math.max(36,16+title.length*9.5+roleLines.length*3.4);
  fill(margin,y,width,heroHeight,palette.dark);
  if(headerArt)doc.addImage(headerArt,'JPEG',margin,y,width,heroHeight);
  fill(margin,y+heroHeight-.65,width,.65,palette.gold);
  font(8,'bold','#eac588');
  doc.text('CINZAS DA GUERRA  /  PATHFINDER 2E',margin+5,y+6);
  font(27,'bold','#fff2db','times');
  doc.text(title,margin+5,y+17,{lineHeightFactor:1});
  font(9,'bold','#f1d6ad');
  doc.text(roleLines,margin+5,y+14+title.length*9.5,{lineHeightFactor:1.1});
  if(portrait){
   fill(margin+width-26,y+(heroHeight-28)/2,22,28,'#c09559');
   doc.addImage(portrait,'JPEG',margin+width-25.6,y+(heroHeight-28)/2+.4,21.2,27.2);
  }
  y+=heroHeight+3;
  const identity=textBand([
   ['Ancestralidade',id.ancestry],['Herança',id.heritage],['Antecedente',id.background],['Divindade',id.deity],['Idiomas',id.languages],['Sentidos',id.senses]
  ]);
  if(identity.length){
   doc.text(identity,margin+1,y+2.8,{lineHeightFactor:1.25});
   y+=identity.length*3.6+2.5;
  }
  statRow([
   ['Vitalidade',`${num(c.hp.current)} / ${num(c.hp.max)}`,num(c.hp.temp)>0?`+${num(c.hp.temp)} temporários`:''],
   ['Foco',`${num(c.focus.current)} / ${num(c.focus.max)}`],
   ['Pontos heroicos',c.hero],['Deslocamento',id.speed]
  ]);
  statRow(['str','dex','con','int','wis','cha'].map(key=>[attrLabel(key),abilityScore(c,key),signed(abilityVal(c,key))]),{crests:true});
  need(24);
  heading('Defesas e salvaguardas');
  const defenseNames={armor:'CA rolada',classDC:'CD de classe'};
  statRow(Object.entries(DEFENSE_FIELDS).map(([key,field])=>{
   const defense=c.defenses[key],total=d[field.result];
   const value=key==='classDC'?total:key==='armor'?'d20'+signed(total):signed(total);
   const note=defense.manualEnabled?'Manual':`${defenseAttribute(defense,field)[2]} · ${rankLabel(defense.rank)}`;
   return [defenseNames[key]||field.label,value,note];
  }));
  const resistances=Object.entries(c.mitigation).filter(([,value])=>num(value)>0);
  if(resistances.length)table('Resistências',[],[],resistances);

  const skills=[...c.skills].sort((a,b)=>Number(Boolean(a.lore))-Number(Boolean(b.lore))||String(a.name).localeCompare(String(b.name),'pt-BR'));
  table('Perícias',[
   ['Perícia',37],['Atrib.',11],['Grad.',10],['Prof.',10,true],['Item',10,true],['Outros',10,true],['Total',12,'total']
  ],skills.map(s=>[s.name,attrLabel(s.attr),rankLabel(s.rank),signed(rankBonus(s.rank,c.level,c.pwl)),signed(num(s.item)),signed(num(s.other)),signed(skillTotal(c,s))]),[
   ['Graduação','D sem treino · T novato · E especialista · M mestre · L lendário']
  ]);
  table('Ataques',[['Golpe',43],['Tipo',21],['Dano',23],['Bônus',13,'total']],c.attacks.map(a=>{
   const mod=abilityVal(c,a.damageAbility||'str');
   return [a.name,a.type,a.damage?`${a.damage}${mod?' '+signed(mod):''}`:'',signed(attackTotal(c,a))];
  }));

  const {items,coins}=c.inventory;
  const bulk=items.reduce((sum,item)=>sum+bulkOf(item.bulk)*Math.max(0,num(item.qty,1)),0);
  const money=[['Platina',coins.pp],['Ouro',coins.gp],['Prata',coins.sp],['Cobre',coins.cp]].filter(([,value])=>num(value)>0);
  table('Equipamento',[['Item',45],['Qtd.',10,true],['Bulk',10,true],['Valor',15],['Estado',20]],items.map(item=>[
   item.name,num(item.qty,1),item.bulk,item.value,item.equipped?'Equipado':'Guardado'
  ]),[['Bulk',number.format(bulk)],...money],'Nenhum item registrado.');

  const book=c.spellcasting;
  const slots=book.slots.filter(slot=>num(slot.max)>0||num(slot.current)>0);
  if(book.spells.length||slots.length||book.specialSlots.length){
   const magic=spellTotals(c);
   const sorted=[...book.spells].sort((a,b)=>num(a.rank)-num(b.rank)||Number(Boolean(b.prepared))-Number(Boolean(a.prepared))||String(a.name).localeCompare(String(b.name),'pt-BR'));
   const resources=[
    ['Tradição',book.tradition],['Ataque mágico',signed(magic.attack)],['CD',magic.dc],['Bônus de dano',signed(magic.damage)],
    ...slots.map(s=>[`${num(s.rank)}º círculo`,`${num(s.current)} / ${num(s.max)}`]),
    ...book.specialSlots.map(s=>[`${s.name||'Espaço especial'}${num(s.rank)>0?' · '+num(s.rank)+'º':''}`,`${num(s.current)} / ${num(s.max)}`])
   ];
   table('Magias',[['Círculo',13],['Magia',50],['Conjuração',20],['Preparo',17]],sorted.map(sp=>{
    const cast=String(sp.cast||'').split(/[•;]/,1)[0].trim();
    const actions=/\d\s*(?:,|\/|ou|a|-|–)\s*\d/i.test(cast)?cast:actionNames[sp.action]||cast;
    return [num(sp.rank)===0?'Truque':num(sp.rank)+'º',sp.name,actions,sp.isFocus?'Foco':sp.prepared?'Preparada':''];
   }),resources);
  }
  const pages=doc.getNumberOfPages();
  for(let page=1;page<=pages;page++){
   doc.setPage(page);
   line(margin,284,margin+width,284,palette.gold);
   font(7.7,'bold',palette.muted);
   doc.text('CINZAS DA GUERRA',margin,288);
   doc.text(`${page} / ${pages}`,margin+width,288,{align:'right'});
  }
  return doc;
 }
 const button=document.getElementById('printBtn');
 button.addEventListener('click',async()=>{
  if(button.disabled)return;
  button.disabled=true;
  try{
   const c=current();
   const [[Pdf,fonts],art,portrait]=await Promise.all([
    loadPdfLibrary(),
    pdfImage('./assets/the-nine-kings.webp',1116,216,true),
    pdfImage(c.image.src,212,272,false,c.image)
   ]);
   const name=printable(c.name).replace(/[<>:"/\\|?*]+/g,'-').slice(0,96);
   buildCharacterPdf(Pdf,c,art,portrait,fonts).save(`Cinzas da Guerra - ${name}.pdf`);
  }catch(error){
   console.error('Falha ao gerar PDF',error);
   toast('Não foi possível gerar o PDF. Tente novamente.');
  }finally{button.disabled=false}
 });
})();
