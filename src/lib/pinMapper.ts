/**
 * pinMapper.ts — Templated pin resolution, no AI involved.
 *
 * Extracts PinAssignment[] from an ArchitectureOption by:
 *   1. Parsing explicit pin labels from component strings (e.g. "LED (Pin GPIO2)")
 *   2. Auto-allocating from the host board's available pins if no label is given
 *
 * Pin numbers in the output are sourced exclusively from the validated spec table
 * and component strings — they never come directly from the LLM text.
 *
 * v2 update: uses BoardProfile.pins instead of deprecated ComponentSpec.available_pins.
 */

import type { ArchitectureOption, PinAssignment } from '../types';
import { findSpec, resolveBoard } from '../data/components';

// ─── Role heuristics (component name → role) ────────────────────────────────
function inferRole(componentName: string): PinAssignment['role'] {
  const n = componentName.toLowerCase();
  if (n.includes('led') || n.includes('buzzer') || n.includes('relay') || n.includes('servo') || n.includes('motor')) return 'output';
  if (n.includes('pir') || n.includes('sensor') || n.includes('hc-sr04') || n.includes('photoresistor') || n.includes('dht')) return 'input';
  if (n.includes('lcd') || n.includes('oled') || n.includes('i2c')) return 'bidirectional';
  return 'output';
}

// ─── Pin type heuristics (spec → primary pin type) ──────────────────────────
function primaryPinType(types: PinAssignment['pinType'][]): PinAssignment['pinType'] {
  if (types.includes('i2c')) return 'i2c';
  if (types.includes('pwm')) return 'pwm';
  if (types.includes('interrupt')) return 'interrupt';
  if (types.includes('analog')) return 'analog';
  return 'digital';
}

// ─── Parse explicit pin label from component string ─────────────────────────
// Handles: "LED (Pin GPIO2)", "Buzzer (GPIO5)", "HC-SR04 (D5, D18)"
function parseExplicitPin(componentStr: string): string | null {
  const match = componentStr.match(/\b(GPIO\s*\d+|D\s*\d+|A\s*\d+)\b/i);
  if (!match) return null;
  return match[1].replace(/\s+/g, '').toUpperCase();
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function resolvePinAssignments(option: ArchitectureOption): PinAssignment[] {
  const assignments: PinAssignment[] = [];

  // Use BoardProfile.pins (v2 two-tier model) instead of ComponentSpec.available_pins
  const board = resolveBoard(option);
  const availablePins = board.pins;

  // Track which board pins are taken so auto-allocation doesn't double-assign
  const usedPins = new Set<string>();

  for (const componentStr of option.components) {
    const spec = findSpec(componentStr);
    if (!spec || spec.is_microcontroller) continue; // skip board itself

    const explicitPin = parseExplicitPin(componentStr);
    const specPinTypes = spec.pin_types_required as PinAssignment['pinType'][];

    if (explicitPin) {
      // Exact pin given — look it up in the BoardProfile
      const boardPin = availablePins.find(
        p => p.name.toUpperCase() === explicitPin || p.name.replace('GPIO', 'D').toUpperCase() === explicitPin
      );
      const resolvedPinType = boardPin
        ? primaryPinType(boardPin.types as PinAssignment['pinType'][])
        : primaryPinType(specPinTypes);

      usedPins.add(explicitPin);
      assignments.push({
        component: spec.name,
        rawLabel: componentStr,
        pin: explicitPin,
        pinType: resolvedPinType,
        role: inferRole(componentStr),
      });
    } else {
      // Auto-allocate: find the first free board pin that supports the needed type
      const needed = specPinTypes.length > 0 ? primaryPinType(specPinTypes) : 'digital';
      const freePin = availablePins.find(
        p => !p.reserved && !usedPins.has(p.name) && p.types.includes(needed as any)
      );

      if (freePin) {
        usedPins.add(freePin.name);
        assignments.push({
          component: spec.name,
          rawLabel: componentStr,
          pin: freePin.name,
          pinType: needed,
          role: inferRole(componentStr),
        });
      } else {
        assignments.push({
          component: spec.name,
          rawLabel: componentStr,
          pin: 'UNASSIGNED',
          pinType: needed,
          role: inferRole(componentStr),
        });
      }
    }
  }

  return assignments;
}
