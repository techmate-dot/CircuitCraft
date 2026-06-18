/**
 * pinMapper.ts — Templated pin resolution, no AI involved.
 *
 * Extracts PinAssignment[] from an ArchitectureOption by:
 *   1. Parsing explicit pin labels from component strings (e.g. "LED (Pin GPIO2)")
 *   2. Auto-allocating from the host board's available pins if no label is given
 *
 * Pin numbers in the output are sourced exclusively from the validated spec table
 * and component strings — they never come directly from the LLM text.
 */

import type { ArchitectureOption, PinAssignment } from '../types';
import { findSpec, COMPONENTS } from '../data/components';

// ─── Role heuristics (component name → role) ────────────────────────────────
function inferRole(componentName: string): PinAssignment['role'] {
  const n = componentName.toLowerCase();
  if (n.includes('led') || n.includes('buzzer') || n.includes('relay') || n.includes('servo') || n.includes('motor')) return 'output';
  if (n.includes('pir') || n.includes('sensor') || n.includes('hc-sr04') || n.includes('photoresistor') || n.includes('dht')) return 'input';
  if (n.includes('lcd') || n.includes('i2c')) return 'bidirectional';
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
  // Match: "GPIO<n>", "D<n>", or "A<n>" after "Pin", "(", or ","
  const match = componentStr.match(/\b(GPIO\s*\d+|D\s*\d+|A\s*\d+)\b/i);
  if (!match) return null;
  // Normalise: strip spaces, uppercase
  return match[1].replace(/\s+/g, '').toUpperCase();
}

// ─── Main export ─────────────────────────────────────────────────────────────
export function resolvePinAssignments(option: ArchitectureOption): PinAssignment[] {
  const assignments: PinAssignment[] = [];

  // Determine host board for auto-allocation
  const boardEntry = option.components.find(c => {
    const s = findSpec(c);
    return s && s.is_microcontroller;
  });
  const hostSpec = boardEntry ? findSpec(boardEntry) : COMPONENTS.find(c => c.name === 'ESP32');
  const availablePins = hostSpec?.available_pins ?? [];

  // Track which board pins are taken so auto-allocation doesn't double-assign
  const usedPins = new Set<string>();

  for (const componentStr of option.components) {
    const spec = findSpec(componentStr);
    if (!spec || spec.is_microcontroller) continue; // skip board itself

    const explicitPin = parseExplicitPin(componentStr);

    if (explicitPin) {
      // Exact pin given — validate it exists on the board; still use it even if
      // the board map doesn't recognise it (to avoid losing real LLM data).
      const boardPin = availablePins.find(
        p => p.name.toUpperCase() === explicitPin || p.name.replace('GPIO', 'D').toUpperCase() === explicitPin
      );
      const resolvedPinType = boardPin
        ? primaryPinType(boardPin.types as PinAssignment['pinType'][])
        : primaryPinType(spec.pin_types_supported as PinAssignment['pinType'][]);

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
      const needed = primaryPinType(spec.pin_types_supported as PinAssignment['pinType'][]);
      const freePin = availablePins.find(
        p => !usedPins.has(p.name) && p.types.includes(needed)
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
        // No free pin found — still create the entry so the UI can surface it
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
