const { withProjectBuildGradle } = require('expo/config-plugins');

const KOTLIN_VERSION = '2.3.0';

/**
 * Force Kotlin Gradle plugin 2.3.x so play-services-ads 25.x compiles
 * (react-native-purchases-ui / google-mobile-ads). RN's default catalog
 * pins Kotlin 2.1.x which cannot read Kotlin 2.3 metadata.
 */
function withAndroidKotlinGradle(config) {
  return withProjectBuildGradle(config, (modConfig) => {
    let contents = modConfig.modResults.contents;
    if (!contents.includes('expo-kotlin-gradle-plugin-pin')) {
      contents = contents.replace(
        'buildscript {\n  repositories {',
        `buildscript {\n  // expo-kotlin-gradle-plugin-pin\n  ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '${KOTLIN_VERSION}'\n  repositories {`,
      );
      contents = contents.replace(
        "classpath('org.jetbrains.kotlin:kotlin-gradle-plugin')",
        'classpath("org.jetbrains.kotlin:kotlin-gradle-plugin:$kotlinVersion")',
      );
      contents = contents.replace(
        'apply plugin: "expo-root-project"',
        `ext.kotlinVersion = findProperty('android.kotlinVersion') ?: '${KOTLIN_VERSION}'\napply plugin: "expo-root-project"`,
      );
    }
    modConfig.modResults.contents = contents;
    return modConfig;
  });
}

module.exports = withAndroidKotlinGradle;
