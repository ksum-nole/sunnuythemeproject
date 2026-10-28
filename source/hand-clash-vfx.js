import * as THREE from 'three';

/** Reference-style wind VFX, centered on the hands on clash and recoil. */
export function createClashVFX(scene){
  const group=new THREE.Group();group.name='Clash_and_recoil_wind_VFX';scene.add(group);
  const canvas=document.createElement('canvas');canvas.width=canvas.height=128;
  const ctx=canvas.getContext('2d'),gradient=ctx.createRadialGradient(64,64,0,64,64,64);
  for(const [stop,alpha] of [[0,.75],[.18,.45],[.43,.16],[.75,.025],[1,0]])gradient.addColorStop(stop,`rgba(255,255,255,${alpha})`);
  ctx.fillStyle=gradient;ctx.fillRect(0,0,128,128);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  let last=-1,activeEvents=0,anchors=[];
  const v=(x,y,z)=>new THREE.Vector3(x,y,z);
  function ribbon(points,width,opacity){
    const positions=[];
    for(let i=0;i<points.length-1;i++){
      const a=points[i],b=points[i+1],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1;
      const taper=Math.pow(Math.sin((i+.5)/(points.length-1)*Math.PI),.8),nx=-dy/len*width*taper/2,ny=dx/len*width*taper/2;
      for(const p of [[a.x+nx,a.y+ny,a.z],[a.x-nx,a.y-ny,a.z],[b.x+nx,b.y+ny,b.z],[b.x+nx,b.y+ny,b.z],[a.x-nx,a.y-ny,a.z],[b.x-nx,b.y-ny,b.z]])positions.push(...p);
    }
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
    const mesh=new THREE.Mesh(geometry,new THREE.MeshBasicMaterial({color:'#e1e7ee',transparent:true,opacity,depthWrite:false,depthTest:false,toneMapped:false,side:THREE.DoubleSide}));
    mesh.renderOrder=20;group.add(mesh);
  }
  function oval(center,rx,ry,phase,width,opacity){
    const points=[];
    for(let i=0;i<=60;i++){
      const a=-1.3+i/60*Math.PI*1.66+phase;
      points.push(v(center.x+rx*Math.cos(a)+.14*Math.sin(a),center.y+ry*Math.sin(a),center.z));
    }
    ribbon(points,width*3,opacity*.11);ribbon(points,width,opacity);
  }
  function wisp(position,width,height,opacity){
    const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,color:'#d7dfe8',transparent:true,opacity,depthWrite:false,depthTest:false,toneMapped:false}));
    sprite.position.copy(position);sprite.scale.set(width,height,1);sprite.renderOrder=10;group.add(sprite);
  }
  function clear(){for(const child of [...group.children]){if(!child.isSprite)child.geometry?.dispose();child.material?.dispose();group.remove(child);}}
  function update(motion,frame){
    if(frame===last)return;last=frame;clear();activeEvents=0;anchors=[];
    for(const event of motion.grappleRevision?.events||[]){
      const age=frame-event.frame;if(age<0||age>=event.durationFrames)continue;activeEvents++;
      const location=event.followCollisionCenter?motion.grappleRevision.collisionCenters[frame]:event.center;
      anchors.push({kind:event.kind,center:[...location]});
      const anchor=new THREE.Vector3(...location);anchor.z+=.02;
      const fade=[.37,.78,.50,.18][age];
      const center=anchor.clone();
      oval(center,.44+age*.22,1.85+age*.55,.08*age,.022,fade);
      oval(center.clone().add(v(.06,0,.03)),.57+age*.23,2.0+age*.54,.21,.010,fade*.55);
      const curve=new THREE.CubicBezierCurve3(anchor.clone().add(v(-.2,-1.25,0)),anchor.clone().add(v(.9,-.2,0)),anchor.clone().add(v(.9,.8,0)),anchor.clone().add(v(-.1,1.55+age*.15,0)));
      ribbon(curve.getPoints(48),.018,fade*.57);
      // The source's soft, directional pressure haze, without colored sparks.
      for(let j=0;j<5;j++){
        const p=anchor.clone().add(v((j-2)*(.29+age*.045),Math.sin(j*1.7)*.25-age*.025,.05));
        wisp(p,1.1+age*.26+j*.08,.56+age*.14,fade*.105);
      }
      wisp(anchor,.85+age*.16,.55+age*.12,fade*.12);
    }
  }
  return {group,update,state:()=>({frame:last,activeEvents,anchors,primitiveCount:group.children.length,nativeGeometry:true,seeded:true,bloodIncluded:false,style:'Reference white wind arcs and pressure wisps'})};
}
