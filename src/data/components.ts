// ─── Two-Tier Domain Model ────────────────────────────────────────────────────
// Layer: Domain/Rules — ZERO I/O. Pure functions. No LLM calls. Ever.

/** A single pin on a board, with all its electrical capabilities */
export interface BoardPin {
  name: string;
  types: ('digital' | 'analog' | 'pwm' | 'i2c' | 'interrupt')[];
  max_current_ma?: number;   // per-pin current limit in mA (default 40mA for AVR, 12mA per GPIO for ESP32)
  reserved?: boolean;        // true = UART/USB/boot-mode pin — must not be assigned
  reserved_reason?: string;  // e.g. "UART0 TX — used by USB Serial"
}

/** Full profile of a supported microcontroller board */
export interface BoardProfile {
  name: string;              // canonical board name, e.g. "Arduino_Uno"
  logic_voltage: number;     // 3.3 or 5.0
  total_current_budget_ma: number; // max safe total draw from the board's regulator
  pins: BoardPin[];
}

/** A component that can be placed in an architecture option */
export interface ComponentSpec {
  name: string;
  category: 'Sensors' | 'Actuators' | 'Power' | 'Control';
  pin_types_required: ('digital' | 'analog' | 'pwm' | 'i2c' | 'interrupt')[];
  voltage: number;           // operating voltage (must match board logic voltage, or needs level-shifter)
  current_ma: number;        // typical draw
  requires_driver: boolean;  // true = needs a driver IC/module in the component list
  requires_pull_resistor?: boolean; // true = needs internal pull-up or external resistor noted
  i2c_default_address?: number;     // for I2C devices: default 7-bit address (e.g. 0x27)
  i2c_remappable?: boolean;         // if true, address conflict is a warning, not a conflict
  notes: string;
  is_microcontroller?: boolean;
}

// ─── Board Catalog ────────────────────────────────────────────────────────────

export const BOARD_PROFILES: BoardProfile[] = [
  {
    name: 'Arduino_Uno',
    logic_voltage: 5,
    total_current_budget_ma: 400,
    pins: [
      { name: 'D0',  types: ['digital'], reserved: true,  reserved_reason: 'UART0 RX — used by USB Serial' },
      { name: 'D1',  types: ['digital'], reserved: true,  reserved_reason: 'UART0 TX — used by USB Serial' },
      { name: 'D2',  types: ['digital', 'interrupt'], max_current_ma: 40 },
      { name: 'D3',  types: ['digital', 'pwm', 'interrupt'], max_current_ma: 40 },
      { name: 'D4',  types: ['digital'], max_current_ma: 40 },
      { name: 'D5',  types: ['digital', 'pwm'], max_current_ma: 40 },
      { name: 'D6',  types: ['digital', 'pwm'], max_current_ma: 40 },
      { name: 'D7',  types: ['digital'], max_current_ma: 40 },
      { name: 'D8',  types: ['digital'], max_current_ma: 40 },
      { name: 'D9',  types: ['digital', 'pwm'], max_current_ma: 40 },
      { name: 'D10', types: ['digital', 'pwm'], max_current_ma: 40 },
      { name: 'D11', types: ['digital', 'pwm'], max_current_ma: 40 },
      { name: 'D12', types: ['digital'], max_current_ma: 40 },
      { name: 'D13', types: ['digital'], max_current_ma: 40 },
      { name: 'A0',  types: ['digital', 'analog'], max_current_ma: 40 },
      { name: 'A1',  types: ['digital', 'analog'], max_current_ma: 40 },
      { name: 'A2',  types: ['digital', 'analog'], max_current_ma: 40 },
      { name: 'A3',  types: ['digital', 'analog'], max_current_ma: 40 },
      { name: 'A4',  types: ['digital', 'analog', 'i2c'], max_current_ma: 40 }, // SDA
      { name: 'A5',  types: ['digital', 'analog', 'i2c'], max_current_ma: 40 }, // SCL
    ],
  },
  {
    name: 'ESP32',
    logic_voltage: 3.3,
    total_current_budget_ma: 500,
    pins: [
      { name: 'GPIO0',  types: ['digital', 'pwm'], reserved: true, reserved_reason: 'Boot-mode strapping pin — HIGH=normal boot, LOW=flash mode' },
      { name: 'GPIO1',  types: ['digital'], reserved: true, reserved_reason: 'UART0 TX — used by USB Serial' },
      { name: 'GPIO2',  types: ['digital', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO3',  types: ['digital'], reserved: true, reserved_reason: 'UART0 RX — used by USB Serial' },
      { name: 'GPIO4',  types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO5',  types: ['digital'], max_current_ma: 12 },
      { name: 'GPIO12', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO13', types: ['digital', 'analog', 'pwm', 'interrupt'], max_current_ma: 12 },
      { name: 'GPIO14', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO15', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO18', types: ['digital'], max_current_ma: 12 },
      { name: 'GPIO19', types: ['digital'], max_current_ma: 12 },
      { name: 'GPIO21', types: ['digital', 'i2c'], max_current_ma: 12 }, // SDA
      { name: 'GPIO22', types: ['digital', 'i2c'], max_current_ma: 12 }, // SCL
      { name: 'GPIO23', types: ['digital'], max_current_ma: 12 },
      { name: 'GPIO25', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO26', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO27', types: ['digital', 'analog', 'pwm'], max_current_ma: 12 },
      { name: 'GPIO32', types: ['digital', 'analog'], max_current_ma: 12 },
      { name: 'GPIO33', types: ['digital', 'analog'], max_current_ma: 12 },
    ],
  },
];

// ─── Component Catalog ────────────────────────────────────────────────────────

export const COMPONENTS: ComponentSpec[] = [
  {
    name: 'ESP32',
    category: 'Control',
    pin_types_required: [],
    voltage: 3.3,
    current_ma: 240,
    requires_driver: false,
    notes: 'ESP32 microcontroller with Wi-Fi & Bluetooth',
    is_microcontroller: true,
  },
  {
    name: 'Arduino_Uno',
    category: 'Control',
    pin_types_required: [],
    voltage: 5,
    current_ma: 50,
    requires_driver: false,
    notes: 'ATmega328P based microcontroller board',
    is_microcontroller: true,
  },
  {
    name: 'LED',
    category: 'Actuators',
    pin_types_required: ['digital'],
    voltage: 3.3,
    current_ma: 20,
    requires_driver: false,
    requires_pull_resistor: true,
    notes: 'Basic Light Emitting Diode — always wire a current-limiting resistor in series.',
  },
  {
    name: 'PIR_Sensor',
    category: 'Sensors',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 1,
    requires_driver: false,
    notes: 'Passive Infrared motion sensor — 5 V logic output; use a voltage divider or logic-level shifter with 3.3 V boards.',
  },
  {
    name: 'HC-SR04',
    category: 'Sensors',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 15,
    requires_driver: false,
    notes: 'Ultrasonic distance sensor — requires 2 digital pins (Trig & Echo). Echo output is 5 V; use a resistor divider with ESP32.',
  },
  {
    name: 'SG90_Servo',
    category: 'Actuators',
    pin_types_required: ['pwm'],
    voltage: 5,
    current_ma: 500,
    requires_driver: false,
    notes: "Micro servo motor \u2014 peak stall current 500 mA; power from an external 5 V rail, not the board's pin.",
  },
  {
    name: 'Buzzer',
    category: 'Actuators',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 30,
    requires_driver: false,
    notes: 'Piezo buzzer — can be driven directly from a digital pin with a transistor for louder output.',
  },
  {
    name: 'Relay_Coil',
    category: 'Actuators',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 70,
    requires_driver: true,
    notes: 'Raw electromechanical relay coil — MUST be driven via a transistor driver circuit; never connect directly to a GPIO.',
  },
  {
    name: 'Relay_Module',
    category: 'Actuators',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 5,
    requires_driver: false,
    notes: 'Relay module with integrated driver transistor and optocoupler — safe to connect directly to GPIO.',
  },
  {
    name: 'DC_Motor',
    category: 'Actuators',
    pin_types_required: ['pwm'],
    voltage: 6,
    current_ma: 250,
    requires_driver: true,
    notes: 'Direct current toy motor — requires an H-bridge driver (e.g. L298N) or transistor driver.',
  },
  {
    name: 'Motor_Driver',
    category: 'Control',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 20,
    requires_driver: false,
    notes: 'Motor driver / transistor board (e.g. ULN2003, L298N) — satisfies the driver requirement for DC_Motor and Relay_Coil.',
  },
  {
    name: 'DHT11',
    category: 'Sensors',
    pin_types_required: ['digital'],
    voltage: 5,
    current_ma: 2.5,
    requires_driver: false,
    requires_pull_resistor: true,
    notes: 'Digital temperature & humidity sensor — the data line requires a 4.7 kΩ pull-up resistor to Vcc.',
  },
  {
    name: 'Photoresistor',
    category: 'Sensors',
    pin_types_required: ['analog'],
    voltage: 3.3,
    current_ma: 1,
    requires_driver: false,
    notes: 'Light-dependent resistor — wire in a voltage-divider configuration with a 10 kΩ series resistor.',
  },
  {
    name: 'LCD_I2C',
    category: 'Actuators',
    pin_types_required: ['i2c'],
    voltage: 5,
    current_ma: 50,
    requires_driver: false,
    i2c_default_address: 0x27,
    i2c_remappable: false,
    notes: '16×2 character LCD with I2C backpack — default address 0x27; requires SDA + SCL pins.',
  },
  {
    name: 'OLED_I2C',
    category: 'Actuators',
    pin_types_required: ['i2c'],
    voltage: 3.3,
    current_ma: 20,
    requires_driver: false,
    i2c_default_address: 0x3C,
    i2c_remappable: true,
    notes: '128×64 OLED display (SSD1306) — default address 0x3C, can be remapped to 0x3D by bridging SA0 pad.',
  },
];

// ─── Rule Violation shape ────────────────────────────────────────────────────

export interface RuleViolation {
  ruleId:     string;   // e.g. "VR-001"
  severity:   'conflict' | 'warning';
  message:    string;   // plain-language explanation for the user
  components: string[]; // names of affected components
}

export interface ValidationResult {
  valid:      boolean;         // true iff zero conflict-severity violations
  violations: RuleViolation[];
  confidence: 'validated' | 'verify_manually';
}

// ─── Helper: resolve component name → spec ───────────────────────────────────

export function findSpec(componentName: string): ComponentSpec | undefined {
  const norm = componentName.toLowerCase();

  if (norm.includes('esp32'))                                                            return COMPONENTS.find(c => c.name === 'ESP32');
  if (norm.includes('uno') || norm.includes('arduino'))                                 return COMPONENTS.find(c => c.name === 'Arduino_Uno');
  if (norm.includes('relay') && (norm.includes('module') || norm.includes('driver')))   return COMPONENTS.find(c => c.name === 'Relay_Module');
  if (norm.includes('relay'))                                                            return COMPONENTS.find(c => c.name === 'Relay_Coil');
  if (norm.includes('servo') || norm.includes('sg90'))                                  return COMPONENTS.find(c => c.name === 'SG90_Servo');
  if (norm.includes('dc motor') || (norm.includes('motor') && !norm.includes('driver'))) return COMPONENTS.find(c => c.name === 'DC_Motor');
  if (norm.includes('driver') || norm.includes('l298n') || norm.includes('uln2003'))    return COMPONENTS.find(c => c.name === 'Motor_Driver');
  if (norm.includes('led'))                                                              return COMPONENTS.find(c => c.name === 'LED');
  if (norm.includes('pir') || norm.includes('sr501') || norm.includes('motion'))        return COMPONENTS.find(c => c.name === 'PIR_Sensor');
  if (norm.includes('hc-sr04') || norm.includes('sr04') || norm.includes('ultrasonic')) return COMPONENTS.find(c => c.name === 'HC-SR04');
  if (norm.includes('buzzer'))                                                           return COMPONENTS.find(c => c.name === 'Buzzer');
  if (norm.includes('dht11') || norm.includes('dht') || norm.includes('humidity'))      return COMPONENTS.find(c => c.name === 'DHT11');
  if (norm.includes('photoresistor') || norm.includes('ldr') || norm.includes('light sensor')) return COMPONENTS.find(c => c.name === 'Photoresistor');
  if (norm.includes('oled'))                                                             return COMPONENTS.find(c => c.name === 'OLED_I2C');
  if (norm.includes('lcd') || norm.includes('1602'))                                    return COMPONENTS.find(c => c.name === 'LCD_I2C');

  return COMPONENTS.find(c =>
    norm.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(norm)
  );
}

/** Find which board profile to use for an architecture option */
export function resolveBoard(option: { components: string[] }): BoardProfile {
  const defaultBoard = BOARD_PROFILES.find(b => b.name === 'ESP32')!;
  const boardComp = option.components.find(c => {
    const spec = findSpec(c);
    return spec?.is_microcontroller;
  });
  if (!boardComp) return defaultBoard;
  const spec = findSpec(boardComp);
  return BOARD_PROFILES.find(b => b.name === spec?.name) ?? defaultBoard;
}

// ─── Pin-name normaliser ──────────────────────────────────────────────────────

function getMentionedPins(componentStr: string, boardPins: BoardPin[]): string[] {
  const found: string[] = [];
  const norm = componentStr.toUpperCase();

  for (const pin of boardPins) {
    const pinUpper = pin.name.toUpperCase();
    const aliases = [pinUpper];
    if (pinUpper.startsWith('GPIO')) {
      const num = pinUpper.replace('GPIO', '');
      aliases.push(`D${num}`, ` ${num}`, `PIN ${num}`);
    } else if (pinUpper.startsWith('D') && !pinUpper.startsWith('DH')) {
      const num = pinUpper.slice(1);
      aliases.push(` ${num}`, `PIN ${num}`);
    }
    const matched = aliases.some(alias => new RegExp(`\\b${alias.trim()}\\b`).test(norm));
    if (matched) found.push(pin.name);
  }
  return found;
}

// ─── DRC Rule Catalog ─────────────────────────────────────────────────────────
// Each rule is a pure function: (context) → RuleViolation[]
// ZERO I/O. ZERO LLM calls. Same input → same output, always.

interface DRCContext {
  option: { components: string[] };
  board: BoardProfile;
  pinMap: Map<string, string>;          // pinName → componentLabel
  componentSpecs: { label: string; spec: ComponentSpec }[];
  totalCurrentMa: number;
  hasDriverModule: boolean;
}

/** VR-001: No two components share a pin */
function ruleVR001_noPinConflict(ctx: DRCContext): RuleViolation[] {
  // Pin conflicts are detected during pin-map construction; results passed in via pinMap
  // We surface them separately — see buildPinMap below
  return []; // violations injected by buildPinMap
}

/** VR-002: Component's required pin capabilities ⊆ assigned pin's capabilities */
function ruleVR002_pinCapability(
  component: string,
  spec: ComponentSpec,
  pin: BoardPin
): RuleViolation[] {
  const compatible = spec.pin_types_required.some(t => pin.types.includes(t as any));
  if (!compatible) {
    return [{
      ruleId: 'VR-002',
      severity: 'conflict',
      message: `${spec.name} requires a ${spec.pin_types_required.join('/')} pin, but ${pin.name} only supports ${pin.types.join('/')}. Reassign to a compatible pin.`,
      components: [component],
    }];
  }
  return [];
}

/** VR-003: Component voltage matches board logic voltage (or level-shifter present) */
function ruleVR003_voltageMatch(
  component: string,
  spec: ComponentSpec,
  board: BoardProfile,
  allComponents: string[]
): RuleViolation[] {
  if (spec.is_microcontroller) return [];
  if (spec.voltage === board.logic_voltage) return [];

  const hasShifter = allComponents.some(c => {
    const n = c.toLowerCase();
    return n.includes('level shift') || n.includes('logic convert') || n.includes('bss138') || n.includes('txs0108');
  });
  if (hasShifter) return [];

  return [{
    ruleId: 'VR-003',
    severity: 'conflict',
    message: `${spec.name} operates at ${spec.voltage} V but the ${board.name} runs at ${board.logic_voltage} V. Add a level-shifter or use a ${spec.voltage === 5 ? '5 V' : '3.3 V'}-compatible board.`,
    components: [component],
  }];
}

/** VR-004: Component current draw ≤ assigned pin's max current */
function ruleVR004_pinCurrentLimit(
  component: string,
  spec: ComponentSpec,
  pin: BoardPin
): RuleViolation[] {
  const limit = pin.max_current_ma ?? 40;
  if (spec.current_ma > limit) {
    return [{
      ruleId: 'VR-004',
      severity: 'conflict',
      message: `${spec.name} draws ${spec.current_ma} mA but pin ${pin.name} has a ${limit} mA limit. Power ${spec.name} from an external supply or use a driver module.`,
      components: [component],
    }];
  }
  return [];
}

/** VR-005: Total current draw ≤ board's total current budget (warn at 80–100 %, conflict if exceeded) */
function ruleVR005_totalCurrentBudget(totalMa: number, board: BoardProfile): RuleViolation[] {
  const budget = board.total_current_budget_ma;
  if (totalMa > budget) {
    return [{
      ruleId: 'VR-005',
      severity: 'conflict',
      message: `Combined current draw is ${totalMa} mA, which exceeds the ${board.name} regulator budget of ${budget} mA. Use an external 5 V/3.3 V power supply for high-draw components.`,
      components: [],
    }];
  }
  if (totalMa >= budget * 0.8) {
    return [{
      ruleId: 'VR-005',
      severity: 'warning',
      message: `Combined current draw is ${totalMa} mA — ${Math.round((totalMa / budget) * 100)} % of the ${board.name}'s ${budget} mA budget. Consider an external supply to avoid brownout.`,
      components: [],
    }];
  }
  return [];
}

/** VR-006: Component not assigned to a reserved pin */
function ruleVR006_reservedPins(
  component: string,
  spec: ComponentSpec,
  pin: BoardPin
): RuleViolation[] {
  if (pin.reserved) {
    return [{
      ruleId: 'VR-006',
      severity: 'conflict',
      message: `${spec.name} is assigned to reserved pin ${pin.name} (${pin.reserved_reason ?? 'reserved'}). Choose a different pin.`,
      components: [component],
    }];
  }
  return [];
}

/** VR-007: No two I2C components share a default address unless remappable */
function ruleVR007_i2cAddressConflict(
  items: { label: string; spec: ComponentSpec }[]
): RuleViolation[] {
  const violations: RuleViolation[] = [];
  const i2cItems = items.filter(i => i.spec.i2c_default_address !== undefined);
  const addressMap = new Map<number, { label: string; spec: ComponentSpec }[]>();

  for (const item of i2cItems) {
    const addr = item.spec.i2c_default_address!;
    if (!addressMap.has(addr)) addressMap.set(addr, []);
    addressMap.get(addr)!.push(item);
  }

  for (const [addr, group] of addressMap) {
    if (group.length < 2) continue;
    const allRemappable = group.every(g => g.spec.i2c_remappable);
    const names = group.map(g => g.spec.name);
    violations.push({
      ruleId: 'VR-007',
      severity: allRemappable ? 'warning' : 'conflict',
      message: allRemappable
        ? `${names.join(' and ')} share I2C address 0x${addr.toString(16).toUpperCase()}. At least one must be remapped via its address-select solder bridge before use.`
        : `${names.join(' and ')} share I2C address 0x${addr.toString(16).toUpperCase()} and cannot be remapped. Use only one, or add a TCA9548A I2C multiplexer.`,
      components: names,
    });
  }
  return violations;
}

/** VR-008: A requires_driver component has a driver/interface component present */
function ruleVR008_driverPresent(
  component: string,
  spec: ComponentSpec,
  hasDriverModule: boolean
): RuleViolation[] {
  if (spec.requires_driver && !hasDriverModule) {
    return [{
      ruleId: 'VR-008',
      severity: 'warning',
      message: `${spec.name} requires a driver module (e.g. Motor_Driver, transistor, L298N) but none is listed in this architecture. Add one to avoid damaging the GPIO pin.`,
      components: [component],
    }];
  }
  return [];
}

/** VR-009: A requires_pull_resistor component has pull-up noted */
function ruleVR009_pullResistor(
  component: string,
  spec: ComponentSpec,
  allComponentLabels: string[]
): RuleViolation[] {
  if (!spec.requires_pull_resistor) return [];
  const hasPullUpNote = allComponentLabels.some(c => {
    const n = c.toLowerCase();
    return n.includes('pull') || n.includes('resistor') || n.includes('4.7k') || n.includes('10k');
  });
  if (!hasPullUpNote) {
    return [{
      ruleId: 'VR-009',
      severity: 'warning',
      message: `${spec.name} requires a pull-up resistor on its data line. Add a 4.7 kΩ–10 kΩ resistor between the data pin and Vcc, or enable the board's internal pull-up in your sketch.`,
      components: [component],
    }];
  }
  return [];
}

// ─── Main validation entry point ─────────────────────────────────────────────

export function validateArchitecture(option: { components: string[] } | any): ValidationResult {
  const violations: RuleViolation[] = [];

  if (!option?.components || !Array.isArray(option.components)) {
    return {
      valid: false,
      violations: [{
        ruleId: 'VR-000',
        severity: 'conflict',
        message: 'No component list found in the architecture proposal. Cannot validate.',
        components: [],
      }],
      confidence: 'verify_manually',
    };
  }

  // ── Resolve board ────────────────────────────────────────────────────────────
  const board = resolveBoard(option);
  const allComponents: string[] = option.components;

  // ── Identify microcontroller and warn if absent ──────────────────────────────
  const mcuLabels = allComponents.filter(c => findSpec(c)?.is_microcontroller);
  if (mcuLabels.length === 0) {
    violations.push({
      ruleId: 'VR-000',
      severity: 'warning',
      message: `No microcontroller (e.g. ESP32, Arduino Uno) detected. Validation defaults to ${board.name} limits — verify manually.`,
      components: [],
    });
  }
  if (mcuLabels.length > 1) {
    violations.push({
      ruleId: 'VR-000',
      severity: 'warning',
      message: `Multiple microcontrollers detected (${mcuLabels.join(', ')}). Validating against: ${board.name}.`,
      components: mcuLabels,
    });
  }

  // ── Build component index ────────────────────────────────────────────────────
  const componentItems: { label: string; spec: ComponentSpec }[] = [];
  const unknownComponents: string[] = [];

  for (const label of allComponents) {
    const spec = findSpec(label);
    if (!spec) {
      unknownComponents.push(label);
      violations.push({
        ruleId: 'VR-000',
        severity: 'warning',
        message: `"${label}" is not in the component catalog — verify connections manually.`,
        components: [label],
      });
      continue;
    }
    if (!spec.is_microcontroller) {
      componentItems.push({ label, spec });
    }
  }

  // ── Driver detection ─────────────────────────────────────────────────────────
  const hasDriverModule = allComponents.some(c => {
    const s = findSpec(c);
    return (
      s?.name === 'Motor_Driver' ||
      c.toLowerCase().includes('driver') ||
      c.toLowerCase().includes('l298n') ||
      c.toLowerCase().includes('uln2003')
    );
  });

  // ── VR-007: I2C address conflicts ─────────────────────────────────────────────
  violations.push(...ruleVR007_i2cAddressConflict(componentItems));

  // ── Pin mapping and per-component rules ──────────────────────────────────────
  const pinMap = new Map<string, string>(); // pinName → componentLabel
  let totalCurrentMa = 0;

  const pinMapConflicts: RuleViolation[] = [];
  const pendingAutoAlloc: { label: string; spec: ComponentSpec }[] = [];

  for (const { label, spec } of componentItems) {
    totalCurrentMa += spec.current_ma;

    // VR-008: driver present?
    violations.push(...ruleVR008_driverPresent(label, spec, hasDriverModule));

    // VR-009: pull resistor noted?
    violations.push(...ruleVR009_pullResistor(label, spec, allComponents));

    const mentionedPins = getMentionedPins(label, board.pins);

    if (mentionedPins.length > 0) {
      for (const pinName of mentionedPins) {
        const pin = board.pins.find(p => p.name === pinName)!;

        // VR-001: pin already used?
        if (pinMap.has(pinName)) {
          pinMapConflicts.push({
            ruleId: 'VR-001',
            severity: 'conflict',
            message: `Pin ${pinName} is assigned to both "${pinMap.get(pinName)}" and "${label}". Each pin may only be used by one component.`,
            components: [pinMap.get(pinName)!, label],
          });
        } else {
          pinMap.set(pinName, label);
        }

        // VR-002: pin capability check
        violations.push(...ruleVR002_pinCapability(label, spec, pin));

        // VR-004: per-pin current limit
        violations.push(...ruleVR004_pinCurrentLimit(label, spec, pin));

        // VR-006: reserved pin
        violations.push(...ruleVR006_reservedPins(label, spec, pin));
      }
    } else {
      pendingAutoAlloc.push({ label, spec });
    }

    // VR-003: voltage match (regardless of explicit pin or not)
    violations.push(...ruleVR003_voltageMatch(label, spec, board, allComponents));
  }

  violations.push(...pinMapConflicts);

  // ── Auto-allocate unspecified pins ────────────────────────────────────────────
  for (const { label, spec } of pendingAutoAlloc) {
    const needed = spec.name === 'HC-SR04' ? 2 : 1;
    for (let i = 0; i < needed; i++) {
      const match = board.pins.find(pin => {
        if (pin.reserved) return false;
        if (pinMap.has(pin.name)) return false;
        return spec.pin_types_required.some(t => pin.types.includes(t as any));
      });
      if (match) {
        pinMap.set(match.name, label);
      } else {
        violations.push({
          ruleId: 'VR-002',
          severity: 'conflict',
          message: `No available ${spec.pin_types_required.join('/')} pin on ${board.name} for "${label}". All compatible pins are already in use.`,
          components: [label],
        });
      }
    }
  }

  // ── VR-005: total current budget ──────────────────────────────────────────────
  violations.push(...ruleVR005_totalCurrentBudget(totalCurrentMa, board));

  const conflicts = violations.filter(v => v.severity === 'conflict');

  return {
    valid: conflicts.length === 0,
    violations,
    confidence: (violations.length === 0) ? 'validated' : 'verify_manually',
  };
}
