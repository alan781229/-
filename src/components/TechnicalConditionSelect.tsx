'use client';
import {technicalConditionOptions,type TechnicalConditionId} from '../lib/scanner';
import './scanner.css';
export function TechnicalConditionSelect({value,onChange,disabled=false,label='掃描條件（可複選）'}:{value:TechnicalConditionId[];onChange:(value:TechnicalConditionId[])=>void;disabled?:boolean;label?:string}){
 return <details className="technical-select"><summary aria-label={label}>{label} · 已選 {value.length} 項 ▾</summary><div className="technical-options" role="group" aria-label={label}>{technicalConditionOptions.map(option=><label key={option.id}><input type="checkbox" disabled={disabled} checked={value.includes(option.id)} onChange={e=>onChange(e.target.checked?[...value,option.id]:value.filter(id=>id!==option.id))}/>{option.label}</label>)}<button type="button" disabled={disabled} onClick={()=>onChange([])}>清除附加條件</button><small>勾選條件須同時符合；未勾選則不加限制。</small></div></details>;
}

export default TechnicalConditionSelect;
