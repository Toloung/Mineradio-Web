import fs from 'node:fs';
import path from 'node:path';

const files = [
  'node_modules/@capacitor/android/capacitor/build.gradle',
  'android/app/capacitor.build.gradle',
  'android/capacitor-cordova-android-plugins/build.gradle',
];

for (const relativePath of files) {
  const filePath = path.resolve(relativePath);
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replaceAll('JavaVersion.VERSION_21', 'JavaVersion.VERSION_17');
  fs.writeFileSync(filePath, content);
  console.log(`Configured Java 17: ${relativePath}`);
}
