import type { TodayCard } from "@/lib/domain";

/** Only visible slots move: a hidden card keeps its place until it is restored. */
export function reorderVisibleCards(order:TodayCard[],hidden:TodayCard[],active:string,over:string):TodayCard[]{
  const visible=order.filter(card=>!hidden.includes(card));
  const from=visible.findIndex(card=>card===active),to=visible.findIndex(card=>card===over);
  if(from<0||to<0||from===to)return order;
  const moved=[...visible];moved.splice(to,0,moved.splice(from,1)[0]);
  let index=0;
  return order.map(card=>hidden.includes(card)?card:moved[index++]);
}
