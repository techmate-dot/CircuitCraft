export interface ComponentSpec {
  name: string;
  pin_types_supported: ("digital" | "analog" | "pwm" | "i2c" | "interrupt")[];
  voltage: number;
  current_ma: number;
  requires_driver: boolean;
  notes: string;
}

export const COMPONENTS: ComponentSpec[] = [
  {
    name: "HC-SR04P",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 15,
    requires_driver: false,
    notes: "Ultrasonic distance sensor"
  },
  {
    name: "HC-SR04",
    pin_types_supported: ["digital"],
    voltage: 5,
    current_ma: 15,
    requires_driver: false,
    notes: "Ultrasonic distance sensor"
  },
  {
    name: "LED",
    pin_types_supported: ["digital", "pwm"],
    voltage: 3.3,
    current_ma: 20,
    requires_driver: false,
    notes: "Basic light emitting diode"
  },
  {
    name: "PIR_Sensor",
    pin_types_supported: ["digital"],
    voltage: 3.3,
    current_ma: 1,
    requires_driver: false,
    notes: "Passive Infrared motion sensor"
  },
  {
    name: "Servo_Motor",
    pin_types_supported: ["pwm"],
    voltage: 5,
    current_ma: 500,
    requires_driver: false,
    notes: "Micro servo motor"
  },
  {
    name: "Buzzer",
    pin_types_supported: ["digital", "pwm"],
    voltage: 3.3,
    current_ma: 30,
    requires_driver: false,
    notes: "Piezo buzzer"
  },
  {
    name: "ESP32",
    pin_types_supported: ["digital", "analog", "pwm", "i2c", "interrupt"],
    voltage: 3.3,
    current_ma: 500,
    requires_driver: false,
    notes: "Microcontroller"
  }
];

export interface ValidationResult {
  valid: boolean;
  conflicts: string[];
  warnings: string[];
  confidence: "validated" | "verify_manually";
}

export function validateArchitecture(option: any): ValidationResult {
  const conflicts: string[] = [];
  const warnings: string[] = [];
  
  if (!option || !option.components) {
    return { valid: false, conflicts: ["No components"], warnings: [], confidence: "verify_manually" };
  }

  for (const componentName of option.components) {
    // Basic fuzz matching for demo since LLM might generate slightly different names
    const componentStr = componentName.toLowerCase();
    const spec = COMPONENTS.find(s => componentStr.includes(s.name.toLowerCase().split('_')[0]));
    
    if (!spec) { 
      warnings.push(`${componentName}: no spec on file, verify manually.`); 
      continue; 
    }
    // simple current draw check
    if (spec.current_ma > 400 && !componentStr.includes('esp32')) {
      warnings.push(`${componentName} draws high current (${spec.current_ma}mA) which might require external power.`);
    }
    if (spec.requires_driver && !option.components.some((c: string) => c.toLowerCase().includes('driver'))) {
      warnings.push(`${componentName} requires a driver according to spec, but none was listed.`);
    }
  }

  // Artificial conflict injection for demo purposes
  if (option.components.join('').toLowerCase().includes('servo') && option.components.join('').toLowerCase().includes('buzzer')) {
     conflicts.push("Pin 13 assigned to both Servo and Buzzer (simulated conflict).");
  }

  return {
    valid: conflicts.length === 0,
    conflicts,
    warnings,
    confidence: warnings.length === 0 ? "validated" : "verify_manually",
  };
}
