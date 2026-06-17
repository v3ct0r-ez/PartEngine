/**
 * Built-in component taxonomy: 2-level (group → category) with English slugs,
 * a reference-designator code prefix per category, and the recognition fields
 * (parameters) per category. Variant types are modelled as an ENUM field on a
 * single category (e.g. capacitor dielectric, diode type) instead of separate
 * categories. This is the seed source; admins can still add/edit categories.
 */
import type { FieldTemplate } from './category-fields.js';

export interface TaxonomyCategory {
  slug: string;
  name: string;
  codePrefix: string;
  fields: FieldTemplate[];
}
export interface TaxonomyGroup {
  slug: string;
  name: string;
  categories: TaxonomyCategory[];
}

// Compact field builders.
const Q = (key: string, label: string, unit?: string, required = false): FieldTemplate => ({ key, label, type: 'QUANTITY', unit, required });
const EN = (key: string, label: string, options: string[], required = false): FieldTemplate => ({ key, label, type: 'ENUM', options, required });
const ST = (key: string, label: string): FieldTemplate => ({ key, label, type: 'STRING' });
const NU = (key: string, label: string): FieldTemplate => ({ key, label, type: 'NUMBER' });
const BO = (key: string, label: string): FieldTemplate => ({ key, label, type: 'BOOLEAN' });

const FOOTPRINT = ['0201', '0402', '0603', '0805', '1206', '1210', '2010', '2512', 'Axiale'];
const MOUNT = ['SMD', 'THT'];

export const TAXONOMY: TaxonomyGroup[] = [
  {
    slug: 'passive',
    name: 'Componenti passivi',
    categories: [
      { slug: 'resistors', name: 'Resistori', codePrefix: 'R', fields: [
        Q('resistance', 'Valore', 'Ω', true), Q('tolerance', 'Tolleranza', '%'), Q('power', 'Potenza', 'W'),
        EN('technology', 'Tecnologia', ['Thick Film', 'Thin Film', 'Metal Film', 'Wirewound', 'Carbon']),
        Q('temp_coefficient', 'Coeff. termico', 'ppm/°C'), EN('mount', 'Montaggio', MOUNT),
        EN('footprint', 'Footprint', FOOTPRINT), EN('series', 'Serie', ['E6', 'E12', 'E24', 'E48', 'E96', 'E192']) ] },
      { slug: 'trimmers', name: 'Trimmer', codePrefix: 'RV', fields: [
        Q('resistance', 'Valore', 'Ω', true), Q('tolerance', 'Tolleranza', '%'), Q('power', 'Potenza', 'W'),
        NU('turns', 'Giri'), EN('mount', 'Montaggio', MOUNT) ] },
      { slug: 'potentiometers', name: 'Potenziometri', codePrefix: 'RV', fields: [
        Q('resistance', 'Valore', 'Ω', true), EN('taper', 'Curva', ['Lineare', 'Logaritmica']),
        Q('power', 'Potenza', 'W'), NU('turns', 'Giri') ] },
      { slug: 'capacitors', name: 'Condensatori', codePrefix: 'C', fields: [
        Q('capacitance', 'Capacità', 'F', true), Q('voltage', 'Tensione', 'V'), Q('tolerance', 'Tolleranza', '%'),
        EN('dielectric', 'Dielettrico', ['C0G', 'NP0', 'X5R', 'X7R', 'X8R', 'Y5V', 'Elettrolitico', 'Tantalio', 'Film', 'Mica']),
        Q('esr', 'ESR', 'Ω'), Q('ripple_current', 'Corrente ripple', 'A'), BO('polarized', 'Polarizzato'),
        EN('mount', 'Montaggio', MOUNT), EN('footprint', 'Footprint', FOOTPRINT) ] },
      { slug: 'inductors', name: 'Induttori', codePrefix: 'L', fields: [
        Q('inductance', 'Induttanza', 'H', true), Q('current_rated', 'Corrente nominale', 'A'),
        Q('current_saturation', 'Corrente saturazione', 'A'), Q('dcr', 'DCR', 'Ω'), BO('shielded', 'Schermato'),
        Q('srf', 'Freq. autorisonanza', 'Hz') ] },
      { slug: 'transformers', name: 'Trasformatori', codePrefix: 'T', fields: [
        Q('power', 'Potenza', 'W'), Q('primary_voltage', 'Tensione primario', 'V'),
        Q('secondary_voltage', 'Tensione secondario', 'V'), ST('turns_ratio', 'Rapporto spire'),
        Q('isolation_voltage', 'Tensione isolamento', 'V') ] },
      { slug: 'ferrites', name: 'Ferriti', codePrefix: 'FB', fields: [
        Q('impedance', 'Impedenza @100MHz', 'Ω'), Q('current_rated', 'Corrente nominale', 'A'), Q('dcr', 'DCR', 'Ω') ] },
    ],
  },
  {
    slug: 'semiconductors',
    name: 'Semiconduttori',
    categories: [
      { slug: 'diodes', name: 'Diodi', codePrefix: 'D', fields: [
        EN('type', 'Tipo', ['Standard', 'Raddrizzatore', 'Zener', 'Schottky', 'TVS', 'Fast', 'Varicap'], true),
        Q('vf', 'Tensione diretta Vf', 'V'), Q('if_forward', 'Corrente diretta If', 'A'),
        Q('vr_reverse', 'Tensione inversa Vr', 'V'), Q('vz_zener', 'Tensione Zener Vz', 'V'),
        Q('power', 'Potenza', 'W'), ST('package', 'Package') ] },
      { slug: 'leds', name: 'LED', codePrefix: 'D', fields: [
        EN('color', 'Colore', ['Rosso', 'Verde', 'Blu', 'Bianco', 'Giallo', 'Arancione', 'RGB', 'IR', 'UV']),
        Q('vf', 'Tensione diretta', 'V'), Q('if_forward', 'Corrente diretta', 'A'),
        Q('luminous_intensity', 'Intensità luminosa', 'mcd'), Q('wavelength', 'Lunghezza d\'onda', 'nm'),
        EN('mount', 'Montaggio', MOUNT), EN('footprint', 'Footprint', FOOTPRINT) ] },
      { slug: 'bjts', name: 'Transistor BJT', codePrefix: 'Q', fields: [
        EN('type', 'Tipo', ['NPN', 'PNP'], true), Q('vceo', 'VCEO', 'V'), Q('ic', 'Corrente IC', 'A'),
        NU('hfe', 'hFE'), Q('ft', 'Freq. transizione', 'Hz'), Q('power', 'Potenza', 'W'), ST('package', 'Package') ] },
      { slug: 'mosfets', name: 'MOSFET', codePrefix: 'Q', fields: [
        EN('channel', 'Canale', ['N', 'P'], true), Q('vds', 'VDS', 'V'), Q('id', 'ID', 'A'),
        Q('rds_on', 'RDS(on)', 'Ω'), Q('vgs_th', 'VGS(th)', 'V'), Q('gate_charge', 'Carica gate', 'C'),
        Q('power', 'Potenza', 'W'), BO('logic_level', 'Logic level'), ST('package', 'Package') ] },
      { slug: 'thyristors', name: 'TRIAC / SCR', codePrefix: 'Q', fields: [
        EN('type', 'Tipo', ['TRIAC', 'SCR'], true), Q('vdrm', 'VDRM', 'V'), Q('it_rms', 'Corrente IT(rms)', 'A'),
        Q('igt', 'Corrente gate IGT', 'A'), ST('package', 'Package') ] },
    ],
  },
  {
    slug: 'integrated_circuits',
    name: 'Circuiti integrati',
    categories: [
      { slug: 'logic_ics', name: 'Logica digitale', codePrefix: 'U', fields: [
        ST('family', 'Famiglia'), ST('function', 'Funzione'), Q('voltage', 'Tensione', 'V'),
        NU('channels', 'Canali'), ST('package', 'Package') ] },
      { slug: 'microcontrollers', name: 'Microcontrollori', codePrefix: 'IC', fields: [
        ST('family', 'Famiglia'), ST('core', 'Core'), Q('flash', 'Flash', 'B'), Q('ram', 'RAM', 'B'),
        Q('eeprom', 'EEPROM', 'B'), NU('pins', 'Numero pin'), Q('frequency', 'Frequenza', 'Hz'),
        ST('interfaces', 'Interfacce'), Q('voltage', 'Tensione', 'V'), ST('package', 'Package') ] },
      { slug: 'memories', name: 'Memorie', codePrefix: 'U', fields: [
        EN('type', 'Tipo', ['Flash', 'EEPROM', 'SRAM', 'DRAM', 'FRAM', 'NAND', 'NOR'], true),
        Q('capacity', 'Capacità', 'B'), EN('interface', 'Interfaccia', ['I2C', 'SPI', 'QSPI', 'Parallel', 'OneWire']),
        Q('voltage', 'Tensione', 'V'), ST('package', 'Package') ] },
      { slug: 'op_amps', name: 'Amplificatori operazionali', codePrefix: 'U', fields: [
        NU('channels', 'Canali'), Q('gbw', 'Banda guadagno', 'Hz'), ST('slew_rate', 'Slew rate'),
        Q('supply_voltage', 'Tensione alim.', 'V'), Q('input_offset', 'Offset ingresso', 'V'), ST('package', 'Package') ] },
      { slug: 'drivers_interfaces', name: 'Driver e interfacce', codePrefix: 'U', fields: [
        ST('function', 'Funzione'), NU('channels', 'Canali'), Q('voltage', 'Tensione', 'V'),
        Q('data_rate', 'Data rate', 'Hz'), ST('package', 'Package') ] },
      { slug: 'adc', name: 'Convertitori ADC', codePrefix: 'U', fields: [
        NU('resolution', 'Risoluzione (bit)'), NU('channels', 'Canali'), Q('sample_rate', 'Sample rate', 'Hz'),
        EN('interface', 'Interfaccia', ['I2C', 'SPI', 'Parallel']), Q('voltage', 'Tensione', 'V'), ST('package', 'Package') ] },
      { slug: 'dac', name: 'Convertitori DAC', codePrefix: 'U', fields: [
        NU('resolution', 'Risoluzione (bit)'), NU('channels', 'Canali'), Q('settling_time', 'Settling time', 's'),
        EN('interface', 'Interfaccia', ['I2C', 'SPI', 'Parallel']), Q('voltage', 'Tensione', 'V'), ST('package', 'Package') ] },
    ],
  },
  {
    slug: 'power',
    name: 'Alimentazione',
    categories: [
      { slug: 'acdc_supplies', name: 'Alimentatori AC/DC', codePrefix: 'PS', fields: [
        Q('input_voltage', 'Tensione ingresso', 'V'), Q('output_voltage', 'Tensione uscita', 'V'),
        Q('output_current', 'Corrente uscita', 'A'), Q('power', 'Potenza', 'W'), Q('efficiency', 'Efficienza', '%') ] },
      { slug: 'buck_converters', name: 'Convertitori Buck (Step-Down)', codePrefix: 'U', fields: [
        Q('vin_min', 'Vin min', 'V'), Q('vin_max', 'Vin max', 'V'), Q('vout', 'Vout', 'V'), Q('iout', 'Iout', 'A'),
        Q('efficiency', 'Efficienza', '%'), Q('fsw', 'Freq. switching', 'Hz'), BO('enable', 'Enable'),
        BO('feedback', 'Feedback'), ST('package', 'Package') ] },
      { slug: 'boost_converters', name: 'Convertitori Boost (Step-Up)', codePrefix: 'U', fields: [
        Q('vin_min', 'Vin min', 'V'), Q('vin_max', 'Vin max', 'V'), Q('vout', 'Vout', 'V'), Q('iout', 'Iout', 'A'),
        Q('efficiency', 'Efficienza', '%'), Q('fsw', 'Freq. switching', 'Hz'), ST('package', 'Package') ] },
      { slug: 'buck_boost', name: 'Convertitori Buck-Boost', codePrefix: 'U', fields: [
        Q('vin_min', 'Vin min', 'V'), Q('vin_max', 'Vin max', 'V'), Q('vout', 'Vout', 'V'), Q('iout', 'Iout', 'A'),
        Q('efficiency', 'Efficienza', '%'), Q('fsw', 'Freq. switching', 'Hz'), ST('package', 'Package') ] },
      { slug: 'ldo', name: 'Regolatori lineari (LDO)', codePrefix: 'U', fields: [
        Q('vin_max', 'Vin max', 'V'), Q('vout', 'Vout', 'V'), Q('iout', 'Iout', 'A'), Q('dropout', 'Dropout', 'V'),
        Q('quiescent_current', 'Corrente quiescente', 'A'), BO('adjustable', 'Regolabile'), ST('package', 'Package') ] },
      { slug: 'voltage_references', name: 'Riferimenti di tensione', codePrefix: 'U', fields: [
        Q('vout', 'Tensione', 'V'), Q('tolerance', 'Tolleranza', '%'), Q('temp_coefficient', 'Coeff. termico', 'ppm/°C'),
        Q('iout', 'Corrente', 'A'), ST('package', 'Package') ] },
      { slug: 'bms', name: 'Gestione batterie (BMS)', codePrefix: 'U', fields: [
        NU('cells', 'Celle'), EN('chemistry', 'Chimica', ['Li-ion', 'LiPo', 'LiFePO4', 'NiMH']),
        Q('charge_current', 'Corrente carica', 'A'), Q('voltage', 'Tensione', 'V'), ST('package', 'Package') ] },
      { slug: 'batteries', name: 'Batterie e accumulatori', codePrefix: 'BT', fields: [
        EN('chemistry', 'Chimica', ['Li-ion', 'LiPo', 'LiFePO4', 'NiMH', 'Alcalina', 'Piombo']),
        Q('voltage', 'Tensione', 'V'), Q('capacity', 'Capacità', 'Ah'), BO('rechargeable', 'Ricaricabile'),
        ST('form_factor', 'Formato') ] },
    ],
  },
  {
    slug: 'connectors_cabling',
    name: 'Connettori e cablaggio',
    categories: [
      { slug: 'connectors', name: 'Connettori', codePrefix: 'J', fields: [
        ST('type', 'Tipo'), NU('pins', 'Numero pin'), ST('pitch', 'Passo'), EN('mount', 'Montaggio', MOUNT),
        EN('gender', 'Genere', ['Maschio', 'Femmina']), Q('current_rating', 'Corrente nominale', 'A'),
        Q('voltage_rating', 'Tensione nominale', 'V') ] },
      { slug: 'terminal_blocks', name: 'Morsettiere', codePrefix: 'X', fields: [
        NU('positions', 'Posizioni'), ST('pitch', 'Passo'), Q('current_rating', 'Corrente nominale', 'A'),
        ST('wire_gauge', 'Sezione cavo') ] },
      { slug: 'cables', name: 'Cavi', codePrefix: 'W', fields: [
        NU('conductors', 'Conduttori'), ST('gauge', 'Sezione (AWG)'), Q('length', 'Lunghezza', 'm'),
        BO('shielded', 'Schermato'), Q('voltage_rating', 'Tensione nominale', 'V') ] },
      { slug: 'adapters', name: 'Adattatori', codePrefix: 'J', fields: [
        ST('type', 'Tipo'), EN('gender', 'Genere', ['Maschio', 'Femmina', 'M-F']) ] },
    ],
  },
  {
    slug: 'sensors_modules',
    name: 'Sensori e moduli',
    categories: [
      { slug: 'sensors', name: 'Sensori', codePrefix: 'SEN', fields: [
        EN('measurand', 'Grandezza', ['Temperatura', 'Umidità', 'Pressione', 'Luce', 'Movimento', 'Corrente', 'Gas', 'Distanza', 'IMU', 'Hall']),
        EN('interface', 'Interfaccia', ['Analogico', 'I2C', 'SPI', 'UART', 'PWM', '1-Wire']),
        Q('voltage', 'Tensione', 'V'), ST('range', 'Range'), ST('accuracy', 'Accuratezza') ] },
      { slug: 'wireless_modules', name: 'Moduli wireless', codePrefix: 'MOD', fields: [
        EN('protocol', 'Protocollo', ['WiFi', 'Bluetooth', 'BLE', 'LoRa', 'Zigbee', 'NRF24', 'Sub-GHz']),
        Q('frequency', 'Frequenza', 'Hz'), EN('interface', 'Interfaccia', ['UART', 'SPI', 'I2C', 'USB']),
        Q('voltage', 'Tensione', 'V'), ST('tx_power', 'Potenza TX') ] },
      { slug: 'gps_gsm_modules', name: 'Moduli GPS/GSM', codePrefix: 'MOD', fields: [
        EN('type', 'Tipo', ['GPS', 'GSM', 'GPRS', 'LTE', 'NB-IoT', 'GNSS']),
        EN('interface', 'Interfaccia', ['UART', 'USB', 'SPI']), Q('voltage', 'Tensione', 'V') ] },
      { slug: 'dev_boards', name: 'Schede di sviluppo', codePrefix: 'DEV', fields: [
        ST('platform', 'Piattaforma'), ST('mcu', 'MCU'), ST('connectivity', 'Connettività'), Q('voltage', 'Tensione', 'V') ] },
    ],
  },
  {
    slug: 'display_opto',
    name: 'Display e optoelettronica',
    categories: [
      { slug: 'displays', name: 'Display', codePrefix: 'DISP', fields: [
        EN('tech', 'Tecnologia', ['LCD', 'OLED', 'TFT', 'LED', 'e-Paper', 'Segmenti'], true), ST('resolution', 'Risoluzione'),
        ST('size', 'Dimensione'), EN('interface', 'Interfaccia', ['I2C', 'SPI', 'Parallel', 'HDMI', 'RGB']),
        Q('voltage', 'Tensione', 'V'), EN('color', 'Colore', ['Mono', 'RGB', 'Grayscale']) ] },
      { slug: 'optocouplers', name: 'Optoisolatori', codePrefix: 'U', fields: [
        NU('channels', 'Canali'), Q('isolation_voltage', 'Tensione isolamento', 'V'), Q('ctr', 'CTR', '%'),
        EN('output_type', 'Tipo uscita', ['Transistor', 'TRIAC', 'MOSFET', 'Logica']), ST('package', 'Package') ] },
    ],
  },
  {
    slug: 'switching_protection',
    name: 'Commutazione e protezione',
    categories: [
      { slug: 'relays', name: 'Relè', codePrefix: 'K', fields: [
        Q('coil_voltage', 'Tensione bobina', 'V'), Q('contact_current', 'Corrente contatti', 'A'),
        Q('contact_voltage', 'Tensione contatti', 'V'), EN('contacts', 'Contatti', ['SPST', 'SPDT', 'DPST', 'DPDT']),
        EN('type', 'Tipo', ['Meccanico', 'SSR']), EN('mount', 'Montaggio', MOUNT) ] },
      { slug: 'switches', name: 'Interruttori', codePrefix: 'S', fields: [
        EN('type', 'Tipo', ['Toggle', 'Slide', 'Rocker', 'Rotary', 'DIP']), NU('poles', 'Poli'),
        Q('current_rating', 'Corrente nominale', 'A'), Q('voltage_rating', 'Tensione nominale', 'V'), EN('mount', 'Montaggio', MOUNT) ] },
      { slug: 'push_buttons', name: 'Pulsanti', codePrefix: 'S', fields: [
        EN('type', 'Tipo', ['Tattile', 'Momentaneo', 'Bistabile']), Q('current_rating', 'Corrente nominale', 'A'),
        ST('actuation_force', 'Forza attuazione'), EN('mount', 'Montaggio', MOUNT) ] },
      { slug: 'fuses', name: 'Fusibili', codePrefix: 'F', fields: [
        Q('current_rating', 'Corrente nominale', 'A'), Q('voltage_rating', 'Tensione nominale', 'V'),
        EN('type', 'Tipo', ['Rapido', 'Ritardato', 'PTC resettabile']), EN('mount', 'Montaggio', MOUNT) ] },
    ],
  },
  {
    slug: 'motors_actuators',
    name: 'Motori e attuatori',
    categories: [
      { slug: 'motors', name: 'Motori', codePrefix: 'M', fields: [
        EN('type', 'Tipo', ['DC', 'Passo-passo', 'Servo', 'BLDC'], true), Q('voltage', 'Tensione', 'V'),
        Q('current', 'Corrente', 'A'), Q('power', 'Potenza', 'W'), NU('rpm', 'RPM'), ST('torque', 'Coppia'),
        NU('steps_per_rev', 'Passi/giro') ] },
      { slug: 'fans', name: 'Ventole', codePrefix: 'M', fields: [
        Q('voltage', 'Tensione', 'V'), Q('current', 'Corrente', 'A'), ST('size', 'Dimensione'),
        ST('airflow', 'Flusso d\'aria'), EN('bearing', 'Cuscinetto', ['Sleeve', 'Ball', 'Hydro']), ST('connector', 'Connettore') ] },
    ],
  },
  {
    slug: 'hardware',
    name: 'Hardware e accessori',
    categories: [
      { slug: 'pcbs', name: 'PCB', codePrefix: 'PCB', fields: [
        NU('layers', 'Strati'), ST('dimensions', 'Dimensioni'), ST('thickness', 'Spessore'),
        EN('finish', 'Finitura', ['HASL', 'ENIG', 'OSP', 'Immersion Silver']) ] },
      { slug: 'heatsinks', name: 'Dissipatori', codePrefix: 'HS', fields: [
        ST('thermal_resistance', 'Resistenza termica (°C/W)'), EN('material', 'Materiale', ['Alluminio', 'Rame']),
        ST('dimensions', 'Dimensioni'), ST('mount', 'Montaggio') ] },
      { slug: 'enclosures', name: 'Contenitori', codePrefix: 'ENC', fields: [
        EN('material', 'Materiale', ['ABS', 'Alluminio', 'Policarbonato', 'Acciaio']), ST('dimensions', 'Dimensioni'),
        ST('ip_rating', 'Grado IP') ] },
      { slug: 'standoffs', name: 'Distanziali', codePrefix: 'STO', fields: [
        EN('material', 'Materiale', ['Ottone', 'Nylon', 'Acciaio', 'Inox']), ST('thread', 'Filettatura'), ST('length', 'Lunghezza') ] },
      { slug: 'screws', name: 'Viteria', codePrefix: 'SCR', fields: [
        ST('type', 'Tipo'), ST('thread', 'Filettatura'), ST('length', 'Lunghezza'),
        EN('material', 'Materiale', ['Acciaio', 'Inox', 'Nylon', 'Ottone']) ] },
      { slug: 'heat_shrink', name: 'Guaine termorestringenti', codePrefix: 'HST', fields: [
        ST('diameter', 'Diametro'), ST('ratio', 'Rapporto restringimento'), ST('color', 'Colore'), ST('material', 'Materiale') ] },
    ],
  },
];

/** All leaf categories flattened. */
export function taxonomyLeaves(): Array<TaxonomyCategory & { groupSlug: string; groupName: string }> {
  return TAXONOMY.flatMap((g) => g.categories.map((c) => ({ ...c, groupSlug: g.slug, groupName: g.name })));
}
