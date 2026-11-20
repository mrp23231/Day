"use client";

import { useI18n } from "@/components/i18n-provider";

import { useEffect, useRef, useState, type ReactNode, type CSSProperties } from "react";
import { DndContext, DragOverlay, KeyboardSensor, MouseSensor, TouchSensor, useSensor, useSensors, type Modifier } from "@dnd-kit/core";
import { SortableContext, rectSortingStrategy, sortableKeyboardCoordinates, useSortable } from "@dnd-kit/sortable";
import { CSS, getEventCoordinates } from "@dnd-kit/utilities";
import { useReducedMotion } from "motion/react";
import { ArrowDown, ArrowUp, Check, EyeOff, GripVertical, ImagePlus, LayoutGrid, Pencil, SlidersHorizontal, Wallpaper } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { PhotoSurface } from "@/features/appearance/personal-photos";
import { PhotoEditor } from "@/features/appearance/photo-editor";
import { FocusLauncher } from "@/features/focus/focus-provider";
import { personalTargets, toggleCardVisibility } from "@/lib/personalization";
import { type TodayCard, type PhotoTarget } from "@/lib/domain";
import { reorderVisibleCards } from "./home-layout-model";
import { homeCardCollision } from "./home-drag-geometry";
import "./today-layout-editor.css";

const targetLabel=(id:string,t:(key:string)=>string)=>t(personalTargets.find(target=>target.id===id)?.label??id);
const interactive="button,a,input,textarea,select,label,summary,[contenteditable],[role='button']";
const centerPreview:Modifier=({transform,activatorEvent,draggingNodeRect})=>{
  const pointer=activatorEvent?getEventCoordinates(activatorEvent):null;
  if(!pointer||!draggingNodeRect)return transform;
  return {...transform,x:transform.x+pointer.x-draggingNodeRect.left-draggingNodeRect.width/2,y:transform.y+pointer.y-draggingNodeRect.top-draggingNodeRect.height/2};
};

export function TodayLayoutEditor({cards}:{cards:Record<TodayCard,ReactNode>}){
  const { t } = useI18n();
  const labelFor=(id:string)=>targetLabel(id,t);
  const {data,ready,update}=useDay();
  const reduced=useReducedMotion();
  const [editing,setEditing]=useState(false);
  const [selected,setSelected]=useState<TodayCard|null>(null);
  const [active,setActive]=useState<TodayCard|null>(null);
  const [photoTarget,setPhotoTarget]=useState<PhotoTarget|null>(null);
  const [showHidden,setShowHidden]=useState(false);
  const [announcement,setAnnouncement]=useState("");
  const activeRef=useRef<TodayCard|null>(null),pending=useRef(false),cancelling=useRef(false);
  const entry=useRef<HTMLButtonElement>(null);
  const {todayOrder:order,todayHidden:hidden}=data.preferences;
  const visible=order.filter(id=>!hidden.includes(id));
  const sensors=useSensors(
    useSensor(MouseSensor,{activationConstraint:editing?{distance:6}:{delay:550,tolerance:9}}),
    useSensor(TouchSensor,{activationConstraint:{delay:editing?160:550,tolerance:9}}),
    useSensor(KeyboardSensor,{coordinateGetter:sortableKeyboardCoordinates}),
  );
  function finish(){setEditing(false);setSelected(null);setShowHidden(false);window.requestAnimationFrame(()=>entry.current?.focus({preventScroll:true}));}
  useEffect(()=>{
    const escape=(event:KeyboardEvent)=>{if(event.key==="Escape"&&!event.defaultPrevented&&!cancelling.current&&!activeRef.current&&!photoTarget&&!document.querySelector('[role="dialog"]')){setEditing(false);setSelected(null);setShowHidden(false);}};
    const cancel=()=>{if(activeRef.current||pending.current){
      // Let the active sensor handle its supported Escape cancellation, including
      // detaching its document listeners. Remounting DndContext alone leaves them alive.
      cancelling.current=true;
      document.dispatchEvent(new KeyboardEvent("keydown",{key:"Escape",code:"Escape",bubbles:true}));
      activeRef.current=null;pending.current=false;setActive(null);cancelling.current=false;
    }};
    const visibility=()=>{if(document.hidden)cancel();};
    document.addEventListener("keydown",escape);window.addEventListener("blur",cancel);document.addEventListener("visibilitychange",visibility);
    return()=>{document.removeEventListener("keydown",escape);window.removeEventListener("blur",cancel);document.removeEventListener("visibilitychange",visibility);cancel();};
  },[photoTarget]);

  function move(card:TodayCard,over:TodayCard){
    update(current=>({...current,preferences:{...current.preferences,todayOrder:reorderVisibleCards(current.preferences.todayOrder,current.preferences.todayHidden,card,over)}}));
    setAnnouncement(t("Блок «{name}» перемещён.",{name:labelFor(card)}));
  }
  function hide(card:TodayCard){
    update(current=>({...current,preferences:{...current.preferences,todayHidden:toggleCardVisibility(current.preferences.todayHidden,card)}}));
    setAnnouncement(t("Блок «{name}» скрыт.",{name:labelFor(card)}));setSelected(null);
  }
  return <>
    <div className="today-space-toolbar"><FocusLauncher/><button ref={entry} className="home-edit-entry" disabled={!ready} aria-pressed={editing} onClick={()=>editing?finish():setEditing(true)}><SlidersHorizontal size={14}/>{editing?t("Редактирование главной"):t("Настроить главную")}</button></div>
    {editing&&<div className="home-edit-intro"><span className="home-edit-dot"/><p>{t("Ваше пространство. Ваш порядок.")}</p><span>{t("Перетаскивайте блоки или изменяйте фото.")}</span></div>}
    <DndContext id="day-home-layout" sensors={sensors} collisionDetection={homeCardCollision} accessibility={{screenReaderInstructions:{draggable:t("Чтобы поднять блок, нажмите пробел. Перемещайте стрелками. Пробел — опустить, Escape — отменить.")},announcements:{onDragStart:({active})=>t("Поднят блок «{name}».",{name:labelFor(String(active.id))}),onDragOver:({over})=>over?t("Место блока «{name}».",{name:labelFor(String(over.id))}):undefined,onDragEnd:({active,over})=>over&&active.id!==over.id?t("Блок «{name}» перемещён.",{name:labelFor(String(active.id))}):t("Блок опущен."),onDragCancel:()=>t("Перемещение отменено.")}}}
      onDragPending={()=>{pending.current=true;}} onDragAbort={()=>{pending.current=false;}}
      onDragStart={({active})=>{const id=active.id as TodayCard;pending.current=false;activeRef.current=id;setActive(id);setSelected(id);setEditing(true);}}
      onDragCancel={()=>{activeRef.current=null;pending.current=false;setActive(null);}}
      onDragEnd={({active,over,delta})=>{const current=activeRef.current===active.id;activeRef.current=null;pending.current=false;setActive(null);if(current&&over&&active.id!==over.id&&(Math.abs(delta.x)>3||Math.abs(delta.y)>3))move(active.id as TodayCard,over.id as TodayCard);}}>
      <SortableContext items={visible} strategy={rectSortingStrategy}>
        <div className={`today-layout today-custom-layout home-layout ${editing?"is-editing":""}`}>
          {visible.map((card,index)=><EditableCard key={card} card={card} editing={editing} selected={selected===card} ready={ready} only={visible.length===1} first={index===0} last={index===visible.length-1} onSelect={()=>setSelected(card)} onEdit={()=>{setSelected(card);setPhotoTarget(card);}} onMove={direction=>move(card,visible[index+direction])} onHide={()=>hide(card)}>{cards[card]}</EditableCard>)}
        </div>
      </SortableContext>
      <DragOverlay modifiers={[centerPreview]} dropAnimation={reduced?null:{duration:180,easing:"cubic-bezier(.2,.7,.2,1)"}} zIndex={88}>{active?<div className="home-drag-preview"><span><GripVertical size={15}/>{t("Перемещаем")}</span><strong>{labelFor(active)}</strong><span className="home-drag-lines"><i/><i/><i/></span></div>:null}</DragOverlay>
    </DndContext>
    <p className="sr-only" role="status">{announcement}</p>
    {editing&&<div className="home-edit-dock-wrap"><div className="home-edit-dock" role="toolbar" aria-label={t("Настройка главной")}>
      <button aria-label={t("Фото фона")} onClick={()=>setPhotoTarget("space")}><Wallpaper size={17}/><span>{t("Фон")}</span></button>
      <button aria-label={t("Фото навигации")} onClick={()=>setPhotoTarget("navigation")}><ImagePlus size={17}/><span>{t("Панель")}</span></button>
      <button aria-label={t("Скрытые блоки: {count}",{count:hidden.length})} aria-expanded={showHidden} disabled={!hidden.length} onClick={()=>setShowHidden(value=>!value)}><LayoutGrid size={17}/><span>{t("Блоки")}{hidden.length?` · ${hidden.length}`:""}</span></button>
      <span className="home-dock-divider"/>
      <button className="home-edit-done" onClick={finish}><Check size={16}/><span>{t("Готово")}</span></button>
    </div>{showHidden&&hidden.length>0&&<div className="home-hidden-tray" role="region" aria-label={t("Скрытые блоки")}><p>{t("Вернуть на главную")}</p>{order.filter(card=>hidden.includes(card)).map(card=><button key={card} aria-label={t("Показать: {name}",{name:labelFor(card)})} onClick={()=>{update(current=>({...current,preferences:{...current.preferences,todayHidden:current.preferences.todayHidden.filter(id=>id!==card)}}));setAnnouncement(t("Блок «{name}» показан.",{name:labelFor(card)}));}}>{labelFor(card)}<ArrowUp size={14}/></button>)}</div>}</div>}
    {photoTarget&&<PhotoEditor key={photoTarget} target={photoTarget} onClose={()=>setPhotoTarget(null)}/>}
  </>;
}

function EditableCard({card,children,editing,selected,ready,only,first,last,onSelect,onEdit,onMove,onHide}:{card:TodayCard;children:ReactNode;editing:boolean;selected:boolean;ready:boolean;only:boolean;first:boolean;last:boolean;onSelect:()=>void;onEdit:()=>void;onMove:(direction:-1|1)=>void;onHide:()=>void}){
  const { t } = useI18n();
  const labelFor=(id:string)=>targetLabel(id,t);
  const {attributes,listeners,setNodeRef,setActivatorNodeRef,transform,transition,isDragging}=useSortable({id:card,disabled:!ready,transition:{duration:230,easing:"cubic-bezier(.2,.7,.2,1)"}});
  const style:CSSProperties={transform:CSS.Transform.toString(transform?{...transform,scaleX:1,scaleY:1}:null),transition};
  const accepts=(target:EventTarget)=>!(target instanceof Element&&target.closest(interactive));
  return <div ref={setNodeRef} style={style} className={`today-card-slot today-slot-${card} home-card ${selected?"is-selected":""} ${isDragging?"is-dragging":""}`} data-home-card={card}
    onMouseDown={event=>{if(event.button===0&&accepts(event.target))listeners?.onMouseDown?.(event);}} onTouchStart={event=>{if(accepts(event.target))listeners?.onTouchStart?.(event);}} onContextMenu={event=>{if(editing)event.preventDefault();}}>
    <div className="home-card-shell" onClick={()=>{if(editing)onSelect();}}>
      {editing&&<div className="home-card-tools">
        <button ref={setActivatorNodeRef} {...attributes} {...listeners} className="home-drag-handle" aria-label={t("Переместить: {name}",{name:labelFor(card)})}><GripVertical size={15}/></button>
        <button className="home-card-edit" aria-label={t("Изменить: {name}",{name:labelFor(card)})} onClick={onEdit}><Pencil size={13}/><span>{t("Изменить")}</span></button>
        <div className="home-card-position"><button disabled={first} aria-label={t("Выше: {name}",{name:labelFor(card)})} onClick={()=>onMove(-1)}><ArrowUp size={14}/></button><button disabled={last} aria-label={t("Ниже: {name}",{name:labelFor(card)})} onClick={()=>onMove(1)}><ArrowDown size={14}/></button><button disabled={only} aria-label={t("Скрыть: {name}",{name:labelFor(card)})} onClick={onHide}><EyeOff size={14}/></button></div>
      </div>}
      <div className="home-card-content" inert={editing||undefined}><PhotoSurface target={card} className="home-card-surface">{children}</PhotoSurface></div>
    </div>
  </div>;
}
