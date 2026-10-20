import { Pane } from 'tweakpane';
import type { ObjectLayer, ObjectLayers } from '../core/ObjectLayers';

export class ObjectLayerControls {
 readonly container=document.createElement('div');
 private list=document.createElement('div');
 private editor=document.createElement('div');
 private pane:Pane|null=null;
 private selected:number|null=null;
 private layers:ObjectLayers;
 constructor(layers:ObjectLayers){
  this.layers=layers;
  this.container.className='object-layer-controls';
  const add=document.createElement('div');add.className='control-row';
  for(const shape of ['Box','Sphere','Egg'] as const)add.append(this.button('+ '+shape,()=>this.select(layers.addPrimitive(shape))));
  const input=document.createElement('input');input.type='file';input.accept='.glb,.obj';input.multiple=true;input.hidden=true;
  const status=document.createElement('p');status.className='studio-panel-hint';status.setAttribute('role','status');
  input.addEventListener('change',async()=>{
   for(const file of Array.from(input.files??[])){
    status.textContent='Loading '+file.name+'…';
    try{this.select(await layers.importFile(file));status.textContent='Imported '+file.name;}
    catch(error){status.textContent=(error as Error).message;break;}
   }
   input.value='';
  });
  add.append(this.button('Import GLB / OBJ',()=>input.click()),input);
  const help=document.createElement('p');help.className='studio-panel-hint';help.textContent='Add several objects or import multiple static models. Each layer has its own material and transform. Z controls front/back depth. GLB must contain embedded assets; OBJ imports geometry only. Media placement uses the separate Glass volume.';
  this.container.append(add,help,this.list,this.editor,status);this.refreshList();
 }
 private button(label:string,action:()=>void):HTMLButtonElement{const b=document.createElement('button');b.type='button';b.className='background-button';b.textContent=label;b.addEventListener('click',action);return b;}
 private refreshList():void{
  this.list.replaceChildren();
  if(!this.layers.layers.length){const p=document.createElement('p');p.textContent='No 3D layers yet. Add a shape or import a model.';p.className='studio-panel-hint';this.list.append(p);}
  for(const layer of [...this.layers.layers].reverse()){
   const row=document.createElement('div');row.className='object-layer-row';
   const select=this.button(layer.name,()=>this.select(layer));select.classList.toggle('active',this.selected===layer.id);
   const visible=this.button(layer.visible?'Hide':'Show',()=>{layer.visible=!layer.visible;this.layers.apply(layer);this.refreshList();});
   row.append(select,visible);this.list.append(row);
  }
 }
 private select(layer:ObjectLayer):void{
  this.selected=layer.id;this.pane?.dispose();this.editor.replaceChildren();this.refreshList();
  const actions=document.createElement('div');actions.className='control-row';
  actions.append(this.button('Duplicate',()=>{const copy=this.layers.duplicate(layer.id);if(copy)this.select(copy);}),this.button('Remove layer',()=>{
   this.layers.remove(layer.id);this.pane?.dispose();this.pane=null;this.editor.replaceChildren();this.selected=null;this.refreshList();
  }));
  this.editor.append(actions);const controls=document.createElement('div');this.editor.append(controls);
  const pane=this.pane=new Pane({container:controls,title:'Selected 3D layer'});
  pane.addBinding(layer,'name',{label:'Name'}).on('change',()=>this.refreshList());
  pane.addBinding(layer,'material',{label:'Material',options:{Glass:'Glass',Solid:'Solid'}});
  pane.addBinding(layer,'color',{label:'Color'});pane.addBinding(layer,'opacity',{label:'Opacity',min:0,max:1,step:0.05});
  pane.addBinding(layer,'x',{label:'Position X',min:-1.5,max:1.5,step:0.01});pane.addBinding(layer,'y',{label:'Position Y',min:-1.5,max:1.5,step:0.01});
  pane.addBinding(layer,'z',{label:'Depth Z',min:-3,max:2,step:0.05});
  for(const key of ['scaleX','scaleY','scaleZ'] as const)pane.addBinding(layer,key,{min:0.1,max:4,step:0.05});
  for(const key of ['rotateX','rotateY','rotateZ'] as const)pane.addBinding(layer,key,{min:-180,max:180,step:1});
  pane.on('change',()=>this.layers.apply(layer));
 }
}
