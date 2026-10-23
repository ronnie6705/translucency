import type { BreakPreferences as Preferences, BreakPreset } from '../recovery/recovery-types';
const options: {id:BreakPreset;name:string;description:string}[] = [
  {id:'balanced',name:'Balanced',description:'Regular recovery based on your workload.'},
  {id:'deep-focus',name:'Deep Focus',description:'Longer focus sessions with fewer breaks.'},
  {id:'frequent',name:'Frequent Breaks',description:'Shorter sessions with more frequent recovery.'},
  {id:'none',name:'No Auto Breaks',description:'Plan without automatic recovery breaks.'},
];
export function BreakPreferences({value,onChange}: {value:Preferences;onChange(value:Preferences):void}) {
  return <fieldset className="tb-break-preferences"><legend>Break Preferences</legend><p>How would you like to pace your day?</p>
    {options.map(option => <label key={option.id} className={value.preset===option.id ? 'selected' : ''}>
      <input type="radio" name="break-preference" value={option.id} checked={value.preset===option.id} onChange={() => onChange({...value,preset:option.id})}/>
      <span><strong>{option.name}</strong><small>{option.description}</small></span>
    </label>)}
  </fieldset>;
}
