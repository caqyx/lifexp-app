// [MODULE] Cube skin rendering - drawSkin() and its private path helpers.
// [MODULE] Split out of cube_master.js - lines moved verbatim, no logic changed.
// [MODULE] Load order matters: see the script tags at the bottom of index.html.
// ══════════════════════════════════════════════════
// SKIN SYSTEM — canvas drawing functions
// ══════════════════════════════════════════════════
function drawSkin(ctx2, id, x, y, size, t) {
  const s = size, cx = x+s/2, cy = y+s/2, r = s/2;
  ctx2.save();
  ctx2.translate(x, y);

  switch(id) {

    // ── PATTERNS ──
    // ── PATTERNS (geometric + neon) ──

    case 'default': {
      // "CORE" — concentric squares with neon pulse from center
      ctx2.fillStyle='#020210'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const pulse = .7 + .3*Math.sin(t*.06);
      // concentric rounded squares
      const rings = [
        {r:s*.48, col:`rgba(0,255,220,${.15*pulse})`},
        {r:s*.36, col:`rgba(0,200,255,${.3*pulse})`},
        {r:s*.24, col:`rgba(0,160,255,${.5*pulse})`},
        {r:s*.13, col:`rgba(100,220,255,${.75*pulse})`},
      ];
      for(const rg of rings){
        const off=s/2-rg.r;
        ctx2.beginPath(); ctx2.roundRect(off,off,rg.r*2,rg.r*2,rg.r*.2);
        ctx2.strokeStyle=rg.col; ctx2.lineWidth=1.5; ctx2.stroke();
      }
      // center — bright dot
      const gcore=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.1);
      gcore.addColorStop(0,'rgba(255,255,255,.9)');
      gcore.addColorStop(1,'rgba(0,255,220,0)');
      ctx2.fillStyle=gcore; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.1,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'stripes': {
      // "HEX" — hexagonal grid with neon outline
      ctx2.fillStyle='#050518'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const hr=s*.12, hh=hr*Math.sqrt(3);
      const hexAlpha=.55+.2*Math.sin(t*.04);
      ctx2.strokeStyle=`rgba(255,60,180,${hexAlpha})`; ctx2.lineWidth=1;
      function _hex(cx,cy,r){
        ctx2.beginPath();
        for(let i=0;i<6;i++){
          const a=Math.PI/6+i*Math.PI/3;
          i===0?ctx2.moveTo(cx+r*Math.cos(a),cy+r*Math.sin(a))
               :ctx2.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
        }
        ctx2.closePath(); ctx2.stroke();
      }
      for(let row=-1;row<4;row++){
        for(let col=-1;col<4;col++){
          const cx=col*hr*3+(row%2)*hr*1.5;
          const cy=row*hh;
          _hex(cx,cy,hr*.92);
        }
      }
      // neon glow on center hex
      ctx2.shadowColor='#ff40b0'; ctx2.shadowBlur=8;
      _hex(s/2,s/2,hr*.92);
      ctx2.shadowBlur=0;
      ctx2.restore(); break;
    }

    case 'grid': {
      // "CIRCUIT" — printed circuit board pattern
      ctx2.fillStyle='#001a08'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const cAlpha=.5+.25*Math.sin(t*.05);
      ctx2.strokeStyle=`rgba(0,255,100,${cAlpha})`; ctx2.lineWidth=.8;
      // horizontal and vertical lines (sparse grid)
      const step=s/5;
      for(let i=0;i<=5;i++){
        ctx2.beginPath();ctx2.moveTo(i*step,0);ctx2.lineTo(i*step,s);ctx2.stroke();
        ctx2.beginPath();ctx2.moveTo(0,i*step);ctx2.lineTo(s,i*step);ctx2.stroke();
      }
      // nodes at intersections
      ctx2.fillStyle=`rgba(0,255,100,${cAlpha})`;
      for(let i=0;i<=5;i++) for(let j=0;j<=5;j++){
        ctx2.beginPath(); ctx2.arc(i*step,j*step,1.8,0,Math.PI*2); ctx2.fill();
      }
      // extra "path" lines — L-shapes
      ctx2.strokeStyle=`rgba(0,200,80,${cAlpha*.8})`; ctx2.lineWidth=1.5;
      const paths=[
        [[1*step,0],[1*step,2*step],[3*step,2*step]],
        [[4*step,5*step],[4*step,3*step],[2*step,3*step],[2*step,1*step]],
        [[0,4*step],[3*step,4*step],[3*step,5*step]],
      ];
      for(const path of paths){
        ctx2.beginPath(); ctx2.moveTo(path[0][0],path[0][1]);
        for(let k=1;k<path.length;k++) ctx2.lineTo(path[k][0],path[k][1]);
        ctx2.stroke();
      }
      // pulsing nodes at path endpoints
      ctx2.shadowColor='#00ff64'; ctx2.shadowBlur=6;
      ctx2.fillStyle=`rgba(0,255,100,${.7+.3*Math.sin(t*.08)})`;
      [[1*step,2*step],[3*step,2*step],[4*step,3*step],[2*step,1*step],[3*step,5*step]].forEach(([px,py])=>{
        ctx2.beginPath(); ctx2.arc(px,py,2.5,0,Math.PI*2); ctx2.fill();
      });
      ctx2.shadowBlur=0;
      ctx2.restore(); break;
    }

    case 'gradient': {
      // "PRISM" — triangular geometry with prism effect
      ctx2.fillStyle='#080010'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      // 4 triangles forming a rhombus/diamond with different gradients
      const prismColors=[
        ['#ff0088','#ff8800'],  // left
        ['#ff8800','#ffff00'],  // top
        ['#ffff00','#00ffcc'],  // right
        ['#00ffcc','#0088ff'],  // bottom
      ];
      const tris=[
        [[0,s/2],[s/2,0],[s/2,s/2]],    // left
        [[s/2,0],[s,s/2],[s/2,s/2]],    // upper-right
        [[s,s/2],[s/2,s],[s/2,s/2]],    // lower-right
        [[s/2,s],[0,s/2],[s/2,s/2]],    // lower-left
      ];
      tris.forEach(([a,b,c],i)=>{
        const g=ctx2.createLinearGradient(a[0],a[1],b[0],b[1]);
        g.addColorStop(0,prismColors[i][0]+'cc');
        g.addColorStop(1,prismColors[i][1]+'cc');
        ctx2.fillStyle=g;
        ctx2.beginPath(); ctx2.moveTo(a[0],a[1]); ctx2.lineTo(b[0],b[1]); ctx2.lineTo(c[0],c[1]); ctx2.closePath(); ctx2.fill();
      });
      // lines between triangles with glow
      ctx2.strokeStyle='rgba(255,255,255,.25)'; ctx2.lineWidth=.8;
      [[0,s/2,s/2,0],[s/2,0,s,s/2],[s,s/2,s/2,s],[s/2,s,0,s/2],[s/2,s/2,s/2,0],[s/2,s/2,s,s/2],[s/2,s/2,s/2,s],[s/2,s/2,0,s/2]].forEach(([x1,y1,x2,y2])=>{
        ctx2.beginPath(); ctx2.moveTo(x1,y1); ctx2.lineTo(x2,y2); ctx2.stroke();
      });
      // centrum
      const gp=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.08);
      gp.addColorStop(0,'rgba(255,255,255,.9)'); gp.addColorStop(1,'rgba(255,255,255,0)');
      ctx2.fillStyle=gp; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.08,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'rainbow': {
      // "VORTEX" — spiral of rotating segments
      ctx2.fillStyle='#04000a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const spin=t*.03;
      const segs=6;
      for(let i=0;i<segs;i++){
        const a1=spin+i*(Math.PI*2/segs);
        const a2=a1+Math.PI*2/segs*.85;
        for(let ring=0;ring<3;ring++){
          const r1=s*.12+ring*s*.12, r2=r1+s*.1;
          const hue=((t*1.5+i*(360/segs)+ring*40))%360;
          const g=ctx2.createRadialGradient(s/2,s/2,r1,s/2,s/2,r2);
          g.addColorStop(0,`hsla(${hue},100%,65%,.9)`);
          g.addColorStop(1,`hsla(${(hue+40)%360},100%,55%,.4)`);
          ctx2.fillStyle=g;
          ctx2.beginPath();
          ctx2.arc(s/2,s/2,r2,a1,a2);
          ctx2.arc(s/2,s/2,r1,a2,a1,true);
          ctx2.closePath(); ctx2.fill();
        }
      }
      // center — white pulse
      const gv=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.08);
      gv.addColorStop(0,'rgba(255,255,255,.95)'); gv.addColorStop(1,'rgba(255,255,255,0)');
      ctx2.fillStyle=gv; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.08,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }
    // ── EFEKTY (GD-inspired) ──

    case 'glitch': {
      ctx2.fillStyle='#000008'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      ctx2.fillStyle='rgba(0,20,40,.8)'; ctx2.fillRect(0,0,s,s);
      const glColors=['#00ffff','#ff00ff','#ffff00','#ff0080','#00ff80'];
      const gseed=Math.floor(t*.3);
      for(let i=0;i<12;i++){
        const gx=((gseed*7+i*31)%16)*s/16;
        const gy=((gseed*13+i*17)%16)*s/16;
        const gw=((gseed*3+i*7)%6+2)*s/16;
        const col=glColors[(gseed+i)%glColors.length];
        ctx2.fillStyle=col+(i%3===0?'99':'44');
        ctx2.fillRect(gx,gy,gw,s/16);
      }
      const shift=(gseed%3)*s*.08;
      ctx2.fillStyle='rgba(0,255,255,.15)';
      for(let y2=0;y2<s;y2+=4){ ctx2.fillRect(shift,y2,s*.6,1.5); }
      ctx2.strokeStyle='rgba(255,255,255,'+((.5+.4*Math.sin(t*.2)))+')';
      ctx2.lineWidth=1.5;
      const errY=s/2+Math.sin(t*.15)*s*.1;
      ctx2.beginPath(); ctx2.moveTo(0,errY); ctx2.lineTo(s,errY+Math.sin(t*.3)*s*.05); ctx2.stroke();
      ctx2.strokeStyle='#00ffff'; ctx2.lineWidth=1; _rect(ctx2,1,1,s-2,s-2,3); ctx2.stroke();
      ctx2.restore(); break;
    }

    case 'aura': {
      ctx2.fillStyle='#020008'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const aHue=(t*1.5)%360;
      for(let layer=4;layer>=0;layer--){
        const lr=s*(.48-layer*.04);
        const la=.12+layer*.08;
        const lHue=(aHue+layer*25)%360;
        const aG=ctx2.createRadialGradient(s/2,s/2,lr*.5,s/2,s/2,lr);
        aG.addColorStop(0,'hsla('+lHue+',100%,70%,0)');
        aG.addColorStop(.7,'hsla('+lHue+',100%,65%,'+la+')');
        aG.addColorStop(1,'hsla('+((lHue+30)%360)+',100%,55%,0)');
        ctx2.fillStyle=aG; ctx2.beginPath(); ctx2.arc(s/2,s/2,lr,0,Math.PI*2); ctx2.fill();
      }
      const aC=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.2);
      aC.addColorStop(0,'rgba(255,255,255,.95)');
      aC.addColorStop(.4,'hsla('+aHue+',100%,80%,.7)');
      aC.addColorStop(1,'hsla('+aHue+',100%,60%,0)');
      ctx2.fillStyle=aC; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.2,0,Math.PI*2); ctx2.fill();
      for(let i=0;i<6;i++){
        const a=t*.04+i*Math.PI/3;
        const px=s/2+Math.cos(a)*s*.33, py=s/2+Math.sin(a)*s*.33;
        const pG=ctx2.createRadialGradient(px,py,0,px,py,s*.04);
        pG.addColorStop(0,'hsla('+((aHue+i*40)%360)+',100%,90%,.9)');
        pG.addColorStop(1,'rgba(0,0,0,0)');
        ctx2.fillStyle=pG; ctx2.beginPath(); ctx2.arc(px,py,s*.04,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'magma': {
      ctx2.fillStyle='#0a0000'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const mBg=ctx2.createRadialGradient(s/2,s*.7,0,s/2,s/2,s*.55);
      mBg.addColorStop(0,'#ff6600'); mBg.addColorStop(.4,'#cc2200');
      mBg.addColorStop(.8,'#660000'); mBg.addColorStop(1,'#1a0000');
      ctx2.fillStyle=mBg; ctx2.fillRect(0,0,s,s);
      const bubbles=[{bx:.3,by:.6,br:.12,phase:0},{bx:.65,by:.4,br:.1,phase:1.5},
        {bx:.5,by:.75,br:.09,phase:.8},{bx:.2,by:.35,br:.08,phase:2.2},{bx:.75,by:.65,br:.11,phase:.3}];
      for(const b of bubbles){
        const pulse=Math.sin(t*.08+b.phase);
        const br=s*(b.br+pulse*.015), by2=s*(b.by+pulse*.02);
        const bG=ctx2.createRadialGradient(s*b.bx,by2,0,s*b.bx,by2,br);
        bG.addColorStop(0,'rgba(255,220,50,.9)'); bG.addColorStop(.4,'rgba(255,100,0,.6)'); bG.addColorStop(1,'rgba(180,0,0,0)');
        ctx2.fillStyle=bG; ctx2.beginPath(); ctx2.arc(s*b.bx,by2,br,0,Math.PI*2); ctx2.fill();
      }
      ctx2.strokeStyle='rgba(255,180,0,.4)'; ctx2.lineWidth=.8;
      [[.1*s,.5*s,.5*s,.2*s],[.5*s,.2*s,.9*s,.6*s],[.3*s,.8*s,.7*s,.7*s]].forEach(([x1,y1,x2,y2])=>{
        ctx2.beginPath(); ctx2.moveTo(x1,y1); ctx2.lineTo(x2,y2); ctx2.stroke();
      });
      ctx2.restore(); break;
    }

    case 'void': {
      ctx2.fillStyle='#000000'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      for(let i=0;i<20;i++){
        const sx2=(Math.sin(i*137.5)*.5+.5)*s, sy2=(Math.cos(i*97.3)*.5+.5)*s;
        const sa=.2+.6*Math.abs(Math.sin(t*.04+i));
        ctx2.fillStyle='rgba(200,180,255,'+sa+')';
        ctx2.beginPath(); ctx2.arc(sx2,sy2,.7,0,Math.PI*2); ctx2.fill();
      }
      const vSpin=t*.04;
      for(let ring=0;ring<3;ring++){
        const vR1=s*(.18+ring*.08), vR2=vR1+s*.06;
        const vHue=270+ring*20;
        for(let seg=0;seg<8;seg++){
          const a1=vSpin+seg*Math.PI/4, a2=a1+Math.PI/4*.85;
          const vSG=ctx2.createRadialGradient(s/2,s/2,vR1,s/2,s/2,vR2);
          vSG.addColorStop(0,'hsla('+(vHue+seg*5)+',100%,60%,.8)');
          vSG.addColorStop(1,'hsla('+(vHue+seg*5+20)+',100%,40%,.3)');
          ctx2.fillStyle=vSG;
          ctx2.beginPath(); ctx2.arc(s/2,s/2,vR2,a1,a2); ctx2.arc(s/2,s/2,vR1,a2,a1,true); ctx2.closePath(); ctx2.fill();
        }
      }
      const vC=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.16);
      vC.addColorStop(0,'rgba(0,0,0,1)'); vC.addColorStop(.7,'rgba(0,0,0,1)'); vC.addColorStop(1,'rgba(30,0,60,.5)');
      ctx2.fillStyle=vC; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.16,0,Math.PI*2); ctx2.fill();
      ctx2.fillStyle='rgba(200,180,255,.9)';
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.025,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'neontrail': {
      ctx2.fillStyle='#000510'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const ntH=(t*2)%360;
      for(let i=4;i>=0;i--){
        const ta=1-i*.2, tx=-i*s*.12, ts=s*(1-i*.05), off=(s-ts)/2+tx;
        const ntHue=(t*2+i*20)%360;
        ctx2.fillStyle='hsla('+ntHue+',100%,65%,'+(ta*.3)+')';
        ctx2.beginPath(); ctx2.roundRect(off,off-tx*.3,ts,ts,4); ctx2.fill();
      }
      const ntG=ctx2.createLinearGradient(0,0,s,s);
      ntG.addColorStop(0,'hsl('+ntH+',100%,65%)');
      ntG.addColorStop(.5,'hsl('+((ntH+60)%360)+',100%,70%)');
      ntG.addColorStop(1,'hsl('+((ntH+120)%360)+',100%,60%)');
      ctx2.fillStyle=ntG; _rect(ctx2,s*.05,s*.05,s*.9,s*.9,5); ctx2.fill();
      ctx2.shadowColor='hsl('+ntH+',100%,60%)'; ctx2.shadowBlur=10;
      ctx2.strokeStyle='hsla('+ntH+',100%,80%,.8)'; ctx2.lineWidth=1.5;
      _rect(ctx2,s*.05,s*.05,s*.9,s*.9,5); ctx2.stroke();
      ctx2.shadowBlur=0;
      ctx2.strokeStyle='rgba(255,255,255,.25)'; ctx2.lineWidth=1;
      for(let i=1;i<4;i++){ ctx2.beginPath(); ctx2.moveTo(s*.1,s*i/4); ctx2.lineTo(s*.9,s*i/4); ctx2.stroke(); }
      ctx2.restore(); break;
    }

    // ── SHAPES (GD-inspired) ──

    case 'spike': {
      ctx2.fillStyle='#000a0a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const spG=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.5);
      spG.addColorStop(0,'rgba(0,255,200,.15)'); spG.addColorStop(1,'rgba(0,0,0,0)');
      ctx2.fillStyle=spG; ctx2.fillRect(0,0,s,s);
      const sqG=ctx2.createLinearGradient(0,0,s,s);
      sqG.addColorStop(0,'#00ffcc'); sqG.addColorStop(1,'#0088ff');
      ctx2.fillStyle=sqG; _rect(ctx2,s*.25,s*.25,s*.5,s*.5,2); ctx2.fill();
      const spikes=[[s/2,s*.04,s*.32,s*.28,s*.68,s*.28],[s*.96,s/2,s*.72,s*.32,s*.72,s*.68],
        [s/2,s*.96,s*.68,s*.72,s*.32,s*.72],[s*.04,s/2,s*.28,s*.68,s*.28,s*.32]];
      spikes.forEach(([ax,ay,bx,by,cx2,cy2])=>{
        const sG2=ctx2.createLinearGradient(ax,ay,(bx+cx2)/2,(by+cy2)/2);
        sG2.addColorStop(0,'rgba(255,255,255,.9)'); sG2.addColorStop(1,'rgba(0,200,150,.6)');
        ctx2.fillStyle=sG2;
        ctx2.beginPath(); ctx2.moveTo(ax,ay); ctx2.lineTo(bx,by); ctx2.lineTo(cx2,cy2); ctx2.closePath(); ctx2.fill();
        ctx2.strokeStyle='rgba(0,255,200,.5)'; ctx2.lineWidth=.5; ctx2.stroke();
      });
      ctx2.shadowColor='#00ffcc'; ctx2.shadowBlur=8;
      ctx2.strokeStyle='rgba(0,255,200,.8)'; ctx2.lineWidth=1;
      _rect(ctx2,s*.25,s*.25,s*.5,s*.5,2); ctx2.stroke();
      ctx2.shadowBlur=0; ctx2.restore(); break;
    }

    case 'robot': {
      ctx2.fillStyle='#050510'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const rBg=ctx2.createLinearGradient(0,0,0,s);
      rBg.addColorStop(0,'#2a2a3a'); rBg.addColorStop(.5,'#1a1a2a'); rBg.addColorStop(1,'#0a0a18');
      ctx2.fillStyle=rBg; _rect(ctx2,s*.04,s*.04,s*.92,s*.92,4); ctx2.fill();
      ctx2.strokeStyle='#4488ff'; ctx2.lineWidth=1.5;
      ctx2.shadowColor='#4488ff'; ctx2.shadowBlur=6;
      _rect(ctx2,s*.04,s*.04,s*.92,s*.92,4); ctx2.stroke(); ctx2.shadowBlur=0;
      const eyePulse=.6+.4*Math.sin(t*.1);
      [[s*.3,s*.38],[s*.7,s*.38]].forEach(([ex,ey])=>{
        const eG=ctx2.createRadialGradient(ex,ey,0,ex,ey,s*.1);
        eG.addColorStop(0,'rgba(255,255,255,.95)');
        eG.addColorStop(.4,'rgba(0,180,255,'+eyePulse+')');
        eG.addColorStop(1,'rgba(0,60,180,.3)');
        ctx2.fillStyle=eG; ctx2.beginPath(); ctx2.arc(ex,ey,s*.1,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle='#000020'; ctx2.beginPath(); ctx2.arc(ex,ey,s*.04,0,Math.PI*2); ctx2.fill();
        ctx2.fillStyle='rgba(255,255,255,.7)'; ctx2.beginPath(); ctx2.arc(ex-s*.03,ey-s*.03,s*.025,0,Math.PI*2); ctx2.fill();
      });
      ctx2.strokeStyle='#4488ff'; ctx2.lineWidth=1;
      ctx2.beginPath(); ctx2.moveTo(s*.25,s*.68); ctx2.lineTo(s*.75,s*.68); ctx2.stroke();
      for(let i=0;i<5;i++){
        ctx2.fillStyle=i%2===0?'rgba(0,200,255,'+eyePulse+')':'rgba(100,100,255,.3)';
        ctx2.beginPath(); ctx2.arc(s*.28+i*s*.11,s*.68,s*.025,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'wave': {
      ctx2.fillStyle='#040010'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const wBg=ctx2.createLinearGradient(0,0,s,s);
      wBg.addColorStop(0,'rgba(80,0,160,.4)'); wBg.addColorStop(1,'rgba(0,80,200,.3)');
      ctx2.fillStyle=wBg; ctx2.fillRect(0,0,s,s);
      for(let w=0;w<3;w++){
        const wPhase=t*.06+w*Math.PI*.6;
        const wY=s/2+Math.sin(wPhase)*s*.12;
        const wAmp=s*.08-w*s*.02;
        const wFreq=3+w, wHue=200+w*40;
        ctx2.strokeStyle='hsla('+wHue+',100%,70%,'+((.7-w*.2))+')';
        ctx2.lineWidth=2-w*.4;
        ctx2.shadowColor='hsl('+wHue+',100%,60%)'; ctx2.shadowBlur=w===0?8:3;
        ctx2.beginPath();
        for(let px2=0;px2<=s;px2+=2){
          const py2=wY+Math.sin(px2/s*Math.PI*wFreq+wPhase)*wAmp;
          px2===0?ctx2.moveTo(px2,py2):ctx2.lineTo(px2,py2);
        }
        ctx2.stroke();
      }
      ctx2.shadowBlur=0;
      const shipY=s/2+Math.sin(t*.06)*s*.12;
      const shG=ctx2.createLinearGradient(s*.15,shipY-s*.12,s*.4,shipY+s*.12);
      shG.addColorStop(0,'#ffffff'); shG.addColorStop(1,'#8844ff');
      ctx2.fillStyle=shG;
      ctx2.beginPath(); ctx2.moveTo(s*.38,shipY); ctx2.lineTo(s*.16,shipY-s*.12); ctx2.lineTo(s*.16,shipY+s*.12); ctx2.closePath(); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'ball': {
      ctx2.fillStyle='#020008'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const ballHue=(t*1.2)%360;
      const bGlow=ctx2.createRadialGradient(s/2,s/2,s*.3,s/2,s/2,s*.5);
      bGlow.addColorStop(0,'rgba(0,0,0,0)');
      bGlow.addColorStop(1,'hsla('+ballHue+',100%,60%,.2)');
      ctx2.fillStyle=bGlow; ctx2.fillRect(0,0,s,s);
      const bG=ctx2.createRadialGradient(s*.35,s*.32,0,s/2,s/2,s*.4);
      bG.addColorStop(0,'rgba(255,255,255,.9)');
      bG.addColorStop(.2,'hsla('+ballHue+',100%,75%,.9)');
      bG.addColorStop(.7,'hsla('+((ballHue+120)%360)+',100%,50%,.8)');
      bG.addColorStop(1,'hsla('+((ballHue+240)%360)+',100%,30%,.9)');
      ctx2.fillStyle=bG; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.4,0,Math.PI*2); ctx2.fill();
      ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(t*.05);
      ctx2.strokeStyle='hsla('+((ballHue+180)%360)+',100%,80%,.4)'; ctx2.lineWidth=1;
      for(let i=0;i<3;i++){ ctx2.beginPath(); ctx2.arc(0,0,s*(.12+i*.09),0,Math.PI*2); ctx2.stroke(); }
      ctx2.strokeStyle='rgba(255,255,255,.25)'; ctx2.lineWidth=1;
      ctx2.beginPath(); ctx2.moveTo(-s*.35,0); ctx2.lineTo(s*.35,0); ctx2.stroke();
      ctx2.beginPath(); ctx2.moveTo(0,-s*.35); ctx2.lineTo(0,s*.35); ctx2.stroke();
      ctx2.restore();
      ctx2.fillStyle='rgba(255,255,255,.55)';
      ctx2.beginPath(); ctx2.ellipse(s*.33,s*.3,s*.09,s*.055,-Math.PI/5,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'ufo': {
      ctx2.fillStyle='#000508'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const uSpin=t*.035;
      // outer electric arcs
      for(let i=0;i<8;i++){
        const ua=uSpin+i*Math.PI/4;
        const ur1=s*.42, ur2=s*.46+Math.sin(t*.15+i)*s*.03;
        const ux1=s/2+Math.cos(ua)*ur1, uy1=s/2+Math.sin(ua)*ur1*.5;
        const ux2=s/2+Math.cos(ua+.15)*ur2, uy2=s/2+Math.sin(ua+.15)*ur2*.5;
        ctx2.strokeStyle='rgba(0,255,180,'+(.3+.3*Math.sin(t*.2+i))+')';
        ctx2.lineWidth=.8; ctx2.beginPath(); ctx2.moveTo(ux1,uy1); ctx2.lineTo(ux2,uy2); ctx2.stroke();
      }
      // ring
      ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(uSpin*.5);
      const ringW=s*.06;
      for(let seg=0;seg<12;seg++){
        const sa=seg*Math.PI/6, ea=(seg+.85)*Math.PI/6;
        const rHue=120+seg*15;
        ctx2.strokeStyle='hsla('+rHue+',100%,'+(50+Math.sin(t*.1+seg)*20)+'%,.85)';
        ctx2.lineWidth=ringW; ctx2.beginPath(); ctx2.ellipse(0,0,s*.38,s*.14,0,sa,ea); ctx2.stroke();
      }
      for(let i=0;i<4;i++){
        const ua2=i*Math.PI/2;
        const ax=Math.cos(ua2)*s*.38, ay=Math.sin(ua2)*s*.14;
        const rG=ctx2.createRadialGradient(ax,ay,0,ax,ay,s*.04);
        rG.addColorStop(0,'rgba(0,255,180,1)'); rG.addColorStop(1,'rgba(0,255,180,0)');
        ctx2.fillStyle=rG; ctx2.beginPath(); ctx2.arc(ax,ay,s*.04,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore();
      // lower metallic hemisphere
      const metG=ctx2.createLinearGradient(s*.1,s*.55,s*.9,s*.88);
      metG.addColorStop(0,'#334455'); metG.addColorStop(.4,'#88aacc'); metG.addColorStop(.7,'#445566'); metG.addColorStop(1,'#223344');
      ctx2.fillStyle=metG; ctx2.beginPath(); ctx2.ellipse(s/2,s*.68,s*.36,s*.2,0,0,Math.PI); ctx2.fill();
      ctx2.strokeStyle='rgba(100,200,255,.3)'; ctx2.lineWidth=.7;
      for(let i=1;i<4;i++){ ctx2.beginPath(); ctx2.ellipse(s/2,s*.68,s*(.36-i*.08),s*(.2-i*.04),0,0,Math.PI); ctx2.stroke(); }
      // upper glass dome
      const domeG=ctx2.createRadialGradient(s*.38,s*.3,0,s/2,s*.48,s*.38);
      domeG.addColorStop(0,'rgba(200,255,240,.7)'); domeG.addColorStop(.3,'rgba(0,200,150,.3)');
      domeG.addColorStop(.7,'rgba(0,100,180,.15)'); domeG.addColorStop(1,'rgba(0,50,100,.05)');
      ctx2.fillStyle=domeG; ctx2.beginPath(); ctx2.ellipse(s/2,s*.48,s*.36,s*.28,0,Math.PI,0); ctx2.fill();
      // energy core
      const coreHue=(t*3)%360;
      const coreG=ctx2.createRadialGradient(s/2,s*.46,0,s/2,s*.46,s*.14);
      coreG.addColorStop(0,'rgba(255,255,255,.95)');
      coreG.addColorStop(.3,'hsla('+coreHue+',100%,70%,.8)');
      coreG.addColorStop(.7,'hsla('+((coreHue+120)%360)+',100%,50%,.4)');
      coreG.addColorStop(1,'rgba(0,0,0,0)');
      ctx2.fillStyle=coreG; ctx2.beginPath(); ctx2.arc(s/2,s*.46,s*.14,0,Math.PI*2); ctx2.fill();
      // rotating inner orbits
      ctx2.save(); ctx2.translate(s/2,s*.46); ctx2.rotate(t*.08);
      ctx2.strokeStyle='hsla('+coreHue+',100%,75%,.35)'; ctx2.lineWidth=.8;
      ctx2.beginPath(); ctx2.ellipse(0,0,s*.1,s*.04,0,0,Math.PI*2); ctx2.stroke();
      ctx2.rotate(Math.PI/2);
      ctx2.beginPath(); ctx2.ellipse(0,0,s*.1,s*.04,0,0,Math.PI*2); ctx2.stroke();
      ctx2.restore();
      // dome reflection
      ctx2.fillStyle='rgba(255,255,255,.25)';
      ctx2.beginPath(); ctx2.ellipse(s*.38,s*.34,s*.1,s*.06,-Math.PI/5,0,Math.PI*2); ctx2.fill();
      // LED lights
      for(let i=0;i<5;i++){
        const lOn=Math.sin(t*.12+i*.8)>.2;
        ctx2.fillStyle=lOn?'hsla('+((coreHue+i*30)%360)+',100%,70%,.9)':'rgba(30,60,80,.4)';
        ctx2.beginPath(); ctx2.arc(s*(.28+i*.11),s*.74,s*.025,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    default: {
      ctx2.fillStyle='#00e0c6'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
    }

    // ── PRESTIGE ──
    case 'sun': {
      // background — dark space
      ctx2.fillStyle='#0a0510'; ctx2.beginPath(); ctx2.arc(s/2,s/2,s/2,0,Math.PI*2); ctx2.fill();
      // corona — outer glow
      const gc=ctx2.createRadialGradient(s/2,s/2,s*.25,s/2,s/2,s*.5);
      gc.addColorStop(0,'rgba(255,200,0,.0)');
      gc.addColorStop(.6,'rgba(255,120,0,.3)');
      gc.addColorStop(1,'rgba(255,60,0,.0)');
      ctx2.fillStyle=gc; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.5,0,Math.PI*2); ctx2.fill();
      // rays — 12 animated rays
      const numRays=12;
      for(let i=0;i<numRays;i++){
        const angle=i*Math.PI*2/numRays + t*.008;
        const pulse=0.7+Math.sin(t*.06+i)*0.3;
        const r1=s*.3, r2=s*(.42+Math.sin(t*.04+i*1.3)*.05);
        const w=s*.025+Math.sin(t*.05+i)*.01;
        ctx2.save();
        ctx2.translate(s/2,s/2); ctx2.rotate(angle);
        const gr=ctx2.createLinearGradient(0,r1,0,r2);
        gr.addColorStop(0,`rgba(255,220,80,${pulse*.9})`);
        gr.addColorStop(1,'rgba(255,100,0,0)');
        ctx2.fillStyle=gr;
        ctx2.beginPath();
        ctx2.moveTo(-w,r1); ctx2.lineTo(w,r1);
        ctx2.lineTo(w*.3,r2); ctx2.lineTo(-w*.3,r2);
        ctx2.closePath(); ctx2.fill();
        ctx2.restore();
      }
      // sun core
      const gs=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.28);
      gs.addColorStop(0,'#ffffff');
      gs.addColorStop(.2,'#ffffa0');
      gs.addColorStop(.5,'#ffcc00');
      gs.addColorStop(.8,'#ff6600');
      gs.addColorStop(1,'#cc2200');
      ctx2.fillStyle=gs;
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.28,0,Math.PI*2); ctx2.fill();
      // surface sunspots
      ctx2.fillStyle='rgba(180,60,0,.35)';
      for(let i=0;i<3;i++){
        const sx=s/2+Math.cos(t*.02+i*2.1)*s*.1;
        const sy=s/2+Math.sin(t*.015+i*2.1)*s*.09;
        ctx2.beginPath(); ctx2.ellipse(sx,sy,s*.04,s*.025,t*.01+i,0,Math.PI*2); ctx2.fill();
      } break;
    }

    case 'blackhole': {
      // background — black space with stars
      ctx2.fillStyle='#000008';
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s/2,0,Math.PI*2); ctx2.fill();
      for(let i=0;i<18;i++){
        const sx=(Math.sin(i*137.5)*0.5+0.5)*s;
        const sy=(Math.cos(i*97.3)*0.5+0.5)*s;
        const sr=0.6+Math.sin(t*.1+i)*.3;
        ctx2.fillStyle=`rgba(255,255,255,${.4+Math.sin(t*.08+i)*.3})`;
        ctx2.beginPath(); ctx2.arc(sx,sy,sr,0,Math.PI*2); ctx2.fill();
      }
      // accretion disk — rotating rings
      const rings=[
        {r1:s*.42,r2:s*.48,col1:'rgba(255,120,0,.7)',col2:'rgba(255,60,0,0)'},
        {r1:s*.33,r2:s*.41,col1:'rgba(200,100,255,.5)',col2:'rgba(100,0,200,0)'},
        {r1:s*.25,r2:s*.33,col1:'rgba(100,150,255,.4)',col2:'rgba(0,50,200,0)'},
      ];
      for(const ring of rings){
        ctx2.save();
        ctx2.translate(s/2,s/2); ctx2.rotate(t*.015);
        const gr=ctx2.createRadialGradient(0,0,ring.r1,0,0,ring.r2);
        gr.addColorStop(0,ring.col2); gr.addColorStop(.5,ring.col1); gr.addColorStop(1,ring.col2);
        ctx2.fillStyle=gr;
        ctx2.beginPath(); ctx2.arc(0,0,ring.r2,0,Math.PI*2);
        ctx2.arc(0,0,ring.r1,0,Math.PI*2,true);
        ctx2.fill(); ctx2.restore();
      }
      // center — black hole
      const gb=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.24);
      gb.addColorStop(0,'#000000');
      gb.addColorStop(.7,'#000000');
      gb.addColorStop(.85,'rgba(80,0,120,.5)');
      gb.addColorStop(1,'rgba(0,0,0,0)');
      ctx2.fillStyle=gb;
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.24,0,Math.PI*2); ctx2.fill();
      // photosphere — white flash
      ctx2.fillStyle='rgba(255,255,255,.9)';
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.04,0,Math.PI*2); ctx2.fill(); break;
    }

    case 'galaxy': {
      // background — deep space
      ctx2.fillStyle='#020008';
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s/2,0,Math.PI*2); ctx2.fill();
      // background nebula
      for(let i=0;i<3;i++){
        const nx=s/2+Math.cos(i*2.1)*s*.15, ny=s/2+Math.sin(i*2.1)*s*.12;
        const gn=ctx2.createRadialGradient(nx,ny,0,nx,ny,s*.22);
        const cols=['rgba(60,0,120,.25)','rgba(0,40,120,.2)','rgba(80,0,60,.2)'];
        gn.addColorStop(0,cols[i]); gn.addColorStop(1,'rgba(0,0,0,0)');
        ctx2.fillStyle=gn; ctx2.beginPath(); ctx2.arc(nx,ny,s*.22,0,Math.PI*2); ctx2.fill();
      }
      // spiral arms — hundreds of stars
      const armCount=2, starsPerArm=60;
      const spinAngle=t*.006;
      for(let arm=0;arm<armCount;arm++){
        const armOffset=arm*Math.PI;
        for(let i=0;i<starsPerArm;i++){
          const frac=i/starsPerArm;
          const angle=armOffset + frac*Math.PI*3 + spinAngle;
          const spread=s*.04+frac*s*.18;
          const dist2=frac*s*.44;
          const jx=(Math.sin(i*73.1)*0.5)*spread;
          const jy=(Math.cos(i*97.3)*0.5)*spread;
          const sx=s/2 + Math.cos(angle)*dist2 + jx;
          const sy=s/2 + Math.sin(angle)*dist2 + jy;
          // skip stars outside circle
          if((sx-s/2)**2+(sy-s/2)**2>(s*.47)**2) continue;
          const brightness=.3+frac*.7;
          const size=.4+Math.abs(Math.sin(i*31.7+arm*17.3))*.8;
          // color based on position in arm
          const hue=220+frac*80; // blue→purple→white
          ctx2.fillStyle=`hsla(${hue},80%,${60+frac*40}%,${brightness})`;
          ctx2.beginPath(); ctx2.arc(sx,sy,size,0,Math.PI*2); ctx2.fill();
        }
      }
      // extra random background stars
      for(let i=0;i<30;i++){
        const ax=(Math.sin(i*43.7)*.5+.5)*s;
        const ay=(Math.cos(i*67.1)*.5+.5)*s;
        if((ax-s/2)**2+(ay-s/2)**2>(s*.47)**2) continue;
        ctx2.fillStyle=`rgba(255,255,255,${.1+Math.sin(t*.05+i)*.08})`;
        ctx2.beginPath(); ctx2.arc(ax,ay,.5,0,Math.PI*2); ctx2.fill();
      }
      // galaxy center — bright core
      const gg=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.12);
      gg.addColorStop(0,'rgba(255,240,200,1)');
      gg.addColorStop(.4,'rgba(200,160,255,.8)');
      gg.addColorStop(.8,'rgba(100,80,200,.3)');
      gg.addColorStop(1,'rgba(0,0,0,0)');
      ctx2.fillStyle=gg; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.12,0,Math.PI*2); ctx2.fill(); break;
    }

    // ── VOID [2.0-s5a] ──

    case 'singularityheart': { // [2.0-s5a] [SECRET] black core + 3 accretion disks + star field
      ctx2.fillStyle='#04000a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      for(let i=0;i<22;i++){ // deterministic star field
        const sx=(Math.sin(i*137.5)*0.5+0.5)*s, sy=(Math.cos(i*89.7)*0.5+0.5)*s;
        const sa=.25+.55*Math.abs(Math.sin(t*.05+i));
        ctx2.fillStyle=`rgba(220,200,255,${sa})`;
        ctx2.beginPath(); ctx2.arc(sx,sy,.7,0,Math.PI*2); ctx2.fill();
      }
      const disks=[ // gold / violet / blue-white, alpha falls outward
        { rot:t*.02,   hue:45,  sat:100, lum:60, a:.85, r1:s*.30, r2:s*.46 },
        { rot:-t*.015, hue:280, sat:100, lum:55, a:.6,  r1:s*.20, r2:s*.32 },
        { rot:t*.03,   hue:220, sat:80,  lum:75, a:.4,  r1:s*.12, r2:s*.20 },
      ];
      for(const d of disks){
        ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(d.rot);
        const gr=ctx2.createRadialGradient(0,0,d.r1,0,0,d.r2);
        gr.addColorStop(0,`hsla(${d.hue},${d.sat}%,${d.lum}%,0)`);
        gr.addColorStop(.5,`hsla(${d.hue},${d.sat}%,${d.lum}%,${d.a})`);
        gr.addColorStop(1,`hsla(${d.hue},${d.sat}%,${d.lum}%,0)`);
        ctx2.fillStyle=gr;
        ctx2.beginPath(); ctx2.ellipse(0,0,d.r2,d.r2*.42,0,0,Math.PI*2);
        ctx2.ellipse(0,0,d.r1,d.r1*.42,0,0,Math.PI*2,true);
        ctx2.fill(); ctx2.restore();
      }
      ctx2.save(); // black core + pulsing glow
      ctx2.shadowColor='rgba(150,80,255,.9)'; ctx2.shadowBlur=8+4*Math.sin(t*.06);
      ctx2.fillStyle='#000'; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.14,0,Math.PI*2); ctx2.fill();
      ctx2.restore();
      for(let i=0;i<6;i++){ // inward-spiraling sparks
        const a=t*.04+i*(Math.PI*2/6), dd=s*.30*(0.5+0.5*Math.sin(t*.03+i));
        const px=s/2+Math.cos(a)*dd, py=s/2+Math.sin(a)*dd;
        ctx2.fillStyle=`hsla(${(t*2+i*60)%360},100%,80%,.9)`;
        ctx2.beginPath(); ctx2.arc(px,py,1.1,0,Math.PI*2); ctx2.fill();
      }
      ctx2.fillStyle='rgba(255,255,255,.95)'; // photon sphere
      ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.02,0,Math.PI*2); ctx2.fill();
      ctx2.restore(); break;
    }

    case 'supernova': { // [2.0-s5a] [LEGENDARY] blazing core + shockwave rings + plasma sparks
      ctx2.fillStyle='#0a0200'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const maxR=s*.5;
      for(let i=0;i<3;i++){ // shockwave rings
        const rr=((t*.5+i*maxR/3)%maxR), a=Math.max(0,1-rr/maxR);
        ctx2.strokeStyle=`rgba(255,${150+Math.floor(80*a)},40,${a*.8})`;
        ctx2.lineWidth=Math.max(.5,3*(1-rr/maxR));
        ctx2.beginPath(); ctx2.arc(s/2,s/2,rr,0,Math.PI*2); ctx2.stroke();
      }
      ctx2.save(); // core
      ctx2.shadowColor='#ffcc00'; ctx2.shadowBlur=14;
      const gc=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.22);
      gc.addColorStop(0,'#ffffff'); gc.addColorStop(.4,'#fff0a0');
      gc.addColorStop(.75,'#ffaa00'); gc.addColorStop(1,'#ff4400');
      ctx2.fillStyle=gc; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.22,0,Math.PI*2); ctx2.fill();
      ctx2.restore();
      for(let i=0;i<10;i++){ // radial plasma sparks
        const a=i*(Math.PI*2/10)+t*.01, dd=s*(.26+.16*Math.abs(Math.sin(t*.05+i)));
        const px=s/2+Math.cos(a)*dd, py=s/2+Math.sin(a)*dd;
        ctx2.fillStyle=`hsla(${30+((t+i*20)%30)},100%,65%,.9)`;
        ctx2.beginPath(); ctx2.arc(px,py,1.3,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'pulsarskin': { // [2.0-s5a] [EPIC] rotating lighthouse beams + fast cyan core pulse
      ctx2.fillStyle='#00060a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(t*.08);
      for(let k=0;k<2;k++){ // two opposing beams
        ctx2.rotate(Math.PI);
        const bg=ctx2.createLinearGradient(0,0,s*.7,0);
        bg.addColorStop(0,'hsla(190,100%,70%,.55)');
        bg.addColorStop(1,'hsla(190,100%,70%,0)');
        ctx2.fillStyle=bg;
        ctx2.beginPath(); ctx2.moveTo(0,0);
        ctx2.lineTo(s*.7,-s*.12); ctx2.lineTo(s*.7,s*.12); ctx2.closePath(); ctx2.fill();
      }
      ctx2.restore();
      const cp=0.5+0.5*Math.sin(t*.025); // fast-pulsing core
      ctx2.save();
      ctx2.shadowColor='hsla(190,100%,70%,1)'; ctx2.shadowBlur=8+8*cp;
      const gc=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.18);
      gc.addColorStop(0,`rgba(255,255,255,${.85+.15*cp})`);
      gc.addColorStop(.5,'hsla(190,100%,75%,.9)');
      gc.addColorStop(1,'hsla(200,100%,45%,0)');
      ctx2.fillStyle=gc; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.18,0,Math.PI*2); ctx2.fill();
      ctx2.restore();
      ctx2.restore(); break;
    }

    case 'cosmicdust': { // [2.0-s5a] [EPIC] drifting nebula gradients + twinkling stars
      ctx2.fillStyle='#06040f'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const clouds=[
        { hue:280, x:.35, y:.4 }, { hue:320, x:.6, y:.55 }, { hue:210, x:.5, y:.3 },
        { hue:260, x:.45, y:.65 }, { hue:300, x:.7, y:.35 },
      ];
      for(let i=0;i<clouds.length;i++){
        const c=clouds[i];
        const px=s*c.x+Math.sin(t*.01+i)*s*.05, py=s*c.y+Math.cos(t*.01+i*1.3)*s*.05;
        const g=ctx2.createRadialGradient(px,py,0,px,py,s*.3);
        g.addColorStop(0,`hsla(${c.hue},90%,65%,.25)`);
        g.addColorStop(1,`hsla(${c.hue},90%,65%,0)`);
        ctx2.fillStyle=g; ctx2.beginPath(); ctx2.arc(px,py,s*.3,0,Math.PI*2); ctx2.fill();
      }
      for(let i=0;i<15;i++){ // twinkling stars on top
        const sx=(Math.sin(i*51.3)*.5+.5)*s, sy=(Math.cos(i*88.1)*.5+.5)*s;
        ctx2.fillStyle=`rgba(255,255,255,${.3+.6*Math.abs(Math.sin(t*.06+i))})`;
        ctx2.beginPath(); ctx2.arc(sx,sy,.8,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'comet': { // [2.0-s5a] [RARE] white-blue nucleus + fading wobbling tail
      ctx2.fillStyle='#02040a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const hx=s*.62, hy=s*.4+Math.sin(t*.05)*s*.06; // nucleus
      for(let k=5;k>=1;k--){ // tail toward lower-left
        const tx=hx-k*s*.13, ty=hy+k*s*.10+Math.sin(t*.08+k)*s*.02;
        ctx2.globalAlpha=.18*(1-k/6);
        ctx2.fillStyle='#88ccff';
        ctx2.beginPath(); ctx2.arc(tx,ty,s*.13*(1-k/7),0,Math.PI*2); ctx2.fill();
      }
      ctx2.globalAlpha=1;
      ctx2.save();
      ctx2.shadowColor='#aaddff'; ctx2.shadowBlur=10;
      const g=ctx2.createRadialGradient(hx,hy,0,hx,hy,s*.15);
      g.addColorStop(0,'#ffffff'); g.addColorStop(.5,'#bbe2ff'); g.addColorStop(1,'rgba(120,180,255,0)');
      ctx2.fillStyle=g; ctx2.beginPath(); ctx2.arc(hx,hy,s*.15,0,Math.PI*2); ctx2.fill();
      ctx2.restore();
      ctx2.restore(); break;
    }

    case 'aurora': { // [2.0-s5a] [RARE] 3 waving green→violet ribbons (additive)
      ctx2.fillStyle='#01060a'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      ctx2.globalCompositeOperation='lighter';
      for(let band=0;band<3;band++){
        const phase=band*1.7, baseX=s*(.3+band*.2);
        ctx2.beginPath();
        for(let yy=0;yy<=s;yy+=3){
          const xx=baseX+Math.sin(yy*.06+t*.04+phase)*s*.12;
          yy===0?ctx2.moveTo(xx,yy):ctx2.lineTo(xx,yy);
        }
        for(let yy=s;yy>=0;yy-=3){
          ctx2.lineTo(baseX+Math.sin(yy*.06+t*.04+phase)*s*.12+s*.1,yy);
        }
        ctx2.closePath();
        const g=ctx2.createLinearGradient(0,0,0,s);
        g.addColorStop(0,'rgba(0,255,136,0)');
        g.addColorStop(.5,'rgba(0,255,136,.5)');
        g.addColorStop(1,'rgba(170,0,255,.4)');
        ctx2.fillStyle=g; ctx2.fill();
      }
      ctx2.globalCompositeOperation='source-over';
      ctx2.restore(); break;
    }

    case 'meteor': { // [2.0-s5a] [RARE] irregular rock + burning leading edge + sparks
      ctx2.fillStyle='#080204'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const mcx=s*.5, mcy=s*.52, mr=s*.34, jag=[1,0.72,0.95,0.66,1,0.7,0.92,0.62];
      ctx2.save(); // rock body
      ctx2.shadowColor='#ff5500'; ctx2.shadowBlur=12;
      ctx2.fillStyle='#4a3b33';
      ctx2.beginPath();
      for(let i=0;i<8;i++){ const ang=(i/8)*Math.PI*2, rr=mr*jag[i];
        const px=mcx+Math.cos(ang)*rr, py=mcy+Math.sin(ang)*rr;
        i===0?ctx2.moveTo(px,py):ctx2.lineTo(px,py); }
      ctx2.closePath(); ctx2.fill();
      ctx2.restore();
      ctx2.save(); // burning leading edge (upper arc)
      ctx2.strokeStyle='rgba(255,140,0,.9)'; ctx2.lineWidth=2;
      ctx2.shadowColor='#ff6600'; ctx2.shadowBlur=8;
      ctx2.beginPath();
      for(let i=0;i<5;i++){ const ang=(-Math.PI*.5)+(i/4)*Math.PI*.9, rr=mr*jag[i];
        const px=mcx+Math.cos(ang)*rr, py=mcy+Math.sin(ang)*rr;
        i===0?ctx2.moveTo(px,py):ctx2.lineTo(px,py); }
      ctx2.stroke();
      ctx2.restore();
      for(let i=0;i<6;i++){ // sparks streaming off
        const a=-Math.PI*.3-i*.2, dd=mr*(1.05+.25*Math.abs(Math.sin(t*.06+i)));
        const px=mcx+Math.cos(a)*dd, py=mcy+Math.sin(a)*dd;
        ctx2.fillStyle=`rgba(255,${120+i*15},0,.85)`;
        ctx2.beginPath(); ctx2.arc(px,py,1,0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'stardust': { // [2.0-s5a] [COMMON] ~12 twinkling dots of varied size
      ctx2.fillStyle='#03030c'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      for(let i=0;i<12;i++){
        const sx=(Math.sin(i*49.7)*.5+.5)*s, sy=(Math.cos(i*73.3)*.5+.5)*s;
        const a=.3+.7*Math.abs(Math.sin(t*.05+i*1.3)), rr=.6+(i%3)*.5;
        ctx2.fillStyle=`rgba(220,235,255,${a})`;
        ctx2.beginPath(); ctx2.arc(sx,sy,rr*(0.6+0.4*a),0,Math.PI*2); ctx2.fill();
      }
      ctx2.restore(); break;
    }

    case 'orbit': { // [2.0-s5a] [COMMON] central core + ring with a satellite
      ctx2.fillStyle='#04030e'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      const g=ctx2.createRadialGradient(s/2,s/2,0,s/2,s/2,s*.16);
      g.addColorStop(0,'#cfe6ff'); g.addColorStop(.6,'#5588cc'); g.addColorStop(1,'rgba(40,70,140,0)');
      ctx2.fillStyle=g; ctx2.beginPath(); ctx2.arc(s/2,s/2,s*.16,0,Math.PI*2); ctx2.fill();
      ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(t*.04);
      ctx2.strokeStyle='rgba(136,187,255,.5)'; ctx2.lineWidth=1;
      ctx2.beginPath(); ctx2.ellipse(0,0,s*.34,s*.14,0,0,Math.PI*2); ctx2.stroke();
      ctx2.fillStyle='#aaccff'; ctx2.shadowColor='#88bbff'; ctx2.shadowBlur=6;
      ctx2.beginPath(); ctx2.arc(s*.34,0,s*.04,0,Math.PI*2); ctx2.fill();
      ctx2.restore();
      ctx2.restore(); break;
    }

    case 'lunar': { // [2.0-s5a] [COMMON] silver sphere + craters, lazy rotation
      ctx2.fillStyle='#050507'; _rect(ctx2,0,0,s,s,4); ctx2.fill();
      ctx2.save(); _rect(ctx2,0,0,s,s,4); ctx2.clip();
      ctx2.save(); ctx2.translate(s/2,s/2); ctx2.rotate(t*.01);
      const g=ctx2.createRadialGradient(-s*.1,-s*.1,s*.05,0,0,s*.4);
      g.addColorStop(0,'#dddddd'); g.addColorStop(.6,'#888888'); g.addColorStop(1,'#444444');
      ctx2.fillStyle=g; ctx2.beginPath(); ctx2.arc(0,0,s*.4,0,Math.PI*2); ctx2.fill();
      const craters=[[-.12,-.05,.07,.05],[.1,.08,.05,.04],[.02,-.18,.04,.03],[.16,-.1,.03,.025]];
      ctx2.fillStyle='rgba(60,60,68,.6)';
      for(const c of craters){ ctx2.beginPath(); ctx2.ellipse(c[0]*s,c[1]*s,c[2]*s,c[3]*s,0,0,Math.PI*2); ctx2.fill(); }
      ctx2.restore();
      ctx2.restore(); break;
    }
  }
  ctx2.restore();
}

// Drawing helpers
function _rect(ctx2,x,y,w,h,r){
  ctx2.beginPath();
  ctx2.roundRect(x,y,w,h,r);
}
function _star(ctx2,cx,cy,outerR,innerR,points){
  ctx2.beginPath();
  for(let i=0;i<points*2;i++){
    const angle=i*Math.PI/points - Math.PI/2;
    const r=i%2===0?outerR:innerR;
    i===0?ctx2.moveTo(cx+r*Math.cos(angle),cy+r*Math.sin(angle))
         :ctx2.lineTo(cx+r*Math.cos(angle),cy+r*Math.sin(angle));
  }
  ctx2.closePath();
}
function _flame(ctx2,x,baseY,w,h){
  ctx2.beginPath();
  ctx2.moveTo(x,baseY);
  ctx2.quadraticCurveTo(x-w,baseY-h*.5,x,baseY-h);
  ctx2.quadraticCurveTo(x+w,baseY-h*.5,x+w*2,baseY);
  ctx2.closePath();
}
function _snowflake(ctx2,cx,cy,r){
  for(let i=0;i<6;i++){
    const a=i*Math.PI/3;
    ctx2.beginPath();
    ctx2.moveTo(cx,cy);
    ctx2.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));
    ctx2.stroke();
    // small branches
    for(let j=1;j<=2;j++){
      const bx=cx+(r*j/3)*Math.cos(a), by=cy+(r*j/3)*Math.sin(a);
      const ba=a+Math.PI/3;
      ctx2.beginPath();
      ctx2.moveTo(bx,by);
      ctx2.lineTo(bx+r*.2*Math.cos(ba),by+r*.2*Math.sin(ba));
      ctx2.stroke();
      ctx2.beginPath();
      ctx2.moveTo(bx,by);
      ctx2.lineTo(bx+r*.2*Math.cos(a-Math.PI/3),by+r*.2*Math.sin(a-Math.PI/3));
      ctx2.stroke();
    }
  }
}
