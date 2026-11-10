(function(){
  var $=function(i){return document.getElementById(i)};
  var files=[],results=[],busy=false;
  var fileIn=$('file'),drop=$('drop'),go=$('go'),gt=$('gt'),gs=$('gs'),list=$('list'),all=$('all'),allrow=$('allrow'),q=$('q'),qv=$('qv'),qbox=$('qbox'),dt=$('dt'),ds=$('ds');
  var EXT={'image/jpeg':'jpg','image/png':'png','image/webp':'webp'};
  function fmt(){return document.querySelector('input[name=fmt]:checked').value}
  function kb(n){return n<1048576?(n/1024).toFixed(0)+' KB':(n/1048576).toFixed(2)+' MB'}
  function sync(){
    var png=fmt()==='image/png'; q.disabled=png; qbox.style.opacity=png?.55:1;
    if(files.length){
      gt.textContent='Convert '+files.length+(files.length===1?' image':' images');
      gs.textContent='to '+EXT[fmt()].toUpperCase()+(png?'':' at '+q.value+'%');
      dt.textContent=files.length===1?files[0].name:files.length+' images ready';
      ds.textContent='Pick a format below, then convert';
    }else{
      gt.textContent='Choose an image'; gs.textContent='JPG, PNG, or WebP';
      dt.textContent='Choose an image'; ds.textContent='Tap to browse, or drop a file here';
    }
  }
  function add(fl){
    for(var i=0;i<fl.length;i++){ if(/^image\//.test(fl[i].type)||/\.(heic|heif|avif|bmp|gif|jpe?g|png|webp)$/i.test(fl[i].name)) files.push(fl[i]); }
    sync();
  }
  drop.addEventListener('click',function(){fileIn.click()});
  drop.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();fileIn.click()}});
  fileIn.addEventListener('change',function(){add(fileIn.files);fileIn.value=''});
  ['dragenter','dragover'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.add('over')})});
  ['dragleave','drop'].forEach(function(e){drop.addEventListener(e,function(ev){ev.preventDefault();drop.classList.remove('over')})});
  drop.addEventListener('drop',function(ev){add(ev.dataTransfer.files)});
  q.addEventListener('input',function(){qv.textContent=q.value+'%';sync()});
  document.querySelectorAll('input[name=fmt]').forEach(function(r){r.addEventListener('change',sync)});

  function load(file){
    return new Promise(function(res,rej){
      var url=URL.createObjectURL(file),img=new Image();
      img.onload=function(){res({img:img,url:url})};
      img.onerror=function(){URL.revokeObjectURL(url);rej(new Error('This browser can’t open this file type.'))};
      img.src=url;
    });
  }
  function convert(file,type,quality){
    return load(file).then(function(o){
      var c=document.createElement('canvas'); c.width=o.img.naturalWidth; c.height=o.img.naturalHeight;
      var ctx=c.getContext('2d');
      if(type==='image/jpeg'){ctx.fillStyle='#fff';ctx.fillRect(0,0,c.width,c.height)}
      ctx.drawImage(o.img,0,0); URL.revokeObjectURL(o.url);
      return new Promise(function(res,rej){
        c.toBlob(function(b){
          if(!b) return rej(new Error('Conversion failed.'));
          if(b.type!==type) return rej(new Error('This browser can’t save '+EXT[type].toUpperCase()+'. Try JPG or PNG.'));
          res(b);
        },type,quality);
      });
    });
  }
  function row(r){
    var li=document.createElement('li');
    if(r.err){
      li.innerHTML='<div></div><div><div class="nm"></div><div class="mt err"></div></div>';
      li.querySelector('.nm').textContent=r.file.name; li.querySelector('.mt').textContent=r.err; return li;
    }
    r.url=URL.createObjectURL(r.blob); r.dl=r.file.name.replace(/\.[^.]+$/,'')+'.'+EXT[r.blob.type];
    li.innerHTML='<img alt=""><div><div class="nm"></div><div class="mt"></div></div><a class="dl">Download</a>';
    li.querySelector('img').src=r.url; li.querySelector('.nm').textContent=r.dl;
    li.querySelector('.mt').textContent=kb(r.file.size)+' → '+kb(r.blob.size);
    var a=li.querySelector('a'); a.href=r.url; a.download=r.dl; return li;
  }
  function clearResults(){results.forEach(function(r){if(r.url)URL.revokeObjectURL(r.url)});results=[];list.innerHTML='';allrow.hidden=true}
  go.addEventListener('click',function(){
    if(busy) return;
    if(!files.length){fileIn.click();return}
    var type=fmt(),quality=type==='image/png'?undefined:q.value/100,batch=files.slice();
    files=[]; busy=true; go.disabled=true; gt.textContent='Converting…'; gs.textContent='Please wait'; clearResults();
    var chain=Promise.resolve();
    batch.forEach(function(f){
      chain=chain.then(function(){return convert(f,type,quality).then(function(b){return{file:f,blob:b}},function(e){return{file:f,err:e.message}})})
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
  sync();
})();