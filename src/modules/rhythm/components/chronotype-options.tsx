import { LionIcon, WolfIcon, BearIcon, DolphinIcon } from './chronotype-icons';

export const chronotypeIconMap = {
  Lion: <LionIcon />, Wolf: <WolfIcon />, Bear: <BearIcon />, Dolphin: <DolphinIcon />,
};
export const chronotypeOptions = (['Lion', 'Wolf', 'Bear', 'Dolphin'] as const).map(id => ({ id, label: id, icon: chronotypeIconMap[id] }));
