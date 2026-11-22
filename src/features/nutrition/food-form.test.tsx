// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { emptyData, type AppData, type Food } from "@/lib/domain";
import { FoodForm } from "./food-form";

const { TestContext }=await vi.hoisted(async()=>{const {createContext}=await import("react");return {TestContext:createContext<Record<string,unknown>>({})};});
vi.mock("@/components/day-provider",async()=>{const {useContext}=await import("react");return {useDay:()=>useContext(TestContext)};});
function Harness({item,missingNutrition}:{item?:Food;missingNutrition?:Array<"calories"|"protein"|"fat"|"carbs">}){
  const [data,setData]=useState<AppData>({...emptyData(),foods:item?.id?[item]:[]});
  return <TestContext.Provider value={{data,date:"2026-11-21",update:setData,closeModal:()=>{},notify:()=>{},openModal:()=>{}}}><FoodForm item={item} missingNutrition={missingNutrition}/><output data-testid="saved">{JSON.stringify(data.foods)}</output></TestContext.Provider>;
}
const known:Food={id:"known",name:"Йогурт",date:"2026-11-21",meal:"snack",grams:230,calories:130.5,protein:7.1,fat:3.6,carbs:17.4,favorite:true};
const stored=()=>JSON.parse(screen.getByTestId("saved").textContent||"[]") as Food[];
afterEach(cleanup);
describe("food portion editor",()=>{
  it("saves package values per 100 g as nutrition for the entire selected portion",async()=>{
    render(<Harness/>);
    fireEvent.change(screen.getByRole("textbox",{name:"Название блюда"}),{target:{value:"Творог"}});
    fireEvent.change(screen.getByRole("spinbutton",{name:"Порция, г"}),{target:{value:"150"}});
    await userEvent.click(screen.getByRole("button",{name:"На 100 г"}));
    for(const [name,value] of [["Калории на 100 г, ккал","140"],["Белки, г","12"],["Жиры, г","4"],["Углеводы, г","14"]]) fireEvent.change(screen.getByRole("spinbutton",{name}),{target:{value}});
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({name:"Творог",grams:150,calories:210,protein:18,fat:6,carbs:21});
  });
  it("applies a food-specific approximate weight using fractional household measures",async()=>{
    render(<Harness/>);
    fireEvent.change(screen.getByRole("textbox",{name:"Название блюда"}),{target:{value:"Рис"}});
    fireEvent.change(screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}),{target:{value:"80"}});
    await userEvent.click(screen.getByRole("button",{name:"Не знаю вес"}));
    fireEvent.change(screen.getByRole("combobox",{name:"Продукт и мера"}),{target:{value:"rice-spoon"}});
    fireEvent.change(screen.getByRole("spinbutton",{name:"Количество мер"}),{target:{value:"2.5"}});
    expect(screen.getByText(/Вес приблизительный/)).toBeTruthy();
    await userEvent.click(screen.getByRole("button",{name:"Использовать ≈ 25 г"}));
    expect((screen.getByRole("spinbutton",{name:"Порция, г"}) as HTMLInputElement).value).toBe("25");
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()[0]).toMatchObject({grams:25,estimated:true,calories:80});
  });
  it("preserves an existing portion exactly on opening and saving",async()=>{
    render(<Harness item={known}/>);
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()).toEqual([known]);
  });
  it("rescales a known food from its original weight and leaves manually changed totals alone",async()=>{
    render(<Harness item={known}/>);
    const grams=screen.getByRole("spinbutton",{name:"Порция, г"});
    fireEvent.change(grams,{target:{value:"115"}});
    expect((screen.getByRole("spinbutton",{name:"Белки, г"}) as HTMLInputElement).value).toBe("3.6");
    fireEvent.change(grams,{target:{value:"460"}});
    expect((screen.getByRole("spinbutton",{name:"Белки, г"}) as HTMLInputElement).value).toBe("14.2");
    fireEvent.change(screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}),{target:{value:"99"}});
    fireEvent.change(grams,{target:{value:"230"}});
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()[0]).toMatchObject({grams:230,calories:99,protein:14.2});
  });
  it("does not multiply manually entered whole-portion nutrition when weight changes",async()=>{
    render(<Harness/>);
    fireEvent.change(screen.getByRole("textbox",{name:"Название блюда"}),{target:{value:"Суп"}});
    fireEvent.change(screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}),{target:{value:"300"}});
    await userEvent.click(screen.getByRole("button",{name:"200 г"}));
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()[0]).toMatchObject({grams:200,calories:300});
  });
  it("refuses an auto-scaled total outside the supported range instead of saving stale nutrition",async()=>{
    render(<Harness item={{...known,calories:40000}}/>);
    fireEvent.change(screen.getByRole("spinbutton",{name:"Порция, г"}),{target:{value:"460"}});
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()[0]).toMatchObject({grams:230,calories:40000});
    expect(screen.getByRole("alert")).toBeTruthy();
  });

  it("keeps unknown AI values blank, preserves true zeros, and requires manual completion",async()=>{
    const draft={...known,id:"",name:"Рис",grams:150,calories:195,protein:0,fat:0,carbs:42,estimated:true};
    render(<Harness item={draft} missingNutrition={["fat"]}/>);
    expect((screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}) as HTMLInputElement).value).toBe("195");
    expect((screen.getByRole("spinbutton",{name:"Белки, г"}) as HTMLInputElement).value).toBe("0");
    const fat=screen.getByRole("spinbutton",{name:"Жиры, г"}) as HTMLInputElement;
    expect(fat.value).toBe("");
    expect(fat.required).toBe(true);
    fireEvent.submit(fat.closest("form")!);
    expect(stored()).toEqual([]);
    fireEvent.change(fat,{target:{value:"0"}});
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()).toHaveLength(1);
    expect(stored()[0]).toMatchObject({calories:195,protein:0,fat:0,carbs:42});
    expect(stored()[0]).not.toHaveProperty("missingNutrition");
  });

  it("does not save an ingredient-only AI draft with invented zero nutrition",()=>{
    render(<Harness item={{...known,id:"",calories:0,protein:0,fat:0,carbs:0}} missingNutrition={["calories","protein","fat","carbs"]}/>);
    for(const name of ["Калории на порцию, ккал","Белки, г","Жиры, г","Углеводы, г"])expect((screen.getByRole("spinbutton",{name}) as HTMLInputElement).value).toBe("");
    fireEvent.submit(screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}).closest("form")!);
    expect(stored()).toEqual([]);
  });

  it("rescales only known draft nutrients while unknown values remain blank",()=>{
    render(<Harness item={{...known,id:"",grams:150,calories:195,protein:0,fat:0,carbs:42}} missingNutrition={["fat"]}/>);
    fireEvent.change(screen.getByRole("spinbutton",{name:"Порция, г"}),{target:{value:"75"}});
    expect((screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}) as HTMLInputElement).value).toBe("97.5");
    expect((screen.getByRole("spinbutton",{name:"Белки, г"}) as HTMLInputElement).value).toBe("0");
    expect((screen.getByRole("spinbutton",{name:"Жиры, г"}) as HTMLInputElement).value).toBe("");
    expect((screen.getByRole("spinbutton",{name:"Углеводы, г"}) as HTMLInputElement).value).toBe("21");
    fireEvent.change(screen.getByRole("spinbutton",{name:"Порция, г"}),{target:{value:"150"}});
    expect((screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}) as HTMLInputElement).value).toBe("195");
    expect((screen.getByRole("spinbutton",{name:"Жиры, г"}) as HTMLInputElement).value).toBe("");
  });

  it("keeps partial nutrition in its original units until all values are completed",async()=>{
    render(<Harness item={{...known,id:"",grams:150,calories:195,protein:0,fat:0,carbs:42}} missingNutrition={["fat"]}/>);
    await userEvent.click(screen.getByRole("button",{name:"На 100 г"}));
    expect(screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"})).toBeTruthy();
    expect((screen.getByRole("spinbutton",{name:"Калории на порцию, ккал"}) as HTMLInputElement).value).toBe("195");
    expect((screen.getByRole("spinbutton",{name:"Жиры, г"}) as HTMLInputElement).value).toBe("");
    expect(screen.queryByRole("checkbox",{name:"Пересчитывать питание при изменении веса"})).toBeNull();
    fireEvent.change(screen.getByRole("spinbutton",{name:"Жиры, г"}),{target:{value:"3"}});
    await userEvent.click(screen.getByRole("button",{name:"На 100 г"}));
    expect((screen.getByRole("spinbutton",{name:"Калории на 100 г, ккал"}) as HTMLInputElement).value).toBe("130");
    expect((screen.getByRole("spinbutton",{name:"Жиры, г"}) as HTMLInputElement).value).toBe("2");
    fireEvent.change(screen.getByRole("spinbutton",{name:"Порция, г"}),{target:{value:"300"}});
    await userEvent.click(screen.getByRole("button",{name:"Сохранить"}));
    expect(stored()[0]).toMatchObject({grams:300,calories:390,protein:0,fat:6,carbs:84});
  });
});
