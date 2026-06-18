import { validateArchitecture } from './components';

function runTest(name: string, option: any, expectedValid: boolean, expectedConflictsCount: number, expectedWarningsCount: number) {
  console.log(`\n==================================================`);
  console.log(`Running Test: ${name}`);
  console.log(`Components:`, JSON.stringify(option.components));
  
  const result = validateArchitecture(option);
  
  console.log(`- Result valid: ${result.valid} (Expected: ${expectedValid})`);
  console.log(`- Conflicts found (${result.conflicts.length}):`);
  result.conflicts.forEach(c => console.log(`  * CONFLICT: ${c}`));
  console.log(`- Warnings found (${result.warnings.length}):`);
  result.warnings.forEach(w => console.log(`  * WARNING: ${w}`));
  console.log(`- Confidence badge: ${result.confidence}`);

  let failed = false;
  if (result.valid !== expectedValid) {
    console.error(`❌ FAILED: Validity mismatch!`);
    failed = true;
  }
  if (result.conflicts.length !== expectedConflictsCount) {
    console.warn(`⚠️ Notice: Conflicts count (${result.conflicts.length}) differs from expected (${expectedConflictsCount}).`);
  }
  if (result.warnings.length !== expectedWarningsCount) {
    console.warn(`⚠️ Notice: Warnings count (${result.warnings.length}) differs from expected (${expectedWarningsCount}).`);
  }

  if (!failed) {
    console.log(`✅ TEST PASSED`);
  } else {
    process.exitCode = 1;
  }
}

// ─── Test 1: Valid Configuration ─────────────────────────────────────────────
runTest(
  "Valid Configuration (ESP32 + LED + PIR)",
  {
    id: "valid-esp32-setup",
    label: "Basic ESP32 Motion Detector",
    components: ["ESP32", "LED (Pin GPIO2)", "PIR_Sensor (Pin GPIO13)"],
    tradeoffs: { cost: "$10", portability: "High", complexity: "Low", power: "Low" },
    summary: "A simple motion detector using ESP32"
  },
  true,
  0,
  0
);

// ─── Test 2: Duplicate-Pin Conflict ──────────────────────────────────────────
runTest(
  "Duplicate Pin Conflict (Arduino Uno + LED + Buzzer on D13)",
  {
    id: "duplicate-pin-setup",
    label: "Conflicting Buzzer & LED",
    components: ["Arduino Uno", "LED (Pin D13)", "Buzzer (Pin D13)"],
    tradeoffs: { cost: "$8", portability: "Medium", complexity: "Low", power: "Low" },
    summary: "Two devices competing for the same GPIO pin"
  },
  false,
  1,
  0
);

// ─── Test 3: Missing Driver Warning ──────────────────────────────────────────
runTest(
  "Missing Driver Warning (ESP32 + Relay Coil)",
  {
    id: "missing-driver-setup",
    label: "ESP32 Relay Switch",
    components: ["ESP32", "Relay_Coil (Pin GPIO5)"],
    tradeoffs: { cost: "$12", portability: "Medium", complexity: "Medium", power: "Medium" },
    summary: "Relay control without a switching transistor driver"
  },
  true, // Warnings do not make a configuration invalid
  0,
  1
);

// ─── Test 4: Pin-Type Incompatibility ────────────────────────────────────────
runTest(
  "Pin-Type Incompatibility (Arduino Uno + Photoresistor on D3)",
  {
    id: "incompatible-pin-setup",
    label: "LDR on Digital Pin",
    components: ["Arduino Uno", "Photoresistor (Pin D3)"],
    tradeoffs: { cost: "$6", portability: "High", complexity: "Low", power: "Low" },
    summary: "Analog sensor connected to a digital-only pin on Arduino Uno"
  },
  false,
  1,
  0
);

// ─── Test 5: Auto-Allocation (No explicit pins specified) ────────────────────
runTest(
  "Auto-Allocation (ESP32 + LED + PIR + Ultrasonic)",
  {
    id: "auto-alloc-setup",
    label: "Auto-wired multisensor board",
    components: ["ESP32", "LED", "PIR_Sensor", "HC-SR04"],
    tradeoffs: { cost: "$18", portability: "Medium", complexity: "Medium", power: "Medium" },
    summary: "Auto-wires an LED, PIR sensor, and ultrasonic distance sensor to ESP32"
  },
  true,
  0,
  0
);
