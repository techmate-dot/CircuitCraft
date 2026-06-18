import Blockly from 'blockly';

const arduinoGenerator = new Blockly.Generator('ARDUINO') as any;

// Precedence levels (Standard C++ operators, atomic is highest)
arduinoGenerator.ORDER_ATOMIC = 0;
arduinoGenerator.ORDER_NONE = 99;

arduinoGenerator.init = function(this: any, workspace: any) {
  this.setupLines_ = [];
  this.includeLines_ = [];
};

arduinoGenerator.finish = function(this: any, code: string) {
  const includes = Array.from(new Set(this.includeLines_ as string[])).join('\n');
  const setup = Array.from(new Set(this.setupLines_ as string[])).join('\n  ');

  return `// Live Generated Arduino C++ Sketch (Blockly Workspace)\n\n` +
         `${includes ? includes + '\n\n' : ''}` +
         `void setup() {\n` +
         `  Serial.begin(115200);\n` +
         `  ${setup ? setup + '\n' : ''}` +
         `}\n\n` +
         `void loop() {\n` +
         `${code || '  // Add your project logic here\n'}` +
         `}\n`;
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

export default arduinoGenerator;
