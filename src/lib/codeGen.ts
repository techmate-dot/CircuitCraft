/**
 * codeGen.ts — Arduino C++ template generator, no AI involved.
 *
 * Takes a PinAssignment[] and inserts the validated pin numbers into a fixed
 * C++ template via string substitution. This is NOT free-form code generation —
 * the logic structure is hardcoded; only the pin constants change.
 *
 * Scoped to Milestone 1 only: setup() wiring + a minimal loop() stub.
 */

import type { PinAssignment } from '../types';

// ─── Pin number extractor ─────────────────────────────────────────────────────
// Converts "GPIO13" → 13, "D5" → 5, "A0" → A0 (kept as-is for Arduino Uno analog)
function toCppPin(pin: string): string {
  if (pin === 'UNASSIGNED') return '/* UNASSIGNED */';
  const gpioMatch = pin.match(/^GPIO(\d+)$/i);
  if (gpioMatch) return gpioMatch[1];
  const dMatch = pin.match(/^D(\d+)$/i);
  if (dMatch) return dMatch[1];
  return pin; // A0, A1, etc. pass through unchanged
}

// ─── pinMode string ───────────────────────────────────────────────────────────
function toPinMode(role: PinAssignment['role'], pinType: PinAssignment['pinType']): string {
  if (role === 'input') return 'INPUT';
  if (pinType === 'pwm') return 'OUTPUT'; // PWM is always OUTPUT
  return 'OUTPUT';
}

// ─── Per-component setup() line ───────────────────────────────────────────────
function setupLine(a: PinAssignment): string {
  const pin = toCppPin(a.pin);
  if (a.pinType === 'i2c') {
    return `  Wire.begin(); // ${a.component} uses I2C (SDA/SCL)`;
  }
  return `  pinMode(${pin}, ${toPinMode(a.role, a.pinType)}); // ${a.component}`;
}

// ─── Per-component loop() stub ────────────────────────────────────────────────
function loopStub(a: PinAssignment): string {
  const pin = toCppPin(a.pin);
  if (a.pinType === 'i2c') return ''; // I2C handled in library calls, not raw digitalWrite

  switch (a.component) {
    case 'LED':
      return `  digitalWrite(${pin}, HIGH); // Turn LED on (${a.component})\n  delay(1000);\n  digitalWrite(${pin}, LOW);  // Turn LED off\n  delay(1000);`;
    case 'Buzzer':
      return `  tone(${pin}, 1000, 200); // Beep buzzer at 1kHz for 200ms`;
    case 'PIR_Sensor':
      return `  int motion${pin} = digitalRead(${pin}); // Read PIR_Sensor\n  if (motion${pin} == HIGH) {\n    // Motion detected — add your response here\n  }`;
    case 'HC-SR04':
      return `  // HC-SR04 ultrasonic — Trig on ${pin}\n  digitalWrite(${pin}, LOW); delayMicroseconds(2);\n  digitalWrite(${pin}, HIGH); delayMicroseconds(10);\n  digitalWrite(${pin}, LOW);`;
    case 'SG90_Servo':
      return `  // SG90 Servo on pin ${pin} — use the Servo library\n  // servo.write(90); // Set angle`;
    case 'DHT11':
      return `  // DHT11 on pin ${pin} — use DHT library\n  // float temp = dht.readTemperature();`;
    case 'Photoresistor':
      return `  int light${pin} = analogRead(${pin}); // Read LDR value (0-1023)`;
    case 'Relay_Coil':
    case 'Relay_Module':
      return `  digitalWrite(${pin}, HIGH); // Activate relay on ${a.component}\n  delay(1000);\n  digitalWrite(${pin}, LOW);  // Deactivate relay\n  delay(1000);`;
    default:
      return `  // ${a.component} on pin ${pin} — add your logic here`;
  }
}

// ─── Generate includes based on components ────────────────────────────────────
function generateIncludes(assignments: PinAssignment[]): string {
  const includes: string[] = ['#include <Arduino.h>'];
  const names = assignments.map(a => a.component);
  if (names.includes('LCD_I2C')) includes.push('#include <LiquidCrystal_I2C.h>');
  if (names.includes('SG90_Servo')) includes.push('#include <Servo.h>');
  if (names.includes('DHT11')) includes.push('#include <DHT.h>');
  if (names.some(n => n.includes('I2C') || n.includes('LCD'))) includes.push('#include <Wire.h>');
  return includes.join('\n');
}

// ─── Generate #define constants ───────────────────────────────────────────────
function generateDefines(assignments: PinAssignment[]): string {
  return assignments
    .filter(a => a.pin !== 'UNASSIGNED' && a.pinType !== 'i2c')
    .map(a => `#define PIN_${a.component.toUpperCase().replace(/[^A-Z0-9]/g, '_')} ${toCppPin(a.pin)}`)
    .join('\n');
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function generateArduinoCode(
  assignments: PinAssignment[],
  optionLabel: string,
  confidence: 'validated' | 'verify_manually'
): string {
  const nonI2cAssignments = assignments.filter(a => a.pinType !== 'i2c');
  const confidenceNote = confidence === 'verify_manually'
    ? '// ⚠️  VALIDATION CONFIDENCE: verify_manually — review warnings before flashing\n'
    : '// ✓  VALIDATION CONFIDENCE: validated\n';

  const includes = generateIncludes(assignments);
  const defines = generateDefines(assignments);

  const setupLines = assignments
    .map(setupLine)
    .filter(Boolean)
    .join('\n');

  const loopLines = nonI2cAssignments
    .map(loopStub)
    .filter(Boolean)
    .join('\n\n');

  return `${confidenceNote}// Generated for: ${optionLabel}
// Milestone 1 — Hardware setup and basic I/O
// Pin numbers validated against component spec table. Do NOT edit manually.

${includes}

// ── Pin assignments (validated) ───────────────────────────────────────────────
${defines || '// (no digital/analog pins — all I2C)'}

void setup() {
  Serial.begin(115200);
${setupLines}
}

void loop() {
${loopLines || '  // Add your project logic here'}
}
`;
}
