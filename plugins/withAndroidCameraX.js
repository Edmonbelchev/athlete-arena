const { withAppBuildGradle, createRunOncePlugin } = require('expo/config-plugins');

/** Must match react-native-vision-camera/android/build.gradle */
const CAMERAX_VERSION = '1.5.0-alpha03';
const PLUGIN_NAME = 'with-android-camerax';

/**
 * Mediapipe depends on camera-core 1.3.3 while Vision Camera needs CameraX 1.5
 * (including camera-camera2 internal classes). Align versions at the app level.
 */
function withAndroidCameraX(config) {
  return withAppBuildGradle(config, (config) => {
    if (config.modResults.language !== 'groovy') {
      return config;
    }

    let contents = config.modResults.contents;

    if (!contents.includes(`${PLUGIN_NAME}-resolution`)) {
      const resolutionBlock = `
// @generated begin ${PLUGIN_NAME}-resolution - expo prebuild (DO NOT MODIFY)
configurations.configureEach {
    resolutionStrategy {
        force "androidx.camera:camera-core:${CAMERAX_VERSION}"
        force "androidx.camera:camera-camera2:${CAMERAX_VERSION}"
        force "androidx.camera:camera-lifecycle:${CAMERAX_VERSION}"
        force "androidx.camera:camera-view:${CAMERAX_VERSION}"
        force "androidx.camera:camera-video:${CAMERAX_VERSION}"
        force "androidx.camera:camera-extensions:${CAMERAX_VERSION}"
    }
}
// @generated end ${PLUGIN_NAME}-resolution
`;
      contents = contents.replace(/^dependencies \{/m, `${resolutionBlock}\ndependencies {`);
    }

    if (!contents.includes(`${PLUGIN_NAME}-deps`)) {
      const depsBlock = `
    // @generated begin ${PLUGIN_NAME}-deps - expo prebuild (DO NOT MODIFY)
    implementation "androidx.camera:camera-core:${CAMERAX_VERSION}"
    implementation "androidx.camera:camera-camera2:${CAMERAX_VERSION}"
    implementation "androidx.camera:camera-lifecycle:${CAMERAX_VERSION}"
    // @generated end ${PLUGIN_NAME}-deps
`;
      contents = contents.replace(/^dependencies \{/m, `dependencies {${depsBlock}`);
    }

    config.modResults.contents = contents;
    return config;
  });
}

module.exports = createRunOncePlugin(withAndroidCameraX, PLUGIN_NAME, '1.0.0');
