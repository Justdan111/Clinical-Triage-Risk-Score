import type { VitalsField } from '@/api/types';

import type { IconName } from './icons';

/** One distinct icon per vital, shared by the form cards and the result's driver cards. */
export const VITAL_ICONS: Record<VitalsField, IconName> = {
  respiration_rate: 'lungs',
  spo2: 'droplet',
  systolic_bp: 'gauge',
  pulse: 'heartPulse',
  consciousness: 'brain',
  temperature: 'thermometer',
  on_supplemental_oxygen: 'air',
};

export function iconForParameter(parameter: string): IconName {
  return Object.prototype.hasOwnProperty.call(VITAL_ICONS, parameter) ? VITAL_ICONS[parameter as VitalsField] : 'info';
}
