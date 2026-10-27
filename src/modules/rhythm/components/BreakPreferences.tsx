import type { BreakPreferences as Preferences, BreakPreset } from '../recovery/recovery-types';
const options: {id:BreakPreset;name:string;description:string}[] = [
  {id:'balanced',name:'Balanced',description:'Steady focus, regular breaks.'},
  {id:'deep-focus',name:'Deep Focus',description:'Longer sessions, fewer interruptions.'},
  {id:'frequent',name:'Frequent Breaks',description:'Shorter sessions, more room to recharge.'},
  {id:'none',name:'No Auto Breaks',description:'Keep your planned task times.'},
];
export function BreakPreferences({value,onChange}: {value:Preferences;onChange(value:Preferences):void}) {
  return <fieldset className="tb-break-preferences"><legend>Recovery preset</legend>
    {options.map(option => <label key={option.id} className={value.preset===option.id ? 'selected' : ''}>
      <input type="radio" name="break-preference" value={option.id} checked={value.preset===option.id} onChange={() => onChange({...value,preset:option.id})}/>
      <img className="tb-recovery-preset-icon" src={`/rhythm/recovery/${option.id}-${value.preset===option.id ? 'selected' : 'unselected'}.svg`} alt="" aria-hidden="true" />
      <span><strong>{option.name}</strong><small>{option.description}</small></span>
    </label>)}
  </fieldset>;
}
