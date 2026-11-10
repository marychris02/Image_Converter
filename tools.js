(function(){
  var $=function(i){return document.getElementById(i)};
  var EXTEND_API=''; // optional: URL of your AI outpainting server (see notes). Empty = local fill.
  var note='',tab='crop',work=null,result=null,name='image',urls=[],r={x:0,y:0,w:0,h:0},drag=null;
  var cimg=$('cimg'),cropEl=$('crop'),cropbox=$('cropbox'),ba=$('ba'),bb=$('bb'),aa=$('aa'),hnd=$('hnd'),alb=$('alb'),msg=$('tmsg'),rbar=$('rbar'),empty=$('empty');

  function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
  function mk(w,h){var c=document.createElement('canvas');c.width=w;c.height=h;return c}
  function blobOf(c,type,q){return new Promise(function(res){c.toBlob(res,type||'image/png',q)})}
  function url(b){var u=URL.createObjectURL(b);urls.push(u);return u}
  function say(t,err){msg.textContent=t;msg.className='mt'+(err?' err':'')}
  function toCanvas(blob){return createImageBitmap(blob).then(function(bm){var c=mk(bm.width,bm.height);c.getContext('2d').drawImage(bm,0,0);return c})}
  function need(){if(!work){throw new Error('Choose an image first.')}}

  /* ---------- show current image ---------- */
  function show(){
    urls.forEach(function(u){URL.revokeObjectURL(u)});urls=[];result=null;
    rbar.hidden=true;aa.hidden=true;hnd.hidden=true;alb.hidden=true;$('tpick').hidden=!work;
    if(!work){empty.hidden=false;cropbox.hidden=true;ba.hidden=true;return}
    empty.hidden=true;
    blobOf(work).then(function(b){
      var u=url(b);
      if(tab==='crop'){ba.hidden=true;cropbox.hidden=false;cimg.src=u}
      else{cropbox.hidden=true;ba.hidden=false;bb.src=u}
    });
  }

  /* ---------- tabs ---------- */
  var HINT={crop:'Drag the box to choose what to keep. Pull a corner to resize it.',bg:'Removes the background and saves a transparent PNG. The first run downloads an AI model, so it may take a minute.',hd:'Uses AI to rebuild fine detail, so the photo looks sharper and not just bigger. The first run downloads an AI model and can take a minute or two. Choose a size, then press the button.',ext:'Adds empty space around your photo. Enter how many pixels to add on each side.'};
  function setTab(t){
    tab=t;var conv=t==='convert';
    document.querySelectorAll('.tabs button').forEach(function(x){var on=x.dataset.t===t;x.classList.toggle('on',on);x.setAttribute('aria-selected',on)});
    $('panel-convert').hidden=!conv;$('panel-tools').hidden=conv;
    if(conv)return;
    ['crop','bg','hd','ext'].forEach(function(k){$('c-'+k).hidden=k!==t});
    $('hint').textContent=HINT[t];say('');show();
  }
  document.querySelectorAll('.tabs button').forEach(function(b){b.addEventListener('click',function(){setTab(b.dataset.t)})});

  /* ---------- load image ---------- */
  $('tpick').addEventListener('click',function(){$('tfile').click()});
  $('empty').addEventListener('click',function(){$('tfile').click()});
  $('tfile').addEventListener('change',function(){
    var f=this.files[0];this.value='';if(!f)return;
    var u=URL.createObjectURL(f),i=new Image();
    i.onload=function(){work=mk(i.naturalWidth,i.naturalHeight);work.getContext('2d').drawImage(i,0,0);URL.revokeObjectURL(u);name=f.name.replace(/\.[^.]+$/,'');say(f.name+' · '+work.width+'×'+work.height);show()};
    i.onerror=function(){say('This browser can’t open this file type.',1)};
    i.src=u;
  });

  /* ---------- before/after slider ---------- */
  function move(p){p=clamp(p,0,1);aa.style.clipPath='inset(0 0 0 '+p*100+'%)';hnd.style.left=p*100+'%'}
  function at(e){var b=ba.getBoundingClientRect();move((e.clientX-b.left)/b.width)}
  ba.addEventListener('pointerdown',function(e){ba.setPointerCapture(e.pointerId);at(e)});
  ba.addEventListener('pointermove',function(e){if(e.buttons)at(e)});
  function done(after,before){
    result=after;
    var jobs=[blobOf(after,'image/webp',.92)];
    if(before)jobs.push(blobOf(before,'image/webp',.92)); // only re-encode the "before" when it changed
    return Promise.all(jobs).then(function(p){
      aa.src=url(p[0]);if(p[1])bb.src=url(p[1]);
      aa.hidden=false;hnd.hidden=false;alb.hidden=false;rbar.hidden=false;move(.5);
      ba.scrollIntoView({behavior:'smooth',block:'center'}); // bring the before/after slider into view
    });
  }
  function run(btn,label,fn){
    btn.disabled=true;say(label+'…');
    Promise.resolve().then(function(){need();return fn()})
      .then(function(){say(note||'Done. Drag the handle to compare.');note=''},function(e){say(e.message||'Something went wrong.',1)})
      .then(function(){btn.disabled=false});
  }

  /* ---------- crop ---------- */
  function paint(){cropEl.style.left=r.x+'px';cropEl.style.top=r.y+'px';cropEl.style.width=r.w+'px';cropEl.style.height=r.h+'px'}
  function fit(){
    var ra=+$('ratio').value,W=cimg.clientWidth,H=cimg.clientHeight;
    if(ra){r.w=Math.min(r.w,H*ra);r.h=r.w/ra}
    r.x=clamp(r.x,0,W-r.w);r.y=clamp(r.y,0,H-r.h);paint();
  }
  cimg.addEventListener('load',function(){
    var W=cimg.clientWidth,H=cimg.clientHeight;
    r={x:W*.1,y:H*.1,w:W*.8,h:H*.8};fit();
  });
  $('ratio').addEventListener('change',fit);
  cropEl.addEventListener('pointerdown',function(e){
    drag={h:e.target.dataset.h||'m',x:e.clientX,y:e.clientY,r:{x:r.x,y:r.y,w:r.w,h:r.h}};
    cropEl.setPointerCapture(e.pointerId);e.preventDefault();
  });
  cropEl.addEventListener('pointermove',function(e){
    if(!drag)return;
    var dx=e.clientX-drag.x,dy=e.clientY-drag.y,o=drag.r,W=cimg.clientWidth,H=cimg.clientHeight,h=drag.h,n;
    if(h==='m'){n={x:clamp(o.x+dx,0,W-o.w),y:clamp(o.y+dy,0,H-o.h),w:o.w,h:o.h}}
    else{
      var l=o.x,t=o.y,rt=o.x+o.w,b=o.y+o.h,ra=+$('ratio').value;
      if(/l/.test(h))l=clamp(l+dx,0,rt-30); if(/r/.test(h))rt=clamp(rt+dx,l+30,W);
      if(/t/.test(h))t=clamp(t+dy,0,b-30); if(/b/.test(h))b=clamp(b+dy,t+30,H);
      n={x:l,y:t,w:rt-l,h:b-t};
      if(ra){
        if(h==='t'||h==='b'){n.w=n.h*ra;if(n.x+n.w>W)return}
        else{n.h=n.w/ra;if(/t/.test(h))n.y=b-n.h;if(n.y<0||n.y+n.h>H)return}
      }
    }
    r=n;paint();
  });
  ['pointerup','pointercancel'].forEach(function(t){cropEl.addEventListener(t,function(){drag=null})});
  $('rot').addEventListener('click',function(){
    if(!work)return say('Choose an image first.',1);
    var c=mk(work.height,work.width),x=c.getContext('2d');
    x.translate(c.width/2,c.height/2);x.rotate(Math.PI/2);x.drawImage(work,-work.width/2,-work.height/2);
    work=c;show();
  });
  $('docrop').addEventListener('click',function(){
    if(!work)return say('Choose an image first.',1);
    var s=work.width/cimg.clientWidth,c=mk(Math.round(r.w*s),Math.round(r.h*s));
    c.getContext('2d').drawImage(work,r.x*s,r.y*s,r.w*s,r.h*s,0,0,c.width,c.height);
    work=c;say('Cropped to '+c.width+'×'+c.height+'. Download it or send it to the converter.');show();
    result=work;rbar.hidden=false;
  });

  /* ---------- remove background (AI model runs in the browser) ---------- */
  var bgModel=null,hfLib=null;
  function lib(){ // load the AI library once; shared by background removal
    if(hfLib)return hfLib;
    hfLib=import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm').then(function(m){
      m.env.allowLocalModels=false; // never look for the model on this site (a web server that answers 404 with a page breaks loading)
      m.env.allowRemoteModels=true;
      return m;
    },function(e){hfLib=null;throw e});
    return hfLib;
  }
  function loadBG(){
    if(bgModel)return bgModel;
    var cb=function(p){if(p.status==='progress')say('Downloading AI model… '+Math.round(p.progress)+'%')};
    var cfg={do_normalize:true,do_pad:false,do_rescale:true,do_resize:true,image_mean:[0.5,0.5,0.5],feature_extractor_type:'ImageFeatureExtractor',image_std:[1,1,1],resample:2,rescale_factor:0.00392156862745098,size:{width:1024,height:1024}};
    bgModel=lib().then(function(m){
      // Safest engine settings: no background worker and one thread, so nothing extra has to load or be allowed by the browser.
      try{m.env.backends.onnx.wasm.proxy=false;m.env.backends.onnx.wasm.numThreads=1}catch(e){}
      return Promise.all([
        m.AutoModel.from_pretrained('briaai/RMBG-1.4',{config:{model_type:'custom'},progress_callback:cb}),
        m.AutoProcessor.from_pretrained('briaai/RMBG-1.4',{config:cfg})
      ]).then(function(r){return{m:m,model:r[0],proc:r[1]}});
    }).catch(function(e){
      bgModel=null;console.error('Background remover failed:',e);
      var why=String((e&&e.message)||e||'').replace(/\s+/g,' ').slice(0,160);
      throw new Error('The AI background remover could not load'+(why?' ('+why+')':'')+'.');
    });
    return bgModel;
  }
  /* Simple remover with no download: erases the background colour connected to the photo's edges.
     Works well on plain or softly shaded backgrounds. Used only when the AI model cannot load. */
  function simpleBG(c){
    var w=c.width,h=c.height,out=mk(w,h),x=out.getContext('2d');x.drawImage(c,0,0);
    var im=x.getImageData(0,0,w,h),d=im.data,N=w*h,seen=new Uint8Array(N),stack=new Int32Array(N),sp=0;
    var br=0,bg=0,bb=0,n=0;
    function edge(i){var p=i*4;br+=d[p];bg+=d[p+1];bb+=d[p+2];n++}
    for(var i=0;i<w;i++){edge(i);edge((h-1)*w+i)}
    for(var j=1;j<h-1;j++){edge(j*w);edge(j*w+w-1)}
    br/=n;bg/=n;bb/=n;
    var TOL=48*48*3/3; // squared colour distance allowed from the background colour
    function like(i){var p=i*4,a=d[p]-br,b=d[p+1]-bg,c2=d[p+2]-bb;return a*a+b*b+c2*c2<=TOL}
    function push(i){if(!seen[i]&&like(i)){seen[i]=1;stack[sp++]=i}}
    for(var i2=0;i2<w;i2++){push(i2);push((h-1)*w+i2)}
    for(var j2=1;j2<h-1;j2++){push(j2*w);push(j2*w+w-1)}
    while(sp){
      var k=stack[--sp],kx=k%w;
      if(kx>0)push(k-1);if(kx<w-1)push(k+1);if(k>=w)push(k-w);if(k<N-w)push(k+w);
    }
    for(var q=0;q<N;q++){
      if(seen[q]){d[q*4+3]=0;continue}
      var qx=q%w; // soften the edge: pixels touching the removed area become half transparent
      if((qx>0&&seen[q-1])||(qx<w-1&&seen[q+1])||(q>=w&&seen[q-w])||(q<N-w&&seen[q+w]))d[q*4+3]=130;
    }
    x.putImageData(im,0,0);return out;
  }
  function removeBG(c){
    return loadBG().then(function(o){
      return blobOf(c).then(function(b){
        var u=URL.createObjectURL(b);
        return o.m.RawImage.fromURL(u).then(function(img){
          URL.revokeObjectURL(u);
          say('Removing background…');
          return o.proc(img).then(function(r){return o.model({input:r.pixel_values})}).then(function(res){
            return o.m.RawImage.fromTensor(res.output[0].mul(255).to('uint8')).resize(img.width,img.height).then(function(mask){
              var r=mk(img.width,img.height),x=r.getContext('2d');
              x.drawImage(c,0,0,r.width,r.height);
              var d=x.getImageData(0,0,r.width,r.height),n=mask.channels||1;
              for(var i=0;i<r.width*r.height;i++)d.data[i*4+3]=mask.data[i*n]; // the AI mask becomes the transparency
              x.putImageData(d,0,0);return r;
            });
          });
        });
      });
    });
  }
  $('dobg').addEventListener('click',function(){
    run(this,'Removing background',function(){
      return removeBG(work).then(function(c){return done(c)},function(err){
        console.warn('Using the simple remover because the AI one failed:',err);
        say('AI model unavailable. Using the simple remover…');
        return Promise.resolve().then(function(){return done(simpleBG(work))}).then(function(){
          note='Done with the simple remover (the AI model could not load on this browser). It works best on plain backgrounds. Drag the handle to compare.';
        });
      });
    });
  });

  /* ---------- enhance to HD ---------- */
  var ENHANCE_API=''; // optional: URL of your AI upscaler (Real-ESRGAN etc.). Empty = built-in HD upscale.
  function sharpen(c,a){ // fallback for browsers without canvas blur
    var x=c.getContext('2d'),w=c.width,h=c.height,d=x.getImageData(0,0,w,h),s=d.data,o=new Uint8ClampedArray(s);
    for(var y=1;y<h-1;y++)for(var i=1;i<w-1;i++){var p=(y*w+i)*4;
      for(var k=0;k<3;k++){var q=p+k;o[q]=s[q]*(1+4*a)-a*(s[q-4]+s[q+4]+s[q-w*4]+s[q+w*4])}}
    d.data.set(o);x.putImageData(d,0,0);
  }
  function unsharp(c,amount,radius){ // sharpen fine detail: original + amount * (original - blurred)
    var w=c.width,h=c.height,x=c.getContext('2d'),b=mk(w,h),bx=b.getContext('2d');
    bx.filter='blur('+radius+'px)';bx.drawImage(c,0,0);
    if(bx.filter!=='blur('+radius+'px)'){sharpen(c,.6);return}
    var o=x.getImageData(0,0,w,h),e=bx.getImageData(0,0,w,h).data,d=o.data;
    for(var i=0;i<d.length;i+=4){for(var k=0;k<3;k++){d[i+k]=d[i+k]+amount*(d[i+k]-e[i+k])}}
    x.putImageData(o,0,0);
  }
  var aiPipe=null,gpuOk=!!navigator.gpu,cancelled=false;
  var tick=function(){return new Promise(function(r){setTimeout(r,0)})}; // lets the page redraw between tiles
  function loadAI(){
    if(aiPipe)return aiPipe;
    var gpu=gpuOk;
    aiPipe=import('https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.0.2/+esm').then(function(m){
      var o={progress_callback:function(p){if(p.status==='progress')say('Downloading AI model… '+Math.round(p.progress)+'%')}};
      if(gpu){o.device='webgpu'} // graphics card: much faster
      else{try{m.env.backends.onnx.wasm.proxy=true}catch(e){}} // CPU: run in a background worker so the page does not freeze
      return m.pipeline('image-to-image','Xenova/swin2SR-realworld-sr-x4-64-bsrgan-psnr',o);
    }).catch(function(){aiPipe=null;throw new Error('The AI model could not load. Check your internet connection and try again.')});
    return aiPipe;
  }
  function rawCanvas(o){return o.toCanvas?Promise.resolve(o.toCanvas()):o.toBlob().then(toCanvas)}
  function resizeTo(c,W,H){
    var cur=c;
    while(cur.width/2>=W){var h=mk(Math.round(cur.width/2),Math.round(cur.height/2)),hx=h.getContext('2d');hx.imageSmoothingQuality='high';hx.drawImage(cur,0,0,h.width,h.height);cur=h}
    var o=mk(W,H),ox=o.getContext('2d');ox.imageSmoothingQuality='high';ox.drawImage(cur,0,0,W,H);return o;
  }
  function aiUpscale(src){ // AI super-resolution, one small tile at a time so big photos do not freeze or crash the page
    var W=src.width,H=src.height,CORE=88,P=8,out=mk(W*4,H*4),tiles=[],i=0,gpu=gpuOk,t0=Date.now(),sc=src.getContext('2d');
    out.getContext('2d').imageSmoothingQuality='high';
    function flat(sx,sy,cw,ch){ // plain sky, walls, studio backdrops: nothing for the AI to add, so a normal resize is enough
      var d=sc.getImageData(sx,sy,cw,ch).data,n=cw*ch,m=0,v=0,k;
      for(k=0;k<d.length;k+=4)m+=d[k]+d[k+1]+d[k+2];m/=n*3;
      for(k=0;k<d.length;k+=4){var a=d[k]-m,b=d[k+1]-m,c=d[k+2]-m;v+=a*a+b*b+c*c}
      return v/(n*3)<6;
    }
    for(var y=0;y<H;y+=CORE)for(var x=0;x<W;x+=CORE)tiles.push([x,y]);
    return loadAI().then(function(up){
      function next(){
        if(cancelled)throw new Error('Cancelled.');
        if(i>=tiles.length)return out;
        var sx=tiles[i][0],sy=tiles[i][1],cw=Math.min(CORE,W-sx),ch=Math.min(CORE,H-sy),
            x0=Math.max(0,sx-P),y0=Math.max(0,sy-P),x1=Math.min(W,sx+cw+P),y1=Math.min(H,sy+ch+P),t=mk(x1-x0,y1-y0);
        t.getContext('2d').drawImage(src,x0,y0,t.width,t.height,0,0,t.width,t.height);
        if(flat(sx,sy,cw,ch)){out.getContext('2d').drawImage(src,sx,sy,cw,ch,sx*4,sy*4,cw*4,ch*4);i++;return next()}
        var left=i?Math.round((Date.now()-t0)/i*(tiles.length-i)/1000):0;
        say('Enhancing with AI… '+Math.round(i/tiles.length*100)+'%'+(left>5?' · about '+(left>90?Math.round(left/60)+' min':left+' s')+' left':''));
        return tick().then(function(){return blobOf(t)}).then(function(b){
          var u=URL.createObjectURL(b);
          return up(u).then(function(o){URL.revokeObjectURL(u);return o},function(e){URL.revokeObjectURL(u);throw e});
        }).then(rawCanvas).then(function(oc){
          var s=4; // the model always enlarges 4x; its output can carry extra padding, so never measure the scale from the output size
          out.getContext('2d').drawImage(oc,(sx-x0)*s,(sy-y0)*s,cw*s,ch*s,sx*s,sy*s,cw*s,ch*s);
          i++;return next();
        },function(e){
          if(gpu&&i===0){gpuOk=false;aiPipe=null;return aiUpscale(src)} // graphics card not supported: retry on CPU
          throw e;
        });
      }
      return next();
    });
  }
  $('dostop').addEventListener('click',function(){cancelled=true;say('Cancelling…')});
  $('dohd').addEventListener('click',function(){
    run(this,'Enhancing with AI',function(){
      var T=+$('scale').value,L=Math.max(work.width,work.height),st=$('dostop');
      if(ENHANCE_API){
        return blobOf(work).then(function(b){
          var f=new FormData();f.append('image',b);f.append('target',T);
          return fetch(ENHANCE_API,{method:'POST',body:f});
        }).then(function(res){if(!res.ok)throw new Error('The AI server returned an error.');return res.blob()})
          .then(toCanvas).then(function(c){note='Done. Now '+c.width+'×'+c.height+'. Drag the handle to compare.';return done(c)});
      }
      cancelled=false;st.hidden=false;
      var need4=Math.min(Math.ceil(T/4),640),k=Math.min(1,need4/L),src=mk(Math.round(work.width*k),Math.round(work.height*k)),sx=src.getContext('2d');
      sx.fillStyle='#fff';sx.fillRect(0,0,src.width,src.height);sx.imageSmoothingQuality='high';sx.drawImage(work,0,0,src.width,src.height);
      var fin=function(r){st.hidden=true;return r},bad=function(e){st.hidden=true;throw e};
      return aiUpscale(src).then(function(big){
        var s=T/Math.max(big.width,big.height),W=Math.round(big.width*s),H=Math.round(big.height*s),out=resizeTo(big,W,H);
        unsharp(out,.5,Math.max(.8,T/1600));
        note='Done. AI enhanced to '+W+'×'+H+'. Drag the handle to compare.';
        return done(out);
      }).then(fin,bad);
    });
  });

  /* ---------- extend in any direction ---------- */
  ['el','et','er','eb'].forEach(function(id){ // no stray zeros: "010" becomes "10", and tapping a box selects its number
    var i=$(id);
    i.addEventListener('focus',function(){var s=this;setTimeout(function(){try{s.select()}catch(e){}},0)});
    i.addEventListener('input',function(){
      var v=this.value;
      if(/^0+\d/.test(v))this.value=v.replace(/^0+(?=\d)/,'');
    });
    i.addEventListener('blur',function(){if(this.value==='')this.value='0'});
  });
  $('doext').addEventListener('click',function(){
    run(this,'Extending',function(){
      var L=+$('el').value||0,T=+$('et').value||0,R=+$('er').value||0,B=+$('eb').value||0;
      if(!(L+T+R+B))throw new Error('Add pixels to at least one side.');
      var W=work.width+L+R,H=work.height+T+B;
      if(Math.max(W,H)>6000)throw new Error('Result would be too large. Use smaller values.');
      var before=mk(W,H);before.getContext('2d').drawImage(work,L,T);
      if(EXTEND_API){
        var m=mk(W,H),mx=m.getContext('2d');
        mx.fillStyle='#fff';mx.fillRect(0,0,W,H);mx.fillStyle='#000';mx.fillRect(L,T,work.width,work.height);
        return Promise.all([blobOf(before),blobOf(m)]).then(function(p){
          var f=new FormData();f.append('image',p[0]);f.append('mask',p[1]);
          return fetch(EXTEND_API,{method:'POST',body:f});
        }).then(function(res){if(!res.ok)throw new Error('The AI server returned an error.');return res.blob()})
          .then(toCanvas).then(function(c){return done(c,before)});
      }
      var c=mk(W,H),x=c.getContext('2d'),k=Math.max(W/work.width,H/work.height);
      x.filter='blur(40px)';
      var g=120;x.drawImage(work,(W-work.width*k)/2-g,(H-work.height*k)/2-g,work.width*k+2*g,work.height*k+2*g);
      x.filter='none';x.drawImage(work,L,T);
      return done(c,before);
    });
  });

  /* ---------- result buttons ---------- */
  $('rdl').addEventListener('click',function(){
    if(!result)return;
    blobOf(result).then(function(b){
      var a=document.createElement('a');a.href=url(b);a.download=name+'-'+tab+'.png';
      document.body.appendChild(a);a.click();a.remove();
    });
  });
  $('rsend').addEventListener('click',function(){
    if(!result)return;
    var fname=name+'-'+tab+'.png';
    blobOf(result).then(function(b){
      var f=new File([b],fname,{type:'image/png'});
      if(window.anyformatAdd)window.anyformatAdd(f);
      else{var dt=new DataTransfer(),fi=$('file');dt.items.add(f);fi.files=dt.files;fi.dispatchEvent(new Event('change'))}
      setTab('convert'); // the converter panel is hidden while an edit tool is open
      document.querySelector('.drop').scrollIntoView({behavior:'smooth',block:'center'});
    });
  });
  $('rkeep').addEventListener('click',function(){if(result){work=result;show();say('Result is now your working image.')}});
})();