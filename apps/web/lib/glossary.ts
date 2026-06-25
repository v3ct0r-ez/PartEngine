// Glossary of acronyms used across the UI → shown via the InfoDot help bubble.
// Keys are normalised (uppercase, alphanumerics only), so "RDS(on)" matches RDSON.
const ACRONYMS: Record<string, string> = {
  MPN: 'Manufacturer Part Number — codice prodotto del produttore',
  MOQ: 'Minimum Order Quantity — quantità minima ordinabile',
  SKU: 'Stock Keeping Unit — codice articolo del fornitore',
  QR: 'Quick Response code — codice a barre bidimensionale',
  SMD: 'Surface-Mount Device — componente a montaggio superficiale',
  THT: 'Through-Hole Technology — componente a montaggio passante',
  ESR: 'Equivalent Series Resistance — resistenza serie equivalente',
  DCR: 'DC Resistance — resistenza in corrente continua',
  VDS: 'Tensione Drain-Source (MOSFET)',
  VGS: 'Tensione Gate-Source (MOSFET)',
  RDSON: 'RDS(on) — resistenza Drain-Source in conduzione',
  VF: 'Forward Voltage — tensione diretta (es. LED/diodo)',
  IF: 'Forward Current — corrente diretta',
  HFE: 'hFE — guadagno di corrente del transistor (β)',
  FT: 'Frequenza di transizione del transistor',
  IGT: 'Gate Trigger Current — corrente di innesco del gate',
  FSW: 'Frequenza di switching',
  VIN: 'Tensione di ingresso',
  VOUT: 'Tensione di uscita',
  IOUT: 'Corrente di uscita',
  MCU: 'Microcontroller Unit — microcontrollore',
  FPGA: 'Field-Programmable Gate Array',
  RAM: 'Random Access Memory — memoria volatile',
  EEPROM: 'Electrically Erasable Programmable ROM — memoria non volatile',
  LED: 'Light-Emitting Diode — diodo a emissione luminosa',
  LDO: 'Low-Dropout Regulator — regolatore a bassa caduta',
  PDF: 'Portable Document Format',
  DDT: 'Documento Di Trasporto',
};

/** Returns the explanation for an acronym label, or undefined if not known. */
export function lookupAcronym(label: string): string | undefined {
  const key = label.toUpperCase().replace(/[^A-Z0-9]/g, '');
  return ACRONYMS[key];
}
