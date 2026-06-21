import * as Blockly from 'blockly';

const arduinoGenerator = new Blockly.Generator('ARDUINO') as any;

// Precedence levels (Standard C++ operators, atomic is highest)
arduinoGenerator.ORDER_ATOMIC = 0;
arduinoGenerator.ORDER_NONE = 99;

// Silently skip blocks with no registered generator (e.g., board label blocks)
(arduinoGenerator as any).ignoreUnknownBlocks = true;

arduinoGenerator.init = function(this: any, workspace: any) {
  this.setupLines_ = [];
  this.includeLines_ = [];
  this.setupBlockCode_ = '';
};

arduinoGenerator.finish = function(this: any, code: string) {
  const includes = Array.from(new Set(this.includeLines_ as string[])).join('\n');
  const pinSetup = Array.from(new Set(this.setupLines_ as string[]));
  const setupExtra = (this.setupBlockCode_ as string) || '';

  const setupLines = ['  Serial.begin(115200);'];
  if (pinSetup.length > 0) setupLines.push(`  ${pinSetup.join('\n  ')}`);
  if (setupExtra.trim()) setupLines.push(setupExtra.trimEnd());

  return `// Live Generated Arduino C++ Sketch (Blockly Workspace)\n\n` +
         `${includes ? includes + '\n\n' : ''}` +
         `void setup() {\n` +
         `${setupLines.join('\n')}\n` +
         `}\n\n` +
         `void loop() {\n` +
         `${code || '  // Add your loop logic here\n'}` +
         `}\n`;
};

// ── Arduino structure containers ──────────────────────────────────────────────
arduinoGenerator.forBlock['arduino_setup'] = function(block: any, generator: any) {
  const body = generator.statementToCode(block, 'SETUP_BLOCKS');
  generator.setupBlockCode_ = body;
  return '';
};

arduinoGenerator.forBlock['arduino_loop'] = function(block: any, generator: any) {
  return generator.statementToCode(block, 'LOOP_BLOCKS') || '  // Add your loop logic here\n';
};

// 1. LED Block generator
arduinoGenerator.forBlock['hardware_LED'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const state = block.getFieldValue('STATE') || 'HIGH';
  generator.setupLines_.push(`pinMode(${pin}, OUTPUT);`);
  return `  digitalWrite(${pin}, ${state});\n  delay(1000);\n`;
};

// 2. PIR_Sensor Block generator (IF control block)
arduinoGenerator.forBlock['hardware_PIR_Sensor'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  generator.setupLines_.push(`pinMode(${pin}, INPUT);`);
  const doCode = generator.statementToCode(block, 'DO');
  return `  if (digitalRead(${pin}) == HIGH) {\n  ${doCode || '  // Motion detected\n'}}\n  delay(100);\n`;
};

// 3. HC-SR04 Block generator (Distance read)
arduinoGenerator.forBlock['hardware_HC-SR04'] = function(block: any, generator: any) {
  const trigPin = block.getFieldValue('TRIG_PIN');
  const echoPin = block.getFieldValue('ECHO_PIN');
  generator.setupLines_.push(`pinMode(${trigPin}, OUTPUT);`);
  generator.setupLines_.push(`pinMode(${echoPin}, INPUT);`);

  return `  // Read distance (cm) from HC-SR04\n` +
         `  digitalWrite(${trigPin}, LOW);\n` +
         `  delayMicroseconds(2);\n` +
         `  digitalWrite(${trigPin}, HIGH);\n` +
         `  delayMicroseconds(10);\n` +
         `  digitalWrite(${trigPin}, LOW);\n` +
         `  long duration = pulseIn(${echoPin}, HIGH);\n` +
         `  float distance = duration * 0.034 / 2;\n` +
         `  Serial.print("Distance (cm): ");\n` +
         `  Serial.println(distance);\n  delay(500);\n`;
};

// 4. SG90_Servo Block generator
arduinoGenerator.forBlock['hardware_SG90_Servo'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const angle = block.getFieldValue('ANGLE') || '90';
  generator.includeLines_.push('#include <Servo.h>');

  const servoName = `myServo_${pin}`;
  generator.includeLines_.push(`Servo ${servoName};`);
  generator.setupLines_.push(`${servoName}.attach(${pin});`);

  return `  ${servoName}.write(${angle});\n  delay(500);\n`;
};

// 5. Buzzer Block generator
arduinoGenerator.forBlock['hardware_Buzzer'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const duration = block.getFieldValue('DURATION') || '200';
  generator.setupLines_.push(`pinMode(${pin}, OUTPUT);`);
  return `  tone(${pin}, 1000, ${duration});\n  delay(${duration} + 100);\n`;
};

// 6. Relay_Coil / Relay_Module Block generator
arduinoGenerator.forBlock['hardware_Relay_Coil'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const state = block.getFieldValue('STATE') || 'HIGH';
  generator.setupLines_.push(`pinMode(${pin}, OUTPUT);`);
  return `  digitalWrite(${pin}, ${state});\n  delay(1000);\n`;
};
arduinoGenerator.forBlock['hardware_Relay_Module'] = arduinoGenerator.forBlock['hardware_Relay_Coil'];

// 7. DC_Motor Block generator
arduinoGenerator.forBlock['hardware_DC_Motor'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const speed = block.getFieldValue('SPEED') || '255';
  generator.setupLines_.push(`pinMode(${pin}, OUTPUT);`);
  return `  analogWrite(${pin}, ${speed});\n`;
};

// 8. DHT11 Block generator
arduinoGenerator.forBlock['hardware_DHT11'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  const type = block.getFieldValue('TYPE') || 'temp';
  generator.includeLines_.push('#include <DHT.h>');

  const dhtName = `dht_${pin}`;
  generator.includeLines_.push(`DHT ${dhtName}(${pin}, DHT11);`);
  generator.setupLines_.push(`${dhtName}.begin();`);

  const readCmd = type === 'temp' ? `${dhtName}.readTemperature()` : `${dhtName}.readHumidity()`;
  return `  // Read DHT11 sensor\n  float dhtValue = ${readCmd};\n  Serial.println(dhtValue);\n  delay(2000);\n`;
};

// 9. Photoresistor Block generator
arduinoGenerator.forBlock['hardware_Photoresistor'] = function(block: any, generator: any) {
  const pin = block.getFieldValue('PIN');
  return `  int lightLevel = analogRead(${pin});\n  Serial.println(lightLevel);\n  delay(500);\n`;
};

// 10. LCD_I2C Block generator
arduinoGenerator.forBlock['hardware_LCD_I2C'] = function(block: any, generator: any) {
  const sda = block.getFieldValue('SDA_PIN');
  const scl = block.getFieldValue('SCL_PIN');
  const line1 = block.getFieldValue('LINE_1') || '';
  const line2 = block.getFieldValue('LINE_2') || '';

  generator.includeLines_.push('#include <Wire.h>');
  generator.includeLines_.push('#include <LiquidCrystal_I2C.h>');
  generator.includeLines_.push('LiquidCrystal_I2C lcd(0x27, 16, 2);');

  generator.setupLines_.push(`Wire.begin(${sda}, ${scl});`);
  generator.setupLines_.push('lcd.init();');
  generator.setupLines_.push('lcd.backlight();');

  return `  lcd.clear();\n  lcd.setCursor(0, 0);\n  lcd.print("${line1}");\n  lcd.setCursor(0, 1);\n  lcd.print("${line2}");\n  delay(2000);\n`;
};

// 11. OLED_I2C Block generator
arduinoGenerator.forBlock['hardware_OLED_I2C'] = function(block: any, generator: any) {
  const sda = block.getFieldValue('SDA_PIN');
  const scl = block.getFieldValue('SCL_PIN');
  const line1 = block.getFieldValue('LINE_1') || '';
  const line2 = block.getFieldValue('LINE_2') || '';

  generator.includeLines_.push('#include <Wire.h>');
  generator.includeLines_.push('#include <Adafruit_GFX.h>');
  generator.includeLines_.push('#include <Adafruit_SSD1306.h>');
  generator.includeLines_.push('Adafruit_SSD1306 display(128, 64, &Wire, -1);');

  generator.setupLines_.push(`Wire.begin(${sda}, ${scl});`);
  generator.setupLines_.push('if(!display.begin(SSD1306_SWITCHCAPVCC, 0x3C)) { Serial.println(F("SSD1306 allocation failed")); }');
  generator.setupLines_.push('display.clearDisplay();');
  generator.setupLines_.push('display.setTextColor(SSD1306_WHITE);');

  return `  display.clearDisplay();\n` +
         `  display.setCursor(0, 0);\n` +
         `  display.setTextSize(1);\n` +
         `  display.println("${line1}");\n` +
         `  display.println("${line2}");\n` +
         `  display.display();\n` +
         `  delay(2000);\n`;
};

// ── Standard Blockly control/logic/math block generators ─────────────────────
// These allow blocks from the Logic panel to produce Arduino C++ output.

arduinoGenerator.forBlock['controls_if'] = function(block: any, generator: any) {
  let n = 0;
  let code = '';
  do {
    const cond = generator.valueToCode(block, `IF${n}`, generator.ORDER_NONE) || 'false';
    const branch = generator.statementToCode(block, `DO${n}`);
    code += (n === 0 ? 'if' : ' else if') + ` (${cond}) {\n${branch}}`;
    n++;
  } while (block.getInput(`IF${n}`));
  if (block.getInput('ELSE')) {
    code += ` else {\n${generator.statementToCode(block, 'ELSE')}}`;
  }
  return code + '\n';
};

arduinoGenerator.forBlock['controls_repeat_ext'] = function(block: any, generator: any) {
  const count = generator.valueToCode(block, 'TIMES', generator.ORDER_NONE) || '10';
  const body = generator.statementToCode(block, 'DO');
  return `for (int count = 0; count < ${count}; count++) {\n${body}}\n`;
};

arduinoGenerator.forBlock['controls_whileUntil'] = function(block: any, generator: any) {
  const until = block.getFieldValue('MODE') === 'UNTIL';
  let cond = generator.valueToCode(block, 'BOOL', generator.ORDER_NONE) || 'false';
  if (until) cond = `!(${cond})`;
  const body = generator.statementToCode(block, 'DO');
  return `while (${cond}) {\n${body}}\n`;
};

arduinoGenerator.forBlock['controls_for'] = function(block: any, generator: any) {
  const varName = block.getField?.('VAR')?.getText?.() ?? 'i';
  const from = generator.valueToCode(block, 'FROM', generator.ORDER_NONE) || '0';
  const to   = generator.valueToCode(block, 'TO',   generator.ORDER_NONE) || '9';
  const by   = generator.valueToCode(block, 'BY',   generator.ORDER_NONE) || '1';
  const body = generator.statementToCode(block, 'DO');
  return `for (int ${varName} = ${from}; ${varName} <= ${to}; ${varName} += ${by}) {\n${body}}\n`;
};

arduinoGenerator.forBlock['logic_compare'] = function(block: any, generator: any) {
  const ops: Record<string, string> = { EQ: '==', NEQ: '!=', LT: '<', LTE: '<=', GT: '>', GTE: '>=' };
  const op = ops[block.getFieldValue('OP')] ?? '==';
  const left  = generator.valueToCode(block, 'A', generator.ORDER_NONE) || '0';
  const right = generator.valueToCode(block, 'B', generator.ORDER_NONE) || '0';
  return [`(${left} ${op} ${right})`, generator.ORDER_NONE];
};

arduinoGenerator.forBlock['logic_operation'] = function(block: any, generator: any) {
  const op = block.getFieldValue('OP') === 'AND' ? '&&' : '||';
  const left  = generator.valueToCode(block, 'A', generator.ORDER_NONE) || 'false';
  const right = generator.valueToCode(block, 'B', generator.ORDER_NONE) || 'false';
  return [`(${left} ${op} ${right})`, generator.ORDER_NONE];
};

arduinoGenerator.forBlock['logic_negate'] = function(block: any, generator: any) {
  const val = generator.valueToCode(block, 'BOOL', generator.ORDER_NONE) || 'false';
  return [`!(${val})`, generator.ORDER_NONE];
};

arduinoGenerator.forBlock['logic_boolean'] = function(block: any, _generator: any) {
  return [block.getFieldValue('BOOL') === 'TRUE' ? 'true' : 'false', 0 /* ORDER_ATOMIC */];
};

arduinoGenerator.forBlock['math_number'] = function(block: any, _generator: any) {
  return [String(Number(block.getFieldValue('NUM')) || 0), 0 /* ORDER_ATOMIC */];
};

arduinoGenerator.forBlock['math_arithmetic'] = function(block: any, generator: any) {
  const ops: Record<string, string> = { ADD: '+', MINUS: '-', MULTIPLY: '*', DIVIDE: '/', POWER: '^' };
  const op   = ops[block.getFieldValue('OP')] ?? '+';
  const left  = generator.valueToCode(block, 'A', generator.ORDER_NONE) || '0';
  const right = generator.valueToCode(block, 'B', generator.ORDER_NONE) || '0';
  if (op === '^') return [`pow(${left}, ${right})`, generator.ORDER_NONE];
  return [`(${left} ${op} ${right})`, generator.ORDER_NONE];
};

arduinoGenerator.forBlock['math_modulo'] = function(block: any, generator: any) {
  const left  = generator.valueToCode(block, 'DIVIDEND', generator.ORDER_NONE) || '0';
  const right = generator.valueToCode(block, 'DIVISOR',  generator.ORDER_NONE) || '1';
  return [`(${left} % ${right})`, generator.ORDER_NONE];
};

arduinoGenerator.forBlock['variables_get'] = function(block: any, _generator: any) {
  const name = block.getField?.('VAR')?.getText?.() ?? 'myVar';
  return [name, 0 /* ORDER_ATOMIC */];
};

arduinoGenerator.forBlock['variables_set'] = function(block: any, generator: any) {
  const name = block.getField?.('VAR')?.getText?.() ?? 'myVar';
  const val  = generator.valueToCode(block, 'VALUE', generator.ORDER_NONE) || '0';
  return `${name} = ${val};\n`;
};

arduinoGenerator.forBlock['text'] = function(block: any, _generator: any) {
  return [`"${block.getFieldValue('TEXT')}"`, 0 /* ORDER_ATOMIC */];
};

// hardware_delay: simple delay(ms) statement
arduinoGenerator.forBlock['hardware_delay'] = function(block: any, _generator: any) {
  const ms = block.getFieldValue('DELAY_MS') ?? '1000';
  return `  delay(${ms});\n`;
};

// hardware_serial_print: Serial.println(text)
arduinoGenerator.forBlock['hardware_serial_print'] = function(block: any, _generator: any) {
  const text = block.getFieldValue('TEXT') ?? '';
  return `  Serial.println("${text}");\n`;
};

export default arduinoGenerator;
