"use client";
import { useId, useState, type FormEvent, type ReactNode } from "react";
import { Check, Minus, Plus, Ruler, Trash2 } from "lucide-react";
import { useDay } from "@/components/day-provider";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { foodSchema, meals, type Food, type FoodNutrient } from "@/lib/domain";
import { estimatePortionGrams, portionMeasures, scaleFoodNutrition, type FoodNutrition } from "@/lib/food-portions";
import styles from "./food-form.module.css";

const nutrientKeys=["calories","protein","fat","carbs"] as const;
type NutrientKey=typeof nutrientKeys[number];
type NutritionFields=Record<NutrientKey,string>;
type NutritionMode="portion"|"per100";
function toFields(values:FoodNutrition):NutritionFields{return {calories:String(values.calories),protein:String(values.protein),fat:String(values.fat),carbs:String(values.carbs)};}
function readFields(fields:NutritionFields):FoodNutrition|null{
  if(nutrientKeys.some(key=>fields[key].trim()===""||!Number.isFinite(Number(fields[key]))||Number(fields[key])<0||Number(fields[key])>50000))return null;
  return {calories:Number(fields.calories),protein:Number(fields.protein),fat:Number(fields.fat),carbs:Number(fields.carbs)};
}
function Field({label,children}:{label:string;children:ReactNode}){return <label className="field"><span>{label}</span>{children}</label>;}

export function FoodForm({item,meal,missingNutrition=[]}:{item?:Food;meal?:Food["meal"];missingNutrition?:FoodNutrient[]}){
  const {t,formatNumber}=useI18n();
  const quantityId=useId();
  const {date,data,update,closeModal,notify,openModal}=useDay();
  const existing=!!item?.id;
  const incompleteDraft=missingNutrition.length>0;
  const [grams,setGrams]=useState(String(item?.grams??100));
  const [mode,setMode]=useState<NutritionMode>("portion");
  const [fields,setFields]=useState<NutritionFields>(()=>{
    const values=item?toFields(item):{calories:"",protein:"0",fat:"0",carbs:"0"};
    for(const key of missingNutrition)values[key]="";
    return values;
  });
  const [autoScale,setAutoScale]=useState(!!item);
  const [estimatedPortion,setEstimatedPortion]=useState(!!item?.estimated);
  const [showHelper,setShowHelper]=useState(false);
  const [measure,setMeasure]=useState<string>("rice-spoon");
  const [quantity,setQuantity]=useState("1");
  const [error,setError]=useState("");
  const [confirmDelete,setConfirmDelete]=useState(false);
  const reusable=Array.from(new Map(data.foods.map(food=>[food.name,food])).values()).sort((a,b)=>Number(b.favorite)-Number(a.favorite));
  const numericGrams=Number(grams);
  const validWeight=grams.trim()!==""&&Number.isFinite(numericGrams)&&numericGrams>=1&&numericGrams<=10000;
  let estimated:number|null=null;
  try{estimated=estimatePortionGrams(measure,Number(quantity));}catch{}
  let totals:FoodNutrition|null=readFields(fields);
  if(totals&&mode==="per100"){
    try{totals=scaleFoodNutrition(totals,100,numericGrams);}catch{totals=null;}
  }else if(totals&&item&&autoScale&&!incompleteDraft&&numericGrams!==item.grams){
    try{totals=scaleFoodNutrition(item,item.grams,numericGrams);}catch{totals=null;}
  }

  function changeGrams(value:string){
    setGrams(value);
    setError("");
    if(item&&autoScale&&mode==="portion"&&value.trim()!==""){
      try{
        const scaled=toFields(scaleFoodNutrition(item,item.grams,Number(value)));
        for(const key of missingNutrition)scaled[key]="";
        setFields(scaled);
      }
      catch{setError(t("Укажите вес от 1 до 10 000 г и допустимые значения питания."));}
    }
  }
  function changeMode(next:NutritionMode){
    if(next===mode)return;
    const current=readFields(fields);
    if(incompleteDraft&&(!current||!validWeight)){
      setError(t("Сначала заполните недостающие значения питания и укажите вес порции."));
      return;
    }
    if(current&&validWeight){
      try{setFields(toFields(scaleFoodNutrition(current,mode==="portion"?numericGrams:100,next==="portion"?numericGrams:100)));}
      catch{setError(t("Укажите вес от 1 до 10 000 г и допустимые значения питания."));return;}
    }
    setMode(next);
    setAutoScale(false);
    setError("");
  }
  function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    setError("");
    const form=new FormData(event.currentTarget);
    try{
      if(!validWeight||!totals)throw new Error("Invalid portion");
      const food=foodSchema.parse({id:item?.id||crypto.randomUUID(),name:form.get("name"),date:form.get("date"),meal:form.get("meal"),grams:numericGrams,...totals,favorite:form.get("favorite")==="on",...(estimatedPortion||item?.estimated!==undefined?{estimated:estimatedPortion}:{})});
      update(current=>({...current,foods:existing?current.foods.map(value=>value.id===item?.id?food:value):[...current.foods,food]}));
      closeModal();
      notify(existing?t("Запись о питании обновлена"):t("Приём пищи добавлен"));
    }catch{setError(t("Проверьте название, вес и значения питания. Нужны числа от нуля, вес — от 1 до 10 000 г."));}
  }

  return <form className="form-stack" onSubmit={submit}>
    {!existing&&reusable.length>0&&<Field label={t("Повторить блюдо")}><select defaultValue="" onChange={event=>{const food=data.foods.find(value=>value.id===event.target.value);if(food)openModal({type:"food",item:{...food,id:"",date},meal});}}><option value="" disabled>{t("Из избранного и истории")}</option>{reusable.map(food=><option key={food.id} value={food.id}>{food.favorite?"★ ":""}{food.name}</option>)}</select></Field>}
    <Field label={t("Название блюда")}><input name="name" required maxLength={180} autoFocus placeholder={t("Например, овсянка с ягодами")} defaultValue={item?.name}/></Field>
    <div className="form-grid"><Field label={t("Приём пищи")}><select name="meal" defaultValue={item?.meal||meal||"breakfast"}>{Object.entries(meals).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></Field><Field label={t("Дата")}><input type="date" name="date" defaultValue={item?.date||date} required/></Field></div>

    <section className={styles.section} aria-label={t("Размер порции")}>
      <div className={styles.sectionHeading}><h3><span>01</span>{t("Размер порции")}</h3><button className={styles.helperToggle} type="button" aria-expanded={showHelper} onClick={()=>setShowHelper(value=>!value)}><Ruler size={14}/>{t("Не знаю вес")}</button></div>
      <Field label={t("Порция, г")}><input className={styles.gramsInput} type="number" inputMode="decimal" name="grams" min="1" max="10000" step="any" required value={grams} onChange={event=>changeGrams(event.target.value)}/></Field>
      <div className={styles.quickWeights} aria-label={t("Быстрый выбор веса")}>{[50,100,150,200].map(weight=><button type="button" key={weight} aria-pressed={numericGrams===weight} onClick={()=>changeGrams(String(weight))}>{formatNumber(weight)} {t("г")}</button>)}</div>
      {showHelper&&<div className={styles.helper}>
        <Field label={t("Продукт и мера")}><select value={measure} onChange={event=>setMeasure(event.target.value)}>{portionMeasures.map(value=><option key={value.id} value={value.id}>{t(value.label)} · ≈ {formatNumber(value.grams)} {t("г")}</option>)}</select></Field>
        <div className={styles.quantityRow}><div className="field"><label htmlFor={quantityId}>{t("Количество мер")}</label><span className={styles.stepper}><button type="button" aria-label={t("Уменьшить количество на половину")} disabled={Number(quantity)<=0.5} onClick={()=>setQuantity(String(Math.max(0.5,(Number(quantity)||1)-0.5)))}><Minus size={14}/></button><input id={quantityId} type="number" inputMode="decimal" step="any" value={quantity} onChange={event=>setQuantity(event.target.value)}/><button type="button" aria-label={t("Увеличить количество на половину")} onClick={()=>setQuantity(String((Number(quantity)||0)+0.5))}><Plus size={14}/></button></span></div><Button type="button" variant="outline" disabled={estimated===null} onClick={()=>{if(estimated!==null){changeGrams(String(estimated));setEstimatedPortion(true);setShowHelper(false);}}}>{t("Использовать ≈ {grams} г",{grams:estimated===null?"—":formatNumber(estimated)})}</Button></div>
        <p className={styles.note}>{t("Вес приблизительный: размер продукта, плотность и наполнение меры отличаются. Для точной записи используйте кухонные весы.")}</p>
      </div>}
      <label className="checkbox-field"><input type="checkbox" checked={estimatedPortion} onChange={event=>setEstimatedPortion(event.target.checked)}/>{t("Примерная порция")}</label>
      {item&&mode==="portion"&&!incompleteDraft&&<div className={styles.scaling}><label className="checkbox-field"><input type="checkbox" checked={autoScale} onChange={event=>{const enabled=event.target.checked;setAutoScale(enabled);if(enabled&&validWeight){try{setFields(toFields(scaleFoodNutrition(item,item.grams,numericGrams)));setError("");}catch{setError(t("Укажите вес от 1 до 10 000 г и допустимые значения питания."));}}}}/>{t("Пересчитывать питание при изменении веса")}</label><p className={styles.note}>{t("Расчёт от исходной порции блюда. Ручное изменение калорий или БЖУ отключает пересчёт.")}</p></div>}
    </section>

    <section className={styles.section} aria-label={t("Пищевая ценность")}>
      <div className={styles.sectionHeading}><h3><span>02</span>{t("Пищевая ценность")}</h3></div>
      {incompleteDraft&&!readFields(fields)&&<p className="form-notice">{t("AI не указал часть значений. Заполните пустые поля. Известные значения пересчитываются с весом до ручного изменения питания.")}</p>}
      <div className={styles.modeSwitch} role="group" aria-label={t("Как указаны значения питания")}><button type="button" aria-pressed={mode==="portion"} onClick={()=>changeMode("portion")}>{t("На порцию")}</button><button type="button" aria-pressed={mode==="per100"} onClick={()=>changeMode("per100")}>{t("На 100 г")}</button></div>
      <p className={styles.note}>{mode==="per100"?t("Перепишите значения на 100 г с упаковки. Day рассчитает вашу порцию."):t("Укажите значения для всей порции. Их можно взять с упаковки или из проверенного справочника продуктов.")}</p>
      <Field label={mode==="per100"?t("Калории на 100 г, ккал"):t("Калории на порцию, ккал")}><input type="number" inputMode="decimal" name="calories" min="0" max="50000" step="any" required value={fields.calories} placeholder="0" onChange={event=>{setFields(value=>({...value,calories:event.target.value}));setAutoScale(false);}}/></Field>
      <div className="form-grid triple">{([["protein","Белки, г"],["fat","Жиры, г"],["carbs","Углеводы, г"]] as const).map(([key,label])=><Field key={key} label={t(label)}><input type="number" inputMode="decimal" name={key} min="0" max="50000" step="any" required value={fields[key]} onChange={event=>{setFields(value=>({...value,[key]:event.target.value}));setAutoScale(false);}}/></Field>)}</div>
      {mode==="per100"&&totals&&validWeight&&<div className={styles.summary} aria-live="polite"><span>{t("В вашей порции · {grams} г",{grams:formatNumber(numericGrams)})}</span><strong>{formatNumber(totals.calories)} {t("ккал")}</strong><small>{t("Белки {protein} г · Жиры {fat} г · Углеводы {carbs} г",{protein:formatNumber(totals.protein),fat:formatNumber(totals.fat),carbs:formatNumber(totals.carbs)})}</small></div>}
    </section>
    <label className="checkbox-field"><input name="favorite" type="checkbox" defaultChecked={item?.favorite}/>{t("Сохранить в избранное")}</label>
    {error&&<div className="form-error" role="alert">{error}</div>}
    <div className="form-actions">{existing&&<Button type="button" variant="destructive" size="sm" className="delete-button" onClick={()=>{if(!confirmDelete){setConfirmDelete(true);return;}update(current=>({...current,foods:current.foods.filter(food=>food.id!==item?.id)}));closeModal();notify(t("Приём пищи удалён"));}}><Trash2 size={13}/>{confirmDelete?t("Точно удалить?"):t("Удалить")}</Button>}<Button type="button" variant="ghost" onClick={closeModal}>{t("Отмена")}</Button><Button type="submit"><Check size={14}/>{t("Сохранить")}</Button></div>
  </form>;
}
