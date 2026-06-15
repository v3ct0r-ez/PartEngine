/**
 * Data-driven category field templates.
 *
 * These describe the technical parameters each component category exposes. They
 * are the seed for the `CategoryField` table and drive the dynamic form on the
 * web client. An admin can add/modify fields at runtime (stored in the DB) —
 * these are just the built-in defaults so the system is useful out of the box.
 *
 * The same metadata powers: the dynamic form, the filter sidebar, validation,
 * and the indexed parameter projection used for unit-aware sorting.
 */

export type FieldType = 'STRING' | 'TEXT' | 'NUMBER' | 'QUANTITY' | 'BOOLEAN' | 'ENUM' | 'DATE';

export interface FieldTemplate {
  key: string;
  label: string;
  type: FieldType;
  unit?: string; // SI base unit for QUANTITY fields
  options?: string[]; // for ENUM
  required?: boolean;
  defaultValue?: unknown;
  validation?: { min?: number; max?: number; regex?: string; step?: number };
  isFilterable?: boolean;
  isSortable?: boolean;
}

export interface CategoryTemplate {
  slug: string;
  name: string;
  icon?: string;
  fields: FieldTemplate[];
}

export const FOOTPRINTS_SMD = ['0201', '0402', '0603', '0805', '1206', '1210'];
export const RESISTOR_SERIES = ['E6', 'E12', 'E24', 'E48', 'E96', 'E192'];

export const CATEGORY_TEMPLATES: CategoryTemplate[] = [
  {
    slug: 'resistors',
    name: 'Resistenze',
    icon: 'resistor',
    fields: [
      { key: 'resistance', label: 'Valore', type: 'QUANTITY', unit: 'Ω', required: true },
      { key: 'tolerance', label: 'Tolleranza', type: 'QUANTITY', unit: '%' },
      { key: 'power', label: 'Potenza', type: 'QUANTITY', unit: 'W' },
      {
        key: 'technology',
        label: 'Tecnologia',
        type: 'ENUM',
        options: ['Thick Film', 'Thin Film', 'Metal Film', 'Wirewound', 'Carbon'],
      },
      { key: 'footprint', label: 'Footprint', type: 'ENUM', options: [...FOOTPRINTS_SMD, 'Axiale'] },
      { key: 'mount', label: 'Tipo', type: 'ENUM', options: ['SMD', 'THT'] },
      { key: 'tempCoefficient', label: 'Coeff. termico', type: 'QUANTITY', unit: 'ppm/°C' },
      { key: 'series', label: 'Serie', type: 'ENUM', options: RESISTOR_SERIES },
    ],
  },
  {
    slug: 'capacitors',
    name: 'Condensatori',
    icon: 'capacitor',
    fields: [
      { key: 'capacitance', label: 'Capacità', type: 'QUANTITY', unit: 'F', required: true },
      { key: 'voltage', label: 'Tensione', type: 'QUANTITY', unit: 'V' },
      { key: 'tolerance', label: 'Tolleranza', type: 'QUANTITY', unit: '%' },
      {
        key: 'dielectric',
        label: 'Dielettrico',
        type: 'ENUM',
        options: ['C0G', 'NP0', 'X5R', 'X7R', 'Y5V', 'Elettrolitico', 'Tantalio'],
      },
      { key: 'esr', label: 'ESR', type: 'QUANTITY', unit: 'Ω' },
      { key: 'polarized', label: 'Polarizzato', type: 'BOOLEAN', defaultValue: false },
    ],
  },
  {
    slug: 'inductors',
    name: 'Induttori',
    icon: 'inductor',
    fields: [
      { key: 'inductance', label: 'Induttanza', type: 'QUANTITY', unit: 'H', required: true },
      { key: 'currentRated', label: 'Corrente nominale', type: 'QUANTITY', unit: 'A' },
      { key: 'currentSaturation', label: 'Corrente saturazione', type: 'QUANTITY', unit: 'A' },
      { key: 'dcr', label: 'DCR', type: 'QUANTITY', unit: 'Ω' },
      { key: 'shielded', label: 'Shielded', type: 'BOOLEAN' },
    ],
  },
  {
    slug: 'mosfets',
    name: 'MOSFET',
    icon: 'mosfet',
    fields: [
      { key: 'channel', label: 'Tipo', type: 'ENUM', options: ['N', 'P'], required: true },
      { key: 'vds', label: 'VDS', type: 'QUANTITY', unit: 'V' },
      { key: 'id', label: 'ID', type: 'QUANTITY', unit: 'A' },
      { key: 'rdsOn', label: 'RDS(on)', type: 'QUANTITY', unit: 'Ω' },
      { key: 'gateCharge', label: 'Gate Charge', type: 'QUANTITY', unit: 'C' },
      { key: 'package', label: 'Package', type: 'STRING' },
      { key: 'logicLevel', label: 'Logic Level', type: 'BOOLEAN' },
    ],
  },
  {
    slug: 'buck_converter',
    name: 'Buck Converter',
    icon: 'buck',
    fields: [
      { key: 'vinMin', label: 'Vin Min', type: 'QUANTITY', unit: 'V' },
      { key: 'vinMax', label: 'Vin Max', type: 'QUANTITY', unit: 'V' },
      { key: 'vout', label: 'Vout', type: 'QUANTITY', unit: 'V' },
      { key: 'iout', label: 'Iout', type: 'QUANTITY', unit: 'A' },
      { key: 'efficiency', label: 'Efficienza', type: 'QUANTITY', unit: '%' },
      { key: 'fsw', label: 'Frequenza Switching', type: 'QUANTITY', unit: 'Hz' },
      { key: 'enable', label: 'Enable', type: 'BOOLEAN' },
      { key: 'feedback', label: 'Feedback', type: 'BOOLEAN' },
    ],
  },
  {
    slug: 'microcontrollers',
    name: 'Microcontrollori',
    icon: 'mcu',
    fields: [
      { key: 'family', label: 'Famiglia', type: 'STRING' },
      { key: 'core', label: 'Core', type: 'STRING' },
      { key: 'flash', label: 'Flash', type: 'QUANTITY', unit: 'B' },
      { key: 'ram', label: 'RAM', type: 'QUANTITY', unit: 'B' },
      { key: 'eeprom', label: 'EEPROM', type: 'QUANTITY', unit: 'B' },
      { key: 'pins', label: 'Numero pin', type: 'NUMBER' },
      { key: 'frequency', label: 'Frequenza', type: 'QUANTITY', unit: 'Hz' },
      { key: 'interfaces', label: 'Interfacce', type: 'STRING' },
    ],
  },
];

export function getCategoryTemplate(slug: string): CategoryTemplate | undefined {
  return CATEGORY_TEMPLATES.find((c) => c.slug === slug);
}
