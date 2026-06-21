/**
 * registerRuntimeBlock.ts
 *
 * Registers a ComponentSpec as a live Blockly block + Arduino generator entry
 * at runtime — after the initial static block table has been built.
 *
 * The block *shape* is always derived deterministically from the spec (same
 * rule as Section 2). Only the spec itself may originate from AI (via
 * /api/spec). No raw Blockly JSON or Arduino code ever comes from the LLM.
 *
 * Two callers:
 *   1. CustomBlockPanel — user searched for something not in the static table.
 *   2. Future: BOM view, component swap — any place that needs a new spec block.
 */

import * as Blockly from 'blockly';
import type { ComponentSpec } from '../data/components';
import { BOARD_PROFILES } from '../data/components';
import arduinoGenerator from './arduinoGenerator';

// ─── Category colour table (matches CenterPanel) ─────────────────────────────
const CATEGORY_COLOUR: Record<string, string> = {
  Sensors:   '#b87333',
  Actuators: '#d4af37',
  Control:   '#9da3a6',
  Power:     '#cc6633',
};

// ─── Static pin options from ESP32 profile ───────────────────────────────────
// For runtime blocks we use the full ESP32 pin list filtered by compatibility.
// The user can change the pin in the dropdown after placing the block.
function staticPinOptions(spec: ComponentSpec): [string, string][] {
  const board = BOARD_PROFILES.find(b => b.name === 'ESP32')!;
  const compatible = board.pins.filter(
    p => !p.reserved && p.types.some(t => spec.pin_types_required.includes(t as any))
  );
  return compatible.length ? compatible.map(p => [p.name, p.name]) : [['None', 'None']];
}

// ─── Build a Blockly JSON block definition from a ComponentSpec ───────────────
export function specToBlockJson(spec: ComponentSpec): object {
  const colour = CATEGORY_COLOUR[spec.category] ?? '#9da3a6';
  const label  = spec.name.replace(/_/g, ' ');
  const pins   = staticPinOptions(spec);

  const base: any = {
    type:    `hardware_${spec.name}`,
    colour,
    tooltip: spec.notes,
    previousStatement: null,
    nextStatement:     null,
  };

  if (spec.is_microcontroller) {
    base.message0 = `${label} Controller`;
    delete base.previousStatement;
    return base;
  }

  const pinField = (name: string) => ({
    type: 'field_dropdown',
    name,
    options: pins,
  });

  if (spec.pin_types_required.includes('i2c')) {
    base.message0 = `${label} SDA %1 SCL %2`;
    base.args0 = [pinField('SDA_PIN'), pinField('SCL_PIN')];
    return base;
  }

  const isOutput = spec.category === 'Actuators' || spec.category === 'Power';

  if (spec.pin_types_required.includes('pwm')) {
    base.message0 = `${label} Pin %1`;
    base.args0 = [pinField('PIN')];
    return base;
  }

  if (isOutput) {
    base.message0 = `${label} Pin %1 State %2`;
    base.args0 = [
      pinField('PIN'),
      { type: 'field_dropdown', name: 'STATE', options: [['HIGH', 'HIGH'], ['LOW', 'LOW']] },
    ];
  } else {
    base.message0 = `${label} Pin %1`;
    base.args0 = [pinField('PIN')];
  }

  return base;
}

// ─── Register an Arduino code generator for the new block type ───────────────
function registerArduinoGen(spec: ComponentSpec): void {
  const blockType = `hardware_${spec.name}`;
  if (arduinoGenerator.forBlock[blockType]) return;

  const isInput  = spec.category === 'Sensors';
  const pinType  = spec.pin_types_required[0] ?? 'digital';
  const safeName = spec.name.toLowerCase().replace(/[^a-z0-9]/g, '_');

  arduinoGenerator.forBlock[blockType] = function (block: any, generator: any) {
    const pin =
      block.getFieldValue('PIN') ??
      block.getFieldValue('SDA_PIN') ??
      'PIN_UNSET';

    if (pinType === 'i2c') {
      const sda = block.getFieldValue('SDA_PIN') ?? pin;
      const scl = block.getFieldValue('SCL_PIN') ?? 'SCL';
      generator.includeLines_.push('#include <Wire.h>');
      generator.setupLines_.push(`Wire.begin(${sda}, ${scl}); // ${spec.name}`);
      return `  // ${spec.name}: add library calls here\n  delay(100);\n`;
    }

    if (pinType === 'analog') {
      return (
        `  int ${safeName}_val = analogRead(${pin}); // ${spec.name}\n` +
        `  Serial.print("${spec.name}: ");\n` +
        `  Serial.println(${safeName}_val);\n` +
        `  delay(500);\n`
      );
    }

    if (isInput) {
      generator.setupLines_.push(`pinMode(${pin}, INPUT); // ${spec.name}`);
      return `  int ${safeName}_state = digitalRead(${pin}); // ${spec.name}\n  delay(100);\n`;
    }

    // Output (actuator / power)
    const state = block.getFieldValue('STATE') ?? 'HIGH';
    generator.setupLines_.push(`pinMode(${pin}, OUTPUT); // ${spec.name}`);
    return `  digitalWrite(${pin}, ${state}); // ${spec.name}\n  delay(500);\n`;
  };
}

// ─── Main export: idempotent registration ────────────────────────────────────
/**
 * Registers a ComponentSpec as a Blockly block + Arduino generator.
 * Safe to call multiple times — skips if the block type is already registered.
 * Returns true if a new registration happened, false if it was a no-op.
 */
export function registerRuntimeBlock(spec: ComponentSpec): boolean {
  const blockType = `hardware_${spec.name}`;
  if ((Blockly.Blocks as any)[blockType]) return false;

  try {
    Blockly.common.defineBlocksWithJsonArray([specToBlockJson(spec)]);
    registerArduinoGen(spec);
    return true;
  } catch (err) {
    console.error(`[registerRuntimeBlock] Failed to register ${blockType}:`, err);
    return false;
  }
}
