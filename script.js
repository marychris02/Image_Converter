(function(){
  var $=function(i){return document.getElementById(i)};
  var items=[],results=[],busy=false,seq=0;
  var fileIn=$('file'),drop=$('drop'),go=$('go'),gt=$('gt'),gs=$('gs'),list=$('list'),all=$('all'),allrow=$('allrow'),q=$('q'),qv=$('qv'),qbox=$('qbox'),dt=$('dt'),ds=$('ds'),queue=$('queue'),more=$('addmore');
  var FMT={
    'image/jpeg':{ext:'jpg',name:'JPG'},
    'image/png':{ext:'png',name:'PNG'},
    'image/webp':{ext:'webp',name:'WebP'},
    'image/bmp':{ext:'bmp',name:'BMP'},
    'image/x-icon':{ext:'ico',name:'ICO'}
  };
  var ORDER=['image/jpeg','image/png','image/webp','image/bmp','image/x-icon'];
  var LOSSY={'image/jpeg':1,'image/webp':1}; // only these use the quality slider
  function fmt(){return document.querySelector('input[name=fmt]:checked').value}
  function kb(n){return n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(2)+' MB'}

  /* ---------- the list of photos waiting to be converted ---------- */
  function sync(){
    var lossy=items.length?items.some(function(i){return LOSSY[i.type]}):!!LOSSY[fmt()];
    q.disabled=!lossy; qbox.style.opacity=lossy?1:.55;
    queue.hidden=!items.length; more.hidden=!items.length;
    if(items.length){
      var same=items.every(function(i){return i.type===items[0].type});
      gt.textContent='Convert '+items.length+(items.length===1?' image':' images');
      gs.textContent=same?'to '+FMT[items[0].type].name+(lossy?' at '+q.value+'%':''):'to the formats you chose';
      dt.textContent=items.length===1?items[0].file.name:items.length+' images ready';
      ds.textContent='Tap here to add more, or pick a format for each photo below';
    }else{
      gt.textContent='Choose an image'; gs.textContent='JPG, PNG, WebP, BMP, or ICO';
      dt.textContent='Choose an image'; ds.textContent='Tap to browse, or drop a file here';
    }
  }
  function renderQueue(){
    queue.innerHTML='';
    items.forEach(function(it){
      var li=document.createElement('li');
      li.innerHTML='<img alt=""><div class="qn"><div class="nm"></div><div class="mt"></div></div><select class="fsel" aria-label="Convert this photo to"></select><button type="button" class="rm" aria-label="Remove this photo">×</button>';
      var img=li.querySelector('img');
      img.onerror=function(){img.style.visibility='hidden'};
      img.src=it.thumb;
      li.querySelector('.nm').textContent=it.file.name;
      li.querySelector('.mt').textContent=kb(it.file.size);
      var sel=li.querySelector('select');
      ORDER.forEach(function(t){var o=document.createElement('option');o.value=t;o.textContent=FMT[t].name;sel.appendChild(o)});
      sel.value=it.type;
      sel.addEventListener('change',function(){it.type=sel.value;sync()});
      li.querySelector('.rm').addEventListener('click',function(){
        URL.revokeObjectURL(it.thumb);
        items=items.filter(function(x){return x!==it});
        renderQueue();sync();
      });
      queue.appendChild(li);
    });
  }
  function add(fl){
    for(var i=0;i<fl.length;i++){
      if(/^image\//.test(fl[i].type)||/\.(heic|heif|avif|bmp|gif|jpe?g|png|webp)$/i.test(fl[i].name))
        items.push({id:++seq,file:fl[i],type:fmt(),thumb:URL.createObjectURL(fl[i])});
    }
    renderQueue();sync();
  }
  drop.addEventListener('click',function(){fileIn.click()});
  drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fileIn.click()}});
  more.addEventListener('click',function(){fileIn.click()});
  fileIn.addEventListener('change',function(){add(fileIn.files);fileIn.value=''});
  ['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('over')})});
  ['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('over')})});
  drop.addEventListener('drop',function(ev){add(ev.dataTransfer.files)});
  q.addEventListener('input',function(){qv.textContent=q.value+'%';sync()});
  // choosing a format tile sets every photo in the list; each photo can still be changed on its own row
  document.querySelectorAll('input[name=fmt]').forEach(function(r){r.addEventListener('change',function(){
    items.forEach(function(i){i.type=fmt()});renderQueue();sync();
  })});

  /* ---------- converting ---------- */
  function load(file){
    return new Promise(function(res,rej){
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){res({img:img,url:url})};
      img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('This browser can’t open this file type.'))};
      img.src=url;
    });
  }
  function toBlob(c,type,quality){return new Promise(function(res){c.toBlob(res,type,quality)})}
  function bmpBlob(c){ // 24-bit BMP; transparent areas become white
    var w=c.width,h=c.height,id=c.getContext('2d').getImageData(0,0,w,h).data,rs=(w*3+3)&~3,size=54+rs*h,buf=new ArrayBuffer(size),v=new DataView(buf),u=new Uint8Array(buf);
    u[0]=66;u[1]=77;v.setUint32(2,size,true);v.setUint32(10,54,true);v.setUint32(14,40,true);
    v.setInt32(18,w,true);v.setInt32(22,h,true);v.setUint16(26,1,true);v.setUint16(28,24,true);
    v.setUint32(34,rs*h,true);v.setUint32(38,2835,true);v.setUint32(42,2835,true);
    for(var y=0;y<h;y++){
      var so=(h-1-y)*w*4,o=54+y*rs;
      for(var x=0;x<w;x++){
        var p=so+x*4,a=id[p+3]/255;
        u[o++]=Math.round(id[p+2]*a+255*(1-a));
        u[o++]=Math.round(id[p+1]*a+255*(1-a));
        u[o++]=Math.round(id[p]*a+255*(1-a));
      }
    }
    return Promise.resolve(new Blob([buf],{type:'image/bmp'}));
  }
  function icoBlob(c){ // ICO holds sizes up to 256 px, so bigger photos are scaled down to fit
    var m=Math.max(c.width,c.height),k=m>256?256/m:1,w=Math.max(1,Math.round(c.width*k)),h=Math.max(1,Math.round(c.height*k)),s=c;
    if(k<1){s=document.createElement('canvas');s.width=w;s.height=h;s.getContext('2d').drawImage(c,0,0,w,h)}
    return toBlob(s,'image/png').then(function(b){return b.arrayBuffer()}).then(function(png){
      var buf=new ArrayBuffer(22+png.byteLength),v=new DataView(buf),u=new Uint8Array(buf);
      v.setUint16(2,1,true);v.setUint16(4,1,true);
      u[6]=w>=256?0:w;u[7]=h>=256?0:h;
      v.setUint16(10,1,true);v.setUint16(12,32,true);v.setUint32(14,png.byteLength,true);v.setUint32(18,22,true);
      u.set(new Uint8Array(png),22);
      return new Blob([buf],{type:'image/x-icon'});
    });
  }
  function convert(file,type,quality){
    return load(file).then(function(o){
      var c=document.createElement('canvas'); c.width=o.img.naturalWidth; c.height=o.img.naturalHeight;
      var ctx=c.getContext('2d');
      if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}
      ctx.drawImage(o.img,0,0); URL.revokeObjectURL(o.url);
      if(type==='image/bmp')return bmpBlob(c);
      if(type==='image/x-icon')return icoBlob(c);
      return toBlob(c,type,LOSSY[type]?quality:undefined).then(function(b){
        if(!b) throw new Error('Conversion failed.');
        if(b.type!==type) throw new Error('This browser can’t save '+FMT[type].name+'. Try JPG or PNG.');
        return b;
      });
    });
  }
  function row(r){
    var li=document.createElement('li');
    if(r.err){
      li.innerHTML='<div></div><div><div class="nm"></div><div class="mt err"></div></div>';
      li.querySelector('.nm').textContent=r.file.name; li.querySelector('.mt').textContent=r.err; return li;
    }
    r.url=URL.createObjectURL(r.blob); r.bUrl=URL.createObjectURL(r.file); r.dl=r.file.name.replace(/\.[^.]+$/,'')+'.'+FMT[r.type].ext;
    li.className='res';
    li.innerHTML='<div class="pair"><figure><img class="bf" alt="Before"><figcaption class="cb">Before</figcaption></figure><figure><img class="af" alt="After"><figcaption class="ca">After</figcaption></figure></div><div><div class="nm"></div><div class="mt"></div></div><a class="dl">Download</a>';
    var bf=li.querySelector('.bf'),af=li.querySelector('.af'),mt=li.querySelector('.mt');
    bf.src=r.bUrl; af.src=r.url; li.querySelector('.nm').textContent=r.dl;
    mt.textContent=kb(r.file.size)+' → '+kb(r.blob.size);
    bf.onload=function(){li.querySelector('.cb').textContent='Before · '+bf.naturalWidth+'×'+bf.naturalHeight+' · '+kb(r.file.size)};
    af.onload=function(){li.querySelector('.ca').textContent='After · '+af.naturalWidth+'×'+af.naturalHeight+' · '+kb(r.blob.size)};
    var a=li.querySelector('a.dl'); a.href=r.url; a.download=r.dl; return li;
  }
  function clearResults(){results.forEach(function(r){if(r.url)URL.revokeObjectURL(r.url);if(r.bUrl)URL.revokeObjectURL(r.bUrl)});results=[];list.innerHTML='';allrow.hidden=true}
  go.addEventListener('click',function(){
    if(busy) return;
    if(!items.length){fileIn.click();return}
    var quality=q.value/100,batch=items.slice();
    items.forEach(function(i){URL.revokeObjectURL(i.thumb)});
    items=[]; renderQueue(); busy=true; go.disabled=true; gt.textContent='Converting…'; gs.textContent='Please wait'; clearResults();
    var chain=Promise.resolve();
    batch.forEach(function(it){
      chain=chain.then(function(){return convert(it.file,it.type,quality).then(function(b){return{file:it.file,type:it.type,blob:b}},function(e){return{file:it.file,type:it.type,err:e.message}})})
        .then(function(r){results.push(r);list.appendChild(row(r))});
    });
    chain.then(function(){
      busy=false; go.disabled=false; sync();
      allrow.hidden=results.filter(function(r){return r.blob}).length<2;
      list.scrollIntoView({behavior:'smooth',block:'nearest'});
    });
  });
  all.addEventListener('click',function(){
    results.filter(function(r){return r.blob}).forEach(function(r,i){
      setTimeout(function(){var a=document.createElement('a');a.href=r.url;a.download=r.dl;document.body.appendChild(a);a.click();a.remove()},i*350);
    });
  });
  window.anyformatAdd=function(f){add([f])}; // lets the edit tools hand a finished image to the converter
  renderQueue();sync();
})();
