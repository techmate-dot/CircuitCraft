export interface ComponentSpec {
  name: string;
  category: "Sensors" | "Actuators" | "Power" | "Control";
  pin_types_supported: ("digital" | "analog" | "pwm" | "i2c" | "interrupt")[];
  voltage: number;
  current_ma: number;
  requires_driver: boolean;
  notes: string;
  is_microcontroller?: boolean;
  available_pins?: { name: string; types: ("digital" | "analog" | "pwm" | "i2c" | "interrupt")[] }[];
  max_current_limit_ma?: number;
}

export const COMPONENTS: ComponentSpec[] = [
  {
    name: "ESP32",
    category: "Control",
    pin_types_supported: ["digital", "analog", "pwm", "i2c", "interrupt"],
    voltage: 3.3,
    current_ma: 240, // Base current with active radio
    requires_driver: false,
    notes: "ESP32 microcontroller with Wi-Fi & Bluetooth",
    is_microcontroller: true,
    max_current_limit_ma: 500, // Safe regulator output limit
    available_pins: [
      { name: "GPIO2", types: ["digital", "pwm"] },
      { name: "GPIO4", types: ["digital", "analog", "pwm"] },
      { name: "GPIO5", types: ["digital"] },
      { name: "GPIO12", types: ["digital", "analog", "pwm"] },
      { name: "GPIO13", types: ["digital", "analog", "pwm", "interrupt"] },
      { name: "GPIO14", types: ["digital", "analog", "pwm"] },
      { name: "GPIO15", types: ["digital", "analog", "pwm"] },
      { name: "GPIO18", types: ["digital"] },
      { name: "GPIO19", types: ["digital"] },
      { name: "GPIO21", types: ["digital", "i2c"] }, // SDA
      { name: "GPIO22", types: ["digital", "i2c"] }, // SCL
      { name: "GPIO23", types: ["digital"] },
      { name: "GPIO25", types: ["digital", "analog", "pwm"] },
      { name: "GPIO26", types: ["digital", "analog", "pwm"] },
      { name: "GPIO27", types: ["digital", "analog", "pwm"] },
      { name: "GPIO32", types: ["digital", "analog"] },
      { name: "GPIO33", types: ["digital", "analog"] }
    ]
  },
  {
    name: "Arduino_Uno",
    category: "Control",
    pin_types_supported: ["digital", "analog", "pwm", "i2c", "interrupt"],
    voltage: 5,
    current_ma: 50,
    requires_driver: false,
    notes: "ATmega328P based microcontroller board",
    is_microcontroller: true,
    max_current_limit_ma: 400, // Total current budget from 5V pin / regulator
    available_pins: [
      { name: "D0", types: ["digital"] },
      { name: "D1", types: ["digital"] },
      { name: "D2", types: ["digital", "interrupt"] },
      { name: "D3", types: ["digital", "pwm", "interrupt"] },
      { name: "D4", types: ["digital"] },
      { name: "D5", types: ["digital", "pwm"] },
      { name: "D6", types: ["digital", "pwm"] },
      { name: "D7", types: ["digital"] },
      { name: "D8", types: ["digital"] },
      { name: "D9", types: ["digital", "pwm"] },
      { name: "D10", types: ["digital", "pwm"] },
      { name: "D11", types: ["digital", "pwm"] },
      { name: "D12", types: ["digital"] },
      { name: "D13", types: ["digital"] },
      { name: "A0", types: ["digital", "analog"] },
      { name: "A1", types: ["digital", "analog"] },
      { name: "A2", types: ["digital", "analog"] },
      { name: "A3", types: ["digital", "analog"] },
      { name: "A4", types: ["digital", "analog", "i2c"] }, // SDA
      { name: "A5", types: ["digital", "analog", "i2c"] }  // SCL
    ]
  },
  {
    name: "LED",
    category: "Actuators",
    pin_types_supported: ["digital", "pwm"],
    voltage: 3.3,
    current_ma: 20,
    requires_driver: false,
    notes: "Basic Light Emitting Diode (requires resistor)"
  },
  {
    name: "PIR_Sensor",
    category: "Sensors",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 1,
    requires_driver: false,
    notes: "Passive Infrared motion sensor"
  },
  {
    name: "HC-SR04",
    category: "Sensors",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 15,
    requires_driver: false,
    notes: "Ultrasonic distance sensor (requires 2 digital pins: Trig & Echo)"
  },
  {
    name: "SG90_Servo",
    category: "Actuators",
    pin_types_supported: ["pwm"],
    voltage: 5,
    current_ma: 500, // Peak stall current
    requires_driver: false,
    notes: "Micro servo motor (requires PWM, draws up to 500mA peak)"
  },
  {
    name: "Buzzer",
    category: "Actuators",
    pin_types_supported: ["digital", "pwm"],
    voltage: 5,
    current_ma: 30,
    requires_driver: false,
    notes: "Piezo buzzer"
  },
  {
    name: "Relay_Coil",
    category: "Actuators",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 70,
    requires_driver: true,
    notes: "Raw electromechanical relay coil. Requires a transistor driver circuit."
  },
  {
    name: "Relay_Module",
    category: "Actuators",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 5, // Module control current (integrated driver)
    requires_driver: false,
    notes: "Relay module with integrated driver transistor/optocoupler"
  },
  {
    name: "DC_Motor",
    category: "Actuators",
    pin_types_supported: ["pwm", "digital"],
    voltage: 6,
    current_ma: 250,
    requires_driver: true,
    notes: "Direct Current toy motor. Requires H-bridge or transistor driver."
  },
  {
    name: "Motor_Driver",
    category: "Control",
    pin_types_supported: ["digital", "pwm"],
    voltage: 5,
    current_ma: 20, // logic current
    requires_driver: false,
    notes: "Motor driver or transistor board (e.g. ULN2003, L298N, driver transistor)"
  },
  {
    name: "DHT11",
    category: "Sensors",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 2.5,
    requires_driver: false,
    notes: "Digital temperature and humidity sensor"
  },
  {
    name: "Photoresistor",
    category: "Sensors",
    pin_types_supported: ["analog"],
    voltage: 3.3,
    current_ma: 1,
    requires_driver: false,
    notes: "Light dependent resistor (requires voltage divider setup)"
  },
  {
    name: "LCD_I2C",
    category: "Actuators",
    pin_types_supported: ["i2c"],
    voltage: 5,
    current_ma: 50,
    requires_driver: false,
    notes: "16x2 Character LCD with I2C backpack"
  }
];

export interface ValidationResult {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  confidence: "validated" | "verify_manually";
}

// Helper to resolve generic user/LLM names to our spec definitions
export function findSpec(componentName: string): ComponentSpec | undefined {
  const norm = componentName.toLowerCase();
  
  if (norm.includes("esp32")) return COMPONENTS.find(c => c.name === "ESP32");
  if (norm.includes("uno") || norm.includes("arduino")) return COMPONENTS.find(c => c.name === "Arduino_Uno");
  if (norm.includes("relay") && (norm.includes("module") || norm.includes("driver"))) return COMPONENTS.find(c => c.name === "Relay_Module");
  if (norm.includes("relay")) return COMPONENTS.find(c => c.name === "Relay_Coil");
  if (norm.includes("servo")) return COMPONENTS.find(c => c.name === "SG90_Servo");
  if (norm.includes("dc motor") || (norm.includes("motor") && !norm.includes("driver"))) return COMPONENTS.find(c => c.name === "DC_Motor");
  if (norm.includes("driver") || norm.includes("l298n") || norm.includes("uln2003")) return COMPONENTS.find(c => c.name === "Motor_Driver");
  if (norm.includes("led")) return COMPONENTS.find(c => c.name === "LED");
  if (norm.includes("pir") || norm.includes("sr501") || norm.includes("motion")) return COMPONENTS.find(c => c.name === "PIR_Sensor");
  if (norm.includes("hc-sr04") || norm.includes("sr04") || norm.includes("ultrasonic")) return COMPONENTS.find(c => c.name === "HC-SR04");
  if (norm.includes("buzzer")) return COMPONENTS.find(c => c.name === "Buzzer");
  if (norm.includes("dht11") || norm.includes("dht") || norm.includes("humidity")) return COMPONENTS.find(c => c.name === "DHT11");
  if (norm.includes("photoresistor") || norm.includes("ldr") || norm.includes("light sensor")) return COMPONENTS.find(c => c.name === "Photoresistor");
  if (norm.includes("lcd") || norm.includes("1602")) return COMPONENTS.find(c => c.name === "LCD_I2C");

  return COMPONENTS.find(c => norm.includes(c.name.toLowerCase()) || c.name.toLowerCase().includes(norm));
}

// Find all pins explicitly mentioned in a component label string
function getMentionedPins(componentStr: string, availablePins: { name: string }[]): string[] {
  const found: string[] = [];
  const normalizedStr = componentStr.toUpperCase();
  
  for (const pinSpec of availablePins) {
    const pinName = pinSpec.name.toUpperCase();
    
    // Create checkable aliases
    // e.g. "GPIO2" can be matched as "GPIO2", "D2", or "2"
    // "D13" can be matched as "D13" or "13"
    const aliases = [pinName];
    if (pinName.startsWith('GPIO')) {
      const pinNum = pinName.replace('GPIO', '');
      aliases.push(`D${pinNum}`);
      aliases.push(` ${pinNum}`);
      aliases.push(`PIN ${pinNum}`);
    } else if (pinName.startsWith('D')) {
      const pinNum = pinName.replace('D', '');
      aliases.push(` ${pinNum}`);
      aliases.push(`PIN ${pinNum}`);
    }
    
    const matched = aliases.some(alias => {
      // Look for boundary-separated words to avoid matching "1" inside "GPIO12"
      const regex = new RegExp(`\\b${alias.trim()}\\b`);
      return regex.test(normalizedStr);
    });
    
    if (matched) {
      found.push(pinSpec.name);
    }
  }
  return found;
}

export function validateArchitecture(option: any): ValidationResult {
  const conflicts: string[] = [];
  const warnings: string[] = [];
  
  if (!option || !option.components || !Array.isArray(option.components)) {
    return { valid: false, conflicts: ["No components list found in proposal"], warnings: [], confidence: "verify_manually" };
  }

  // 1. Find Host Microcontroller
  const boardComponents = option.components.filter((c: string) => {
    const spec = findSpec(c);
    return spec && spec.is_microcontroller;
  });

  let hostBoard = COMPONENTS.find(c => c.name === "ESP32")!; // default fallback
  if (boardComponents.length === 0) {
    warnings.push("No microcontroller board (e.g. ESP32, Arduino Uno) detected in architecture list. Defaulting to ESP32 limits.");
  } else {
    const matchedBoard = findSpec(boardComponents[0]);
    if (matchedBoard) {
      hostBoard = matchedBoard;
    }
    if (boardComponents.length > 1) {
      warnings.push(`Multiple microcontrollers detected (${boardComponents.join(', ')}). Validating against: ${hostBoard.name}.`);
    }
  }

  const availablePins = hostBoard.available_pins || [];
  const usedPinsMap = new Map<string, string>(); // Pin Name -> Component Name
  let totalCurrentDraw = 0;
  let hasDriverModule = option.components.some((c: string) => {
    const spec = findSpec(c);
    return spec && (spec.name === "Motor_Driver" || c.toLowerCase().includes("driver") || c.toLowerCase().includes("l298n") || c.toLowerCase().includes("uln2003"));
  });

  // Keep track of unmapped components of each type for auto-allocation
  interface ComponentAllocation {
    name: string;
    spec: ComponentSpec;
  }
  const pendingAllocation: ComponentAllocation[] = [];

  // 2. First pass: Process explicit pin mappings & gather electrical details
  for (const componentStr of option.components) {
    const spec = findSpec(componentStr);
    if (!spec) {
      warnings.push(`${componentStr}: no component specification on file. Verify connections manually.`);
      continue;
    }

    // Skip the host board itself for pin check and current sum
    if (spec.is_microcontroller) {
      continue;
    }

    // Accumulate power consumption
    totalCurrentDraw += spec.current_ma;

    // Check driver requirements
    if (spec.requires_driver && !hasDriverModule) {
      warnings.push(`${spec.name} (${componentStr}) requires a driver module/shield, but no driver was listed in components.`);
    }

    // Detect if component explicitly lists pins
    const pinsUsed = getMentionedPins(componentStr, availablePins);
    
    if (pinsUsed.length > 0) {
      for (const pinName of pinsUsed) {
        // Check for duplicate pin assignment
        if (usedPinsMap.has(pinName)) {
          conflicts.push(`Pin ${pinName} is assigned to multiple components: ${usedPinsMap.get(pinName)} and ${componentStr}`);
        } else {
          usedPinsMap.set(pinName, componentStr);
        }

        // Check pin type compatibility
        const boardPin = availablePins.find(p => p.name === pinName);
        if (boardPin) {
          const compatible = spec.pin_types_supported.some(requiredType => boardPin.types.includes(requiredType));
          if (!compatible) {
            conflicts.push(`Pin ${pinName} (${boardPin.types.join('/')}) does not support the required type (${spec.pin_types_supported.join('/')}) for ${componentStr}`);
          }
        }
      }
    } else {
      // Needs auto-allocation
      pendingAllocation.push({ name: componentStr, spec });
    }
  }

  // 3. Second pass: Auto-allocate pins for components that did not specify them
  for (const pending of pendingAllocation) {
    const requiredTypes = pending.spec.pin_types_supported;
    
    // For ultrasonic (HC-SR04), it requires 2 digital pins (Trig and Echo)
    const pinsNeededCount = pending.spec.name === "HC-SR04" ? 2 : 1;
    const allocatedPins: string[] = [];

    for (let i = 0; i < pinsNeededCount; i++) {
      // Find first available board pin that matches required types and is not yet used
      const matchingPin = availablePins.find(pin => {
        if (usedPinsMap.has(pin.name)) return false;
        return requiredTypes.some(t => pin.types.includes(t));
      });

      if (matchingPin) {
        usedPinsMap.set(matchingPin.name, pending.name);
        allocatedPins.push(matchingPin.name);
      } else {
        conflicts.push(`Not enough available pins on ${hostBoard.name} to allocate a ${requiredTypes.join('/')} pin for ${pending.name}`);
        break;
      }
    }
  }

  // 4. Power limit check
  const powerLimit = hostBoard.max_current_limit_ma || 500;
  if (totalCurrentDraw > powerLimit) {
    warnings.push(`Combined current draw (${totalCurrentDraw}mA) exceeds the ${hostBoard.name} board limit of ${powerLimit}mA. An external power supply is highly recommended.`);
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    warnings,
    confidence: (conflicts.length === 0 && warnings.length === 0) ? "validated" : "verify_manually"
  };
}
