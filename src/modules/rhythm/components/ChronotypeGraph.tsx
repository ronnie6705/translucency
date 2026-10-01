import type { Chronotype } from '../types';
import { getChronotypeCurve } from '../energy-curve';
import { EnergyCurveGraph } from './EnergyCurveGraph';
export function ChronotypeGraph({ type, showAnimal = false }: { type: Chronotype; showAnimal?: boolean }) {
  return <EnergyCurveGraph curve={getChronotypeCurve(type)} label={`${type} energy pattern over the day`} animal={showAnimal ? type : undefined} />;
}
